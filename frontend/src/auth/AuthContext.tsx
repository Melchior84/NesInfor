import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, setUnauthorizedHandler, tokenStore } from '../lib/api';
import type { Usuario } from '../types';

interface AuthCtx {
  usuario: Usuario | null;
  carregando: boolean;
  login: (email: string, senha: string) => Promise<void>;
  entrarComGoogle: (
    credential: string,
  ) => Promise<{ entrou: true } | { entrou: false; mensagem: string; email: string }>;
  registrar: (nome: string, email: string, senha: string) => Promise<{ mensagem: string; email: string }>;
  atualizarUsuario: (u: Usuario) => void;
  sair: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(!!tokenStore.get());

  const sair = useCallback(() => {
    tokenStore.clear();
    setUsuario(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(sair);
    if (!tokenStore.get()) return;
    api
      .me()
      .then(setUsuario)
      .catch(() => tokenStore.clear())
      .finally(() => setCarregando(false));
  }, [sair]);

  const value = useMemo<AuthCtx>(
    () => ({
      usuario,
      carregando,
      sair,
      atualizarUsuario: setUsuario,
      login: async (email, senha) => {
        const r = await api.login(email, senha);
        tokenStore.set(r.token);
        setUsuario(r.usuario);
      },
      entrarComGoogle: async (credential) => {
        const r = await api.loginGoogle(credential);
        if ('token' in r) {
          tokenStore.set(r.token);
          setUsuario(r.usuario);
          return { entrou: true };
        }
        return { entrou: false, mensagem: r.mensagem, email: r.email };
      },
      registrar: (nome, email, senha) => api.register(nome, email, senha),
    }),
    [usuario, carregando, sair],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}
