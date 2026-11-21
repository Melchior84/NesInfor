import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { moeda, ROTULO_STATUS, TRANSICOES } from '../lib/format';
import type { Participantes, Rodada, ResumoCompra, StatusRodada } from '../types';
import { BadgePagamento } from './Badges';
import { useToast } from './Toast';

interface Props {
  rodada: Rodada;
  participantes: Participantes | null;
  resumoCompra: ResumoCompra | null;
  /** Recarrega todos os dados do dashboard. */
  onChange: () => void;
}

const ROTULO_ACAO: Record<StatusRodada, string> = {
  ABERTO: 'Reabrir pedidos',
  FECHADO: 'Fechar pedidos',
  COMPRADO: 'Marcar como comprado',
  ENTREGUE: 'Marcar como entregue',
  CANCELADO: 'Cancelar rodada',
};

export default function PainelOrganizador({ rodada, participantes, resumoCompra, onChange }: Props) {
  const toast = useToast();
  const [ocupado, setOcupado] = useState(false);
  const [salvandoPag, setSalvandoPag] = useState(false);
  const [pixChave, setPixChave] = useState('');
  const [banco, setBanco] = useState('');
  const [agencia, setAgencia] = useState('');
  const [conta, setConta] = useState('');

  useEffect(() => {
    api
      .dadosPagamento()
      .then((d) => {
        setPixChave(d.pixChave ?? '');
        setBanco(d.banco ?? '');
        setAgencia(d.agencia ?? '');
        setConta(d.conta ?? '');
      })
      .catch(() => {});
  }, []);

  async function salvarPagamento(e: FormEvent) {
    e.preventDefault();
    setSalvandoPag(true);
    try {
      await api.salvarDadosPagamento({
        pixChave: pixChave.trim() || null,
        banco: banco.trim() || null,
        agencia: agencia.trim() || null,
        conta: conta.trim() || null,
      });
      toast.ok('Dados de pagamento salvos!');
    } catch (err) {
      toast.erro(err);
    } finally {
      setSalvandoPag(false);
    }
  }

  async function executar(fn: () => Promise<unknown>, msg?: string) {
    setOcupado(true);
    try {
      await fn();
      if (msg) toast.ok(msg);
      onChange();
    } catch (e) {
      toast.erro(e);
    } finally {
      setOcupado(false);
    }
  }

  async function mudarStatus(novo: StatusRodada) {
    if (novo === 'CANCELADO' && !confirm('Cancelar esta rodada? Essa ação não pode ser desfeita.')) return;
    if (novo === 'COMPRADO' && !confirm('Confirmar que a compra foi feita na Nespresso?')) return;
    if (
      novo === 'FECHADO' &&
      !confirm(
        'Fechar a rodada agora? Um e-mail com os pedidos confirmados e seus dados de pagamento será enviado a cada participante, e um resumo detalhado será enviado para você.',
      )
    ) {
      return;
    }

    setOcupado(true);
    try {
      const res = await api.mudarStatus(rodada.id, novo);
      if (novo === 'FECHADO' && res.notificacoes) {
        const { participantesEnviados, organizadorEnviado, falhas } = res.notificacoes;
        const resumoEnvio = `Rodada fechada! E-mails enviados: ${participantesEnviados} participante(s)${
          organizadorEnviado ? ' + resumo ao organizador' : ''
        }${falhas ? ` (${falhas} falha(s))` : ''}.`;
        toast.ok(resumoEnvio);
      } else {
        toast.ok(`Status alterado para ${ROTULO_STATUS[novo]}.`);
      }
      onChange();
    } catch (e) {
      toast.erro(e);
    } finally {
      setOcupado(false);
    }
  }

  function copiarResumo() {
    if (!resumoCompra) return;
    const linhas = resumoCompra.itens.map(
      (i) => `${i.caixas}x caixa de ${i.tamanhoCaixa} - ${i.nome} (${i.capsulas} cápsulas)`,
    );
    const texto = [
      `Compra Nespresso - ${rodada.titulo}`,
      ...linhas,
      `Total: ${resumoCompra.totalCaixas} caixa(s), ${resumoCompra.totalCapsulas} cápsulas - ${moeda(resumoCompra.valorTotal)}`,
    ].join('\n');
    navigator.clipboard.writeText(texto).then(
      () => toast.ok('Resumo copiado!'),
      () => toast.erro('Não foi possível copiar.'),
    );
  }

  const proximos = TRANSICOES[rodada.status];

  return (
    <section className="card space-y-6 border-cafe-200 bg-cafe-50/40">
      <h2 className="text-lg font-semibold text-cafe-700">Painel do organizador</h2>

      {/* Dados de pagamento do organizador enviados por e-mail ao fechar */}
      <form onSubmit={salvarPagamento} className="rounded-lg border border-stone-200 bg-white p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-stone-800">
            Dados para pagamento (enviados no e-mail ao fechar a rodada)
          </h3>
          <p className="text-xs text-stone-500">
            Informe sua chave PIX e/ou dados bancários (banco, agência e conta). Eles ficam salvos no seu perfil.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label" htmlFor="pag-pix">Chave PIX</label>
            <input
              id="pag-pix"
              className="input"
              placeholder="CPF, e-mail, celular ou aleatória"
              value={pixChave}
              onChange={(e) => setPixChave(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="pag-banco">Banco</label>
            <input
              id="pag-banco"
              className="input"
              placeholder="Ex.: Itaú, Nubank, BB"
              value={banco}
              onChange={(e) => setBanco(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="pag-ag">Agência</label>
            <input
              id="pag-ag"
              className="input"
              placeholder="Ex.: 0001"
              value={agencia}
              onChange={(e) => setAgencia(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="pag-cc">Conta</label>
            <input
              id="pag-cc"
              className="input"
              placeholder="Ex.: 12345-6"
              value={conta}
              onChange={(e) => setConta(e.target.value)}
            />
          </div>
        </div>
        <button className="btn-secondary btn-sm" disabled={salvandoPag}>
          {salvandoPag ? 'Salvando…' : 'Salvar dados de pagamento'}
        </button>
      </form>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Status da rodada</h3>
        {proximos.length === 0 ? (
          <p className="text-sm text-stone-500">Rodada encerrada ({ROTULO_STATUS[rodada.status]}).</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {proximos.map((s) => (
              <button
                key={s}
                disabled={ocupado}
                onClick={() => void mudarStatus(s)}
                className={
                  s === 'CANCELADO'
                    ? 'btn-danger'
                    : s === 'ABERTO'
                      ? 'btn-secondary'
                      : 'btn-primary'
                }
              >
                {ROTULO_ACAO[s]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Participantes e pagamentos</h3>
        {!participantes || participantes.participantes.length === 0 ? (
          <p className="text-sm text-stone-500">Nenhum participante ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-stone-500">
                <tr>
                  <th className="py-2">Participante</th>
                  <th className="text-right">Cápsulas</th>
                  <th className="text-right">Solicitado</th>
                  <th className="text-right">A pagar (caixas fechadas)</th>
                  <th className="pl-4">Pagamento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {participantes.participantes.map((p) => (
                  <tr key={p.solicitacaoId}>
                    <td className="py-2">
                      <div className="font-medium">{p.nome}</div>
                      <div className="text-xs text-stone-500">{p.email}</div>
                    </td>
                    <td className="text-right">{p.totalCapsulas}</td>
                    <td className="text-right">{moeda(p.totalSolicitado)}</td>
                    <td className="text-right font-semibold">{moeda(p.valorAPagar)}</td>
                    <td className="pl-4">
                      <div className="flex items-center gap-2">
                        <BadgePagamento status={p.statusPagamento} />
                        <button
                          className="btn-secondary btn-sm"
                          disabled={ocupado}
                          onClick={() =>
                            executar(() =>
                              api.alterarPagamento(
                                rodada.id,
                                p.solicitacaoId,
                                p.statusPagamento === 'PAGO' ? 'PENDENTE' : 'PAGO',
                              ),
                            )
                          }
                        >
                          Marcar {p.statusPagamento === 'PAGO' ? 'pendente' : 'pago'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Resumo para compra na Nespresso (só caixas fechadas)</h3>
          <button
            className="btn-secondary btn-sm"
            onClick={copiarResumo}
            disabled={!resumoCompra || resumoCompra.itens.length === 0}
          >
            Copiar
          </button>
        </div>
        {!resumoCompra || resumoCompra.itens.length === 0 ? (
          <p className="text-sm text-stone-500">Nenhuma caixa fechada ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-stone-500">
              <tr>
                <th className="py-2">Sabor</th>
                <th className="text-right">Caixas</th>
                <th className="text-right">Cápsulas</th>
                <th className="text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {resumoCompra.itens.map((i) => (
                <tr key={i.capsulaId}>
                  <td className="py-1.5">{i.nome}</td>
                  <td className="text-right">{i.caixas}</td>
                  <td className="text-right">{i.capsulas}</td>
                  <td className="text-right">{moeda(i.valor)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="font-semibold">
              <tr>
                <td className="pt-2">Total</td>
                <td className="pt-2 text-right">{resumoCompra.totalCaixas}</td>
                <td className="pt-2 text-right">{resumoCompra.totalCapsulas}</td>
                <td className="pt-2 text-right">{moeda(resumoCompra.valorTotal)}</td>
              </tr>
            </tfoot>
          </table>
        )}
        {resumoCompra && resumoCompra.aguardando.length > 0 && (
          <div className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
            <strong>Fora da compra:</strong>{' '}
            {resumoCompra.aguardando
              .map((a) => `${a.nome} (${a.sobra} un., faltam ${a.faltam})`)
              .join(' · ')}
          </div>
        )}
      </div>
    </section>
  );
}
