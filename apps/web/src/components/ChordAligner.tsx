import { isChordLine, moveChordInLine, splitChordLine } from '@ensaio/shared'
import clsx from 'clsx'
import { ChevronLeft, ChevronRight, MousePointerClick, Undo2 } from 'lucide-react'
import { useState } from 'react'

type Selected = { line: number; col: number }

/**
 * Ajustar a posição dos acordes sem contar espaços: toque no acorde e depois na sílaba
 * da letra onde ele entra (ou use ◀ ▶ para ajustar de letra em letra).
 * Mexe só na posição; a letra e os outros acordes ficam como estão.
 */
export function ChordAligner({ content, onChange }: { content: string; onChange: (content: string) => void }) {
  const lines = content.replace(/\r\n?/g, '\n').split('\n')
  const [selected, setSelected] = useState<Selected | null>(null)
  const [history, setHistory] = useState<string[]>([])

  const move = (to: number) => {
    if (!selected) return
    const { line, col } = moveChordInLine(lines[selected.line], selected.col, to)
    if (line === lines[selected.line]) return
    setHistory((h) => [...h.slice(-49), content])
    const next = [...lines]
    next[selected.line] = line.replace(/\s+$/, '')
    onChange(next.join('\n'))
    setSelected({ line: selected.line, col })
  }

  const undo = () => {
    const prev = history[history.length - 1]
    if (prev === undefined) return
    setHistory((h) => h.slice(0, -1))
    onChange(prev)
    setSelected(null)
  }

  const chordAt = (s: Selected | null) => {
    if (!s) return null
    const m = /^\S+/.exec(lines[s.line].slice(s.col))
    return m?.[0] ?? null
  }

  return (
    <div className="space-y-3">
      <p className="flex items-start gap-2 rounded-xl bg-accent/10 px-3 py-2 text-sm">
        <MousePointerClick className="mt-0.5 size-4 shrink-0 text-accent" />
        <span>
          <b>Toque no acorde</b> e depois <b>na letra, na sílaba onde ele entra</b>. Para ajustes finos, use ◀ ▶.
        </span>
      </p>

      <div className="sheet overflow-x-auto rounded-xl bg-bg p-4 text-[16px] leading-[1.7]">
        {lines.map((raw, i) => {
          const isChords = isChordLine(raw) && !/^\s*\[/.test(raw)
          if (isChords) {
            let col = 0
            return (
              <div key={i} className="font-bold text-chord">
                {splitChordLine(raw).map((p, k) => {
                  const start = col
                  col += p.text.length
                  if (!p.chord) return <span key={k}>{p.text}</span>
                  const on = selected?.line === i && selected.col === start
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setSelected(on ? null : { line: i, col: start })}
                      className={clsx('rounded-sm', on ? 'bg-accent text-accent-ink outline outline-2 outline-accent' : 'underline decoration-chord/40 decoration-dotted underline-offset-4 hover:bg-chord/15')}
                      aria-pressed={on}
                      aria-label={`Acorde ${p.chord}`}
                    >
                      {p.text}
                    </button>
                  )
                })}
                {' '}
              </div>
            )
          }
          // Letra logo abaixo da linha do acorde escolhido: cada letra é um alvo de toque.
          const target = selected && selected.line === i - 1
          if (target) {
            const width = Math.max(raw.length, lines[i - 1].length + 4)
            return (
              <div key={i} className="cursor-pointer rounded-sm bg-accent/5">
                {raw
                  .padEnd(width, ' ')
                  .split('')
                  .map((ch, c) => (
                    <span key={c} onClick={() => move(c)} className="hover:bg-accent/30" title="Pôr o acorde aqui">
                      {ch}
                    </span>
                  ))}
              </div>
            )
          }
          return <div key={i}>{raw || ' '}</div>
        })}
      </div>

      {/* Barra do acorde escolhido */}
      <div className="sticky bottom-20 z-10 flex items-center gap-2 rounded-2xl border border-border bg-surface/95 p-2 shadow-xl backdrop-blur md:bottom-4">
        <span className="min-w-0 flex-1 truncate px-2 text-sm text-muted">
          {selected ? (
            <>
              Acorde <b className="font-mono text-chord">{chordAt(selected)}</b> · toque na letra ou ajuste
            </>
          ) : (
            'Escolha um acorde na cifra'
          )}
        </span>
        <button type="button" className="btn-icon size-10" onClick={() => selected && move(selected.col - 1)} disabled={!selected} aria-label="Mover uma letra para a esquerda">
          <ChevronLeft className="size-5" />
        </button>
        <button type="button" className="btn-icon size-10" onClick={() => selected && move(selected.col + 1)} disabled={!selected} aria-label="Mover uma letra para a direita">
          <ChevronRight className="size-5" />
        </button>
        <button type="button" className="btn-icon size-10" onClick={undo} disabled={!history.length} aria-label="Desfazer">
          <Undo2 className="size-5" />
        </button>
      </div>
    </div>
  )
}
