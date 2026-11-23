import { Body, Controller, Get, HttpCode, Post, Put } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AllowPasswordResetPending } from '../common/decorators/allow-password-reset-pending.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { UsuarioAutenticado } from '../common/types/usuario-autenticado';
import {
  ConfirmarEmailDto,
  DadosPagamentoDto,
  EmailDto,
  GoogleAuthDto,
  LoginDto,
  RedefinirSenhaDto,
  RegisterDto,
  TrocarSenhaObrigatoriaDto,
} from './auth.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Get('config')
  config() {
    return this.auth.obterConfigPublica();
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 15 } })
  @HttpCode(200)
  @Post('google')
  google(@Body() dto: GoogleAuthDto) {
    return this.auth.autenticarGoogle(dto.credential);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 15 } })
  @HttpCode(200)
  @Post('confirmar-email')
  confirmarEmail(@Body() dto: ConfirmarEmailDto) {
    return this.auth.confirmarEmail(dto.token);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @HttpCode(200)
  @Post('reenviar-confirmacao')
  reenviarConfirmacao(@Body() dto: EmailDto) {
    return this.auth.reenviarConfirmacao(dto.email);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @HttpCode(200)
  @Post('esqueci-senha')
  esqueciSenha(@Body() dto: EmailDto) {
    return this.auth.esqueciSenha(dto.email);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @HttpCode(200)
  @Post('redefinir-senha')
  redefinirSenha(@Body() dto: RedefinirSenhaDto) {
    return this.auth.redefinirSenha(dto.token, dto.novaSenha);
  }

  @AllowPasswordResetPending()
  @HttpCode(200)
  @Post('trocar-senha-obrigatoria')
  trocarSenhaObrigatoria(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Body() dto: TrocarSenhaObrigatoriaDto,
  ) {
    return this.auth.trocarSenhaObrigatoria(usuario, dto.novaSenha);
  }

  @AllowPasswordResetPending()
  @Get('me')
  me(@CurrentUser() usuario: UsuarioAutenticado) {
    return usuario;
  }

  @Get('dados-pagamento')
  obterDadosPagamento(@CurrentUser() usuario: UsuarioAutenticado) {
    return this.auth.obterDadosPagamento(usuario.id);
  }

  @Put('dados-pagamento')
  salvarDadosPagamento(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Body() dto: DadosPagamentoDto,
  ) {
    return this.auth.salvarDadosPagamento(usuario.id, dto);
  }
}
