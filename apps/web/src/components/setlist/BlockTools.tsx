// Montar blocos sem trabalho: dividir a lista a cada N músicas, criar um bloco já escolhendo
// as músicas, ou trazer várias músicas de uma vez para um bloco que já existe.
import clsx from 'clsx'
import { Check, Layers, Loader2, Wand2 } from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { type BlockLayout, useArrangeBlocks, useReorderLayout } from '../../lib/setlists'
import type { SetlistBlock, SetlistDetail } from '../../lib/types'
import { Sheet } from '../Sheet'
import { useToast } from '../ui'
import { blockColor } from './Blocks'

const SIZES = [3, 4, 5, 6, 8, 10]

/** Dividir o repertório inteiro em blocos de N músicas, na ordem atual. */
export function SplitBlocksDialog({ setlist, open, onClose }: { setlist: SetlistDetail; open: boolean; onClose: () => void }) {
  const arrange = useArrangeBlocks(setlist.id)
  const toast = useToast()
  const total = setlist.items.length
  const [size, setSize] = useState(6)
  const [prefix, setPrefix] = useState('Bloco')

  useEffect(() => {
    if (!open) return
    // Sugestão: blocos de 6 (ou menos, se a lista é curta).
    setSize(total <= 8 ? Math.max(2, Math.ceil(total / 2)) : 6)
    setPrefix('Bloco')
  }, [open, total])

  // Blocos equilibrados: 14 músicas de "6 em 6" viram 5 + 5 + 4 (e não 6 + 6 + 2).
  const chunks = useMemo(() => {
    const k = Math.max(1, Math.ceil(total / size))
    const out: SetlistDetail['items'][] = []
    let start = 0
    for (let i = 0; i < k; i++) {
      const n = Math.floor(total / k) + (i < total % k ? 1 : 0)
      out.push(setlist.items.slice(start, start + n))
      start += n
    }
    return out.filter((c) => c.length)
  }, [setlist.items, size, total])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (setlist.blocks.length && !confirm(`Os ${setlist.blocks.length} blocos atuais serão refeitos. Continuar?`)) return
    const name = prefix.trim() || 'Bloco'
    arrange.mutate(
      {
        replace: true,
        blocks: chunks.map((c, i) => ({ name: `${name} ${i + 1}`, style: null, bpm: null, notes: null, itemIds: c.map((it) => it.id) })),
      },
      {
        onSuccess: () => {
          toast(`Repertório dividido em ${chunks.length} blocos.`)
          onClose()
        },
        onError: (err) => toast(err.message, 'error'),
      },
    )
  }

  return (
    <Sheet open={open} onClose={onClose} title="Dividir em blocos">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted">As {total} músicas são separadas na ordem atual, em blocos de tamanho parecido. Nomes e músicas podem ser ajustados depois.</p>
        <div>
          <p className="label">Até quantas músicas por bloco</p>
          <div className="flex flex-wrap gap-2">
            {SIZES.filter((n) => n < total).map((n) => (
              <button key={n} type="button" className={clsx('chip', size === n && 'chip-on')} onClick={() => setSize(n)} aria-pressed={size === n}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="label">Nome dos blocos</span>
          <input className="input" value={prefix} onChange={(e) => setPrefix(e.target.value)} maxLength={60} placeholder="Bloco" />
        </label>

        <div className="space-y-2">
          <p className="label">Como vai ficar ({chunks.length} blocos)</p>
          {chunks.map((c, i) => (
            <div key={i} className="rounded-xl border px-3 py-2" style={{ borderColor: `${blockColor(i)}55`, background: `${blockColor(i)}14` }}>
              <p className="text-sm font-extrabold uppercase" style={{ color: blockColor(i) }}>
                {prefix.trim() || 'Bloco'} {i + 1} <span className="font-normal text-muted normal-case">· {c.length} músicas</span>
              </p>
              <p className="truncate text-xs text-muted">{c.map((it) => it.song.title).join(' · ')}</p>
            </div>
          ))}
        </div>

        <button className="btn-primary w-full" disabled={arrange.isPending || total < 2}>
          {arrange.isPending ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />} Dividir em {chunks.length} blocos
        </button>
      </form>
    </Sheet>
  )
}

/**
 * Escolher músicas do repertório: para um bloco novo (com nome) ou para trazer a um bloco que
 * já existe. As músicas saem de onde estavam e entram na ordem em que aparecem na lista.
 */
export function PickSongsDialog({
  setlist,
  target,
  onClose,
}: {
  setlist: SetlistDetail
  /** 'new' = criar um bloco; um bloco = trazer músicas para ele; null = fechado. */
  target: SetlistBlock | 'new' | null
  onClose: () => void
}) {
  const arrange = useArrangeBlocks(setlist.id)
  const reorder = useReorderLayout(setlist.id)
  const toast = useToast()
  const isNew = target === 'new'
  const block = target && target !== 'new' ? target : null
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [name, setName] = useState('')
  const [style, setStyle] = useState('')

  useEffect(() => {
    if (!target) return
    setPicked(new Set())
    setName(`Bloco ${setlist.blocks.length + 1}`)
    setStyle('')
  }, [target, setlist.blocks.length])

  const blockIndex = new Map(setlist.blocks.map((b, i) => [b.id, i]))
  // As que já estão no bloco escolhido não aparecem; as sem bloco vêm marcadas como "sem bloco".
  const options = setlist.items.filter((it) => !block || it.blockId !== block.id)
  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const looseIds = options.filter((it) => !it.blockId).map((it) => it.id)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const ids = setlist.items.filter((it) => picked.has(it.id)).map((it) => it.id)
    const done = (msg: string) => {
      toast(msg)
      onClose()
    }
    if (isNew) {
      arrange.mutate(
        { blocks: [{ name: name.trim() || `Bloco ${setlist.blocks.length + 1}`, style: style.trim() || null, bpm: null, notes: null, itemIds: ids }] },
        { onSuccess: () => done(ids.length ? `Bloco criado com ${ids.length} músicas.` : 'Bloco criado.'), onError: (err) => toast(err.message, 'error') },
      )
      return
    }
    if (!block || !ids.length) return
    // Layout atual sem as escolhidas; elas entram no fim do bloco de destino.
    const layout: BlockLayout = [
      { blockId: null, itemIds: setlist.items.filter((it) => !it.blockId && !picked.has(it.id)).map((it) => it.id) },
      ...setlist.blocks.map((b) => ({
        blockId: b.id,
        itemIds: [
          ...setlist.items.filter((it) => it.blockId === b.id && !picked.has(it.id)).map((it) => it.id),
          ...(b.id === block.id ? ids : []),
        ],
      })),
    ]
    reorder.mutate(layout, { onSuccess: () => done(`${ids.length} músicas foram para o ${block.name}.`), onError: (err) => toast(err.message, 'error') })
  }

  const busy = arrange.isPending || reorder.isPending
  return (
    <Sheet open={target !== null} onClose={onClose} title={isNew ? 'Novo bloco' : `Trazer músicas para o ${block?.name ?? ''}`}>
      <form onSubmit={submit} className="space-y-4">
        {isNew && (
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label">Nome do bloco</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </label>
            <label className="block">
              <span className="label">Estilo (opcional)</span>
              <input className="input" value={style} onChange={(e) => setStyle(e.target.value)} maxLength={80} placeholder="Sertanejo, Xote…" />
            </label>
          </div>
        )}
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="label mb-0">{isNew ? 'Músicas deste bloco' : 'Escolha as músicas'}</p>
            {looseIds.length > 0 && (
              <button type="button" className="text-xs font-semibold text-accent hover:underline" onClick={() => setPicked(new Set([...picked, ...looseIds]))}>
                Marcar todas sem bloco ({looseIds.length})
              </button>
            )}
          </div>
          {options.length === 0 ? (
            <p className="rounded-xl bg-surface-2 p-3 text-sm text-muted">Todas as músicas do repertório já estão neste bloco.</p>
          ) : (
            <ul className="max-h-[50dvh] divide-y divide-border overflow-y-auto rounded-xl border border-border">
              {options.map((it) => {
                const on = picked.has(it.id)
                const bi = it.blockId ? blockIndex.get(it.blockId) : undefined
                const from = bi !== undefined ? setlist.blocks[bi] : null
                return (
                  <li key={it.id}>
                    <button
                      type="button"
                      className={clsx('flex w-full items-center gap-3 px-3 py-2.5 text-left transition', on ? 'bg-accent/10' : 'hover:bg-surface-2')}
                      onClick={() => toggle(it.id)}
                      aria-pressed={on}
                    >
                      <span
                        className={clsx(
                          'grid size-5 shrink-0 place-items-center rounded-md border',
                          on ? 'border-accent bg-accent text-accent-ink' : 'border-border',
                        )}
                      >
                        {on && <Check className="size-3.5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{it.song.title}</span>
                        <span className="block truncate text-xs text-muted">{it.song.artist}</span>
                      </span>
                      {from && bi !== undefined ? (
                        <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase" style={{ color: blockColor(bi), background: `${blockColor(bi)}1f` }}>
                          {from.name}
                        </span>
                      ) : (
                        <span className="shrink-0 text-[10px] text-muted">sem bloco</span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <p className="mt-2 text-xs text-muted">As músicas marcadas saem de onde estão e vão para {isNew ? 'o bloco novo' : 'este bloco'}.</p>
        </div>
        <button className="btn-primary w-full" disabled={busy || (!isNew && picked.size === 0)}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Layers className="size-4" />}
          {isNew ? (picked.size ? `Criar bloco com ${picked.size} músicas` : 'Criar bloco vazio') : `Trazer ${picked.size || ''} músicas`}
        </button>
      </form>
    </Sheet>
  )
}
