import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomInt } from 'crypto';
import { UsuarioAutenticado } from '../common/types/usuario-autenticado';
import { DatabaseService } from '../database/database.service';
import { MailService } from '../mail/mail.service';
import { AtualizarUsuarioDto } from './usuarios.dto';

const ALFABETO_TEMP = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
const CHAVE_DOMINIOS = 'dominios_auto_aprovados';

function gerarSenhaTemporaria(tamanho = 10): string {
  let out = '';
  for (let i = 0; i < tamanho; i++) {
    out += ALFABETO_TEMP[randomInt(0, ALFABETO_TEMP.length)];
  }
  return out;
}

@Injectable()
export class UsuariosService {
  private readonly logger = new Logger(UsuariosService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly mail: MailService,
  ) {}

  async listar() {
    const rows = await this.db.query<{
      id: number;
      nome: string;
      email: string;
      perfil: 'ADMIN' | 'USUARIO';
      ativo: number;
      emailVerificado: number;
      aprovado: number;
      deveTrocarSenha: number;
      criadoEm: Date;
    }>(
      `SELECT id, nome, email, perfil, (ativo = 1) AS ativo,
              (email_verificado = 1) AS emailVerificado,
              (aprovado = 1) AS aprovado,
              (deve_trocar_senha = 1) AS deveTrocarSenha,
              criado_em AS criadoEm
         FROM usuarios ORDER BY aprovado ASC, nome ASC`,
    );
    return rows.map((u) => ({
      ...u,
      ativo: Boolean(u.ativo),
      emailVerificado: Boolean(u.emailVerificado),
      aprovado: Boolean(u.aprovado),
      deveTrocarSenha: Boolean(u.deveTrocarSenha),
    }));
  }

  async obterDominiosAprovados(): Promise<{ dominios: string[] }> {
    const [row] = await this.db.query<{ valor: string | null }>(
      'SELECT valor FROM configuracoes_sistema WHERE chave = ?',
      [CHAVE_DOMINIOS],
    );
    const dominios = (row?.valor ?? '')
      .split(',')
      .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
      .filter(Boolean);
    return { dominios };
  }

  async salvarDominiosAprovados(dominiosRaw: string[]): Promise<{ dominios: string[] }> {
    const limpos = Array.from(
      new Set(
        dominiosRaw
          .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
          .filter((d) => d.includes('.') && !d.includes(' ')),
      ),
    );
    await this.db.execute(
      `INSERT INTO configuracoes_sistema (chave, valor)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
      [CHAVE_DOMINIOS, limpos.join(',')],
    );
    return { dominios: limpos };
  }

  async aprovar(id: number) {
    const [alvo] = await this.db.query<{
      id: number;
      nome: string;
      email: string;
      aprovado: number;
    }>('SELECT id, nome, email, aprovado FROM usuarios WHERE id = ?', [id]);
    if (!alvo) throw new NotFoundException('Usuario nao encontrado.');

    await this.db.execute(
      `UPDATE usuarios SET aprovado = 1, ativo = 1, atualizado_em = NOW() WHERE id = ?`,
      [id],
    );

    if (!alvo.aprovado) {
      try {
        await this.mail.enviarCadastroAprovado(alvo.email, alvo.nome);
      } catch (err) {
        this.logger.error('Falha ao enviar e-mail de aprovacao ao usuario', err);
      }
    }

    const [usuario] = await this.db.query(
      `SELECT id, nome, email, perfil, (ativo = 1) AS ativo,
              (email_verificado = 1) AS emailVerificado,
              (aprovado = 1) AS aprovado,
              (deve_trocar_senha = 1) AS deveTrocarSenha
         FROM usuarios WHERE id = ?`,
      [id],
    );
    return usuario;
  }

  async recusar(id: number, atual: UsuarioAutenticado) {
    if (id === atual.id) {
      throw new BadRequestException('Voce nao pode recusar sua propria conta.');
    }
    const [alvo] = await this.db.query<{ id: number; aprovado: number }>(
      'SELECT id, aprovado FROM usuarios WHERE id = ?',
      [id],
    );
    if (!alvo) throw new NotFoundException('Usuario nao encontrado.');
    if (alvo.aprovado) {
      throw new ConflictException(
        'Este usuario ja foi aprovado. Use a opcao Desativar em vez de recusar.',
      );
    }

    await this.db.execute('DELETE FROM usuarios WHERE id = ?', [id]);
    return { mensagem: 'Cadastro recusado e removido.' };
  }

  async atualizar(
    id: number,
    dto: AtualizarUsuarioDto,
    atual: UsuarioAutenticado,
  ) {
    if (id === atual.id && (dto.ativo === false || dto.perfil === 'USUARIO')) {
      throw new BadRequestException(
        'Voce nao pode remover seu proprio acesso de administrador nem se desativar.',
      );
    }

    const sets: string[] = [];
    const params: any[] = [];
    if (dto.perfil !== undefined) {
      sets.push('perfil = ?');
      params.push(dto.perfil);
    }
    if (dto.ativo !== undefined) {
      sets.push('ativo = ?');
      params.push(dto.ativo ? 1 : 0);
    }
    if (!sets.length) throw new BadRequestException('Nada para atualizar.');

    const res = await this.db.execute(
      `UPDATE usuarios SET ${sets.join(', ')}, atualizado_em = NOW() WHERE id = ?`,
      [...params, id],
    );
    if (!res.affectedRows) throw new NotFoundException('Usuario nao encontrado.');

    const [usuario] = await this.db.query(
      `SELECT id, nome, email, perfil, (ativo = 1) AS ativo,
              (email_verificado = 1) AS emailVerificado,
              (aprovado = 1) AS aprovado,
              (deve_trocar_senha = 1) AS deveTrocarSenha
         FROM usuarios WHERE id = ?`,
      [id],
    );
    return usuario;
  }

  /**
   * Zera a senha do usuario para uma senha temporaria e exige troca no proximo login.
   */
  async resetarSenha(id: number, atual: UsuarioAutenticado) {
    if (id === atual.id) {
      throw new BadRequestException(
        'Voce nao pode zerar a propria senha por esta acao.',
      );
    }

    const [alvo] = await this.db.query<{ id: number; nome: string; email: string }>(
      'SELECT id, nome, email FROM usuarios WHERE id = ?',
      [id],
    );
    if (!alvo) throw new NotFoundException('Usuario nao encontrado.');

    const senhaTemporaria = gerarSenhaTemporaria(10);
    const hash = await argon2.hash(senhaTemporaria, { type: argon2.argon2id });

    await this.db.execute(
      `UPDATE usuarios
          SET senha_hash = ?, deve_trocar_senha = 1, email_verificado = 1, aprovado = 1, atualizado_em = NOW()
        WHERE id = ?`,
      [hash, id],
    );

    await this.mail.enviarSenhaZeradaPorAdmin(
      alvo.email,
      alvo.nome,
      senhaTemporaria,
    );

    return {
      mensagem:
        'Senha zerada! Passe a senha temporaria ao usuario; ele sera obrigado a cadastrar uma nova senha no proximo login.',
      usuarioId: alvo.id,
      email: alvo.email,
      senhaTemporaria,
    };
  }
}
