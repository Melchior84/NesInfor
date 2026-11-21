import { useState } from 'react';
import { moeda } from '../lib/format';
import type { SaborPainel } from '../types';
import { BadgeSabor } from './Badges';
import ProgressBar from './ProgressBar';

export default function SaborCard({
  sabor,
  usuarioId,
}: {
  sabor: SaborPainel;
  usuarioId: number;
}) {
  const [aberto, setAberto] = useState(false);
  const { tamanhoCaixa, progressoAtual, faltamProximaCaixa } = sabor;
  const completa = faltamProximaCaixa === 0;

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-stone-900">{sabor.nome}</h3>
        <BadgeSabor status={sabor.status} />
      </div>

      <div>
        <ProgressBar
          atual={progressoAtual}
          total={tamanhoCaixa}
          tom={completa ? 'ok' : sabor.caixasFechadas > 0 ? 'sobra' : 'andamento'}
        />
        <p className="mt-1 text-sm">
          <strong>
            {progressoAtual}/{tamanhoCaixa}
          </strong>{' '}
          {completa ? (
            <span className="text-emerald-700">· caixa completa</span>
          ) : (
            <span className="text-stone-600">· Faltam {faltamProximaCaixa}</span>
          )}
        </p>
      </div>

      <dl className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-stone-50 p-2">
          <dt className="text-stone-500">Solicitado</dt>
          <dd className="text-base font-semibold">{sabor.totalSolicitado}</dd>
        </div>
        <div className="rounded-lg bg-stone-50 p-2">
          <dt className="text-stone-500">Caixas fechadas</dt>
          <dd className="text-base font-semibold">{sabor.caixasFechadas}</dd>
        </div>
        <div className="rounded-lg bg-stone-50 p-2">
          <dt className="text-stone-500">Valor em caixas</dt>
          <dd className="text-base font-semibold">{moeda(sabor.valorFechado)}</dd>
        </div>
      </dl>

      {sabor.sobra > 0 && sabor.caixasFechadas > 0 && (
        <p className="text-xs text-amber-700">
          {sabor.sobra} cápsula(s) além das caixas fechadas não entram na compra.
        </p>
      )}

      <button
        className="btn-secondary btn-sm self-start"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
      >
        {aberto ? '▾' : '▸'} Quem pediu ({sabor.participantes.length})
      </button>

      {aberto && (
        <ul className="divide-y divide-stone-100 text-sm">
          {sabor.participantes.map((p) => (
            <li key={p.usuarioId} className="flex items-center justify-between py-1.5">
              <span className={p.usuarioId === usuarioId ? 'font-semibold text-cafe-700' : ''}>
                {p.nome}
                {p.usuarioId === usuarioId && ' (você)'}
              </span>
              <span className="text-right">
                <strong>{p.quantidade}</strong> un.
                {p.quantidadeAguardando > 0 && (
                  <span className="block text-xs text-amber-700">
                    {p.quantidadeEmCaixa} em caixa · {p.quantidadeAguardando} aguardando
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
