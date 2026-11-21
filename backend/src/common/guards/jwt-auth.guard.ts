import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../../database/database.service';
import { ALLOW_PASSWORD_RESET_PENDING_KEY } from '../decorators/allow-password-reset-pending.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { UsuarioAutenticado } from '../types/usuario-autenticado';

/**
 * Guard global: valida o JWT e recarrega o usuario do banco a cada requisicao,
 * de modo que desativacao ou mudanca de perfil tenham efeito imediato.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly db: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const publica = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (publica) return true;

    const req = context.switchToHttp().getRequest();
    const [tipo, token] = (req.headers['authorization'] ?? '').split(' ');
    if (tipo !== 'Bearer' || !token) {
      throw new UnauthorizedException('Token ausente.');
    }

    let payload: { sub: number };
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Token invalido ou expirado.');
    }

    const [usuario] = await this.db.query<{
      id: number;
      nome: string;
      email: string;
      perfil: 'ADMIN' | 'USUARIO';
      ativo: number;
      email_verificado: number;
      aprovado: number;
      deve_trocar_senha: number;
    }>(
      `SELECT id, nome, email, perfil, ativo, email_verificado, aprovado, deve_trocar_senha
         FROM usuarios WHERE id = ?`,
      [payload.sub],
    );
    if (!usuario || !usuario.ativo) {
      throw new UnauthorizedException('Usuario inexistente ou inativo.');
    }
    if (!usuario.email_verificado) {
      throw new ForbiddenException(
        'E-mail ainda nao confirmado. Verifique sua caixa de entrada.',
      );
    }
    if (!usuario.aprovado) {
      throw new ForbiddenException(
        'Seu cadastro esta aguardando aprovacao de um administrador.',
      );
    }

    const deveTrocarSenha = Boolean(usuario.deve_trocar_senha);
    const permitePendencia = this.reflector.getAllAndOverride<boolean>(
      ALLOW_PASSWORD_RESET_PENDING_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (deveTrocarSenha && !permitePendencia) {
      throw new ForbiddenException(
        'Voce precisa cadastrar uma nova senha antes de continuar.',
      );
    }

    req.user = {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
      deveTrocarSenha,
    } satisfies UsuarioAutenticado;
    return true;
  }
}
