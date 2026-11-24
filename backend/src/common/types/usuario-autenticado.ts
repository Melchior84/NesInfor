export type Perfil = 'ADMIN' | 'USUARIO';
export type Tema = 'claro' | 'escuro';

export interface UsuarioAutenticado {
  id: number;
  nome: string;
  email: string;
  perfil: Perfil;
  deveTrocarSenha: boolean;
  tema: Tema;
}
