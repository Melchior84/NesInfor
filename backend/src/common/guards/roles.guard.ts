import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Perfil } from '../types/usuario-autenticado';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const exigidos = this.reflector.getAllAndOverride<Perfil[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!exigidos?.length) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user || !exigidos.includes(user.perfil)) {
      throw new ForbiddenException('Acesso restrito.');
    }
    return true;
  }
}
