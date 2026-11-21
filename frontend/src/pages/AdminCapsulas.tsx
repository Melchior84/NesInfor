import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useToast } from '../components/Toast';
import { api } from '../lib/api';
import { dataHora, moeda } from '../lib/format';
import type { Capsula, HistoricoPreco } from '../types';

interface Form {
  id: number | null;
  nome: string;
  descricao: string;
  imagemUrl: string;
  preco: string;
  tamanho: string;
}
const NOVO: Form = { id: null, nome: '', descricao: '', imagemUrl: '', preco: '', tamanho: '50' };

export default function AdminCapsulas() {
  const toast = useToast();
  const [lista, setLista] = useState<Capsula[] | null>(null);
  const [form, setForm] = useState<Form>(NOVO);
  const [salvando, setSalvando] = useState(false);
  const [enviandoImg, setEnviandoImg] = useState(false);
  const [hist, setHist] = useState<{ capsula: Capsula; itens: HistoricoPreco[] } | null>(null);

  const carregar = useCallback(
    () => api.capsulas().then(setLista).catch(toast.erro),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useEffect(() => void carregar(), [carregar]);

  async function onSelecionarArquivo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setEnviandoImg(true);
    try {
      const r = await api.uploadImagemCapsula(file);
      setForm((f) => ({ ...f, imagemUrl: r.imagemUrl }));
      toast.ok('Imagem enviada!');
    } catch (err) {
      toast.erro(err);
    } finally {
      setEnviandoImg(false);
    }
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const preco = Number(form.preco.replace(',', '.'));
    const tamanho = Math.floor(Number(form.tamanho));
    if (!(preco > 0)) return toast.erro('Informe um preço válido.');
    setSalvando(true);
    try {
      const payload = {
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || null,
        imagemUrl: form.imagemUrl.trim() || null,
        precoAtual: preco,
        tamanhoCaixa: tamanho,
      };
      if (form.id === null) {
        await api.criarCapsula(payload);
        toast.ok('Sabor criado.');
      } else {
        await api.atualizarCapsula(form.id, payload);
        toast.ok('Sabor atualizado (histórico de preço registrado se o preço mudou).');
      }
      setForm(NOVO);
      await carregar();
    } catch (err) {
      toast.erro(err);
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(c: Capsula) {
    try {
      await api.ativarCapsula(c.id, !c.ativo);
      await carregar();
    } catch (e) {
      toast.erro(e);
    }
  }

  async function verHistorico(c: Capsula) {
    try {
      setHist({ capsula: c, itens: await api.historicoPrecos(c.id) });
    } catch (e) {
      toast.erro(e);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Catálogo de cápsulas</h1>

      <form onSubmit={salvar} className="card space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_8rem_8rem]">
          <div>
            <label className="label" htmlFor="c-nome">Sabor</label>
            <input
              id="c-nome"
              required
              minLength={2}
              className="input"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="c-preco">Preço (R$)</label>
            <input
              id="c-preco"
              required
              inputMode="decimal"
              className="input"
              value={form.preco}
              onChange={(e) => setForm({ ...form, preco: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="c-tam">Cápsulas/caixa</label>
            <input
              id="c-tam"
              type="number"
              min={1}
              required
              className="input"
              value={form.tamanho}
              onChange={(e) => setForm({ ...form, tamanho: e.target.value })}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="c-desc">Descrição (aparece no verso do card)</label>
            <textarea
              id="c-desc"
              rows={3}
              maxLength={1000}
              className="input resize-y"
              placeholder="Ex.: Notas de caramelo cremoso, intensidade 6, ideal com leite…"
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="label" htmlFor="c-img">Imagem (cole uma URL ou envie do computador)</label>
            <input
              id="c-img"
              type="text"
              maxLength={500}
              className="input"
              placeholder="https://… ou envie um arquivo abaixo"
              value={form.imagemUrl}
              onChange={(e) => setForm({ ...form, imagemUrl: e.target.value })}
            />
            <div className="flex items-center gap-3">
              <label className="btn-secondary btn-sm cursor-pointer">
                {enviandoImg ? 'Enviando…' : 'Enviar imagem (PNG/JPG/WebP)'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  disabled={enviandoImg}
                  onChange={onSelecionarArquivo}
                />
              </label>
              {form.imagemUrl && (
                <>
                  <img
                    src={form.imagemUrl}
                    alt="Preview"
                    className="h-10 w-10 rounded border border-stone-200 bg-stone-50 object-contain p-0.5"
                  />
                  <button
                    type="button"
                    className="text-xs text-stone-500 hover:text-red-600"
                    onClick={() => setForm({ ...form, imagemUrl: '' })}
                  >
                    Remover
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button className="btn-primary" disabled={salvando || enviandoImg}>
            {form.id === null ? 'Adicionar' : 'Salvar alterações'}
          </button>
          {form.id !== null && (
            <button type="button" className="btn-secondary" onClick={() => setForm(NOVO)}>
              Cancelar
            </button>
          )}
        </div>
      </form>

      <div className="card overflow-x-auto">
        {!lista ? (
          <p className="text-stone-500">Carregando…</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-stone-500">
              <tr>
                <th className="py-2">Sabor</th>
                <th className="text-right">Preço atual</th>
                <th className="text-right">Cáps./caixa</th>
                <th className="pl-4">Situação</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {lista.map((c) => (
                <tr key={c.id} className={c.ativo ? '' : 'text-stone-400'}>
                  <td className="py-2">
                    <div className="flex items-center gap-3">
                      {c.imagemUrl ? (
                        <img
                          src={c.imagemUrl}
                          alt={c.nome}
                          className="h-10 w-10 shrink-0 rounded-lg border border-stone-200 bg-stone-50 object-contain p-0.5"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-cafe-50 text-lg">
                          ☕
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-medium">{c.nome}</div>
                        {c.descricao && (
                          <div className="max-w-md truncate text-xs text-stone-500">
                            {c.descricao}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="text-right">{moeda(c.precoAtual)}</td>
                  <td className="text-right">{c.tamanhoCaixa}</td>
                  <td className="pl-4">{c.ativo ? 'Ativo' : 'Inativo'}</td>
                  <td className="space-x-1 py-1 text-right whitespace-nowrap">
                    <button
                      className="btn-secondary btn-sm"
                      onClick={() =>
                        setForm({
                          id: c.id,
                          nome: c.nome,
                          descricao: c.descricao ?? '',
                          imagemUrl: c.imagemUrl ?? '',
                          preco: String(c.precoAtual),
                          tamanho: String(c.tamanhoCaixa),
                        })
                      }
                    >
                      Editar
                    </button>
                    <button className="btn-secondary btn-sm" onClick={() => verHistorico(c)}>
                      Histórico
                    </button>
                    <button className="btn-secondary btn-sm" onClick={() => alternarAtivo(c)}>
                      {c.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {hist && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setHist(null)}
        >
          <div
            className="card max-h-[80vh] w-full max-w-md overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Histórico de preços — {hist.capsula.nome}</h2>
              <button className="btn-secondary btn-sm" onClick={() => setHist(null)}>
                Fechar
              </button>
            </div>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-stone-500">
                <tr>
                  <th className="py-1">Vigência</th>
                  <th className="text-right">Preço</th>
                  <th className="pl-3">Por</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {hist.itens.map((h) => (
                  <tr key={h.id}>
                    <td className="py-1.5">{dataHora(h.dataVigencia)}</td>
                    <td className="text-right font-medium">{moeda(h.preco)}</td>
                    <td className="pl-3">{h.alteradoPorNome ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
