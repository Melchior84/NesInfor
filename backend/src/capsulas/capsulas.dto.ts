import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const IMAGEM_URL_REGEX = /^(https?:\/\/|\/uploads\/)/i;

export class CriarCapsulaDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nome: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descricao?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(IMAGEM_URL_REGEX, {
    message: 'imagemUrl deve comecar com http://, https:// ou /uploads/.',
  })
  imagemUrl?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(12)
  intensidade?: number | null;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999)
  precoAtual: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  tamanhoCaixa?: number;
}

export class AtualizarCapsulaDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descricao?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(IMAGEM_URL_REGEX, {
    message: 'imagemUrl deve comecar com http://, https:// ou /uploads/.',
  })
  imagemUrl?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(12)
  intensidade?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999)
  precoAtual?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  tamanhoCaixa?: number;
}

export class AtivarCapsulaDto {
  @IsBoolean()
  ativo: boolean;
}
