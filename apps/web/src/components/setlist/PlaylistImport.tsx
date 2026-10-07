import { MUSIC_SERVICE_COLOR, MUSIC_SERVICE_LABEL } from '@ensaio/shared'
import { useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { Check, ListMusic, Loader2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../../lib/api'
import { setlistKeys } from '../../lib/setlists'
import { Sheet } from '../Sheet'
import { useToast } from '../ui'

interface Track {
  title: string
  artist: string | null
  url: string
  /** Já está na biblioteca (mesmo título e artista). */
  songId: string | null
}
interface Playlist {
  service: 'spotify' | 'deezer'
  name: string
  tracks: Track[]
  truncated: boolean
}

/**
 * O Spotify não deixa apps lerem playlists de outras pessoas (regra de fev/2026). O caminho:
 * copiar a playlist para o Deezer (grátis) e colar o link de lá.
 */
function SpotifyTip({ inline = false }: { inline?: boolean }) {
  const steps = (
    <>
      Copie para o Deezer de graça no{' '}
      <a href="https://www.tunemymusic.com/pt/transfer/spotify-to-deezer" target="_blank" rel="noopener noreferrer" className="text-accent underline">
        TuneMyMusic
      </a>{' '}
      (ou no próprio Deezer: Biblioteca → Playlists → Importar) e cole aqui o link da playlist do Deezer.
    </>
  )
  if (inline) return steps
  return (
    <div className="rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs">
      <b>Link do Spotify:</b> o Spotify não permite que apps leiam playlists de outras pessoas. {steps}
    </div>
  )
}

const chunks =<T,>(list: T[], size: number) =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size))

/**
 * Playlist do Spotify ou do Deezer → repertório: as músicas entram na biblioteca (só nome,
 * artista e o link daquela versão) e o repertório sai montado na ordem da playlist.
 */
