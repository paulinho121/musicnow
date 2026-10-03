import { normalizeOffset, parseSheet, semitonesBetween, transposeKey } from '@ensaio/shared'
import { useQueries } from '@tanstack/react-query'
import { ArrowLeft, Printer } from 'lucide-react'
import clsx from 'clsx'
import { Fragment, useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { ChordSheet } from '../components/ChordSheet'
import { ErrorState, PageSpinner } from '../components/ui'
import { api } from '../lib/api'
import { keys, useSong } from '../lib/queries'
import { useSetlist } from '../lib/setlists'
import type { SongDetail } from '../lib/types'

const dateFmt = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** Opções da impressão, lembradas entre usos. */
function usePrintPrefs() {
  const [prefs, setPrefs] = useState(() => {
    try {
      return {
        fontSize: 13,
        marks: true,
        ...JSON.parse(localStorage.getItem('ef-print') ?? '{}'),
      }
    } catch {
      return { fontSize: 13, marks: true }
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem('ef-print', JSON.stringify(prefs))
    } catch {
      // navegação privada
    }
  }, [prefs])
  return [prefs, setPrefs] as const
}

function Toolbar({
  title,
  prefs,
  setPrefs,
  onBack,
}: {
  title: string
  prefs: { fontSize: number; marks: boolean }
  setPrefs: (p: { fontSize: number; marks: boolean }) => void
  onBack: () => void
}) {
  // A barra não sai no papel (classe no-print).
  return (
    <div className="no-print sticky top-0 z-10 border-b border-border bg-bg/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 px-4 py-3">
        <button className="btn-icon border-transparent bg-transparent" onClick={onBack} aria-label="Voltar">
          <ArrowLeft className="size-5" />
        </button>
        <p className="min-w-0 flex-1 truncate font-semibold">{title}</p>
        <label className="flex items-center gap-2 text-sm text-muted">
          Fonte
          <select
            className="h-9 rounded-lg border border-border bg-surface-2 px-2 text-text"
            value={prefs.fontSize}
            onChange={(e) => setPrefs({ ...prefs, fontSize: Number(e.target.value) })}
          >
            {[11, 12, 13, 14, 16, 18].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            className="size-4 accent-[var(--accent)]"
            checked={prefs.marks}
            onChange={(e) => setPrefs({ ...prefs, marks: e.target.checked })}
          />
          Marcações
        </label>
        <button className="btn-primary" onClick={() => window.print()}>
          <Printer className="size-4" /> Imprimir / Salvar PDF
        </button>
      </div>
      <p className="mx-auto max-w-3xl px-4 pb-2 text-xs text-muted">
        Para PDF, escolha “Salvar como PDF” como impressora. No celular: Compartilhar → Imprimir.
      </p>
    </div>
  )
}

function SongPage({
  song,
  semitones,
  targetKey,
  itemNotes,
  fontSize,
  showMarks,
  index,
}: {
  song: SongDetail
  semitones: number
  targetKey: string | null
  itemNotes?: string | null
  fontSize: number
  showMarks: boolean
  index?: number
}) {
  const lines = parseSheet(song.content, semitones, targetKey)
  return (
    <article className="print-song mx-auto max-w-3xl px-4 py-6">
      <header className="mb-4 border-b border-border pb-3">
        <h2 className="text-xl font-bold">
          {index !== undefined && <span className="mr-2 text-muted">{index + 1}.</span>}
          {song.title}
        </h2>
        <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-muted">
          {song.artist && <span>{song.artist}</span>}
          {song.composer && <span>Composição: {song.composer}</span>}
          {targetKey && (
            <span>
              Tom: <b className="font-mono text-text">{targetKey}</b>
              {song.originalKey && targetKey !== song.originalKey && ` (original ${song.originalKey})`}
            </span>
          )}
          {song.bpm && <span>{song.bpm} BPM</span>}
          {song.timeSignature && <span>{song.timeSignature}</span>}
        </p>
        {itemNotes && (
          <p className="mt-2 text-sm">
            <b>Neste repertório:</b> {itemNotes}
          </p>
        )}
        {song.notes && <p className="mt-1 text-sm text-muted">{song.notes}</p>}
      </header>
      <ChordSheet lines={lines} marks={showMarks ? song.marks : []} fontSize={fontSize} lineHeight={1.35} hideLyrics={song.lyricsHidden} />
    </article>
  )
}

/** /musicas/:id/imprimir?st=2 — uma música, no tom escolhido. */
export function PrintSong() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { data: song, isLoading, error } = useSong(id)
  const [prefs, setPrefs] = usePrintPrefs()

  if (isLoading) return <PageSpinner />
  if (error || !song) return <ErrorState error={error ?? new Error('Música não encontrada.')} />

  const st = normalizeOffset(Number(params.get('st')) || 0)
  const targetKey = song.originalKey ? transposeKey(song.originalKey, st) : null
  return (
    <div className="print-root min-h-dvh">
      <Toolbar title={song.title} prefs={prefs} setPrefs={setPrefs} onBack={() => navigate(-1)} />
      <SongPage song={song} semitones={st} targetKey={targetKey} fontSize={prefs.fontSize} showMarks={prefs.marks} />
    </div>
  )
}

/** /repertorios/:id/imprimir — capa com a ordem + cada música no tom do repertório. */
export function PrintSetlist() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: s, isLoading, error } = useSetlist(id)
  const [prefs, setPrefs] = usePrintPrefs()
  const songs = useQueries({
    queries: (s?.items ?? []).map((it) => ({
      queryKey: keys.song(it.song.id, s!.id),
      queryFn: () => api<SongDetail>(`/songs/${it.song.id}?setlistId=${s!.id}`),
    })),
  })

  if (isLoading || songs.some((q) => q.isLoading)) return <PageSpinner />
  if (error || !s) return <ErrorState error={error ?? new Error('Repertório não encontrado.')} />

  return (
    <div className="print-root min-h-dvh">
      <Toolbar
        title={`${s.name} · ${s.items.length} músicas`}
        prefs={prefs}
        setPrefs={setPrefs}
        onBack={() => navigate(`/repertorios/${s.id}`)}
      />

      <section className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="text-2xl font-bold">{s.name}</h1>
        <p className="mt-1 text-sm text-muted first-letter:uppercase">
          {[s.eventDate && dateFmt.format(new Date(s.eventDate)), s.location, s.groupName].filter(Boolean).join(' · ')}
        </p>
        {s.notes && <p className="mt-3 text-sm whitespace-pre-line">{s.notes}</p>}
        <table className="mt-5 w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="py-1.5 pr-2 font-medium">#</th>
              <th className="py-1.5 pr-2 font-medium">Música</th>
              <th className="py-1.5 pr-2 font-medium">Tom</th>
              <th className="py-1.5 pr-2 font-medium">BPM</th>
              <th className="py-1.5 font-medium">Observação</th>
            </tr>
          </thead>
          <tbody>
            {s.items.map((it, i) => {
              const block = it.blockId && it.blockId !== s.items[i - 1]?.blockId ? s.blocks.find((b) => b.id === it.blockId) : null
              return (
                <Fragment key={it.id}>
                  {/* Começo de bloco: uma linha com nome, estilo e BPM */}
                  {block && (
                    <tr>
                      <td colSpan={5} className="pt-3 pb-1 font-bold uppercase">
                        {block.name}
                        <span className="ml-2 font-normal text-muted normal-case">
                          {[block.style, block.bpm ? `${block.bpm} BPM` : null].filter(Boolean).join(' · ')}
                        </span>
                      </td>
                    </tr>
                  )}
                  <tr className="border-b border-border align-top">
                    <td className="py-1.5 pr-2 font-mono text-muted">{i + 1}</td>
                    <td className="py-1.5 pr-2">
                      <b>{it.song.title}</b>
                      {it.song.artist && <span className="block text-xs text-muted">{it.song.artist}</span>}
                    </td>
                    <td className="py-1.5 pr-2 font-mono font-bold">{it.key ?? it.song.originalKey ?? '—'}</td>
                    <td className="py-1.5 pr-2">{it.bpm ?? it.song.bpm ?? ''}</td>
                    <td className="py-1.5 text-muted">{it.notes}</td>
                  </tr>
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </section>

      {s.items.map((it, i) => {
        const song = songs[i]?.data
        if (!song) return null
        const target = it.key ?? song.originalKey
        const st = song.originalKey && target ? normalizeOffset(semitonesBetween(song.originalKey, target)) : 0
        return (
          <div key={it.id} className="print-break">
            <SongPage
              song={song}
              semitones={st}
              targetKey={target}
              itemNotes={it.notes}
              fontSize={prefs.fontSize}
              showMarks={prefs.marks}
              index={i}
            />
          </div>
        )
      })}
    </div>
  )
}

const SHEET_SIZES = [
  { id: 'normal', label: 'Normal', px: 18 },
  { id: 'grande', label: 'Grande', px: 24 },
  { id: 'gigante', label: 'Gigante', px: 32 },
] as const
type SheetSize = (typeof SHEET_SIZES)[number]['id']

// Cores fortes que saem bem impressas (inclusive em impressora comum).
const STAGE_COLORS = ['#d32f2f', '#c2410c', '#1d4ed8', '#047857', '#7c3aed', '#be185d']

/**
 * /repertorios/:id/folha — folha de palco: só a ordem, com blocos e tons, em letra grande.
 * É a folha que o músico cola no chão do palco ou no pedestal.
 */
export function PrintStageSheet() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: s, isLoading, error } = useSetlist(id)
  const [size, setSize] = useState<SheetSize>(() => {
    try {
      const saved = localStorage.getItem('ef-stage-sheet')
      return SHEET_SIZES.some((x) => x.id === saved) ? (saved as SheetSize) : 'grande'
    } catch {
      return 'grande'
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem('ef-stage-sheet', size)
    } catch {
      // navegação privada
    }
  }, [size])

  if (isLoading) return <PageSpinner />
  if (error || !s) return <ErrorState error={error ?? new Error('Repertório não encontrado.')} />

  const px = SHEET_SIZES.find((x) => x.id === size)!.px
  const loose = s.items.filter((i) => !i.blockId)
  const groups = [
    ...(loose.length ? [{ block: null, items: loose }] : []),
    ...s.blocks.map((b) => ({
      block: b,
      items: s.items.filter((i) => i.blockId === b.id),
    })),
  ]
  // Muitas músicas: duas colunas, para caber numa folha só.
  const twoColumns = s.items.length + s.blocks.length > (size === 'gigante' ? 12 : size === 'grande' ? 18 : 26)

  return (
    <div className="print-root min-h-dvh">
      <div className="no-print sticky top-0 z-10 border-b border-border bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 px-4 py-3">
          <button
            className="btn-icon border-transparent bg-transparent"
            onClick={() => navigate(`/repertorios/${s.id}`)}
            aria-label="Voltar"
          >
            <ArrowLeft className="size-5" />
          </button>
          <p className="min-w-0 flex-1 truncate font-semibold">Folha de palco</p>
          <div className="flex rounded-xl border border-border p-0.5" role="group" aria-label="Tamanho da letra">
            {SHEET_SIZES.map((x) => (
              <button
                key={x.id}
                className={clsx('h-8 rounded-lg px-2.5 text-sm', size === x.id ? 'bg-accent font-semibold text-accent-ink' : 'text-muted')}
                onClick={() => setSize(x.id)}
                aria-pressed={size === x.id}
              >
                {x.label}
              </button>
            ))}
          </div>
          <button className="btn-primary h-9 px-3" onClick={() => window.print()}>
            <Printer className="size-4" /> Imprimir / PDF
          </button>
        </div>
      </div>

      <section
        className="mx-auto my-4 max-w-3xl rounded-xl bg-white px-6 py-8 text-black shadow-xl print:my-0 print:rounded-none print:shadow-none"
        style={{ fontSize: px }}
      >
        <h1 className="text-center text-[1.5em] font-black tracking-wide uppercase">{s.name}</h1>
        {s.eventDate && (
          <p className="mb-[0.8em] text-center text-[0.6em] text-neutral-600 first-letter:uppercase">
            {dateFmt.format(new Date(s.eventDate))}
          </p>
        )}
        <div className={twoColumns ? 'gap-[1.5em] sm:columns-2 print:columns-2' : ''}>
          {groups.map(({ block, items }, gi) => {
            const color = block ? STAGE_COLORS[(gi - (loose.length ? 1 : 0)) % STAGE_COLORS.length] : '#111'
            return (
              <div key={block?.id ?? 'loose'} className="mb-[0.7em] break-inside-avoid">
                {block && (
                  <p className="leading-tight font-black uppercase" style={{ color }}>
                    {block.name}
                    {(block.style || block.bpm) && (
                      <span className="text-[0.8em]"> ({[block.style, block.bpm].filter(Boolean).join(' - ')})</span>
                    )}
                  </p>
                )}
                <ul className="mt-[0.15em]">
                  {items.map((it) => (
                    <li key={it.id} className="flex items-baseline gap-[0.4em] leading-snug">
                      <span className="text-[0.6em]">●</span>
                      <span className="min-w-0">
                        {it.song.title}
                        {(it.key ?? it.song.originalKey) && <b className="font-mono"> - {it.key ?? it.song.originalKey}</b>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
