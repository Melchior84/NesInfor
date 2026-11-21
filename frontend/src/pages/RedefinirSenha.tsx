import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { api } from '../lib/api';

export default function RedefinirSenha() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const toast = useToast();
  const navigate = useNavigate();
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
      const r = await api.redefinirSenha(token, novaSenha);
      toast.ok(r.mensagem);
      navigate('/login');
    } catch (err) {
      toast.erro(err);
    } finally {
      setEnviando(false);
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="card w-full max-w-sm space-y-4 p-6 text-center">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-xl font-bold text-cafe-700">Link inválido</h1>
          <p className="text-sm text-stone-600">
            O link de recuperação está incompleto ou inválido. Solicite uma nova recuperação.
          </p>
          <Link to="/esqueci-senha" className="btn-primary w-full">
            Solicitar novamente
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={enviar} className="card w-full max-w-sm space-y-4 p-6">
        <div className="text-center">
          <div className="text-4xl">🔒</div>
          <h1 className="text-xl font-bold text-cafe-700">Definir nova senha</h1>
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
          {enviando ? 'Salvando…' : 'Salvar nova senha'}
        </button>
      </form>
    </div>
  );
}
