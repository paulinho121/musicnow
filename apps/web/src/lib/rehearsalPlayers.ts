// Players da Sala de ensaio: o YouTube (controlado por mensagens, sem script de fora) e o
// áudio guia (tom e velocidade independentes). Os dois expõem o mesmo controle.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'

export interface PlayerState {
  ready: boolean
  playing: boolean
  time: number
  duration: number
  rate: number
}

export interface Player extends PlayerState {
  play(): void
  pause(): void
  seek(t: number): void
  setRate(r: number): void
  /** Hora atual estimada (entre um aviso e outro do player). */
  now(): number
}

const INITIAL: PlayerState = { ready: false, playing: false, time: 0, duration: 0, rate: 1 }

// ---------------------------------------------------------------------------
// YouTube: o player oficial embutido aceita comandos por postMessage (enablejsapi=1) e
// manda o tempo, o estado e a velocidade de volta. É o mesmo mecanismo que a biblioteca
// do YouTube usa por dentro, sem precisar carregá-la.

const YT_ORIGINS = ['https://www.youtube-nocookie.com', 'https://www.youtube.com']

export const youtubeEmbedUrl = (id: string) =>
  `https://www.youtube-nocookie.com/embed/${id}?enablejsapi=1&playsinline=1&rel=0&modestbranding=1&origin=${encodeURIComponent(location.origin)}`

export function useYouTubePlayer(
  iframe: RefObject<HTMLIFrameElement | null>,
  videoId: string | null,
): Player & { rates: number[]; error: number | null } {
  const [state, setState] = useState(INITIAL)
  /** Erro do YouTube (101/150: o dono do vídeo não deixa tocar fora do YouTube; 100: não existe). */
  const [error, setError] = useState<number | null>(null)
  const [rates, setRates] = useState<number[]>([0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2])
  const last = useRef({ time: 0, at: 0, playing: false, rate: 1 })

  const send = useCallback(
    (func: string, args: unknown[] = []) =>
      iframe.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*'),
    [iframe],
  )

  useEffect(() => {
    if (!videoId) return
    setState(INITIAL)
    setError(null)
    let ready = false
    // Pede para o player começar a mandar notícias (repete até ele responder).
    const hello = setInterval(() => {
      if (ready) return clearInterval(hello)
      iframe.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*')
    }, 400)
    const onMessage = (e: MessageEvent) => {
      if (!YT_ORIGINS.includes(e.origin) || e.source !== iframe.current?.contentWindow) return
      let data: { event?: string; info?: Record<string, unknown> }
      try {
        data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
      } catch {
        return
      }
      if (data.event === 'onReady' || data.event === 'initialDelivery') ready = true
      if (data.event === 'onError') setError(Number((data as { info?: unknown }).info) || 150)
      const info = data.info
      if (!info || typeof info !== 'object') return
      ready = true
      if (Array.isArray(info.availablePlaybackRates)) setRates(info.availablePlaybackRates as number[])
      setState((s) => {
        const next = { ...s, ready: true }
        if (typeof info.currentTime === 'number') next.time = info.currentTime
        if (typeof info.duration === 'number' && info.duration > 0) next.duration = info.duration
        if (typeof info.playbackRate === 'number') next.rate = info.playbackRate
        if (typeof info.playerState === 'number') next.playing = info.playerState === 1
        last.current = { time: next.time, at: performance.now(), playing: next.playing, rate: next.rate }
        return next
      })
    }
    window.addEventListener('message', onMessage)
    return () => {
      clearInterval(hello)
      window.removeEventListener('message', onMessage)
    }
  }, [videoId, iframe])

  return {
    ...state,
    rates,
    error,
    play: () => send('playVideo'),
    pause: () => send('pauseVideo'),
    seek: (t) => {
      send('seekTo', [Math.max(0, t), true])
      last.current = { ...last.current, time: t, at: performance.now() }
      setState((s) => ({ ...s, time: t }))
    },
    setRate: (r) => send('setPlaybackRate', [r]),
    now: () => {
      const l = last.current
      return l.playing ? l.time + ((performance.now() - l.at) / 1000) * l.rate : l.time
    },
  }
}

