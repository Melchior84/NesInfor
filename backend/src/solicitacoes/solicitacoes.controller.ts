import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RodadaOrganizadorGuard } from '../common/guards/rodada-organizador.guard';
import { UsuarioAutenticado } from '../common/types/usuario-autenticado';
import { AlterarPagamentoDto, DefinirQuantidadeDto } from './solicitacoes.dto';
import { SolicitacoesService } from './solicitacoes.service';

@Controller('rodadas/:id')
export class SolicitacoesController {
  constructor(private readonly solicitacoes: SolicitacoesService) {}

  @Get('meu-pedido')
  meuPedido(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: UsuarioAutenticado,
  ) {
    return this.solicitacoes.meuPedido(id, usuario);
  }

  @Put('meu-pedido/itens/:capsulaId')
  definirQuantidade(
    @Param('id', ParseIntPipe) id: number,
    @Param('capsulaId', ParseIntPipe) capsulaId: number,
    @Body() dto: DefinirQuantidadeDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ) {
    return this.solicitacoes.definirQuantidade(id, capsulaId, dto.quantidade, usuario);
  }

  @Delete('meu-pedido/itens/:capsulaId')
  remover(
    @Param('id', ParseIntPipe) id: number,
    @Param('capsulaId', ParseIntPipe) capsulaId: number,
    @CurrentUser() usuario: UsuarioAutenticado,
  ) {
    return this.solicitacoes.definirQuantidade(id, capsulaId, 0, usuario);
  }

  @UseGuards(RodadaOrganizadorGuard)
  @Patch('participantes/:solicitacaoId/pagamento')
  alterarPagamento(
    @Param('id', ParseIntPipe) id: number,
    @Param('solicitacaoId', ParseIntPipe) solicitacaoId: number,
    @Body() dto: AlterarPagamentoDto,
  ) {
    return this.solicitacoes.alterarPagamento(id, solicitacaoId, dto.status);
  }
}
