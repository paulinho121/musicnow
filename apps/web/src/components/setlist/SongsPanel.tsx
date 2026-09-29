import { atLeast, MAJOR_KEYS, MINOR_KEYS, parseChord } from '@ensaio/shared'
import clsx from 'clsx'
import { ArrowDown, ArrowUp, Check, Lightbulb, MessageSquarePlus, Music2, Play, Plus, StickyNote, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useRemoveItem, useReorder, useResolveSuggestion, useSuggest, useUpdateItem } from '../../lib/setlists'
import type { SetlistDetail, SetlistItem } from '../../lib/types'
import { Sheet } from '../Sheet'
import { EmptyState, KeyBadge, useToast } from '../ui'
import { AddSongDialog } from './AddSongDialog'

export function keyOptions(original: string | null) {
  const minor = original ? (parseChord(original)?.suffix ?? '').startsWith('m') : false
  return minor ? MINOR_KEYS : MAJOR_KEYS
}

export function SongsPanel({ setlist }: { setlist: SetlistDetail }) {
  const isAdmin = atLeast(setlist.role, 'admin')
  const canSuggest = atLeast(setlist.role, 'suggest') && !isAdmin
  const navigate = useNavigate()
  const toast = useToast()
  const reorder = useReorder(setlist.id)
  const [adding, setAdding] = useState(false)
  const [suggestFor, setSuggestFor] = useState<SetlistItem | null | 'general'>(null)

  const move = (index: number, delta: number) => {
    const ids = setlist.items.map((i) => i.id)
    const target = index + delta
    if (target < 0 || target >= ids.length) return
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    reorder.mutate(ids, { onError: (e) => toast(e.message, 'error') })
  }

  const openSuggestions = setlist.suggestions.filter((s) => s.status === 'open')

  return (
    <div className="space-y-4">
      {isAdmin && openSuggestions.length > 0 && <SuggestionsBox setlist={setlist} />}
      {!isAdmin && setlist.suggestions.length > 0 && <MySuggestions setlist={setlist} />}

      {setlist.items.length === 0 ? (
        <EmptyState
          icon={Music2}
          title="Nenhuma música ainda"
          action={
            isAdmin && (
              <button className="btn-primary" onClick={() => setAdding(true)}>
                <Plus className="size-4" /> Adicionar músicas
              </button>
            )
          }
        >
          {isAdmin ? 'Adicione as músicas na ordem em que vão ser tocadas.' : 'Quem administra ainda não adicionou músicas.'}
        </EmptyState>
      ) : (
        <ol className="card divide-y divide-border">
          {setlist.items.map((item, index) => (
            <ItemRow
              key={item.id}
              setlistId={setlist.id}
              item={item}
              index={index}
              count={setlist.items.length}
              isAdmin={isAdmin}
              canSuggest={canSuggest}
              onPlay={() => navigate(`/repertorios/${setlist.id}/tocar/${index}`)}
              onMove={(d) => move(index, d)}
              onSuggest={() => setSuggestFor(item)}
            />
          ))}
        </ol>
      )}

      <div className="flex flex-wrap gap-2">
        {isAdmin && setlist.items.length > 0 && (
          <button className="btn-ghost" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> Adicionar música
          </button>
        )}
        {canSuggest && (
          <button className="btn-ghost" onClick={() => setSuggestFor('general')}>
            <MessageSquarePlus className="size-4" /> Enviar sugestão
          </button>
        )}
      </div>

      {isAdmin && <AddSongDialog open={adding} onClose={() => setAdding(false)} setlist={setlist} />}
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
  canSuggest,
  onPlay,
  onMove,
  onSuggest,
}: {
  setlistId: string
  item: SetlistItem
  index: number
  count: number
  isAdmin: boolean
  canSuggest: boolean
  onPlay: () => void
  onMove: (delta: number) => void
  onSuggest: () => void
}) {
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

  return (
    <li className="p-3">
      <div className="flex items-center gap-3">
        <span className="w-6 shrink-0 text-center font-mono text-sm text-muted">{index + 1}</span>
        <button className="min-w-0 flex-1 text-left" onClick={onPlay}>
          <p className="truncate font-semibold">{item.song.title}</p>
          <p className="truncate text-sm text-muted">
            {[item.song.artist, item.bpm ?? item.song.bpm ? `${item.bpm ?? item.song.bpm} BPM` : null].filter(Boolean).join(' · ')}
          </p>
        </button>
        {isAdmin ? (
          <select
            className="h-9 rounded-lg border border-border bg-surface-2 px-2 font-mono text-sm font-bold text-chord"
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
        ) : (
          <KeyBadge value={key} />
        )}
      </div>

      {item.personalKey && item.personalKey !== key && (
        <p className="mt-1 pl-9 text-xs text-muted">
          Seu tom pessoal: <b className="font-mono text-accent">{item.personalKey}</b> (o repertório usa {key})
        </p>
      )}
      {item.notes && !editingNotes && <p className="mt-1.5 pl-9 text-sm text-muted">📝 {item.notes}</p>}

      {editingNotes && (
        <div className="mt-2 flex gap-2 pl-9">
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

      <div className="mt-2 flex items-center gap-1 pl-8">
        <button className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-accent hover:bg-accent/10" onClick={onPlay}>
          <Play className="size-3.5" /> Abrir
        </button>
        {isAdmin && (
          <>
            <button className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text disabled:opacity-30" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Subir na ordem">
              <ArrowUp className="size-4" />
            </button>
            <button className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text disabled:opacity-30" onClick={() => onMove(1)} disabled={index === count - 1} aria-label="Descer na ordem">
              <ArrowDown className="size-4" />
            </button>
            <button
              className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text"
              onClick={() => {
                setNotes(item.notes ?? '')
                setEditingNotes(true)
              }}
              aria-label="Observação desta música no repertório"
            >
              <StickyNote className="size-4" />
            </button>
            <button
              className="ml-auto grid size-8 place-items-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger"
              onClick={() => confirm(`Tirar "${item.song.title}" do repertório?`) && remove.mutate(item.id, { onError: (e) => toast(e.message, 'error') })}
              aria-label="Tirar do repertório"
            >
              <Trash2 className="size-4" />
            </button>
          </>
        )}
        {canSuggest && (
          <button className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-muted hover:bg-surface-2 hover:text-text" onClick={onSuggest}>
            <Lightbulb className="size-3.5" /> Sugerir
          </button>
        )}
      </div>
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
                {itemTitle(s.itemId) && <> sobre <b>{itemTitle(s.itemId)}</b></>}
                {s.proposedKey && (
                  <>
                    : tocar em <b className="font-mono text-chord">{s.proposedKey}</b>
                  </>
                )}
              </p>
              {s.message && <p className="mt-1 text-muted">“{s.message}”</p>}
              <div className="mt-2 flex gap-2">
                <button
                  className="btn-primary h-9 px-3"
                  onClick={() =>
                    resolve.mutate(
                      { sid: s.id, status: 'accepted' },
                      { onSuccess: () => toast(s.proposedKey ? `Tom trocado para ${s.proposedKey}.` : 'Sugestão aceita.'), onError: (e) => toast(e.message, 'error') },
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
            <span className={clsx('shrink-0 text-xs font-semibold', s.status === 'accepted' ? 'text-ok' : s.status === 'rejected' ? 'text-danger' : 'text-muted')}>
              {label[s.status]}
            </span>
          </li>
        ))}
      </ul>
    </details>
  )
}

function SuggestDialog({ setlist, target, onClose }: { setlist: SetlistDetail; target: SetlistItem | null | 'general'; onClose: () => void }) {
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
