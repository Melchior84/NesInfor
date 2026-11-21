import { IsArray, IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class AtualizarUsuarioDto {
  @IsOptional()
  @IsIn(['ADMIN', 'USUARIO'])
  perfil?: 'ADMIN' | 'USUARIO';

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

export class DominiosAprovadosDto {
  @IsArray()
  @IsString({ each: true })
  dominios: string[];
}
