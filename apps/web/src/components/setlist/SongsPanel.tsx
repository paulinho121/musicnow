import { atLeast, MAJOR_KEYS, MINOR_KEYS, parseChord } from '@ensaio/shared'
import clsx from 'clsx'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronsDown,
  ChevronsUp,
  CirclePlay,
  ClipboardPaste,
  Layers,
  Lightbulb,
  MessageSquarePlus,
  MoreVertical,
  Music2,
  Pencil,
  Play,
  Plus,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { type BlockLayout, useRemoveItem, useReorderLayout, useResolveSuggestion, useSuggest, useUpdateItem } from '../../lib/setlists'
import type { SetlistBlock, SetlistDetail, SetlistItem } from '../../lib/types'
import { Sheet } from '../Sheet'
import { SongCover } from '../SongCover'
import { EmptyState, KeyBadge, useToast } from '../ui'
import { AddSongDialog } from './AddSongDialog'
import { BlockDialog, blockColor, blockSubtitle, ImportTextDialog } from './Blocks'
import { ItemMenu, listenUrl } from './ItemMenu'

export function keyOptions(original: string | null) {
  const minor = original ? (parseChord(original)?.suffix ?? '').startsWith('m') : false
  return minor ? MINOR_KEYS : MAJOR_KEYS
}

