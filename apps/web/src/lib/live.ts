import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useToast } from '../components/ui'
import { api } from './api'
import { setlistKeys, useSetlistSync } from './setlists'

export interface StageState {
  leaderId: string
  leaderName: string
  position: number
  section: number | null
  seq: number
  startedAt: number
  updatedAt: number
}

export interface PresenceEntry {
  userId: string
  name: string
  following: boolean
  leading: boolean
  devices: number
}

export type LiveStatus = 'connecting' | 'live' | 'offline'

/**
 * Conexão ao vivo com o repertório (Server-Sent Events). Recebe na hora as alterações,
 * o Modo Palco e quem está conectado. Se a conexão cair, o navegador reconecta sozinho;
 * enquanto isso, a checagem periódica de revisão continua como plano B.
 */
export function useSetlistLive(setlistId: string | undefined, revision: number | undefined) {
  const qc = useQueryClient()
  const toast = useToast()
  const navigate = useNavigate()
  const [status, setStatus] = useState<LiveStatus>('connecting')
  const [stage, setStage] = useState<StageState | null>(null)
  const [presence, setPresence] = useState<PresenceEntry[]>([])
  const [clientId, setClientId] = useState<string | null>(null)
  const known = useRef(revision)
  known.current = revision

  // Plano B: sem conexão ao vivo, pergunta a revisão de tempos em tempos.
  useSetlistSync(status === 'live' ? undefined : setlistId, revision)

  useEffect(() => {
    if (!setlistId || typeof EventSource === 'undefined') {
      setStatus('offline')
      return
    }
    const refresh = () => {
      qc.invalidateQueries({ queryKey: setlistKeys.detail(setlistId) })
      qc.invalidateQueries({ queryKey: ['song'] })
    }
    const es = new EventSource(`/api/setlists/${setlistId}/events`)
    const on = (event: string, fn: (data: any) => void) =>
      es.addEventListener(event, (e) => fn(JSON.parse((e as MessageEvent).data)))

    on('hello', (d) => {
      setStatus('live')
      setClientId(d.clientId)
      setStage(d.stage)
      setPresence(d.presence)
      // Reconectou depois de ficar fora: se algo mudou nesse meio-tempo, recarrega.
      if (known.current !== undefined && d.revision !== known.current) refresh()
    })
    on('revision', (d) => {
      if (d.revision !== known.current) refresh()
    })
    on('marks', (d) => qc.invalidateQueries({ queryKey: ['song', d.songId] }))
    on('stage', setStage)
    on('presence', setPresence)
    const leave = (message: string) => {
      es.close()
      setStatus('offline')
      toast(message, 'error')
      qc.invalidateQueries({ queryKey: setlistKeys.all })
      navigate('/repertorios', { replace: true })
    }
    on('removed', () => leave('Você não faz mais parte deste repertório.'))
    on('deleted', () => leave('Este repertório foi excluído.'))
    es.onerror = () => setStatus(es.readyState === EventSource.CLOSED ? 'offline' : 'connecting')

    return () => es.close()
  }, [setlistId, qc, toast, navigate])

  const setFollowing = useCallback(
    (following: boolean) => {
      if (!setlistId || !clientId) return
      api(`/setlists/${setlistId}/presence`, { method: 'POST', json: { clientId, following } }).catch(() => {})
    },
    [setlistId, clientId],
  )

  const command = useCallback(
    async (body: { action: 'go' | 'stop'; position?: number; section?: number | null }) => {
      if (!setlistId) return
      try {
        await api(`/setlists/${setlistId}/stage`, { method: 'POST', json: body })
      } catch (e) {
        toast((e as Error).message, 'error')
      }
    },
    [setlistId, toast],
  )

  return { status, stage, presence, clientId, setFollowing, command }
}

export type LiveSetlist = ReturnType<typeof useSetlistLive>
