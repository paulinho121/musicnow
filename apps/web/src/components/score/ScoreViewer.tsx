import { INSTRUMENTS, type Instrument } from '@ensaio/shared'
import clsx from 'clsx'
import { ChevronLeft, ChevronRight, Loader2, Maximize, Pencil, Trash2, X } from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMe } from '../../lib/queries'
import { scorePageUrl, useScoreActions } from '../../lib/scores'
import { formatBytes } from '../../lib/scoreProcess'
import type { ScorePart } from '../../lib/types'
import { Sheet } from '../Sheet'
import { useToast } from '../ui'

/** Parte que abre primeiro: a escolhida antes nesta música, a do instrumento do músico ou a primeira. */
function useChosenPart(songId: string, parts: ScorePart[]) {
  const { data: me } = useMe()
  const storageKey = `ef-score-part:${songId}`
  const [chosen, setChosen] = useState<string | null>(() => {
    try {
      return localStorage.getItem(storageKey)
    } catch {
      return null
    }
  })
  const mine = new Set(me?.instruments.map((i) => i.instrument))
  const primary = me?.instruments.find((i) => i.primary)?.instrument
  const part =
    parts.find((p) => p.id === chosen) ??
    parts.find((p) => p.instrument && p.instrument === primary) ??
    parts.find((p) => p.instrument && mine.has(p.instrument)) ??
    parts[0]
  const choose = (id: string) => {
    setChosen(id)
    try {
      localStorage.setItem(storageKey, id)
    } catch {
      // navegação privada
    }
  }
  return [part, choose] as const
}

/** Leitor da partitura: rolagem normal ou "modo palco" (página a página, com pedal). */
export function ScoreViewer({ songId, parts, canEdit = false }: { songId: string; parts: ScorePart[]; canEdit?: boolean }) {
  const [part, choose] = useChosenPart(songId, parts)
  const [stagePage, setStagePage] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)
  if (!part) return null

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {parts.length > 1 &&
          parts.map((p) => (
            <button key={p.id} className={clsx('chip h-8 text-sm', p.id === part.id && 'chip-on')} onClick={() => choose(p.id)}>
              {p.label}
            </button>
          ))}
        {canEdit && (
          <button className="btn-icon ml-auto size-9" onClick={() => setEditing(true)} aria-label={`Editar a parte ${part.label}`} title="Renomear ou apagar esta parte">
            <Pencil className="size-4" />
          </button>
        )}
        <button className={clsx('btn-primary h-9 px-3 text-sm', !canEdit && 'ml-auto')} onClick={() => setStagePage(0)}>
          <Maximize className="size-4" /> Modo palco
        </button>
      </div>

      {/* Rolagem: páginas em sequência, com o espaço já reservado (não "pula" ao carregar) */}
      <div className="space-y-3">
        {part.pages.map((p, i) => (
          <button
            key={`${part.id}-${i}`}
            className="relative block w-full overflow-hidden rounded-xl bg-white shadow-lg shadow-black/30"
            style={{ aspectRatio: `${p.w} / ${p.h}` }}
            onClick={() => setStagePage(i)}
            aria-label={`Abrir a página ${i + 1} no modo palco`}
          >
            <img src={scorePageUrl(part.id, i)} alt={`${part.label}, página ${i + 1}`} className="size-full object-contain" loading={i < 2 ? 'eager' : 'lazy'} />
            <span className="absolute right-2 bottom-2 rounded-md bg-black/60 px-1.5 py-0.5 text-xs font-semibold text-white">
              {i + 1}/{part.pages.length}
            </span>
          </button>
        ))}
      </div>

      {stagePage !== null && <StageReader part={part} start={stagePage} onClose={() => setStagePage(null)} />}
      {canEdit && <PartDialog songId={songId} part={part} open={editing} onClose={() => setEditing(false)} />}
    </div>
  )
}

