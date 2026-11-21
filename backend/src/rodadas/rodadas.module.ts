import { Module } from '@nestjs/common';
import { RodadaOrganizadorGuard } from '../common/guards/rodada-organizador.guard';
import { BrindesController } from './brindes.controller';
import { BrindesService } from './brindes.service';
import { RodadasController } from './rodadas.controller';
import { RodadasService } from './rodadas.service';

@Module({
  controllers: [RodadasController, BrindesController],
  providers: [RodadasService, BrindesService, RodadaOrganizadorGuard],
  exports: [RodadasService, RodadaOrganizadorGuard],
})
export class RodadasModule {}
