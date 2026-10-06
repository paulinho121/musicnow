import clsx from 'clsx'
import { Check, ChevronRight, ListMusic, Music2, Radio, UserPlus, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

const HIDDEN_KEY = 'ef-primeiros-passos-ocultos'

/**
 * Primeiros passos de quem está começando: abrir a música de exemplo, montar o primeiro
 * repertório e chamar a banda. Some sozinho quando tudo estiver feito (ou ao fechar).
 */
export function GettingStarted({ progress }: { progress: { opened: boolean; setlist: boolean; band: boolean } }) {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(HIDDEN_KEY) === '1'
    } catch {
      return false
    }
  })
  const steps = [
    {
      done: progress.opened,
      icon: Music2,
      title: 'Abra a música de exemplo',
      text: 'Veja como trocar o tom e ler no palco.',
      to: '/musicas',
    },
    {
      done: progress.setlist,
      icon: ListMusic,
      title: 'Monte seu primeiro repertório',
      text: 'Cole a lista do WhatsApp: leva 1 minuto.',
      to: '/comecar',
    },
    {
      done: progress.band,
      icon: UserPlus,
      title: 'Chame a sua banda',
      text: 'Mande o link: entram de graça e veem tudo no mesmo tom.',
      to: '/repertorios',
    },
  ]
  const done = steps.filter((s) => s.done).length
  if (hidden || done === steps.length) return null

  const hide = () => {
    setHidden(true)
    try {
      localStorage.setItem(HIDDEN_KEY, '1')
    } catch {
      // navegação privada: some só nesta visita
    }
  }

  return (
    <section className="card relative overflow-hidden p-5" aria-label="Primeiros passos">
      <div aria-hidden className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full bg-accent/15 blur-3xl" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <h2 className="font-bold">Comece em 3 passos</h2>
          <p className="text-sm text-muted">
            {done} de {steps.length} feitos · depois é só tocar no <Radio className="inline size-3.5 align-[-2px]" /> Modo Palco
          </p>
        </div>
        <button
          className="btn-icon size-8 shrink-0 border-transparent bg-transparent"
          onClick={hide}
          aria-label="Esconder primeiros passos"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="relative mt-4 grid gap-2 md:grid-cols-3">
        {steps.map(({ done, icon: Icon, title, text, to }, i) => (
          <li key={title}>
            <Link
              to={to}
              className={clsx(
                'flex h-full items-center gap-3 rounded-xl border p-3 transition',
                done ? 'border-border opacity-60' : 'border-accent/30 bg-accent/5 hover:border-accent/60 hover:bg-accent/10',
              )}
            >
              <span
                className={clsx(
                  'grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold',
                  done ? 'bg-ok/15 text-ok' : 'bg-accent text-accent-ink',
                )}
              >
                {done ? <Check className="size-4" /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className={clsx('flex items-center gap-1.5 text-sm font-semibold', done && 'line-through')}>
                  <Icon className="size-3.5 shrink-0 text-muted" /> {title}
                </span>
                <span className="block text-xs text-muted">{text}</span>
              </span>
              {!done && <ChevronRight className="size-4 shrink-0 text-muted" />}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}