/** Renomear a parte, trocar o instrumento que a abre ou apagar (libera o espaço). */
function PartDialog({ songId, part, open, onClose }: { songId: string; part: ScorePart; open: boolean; onClose: () => void }) {
  const { update, remove } = useScoreActions(songId)
  const toast = useToast()
  const [label, setLabel] = useState(part.label)
  const [instrument, setInstrument] = useState<Instrument | null>(part.instrument)

  useEffect(() => {
    if (!open) return
    setLabel(part.label)
    setInstrument(part.instrument)
  }, [open, part])

  const save = (e: FormEvent) => {
    e.preventDefault()
    if (!label.trim()) return
    update.mutate({ id: part.id, label: label.trim(), instrument }, { onSuccess: onClose, onError: (err) => toast(err.message, 'error') })
  }
  const del = () => {
    if (!confirm(`Apagar a parte "${part.label}" (${part.pages.length} páginas)? Não dá para desfazer.`)) return
    remove.mutate(part.id, {
      onSuccess: () => {
        toast(`Parte apagada. ${formatBytes(part.totalBytes)} liberados.`)
        onClose()
      },
      onError: (err) => toast(err.message, 'error'),
    })
  }

  return (
    <Sheet open={open} onClose={onClose} title="Editar parte">
      <form onSubmit={save} className="space-y-4">
        <label className="block">
          <span className="label">Nome da parte</span>
          <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} autoFocus />
        </label>
        <label className="block">
          <span className="label">Abre direto para quem toca</span>
          <select className="input" value={instrument ?? ''} onChange={(e) => setInstrument((e.target.value || null) as Instrument | null)}>
            <option value="">qualquer instrumento</option>
            {Object.entries(INSTRUMENTS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-muted">
          {part.pages.length} {part.pages.length === 1 ? 'página' : 'páginas'} · {formatBytes(part.totalBytes)}
        </p>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost text-danger" onClick={del} disabled={remove.isPending}>
            {remove.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Apagar
          </button>
          <button className="btn-primary flex-1" disabled={update.isPending || !label.trim()}>
            {update.isPending && <Loader2 className="size-4 animate-spin" />} Salvar
          </button>
        </div>
      </form>
    </Sheet>
  )
}

/**
 * Tela cheia, página a página. Toque na direita avança, na esquerda volta.
 * Pedais Bluetooth (AirTurn, PageFlip...) funcionam como teclado: setas, PageDown/PageUp, espaço.
 * Em tela deitada e larga (tablet), mostra duas páginas lado a lado.
 */
function StageReader({ part, start, onClose }: { part: ScorePart; start: number; onClose: () => void }) {
  const total = part.pages.length
  const [page, setPage] = useState(start)
  const [twoUp, setTwoUp] = useState(() => window.innerWidth > window.innerHeight * 1.25)
  const step = twoUp ? 2 : 1
  const go = useCallback((delta: number) => setPage((p) => Math.max(0, Math.min(total - 1, p + delta))), [total])

  useEffect(() => {
    const onResize = () => setTwoUp(window.innerWidth > window.innerHeight * 1.25)
    // Captura antes das outras telas: com o leitor aberto, o pedal só vira página.
    const onKey = (e: KeyboardEvent) => {
      e.stopImmediatePropagation()
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) {
        e.preventDefault()
        go(step)
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) {
        e.preventDefault()
        go(-step)
      } else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('keydown', onKey, { capture: true })
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Tela cheia de verdade quando o navegador deixa (some a barra do navegador).
    document.documentElement.requestFullscreen?.().catch(() => {})
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', onKey, { capture: true })
      document.body.style.overflow = overflow
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
  }, [go, step, onClose])

  // Com duas páginas, a da esquerda é sempre par (1-2, 3-4...).
  const first = twoUp ? page - (page % 2) : page
  const shown = twoUp ? [first, first + 1].filter((n) => n < total) : [page]
  // Já baixa a próxima, para virar sem esperar.
  const preload = shown[shown.length - 1] + 1

  return createPortal(
    <div className="fixed inset-0 z-[90] flex flex-col bg-neutral-900 select-none">
      <div className="flex shrink-0 items-center gap-2 px-3 py-2 text-sm text-white/80">
        <span className="min-w-0 flex-1 truncate font-semibold">{part.label}</span>
        <span className="tabular-nums">
          {shown.map((n) => n + 1).join('–')} / {total}
        </span>
        <button className="grid size-10 place-items-center rounded-lg hover:bg-white/10" onClick={onClose} aria-label="Sair do modo palco">
          <X className="size-5" />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-stretch justify-center gap-1 px-1 pb-1">
        {shown.map((n) => (
          <img key={n} src={scorePageUrl(part.id, n)} alt={`Página ${n + 1}`} className="h-full min-w-0 flex-1 rounded bg-white object-contain" draggable={false} />
        ))}
        {preload < total && <img src={scorePageUrl(part.id, preload)} alt="" className="hidden" aria-hidden />}
        {/* Áreas de toque: 1/3 esquerdo volta, 2/3 direitos avançam */}
        <button className="absolute inset-y-0 left-0 w-1/3" onClick={() => go(-step)} aria-label="Página anterior" />
        <button className="absolute inset-y-0 right-0 w-2/3" onClick={() => go(step)} aria-label="Próxima página" />
      </div>
      <div className="flex shrink-0 items-center justify-center gap-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-white/70">
        <button className="grid size-10 place-items-center rounded-lg hover:bg-white/10 disabled:opacity-30" onClick={() => go(-step)} disabled={first === 0} aria-label="Página anterior">
          <ChevronLeft className="size-5" />
        </button>
        <span className="text-xs">Toque na direita para avançar · funciona com pedal Bluetooth</span>
        <button
          className="grid size-10 place-items-center rounded-lg hover:bg-white/10 disabled:opacity-30"
          onClick={() => go(step)}
          disabled={shown[shown.length - 1] >= total - 1}
          aria-label="Próxima página"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>
    </div>,
    document.body,
  )
}
