import { MAJOR_KEYS, MINOR_KEYS, spellKey, type Accidentals } from '@ensaio/shared'
import clsx from 'clsx'
import { X } from 'lucide-react'
import { useEffect } from 'react'
import { setAccidentals, useAccidentals } from '../lib/accidentals'

const ACCIDENTAL_OPTIONS: [Accidentals, string][] = [
  ['auto', 'Automático'],
  ['sharp', 'Sustenido (A#)'],
  ['flat', 'Bemol (Bb)'],
]

/** Folha inferior para escolher um tom diretamente (no celular abre de baixo, alcançável com o polegar). */
export function KeyPicker({
  open,
  onClose,
  minor,
  current,
  original,
  personal,
  personalLabel = 'meu tom',
  onPick,
}: {
  open: boolean
  onClose: () => void
  minor: boolean
  current: string | null
  original: string | null
  personal: string | null
  personalLabel?: string
  onPick: (key: string) => void
}) {
  const accidentals = useAccidentals()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  const keys = minor ? MINOR_KEYS : MAJOR_KEYS
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Escolher tom"
        className="w-full max-w-md rounded-t-3xl border border-border bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Escolher tom</h2>
          <button className="btn-icon size-9" onClick={onClose} aria-label="Fechar">
            <X className="size-4" />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {keys.map((k) => (
            <button
              key={k}
              onClick={() => onPick(k)}
              className={clsx(
                'relative h-14 rounded-xl border font-mono text-lg font-bold transition',
                k === current ? 'border-accent bg-accent text-accent-ink' : 'border-border bg-surface-2 text-text hover:border-accent/60',
              )}
            >
              {spellKey(k, accidentals)}
              {(k === original || k === personal) && (
                <span className="absolute inset-x-0 bottom-1 font-sans text-[9px] font-semibold tracking-wide uppercase opacity-70">
                  {k === original ? 'original' : personalLabel}
                </span>
              )}
            </button>
          ))}
        </div>
        <p className="mt-4 text-sm">Escrever os acordes com</p>
        <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl border border-border p-1" role="radiogroup" aria-label="Sustenido ou bemol">
          {ACCIDENTAL_OPTIONS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={accidentals === id}
              className={clsx(
                'h-9 rounded-lg text-xs font-semibold',
                accidentals === id ? 'bg-accent text-accent-ink' : 'text-muted hover:text-text',
              )}
              onClick={() => setAccidentals(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          {accidentals === 'auto'
            ? 'Segue o tom: bemóis em Bb, F, Eb…; sustenidos em F#, B, E…'
            : 'Vale para todas as músicas neste aparelho.'}
        </p>
      </div>
    </div>
  )
}
