import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../components/Toast';
import { api } from '../lib/api';
import type { UsuarioAdmin } from '../types';

export default function AdminUsuarios() {
  const toast = useToast();
  const { usuario } = useAuth();
  const [lista, setLista] = useState<UsuarioAdmin[] | null>(null);
  const [dominiosTxt, setDominiosTxt] = useState('');
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
      setDominiosTxt(dom.dominios.join(', '));
    } catch (e) {
      toast.erro(e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function salvarDominios(e: FormEvent) {
    e.preventDefault();
    setSalvandoDom(true);
    try {
      const dominios = dominiosTxt
        .split(/[,\s;]+/)
        .map((d) => d.trim().replace(/^@/, ''))
        .filter(Boolean);
      const r = await api.salvarDominiosAprovados(dominios);
      setDominiosTxt(r.dominios.join(', '));
      toast.ok(
        r.dominios.length
          ? `Aprovação automática ativa para: ${r.dominios.map((d) => '@' + d).join(', ')}`
          : 'Aprovação manual obrigatória para todos os novos cadastros.',
      );
    } catch (err) {
      toast.erro(err);
    } finally {
      setSalvandoDom(false);
    }
  }

  async function aprovar(u: UsuarioAdmin) {
    try {
      await api.aprovarUsuario(u.id);
      toast.ok(`${u.nome} aprovado(a)! E-mail de confirmação enviado.`);
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
    if (
      !confirm(
        `Zerar a senha de ${u.nome} (${u.email})? Uma senha temporária será gerada e o usuário terá que definir uma nova senha no próximo login.`,
      )
    ) {
      return;
    }
    try {
      const r = await api.resetarSenhaUsuario(u.id);
      setResetInfo({ nome: u.nome, email: u.email, senhaTemporaria: r.senhaTemporaria });
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

  const pendentes = (lista ?? []).filter((u) => !u.aprovado);
  const aprovados = (lista ?? []).filter((u) => u.aprovado);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Usuários</h1>

      {/* Cadastros aguardando aprovação de um ADMIN */}
      {pendentes.length > 0 && (
        <section className="card space-y-3 border-amber-300 bg-amber-50/60">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-amber-900">
              ⏳ Cadastros aguardando aprovação ({pendentes.length})
            </h2>
          </div>
          <div className="divide-y divide-amber-200/70">
            {pendentes.map((u) => (
              <div
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm"
              >
                <div>
                  <div className="font-semibold text-stone-900">{u.nome}</div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
                    <span>{u.email}</span>
                    {u.emailVerificado ? (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800">
                        E-mail confirmado
                      </span>
                    ) : (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">
                        Ainda não confirmou o e-mail
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="btn-primary btn-sm" onClick={() => void aprovar(u)}>
                    ✓ Aprovar
                  </button>
                  <button className="btn-danger btn-sm" onClick={() => void recusar(u)}>
                    ✕ Recusar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Configuração de domínios com aprovação automática */}
      <form onSubmit={salvarDominios} className="card space-y-2">
        <label className="label text-stone-700" htmlFor="dom-aprov">
          Domínios de e-mail com aprovação automática (opcional)
        </label>
        <p className="text-xs text-stone-500">
          Quem se cadastrar com um desses domínios (ex.: <code>infor.com.br</code>) é aprovado
          automaticamente após confirmar o e-mail. Deixe vazio para exigir aprovação manual de
          todos os novos cadastros.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            id="dom-aprov"
            className="input flex-1"
            placeholder="Ex.: infor.com.br, empresa.com.br"
            value={dominiosTxt}
            onChange={(e) => setDominiosTxt(e.target.value)}
          />
          <button className="btn-secondary" disabled={salvandoDom}>
            {salvandoDom ? 'Salvando…' : 'Salvar domínios'}
          </button>
        </div>
      </form>

      {/* Tabela de usuários aprovados */}
      <div className="card overflow-x-auto">
        {!lista ? (
          <p className="text-stone-500">Carregando…</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-stone-500">
              <tr>
                <th className="py-2">Nome</th>
                <th>E-mail</th>
                <th>Perfil</th>
                <th>Situação</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {aprovados.map((u) => {
                const eu = u.id === usuario?.id;
                return (
                  <tr key={u.id} className={u.ativo ? '' : 'text-stone-400'}>
                    <td className="py-2 font-medium">
                      {u.nome}
                      {eu && ' (você)'}
                    </td>
                    <td>
                      <div>{u.email}</div>
                      <div className="flex flex-wrap gap-1 pt-0.5 text-xs">
                        {!u.emailVerificado && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">
                            E-mail pendente
                          </span>
                        )}
                        {u.deveTrocarSenha && (
                          <span className="rounded bg-sky-100 px-1.5 py-0.5 text-sky-800">
                            Troca de senha pendente
                          </span>
                        )}
                      </div>
                    </td>
                    <td>{u.perfil}</td>
                    <td>{u.ativo ? 'Ativo' : 'Inativo'}</td>
                    <td className="space-x-1 py-1 text-right whitespace-nowrap">
                      <button
                        className="btn-secondary btn-sm"
                        disabled={eu}
                        onClick={() => void zerarSenha(u)}
                      >
                        Zerar senha
                      </button>
                      <button
                        className="btn-secondary btn-sm"
                        disabled={eu}
                        onClick={() =>
                          void alterar(u.id, {
                            perfil: u.perfil === 'ADMIN' ? 'USUARIO' : 'ADMIN',
                          })
                        }
                      >
                        {u.perfil === 'ADMIN' ? 'Tornar usuário' : 'Tornar admin'}
                      </button>
                      <button
                        className="btn-secondary btn-sm"
                        disabled={eu}
                        onClick={() => void alterar(u.id, { ativo: !u.ativo })}
                      >
                        {u.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

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
