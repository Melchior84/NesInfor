import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UsuarioAutenticado } from '../common/types/usuario-autenticado';
import { DatabaseService } from '../database/database.service';
import { CriarBrindeDto } from './brindes.dto';
import { RodadasService } from './rodadas.service';
import { executarSorteioAuditavel, ParticipanteSorteio } from './sorteio';

interface RodadaSorteioRow {
  id: number;
  organizadorId: number | null;
  organizadorNome: string | null;
  sorteadorId: number | null;
  sorteadorNome: string | null;
  status: string;
}

interface BrindeRow {
  id: number;
  rodadaId: number;
  nome: string;
  descricao: string | null;
  vencedorId: number | null;
  vencedorNome: string | null;
  sorteadoPorId: number | null;
  sorteadoPorNome: string | null;
  sorteadoEm: Date | null;
  seedPublica: string | null;
  hashAuditoria: string | null;
  indiceSorteado: number | null;
  participantesSnapshot: ParticipanteSorteio[] | string | null;
  criadoEm: Date;
}

@Injectable()
export class BrindesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly rodadas: RodadasService,
  ) {}

  private async carregarRodadaSorteio(rodadaId: number): Promise<RodadaSorteioRow> {
    const [row] = await this.db.query<RodadaSorteioRow>(
      `SELECT r.id,
              r.organizador_id AS organizadorId,
              COALESCE(NULLIF(TRIM(uo.nome_exibicao), ''), uo.nome) AS organizadorNome,
              r.sorteador_id AS sorteadorId,
              COALESCE(NULLIF(TRIM(us.nome_exibicao), ''), us.nome) AS sorteadorNome,
              r.status
         FROM rodadas_pedido r
         LEFT JOIN usuarios uo ON uo.id = r.organizador_id
         LEFT JOIN usuarios us ON us.id = r.sorteador_id
        WHERE r.id = ?`,
      [rodadaId],
    );
    if (!row) throw new NotFoundException('Rodada nao encontrada.');
    return row;
  }

  private podeGerenciar(rodada: RodadaSorteioRow, usuario: UsuarioAutenticado): boolean {
    return (
      usuario.perfil === 'ADMIN' ||
      rodada.organizadorId === usuario.id ||
      rodada.sorteadorId === usuario.id
    );
  }

  private podeDefinirSorteador(
    rodada: RodadaSorteioRow,
    usuario: UsuarioAutenticado,
  ): boolean {
    return usuario.perfil === 'ADMIN' || rodada.organizadorId === usuario.id;
  }

  async listar(rodadaId: number, usuario: UsuarioAutenticado) {
    const rodada = await this.carregarRodadaSorteio(rodadaId);
    const calculo = await this.rodadas.calcular(rodadaId);

    // Elegiveis: quem teve pelo menos 1 capsula confirmada em caixa fechada
    const elegiveisRodada: ParticipanteSorteio[] = calculo.participantes
      .filter((p) => p.capsulasEmCaixas > 0)
      .map((p) => ({ usuarioId: p.usuarioId, nome: p.nome }))
      .sort((a, b) => a.usuarioId - b.usuarioId);

    const brindesRows = await this.db.query<BrindeRow>(
      `SELECT b.id, b.rodada_id AS rodadaId, b.nome, b.descricao,
              b.vencedor_id AS vencedorId,
              COALESCE(NULLIF(TRIM(uv.nome_exibicao), ''), uv.nome) AS vencedorNome,
              b.sorteado_por AS sorteadoPorId,
              COALESCE(NULLIF(TRIM(us.nome_exibicao), ''), us.nome) AS sorteadoPorNome,
              b.sorteado_em AS sorteadoEm,
              b.seed_publica AS seedPublica,
              b.hash_auditoria AS hashAuditoria,
              b.indice_sorteado AS indiceSorteado,
              b.participantes_snapshot AS participantesSnapshot,
              b.criado_em AS criadoEm
         FROM brindes_rodada b
         LEFT JOIN usuarios uv ON uv.id = b.vencedor_id
         LEFT JOIN usuarios us ON us.id = b.sorteado_por
        WHERE b.rodada_id = ?
        ORDER BY b.id ASC`,
      [rodadaId],
    );

    const exclusoesRows = brindesRows.length
      ? await this.db.query<{ brindeId: number; usuarioId: number }>(
          `SELECT e.brinde_id AS brindeId, e.usuario_id AS usuarioId
             FROM brinde_exclusoes e
             JOIN brindes_rodada b ON b.id = e.brinde_id
            WHERE b.rodada_id = ?`,
          [rodadaId],
        )
      : [];

    const exclusoesPorBrinde = new Map<number, Set<number>>();
    for (const ex of exclusoesRows) {
      const set = exclusoesPorBrinde.get(ex.brindeId) ?? new Set<number>();
      set.add(ex.usuarioId);
      exclusoesPorBrinde.set(ex.brindeId, set);
    }

    const jaPremiadosIds = new Set<number>(
      brindesRows
        .filter((b) => b.vencedorId !== null)
        .map((b) => b.vencedorId as number),
    );

    const euElegivel = elegiveisRodada.some((e) => e.usuarioId === usuario.id);
    const euJaPremiado = jaPremiadosIds.has(usuario.id);

    const brindes = brindesRows.map((b) => {
      const sorteado = b.vencedorId !== null;
      const excluidos = exclusoesPorBrinde.get(b.id) ?? new Set<number>();

      let snapshot: ParticipanteSorteio[] = [];
      if (b.participantesSnapshot) {
        snapshot =
          typeof b.participantesSnapshot === 'string'
            ? (JSON.parse(b.participantesSnapshot) as ParticipanteSorteio[])
            : b.participantesSnapshot;
      }

      const concorrentes = sorteado
        ? snapshot
        : elegiveisRodada.filter(
            (e) => !excluidos.has(e.usuarioId) && !jaPremiadosIds.has(e.usuarioId),
          );

      const desistentes = sorteado
        ? []
        : elegiveisRodada.filter((e) => excluidos.has(e.usuarioId));

      const jaPremiados = sorteado
        ? []
        : elegiveisRodada.filter(
            (e) => jaPremiadosIds.has(e.usuarioId) && !excluidos.has(e.usuarioId),
          );

      return {
        id: b.id,
        rodadaId: b.rodadaId,
        nome: b.nome,
        descricao: b.descricao,
        sorteado,
        vencedorId: b.vencedorId,
        vencedorNome: b.vencedorNome,
        sorteadoPorId: b.sorteadoPorId,
        sorteadoPorNome: b.sorteadoPorNome,
        sorteadoEm: b.sorteadoEm,
        seedPublica: b.seedPublica,
        hashAuditoria: b.hashAuditoria,
        indiceSorteado: b.indiceSorteado,
        concorrentes,
        desistentes,
        jaPremiados,
        euParticipando: euElegivel && !excluidos.has(usuario.id) && !euJaPremiado,
        euDesisti: euElegivel && excluidos.has(usuario.id),
      };
    });

    const podeDefinir = this.podeDefinirSorteador(rodada, usuario);
    const usuariosDisponiveis = podeDefinir
      ? await this.db.query<{ id: number; nome: string }>(
          'SELECT id, nome FROM usuarios WHERE ativo = 1 ORDER BY nome',
        )
      : [];

    return {
      rodadaId,
      organizadorId: rodada.organizadorId,
      organizadorNome: rodada.organizadorNome,
      sorteadorId: rodada.sorteadorId,
      sorteadorNome: rodada.sorteadorNome,
      encarregadoNome: rodada.sorteadorNome ?? rodada.organizadorNome ?? null,
      podeGerenciarSorteio: this.podeGerenciar(rodada, usuario),
      podeDefinirSorteador: podeDefinir,
      euElegivel,
      euJaPremiado,
      elegiveisRodada,
      usuariosDisponiveis,
      brindes,
    };
  }

  async definirSorteador(
    rodadaId: number,
    sorteadorId: number | null,
    usuario: UsuarioAutenticado,
  ) {
    const rodada = await this.carregarRodadaSorteio(rodadaId);
    if (!this.podeDefinirSorteador(rodada, usuario)) {
      throw new ForbiddenException(
        'Apenas o organizador da rodada ou um ADMIN pode definir o encarregado do sorteio.',
      );
    }

    if (sorteadorId !== null) {
      const [alvo] = await this.db.query<{ id: number }>(
        'SELECT id FROM usuarios WHERE id = ? AND ativo = 1',
        [sorteadorId],
      );
      if (!alvo) {
        throw new NotFoundException('Usuario selecionado nao encontrado ou inativo.');
      }
    }

    await this.db.execute(
      'UPDATE rodadas_pedido SET sorteador_id = ? WHERE id = ?',
      [sorteadorId, rodadaId],
    );
    return this.listar(rodadaId, usuario);
  }

  async criar(
    rodadaId: number,
    dto: CriarBrindeDto,
    usuario: UsuarioAutenticado,
  ) {
    const rodada = await this.carregarRodadaSorteio(rodadaId);
    if (!this.podeGerenciar(rodada, usuario)) {
      throw new ForbiddenException(
        'Apenas o encarregado do sorteio, o organizador da rodada ou um ADMIN pode cadastrar brindes.',
      );
    }
    if (!['FECHADO', 'COMPRADO', 'ENTREGUE'].includes(rodada.status)) {
      throw new ConflictException(
        'Brindes so podem ser cadastrados depois que o pedido for fechado.',
      );
    }

    await this.db.execute(
      'INSERT INTO brindes_rodada (rodada_id, nome, descricao) VALUES (?, ?, ?)',
      [rodadaId, dto.nome.trim(), dto.descricao?.trim() || null],
    );
    return this.listar(rodadaId, usuario);
  }

  async remover(
    rodadaId: number,
    brindeId: number,
    usuario: UsuarioAutenticado,
  ) {
    const rodada = await this.carregarRodadaSorteio(rodadaId);
    if (!this.podeGerenciar(rodada, usuario)) {
      throw new ForbiddenException(
        'Apenas o encarregado do sorteio, o organizador da rodada ou um ADMIN pode remover brindes.',
      );
    }

    const [brinde] = await this.db.query<{ id: number; vencedorId: number | null }>(
      'SELECT id, vencedor_id AS vencedorId FROM brindes_rodada WHERE id = ? AND rodada_id = ?',
      [brindeId, rodadaId],
    );
    if (!brinde) throw new NotFoundException('Brinde nao encontrado nesta rodada.');
    if (brinde.vencedorId !== null) {
      throw new ConflictException(
        'Nao e possivel remover um brinde que ja foi sorteado (registro de auditoria).',
      );
    }

    await this.db.execute('DELETE FROM brindes_rodada WHERE id = ?', [brindeId]);
    return this.listar(rodadaId, usuario);
  }

  async definirParticipacao(
    rodadaId: number,
    brindeId: number,
    participar: boolean,
    usuario: UsuarioAutenticado,
  ) {
    await this.carregarRodadaSorteio(rodadaId);
    const [brinde] = await this.db.query<{ id: number; vencedorId: number | null }>(
      'SELECT id, vencedor_id AS vencedorId FROM brindes_rodada WHERE id = ? AND rodada_id = ?',
      [brindeId, rodadaId],
    );
    if (!brinde) throw new NotFoundException('Brinde nao encontrado nesta rodada.');
    if (brinde.vencedorId !== null) {
      throw new ConflictException('Este brinde ja foi sorteado.');
    }

    const calculo = await this.rodadas.calcular(rodadaId);
    const elegivel = calculo.participantes.some(
      (p) => p.usuarioId === usuario.id && p.capsulasEmCaixas > 0,
    );
    if (!elegivel) {
      throw new ForbiddenException(
        'Apenas participantes com pelo menos 1 capsula em caixa fechada participam do sorteio.',
      );
    }

    if (participar) {
      await this.db.execute(
        'DELETE FROM brinde_exclusoes WHERE brinde_id = ? AND usuario_id = ?',
        [brindeId, usuario.id],
      );
    } else {
      await this.db.execute(
        `INSERT INTO brinde_exclusoes (brinde_id, usuario_id)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE brinde_id = brinde_id`,
        [brindeId, usuario.id],
      );
    }

    return this.listar(rodadaId, usuario);
  }

  async definirParticipacaoUsuario(
    rodadaId: number,
    brindeId: number,
    usuarioIdAlvo: number,
    participar: boolean,
    ator: UsuarioAutenticado,
  ) {
    const rodada = await this.carregarRodadaSorteio(rodadaId);
    if (!this.podeGerenciar(rodada, ator)) {
      throw new ForbiddenException(
        'Apenas o encarregado do sorteio, o organizador da rodada ou um ADMIN pode alterar a participacao de outros usuarios.',
      );
    }

    const [brinde] = await this.db.query<{ id: number; vencedorId: number | null }>(
      'SELECT id, vencedor_id AS vencedorId FROM brindes_rodada WHERE id = ? AND rodada_id = ?',
      [brindeId, rodadaId],
    );
    if (!brinde) throw new NotFoundException('Brinde nao encontrado nesta rodada.');
    if (brinde.vencedorId !== null) {
      throw new ConflictException('Este brinde ja foi sorteado.');
    }

    const calculo = await this.rodadas.calcular(rodadaId);
    const elegivel = calculo.participantes.some(
      (p) => p.usuarioId === usuarioIdAlvo && p.capsulasEmCaixas > 0,
    );
    if (!elegivel) {
      throw new BadRequestException(
        'Este usuario nao possui capsulas confirmadas em caixa fechada nesta rodada.',
      );
    }

    if (participar) {
      await this.db.execute(
        'DELETE FROM brinde_exclusoes WHERE brinde_id = ? AND usuario_id = ?',
        [brindeId, usuarioIdAlvo],
      );
    } else {
      await this.db.execute(
        `INSERT INTO brinde_exclusoes (brinde_id, usuario_id)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE brinde_id = brinde_id`,
        [brindeId, usuarioIdAlvo],
      );
    }

    return this.listar(rodadaId, ator);
  }

  async sortear(
    rodadaId: number,
    brindeId: number,
    usuario: UsuarioAutenticado,
  ) {
    const rodada = await this.carregarRodadaSorteio(rodadaId);
    if (!this.podeGerenciar(rodada, usuario)) {
      throw new ForbiddenException(
        'Apenas o encarregado do sorteio, o organizador da rodada ou um ADMIN pode realizar o sorteio.',
      );
    }
    if (!['FECHADO', 'COMPRADO', 'ENTREGUE'].includes(rodada.status)) {
      throw new ConflictException(
        'O sorteio so pode ser realizado depois que o pedido for fechado.',
      );
    }

    await this.db.transaction(async (tx) => {
      // Lock em todos os brindes da rodada para garantir atomicidade da regra "1 brinde por pessoa"
      const brindes = await tx.query<{ id: number; vencedorId: number | null }>(
        `SELECT id, vencedor_id AS vencedorId
           FROM brindes_rodada
          WHERE rodada_id = ?
          FOR UPDATE`,
        [rodadaId],
      );

      const alvo = brindes.find((b) => b.id === brindeId);
      if (!alvo) throw new NotFoundException('Brinde nao encontrado nesta rodada.');
      if (alvo.vencedorId !== null) {
        throw new ConflictException('Este brinde ja foi sorteado.');
      }

      const jaPremiados = new Set<number>(
        brindes
          .filter((b) => b.vencedorId !== null)
          .map((b) => b.vencedorId as number),
      );

      const exclusoes = await tx.query<{ usuarioId: number }>(
        'SELECT usuario_id AS usuarioId FROM brinde_exclusoes WHERE brinde_id = ?',
        [brindeId],
      );
      const excluidosIds = new Set(exclusoes.map((e) => e.usuarioId));

      const calculo = await this.rodadas.calcular(rodadaId, tx);
      const concorrentes: ParticipanteSorteio[] = calculo.participantes
        .filter(
          (p) =>
            p.capsulasEmCaixas > 0 &&
            !excluidosIds.has(p.usuarioId) &&
            !jaPremiados.has(p.usuarioId),
        )
        .map((p) => ({ usuarioId: p.usuarioId, nome: p.nome }))
        .sort((a, b) => a.usuarioId - b.usuarioId);

      if (concorrentes.length === 0) {
        throw new BadRequestException(
          'Nao ha participantes elegiveis disponiveis para sortear este brinde.',
        );
      }

      const resultado = executarSorteioAuditavel(rodadaId, brindeId, concorrentes);

      await tx.execute(
        `UPDATE brindes_rodada
            SET vencedor_id = ?,
                sorteado_por = ?,
                sorteado_em = NOW(),
                seed_publica = ?,
                hash_auditoria = ?,
                indice_sorteado = ?,
                participantes_snapshot = ?
          WHERE id = ?`,
        [
          resultado.vencedor.usuarioId,
          usuario.id,
          resultado.seedPublica,
          resultado.hashAuditoria,
          resultado.indiceSorteado,
          JSON.stringify(resultado.participantesOrdenados),
          brindeId,
        ],
      );
    });

    return this.listar(rodadaId, usuario);
  }
}
