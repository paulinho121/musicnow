import { chordInfo, GUITAR_TUNING, guitarVoicings, keyboardNotes, noteNamePt } from '@ensaio/shared'
import clsx from 'clsx'
import { ChevronLeft, ChevronRight, Guitar, Piano, Volume2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLocalState } from '../lib/storage'
import { GuitarDiagram, PianoDiagram, playNotes } from './ChordDiagrams'
import { Sheet } from './Sheet'

type Instrument = 'violao' | 'teclado'

/** Nome por extenso: "Fá sustenido menor, com sétima (baixo em Lá)". */
export function chordFullName(symbol: string) {
  const info = chordInfo(symbol)
  if (!info) return null
  const name = `${noteNamePt(info.notes[0])} ${info.quality}`
  return info.bassNote ? `${name}, com baixo em ${noteNamePt(info.bassNote)}` : name
}

/** Tudo sobre um acorde: nome, notas e como montar no violão e no teclado. */
export function ChordDetails({ symbol }: { symbol: string }) {
  const [prefs, setPrefs] = useLocalState('ef-chords', { instrument: 'violao' as Instrument })
  const info = useMemo(() => chordInfo(symbol), [symbol])
  const voicings = useMemo(() => guitarVoicings(symbol, 8), [symbol])
  const keys = useMemo(() => keyboardNotes(symbol), [symbol])
  const [pos, setPos] = useState(0)
  useEffect(() => setPos(0), [symbol])

  if (!info) {
    return <p className="py-6 text-center text-sm text-muted">Não reconhecemos “{symbol}” como acorde.</p>
  }
  const flats = info.notes.some((n) => n.includes('b'))
  const v = voicings[Math.min(pos, voicings.length - 1)]
  const play = () =>
    prefs.instrument === 'violao' && v
      ? playNotes(v.frets.flatMap((f, s) => (f < 0 ? [] : [GUITAR_TUNING[s] + f])))
      : playNotes(keys, 0.012)

  return (
    <div className="space-y-4">
      <div>
        <p className="font-mono text-3xl font-bold text-chord">{info.symbol}</p>
        <p className="text-sm text-muted">{chordFullName(symbol)}</p>
        <p className="mt-2 flex flex-wrap gap-1.5">
          {info.notes.map((n, i) => (
            <span key={n} className={clsx('rounded-lg border px-2 py-0.5 text-sm', i === 0 ? 'border-accent/50 bg-accent/10 font-semibold' : 'border-border')}>
              {n} <span className="text-xs text-muted">· {noteNamePt(n)}</span>
            </span>
          ))}
        </p>
      </div>

      <div className="flex gap-2">
        {(
          [
            ['violao', 'Violão', Guitar],
            ['teclado', 'Teclado', Piano],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            className={clsx('chip h-9', prefs.instrument === id && 'chip-on')}
            aria-pressed={prefs.instrument === id}
            onClick={() => setPrefs({ instrument: id })}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
        <button className="chip ml-auto h-9 max-[380px]:px-3" onClick={play} aria-label="Ouvir o acorde">
          <Volume2 className="size-4" /> <span className="max-[380px]:sr-only">Ouvir</span>
        </button>
      </div>

      {prefs.instrument === 'violao' ? (
        v ? (
          <div className="flex flex-col items-center gap-2">
            <GuitarDiagram voicing={v} flats={flats} className="h-56 w-auto" />
            {voicings.length > 1 && (
              <div className="flex items-center gap-3">
                <button className="btn-icon size-9" onClick={() => setPos((p) => (p - 1 + voicings.length) % voicings.length)} aria-label="Posição anterior">
                  <ChevronLeft className="size-4" />
                </button>
                <span className="min-w-28 text-center text-sm text-muted">
                  Posição {pos + 1} de {voicings.length}
                </span>
                <button className="btn-icon size-9" onClick={() => setPos((p) => (p + 1) % voicings.length)} aria-label="Próxima posição">
                  <ChevronRight className="size-4" />
                </button>
              </div>
            )}
            <p className="text-center text-xs text-muted">
              Cordas da 6ª (Mi grave, à esquerda) à 1ª. <b>X</b> = não tocar · <b>O</b> = corda solta
              {v.barre && ' · faixa = pestana'}
            </p>
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted">Não achamos uma posição confortável para este acorde no violão.</p>
        )
      ) : (
        <div className="space-y-2">
          <PianoDiagram notes={keys} flats={flats} className="w-full" />
          <p className="text-center text-xs text-muted">
            {info.bassNote ? `Mão esquerda: ${info.bassNote} no baixo. ` : ''}Posição fundamental, a partir do Dó central.
          </p>
        </div>
      )}
    </div>
  )
}

/** Janela do dicionário: abre ao tocar num acorde da cifra. */
export function ChordDialog({
  symbol,
  onClose,
  related = [],
  onPick,
}: {
  symbol: string | null
  onClose: () => void
  /** Outros acordes da música, para trocar sem fechar. */
  related?: string[]
  onPick?: (symbol: string) => void
}) {
  return (
    <Sheet open={symbol !== null} onClose={onClose} title="Dicionário de acordes">
      {symbol && (
        <div className="space-y-4">
          {related.length > 1 && onPick && (
            <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
              {related.map((c) => (
                <button
                  key={c}
                  className={clsx('chip h-8 shrink-0 font-mono text-sm font-bold', c === symbol && 'chip-on')}
                  onClick={() => onPick(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
          <ChordDetails symbol={symbol} />
        </div>
      )}
    </Sheet>
  )
}
