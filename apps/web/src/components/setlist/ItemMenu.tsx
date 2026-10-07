import {
  isShortMusicLink,
  MUSIC_SERVICE_COLOR,
  MUSIC_SERVICE_LABEL,
  MUSIC_SERVICES,
  parseMusicLink,
  type MusicService,
} from '@ensaio/shared'
import clsx from 'clsx'
import { CirclePlay, FileText, Layers, Link2, Loader2, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSession } from '../../lib/auth'
import { setListenService, useListen, useListenService } from '../../lib/listen'
import { useRemoveItem, useUpdateItem, useUpdateReference } from '../../lib/setlists'
import type { SetlistBlock, SetlistItem } from '../../lib/types'
import { ReferenceLinkInput } from '../ReferenceLinkInput'
import { Sheet } from '../Sheet'
import { useToast } from '../ui'
import { keyOptions } from './SongsPanel'

/** Botão de ouvir da lista: abre a música no serviço que a pessoa usa. */
export function ListenButton({ song, className }: { song: SetlistItem['song']; className?: string }) {
  const { service, url, isReference } = useListen(song)
  const label = MUSIC_SERVICE_LABEL[service]
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={clsx('grid size-8 shrink-0 place-items-center rounded-lg sm:size-9', className)}
      style={{ color: MUSIC_SERVICE_COLOR[service] }}
      aria-label={`Ouvir ${song.title} no ${label}`}
      title={isReference ? `Ouvir a gravação de referência no ${label}` : `Procurar no ${label}`}
    >
      <CirclePlay className="size-5" />
    </a>
  )
}

