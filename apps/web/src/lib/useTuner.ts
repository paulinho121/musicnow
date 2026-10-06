// Afinador: escuta o microfone e acha a nota tocada (detectPitch, em @ensaio/shared).
// Sem cancelamento de eco/ruído do navegador: eles distorcem a nota do instrumento.
import { decimate, decimationFor, detectPitch } from '@ensaio/shared'
import { useCallback, useEffect, useRef, useState } from 'react'

export type TunerError = 'denied' | 'unsupported' | 'failed'

const BUFFER = 8192
/** Leituras por segundo (suficiente para o ponteiro andar suave sem pesar no celular). */
const RATE_MS = 70
/** Sem som por este tempo: volta a "toque uma corda". */
const HOLD_MS = 900

export function useTuner(range: { minFreq: number; maxFreq: number }) {
  const [freq, setFreq] = useState<number | null>(null)
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<TunerError | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rangeRef = useRef(range)
  rangeRef.current = range

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    void ctxRef.current?.close().catch(() => {})
    ctxRef.current = null
    setListening(false)
    setFreq(null)
  }, [])

  const start = useCallback(async () => {
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia) return setError('unsupported')
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      })
    } catch (e) {
      return setError((e as Error).name === 'NotAllowedError' ? 'denied' : 'failed')
    }
    const ctx = new AudioContext()
    await ctx.resume().catch(() => {})
    const analyser = ctx.createAnalyser()
    analyser.fftSize = BUFFER
    ctx.createMediaStreamSource(stream).connect(analyser)
    ctxRef.current = ctx
    streamRef.current = stream
    setListening(true)

    const buf = new Float32Array(BUFFER)
    const recent: number[] = []
    let lastHeard = 0
    const timer = setInterval(() => {
      if (ctxRef.current !== ctx) return clearInterval(timer)
      const t = performance.now()
      analyser.getFloatTimeDomainData(buf)
      const r = rangeRef.current
      const factor = decimationFor(ctx.sampleRate, r.maxFreq)
      const p = detectPitch(decimate(buf, factor), ctx.sampleRate / factor, r)
      if (p) {
        // Mediana das últimas leituras: o ponteiro não treme.
        recent.push(p.freq)
        if (recent.length > 5) recent.shift()
        const sorted = [...recent].sort((a, b) => a - b)
        setFreq(sorted[Math.floor(sorted.length / 2)])
        lastHeard = t
      } else if (t - lastHeard > HOLD_MS) {
        recent.length = 0
        setFreq(null)
      }
    }, RATE_MS)
  }, [])

  // Sai da tela ou fecha a aba: desliga o microfone.
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && stop()
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      stop()
    }
  }, [stop])

  return { freq, listening, error, start, stop }
}

/** Toca a nota de referência (para afinar de ouvido), ~2 s com som parecido com corda. */
let refCtx: AudioContext | null = null
export function playReference(freq: number) {
  refCtx ??= new AudioContext()
  const ctx = refCtx
  void ctx.resume()
  const now = ctx.currentTime
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.35, now + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.2)
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = Math.min(4000, freq * 6)
  filter.connect(gain).connect(ctx.destination)
  for (const [mult, type] of [
    [1, 'triangle'],
    [2, 'sine'],
  ] as const) {
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.value = freq * mult
    const g = ctx.createGain()
    g.gain.value = mult === 1 ? 1 : 0.3
    osc.connect(g).connect(filter)
    osc.start(now)
    osc.stop(now + 2.3)
  }
}
