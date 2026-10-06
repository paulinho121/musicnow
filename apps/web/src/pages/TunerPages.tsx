import { noteNamePt, TUNER_INSTRUMENTS } from '@ensaio/shared'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { PublicPage, TryCta } from '../components/PublicChrome'
import { Tuner } from '../components/Tuner'

/** Afinador dentro do app (menu). */
export function TunerPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Afinador</h1>
        <p className="text-sm text-muted">Violão, guitarra, baixo, cavaquinho, ukulele, viola caipira, violino e bandolim.</p>
      </div>
      <Tuner />
    </div>
  )
}

const ptNote = (n: string) => noteNamePt(n.replace(/-?\d$/, ''))

export const TUNER_FAQ = [
  {
    q: 'Como usar o afinador online?',
    a: 'Toque em "Ligar o afinador" e permita o microfone. Toque uma corda solta: o afinador mostra a nota e o ponteiro. À esquerda, a corda está grave (aperte); à direita, aguda (afrouxe). No centro e verde, está afinada.',
  },
  {
    q: 'O afinador funciona no celular?',
    a: 'Sim. Funciona no navegador do celular, do tablet e do computador, sem instalar nada. Para mais precisão, toque perto do microfone e num lugar sem barulho.',
  },
  {
    q: 'O que é a referência Lá 440 Hz?',
    a: 'É a frequência padrão da nota Lá (A4). Algumas bandas e orquestras usam 442 Hz; ajuste a referência se for afinar com outro instrumento que já está assim.',
  },
  {
    q: 'O microfone grava alguma coisa?',
    a: 'Não. O som é analisado no próprio aparelho e não é gravado nem enviado para lugar nenhum.',
  },
]

/** /afinador-online e /afinador-online/cavaquinho: afinador grátis, com conteúdo para o Google. */
export function PublicTuner() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const inst = slug ? TUNER_INSTRUMENTS.find((i) => i.slug === slug) : null
  if (slug && !inst) return <Navigate to="/afinador-online" replace />
  const name = inst ? inst.name.toLowerCase() : null
  const standard = inst?.tunings[0]

  return (
    <PublicPage>
      <div className="mx-auto max-w-6xl space-y-10 px-5 py-10">
        <nav aria-label="Você está em" className="text-sm text-muted">
          <Link to="/" className="hover:text-text">
            Início
          </Link>{' '}
          ›{' '}
          {inst ? (
            <>
              <Link to="/afinador-online" className="hover:text-text">
                Afinador
              </Link>{' '}
              › {inst.name}
            </>
          ) : (
            'Afinador'
          )}
        </nav>

        <header className="max-w-3xl">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            {inst && inst.id !== 'chromatic' ? `Afinador de ${name} online` : inst ? 'Afinador cromático online' : 'Afinador online grátis'}
          </h1>
          <p className="mt-2 text-lg text-muted">
            {inst && standard?.strings.length
              ? `Afine o ${name} pelo microfone do celular ou do computador. Grátis, sem instalar nada.`
              : 'Afine violão, guitarra, baixo, cavaquinho, ukulele, viola caipira, violino e bandolim pelo microfone. Grátis e sem instalar nada.'}
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,40rem)_1fr]">
          <Tuner instrument={inst?.slug ?? 'violao'} onInstrumentChange={(s) => navigate(`/afinador-online/${s}`, { replace: true })} />

          <aside className="space-y-6 text-[15px] leading-relaxed">
            {inst && standard?.strings.length ? (
              <section>
                <h2 className="mb-2 text-xl font-bold">Afinação padrão do {name}</h2>
                <p className="mb-3 text-muted">Da corda mais grave para a mais aguda:</p>
                <ol className="space-y-1">
                  {standard.strings.map((s, i) => (
                    <li key={`${s}${i}`} className="flex justify-between rounded-lg border border-border px-3 py-1.5">
                      <span>{standard.strings.length - i}ª corda</span>
                      <span>
                        <b className="font-mono">{s.replace(/-?\d$/, '')}</b> <span className="text-muted">· {ptNote(s)}</span>
                      </span>
                    </li>
                  ))}
                </ol>
                {inst.tunings.length > 1 && (
                  <p className="mt-3 text-sm text-muted">
                    Outras afinações no afinador:{' '}
                    {inst.tunings
                      .slice(1)
                      .map((t) => t.label)
                      .join('; ')}
                    .
                  </p>
                )}
              </section>
            ) : null}
            <section>
              <h2 className="mb-2 text-xl font-bold">Como afinar</h2>
              <ol className="list-decimal space-y-1.5 pl-5">
                <li>Toque em “Ligar o afinador” e permita o uso do microfone.</li>
                <li>Toque uma corda solta. O afinador reconhece qual corda é.</li>
                <li>Ponteiro à esquerda: aperte a tarraxa. À direita: afrouxe. No verde, está afinada.</li>
                <li>Repita em todas as cordas e confira de novo a primeira (a tensão muda um pouco).</li>
              </ol>
            </section>
          </aside>
        </div>

        <section aria-labelledby="outros">
          <h2 id="outros" className="mb-3 text-lg font-bold">
            Afinador para outros instrumentos
          </h2>
          <ul className="flex flex-wrap gap-2">
            {TUNER_INSTRUMENTS.filter((i) => i.slug !== inst?.slug).map((i) => (
              <li key={i.slug}>
                <Link to={`/afinador-online/${i.slug}`} className="chip h-9">
                  {i.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <TryCta
          title="Afinado? Agora é hora de tocar com a banda"
          text="No Ensaio Fácil você monta o repertório, troca o tom da cifra com um toque e a banda toda acompanha no Modo Palco."
        />

        <section className="max-w-3xl space-y-2" aria-labelledby="duvidas">
          <h2 id="duvidas" className="mb-3 text-xl font-bold">
            Dúvidas frequentes
          </h2>
          {TUNER_FAQ.map((f) => (
            <details key={f.q} className="card p-0">
              <summary className="cursor-pointer p-4 font-semibold">{f.q}</summary>
              <p className="-mt-1 px-4 pb-4 text-muted">{f.a}</p>
            </details>
          ))}
        </section>
      </div>
    </PublicPage>
  )
}
