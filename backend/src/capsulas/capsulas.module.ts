import { Module } from '@nestjs/common';
import { CapsulasController } from './capsulas.controller';
import { CapsulasService } from './capsulas.service';

@Module({
  controllers: [CapsulasController],
  providers: [CapsulasService],
})
export class CapsulasModule {}
