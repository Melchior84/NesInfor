import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { CapsulasModule } from './capsulas/capsulas.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { DatabaseModule } from './database/database.module';
import { MailModule } from './mail/mail.module';
import { RodadasModule } from './rodadas/rodadas.module';
import { SolicitacoesModule } from './solicitacoes/solicitacoes.module';
import { UsuariosModule } from './usuarios/usuarios.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    DatabaseModule,
    MailModule,
    AuthModule,
    UsuariosModule,
    CapsulasModule,
    RodadasModule,
    SolicitacoesModule,
  ],
  providers: [
    // Ordem importa: rate limit, depois JWT, depois perfil (ADMIN)
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
