import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { UsuarioAutenticado } from '../common/types/usuario-autenticado';
import { DatabaseService, SqlExecutor } from '../database/database.service';
import { ItemEmailParticipante, MailService } from '../mail/mail.service';
import {
  calcularRodada,
  ItemRodada,
  ResultadoRodada,
} from './calculo-caixas';
import { CriarRodadaDto, StatusRodada } from './rodadas.dto';

export interface Rodada {
  id: number;
  titulo: string;
  organizadorId: number | null;
  organizadorNome: string | null;
  status: StatusRodada;
  dataAbertura: Date;
  dataFechamento: Date | null;
}

const STATUS_ATIVOS: StatusRodada[] = ['ABERTO', 'FECHADO', 'COMPRADO'];

/** Transicoes permitidas de status. */
const TRANSICOES: Record<StatusRodada, StatusRodada[]> = {
  ABERTO: ['FECHADO', 'CANCELADO'],
  FECHADO: ['ABERTO', 'COMPRADO', 'CANCELADO'],
  COMPRADO: ['ENTREGUE', 'CANCELADO'],
  ENTREGUE: [],
  CANCELADO: [],
};

const SELECT_RODADA = `
  SELECT r.id, r.titulo, r.organizador_id AS organizadorId,
         u.nome AS organizadorNome, r.status,
         r.data_abertura AS dataAbertura, r.data_fechamento AS dataFechamento
    FROM rodadas_pedido r
    LEFT JOIN usuarios u ON u.id = r.organizador_id`;

@Injectable()
export class RodadasService {
  private readonly logger = new Logger(RodadasService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly mail: MailService,
  ) {}

  listar(): Promise<Rodada[]> {
    return this.db.query<Rodada>(`${SELECT_RODADA} ORDER BY r.id DESC`);
  }

  /** Rodada em andamento (ABERTO/FECHADO/COMPRADO) ou null. */
  async ativa(): Promise<Rodada | null> {
    const marcadores = STATUS_ATIVOS.map(() => '?').join(',');
    const [rodada] = await this.db.query<Rodada>(
      `${SELECT_RODADA} WHERE r.status IN (${marcadores}) ORDER BY r.id DESC LIMIT 1`,
      STATUS_ATIVOS,
    );
    return rodada ?? null;
  }

  async obter(id: number, executor: SqlExecutor = this.db): Promise<Rodada> {
    const [rodada] = await executor.query<Rodada>(
      `${SELECT_RODADA} WHERE r.id = ?`,
      [id],
    );
    if (!rodada) throw new NotFoundException('Rodada nao encontrada.');
    return rodada;
  }

  async criar(dto: CriarRodadaDto, usuario: UsuarioAutenticado): Promise<Rodada> {
    const existente = await this.ativa();
    if (existente) {
      throw new ConflictException(
        `Ja existe uma rodada em andamento (#${existente.id} - ${existente.status}). Finalize-a antes de abrir outra.`,
      );
    }

    let organizadorId: number | null = null;
    if (dto.organizadorId !== undefined && dto.organizadorId !== null) {
      const [alvo] = await this.db.query<{ id: number }>(
        'SELECT id FROM usuarios WHERE id = ? AND ativo = 1 AND aprovado = 1',
        [dto.organizadorId],
      );
      if (!alvo) {
        throw new NotFoundException(
          'Usuario escolhido como organizador nao encontrado ou inativo.',
        );
      }
      organizadorId = alvo.id;
    } else if (dto.assumirOrganizacao) {
      organizadorId = usuario.id;
    }

    const res = await this.db.execute(
      `INSERT INTO rodadas_pedido (titulo, organizador_id, status, data_abertura)
       VALUES (?, ?, 'ABERTO', NOW())`,
      [dto.titulo.trim(), organizadorId],
    );
    return this.obter(res.insertId);
  }

