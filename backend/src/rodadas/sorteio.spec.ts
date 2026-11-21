import { executarSorteioAuditavel } from './sorteio';

describe('executarSorteioAuditavel', () => {
  const participantes = [
    { usuarioId: 12, nome: 'Carlos' },
    { usuarioId: 3, nome: 'Ana' },
    { usuarioId: 7, nome: 'Paula' },
  ];

  it('ordena participantes por usuarioId e produz resultado 100% reproduzivel para a mesma seed', () => {
    const seed = 'a'.repeat(64);
    const r1 = executarSorteioAuditavel(5, 10, participantes, seed);
    const r2 = executarSorteioAuditavel(5, 10, [...participantes].reverse(), seed);

    expect(r1.participantesOrdenados.map((p) => p.usuarioId)).toEqual([3, 7, 12]);
    expect(r1.hashAuditoria).toBe(r2.hashAuditoria);
    expect(r1.indiceSorteado).toBe(r2.indiceSorteado);
    expect(r1.vencedor).toEqual(r2.vencedor);
    expect(r1.entradaHash).toBe(`${seed}|5|10|3,7,12`);
  });

  it('gera seeds aleatorias diferentes quando nao informada', () => {
    const r1 = executarSorteioAuditavel(1, 1, participantes);
    const r2 = executarSorteioAuditavel(1, 1, participantes);
    expect(r1.seedPublica).not.toBe(r2.seedPublica);
    expect(r1.seedPublica).toHaveLength(64);
    expect(r1.hashAuditoria).toHaveLength(64);
  });

  it('falha quando nao ha participantes elegiveis', () => {
    expect(() => executarSorteioAuditavel(1, 1, [])).toThrow();
  });
});
