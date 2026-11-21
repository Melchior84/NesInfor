import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UsuarioAutenticado } from '../types/usuario-autenticado';

/** Injeta o usuario autenticado (preenchido pelo JwtAuthGuard). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UsuarioAutenticado => {
    return ctx.switchToHttp().getRequest().user;
  },
);