// ---------------------------------------------------------------------------
// Áudio guia: <audio> faz a velocidade (sem mudar o tom) e o processador de tom (AudioWorklet)
// muda o tom sem mudar a velocidade.

export function useAudioPlayer(src: string | null, semitones: number): Player & { pitchSupported: boolean } {
  const audio = useRef<HTMLAudioElement | null>(null)
  const graph = useRef<{ ctx: AudioContext; node: AudioWorkletNode } | null>(null)
  const [state, setState] = useState(INITIAL)
  const [pitchSupported, setPitchSupported] = useState(typeof AudioWorkletNode !== 'undefined')

  useEffect(() => {
    if (!src) return
    const el = new Audio()
    el.src = src
    el.preload = 'auto'
    el.crossOrigin = 'use-credentials'
    // Velocidade sem mudar o tom (o tom é com o processador).
    el.preservesPitch = true
    ;(el as unknown as { webkitPreservesPitch?: boolean }).webkitPreservesPitch = true
    audio.current = el
    const sync = () =>
      setState({ ready: el.readyState >= 1, playing: !el.paused, time: el.currentTime, duration: el.duration || 0, rate: el.playbackRate })
    const events = ['loadedmetadata', 'timeupdate', 'play', 'pause', 'ratechange', 'ended', 'seeked']
    for (const ev of events) el.addEventListener(ev, sync)
    return () => {
      for (const ev of events) el.removeEventListener(ev, sync)
      el.pause()
      el.removeAttribute('src')
      el.load()
      audio.current = null
      void graph.current?.ctx.close()
      graph.current = null
      setState(INITIAL)
    }
  }, [src])

  /** Monta o caminho do som com o processador de tom (só no primeiro toque: o navegador exige um gesto). */
  const ensureGraph = useCallback(async () => {
    const el = audio.current
    if (!el || graph.current || typeof AudioWorkletNode === 'undefined') return
    try {
      const ctx = new AudioContext()
      await ctx.audioWorklet.addModule('/pitch-worklet.js')
      const node = new AudioWorkletNode(ctx, 'pitch-shifter', { outputChannelCount: [2] })
      ctx.createMediaElementSource(el).connect(node).connect(ctx.destination)
      graph.current = { ctx, node }
    } catch (e) {
      console.warn('Sala de ensaio: sem mudança de tom neste navegador', e)
      setPitchSupported(false)
    }
  }, [])

  useEffect(() => {
    const g = graph.current
    if (g) g.node.parameters.get('ratio')!.setValueAtTime(2 ** (semitones / 12), g.ctx.currentTime)
  }, [semitones, state.playing])

  return {
    ...state,
    pitchSupported,
    play: () => {
      void ensureGraph().then(() => {
        void graph.current?.ctx.resume()
        if (graph.current) graph.current.node.parameters.get('ratio')!.value = 2 ** (semitones / 12)
        void audio.current?.play()
      })
    },
    pause: () => audio.current?.pause(),
    seek: (t) => {
      if (audio.current) audio.current.currentTime = Math.max(0, Math.min(t, audio.current.duration || t))
    },
    setRate: (r) => {
      if (audio.current) audio.current.playbackRate = r
    },
    now: () => audio.current?.currentTime ?? 0,
  }
}

// ---------------------------------------------------------------------------
// Áudio guia da música (servidor).

export interface SongAudio {
  id: string
  fileName: string
  mimeType: string
  sizeBytes: number
}

export function useSongAudio(songId: string | undefined) {
  return useQuery({
    queryKey: ['audio', songId],
    queryFn: () => api<{ audio: SongAudio | null; canEdit: boolean }>(`/audio/song/${songId}`),
    enabled: Boolean(songId),
  })
}

export function useUploadAudio(songId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.set('songId', songId)
      form.set('file', file)
      return api<SongAudio>('/audio', { method: 'POST', body: form })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['audio', songId] }),
  })
}

export function useDeleteAudio(songId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api(`/audio/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['audio', songId] }),
  })
}
