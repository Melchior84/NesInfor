import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../components/Toast';
import { api } from '../lib/api';

export default function Register() {
  const { registrar } = useAuth();
  const toast = useToast();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [cadastrado, setCadastrado] = useState<{
    email: string;
    mensagem: string;
  } | null>(null);
  const [reenviando, setReenviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      const r = await registrar(nome, email, senha);
      setCadastrado({ email: r.email, mensagem: r.mensagem });
      toast.ok('Cadastro realizado!');
    } catch (err) {
      toast.erro(err);
    } finally {
      setEnviando(false);
    }
  }

  async function reenviar() {
    if (!cadastrado) return;
    setReenviando(true);
    try {
      const r = await api.reenviarConfirmacao(cadastrado.email);
      toast.ok(r.mensagem);
    } catch (err) {
      toast.erro(err);
    } finally {
      setReenviando(false);
    }
  }

  if (cadastrado) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="card w-full max-w-sm space-y-4 p-6 text-center">
          <div className="text-4xl">✉️</div>
          <h1 className="text-xl font-bold text-cafe-700">Confirme seu e-mail</h1>
          <p className="text-sm text-stone-600">{cadastrado.mensagem}</p>
          <p className="text-xs text-stone-500">
            E-mail cadastrado: <strong>{cadastrado.email}</strong>
          </p>
          <button className="btn-secondary w-full" disabled={reenviando} onClick={reenviar}>
            {reenviando ? 'Reenviando…' : 'Reenviar e-mail de confirmação'}
          </button>
          <Link to="/login" className="btn-primary w-full">
            Ir para o login
          </Link>
        </div>
        <p className="mt-6 text-xs text-stone-400">
          Desenvolvido por <span className="font-semibold text-cafe-700">Studios Melk</span>
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <form onSubmit={enviar} className="card w-full max-w-sm space-y-4 p-6">
        <div className="text-center">
          <div className="text-4xl">☕</div>
          <h1 className="text-xl font-bold text-cafe-700">Criar conta</h1>
        </div>
        <div>
          <label className="label" htmlFor="nome">Nome</label>
          <input id="nome" required minLength={2} autoFocus className="input"
            value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="email">E-mail</label>
          <input id="email" type="email" required className="input"
            value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="senha">Senha (mín. 8 caracteres)</label>
          <input id="senha" type="password" required minLength={8} className="input"
            value={senha} onChange={(e) => setSenha(e.target.value)} />
        </div>
        <button className="btn-primary w-full" disabled={enviando}>
          {enviando ? 'Criando…' : 'Criar conta'}
        </button>
        <p className="text-center text-sm text-stone-500">
          Já tem conta?{' '}
          <Link to="/login" className="font-medium text-cafe-600 hover:underline">Entrar</Link>
        </p>
      </form>
      <p className="mt-6 text-xs text-stone-400">
        Desenvolvido por <span className="font-semibold text-cafe-700">Studios Melk</span>
      </p>
    </div>
  );
}
