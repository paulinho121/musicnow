import { isChordLine, parseSheet, SECTION_LABELS, splitChordLine, wrapChordPair, type SectionType, type SheetLine } from '@ensaio/shared'
import clsx from 'clsx'
import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useAccidentals } from '../lib/accidentals'
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

/** Cifra pronta para mostrar: no tom escolhido e com sustenido/bemol do jeito do músico. */
/** Onde está o acorde tocado: linha da cifra e a ordem dele entre os acordes da linha. */
export interface ChordAt {
  line: number
  occurrence: number
}
export type OnChordClick = (chord: string, at: ChordAt) => void

export function useSheet(content: string, semitones: number, targetKey: string | null) {
  const accidentals = useAccidentals()
  return useMemo(() => parseSheet(content, semitones, targetKey, accidentals), [content, semitones, targetKey, accidentals])
}

interface Props {
  lines: SheetLine[]
  marks?: SongMark[]
  fontSize: number
  lineHeight: number
  showChords?: boolean
  /** Letra sem autorização de exibição: mostra só acordes e seções. */
  hideLyrics?: boolean
  /** Modo cantor: só a letra, centralizada e em fonte comum. */
  singer?: boolean
  currentUserId?: string
  /** Modo de marcar: as linhas viram botões para criar marcação; as marcações, para apagar. */
  markMode?: boolean
  onLineClick?: (lineIndex: number) => void
  onMarkClick?: (mark: SongMark) => void
  /** Toque num acorde (fora do modo de marcar): abre o dicionário. */
  onChordClick?: OnChordClick
  /** Quebra as linhas longas para caber na tela (acorde e letra juntos), sem rolagem lateral. */
  wrap?: boolean
}

/** Quantas colunas da fonte monoespaçada cabem no elemento (acompanha giro de tela e zoom). */
function useColumns(enabled: boolean, fontSize: number) {
  const ref = useRef<HTMLDivElement>(null)
  const probe = useRef<HTMLSpanElement>(null)
  const [cols, setCols] = useState<number | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!enabled || !el) return setCols(null)
    const measure = () => {
      const charW = (probe.current?.getBoundingClientRect().width ?? 0) / 50
      if (charW > 0) setCols(Math.max(12, Math.floor((el.clientWidth - 2) / charW)))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [enabled, fontSize])
  return { ref, probe, cols }
}

export const ChordSheet = memo(function ChordSheet({
  lines,
  marks = [],
  fontSize,
  lineHeight,
  showChords = true,
  hideLyrics = false,
  singer = false,
  currentUserId,
  markMode = false,
  onLineClick,
  onMarkClick,
  onChordClick,
  wrap = false,
}: Props) {
  const { ref, probe, cols } = useColumns(wrap, fontSize)
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
    <div
      ref={ref}
      className={clsx('sheet relative pb-2', singer ? 'sheet-singer' : cols ? 'overflow-x-hidden' : 'overflow-x-auto')}
      style={{ fontSize, lineHeight }}
    >
      {wrap && (
        <span ref={probe} aria-hidden className="pointer-events-none invisible absolute">
          {'0'.repeat(50)}
        </span>
      )}
      {lines.map((line, i) => {
        const lineMarks = marksByLine.get(i)
        // Com quebra, a letra que fica embaixo de uma linha de acordes é desenhada junto com ela.
        const pairedBelow =
          cols !== null && showChords && !hideLyrics && line.kind === 'chords' && lines[i + 1]?.kind === 'lyrics'
        const pairedAbove =
          cols !== null && showChords && !hideLyrics && line.kind === 'lyrics' && lines[i - 1]?.kind === 'chords'
        const pair = pairedBelow ? (lines[i + 1] as { text: string }).text : null
        const hidden =
          (hideLyrics && line.kind === 'blank' && lines[i + 1]?.kind !== 'section') ||
          pairedAbove ||
          // Modo cantor: sem as linhas de acorde, sobram brancos repetidos; fica um só.
          (singer && line.kind === 'blank' && (i === 0 || lines[i - 1]?.kind === 'blank'))
        return (
          <div key={i} id={`linha-${i}`} className="scroll-mt-28">
            {lineMarks && (
              <div
                className={clsx('my-1.5 flex flex-wrap gap-1.5 font-sans whitespace-normal', singer && 'justify-center')}
                style={{ fontSize: singer ? 15 : 13, lineHeight: 1.3 }}
              >
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
                  <Line line={line} showChords={showChords} hideLyrics={hideLyrics} singer={singer} cols={cols} pair={pair} />
                </button>
              ) : (
                <Line
                  line={line}
                  index={i}
                  showChords={showChords}
                  hideLyrics={hideLyrics}
                  singer={singer}
                  onChordClick={onChordClick}
                  cols={cols}
                  pair={pair}
                />
              ))}
          </div>
        )
      })}
    </div>
  )
})