/** Versão compacta (cabeçalho da lista): cada músico escolhe onde ouve, inclusive quem só vê. */
export function ListenServiceSelect() {
  const service = useListenService()
  return (
    <label className="chip h-9 cursor-pointer gap-1.5 pr-1" title="Onde você ouve as músicas (fica salvo neste aparelho)">
      <CirclePlay className="size-4 shrink-0" style={{ color: MUSIC_SERVICE_COLOR[service] }} />
      <span className="sr-only">Ouvir no</span>
      <select
        className="cursor-pointer bg-transparent text-sm focus:outline-none"
        value={service}
        onChange={(e) => setListenService(e.target.value as MusicService)}
      >
        {MUSIC_SERVICES.map((s) => (
          <option key={s} value={s}>
            {MUSIC_SERVICE_LABEL[s]}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Escolha de onde a pessoa ouve (fica salva no aparelho). */
export function ListenServicePicker() {
  const service = useListenService()
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Onde você ouve as músicas">
      {MUSIC_SERVICES.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={service === s}
          onClick={() => setListenService(s)}
          className={clsx('chip h-8 text-xs', service === s && 'border-accent bg-accent/15 text-text')}
        >
          <span className="size-2 rounded-full" style={{ background: MUSIC_SERVICE_COLOR[s] }} />
          {MUSIC_SERVICE_LABEL[s]}
        </button>
      ))}
    </div>
  )
}

/**
 * Tudo sobre uma música do repertório, num lugar só: ouvir, abrir a cifra, tom,
 * observação, mudar de bloco e tirar do repertório.
 */
export function ItemMenu({
  setlistId,
  item,
  blocks,
  open,
  onClose,
  onOpenSong,
  onMoveToBlock,
}: {
  setlistId: string
  item: SetlistItem
  blocks: SetlistBlock[]
  open: boolean
  onClose: () => void
  onOpenSong: () => void
  onMoveToBlock: (blockId: string | null) => void
}) {
  const update = useUpdateItem(setlistId)
  const remove = useRemoveItem(setlistId)
  const updateRef = useUpdateReference(setlistId)
  const toast = useToast()
  const { data: session } = useSession()
  const [notes, setNotes] = useState(item.notes ?? '')
  const [refUrl, setRefUrl] = useState(item.song.referenceUrl)
  const [editingRef, setEditingRef] = useState(false)
  const listen = useListen(item.song)
  const ref = parseMusicLink(item.song.referenceUrl)
  const canEditRef = session?.user.id === item.song.ownerId

  useEffect(() => {
    if (open) {
      setNotes(item.notes ?? '')
      setRefUrl(item.song.referenceUrl)
      setEditingRef(false)
    }
  }, [open, item.notes, item.song.referenceUrl])

  const refValid = !refUrl || Boolean(parseMusicLink(refUrl)) || isShortMusicLink(refUrl)
  const saveRef = () =>
    updateRef.mutate(
      { songId: item.song.id, referenceUrl: refUrl },
      {
        onSuccess: () => {
          toast(refUrl ? 'Link da gravação salvo.' : 'Link da gravação removido.')
          setEditingRef(false)
        },
        onError: (e) => toast(e.message, 'error'),
      },
    )

  const save = (patch: Partial<Pick<SetlistItem, 'key' | 'notes'>>, done?: string) =>
    update.mutate(
      { itemId: item.id, key: item.key, bpm: item.bpm, notes: item.notes, ...patch },
      { onSuccess: () => done && toast(done), onError: (e) => toast(e.message, 'error') },
    )

  const drop = () => {
    if (!confirm(`Tirar "${item.song.title}" do repertório?`)) return
    remove.mutate(item.id, {
      onSuccess: () => {
        toast('Música tirada do repertório.')
        onClose()
      },
      onError: (e) => toast(e.message, 'error'),
    })
  }

  const row = 'flex h-12 w-full items-center gap-3 rounded-xl px-2 text-left hover:bg-surface-2'
  return (
    <Sheet open={open} onClose={onClose} title={item.song.title}>
      <div className="-mx-2 flex flex-col">
        <a className={row} href={listen.url} target="_blank" rel="noreferrer" onClick={onClose}>
          <CirclePlay className="size-5" style={{ color: MUSIC_SERVICE_COLOR[listen.service] }} />
          <span>
            Ouvir no {MUSIC_SERVICE_LABEL[listen.service]}
            <span className="block text-xs text-muted">
              {listen.isReference ? 'Gravação de referência da música' : 'Busca pelo nome e artista'}
            </span>
          </span>
        </a>
        {ref && !listen.isReference && (
          <a className={row} href={ref.openUrl} target="_blank" rel="noreferrer" onClick={onClose}>
            <CirclePlay className="size-5" style={{ color: MUSIC_SERVICE_COLOR[ref.service] }} />
            <span>
              Ouvir a referência no {MUSIC_SERVICE_LABEL[ref.service]}
              <span className="block text-xs text-muted">A versão que a banda toca</span>
            </span>
          </a>
        )}
        <button
          className={row}
          onClick={() => {
            onClose()
            onOpenSong()
          }}
        >
          <FileText className="size-5 text-muted" /> Abrir a cifra
        </button>
      </div>

      <div className="mt-3 space-y-2">
        <p className="text-xs text-muted">Você ouve no:</p>
        <ListenServicePicker />
      </div>

      <div className="mt-4 space-y-4 border-t border-border pt-4">
        {canEditRef && (
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Link2 className="size-4 text-muted" /> Link da gravação
              </span>
              {!editingRef && (
                <button type="button" className="btn-ghost h-9 px-3 text-sm" onClick={() => setEditingRef(true)}>
                  {item.song.referenceUrl ? 'Trocar' : 'Adicionar'}
                </button>
              )}
            </div>
            {!editingRef && ref && (
              <p className="mt-1 truncate text-xs text-muted">
                {MUSIC_SERVICE_LABEL[ref.service]} · {item.song.referenceUrl}
              </p>
            )}
            {editingRef && (
              <div className="mt-2 space-y-2">
                <ReferenceLinkInput value={refUrl} onChange={setRefUrl} song={item.song} autoFocus />
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-primary h-10 flex-1"
                    disabled={!refValid || refUrl === item.song.referenceUrl || updateRef.isPending}
                    onClick={saveRef}
                  >
                    {updateRef.isPending ? <Loader2 className="size-4 animate-spin" /> : 'Salvar link'}
                  </button>
                  <button type="button" className="btn-ghost h-10 px-3" onClick={() => setEditingRef(false)}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <label className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">Tom neste repertório</span>
          <select
            className="h-10 rounded-lg border border-border bg-surface-2 px-2 font-mono font-bold text-chord"
            value={item.key ?? ''}
            onChange={(e) => save({ key: e.target.value || null }, 'Tom alterado.')}
            disabled={!item.song.originalKey}
          >
            <option value="">{item.song.originalKey ? `${item.song.originalKey} (original)` : '—'}</option>
            {keyOptions(item.song.originalKey).map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>

        {blocks.length > 0 && (
          <label className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Layers className="size-4 text-muted" /> Bloco
            </span>
            <select
              className="h-10 max-w-48 rounded-lg border border-border bg-surface-2 px-2 text-sm"
              value={item.blockId ?? ''}
              onChange={(e) => {
                onMoveToBlock(e.target.value || null)
                toast('Música movida de bloco.')
                onClose()
              }}
            >
              <option value="">Sem bloco</option>
              {blocks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block">
          <span className="label">Observação neste repertório</span>
          <div className="flex gap-2">
            <input
              className="input h-10"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
              placeholder="Ex.: começar só voz e violão"
            />
            <button
              className="btn-ghost h-10 shrink-0 px-3"
              disabled={(notes.trim() || null) === (item.notes ?? null) || update.isPending}
              onClick={() => save({ notes: notes.trim() || null }, 'Observação salva.')}
            >
              {update.isPending ? <Loader2 className="size-4 animate-spin" /> : 'Salvar'}
            </button>
          </div>
        </label>

        <button className="btn-ghost w-full text-danger" onClick={drop} disabled={remove.isPending}>
          {remove.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Tirar do repertório
        </button>
      </div>
    </Sheet>
  )
}
