import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../components/Toast';
import { api } from '../lib/api';

export default function TrocarSenhaObrigatoria() {
  const { usuario, atualizarUsuario, sair } = useAuth();
  const toast = useToast();
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (novaSenha !== confirmar) {
      return toast.erro('As senhas não coincidem.');
    }
    setEnviando(true);
    try {
      const r = await api.trocarSenhaObrigatoria(novaSenha);
      toast.ok(r.mensagem);
      atualizarUsuario(r.usuario);
    } catch (err) {
      toast.erro(err);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={enviar} className="card w-full max-w-sm space-y-4 p-6">
        <div className="text-center">
          <div className="text-4xl">🔐</div>
          <h1 className="text-xl font-bold text-cafe-700">Cadastre uma nova senha</h1>
          <p className="mt-1 text-sm text-stone-500">
            Olá, <strong>{usuario?.nome}</strong>! Sua senha foi zerada por um administrador.
            Defina uma nova senha para continuar usando o Cafezinho Infor.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="nova">Nova senha (mín. 8 caracteres)</label>
          <input id="nova" type="password" required minLength={8} autoFocus className="input"
            value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="conf">Confirmar nova senha</label>
          <input id="conf" type="password" required minLength={8} className="input"
            value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />
        </div>
        <button className="btn-primary w-full" disabled={enviando}>
          {enviando ? 'Salvando…' : 'Salvar e continuar'}
        </button>
        <button type="button" className="btn-secondary w-full" onClick={sair}>
          Sair
        </button>
      </form>
    </div>
  );
}
