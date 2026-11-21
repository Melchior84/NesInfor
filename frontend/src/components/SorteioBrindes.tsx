import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { dataHora } from '../lib/format';
import type { BrindeRodada, SorteioRodada } from '../types';
import { useToast } from './Toast';

interface Props {
  rodadaTitulo: string;
  sorteio: SorteioRodada;
  usuarioId: number;
  onChange: (novo: SorteioRodada) => void;
}

interface ResultadoAuditoria {
  valido: boolean;
  entrada: string;
  hashCalculado: string;
  indiceCalculado: number;
  vencedorCalculado: string;
}

async function verificarAuditoria(brinde: BrindeRodada): Promise<ResultadoAuditoria> {
  const ids = brinde.concorrentes.map((p) => p.usuarioId).join(',');
  const entrada = `${brinde.seedPublica}|${brinde.rodadaId}|${brinde.id}|${ids}`;
  const bytes = new TextEncoder().encode(entrada);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hashCalculado = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const valor64 = BigInt(`0x${hashCalculado.slice(0, 16)}`);
  const indiceCalculado = Number(valor64 % BigInt(brinde.concorrentes.length));
  const vencedor = brinde.concorrentes[indiceCalculado];
  const valido =
    hashCalculado === brinde.hashAuditoria &&
    indiceCalculado === brinde.indiceSorteado &&
    vencedor?.usuarioId === brinde.vencedorId;

  return {
    valido,
    entrada,
    hashCalculado,
    indiceCalculado,
    vencedorCalculado: vencedor?.nome ?? '—',
  };
}

