import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

interface Toast {
  id: number;
  tipo: 'ok' | 'erro';
  texto: string;
}

interface ToastCtx {
  ok: (texto: string) => void;
  erro: (e: unknown) => void;
}

const Ctx = createContext<ToastCtx | null>(null);
let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((tipo: Toast['tipo'], texto: string) => {
    const id = ++seq;
    setToasts((t) => [...t, { id, tipo, texto }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  const value: ToastCtx = {
    ok: (t) => push('ok', t),
    erro: (e) => push('erro', e instanceof Error ? e.message : String(e)),
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="fixed right-4 bottom-4 z-50 flex max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`rounded-lg px-4 py-3 text-sm shadow-lg ${
              t.tipo === 'ok' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
            }`}
          >
            {t.texto}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast fora do ToastProvider');
  return ctx;
}
