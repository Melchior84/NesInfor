import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';
import { useToast } from './Toast';

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: 'standard' | 'icon';
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              width?: number;
              locale?: string;
            },
          ) => void;
        };
      };
    };
  }
}

let cachedClientIdPromise: Promise<string | null> | null = null;
let gsiScriptPromise: Promise<void> | null = null;

function getGoogleClientId(): Promise<string | null> {
  if (!cachedClientIdPromise) {
    cachedClientIdPromise = api
      .authConfig()
      .then((c) => c.googleClientId)
      .catch(() => null);
  }
  return cachedClientIdPromise;
}

function loadGsiScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!gsiScriptPromise) {
    gsiScriptPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(
        'script[src="https://accounts.google.com/gsi/client"]',
      );
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('Falha ao carregar Google')), {
          once: true,
        });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Falha ao carregar Google'));
      document.head.appendChild(script);
    });
  }
  return gsiScriptPromise;
}

interface Props {
  texto?: 'signin_with' | 'signup_with' | 'continue_with';
  onSuccess: () => void;
  onPending: (mensagem: string, email: string) => void;
}

export default function GoogleButton({
  texto = 'continue_with',
  onSuccess,
  onPending,
}: Props) {
  const { entrarComGoogle } = useAuth();
  const toast = useToast();
  const [clientId, setClientId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const callbacksRef = useRef({ entrarComGoogle, toast, onSuccess, onPending });
  callbacksRef.current = { entrarComGoogle, toast, onSuccess, onPending };

  useEffect(() => {
    let ativo = true;
    getGoogleClientId().then((id) => {
      if (ativo) setClientId(id);
    });
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    if (!clientId || !containerRef.current) return;
    let cancelado = false;

    loadGsiScript()
      .then(() => {
        if (cancelado || !containerRef.current || !window.google?.accounts?.id) return;

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response) => {
            if (!response.credential) return;
            setCarregando(true);
            try {
              const res = await callbacksRef.current.entrarComGoogle(response.credential);
              if (res.entrou) {
                callbacksRef.current.onSuccess();
              } else {
                callbacksRef.current.onPending(res.mensagem, res.email);
              }
            } catch (err) {
              callbacksRef.current.toast.erro(err);
            } finally {
              setCarregando(false);
            }
          },
        });

        containerRef.current.innerHTML = '';
        const width = Math.min(Math.max(containerRef.current.offsetWidth || 320, 220), 400);
        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: texto,
          shape: 'rectangular',
          width,
          locale: 'pt-BR',
        });
      })
      .catch(() => {
        // Falha silenciosa caso o script do Google esteja bloqueado na rede
      });

    return () => {
      cancelado = true;
    };
  }, [clientId, texto]);

  if (!clientId) return null;

  return (
    <div className="space-y-3">
      <div className="relative flex items-center py-1">
        <div className="flex-grow border-t border-stone-200" />
        <span className="mx-3 flex-shrink text-xs text-stone-400">ou</span>
        <div className="flex-grow border-t border-stone-200" />
      </div>
      <div
        className={`flex justify-center transition-opacity ${
          carregando ? 'pointer-events-none opacity-60' : ''
        }`}
      >
        <div ref={containerRef} className="w-full flex justify-center" />
      </div>
      {carregando && (
        <p className="text-center text-xs text-stone-500">Autenticando com o Google…</p>
      )}
    </div>
  );
}
