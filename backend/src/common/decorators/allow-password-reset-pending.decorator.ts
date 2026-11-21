import { SetMetadata } from '@nestjs/common';

export const ALLOW_PASSWORD_RESET_PENDING_KEY = 'allowPasswordResetPending';

/** Permite acesso a rota mesmo quando o usuario ainda precisa trocar a senha temporaria. */
export const AllowPasswordResetPending = () =>
  SetMetadata(ALLOW_PASSWORD_RESET_PENDING_KEY, true);
