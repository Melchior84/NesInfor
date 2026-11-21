import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CriarBrindeDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  nome: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descricao?: string | null;
}

export class ParticipacaoBrindeDto {
  @IsBoolean()
  participar: boolean;
}

export class DefinirSorteadorDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  sorteadorId?: number | null;
}
