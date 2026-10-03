import { atLeast } from '@ensaio/shared'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { ErrorState, PageSpinner, useToast } from '../components/ui'
import { useSession } from '../lib/auth'
import { useSetlistLive } from '../lib/live'
import { useSetlist } from '../lib/setlists'
import { SongViewer } from './SongView'

const leadingKey = (id: string) => `ef-leading-${id}`

function readLeading(id: string) {
  try {
    return sessionStorage.getItem(leadingKey(id)) === '1'
  } catch {
    return false
  }
}

function writeLeading(id: string, on: boolean) {
  try {
    if (on) sessionStorage.setItem(leadingKey(id), '1')
    else sessionStorage.removeItem(leadingKey(id))
  } catch {
    // navegação privada: só em memória
  }
}

/** /repertorios/:id/tocar/:pos — as músicas em sequência, no tom do repertório, com Modo Palco. */
export function SetlistPlay() {
  const { id, pos } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { data: session } = useSession()
  const { data: s, isLoading, error, refetch } = useSetlist(id)
  const live = useSetlistLive(id, s?.revision)
  const [following, setFollowingState] = useState(true)

  const uid = session?.user.id
  const stage = live.stage
  const isLeader = Boolean(stage && uid && stage.leaderId === uid)
  const canLead = atLeast(s?.role, 'admin')
  const total = s?.items.length ?? 0
  const index = total ? Math.min(Math.max(Number(pos) || 0, 0), total - 1) : 0

  const goTo = useCallback((i: number) => navigate(`/repertorios/${id}/tocar/${i}`, { replace: true }), [id, navigate])

  // Seguir/livre: muda localmente e avisa o servidor (aparece na lista de presença).
  const setFollowing = useCallback(
    (on: boolean) => {
      setFollowingState(on)
      live.setFollowing(on)
    },
    [live],
  )

  // Seguindo: vai para a música (e seção) que o líder escolher.
  const lastSeq = useRef<number | null>(null)
  const [scrollTarget, setScrollTarget] = useState<{ line: number | null; nonce: number } | undefined>()
  useEffect(() => {
    if (!stage || isLeader || !following) return
    if (stage.position !== index) goTo(stage.position)
    if (lastSeq.current !== stage.seq) {
      lastSeq.current = stage.seq
      setScrollTarget({ line: stage.section, nonce: stage.seq })
    }
  }, [stage, isLeader, following, index, goTo])

  // Quem estava no comando e a API reiniciou (ou a conexão caiu): retoma de onde parou.
  useEffect(() => {
    if (!id || live.status !== 'live' || !canLead) return
    if (!stage && readLeading(id)) live.command({ action: 'go', position: index })
    if (stage && stage.leaderId !== uid) writeLeading(id, false)
    // Reage só a (re)conexões e mudanças de palco; índice e comando são lidos no momento.
  }, [id, live.status, stage, canLead, uid])

  if (isLoading) return <PageSpinner />
  if (error || !s) return <ErrorState error={error ?? new Error('Repertório não encontrado.')} onRetry={() => refetch()} />
  if (!s.items.length) return <Navigate to={`/repertorios/${s.id}`} replace />

  const item = s.items[index]
  const prevItem = s.items[index - 1]
  const nextItem = s.items[index + 1]

  /** Navegação pela própria pessoa: o líder leva a banda junto; quem segue passa para "livre". */
  const move = (i: number) => {
    if (isLeader) live.command({ action: 'go', position: i })
    else if (stage && following) {
      setFollowing(false)
      toast('Você está navegando por conta própria. Toque em "Seguir" para voltar ao líder.')
    }
    goTo(i)
  }

  return (
    <SongViewer
      key={item.id}
      songId={item.song.id}
      setlist={{
        id: s.id,
        name: s.name,
        position: index,
        total,
        itemKey: item.key,
        itemNotes: item.notes,
        prev: prevItem ? { title: prevItem.song.title, go: () => move(index - 1) } : undefined,
        next: nextItem ? { title: nextItem.song.title, go: () => move(index + 1) } : undefined,
        onExit: () => navigate(`/repertorios/${s.id}`),
        scrollTarget,
        live: {
          status: live.status,
          stage,
          presence: live.presence,
          isLeader,
          canLead,
          following,
          onToggleFollow: () => {
            const next = !following
            setFollowing(next)
            if (next && stage) {
              lastSeq.current = null // reaplica a seção atual do líder
              if (stage.position !== index) goTo(stage.position)
            }
          },
          onLead: () => {
            if (stage && !isLeader && !confirm(`${stage.leaderName} está no comando. Assumir o comando da banda?`)) return
            writeLeading(s.id, true)
            live.command({ action: 'go', position: index })
            toast('Você está no comando: a banda que estiver seguindo vai junto com você.')
          },
          onStop: () => {
            if (!confirm('Encerrar o Modo Palco? Cada músico volta a navegar por conta própria.')) return
            writeLeading(s.id, false)
            live.command({ action: 'stop' })
          },
          onSection: (line) => live.command({ action: 'go', position: index, section: line }),
        },
      }}
    />
  )
}
