import { useState } from 'react';

interface Props {
  valor: number | null;
  /** Quando informado, habilita modo interativo (clicavel) de 0 a 12. */
  onChange?: (novo: number | null) => void;
  compacto?: boolean;
  /** Exibe o rotulo "Intensidade" junto as bolinhas (padrao: true no modo leitura). */
  mostrarRotulo?: boolean;
}

const MAX = 12;
const NIVEIS = Array.from({ length: MAX }, (_, i) => i + 1);

export default function IntensidadeBolinhas({
  valor,
  onChange,
  compacto,
  mostrarRotulo,
}: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const editavel = Boolean(onChange);
  const exibirRotulo = mostrarRotulo ?? !editavel;

  if (!editavel && valor === null) return null;

  const ativoAte = hover ?? valor ?? 0;
  const titulo =
    valor !== null
      ? `Intensidade ${valor} de ${MAX} (escala de torra/força do café)`
      : 'Intensidade não informada';

  if (compacto && !editavel) {
    return (
      <div
        className="space-y-0.5"
        title={titulo}
        aria-label={`Intensidade ${valor} de ${MAX}`}
      >
        {exibirRotulo && (
          <div className="flex items-center justify-between text-[11px] leading-tight">
            <span className="font-medium text-stone-500">Intensidade</span>
            <span className="font-semibold text-cafe-700">
              {valor}/{MAX}
            </span>
          </div>
        )}
        <div className="flex items-center gap-0.5">
          {NIVEIS.map((n) => (
            <span
              key={n}
              className={`h-2 w-2 rounded-full border ${
                n <= ativoAte
                  ? 'border-cafe-700 bg-cafe-700'
                  : 'border-stone-300 bg-transparent'
              }`}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="inline-flex flex-wrap items-center gap-1.5"
      title={titulo}
      aria-label={titulo}
    >
      {exibirRotulo && (
        <span className="text-xs font-medium text-stone-500">Intensidade:</span>
      )}

      {editavel && (
        <button
          type="button"
          onClick={() => onChange!(0)}
          title="Intensidade 0 (suave / sem intensidade)"
          className={`rounded px-1.5 py-0.5 text-[11px] font-semibold transition ${
            valor === 0
              ? 'bg-cafe-600 text-white'
              : 'border border-stone-300 bg-white text-stone-600 hover:bg-stone-100'
          }`}
        >
          0
        </button>
      )}

      <div
        className="inline-flex items-center gap-1"
        onMouseLeave={() => editavel && setHover(null)}
      >
        {NIVEIS.map((n) => {
          const cheia = n <= ativoAte;
          const cor = cheia
            ? 'bg-cafe-700 border-cafe-700'
            : 'bg-transparent border-stone-300';

          if (!editavel) {
            return (
              <span
                key={n}
                className={`inline-block h-3 w-3 rounded-full border ${cor}`}
              />
            );
          }

          return (
            <button
              key={n}
              type="button"
              onMouseEnter={() => setHover(n)}
              onClick={() => onChange!(n)}
              title={`Intensidade ${n} de ${MAX}`}
              aria-label={`Marcar intensidade ${n}`}
              className={`h-3.5 w-3.5 rounded-full border transition-transform hover:scale-125 ${cor}`}
            />
          );
        })}
      </div>

      <span className="text-xs font-medium text-stone-600">
        {valor !== null ? `${valor}/${MAX}` : 'Não informada'}
      </span>

      {editavel && valor !== null && (
        <button
          type="button"
          onClick={() => onChange!(null)}
          className="text-xs text-stone-400 hover:text-red-600"
        >
          Limpar
        </button>
      )}
    </div>
  );
}
