import {
  CHORD_ROOTS,
  CHORD_TYPES,
  chordFromSlug,
  chordInfo,
  chordSlug,
  guitarVoicings,
  keyboardNotes,
  noteNamePt,
  parseChord,
} from '@ensaio/shared'
import { ChevronRight, Search } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { GuitarDiagram, PianoDiagram } from '../components/ChordDiagrams'
import { ChordDetails, chordFullName } from '../components/ChordDictionary'
import { PublicPage, TryCta } from '../components/PublicChrome'

const INTERVAL_NAMES: Record<number, string> = {
  0: 'fundamental',
  1: 'segunda menor',
  2: 'segunda (nona)',
  3: 'terça menor',
  4: 'terça maior',
  5: 'quarta justa',
  6: 'quinta diminuta',
  7: 'quinta justa',
  8: 'quinta aumentada',
  9: 'sexta maior',
  10: 'sétima menor',
  11: 'sétima maior',
  13: 'nona menor',
  14: 'nona maior',
  15: 'nona aumentada',
  17: 'décima primeira',
  18: 'décima primeira aumentada',
  20: 'décima terceira menor',
  21: 'décima terceira',
}

function ChordSearch({ initial = '' }: { initial?: string }) {
  const [typed, setTyped] = useState(initial)
  const navigate = useNavigate()
  return (
    <form
      className="flex gap-2"
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        const s = typed.trim()
        if (!s) return
        const slug = chordSlug(s)
        navigate(slug ? `/acordes/${slug}` : `/acordes?a=${encodeURIComponent(s)}`)
      }}
    >
      <input
        className="input font-mono"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder="Digite um acorde: F#m7, G/B, A7(13)…"
        aria-label="Buscar acorde"
        autoCapitalize="characters"
        spellCheck={false}
      />
      <button className="btn-primary shrink-0">
        <Search className="size-4" /> Ver
      </button>
    </form>
  )
}

