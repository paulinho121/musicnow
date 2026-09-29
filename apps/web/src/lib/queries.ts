import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ReportReason } from '@ensaio/shared'
import { api } from './api'
import type { Dashboard, ImportResult, ImportSongInput, Me, SongDetail, SongInput, SongListItem, SongMark } from './types'

export const keys = {
  me: ['me'] as const,
  dashboard: ['dashboard'] as const,
  songs: (params: Record<string, string | undefined>) => ['songs', params] as const,
  /** Prefixo ['song', id] cobre a música vista solta e dentro de qualquer repertório. */
  song: (id: string, setlistId?: string | null) => (setlistId ? ['song', id, setlistId] : ['song', id]),
  facets: ['songs', 'facets'] as const,
}

export function useMe(enabled = true) {
  return useQuery({ queryKey: keys.me, queryFn: () => api<Me>('/me'), enabled, staleTime: 60_000 })
}

export function useDashboard() {
  return useQuery({ queryKey: keys.dashboard, queryFn: () => api<Dashboard>('/me/dashboard') })
}

export function useSongs(params: { q?: string; scope?: string; key?: string; style?: string }) {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v)) as Record<string, string>
  return useQuery({
    queryKey: keys.songs(clean),
    queryFn: () => api<SongListItem[]>(`/songs?${new URLSearchParams(clean)}`),
    placeholderData: (prev) => prev,
  })
}

export function useFacets() {
  return useQuery({ queryKey: keys.facets, queryFn: () => api<{ styles: string[] }>('/songs/facets'), staleTime: 5 * 60_000 })
}

export function useSong(id: string | undefined, setlistId?: string | null) {
  return useQuery({
    queryKey: keys.song(id ?? '', setlistId),
    queryFn: () => api<SongDetail>(`/songs/${id}${setlistId ? `?setlistId=${setlistId}` : ''}`),
    enabled: Boolean(id),
  })
}

export interface MarkInput {
  lineIndex: number
  type: SongMark['type']
  text: string | null
  shared: boolean
  setlistId: string | null
}

export function useAddMark(songId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: MarkInput) => api<SongMark>(`/songs/${songId}/marks`, { method: 'POST', json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['song', songId] }),
  })
}

export function useDeleteMark(songId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (markId: string) => api(`/songs/${songId}/marks/${markId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['song', songId] }),
  })
}

export function useSaveSong(id?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SongInput) =>
      id
        ? api<{ id: string }>(`/songs/${id}`, { method: 'PUT', json: input })
        : api<{ id: string }>('/songs', { method: 'POST', json: input }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['songs'] })
      qc.invalidateQueries({ queryKey: keys.song(res.id) })
      qc.invalidateQueries({ queryKey: keys.dashboard })
    },
  })
}

export function useDeleteSong() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api(`/songs/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['songs'] })
      qc.invalidateQueries({ queryKey: keys.dashboard })
    },
  })
}

/** Favoritar com atualização otimista: a estrela muda na hora, mesmo com rede lenta. */
export function useToggleFavorite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) =>
      api(`/songs/${id}/favorite`, { method: value ? 'POST' : 'DELETE' }),
    onMutate: async ({ id, value }) => {
      qc.setQueriesData<SongDetail>({ queryKey: ['song', id] }, (s) => (s ? { ...s, isFavorite: value } : s))
      qc.setQueriesData<SongListItem[]>({ queryKey: ['songs'] }, (list) =>
        Array.isArray(list) ? list.map((s) => (s.id === id ? { ...s, isFavorite: value } : s)) : list,
      )
    },
    onSettled: (_d, _e, { id }) => {
      qc.invalidateQueries({ queryKey: keys.song(id) })
      qc.invalidateQueries({ queryKey: keys.dashboard })
      qc.invalidateQueries({ queryKey: ['songs'] })
    },
  })
}

export function useSavePersonalKey(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (personalKey: string | null) =>
      api<{ personalKey: string | null }>(`/songs/${id}/state`, { method: 'PUT', json: { personalKey } }),
    onSuccess: (res) => qc.setQueriesData<SongDetail>({ queryKey: ['song', id] }, (s) => (s ? { ...s, ...res } : s)),
  })
}

export function useSaveProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<Me> & { name: string }) => api<Me>('/me', { method: 'PUT', json: input }),
    onSuccess: (me) => qc.setQueryData(keys.me, me),
  })
}

export function checkDuplicates(items: { title: string; artist: string | null }[]) {
  return api<{ duplicates: (string | null)[] }>('/songs/import/check', { method: 'POST', json: { items } })
}

export function useImportSongs() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { songs: ImportSongInput[]; skipDuplicates: boolean }) =>
      api<ImportResult>('/songs/import', { method: 'POST', json: body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['songs'] })
      qc.invalidateQueries({ queryKey: keys.dashboard })
    },
  })
}

export function useReportSong(id: string) {
  return useMutation({
    mutationFn: (body: { reason: ReportReason; details: string | null }) =>
      api(`/songs/${id}/report`, { method: 'POST', json: body }),
  })
}
