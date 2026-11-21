import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UsuarioAutenticado } from '../common/types/usuario-autenticado';
import { DatabaseService, isDuplicateEntry } from '../database/database.service';
import { AtualizarCapsulaDto, CriarCapsulaDto } from './capsulas.dto';

const SELECT_CAPSULA = `
  SELECT id, nome, descricao, imagem_url AS imagemUrl, intensidade,
         preco_atual AS precoAtual, tamanho_caixa AS tamanhoCaixa,
         (ativo = 1) AS ativo, criado_em AS criadoEm, atualizado_em AS atualizadoEm
    FROM capsulas`;

function limparTexto(valor: string | null | undefined): string | null {
  if (valor == null) return null;
  const limpo = valor.trim();
  return limpo ? limpo : null;
}

@Injectable()
export class CapsulasService {
  constructor(private readonly db: DatabaseService) {}

  /** Usuarios comuns so enxergam capsulas ativas. */
  listar(usuario: UsuarioAutenticado, somenteAtivas: boolean) {
    const filtrar = somenteAtivas || usuario.perfil !== 'ADMIN';
    return this.db.query(
      `${SELECT_CAPSULA} ${filtrar ? 'WHERE ativo = 1' : ''} ORDER BY nome`,
    );
  }

  async obter(id: number) {
    const [capsula] = await this.db.query(`${SELECT_CAPSULA} WHERE id = ?`, [
      id,
    ]);
    if (!capsula) throw new NotFoundException('Capsula nao encontrada.');
    return capsula;
  }

  /** Cria a capsula e ja registra o primeiro preco no historico (transacao). */
  async criar(dto: CriarCapsulaDto, usuario: UsuarioAutenticado) {
    try {
      const id = await this.db.transaction(async (tx) => {
        const res = await tx.execute(
          `INSERT INTO capsulas (nome, descricao, imagem_url, intensidade, preco_atual, tamanho_caixa, ativo, criado_em, atualizado_em)
           VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
          [
            dto.nome.trim(),
            limparTexto(dto.descricao),
            limparTexto(dto.imagemUrl),
            dto.intensidade ?? null,
            dto.precoAtual,
            dto.tamanhoCaixa ?? 50,
          ],
        );
        await tx.execute(
          `INSERT INTO historico_precos (capsula_id, preco, alterado_por, data_vigencia)
           VALUES (?, ?, ?, NOW())`,
          [res.insertId, dto.precoAtual, usuario.id],
        );
        return res.insertId;
      });
      return this.obter(id);
    } catch (erro) {
      if (isDuplicateEntry(erro)) {
        throw new ConflictException('Ja existe uma capsula com este nome.');
      }
      throw erro;
    }
  }

  /**
   * Atualiza a capsula. Se o preco mudar, grava capsulas.preco_atual e insere
   * historico_precos na MESMA transacao. Pedidos antigos nao sao afetados
   * porque itens_solicitacao guarda o preco congelado.
   */
  async atualizar(
    id: number,
    dto: AtualizarCapsulaDto,
    usuario: UsuarioAutenticado,
  ) {
    try {
      await this.db.transaction(async (tx) => {
        const [atual] = await tx.query<{
          nome: string;
          descricao: string | null;
          imagem_url: string | null;
          intensidade: number | null;
          preco_atual: number;
          tamanho_caixa: number;
        }>(
          'SELECT nome, descricao, imagem_url, intensidade, preco_atual, tamanho_caixa FROM capsulas WHERE id = ? FOR UPDATE',
          [id],
        );
        if (!atual) throw new NotFoundException('Capsula nao encontrada.');

        const novoPreco = dto.precoAtual ?? atual.preco_atual;
        const novaDescricao =
          dto.descricao !== undefined ? limparTexto(dto.descricao) : atual.descricao;
        const novaImagem =
          dto.imagemUrl !== undefined ? limparTexto(dto.imagemUrl) : atual.imagem_url;
        const novaIntensidade =
          dto.intensidade !== undefined ? dto.intensidade : atual.intensidade;

        await tx.execute(
          `UPDATE capsulas
              SET nome = ?, descricao = ?, imagem_url = ?, intensidade = ?, preco_atual = ?,
                  tamanho_caixa = ?, atualizado_em = NOW()
            WHERE id = ?`,
          [
            dto.nome?.trim() ?? atual.nome,
            novaDescricao,
            novaImagem,
            novaIntensidade,
            novoPreco,
            dto.tamanhoCaixa ?? atual.tamanho_caixa,
            id,
          ],
        );

        if (Number(novoPreco) !== Number(atual.preco_atual)) {
          await tx.execute(
            `INSERT INTO historico_precos (capsula_id, preco, alterado_por, data_vigencia)
             VALUES (?, ?, ?, NOW())`,
            [id, novoPreco, usuario.id],
          );
        }
      });
      return this.obter(id);
    } catch (erro) {
      if (isDuplicateEntry(erro)) {
        throw new ConflictException('Ja existe uma capsula com este nome.');
      }
      throw erro;
    }
  }

  async definirAtivo(id: number, ativo: boolean) {
    const res = await this.db.execute(
      'UPDATE capsulas SET ativo = ?, atualizado_em = NOW() WHERE id = ?',
      [ativo ? 1 : 0, id],
    );
    if (!res.affectedRows) throw new NotFoundException('Capsula nao encontrada.');
    return this.obter(id);
  }

  async historicoPrecos(id: number) {
    await this.obter(id);
    return this.db.query(
      `SELECT h.id, h.preco, h.data_vigencia AS dataVigencia,
              h.alterado_por AS alteradoPorId, u.nome AS alteradoPorNome
         FROM historico_precos h
         LEFT JOIN usuarios u ON u.id = h.alterado_por
        WHERE h.capsula_id = ?
        ORDER BY h.data_vigencia DESC, h.id DESC`,
      [id],
    );
  }
}
