export type Perfil = 'ADMIN' | 'USUARIO';
export type Tema = 'claro' | 'escuro';
export type StatusRodada = 'ABERTO' | 'FECHADO' | 'COMPRADO' | 'ENTREGUE' | 'CANCELADO';
export type StatusPagamento = 'PENDENTE' | 'PAGO';
export type StatusSabor = 'FECHADA' | 'COM_SOBRA' | 'AGUARDANDO_COMPLETAR';

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  perfil: Perfil;
  deveTrocarSenha: boolean;
  tema?: Tema;
}

export interface UsuarioAdmin extends Usuario {
  ativo: boolean;
  emailVerificado: boolean;
  aprovado: boolean;
  receberEmailsCafe?: boolean;
  criadoEm: string;
}

export interface CapsulaPublica {
  id: number;
  nome: string;
  descricao: string | null;
  imagemUrl: string | null;
  intensidade: number | null;
  tamanhoCaixa: number;
}

export interface Capsula {
  id: number;
  nome: string;
  descricao: string | null;
  imagemUrl: string | null;
  intensidade: number | null;
  precoAtual: number;
  tamanhoCaixa: number;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface HistoricoPreco {
  id: number;
  preco: number;
  dataVigencia: string;
  alteradoPorId: number | null;
  alteradoPorNome: string | null;
}

export interface DadosPagamento {
  pixChave: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
}

export interface NotificacoesFechamento {
  participantesEnviados: number;
  organizadorEnviado: boolean;
  falhas: number;
}

export interface Rodada {
  id: number;
  titulo: string;
  organizadorId: number | null;
  organizadorNome: string | null;
  status: StatusRodada;
  dataAbertura: string;
  dataFechamento: string | null;
}

export interface ParticipanteSabor {
  usuarioId: number;
  nome: string;
  quantidade: number;
  quantidadeEmCaixa: number;
  quantidadeAguardando: number;
}

export interface SaborPainel {
  capsulaId: number;
  nome: string;
  tamanhoCaixa: number;
  totalSolicitado: number;
  caixasFechadas: number;
  capsulasEmCaixas: number;
  sobra: number;
  progressoAtual: number;
  faltamProximaCaixa: number;
  status: StatusSabor;
  valorSolicitado: number;
  valorFechado: number;
  participantes: ParticipanteSabor[];
}

export interface ResumoColetivo {
  totalCapsulasSolicitadas: number;
  totalCapsulasEmCaixas: number;
  totalCaixasFechadas: number;
  saboresAguardando: number;
  valorSolicitado: number;
  valorCompraNespresso: number;
}

export interface Painel {
  rodada: Rodada;
  sabores: SaborPainel[];
  resumo: ResumoColetivo;
}

export interface ResumoCompra {
  rodada: Rodada;
  itens: {
    capsulaId: number;
    nome: string;
    caixas: number;
    capsulas: number;
    tamanhoCaixa: number;
    valor: number;
  }[];
  totalCaixas: number;
  totalCapsulas: number;
  valorTotal: number;
  aguardando: { nome: string; sobra: number; faltam: number }[];
}

export interface ParticipanteRodada {
  solicitacaoId: number;
  usuarioId: number;
  nome: string;
  email: string;
  statusPagamento: StatusPagamento;
  dataPagamento: string | null;
  cafezinhosGorjeta: number;
  valorGorjeta: number;
  totalCapsulas: number;
  capsulasEmCaixas: number;
  totalSolicitado: number;
  totalEmCaixasFechadas: number;
  valorAPagar: number;
}

export interface Participantes {
  rodada: Rodada;
  participantes: ParticipanteRodada[];
  resumo: ResumoColetivo;
  totalCafezinhosGorjeta: number;
  totalValorGorjeta: number;
}

export interface ItemPedido {
  itemId: number;
  capsulaId: number;
  nome: string;
  tamanhoCaixa: number;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
  quantidadeEmCaixa: number;
  quantidadeAguardando: number;
}

export interface PagamentoOrganizador {
  organizadorNome: string;
  pixChave: string | null;
  isPixCopiaCola: boolean;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
}

export interface MeuPedido {
  rodada: Rodada;
  solicitacaoId: number | null;
  statusPagamento: StatusPagamento;
  dataPagamento: string | null;
  podeEditar: boolean;
  itens: ItemPedido[];
  totalCapsulas: number;
  totalSolicitado: number;
  totalEmCaixasFechadas: number;
  cafezinhosGorjeta: number;
  valorGorjeta: number;
  valorPorCafezinho: number;
  gorjetaContabilizada: boolean;
  valorTotalAPagar: number;
  pagamentoOrganizador: PagamentoOrganizador | null;
}

export interface ParticipanteSorteio {
  usuarioId: number;
  nome: string;
}

export interface BrindeRodada {
  id: number;
  rodadaId: number;
  nome: string;
  descricao: string | null;
  sorteado: boolean;
  vencedorId: number | null;
  vencedorNome: string | null;
  sorteadoPorId: number | null;
  sorteadoPorNome: string | null;
  sorteadoEm: string | null;
  seedPublica: string | null;
  hashAuditoria: string | null;
  indiceSorteado: number | null;
  concorrentes: ParticipanteSorteio[];
  desistentes: ParticipanteSorteio[];
  jaPremiados: ParticipanteSorteio[];
  euParticipando: boolean;
  euDesisti: boolean;
}

export interface SorteioRodada {
  rodadaId: number;
  organizadorId: number | null;
  organizadorNome: string | null;
  sorteadorId: number | null;
  sorteadorNome: string | null;
  encarregadoNome: string | null;
  podeGerenciarSorteio: boolean;
  podeDefinirSorteador: boolean;
  euElegivel: boolean;
  euJaPremiado: boolean;
  elegiveisRodada: ParticipanteSorteio[];
  usuariosDisponiveis: { id: number; nome: string }[];
  brindes: BrindeRodada[];
}

export interface ItemRankingCafezinho {
  posicao: number;
  usuarioId: number;
  nome: string;
  totalCafezinhos: number;
  rodadasApoiadas: number;
}

export interface RankingCafezinhos {
  ano: number;
  anosDisponiveis: number[];
  totalCafezinhosAno: number;
  totalDoadores: number;
  ranking: ItemRankingCafezinho[];
}

export interface SaborResumoPainel {
  capsulaId: number;
  nome: string;
  quantidade: number;
  imagemUrl: string | null;
  descricao: string | null;
  intensidade: number | null;
}

export interface MeuPainel {
  ano: number;
  anosDisponiveis: number[];
  receberEmailsCafe: boolean;
  solicitacaoAbertura: {
    existeRodadaAtiva: boolean;
    euSolicitei: boolean;
    minhaSolicitacaoEm: string | null;
    totalSolicitacoes: number;
    solicitantes: {
      usuarioId: number;
      nome: string;
      criadoEm: string;
    }[];
  };
  totalPedidosAno: number;
  totalCapsulasConsumidasAno: number;
  totalCapsulasSolicitadasAno: number;
  valorInvestidoAno: number;
  mediaCapsulasPorPedido: number;
  cafezinhosDoadosAno: number;
  posicaoRanking: number | null;
  rankingConsumo: {
    posicao: number | null;
    totalParticipantes: number;
    totalCapsulasSolicitadas: number;
  };
  sorteios: {
    jaFoiSorteado: boolean;
    vezesTotal: number;
    vezesNoAno: number;
    ultimoSorteio: {
      brindeNome: string;
      rodadaId: number;
      rodadaTitulo: string;
      sorteadoEm: string;
    } | null;
  };
  saborPreferido: SaborResumoPainel | null;
  topSabores: SaborResumoPainel[];
  saborNovidade: {
    capsulaId: number;
    nome: string;
    descricao: string | null;
    imagemUrl: string | null;
    intensidade: number | null;
    precoAtual: number;
    criadoEm: string;
    jaExperimentou: boolean;
  } | null;
  variedade: {
    saboresProvados: number;
    totalSaboresAtivos: number;
  };
  intensidadeMedia: number | null;
  ultimasRodadas: {
    rodadaId: number;
    titulo: string;
    status: StatusRodada;
    statusPagamento: StatusPagamento;
    dataAbertura: string;
    capsulasConfirmadas: number;
    capsulasSolicitadas: number;
    valorAPagar: number;
  }[];
}
