export type Perfil = 'ADMIN' | 'USUARIO';

export interface UsuarioAutenticado {
  id: number;
  nome: string;
  email: string;
  perfil: Perfil;
  deveTrocarSenha: boolean;
}
