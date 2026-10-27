import { normalizeOffset, transposeKey, youtubeId } from '@ensaio/shared'
import clsx from 'clsx'
import {
  ArrowLeft,
  Bookmark,
  FileAudio,
  Loader2,
  Minus,
  Pause,
  Play,
  Plus,
  Repeat,
  RotateCcw,
  RotateCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ChordSheet, useSheet } from '../components/ChordSheet'
import { ErrorState, PageSpinner, useToast } from '../components/ui'
import { useSong } from '../lib/queries'
import {
  type Player,
  useAudioPlayer,
  useDeleteAudio,
  useSongAudio,
  useUploadAudio,
  useYouTubePlayer,
  youtubeEmbedUrl,
} from '../lib/rehearsalPlayers'
import { useLocalState } from '../lib/storage'

type Source = 'youtube' | 'audio'

interface Practice {
  source: Source | null
  loopA: number | null
  loopB: number | null
  loopOn: boolean
  markers: { t: number; label: string }[]
  speed: number
  pitch: number
  /** A cifra sobe e desce junto com o tom do áudio. */
  follow: boolean
}

const fmt = (t: number) => {
  if (!Number.isFinite(t) || t < 0) t = 0
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/** /musicas/:id/ensaio — tocar junto com o YouTube ou o áudio guia: velocidade, tom e loop. */
export function RehearsalRoom() {
  const { id = '' } = useParams()
  const { data: song, isLoading, error, refetch } = useSong(id)
  const { data: audioInfo } = useSongAudio(id)
  const [prefs, setPrefs] = useLocalState<Practice>(`ef-ensaio-${id}`, {
    source: null,
    loopA: null,
    loopB: null,
    loopOn: false,
    markers: [],
    speed: 1,
    pitch: 0,
    follow: true,
  })
  const set = <K extends keyof Practice>(k: K, v: Practice[K]) => setPrefs((p) => ({ ...p, [k]: v }))

  const ytId = youtubeId(song?.referenceUrl)
  const audio = audioInfo?.audio ?? null
  const available: Source[] = [...(ytId ? (['youtube'] as const) : []), ...(audio ? (['audio'] as const) : [])]
  const source: Source | null = prefs.source && available.includes(prefs.source) ? prefs.source : (available[0] ?? null)

  const iframe = useRef<HTMLIFrameElement | null>(null)
  const yt = useYouTubePlayer(iframe, source === 'youtube' ? ytId : null)
  const au = useAudioPlayer(source === 'audio' && audio ? `/api/audio/${audio.id}/arquivo` : null, prefs.pitch)
  const player: Player = source === 'audio' ? au : yt

  // Velocidade escolhida vale ao trocar de fonte e quando o player fica pronto.
  useEffect(() => {
    if (player.ready) player.setRate(prefs.speed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.ready, source])

  // Loop A–B: chegou no B, volta para o A.
  const loop = useRef(prefs)
  loop.current = prefs
  useEffect(() => {
    const t = setInterval(() => {
      const { loopOn, loopA, loopB } = loop.current
      if (!loopOn || loopA === null || loopB === null || loopB <= loopA) return
      if (player.playing && player.now() >= loopB) player.seek(loopA)
    }, 80)
    return () => clearInterval(t)
  }, [player])

  // Espaço: tocar/pausar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || (e.target as HTMLElement)?.closest('input, textarea, select')) return
      e.preventDefault()
      if (player.playing) player.pause()
      else player.play()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [player])

  const semitones = source === 'audio' && prefs.follow ? prefs.pitch : 0
  const targetKey = song?.originalKey ? transposeKey(song.originalKey, semitones) : null
  const lines = useSheet(song?.content ?? '', normalizeOffset(semitones), targetKey)

  if (isLoading) return <PageSpinner />
  if (error || !song) return <ErrorState error={error} onRetry={() => refetch()} />

  const setSpeed = (r: number) => {
    const v = Math.round(r * 100) / 100
    loop.current = { ...loop.current, speed: v }
    set('speed', v)
    player.setRate(v)
  }

  return (
    <div className="min-h-dvh bg-bg pb-10">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-2 px-3 py-2">
          <Link to={`/musicas/${id}`} className="btn-icon border-transparent bg-transparent" aria-label="Voltar para a música">
            <ArrowLeft className="size-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold tracking-widest text-muted uppercase">Sala de ensaio</p>
            <h1 className="truncate leading-tight font-bold">{song.title}</h1>
          </div>
          {available.length > 1 && (
            <div className="flex rounded-lg border border-border p-0.5 text-sm" role="tablist" aria-label="Tocar junto com">
              {available.map((s) => (
                <button
                  key={s}
                  role="tab"
                  aria-selected={source === s}
                  className={clsx('rounded-md px-3 py-1.5 font-medium', source === s ? 'bg-surface-2 text-text' : 'text-muted')}
                  onClick={() => {
                    player.pause()
                    set('source', s)
                  }}
                >
                  {s === 'youtube' ? 'YouTube' : 'Áudio guia'}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 px-3 pt-4">
        {/* Fonte */}
        {source === 'youtube' && ytId && (
          <div className="aspect-video overflow-hidden rounded-2xl border border-border bg-black">
            <iframe
              ref={iframe}
              className="size-full"
              src={youtubeEmbedUrl(ytId)}
              title={`Vídeo de ${song.title}`}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}
        <AudioCard songId={id} audio={audio} canEdit={Boolean(audioInfo?.canEdit)} active={source === 'audio'} hasYoutube={Boolean(ytId)} />

        {source && (
          <>
            <Transport player={player} prefs={prefs} />

            <section className="card space-y-4 p-4">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold">Velocidade</p>
                  <span className="font-mono text-sm font-bold">{Math.round(prefs.speed * 100)}%</span>
                </div>
                {source === 'youtube' ? (
                  <div className="flex flex-wrap gap-1.5">
                    {yt.rates.map((r) => (
                      <button key={r} className={clsx('chip h-8 px-3 text-xs', Math.abs(prefs.speed - r) < 0.01 && 'chip-on')} onClick={() => setSpeed(r)}>
                        {Math.round(r * 100)}%
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <button className="btn-icon size-9" onClick={() => setSpeed(Math.max(0.5, loop.current.speed - 0.05))} aria-label="Mais devagar">
                      <Minus className="size-4" />
                    </button>
                    <input
                      type="range"
                      min={0.5}
                      max={1.5}
                      step={0.05}
                      value={prefs.speed}
                      onChange={(e) => setSpeed(Number(e.target.value))}
                      className="flex-1 accent-[var(--accent)]"
                      aria-label="Velocidade"
                    />
                    <button className="btn-icon size-9" onClick={() => setSpeed(Math.min(1.5, loop.current.speed + 0.05))} aria-label="Mais rápido">
                      <Plus className="size-4" />
                    </button>
                  </div>
                )}
                <p className="mt-1.5 text-xs text-muted">Muda o andamento sem mudar o tom.</p>
              </div>

              {source === 'audio' && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold">Tom</p>
                    <span className="font-mono text-sm font-bold">
                      {prefs.pitch > 0 ? `+${prefs.pitch}` : prefs.pitch} st{targetKey && prefs.pitch !== 0 ? ` · ${targetKey}` : ''}
                    </span>
                  </div>
                  {au.pitchSupported ? (
                    <div className="flex items-center gap-3">
                      <button className="btn-icon size-9" onClick={() => setPrefs((p) => ({ ...p, pitch: Math.max(-12, p.pitch - 1) }))} aria-label="Descer meio tom">
                        <Minus className="size-4" />
                      </button>
                      <input
                        type="range"
                        min={-12}
                        max={12}
                        step={1}
                        value={prefs.pitch}
                        onChange={(e) => set('pitch', Number(e.target.value))}
                        className="flex-1 accent-[var(--accent)]"
                        aria-label="Tom em semitons"
                      />
                      <button className="btn-icon size-9" onClick={() => setPrefs((p) => ({ ...p, pitch: Math.min(12, p.pitch + 1) }))} aria-label="Subir meio tom">
                        <Plus className="size-4" />
                      </button>
                      {prefs.pitch !== 0 && (
                        <button className="text-xs text-muted hover:text-text" onClick={() => set('pitch', 0)}>
                          Original
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted">Este navegador não consegue mudar o tom do áudio. Use o Chrome ou o Safari atualizado.</p>
                  )}
                  {song.content.trim() && (
                    <label className="mt-2 flex items-center gap-2 text-sm">
                      <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={prefs.follow} onChange={(e) => set('follow', e.target.checked)} />
                      A cifra acompanha o tom do áudio
                    </label>
                  )}
                </div>
              )}
              {source === 'youtube' && (
                <p className="text-xs text-muted">
                  O YouTube não deixa mudar o tom do vídeo. Para treinar em outro tom, envie um áudio guia (MP3) desta música.
                </p>
              )}
            </section>

            <LoopCard player={player} prefs={prefs} setPrefs={setPrefs} />
          </>
        )}

        {song.content.trim() && (
          <section className="card p-4">
            <p className="mb-2 text-sm font-semibold">
              Cifra{targetKey ? <span className="font-normal text-muted"> · tom {targetKey}</span> : null}
            </p>
            <ChordSheet lines={lines} fontSize={15} lineHeight={1.45} wrap timeSignature={song.timeSignature} />
          </section>
        )}
      </main>
    </div>
  )
}

function Transport({ player, prefs }: { player: Player; prefs: Practice }) {
  const [drag, setDrag] = useState<number | null>(null)
  const d = player.duration || 0
  const t = drag ?? player.time
  const pct = (x: number | null) => (x === null || !d ? null : Math.min(100, Math.max(0, (x / d) * 100)))
  const a = pct(prefs.loopA)
  const b = pct(prefs.loopB)
  return (
    <section className="card p-4">
      <div className="relative h-6">
        {a !== null && b !== null && b > a && (
          <div
            className={clsx('pointer-events-none absolute top-2 h-2 rounded-full', prefs.loopOn ? 'bg-accent/35' : 'bg-muted/25')}
            style={{ left: `${a}%`, width: `${b - a}%` }}
          />
        )}
        {prefs.markers.map((m, i) =>
          pct(m.t) === null ? null : (
            <span key={i} className="pointer-events-none absolute top-0 h-6 w-0.5 bg-sec-intro/70" style={{ left: `${pct(m.t)}%` }} title={m.label} />
          ),
        )}
        <input
          type="range"
          min={0}
          max={d || 1}
          step={0.1}
          value={Math.min(t, d || 1)}
          disabled={!d}
          onChange={(e) => setDrag(Number(e.target.value))}
          onPointerUp={() => {
            if (drag !== null) player.seek(drag)
            setDrag(null)
          }}
          onKeyUp={() => {
            if (drag !== null) player.seek(drag)
            setDrag(null)
          }}
          className="absolute inset-x-0 top-0 h-6 w-full accent-[var(--accent)]"
          aria-label="Posição na música"
        />
      </div>
      <div className="mt-1 flex justify-between font-mono text-xs text-muted">
        <span>{fmt(t)}</span>
        <span>{fmt(d)}</span>
      </div>
      <div className="mt-2 flex items-center justify-center gap-4">
        <button className="btn-icon" onClick={() => player.seek(player.now() - 5)} aria-label="Voltar 5 segundos" title="Voltar 5 s">
          <RotateCcw className="size-5" />
        </button>
        <button
          className="grid size-16 place-items-center rounded-full bg-accent text-accent-ink shadow-lg transition active:scale-95 disabled:opacity-40"
          onClick={() => (player.playing ? player.pause() : player.play())}
          disabled={!player.ready && !d}
          aria-label={player.playing ? 'Pausar' : 'Tocar'}
        >
          {player.playing ? <Pause className="size-7" /> : <Play className="size-7 translate-x-0.5" />}
        </button>
        <button className="btn-icon" onClick={() => player.seek(player.now() + 5)} aria-label="Avançar 5 segundos" title="Avançar 5 s">
          <RotateCw className="size-5" />
        </button>
      </div>
    </section>
  )
}

function LoopCard({ player, prefs, setPrefs }: { player: Player; prefs: Practice; setPrefs: (f: (p: Practice) => Practice) => void }) {
  const canLoop = prefs.loopA !== null && prefs.loopB !== null && prefs.loopB > prefs.loopA
  const mark = (k: 'loopA' | 'loopB') => {
    const now = Math.round(player.now() * 10) / 10
    setPrefs((p) => {
      const next = { ...p, [k]: now }
      // Marcou o B antes do A (ou o contrário): troca para o trecho fazer sentido.
      if (next.loopA !== null && next.loopB !== null && next.loopB < next.loopA) [next.loopA, next.loopB] = [next.loopB, next.loopA]
      if (next.loopA !== null && next.loopB !== null && next.loopB > next.loopA) next.loopOn = true
      return next
    })
  }
  const addMarker = () => {
    const t = Math.round(player.now() * 10) / 10
    const label = prompt('Nome do marcador (ex.: Refrão, Solo):', `Marcador ${prefs.markers.length + 1}`)
    if (label === null) return
    setPrefs((p) => ({ ...p, markers: [...p.markers, { t, label: label.trim() || fmt(t) }].sort((x, y) => x.t - y.t) }))
  }
  const sorted = useMemo(() => prefs.markers, [prefs.markers])
  return (
    <section className="card space-y-4 p-4">
      <div>
        <p className="mb-2 text-sm font-semibold">Repetir um trecho (A–B)</p>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-ghost h-9 px-3 text-sm" onClick={() => mark('loopA')}>
            A <span className="font-mono text-muted">{prefs.loopA !== null ? fmt(prefs.loopA) : '--:--'}</span>
          </button>
          <button className="btn-ghost h-9 px-3 text-sm" onClick={() => mark('loopB')}>
            B <span className="font-mono text-muted">{prefs.loopB !== null ? fmt(prefs.loopB) : '--:--'}</span>
          </button>
          <button
            className={clsx('btn-ghost h-9 px-3 text-sm', prefs.loopOn && canLoop && 'border-accent text-accent')}
            onClick={() => setPrefs((p) => ({ ...p, loopOn: !p.loopOn }))}
            disabled={!canLoop}
            aria-pressed={prefs.loopOn}
          >
            <Repeat className="size-4" /> {prefs.loopOn && canLoop ? 'Repetindo' : 'Repetir'}
          </button>
          {(prefs.loopA !== null || prefs.loopB !== null) && (
            <button
              className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text"
              onClick={() => setPrefs((p) => ({ ...p, loopA: null, loopB: null, loopOn: false }))}
              aria-label="Limpar o trecho"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <p className="mt-1.5 text-xs text-muted">Toque em A no começo do trecho e em B no fim, com a música tocando.</p>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">Marcadores</p>
          <button className="btn-ghost h-8 px-3 text-xs" onClick={addMarker} disabled={!player.duration}>
            <Bookmark className="size-3.5" /> Marcar agora
          </button>
        </div>
        {sorted.length === 0 ? (
          <p className="text-xs text-muted">Marque as partes (Refrão, Solo) para pular direto para elas.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sorted.map((m, i) => (
              <span key={i} className="inline-flex items-center overflow-hidden rounded-full border border-border text-sm">
                <button className="px-3 py-1 hover:bg-surface-2" onClick={() => player.seek(m.t)}>
                  {m.label} <span className="font-mono text-xs text-muted">{fmt(m.t)}</span>
                </button>
                <button
                  className="border-l border-border px-2 py-1 text-muted hover:bg-surface-2 hover:text-danger"
                  onClick={() => setPrefs((p) => ({ ...p, markers: p.markers.filter((_, j) => j !== i) }))}
                  aria-label={`Apagar o marcador ${m.label}`}
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

/** Áudio guia: enviar, trocar ou apagar (quem cadastrou a música). */
function AudioCard({
  songId,
  audio,
  canEdit,
  active,
  hasYoutube,
}: {
  songId: string
  audio: { id: string; fileName: string; sizeBytes: number } | null
  canEdit: boolean
  active: boolean
  hasYoutube: boolean
}) {
  const upload = useUploadAudio(songId)
  const del = useDeleteAudio(songId)
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (f.size > 25 * 1024 * 1024) return toast('Arquivo grande demais (máximo de 25 MB). Use MP3.', 'error')
    upload.mutate(f, { onSuccess: () => toast('Áudio guia enviado.'), onError: (err) => toast(err.message, 'error') })
  }
  const fileInput = <input ref={input} type="file" accept="audio/*,.mp3,.m4a,.ogg,.wav,.flac" className="hidden" onChange={pick} />

  if (!audio) {
    if (!canEdit) return hasYoutube ? null : <p className="card p-4 text-sm text-muted">Esta música ainda não tem vídeo nem áudio guia.</p>
    return (
      <section className="card flex flex-wrap items-center gap-3 border-dashed p-4">
        <FileAudio className="size-6 shrink-0 text-muted" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Áudio guia</p>
          <p className="text-xs text-muted">Envie um MP3 da música para treinar mudando o tom e a velocidade. A banda toda usa o mesmo.</p>
        </div>
        <button className="btn-ghost h-9 text-sm" onClick={() => input.current?.click()} disabled={upload.isPending}>
          {upload.isPending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Enviar áudio
        </button>
        {fileInput}
      </section>
    )
  }
  if (!active && !canEdit) return null
  return (
    <section className={clsx('card flex flex-wrap items-center gap-3 p-4', !active && 'opacity-70')}>
      <FileAudio className="size-6 shrink-0 text-accent" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{audio.fileName}</p>
        <p className="text-xs text-muted">Áudio guia · {(audio.sizeBytes / 1024 / 1024).toFixed(1)} MB</p>
      </div>
      {canEdit && (
        <div className="flex gap-1">
          <button className="btn-ghost h-9 px-3 text-sm" onClick={() => input.current?.click()} disabled={upload.isPending}>
            {upload.isPending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Trocar
          </button>
          <button
            className="grid size-9 place-items-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger"
            onClick={() => confirm('Apagar o áudio guia desta música?') && del.mutate(audio.id)}
            aria-label="Apagar o áudio guia"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      )}
      {fileInput}
    </section>
  )
}
