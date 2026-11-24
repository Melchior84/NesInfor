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
import type { Tema, Usuario } from '../types';

const TEMA_KEY = 'nesinfor.tema';

function lerTemaInicial(): Tema {
  return localStorage.getItem(TEMA_KEY) === 'escuro' ? 'escuro' : 'claro';
}

interface AuthCtx {
  usuario: Usuario | null;
  carregando: boolean;
  tema: Tema;
  alternarTema: () => Promise<void>;
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
  const [tema, setTema] = useState<Tema>(lerTemaInicial);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'escuro');
    localStorage.setItem(TEMA_KEY, tema);
  }, [tema]);

  const aplicarUsuario = useCallback((u: Usuario | null) => {
    setUsuario(u);
    if (u?.tema) {
      setTema(u.tema);
    }
  }, []);

  const alternarTema = useCallback(async () => {
    const novo: Tema = tema === 'escuro' ? 'claro' : 'escuro';
    setTema(novo);
    if (usuario) {
      setUsuario({ ...usuario, tema: novo });
      try {
        await api.salvarTema(novo);
      } catch {
        // Mantem preferencia local caso ocorra erro transitorio de rede
      }
    }
  }, [tema, usuario]);

  const sair = useCallback(() => {
    tokenStore.clear();
    setUsuario(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(sair);
    if (!tokenStore.get()) return;
    api
      .me()
      .then(aplicarUsuario)
      .catch(() => tokenStore.clear())
      .finally(() => setCarregando(false));
  }, [sair, aplicarUsuario]);

  const value = useMemo<AuthCtx>(
    () => ({
      usuario,
      carregando,
      tema,
      alternarTema,
      sair,
      atualizarUsuario: aplicarUsuario,
      login: async (email, senha) => {
        const r = await api.login(email, senha);
        tokenStore.set(r.token);
        aplicarUsuario(r.usuario);
      },
      entrarComGoogle: async (credential) => {
        const r = await api.loginGoogle(credential);
        if ('token' in r) {
          tokenStore.set(r.token);
          aplicarUsuario(r.usuario);
          return { entrou: true };
        }
        return { entrou: false, mensagem: r.mensagem, email: r.email };
      },
      registrar: (nome, email, senha) => api.register(nome, email, senha),
    }),
    [usuario, carregando, tema, alternarTema, sair, aplicarUsuario],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}
