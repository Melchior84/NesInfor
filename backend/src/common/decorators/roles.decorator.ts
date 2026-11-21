import { SetMetadata } from '@nestjs/common';
import { Perfil } from '../types/usuario-autenticado';

export const ROLES_KEY = 'roles';
/** Restringe a rota aos perfis informados (ex.: @Roles('ADMIN')). */
export const Roles = (...perfis: Perfil[]) => SetMetadata(ROLES_KEY, perfis);
