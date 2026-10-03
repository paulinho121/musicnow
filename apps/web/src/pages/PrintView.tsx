import { normalizeOffset, parseSheet, semitonesBetween, transposeKey } from '@ensaio/shared'
import { useQueries } from '@tanstack/react-query'
import { ArrowLeft, Printer } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { ChordSheet } from '../components/ChordSheet'
import { ErrorState, PageSpinner } from '../components/ui'
import { api } from '../lib/api'
import { keys, useSong } from '../lib/queries'
import { useSetlist } from '../lib/setlists'
import type { SongDetail } from '../lib/types'

const dateFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/** Opções da impressão, lembradas entre usos. */
function usePrintPrefs() {
  const [prefs, setPrefs] = useState(() => {
    try {
      return { fontSize: 13, marks: true, ...JSON.parse(localStorage.getItem('ef-print') ?? '{}') }
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
          <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={prefs.marks} onChange={(e) => setPrefs({ ...prefs, marks: e.target.checked })} />
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

function SongPage({ song, semitones, targetKey, itemNotes, fontSize, showMarks, index }: {
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
        {itemNotes && <p className="mt-2 text-sm"><b>Neste repertório:</b> {itemNotes}</p>}
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
      <Toolbar title={`${s.name} · ${s.items.length} músicas`} prefs={prefs} setPrefs={setPrefs} onBack={() => navigate(`/repertorios/${s.id}`)} />

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
            {s.items.map((it, i) => (
              <tr key={it.id} className="border-b border-border align-top">
                <td className="py-1.5 pr-2 font-mono text-muted">{i + 1}</td>
                <td className="py-1.5 pr-2">
                  <b>{it.song.title}</b>
                  {it.song.artist && <span className="block text-xs text-muted">{it.song.artist}</span>}
                </td>
                <td className="py-1.5 pr-2 font-mono font-bold">{it.key ?? it.song.originalKey ?? '—'}</td>
                <td className="py-1.5 pr-2">{it.bpm ?? it.song.bpm ?? ''}</td>
                <td className="py-1.5 text-muted">{it.notes}</td>
              </tr>
            ))}
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
            <SongPage song={song} semitones={st} targetKey={target} itemNotes={it.notes} fontSize={prefs.fontSize} showMarks={prefs.marks} index={i} />
          </div>
        )
      })}
    </div>
  )
}
