import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import IntensidadeBolinhas from '../components/IntensidadeBolinhas';
import { api } from '../lib/api';
import type { CapsulaPublica } from '../types';

const PILARES_NESPRESSO = [
  {
    icone: '⚡',
    titulo: 'Extração a 19 bar de pressão',
    texto:
      'As máquinas Nespresso utilizam alta pressão controlada (até 19 bar) e temperatura precisa da água para liberar mais de 900 aromas voláteis do café e formar a crema densa e aveludada.',
  },
  {
    icone: '🌱',
    titulo: 'Top 1% a 2% dos grãos mundiais',
    texto:
      'Apenas uma pequena fração da colheita global atende aos critérios de qualidade e perfil aromático. Blends de Arábica e Robusta de origens como Brasil, Colômbia, Guatemala e Indonésia.',
  },
  {
    icone: '♻️',
    titulo: 'Alumínio hermético e reciclável',
    texto:
      'Cada cápsula é selada hermeticamente em alumínio para bloquear oxigênio, luz e umidade — preservando o frescor da moagem até o instante do preparo. O alumínio é infinitamente reciclável.',
  },
  {
    icone: '🔥',
    titulo: 'Torra e moagem sob medida',
    texto:
      'Cada origem recebe uma curva de torra específica (torra separada ou conjunta) e granulometria exata para equilibrar doçura, acidez, corpo e notas aromáticas na xícara.',
  },
];

const TAMANHOS_XICARA = [
  {
    nome: 'Ristretto',
    ml: '25 ml',
    icone: '☕',
    descricao:
      'Extração curta e concentrada. Realça notas tostadas, corpo denso e final marcante — ideal para quem gosta de café bem forte.',
  },
  {
    nome: 'Espresso',
    ml: '40 ml',
    icone: '☕',
    descricao:
      'O clássico italiano equilibrado. Combina aroma intenso, crema espessa e acidez na medida certa para qualquer hora do dia.',
  },
  {
    nome: 'Lungo',
    ml: '110 ml',
    icone: '🫖',
    descricao:
      'Xícara mais longa e suave, feita com blends moídos especialmente para manter o equilíbrio sem amargar durante a extração.',
  },
  {
    nome: 'Com Leite',
    ml: 'Cappuccino / Latte',
    icone: '🥛',
    descricao:
      'Cápsulas criadas ou aromatizadas (caramelo, baunilha, avelã) que harmonizam perfeitamente com leite vaporizado e espuma cremosa.',
  },
];

const FAIXAS_INTENSIDADE = [
  {
    faixa: '1 a 5',
    nivel: 4,
    titulo: 'Suave & Floral',
    cor: 'border-emerald-200 bg-emerald-50/50',
    perfil: 'Torra leve · Notas florais, frutadas e acidez delicada',
    exemplos: 'Ex.: Finezzo, Volluto',
  },
  {
    faixa: '6 a 8',
    nivel: 7,
    titulo: 'Equilibrado & Cremoso',
    cor: 'border-amber-200 bg-amber-50/50',
    perfil: 'Torra média · Notas de cereais, malte, cacau e corpo médio',
    exemplos: 'Ex.: Leggero, Guatemala, Forte, Intenso',
  },
  {
    faixa: '9 a 12',
    nivel: 11,
    titulo: 'Intenso & Encorpado',
    cor: 'border-cafe-200 bg-cafe-50',
    perfil: 'Torra escura · Corpo denso, notas tostadas, amadeiradas e especiarias',
    exemplos: 'Ex.: Indonésia, Ristretto, Ristretto Intenso',
  },
];

const PASSOS_SITE = [
  {
    num: '01',
    titulo: 'Escolha seus sabores',
    texto: 'Explore o catálogo com fotos, intensidade e descrição no verso de cada cápsula.',
  },
  {
    num: '02',
    titulo: 'Feche caixas em grupo',
    texto: 'Acompanhe em tempo real quantas cápsulas faltam para completar cada caixa de 50.',
  },
  {
    num: '03',
    titulo: 'Pague fácil via PIX',
    texto: 'Quando a rodada fecha, você recebe o resumo por e-mail e paga direto via QR Code PIX.',
  },
  {
    num: '04',
    titulo: 'Painel, Ranking e Brindes',
    texto: 'Veja seu histórico anual, sabor favorito, ranking de cafezinhos e concorra a brindes.',
  },
];

