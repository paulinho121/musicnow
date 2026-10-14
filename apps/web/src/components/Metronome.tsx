import { parseTimeSignature } from '@ensaio/shared'
import clsx from 'clsx'
import { Hand, Minus, Play, Plus, Square, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

const MIN_BPM = 30
const MAX_BPM = 260
const clampBpm = (n: number) => Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(n)))

/**
 * Metrônomo com Web Audio: os cliques são agendados no relógio do áudio (não no do JavaScript),
 * então não atrasam quando a tela está ocupada. O primeiro tempo do compasso soa mais agudo.
 * `stopAfter` para sozinho depois de N tempos (a contagem de entrada).
 */
function useMetronome(bpm: number, beats: number, onBeat: (beat: number) => void) {
  const ctxRef = useRef<AudioContext | null>(null)
  const timer = useRef<number | null>(null)
  const state = useRef({ next: 0, beat: 0, count: 0, stopAfter: Infinity, onDone: undefined as (() => void) | undefined })
  const bpmRef = useRef(bpm)
  const beatsRef = useRef(beats)
  const onBeatRef = useRef(onBeat)
  bpmRef.current = bpm
  beatsRef.current = beats
  onBeatRef.current = onBeat
  const [running, setRunning] = useState(false)

  const stop = useCallback(() => {
    if (timer.current) window.clearInterval(timer.current)
    timer.current = null
    setRunning(false)
  }, [])

  const click = (ctx: AudioContext, at: number, accent: boolean) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = accent ? 1760 : 1100
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(accent ? 0.9 : 0.55, at + 0.002)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.06)
    osc.connect(gain).connect(ctx.destination)
    osc.start(at)
    osc.stop(at + 0.07)
  }

  const start = useCallback(
    (opts?: { stopAfter?: number; onDone?: () => void }) => {
      const ctx = (ctxRef.current ??= new AudioContext())
      void ctx.resume()
      if (timer.current) window.clearInterval(timer.current)
      state.current = { next: ctx.currentTime + 0.08, beat: 0, count: 0, stopAfter: opts?.stopAfter ?? Infinity, onDone: opts?.onDone }
      setRunning(true)
      // Agenda os cliques dos próximos 120 ms a cada 25 ms.
      timer.current = window.setInterval(() => {
        const s = state.current
        while (s.next < ctx.currentTime + 0.12) {
          if (s.count >= s.stopAfter) {
            const done = s.onDone
            const wait = Math.max(0, (s.next - ctx.currentTime) * 1000)
            stop()
            if (done) window.setTimeout(done, wait)
            return
          }
          const beat = s.beat
          click(ctx, s.next, beat === 0)
          window.setTimeout(() => onBeatRef.current(beat), Math.max(0, (s.next - ctx.currentTime) * 1000))
          s.next += 60 / bpmRef.current
          s.beat = (beat + 1) % beatsRef.current
          s.count++
        }
      }, 25)
    },
    [stop],
  )

  useEffect(() => () => {
    if (timer.current) window.clearInterval(timer.current)
    void ctxRef.current?.close()
  }, [])

  return { running, start, stop }
}

/**
 * Painel do metrônomo (Modo Palco): BPM da música, ajuste fino, "toque no ritmo" e a contagem de
 * um compasso antes de começar a rolagem automática.
 */
export function MetronomePanel({
  initialBpm,
  timeSignature,
  onClose,
  onCountInDone,
}: {
  initialBpm: number | null
  timeSignature: string | null
  onClose: () => void
  /** Depois da contagem de entrada (ex.: liga a rolagem automática). */
  onCountInDone?: () => void
}) {
  const beats = Math.min(12, parseTimeSignature(timeSignature).beats)
  const [bpm, setBpm] = useState(() => clampBpm(initialBpm ?? 100))
  const [beat, setBeat] = useState<number | null>(null)
  const metro = useMetronome(bpm, beats, setBeat)
  const taps = useRef<number[]>([])

  useEffect(() => {
    if (!metro.running) setBeat(null)
  }, [metro.running])

  const tap = () => {
    const now = performance.now()
    const recent = [...taps.current.filter((t) => now - t < 3000), now].slice(-6)
    taps.current = recent
    if (recent.length >= 2) {
      const gaps = recent.slice(1).map((t, i) => t - recent[i])
      setBpm(clampBpm(60000 / (gaps.reduce((a, b) => a + b, 0) / gaps.length)))
    }
  }

  return (
    <div className="mx-auto mb-2 w-[min(22rem,calc(100%-1rem))] rounded-2xl border border-border bg-surface/95 p-3 shadow-2xl shadow-black/40 backdrop-blur">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Metrônomo</p>
        <button className="grid size-8 place-items-center rounded-lg text-muted hover:text-text" onClick={() => (metro.stop(), onClose())} aria-label="Fechar metrônomo">
          <X className="size-4" />
        </button>
      </div>

      <div className="mt-2 flex items-center justify-center gap-3">
        <button className="btn-icon" onClick={() => setBpm((b) => clampBpm(b - 1))} aria-label="Diminuir o andamento">
          <Minus className="size-5" />
        </button>
        <div className="text-center">
          <p className="font-mono text-3xl leading-none font-bold tabular-nums">{bpm}</p>
          <p className="text-[11px] text-muted">BPM{timeSignature ? ` · ${timeSignature}` : ''}</p>
        </div>
        <button className="btn-icon" onClick={() => setBpm((b) => clampBpm(b + 1))} aria-label="Aumentar o andamento">
          <Plus className="size-5" />
        </button>
      </div>
      <input
        type="range"
        min={MIN_BPM}
        max={MAX_BPM}
        value={bpm}
        onChange={(e) => setBpm(Number(e.target.value))}
        className="mt-2 w-full accent-[var(--accent)]"
        aria-label="Andamento"
      />

      {/* Os tempos do compasso: o que está soando acende. */}
      <div className="mt-2 flex justify-center gap-1.5" aria-hidden>
        {Array.from({ length: beats }, (_, i) => (
          <span
            key={i}
            className={clsx(
              'size-3 rounded-full transition-colors duration-75',
              beat === i ? (i === 0 ? 'bg-accent' : 'bg-text') : 'bg-surface-2',
            )}
          />
        ))}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          className={clsx('btn-ghost h-10 px-2 text-sm', metro.running && 'border-accent text-accent')}
          onClick={() => (metro.running ? metro.stop() : metro.start())}
        >
          {metro.running ? <Square className="size-4" /> : <Play className="size-4" />}
          {metro.running ? 'Parar' : 'Tocar'}
        </button>
        <button className="btn-ghost h-10 px-2 text-sm" onClick={tap} title="Toque no ritmo da música para medir o andamento">
          <Hand className="size-4" /> Bater
        </button>
        <button
          className="btn-primary h-10 px-2 text-sm"
          onClick={() => metro.start({ stopAfter: beats, onDone: onCountInDone })}
          title={`Conta ${beats} tempos e começa a rolagem automática`}
        >
          Contar e ir
        </button>
      </div>
    </div>
  )
}
