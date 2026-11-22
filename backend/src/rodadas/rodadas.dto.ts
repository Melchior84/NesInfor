import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const STATUS_RODADA = [
  'ABERTO',
  'FECHADO',
  'COMPRADO',
  'ENTREGUE',
  'CANCELADO',
] as const;
export type StatusRodada = (typeof STATUS_RODADA)[number];

export class CriarRodadaDto {
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  titulo: string;

  /** Se true (e organizadorId nao informado), quem abriu assume a organizacao. */
  @IsOptional()
  @IsBoolean()
  assumirOrganizacao?: boolean;

  /** Permite ao ADMIN delegar a organizacao diretamente a qualquer usuario ativo. */
  @IsOptional()
  @IsInt()
  @Min(1)
  organizadorId?: number | null;
}

export class DefinirOrganizadorDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  organizadorId?: number | null;
}

export class AlterarStatusDto {
  @IsIn(STATUS_RODADA)
  status: StatusRodada;
}
