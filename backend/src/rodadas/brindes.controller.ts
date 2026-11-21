import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsuarioAutenticado } from '../common/types/usuario-autenticado';
import {
  CriarBrindeDto,
  DefinirSorteadorDto,
  ParticipacaoBrindeDto,
} from './brindes.dto';
import { BrindesService } from './brindes.service';

@Controller('rodadas/:id')
export class BrindesController {
  constructor(private readonly brindes: BrindesService) {}

  @Get('brindes')
  listar(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: UsuarioAutenticado,
  ) {
    return this.brindes.listar(id, usuario);
  }

  @Patch('sorteador')
  definirSorteador(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DefinirSorteadorDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ) {
    return this.brindes.definirSorteador(id, dto.sorteadorId ?? null, usuario);
  }

  @Post('brindes')
  criar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CriarBrindeDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ) {
    return this.brindes.criar(id, dto, usuario);
  }

  @Delete('brindes/:brindeId')
  remover(
    @Param('id', ParseIntPipe) id: number,
    @Param('brindeId', ParseIntPipe) brindeId: number,
    @CurrentUser() usuario: UsuarioAutenticado,
  ) {
    return this.brindes.remover(id, brindeId, usuario);
  }

  @Put('brindes/:brindeId/participacao')
  definirParticipacao(
    @Param('id', ParseIntPipe) id: number,
    @Param('brindeId', ParseIntPipe) brindeId: number,
    @Body() dto: ParticipacaoBrindeDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ) {
    return this.brindes.definirParticipacao(id, brindeId, dto.participar, usuario);
  }

  @Put('brindes/:brindeId/participantes/:usuarioId')
  definirParticipacaoUsuario(
    @Param('id', ParseIntPipe) id: number,
    @Param('brindeId', ParseIntPipe) brindeId: number,
    @Param('usuarioId', ParseIntPipe) usuarioId: number,
    @Body() dto: ParticipacaoBrindeDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ) {
    return this.brindes.definirParticipacaoUsuario(
      id,
      brindeId,
      usuarioId,
      dto.participar,
      usuario,
    );
  }

  @HttpCode(200)
  @Post('brindes/:brindeId/sortear')
  sortear(
    @Param('id', ParseIntPipe) id: number,
    @Param('brindeId', ParseIntPipe) brindeId: number,
    @CurrentUser() usuario: UsuarioAutenticado,
  ) {
    return this.brindes.sortear(id, brindeId, usuario);
  }
}