export default function SorteioBrindes({
  rodadaTitulo,
  sorteio,
  usuarioId,
  onChange,
}: Props) {
  const toast = useToast();
  const [ocupado, setOcupado] = useState(false);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [auditorias, setAuditorias] = useState<Record<number, ResultadoAuditoria>>({});

  async function executar(fn: () => Promise<SorteioRodada>, msg?: string) {
    setOcupado(true);
    try {
      const novo = await fn();
      onChange(novo);
      if (msg) toast.ok(msg);
    } catch (e) {
      toast.erro(e);
    } finally {
      setOcupado(false);
    }
  }

  async function adicionarBrinde(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    await executar(
      () => api.criarBrinde(sorteio.rodadaId, nome.trim(), descricao.trim() || undefined),
      'Brinde adicionado ao sorteio!',
    );
    setNome('');
    setDescricao('');
  }

  async function auditar(b: BrindeRodada) {
    try {
      const res = await verificarAuditoria(b);
      setAuditorias((prev) => ({ ...prev, [b.id]: res }));
    } catch {
      toast.erro('Não foi possível executar a verificação no navegador.');
    }
  }

  function copiarComprovante(b: BrindeRodada) {
    const lista = b.concorrentes.map((p, idx) => `#${idx} ${p.nome} (id ${p.usuarioId})`).join('\n');
    const texto = [
      `🎁 Sorteio de Brinde - ${rodadaTitulo}`,
      `Brinde: ${b.nome}`,
      `🏆 Vencedor: ${b.vencedorNome} (índice #${b.indiceSorteado})`,
      `Sorteado por: ${b.sorteadoPorNome} em ${dataHora(b.sorteadoEm)}`,
      '',
      'Participantes concorrendo (ordem por ID):',
      lista,
      '',
      `Seed: ${b.seedPublica}`,
      `SHA-256: ${b.hashAuditoria}`,
      `Fórmula: BigInt("0x" + sha256(seed|rodadaId|brindeId|ids).slice(0,16)) % ${b.concorrentes.length} = ${b.indiceSorteado}`,
    ].join('\n');
    navigator.clipboard.writeText(texto).then(
      () => toast.ok('Comprovante copiado!'),
      () => toast.erro('Não foi possível copiar.'),
    );
  }

  // Oculta a seção se não houver brindes e o usuário não puder cadastrar
  if (sorteio.brindes.length === 0 && !sorteio.podeGerenciarSorteio) {
    return null;
  }

  return (
    <section className="card space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">🎁 Sorteio de brindes</h2>
          <p className="text-sm text-stone-500">
            Concorrem automaticamente os participantes com pelo menos 1 cápsula em caixa fechada (
            {sorteio.elegiveisRodada.length} elegível(is)). Cada pessoa pode ganhar no máximo 1 brinde por rodada
            e pode optar por não participar de qualquer item antes do sorteio.
          </p>
          <p className="mt-1 text-xs text-stone-600">
            Encarregado do sorteio:{' '}
            <strong>{sorteio.encarregadoNome ?? 'Organizador da rodada'}</strong>
          </p>
        </div>

        {sorteio.podeDefinirSorteador && (
          <div className="min-w-56">
            <label className="label" htmlFor="sel-sorteador">
              Designar encarregado do sorteio
            </label>
            <select
              id="sel-sorteador"
              className="input py-1.5 text-xs"
              disabled={ocupado}
              value={sorteio.sorteadorId ?? ''}
              onChange={(e) =>
                void executar(
                  () =>
                    api.definirSorteador(
                      sorteio.rodadaId,
                      e.target.value ? Number(e.target.value) : null,
                    ),
                  'Encarregado do sorteio atualizado.',
                )
              }
            >
              <option value="">
                Padrão (Organizador{sorteio.organizadorNome ? `: ${sorteio.organizadorNome}` : ''})
              </option>
              {sorteio.usuariosDisponiveis.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {sorteio.podeGerenciarSorteio && (
        <form
          onSubmit={adicionarBrinde}
          className="grid gap-2 rounded-lg bg-stone-50 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        >
          <div>
            <label className="label" htmlFor="b-nome">Novo brinde</label>
            <input
              id="b-nome"
              required
              minLength={2}
              className="input"
              placeholder="Ex.: Caixa de biscoitos Nespresso"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="b-desc">Descrição (opcional)</label>
            <input
              id="b-desc"
              className="input"
              placeholder="Ex.: Enviado grátis pela Nespresso"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>
          <button className="btn-primary" disabled={ocupado}>
            + Adicionar brinde
          </button>
        </form>
      )}

      {sorteio.brindes.length === 0 ? (
        <p className="text-sm text-stone-500">
          Nenhum brinde cadastrado nesta rodada ainda. Cadastre acima quando a Nespresso enviar brindes!
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sorteio.brindes.map((b) => {
            const aud = auditorias[b.id];
            return (
              <div
                key={b.id}
                className={`rounded-xl border p-4 space-y-3 ${
                  b.sorteado
                    ? 'border-emerald-200 bg-emerald-50/40'
                    : 'border-stone-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-stone-900">{b.nome}</h3>
                    {b.descricao && <p className="text-xs text-stone-500">{b.descricao}</p>}
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      b.sorteado
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {b.sorteado ? 'Sorteado' : 'Aguardando sorteio'}
                  </span>
                </div>

                {b.sorteado ? (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-emerald-200 bg-white p-3">
                      <div className="text-xs font-medium text-emerald-700">🏆 Vencedor</div>
                      <div className="text-lg font-bold text-stone-900">
                        {b.vencedorNome}
                        {b.vencedorId === usuarioId && ' (você!)'}
                      </div>
                      <div className="mt-0.5 text-xs text-stone-500">
                        Índice sorteado: <strong>#{b.indiceSorteado}</strong> de {b.concorrentes.length}{' '}
                        · por {b.sorteadoPorNome} em {dataHora(b.sorteadoEm)}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => void auditar(b)}
                      >
                        🔍 Verificar auditoria
                      </button>
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => copiarComprovante(b)}
                      >
                        Copiar comprovante
                      </button>
                    </div>

                    {aud && (
                      <div
                        className={`rounded-lg border p-3 text-xs space-y-2 ${
                          aud.valido
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                            : 'border-red-300 bg-red-50 text-red-900'
                        }`}
                      >
                        <div className="font-semibold">
                          {aud.valido
                            ? '✅ Auditoria válida — resultado matematicamente comprovado!'
                            : '❌ Divergência detectada na auditoria!'}
                        </div>
                        <div className="space-y-1 break-all font-mono text-[11px]">
                          <div>
                            <strong>Seed:</strong> {b.seedPublica}
                          </div>
                          <div>
                            <strong>Entrada:</strong> {aud.entrada}
                          </div>
                          <div>
                            <strong>SHA-256:</strong> {aud.hashCalculado}
                          </div>
                          <div>
                            <strong>Cálculo:</strong> BigInt(0x{aud.hashCalculado.slice(0, 16)}) %{' '}
                            {b.concorrentes.length} = <strong>#{aud.indiceCalculado}</strong> (
                            {aud.vencedorCalculado})
                          </div>
                        </div>
                        <div>
                          <div className="mb-1 font-semibold">Lista congelada no sorteio:</div>
                          <div className="flex flex-wrap gap-1">
                            {b.concorrentes.map((p, idx) => (
                              <span
                                key={p.usuarioId}
                                className={`rounded px-1.5 py-0.5 ${
                                  idx === b.indiceSorteado
                                    ? 'bg-emerald-600 font-bold text-white'
                                    : 'bg-white text-stone-700'
                                }`}
                              >
                                #{idx} {p.nome}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <div className="mb-1 text-xs font-medium text-stone-600">
                        Concorrendo ({b.concorrentes.length}):
                        {sorteio.podeGerenciarSorteio && b.concorrentes.length > 0 && (
                          <span className="ml-1 font-normal text-stone-400">
                            (clique em × para remover deste item)
                          </span>
                        )}
                      </div>
                      {b.concorrentes.length === 0 ? (
                        <p className="text-xs text-stone-400">
                          Nenhum participante elegível disponível no momento.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 text-xs">
                          {b.concorrentes.map((p, idx) => (
                            <span
                              key={p.usuarioId}
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                                p.usuarioId === usuarioId
                                  ? 'bg-cafe-100 font-semibold text-cafe-800'
                                  : 'bg-stone-100 text-stone-700'
                              }`}
                            >
                              #{idx} {p.nome}
                              {sorteio.podeGerenciarSorteio && (
                                <button
                                  type="button"
                                  disabled={ocupado}
                                  title={`Remover ${p.nome} deste brinde`}
                                  aria-label={`Remover ${p.nome} de ${b.nome}`}
                                  onClick={() =>
                                    void executar(
                                      () =>
                                        api.participacaoBrindeUsuario(
                                          sorteio.rodadaId,
                                          b.id,
                                          p.usuarioId,
                                          false,
                                        ),
                                      `${p.nome} removido(a) do sorteio de "${b.nome}".`,
                                    )
                                  }
                                  className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-stone-500 transition hover:bg-red-100 hover:text-red-700"
                                >
                                  ×
                                </button>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {b.desistentes.length > 0 && (
                      <div>
                        <div className="mb-1 text-xs text-stone-500">
                          Não participam deste brinde ({b.desistentes.length}):
                          {sorteio.podeGerenciarSorteio && (
                            <span className="ml-1 text-stone-400">(clique em + para habilitar)</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5 text-xs">
                          {b.desistentes.map((p) => (
                            <span
                              key={p.usuarioId}
                              className="inline-flex items-center gap-1 rounded-full bg-stone-100/70 px-2 py-0.5 text-stone-500 line-through"
                            >
                              {p.nome}
                              {sorteio.podeGerenciarSorteio && (
                                <button
                                  type="button"
                                  disabled={ocupado}
                                  title={`Habilitar ${p.nome} neste brinde`}
                                  aria-label={`Habilitar ${p.nome} em ${b.nome}`}
                                  onClick={() =>
                                    void executar(
                                      () =>
                                        api.participacaoBrindeUsuario(
                                          sorteio.rodadaId,
                                          b.id,
                                          p.usuarioId,
                                          true,
                                        ),
                                      `${p.nome} habilitado(a) no sorteio de "${b.nome}".`,
                                    )
                                  }
                                  className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full no-underline text-emerald-700 transition hover:bg-emerald-100"
                                >
                                  +
                                </button>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {b.jaPremiados.length > 0 && (
                      <p className="text-xs text-emerald-700">
                        Já ganharam outro brinde nesta rodada:{' '}
                        {b.jaPremiados.map((p) => p.nome).join(', ')}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-2">
                      {sorteio.euElegivel && !sorteio.euJaPremiado ? (
                        <button
                          type="button"
                          disabled={ocupado}
                          className="btn-secondary btn-sm"
                          onClick={() =>
                            void executar(
                              () =>
                                api.participacaoBrinde(
                                  sorteio.rodadaId,
                                  b.id,
                                  b.euDesisti,
                                ),
                              b.euDesisti
                                ? 'Você voltou a participar deste sorteio.'
                                : 'Você optou por não participar deste brinde.',
                            )
                          }
                        >
                          {b.euDesisti ? 'Voltar a participar' : 'Não participar deste brinde'}
                        </button>
                      ) : (
                        <span className="text-xs text-stone-400">
                          {sorteio.euJaPremiado
                            ? 'Você já ganhou um brinde nesta rodada.'
                            : 'Necessário ter cápsula em caixa fechada para concorrer.'}
                        </span>
                      )}

                      {sorteio.podeGerenciarSorteio && (
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            disabled={ocupado || b.concorrentes.length === 0}
                            className="btn-primary btn-sm"
                            onClick={() => {
                              if (
                                confirm(
                                  `Sortear "${b.nome}" entre ${b.concorrentes.length} participante(s)? O resultado será público e definitivo.`,
                                )
                              ) {
                                void executar(
                                  () => api.sortearBrinde(sorteio.rodadaId, b.id),
                                  `Sorteio de "${b.nome}" realizado!`,
                                );
                              }
                            }}
                          >
                            🎲 Sortear agora
                          </button>
                          <button
                            type="button"
                            disabled={ocupado}
                            className="btn-danger btn-sm"
                            onClick={() =>
                              void executar(
                                () => api.removerBrinde(sorteio.rodadaId, b.id),
                                'Brinde removido.',
                              )
                            }
                          >
                            Remover
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
