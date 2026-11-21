import { calcularRodada, ItemRodada } from './calculo-caixas';

let seq = 0;
const item = (
  usuarioId: number,
  usuarioNome: string,
  capsulaId: number,
  capsulaNome: string,
  quantidade: number,
  precoUnitario = 10,
  tamanhoCaixa = 50,
): ItemRodada => ({
  itemId: ++seq,
  solicitacaoId: usuarioId,
  usuarioId,
  usuarioNome,
  capsulaId,
  capsulaNome,
  tamanhoCaixa,
  quantidade,
  precoUnitario,
});

describe('calcularRodada', () => {
  beforeEach(() => (seq = 0));

  it('Ana 25 + Paula 20 + Carlos 5 de Caramello = 1 caixa fechada exata', () => {
    const r = calcularRodada([
      item(1, 'Ana', 1, 'Caramello', 25),
      item(2, 'Paula', 1, 'Caramello', 20),
      item(3, 'Carlos', 1, 'Caramello', 5),
    ]);
    const [s] = r.sabores;
    expect(s.totalSolicitado).toBe(50);
    expect(s.caixasFechadas).toBe(1);
    expect(s.faltamProximaCaixa).toBe(0);
    expect(s.progressoAtual).toBe(50);
    expect(s.status).toBe('FECHADA');
    expect(r.resumo.valorCompraNespresso).toBe(500);
    expect(r.participantes.every((p) => p.totalSolicitado === p.totalEmCaixasFechadas)).toBe(true);
  });

  it('sabor com menos de 50 fica aguardando e nao entra na compra', () => {
    const r = calcularRodada([item(1, 'Ana', 1, 'Ristretto', 25)]);
    const [s] = r.sabores;
    expect(s.caixasFechadas).toBe(0);
    expect(s.faltamProximaCaixa).toBe(25);
    expect(s.progressoAtual).toBe(25);
    expect(s.status).toBe('AGUARDANDO_COMPLETAR');
    expect(r.resumo.valorCompraNespresso).toBe(0);
    expect(r.resumo.saboresAguardando).toBe(1);
    expect(r.participantes[0].totalSolicitado).toBe(250);
    expect(r.participantes[0].totalEmCaixasFechadas).toBe(0);
  });

  it('sobra e alocada por ordem de chegada (quem pediu primeiro garante)', () => {
    const r = calcularRodada([
      item(1, 'Ana', 1, 'Caramello', 30),
      item(2, 'Paula', 1, 'Caramello', 30),
    ]);
    const [s] = r.sabores;
    expect(s.caixasFechadas).toBe(1);
    expect(s.sobra).toBe(10);
    expect(s.status).toBe('COM_SOBRA');
    expect(s.faltamProximaCaixa).toBe(40);
    const ana = s.participantes.find((p) => p.nome === 'Ana')!;
    const paula = s.participantes.find((p) => p.nome === 'Paula')!;
    expect(ana.quantidadeEmCaixa).toBe(30);
    expect(paula.quantidadeEmCaixa).toBe(20);
    expect(paula.quantidadeAguardando).toBe(10);
    expect(r.resumo.valorCompraNespresso).toBe(500);
  });

  it('usa o preco congelado de cada item e soma varios sabores', () => {
    const r = calcularRodada([
      item(1, 'Ana', 1, 'Caramello', 50, 12.5),
      item(2, 'Paula', 2, 'Ristretto', 50, 10.25),
    ]);
    expect(r.resumo.totalCaixasFechadas).toBe(2);
    expect(r.resumo.valorCompraNespresso).toBe(50 * 12.5 + 50 * 10.25);
  });

  it('suporta tamanho de caixa diferente de 50', () => {
    const r = calcularRodada([item(1, 'Ana', 1, 'Edicao', 25, 10, 10)]);
    expect(r.sabores[0].caixasFechadas).toBe(2);
    expect(r.sabores[0].sobra).toBe(5);
  });

  it('rodada vazia', () => {
    const r = calcularRodada([]);
    expect(r.sabores).toEqual([]);
    expect(r.resumo.valorCompraNespresso).toBe(0);
  });
});
