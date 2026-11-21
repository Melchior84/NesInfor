import { useState } from 'react';
import { moeda } from '../lib/format';
import type { Capsula } from '../types';

interface Props {
  capsula: Capsula;
  quantidadeNoPedido: number;
  disabled: boolean;
  onDefinir: (capsulaId: number, quantidade: number) => void;
}

export default function CapsulaFlipCard({
  capsula,
  quantidadeNoPedido,
  disabled,
  onDefinir,
}: Props) {
  const [virado, setVirado] = useState(false);
  const [qtdAdicionar, setQtdAdicionar] = useState('5');
  const [imgErro, setImgErro] = useState(false);

  const temImagem = Boolean(capsula.imagemUrl) && !imgErro;

  function adicionar() {
    const n = Math.max(1, Math.floor(Number(qtdAdicionar) || 1));
    onDefinir(capsula.id, quantidadeNoPedido + n);
  }

  return (
    <div className="flip-scene h-72">
      <div className={`flip-card ${virado ? 'flipped' : ''}`}>
        {/* FRENTE: foto + nome + preço + controle de pedido */}
        <div
          className={`flip-face flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm ${
            quantidadeNoPedido > 0 ? 'border-cafe-500 ring-1 ring-cafe-200' : 'border-stone-200'
          }`}
        >
          {/* Área da foto */}
          <div className="relative flex h-36 items-center justify-center bg-gradient-to-br from-cafe-50 to-stone-100">
            {temImagem ? (
              <img
                src={capsula.imagemUrl!}
                alt={capsula.nome}
                onError={() => setImgErro(true)}
                className="h-full w-full object-contain p-3"
              />
            ) : (
              <div className="flex flex-col items-center text-cafe-500/60">
                <span className="text-4xl">☕</span>
                <span className="mt-1 text-[11px] font-medium">Sem imagem</span>
              </div>
            )}

            {/* Badge de quantidade já pedida */}
            {quantidadeNoPedido > 0 && (
              <span className="absolute top-2 left-2 rounded-full bg-cafe-600 px-2 py-0.5 text-xs font-semibold text-white shadow">
                {quantidadeNoPedido} no pedido
              </span>
            )}

            {/* Ícone no canto superior direito para virar o card */}
            <button
              type="button"
              onClick={() => setVirado(true)}
              title="Ver descrição"
              aria-label={`Ver descrição de ${capsula.nome}`}
              className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 bg-white/90 text-stone-600 shadow-sm backdrop-blur transition hover:border-cafe-500 hover:bg-cafe-50 hover:text-cafe-700"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>

          {/* Nome, preço e ações */}
          <div className="flex flex-1 flex-col justify-between p-3">
            <div>
              <h3 className="truncate text-sm font-semibold text-stone-900" title={capsula.nome}>
                {capsula.nome}
              </h3>
              <p className="text-xs text-stone-500">
                <strong className="text-cafe-700">{moeda(capsula.precoAtual)}</strong> / un. · caixa com{' '}
                {capsula.tamanhoCaixa}
              </p>
            </div>

            {quantidadeNoPedido === 0 ? (
              <div className="mt-2 flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  aria-label={`Quantidade de ${capsula.nome}`}
                  className="input w-16 py-1 text-center text-xs"
                  value={qtdAdicionar}
                  disabled={disabled}
                  onChange={(e) => setQtdAdicionar(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-primary btn-sm flex-1"
                  disabled={disabled}
                  onClick={adicionar}
                >
                  + Adicionar
                </button>
              </div>
            ) : (
              <div className="mt-2 flex items-center justify-between gap-1">
                <div className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    disabled={disabled}
                    onClick={() => onDefinir(capsula.id, quantidadeNoPedido - 1)}
                    aria-label="Diminuir"
                  >
                    −
                  </button>
                  <span className="min-w-8 text-center text-sm font-semibold">
                    {quantidadeNoPedido}
                  </span>
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    disabled={disabled}
                    onClick={() => onDefinir(capsula.id, quantidadeNoPedido + 1)}
                    aria-label="Aumentar"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  className="btn-danger btn-sm"
                  disabled={disabled}
                  onClick={() => onDefinir(capsula.id, 0)}
                >
                  Remover
                </button>
              </div>
            )}
          </div>
        </div>

        {/* VERSO: descrição completa da cápsula */}
        <div className="flip-face flip-back flex flex-col justify-between rounded-xl border border-cafe-200 bg-cafe-50 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-cafe-900">{capsula.nome}</h3>
              <p className="text-xs text-cafe-700">
                {moeda(capsula.precoAtual)} / un. · caixa com {capsula.tamanhoCaixa}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setVirado(false)}
              title="Voltar para a foto"
              aria-label={`Voltar para a frente de ${capsula.nome}`}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-cafe-200 bg-white text-cafe-700 shadow-sm transition hover:bg-cafe-100"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4"
              >
                <path
                  fillRule="evenodd"
                  d="M7.793 2.232a.75.75 0 01-.025 1.06L3.622 7.25h10.003a5.375 5.375 0 010 10.75H10.75a.75.75 0 010-1.5h2.875a3.875 3.875 0 000-7.75H3.622l4.146 3.957a.75.75 0 01-1.036 1.085l-5.5-5.25a.75.75 0 010-1.085l5.5-5.25a.75.75 0 011.06.025z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>

          <div className="my-2 flex-1 overflow-y-auto pr-1 text-xs leading-relaxed text-stone-700">
            {capsula.descricao ? (
              <p className="whitespace-pre-line">{capsula.descricao}</p>
            ) : (
              <p className="italic text-stone-400">Nenhuma descrição cadastrada para este sabor.</p>
            )}
          </div>

          <button
            type="button"
            className="btn-secondary btn-sm w-full"
            onClick={() => setVirado(false)}
          >
            Voltar para o card
          </button>
        </div>
      </div>
    </div>
  );
}
