import { Navigate, useNavigate, useParams } from 'react-router'
import { ErrorState, PageSpinner } from '../components/ui'
import { useSetlist, useSetlistSync } from '../lib/setlists'
import { SongViewer } from './SongView'

/** /repertorios/:id/tocar/:pos — as músicas em sequência, no tom do repertório. */
export function SetlistPlay() {
  const { id, pos } = useParams()
  const navigate = useNavigate()
  const { data: s, isLoading, error, refetch } = useSetlist(id)
  useSetlistSync(id, s?.revision)

  if (isLoading) return <PageSpinner />
  if (error || !s) return <ErrorState error={error ?? new Error('Repertório não encontrado.')} onRetry={() => refetch()} />
  if (!s.items.length) return <Navigate to={`/repertorios/${s.id}`} replace />

  const index = Math.min(Math.max(Number(pos) || 0, 0), s.items.length - 1)
  const item = s.items[index]
  const go = (i: number) => navigate(`/repertorios/${s.id}/tocar/${i}`, { replace: true })
  const prevItem = s.items[index - 1]
  const nextItem = s.items[index + 1]

  return (
    <SongViewer
      key={item.id}
      songId={item.song.id}
      setlist={{
        id: s.id,
        name: s.name,
        position: index,
        total: s.items.length,
        itemKey: item.key,
        itemNotes: item.notes,
        prev: prevItem ? { title: prevItem.song.title, go: () => go(index - 1) } : undefined,
        next: nextItem ? { title: nextItem.song.title, go: () => go(index + 1) } : undefined,
        onExit: () => navigate(`/repertorios/${s.id}`),
      }}
    />
  )
}
