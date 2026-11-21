import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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

  /** Se true, quem abriu ja se declara organizador da rodada. */
  @IsOptional()
  @IsBoolean()
  assumirOrganizacao?: boolean;
}

export class AlterarStatusDto {
  @IsIn(STATUS_RODADA)
  status: StatusRodada;
}
