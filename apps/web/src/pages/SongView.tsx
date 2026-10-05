import { atLeast, chordsInSheet, fileNameFor, guitarVoicings, normalizeOffset, parseChord, semitonesBetween, songInKey, toChordPro, transposeKey } from '@ensaio/shared'
import clsx from 'clsx'
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  EllipsisVertical,
  Expand,
  FileDown,
  FileText,
  FileUp,
  ListMusic,
  ListPlus,
  Lock,
  LogOut,
  Minus,
  Pause,
  Pencil,
  Play,
  Plus,
  Printer,
  RotateCcw,
  Share2,
  Shrink,
  Star,
  Tag,
  Type,
  Unlock,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { AddToSetlistButton } from '../components/AddToSetlist'
import { GuitarDiagram } from '../components/ChordDiagrams'
import { ChordDialog } from '../components/ChordDictionary'
import { ChordSheet, sectionsOf, useSheet } from '../components/ChordSheet'
import { FindLinks } from '../components/FindLinks'
import { KeyPicker } from '../components/KeyPicker'
import { LiveStrip, type LiveControls } from '../components/LiveStrip'
import { MarkDialog } from '../components/MarkDialog'
import { ReferencePlayer } from '../components/ReferencePlayer'
import { ReportButton } from '../components/ReportDialog'
import { ScoreUploadDialog } from '../components/score/ScoreUploadDialog'
import { ScoreViewer } from '../components/score/ScoreViewer'
import { ShareSongDialog } from '../components/ShareSongDialog'
import { Sheet } from '../components/Sheet'
import { CoverGlow, SongCover } from '../components/SongCover'
import { UsageBadge } from '../components/UsageBadge'
import { ErrorState, PageSpinner, useToast } from '../components/ui'
import { useSession } from '../lib/auth'
import { useDeleteMark, useSavePersonalKey, useSong, useToggleFavorite } from '../lib/queries'
import { downloadText } from '../lib/download'
import { useLeaveSharedSong } from '../lib/songShare'
import { useLocalState } from '../lib/storage'
import type { SongMark } from '../lib/types'

const VIEWER_DEFAULTS = { fontSize: 17, lineHeight: 1.45, speed: 3, showChords: true, chordStrip: false, wrap: true, view: 'chord' as 'chord' | 'score' }

export interface BlockInfo {
  name: string
  /** "Marília · 130 BPM" */
  subtitle: string
  color: string
}

/** Contexto quando a música é tocada dentro de um repertório. */
export interface SetlistContext {
  id: string
  name: string
  position: number
  total: number
  /** Tom definido para esta música no repertório (null = tom original). */
  itemKey: string | null
  itemNotes: string | null
  prev?: { title: string; go: () => void }
  /** `block` vem preenchido quando a próxima música abre outro bloco. */
  next?: { title: string; go: () => void; block?: BlockInfo }
  /** Bloco desta música (repertório de barzinho/baile). */
  block?: BlockInfo & { song: number; songs: number }
  onExit: () => void
  /** Modo Palco (tempo real). */
  live?: LiveControls
  /** O líder mandou rolar até uma linha (nonce muda a cada comando). */
  scrollTarget?: { line: number | null; nonce: number }
  /**
   * Tom da banda ao vivo: string = o líder escolheu esse tom; null = o tom do repertório;
   * undefined = fora do Modo Palco (cada um no seu tom).
   */
  liveKey?: string | null
  /** Só para quem comanda: avisa a banda quando o tom muda. */
  onLiveKeyChange?: (key: string | null) => void
}

/** Rota /musicas/:id — a música solta. */
export function SongView() {
  const { id } = useParams()
  return <SongViewer songId={id!} />
}

