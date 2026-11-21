import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { useToast } from './Toast';
import type { Rodada } from '../types';

export default function NovaRodadaForm({ onCriada }: { onCriada: (r: Rodada) => void }) {
  const toast = useToast();
  const [titulo, setTitulo] = useState('');
  const [assumir, setAssumir] = useState(true);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      const r = await api.criarRodada(titulo.trim(), assumir);
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
      <div>
        <label className="label" htmlFor="titulo">Título</label>
        <input id="titulo" required minLength={3} className="input" placeholder="Ex.: Pedido de dezembro"
          value={titulo} onChange={(e) => setTitulo(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={assumir} onChange={(e) => setAssumir(e.target.checked)} />
        Quero ser o organizador desta rodada
      </label>
      <button className="btn-primary" disabled={enviando}>
        {enviando ? 'Abrindo…' : 'Abrir rodada'}
      </button>
    </form>
  );
}
