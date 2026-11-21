import { useState } from 'react';
import { api } from '../lib/api';
import { moeda } from '../lib/format';
import type { Capsula, MeuPedido as Pedido } from '../types';
import { BadgePagamento } from './Badges';
import CapsulaFlipCard from './CapsulaFlipCard';
import { useToast } from './Toast';

interface Props {
  rodadaId: number;
  pedido: Pedido;
  capsulas: Capsula[];
  /** Chamado após qualquer alteração para recarregar o painel. */
  onChange: (pedido: Pedido) => void;
}

function QtdInput({
  valor,
  disabled,
  onCommit,
}: {
  valor: number;
  disabled: boolean;
  onCommit: (n: number) => void;
}) {
  const [txt, setTxt] = useState(String(valor));
  const commit = () => {
    const n = Math.max(0, Math.floor(Number(txt)));
    if (Number.isNaN(n)) return setTxt(String(valor));
    if (n !== valor) onCommit(n);
    else setTxt(String(valor));
  };
  return (
    <div className="inline-flex items-center gap-1">
      <button
        className="btn-secondary btn-sm"
        disabled={disabled || valor <= 0}
        onClick={() => onCommit(valor - 1)}
        aria-label="Diminuir"
      >
        −
      </button>
      <input
        type="number"
        min={0}
        className="input w-20 text-center"
        value={txt}
        disabled={disabled}
        onChange={(e) => setTxt(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      <button
        className="btn-secondary btn-sm"
        disabled={disabled}
        onClick={() => onCommit(valor + 1)}
        aria-label="Aumentar"
      >
        +
      </button>
    </div>
  );
}

export default function MeuPedido({ rodadaId, pedido, capsulas, onChange }: Props) {
  const toast = useToast();
  const [ocupado, setOcupado] = useState(false);
  const [busca, setBusca] = useState('');

  const editavel = pedido.podeEditar;
  const qtdPorCapsula = new Map(pedido.itens.map((i) => [i.capsulaId, i.quantidade]));
  const disponiveis = capsulas.filter(
    (c) =>
      c.ativo &&
      (!busca.trim() ||
        c.nome.toLowerCase().includes(busca.trim().toLowerCase()) ||
        (c.descricao ?? '').toLowerCase().includes(busca.trim().toLowerCase())),
  );
  const totalSolicitado = pedido.itens.reduce((s, i) => s + i.quantidade * i.precoUnitario, 0);
  const totalCapsulas = pedido.itens.reduce((s, i) => s + i.quantidade, 0);

  async function definir(id: number, quantidade: number) {
    setOcupado(true);
    try {
      onChange(await api.definirQuantidade(rodadaId, id, quantidade));
    } catch (e) {
      toast.erro(e);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="card space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Meu pedido</h2>
        {pedido.solicitacaoId && <BadgePagamento status={pedido.statusPagamento} />}
      </div>

      {!editavel && (
        <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-800">
          A rodada não está aberta: o pedido não pode mais ser alterado.
        </p>
      )}

      {editavel && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-stone-600">
              Escolha os sabores abaixo — clique no ícone <strong>ⓘ</strong> no canto superior direito de
              cada card para virar e ver a descrição.
            </p>
            {capsulas.filter((c) => c.ativo).length > 4 && (
              <input
                type="search"
                placeholder="Buscar sabor…"
                className="input w-full sm:w-56"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            )}
          </div>

          {disponiveis.length === 0 ? (
            <p className="rounded-lg bg-stone-50 p-4 text-center text-sm text-stone-500">
              Nenhuma cápsula disponível encontrada.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {disponiveis.map((c) => (
                <CapsulaFlipCard
                  key={c.id}
                  capsula={c}
                  quantidadeNoPedido={qtdPorCapsula.get(c.id) ?? 0}
                  disabled={ocupado}
                  onDefinir={definir}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Resumo dos itens já escolhidos */}
      <div className="space-y-2 border-t border-stone-100 pt-4">
        <h3 className="text-sm font-semibold text-stone-700">Resumo dos meus itens</h3>
        {pedido.itens.length === 0 ? (
          <p className="text-sm text-stone-500">Você ainda não pediu nenhuma cápsula nesta rodada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-stone-500">
                <tr>
                  <th className="py-2">Sabor</th>
                  <th>Preço un.</th>
                  <th>Quantidade</th>
                  <th className="text-right">Subtotal</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {pedido.itens.map((i) => (
                  <tr key={i.capsulaId}>
                    <td className="py-2">
                      <div className="font-medium">{i.nome}</div>
                      {i.quantidadeAguardando > 0 && (
                        <div className="text-xs text-amber-700">
                          {i.quantidadeEmCaixa} em caixa fechada · {i.quantidadeAguardando} aguardando
                        </div>
                      )}
                    </td>
                    <td>{moeda(i.precoUnitario)}</td>
                    <td>
                      <QtdInput
                        key={i.quantidade}
                        valor={i.quantidade}
                        disabled={!editavel || ocupado}
                        onCommit={(n) => definir(i.capsulaId, n)}
                      />
                    </td>
                    <td className="text-right font-medium">{moeda(i.quantidade * i.precoUnitario)}</td>
                    <td className="pl-2 text-right">
                      {editavel && (
                        <button
                          className="btn-danger btn-sm"
                          disabled={ocupado}
                          onClick={() => definir(i.capsulaId, 0)}
                        >
                          Remover
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid gap-2 rounded-lg bg-cafe-50 p-3 text-sm sm:grid-cols-3">
        <div>
          <div className="text-xs text-stone-500">Cápsulas pedidas</div>
          <div className="text-lg font-semibold">{totalCapsulas}</div>
        </div>
        <div>
          <div className="text-xs text-stone-500">Total solicitado</div>
          <div className="text-lg font-semibold">{moeda(totalSolicitado)}</div>
        </div>
        <div>
          <div className="text-xs text-stone-500">Total em caixas fechadas (a pagar)</div>
          <div className="text-lg font-semibold text-cafe-700">
            {moeda(pedido.totalEmCaixasFechadas)}
          </div>
        </div>
      </div>
    </section>
  );
}
