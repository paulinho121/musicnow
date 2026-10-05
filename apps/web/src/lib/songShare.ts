import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import { keys } from './queries'

export interface SongShareInfo {
  /** Link ativo (null = desligado). */
  url: string | null
  people: { userId: string; name: string; image: string | null; createdAt: string }[]
}

export interface SharedSongPreview {
  id: string
  title: string
  artist: string | null
  coverUrl: string | null
  ownerName: string
  isOwner: boolean
  alreadyHas: boolean
}

const shareKey = (songId: string) => ['song', songId, 'share'] as const

/** Link e pessoas com acesso (só a dona da música). */
export function useSongShare(songId: string, enabled: boolean) {
  return useQuery({ queryKey: shareKey(songId), queryFn: () => api<SongShareInfo>(`/songs/${songId}/share`), enabled })
}

export function useSongShareActions(songId: string) {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: shareKey(songId) })
  return {
    create: useMutation({
      mutationFn: (rotate: boolean) => api<{ url: string }>(`/songs/${songId}/share`, { method: 'POST', json: { rotate } }),
      onSuccess: refresh,
    }),
    disable: useMutation({ mutationFn: () => api(`/songs/${songId}/share`, { method: 'DELETE' }), onSuccess: refresh }),
    remove: useMutation({
      mutationFn: (userId: string) => api(`/songs/${songId}/share/${userId}`, { method: 'DELETE' }),
      onSuccess: refresh,
    }),
  }
}

/** Quem recebeu: sair da música compartilhada. */
export function useLeaveSharedSong(songId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api(`/songs/${songId}/share/eu`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['songs'] })
      qc.invalidateQueries({ queryKey: keys.dashboard })
    },
  })
}

export function useSharedSongPreview(code: string) {
  return useQuery({ queryKey: ['shared', code], queryFn: () => api<SharedSongPreview>(`/shared/${code}`), retry: false })
}

export function useAcceptSharedSong() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (code: string) => api<{ songId: string }>(`/shared/${code}/accept`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['songs'] })
      qc.invalidateQueries({ queryKey: keys.dashboard })
    },
  })
}
