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

  const qtdAlertados = usuarios.filter(
    (u) => u.ativo && u.aprovado && u.emailVerificado && u.receberEmailsCafe !== false,
  ).length;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const msgConfirmacao =
      qtdAlertados > 0
        ? `Abrir a rodada "${titulo.trim()}" agora?\n\nAtenção: um e-mail de aviso será disparado para ${qtdAlertados} usuário${qtdAlertados === 1 ? '' : 's'} com notificações ativas.`
        : `Abrir a rodada "${titulo.trim()}" agora?\n\nNenhum usuário está com notificações de e-mail ativas no momento.`;
    if (!confirm(msgConfirmacao)) return;

    setEnviando(true);
    try {
      const orgId = organizadorId ? Number(organizadorId) : null;
      const r = await api.criarRodada(titulo.trim(), false, orgId);
      const env = r.notificacoes?.enviados ?? 0;
      const falhas = r.notificacoes?.falhas ?? 0;
      toast.ok(
        env > 0
          ? `Nova rodada aberta! E-mail enviado para ${env} participante(s)${falhas ? ` (${falhas} falha(s))` : ''}.`
          : 'Nova rodada aberta!',
      );
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
              <option value={usuario.id}>{usuario.nomeExibicao || usuario.nome} (você)</option>
            )}
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nomeExibicao || u.nome}
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
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" disabled={enviando}>
          {enviando ? 'Abrindo…' : 'Abrir rodada'}
        </button>
        {usuarios.length > 0 && (
          <span className="text-xs text-stone-500">
            📧 {qtdAlertados} usuário{qtdAlertados === 1 ? '' : 's'} receber
            {qtdAlertados === 1 ? 'á' : 'ão'} aviso por e-mail
          </span>
        )}
      </div>
    </form>
  );
}