  /** Permite ao ADMIN delegar ou alterar o organizador de uma rodada em andamento. */
  async definirOrganizador(
    id: number,
    organizadorId: number | null,
  ): Promise<Rodada> {
    const rodada = await this.obter(id);
    if (!STATUS_ATIVOS.includes(rodada.status)) {
      throw new ConflictException(
        'Nao e possivel alterar o organizador de uma rodada ja encerrada.',
      );
    }

    if (organizadorId !== null) {
      const [alvo] = await this.db.query<{ id: number }>(
        'SELECT id FROM usuarios WHERE id = ? AND ativo = 1 AND aprovado = 1',
        [organizadorId],
      );
      if (!alvo) {
        throw new NotFoundException(
          'Usuario escolhido como organizador nao encontrado ou inativo.',
        );
      }
    }

    await this.db.execute(
      'UPDATE rodadas_pedido SET organizador_id = ? WHERE id = ?',
      [organizadorId, id],
    );
    return this.obter(id);
  }

  /** Atomico: so assume se organizador_id ainda for NULL. */
  async assumir(id: number, usuario: UsuarioAutenticado): Promise<Rodada> {
    const marcadores = STATUS_ATIVOS.map(() => '?').join(',');
    const res = await this.db.execute(
      `UPDATE rodadas_pedido SET organizador_id = ?
        WHERE id = ? AND organizador_id IS NULL AND status IN (${marcadores})`,
      [usuario.id, id, ...STATUS_ATIVOS],
    );
    if (!res.affectedRows) {
      const rodada = await this.obter(id);
      if (rodada.organizadorId !== null) {
        throw new ConflictException('Esta rodada ja possui organizador.');
      }
      throw new ConflictException(
        'Nao e possivel assumir uma rodada ja encerrada.',
      );
    }
    return this.obter(id);
  }

  async mudarStatus(
    id: number,
    novo: StatusRodada,
    usuario?: UsuarioAutenticado,
  ): Promise<
    Rodada & {
      notificacoes?: {
        participantesEnviados: number;
        organizadorEnviado: boolean;
        falhas: number;
      };
    }
  > {
    await this.db.transaction(async (tx) => {
      const [atual] = await tx.query<{ status: StatusRodada }>(
        'SELECT status FROM rodadas_pedido WHERE id = ? FOR UPDATE',
        [id],
      );
      if (!atual) throw new NotFoundException('Rodada nao encontrada.');

      if (!TRANSICOES[atual.status].includes(novo)) {
        throw new BadRequestException(
          `Transicao invalida: ${atual.status} -> ${novo}.`,
        );
      }

      if (novo === 'COMPRADO') {
        const { resumo } = await this.calcular(id, tx);
        if (resumo.totalCaixasFechadas === 0) {
          throw new BadRequestException(
            'Nao ha nenhuma caixa fechada para comprar nesta rodada.',
          );
        }
      }

      const fechamento =
        novo === 'FECHADO' ? 'data_fechamento = NOW()'
        : novo === 'ABERTO' ? 'data_fechamento = NULL'
        : null;
      await tx.execute(
        `UPDATE rodadas_pedido SET status = ?${fechamento ? ', ' + fechamento : ''} WHERE id = ?`,
        [novo, id],
      );
    });

    const rodada = await this.obter(id);
    if (novo === 'FECHADO') {
      const notificacoes = await this.notificarFechamento(rodada, usuario);
      return { ...rodada, notificacoes };
    }
    return rodada;
  }

