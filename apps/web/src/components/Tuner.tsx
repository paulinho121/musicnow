import { freqOf, nearestString, noteFromFreq, TUNER_INSTRUMENTS, tuningRange, type TunerInstrument } from '@ensaio/shared'
import clsx from 'clsx'
import { Mic, MicOff, Minus, Plus, Volume2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useLocalState } from '../lib/storage'
import { playReference, useTuner } from '../lib/useTuner'

/** Dentro desta faixa (cents) a corda está afinada. */
const IN_TUNE = 5

const shortName = (note: string) => note.replace(/-?\d$/, '')

/**
 * Afinador multi-instrumento: escuta o microfone, mostra a nota e quanto falta (cents),
 * acha a corda sozinho e toca a nota de referência para afinar de ouvido.
 */
export function Tuner({ instrument, onInstrumentChange }: { instrument?: string; onInstrumentChange?: (slug: string) => void }) {
  const [prefs, setPrefs] = useLocalState('ef-afinador', { instrument: 'violao', tunings: {} as Record<string, string>, a4: 440 })
  const slug = instrument ?? prefs.instrument
  const inst: TunerInstrument = TUNER_INSTRUMENTS.find((i) => i.slug === slug) ?? TUNER_INSTRUMENTS[0]
  const tuning = inst.tunings.find((t) => t.id === prefs.tunings[inst.id]) ?? inst.tunings[0]
  const range = useMemo(() => tuningRange(tuning), [tuning])
  const { freq, listening, error, start, stop } = useTuner(range)
  const [locked, setLocked] = useState<number | null>(null)
  const a4 = prefs.a4

  const chromatic = tuning.strings.length === 0
  const auto = freq && !chromatic ? nearestString(freq, tuning, a4) : null
  const target = locked ?? auto?.index ?? null
  const targetNote = target != null ? tuning.strings[target] : null
  const note = freq ? noteFromFreq(freq, a4) : null
  const cents = freq ? (targetNote ? 1200 * Math.log2(freq / freqOf(targetNote, a4)) : note!.cents) : null
  const shown = cents == null ? 0 : Math.max(-50, Math.min(50, cents))
  const inTune = cents != null && Math.abs(cents) <= IN_TUNE
  // Longe demais da corda escolhida (outra corda tocando): mostra a nota real e avisa.
  const farOff = cents != null && Math.abs(cents) > 100

  const chooseInstrument = (s: string) => {
    setLocked(null)
    setPrefs((p) => ({ ...p, instrument: s }))
    onInstrumentChange?.(s)
  }

  return (
    // min-w-0: dentro de uma grade, a lista de instrumentos rola em vez de esticar a página.
    <div className="min-w-0 space-y-5">
      {/* Instrumento e afinação */}
      <div className="space-y-3">
        <div
          className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible"
          role="radiogroup"
          aria-label="Instrumento"
        >
          {TUNER_INSTRUMENTS.map((i) => (
            <button
              key={i.slug}
              role="radio"
              aria-checked={i.slug === inst.slug}
              ref={i.slug === inst.slug ? (el) => el?.scrollIntoView({ block: 'nearest', inline: 'nearest' }) : undefined}
              className={clsx('chip h-9 shrink-0', i.slug === inst.slug && 'chip-on')}
              onClick={() => chooseInstrument(i.slug)}
            >
              {i.name}
            </button>
          ))}
        </div>
        {inst.tunings.length > 1 && (
          <select
            className="input h-10 max-w-sm"
            value={tuning.id}
            onChange={(e) => {
              setLocked(null)
              setPrefs((p) => ({ ...p, tunings: { ...p.tunings, [inst.id]: e.target.value } }))
            }}
            aria-label="Afinação"
          >
            {inst.tunings.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Mostrador */}
      <section className={clsx('card relative overflow-hidden p-5 transition-colors sm:p-8', inTune && 'border-ok/60')} aria-live="polite">
        <div
          aria-hidden
          className={clsx(
            'pointer-events-none absolute inset-0 transition-opacity duration-300',
            inTune
              ? 'bg-[radial-gradient(60%_60%_at_50%_30%,color-mix(in_srgb,var(--ok)_22%,transparent),transparent)] opacity-100'
              : 'opacity-0',
          )}
        />
        <Gauge cents={shown} active={cents != null} inTune={inTune} />
        <div className="relative -mt-6 text-center">
          <p
            className={clsx(
              'font-mono text-6xl font-extrabold tracking-tight sm:text-7xl',
              inTune ? 'text-ok' : cents != null ? 'text-text' : 'text-muted/40',
            )}
          >
            {farOff || !targetNote ? (note ? note.name : '—') : shortName(targetNote)}
            <span className="ml-1 align-top text-2xl text-muted">
              {farOff || !targetNote ? (note?.octave ?? '') : targetNote.match(/-?\d$/)?.[0]}
            </span>
          </p>
          <p className="mt-1 h-6 text-sm text-muted">
            {freq ? `${freq.toFixed(1)} Hz${note ? ` · ${note.namePt}` : ''}` : listening ? 'Toque uma corda…' : ' '}
          </p>
          <p className={clsx('mt-2 h-7 text-lg font-bold', inTune ? 'text-ok' : 'text-accent')}>
            {cents == null
              ? ''
              : farOff
                ? 'Essa não é a corda escolhida'
                : inTune
                  ? 'Afinado ✓'
                  : cents < 0
                    ? `Aperte um pouco · −${Math.abs(Math.round(cents))} cents`
                    : `Afrouxe um pouco · +${Math.round(cents)} cents`}
          </p>
        </div>

        {!listening && (
          <div className="relative mt-5 flex flex-col items-center gap-2">
            <button className="btn-primary h-12 px-6 text-base" onClick={start}>
              <Mic className="size-5" /> Ligar o afinador
            </button>
            {error && (
              <p role="alert" className="max-w-sm text-center text-sm text-danger">
                {error === 'denied'
                  ? 'O navegador bloqueou o microfone. Libere o microfone para este site (no cadeado ao lado do endereço) e tente de novo.'
                  : error === 'unsupported'
                    ? 'Este navegador não deixa usar o microfone. Tente o Chrome, o Safari ou o Edge atualizado.'
                    : 'Não conseguimos abrir o microfone. Confira se outro app não está usando e tente de novo.'}
              </p>
            )}
            <p className="text-center text-xs text-muted">O som fica no seu aparelho: nada é gravado nem enviado.</p>
          </div>
        )}
      </section>

      {/* Cordas */}
      {!chromatic && (
        <section aria-label="Cordas">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">
              Cordas <span className="font-normal text-muted">· {locked == null ? 'detecção automática' : 'corda escolhida'}</span>
            </p>
            {locked != null && (
              <button className="text-xs font-semibold text-accent hover:underline" onClick={() => setLocked(null)}>
                Voltar ao automático
              </button>
            )}
          </div>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${tuning.strings.length}, minmax(0, 1fr))` }}>
            {tuning.strings.map((s, i) => {
              const active = target === i && cents != null
              return (
                <button
                  key={`${s}-${i}`}
                  className={clsx(
                    'flex flex-col items-center gap-0.5 rounded-xl border py-2.5 transition',
                    active && inTune
                      ? 'border-ok bg-ok/15'
                      : active
                        ? 'border-accent bg-accent/10'
                        : locked === i
                          ? 'border-accent/60'
                          : 'border-border bg-surface hover:bg-surface-2',
                  )}
                  onClick={() => {
                    setLocked(i)
                    playReference(freqOf(s, a4))
                  }}
                  aria-label={`Corda ${tuning.strings.length - i}: ${s}. Tocar a nota de referência`}
                >
                  <span className="font-mono text-lg font-bold">{shortName(s)}</span>
                  <span className="text-[10px] text-muted">{tuning.strings.length - i}ª</span>
                </button>
              )
            })}
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
            <Volume2 className="size-3.5" /> Toque numa corda para ouvir a nota e afinar de ouvido.
          </p>
        </section>
      )}

      {/* Calibração e microfone */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted">Lá (A4)</span>
          <button
            className="btn-icon size-8"
            onClick={() => setPrefs((p) => ({ ...p, a4: Math.max(430, p.a4 - 1) }))}
            aria-label="Diminuir a referência"
          >
            <Minus className="size-3.5" />
          </button>
          <span className="w-16 text-center font-mono font-semibold">{a4} Hz</span>
          <button
            className="btn-icon size-8"
            onClick={() => setPrefs((p) => ({ ...p, a4: Math.min(450, p.a4 + 1) }))}
            aria-label="Aumentar a referência"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
        {listening && (
          <button className="btn-ghost h-9" onClick={stop}>
            <MicOff className="size-4" /> Desligar
          </button>
        )}
      </div>
    </div>
  )
}

/** Ponteiro de −50 a +50 cents (meia-lua). */
function Gauge({ cents, active, inTune }: { cents: number; active: boolean; inTune: boolean }) {
  const angle = (cents / 50) * 80
  const ticks = Array.from({ length: 21 }, (_, i) => -50 + i * 5)
  return (
    <svg viewBox="0 0 300 170" className="relative mx-auto w-full max-w-md" aria-hidden>
      <path d="M 30 150 A 120 120 0 0 1 270 150" fill="none" stroke="var(--border)" strokeWidth="2" />
      {/* Zona afinada */}
      <path d={arc(150, 150, 120, -8, 8)} fill="none" stroke="var(--ok)" strokeOpacity=".5" strokeWidth="10" strokeLinecap="round" />
      {ticks.map((t) => {
        const a = ((t / 50) * 80 * Math.PI) / 180
        const big = t % 25 === 0
        const r1 = big ? 100 : 106
        return (
          <line
            key={t}
            x1={150 + r1 * Math.sin(a)}
            y1={150 - r1 * Math.cos(a)}
            x2={150 + 114 * Math.sin(a)}
            y2={150 - 114 * Math.cos(a)}
            stroke="var(--muted)"
            strokeOpacity={big ? 0.8 : 0.35}
            strokeWidth={big ? 2 : 1}
          />
        )
      })}
      <text x="40" y="168" fontSize="11" fill="var(--muted)" textAnchor="middle">
        −50
      </text>
      <text x="260" y="168" fontSize="11" fill="var(--muted)" textAnchor="middle">
        +50
      </text>
      <g
        style={{ transform: `rotate(${active ? angle : 0}deg)`, transformOrigin: '150px 150px', transition: 'transform 120ms ease-out' }}
        opacity={active ? 1 : 0.25}
      >
        <line x1="150" y1="150" x2="150" y2="40" stroke={inTune ? 'var(--ok)' : 'var(--accent)'} strokeWidth="4" strokeLinecap="round" />
      </g>
      <circle cx="150" cy="150" r="8" fill={inTune ? 'var(--ok)' : 'var(--accent)'} />
    </svg>
  )
}

function arc(cx: number, cy: number, r: number, fromDeg: number, toDeg: number) {
  const p = (deg: number) => {
    const a = (deg * Math.PI) / 180
    return `${cx + r * Math.sin(a)} ${cy - r * Math.cos(a)}`
  }
  return `M ${p(fromDeg)} A ${r} ${r} 0 0 1 ${p(toDeg)}`
}
