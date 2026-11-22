import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';
import type { Rodada, UsuarioAdmin } from '../types';
import { useToast } from './Toast';

export default function NovaRodadaForm({ onCriada }: { onCriada: (r: Rodada) => void }) {
  const { usuario } = useAuth();
  const toast = useToast();
  const [titulo, setTitulo] = useState('');
  const [organizadorId, setOrganizadorId] = useState<string>(
    usuario ? String(usuario.id) : '',
  );
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api
      .usuarios()
      .then((lista) => setUsuarios(lista.filter((u) => u.ativo && u.aprovado)))
      .catch(() => {});
  }, []);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      const orgId = organizadorId ? Number(organizadorId) : null;
      const r = await api.criarRodada(titulo.trim(), false, orgId);
      toast.ok('Nova rodada aberta!');
      setTitulo('');
      onCriada(r);
    } catch (err) {
      toast.erro(err);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="card space-y-3">
      <h2 className="text-lg font-semibold">Abrir nova rodada</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="titulo">Título</label>
          <input
            id="titulo"
            required
            minLength={3}
            className="input"
            placeholder="Ex.: Pedido de dezembro"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="organizador">Organizador da rodada</label>
          <select
            id="organizador"
            className="input"
            value={organizadorId}
            onChange={(e) => setOrganizadorId(e.target.value)}
          >
            <option value="">Deixar em aberto (qualquer pessoa pode assumir)</option>
            {usuarios.length === 0 && usuario && (
              <option value={usuario.id}>{usuario.nome} (você)</option>
            )}
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
                {u.id === usuario?.id ? ' (você)' : ''}
                {u.perfil === 'ADMIN' ? ' · ADMIN' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-xs text-stone-500">
        O organizador escolhido terá acesso completo ao Painel do organizador, fechamento da
        rodada, controle de pagamentos e sorteio de brindes desta rodada.
      </p>
      <button className="btn-primary" disabled={enviando}>
        {enviando ? 'Abrindo…' : 'Abrir rodada'}
      </button>
    </form>
  );
}
