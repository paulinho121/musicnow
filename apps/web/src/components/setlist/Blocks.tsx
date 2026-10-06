import { parseSetlistText } from '@ensaio/shared'
import { ClipboardPaste, Loader2, Trash2 } from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { useDeleteBlock, useImportText, useSaveBlock } from '../../lib/setlists'
import type { SetlistBlock } from '../../lib/types'
import { Sheet } from '../Sheet'
import { useToast } from '../ui'

// Cor de cada bloco (repete depois da 6ª): ajuda a achar o bloco de longe, no palco.
export const BLOCK_COLORS = ['#f06a6a', '#f5a524', '#4fd1c5', '#7aa2ff', '#b58cff', '#ff7eb6']
export const blockColor = (index: number) => BLOCK_COLORS[index % BLOCK_COLORS.length]

/** "Marília · 130 BPM" */
export const blockSubtitle = (b: Pick<SetlistBlock, 'style' | 'bpm'>) =>
  [b.style, b.bpm ? `${b.bpm} BPM` : null].filter(Boolean).join(' · ')

/** Criar ou editar um bloco. */
export function BlockDialog({
  setlistId,
  block,
  open,
  onClose,
  suggestedName,
}: {
  setlistId: string
  block: SetlistBlock | null
  open: boolean
  onClose: () => void
  suggestedName: string
}) {
  const save = useSaveBlock(setlistId)
  const del = useDeleteBlock(setlistId)
  const toast = useToast()
  const [name, setName] = useState('')
  const [style, setStyle] = useState('')
  const [bpm, setBpm] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!open) return
    setName(block?.name ?? suggestedName)
    setStyle(block?.style ?? '')
    setBpm(block?.bpm ? String(block.bpm) : '')
    setNotes(block?.notes ?? '')
  }, [open, block, suggestedName])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const n = Number(bpm)
    save.mutate(
      {
        blockId: block?.id,
        name: name.trim() || suggestedName,
        style: style.trim() || null,
        bpm: bpm && n >= 20 && n <= 320 ? Math.round(n) : null,
        notes: notes.trim() || null,
      },
      { onSuccess: onClose, onError: (err) => toast(err.message, 'error') },
    )
  }

  const remove = () => {
    if (!block || !confirm(`Apagar o ${block.name}? As músicas continuam no repertório, sem bloco.`)) return
    del.mutate(block.id, {
      onSuccess: onClose,
      onError: (err) => toast(err.message, 'error'),
    })
  }

  return (
    <Sheet open={open} onClose={onClose} title={block ? 'Editar bloco' : 'Novo bloco'}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="label">Nome</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Bloco 1" autoFocus />
        </label>
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <label className="block">
            <span className="label">Estilo ou ritmo</span>
            <input
              className="input"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              maxLength={80}
              placeholder="Sertanejo, Xote, Marília…"
            />
          </label>
          <label className="block">
            <span className="label">BPM</span>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={20}
              max={320}
              value={bpm}
              onChange={(e) => setBpm(e.target.value)}
              placeholder="130"
            />
          </label>
        </div>
        <label className="block">
          <span className="label">Observação (opcional)</span>
          <input
            className="input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            placeholder="Emendar sem parar, puxar o público…"
          />
        </label>
        <div className="flex gap-2">
          {block && (
            <button type="button" className="btn-ghost text-danger" onClick={remove} disabled={del.isPending}>
              <Trash2 className="size-4" /> Apagar
            </button>
          )}
          <button className="btn-primary flex-1" disabled={save.isPending}>
            {save.isPending && <Loader2 className="size-4 animate-spin" />} {block ? 'Salvar bloco' : 'Criar bloco'}
          </button>
        </div>
      </form>
    </Sheet>
  )
}

export const EXAMPLE = `BLOCO 1 (Balada - 80)
Programa de fim de semana - C
Inevitável - C

BLOCO 2 (Marília - 130)
Largado às traças - A
Fada - A`