export function SongViewer({ songId, setlist }: { songId: string; setlist?: SetlistContext }) {
  const navigate = useNavigate()
  const toast = useToast()
  const { data: session } = useSession()
  const { data: song, isLoading, error, refetch } = useSong(songId, setlist?.id)
  const fav = useToggleFavorite()
  const savePersonal = useSavePersonalKey(songId)
  const deleteMark = useDeleteMark(songId)

  const [prefs, setPrefs] = useLocalState('ef-viewer', VIEWER_DEFAULTS)
  const [offset, setOffset] = useState(0)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [scrolling, setScrolling] = useState(false)
  const [locked, setLocked] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [markMode, setMarkMode] = useState(false)
  const [markLine, setMarkLine] = useState<number | null>(null)
  const [chordOpen, setChordOpen] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const leaveShared = useLeaveSharedSong(songId)
  // Cifra ou partitura: a escolha vale para as próximas músicas (quem lê partitura não troca a cada uma).
  const setViewMode = (view: 'chord' | 'score') => setPrefs((p) => ({ ...p, view }))
  const [uploadScoreOpen, setUploadScoreOpen] = useState(false)

  // Tom inicial: o do repertório; fora dele, o tom pessoal do músico; senão, o original.
  const inLiveSync = setlist?.liveKey !== undefined
  const baseKey = inLiveSync ? (setlist?.liveKey ?? setlist?.itemKey ?? null) : (setlist?.itemKey ?? song?.personalKey ?? null)
  const initialized = useRef<string | null>(null)
  useEffect(() => {
    if (!song) return
    const marker = `${song.id}|${setlist?.id ?? ''}|${setlist?.itemKey ?? ''}|${inLiveSync ? 'ao-vivo' : ''}`
    if (initialized.current === marker) return
    initialized.current = marker
    setOffset(song.originalKey && baseKey ? normalizeOffset(semitonesBetween(song.originalKey, baseKey)) : 0)
  }, [song, setlist?.id, setlist?.itemKey, baseKey])

  // Trocou de música no repertório: volta ao topo e para a rolagem.
  useEffect(() => {
    window.scrollTo(0, 0)
    setScrolling(false)
    setMarkLine(null)
  }, [songId])

  // Comando do líder no Modo Palco: rola até a seção (ou o topo) escolhida por ele.
  const scrollTarget = setlist?.scrollTarget
  useEffect(() => {
    if (!scrollTarget) return
    const t = setTimeout(() => {
      // Em segundo plano (tela apagada, outro app) a rolagem suave não acontece:
      // aí rola direto, para a pessoa voltar já no lugar certo.
      const behavior: ScrollBehavior = document.hidden ? 'auto' : 'smooth'
      if (scrollTarget.line == null) window.scrollTo({ top: 0, behavior })
      else document.getElementById(`linha-${scrollTarget.line}`)?.scrollIntoView({ behavior, block: 'start' })
    }, 150)
    return () => clearTimeout(t)
    // Só o nonce importa: o mesmo comando repetido (mesma seção) deve rolar de novo.
  }, [scrollTarget?.nonce])

  const original = song?.originalKey ?? null
  const currentKey = original ? transposeKey(original, offset) : null
  const isMinor = original ? (parseChord(original)?.suffix ?? '').startsWith('m') : false
  const lines = useSheet(song?.content ?? '', offset, currentKey)
  // Partitura quando a pessoa escolheu ver partitura (ou a música só tem partitura, sem cifra).
  const hasScores = Boolean(song?.scores?.length)
  const viewMode: 'chord' | 'score' = hasScores && (prefs.view === 'score' || !song?.content.trim()) ? 'score' : 'chord'
  const sections = sectionsOf(lines)
  const songChords = useMemo(() => chordsInSheet(lines), [lines])

  const shift = useCallback((d: number) => setOffset((o) => normalizeOffset(o + d)), [])

  // Ao vivo: quando o líder muda o tom, todos que seguem vão para o mesmo tom.
  // (Quem segue pode mudar o seu na hora, ex.: capotraste; volta ao do líder na próxima mudança.)
  const liveKey = setlist?.liveKey
  const repertoireKey = setlist?.itemKey ?? original
  useEffect(() => {
    if (liveKey === undefined || !original) return
    const target = liveKey ?? repertoireKey
    if (target && target !== transposeKey(original, offset)) setOffset(normalizeOffset(semitonesBetween(original, target)))
    // Só quando o tom do líder muda (não a cada toque local de quem segue).
  }, [liveKey, original])

  // Quem comanda: avisa a banda meio segundo depois do último toque em +/− (sem tremer a tela de todos).
  const onLiveKeyChange = setlist?.onLiveKeyChange
  useEffect(() => {
    if (!onLiveKeyChange || !currentKey) return
    const bandKey = liveKey ?? repertoireKey
    if (currentKey === bandKey) return
    const t = setTimeout(() => onLiveKeyChange(currentKey === repertoireKey ? null : currentKey), 500)
    return () => clearTimeout(t)
  }, [currentKey, liveKey, repertoireKey, onLiveKeyChange])
  const next = setlist?.next
  const prev = setlist?.prev

  useAutoScroll(scrolling, prefs.speed, () => setScrolling(false))
  const headerHidden = useHideOnScroll() && !markMode
  useWakeLock(Boolean(song))

  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  // Teclado e pedais Bluetooth (que enviam setas / PageDown). No fim da página,
  // "avançar" passa para a próxima música do repertório.
  useEffect(() => {
    const atBottom = () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4
    const atTop = () => window.scrollY <= 4
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      if (e.key === ' ') {
        e.preventDefault()
        setScrolling((s) => !s)
      } else if (e.key === 'PageDown' || e.key === 'ArrowRight') {
        e.preventDefault()
        if (atBottom() && next) next.go()
        else window.scrollBy({ top: window.innerHeight * 0.75, behavior: 'smooth' })
      } else if (e.key === 'PageUp' || e.key === 'ArrowLeft') {
        e.preventDefault()
        if (atTop() && prev) prev.go()
        else window.scrollBy({ top: -window.innerHeight * 0.75, behavior: 'smooth' })
      } else if (!locked && (e.key === '+' || e.key === '=')) shift(1)
      else if (!locked && e.key === '-') shift(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [locked, shift, next, prev])

  if (isLoading) return <PageSpinner />
  if (error || !song)
    return (
      <div className="mx-auto max-w-lg p-4 pt-10">
        <ErrorState error={error ?? new Error('Música não encontrada.')} onRetry={() => refetch()} />
      </div>
    )

  const hideLyrics = song.lyricsHidden
  const uid = session?.user.id
  // Fora de repertório, oferece salvar o tom pessoal; dentro dele, o tom é o da banda.
  const personalDiffers = !setlist && currentKey !== (song.personalKey ?? original)

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

  const canDelete = (m: SongMark) => m.authorId === uid || (Boolean(m.setlistId) && atLeast(song.setlistRole, 'admin'))
  const onMarkClick = (m: SongMark) => {
    if (!canDelete(m)) return toast('Só quem criou esta marcação pode apagá-la.', 'error')
    if (!confirm(`Apagar a marcação "${m.text ?? m.type}"?`)) return
    deleteMark.mutate(m.id, { onSuccess: () => toast('Marcação apagada.'), onError: (e) => toast(e.message, 'error') })
  }

  const lineText = markLine !== null ? (song.content.split('\n')[markLine] ?? '') : ''
  const resetLabel = setlist?.itemKey ? `Voltar ao tom do repertório (${setlist.itemKey})` : 'Voltar ao tom original'

  return (
    <div className="min-h-dvh pb-36">
      <header
        className={clsx(
          'sticky top-0 z-30 border-b border-border bg-bg/95 backdrop-blur transition-transform duration-200',
          headerHidden && '-translate-y-full',
        )}
      >
        {setlist && (
          <div className="flex items-center gap-1 border-b border-border bg-surface/60 px-2 py-1">
            <button className="btn-icon size-9 shrink-0 border-transparent bg-transparent" onClick={setlist.onExit} aria-label="Voltar ao repertório">
              <ListMusic className="size-4" />
            </button>
            <p className="min-w-0 flex-1 truncate text-xs text-muted">
              <b className="text-text">{setlist.name}</b> · {setlist.position + 1} de {setlist.total}
            </p>
            <button className="btn-icon size-9 shrink-0" onClick={prev?.go} disabled={!prev} aria-label="Música anterior">
              <ChevronLeft className="size-4" />
            </button>
            <button className="btn-icon size-9 shrink-0" onClick={next?.go} disabled={!next} aria-label="Próxima música">
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
        {setlist?.live && <LiveStrip live={setlist.live} />}
        <div className="mx-auto flex max-w-4xl items-center gap-1 px-2 py-2">
          <button
            className="btn-icon shrink-0 border-transparent bg-transparent"
            aria-label="Voltar"
            onClick={() => (setlist ? setlist.onExit() : window.history.length > 1 ? navigate(-1) : navigate('/musicas'))}
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="line-clamp-2 text-base leading-tight font-bold break-words sm:truncate md:text-lg">{song.title}</h1>
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
          <button
            className={clsx('btn-icon shrink-0', markMode ? 'border-accent bg-accent/15 text-accent' : 'border-transparent bg-transparent')}
            aria-label={markMode ? 'Sair do modo de marcar' : 'Marcar trechos'}
            aria-pressed={markMode}
            onClick={() => {
              setMarkMode((m) => !m)
              setScrolling(false)
            }}
          >
            <Tag className="size-5" />
          </button>
          {!setlist && (
            <AddToSetlistButton
              songId={song.id}
              songTitle={song.title}
              isPrivate={song.visibility === 'private'}
              className="hidden sm:inline-flex"
              open={addOpen}
              onOpenChange={setAddOpen}
            />
          )}
          {song.canEdit && !setlist && (
            <button
              className="btn-icon hidden shrink-0 border-transparent bg-transparent sm:inline-flex"
              aria-label="Compartilhar música"
              title="Compartilhar com outra pessoa"
              onClick={() => setShareOpen(true)}
            >
              <Share2 className="size-5" />
            </button>
          )}
          {song.canEdit && !setlist && (
            <Link to={`/musicas/${song.id}/editar`} className="btn-icon hidden shrink-0 border-transparent bg-transparent sm:inline-flex" aria-label="Editar">
              <Pencil className="size-5" />
            </Link>
          )}
          {song.scores && song.scores.length > 0 && (
            <button
              className={clsx(
                'btn-icon shrink-0',
                viewMode === 'score' ? 'border-accent bg-accent/15 text-accent' : 'border-transparent bg-transparent',
              )}
              aria-label={viewMode === 'score' ? 'Ver cifra' : 'Ver partitura'}
              title={viewMode === 'score' ? 'Ver cifra' : 'Ver partitura'}
              onClick={() => setViewMode(viewMode === 'score' ? 'chord' : 'score')}
            >
              <FileText className="size-5" />
            </button>
          )}
          {/* Celular: as ações menos usadas ficam num menu, para o título ter espaço. */}
          {!setlist && (
            <button className="btn-icon shrink-0 border-transparent bg-transparent sm:hidden" aria-label="Mais opções" onClick={() => setMoreOpen(true)}>
              <EllipsisVertical className="size-5" />
            </button>
          )}
        </div>

        {markMode ? (
          <p className="bg-accent/10 px-4 py-2 text-center text-xs text-accent">
            Toque numa linha para marcar · toque numa marcação para apagar
          </p>
        ) : (
          sections.length > 1 && (
            <nav aria-label="Seções" className="mx-auto flex max-w-4xl gap-2 overflow-x-auto px-3 pb-2 [scrollbar-width:none]">
              {sections.map((s) => (
                <button
                  key={s.index}
                  className="chip h-8 shrink-0 text-xs"
                  onClick={() => {
                    document.getElementById(`linha-${s.index}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    // No comando, a seção vai também para a tela de toda a banda.
                    if (setlist?.live?.isLeader && setlist.live.stage) setlist.live.onSection(s.index)
                  }}
                >
                  {s.label}
                </button>
              ))}
            </nav>
          )
        )}
      </header>

      <div className="mx-auto max-w-4xl px-4 pt-4">
        {/* Destaque: capa, nome e as informações para tocar */}
        <section className="relative mb-5 overflow-hidden rounded-3xl border border-border bg-surface">
          <CoverGlow song={song} />
          <div className="relative flex items-center gap-4 p-4 sm:gap-6 sm:p-6">
            <SongCover
              song={song}
              hd
              className={clsx('rounded-2xl shadow-2xl shadow-black/50', setlist ? 'size-20 sm:size-28' : 'size-24 sm:size-36')}
            />
            <div className="min-w-0 flex-1">
              {setlist?.block ? (
                // No show: em que bloco a banda está (com a cor do bloco)
                <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] font-bold tracking-widest uppercase" style={{ color: setlist.block.color }}>
                  {setlist.block.name}
                  <span className="font-semibold tracking-normal text-muted normal-case">
                    {[setlist.block.subtitle, `${setlist.block.song} de ${setlist.block.songs}`].filter(Boolean).join(' · ')}
                  </span>
                </p>
              ) : (
                <p className="text-[11px] font-bold tracking-widest text-muted uppercase">{song.style ?? 'Música'}</p>
              )}
              <h2 className="mt-0.5 line-clamp-2 text-xl leading-tight font-extrabold tracking-tight break-words sm:text-3xl">{song.title}</h2>
              <p className="mt-0.5 truncate text-sm text-muted">{[song.artist, song.composer && song.composer !== song.artist ? song.composer : null].filter(Boolean).join(' · ')}</p>
              <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                {setlist?.itemKey && (
                  <HeroChip>
                    Repertório <b className="font-mono text-chord">{setlist.itemKey}</b>
                  </HeroChip>
                )}
                {original && (
                  <HeroChip>
                    Original <b className="font-mono">{original}</b>
                  </HeroChip>
                )}
                {song.personalKey && !setlist && (
                  <HeroChip>
                    Meu tom <b className="font-mono text-chord">{song.personalKey}</b>
                  </HeroChip>
                )}
                {song.bpm && <HeroChip>{song.bpm} BPM</HeroChip>}
                {song.timeSignature && <HeroChip>{song.timeSignature}</HeroChip>}
                {setlist?.liveKey && (
                  <HeroChip>
                    <span className="size-1.5 rounded-full bg-danger" /> Ao vivo <b className="font-mono text-chord">{setlist.liveKey}</b>
                  </HeroChip>
                )}
              </div>
              <UsageBadge usagePeople={song.usagePeople} usageSetlists={song.usageSetlists} className="mt-2.5 text-xs font-medium" />
            </div>
          </div>
        </section>
        {song.referenceUrl && (
          <div className="-mt-1 mb-4">
            <ReferencePlayer url={song.referenceUrl} title={song.title} />
          </div>
        )}
        {setlist?.itemNotes && (
          <p className="mb-3 rounded-xl border-l-4 border-sec-intro bg-sec-intro/10 px-3 py-2 text-sm">
            <b>Neste repertório:</b> {setlist.itemNotes}
          </p>
        )}
        {song.notes && <p className="mb-4 rounded-xl border-l-4 border-accent bg-accent/10 px-3 py-2 text-sm">{song.notes}</p>}
        {hideLyrics && (
          <p className="mb-4 rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">
            A letra desta música não está autorizada para exibição. Mostrando apenas acordes e seções.
          </p>
        )}

        {/* Alternador de visualização e ação de partitura */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {song.scores && song.scores.length > 0 ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className={clsx(
                  'chip h-9 px-4 text-xs font-semibold sm:text-sm flex items-center gap-1.5 transition',
                  viewMode === 'chord' ? 'chip-on' : 'hover:border-accent/40',
                )}
                onClick={() => setViewMode('chord')}
              >
                Cifra
              </button>
              <button
                type="button"
                className={clsx(
                  'chip h-9 px-4 text-xs font-semibold sm:text-sm flex items-center gap-1.5 transition',
                  viewMode === 'score' ? 'chip-on' : 'hover:border-accent/40',
                )}
                onClick={() => setViewMode('score')}
              >
                <FileText className="size-4" />
                Ver partitura {song.scores.length > 1 ? `(${song.scores.length})` : ''}
              </button>
            </div>
          ) : null}

          {song.canEdit && !setlist && (
            <button
              type="button"
              className={clsx(
                'btn-ghost h-8 px-2.5 text-xs text-muted hover:text-text flex items-center gap-1.5',
                song.scores?.length ? 'ml-auto' : '',
              )}
              onClick={() => setUploadScoreOpen(true)}
            >
              <FileUp className="size-3.5 text-accent" />
              {song.scores?.length ? 'Adicionar outra parte' : 'Anexar partitura (.gp, .gp5 ou PDF)'}
            </button>
          )}
        </div>

        {viewMode === 'score' && song.scores && song.scores.length > 0 ? (
          <div className="py-2">
            <ScoreViewer songId={song.id} parts={song.scores} canEdit={song.canEdit} />
          </div>
        ) : (
          <>
            {songChords.length > 0 && prefs.showChords && (
              <SongChords
                chords={songChords}
                open={prefs.chordStrip}
                onToggle={() => setPrefs((p) => ({ ...p, chordStrip: !p.chordStrip }))}
                onPick={setChordOpen}
              />
            )}

            {song.content.trim() ? (
              <ChordSheet
                lines={lines}
                marks={song.marks}
                fontSize={prefs.fontSize}
                lineHeight={prefs.lineHeight}
                showChords={prefs.showChords}
                wrap={prefs.wrap}
                hideLyrics={hideLyrics}
                currentUserId={uid}
                markMode={markMode}
                onLineClick={setMarkLine}
                onMarkClick={onMarkClick}
                onChordClick={setChordOpen}
              />
            ) : (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <p className="text-muted">Esta música ainda não tem cifra cadastrada.</p>
                <FindLinks song={{ title: song.title, artist: song.artist }} compact />
                {song.canEdit && (
                  <Link to={`/musicas/${song.id}/editar`} className="btn-primary">
                    <Pencil className="size-4" /> Escrever a cifra
                  </Link>
                )}
              </div>
            )}
          </>
        )}

        {next &&
          (next.block ? (
            // Virada de bloco: aviso bem visível, com estilo e BPM do próximo bloco
            <button
              className="card mt-10 flex w-full items-center gap-4 overflow-hidden p-4 text-left transition hover:brightness-110"
              style={{ borderColor: `${next.block.color}88`, background: `linear-gradient(90deg, ${next.block.color}26, transparent 75%)` }}
              onClick={next.go}
            >
              <span className="h-12 w-1.5 shrink-0 rounded-full" style={{ background: next.block.color }} />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-muted uppercase">Próximo bloco</span>
                <span className="block truncate text-lg font-extrabold uppercase" style={{ color: next.block.color }}>
                  {next.block.name}
                </span>
                <span className="block truncate text-sm text-muted">{[next.block.subtitle, next.title].filter(Boolean).join(' · ')}</span>
              </span>
              <ChevronRight className="size-5 shrink-0" style={{ color: next.block.color }} />
            </button>
          ) : (
            <button className="card mt-10 flex w-full items-center gap-3 p-4 text-left transition hover:border-accent/50" onClick={next.go}>
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-muted">Próxima música</span>
                <span className="block truncate font-semibold">{next.title}</span>
              </span>
              <ChevronRight className="size-5 text-accent" />
            </button>
          ))}
        {!song.canEdit && !setlist && (
          <div className="mt-8 flex justify-center">
            <ReportButton songId={song.id} />
          </div>
        )}
      </div>

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
          <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
            <span>
              Quebrar linhas longas
              <span className="block text-xs text-muted">A cifra cabe na tela, sem rolar para o lado</span>
            </span>
            <input
              type="checkbox"
              className="size-5 shrink-0 accent-[var(--accent)]"
              checked={prefs.wrap}
              onChange={(e) => setPrefs((p) => ({ ...p, wrap: e.target.checked }))}
            />
          </label>
          <button className="btn-ghost mt-2 w-full" onClick={toggleFullscreen}>
            {fullscreen ? <Shrink className="size-4" /> : <Expand className="size-4" />}
            {fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
          </button>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              className="btn-ghost"
              onClick={() => {
                const s = songInKey(song, offset, currentKey)
                downloadText(fileNameFor(`${song.title}${currentKey ? ` (${currentKey})` : ''}`, 'cho'), toChordPro(s))
                toast('Arquivo ChordPro baixado: abre em OnSong, SongbookPro e outros apps.')
              }}
              title="Baixar no formato ChordPro, no tom atual"
            >
              <FileDown className="size-4" /> ChordPro
            </button>
            <Link className="btn-ghost" to={`/musicas/${song.id}/imprimir${offset ? `?st=${offset}` : ''}`} title="Imprimir ou salvar em PDF, no tom atual">
              <Printer className="size-4" /> Imprimir/PDF
            </Link>
          </div>
        </div>
      )}

      {!locked && viewMode === 'chord' && (
        <div className="fixed inset-x-0 bottom-0 z-30 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex w-fit max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-2xl border border-border bg-surface/95 p-1.5 shadow-2xl shadow-black/40 backdrop-blur">
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
            {original && currentKey !== (baseKey ?? original) && (
              <button
                className="btn-icon"
                aria-label={resetLabel}
                title={resetLabel}
                onClick={() => setOffset(baseKey ? normalizeOffset(semitonesBetween(original, baseKey)) : 0)}
              >
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
                setMarkMode(false)
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
        personal={setlist ? setlist.itemKey : song.personalKey}
        personalLabel={setlist ? 'repertório' : 'meu tom'}
        onPick={(k) => {
          if (original) setOffset(normalizeOffset(semitonesBetween(original, k)))
          setPickerOpen(false)
        }}
      />

      <MarkDialog
        songId={song.id}
        lineIndex={markLine}
        lineText={lineText}
        setlistId={setlist?.id ?? null}
        canShare={song.canShareMarks}
        onClose={() => setMarkLine(null)}
      />

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title={song.title}>
        <div className="-mx-2 flex flex-col">
          <button
            className="flex h-12 items-center gap-3 rounded-xl px-2 text-left hover:bg-surface-2"
            onClick={() => {
              setMoreOpen(false)
              setAddOpen(true)
            }}
          >
            <ListPlus className="size-5 text-muted" /> Adicionar ao repertório
          </button>
          {song.canEdit && (
            <Link to={`/musicas/${song.id}/editar`} className="flex h-12 items-center gap-3 rounded-xl px-2 hover:bg-surface-2">
              <Pencil className="size-5 text-muted" /> Editar música
            </Link>
          )}
          {song.scores && song.scores.length > 0 && (
            <button
              className="flex h-12 items-center gap-3 rounded-xl px-2 text-left hover:bg-surface-2"
              onClick={() => {
                setMoreOpen(false)
                setViewMode(viewMode === 'score' ? 'chord' : 'score')
              }}
            >
              <FileText className="size-5 text-muted" /> {viewMode === 'score' ? 'Ver cifra' : 'Ver partitura'}
            </button>
          )}
          {song.canEdit && !setlist && (
            <button
              className="flex h-12 items-center gap-3 rounded-xl px-2 text-left hover:bg-surface-2"
              onClick={() => {
                setMoreOpen(false)
                setUploadScoreOpen(true)
              }}
            >
              <FileUp className="size-5 text-muted" /> Anexar partitura
            </button>
          )}
          <Link to={`/musicas/${song.id}/imprimir${offset ? `?st=${offset}` : ''}`} className="flex h-12 items-center gap-3 rounded-xl px-2 hover:bg-surface-2">
            <Printer className="size-5 text-muted" /> Imprimir ou salvar PDF
          </Link>
          {song.canEdit && (
            <button
              className="flex h-12 items-center gap-3 rounded-xl px-2 text-left hover:bg-surface-2"
              onClick={() => {
                setMoreOpen(false)
                setShareOpen(true)
              }}
            >
              <Share2 className="size-5 text-muted" /> Compartilhar com outra pessoa
            </button>
          )}
          {song.sharedWithMe && (
            <button
              className="flex h-12 items-center gap-3 rounded-xl px-2 text-left text-danger hover:bg-danger/10"
              onClick={() =>
                confirm(`Tirar "${song.title}" da sua biblioteca? ${song.ownerName} pode compartilhar de novo depois.`) &&
                leaveShared.mutate(undefined, {
                  onSuccess: () => {
                    toast('Música removida da sua biblioteca.')
                    navigate('/musicas', { replace: true })
                  },
                  onError: (e) => toast(e.message, 'error'),
                })
              }
            >
              <LogOut className="size-5" /> Sair desta música compartilhada
            </button>
          )}
        </div>
      </Sheet>

      {song.canEdit && <ShareSongDialog songId={song.id} title={song.title} open={shareOpen} onClose={() => setShareOpen(false)} />}

      <ScoreUploadDialog
        songId={song.id}
        open={uploadScoreOpen}
        onClose={() => setUploadScoreOpen(false)}
        onDone={() => {
          refetch()
          setViewMode('score')
        }}
      />

      <ChordDialog symbol={chordOpen} onClose={() => setChordOpen(null)} related={songChords} onPick={setChordOpen} />
    </div>
  )
}

function HeroChip({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/25 px-2.5 py-1 backdrop-blur-sm">{children}</span>
}

/** "Acordes desta música": os desenhos de todos os acordes, no tom que está na tela. */
function SongChords({
  chords,
  open,
  onToggle,
  onPick,
}: {
  chords: string[]
  open: boolean
  onToggle: () => void
  onPick: (chord: string) => void
}) {
  return (
    <section className="mb-4">
      <button className="flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-text" onClick={onToggle} aria-expanded={open}>
        <ChevronDown className={clsx('size-4 transition', !open && '-rotate-90')} />
        Acordes desta música <span className="font-normal">({chords.length})</span>
      </button>
      {open ? (
        <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-2">
          {chords.map((c) => {
            const v = guitarVoicings(c, 1)[0]
            return (
              <button
                key={c}
                className="card flex w-24 shrink-0 flex-col items-center gap-1 px-2 py-2 transition hover:border-accent/50"
                onClick={() => onPick(c)}
                aria-label={`Como tocar ${c}`}
              >
                <span className="font-mono font-bold text-chord">{c}</span>
                {v ? <GuitarDiagram voicing={v} showNotes={false} className="h-24 w-auto" /> : <span className="py-8 text-xs text-muted">—</span>}
              </button>
            )
          })}
        </div>
      ) : (
        <p className="mt-1 text-xs text-muted">Toque em qualquer acorde da cifra para ver como montar no violão e no teclado.</p>
      )}
    </section>
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
/**
 * Em tela baixa (celular), o cabeçalho some enquanto a pessoa desce lendo a cifra
 * e volta assim que ela rola um pouco para cima.
 */
function useHideOnScroll() {
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    let last = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      if (window.innerHeight > 900 || y < 120) setHidden(false)
      else if (y > last + 6) setHidden(true)
      else if (y < last - 6) setHidden(false)
      if (Math.abs(y - last) > 6) last = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return hidden
}

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
