// Ensaios no estúdio: data, estúdio, custo e a parte de cada músico.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'

export interface RehearsalShare {
  userId: string
  name: string
  image: string | null
  amountCents: number
  paidAt: string | null
}

export interface Rehearsal {
  id: string
  setlistId: string
  startsAt: string
  durationMin: number
  studioName: string | null
  room: string | null
  address: string | null
  phone: string | null
  costCents: number | null
  paidBy: string | null
  paidByName: string | null
  notes: string | null
  shares: RehearsalShare[]
}

export interface RehearsalInput {
  startsAt: string
  durationMin: number
  studioName: string | null
  room: string | null
  address: string | null
  phone: string | null
  costCents: number | null
  paidBy: string | null
  notes: string | null
  participants?: string[]
}

export interface MyRehearsal {
  id: string
  setlistId: string
  setlistName: string
  startsAt: string
  durationMin: number
  studioName: string | null
  room: string | null
  address: string | null
  amountCents: number | null
  paidAt: string | null
  paidByName: string | null
}

export interface SavedStudio {
  studioName: string
  room: string | null
  address: string | null
  phone: string | null
  costCents: number | null
  durationMin: number
}

export const rehearsalKeys = {
  setlist: (id: string) => ['ensaios', 'setlist', id] as const,
  mine: ['ensaios', 'meus'] as const,
  studios: ['ensaios', 'estudios'] as const,
}

export function useRehearsals(setlistId: string) {
  return useQuery({
    queryKey: rehearsalKeys.setlist(setlistId),
    queryFn: () => api<{ canEdit: boolean; rehearsals: Rehearsal[] }>(`/ensaios/setlist/${setlistId}`),
  })
}

export function useMyRehearsals() {
  return useQuery({ queryKey: rehearsalKeys.mine, queryFn: () => api<MyRehearsal[]>('/ensaios/meus') })
}

export function useSavedStudios(enabled: boolean) {
  return useQuery({ queryKey: rehearsalKeys.studios, queryFn: () => api<SavedStudio[]>('/ensaios/estudios'), enabled, staleTime: 60_000 })
}

function useDone() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['ensaios'] })
}

export function useSaveRehearsal(setlistId: string) {
  const done = useDone()
  return useMutation({
    mutationFn: ({ id, ...input }: RehearsalInput & { id?: string }) =>
      id ? api(`/ensaios/${id}`, { method: 'PUT', json: input }) : api(`/ensaios/setlist/${setlistId}`, { method: 'POST', json: input }),
    onSuccess: done,
  })
}

export function useDeleteRehearsal() {
  const done = useDone()
  return useMutation({ mutationFn: (id: string) => api(`/ensaios/${id}`, { method: 'DELETE' }), onSuccess: done })
}

export function useSharePaid() {
  const done = useDone()
  return useMutation({
    mutationFn: ({ id, userId, paid }: { id: string; userId: string; paid: boolean }) =>
      api(`/ensaios/${id}/partes/${userId}`, { method: 'PATCH', json: { paid } }),
    onSuccess: done,
  })
}
