import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const link = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-1.5 text-sm font-medium ${
    isActive ? 'bg-cafe-100 text-cafe-700' : 'text-stone-600 hover:bg-stone-100'
  }`;

export default function Layout() {
  const { usuario, sair, tema, alternarTema } = useAuth();
  const admin = usuario?.perfil === 'ADMIN';

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <span className="mr-2 text-lg font-bold text-cafe-700">☕ Cafezinho Infor</span>
          <nav className="flex flex-wrap gap-1">
            <NavLink to="/" end className={link}>
              Rodada ativa
            </NavLink>
            <NavLink to="/painel" className={link}>
              Painel
            </NavLink>
            <NavLink to="/rodadas" end className={link}>
              Histórico
            </NavLink>
            <NavLink to="/ranking" className={link}>
              🏆 Ranking
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
          <div className="ml-auto flex items-center gap-2 sm:gap-3 text-sm">
            <button
              type="button"
              onClick={() => void alternarTema()}
              className="btn-secondary btn-sm"
              title={
                tema === 'escuro'
                  ? 'Alternar para tema claro'
                  : 'Alternar para tema escuro'
              }
              aria-label="Alternar tema claro e escuro"
            >
              {tema === 'escuro' ? '☀️ Claro' : '🌙 Escuro'}
            </button>
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
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <footer className="border-t border-stone-200 bg-white py-3 text-center text-xs text-stone-400">
        Cafezinho Infor · Desenvolvido por{' '}
        <span className="font-semibold text-cafe-700">Studios Melk</span>
      </footer>
    </div>
  );
}
