import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const link = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-1.5 text-sm font-medium ${
    isActive ? 'bg-cafe-100 text-cafe-700' : 'text-stone-600 hover:bg-stone-100'
  }`;

export default function Layout() {
  const { usuario, sair } = useAuth();
  const admin = usuario?.perfil === 'ADMIN';

  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <span className="mr-2 text-lg font-bold text-cafe-700">☕ NesInfor</span>
          <nav className="flex flex-wrap gap-1">
            <NavLink to="/" end className={link}>
              Rodada ativa
            </NavLink>
            <NavLink to="/rodadas" end className={link}>
              Histórico
            </NavLink>
            {admin && (
              <>
                <NavLink to="/admin/capsulas" className={link}>
                  Cápsulas
                </NavLink>
                <NavLink to="/admin/usuarios" className={link}>
                  Usuários
                </NavLink>
              </>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-stone-600">
              {usuario?.nome}
              {admin && (
                <span className="ml-2 rounded bg-cafe-100 px-1.5 py-0.5 text-xs font-semibold text-cafe-700">
                  ADMIN
                </span>
              )}
            </span>
            <button onClick={sair} className="btn-secondary btn-sm">
              Sair
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
