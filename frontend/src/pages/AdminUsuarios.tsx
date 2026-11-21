import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../components/Toast';
import { api } from '../lib/api';
import type { UsuarioAdmin } from '../types';

export default function AdminUsuarios() {
  const toast = useToast();
  const { usuario } = useAuth();
  const [lista, setLista] = useState<UsuarioAdmin[] | null>(null);
  const [resetInfo, setResetInfo] = useState<{
    nome: string;
    email: string;
    senhaTemporaria: string;
  } | null>(null);

  const carregar = useCallback(
    () => api.usuarios().then(setLista).catch(toast.erro),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useEffect(() => void carregar(), [carregar]);

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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Usuários</h1>
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
              {lista.map((u) => {
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
                        onClick={() => zerarSenha(u)}
                      >
                        Zerar senha
                      </button>
                      <button
                        className="btn-secondary btn-sm"
                        disabled={eu}
                        onClick={() =>
                          alterar(u.id, { perfil: u.perfil === 'ADMIN' ? 'USUARIO' : 'ADMIN' })
                        }
                      >
                        {u.perfil === 'ADMIN' ? 'Tornar usuário' : 'Tornar admin'}
                      </button>
                      <button
                        className="btn-secondary btn-sm"
                        disabled={eu}
                        onClick={() => alterar(u.id, { ativo: !u.ativo })}
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