  private async notificarFechamento(
    rodada: Rodada,
    ator?: UsuarioAutenticado,
  ) {
    const calculo = await this.calcular(rodada.id);

    // Organizador da rodada ou o ADMIN que fechou (se a rodada estava sem organizador)
    const organizadorId = rodada.organizadorId ?? ator?.id ?? null;
    const [org] = organizadorId
      ? await this.db.query<{
          id: number;
          nome: string;
          email: string;
          pixChave: string | null;
          banco: string | null;
          agencia: string | null;
          conta: string | null;
        }>(
          `SELECT id, nome, email, pix_chave AS pixChave, banco, agencia, conta
             FROM usuarios WHERE id = ?`,
          [organizadorId],
        )
      : [];

    const solicitacoes = await this.db.query<{
      usuarioId: number;
      nome: string;
      email: string;
      statusPagamento: 'PENDENTE' | 'PAGO';
    }>(
      `SELECT u.id AS usuarioId, u.nome, u.email, s.status_pagamento AS statusPagamento
         FROM solicitacoes s
         JOIN usuarios u ON u.id = s.usuario_id
        WHERE s.rodada_id = ?
        ORDER BY u.nome`,
      [rodada.id],
    );

    const itensPorUsuario = new Map<number, ItemEmailParticipante[]>();
    for (const item of calculo.itens) {
      const lista = itensPorUsuario.get(item.usuarioId) ?? [];
      lista.push({
        sabor: item.capsulaNome,
        quantidadeConfirmada: item.quantidadeEmCaixa,
        quantidadeNaoFechada: item.quantidadeAguardando,
        precoUnitario: item.precoUnitario,
        valorConfirmado: item.valorEmCaixa,
      });
      itensPorUsuario.set(item.usuarioId, lista);
    }

    const totaisPorUsuario = new Map(
      calculo.participantes.map((p) => [p.usuarioId, p]),
    );

    const dadosPagamento = {
      organizadorNome: org?.nome ?? rodada.organizadorNome ?? 'Organizador',
      pixChave: org?.pixChave ?? null,
      banco: org?.banco ?? null,
      agencia: org?.agencia ?? null,
      conta: org?.conta ?? null,
    };

    // Apenas quem tem pelo menos 1 item solicitado recebe o e-mail de fechamento
    const participantesComItens = solicitacoes
      .map((s) => ({
        ...s,
        itens: (itensPorUsuario.get(s.usuarioId) ?? []).sort((a, b) =>
          a.sabor.localeCompare(b.sabor, 'pt-BR'),
        ),
        valorAPagar: totaisPorUsuario.get(s.usuarioId)?.totalEmCaixasFechadas ?? 0,
      }))
      .filter((p) => p.itens.length > 0);

    let participantesEnviados = 0;
    let falhas = 0;

    const resultadosPart = await Promise.allSettled(
      participantesComItens.map((p) =>
        this.mail.enviarFechamentoParticipante({
          para: p.email,
          nomeParticipante: p.nome,
          rodadaTitulo: rodada.titulo,
          itens: p.itens,
          valorTotalAPagar: p.valorAPagar,
          pagamento: dadosPagamento,
        }),
      ),
    );
    for (const res of resultadosPart) {
      if (res.status === 'fulfilled') participantesEnviados++;
      else {
        falhas++;
        this.logger.error('Erro ao enviar e-mail de fechamento ao participante', res.reason);
      }
    }

    let organizadorEnviado = false;
    if (org?.email) {
      try {
        await this.mail.enviarFechamentoOrganizador({
          para: org.email,
          nomeOrganizador: org.nome,
          rodadaTitulo: rodada.titulo,
          caixasFechadas: calculo.sabores
            .filter((s) => s.caixasFechadas > 0)
            .map((s) => ({
              sabor: s.nome,
              caixas: s.caixasFechadas,
              capsulas: s.capsulasEmCaixas,
              tamanhoCaixa: s.tamanhoCaixa,
              valor: s.valorFechado,
            })),
          naoFecharam: calculo.sabores
            .filter((s) => s.status === 'AGUARDANDO_COMPLETAR' || s.sobra > 0)
            .map((s) => ({
              sabor: s.nome,
              sobra: s.status === 'AGUARDANDO_COMPLETAR' ? s.totalSolicitado : s.sobra,
              faltam: s.faltamProximaCaixa,
            })),
          totalCaixas: calculo.resumo.totalCaixasFechadas,
          totalCapsulas: calculo.resumo.totalCapsulasEmCaixas,
          valorCompraNespresso: calculo.resumo.valorCompraNespresso,
          participantes: participantesComItens.map((p) => ({
            nome: p.nome,
            email: p.email,
            valorAPagar: p.valorAPagar,
            statusPagamento: p.statusPagamento,
            itens: p.itens,
          })),
        });
        organizadorEnviado = true;
      } catch (err) {
        falhas++;
        this.logger.error('Erro ao enviar e-mail de fechamento ao organizador', err);
      }
    }

    return { participantesEnviados, organizadorEnviado, falhas };
  }