export default function Home() {
  const { tema, alternarTema } = useAuth();
  const [capsulas, setCapsulas] = useState<CapsulaPublica[]>([]);

  useEffect(() => {
    api
      .capsulasPublico()
      .then(setCapsulas)
      .catch(() => {});
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header fixo com Login / Cadastro no canto superior direito */}
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold text-cafe-700">
            <span className="text-2xl">☕</span>
            <span>Cafezinho Infor</span>
          </Link>

          <nav className="hidden items-center gap-5 text-sm text-stone-600 md:flex">
            <a href="#universo-nespresso" className="hover:text-cafe-700 transition">
              Universo Nespresso
            </a>
            <a href="#intensidade" className="hover:text-cafe-700 transition">
              Intensidades
            </a>
            <a href="#como-funciona" className="hover:text-cafe-700 transition">
              Como funciona
            </a>
            {capsulas.length > 0 && (
              <a href="#catalogo" className="hover:text-cafe-700 transition">
                Sabores
              </a>
            )}
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void alternarTema()}
              className="btn-secondary btn-sm"
              title={tema === 'escuro' ? 'Alternar para tema claro' : 'Alternar para tema escuro'}
              aria-label="Alternar tema claro e escuro"
            >
              {tema === 'escuro' ? '☀️' : '🌙'}
            </button>
            <Link to="/login" className="btn-secondary btn-sm sm:px-3 sm:py-1.5 sm:text-sm">
              Entrar
            </Link>
            <Link to="/cadastro" className="btn-primary btn-sm sm:px-3.5 sm:py-1.5 sm:text-sm">
              Criar conta
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero / Capa moderna */}
        <section className="relative overflow-hidden border-b border-stone-200 bg-gradient-to-br from-cafe-50 via-amber-50/50 to-white">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:py-20 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-cafe-200 bg-white/80 px-3 py-1 text-xs font-semibold text-cafe-700">
                <span>☕</span>
                <span>Clube coletivo Nespresso Professional</span>
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight text-stone-900 sm:text-5xl sm:leading-tight">
                O melhor café <span className="text-cafe-700">Nespresso</span> compartilhado com a
                equipe, sem complicação.
              </h1>

              <p className="max-w-xl text-base text-stone-600 sm:text-lg">
                Descubra os sabores, intensidades e origens do café Nespresso e participe das
                rodadas coletivas do <strong>Cafezinho Infor</strong> — fechando caixas de 50
                cápsulas juntos com total transparência.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link to="/cadastro" className="btn-primary px-5 py-2.5 text-base shadow-sm">
                  Quero participar
                </Link>
                <Link to="/login" className="btn-secondary px-5 py-2.5 text-base">
                  Já tenho conta · Entrar
                </Link>
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-xs text-stone-500">
                <span>✓ Cadastro com e-mail ou Google</span>
                <span>✓ Pagamento fácil via QR Code PIX</span>
                <span>✓ Sorteio auditável de brindes</span>
              </div>
            </div>

            {/* Card visual lateral de destaques */}
            <div className="lg:col-span-5">
              <div className="card space-y-4 border-cafe-200 p-6 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-cafe-600">
                    Por que Nespresso?
                  </span>
                  <span className="rounded-full bg-cafe-100 px-2.5 py-0.5 text-xs font-bold text-cafe-700">
                    19 bar
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-cafe-50 p-3">
                    <div className="text-2xl font-extrabold text-cafe-700">900+</div>
                    <div className="text-xs text-stone-600">
                      aromas voláteis preservados na cápsula
                    </div>
                  </div>
                  <div className="rounded-lg bg-cafe-50 p-3">
                    <div className="text-2xl font-extrabold text-cafe-700">1 a 12</div>
                    <div className="text-xs text-stone-600">
                      escala de intensidade, torra e corpo
                    </div>
                  </div>
                  <div className="rounded-lg bg-cafe-50 p-3">
                    <div className="text-2xl font-extrabold text-cafe-700">100%</div>
                    <div className="text-xs text-stone-600">
                      alumínio hermeticamente selado e reciclável
                    </div>
                  </div>
                  <div className="rounded-lg bg-cafe-50 p-3">
                    <div className="text-2xl font-extrabold text-cafe-700">
                      {capsulas.length > 0 ? capsulas.length : '14+'}
                    </div>
                    <div className="text-xs text-stone-600">
                      sabores ativos no nosso catálogo coletivo
                    </div>
                  </div>
                </div>

                <p className="border-t border-stone-100 pt-3 text-xs text-stone-500">
                  Do <strong>Ristretto Intenso</strong> (12/12) ao suave{' '}
                  <strong>Volluto</strong> (4/12), passando por aromatizados como{' '}
                  <strong>Caramello</strong>, <strong>Vanilio</strong> e <strong>Nocciola</strong>.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Universo Nespresso */}
        <section id="universo-nespresso" className="mx-auto max-w-6xl space-y-10 px-4 py-14">
          <div className="max-w-2xl space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-cafe-600">
              Cultura do Café
            </span>
            <h2 className="text-2xl font-bold text-stone-900 sm:text-3xl">
              O segredo por trás de cada xícara Nespresso
            </h2>
            <p className="text-sm text-stone-600 sm:text-base">
              Da escolha do terroir à extração em alta pressão, cada detalhe foi pensado para
              entregar um espresso de cafeteria em segundos.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PILARES_NESPRESSO.map((p) => (
              <div key={p.titulo} className="card space-y-2.5 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cafe-100 text-xl">
                  {p.icone}
                </div>
                <h3 className="text-base font-semibold text-stone-800">{p.titulo}</h3>
                <p className="text-xs leading-relaxed text-stone-600">{p.texto}</p>
              </div>
            ))}
          </div>

          {/* Tamanhos ideais de xícara */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-stone-800">
              Qual tamanho de xícara combina com você?
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {TAMANHOS_XICARA.map((t) => (
                <div key={t.nome} className="card space-y-2 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-cafe-700">{t.nome}</span>
                    <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-semibold text-stone-600">
                      {t.ml}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-stone-600">{t.descricao}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Guia de Intensidade */}
        <section
          id="intensidade"
          className="border-y border-stone-200 bg-cafe-50/50 py-14"
        >
          <div className="mx-auto max-w-6xl space-y-8 px-4">
            <div className="max-w-2xl space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-cafe-600">
                Guia de Degustação
              </span>
              <h2 className="text-2xl font-bold text-stone-900 sm:text-3xl">
                Entenda a escala de intensidade (1 a 12)
              </h2>
              <p className="text-sm text-stone-600">
                <strong>Curiosidade:</strong> a intensidade Nespresso{' '}
                <strong>não mede a quantidade de cafeína</strong>! Ela indica o{' '}
                <strong>grau de torra, o corpo e o amargor</strong> do café na xícara.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {FAIXAS_INTENSIDADE.map((f) => (
                <div key={f.faixa} className={`card space-y-3 border p-5 ${f.cor}`}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-stone-800">{f.titulo}</h3>
                    <span className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-bold text-cafe-700 border border-stone-200">
                      {f.faixa}
                    </span>
                  </div>
                  <IntensidadeBolinhas valor={f.nivel} compacto mostrarRotulo={false} />
                  <p className="text-xs text-stone-700">{f.perfil}</p>
                  <p className="text-xs font-medium text-cafe-700">{f.exemplos}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="card flex items-start gap-3 p-4">
                <span className="text-2xl">🍮</span>
                <div>
                  <h3 className="text-sm font-bold text-stone-800">Criações Aromatizadas</h3>
                  <p className="mt-0.5 text-xs text-stone-600">
                    Blends equilibrados de Arábica com aromas naturais de caramelo (
                    <em>Caramello</em>), baunilha (<em>Vanilio</em>) ou avelã torrada (
                    <em>Nocciola</em>) — excelentes puros ou com leite.
                  </p>
                </div>
              </div>
              <div className="card flex items-start gap-3 p-4">
                <span className="text-2xl">🌙</span>
                <div>
                  <h3 className="text-sm font-bold text-stone-800">Descafeinados</h3>
                  <p className="mt-0.5 text-xs text-stone-600">
                    Todo o prazer do espresso no fim da tarde ou à noite, sem abrir mão do aroma e
                    da crema (como <em>Decaffeinato</em> e <em>Amaretti</em>).
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Como funciona o Cafezinho Infor */}
        <section id="como-funciona" className="mx-auto max-w-6xl space-y-8 px-4 py-14">
          <div className="max-w-2xl space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-cafe-600">
              Pedido Coletivo
            </span>
            <h2 className="text-2xl font-bold text-stone-900 sm:text-3xl">
              Como funciona o Cafezinho Infor
            </h2>
            <p className="text-sm text-stone-600">
              Organizamos compras coletivas de caixas de 50 cápsulas para que cada pessoa peça
              apenas a quantidade que quiser, pagando o preço justo de caixa fechada.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PASSOS_SITE.map((p) => (
              <div key={p.num} className="card space-y-2 p-5">
                <span className="text-2xl font-black text-cafe-600/80">{p.num}</span>
                <h3 className="text-base font-semibold text-stone-800">{p.titulo}</h3>
                <p className="text-xs leading-relaxed text-stone-600">{p.texto}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Vitrine real de sabores cadastrados no sistema */}
        {capsulas.length > 0 && (
          <section id="catalogo" className="border-t border-stone-200 bg-stone-50/80 py-14">
            <div className="mx-auto max-w-6xl space-y-8 px-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-cafe-600">
                    Nosso Catálogo
                  </span>
                  <h2 className="text-2xl font-bold text-stone-900 sm:text-3xl">
                    Sabores disponíveis nas rodadas ({capsulas.length})
                  </h2>
                </div>
                <Link to="/cadastro" className="btn-primary btn-sm">
                  Criar conta para pedir →
                </Link>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {capsulas.map((c) => (
                  <div key={c.id} className="card flex flex-col justify-between gap-3 p-4">
                    <div className="flex items-start gap-3">
                      {c.imagemUrl ? (
                        <img
                          src={c.imagemUrl}
                          alt={c.nome}
                          className="h-14 w-14 shrink-0 rounded-full border border-stone-200 bg-white object-contain p-1"
                        />
                      ) : (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-cafe-100 text-2xl">
                          ☕
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="font-bold text-stone-800">{c.nome}</h3>
                        <p className="text-[11px] text-stone-500">
                          Caixa com {c.tamanhoCaixa} cápsulas
                        </p>
                      </div>
                    </div>

                    {c.intensidade !== null && (
                      <IntensidadeBolinhas valor={c.intensidade} compacto />
                    )}

                    {c.descricao && (
                      <p className="line-clamp-3 text-xs leading-relaxed text-stone-600">
                        {c.descricao}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* CTA Final */}
        <section className="mx-auto max-w-6xl px-4 py-14">
          <div className="rounded-2xl border border-cafe-200 bg-gradient-to-r from-cafe-50 via-amber-50/50 to-cafe-50 p-8 text-center space-y-4 shadow-sm">
            <div className="text-4xl">☕</div>
            <h2 className="text-2xl font-bold text-cafe-700 sm:text-3xl">
              Pronto para o próximo cafezinho?
            </h2>
            <p className="mx-auto max-w-lg text-sm text-stone-600">
              Crie sua conta em segundos (com e-mail ou Google) e participe da próxima rodada
              coletiva de cápsulas Nespresso!
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <Link to="/cadastro" className="btn-primary px-6 py-2.5 text-sm">
                Criar minha conta
              </Link>
              <Link to="/login" className="btn-secondary px-6 py-2.5 text-sm">
                Já tenho conta · Entrar
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-stone-200 bg-white py-4 text-center text-xs text-stone-400">
        Cafezinho Infor · Desenvolvido por{' '}
        <span className="font-semibold text-cafe-700">Studios Melk</span>
      </footer>
    </div>
  );
}