/** Colar o repertório do WhatsApp ou do papel; mostra na hora o que o app entendeu. */
export function ImportTextDialog({ setlistId, open, onClose }: { setlistId: string; open: boolean; onClose: () => void }) {
  const [text, setText] = useState('')
  const importText = useImportText(setlistId)
  const toast = useToast()
  const parsed = useMemo(() => parseSetlistText(text), [text])
  const songs = parsed.loose.length + parsed.blocks.reduce((n, b) => n + b.songs.length, 0)

  useEffect(() => {
    if (open) setText('')
  }, [open])

  const submit = () =>
    importText.mutate(text, {
      onSuccess: (r) => {
        const parts = [
          `${r.songs} ${r.songs === 1 ? 'música' : 'músicas'}${r.blocks ? ` em ${r.blocks} ${r.blocks === 1 ? 'bloco' : 'blocos'}` : ''}`,
        ]
        if (r.found) parts.push(`${r.found} já estava${r.found === 1 ? '' : 'm'} na sua biblioteca`)
        if (r.created.length) parts.push(`${r.created.length} criada${r.created.length === 1 ? '' : 's'} só com nome e tom`)
        toast(parts.join(' · '))
        onClose()
      },
      onError: (e) => toast(e.message, 'error'),
    })

  return (
    <Sheet open={open} onClose={onClose} title="Colar lista do repertório" wide>
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Cole do WhatsApp, do Word ou do bloco de notas. Uma música por linha com o tom (<b className="text-text">Fada - A</b>) e os blocos
          com nome, estilo e BPM (<b className="text-text">BLOCO 2 (Marília - 130)</b>).
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <textarea
            className="input h-64 resize-none py-3 font-mono text-sm leading-relaxed md:h-80"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={EXAMPLE}
            spellCheck={false}
            autoFocus
            aria-label="Lista do repertório"
          />
          {/* Prévia: o músico confere antes de adicionar */}
          <div className="h-64 overflow-y-auto rounded-xl border border-border bg-bg/60 p-3 md:h-80" aria-live="polite">
            {songs === 0 && parsed.blocks.length === 0 ? (
              <p className="grid h-full place-items-center text-center text-sm text-muted">A prévia aparece aqui enquanto você cola.</p>
            ) : (
              <div className="space-y-3 text-sm">
                {parsed.loose.length > 0 && <PreviewSongs songs={parsed.loose} />}
                {parsed.blocks.map((b, i) => (
                  <div key={i}>
                    <p className="font-bold" style={{ color: blockColor(i) }}>
                      {b.name}
                      {blockSubtitle(b) && <span className="ml-1.5 font-medium text-muted">· {blockSubtitle(b)}</span>}
                    </p>
                    {b.songs.length ? <PreviewSongs songs={b.songs} /> : <p className="text-xs text-muted">(sem músicas)</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {songs > 0 &&
              `${songs} ${songs === 1 ? 'música' : 'músicas'}${parsed.blocks.length ? ` · ${parsed.blocks.length} ${parsed.blocks.length === 1 ? 'bloco' : 'blocos'}` : ''}`}
          </p>
          <button className="btn-primary" onClick={submit} disabled={songs === 0 || importText.isPending}>
            {importText.isPending ? <Loader2 className="size-4 animate-spin" /> : <ClipboardPaste className="size-4" />} Adicionar ao
            repertório
          </button>
        </div>
        <p className="text-xs text-muted">
          As músicas que já estão na sua biblioteca são usadas com a cifra. As outras entram só com nome e tom; você pode escrever ou
          importar a cifra depois.
        </p>
      </div>
    </Sheet>
  )
}

export function PreviewSongs({ songs }: { songs: { title: string; key: string | null }[] }) {
  return (
    <ul className="mt-1 space-y-0.5">
      {songs.map((s, i) => (
        <li key={i} className="flex items-baseline justify-between gap-3">
          <span className="truncate">• {s.title}</span>
          {s.key ? <b className="shrink-0 font-mono text-chord">{s.key}</b> : <span className="shrink-0 text-xs text-muted">sem tom</span>}
        </li>
      ))}
    </ul>
  )
}
