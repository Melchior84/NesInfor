import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import Layout from './components/Layout';
import AdminCapsulas from './pages/AdminCapsulas';
import AdminUsuarios from './pages/AdminUsuarios';
import ConfirmarEmail from './pages/ConfirmarEmail';
import Dashboard from './pages/Dashboard';
import EsqueciSenha from './pages/EsqueciSenha';
import Historico from './pages/Historico';
import Home from './pages/Home';
import Login from './pages/Login';
import PainelUsuario from './pages/PainelUsuario';
import RankingCafezinhos from './pages/RankingCafezinhos';
import RedefinirSenha from './pages/RedefinirSenha';
import Register from './pages/Register';
import TrocarSenhaObrigatoria from './pages/TrocarSenhaObrigatoria';

export default function App() {
  const { usuario, carregando } = useAuth();

  if (carregando) {
    return <p className="p-8 text-center text-stone-500">Carregando…</p>;
  }

  if (!usuario) {
    return (
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Register />} />
        <Route path="/confirmar-email" element={<ConfirmarEmail />} />
        <Route path="/esqueci-senha" element={<EsqueciSenha />} />
        <Route path="/redefinir-senha" element={<RedefinirSenha />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  if (usuario.deveTrocarSenha) {
    return (
      <Routes>
        <Route path="*" element={<TrocarSenhaObrigatoria />} />
      </Routes>
    );
  }

  const admin = usuario.perfil === 'ADMIN';
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="painel" element={<PainelUsuario />} />
        <Route path="rodadas" element={<Historico />} />
        <Route path="rodadas/:id" element={<Dashboard />} />
        <Route path="ranking" element={<RankingCafezinhos />} />
        {admin && <Route path="admin/capsulas" element={<AdminCapsulas />} />}
        {admin && <Route path="admin/usuarios" element={<AdminUsuarios />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
