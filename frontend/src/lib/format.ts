import type { StatusRodada } from '../types';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const moeda = (valor: number | null | undefined) => brl.format(Number(valor ?? 0));

export const dataHora = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    : '—';

export const ROTULO_STATUS: Record<StatusRodada, string> = {
  ABERTO: 'Aberta',
  FECHADO: 'Fechada',
  COMPRADO: 'Comprada',
  ENTREGUE: 'Entregue',
  CANCELADO: 'Cancelada',
};

/** Espelha as transições permitidas no backend (rodadas.service.ts). */
export const TRANSICOES: Record<StatusRodada, StatusRodada[]> = {
  ABERTO: ['FECHADO', 'CANCELADO'],
  FECHADO: ['ABERTO', 'COMPRADO', 'CANCELADO'],
  COMPRADO: ['ENTREGUE', 'CANCELADO'],
  ENTREGUE: [],
  CANCELADO: [],
};

export const rodadaAtiva = (status: StatusRodada) =>
  status === 'ABERTO' || status === 'FECHADO' || status === 'COMPRADO';
