import { ROTULO_STATUS } from '../lib/format';
import type { StatusPagamento, StatusRodada, StatusSabor } from '../types';

const COR_RODADA: Record<StatusRodada, string> = {
  ABERTO: 'bg-emerald-100 text-emerald-800',
  FECHADO: 'bg-amber-100 text-amber-800',
  COMPRADO: 'bg-sky-100 text-sky-800',
  ENTREGUE: 'bg-stone-200 text-stone-700',
  CANCELADO: 'bg-red-100 text-red-800',
};

const Pill = ({ cls, children }: { cls: string; children: React.ReactNode }) => (
  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
    {children}
  </span>
);

export const BadgeRodada = ({ status }: { status: StatusRodada }) => (
  <Pill cls={COR_RODADA[status]}>{ROTULO_STATUS[status]}</Pill>
);

export const BadgePagamento = ({ status }: { status: StatusPagamento }) => (
  <Pill cls={status === 'PAGO' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}>
    {status === 'PAGO' ? 'Pago' : 'Pendente'}
  </Pill>
);

const SABOR: Record<StatusSabor, [string, string]> = {
  FECHADA: ['Caixa fechada', 'bg-emerald-100 text-emerald-800'],
  COM_SOBRA: ['Fechada + sobra', 'bg-sky-100 text-sky-800'],
  AGUARDANDO_COMPLETAR: ['Aguardando completar', 'bg-amber-100 text-amber-800'],
};

export const BadgeSabor = ({ status }: { status: StatusSabor }) => (
  <Pill cls={SABOR[status][1]}>{SABOR[status][0]}</Pill>
);