export function SongsPanel({ setlist }: { setlist: SetlistDetail }) {
  const isAdmin = atLeast(setlist.role, 'admin')
  const canSuggest = atLeast(setlist.role, 'suggest') && !isAdmin
  const navigate = useNavigate()
  const toast = useToast()
  const reorder = useReorderLayout(setlist.id)
  const [adding, setAdding] = useState<{ blockId: string | null } | null>(null)
  const [pasting, setPasting] = useState(false)
  const [editingBlock, setEditingBlock] = useState<SetlistBlock | null | 'new'>(null)
  const [suggestFor, setSuggestFor] = useState<SetlistItem | null | 'general'>(null)
  // Lista limpa por padrão (como a folha de papel); "Organizar" mostra os controles.
  const [organizing, setOrganizing] = useState(false)

  // Grupos na ordem da tela (e de tocar): primeiro as músicas sem bloco, depois cada bloco.
  const groups = useMemo(() => {
    const loose = setlist.items.filter((i) => !i.blockId)
    return [
      { block: null as SetlistBlock | null, items: loose },
      ...setlist.blocks.map((b) => ({ block: b as SetlistBlock | null, items: setlist.items.filter((i) => i.blockId === b.id) })),
    ]
  }, [setlist.items, setlist.blocks])
  const indexOf = new Map(setlist.items.map((it, i) => [it.id, i]))
  const hasBlocks = setlist.blocks.length > 0

  const send = (layout: BlockLayout) => reorder.mutate(layout, { onError: (e) => toast(e.message, 'error') })
  const layoutOf = (gs: typeof groups) => gs.map((g) => ({ blockId: g.block?.id ?? null, itemIds: g.items.map((i) => i.id) }))

  /** Sobe/desce a música; no começo ou fim do bloco, passa para o bloco vizinho. */
  const moveItem = (item: SetlistItem, delta: number) => {
    const layout = layoutOf(groups)
    const g = layout.findIndex((x) => x.itemIds.includes(item.id))
    const ids = layout[g].itemIds
    const i = ids.indexOf(item.id)
    const j = i + delta
    if (j >= 0 && j < ids.length) {
      ;[ids[i], ids[j]] = [ids[j], ids[i]]
    } else {
      // Procura o grupo vizinho (pula grupos que não existem na tela, como "sem bloco" vazio).
      const ng = g + delta
      if (ng < 0 || ng >= layout.length) return
      ids.splice(i, 1)
      if (delta < 0) layout[ng].itemIds.push(item.id)
      else layout[ng].itemIds.unshift(item.id)
    }
    send(layout)
  }

  /** Pelo menu da música: vai para o fim do bloco escolhido (ou para "sem bloco"). */
  const moveToBlock = (item: SetlistItem, blockId: string | null) => {
    if ((item.blockId ?? null) === blockId) return
    const layout = layoutOf(groups)
    for (const g of layout) g.itemIds = g.itemIds.filter((id) => id !== item.id)
    layout.find((g) => g.blockId === blockId)?.itemIds.push(item.id)
    send(layout)
  }

  const moveBlock = (blockId: string, delta: number) => {
    const layout = layoutOf(groups)
    const loose = layout[0]
    const blocks = layout.slice(1)
    const i = blocks.findIndex((b) => b.blockId === blockId)
    const j = i + delta
    if (j < 0 || j >= blocks.length) return
    ;[blocks[i], blocks[j]] = [blocks[j], blocks[i]]
    send([loose, ...blocks])
  }

  const openSuggestions = setlist.suggestions.filter((s) => s.status === 'open')
  const row = (item: SetlistItem) => {
    const index = indexOf.get(item.id)!
    return (
      <ItemRow
        key={item.id}
        setlistId={setlist.id}
        item={item}
        index={index}
        count={setlist.items.length}
        isAdmin={isAdmin}
        organizing={organizing}
        canSuggest={canSuggest}
        onPlay={() => navigate(`/repertorios/${setlist.id}/tocar/${index}`)}
        onMove={(d) => moveItem(item, d)}
        blocks={setlist.blocks}
        onMoveToBlock={(b) => moveToBlock(item, b)}
        onSuggest={() => setSuggestFor(item)}
      />
    )
  }

  return (
    <div className="space-y-4">
      {isAdmin && openSuggestions.length > 0 && <SuggestionsBox setlist={setlist} />}
      {!isAdmin && setlist.suggestions.length > 0 && <MySuggestions setlist={setlist} />}

      {(setlist.items.length > 0 || hasBlocks) && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {setlist.items.length} {setlist.items.length === 1 ? 'música' : 'músicas'}
            {hasBlocks && ` · ${setlist.blocks.length} ${setlist.blocks.length === 1 ? 'bloco' : 'blocos'}`}
          </p>
          {isAdmin && (
            <button
              className={clsx('chip h-9', organizing && 'chip-on')}
              onClick={() => setOrganizing((o) => !o)}
              aria-pressed={organizing}
            >
              {organizing ? <Check className="size-4" /> : <ArrowUpDown className="size-4" />}
              {organizing ? 'Concluir' : 'Organizar'}
            </button>
          )}
        </div>
      )}

      {setlist.items.length === 0 && !hasBlocks ? (
        <EmptyState
          icon={Music2}
          title="Nenhuma música ainda"
          action={
            isAdmin && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <button className="btn-primary" onClick={() => setAdding({ blockId: null })}>
                  <Plus className="size-4" /> Adicionar músicas
                </button>
                <button className="btn-ghost" onClick={() => setPasting(true)}>
                  <ClipboardPaste className="size-4" /> Colar lista pronta
                </button>
              </div>
            )
          }
        >
          {isAdmin
            ? 'Adicione as músicas na ordem do show, ou cole a lista que você já tem (com blocos, se quiser).'
            : 'Quem administra ainda não adicionou músicas.'}
        </EmptyState>
      ) : !hasBlocks ? (
        <ol className="card divide-y divide-border">{setlist.items.map(row)}</ol>
      ) : (
        <div className="space-y-4">
          {groups[0].items.length > 0 && (
            <section>
              <p className="mb-2 px-1 text-xs font-bold tracking-widest text-muted uppercase">Sem bloco</p>
              <ol className="card divide-y divide-border">{groups[0].items.map(row)}</ol>
            </section>
          )}
          {groups.slice(1).map(({ block, items }, bi) => {
            const b = block!
            const color = blockColor(bi)
            return (
              <section key={b.id} className="card overflow-hidden" style={{ borderColor: `${color}55` }}>
                {/* Cabeçalho do bloco: grande e colorido, como na folha de papel */}
                <header
                  className="flex items-center gap-3 border-b border-border px-4 py-3"
                  style={{ background: `linear-gradient(90deg, ${color}26, transparent 70%)` }}
                >
                  <span className="h-10 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-lg leading-tight font-extrabold tracking-tight uppercase" style={{ color }}>
                      {b.name}
                    </h3>
                    <p className="truncate text-sm text-muted">
                      {[blockSubtitle(b), `${items.length} ${items.length === 1 ? 'música' : 'músicas'}`].filter(Boolean).join(' · ')}
                    </p>
                    {b.notes && <p className="mt-0.5 truncate text-xs text-muted italic">{b.notes}</p>}
                  </div>
                  {isAdmin && (
                    <div className="flex shrink-0 items-center">
                      {organizing && (
                        <>
                          <button
                            className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text disabled:opacity-30"
                            onClick={() => moveBlock(b.id, -1)}
                            disabled={bi === 0}
                            aria-label={`Subir o ${b.name}`}
                          >
                            <ChevronsUp className="size-4" />
                          </button>
                          <button
                            className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text disabled:opacity-30"
                            onClick={() => moveBlock(b.id, 1)}
                            disabled={bi === setlist.blocks.length - 1}
                            aria-label={`Descer o ${b.name}`}
                          >
                            <ChevronsDown className="size-4" />
                          </button>
                        </>
                      )}
                      <button
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-muted hover:bg-surface-2 hover:text-text"
                        onClick={() => setEditingBlock(b)}
                        aria-label={`Editar o ${b.name}`}
                      >
                        <Pencil className="size-3.5" /> Editar
                      </button>
                    </div>
                  )}
                </header>
                {items.length > 0 ? (
                  <ol className="divide-y divide-border">{items.map(row)}</ol>
                ) : (
                  <p className="px-4 py-4 text-sm text-muted">Nenhuma música neste bloco ainda.</p>
                )}
                {isAdmin && (
                  <button
                    className="flex w-full items-center gap-2 border-t border-border px-4 py-2.5 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-text"
                    onClick={() => setAdding({ blockId: b.id })}
                  >
                    <Plus className="size-4" /> Adicionar música no {b.name}
                  </button>
                )}
              </section>
            )
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {isAdmin && (setlist.items.length > 0 || hasBlocks) && (
          <>
            {!hasBlocks && (
              <button className="btn-ghost" onClick={() => setAdding({ blockId: null })}>
                <Plus className="size-4" /> Adicionar música
              </button>
            )}
            <button className="btn-ghost" onClick={() => setEditingBlock('new')}>
              <Layers className="size-4" /> Novo bloco
            </button>
            <button className="btn-ghost" onClick={() => setPasting(true)}>
              <ClipboardPaste className="size-4" /> Colar lista
            </button>
          </>
        )}
        {canSuggest && (
          <button className="btn-ghost" onClick={() => setSuggestFor('general')}>
            <MessageSquarePlus className="size-4" /> Enviar sugestão
          </button>
        )}
      </div>

      {isAdmin && (
        <>
          <AddSongDialog
            open={adding !== null}
            onClose={() => setAdding(null)}
            setlist={setlist}
            blockId={adding?.blockId ?? null}
            blockName={setlist.blocks.find((b) => b.id === adding?.blockId)?.name ?? null}
          />
          <ImportTextDialog setlistId={setlist.id} open={pasting} onClose={() => setPasting(false)} />
          <BlockDialog
            setlistId={setlist.id}
            open={editingBlock !== null}
            block={editingBlock === 'new' ? null : editingBlock}
            onClose={() => setEditingBlock(null)}
            suggestedName={`Bloco ${setlist.blocks.length + 1}`}
          />
        </>
      )}
      <SuggestDialog setlist={setlist} target={suggestFor} onClose={() => setSuggestFor(null)} />
    </div>
  )
}

function ItemRow({
  setlistId,
  item,
  index,
  count,
  isAdmin,
  organizing,
  canSuggest,
  onPlay,
  onMove,
  onSuggest,
  blocks,
  onMoveToBlock,
}: {
  setlistId: string
  item: SetlistItem
  index: number
  count: number
  isAdmin: boolean
  /** Mostra os controles (ordem, tom, observação, tirar). Sem isso, a lista fica limpa. */
  organizing: boolean
  canSuggest: boolean
  onPlay: () => void
  onMove: (delta: number) => void
  onSuggest: () => void
  blocks: SetlistBlock[]
  onMoveToBlock: (blockId: string | null) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const update = useUpdateItem(setlistId)
  const remove = useRemoveItem(setlistId)
  const toast = useToast()
  const [editingNotes, setEditingNotes] = useState(false)
  const [notes, setNotes] = useState(item.notes ?? '')
  const key = item.key ?? item.song.originalKey

  const save = (patch: Partial<Pick<SetlistItem, 'key' | 'notes'>>) =>
    update.mutate(
      { itemId: item.id, key: item.key, bpm: item.bpm, notes: item.notes, ...patch },
      { onError: (e) => toast(e.message, 'error') },
    )

  const editing = isAdmin && organizing
  const keyControl = editing ? (
    <select
      className="h-9 max-w-28 min-w-0 rounded-lg border border-border bg-surface-2 px-2 font-mono text-sm font-bold text-chord"
      value={item.key ?? ''}
      onChange={(e) => save({ key: e.target.value || null })}
      aria-label={`Tom de ${item.song.title}`}
      disabled={!item.song.originalKey}
    >
      <option value="">{item.song.originalKey ? `${item.song.originalKey} (orig.)` : '—'}</option>
      {keyOptions(item.song.originalKey).map((k) => (
        <option key={k}>{k}</option>
      ))}
    </select>
  ) : key ? (
    // Tom em destaque, para ler de longe
    <span
      className="grid h-9 min-w-9 place-items-center rounded-lg bg-accent/12 px-1.5 font-mono text-base font-black text-chord sm:min-w-11 sm:px-2"
      title="Tom"
    >
      {key}
    </span>
  ) : (
    <KeyBadge value={key} />
  )

  return (
    <li className="p-3">
      {/* Celular: sem o número da ordem e com capa/botões menores, para o nome caber. */}
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="hidden w-5 shrink-0 text-center font-mono text-sm text-muted sm:block">{index + 1}</span>
        <button className="shrink-0" onClick={onPlay} aria-hidden tabIndex={-1}>
          <SongCover song={item.song} className="size-10 rounded-lg shadow-md shadow-black/30 sm:size-12" />
        </button>
        <button className="min-w-0 flex-1 text-left" onClick={onPlay}>
          <p className="line-clamp-2 leading-snug font-semibold break-words sm:truncate">
            {item.song.title}
            {!item.song.hasContent && (
              <span className="ml-1.5 inline-block rounded bg-surface-2 px-1.5 py-px align-[1px] text-[10px] font-semibold tracking-wide text-muted uppercase">
                sem cifra
              </span>
            )}
          </p>
          <p className="truncate text-sm text-muted">
            {[item.song.artist, (item.bpm ?? item.song.bpm) ? `${item.bpm ?? item.song.bpm} BPM` : null].filter(Boolean).join(' · ')}
          </p>
        </button>
        {/* No celular o tom desce para a linha de ações: o nome da música fica legível. */}
        {canSuggest && (
          <button
            className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text"
            onClick={onSuggest}
            aria-label={`Sugerir algo sobre ${item.song.title}`}
          >
            <Lightbulb className="size-4" />
          </button>
        )}
        {/* Ouvir a música: gravação de referência ou busca no YouTube (para toda a banda) */}
        <a
          href={listenUrl(item.song)}
          target="_blank"
          rel="noreferrer"
          className="grid size-8 shrink-0 place-items-center rounded-lg text-[#ff4e45] hover:bg-[#ff4e45]/10 sm:size-9"
          aria-label={`Ouvir ${item.song.title} no YouTube`}
          title={item.song.referenceUrl ? 'Ouvir a gravação de referência' : 'Procurar no YouTube'}
        >
          <CirclePlay className="size-5" />
        </a>
        <div className={editing ? 'hidden sm:block' : ''}>{keyControl}</div>
        {isAdmin && !editing && (
          <button
            className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text sm:size-9"
            onClick={() => setMenuOpen(true)}
            aria-label={`Opções de ${item.song.title}`}
          >
            <MoreVertical className="size-4" />
          </button>
        )}
      </div>
      {isAdmin && (
        <ItemMenu
          setlistId={setlistId}
          item={item}
          blocks={blocks}
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          onOpenSong={onPlay}
          onMoveToBlock={onMoveToBlock}
        />
      )}

      {item.personalKey && item.personalKey !== key && (
        <p className="mt-1 sm:pl-[5.75rem] text-xs text-muted">
          Seu tom pessoal: <b className="font-mono text-accent">{item.personalKey}</b> (o repertório usa {key})
        </p>
      )}
      {item.notes && !editingNotes && <p className="mt-1.5 sm:pl-[5.75rem] text-sm text-muted">📝 {item.notes}</p>}

      {editingNotes && (
        <div className="mt-2 flex gap-2 sm:pl-[5.75rem]">
          <input
            className="input h-10"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={1000}
            placeholder="Ex.: momento da ceia, bem suave"
            autoFocus
          />
          <button
            className="btn-icon size-10 shrink-0"
            aria-label="Salvar observação"
            onClick={() => {
              save({ notes: notes.trim() || null })
              setEditingNotes(false)
            }}
          >
            <Check className="size-4" />
          </button>
          <button className="btn-icon size-10 shrink-0" aria-label="Cancelar" onClick={() => setEditingNotes(false)}>
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Celular: sem recuo e sem "Abrir" (tocar no nome já abre); o tom vem para esta linha. */}
      {editing && (
        <div className="mt-2 flex items-center gap-1 sm:pl-[5.5rem]">
          <div className="mr-1 sm:hidden">{keyControl}</div>
          <button
            className="hidden h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-accent hover:bg-accent/10 sm:inline-flex"
            onClick={onPlay}
          >
            <Play className="size-3.5" /> Abrir
          </button>
          <button
            className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text disabled:opacity-30"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label="Subir na ordem"
          >
            <ArrowUp className="size-4" />
          </button>
          <button
            className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text disabled:opacity-30"
            onClick={() => onMove(1)}
            disabled={index === count - 1}
            aria-label="Descer na ordem"
          >
            <ArrowDown className="size-4" />
          </button>
          <button
            className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text"
            onClick={() => {
              setNotes(item.notes ?? '')
              setEditingNotes(true)
            }}
            aria-label="Observação desta música no repertório"
          >
            <StickyNote className="size-4" />
          </button>
          <button
            className="ml-auto grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger"
            onClick={() =>
              confirm(`Tirar "${item.song.title}" do repertório?`) && remove.mutate(item.id, { onError: (e) => toast(e.message, 'error') })
            }
            aria-label="Tirar do repertório"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      )}
    </li>
  )
}

function SuggestionsBox({ setlist }: { setlist: SetlistDetail }) {
  const resolve = useResolveSuggestion(setlist.id)
  const toast = useToast()
  const itemTitle = (id: string | null) => setlist.items.find((i) => i.id === id)?.song.title
  return (
    <section className="card border-accent/40 p-4">
      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        <Lightbulb className="size-4 text-accent" /> Sugestões da banda
      </h2>
      <ul className="space-y-3">
        {setlist.suggestions
          .filter((s) => s.status === 'open')
          .map((s) => (
            <li key={s.id} className="rounded-xl bg-surface-2 p-3 text-sm">
              <p>
                <b>{s.authorName}</b>
                {itemTitle(s.itemId) && (
                  <>
                    {' '}
                    sobre <b>{itemTitle(s.itemId)}</b>
                  </>
                )}
                {s.proposedKey && (
                  <>
                    : tocar em <b className="font-mono text-chord">{s.proposedKey}</b>
                  </>
                )}
              </p>
              {s.message && <p className="mt-1 text-muted">“{s.message}”</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  className="btn-primary h-9 px-3 whitespace-nowrap"
                  onClick={() =>
                    resolve.mutate(
                      { sid: s.id, status: 'accepted' },
                      {
                        onSuccess: () => toast(s.proposedKey ? `Tom trocado para ${s.proposedKey}.` : 'Sugestão aceita.'),
                        onError: (e) => toast(e.message, 'error'),
                      },
                    )
                  }
                >
                  <Check className="size-4" /> {s.proposedKey ? 'Aceitar e aplicar' : 'Aceitar'}
                </button>
                <button className="btn-ghost h-9 px-3" onClick={() => resolve.mutate({ sid: s.id, status: 'rejected' })}>
                  Recusar
                </button>
              </div>
            </li>
          ))}
      </ul>
    </section>
  )
}

function MySuggestions({ setlist }: { setlist: SetlistDetail }) {
  const label = { open: 'Aguardando', accepted: 'Aceita', rejected: 'Recusada' } as const
  return (
    <details className="card p-4 text-sm">
      <summary className="cursor-pointer font-semibold">Minhas sugestões ({setlist.suggestions.length})</summary>
      <ul className="mt-3 space-y-2">
        {setlist.suggestions.map((s) => (
          <li key={s.id} className="flex items-start justify-between gap-3">
            <span className="text-muted">
              {setlist.items.find((i) => i.id === s.itemId)?.song.title ?? 'Geral'}
              {s.proposedKey && ` → ${s.proposedKey}`}
              {s.message && ` · “${s.message}”`}
            </span>
            <span
              className={clsx(
                'shrink-0 text-xs font-semibold',
                s.status === 'accepted' ? 'text-ok' : s.status === 'rejected' ? 'text-danger' : 'text-muted',
              )}
            >
              {label[s.status]}
            </span>
          </li>
        ))}
      </ul>
    </details>
  )
}

function SuggestDialog({
  setlist,
  target,
  onClose,
}: {
  setlist: SetlistDetail
  target: SetlistItem | null | 'general'
  onClose: () => void
}) {
  const suggest = useSuggest(setlist.id)
  const toast = useToast()
  const [key, setKey] = useState('')
  const [message, setMessage] = useState('')
  const item = target && target !== 'general' ? target : null

  const send = () =>
    suggest.mutate(
      { itemId: item?.id ?? null, proposedKey: key || null, message: message.trim() || null },
      {
        onSuccess: () => {
          toast('Sugestão enviada para quem administra o repertório.')
          setKey('')
          setMessage('')
          onClose()
        },
        onError: (e) => toast(e.message, 'error'),
      },
    )

  return (
    <Sheet open={target !== null} onClose={onClose} title={item ? `Sugerir: ${item.song.title}` : 'Enviar sugestão'}>
      {item && item.song.originalKey && (
        <label className="mb-4 block">
          <span className="label">Tocar em outro tom?</span>
          <select className="input font-mono" value={key} onChange={(e) => setKey(e.target.value)}>
            <option value="">Manter {item.key ?? item.song.originalKey}</option>
            {keyOptions(item.song.originalKey).map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
      )}
      <label className="block">
        <span className="label">Mensagem</span>
        <textarea
          className="input h-24 py-2"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={1000}
          placeholder={item ? 'Ex.: em C fica alto para mim no refrão' : 'Ex.: que tal abrir com uma música mais animada?'}
        />
      </label>
      <button className="btn-primary mt-4 w-full" onClick={send} disabled={suggest.isPending || (!key && !message.trim())}>
        {suggest.isPending ? 'Enviando...' : 'Enviar sugestão'}
      </button>
    </Sheet>
  )
}
