import clsx from 'clsx'
import { useEffect, useState } from 'react'
import { useAddMark } from '../lib/queries'
import type { MarkType } from '../lib/types'
import { MARK_LABELS } from './ChordSheet'
import { Sheet } from './Sheet'
import { useToast } from './ui'

// Ordem pensada para o palco: estrutura primeiro, depois instruções para a banda.
const TYPES: MarkType[] = [
  'intro', 'verso', 'pre_refrao', 'refrao', 'ponte', 'solo', 'interludio', 'final',
  'repeticao', 'entrada', 'saida', 'dinamica', 'parada', 'vocal', 'nota',
]

const QUICK_TEXTS: Partial<Record<MarkType, string[]>> = {
  entrada: ['Só bateria e baixo', 'Entram todos', 'Só voz e teclado'],
  dinamica: ['Subir a dinâmica', 'Baixar a dinâmica', 'Crescendo'],
  repeticao: ['Repetir 2x', 'Repetir até o sinal'],
  parada: ['Parada da banda', 'Só a voz segue'],
  final: ['Finalizar após o segundo refrão', 'Final seco'],
  vocal: ['Segunda voz aqui', 'Respiração'],
}

export function MarkDialog({
  songId,
  lineIndex,
  lineText,
  setlistId,
  canShare,
  onClose,
}: {
  songId: string
  lineIndex: number | null
  lineText: string
  setlistId: string | null
  canShare: boolean
  onClose: () => void
}) {
  const add = useAddMark(songId)
  const toast = useToast()
  const [type, setType] = useState<MarkType>('nota')
  const [text, setText] = useState('')
  const [shared, setShared] = useState(canShare)

  useEffect(() => {
    if (lineIndex === null) return
    setType('nota')
    setText('')
    setShared(canShare)
  }, [lineIndex, canShare])

  const save = () => {
    if (lineIndex === null) return
    add.mutate(
      { lineIndex, type, text: text.trim() || null, shared: canShare && shared, setlistId },
      {
        onSuccess: () => {
          toast(shared && canShare ? 'Marcação compartilhada com a banda.' : 'Marcação salva só para você.')
          onClose()
        },
        onError: (e) => toast(e.message, 'error'),
      },
    )
  }

  return (
    <Sheet open={lineIndex !== null} onClose={onClose} title="Nova marcação">
      <p className="sheet mb-4 truncate rounded-lg bg-bg px-3 py-2 text-sm text-muted">{lineText || ' '}</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {TYPES.map((t) => (
          <button key={t} type="button" className={clsx('chip h-8 text-xs', type === t && 'chip-on')} onClick={() => setType(t)} aria-pressed={type === t}>
            {MARK_LABELS[t]}
          </button>
        ))}
      </div>
      <label className="block">
        <span className="label">Observação (opcional)</span>
        <input
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder="Ex.: entrar com todos no refrão"
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
      </label>
      {QUICK_TEXTS[type] && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {QUICK_TEXTS[type]!.map((q) => (
            <button key={q} type="button" className="rounded-lg bg-surface-2 px-2.5 py-1 text-xs text-muted hover:text-text" onClick={() => setText(q)}>
              {q}
            </button>
          ))}
        </div>
      )}
      {canShare ? (
        <label className="mt-4 flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-5 accent-[var(--accent)]" checked={shared} onChange={(e) => setShared(e.target.checked)} />
          <span>
            Compartilhar
            <span className="block text-xs text-muted">
              {setlistId ? 'Toda a banda deste repertório vê a marcação.' : 'Todos que abrirem esta música veem a marcação.'}
            </span>
          </span>
        </label>
      ) : (
        <p className="mt-4 text-xs text-muted">Esta marcação fica só para você.</p>
      )}
      <button type="button" className="btn-primary mt-5 w-full" onClick={save} disabled={add.isPending}>
        {add.isPending ? 'Salvando...' : 'Salvar marcação'}
      </button>
    </Sheet>
  )
}
