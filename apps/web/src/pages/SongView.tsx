import { normalizeOffset, parseChord, semitonesBetween, transposeKey } from '@ensaio/shared'
import clsx from 'clsx'
import {
  ArrowLeft,
  Expand,
  Lock,
  Minus,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Shrink,
  Star,
  Type,
  Unlock,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ChordSheet, sectionsOf, useSheet } from '../components/ChordSheet'
import { KeyPicker } from '../components/KeyPicker'
import { ReportButton } from '../components/ReportDialog'
import { ErrorState, PageSpinner, useToast } from '../components/ui'
import { useSession } from '../lib/auth'
import { useSavePersonalKey, useSong, useToggleFavorite } from '../lib/queries'
import { useLocalState } from '../lib/storage'

const VIEWER_DEFAULTS = { fontSize: 17, lineHeight: 1.45, speed: 3, showChords: true }

export function SongView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { data: session } = useSession()
  const { data: song, isLoading, error, refetch } = useSong(id)
  const fav = useToggleFavorite()
  const savePersonal = useSavePersonalKey(id ?? '')

  const [prefs, setPrefs] = useLocalState('ef-viewer', VIEWER_DEFAULTS)
  const [offset, setOffset] = useState(0)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [scrolling, setScrolling] = useState(false)
  const [locked, setLocked] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)

  // Ao abrir, começa no tom pessoal do músico (se ele tiver um salvo).
  const initialized = useRef<string | null>(null)
  useEffect(() => {
    if (!song || initialized.current === song.id) return
    initialized.current = song.id
    setOffset(song.originalKey && song.personalKey ? normalizeOffset(semitonesBetween(song.originalKey, song.personalKey)) : 0)
  }, [song])

  const original = song?.originalKey ?? null
  const currentKey = original ? transposeKey(original, offset) : null
  const isMinor = original ? (parseChord(original)?.suffix ?? '').startsWith('m') : false
  const lines = useSheet(song?.content ?? '', offset, currentKey)
  const sections = sectionsOf(lines)

  const shift = useCallback((d: number) => setOffset((o) => normalizeOffset(o + d)), [])

  useAutoScroll(scrolling, prefs.speed, () => setScrolling(false))
  useWakeLock(Boolean(song))

  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  // Teclado e pedais Bluetooth (que enviam setas / PageDown).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === ' ') {
        e.preventDefault()
        setScrolling((s) => !s)
      } else if (e.key === 'PageDown' || e.key === 'ArrowRight') {
        e.preventDefault()
        window.scrollBy({ top: window.innerHeight * 0.75, behavior: 'smooth' })
      } else if (e.key === 'PageUp' || e.key === 'ArrowLeft') {
        e.preventDefault()
        window.scrollBy({ top: -window.innerHeight * 0.75, behavior: 'smooth' })
      } else if (!locked && (e.key === '+' || e.key === '=')) shift(1)
      else if (!locked && e.key === '-') shift(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [locked, shift])

  if (isLoading) return <PageSpinner />
  if (error || !song)
    return (
      <div className="mx-auto max-w-lg p-4 pt-10">
        <ErrorState error={error ?? new Error('Música não encontrada.')} onRetry={() => refetch()} />
      </div>
    )

  const hideLyrics = !song.lyricsAuthorized && !song.canEdit
  const personalDiffers = currentKey !== (song.personalKey ?? original)

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen()
    else document.documentElement.requestFullscreen?.().catch(() => toast('Tela cheia não disponível neste navegador.', 'error'))
  }

  const savePersonalKey = () => {
    const value = currentKey === original ? null : currentKey
    savePersonal.mutate(value, {
      onSuccess: () => toast(value ? `Tom ${value} salvo como seu tom.` : 'Voltou a usar o tom original.'),
      onError: (e) => toast(e.message, 'error'),
    })
  }

  return (
    <div className="min-h-dvh pb-32">
      {/* Cabeçalho */}
      <header className="sticky top-0 z-30 border-b border-border bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-2 px-3 py-2">
          <button
            className="btn-icon shrink-0 border-transparent bg-transparent"
            aria-label="Voltar"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/musicas'))}
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base leading-tight font-bold md:text-lg">{song.title}</h1>
            <p className="truncate text-sm text-muted">{song.artist}</p>
          </div>
          <button
            className="btn-icon shrink-0 border-transparent bg-transparent"
            aria-label={song.isFavorite ? 'Remover dos favoritos' : 'Favoritar'}
            aria-pressed={song.isFavorite}
            onClick={() => fav.mutate({ id: song.id, value: !song.isFavorite })}
          >
            <Star className={clsx('size-5', song.isFavorite ? 'fill-accent text-accent' : '')} />
          </button>
          {song.canEdit && (
            <Link to={`/musicas/${song.id}/editar`} className="btn-icon shrink-0 border-transparent bg-transparent" aria-label="Editar">
              <Pencil className="size-5" />
            </Link>
          )}
          <button className="btn-icon shrink-0 border-transparent bg-transparent" aria-label="Tela cheia" onClick={toggleFullscreen}>
            {fullscreen ? <Shrink className="size-5" /> : <Expand className="size-5" />}
          </button>
        </div>

        {sections.length > 1 && (
          <nav aria-label="Seções" className="mx-auto flex max-w-4xl gap-2 overflow-x-auto px-3 pb-2 [scrollbar-width:none]">
            {sections.map((s) => (
              <button
                key={s.index}
                className="chip h-8 shrink-0 text-xs"
                onClick={() => document.getElementById(`linha-${s.index}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                {s.label}
              </button>
            ))}
          </nav>
        )}
      </header>

      <div className="mx-auto max-w-4xl px-4 pt-4">
        {/* Dados da música */}
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          {original && (
            <span>
              Tom original <b className="font-mono text-text">{original}</b>
            </span>
          )}
          {song.personalKey && (
            <span>
              Meu tom <b className="font-mono text-accent">{song.personalKey}</b>
            </span>
          )}
          {song.bpm && <span>{song.bpm} BPM</span>}
          {song.timeSignature && <span>{song.timeSignature}</span>}
          {song.style && <span>{song.style}</span>}
        </div>
        {song.notes && (
          <p className="mb-4 rounded-xl border-l-4 border-accent bg-accent/10 px-3 py-2 text-sm">{song.notes}</p>
        )}
        {hideLyrics && (
          <p className="mb-4 rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">
            A letra desta música não está autorizada para exibição. Mostrando apenas acordes e seções.
          </p>
        )}

        {song.content.trim() ? (
          <ChordSheet
            lines={lines}
            marks={song.marks}
            fontSize={prefs.fontSize}
            lineHeight={prefs.lineHeight}
            showChords={prefs.showChords}
            hideLyrics={hideLyrics}
            currentUserId={session?.user.id}
          />
        ) : (
          <p className="py-10 text-center text-muted">Esta música ainda não tem cifra cadastrada.</p>
        )}
        {!song.canEdit && (
          <div className="mt-8 flex justify-center">
            <ReportButton songId={song.id} />
          </div>
        )}
      </div>

      {/* Painel de leitura */}
      {panelOpen && !locked && (
        <div className="fixed inset-x-3 bottom-24 z-30 mx-auto max-w-md rounded-2xl border border-border bg-surface p-4 shadow-2xl shadow-black/40">
          <Stepper
            label="Tamanho da fonte"
            value={`${prefs.fontSize}px`}
            onMinus={() => setPrefs((p) => ({ ...p, fontSize: Math.max(11, p.fontSize - 1) }))}
            onPlus={() => setPrefs((p) => ({ ...p, fontSize: Math.min(40, p.fontSize + 1) }))}
          />
          <Stepper
            label="Espaçamento"
            value={prefs.lineHeight.toFixed(2)}
            onMinus={() => setPrefs((p) => ({ ...p, lineHeight: Math.max(1.1, +(p.lineHeight - 0.1).toFixed(2)) }))}
            onPlus={() => setPrefs((p) => ({ ...p, lineHeight: Math.min(2.4, +(p.lineHeight + 0.1).toFixed(2)) }))}
          />
          <Stepper
            label="Velocidade da rolagem"
            value={String(prefs.speed)}
            onMinus={() => setPrefs((p) => ({ ...p, speed: Math.max(1, p.speed - 1) }))}
            onPlus={() => setPrefs((p) => ({ ...p, speed: Math.min(10, p.speed + 1) }))}
          />
          <label className="flex h-11 items-center justify-between text-sm">
            Mostrar acordes
            <input
              type="checkbox"
              className="size-5 accent-[var(--accent)]"
              checked={prefs.showChords}
              onChange={(e) => setPrefs((p) => ({ ...p, showChords: e.target.checked }))}
            />
          </label>
        </div>
      )}

      {/* Barra de controles ao vivo */}
      {!locked && (
        <div className="fixed inset-x-0 bottom-0 z-30 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex w-fit max-w-[calc(100%-1.5rem)] items-center gap-1.5 rounded-2xl border border-border bg-surface/95 p-1.5 shadow-2xl shadow-black/40 backdrop-blur">
            <button className="btn-icon" aria-label="Descer meio tom" onClick={() => shift(-1)} disabled={!song.content}>
              <Minus className="size-5" />
            </button>
            <button
              className="flex h-11 min-w-16 flex-col items-center justify-center rounded-xl bg-accent/15 px-3 font-mono leading-none font-bold text-chord"
              onClick={() => setPickerOpen(true)}
              aria-label={`Tom atual ${currentKey ?? ''}. Escolher tom`}
            >
              <span className="text-lg">{currentKey ?? (offset > 0 ? `+${offset}` : offset || '—')}</span>
              {offset !== 0 && <span className="mt-0.5 font-sans text-[10px] font-semibold text-muted">{offset > 0 ? `+${offset}` : offset} st</span>}
            </button>
            <button className="btn-icon" aria-label="Subir meio tom" onClick={() => shift(1)} disabled={!song.content}>
              <Plus className="size-5" />
            </button>
            {offset !== 0 && (
              <button className="btn-icon" aria-label="Voltar ao tom original" onClick={() => setOffset(0)}>
                <RotateCcw className="size-5" />
              </button>
            )}
            <span className="mx-0.5 h-7 w-px bg-border" />
            <button
              className={clsx('btn-icon', panelOpen && 'border-accent text-accent')}
              aria-label="Ajustes de leitura"
              aria-expanded={panelOpen}
              onClick={() => setPanelOpen((o) => !o)}
            >
              <Type className="size-5" />
            </button>
            <button
              className={clsx('btn-icon', scrolling && 'border-accent bg-accent text-accent-ink hover:bg-accent')}
              aria-label={scrolling ? 'Pausar rolagem' : 'Rolagem automática'}
              onClick={() => setScrolling((s) => !s)}
            >
              {scrolling ? <Pause className="size-5" /> : <Play className="size-5" />}
            </button>
            <button
              className="btn-icon"
              aria-label="Bloquear toques"
              onClick={() => {
                setPanelOpen(false)
                setLocked(true)
              }}
            >
              <Lock className="size-5" />
            </button>
          </div>
          {original && personalDiffers && (
            <div className="mt-2 flex justify-center">
              <button className="chip chip-on h-8 bg-surface text-xs" onClick={savePersonalKey} disabled={savePersonal.isPending}>
                {currentKey === original ? 'Usar o tom original como meu tom' : `Salvar ${currentKey} como meu tom`}
              </button>
            </div>
          )}
        </div>
      )}

      {locked && <LockOverlay onUnlock={() => setLocked(false)} />}

      <KeyPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        minor={isMinor}
        current={currentKey}
        original={original}
        personal={song.personalKey}
        onPick={(k) => {
          if (original) setOffset(normalizeOffset(semitonesBetween(original, k)))
          setPickerOpen(false)
        }}
      />
    </div>
  )
}

function Stepper({ label, value, onMinus, onPlus }: { label: string; value: string; onMinus: () => void; onPlus: () => void }) {
  return (
    <div className="flex h-12 items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <button className="btn-icon size-9" onClick={onMinus} aria-label={`Diminuir ${label.toLowerCase()}`}>
          <Minus className="size-4" />
        </button>
        <span className="w-12 text-center font-mono text-sm">{value}</span>
        <button className="btn-icon size-9" onClick={onPlus} aria-label={`Aumentar ${label.toLowerCase()}`}>
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  )
}

/** Bloqueio contra toques acidentais: só destrava segurando o botão. */
function LockOverlay({ onUnlock }: { onUnlock: () => void }) {
  const [holding, setHolding] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const start = () => {
    setHolding(true)
    timer.current = window.setTimeout(onUnlock, 800)
  }
  const cancel = () => {
    setHolding(false)
    window.clearTimeout(timer.current)
  }
  return (
    <div className="fixed inset-0 z-40 touch-pan-y" onContextMenu={(e) => e.preventDefault()}>
      <div className="fixed inset-x-0 bottom-0 flex justify-center pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          className={clsx(
            'flex h-12 items-center gap-2 rounded-full border px-5 text-sm font-semibold backdrop-blur transition',
            holding ? 'scale-105 border-accent bg-accent text-accent-ink' : 'border-border bg-surface/90 text-muted',
          )}
          onPointerDown={start}
          onPointerUp={cancel}
          onPointerLeave={cancel}
          onPointerCancel={cancel}
        >
          {holding ? <Unlock className="size-4" /> : <Lock className="size-4" />}
          Segure para desbloquear
        </button>
      </div>
    </div>
  )
}

/** Rolagem automática suave; para sozinha ao chegar no fim. */
function useAutoScroll(active: boolean, speed: number, onEnd: () => void) {
  const endRef = useRef(onEnd)
  endRef.current = onEnd
  useEffect(() => {
    if (!active) return
    let raf = 0
    let last = performance.now()
    let carry = 0
    const pxPerSecond = speed * 9
    const step = (now: number) => {
      carry += ((now - last) / 1000) * pxPerSecond
      last = now
      const whole = Math.floor(carry)
      if (whole > 0) {
        window.scrollBy(0, whole)
        carry -= whole
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
        endRef.current()
        return
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [active, speed])
}

/** Mantém a tela acesa enquanto a música está aberta (quando o navegador permite). */
function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    const request = () => {
      navigator.wakeLock
        .request('screen')
        .then((l) => (lock = l))
        .catch(() => {})
    }
    const onVisible = () => document.visibilityState === 'visible' && request()
    request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      lock?.release().catch(() => {})
    }
  }, [enabled])
}
