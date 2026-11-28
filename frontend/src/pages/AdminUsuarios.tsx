import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../components/Toast';
import { api } from '../lib/api';
import { dataHora } from '../lib/format';
import type { UsuarioAdmin } from '../types';

type AbaAdmin = 'usuarios' | 'dominios';

export default function AdminUsuarios() {
  const toast = useToast();
  const { usuario } = useAuth();
  const [aba, setAba] = useState<AbaAdmin>('usuarios');
  const [lista, setLista] = useState<UsuarioAdmin[] | null>(null);
  const [busca, setBusca] = useState('');
  const [dominios, setDominios] = useState<string[]>([]);
  const [novoDominio, setNovoDominio] = useState('');
  const [salvandoDom, setSalvandoDom] = useState(false);
  const [resetInfo, setResetInfo] = useState<{
    nome: string;
    email: string;
    senhaTemporaria: string;
  } | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [usuarios, dom] = await Promise.all([
        api.usuarios(),
        api.dominiosAprovados(),
      ]);
      setLista(usuarios);
      setDominios(dom.dominios);
    } catch (e) {
      toast.erro(e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function persistirDominios(novaLista: string[], msgOk: string) {
    setSalvandoDom(true);
    try {
      const r = await api.salvarDominiosAprovados(novaLista);
      setDominios(r.dominios);
      toast.ok(msgOk);
    } catch (err) {
      toast.erro(err);
    } finally {
      setSalvandoDom(false);
    }
  }

  async function adicionarDominio(e: FormEvent) {
    e.preventDefault();
    const entradas = novoDominio
      .split(/[,\s;]+/)
      .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
      .filter(Boolean);
    if (entradas.length === 0) return;

    const unicos = Array.from(new Set([...dominios, ...entradas]));
    if (unicos.length === dominios.length) {
      toast.erro('Este domínio já está na lista.');
      return;
    }
    setNovoDominio('');
    await persistirDominios(
      unicos,
      `Domínio(s) de confiança atualizado(s): ${unicos.map((d) => '@' + d).join(', ')}`,
    );
  }

  async function removerDominio(alvo: string) {
    const restante = dominios.filter((d) => d !== alvo);
    await persistirDominios(
      restante,
      restante.length
        ? `Domínio @${alvo} removido.`
        : 'Todos os domínios removidos: aprovação manual obrigatória.',
    );
  }

  async function aprovar(u: UsuarioAdmin) {
    try {
      await api.aprovarUsuario(u.id);
      toast.ok(`${u.nomeExibicao || u.nome} aprovado(a)! E-mail de confirmação enviado.`);
      await carregar();
    } catch (e) {
      toast.erro(e);
    }
  }

  async function recusar(u: UsuarioAdmin) {
    if (!confirm(`Recusar e remover o cadastro pendente de ${u.nome} (${u.email})?`)) return;
    try {
      await api.recusarUsuario(u.id);
      toast.ok('Cadastro recusado e removido.');
      await carregar();
    } catch (e) {
      toast.erro(e);
    }
  }

  async function alterar(id: number, d: Parameters<typeof api.atualizarUsuario>[1]) {
    try {
      await api.atualizarUsuario(id, d);
      await carregar();
    } catch (e) {
      toast.erro(e);
    }
  }

  async function zerarSenha(u: UsuarioAdmin) {
    const rotulo = u.nomeExibicao || u.nome;
    if (
      !confirm(
        `Zerar a senha de ${rotulo} (${u.email})? Uma senha temporária será gerada e o usuário terá que definir uma nova senha no próximo login.`,
      )
    ) {
      return;
    }
    try {
      const r = await api.resetarSenhaUsuario(u.id);
      setResetInfo({ nome: rotulo, email: u.email, senhaTemporaria: r.senhaTemporaria });
      toast.ok('Senha zerada com sucesso!');
      await carregar();
    } catch (e) {
      toast.erro(e);
    }
  }

  function copiar(texto: string) {
    navigator.clipboard.writeText(texto).then(
      () => toast.ok('Senha temporária copiada!'),
      () => toast.erro('Não foi possível copiar.'),
    );
  }

  const termo = busca.trim().toLowerCase();
  const filtrados = (lista ?? []).filter(
    (u) =>
      !termo ||
      u.nome.toLowerCase().includes(termo) ||
      (u.nomeExibicao ?? '').toLowerCase().includes(termo) ||
      u.email.toLowerCase().includes(termo),
  );
  const pendentes = filtrados.filter((u) => !u.aprovado);
  const aprovados = filtrados.filter((u) => u.aprovado);
  const totalPendentes = (lista ?? []).filter((u) => !u.aprovado).length;

  return (
    <div className="space-y-6">
      {/* Cabeçalho estilo Painel Administrativo + abas em pílula */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Painel Administrativo</h1>
          <p className="text-sm text-stone-500">
            Aprove cadastros, gerencie usuários e configure os domínios de confiança.
          </p>
        </div>

        <div className="inline-flex rounded-xl border border-stone-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setAba('usuarios')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
              aba === 'usuarios'
                ? 'bg-cafe-600 text-white shadow-sm'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <span>👥</span>
            <span>Usuários</span>
            {totalPendentes > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.2 text-[11px] font-bold ${
                  aba === 'usuarios'
                    ? 'bg-white/20 text-white'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {totalPendentes}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setAba('dominios')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
              aba === 'dominios'
                ? 'bg-cafe-600 text-white shadow-sm'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <span>🌐</span>
            <span>Domínios</span>
          </button>
        </div>
      </div>

      {/* ABA: USUÁRIOS & APROVAÇÕES */}
      {aba === 'usuarios' && (
        <section className="card space-y-5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-stone-900">
                Usuários &amp; Aprovações ({lista ? lista.length : 0})
              </h2>
              <p className="text-xs text-stone-500">
                Usuários que se cadastram com e-mail fora dos domínios de confiança ficam pendentes
                até um admin aprovar.
              </p>
            </div>

            {lista && lista.length > 4 && (
              <input
                type="search"
                placeholder="Buscar por nome ou e-mail…"
                className="input w-full sm:w-64"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            )}
          </div>

          {!lista ? (
            <p className="text-sm text-stone-500">Carregando…</p>
          ) : filtrados.length === 0 ? (
            <p className="rounded-lg bg-stone-50 p-4 text-center text-sm text-stone-500">
              Nenhum usuário encontrado.
            </p>
          ) : (
            <div className="space-y-3">
              {/* Pendentes de aprovação primeiro */}
              {pendentes.map((u) => {
                const nomeExib = u.nomeExibicao || u.nome;
                const diferente = nomeExib.trim().toLowerCase() !== u.nome.trim().toLowerCase();
                return (
                  <div
                    key={u.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50/60 px-4 py-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-stone-900">{nomeExib}</span>
                        {diferente && (
                          <span className="text-xs text-stone-500">(cadastro: {u.nome})</span>
                        )}
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                          ⏳ Aguardando aprovação
                        </span>
                        {u.emailVerificado ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                            E-mail confirmado
                          </span>
                        ) : (
                          <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-semibold text-stone-700">
                            E-mail pendente
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-stone-600">
                        {u.email} • Cadastrado em {dataHora(u.criadoEm)}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button className="btn-primary btn-sm" onClick={() => void aprovar(u)}>
                        ✓ Aprovar
                      </button>
                      <button className="btn-danger btn-sm" onClick={() => void recusar(u)}>
                        ✕ Recusar
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Usuários aprovados em cards horizontais */}
              {aprovados.map((u) => {
                const eu = u.id === usuario?.id;
                const nomeExib = u.nomeExibicao || u.nome;
                const diferente = nomeExib.trim().toLowerCase() !== u.nome.trim().toLowerCase();
                return (
                  <div
                    key={u.id}
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 transition hover:border-cafe-200 ${
                      u.ativo ? '' : 'opacity-65'
                    }`}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-stone-900">
                          {nomeExib}
                          {eu && (
                            <span className="ml-1.5 text-xs font-normal text-stone-500">
                              (você)
                            </span>
                          )}
                        </span>
                        {diferente && (
                          <span className="text-xs text-stone-500">(cadastro: {u.nome})</span>
                        )}

                        {u.perfil === 'ADMIN' ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                            🛡️ Admin
                          </span>
                        ) : (
                          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">
                            Usuário
                          </span>
                        )}

                        {u.ativo ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                            Ativo
                          </span>
                        ) : (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                            Inativo
                          </span>
                        )}

                        {!u.emailVerificado && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                            E-mail pendente
                          </span>
                        )}
                        {Boolean(u.deveTrocarSenha) && (
                          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800">
                            Troca de senha pendente
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-stone-500">
                        {u.email} • Cadastrado em {dataHora(u.criadoEm)}
                        {u.receberEmailsCafe !== undefined && (
                          <>
                            {' '}
                            • E-mails de café:{' '}
                            <span className="font-medium">
                              {u.receberEmailsCafe ? 'Ativos' : 'Desativados'}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {!eu && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          className="btn-secondary btn-sm"
                          onClick={() => void zerarSenha(u)}
                        >
                          Zerar senha
                        </button>
                        <button
                          className="btn-secondary btn-sm"
                          onClick={() =>
                            void alterar(u.id, {
                              perfil: u.perfil === 'ADMIN' ? 'USUARIO' : 'ADMIN',
                            })
                          }
                        >
                          {u.perfil === 'ADMIN' ? 'Remover Admin' : 'Tornar Admin'}
                        </button>
                        <button
                          className={u.ativo ? 'btn-danger btn-sm' : 'btn-secondary btn-sm'}
                          onClick={() => void alterar(u.id, { ativo: !u.ativo })}
                        >
                          {u.ativo ? 'Desativar' : 'Ativar'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ABA: DOMÍNIOS DE CONFIANÇA */}
      {aba === 'dominios' && (
        <section className="card space-y-5 p-5">
          <div>
            <h2 className="text-base font-bold text-stone-900">
              Domínios de Confiança ({dominios.length})
            </h2>
            <p className="text-xs text-stone-500">
              Quem se cadastrar com um e-mail desses domínios (ex.: <code>previ.com.br</code>) é
              aprovado automaticamente após confirmar o e-mail. Se a lista ficar vazia, todos os
              novos cadastros exigirão aprovação manual de um admin.
            </p>
          </div>

          <form onSubmit={(e) => void adicionarDominio(e)} className="flex flex-wrap gap-2">
            <input
              type="text"
              className="input flex-1"
              placeholder="Ex.: previ.com.br (ou vários separados por vírgula)"
              value={novoDominio}
              disabled={salvandoDom}
              onChange={(e) => setNovoDominio(e.target.value)}
            />
            <button
              type="submit"
              className="btn-primary"
              disabled={salvandoDom || !novoDominio.trim()}
            >
              {salvandoDom ? 'Salvando…' : '+ Adicionar domínio'}
            </button>
          </form>

          {dominios.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50/70 p-6 text-center text-sm text-stone-500">
              Nenhum domínio de confiança cadastrado. Todos os novos cadastros passarão por
              aprovação manual.
            </div>
          ) : (
            <div className="space-y-2">
              {dominios.map((dom) => (
                <div
                  key={dom}
                  className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">🌐</span>
                    <div>
                      <div className="font-semibold text-stone-800">@{dom}</div>
                      <div className="text-xs text-stone-500">
                        Aprovação automática ativa para contas com este domínio
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-danger btn-sm"
                    disabled={salvandoDom}
                    onClick={() => void removerDominio(dom)}
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Modal de senha temporária gerada */}
      {resetInfo && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setResetInfo(null)}
        >
          <div className="card w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-cafe-700">Senha temporária gerada</h2>
            <p className="text-sm text-stone-600">
              A senha de <strong>{resetInfo.nome}</strong> ({resetInfo.email}) foi zerada.
              No próximo login, será exigido o cadastro de uma nova senha.
            </p>
            <div className="flex items-center justify-between rounded-lg bg-stone-100 px-3 py-2">
              <code className="text-base font-bold tracking-wider text-stone-900">
                {resetInfo.senhaTemporaria}
              </code>
              <button
                className="btn-secondary btn-sm"
                onClick={() => copiar(resetInfo.senhaTemporaria)}
              >
                Copiar
              </button>
            </div>
            <div className="text-right">
              <button className="btn-primary" onClick={() => setResetInfo(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
