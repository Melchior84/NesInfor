import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomInt } from 'crypto';
import { UsuarioAutenticado } from '../common/types/usuario-autenticado';
import { DatabaseService } from '../database/database.service';
import { MailService } from '../mail/mail.service';
import { AtualizarUsuarioDto } from './usuarios.dto';

const ALFABETO_TEMP = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

function gerarSenhaTemporaria(tamanho = 10): string {
  let out = '';
  for (let i = 0; i < tamanho; i++) {
    out += ALFABETO_TEMP[randomInt(0, ALFABETO_TEMP.length)];
  }
  return out;
}

@Injectable()
export class UsuariosService {
  constructor(
    private readonly db: DatabaseService,
    private readonly mail: MailService,
  ) {}

  listar() {
    return this.db.query(
      `SELECT id, nome, email, perfil, (ativo = 1) AS ativo,
              (email_verificado = 1) AS emailVerificado,
              (deve_trocar_senha = 1) AS deveTrocarSenha,
              criado_em AS criadoEm
         FROM usuarios ORDER BY nome`,
    );
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
          SET senha_hash = ?, deve_trocar_senha = 1, email_verificado = 1, atualizado_em = NOW()
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