  async carregarItens(
    rodadaId: number,
    executor: SqlExecutor = this.db,
  ): Promise<ItemRodada[]> {
    return executor.query<ItemRodada>(
      `SELECT i.id AS itemId, s.id AS solicitacaoId, u.id AS usuarioId,
              u.nome AS usuarioNome, c.id AS capsulaId, c.nome AS capsulaNome,
              c.tamanho_caixa AS tamanhoCaixa, i.quantidade,
              i.preco_unitario AS precoUnitario
         FROM itens_solicitacao i
         JOIN solicitacoes s ON s.id = i.solicitacao_id
         JOIN usuarios u ON u.id = s.usuario_id
         JOIN capsulas c ON c.id = i.capsula_id
        WHERE s.rodada_id = ?
        ORDER BY i.id`,
      [rodadaId],
    );
  }

  async calcular(
    rodadaId: number,
    executor: SqlExecutor = this.db,
  ): Promise<ResultadoRodada> {
    return calcularRodada(await this.carregarItens(rodadaId, executor));
  }

  /** Painel de caixas: visivel a todos os logados (transparencia). */
  async painel(id: number) {
    const rodada = await this.obter(id);
    const { sabores, resumo } = await this.calcular(id);
    return { rodada, sabores, resumo };
  }

  /** Lista consolidada para a compra: somente caixas fechadas. */
  async resumoCompra(id: number) {
    const rodada = await this.obter(id);
    const { sabores, resumo } = await this.calcular(id);
    const itens = sabores
      .filter((s) => s.caixasFechadas > 0)
      .map((s) => ({
        capsulaId: s.capsulaId,
        nome: s.nome,
        caixas: s.caixasFechadas,
        capsulas: s.capsulasEmCaixas,
        tamanhoCaixa: s.tamanhoCaixa,
        valor: s.valorFechado,
      }));
    return {
      rodada,
      itens,
      totalCaixas: resumo.totalCaixasFechadas,
      totalCapsulas: resumo.totalCapsulasEmCaixas,
      valorTotal: resumo.valorCompraNespresso,
      aguardando: sabores
        .filter((s) => s.status === 'AGUARDANDO_COMPLETAR' || s.sobra > 0)
        .map((s) => ({
          nome: s.nome,
          sobra: s.status === 'AGUARDANDO_COMPLETAR' ? s.totalSolicitado : s.sobra,
          faltam: s.faltamProximaCaixa,
        })),
    };
  }

  /** Participantes + valor a pagar + status de pagamento (organizador/ADMIN). */
  async participantes(id: number) {
    const rodada = await this.obter(id);
    const { participantes, resumo } = await this.calcular(id);
    const solicitacoes = await this.db.query<{
      solicitacaoId: number;
      usuarioId: number;
      nome: string;
      email: string;
      statusPagamento: 'PENDENTE' | 'PAGO';
      dataPagamento: Date | null;
    }>(
      `SELECT s.id AS solicitacaoId, u.id AS usuarioId, u.nome, u.email,
              s.status_pagamento AS statusPagamento, s.data_pagamento AS dataPagamento
         FROM solicitacoes s JOIN usuarios u ON u.id = s.usuario_id
        WHERE s.rodada_id = ? ORDER BY u.nome`,
      [id],
    );
    const totais = new Map(participantes.map((p) => [p.usuarioId, p]));
    const lista = solicitacoes.map((s) => {
      const t = totais.get(s.usuarioId);
      return {
        ...s,
        totalCapsulas: t?.totalCapsulas ?? 0,
        capsulasEmCaixas: t?.capsulasEmCaixas ?? 0,
        totalSolicitado: t?.totalSolicitado ?? 0,
        totalEmCaixasFechadas: t?.totalEmCaixasFechadas ?? 0,
        valorAPagar: t?.totalEmCaixasFechadas ?? 0,
      };
    });
    return { rodada, participantes: lista, resumo };
  }
}
