import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { BadgePagamento, BadgeRodada } from '../components/Badges';
import IntensidadeBolinhas from '../components/IntensidadeBolinhas';
import { useToast } from '../components/Toast';
import { api } from '../lib/api';
import { dataHora, moeda } from '../lib/format';
import type { MeuPainel } from '../types';

function perfilIntensidade(media: number): string {
  if (media <= 4) return 'Suave & delicado';
  if (media <= 7) return 'Equilibrado';
  if (media <= 9.5) return 'Encorpado';
  return 'Intenso raiz';
}

export default function PainelUsuario() {
  const { usuario } = useAuth();
  const toast = useToast();
  const [ano, setAno] = useState<number>(new Date().getFullYear());
  const [dados, setDados] = useState<MeuPainel | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvandoPref, setSalvandoPref] = useState(false);
  const [mostrarPrefs, setMostrarPrefs] = useState(false);
  const [ocupadoSolicitacao, setOcupadoSolicitacao] = useState(false);

  async function alternarEmails(marcado: boolean) {
    if (!dados) return;
    setSalvandoPref(true);
    try {
      const r = await api.salvarPreferenciasEmail(marcado);
      setDados({ ...dados, receberEmailsCafe: r.receberEmailsCafe });
      toast.ok(
        r.receberEmailsCafe
          ? 'Notificações por e-mail ativadas!'
          : 'Notificações de café por e-mail desativadas.',
      );
    } catch (e) {
      toast.erro(e);
    } finally {
      setSalvandoPref(false);
    }
  }

  const carregar = useCallback(
    async (anoAlvo: number) => {
      setCarregando(true);
      try {
        setDados(await api.meuPainel(anoAlvo));
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

  async function solicitarAbertura() {
    setOcupadoSolicitacao(true);
    try {
      await api.solicitarAberturaRodada();
      toast.ok('Solicitação de abertura de rodada registrada!');
      await carregar(ano);
    } catch (e) {
      toast.erro(e);
    } finally {
      setOcupadoSolicitacao(false);
    }
  }

  async function cancelarSolicitacao() {
    setOcupadoSolicitacao(true);
    try {
      await api.cancelarSolicitacaoAbertura();
      toast.ok('Solicitação de abertura cancelada.');
      await carregar(ano);
    } catch (e) {
      toast.erro(e);
    } finally {
      setOcupadoSolicitacao(false);
    }
  }

  const isAdmin = usuario?.perfil === 'ADMIN';

  const primeiroNome = usuario?.nome?.split(' ')[0] ?? 'Cafezeiro';
  const pctVariedade =
    dados && dados.variedade.totalSaboresAtivos > 0
      ? Math.round((dados.variedade.saboresProvados / dados.variedade.totalSaboresAtivos) * 100)
      : 0;
  const maxTopSabor = dados?.topSabores[0]?.quantidade ?? 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-cafe-700">Meu Painel</h1>
          <p className="text-sm text-stone-500">
            Olá, <strong>{primeiroNome}</strong>! Confira seu resumo no Cafezinho Infor em {ano}.
          </p>
        </div>

        {dados && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setMostrarPrefs((v) => !v)}
              className="rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-600 transition hover:bg-stone-50"
              title="Configurar notificações por e-mail"
            >
              {dados.receberEmailsCafe ? '🔔 E-mails: Ativos' : '🔕 E-mails: Desativados'}{' '}
              <span className="text-stone-400">{mostrarPrefs ? '▴' : '▾'}</span>
            </button>

            {dados.anosDisponiveis.length > 0 && (
              <div className="flex items-center gap-2">
                <label htmlFor="painel-ano" className="text-xs font-medium text-stone-600">
                  Ano:
                </label>
                <select
                  id="painel-ano"
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
        )}
      </div>

      {carregando || !dados ? (
        <p className="text-stone-500">Carregando seu painel…</p>
      ) : (
        <>
          {/* Preferência de e-mails (expansível sob demanda) */}
          {mostrarPrefs && (
            <section className="rounded-xl border border-stone-200 bg-stone-50/80 p-3.5 text-sm">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-stone-300 accent-cafe-600"
                  checked={dados.receberEmailsCafe}
                  disabled={salvandoPref}
                  onChange={(e) => void alternarEmails(e.target.checked)}
                />
                <div>
                  <div className="text-xs font-semibold text-stone-800">
                    Receber e-mails sobre os cafés
                  </div>
                  <p className="text-xs text-stone-500">
                    Quando marcado, você recebe avisos quando uma nova rodada for aberta e o resumo
                    do seu pedido ao fechar. Desmarque para não receber nenhum e-mail sobre os
                    cafés.
                  </p>
                </div>
              </label>
            </section>
          )}

          {/* Solicitação de abertura de nova rodada (somente quando não há rodada ativa) */}
          {!dados.solicitacaoAbertura.existeRodadaAtiva && (
            <section className="card space-y-4 border-cafe-200 bg-cafe-50/40">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-cafe-700">
                    ☕ Querendo café? Solicite a próxima rodada!
                  </h2>
                  <p className="text-xs text-stone-500">
                    Não há nenhuma rodada aberta no momento.
                    {dados.solicitacaoAbertura.totalSolicitacoes > 0 && (
                      <>
                        {' '}
                        <strong>
                          {dados.solicitacaoAbertura.totalSolicitacoes}{' '}
                          {dados.solicitacaoAbertura.totalSolicitacoes === 1
                            ? 'pessoa já solicitou'
                            : 'pessoas já solicitaram'}
                        </strong>{' '}
                        a abertura!
                      </>
                    )}
                  </p>
                </div>

                {dados.solicitacaoAbertura.euSolicitei ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                      ✓ Solicitado em {dataHora(dados.solicitacaoAbertura.minhaSolicitacaoEm)}
                    </span>
                    <button
                      type="button"
                      className="btn-danger btn-sm"
                      disabled={ocupadoSolicitacao}
                      onClick={() => void cancelarSolicitacao()}
                    >
                      {ocupadoSolicitacao ? 'Cancelando…' : 'Cancelar solicitação'}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={ocupadoSolicitacao}
                    onClick={() => void solicitarAbertura()}
                  >
                    {ocupadoSolicitacao ? 'Enviando…' : '☕ Solicitar abertura de rodada'}
                  </button>
                )}
              </div>

              {/* Lista de solicitantes visível apenas para ADMIN */}
              {isAdmin && (
                <div className="border-t border-cafe-200/70 pt-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-cafe-700">
                      Solicitações de abertura ({dados.solicitacaoAbertura.solicitantes.length})
                    </h3>
                    <Link to="/rodadas" className="btn-secondary btn-sm">
                      Abrir nova rodada →
                    </Link>
                  </div>

                  {dados.solicitacaoAbertura.solicitantes.length === 0 ? (
                    <p className="text-xs text-stone-500">
                      Nenhuma solicitação de abertura registrada ainda.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
                      <table className="w-full text-xs">
                        <thead className="text-left text-stone-500">
                          <tr className="border-b border-stone-100">
                            <th className="px-3 py-2">Solicitante</th>
                            <th className="px-3 py-2 text-right">Data e hora</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {dados.solicitacaoAbertura.solicitantes.map((s) => (
                            <tr key={s.usuarioId}>
                              <td className="px-3 py-2 font-medium text-stone-800">{s.nome}</td>
                              <td className="px-3 py-2 text-right text-stone-500">
                                {dataHora(s.criadoEm)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* KPIs principais */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card space-y-1">
              <div className="text-xs font-medium text-stone-500">Pedidos no ano</div>
              <div className="text-2xl font-bold text-cafe-700">{dados.totalPedidosAno}</div>
              <div className="text-xs text-stone-500">
                {dados.totalPedidosAno > 0
                  ? `Média de ${dados.mediaCapsulasPorPedido} cápsulas/pedido`
                  : 'Nenhum pedido registrado neste ano'}
              </div>
            </div>

            <div className="card space-y-1">
              <div className="text-xs font-medium text-stone-500">Cafés consumidos ({ano})</div>
              <div className="text-2xl font-bold text-cafe-700">
                {dados.totalCapsulasConsumidasAno}{' '}
                <span className="text-sm font-normal text-stone-500">cápsulas</span>
              </div>
              <div className="text-xs text-stone-500">
                {dados.totalCapsulasSolicitadasAno > dados.totalCapsulasConsumidasAno
                  ? `${dados.totalCapsulasSolicitadasAno} solicitadas no total`
                  : dados.valorInvestidoAno > 0
                    ? `Total investido: ${moeda(dados.valorInvestidoAno)}`
                    : 'Em caixas fechadas'}
              </div>
            </div>

            <div className="card space-y-1">
              <div className="text-xs font-medium text-stone-500">Cafezinhos doados ({ano})</div>
              <div className="text-2xl font-bold text-cafe-700">
                ☕ {dados.cafezinhosDoadosAno}
              </div>
              <div className="text-xs text-stone-500">
                {dados.posicaoRanking ? (
                  <>
                    <strong className="text-cafe-700">{dados.posicaoRanking}º lugar</strong> no{' '}
                    <Link to="/ranking" className="underline hover:text-cafe-700">
                      Ranking
                    </Link>
                  </>
                ) : (
                  <Link to="/ranking" className="underline hover:text-cafe-700">
                    Ver Ranking de Cafezinhos
                  </Link>
                )}
              </div>
            </div>

            <div className="card space-y-1">
              <div className="text-xs font-medium text-stone-500">Sorteios de brindes</div>
              <div className="text-2xl font-bold text-cafe-700">
                {dados.sorteios.jaFoiSorteado ? `🎁 ${dados.sorteios.vezesTotal}x` : '0x'}
              </div>
              <div className="text-xs text-stone-500">
                {dados.sorteios.jaFoiSorteado
                  ? `${dados.sorteios.vezesNoAno}x em ${ano} · ${dados.sorteios.vezesTotal}x no total`
                  : 'Ainda não foi sorteado — boa sorte!'}
              </div>
            </div>
          </div>

          {/* Colocação anual em pedidos de café */}
          <section className="rounded-xl border border-cafe-200 bg-gradient-to-r from-cafe-50 via-amber-50/50 to-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-cafe-100 text-2xl">
                  {dados.rankingConsumo.posicao === 1
                    ? '🥇'
                    : dados.rankingConsumo.posicao === 2
                      ? '🥈'
                      : dados.rankingConsumo.posicao === 3
                        ? '🥉'
                        : '☕'}
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-cafe-600">
                    Colocação em pedidos de café ({ano})
                  </div>
                  {dados.rankingConsumo.posicao !== null ? (
                    <>
                      <p className="text-base text-stone-800">
                        Neste ano você está na posição{' '}
                        <strong className="text-lg text-cafe-700">
                          {dados.rankingConsumo.posicao}º
                        </strong>{' '}
                        em pedidos de café!
                      </p>
                      <p className="text-xs text-stone-500">
                        {dados.rankingConsumo.totalCapsulasSolicitadas} cápsula
                        {dados.rankingConsumo.totalCapsulasSolicitadas === 1 ? '' : 's'} solicitada
                        {dados.rankingConsumo.totalCapsulasSolicitadas === 1 ? '' : 's'} entre{' '}
                        {dados.rankingConsumo.totalParticipantes} participante
                        {dados.rankingConsumo.totalParticipantes === 1 ? '' : 's'} ·{' '}
                        {dados.rankingConsumo.posicao === 1
                          ? 'Líder absoluto da cafeína!'
                          : dados.rankingConsumo.posicao <= 3
                            ? 'Pódio garantido na cafeína!'
                            : 'Bora pedir mais umas cápsulas para subir no ranking!'}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-stone-500">
                      Você ainda não entrou no ranking de pedidos de café em {ano} — faça seu
                      primeiro pedido!
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Sabor preferido + Sabor novidade */}
          <div className="grid gap-4 md:grid-cols-2">
            <section className="card flex flex-col justify-between space-y-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-cafe-600">
                  ❤️ Seu sabor preferido em {ano}
                </div>
                {dados.saborPreferido ? (
                  <div className="mt-3 flex items-center gap-4">
                    {dados.saborPreferido.imagemUrl ? (
                      <img
                        src={dados.saborPreferido.imagemUrl}
                        alt={dados.saborPreferido.nome}
                        className="h-16 w-16 shrink-0 rounded-full border border-stone-200 bg-white object-contain p-1"
                      />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-cafe-100 text-2xl">
                        ☕
                      </div>
                    )}
                    <div className="min-w-0 space-y-1">
                      <h2 className="text-lg font-bold text-stone-800">
                        {dados.saborPreferido.nome}
                      </h2>
                      <p className="text-sm text-stone-600">
                        <strong>{dados.saborPreferido.quantidade}</strong> cápsula
                        {dados.saborPreferido.quantidade === 1 ? '' : 's'} neste ano
                      </p>
                      <IntensidadeBolinhas valor={dados.saborPreferido.intensidade} compacto />
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-stone-500">
                    Faça seu primeiro pedido em {ano} para descobrir qual é o seu sabor favorito!
                  </p>
                )}
              </div>
            </section>

            <section className="card flex flex-col justify-between space-y-3 border-amber-200 bg-amber-50/30">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                    ✨ Sabor novidade no catálogo
                  </span>
                  {dados.saborNovidade && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        dados.saborNovidade.jaExperimentou
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {dados.saborNovidade.jaExperimentou
                        ? 'Você já provou ✓'
                        : 'Ainda não provou!'}
                    </span>
                  )}
                </div>

                {dados.saborNovidade ? (
                  <div className="mt-3 flex items-center gap-4">
                    {dados.saborNovidade.imagemUrl ? (
                      <img
                        src={dados.saborNovidade.imagemUrl}
                        alt={dados.saborNovidade.nome}
                        className="h-16 w-16 shrink-0 rounded-full border border-amber-200 bg-white object-contain p-1"
                      />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-amber-100 text-2xl">
                        ✨
                      </div>
                    )}
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <h2 className="text-lg font-bold text-stone-800">
                          {dados.saborNovidade.nome}
                        </h2>
                        <span className="text-xs font-semibold text-cafe-700">
                          {moeda(dados.saborNovidade.precoAtual)}/un.
                        </span>
                      </div>
                      {dados.saborNovidade.descricao && (
                        <p className="line-clamp-2 text-xs text-stone-600">
                          {dados.saborNovidade.descricao}
                        </p>
                      )}
                      <IntensidadeBolinhas valor={dados.saborNovidade.intensidade} compacto />
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-stone-500">Nenhuma cápsula ativa no catálogo.</p>
                )}
              </div>
            </section>
          </div>

          {/* Sorteios de brindes */}
          <section className="card space-y-2">
            <h2 className="text-base font-semibold text-cafe-700">🎁 Histórico de sorteios</h2>
            {dados.sorteios.jaFoiSorteado && dados.sorteios.ultimoSorteio ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-sm">
                <div>
                  <p className="text-stone-800">
                    Você já foi sorteado{' '}
                    <strong>
                      {dados.sorteios.vezesTotal}{' '}
                      {dados.sorteios.vezesTotal === 1 ? 'vez' : 'vezes'}
                    </strong>{' '}
                    no Cafezinho Infor
                    {dados.sorteios.vezesNoAno > 0 &&
                      ` (${dados.sorteios.vezesNoAno}x em ${ano})`}
                    !
                  </p>
                  <p className="mt-1 text-xs text-stone-600">
                    <strong>Última vez:</strong> {dados.sorteios.ultimoSorteio.brindeNome} ·{' '}
                    <Link
                      to={`/rodadas/${dados.sorteios.ultimoSorteio.rodadaId}`}
                      className="font-medium text-cafe-700 underline"
                    >
                      {dados.sorteios.ultimoSorteio.rodadaTitulo}
                    </Link>{' '}
                    em {dataHora(dados.sorteios.ultimoSorteio.sorteadoEm)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-stone-500">
                Você ainda não foi sorteado em nenhum brinde. Participe das rodadas coletivas para
                concorrer automaticamente aos brindes da Nespresso!
              </p>
            )}
          </section>

          {/* Top 5 sabores + Perfil de cafezeiro */}
          <div className="grid gap-4 md:grid-cols-2">
            <section className="card space-y-3">
              <h2 className="text-base font-semibold text-cafe-700">
                📊 Seus sabores mais pedidos em {ano}
              </h2>
              {dados.topSabores.length === 0 ? (
                <p className="text-sm text-stone-500">Nenhum sabor pedido em {ano} ainda.</p>
              ) : (
                <div className="space-y-2.5">
                  {dados.topSabores.map((s, idx) => {
                    const largura = Math.max(8, Math.round((s.quantidade / maxTopSabor) * 100));
                    return (
                      <div key={s.capsulaId} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-stone-700">
                            {idx + 1}. {s.nome}
                          </span>
                          <span className="font-semibold text-cafe-700">
                            {s.quantidade} un.
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
                          <div
                            className="h-full rounded-full bg-cafe-600 transition-all"
                            style={{ width: `${largura}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="card space-y-4">
              <h2 className="text-base font-semibold text-cafe-700">🧭 Seu perfil de cafezeiro</h2>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-stone-600">Variedade do catálogo explorada</span>
                  <span className="font-semibold text-cafe-700">
                    {dados.variedade.saboresProvados} de {dados.variedade.totalSaboresAtivos}{' '}
                    sabores ({pctVariedade}%)
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-stone-100">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all"
                    style={{ width: `${pctVariedade}%` }}
                  />
                </div>
              </div>

              <div className="rounded-lg bg-stone-50 p-3 space-y-1.5">
                <div className="text-xs font-medium text-stone-500">
                  Intensidade média preferida ({ano})
                </div>
                {dados.intensidadeMedia !== null ? (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-bold text-cafe-700">
                        {dados.intensidadeMedia}/12
                      </span>
                      <span className="text-xs font-medium text-stone-600">
                        · {perfilIntensidade(dados.intensidadeMedia)}
                      </span>
                    </div>
                    <IntensidadeBolinhas
                      valor={Math.round(dados.intensidadeMedia)}
                      compacto
                      mostrarRotulo={false}
                    />
                  </>
                ) : (
                  <p className="text-xs text-stone-500">
                    Ainda sem dados suficientes de intensidade neste ano.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between rounded-lg bg-cafe-50 px-3 py-2 text-xs">
                <span className="text-stone-600">Total investido em café ({ano})</span>
                <span className="font-bold text-cafe-700">{moeda(dados.valorInvestidoAno)}</span>
              </div>
            </section>
          </div>

          {/* Últimas rodadas participadas no ano */}
          {dados.ultimasRodadas.length > 0 && (
            <section className="card space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-cafe-700">
                  🧾 Seus últimos pedidos em {ano}
                </h2>
                <Link to="/rodadas" className="text-xs font-medium text-cafe-600 hover:underline">
                  Ver histórico completo
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-stone-500">
                    <tr>
                      <th className="py-2">Rodada</th>
                      <th>Status</th>
                      <th className="text-right">Cápsulas</th>
                      <th className="text-right">Valor</th>
                      <th className="pl-3">Pagamento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {dados.ultimasRodadas.map((r) => (
                      <tr key={r.rodadaId}>
                        <td className="py-2">
                          <Link
                            to={`/rodadas/${r.rodadaId}`}
                            className="font-medium text-cafe-700 hover:underline"
                          >
                            {r.titulo}
                          </Link>
                        </td>
                        <td>
                          <BadgeRodada status={r.status} />
                        </td>
                        <td className="text-right">
                          {r.capsulasConfirmadas > 0
                            ? r.capsulasConfirmadas
                            : `${r.capsulasSolicitadas} (solic.)`}
                        </td>
                        <td className="text-right font-medium">{moeda(r.valorAPagar)}</td>
                        <td className="pl-3">
                          <BadgePagamento status={r.statusPagamento} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
