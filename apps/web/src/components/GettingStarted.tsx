import clsx from 'clsx'
import { Check, ChevronRight, X } from 'lucide-react'
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
      title: 'Abra a música de exemplo',
      text: 'Troque o tom e veja como fica a leitura no palco.',
      to: '/musicas',
    },
    {
      done: progress.setlist,
      title: 'Monte seu primeiro repertório',
      text: 'Cole a lista que você já usa no WhatsApp.',
      to: '/comecar',
    },
    {
      done: progress.band,
      title: 'Chame a sua banda',
      text: 'Os músicos entram pelo link, sem pagar.',
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
    <section className="card" aria-label="Primeiros passos">
      <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Primeiros passos</h2>
          <p className="text-xs text-muted">
            {done} de {steps.length} concluídos
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-1 w-20 overflow-hidden rounded-full bg-surface-2" aria-hidden>
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(done / steps.length) * 100}%` }} />
          </div>
          <button
            className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-text"
            onClick={hide}
            aria-label="Esconder primeiros passos"
            title="Esconder"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
      <ol className="divide-y divide-border border-t border-border">
        {steps.map(({ done, title, text, to }) => (
          <li key={title}>
            <Link to={to} className="group flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2">
              <span
                className={clsx(
                  'grid size-5 shrink-0 place-items-center rounded-full border',
                  done ? 'border-ok bg-ok text-bg' : 'border-muted/60',
                )}
                aria-label={done ? 'Concluído' : 'Pendente'}
              >
                {done && <Check className="size-3" strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={clsx('block text-sm font-medium', done && 'text-muted line-through')}>{title}</span>
                {!done && <span className="block text-xs text-muted">{text}</span>}
              </span>
              {!done && <ChevronRight className="size-4 shrink-0 text-muted transition group-hover:text-text" />}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}
