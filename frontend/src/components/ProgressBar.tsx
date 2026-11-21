interface Props {
  atual: number;
  total: number;
  /** Cor da barra. */
  tom?: 'ok' | 'andamento' | 'sobra';
}

export default function ProgressBar({ atual, total, tom = 'andamento' }: Props) {
  const pct = total > 0 ? Math.min(100, Math.round((atual / total) * 100)) : 0;
  const cor =
    tom === 'ok' ? 'bg-emerald-500' : tom === 'sobra' ? 'bg-amber-500' : 'bg-cafe-500';
  return (
    <div
      className="h-3 w-full overflow-hidden rounded-full bg-stone-200"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={atual}
    >
      <div className={`h-full rounded-full transition-all ${cor}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
