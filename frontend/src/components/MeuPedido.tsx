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

  async function definirGorjeta(cafezinhos: number) {
    if (cafezinhos === pedido.cafezinhosGorjeta) return;
    setOcupado(true);
    try {
      onChange(await api.definirGorjeta(rodadaId, cafezinhos));
      if (cafezinhos > 0) {
        toast.ok(
          `Obrigado! ${cafezinhos} cafezinho${cafezinhos > 1 ? 's' : ''} adicionado${cafezinhos > 1 ? 's' : ''} à caixinha para o Cafezinho Infor ☕`,
        );
      } else {
        toast.ok('Caixinha removida do seu pedido.');
      }
    } catch (e) {
      toast.erro(e);
    } finally {
      setOcupado(false);
    }
  }

  const valorCafezinho = pedido.valorPorCafezinho || 3;
  const opcoesGorjeta = [
    { qtd: 0, rotulo: 'Nenhum', icones: '—', valor: 0 },
    { qtd: 1, rotulo: '1 café', icones: '☕', valor: valorCafezinho },
    { qtd: 2, rotulo: '2 cafés', icones: '☕☕', valor: valorCafezinho * 2 },
    { qtd: 3, rotulo: '3 cafés', icones: '☕☕☕', valor: valorCafezinho * 3 },
  ];

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

      {/* Caixinha / gorjeta Studios Melk */}
      {(editavel || pedido.cafezinhosGorjeta > 0) && (
        <div className="rounded-xl border border-cafe-200 bg-gradient-to-br from-cafe-50/80 to-amber-50/50 p-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-cafe-800">
                ☕ Caixinha para o Cafezinho Infor
              </h3>
              <p className="text-xs text-stone-600">
                Curtiu o Cafezinho Infor? Pague um cafezinho de{' '}
                <strong>{moeda(valorCafezinho)}</strong> para ajudar a custear o servidor, domínio e
                manutenção do site.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {opcoesGorjeta.map((op) => {
              const selecionado = pedido.cafezinhosGorjeta === op.qtd;
              return (
                <button
                  key={op.qtd}
                  type="button"
                  disabled={!editavel || ocupado}
                  onClick={() => void definirGorjeta(op.qtd)}
                  className={`flex flex-col items-center justify-center rounded-lg border px-3 py-2 text-center transition ${
                    selecionado
                      ? 'border-cafe-600 bg-cafe-600 text-white shadow-sm'
                      : 'border-stone-200 bg-white text-stone-700 hover:border-cafe-300 hover:bg-cafe-50/60'
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <span className="text-base leading-tight">{op.icones}</span>
                  <span className="mt-0.5 text-xs font-semibold">{op.rotulo}</span>
                  <span
                    className={`text-[11px] ${
                      selecionado ? 'text-cafe-100' : 'text-stone-500'
                    }`}
                  >
                    {op.valor === 0 ? moeda(0) : `+ ${moeda(op.valor)}`}
                  </span>
                </button>
              );
            })}
          </div>

          {pedido.cafezinhosGorjeta > 0 && (
            <div className="rounded-lg bg-white/80 px-3 py-2 text-xs text-cafe-800 border border-cafe-200/70">
              ❤️ <strong>Muito obrigado pelo carinho!</strong>{' '}
              {pedido.cafezinhosGorjeta === 1
                ? 'Seu cafezinho'
                : `Seus ${pedido.cafezinhosGorjeta} cafezinhos`}{' '}
              (<strong>+ {moeda(pedido.valorGorjeta)}</strong>) ajuda
              {pedido.cafezinhosGorjeta > 1 ? 'm' : ''} os <strong>Studios Melk</strong> a manter o
              site sempre no ar — e só é cobrado se pelo menos um sabor do seu pedido fechar caixa.
            </div>
          )}
        </div>
      )}

      <div className="grid gap-2 rounded-lg bg-cafe-50 p-3 text-sm sm:grid-cols-4">
        <div>
          <div className="text-xs text-stone-500">Cápsulas pedidas</div>
          <div className="text-lg font-semibold">{totalCapsulas}</div>
        </div>
        <div>
          <div className="text-xs text-stone-500">Total solicitado</div>
          <div className="text-lg font-semibold">
            {moeda(totalSolicitado + pedido.valorGorjeta)}
          </div>
          {pedido.valorGorjeta > 0 && (
            <div className="text-[11px] text-cafe-700">
              inclui {moeda(pedido.valorGorjeta)} caixinha ({pedido.cafezinhosGorjeta}☕)
            </div>
          )}
        </div>
        <div>
          <div className="text-xs text-stone-500">Caixas fechadas</div>
          <div className="text-lg font-semibold">{moeda(pedido.totalEmCaixasFechadas)}</div>
        </div>
        <div>
          <div className="text-xs text-stone-500">Total a pagar</div>
          <div className="text-lg font-bold text-cafe-700">
            {moeda(pedido.valorTotalAPagar)}
          </div>
          {pedido.cafezinhosGorjeta > 0 && !pedido.gorjetaContabilizada && (
            <div className="text-[11px] text-stone-500">
              Caixinha só entra se fechar caixa
            </div>
          )}
          {pedido.gorjetaContabilizada && (
            <div className="text-[11px] text-cafe-700">
              inclui {moeda(pedido.valorGorjeta)} caixinha ({pedido.cafezinhosGorjeta}☕)
            </div>
          )}
        </div>
      </div>

      {/* Dados de pagamento + QR Code PIX do organizador (somente após fechar a rodada) */}
      {['FECHADO', 'COMPRADO', 'ENTREGUE'].includes(pedido.rodada.status) &&
        pedido.valorTotalAPagar > 0 &&
        pedido.pagamentoOrganizador && (
        <div className="rounded-xl border border-cafe-200 bg-white p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-cafe-800">💳 Pagamento do pedido</h3>
              <p className="text-xs text-stone-500">
                Organizador: <strong>{pedido.pagamentoOrganizador.organizadorNome}</strong> · Valor:{' '}
                <strong className="text-cafe-700">{moeda(pedido.valorTotalAPagar)}</strong>
              </p>
            </div>
            <BadgePagamento status={pedido.statusPagamento} />
          </div>

          {pedido.pagamentoOrganizador.isPixCopiaCola && pedido.pagamentoOrganizador.pixChave ? (
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <img
                src={`/api/rodadas/${rodadaId}/pix-qrcode.png`}
                alt="QR Code PIX para pagamento"
                className="h-44 w-44 shrink-0 rounded-lg border border-stone-200 bg-white p-1.5"
              />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-xs text-stone-600">
                  Escaneie o QR Code no aplicativo do seu banco ou copie o código{' '}
                  <strong>PIX Copia e Cola</strong> abaixo e informe o valor de{' '}
                  <strong>{moeda(pedido.valorTotalAPagar)}</strong>:
                </p>
                <div className="break-all rounded-lg bg-stone-50 p-2 font-mono text-[11px] text-stone-700 border border-stone-200">
                  {pedido.pagamentoOrganizador.pixChave}
                </div>
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  onClick={() => {
                    navigator.clipboard
                      .writeText(pedido.pagamentoOrganizador!.pixChave!)
                      .then(
                        () => toast.ok('Código PIX Copia e Cola copiado!'),
                        () => toast.erro('Não foi possível copiar o código PIX.'),
                      );
                  }}
                >
                  Copiar código PIX
                </button>
              </div>
            </div>
          ) : pedido.pagamentoOrganizador.pixChave ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-stone-600">Chave PIX:</span>
              <code className="rounded bg-stone-100 px-2 py-0.5 font-mono text-xs text-stone-800">
                {pedido.pagamentoOrganizador.pixChave}
              </code>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => {
                  navigator.clipboard
                    .writeText(pedido.pagamentoOrganizador!.pixChave!)
                    .then(
                      () => toast.ok('Chave PIX copiada!'),
                      () => toast.erro('Não foi possível copiar.'),
                    );
                }}
              >
                Copiar chave
              </button>
            </div>
          ) : null}

          {(pedido.pagamentoOrganizador.banco ||
            pedido.pagamentoOrganizador.agencia ||
            pedido.pagamentoOrganizador.conta) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-stone-100 pt-2 text-xs text-stone-600">
              {pedido.pagamentoOrganizador.banco && (
                <span>
                  <strong>Banco:</strong> {pedido.pagamentoOrganizador.banco}
                </span>
              )}
              {pedido.pagamentoOrganizador.agencia && (
                <span>
                  <strong>Agência:</strong> {pedido.pagamentoOrganizador.agencia}
                </span>
              )}
              {pedido.pagamentoOrganizador.conta && (
                <span>
                  <strong>Conta:</strong> {pedido.pagamentoOrganizador.conta}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
