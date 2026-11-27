import type {
  Capsula,
  CapsulaPublica,
  DadosPagamento,
  HistoricoPreco,
  MeuPainel,
  MeuPedido,
  NotificacoesFechamento,
  Painel,
  Participantes,
  Perfil,
  RankingCafezinhos,
  Rodada,
  ResumoCompra,
  SorteioRodada,
  StatusPagamento,
  StatusRodada,
  Tema,
  Usuario,
  UsuarioAdmin,
} from '../types';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';
const TOKEN_KEY = 'nesinfor.token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** Chamado quando a API responde 401 numa rota autenticada (token expirado/inválido). */
let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = tokenStore.get();
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Não foi possível conectar à API. O backend está no ar?', 0);
  }

  // Algumas rotas retornam corpo vazio (ex.: rodada ativa inexistente => null)
  const texto = await res.text();
  const dados = texto ? JSON.parse(texto) : null;

  if (!res.ok) {
    if (res.status === 401 && token && !path.startsWith('/auth/')) onUnauthorized();
    const msg = Array.isArray(dados?.message) ? dados.message.join(' ') : dados?.message;
    throw new ApiError(msg ?? `Erro ${res.status}`, res.status);
  }
  return dados as T;
}

const get = <T>(p: string) => request<T>('GET', p);
const post = <T>(p: string, b?: unknown) => request<T>('POST', p, b ?? {});
const put = <T>(p: string, b: unknown) => request<T>('PUT', p, b);
const patch = <T>(p: string, b: unknown) => request<T>('PATCH', p, b);

