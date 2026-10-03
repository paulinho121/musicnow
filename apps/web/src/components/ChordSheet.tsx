import { isChordLine, parseSheet, SECTION_LABELS, splitChordLine, type SectionType, type SheetLine } from '@ensaio/shared'
import clsx from 'clsx'
import { memo, useMemo } from 'react'
import type { MarkType, SongMark } from '../lib/types'

const SECTION_COLOR: Record<SectionType, string> = {
  intro: 'border-sec-intro text-sec-intro',
  verso: 'border-sec-verso text-sec-verso',
  pre_refrao: 'border-sec-pre text-sec-pre',
  refrao: 'border-sec-refrao text-sec-refrao',
  ponte: 'border-sec-ponte text-sec-ponte',
  solo: 'border-sec-solo text-sec-solo',
  interludio: 'border-sec-solo text-sec-solo',
  final: 'border-sec-final text-sec-final',
}

export const MARK_LABELS: Record<MarkType, string> = {
  ...SECTION_LABELS,
  repeticao: 'Repetição',
  entrada: 'Entrada',
  saida: 'Saída',
  dinamica: 'Dinâmica',
  parada: 'Parada',
  vocal: 'Vocal',
  nota: 'Nota',
}

export interface SheetSection {
  index: number
  label: string
  type: SectionType | null
}

/** Seções da cifra, para a navegação rápida. */
export function sectionsOf(lines: SheetLine[]): SheetSection[] {
  return lines.flatMap((l, index) => (l.kind === 'section' ? [{ index, label: l.label, type: l.type }] : []))
}

export function useSheet(content: string, semitones: number, targetKey: string | null) {
  return useMemo(() => parseSheet(content, semitones, targetKey), [content, semitones, targetKey])
}

interface Props {
  lines: SheetLine[]
  marks?: SongMark[]
  fontSize: number
  lineHeight: number
  showChords?: boolean
  /** Letra sem autorização de exibição: mostra só acordes e seções. */
  hideLyrics?: boolean
  currentUserId?: string
  /** Modo de marcar: as linhas viram botões para criar marcação; as marcações, para apagar. */
  markMode?: boolean
  onLineClick?: (lineIndex: number) => void
  onMarkClick?: (mark: SongMark) => void
  /** Toque num acorde (fora do modo de marcar): abre o dicionário. */
  onChordClick?: (chord: string) => void
}

export const ChordSheet = memo(function ChordSheet({
  lines,
  marks = [],
  fontSize,
  lineHeight,
  showChords = true,
  hideLyrics = false,
  currentUserId,
  markMode = false,
  onLineClick,
  onMarkClick,
  onChordClick,
}: Props) {
  const marksByLine = useMemo(() => {
    const m = new Map<number, SongMark[]>()
    for (const mark of marks) {
      // Marcação numa linha de letra sobe para cima do acorde dela: não separa o acorde da sílaba.
      const i = mark.lineIndex
      const anchor = lines[i]?.kind === 'lyrics' && lines[i - 1]?.kind === 'chords' ? i - 1 : i
      m.set(anchor, [...(m.get(anchor) ?? []), mark])
    }
    return m
  }, [marks, lines])

  return (
    <div className="sheet overflow-x-auto pb-2" style={{ fontSize, lineHeight }}>
      {lines.map((line, i) => {
        const lineMarks = marksByLine.get(i)
        const hidden = hideLyrics && line.kind === 'blank' && lines[i + 1]?.kind !== 'section'
        return (
          <div key={i} id={`linha-${i}`} className="scroll-mt-28">
            {lineMarks && (
              <div className="my-1.5 flex flex-wrap gap-1.5 font-sans whitespace-normal" style={{ fontSize: 13, lineHeight: 1.3 }}>
                {lineMarks.map((m) => {
                  const chip = (
                    <>
                      <b className="text-accent">{MARK_LABELS[m.type]}</b>
                      {m.text}
                      {!m.shared && m.authorId === currentUserId && <em className="not-italic opacity-60">· só você</em>}
                      {m.shared && m.authorId !== currentUserId && m.authorName && (
                        <em className="not-italic opacity-60">· {m.authorName.split(' ')[0]}</em>
                      )}
                    </>
                  )
                  const cls = clsx(
                    'inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-left',
                    m.shared ? 'border-accent/40 bg-accent/10 text-text' : 'border-border border-dashed bg-surface text-muted',
                  )
                  const title = m.shared ? 'Marcação compartilhada' : 'Marcação pessoal (só você vê)'
                  return markMode && onMarkClick ? (
                    <button key={m.id} type="button" className={clsx(cls, 'ring-danger/60 hover:ring-2')} title={title} onClick={() => onMarkClick(m)}>
                      {chip}
                    </button>
                  ) : (
                    <span key={m.id} className={cls} title={title}>
                      {chip}
                    </span>
                  )
                })}
              </div>
            )}
            {/* Sem letra, as linhas em branco que sobram só ficam antes das seções. */}
            {!hidden &&
              (markMode && onLineClick && line.kind !== 'blank' ? (
                <button
                  type="button"
                  className="-mx-2 block w-[calc(100%+1rem)] rounded-lg px-2 text-left hover:bg-accent/10 focus-visible:bg-accent/10"
                  onClick={() => onLineClick(i)}
                  aria-label={`Marcar a linha ${i + 1}`}
                >
                  <Line line={line} showChords={showChords} hideLyrics={hideLyrics} />
                </button>
              ) : (
                <Line line={line} showChords={showChords} hideLyrics={hideLyrics} onChordClick={onChordClick} />
              ))}
          </div>
        )
      })}
    </div>
  )
})

function Line({
  line,
  showChords,
  hideLyrics,
  onChordClick,
}: {
  line: SheetLine
  showChords: boolean
  hideLyrics: boolean
  onChordClick?: (chord: string) => void
}) {
  switch (line.kind) {
    case 'blank':
      return <div aria-hidden>{' '}</div>
    case 'lyrics':
      return hideLyrics ? null : <div>{line.text}</div>
    case 'chords':
      return showChords ? (
        <div className="font-bold text-chord">
          <Chords text={line.text} onChordClick={onChordClick} />
        </div>
      ) : null
    case 'section':
      return (
        <div className="mt-3 mb-1 flex items-baseline gap-3">
          <span
            className={clsx(
              'rounded-md border-l-4 bg-surface-2 px-2 py-0.5 font-sans text-[0.8em] font-bold tracking-wide uppercase',
              line.type ? SECTION_COLOR[line.type] : 'border-muted text-muted',
            )}
          >
            {line.label}
          </span>
          {line.chords && showChords && (
            <span className="font-bold text-chord">
              {isChordLine(line.chords) ? <Chords text={line.chords} onChordClick={onChordClick} /> : line.chords}
            </span>
          )}
        </div>
      )
  }
}

/** Acordes como botões, sem mudar a largura de nada: as colunas da cifra continuam alinhadas. */
function Chords({ text, onChordClick }: { text: string; onChordClick?: (chord: string) => void }) {
  if (!onChordClick) return <>{text}</>
  return (
    <>
      {splitChordLine(text).map((p, i) =>
        p.chord ? (
          <button
            key={i}
            type="button"
            className="cursor-pointer rounded-sm underline decoration-chord/30 decoration-dotted underline-offset-4 hover:bg-chord/15 hover:decoration-chord focus-visible:bg-chord/15"
            onClick={() => onChordClick(p.chord!)}
            title={`Como tocar ${p.chord}`}
          >
            {p.text}
          </button>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  )
}
