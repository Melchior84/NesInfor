import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nome: string;

  @IsEmail()
  @MaxLength(180)
  email: string;

  @IsString()
  @MinLength(8, { message: 'A senha deve ter ao menos 8 caracteres.' })
  @MaxLength(128)
  senha: string;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MaxLength(128)
  senha: string;
}

export class ConfirmarEmailDto {
  @IsString()
  @MinLength(16)
  @MaxLength(200)
  token: string;
}

export class EmailDto {
  @IsEmail()
  @MaxLength(180)
  email: string;
}

export class RedefinirSenhaDto {
  @IsString()
  @MinLength(16)
  @MaxLength(200)
  token: string;

  @IsString()
  @MinLength(8, { message: 'A nova senha deve ter ao menos 8 caracteres.' })
  @MaxLength(128)
  novaSenha: string;
}

export class TrocarSenhaObrigatoriaDto {
  @IsString()
  @MinLength(8, { message: 'A nova senha deve ter ao menos 8 caracteres.' })
  @MaxLength(128)
  novaSenha: string;
}

export class DadosPagamentoDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  pixChave?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  banco?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  agencia?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  conta?: string | null;
}