/** /acordes: todas as notas e tipos (links para o Google seguir) e a busca de qualquer acorde. */
export function ChordsIndex() {
  const [params] = useSearchParams()
  const typed = params.get('a')
  // Link antigo do app (/acordes?a=C#m): vai para a página do acorde.
  const slug = typed ? chordSlug(typed) : null
  if (slug) return <Navigate to={`/acordes/${slug}`} replace />

  return (
    <PublicPage>
      <div className="mx-auto max-w-6xl space-y-8 px-5 py-10">
        <nav aria-label="Você está em" className="text-sm text-muted">
          <Link to="/" className="hover:text-text">
            Início
          </Link>{' '}
          › Acordes
        </nav>
        <div className="max-w-3xl">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Dicionário de acordes</h1>
          <p className="mt-2 text-lg text-muted">
            Como montar qualquer acorde no violão, na guitarra e no teclado, com várias posições e as notas de cada um. Grátis.
          </p>
        </div>
        <div className="max-w-xl">
          <ChordSearch initial={typed ?? ''} />
        </div>

        {typed && (
          <section className="card max-w-xl p-5" aria-label={`Acorde ${typed}`}>
            <ChordDetails symbol={typed} />
          </section>
        )}

        <div className="space-y-6">
          {CHORD_ROOTS.map((root) => (
            <section key={root} aria-labelledby={`nota-${root}`}>
              <h2 id={`nota-${root}`} className="mb-2 font-bold">
                Acordes de {root} <span className="font-normal text-muted">· {noteNamePt(root)}</span>
              </h2>
              <ul className="flex flex-wrap gap-1.5">
                {CHORD_TYPES.filter((t) => chordInfo(root + t.suffix)).map((t) => (
                  <li key={t.slug}>
                    <Link to={`/acordes/${chordSlug(root + t.suffix)}`} className="chip h-9 font-mono font-bold hover:border-accent/50">
                      {root + t.suffix}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <TryCta
          title="Toque a cifra inteira no tom certo"
          text="No Ensaio Fácil, toque em qualquer acorde da música para ver como montar, já no tom em que a banda vai tocar."
        />
      </div>
    </PublicPage>
  )
}

/** /acordes/c-sustenido-menor: tudo sobre um acorde. */
export function ChordPage() {
  const { slug = '' } = useParams()
  const symbol = chordFromSlug(slug)
  if (!symbol) return <Navigate to="/acordes" replace />
  return <ChordPageContent symbol={symbol} />
}

function ChordPageContent({ symbol }: { symbol: string }) {
  const info = chordInfo(symbol)!
  const name = chordFullName(symbol)
  const voicings = guitarVoicings(symbol, 8)
  const keys = keyboardNotes(symbol)
  const flats = info.notes.some((n) => n.includes('b'))
  const parsed = parseChord(symbol)!
  const sameRoot = CHORD_TYPES.filter((t) => t.suffix !== parsed.suffix && chordInfo(parsed.root + t.suffix))
  const sameType = CHORD_ROOTS.filter((r) => r !== parsed.root)
  const intervals = info.intervals.map((i) => INTERVAL_NAMES[i] ?? `${i} semitons`)
  const notesText = info.notes.map((n) => `${n} (${noteNamePt(n)})`)
  const easiest = voicings[0]

  return (
    <PublicPage>
      <article className="mx-auto max-w-6xl space-y-10 px-5 py-10">
        <nav aria-label="Você está em" className="text-sm text-muted">
          <Link to="/" className="hover:text-text">
            Início
          </Link>{' '}
          ›{' '}
          <Link to="/acordes" className="hover:text-text">
            Acordes
          </Link>{' '}
          › {symbol}
        </nav>

        <header className="max-w-3xl">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Acorde <span className="font-mono text-chord">{symbol}</span>
          </h1>
          <p className="mt-2 text-lg text-muted">{name}: como tocar no violão, na guitarra e no teclado.</p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
          <section className="card p-5" aria-label={`Diagrama do acorde ${symbol}`}>
            <ChordDetails symbol={symbol} />
          </section>

          <section className="space-y-4 text-[15px] leading-relaxed">
            <h2 className="text-xl font-bold">Como é formado o acorde {symbol}</h2>
            <p>
              O acorde <b>{symbol}</b> ({name}) é formado pelas notas <b>{notesText.join(', ')}</b>. Em relação à fundamental{' '}
              {noteNamePt(info.notes[0])}, as notas são: {intervals.join(', ')}.
            </p>
            {easiest && (
              <p>
                No violão e na guitarra, a posição mais fácil{' '}
                {easiest.barre
                  ? `usa pestana na ${easiest.barre.fret}ª casa`
                  : easiest.baseFret > 1
                    ? `fica a partir da ${easiest.baseFret}ª casa`
                    : 'fica no começo do braço'}
                . Abaixo estão {voicings.length > 1 ? `${voicings.length} posições diferentes` : 'a posição'}, da mais fácil para a mais
                difícil, na afinação padrão (Mi Lá Ré Sol Si Mi).
              </p>
            )}
            <p>
              No teclado ou no piano, toque {info.notes.join(' + ')}
              {info.bassNote ? `, com ${info.bassNote} no baixo` : ''}. Para soar mais cheio, a mão esquerda pode reforçar a fundamental{' '}
              {info.notes[0]} uma oitava abaixo.
            </p>
          </section>
        </div>

        {voicings.length > 0 && (
          <section aria-labelledby="posicoes">
            <h2 id="posicoes" className="mb-4 text-xl font-bold">
              Posições do acorde {symbol} no violão e na guitarra
            </h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
              {voicings.map((v, i) => (
                <li key={i} className="card flex flex-col items-center p-3">
                  <GuitarDiagram voicing={v} flats={flats} className="h-36 w-auto" />
                  <span className="mt-1 text-xs text-muted">Posição {i + 1}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="teclado">
          <h2 id="teclado" className="mb-4 text-xl font-bold">
            Acorde {symbol} no teclado e no piano
          </h2>
          <div className="card max-w-xl p-5">
            <PianoDiagram notes={keys} flats={flats} className="w-full" />
          </div>
        </section>

        <TryCta
          title={`Vai tocar uma música com ${symbol}?`}
          text="No Ensaio Fácil você troca o tom da cifra inteira com um toque e a banda toda acompanha no Modo Palco."
        />

        <div className="grid gap-8 md:grid-cols-2">
          <section aria-labelledby="mesma-nota">
            <h2 id="mesma-nota" className="mb-3 text-lg font-bold">
              Outros acordes de {parsed.root} ({noteNamePt(parsed.root)})
            </h2>
            <ul className="flex flex-wrap gap-1.5">
              {sameRoot.map((t) => (
                <li key={t.slug}>
                  <Link to={`/acordes/${chordSlug(parsed.root + t.suffix)}`} className="chip h-9 font-mono font-bold">
                    {parsed.root + t.suffix}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="mesmo-tipo">
            <h2 id="mesmo-tipo" className="mb-3 text-lg font-bold">
              Acordes {chordInfo('C' + parsed.suffix)?.quality ?? ''} em outras notas
            </h2>
            <ul className="flex flex-wrap gap-1.5">
              {sameType.map((r) => (
                <li key={r}>
                  <Link to={`/acordes/${chordSlug(r + parsed.suffix)}`} className="chip h-9 font-mono font-bold">
                    {r + parsed.suffix}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <p>
          <Link to="/acordes" className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline">
            Ver o dicionário completo de acordes <ChevronRight className="size-4" />
          </Link>
        </p>
      </article>
    </PublicPage>
  )
}
