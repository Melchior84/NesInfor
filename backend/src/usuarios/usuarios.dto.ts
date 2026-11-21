import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export class AtualizarUsuarioDto {
  @IsOptional()
  @IsIn(['ADMIN', 'USUARIO'])
  perfil?: 'ADMIN' | 'USUARIO';

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
