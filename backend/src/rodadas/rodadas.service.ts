import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as QRCode from 'qrcode';
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
      cafezinhosGorjeta: number;
      valorGorjeta: number;
    }>(
      `SELECT u.id AS usuarioId, u.nome, u.email,
              s.status_pagamento AS statusPagamento,
              s.cafezinhos_gorjeta AS cafezinhosGorjeta,
              s.valor_gorjeta AS valorGorjeta
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

    // Apenas quem tem pelo menos 1 item solicitado recebe o e-mail de fechamento.
    // A caixinha so e contabilizada/cobrada se o participante tiver pelo menos 1 caixa fechada.
    const participantesComItens = solicitacoes
      .map((s) => {
        const resumoPart = totaisPorUsuario.get(s.usuarioId);
        const valorCapsulas = resumoPart?.totalEmCaixasFechadas ?? 0;
        const temCaixaFechada = (resumoPart?.capsulasEmCaixas ?? 0) > 0;
        const cafezinhosGorjeta = temCaixaFechada ? Number(s.cafezinhosGorjeta ?? 0) : 0;
        const valorGorjeta = temCaixaFechada ? Number(s.valorGorjeta ?? 0) : 0;
        return {
          ...s,
          cafezinhosGorjeta,
          valorGorjeta,
          itens: (itensPorUsuario.get(s.usuarioId) ?? []).sort((a, b) =>
            a.sabor.localeCompare(b.sabor, 'pt-BR'),
          ),
          valorCapsulas,
          valorAPagar: Math.round((valorCapsulas + valorGorjeta) * 100) / 100,
        };
      })
      .filter((p) => p.itens.length > 0);

    const totalCafezinhosGorjeta = participantesComItens.reduce(
      (acc, p) => acc + p.cafezinhosGorjeta,
      0,
    );
    const totalValorGorjeta =
      Math.round(
        participantesComItens.reduce((acc, p) => acc + p.valorGorjeta, 0) * 100,
      ) / 100;

    let participantesEnviados = 0;
    let falhas = 0;

    const resultadosPart = await Promise.allSettled(
      participantesComItens.map((p) =>
        this.mail.enviarFechamentoParticipante({
          para: p.email,
          nomeParticipante: p.nome,
          rodadaId: rodada.id,
          rodadaTitulo: rodada.titulo,
          itens: p.itens,
          cafezinhosGorjeta: p.cafezinhosGorjeta,
          valorGorjeta: p.valorGorjeta,
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
          totalCafezinhosGorjeta,
          totalValorGorjeta,
          participantes: participantesComItens.map((p) => ({
            nome: p.nome,
            email: p.email,
            cafezinhosGorjeta: p.cafezinhosGorjeta,
            valorGorjeta: p.valorGorjeta,
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
      cafezinhosGorjeta: number;
      valorGorjeta: number;
    }>(
      `SELECT s.id AS solicitacaoId, u.id AS usuarioId, u.nome, u.email,
              s.status_pagamento AS statusPagamento, s.data_pagamento AS dataPagamento,
              s.cafezinhos_gorjeta AS cafezinhosGorjeta, s.valor_gorjeta AS valorGorjeta
         FROM solicitacoes s JOIN usuarios u ON u.id = s.usuario_id
        WHERE s.rodada_id = ? ORDER BY u.nome`,
      [id],
    );
    const totais = new Map(participantes.map((p) => [p.usuarioId, p]));
    const lista = solicitacoes.map((s) => {
      const t = totais.get(s.usuarioId);
      const totalEmCaixasFechadas = t?.totalEmCaixasFechadas ?? 0;
      const temCaixaFechada = (t?.capsulasEmCaixas ?? 0) > 0;
      const cafezinhosGorjeta = temCaixaFechada ? Number(s.cafezinhosGorjeta ?? 0) : 0;
      const valorGorjeta = temCaixaFechada ? Number(s.valorGorjeta ?? 0) : 0;
      return {
        ...s,
        cafezinhosGorjeta,
        valorGorjeta,
        totalCapsulas: t?.totalCapsulas ?? 0,
        capsulasEmCaixas: t?.capsulasEmCaixas ?? 0,
        totalSolicitado: t?.totalSolicitado ?? 0,
        totalEmCaixasFechadas,
        valorAPagar: Math.round((totalEmCaixasFechadas + valorGorjeta) * 100) / 100,
      };
    });
    const totalCafezinhosGorjeta = lista.reduce((acc, p) => acc + p.cafezinhosGorjeta, 0);
    const totalValorGorjeta =
      Math.round(lista.reduce((acc, p) => acc + p.valorGorjeta, 0) * 100) / 100;
    return {
      rodada,
      participantes: lista,
      resumo,
      totalCafezinhosGorjeta,
      totalValorGorjeta,
    };
  }

  /**
   * Ranking anual de cafezinhos doados (somente rodadas nao canceladas em que
   * o participante teve pelo menos 1 caixa fechada).
   */
  async rankingCafezinhos(anoParam?: number) {
    const anoAtual = new Date().getFullYear();
    const ano =
      anoParam && Number.isInteger(anoParam) && anoParam >= 2020 && anoParam <= 2100
        ? anoParam
        : anoAtual;

    const anosRows = await this.db.query<{ ano: number }>(
      `SELECT DISTINCT YEAR(COALESCE(data_fechamento, data_abertura)) AS ano
         FROM rodadas_pedido
        WHERE status <> 'CANCELADO'
        ORDER BY ano DESC`,
    );
    const anosSet = new Set<number>([anoAtual, ano]);
    for (const r of anosRows) {
      if (r.ano) anosSet.add(Number(r.ano));
    }
    const anosDisponiveis = Array.from(anosSet).sort((a, b) => b - a);

    const doacoes = await this.db.query<{
      rodadaId: number;
      usuarioId: number;
      nome: string;
      cafezinhos: number;
    }>(
      `SELECT r.id AS rodadaId, s.usuario_id AS usuarioId, u.nome,
              s.cafezinhos_gorjeta AS cafezinhos
         FROM solicitacoes s
         JOIN rodadas_pedido r ON r.id = s.rodada_id
         JOIN usuarios u ON u.id = s.usuario_id
        WHERE r.status <> 'CANCELADO'
          AND s.status_pagamento = 'PAGO'
          AND s.cafezinhos_gorjeta > 0
          AND YEAR(COALESCE(r.data_fechamento, r.data_abertura)) = ?`,
      [ano],
    );

    const rodadaIds = Array.from(new Set(doacoes.map((d) => d.rodadaId)));
    const fechadosPorRodada = new Map<number, Set<number>>();
    await Promise.all(
      rodadaIds.map(async (rodadaId) => {
        const calc = await this.calcular(rodadaId);
        const comCaixa = new Set(
          calc.participantes
            .filter((p) => p.capsulasEmCaixas > 0)
            .map((p) => p.usuarioId),
        );
        fechadosPorRodada.set(rodadaId, comCaixa);
      }),
    );

    const acumulado = new Map<
      number,
      { usuarioId: number; nome: string; totalCafezinhos: number; rodadasApoiadas: number }
    >();

    for (const d of doacoes) {
      if (!fechadosPorRodada.get(d.rodadaId)?.has(d.usuarioId)) continue;
      const qtd = Number(d.cafezinhos ?? 0);
      if (qtd <= 0) continue;
      const atual = acumulado.get(d.usuarioId) ?? {
        usuarioId: d.usuarioId,
        nome: d.nome,
        totalCafezinhos: 0,
        rodadasApoiadas: 0,
      };
      atual.totalCafezinhos += qtd;
      atual.rodadasApoiadas += 1;
      acumulado.set(d.usuarioId, atual);
    }

    const ordenado = Array.from(acumulado.values()).sort(
      (a, b) =>
        b.totalCafezinhos - a.totalCafezinhos ||
        b.rodadasApoiadas - a.rodadasApoiadas ||
        a.nome.localeCompare(b.nome, 'pt-BR'),
    );

    let posicaoAtual = 0;
    let anteriorQtd: number | null = null;
    const ranking = ordenado.map((item, idx) => {
      if (anteriorQtd === null || item.totalCafezinhos < anteriorQtd) {
        posicaoAtual = idx + 1;
        anteriorQtd = item.totalCafezinhos;
      }
      return {
        posicao: posicaoAtual,
        ...item,
      };
    });

    const totalCafezinhosAno = ranking.reduce(
      (acc, r) => acc + r.totalCafezinhos,
      0,
    );

    return {
      ano,
      anosDisponiveis,
      totalCafezinhosAno,
      totalDoadores: ranking.length,
      ranking,
    };
  }

  /**
   * Dashboard pessoal do usuario (Painel): estatisticas anuais e curiosidades.
   */
  async meuPainel(usuario: UsuarioAutenticado, anoParam?: number) {
    const rankingRes = await this.rankingCafezinhos(anoParam);
    const { ano, anosDisponiveis } = rankingRes;

    const minhasSolicitacoes = await this.db.query<{
      rodadaId: number;
      titulo: string;
      status: StatusRodada;
      dataAbertura: Date;
      dataFechamento: Date | null;
      statusPagamento: 'PENDENTE' | 'PAGO';
      cafezinhosGorjeta: number;
      valorGorjeta: number;
    }>(
      `SELECT r.id AS rodadaId, r.titulo, r.status,
              r.data_abertura AS dataAbertura, r.data_fechamento AS dataFechamento,
              s.status_pagamento AS statusPagamento,
              s.cafezinhos_gorjeta AS cafezinhosGorjeta,
              s.valor_gorjeta AS valorGorjeta
         FROM solicitacoes s
         JOIN rodadas_pedido r ON r.id = s.rodada_id
        WHERE s.usuario_id = ?
          AND r.status <> 'CANCELADO'
          AND YEAR(COALESCE(r.data_fechamento, r.data_abertura)) = ?
        ORDER BY r.id DESC`,
      [usuario.id, ano],
    );

    const calculos = await Promise.all(
      minhasSolicitacoes.map(async (s) => ({
        sol: s,
        calc: await this.calcular(s.rodadaId),
      })),
    );

    let totalPedidosAno = 0;
    let totalCapsulasConsumidasAno = 0;
    let totalCapsulasSolicitadasAno = 0;
    let valorInvestidoAno = 0;
    let cafezinhosDoadosAno = 0;

    const porSabor = new Map<
      number,
      { capsulaId: number; nome: string; confirmadas: number; solicitadas: number }
    >();

    const ultimasRodadas: {
      rodadaId: number;
      titulo: string;
      status: StatusRodada;
      statusPagamento: 'PENDENTE' | 'PAGO';
      dataAbertura: Date;
      capsulasConfirmadas: number;
      capsulasSolicitadas: number;
      valorAPagar: number;
    }[] = [];

    for (const { sol, calc } of calculos) {
      const meusItens = calc.itens.filter((i) => i.usuarioId === usuario.id);
      if (meusItens.length === 0) continue;

      totalPedidosAno += 1;
      const resumoPart = calc.participantes.find((p) => p.usuarioId === usuario.id);
      const capsConfirmadas = resumoPart?.capsulasEmCaixas ?? 0;
      const capsSolicitadas = resumoPart?.totalCapsulas ?? 0;
      const valorCaixas = resumoPart?.totalEmCaixasFechadas ?? 0;
      const temCaixa = capsConfirmadas > 0;
      const gorjetaEfetiva = temCaixa ? Number(sol.valorGorjeta ?? 0) : 0;

      totalCapsulasConsumidasAno += capsConfirmadas;
      totalCapsulasSolicitadasAno += capsSolicitadas;
      valorInvestidoAno += valorCaixas;

      if (temCaixa && sol.statusPagamento === 'PAGO') {
        cafezinhosDoadosAno += Number(sol.cafezinhosGorjeta ?? 0);
      }

      for (const item of meusItens) {
        const atual = porSabor.get(item.capsulaId) ?? {
          capsulaId: item.capsulaId,
          nome: item.capsulaNome,
          confirmadas: 0,
          solicitadas: 0,
        };
        atual.confirmadas += item.quantidadeEmCaixa;
        atual.solicitadas += item.quantidade;
        porSabor.set(item.capsulaId, atual);
      }

      if (ultimasRodadas.length < 5) {
        ultimasRodadas.push({
          rodadaId: sol.rodadaId,
          titulo: sol.titulo,
          status: sol.status,
          statusPagamento: sol.statusPagamento,
          dataAbertura: sol.dataAbertura,
          capsulasConfirmadas: capsConfirmadas,
          capsulasSolicitadas: capsSolicitadas,
          valorAPagar: Math.round((valorCaixas + gorjetaEfetiva) * 100) / 100,
        });
      }
    }

    valorInvestidoAno = Math.round(valorInvestidoAno * 100) / 100;

    // Detalhes das capsulas do catalogo para enriquecer sabores, novidade, variedade e intensidade
    const todasCapsulas = await this.db.query<{
      id: number;
      nome: string;
      descricao: string | null;
      imagemUrl: string | null;
      intensidade: number | null;
      precoAtual: number;
      ativo: number;
      criadoEm: Date;
    }>(
      `SELECT id, nome, descricao, imagem_url AS imagemUrl, intensidade,
              preco_atual AS precoAtual, ativo, criado_em AS criadoEm
         FROM capsulas
        ORDER BY criado_em DESC, id DESC`,
    );
    const capsulaMap = new Map(todasCapsulas.map((c) => [c.id, c]));

    // Sabores ja pedidos pelo usuario em todo o historico (para "variedade" e "novidade")
    const historicoSabores = await this.db.query<{ capsulaId: number }>(
      `SELECT DISTINCT i.capsula_id AS capsulaId
         FROM itens_solicitacao i
         JOIN solicitacoes s ON s.id = i.solicitacao_id
         JOIN rodadas_pedido r ON r.id = s.rodada_id
        WHERE s.usuario_id = ? AND r.status <> 'CANCELADO'`,
      [usuario.id],
    );
    const provadosSet = new Set(historicoSabores.map((h) => h.capsulaId));

    const ativas = todasCapsulas.filter((c) => Boolean(c.ativo));
    const saboresProvadosAtivos = ativas.filter((c) => provadosSet.has(c.id)).length;
    const novidadeRow = ativas[0] ?? null;
    const saborNovidade = novidadeRow
      ? {
          capsulaId: novidadeRow.id,
          nome: novidadeRow.nome,
          descricao: novidadeRow.descricao,
          imagemUrl: novidadeRow.imagemUrl,
          intensidade:
            novidadeRow.intensidade !== null && novidadeRow.intensidade !== undefined
              ? Number(novidadeRow.intensidade)
              : null,
          precoAtual: Number(novidadeRow.precoAtual),
          criadoEm: novidadeRow.criadoEm,
          jaExperimentou: provadosSet.has(novidadeRow.id),
        }
      : null;

    // Top sabores do ano (prioriza confirmadas; se ainda nao fechou caixa, usa solicitadas)
    const usarConfirmadas = totalCapsulasConsumidasAno > 0;
    const saboresOrdenados = Array.from(porSabor.values())
      .map((s) => {
        const cap = capsulaMap.get(s.capsulaId);
        const qtd = usarConfirmadas ? s.confirmadas : s.solicitadas;
        return {
          capsulaId: s.capsulaId,
          nome: s.nome,
          quantidade: qtd,
          imagemUrl: cap?.imagemUrl ?? null,
          descricao: cap?.descricao ?? null,
          intensidade:
            cap && cap.intensidade !== null && cap.intensidade !== undefined
              ? Number(cap.intensidade)
              : null,
        };
      })
      .filter((s) => s.quantidade > 0)
      .sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, 'pt-BR'));

    const saborPreferido = saboresOrdenados[0] ?? null;
    const topSabores = saboresOrdenados.slice(0, 5);

    // Intensidade media ponderada
    let somaIntensidade = 0;
    let pesoIntensidade = 0;
    for (const s of saboresOrdenados) {
      if (s.intensidade !== null && s.intensidade > 0) {
        somaIntensidade += s.intensidade * s.quantidade;
        pesoIntensidade += s.quantidade;
      }
    }
    const intensidadeMedia =
      pesoIntensidade > 0 ? Math.round((somaIntensidade / pesoIntensidade) * 10) / 10 : null;

    // Historico de sorteios ganhos pelo usuario
    const sorteiosGanhos = await this.db.query<{
      brindeNome: string;
      rodadaId: number;
      rodadaTitulo: string;
      sorteadoEm: Date;
    }>(
      `SELECT b.nome AS brindeNome, b.rodada_id AS rodadaId,
              r.titulo AS rodadaTitulo, b.sorteado_em AS sorteadoEm
         FROM brindes_rodada b
         JOIN rodadas_pedido r ON r.id = b.rodada_id
        WHERE b.vencedor_id = ? AND b.sorteado_em IS NOT NULL
        ORDER BY b.sorteado_em DESC`,
      [usuario.id],
    );
    const vezesSorteadoNoAno = sorteiosGanhos.filter(
      (s) => new Date(s.sorteadoEm).getFullYear() === ano,
    ).length;

    const minhaPosicaoRanking =
      rankingRes.ranking.find((r) => r.usuarioId === usuario.id)?.posicao ?? null;

    return {
      ano,
      anosDisponiveis,
      totalPedidosAno,
      totalCapsulasConsumidasAno,
      totalCapsulasSolicitadasAno,
      valorInvestidoAno,
      mediaCapsulasPorPedido:
        totalPedidosAno > 0
          ? Math.round(
              ((usarConfirmadas ? totalCapsulasConsumidasAno : totalCapsulasSolicitadasAno) /
                totalPedidosAno) *
                10,
            ) / 10
          : 0,
      cafezinhosDoadosAno,
      posicaoRanking: minhaPosicaoRanking,
      sorteios: {
        jaFoiSorteado: sorteiosGanhos.length > 0,
        vezesTotal: sorteiosGanhos.length,
        vezesNoAno: vezesSorteadoNoAno,
        ultimoSorteio: sorteiosGanhos[0] ?? null,
      },
      saborPreferido,
      topSabores,
      saborNovidade,
      variedade: {
        saboresProvados: saboresProvadosAtivos,
        totalSaboresAtivos: ativas.length,
      },
      intensidadeMedia,
      ultimasRodadas,
    };
  }

  async obterPixQrCodePng(rodadaId: number): Promise<Buffer> {
    const [row] = await this.db.query<{ pixChave: string | null }>(
      `SELECT u.pix_chave AS pixChave
         FROM rodadas_pedido r
         JOIN usuarios u ON u.id = r.organizador_id
        WHERE r.id = ?`,
      [rodadaId],
    );
    const codigo = row?.pixChave?.trim();
    if (!codigo || !codigo.startsWith('000201') || !codigo.includes('br.gov.bcb.pix')) {
      throw new NotFoundException('QR Code PIX indisponivel para esta rodada.');
    }
    return QRCode.toBuffer(codigo, {
      type: 'png',
      width: 260,
      margin: 2,
      errorCorrectionLevel: 'M',
    });
  }
}
