import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RodadaOrganizadorGuard } from '../common/guards/rodada-organizador.guard';
import { UsuarioAutenticado } from '../common/types/usuario-autenticado';
import { AlterarStatusDto, CriarRodadaDto } from './rodadas.dto';
import { RodadasService } from './rodadas.service';

@Controller('rodadas')
export class RodadasController {
  constructor(private readonly rodadas: RodadasService) {}

  @Get()
  listar() {
    return this.rodadas.listar();
  }

  // Rotas estaticas antes das parametrizadas
  @Get('ativa')
  ativa() {
    return this.rodadas.ativa();
  }

  @Roles('ADMIN')
  @Post()
  criar(@Body() dto: CriarRodadaDto, @CurrentUser() usuario: UsuarioAutenticado) {
    return this.rodadas.criar(dto, usuario);
  }

  @Get(':id')
  obter(@Param('id', ParseIntPipe) id: number) {
    return this.rodadas.obter(id);
  }

  @HttpCode(200)
  @Post(':id/assumir')
  assumir(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: UsuarioAutenticado,
  ) {
    return this.rodadas.assumir(id, usuario);
  }

  @UseGuards(RodadaOrganizadorGuard)
  @Patch(':id/status')
  mudarStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AlterarStatusDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ) {
    return this.rodadas.mudarStatus(id, dto.status, usuario);
  }

  @Get(':id/painel-caixas')
  painel(@Param('id', ParseIntPipe) id: number) {
    return this.rodadas.painel(id);
  }

  @Get(':id/resumo-compra')
  resumoCompra(@Param('id', ParseIntPipe) id: number) {
    return this.rodadas.resumoCompra(id);
  }

  @UseGuards(RodadaOrganizadorGuard)
  @Get(':id/participantes')
  participantes(@Param('id', ParseIntPipe) id: number) {
    return this.rodadas.participantes(id);
  }
}
