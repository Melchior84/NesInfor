import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
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
    DatabaseModule,
    MailModule,
    AuthModule,
    UsuariosModule,
    CapsulasModule,
    RodadasModule,
    SolicitacoesModule,
  ],
  providers: [
    // Ordem importa: primeiro autentica (JWT), depois valida perfil (ADMIN)
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