function Line({
  line,
  index = 0,
  showChords,
  hideLyrics,
  singer = false,
  onChordClick,
  cols = null,
  pair = null,
}: {
  line: SheetLine
  index?: number
  showChords: boolean
  hideLyrics: boolean
  singer?: boolean
  onChordClick?: OnChordClick
  /** Colunas disponíveis (quebra ligada) ou null (linha inteira, com rolagem lateral). */
  cols?: number | null
  /** Letra que vai embaixo desta linha de acordes (quebrada junto com ela). */
  pair?: string | null
}) {
  switch (line.kind) {
    case 'blank':
      return <div aria-hidden>{' '}</div>
    case 'lyrics':
      if (hideLyrics) return null
      // No modo cantor a letra é centralizada: os espaços que alinhavam os acordes saem.
      return <div className={clsx(cols && 'whitespace-pre-wrap')}>{singer ? line.text.trim() : line.text}</div>
    case 'chords':
      if (!showChords) return null
      if (cols) {
        // Cada pedaço da linha quebrada continua a contagem dos acordes do anterior.
        let before = 0
        return (
          <>
            {wrapChordPair(line.text, pair, cols).map((row, k) => {
              const start = before
              before += row.chords ? splitChordLine(row.chords).filter((p) => p.chord).length : 0
              return (
                <div key={k}>
                  <div className="font-bold text-chord">
                    {row.chords ? <Chords text={row.chords} line={index} start={start} onChordClick={onChordClick} /> : ' '}
                  </div>
                  {row.lyrics !== null && <div>{row.lyrics || ' '}</div>}
                </div>
              )
            })}
          </>
        )
      }
      return (
        <div className="font-bold text-chord">
          <Chords text={line.text} line={index} onChordClick={onChordClick} />
        </div>
      )
    case 'section':
      return (
        <div className={clsx('mt-3 mb-1 flex items-baseline gap-x-3', cols && 'flex-wrap whitespace-pre-wrap', singer && 'justify-center')}>
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
              {isChordLine(line.chords) ? <Chords text={line.chords} line={index} onChordClick={onChordClick} /> : line.chords}
            </span>
          )}
        </div>
      )
  }
}

/** Acordes como botões, sem mudar a largura de nada: as colunas da cifra continuam alinhadas. */
function Chords({
  text,
  line,
  start = 0,
  onChordClick,
}: {
  text: string
  line: number
  /** Quantos acordes da mesma linha vieram antes deste pedaço (linha quebrada). */
  start?: number
  onChordClick?: OnChordClick
}) {
  if (!onChordClick) return <>{text}</>
  let occurrence = start
  return (
    <>
      {splitChordLine(text).map((p, i) => {
        if (!p.chord) return <span key={i}>{p.text}</span>
        const at = { line, occurrence: occurrence++ }
        return (
          <button
            key={i}
            type="button"
            className="cursor-pointer rounded-sm underline decoration-chord/30 decoration-dotted underline-offset-4 hover:bg-chord/15 hover:decoration-chord focus-visible:bg-chord/15"
            onClick={() => onChordClick(p.chord!, at)}
            title={`Como tocar ${p.chord}`}
          >
            {p.text}
          </button>
        )
      })}
    </>
  )
}
