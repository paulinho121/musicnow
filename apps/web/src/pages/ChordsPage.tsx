import { chordInfo, parseChord } from '@ensaio/shared'
import clsx from 'clsx'
import { ArrowLeft, Search } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ChordDetails } from '../components/ChordDictionary'

const ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
const TYPES: { suffix: string; label: string }[] = [
  { suffix: '', label: 'Maior' },
  { suffix: 'm', label: 'Menor' },
  { suffix: '7', label: '7' },
  { suffix: 'm7', label: 'm7' },
  { suffix: '7M', label: '7M' },
  { suffix: 'm7M', label: 'm7M' },
  { suffix: '6', label: '6' },
  { suffix: 'm6', label: 'm6' },
  { suffix: '9', label: '9' },
  { suffix: 'm9', label: 'm9' },
  { suffix: '7(9)', label: '7(9)' },
  { suffix: '4', label: '4 (sus)' },
  { suffix: '7(4)', label: '7(4)' },
  { suffix: 'sus2', label: 'sus2' },
  { suffix: '°', label: '° (dim)' },
  { suffix: 'm7(b5)', label: 'ø · m7(b5)' },
  { suffix: '+', label: '+ (aum)' },
  { suffix: '5', label: '5 (power)' },
]

/** Dicionário de acordes: escolha a nota e o tipo, ou digite qualquer acorde. */
export function ChordsPage() {
  const [params, setParams] = useSearchParams()
  const current = params.get('a') || 'C'
  const [typed, setTyped] = useState(current)
  const parsed = parseChord(current)
  const root = parsed ? parsed.root : null
  const suffix = parsed?.suffix ?? null

  const show = (symbol: string) => {
    setTyped(symbol)
    setParams({ a: symbol }, { replace: true })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link to="/inicio" className="btn-icon border-transparent bg-transparent" aria-label="Voltar">
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Dicionário de acordes</h1>
          <p className="text-sm text-muted">Como montar qualquer acorde no violão e no teclado.</p>
        </div>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (typed.trim()) show(typed.trim())
        }}
      >
        <input
          className="input font-mono"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="Digite um acorde: F#m7, G/B, A7(13)…"
          aria-label="Acorde"
          autoCapitalize="characters"
          spellCheck={false}
        />
        <button className="btn-primary shrink-0" aria-label="Ver acorde">
          <Search className="size-4" /> Ver
        </button>
      </form>

      <div className="grid gap-5 md:grid-cols-[1fr_1.1fr]">
        <div className="space-y-4">
          <div>
            <p className="label">Nota</p>
            <div className="grid grid-cols-6 gap-1.5">
              {ROOTS.map((r) => (
                <button key={r} className={clsx('chip justify-center px-0 font-mono font-bold', root === r && 'chip-on')} onClick={() => show(r + (suffix ?? ''))}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="label">Tipo</p>
            <div className="flex flex-wrap gap-1.5">
              {TYPES.map((t) => (
                <button
                  key={t.suffix}
                  className={clsx('chip h-8 font-mono text-xs', suffix === t.suffix && 'chip-on')}
                  onClick={() => show((root ?? 'C') + t.suffix)}
                  disabled={!chordInfo((root ?? 'C') + t.suffix)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <section className="card p-5">
          <ChordDetails symbol={current} />
        </section>
      </div>

      <p className="text-xs text-muted">
        As posições são calculadas para a afinação padrão (Mi Lá Ré Sol Si Mi). Dentro de uma música, toque em qualquer acorde
        da cifra para abrir este dicionário já no tom em que você está tocando.
      </p>
    </div>
  )
}
