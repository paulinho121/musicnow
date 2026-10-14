import { barEvents, chordBassLine, isBarLine, isChordLine, parseChord, parseSheet, SECTION_LABELS, splitChordLine, wrapChordPair, type SectionType, type SheetLine } from '@ensaio/shared'
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
  /** Tablaturas (E|---): a pessoa pode esconder nos ajustes de leitura. */
  showTabs?: boolean
  /** Compasso da música ("4/4"): dá a duração de cada acorde no mapa de compassos. */
  timeSignature?: string | null
  /** Letra sem autorização de exibição: mostra só acordes e seções. */
  hideLyrics?: boolean
  /** Modo cantor: só a letra, centralizada e em fonte comum. */
  singer?: boolean
  /** Modo baixista: a nota do baixo de cada acorde em destaque, em cima do acorde. */
  bass?: boolean
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
  showTabs = true,
  timeSignature = null,
  hideLyrics = false,
  singer = false,
  bass = false,
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
      const above = lines[i - 1]
      const anchor = lines[i]?.kind === 'lyrics' && above?.kind === 'chords' && !isBarLine(above.text) ? i - 1 : i
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
          cols !== null && showChords && !hideLyrics && line.kind === 'chords' && !isBarLine(line.text) && lines[i + 1]?.kind === 'lyrics'
        const prev = lines[i - 1]
        const pairedAbove =
          cols !== null && showChords && !hideLyrics && line.kind === 'lyrics' && prev?.kind === 'chords' && !isBarLine(prev.text)
        const pair = pairedBelow ? (lines[i + 1] as { text: string }).text : null
        const hidden =
          (hideLyrics && line.kind === 'blank' && lines[i + 1]?.kind !== 'section') ||
          pairedAbove ||
          // Modo cantor: sem as linhas de acorde, sobram brancos repetidos; fica um só.
          (singer && line.kind === 'blank' && (i === 0 || lines[i - 1]?.kind === 'blank')) ||
          // Tablaturas escondidas: some também a linha em branco logo depois de cada bloco.
          (!showTabs && line.kind === 'blank' && lines[i - 1]?.kind === 'tab')
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
                  <Line line={line} showChords={showChords} showTabs={showTabs} timeSignature={timeSignature} hideLyrics={hideLyrics} singer={singer} cols={cols} pair={pair} />
                </button>
              ) : (
                <Line
                  line={line}
                  index={i}
                  showChords={showChords}
                  showTabs={showTabs}
                  timeSignature={timeSignature}
                  hideLyrics={hideLyrics}
                  singer={singer}
                  bass={bass}
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
  showTabs = true,
  timeSignature = null,
  hideLyrics,
  singer = false,
  bass = false,
  onChordClick,
  cols = null,
  pair = null,
}: {
  line: SheetLine
  index?: number
  showChords: boolean
  showTabs?: boolean
  timeSignature?: string | null
  hideLyrics: boolean
  singer?: boolean
  bass?: boolean
  onChordClick?: OnChordClick
  /** Colunas disponíveis (quebra ligada) ou null (linha inteira, com rolagem lateral). */
  cols?: number | null
  /** Letra que vai embaixo desta linha de acordes (quebrada junto com ela). */
  pair?: string | null
}) {
  switch (line.kind) {
    case 'blank':
      return <div aria-hidden>{' '}</div>
    case 'tab':
      // Modo cantor: só a letra. A tablatura nunca quebra a linha (desalinharia as cordas).
      if (singer || !showChords || !showTabs) return null
      return <div className="overflow-x-auto whitespace-pre text-[0.92em] [scrollbar-width:none]">{line.text}</div>
    case 'lyrics':
      if (hideLyrics) return null
      // No modo cantor a letra é centralizada: os espaços que alinhavam os acordes saem.
      return <div className={clsx(cols && 'whitespace-pre-wrap')}>{singer ? line.text.trim() : line.text}</div>
    case 'chords': {
      if (!showChords) return null
      if (isBarLine(line.text)) return <BarRow text={line.text} line={index} cols={cols} bass={bass} timeSignature={timeSignature} onChordClick={onChordClick} />
      // Sem a letra embaixo, os espaços que punham cada acorde em cima da sílaba só espalham os
      // acordes pela tela: ficam em sequência, com um espaçamento fixo.
      const text = hideLyrics ? line.text.trim().split(/\s+/).join('   ') : line.text
      if (cols) {
        // Cada pedaço da linha quebrada continua a contagem dos acordes do anterior.
        let before = 0
        return (
          <>
            {wrapChordPair(text, pair, cols).map((row, k) => {
              const start = before
              before += row.chords ? splitChordLine(row.chords).filter((p) => p.chord).length : 0
              return (
                <div key={k}>
                  {bass && row.chords && <div className="font-black text-chord">{chordBassLine(row.chords)}</div>}
                  <div className={bass ? 'font-semibold text-muted' : 'font-bold text-chord'}>
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
        <>
          {/* Modo baixista: a nota do baixo em cima, nas mesmas colunas; o acorde completo embaixo, discreto. */}
          {bass && <div className="font-black text-chord">{chordBassLine(text)}</div>}
          <div className={bass ? 'font-semibold text-muted' : 'font-bold text-chord'}>
            <Chords text={text} line={index} onChordClick={onChordClick} />
          </div>
        </>
      )
    }
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
              {isChordLine(line.chords) ? (
                bass ? (
                  <>
                    <span className="font-black">{chordBassLine(line.chords).trim().replace(/\s+/g, ' ')}</span>{' '}
                    <span className="font-semibold text-muted">
                      (<Chords text={line.chords.trim()} line={index} onChordClick={onChordClick} />)
                    </span>
                  </>
                ) : (
                  <Chords text={line.chords} line={index} onChordClick={onChordClick} />
                )
              ) : (
                line.chords
              )}
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

/** O acorde escrito como nas partituras de acordes: a extensão pequena e no alto (C⁷ᴹ, Am⁷). */
function ChordLabel({ chord }: { chord: string }) {
  const c = parseChord(chord)
  if (!c) return <>{chord}</>
  const minor = /^m(?!aj)/.test(c.suffix) ? 'm' : ''
  const ext = c.suffix.slice(minor.length)
  return (
    <>
      {c.root}
      {minor}
      {ext && <sup className="ml-px text-[0.68em] font-semibold">{ext}</sup>}
      {c.bass && <>/{c.bass}</>}
    </>
  )
}

interface Bar {
  text: string
  /** Começa ou termina um trecho de repetição ("||:" e ":||"). */
  open: boolean
  close: boolean
  /** Barra dupla antes do compasso ("||"): começo de parte. */
  double: boolean
  /** Barra dupla depois do último compasso ("| G ||"): fim de parte. */
  end?: boolean
  /** Casa de repetição ("1." / "2."): na volta, toca-se a casa seguinte. */
  ending?: string
}

/** Divide "||: C | F G :|| x2" em compassos e o que sobra depois da última barra ("x2"). */
function splitBars(text: string): { bars: Bar[]; note: string } {
  const segs = text.split('|')
  const lead = segs.shift() ?? ''
  const tail = segs.pop() ?? ''
  const tailIsBar = isChordLine(tail)
  const raw = [...(lead.trim() ? [lead] : []), ...segs, ...(tailIsBar ? [tail] : [])]
  const bars: Bar[] = []
  let double = false
  for (const seg of raw) {
    let t = seg.trim()
    if (!t) {
      double = true
      continue
    }
    const open = t.startsWith(':')
    const close = t.endsWith(':')
    t = t.replace(/^:|:$/g, '').trim()
    const ending = t.match(/^(\d)\.\s*/)
    if (ending) t = t.slice(ending[0].length)
    bars.push({ text: t, open, close, double: double || open, ending: ending?.[1] })
    double = false
  }
  // Barra dupla no fim ("... | G ||") fecha o último compasso com traço grosso.
  if (double && bars.length) bars[bars.length - 1].end = true
  return { bars, note: tailIsBar ? '' : tail.trim().replace(/^\(|\)$/g, '') }
}

/**
 * Linha de compassos ("| C | F G | Am |"), desenhada como numa partitura de acordes: uma caixa
 * por compasso, com as barras, as repetições e os acordes clicáveis (abrem o dicionário).
 */
function BarRow({
  text,
  line,
  cols,
  bass,
  timeSignature,
  onChordClick,
}: {
  text: string
  line: number
  cols?: number | null
  bass: boolean
  timeSignature?: string | null
  onChordClick?: OnChordClick
}) {
  const { bars, note } = splitBars(text)
  // Se a linha não cabe inteira, quebra em 4 ou 2 por linha (a frase musical fica 2 + 2, não 3 + 1).
  const fit = cols ? Math.floor(cols / 11) : bars.length
  const k = bars.length <= fit ? bars.length : fit >= 4 ? 4 : fit >= 2 ? 2 : 1
  let occurrence = 0
  return (
    <div className="my-1 flex items-center gap-3">
      <div className="grid" style={{ gridTemplateColumns: `repeat(${k}, minmax(11ch, max-content))` }}>
        {bars.map((b, i) => {
          const last = i % k === k - 1 || i === bars.length - 1
          return (
            <div
              key={i}
              className={clsx(
                'relative flex min-h-[2.4em] items-end gap-[1.4ch] py-0.5 pr-[1.2ch] pl-[1ch]',
                // Casa 1 / 2: o colchete por cima do compasso, como na partitura.
                b.ending && 'mt-1 border-t-2 pt-[0.9em]',
                b.double ? 'border-l-4' : 'border-l-2',
                last && (b.close || b.end ? 'border-r-4' : 'border-r-2'),
                'border-muted/60',
              )}
            >
              {b.open && <span className="-ml-[0.6ch] font-black text-muted">:</span>}
              {b.ending && (
                <span className="absolute -top-[0.15em] left-[0.6ch] font-sans text-[0.7em] font-bold text-muted">{b.ending}.</span>
              )}
              {barEvents(b.text, timeSignature).map((e, j) => {
                // A figura em cima; cada coisa ocupa no compasso o espaço do tempo que dura.
                const slot = (body: React.ReactNode, rest = false) => (
                  <span key={j} className="flex flex-col items-start" style={{ minWidth: `${e.beats * 3}ch` }}>
                    <NoteFigure quarters={e.beats} rest={rest} />
                    {body}
                  </span>
                )
                if (e.kind === 'repeat')
                  return (
                    <span key={j} className="self-center text-[1.2em] font-bold text-muted" title="Repete o compasso anterior">
                      %
                    </span>
                  )
                if (e.kind === 'hit') return slot(<span className="font-black text-chord" title="Ataque marcado (convenção)">×</span>)
                if (e.kind === 'rest') return slot(<span className="font-sans text-[0.8em] font-bold text-muted" title="Ninguém toca">N.C.</span>, true)
                const chord = e.chord
                const at = { line, occurrence: occurrence++ }
                const label = bass ? (
                  <span className="flex flex-col items-start leading-tight">
                    <span className="font-black">{parseChord(chord)?.bass ?? parseChord(chord)?.root}</span>
                    <span className="text-[0.75em] font-semibold text-muted">
                      <ChordLabel chord={chord} />
                    </span>
                  </span>
                ) : (
                  <ChordLabel chord={chord} />
                )
                return slot(
                  onChordClick ? (
                    <button
                      type="button"
                      className="cursor-pointer rounded-sm font-bold text-chord hover:bg-chord/15 focus-visible:bg-chord/15"
                      onClick={() => onChordClick(chord, at)}
                      title={`Como tocar ${chord}`}
                    >
                      {label}
                    </button>
                  ) : (
                    <span className="font-bold text-chord">{label}</span>
                  ),
                )
              })}
              {b.close && <span className="ml-auto -mr-[0.6ch] font-black text-muted">:</span>}
            </div>
          )
        })}
      </div>
      {note && <span className="rounded-md bg-surface-2 px-2 py-0.5 font-sans text-[0.75em] font-bold text-muted">{note}</span>}
    </div>
  )
}

/** Figuras: duração em semínimas → cabeça vazada ou cheia, haste, colchetes e ponto. */
const FIGURES: Record<string, { name: string; hollow: boolean; stem: boolean; flags: number; dot: boolean }> = {
  '6': { name: 'semibreve pontuada', hollow: true, stem: false, flags: 0, dot: true },
  '4': { name: 'semibreve', hollow: true, stem: false, flags: 0, dot: false },
  '3': { name: 'mínima pontuada', hollow: true, stem: true, flags: 0, dot: true },
  '2': { name: 'mínima', hollow: true, stem: true, flags: 0, dot: false },
  '1.5': { name: 'semínima pontuada', hollow: false, stem: true, flags: 0, dot: true },
  '1': { name: 'semínima', hollow: false, stem: true, flags: 0, dot: false },
  '0.75': { name: 'colcheia pontuada', hollow: false, stem: true, flags: 1, dot: true },
  '0.5': { name: 'colcheia', hollow: false, stem: true, flags: 1, dot: false },
  '0.25': { name: 'semicolcheia', hollow: false, stem: true, flags: 2, dot: false },
}

/**
 * A figura musical do tempo que o acorde dura, desenhada (não um caractere: fica igual no
 * iPhone, no Android e no PDF). Duração sem figura (ex.: 3 acordes em 4/4) não mostra nada.
 */
function NoteFigure({ quarters, rest = false }: { quarters: number; rest?: boolean }) {
  const f = FIGURES[String(Math.round(quarters * 100) / 100)]
  if (!f) return <span className="h-[1.15em]" aria-hidden />
  if (rest) return <RestFigure quarters={quarters} dot={f.dot} name={f.name.replace(/^\S+/, (n) => `pausa de ${n}`)} />
  return (
    <svg viewBox="0 0 18 26" className="h-[1.15em] w-auto text-muted" role="img" aria-label={f.name}>
      <title>{f.name}</title>
      <ellipse
        cx="6"
        cy="20"
        rx="4.6"
        ry="3.2"
        transform="rotate(-22 6 20)"
        fill={f.hollow ? 'none' : 'currentColor'}
        stroke="currentColor"
        strokeWidth={f.hollow ? 1.6 : 0}
      />
      {f.stem && <line x1="10.1" y1="19" x2="10.1" y2="2" stroke="currentColor" strokeWidth="1.4" />}
      {Array.from({ length: f.flags }, (_, i) => (
        <path key={i} d={`M10.1 ${2 + i * 5} q5 3 4 9`} fill="none" stroke="currentColor" strokeWidth="1.5" />
      ))}
      {f.dot && <circle cx="15.5" cy="20" r="1.5" fill="currentColor" />}
    </svg>
  )
}

/** Pausa (N.C.) com o desenho da pausa de cada figura. */
function RestFigure({ quarters, dot, name }: { quarters: number; dot: boolean; name: string }) {
  const q = dot ? quarters / 1.5 : quarters
  return (
    <svg viewBox="0 0 18 26" className="h-[1.15em] w-auto text-muted" role="img" aria-label={name}>
      <title>{name}</title>
      {q >= 4 ? (
        <>
          <line x1="1" y1="9" x2="15" y2="9" stroke="currentColor" strokeWidth="1.2" />
          <rect x="4" y="9" width="8" height="4" fill="currentColor" />
        </>
      ) : q >= 2 ? (
        <>
          <line x1="1" y1="17" x2="15" y2="17" stroke="currentColor" strokeWidth="1.2" />
          <rect x="4" y="13" width="8" height="4" fill="currentColor" />
        </>
      ) : q >= 1 ? (
        <path d="M6 3 l5 6 -4 4 5 6 c-4 -2 -7 0 -4 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      ) : (
        <>
          <circle cx="6" cy="10" r="2" fill="currentColor" />
          <path d="M6 11 q4 1 6 -3 l-4 14" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </>
      )}
      {dot && <circle cx="15.5" cy="15" r="1.5" fill="currentColor" />}
    </svg>
  )
}