export function PlaylistImport({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [playlist, setPlaylist] = useState<Playlist | null>(null)
  const [name, setName] = useState('')
  const [picked, setPicked] = useState<boolean[]>([])
  const [progress, setProgress] = useState<string | null>(null)
  const toast = useToast()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const close = () => {
    if (progress) return
    setUrl('')
    setPlaylist(null)
    onClose()
  }

  const load = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const p = await api<Playlist>('/songs/playlist', { method: 'POST', json: { url: url.trim() } })
      setPlaylist(p)
      setName(p.name)
      setPicked(p.tracks.map(() => true))
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const create = async () => {
    if (!playlist) return
    const tracks = playlist.tracks.filter((_, i) => picked[i])
    try {
      // 1. Músicas novas entram na biblioteca com o link da versão da playlist.
      const fresh = tracks.filter((t) => !t.songId)
      if (fresh.length) {
        setProgress('Adicionando as músicas à biblioteca…')
        for (const part of chunks(fresh, 100)) {
          await api('/songs/import', {
            method: 'POST',
            json: { songs: part.map((t) => ({ title: t.title, artist: t.artist, referenceUrl: t.url })), skipDuplicates: true },
          })
        }
      }
      // 2. Id de cada música (as novas e as que já existiam), na ordem da playlist.
      const ids: string[] = []
      for (const part of chunks(tracks, 100)) {
        const { duplicates } = await api<{ duplicates: (string | null)[] }>('/songs/import/check', {
          method: 'POST',
          json: { items: part.map((t) => ({ title: t.title, artist: t.artist })) },
        })
        ids.push(...duplicates.filter((id): id is string => Boolean(id)))
      }
      // 3. O repertório, na ordem (sem repetir a mesma música).
      const songIds = [...new Set(ids)]
      const { id } = await api<{ id: string }>('/setlists', { method: 'POST', json: { name: name.trim() || playlist.name } })
      setProgress('Montando o repertório…')
      await api(`/setlists/${id}/items/batch`, {
        method: 'POST',
        json: { songIds, source: `playlist do ${MUSIC_SERVICE_LABEL[playlist.service]}` },
      })
      qc.invalidateQueries({ queryKey: setlistKeys.all })
      qc.invalidateQueries({ queryKey: ['songs'] })
      toast(`Repertório "${name.trim() || playlist.name}" criado com ${songIds.length} músicas.`)
      setProgress(null)
      setPlaylist(null)
      setUrl('')
      onClose()
      navigate(`/repertorios/${id}`)
    } catch (err) {
      toast((err as Error).message, 'error')
      setProgress(null)
    }
  }

  const count = picked.filter(Boolean).length
  const fresh = playlist ? playlist.tracks.filter((t, i) => picked[i] && !t.songId).length : 0

  return (
    <Sheet open={open} onClose={close} title="Repertório a partir de uma playlist" wide>
      {!playlist ? (
        <form onSubmit={load} className="space-y-4">
          <p className="text-sm text-muted">
            Recebeu o repertório numa playlist? Cole o link da playlist do <b className="text-text">Deezer</b>: o app monta o repertório na
            mesma ordem, com o link de cada versão. Cada músico ouve onde preferir.
          </p>
          <input
            className="input"
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.deezer.com/playlist/…"
            autoFocus
            required
          />
          <p className="text-xs text-muted">No app do Deezer: abra a playlist → Compartilhar → Copiar link. A playlist precisa ser pública.</p>
          {/spotify\.(com|link)|spotify\.app\.link/i.test(url) ? (
            <SpotifyTip />
          ) : (
            <p className="text-xs text-muted">
              A playlist está no Spotify? <SpotifyTip inline />
            </p>
          )}
          <button className="btn-primary w-full" disabled={loading || !url.trim()}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <ListMusic className="size-4" />} Ler a playlist
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <label className="block">
            <span className="label">Nome do repertório</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
          </label>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2 text-muted">
              <span className="size-2 rounded-full" style={{ background: MUSIC_SERVICE_COLOR[playlist.service] }} />
              {MUSIC_SERVICE_LABEL[playlist.service]} · {count} de {playlist.tracks.length} músicas
            </span>
            <button
              type="button"
              className="text-accent hover:underline"
              onClick={() => setPicked(picked.map(() => count !== playlist.tracks.length))}
            >
              {count === playlist.tracks.length ? 'Desmarcar todas' : 'Marcar todas'}
            </button>
          </div>
          {playlist.truncated && (
            <p className="rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">
              A playlist é longa: vieram as primeiras {playlist.tracks.length}.
            </p>
          )}
          <ol className="card max-h-[45dvh] divide-y divide-border overflow-y-auto">
            {playlist.tracks.map((t, i) => (
              <li key={`${t.url}-${i}`}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-surface-2">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={picked[i]}
                    onChange={() => setPicked(picked.map((v, j) => (j === i ? !v : v)))}
                  />
                  <span
                    className={clsx(
                      'grid size-5 shrink-0 place-items-center rounded-md border',
                      picked[i] ? 'border-accent bg-accent text-bg' : 'border-border',
                    )}
                    aria-hidden
                  >
                    {picked[i] && <Check className="size-3.5" />}
                  </span>
                  <span className="w-6 shrink-0 text-right font-mono text-xs text-muted">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{t.title}</span>
                    <span className="block truncate text-xs text-muted">{t.artist}</span>
                  </span>
                  {t.songId && (
                    <span className="shrink-0 rounded-md bg-ok/15 px-2 py-0.5 text-[11px] font-semibold text-ok">Na biblioteca</span>
                  )}
                </label>
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted">
            {fresh > 0
              ? `${fresh} música(s) nova(s) entram na sua biblioteca só com nome, artista e o link da versão. Depois é só escrever a cifra.`
              : 'Todas já estão na sua biblioteca.'}
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={() => setPlaylist(null)} disabled={Boolean(progress)}>
              Outro link
            </button>
            <button type="button" className="btn-primary flex-1" onClick={create} disabled={!count || Boolean(progress)}>
              {progress ? <Loader2 className="size-4 animate-spin" /> : <ListMusic className="size-4" />}{' '}
              {progress ?? `Criar repertório (${count})`}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
