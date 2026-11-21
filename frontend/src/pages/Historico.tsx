import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BadgeRodada } from '../components/Badges';
import NovaRodadaForm from '../components/NovaRodadaForm';
import { useToast } from '../components/Toast';
import { api } from '../lib/api';
import { dataHora, rodadaAtiva } from '../lib/format';
import type { Rodada } from '../types';

export default function Historico() {
  const toast = useToast();
  const navigate = useNavigate();
  const [rodadas, setRodadas] = useState<Rodada[] | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);

  const carregar = useCallback(
    () => api.rodadas().then(setRodadas).catch(toast.erro),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (!rodadas) return <p className="text-stone-500">Carregando…</p>;

  const temAtiva = rodadas.some((r) => rodadaAtiva(r.status));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Histórico de rodadas</h1>
        {!temAtiva && (
          <button
            className="btn-primary"
            onClick={() => setMostrarForm((v) => !v)}
          >
            {mostrarForm ? 'Fechar formulário' : '+ Abrir nova rodada'}
          </button>
        )}
      </div>

      {mostrarForm && !temAtiva && (
        <NovaRodadaForm onCriada={() => navigate('/')} />
      )}

      {rodadas.length === 0 ? (
        <div className="card text-sm text-stone-500">Nenhuma rodada ainda.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-stone-500">
              <tr>
                <th className="py-2">#</th>
                <th>Título</th>
                <th>Status</th>
                <th>Organizador</th>
                <th>Abertura</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rodadas.map((r) => (
                <tr key={r.id}>
                  <td className="py-2">{r.id}</td>
                  <td>
                    <Link to={`/rodadas/${r.id}`} className="font-medium text-cafe-600 hover:underline">
                      {r.titulo}
                    </Link>
                  </td>
                  <td><BadgeRodada status={r.status} /></td>
                  <td>{r.organizadorNome ?? '—'}</td>
                  <td>{dataHora(r.dataAbertura)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
