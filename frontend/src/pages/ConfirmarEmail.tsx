import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';

export default function ConfirmarEmail() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [estado, setEstado] = useState<'carregando' | 'ok' | 'erro'>(
    token ? 'carregando' : 'erro',
  );
  const [mensagem, setMensagem] = useState(
    token ? '' : 'Link de confirmação inválido (token ausente).',
  );
  const chamado = useRef(false);

  useEffect(() => {
    if (!token || chamado.current) return;
    chamado.current = true;
    api
      .confirmarEmail(token)
      .then((r) => {
        setEstado('ok');
        setMensagem(r.mensagem);
      })
      .catch((e) => {
        setEstado('erro');
        setMensagem(e instanceof Error ? e.message : String(e));
      });
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm space-y-4 p-6 text-center">
        <div className="text-4xl">
          {estado === 'carregando' ? '⏳' : estado === 'ok' ? '✅' : '⚠️'}
        </div>
        <h1 className="text-xl font-bold text-cafe-700">Confirmação de e-mail</h1>
        {estado === 'carregando' ? (
          <p className="text-sm text-stone-500">Validando seu link…</p>
        ) : (
          <p className={`text-sm ${estado === 'ok' ? 'text-emerald-700' : 'text-red-700'}`}>
            {mensagem}
          </p>
        )}
        <Link to="/login" className="btn-primary w-full">
          Ir para o login
        </Link>
      </div>
    </div>
  );
}
