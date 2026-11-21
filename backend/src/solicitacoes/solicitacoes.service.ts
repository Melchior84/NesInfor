import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UsuarioAutenticado } from '../common/types/usuario-autenticado';
import { DatabaseService } from '../database/database.service';
import { RodadasService } from '../rodadas/rodadas.service';

@Injectable()
export class SolicitacoesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly rodadas: RodadasService,
  ) {}

  async meuPedido(rodadaId: number, usuario: UsuarioAutenticado) {
    const rodada = await this.rodadas.obter(rodadaId);
    const calculo = await this.rodadas.calcular(rodadaId);
    const [sol] = await this.db.query<{
      id: number;
      statusPagamento: 'PENDENTE' | 'PAGO';
      dataPagamento: Date | null;
    }>(
      `SELECT id, status_pagamento AS statusPagamento, data_pagamento AS dataPagamento
         FROM solicitacoes WHERE rodada_id = ? AND usuario_id = ?`,
      [rodadaId, usuario.id],
    );

    const itens = calculo.itens
      .filter((i) => i.usuarioId === usuario.id)
      .map((i) => ({
        itemId: i.itemId,
        capsulaId: i.capsulaId,
        nome: i.capsulaNome,
        tamanhoCaixa: i.tamanhoCaixa,
        quantidade: i.quantidade,
        precoUnitario: i.precoUnitario,
        subtotal: i.valorSolicitado,
        quantidadeEmCaixa: i.quantidadeEmCaixa,
        quantidadeAguardando: i.quantidadeAguardando,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    const totais = calculo.participantes.find((p) => p.usuarioId === usuario.id);
    return {
      rodada,
      solicitacaoId: sol?.id ?? null,
      statusPagamento: sol?.statusPagamento ?? 'PENDENTE',
      dataPagamento: sol?.dataPagamento ?? null,
      podeEditar: rodada.status === 'ABERTO',
      itens,
      totalCapsulas: totais?.totalCapsulas ?? 0,
      totalSolicitado: totais?.totalSolicitado ?? 0,
      totalEmCaixasFechadas: totais?.totalEmCaixasFechadas ?? 0,
    };
  }

  /**
   * Adiciona/edita/remove (quantidade 0) um item do pedido do usuario.
   * - Item novo: copia capsulas.preco_atual para itens_solicitacao.preco_unitario (congelamento).
   * - Item existente: so altera a quantidade, mantendo o preco ja congelado.
   */
  async definirQuantidade(
    rodadaId: number,
    capsulaId: number,
    quantidade: number,
    usuario: UsuarioAutenticado,
  ) {
    await this.db.transaction(async (tx) => {
      const [rodada] = await tx.query<{ status: string }>(
        'SELECT status FROM rodadas_pedido WHERE id = ? FOR UPDATE',
        [rodadaId],
      );
      if (!rodada) throw new NotFoundException('Rodada nao encontrada.');
      if (rodada.status !== 'ABERTO') {
        throw new ConflictException(
          'A rodada nao esta ABERTA: o pedido nao pode mais ser alterado.',
        );
      }

      const [existente] = await tx.query<{ id: number }>(
        `SELECT i.id FROM itens_solicitacao i
           JOIN solicitacoes s ON s.id = i.solicitacao_id
          WHERE s.rodada_id = ? AND s.usuario_id = ? AND i.capsula_id = ?`,
        [rodadaId, usuario.id, capsulaId],
      );

      if (quantidade === 0) {
        if (existente) {
          await tx.execute('DELETE FROM itens_solicitacao WHERE id = ?', [
            existente.id,
          ]);
        }
        return;
      }

      if (existente) {
        await tx.execute(
          'UPDATE itens_solicitacao SET quantidade = ? WHERE id = ?',
          [quantidade, existente.id],
        );
        return;
      }

      const [capsula] = await tx.query<{ preco_atual: number; ativo: number }>(
        'SELECT preco_atual, ativo FROM capsulas WHERE id = ?',
        [capsulaId],
      );
      if (!capsula) throw new NotFoundException('Capsula nao encontrada.');
      if (!capsula.ativo) {
        throw new BadRequestException('Esta capsula nao esta disponivel.');
      }

      const sol = await tx.execute(
        `INSERT INTO solicitacoes (rodada_id, usuario_id, status_pagamento, criado_em)
         VALUES (?, ?, 'PENDENTE', NOW())
         ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
        [rodadaId, usuario.id],
      );
      await tx.execute(
        `INSERT INTO itens_solicitacao (solicitacao_id, capsula_id, quantidade, preco_unitario)
         VALUES (?, ?, ?, ?)`,
        [sol.insertId, capsulaId, quantidade, capsula.preco_atual],
      );
    });

    return this.meuPedido(rodadaId, usuario);
  }

  async alterarPagamento(
    rodadaId: number,
    solicitacaoId: number,
    status: 'PENDENTE' | 'PAGO',
  ) {
    const res = await this.db.execute(
      `UPDATE solicitacoes
          SET status_pagamento = ?, data_pagamento = ${status === 'PAGO' ? 'NOW()' : 'NULL'}
        WHERE id = ? AND rodada_id = ?`,
      [status, solicitacaoId, rodadaId],
    );
    if (!res.affectedRows) {
      throw new NotFoundException('Solicitacao nao encontrada nesta rodada.');
    }
    const [sol] = await this.db.query(
      `SELECT id AS solicitacaoId, usuario_id AS usuarioId,
              status_pagamento AS statusPagamento, data_pagamento AS dataPagamento
         FROM solicitacoes WHERE id = ?`,
      [solicitacaoId],
    );
    return sol;
  }
}
