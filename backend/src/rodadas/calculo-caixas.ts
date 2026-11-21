/**
 * Calculo das caixas fechadas (funcao pura, sem acesso a banco).
 *
 * Regras:
 *  - Cada sabor fecha `floor(total / tamanhoCaixa)` caixas.
 *  - As cápsulas que ultrapassam as caixas fechadas sao "sobra" e NAO entram na compra.
 *  - As cápsulas em caixas sao alocadas por ORDEM DE CHEGADA (id do item):
 *    quem pediu primeiro tem as capsulas garantidas; as ultimas unidades viram sobra.
 *  - O preco usado e sempre o preco_unitario CONGELADO em cada item.
 */

export interface ItemRodada {
  itemId: number;
  solicitacaoId: number;
  usuarioId: number;
  usuarioNome: string;
  capsulaId: number;
  capsulaNome: string;
  tamanhoCaixa: number;
  quantidade: number;
  precoUnitario: number;
}

export type StatusSabor = 'FECHADA' | 'COM_SOBRA' | 'AGUARDANDO_COMPLETAR';

export interface ItemCalculado extends ItemRodada {
  quantidadeEmCaixa: number;
  quantidadeAguardando: number;
  valorSolicitado: number;
  valorEmCaixa: number;
}

export interface ParticipanteSabor {
  usuarioId: number;
  nome: string;
  quantidade: number;
  quantidadeEmCaixa: number;
  quantidadeAguardando: number;
}

export interface SaborPainel {
  capsulaId: number;
  nome: string;
  tamanhoCaixa: number;
  totalSolicitado: number;
  caixasFechadas: number;
  capsulasEmCaixas: number;
  /** Cápsulas alem das caixas fechadas (nao entram na compra). */
  sobra: number;
  /** Valor para a barra de progresso (0..tamanhoCaixa). */
  progressoAtual: number;
  /** Quantas faltam para fechar a proxima caixa (0 se acabou de fechar exato). */
  faltamProximaCaixa: number;
  status: StatusSabor;
  valorSolicitado: number;
  valorFechado: number;
  participantes: ParticipanteSabor[];
}

export interface TotalParticipante {
  usuarioId: number;
  nome: string;
  solicitacaoId: number;
  totalCapsulas: number;
  capsulasEmCaixas: number;
  totalSolicitado: number;
  totalEmCaixasFechadas: number;
}

export interface ResumoColetivo {
  totalCapsulasSolicitadas: number;
  totalCapsulasEmCaixas: number;
  totalCaixasFechadas: number;
  saboresAguardando: number;
  valorSolicitado: number;
  /** Valor total da compra na Nespresso (so caixas fechadas). */
  valorCompraNespresso: number;
}

export interface ResultadoRodada {
  sabores: SaborPainel[];
  participantes: TotalParticipante[];
  itens: ItemCalculado[];
  resumo: ResumoColetivo;
}

export const arredondar = (valor: number): number =>
  Math.round((valor + Number.EPSILON) * 100) / 100;

export function calcularRodada(itensEntrada: ItemRodada[]): ResultadoRodada {
  const porCapsula = new Map<number, ItemRodada[]>();
  for (const item of itensEntrada) {
    const lista = porCapsula.get(item.capsulaId) ?? [];
    lista.push(item);
    porCapsula.set(item.capsulaId, lista);
  }

  const itens: ItemCalculado[] = [];
  const sabores: SaborPainel[] = [];

  for (const lista of porCapsula.values()) {
    const ordenados = [...lista].sort((a, b) => a.itemId - b.itemId);
    const { capsulaId, capsulaNome, tamanhoCaixa } = ordenados[0];
    const total = ordenados.reduce((soma, i) => soma + i.quantidade, 0);
    const caixasFechadas = Math.floor(total / tamanhoCaixa);
    const capsulasEmCaixas = caixasFechadas * tamanhoCaixa;
    const sobra = total - capsulasEmCaixas;

    let restante = capsulasEmCaixas;
    const participantes: ParticipanteSabor[] = [];
    let valorSolicitado = 0;
    let valorFechado = 0;

    for (const item of ordenados) {
      const emCaixa = Math.min(item.quantidade, restante);
      restante -= emCaixa;
      const calculado: ItemCalculado = {
        ...item,
        quantidadeEmCaixa: emCaixa,
        quantidadeAguardando: item.quantidade - emCaixa,
        valorSolicitado: arredondar(item.quantidade * item.precoUnitario),
        valorEmCaixa: arredondar(emCaixa * item.precoUnitario),
      };
      itens.push(calculado);
      valorSolicitado += calculado.valorSolicitado;
      valorFechado += calculado.valorEmCaixa;
      participantes.push({
        usuarioId: item.usuarioId,
        nome: item.usuarioNome,
        quantidade: item.quantidade,
        quantidadeEmCaixa: emCaixa,
        quantidadeAguardando: item.quantidade - emCaixa,
      });
    }

    const resto = total % tamanhoCaixa;
    const status: StatusSabor =
      caixasFechadas === 0
        ? 'AGUARDANDO_COMPLETAR'
        : sobra === 0
          ? 'FECHADA'
          : 'COM_SOBRA';

    sabores.push({
      capsulaId,
      nome: capsulaNome,
      tamanhoCaixa,
      totalSolicitado: total,
      caixasFechadas,
      capsulasEmCaixas,
      sobra,
      progressoAtual: total > 0 && resto === 0 ? tamanhoCaixa : resto,
      faltamProximaCaixa: resto === 0 ? 0 : tamanhoCaixa - resto,
      status,
      valorSolicitado: arredondar(valorSolicitado),
      valorFechado: arredondar(valorFechado),
      participantes,
    });
  }
  sabores.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  // Totais por participante
  const porUsuario = new Map<number, TotalParticipante>();
  for (const item of itens) {
    const atual = porUsuario.get(item.usuarioId) ?? {
      usuarioId: item.usuarioId,
      nome: item.usuarioNome,
      solicitacaoId: item.solicitacaoId,
      totalCapsulas: 0,
      capsulasEmCaixas: 0,
      totalSolicitado: 0,
      totalEmCaixasFechadas: 0,
    };
    atual.totalCapsulas += item.quantidade;
    atual.capsulasEmCaixas += item.quantidadeEmCaixa;
    atual.totalSolicitado += item.valorSolicitado;
    atual.totalEmCaixasFechadas += item.valorEmCaixa;
    porUsuario.set(item.usuarioId, atual);
  }
  const participantes = [...porUsuario.values()]
    .map((p) => ({
      ...p,
      totalSolicitado: arredondar(p.totalSolicitado),
      totalEmCaixasFechadas: arredondar(p.totalEmCaixasFechadas),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  const resumo: ResumoColetivo = {
    totalCapsulasSolicitadas: sabores.reduce((s, x) => s + x.totalSolicitado, 0),
    totalCapsulasEmCaixas: sabores.reduce((s, x) => s + x.capsulasEmCaixas, 0),
    totalCaixasFechadas: sabores.reduce((s, x) => s + x.caixasFechadas, 0),
    saboresAguardando: sabores.filter((s) => s.status === 'AGUARDANDO_COMPLETAR')
      .length,
    valorSolicitado: arredondar(sabores.reduce((s, x) => s + x.valorSolicitado, 0)),
    valorCompraNespresso: arredondar(sabores.reduce((s, x) => s + x.valorFechado, 0)),
  };

  return { sabores, participantes, itens, resumo };
}
