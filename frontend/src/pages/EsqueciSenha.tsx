import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { api } from '../lib/api';

export default function EsqueciSenha() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      const r = await api.esqueciSenha(email);
      setEnviado(true);
      toast.ok(r.mensagem);
    } catch (err) {
      toast.erro(err);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm space-y-4 p-6">
        <div className="text-center">
          <div className="text-4xl">🔑</div>
          <h1 className="text-xl font-bold text-cafe-700">Recuperar senha</h1>
          <p className="text-sm text-stone-500">
            Informe seu e-mail para receber o link de redefinição.
          </p>
        </div>

        {enviado ? (
          <div className="space-y-4 text-center">
            <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
              Se o e-mail estiver cadastrado, enviamos um link para redefinir sua senha (válido por 1 hora).
            </p>
            <Link to="/login" className="btn-primary w-full">
              Voltar para o login
            </Link>
          </div>
        ) : (
          <form onSubmit={enviar} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">E-mail</label>
              <input id="email" type="email" required autoFocus className="input"
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button className="btn-primary w-full" disabled={enviando}>
              {enviando ? 'Enviando…' : 'Enviar link de recuperação'}
            </button>
            <p className="text-center text-sm text-stone-500">
              Lembrou a senha?{' '}
              <Link to="/login" className="font-medium text-cafe-600 hover:underline">Entrar</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
