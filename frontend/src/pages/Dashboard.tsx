import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { BadgeRodada } from '../components/Badges';
import MeuPedido from '../components/MeuPedido';
import PainelOrganizador from '../components/PainelOrganizador';
import SaborCard from '../components/SaborCard';
import SorteioBrindes from '../components/SorteioBrindes';
import { useToast } from '../components/Toast';
import { api } from '../lib/api';
import { dataHora, moeda, rodadaAtiva } from '../lib/format';
import type {
  Capsula,
  MeuPedido as Pedido,
  Painel,
  Participantes,
  ResumoCompra,
  Rodada,
  SorteioRodada,
} from '../types';

const POLL_MS = 20_000;

interface Dados {
  rodada: Rodada | null;
  painel: Painel | null;
  pedido: Pedido | null;
  capsulas: Capsula[];
  participantes: Participantes | null;
  resumoCompra: ResumoCompra | null;
  sorteio: SorteioRodada | null;
}

const VAZIO: Dados = {
  rodada: null,
  painel: null,
  pedido: null,
  capsulas: [],
  participantes: null,
  resumoCompra: null,
  sorteio: null,
};

export default function Dashboard() {
  const { id } = useParams();
  const { usuario } = useAuth();
  const toast = useToast();
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const seq = useRef(0);

  const carregar = useCallback(async () => {
    const minha = ++seq.current;
    try {
      // Sem :id => apenas a rodada ativa no momento (se nao houver, mostra aviso).
      const rodada = id ? await api.rodada(Number(id)) : await api.rodadaAtiva();

      if (!rodada) {
        if (minha === seq.current) setDados(VAZIO);
        return;
      }

      const organiza = usuario!.perfil === 'ADMIN' || rodada.organizadorId === usuario!.id;
      const podeSortear = ['FECHADO', 'COMPRADO', 'ENTREGUE'].includes(rodada.status);
      const [painel, pedido, capsulas, participantes, resumoCompra, sorteio] = await Promise.all([
        api.painel(rodada.id),
        api.meuPedido(rodada.id),
        rodada.status === 'ABERTO' ? api.capsulas(true) : Promise.resolve([] as Capsula[]),
        organiza ? api.participantes(rodada.id) : Promise.resolve(null),
        organiza ? api.resumoCompra(rodada.id) : Promise.resolve(null),
        podeSortear ? api.brindes(rodada.id) : Promise.resolve(null),
      ]);
      if (minha !== seq.current) return; // resposta antiga
      setDados({ rodada, painel, pedido, capsulas, participantes, resumoCompra, sorteio });
      setErro(null);
    } catch (e) {
      if (minha === seq.current) setErro(e instanceof Error ? e.message : String(e));
    }
  }, [id, usuario]);

  useEffect(() => {
    setDados(null);
    void carregar();
    const t = setInterval(() => {
      if (!document.hidden) void carregar();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [carregar]);

  if (erro && !dados) {
    return (
      <div className="card text-center">
        <p className="mb-3 text-red-700">{erro}</p>
        <button className="btn-secondary" onClick={() => void carregar()}>Tentar novamente</button>
      </div>
    );
  }
  if (!dados) return <p className="text-stone-500">Carregando…</p>;

  const { rodada, painel, pedido } = dados;

  if (!rodada || !painel || !pedido) {
    return (
      <div className="card py-12 text-center">
        <div className="text-4xl">☕</div>
        <h1 className="mt-3 text-lg font-semibold text-stone-800">
          Não há nenhuma rodada de pedidos aberta no momento.
        </h1>
        <p className="mt-1 text-sm text-stone-500">Aguarde a próxima!</p>
      </div>
    );
  }

  const ativa = rodadaAtiva(rodada.status);
  const organiza = usuario!.perfil === 'ADMIN' || rodada.organizadorId === usuario!.id;
  const { resumo } = painel;

  async function assumir() {
    try {
      await api.assumirRodada(rodada!.id);
      toast.ok('Você agora é o organizador desta rodada.');
      void carregar();
    } catch (e) {
      toast.erro(e);
      void carregar();
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <section className="card space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-stone-900">{rodada.titulo}</h1>
              <BadgeRodada status={rodada.status} />
            </div>
            <p className="mt-1 text-sm text-stone-500">
              Aberta em {dataHora(rodada.dataAbertura)}
              {rodada.dataFechamento && ` · fechada em ${dataHora(rodada.dataFechamento)}`}
            </p>
            <p className="mt-1 text-sm">
              Organizador:{' '}
              {rodada.organizadorNome ? (
                <strong>
                  {rodada.organizadorNome}
                  {rodada.organizadorId === usuario!.id && ' (você)'}
                </strong>
              ) : (
                <span className="text-stone-500">ninguém ainda</span>
              )}
            </p>
          </div>
          {rodada.organizadorId === null && ativa && (
            <button className="btn-primary" onClick={assumir}>
              Assumir organização desta rodada
            </button>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metrica rotulo="Compra na Nespresso (caixas fechadas)" valor={moeda(resumo.valorCompraNespresso)} destaque />
          <Metrica rotulo="Total solicitado (todos)" valor={moeda(resumo.valorSolicitado)} />
          <Metrica rotulo="Caixas fechadas" valor={String(resumo.totalCaixasFechadas)} />
          <Metrica rotulo="Sabores aguardando completar" valor={String(resumo.saboresAguardando)} />
        </dl>
      </section>

      {/* Painel de caixas */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Painel de caixas</h2>
        <p className="text-sm text-stone-500">
          Caixas fechadas de 50 cápsulas por sabor. Sabores sem caixa completa ficam “aguardando completar” e não
          entram na compra — combine com os colegas para fechar!
        </p>
        {painel.sabores.length === 0 ? (
          <div className="card text-sm text-stone-500">Nenhum sabor foi pedido ainda.</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {painel.sabores.map((s) => (
              <SaborCard key={s.capsulaId} sabor={s} usuarioId={usuario!.id} />
            ))}
          </div>
        )}
      </section>

      <MeuPedido
        rodadaId={rodada.id}
        pedido={pedido}
        capsulas={dados.capsulas}
        onChange={() => void carregar()}
      />

      {dados.sorteio && (
        <SorteioBrindes
          rodadaTitulo={rodada.titulo}
          sorteio={dados.sorteio}
          usuarioId={usuario!.id}
          onChange={(s) => setDados((d) => (d ? { ...d, sorteio: s } : d))}
        />
      )}

      {organiza && (
        <PainelOrganizador
          rodada={rodada}
          participantes={dados.participantes}
          resumoCompra={dados.resumoCompra}
          onChange={() => void carregar()}
        />
      )}
    </div>
  );
}

function Metrica({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className={`rounded-lg p-3 ${destaque ? 'bg-cafe-600 text-white' : 'bg-stone-50'}`}>
      <dt className={`text-xs ${destaque ? 'text-cafe-100' : 'text-stone-500'}`}>{rotulo}</dt>
      <dd className="text-xl font-bold">{valor}</dd>
    </div>
  );
}