export const api = {
  // auth
  authConfig: () => get<{ googleClientId: string | null }>('/auth/config'),
  loginGoogle: (credential: string) =>
    post<
      | { token: string; usuario: Usuario; aguardandoAprovacao?: false }
      | { aguardandoAprovacao: true; mensagem: string; email: string }
    >('/auth/google', { credential }),
  login: (email: string, senha: string) =>
    post<{ token: string; usuario: Usuario }>('/auth/login', { email, senha }),
  register: (nome: string, email: string, senha: string) =>
    post<{ mensagem: string; email: string; aguardandoAprovacao?: boolean }>('/auth/register', {
      nome,
      email,
      senha,
    }),
  confirmarEmail: (token: string) =>
    post<{ mensagem: string }>('/auth/confirmar-email', { token }),
  reenviarConfirmacao: (email: string) =>
    post<{ mensagem: string }>('/auth/reenviar-confirmacao', { email }),
  esqueciSenha: (email: string) =>
    post<{ mensagem: string }>('/auth/esqueci-senha', { email }),
  redefinirSenha: (token: string, novaSenha: string) =>
    post<{ mensagem: string }>('/auth/redefinir-senha', { token, novaSenha }),
  trocarSenhaObrigatoria: (novaSenha: string) =>
    post<{ mensagem: string; usuario: Usuario }>('/auth/trocar-senha-obrigatoria', {
      novaSenha,
    }),
  me: () => get<Usuario>('/auth/me'),
  dadosPagamento: () => get<DadosPagamento>('/auth/dados-pagamento'),
  salvarDadosPagamento: (d: DadosPagamento) =>
    put<DadosPagamento>('/auth/dados-pagamento', d),
  salvarPreferenciasEmail: (receberEmailsCafe: boolean) =>
    put<{ receberEmailsCafe: boolean }>('/auth/preferencias-email', { receberEmailsCafe }),
  salvarTema: (tema: Tema) => put<{ tema: Tema }>('/auth/tema', { tema }),
  salvarNomeExibicao: (nomeExibicao: string) =>
    put<{ nomeExibicao: string }>('/auth/nome-exibicao', { nomeExibicao }),

  // cápsulas
  capsulasPublico: () => get<CapsulaPublica[]>('/capsulas/publico'),
  capsulas: (somenteAtivas = false) =>
    get<Capsula[]>(`/capsulas${somenteAtivas ? '?ativos=true' : ''}`),
  criarCapsula: (d: {
    nome: string;
    descricao?: string | null;
    imagemUrl?: string | null;
    intensidade?: number | null;
    precoAtual: number;
    tamanhoCaixa?: number;
  }) => post<Capsula>('/capsulas', d),
  atualizarCapsula: (
    id: number,
    d: {
      nome?: string;
      descricao?: string | null;
      imagemUrl?: string | null;
      intensidade?: number | null;
      precoAtual?: number;
      tamanhoCaixa?: number;
    },
  ) => put<Capsula>(`/capsulas/${id}`, d),
  uploadImagemCapsula: async (arquivo: File): Promise<{ imagemUrl: string }> => {
    const token = tokenStore.get();
    const form = new FormData();
    form.append('imagem', arquivo);
    let res: Response;
    try {
      res = await fetch(`${BASE}/capsulas/upload-imagem`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });
    } catch {
      throw new ApiError('Não foi possível conectar à API.', 0);
    }
    const texto = await res.text();
    const dados = texto ? JSON.parse(texto) : null;
    if (!res.ok) {
      if (res.status === 401 && token) onUnauthorized();
      const msg = Array.isArray(dados?.message) ? dados.message.join(' ') : dados?.message;
      throw new ApiError(msg ?? `Erro ${res.status}`, res.status);
    }
    return dados as { imagemUrl: string };
  },
  ativarCapsula: (id: number, ativo: boolean) =>
    patch<Capsula>(`/capsulas/${id}/ativo`, { ativo }),
  historicoPrecos: (id: number) => get<HistoricoPreco[]>(`/capsulas/${id}/historico-precos`),

  // usuários (ADMIN)
  usuarios: () => get<UsuarioAdmin[]>('/usuarios'),
  dominiosAprovados: () => get<{ dominios: string[] }>('/usuarios/dominios-aprovados'),
  salvarDominiosAprovados: (dominios: string[]) =>
    put<{ dominios: string[] }>('/usuarios/dominios-aprovados', { dominios }),
  aprovarUsuario: (id: number) => post<UsuarioAdmin>(`/usuarios/${id}/aprovar`),
  recusarUsuario: (id: number) =>
    request<{ mensagem: string }>('DELETE', `/usuarios/${id}/recusar`),
  atualizarUsuario: (id: number, d: { perfil?: Perfil; ativo?: boolean }) =>
    patch<UsuarioAdmin>(`/usuarios/${id}`, d),
  resetarSenhaUsuario: (id: number) =>
    post<{ mensagem: string; usuarioId: number; email: string; senhaTemporaria: string }>(
      `/usuarios/${id}/resetar-senha`,
    ),

  // rodadas
  rodadas: () => get<Rodada[]>('/rodadas'),
  rodadaAtiva: () => get<Rodada | null>('/rodadas/ativa'),
  rankingCafezinhos: (ano?: number) =>
    get<RankingCafezinhos>(
      ano ? `/rodadas/ranking-cafezinhos?ano=${encodeURIComponent(ano)}` : '/rodadas/ranking-cafezinhos',
    ),
  meuPainel: (ano?: number) =>
    get<MeuPainel>(
      ano ? `/rodadas/meu-painel?ano=${encodeURIComponent(ano)}` : '/rodadas/meu-painel',
    ),
  solicitarAberturaRodada: () =>
    post<{ solicitado: boolean; criadoEm: string }>('/rodadas/solicitar-abertura'),
  cancelarSolicitacaoAbertura: () =>
    request<{ solicitado: boolean }>('DELETE', '/rodadas/solicitar-abertura'),
  rodada: (id: number) => get<Rodada>(`/rodadas/${id}`),
  criarRodada: (titulo: string, assumirOrganizacao: boolean, organizadorId?: number | null) =>
    post<Rodada & { notificacoes?: { enviados: number; falhas: number } }>('/rodadas', {
      titulo,
      assumirOrganizacao,
      ...(organizadorId ? { organizadorId } : {}),
    }),
  assumirRodada: (id: number) => post<Rodada>(`/rodadas/${id}/assumir`),
  definirOrganizador: (id: number, organizadorId: number | null) =>
    patch<Rodada>(`/rodadas/${id}/organizador`, { organizadorId }),
  mudarStatus: (id: number, status: StatusRodada) =>
    patch<Rodada & { notificacoes?: NotificacoesFechamento }>(`/rodadas/${id}/status`, {
      status,
    }),
  painel: (id: number) => get<Painel>(`/rodadas/${id}/painel-caixas`),
  resumoCompra: (id: number) => get<ResumoCompra>(`/rodadas/${id}/resumo-compra`),
  participantes: (id: number) => get<Participantes>(`/rodadas/${id}/participantes`),
  alterarPagamento: (id: number, solicitacaoId: number, status: StatusPagamento) =>
    patch(`/rodadas/${id}/participantes/${solicitacaoId}/pagamento`, { status }),

  // meu pedido
  meuPedido: (id: number) => get<MeuPedido>(`/rodadas/${id}/meu-pedido`),
  definirQuantidade: (id: number, capsulaId: number, quantidade: number) =>
    put<MeuPedido>(`/rodadas/${id}/meu-pedido/itens/${capsulaId}`, { quantidade }),
  removerItem: (id: number, capsulaId: number) =>
    request<MeuPedido>('DELETE', `/rodadas/${id}/meu-pedido/itens/${capsulaId}`),
  definirGorjeta: (id: number, cafezinhos: number) =>
    put<MeuPedido>(`/rodadas/${id}/meu-pedido/gorjeta`, { cafezinhos }),

  // brindes / sorteio
  brindes: (rodadaId: number) => get<SorteioRodada>(`/rodadas/${rodadaId}/brindes`),
  definirSorteador: (rodadaId: number, sorteadorId: number | null) =>
    patch<SorteioRodada>(`/rodadas/${rodadaId}/sorteador`, { sorteadorId }),
  criarBrinde: (rodadaId: number, nome: string, descricao?: string) =>
    post<SorteioRodada>(`/rodadas/${rodadaId}/brindes`, { nome, descricao }),
  removerBrinde: (rodadaId: number, brindeId: number) =>
    request<SorteioRodada>('DELETE', `/rodadas/${rodadaId}/brindes/${brindeId}`),
  participacaoBrinde: (rodadaId: number, brindeId: number, participar: boolean) =>
    put<SorteioRodada>(`/rodadas/${rodadaId}/brindes/${brindeId}/participacao`, { participar }),
  participacaoBrindeUsuario: (
    rodadaId: number,
    brindeId: number,
    usuarioId: number,
    participar: boolean,
  ) =>
    put<SorteioRodada>(
      `/rodadas/${rodadaId}/brindes/${brindeId}/participantes/${usuarioId}`,
      { participar },
    ),
  sortearBrinde: (rodadaId: number, brindeId: number) =>
    post<SorteioRodada>(`/rodadas/${rodadaId}/brindes/${brindeId}/sortear`),
};
