import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { UsuarioAutenticado } from '../common/types/usuario-autenticado';
import { AuthDbService } from '../database/auth-db.service';
import { DatabaseService, isDuplicateEntry } from '../database/database.service';
import { MailService } from '../mail/mail.service';
import { DadosPagamentoDto, LoginDto, RegisterDto } from './auth.dto';

interface UsuarioRow {
  id: number;
  nome: string;
  nome_exibicao: string | null;
  email: string;
  senha_hash: string;
  perfil: 'ADMIN' | 'USUARIO';
  ativo: number;
  email_verificado: number;
  aprovado: number;
  deve_trocar_senha: number;
  tema: 'claro' | 'escuro' | null;
}

type TipoToken = 'CONFIRMACAO_EMAIL' | 'RECUPERACAO_SENHA';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly googleClientId: string | null;
  private readonly googleClient: OAuth2Client | null;

  constructor(
    private readonly db: DatabaseService,
    private readonly authDb: AuthDbService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID')?.trim() || null;
    this.googleClientId = clientId;
    this.googleClient = clientId ? new OAuth2Client(clientId) : null;
  }

  obterConfigPublica() {
    return { googleClientId: this.googleClientId };
  }

  private async avisarAdminsCadastroPendente(nome: string, email: string) {
    const admins = await this.db.query<{ nome: string; email: string }>(
      `SELECT COALESCE(NULLIF(TRIM(nome_exibicao), ''), nome) AS nome, email
         FROM usuarios WHERE perfil = 'ADMIN' AND ativo = 1`,
    );
    const envios = await Promise.allSettled(
      admins.map((a) =>
        this.mail.enviarAvisoNovoCadastroPendente(a.email, a.nome, nome, email),
      ),
    );
    for (const e of envios) {
      if (e.status === 'rejected') {
        this.logger.error('Falha ao avisar admin sobre cadastro pendente', e.reason);
      }
    }
  }

  private async dominioAutoAprovado(email: string): Promise<boolean> {
    const dominio = email.split('@')[1]?.toLowerCase();
    if (!dominio) return false;
    const [cfg] = await this.db.query<{ valor: string | null }>(
      `SELECT valor FROM configuracoes_sistema WHERE chave = 'dominios_auto_aprovados'`,
    );
    if (!cfg?.valor) return false;
    const lista = cfg.valor
      .split(',')
      .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
      .filter(Boolean);
    return lista.includes(dominio);
  }

  async register(dto: RegisterDto) {
    const nome = dto.nome.trim();
    const email = dto.email.trim().toLowerCase();
    const senhaHash = await argon2.hash(dto.senha, { type: argon2.argon2id });
    const autoAprovado = await this.dominioAutoAprovado(email);

    if (this.authDb.habilitado) {
      const contaExistente = await this.authDb.buscarPorEmail(email);
      if (contaExistente) {
        throw new ConflictException(
          'Este e-mail ja possui uma conta Studios Melk. Faca login com sua senha atual.',
        );
      }
    }

    let usuarioId: number;
    try {
      const res = await this.db.execute(
        `INSERT INTO usuarios (nome, nome_exibicao, email, senha_hash, perfil, ativo, email_verificado, aprovado, deve_trocar_senha, criado_em, atualizado_em)
         VALUES (?, ?, ?, ?, 'USUARIO', 1, 0, ?, 0, NOW(), NOW())`,
        [nome, nome, email, senhaHash, autoAprovado ? 1 : 0],
      );
      usuarioId = res.insertId;
    } catch (erro) {
      if (isDuplicateEntry(erro)) {
        throw new ConflictException('Este e-mail ja esta cadastrado.');
      }
      throw erro;
    }

    await this.authDb.criarOuSincronizarConta({
      nome,
      nomeExibicao: nome,
      email,
      senhaHash,
      emailVerificado: false,
    });

    const token = await this.criarToken(usuarioId, 'CONFIRMACAO_EMAIL', 24 * 60);
    await this.mail.enviarConfirmacaoEmail(email, nome, token);

    return {
      mensagem: autoAprovado
        ? 'Cadastro realizado! Enviamos um link de confirmacao para o seu e-mail. Confirme antes de entrar.'
        : 'Cadastro realizado! Confirme seu e-mail pelo link enviado e aguarde a aprovacao de um administrador para acessar.',
      email,
      aguardandoAprovacao: !autoAprovado,
    };
  }

  async confirmarEmail(token: string) {
    const tokenHash = hashToken(token.trim());

    const usuarioConfirmado = await this.db.transaction(async (tx) => {
      const [row] = await tx.query<{ id: number; usuario_id: number }>(
        `SELECT id, usuario_id
           FROM tokens_autenticacao
          WHERE token_hash = ?
            AND tipo = 'CONFIRMACAO_EMAIL'
            AND usado_em IS NULL
            AND expira_em > NOW()
          FOR UPDATE`,
        [tokenHash],
      );
      if (!row) {
        throw new BadRequestException(
          'Link de confirmacao invalido ou expirado. Solicite um novo link.',
        );
      }

      await tx.execute(
        'UPDATE usuarios SET email_verificado = 1, atualizado_em = NOW() WHERE id = ?',
        [row.usuario_id],
      );
      await tx.execute(
        'UPDATE tokens_autenticacao SET usado_em = NOW() WHERE id = ?',
        [row.id],
      );

      const [u] = await tx.query<{
        nome: string;
        email: string;
        aprovado: number;
      }>('SELECT nome, email, aprovado FROM usuarios WHERE id = ?', [
        row.usuario_id,
      ]);
      return u;
    });

    if (usuarioConfirmado) {
      await this.authDb.marcarEmailVerificado(usuarioConfirmado.email);
    }

    // Se ainda aguarda aprovacao, avisa todos os ADMINs ativos por e-mail
    if (usuarioConfirmado && !usuarioConfirmado.aprovado) {
      await this.avisarAdminsCadastroPendente(
        usuarioConfirmado.nome,
        usuarioConfirmado.email,
      );
      return {
        mensagem:
          'E-mail confirmado! Seu cadastro agora esta aguardando aprovacao de um administrador. Voce recebera um e-mail assim que for liberado.',
      };
    }

    return { mensagem: 'E-mail confirmado com sucesso! Agora voce ja pode entrar.' };
  }

  async reenviarConfirmacao(emailRaw: string) {
    const email = emailRaw.trim().toLowerCase();
    const [row] = await this.db.query<{
      id: number;
      nome: string;
      ativo: number;
      email_verificado: number;
    }>(
      'SELECT id, nome, ativo, email_verificado FROM usuarios WHERE email = ?',
      [email],
    );

    if (row && row.ativo && !row.email_verificado) {
      const token = await this.criarToken(row.id, 'CONFIRMACAO_EMAIL', 24 * 60);
      await this.mail.enviarConfirmacaoEmail(email, row.nome, token);
    }

    return {
      mensagem:
        'Se o e-mail estiver cadastrado e aguardando confirmacao, um novo link foi enviado.',
    };
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();

    // Quando o Banco de Contas compartilhado esta ativo, ele e a fonte unica de senha/status
    if (this.authDb.habilitado) {
      const conta = await this.authDb.buscarPorEmail(email);
      if (conta) {
        const validoConta =
          Boolean(conta.ativo) &&
          (await this.verificar(conta.senha_hash, dto.senha));
        if (!validoConta) {
          throw new UnauthorizedException('Credenciais invalidas.');
        }
        if (!conta.email_verificado) {
          throw new ForbiddenException(
            'E-mail ainda nao confirmado. Verifique sua caixa de entrada ou solicite o reenvio do link.',
          );
        }

        let [row] = await this.db.query<UsuarioRow>(
          `SELECT id, nome, nome_exibicao, email, senha_hash, perfil, ativo, email_verificado, aprovado, deve_trocar_senha, tema
             FROM usuarios WHERE email = ?`,
          [email],
        );

        const nomeExibConta = conta.nome_exibicao?.trim() || conta.nome;

        // Usuario criou conta em outro site Studios Melk (ex.: Bolao) e entrou aqui pela 1a vez
        if (!row) {
          const autoAprovado = await this.dominioAutoAprovado(email);
          const res = await this.db.execute(
            `INSERT INTO usuarios (nome, nome_exibicao, email, senha_hash, perfil, ativo, email_verificado, aprovado, deve_trocar_senha, tema, criado_em, atualizado_em)
             VALUES (?, ?, ?, ?, 'USUARIO', 1, 1, ?, ?, ?, NOW(), NOW())`,
            [
              conta.nome,
              nomeExibConta,
              email,
              conta.senha_hash,
              autoAprovado ? 1 : 0,
              conta.deve_trocar_senha ? 1 : 0,
              conta.tema === 'escuro' ? 'escuro' : 'claro',
            ],
          );
          if (!autoAprovado) {
            await this.avisarAdminsCadastroPendente(nomeExibConta, email);
            throw new ForbiddenException(
              'Sua conta Studios Melk foi vinculada ao Cafezinho Infor e aguarda aprovacao de um administrador.',
            );
          }
          [row] = await this.db.query<UsuarioRow>(
            `SELECT id, nome, nome_exibicao, email, senha_hash, perfil, ativo, email_verificado, aprovado, deve_trocar_senha, tema
               FROM usuarios WHERE id = ?`,
            [res.insertId],
          );
        } else {
          if (!row.ativo) {
            throw new UnauthorizedException('Credenciais invalidas.');
          }
          // Espelha eventual alteracao de senha/tema/nome_exibicao feita em outro site Studios Melk
          if (
            row.senha_hash !== conta.senha_hash ||
            Boolean(row.deve_trocar_senha) !== Boolean(conta.deve_trocar_senha) ||
            !row.email_verificado ||
            row.tema !== conta.tema ||
            (row.nome_exibicao?.trim() || row.nome) !== nomeExibConta
          ) {
            await this.db.execute(
              `UPDATE usuarios
                  SET senha_hash = ?, deve_trocar_senha = ?, email_verificado = 1, tema = ?, nome_exibicao = ?, atualizado_em = NOW()
                WHERE id = ?`,
              [
                conta.senha_hash,
                conta.deve_trocar_senha ? 1 : 0,
                conta.tema === 'escuro' ? 'escuro' : 'claro',
                nomeExibConta,
                row.id,
              ],
            );
            row.deve_trocar_senha = conta.deve_trocar_senha;
            row.tema = conta.tema;
            row.nome_exibicao = nomeExibConta;
          }
          if (!row.aprovado) {
            throw new ForbiddenException(
              'Seu cadastro esta aguardando aprovacao de um administrador.',
            );
          }
        }

        const usuario: UsuarioAutenticado = {
          id: row.id,
          nome: row.nome,
          nomeExibicao: row.nome_exibicao?.trim() || row.nome,
          email: row.email,
          perfil: row.perfil,
          deveTrocarSenha: Boolean(row.deve_trocar_senha),
          tema: row.tema === 'escuro' ? 'escuro' : 'claro',
        };
        return { token: await this.assinar(usuario), usuario };
      }
    }

    const [row] = await this.db.query<UsuarioRow>(
      `SELECT id, nome, nome_exibicao, email, senha_hash, perfil, ativo, email_verificado, aprovado, deve_trocar_senha, tema
         FROM usuarios WHERE email = ?`,
      [email],
    );

    const valido =
      !!row && !!row.ativo && (await this.verificar(row.senha_hash, dto.senha));
    if (!valido) throw new UnauthorizedException('Credenciais invalidas.');

    if (!row.email_verificado) {
      throw new ForbiddenException(
        'E-mail ainda nao confirmado. Verifique sua caixa de entrada ou solicite o reenvio do link.',
      );
    }

    if (!row.aprovado) {
      throw new ForbiddenException(
        'Seu cadastro esta aguardando aprovacao de um administrador.',
      );
    }

    const usuario: UsuarioAutenticado = {
      id: row.id,
      nome: row.nome,
      nomeExibicao: row.nome_exibicao?.trim() || row.nome,
      email: row.email,
      perfil: row.perfil,
      deveTrocarSenha: Boolean(row.deve_trocar_senha),
      tema: row.tema === 'escuro' ? 'escuro' : 'claro',
    };
    return { token: await this.assinar(usuario), usuario };
  }

  async autenticarGoogle(credential: string) {
    if (!this.googleClientId || !this.googleClient) {
      throw new BadRequestException('Login com Google nao esta configurado.');
    }

    let payload:
      | { email?: string; email_verified?: boolean; name?: string }
      | undefined;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: credential,
        audience: this.googleClientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Token do Google invalido ou expirado.');
    }

    if (!payload?.email || !payload.email_verified) {
      throw new UnauthorizedException(
        'Conta Google sem e-mail verificado.',
      );
    }

    const email = payload.email.trim().toLowerCase();
    const nome = (payload.name?.trim() || email.split('@')[0]).slice(0, 120);

    const [existente] = await this.db.query<UsuarioRow>(
      `SELECT id, nome, nome_exibicao, email, senha_hash, perfil, ativo, email_verificado, aprovado, deve_trocar_senha, tema
         FROM usuarios WHERE email = ?`,
      [email],
    );

    if (existente) {
      if (!existente.ativo) {
        throw new UnauthorizedException('Usuario inativo.');
      }
      if (!existente.email_verificado) {
        await this.db.execute(
          'UPDATE usuarios SET email_verificado = 1, atualizado_em = NOW() WHERE id = ?',
          [existente.id],
        );
        await this.authDb.marcarEmailVerificado(email);
      }
      if (!existente.aprovado) {
        throw new ForbiddenException(
          'Seu cadastro esta aguardando aprovacao de um administrador.',
        );
      }
      const usuario: UsuarioAutenticado = {
        id: existente.id,
        nome: existente.nome,
        nomeExibicao: existente.nome_exibicao?.trim() || existente.nome,
        email: existente.email,
        perfil: existente.perfil,
        deveTrocarSenha: Boolean(existente.deve_trocar_senha),
        tema: existente.tema === 'escuro' ? 'escuro' : 'claro',
      };
      return { token: await this.assinar(usuario), usuario };
    }

    const autoAprovado = await this.dominioAutoAprovado(email);
    const senhaAleatoria = randomBytes(32).toString('hex');
    const senhaHash = await argon2.hash(senhaAleatoria, {
      type: argon2.argon2id,
    });

    let usuarioId: number;
    try {
      const res = await this.db.execute(
        `INSERT INTO usuarios (nome, nome_exibicao, email, senha_hash, perfil, ativo, email_verificado, aprovado, deve_trocar_senha, criado_em, atualizado_em)
         VALUES (?, ?, ?, ?, 'USUARIO', 1, 1, ?, 0, NOW(), NOW())`,
        [nome, nome, email, senhaHash, autoAprovado ? 1 : 0],
      );
      usuarioId = res.insertId;
    } catch (erro) {
      if (isDuplicateEntry(erro)) {
        throw new ConflictException(
          'Este e-mail acabou de ser cadastrado. Tente entrar novamente.',
        );
      }
      throw erro;
    }

    await this.authDb.criarOuSincronizarConta({
      nome,
      nomeExibicao: nome,
      email,
      senhaHash,
      emailVerificado: true,
    });

    if (autoAprovado) {
      const usuario: UsuarioAutenticado = {
        id: usuarioId,
        nome,
        nomeExibicao: nome,
        email,
        perfil: 'USUARIO',
        deveTrocarSenha: false,
        tema: 'claro',
      };
      return { token: await this.assinar(usuario), usuario };
    }

    await this.avisarAdminsCadastroPendente(nome, email);
    return {
      aguardandoAprovacao: true as const,
      email,
      mensagem:
        'Conta criada com o Google! Seu cadastro agora esta aguardando aprovacao de um administrador. Voce recebera um e-mail assim que for liberado.',
    };
  }

  async esqueciSenha(emailRaw: string) {
    const email = emailRaw.trim().toLowerCase();
    const [row] = await this.db.query<{ id: number; nome: string; ativo: number }>(
      `SELECT id, COALESCE(NULLIF(TRIM(nome_exibicao), ''), nome) AS nome, ativo
         FROM usuarios WHERE email = ?`,
      [email],
    );

    if (row && row.ativo) {
      const token = await this.criarToken(row.id, 'RECUPERACAO_SENHA', 60);
      await this.mail.enviarRecuperacaoSenha(email, row.nome, token);
    }

    return {
      mensagem:
        'Se o e-mail estiver cadastrado, enviamos instrucoes para redefinir sua senha.',
    };
  }

  async redefinirSenha(token: string, novaSenha: string) {
    const tokenHash = hashToken(token.trim());
    const senhaHash = await argon2.hash(novaSenha, { type: argon2.argon2id });

    const emailAtualizado = await this.db.transaction(async (tx) => {
      const [row] = await tx.query<{ id: number; usuario_id: number }>(
        `SELECT id, usuario_id
           FROM tokens_autenticacao
          WHERE token_hash = ?
            AND tipo = 'RECUPERACAO_SENHA'
            AND usado_em IS NULL
            AND expira_em > NOW()
          FOR UPDATE`,
        [tokenHash],
      );
      if (!row) {
        throw new BadRequestException(
          'Link de recuperacao invalido ou expirado. Solicite uma nova recuperacao.',
        );
      }

      await tx.execute(
        `UPDATE usuarios
            SET senha_hash = ?, deve_trocar_senha = 0, email_verificado = 1, atualizado_em = NOW()
          WHERE id = ?`,
        [senhaHash, row.usuario_id],
      );
      await tx.execute(
        'UPDATE tokens_autenticacao SET usado_em = NOW() WHERE id = ?',
        [row.id],
      );
      const [u] = await tx.query<{ email: string }>(
        'SELECT email FROM usuarios WHERE id = ?',
        [row.usuario_id],
      );
      return u?.email ?? null;
    });

    if (emailAtualizado) {
      await this.authDb.atualizarSenha(emailAtualizado, senhaHash, false, true);
    }

    return { mensagem: 'Senha redefinida com sucesso! Agora voce ja pode entrar.' };
  }

  async trocarSenhaObrigatoria(usuario: UsuarioAutenticado, novaSenha: string) {
    const senhaHash = await argon2.hash(novaSenha, { type: argon2.argon2id });
    await this.db.execute(
      `UPDATE usuarios
          SET senha_hash = ?, deve_trocar_senha = 0, atualizado_em = NOW()
        WHERE id = ?`,
      [senhaHash, usuario.id],
    );
    await this.authDb.atualizarSenha(usuario.email, senhaHash, false);
    return {
      mensagem: 'Nova senha cadastrada com sucesso!',
      usuario: { ...usuario, deveTrocarSenha: false },
    };
  }

  async obterDadosPagamento(usuarioId: number) {
    const [row] = await this.db.query<{
      pixChave: string | null;
      banco: string | null;
      agencia: string | null;
      conta: string | null;
    }>(
      `SELECT pix_chave AS pixChave, banco, agencia, conta
         FROM usuarios WHERE id = ?`,
      [usuarioId],
    );
    return (
      row ?? { pixChave: null, banco: null, agencia: null, conta: null }
    );
  }

  async salvarDadosPagamento(usuarioId: number, dto: DadosPagamentoDto) {
    const limpar = (v?: string | null) => {
      const t = v?.trim();
      return t ? t : null;
    };
    await this.db.execute(
      `UPDATE usuarios
          SET pix_chave = ?, banco = ?, agencia = ?, conta = ?, atualizado_em = NOW()
        WHERE id = ?`,
      [
        limpar(dto.pixChave),
        limpar(dto.banco),
        limpar(dto.agencia),
        limpar(dto.conta),
        usuarioId,
      ],
    );
    return this.obterDadosPagamento(usuarioId);
  }

  async salvarPreferenciasEmail(
    usuarioId: number,
    receberEmailsCafe: boolean,
  ) {
    await this.db.execute(
      `UPDATE usuarios
          SET receber_emails_cafe = ?, atualizado_em = NOW()
        WHERE id = ?`,
      [receberEmailsCafe ? 1 : 0, usuarioId],
    );
    return { receberEmailsCafe };
  }

  async salvarTema(usuarioId: number, tema: 'claro' | 'escuro') {
    await this.db.execute(
      `UPDATE usuarios
          SET tema = ?, atualizado_em = NOW()
        WHERE id = ?`,
      [tema, usuarioId],
    );
    const [u] = await this.db.query<{ email: string }>(
      'SELECT email FROM usuarios WHERE id = ?',
      [usuarioId],
    );
    if (u?.email) {
      await this.authDb.atualizarTema(u.email, tema);
    }
    return { tema };
  }

  async salvarNomeExibicao(usuarioId: number, nomeExibicaoRaw: string) {
    const nomeExibicao = nomeExibicaoRaw.trim();
    await this.db.execute(
      `UPDATE usuarios
          SET nome_exibicao = ?, atualizado_em = NOW()
        WHERE id = ?`,
      [nomeExibicao, usuarioId],
    );
    const [u] = await this.db.query<{ email: string }>(
      'SELECT email FROM usuarios WHERE id = ?',
      [usuarioId],
    );
    if (u?.email) {
      await this.authDb.atualizarNomeExibicao(u.email, nomeExibicao);
    }
    return { nomeExibicao };
  }

  private async criarToken(
    usuarioId: number,
    tipo: TipoToken,
    minutosValidade: number,
  ): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);

    // Invalida tokens anteriores do mesmo tipo ainda nao usados
    await this.db.execute(
      `UPDATE tokens_autenticacao
          SET usado_em = NOW()
        WHERE usuario_id = ? AND tipo = ? AND usado_em IS NULL`,
      [usuarioId, tipo],
    );

    await this.db.execute(
      `INSERT INTO tokens_autenticacao (usuario_id, tipo, token_hash, expira_em)
       VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
      [usuarioId, tipo, tokenHash, minutosValidade],
    );

    return token;
  }

  private assinar(usuario: UsuarioAutenticado): Promise<string> {
    return this.jwt.signAsync({ sub: usuario.id, perfil: usuario.perfil });
  }

  private async verificar(hash: string, senha: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, senha);
    } catch {
      return false;
    }
  }
}
