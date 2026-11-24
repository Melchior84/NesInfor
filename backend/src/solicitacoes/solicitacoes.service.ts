import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UsuarioAutenticado } from '../common/types/usuario-autenticado';
import { DatabaseService } from '../database/database.service';
import { RodadasService } from '../rodadas/rodadas.service';

export const VALOR_CAFEZINHO_GORJETA = 3;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

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
      cafezinhosGorjeta: number;
      valorGorjeta: number;
    }>(
      `SELECT id, status_pagamento AS statusPagamento, data_pagamento AS dataPagamento,
              cafezinhos_gorjeta AS cafezinhosGorjeta, valor_gorjeta AS valorGorjeta
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
    const totalEmCaixasFechadas = totais?.totalEmCaixasFechadas ?? 0;
    const temCaixaFechada = (totais?.capsulasEmCaixas ?? 0) > 0;
    const cafezinhosGorjeta = Number(sol?.cafezinhosGorjeta ?? 0);
    const valorGorjeta = Number(sol?.valorGorjeta ?? 0);
    const gorjetaContabilizada = temCaixaFechada && cafezinhosGorjeta > 0;
    const valorGorjetaEfetivo = gorjetaContabilizada ? valorGorjeta : 0;

    const [orgPag] = rodada.organizadorId
      ? await this.db.query<{
          nome: string;
          pixChave: string | null;
          banco: string | null;
          agencia: string | null;
          conta: string | null;
        }>(
          `SELECT nome, pix_chave AS pixChave, banco, agencia, conta
             FROM usuarios WHERE id = ?`,
          [rodada.organizadorId],
        )
      : [];

    const pixLimpo = orgPag?.pixChave?.trim() || null;
    const isPixCopiaCola = Boolean(
      pixLimpo && pixLimpo.startsWith('000201') && pixLimpo.includes('br.gov.bcb.pix'),
    );
    const temDadosPag = Boolean(
      pixLimpo || orgPag?.banco || orgPag?.agencia || orgPag?.conta,
    );

    return {
      rodada,
      solicitacaoId: sol?.id ?? null,
      statusPagamento: sol?.statusPagamento ?? 'PENDENTE',
      dataPagamento: sol?.dataPagamento ?? null,
      podeEditar: rodada.status === 'ABERTO',
      itens,
      totalCapsulas: totais?.totalCapsulas ?? 0,
      totalSolicitado: totais?.totalSolicitado ?? 0,
      totalEmCaixasFechadas,
      cafezinhosGorjeta,
      valorGorjeta,
      valorPorCafezinho: VALOR_CAFEZINHO_GORJETA,
      gorjetaContabilizada,
      valorTotalAPagar: round2(totalEmCaixasFechadas + valorGorjetaEfetivo),
      pagamentoOrganizador:
        orgPag && temDadosPag
          ? {
              organizadorNome: orgPag.nome,
              pixChave: pixLimpo,
              isPixCopiaCola,
              banco: orgPag.banco,
              agencia: orgPag.agencia,
              conta: orgPag.conta,
            }
          : null,
    };
  }

  async definirGorjeta(
    rodadaId: number,
    cafezinhos: number,
    usuario: UsuarioAutenticado,
  ) {
    const valorGorjeta = round2(cafezinhos * VALOR_CAFEZINHO_GORJETA);

    await this.db.transaction(async (tx) => {
      const [rodada] = await tx.query<{ status: string }>(
        'SELECT status FROM rodadas_pedido WHERE id = ? FOR UPDATE',
        [rodadaId],
      );
      if (!rodada) throw new NotFoundException('Rodada nao encontrada.');
      if (rodada.status !== 'ABERTO') {
        throw new ConflictException(
          'A rodada nao esta ABERTA: a caixinha nao pode mais ser alterada.',
        );
      }

      if (cafezinhos === 0) {
        await tx.execute(
          `UPDATE solicitacoes
              SET cafezinhos_gorjeta = 0, valor_gorjeta = 0
            WHERE rodada_id = ? AND usuario_id = ?`,
          [rodadaId, usuario.id],
        );
        return;
      }

      await tx.execute(
        `INSERT INTO solicitacoes (rodada_id, usuario_id, status_pagamento, cafezinhos_gorjeta, valor_gorjeta, criado_em)
         VALUES (?, ?, 'PENDENTE', ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           cafezinhos_gorjeta = VALUES(cafezinhos_gorjeta),
           valor_gorjeta = VALUES(valor_gorjeta)`,
        [rodadaId, usuario.id, cafezinhos, valorGorjeta],
      );
    });

    return this.meuPedido(rodadaId, usuario);
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
