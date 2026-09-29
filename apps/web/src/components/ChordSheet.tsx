import { parseSheet, SECTION_LABELS, type SectionType, type SheetLine } from '@ensaio/shared'
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
}

export const ChordSheet = memo(function ChordSheet({
  lines,
  marks = [],
  fontSize,
  lineHeight,
  showChords = true,
  hideLyrics = false,
  currentUserId,
}: Props) {
  const marksByLine = useMemo(() => {
    const m = new Map<number, SongMark[]>()
    for (const mark of marks) m.set(mark.lineIndex, [...(m.get(mark.lineIndex) ?? []), mark])
    return m
  }, [marks])

  return (
    <div className="sheet overflow-x-auto pb-2" style={{ fontSize, lineHeight }}>
      {lines.map((line, i) => {
        const lineMarks = marksByLine.get(i)
        return (
          <div key={i} id={`linha-${i}`} className="scroll-mt-28">
            {lineMarks && (
              <div className="my-1.5 flex flex-wrap gap-1.5 font-sans whitespace-normal" style={{ fontSize: 13, lineHeight: 1.3 }}>
                {lineMarks.map((m) => (
                  <span
                    key={m.id}
                    className={clsx(
                      'inline-flex items-center gap-1.5 rounded-lg border px-2 py-1',
                      m.shared ? 'border-accent/40 bg-accent/10 text-text' : 'border-border border-dashed bg-surface text-muted',
                    )}
                    title={m.shared ? 'Marcação compartilhada' : 'Marcação privada (só você vê)'}
                  >
                    <b className="text-accent">{MARK_LABELS[m.type]}</b>
                    {m.text}
                    {!m.shared && m.authorId === currentUserId && <em className="not-italic opacity-60">· só você</em>}
                  </span>
                ))}
              </div>
            )}
            <Line line={line} showChords={showChords} hideLyrics={hideLyrics} />
          </div>
        )
      })}
    </div>
  )
})

function Line({ line, showChords, hideLyrics }: { line: SheetLine; showChords: boolean; hideLyrics: boolean }) {
  switch (line.kind) {
    case 'blank':
      return <div aria-hidden>{' '}</div>
    case 'lyrics':
      return hideLyrics ? null : <div>{line.text}</div>
    case 'chords':
      return showChords ? <div className="font-bold text-chord">{line.text}</div> : null
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
          {line.chords && showChords && <span className="font-bold text-chord">{line.chords}</span>}
        </div>
      )
  }
}
