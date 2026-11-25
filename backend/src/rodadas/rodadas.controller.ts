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
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RodadaOrganizadorGuard } from '../common/guards/rodada-organizador.guard';
import { UsuarioAutenticado } from '../common/types/usuario-autenticado';
import {
  AlterarStatusDto,
  CriarRodadaDto,
  DefinirOrganizadorDto,
} from './rodadas.dto';
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

  @Get('ranking-cafezinhos')
  rankingCafezinhos(@Query('ano') ano?: string) {
    const parsed = ano ? Number(ano) : undefined;
    return this.rodadas.rankingCafezinhos(parsed);
  }

  @Get('meu-painel')
  meuPainel(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Query('ano') ano?: string,
  ) {
    const parsed = ano ? Number(ano) : undefined;
    return this.rodadas.meuPainel(usuario, parsed);
  }

  @HttpCode(200)
  @Post('solicitar-abertura')
  solicitarAbertura(@CurrentUser() usuario: UsuarioAutenticado) {
    return this.rodadas.solicitarAbertura(usuario);
  }

  @Delete('solicitar-abertura')
  cancelarSolicitacaoAbertura(@CurrentUser() usuario: UsuarioAutenticado) {
    return this.rodadas.cancelarSolicitacaoAbertura(usuario);
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

  @Roles('ADMIN')
  @Patch(':id/organizador')
  definirOrganizador(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DefinirOrganizadorDto,
  ) {
    return this.rodadas.definirOrganizador(id, dto.organizadorId ?? null);
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

  /**
   * QR Code PNG do PIX Copia e Cola do organizador da rodada.
   * Rota publica para funcionar tambem em clientes de e-mail (Gmail/Outlook).
   */
  @Public()
  @Get(':id/pix-qrcode.png')
  async pixQrCode(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const png = await this.rodadas.obterPixQrCodePng(id);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(png);
  }
}
