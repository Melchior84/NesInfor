import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { UsuarioAutenticado } from '../common/types/usuario-autenticado';
import { DatabaseService, isDuplicateEntry } from '../database/database.service';
import { MailService } from '../mail/mail.service';
import { DadosPagamentoDto, LoginDto, RegisterDto } from './auth.dto';

interface UsuarioRow {
  id: number;
  nome: string;
  email: string;
  senha_hash: string;
  perfil: 'ADMIN' | 'USUARIO';
  ativo: number;
  email_verificado: number;
  aprovado: number;
  deve_trocar_senha: number;
}

type TipoToken = 'CONFIRMACAO_EMAIL' | 'RECUPERACAO_SENHA';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
  ) {}

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

    let usuarioId: number;
    try {
      const res = await this.db.execute(
        `INSERT INTO usuarios (nome, email, senha_hash, perfil, ativo, email_verificado, aprovado, deve_trocar_senha, criado_em, atualizado_em)
         VALUES (?, ?, ?, 'USUARIO', 1, 0, ?, 0, NOW(), NOW())`,
        [nome, email, senhaHash, autoAprovado ? 1 : 0],
      );
      usuarioId = res.insertId;
    } catch (erro) {
      if (isDuplicateEntry(erro)) {
        throw new ConflictException('Este e-mail ja esta cadastrado.');
      }
      throw erro;
    }

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

    // Se ainda aguarda aprovacao, avisa todos os ADMINs ativos por e-mail
    if (usuarioConfirmado && !usuarioConfirmado.aprovado) {
      const admins = await this.db.query<{ nome: string; email: string }>(
        `SELECT nome, email FROM usuarios WHERE perfil = 'ADMIN' AND ativo = 1`,
      );
      const envios = await Promise.allSettled(
        admins.map((a) =>
          this.mail.enviarAvisoNovoCadastroPendente(
            a.email,
            a.nome,
            usuarioConfirmado.nome,
            usuarioConfirmado.email,
          ),
        ),
      );
      for (const e of envios) {
        if (e.status === 'rejected') {
          this.logger.error('Falha ao avisar admin sobre cadastro pendente', e.reason);
        }
      }
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
    const [row] = await this.db.query<UsuarioRow>(
      `SELECT id, nome, email, senha_hash, perfil, ativo, email_verificado, aprovado, deve_trocar_senha
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
      email: row.email,
      perfil: row.perfil,
      deveTrocarSenha: Boolean(row.deve_trocar_senha),
    };
    return { token: await this.assinar(usuario), usuario };
  }

  async esqueciSenha(emailRaw: string) {
    const email = emailRaw.trim().toLowerCase();
    const [row] = await this.db.query<{ id: number; nome: string; ativo: number }>(
      'SELECT id, nome, ativo FROM usuarios WHERE email = ?',
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

    await this.db.transaction(async (tx) => {
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
    });

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
