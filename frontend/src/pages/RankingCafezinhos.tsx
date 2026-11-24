import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../components/Toast';
import { api } from '../lib/api';
import type { RankingCafezinhos as DadosRanking } from '../types';

function medalha(posicao: number): string {
  if (posicao === 1) return '🥇';
  if (posicao === 2) return '🥈';
  if (posicao === 3) return '🥉';
  return `${posicao}º`;
}

export default function RankingCafezinhos() {
  const { usuario } = useAuth();
  const toast = useToast();
  const [ano, setAno] = useState<number>(new Date().getFullYear());
  const [dados, setDados] = useState<DadosRanking | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(
    async (anoAlvo: number) => {
      setCarregando(true);
      try {
        setDados(await api.rankingCafezinhos(anoAlvo));
      } catch (e) {
        toast.erro(e);
      } finally {
        setCarregando(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    void carregar(ano);
  }, [ano, carregar]);

  const campeoes = dados?.ranking.filter((r) => r.posicao === 1) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-cafe-700">🏆 Ranking de Cafezinhos</h1>
          <p className="text-sm text-stone-500">
            Quem mais doou cafezinhos para manter o Cafezinho Infor no ar em {ano}.
          </p>
        </div>

        {dados && dados.anosDisponiveis.length > 0 && (
          <div className="flex items-center gap-2">
            <label htmlFor="ranking-ano" className="text-xs font-medium text-stone-600">
              Ano:
            </label>
            <select
              id="ranking-ano"
              className="input w-auto py-1.5 text-sm font-medium"
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
            >
              {dados.anosDisponiveis.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {carregando ? (
        <p className="text-stone-500">Carregando ranking…</p>
      ) : !dados || dados.ranking.length === 0 ? (
        <div className="card py-10 text-center space-y-2">
          <div className="text-4xl">☕</div>
          <h2 className="text-lg font-semibold text-stone-700">
            Nenhum cafezinho doado em {ano} ainda
          </h2>
          <p className="text-sm text-stone-500">
            Quando você fizer um pedido com caixa fechada, adicionar cafezinhos na caixinha e o
            pagamento for confirmado pelo organizador, seu nome aparecerá aqui!
          </p>
        </div>
      ) : (
        <>
          {/* Destaque do Campeão / Campeões do Ano */}
          {campeoes.length > 0 && (
            <section className="rounded-xl border border-amber-300 bg-gradient-to-br from-amber-50 via-cafe-50/70 to-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-amber-100 text-3xl shadow-inner">
                    🏆
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                      {campeoes.length > 1
                        ? `Campeões de ${dados.ano} (empate)`
                        : `Campeão de Cafezinhos ${dados.ano}`}
                    </div>
                    <div className="mt-0.5 text-xl font-bold text-cafe-800">
                      {campeoes.map((c) => c.nome).join(' & ')}
                    </div>
                    <div className="text-sm text-stone-600">
                      Liderando a caixinha do Cafezinho Infor com{' '}
                      <strong className="text-cafe-700">
                        ☕ {campeoes[0].totalCafezinhos}{' '}
                        {campeoes[0].totalCafezinhos === 1 ? 'xícara doada' : 'xícaras doadas'}
                      </strong>
                      !
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 text-center">
                  <div className="rounded-lg bg-white/90 px-4 py-2 border border-amber-200">
                    <div className="text-xs text-stone-500">Total em {dados.ano}</div>
                    <div className="text-lg font-bold text-cafe-700">
                      ☕ {dados.totalCafezinhosAno}
                    </div>
                  </div>
                  <div className="rounded-lg bg-white/90 px-4 py-2 border border-amber-200">
                    <div className="text-xs text-stone-500">Apoiadores</div>
                    <div className="text-lg font-bold text-cafe-700">{dados.totalDoadores}</div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Tabela completa do Ranking */}
          <section className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-stone-500">
                <tr>
                  <th className="py-2 w-16">Posição</th>
                  <th>Apoiador</th>
                  <th className="text-right">Rodadas</th>
                  <th className="text-right">Xícaras doadas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {dados.ranking.map((item) => {
                  const ehVoce = item.usuarioId === usuario?.id;
                  const ehLider = item.posicao === 1;
                  return (
                    <tr
                      key={item.usuarioId}
                      className={
                        ehLider
                          ? 'bg-amber-50/50'
                          : ehVoce
                            ? 'bg-cafe-50/50'
                            : undefined
                      }
                    >
                      <td className="py-3 text-base font-bold text-stone-700">
                        {medalha(item.posicao)}
                      </td>
                      <td className="py-3">
                        <span className="font-medium text-stone-800">{item.nome}</span>
                        {ehVoce && (
                          <span className="ml-2 rounded bg-cafe-100 px-1.5 py-0.5 text-[11px] font-semibold text-cafe-700">
                            você
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right text-stone-500">
                        {item.rodadasApoiadas}{' '}
                        {item.rodadasApoiadas === 1 ? 'rodada' : 'rodadas'}
                      </td>
                      <td className="py-3 text-right">
                        <span className="inline-flex items-center gap-1 rounded-full bg-cafe-100 px-3 py-1 font-bold text-cafe-800">
                          ☕ {item.totalCafezinhos}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <p className="text-xs text-stone-400">
            * Contabiliza apenas cafezinhos doados em rodadas de {dados.ano} (não canceladas) com
            pelo menos uma caixa fechada e pagamento confirmado pelo organizador.
          </p>
        </>
      )}
    </div>
  );
}
