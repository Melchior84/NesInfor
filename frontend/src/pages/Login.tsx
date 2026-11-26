import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import GoogleButton from '../components/GoogleButton';
import { useToast } from '../components/Toast';
import { api, ApiError } from '../lib/api';

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [emailNaoConfirmado, setEmailNaoConfirmado] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [avisoPendente, setAvisoPendente] = useState<string | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setEmailNaoConfirmado(false);
    setAvisoPendente(null);
    try {
      await login(email, senha);
      navigate('/');
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.status === 403 &&
        err.message.toLowerCase().includes('confirmado')
      ) {
        setEmailNaoConfirmado(true);
      }
      toast.erro(err);
    } finally {
      setEnviando(false);
    }
  }

  async function reenviar() {
    if (!email) return;
    setReenviando(true);
    try {
      const r = await api.reenviarConfirmacao(email);
      toast.ok(r.mensagem);
    } catch (err) {
      toast.erro(err);
    } finally {
      setReenviando(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <form onSubmit={enviar} className="card w-full max-w-sm space-y-4 p-6">
        <div className="text-center">
          <div className="text-4xl">☕</div>
          <h1 className="text-xl font-bold text-cafe-700">Cafezinho Infor</h1>
          <p className="text-sm text-stone-500">Pedidos coletivos Nespresso</p>
        </div>
        <div>
          <label className="label" htmlFor="email">E-mail</label>
          <input id="email" type="email" required autoFocus className="input"
            value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="label" htmlFor="senha">Senha</label>
            <Link to="/esqueci-senha" className="mb-1 text-xs font-medium text-cafe-600 hover:underline">
              Esqueci minha senha
            </Link>
          </div>
          <input id="senha" type="password" required className="input"
            value={senha} onChange={(e) => setSenha(e.target.value)} />
        </div>

        {emailNaoConfirmado && (
          <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 space-y-2">
            <p>Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada ou solicite um novo link.</p>
            <button type="button" className="btn-secondary btn-sm w-full" disabled={reenviando} onClick={reenviar}>
              {reenviando ? 'Reenviando…' : 'Reenviar e-mail de confirmação'}
            </button>
          </div>
        )}

        {avisoPendente && (
          <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            {avisoPendente}
          </div>
        )}

        <button className="btn-primary w-full" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>

        <GoogleButton
          texto="continue_with"
          onSuccess={() => navigate('/')}
          onPending={(mensagem) => {
            setAvisoPendente(mensagem);
            toast.ok('Conta criada! Aguardando aprovação.');
          }}
        />

        <p className="text-center text-sm text-stone-500">
          Não tem conta?{' '}
          <Link to="/cadastro" className="font-medium text-cafe-600 hover:underline">
            Cadastre-se
          </Link>
        </p>
        <p className="text-center text-xs text-stone-400">
          <Link to="/" className="hover:text-cafe-600 hover:underline">
            ← Voltar à página inicial
          </Link>
        </p>
      </form>
      <p className="mt-6 text-xs text-stone-400">
        Desenvolvido por <span className="font-semibold text-cafe-700">Studios Melk</span>
      </p>
    </div>
  );
}
