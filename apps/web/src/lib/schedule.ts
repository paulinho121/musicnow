// Escala de músicos: quem toca em cada repertório, a resposta de cada um e as datas em que
// cada músico não pode tocar.
import type { Instrument } from '@ensaio/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'

export type AssignmentStatus = 'pendente' | 'confirmado' | 'recusado'

export interface Assignment {
  userId: string
  name: string
  image: string | null
  instrument: Instrument | null
  status: AssignmentStatus
  note: string | null
  respondedAt: string | null
  /** Avisou que não pode na data (só quem administra vê). */
  unavailable: string | null
}

export interface SchedulePerson {
  userId: string
  name: string
  image: string | null
  instrument: Instrument | null
  /** Recado de indisponibilidade na data do repertório (null = pode). */
  unavailable: string | null
}

export interface SetlistSchedule {
  eventDate: string | null
  ownerId: string
  canEdit: boolean
  assignments: Assignment[]
  people: SchedulePerson[]
}

export interface MyAssignment {
  setlistId: string
  setlistName: string
  eventDate: string | null
  location: string | null
  leaderName: string
  instrument: Instrument | null
  status: AssignmentStatus
  note: string | null
}

export interface Unavailability {
  id: string
  startsOn: string
  endsOn: string
  note: string | null
}

export const scheduleKeys = {
  setlist: (id: string) => ['escala', 'setlist', id] as const,
  mine: ['escala', 'minhas'] as const,
  unavailable: ['escala', 'indisponivel'] as const,
}

export const STATUS_LABEL: Record<AssignmentStatus, string> = {
  pendente: 'Aguardando resposta',
  confirmado: 'Confirmado',
  recusado: 'Não pode',
}

export function useSetlistSchedule(id: string) {
  return useQuery({ queryKey: scheduleKeys.setlist(id), queryFn: () => api<SetlistSchedule>(`/escala/setlist/${id}`) })
}

export function useMySchedule() {
  return useQuery({ queryKey: scheduleKeys.mine, queryFn: () => api<MyAssignment[]>('/escala/minhas') })
}

function useInvalidate() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['escala'] })
}

export function useAssign(setlistId: string) {
  const done = useInvalidate()
  return useMutation({
    mutationFn: ({ userId, instrument }: { userId: string; instrument: Instrument | null }) =>
      api(`/escala/setlist/${setlistId}/${userId}`, { method: 'PUT', json: { instrument } }),
    onSuccess: done,
  })
}

export function useUnassign(setlistId: string) {
  const done = useInvalidate()
  return useMutation({
    mutationFn: (userId: string) => api(`/escala/setlist/${setlistId}/${userId}`, { method: 'DELETE' }),
    onSuccess: done,
  })
}

export function useRespond() {
  const done = useInvalidate()
  return useMutation({
    mutationFn: ({ setlistId, status, note }: { setlistId: string; status: 'confirmado' | 'recusado'; note?: string | null }) =>
      api(`/escala/setlist/${setlistId}/responder`, { method: 'POST', json: { status, note } }),
    onSuccess: done,
  })
}

export function useUnavailability() {
  return useQuery({ queryKey: scheduleKeys.unavailable, queryFn: () => api<Unavailability[]>('/escala/indisponivel') })
}

export function useAddUnavailability() {
  const done = useInvalidate()
  return useMutation({
    mutationFn: (input: { startsOn: string; endsOn: string; note?: string | null }) =>
      api('/escala/indisponivel', { method: 'POST', json: input }),
    onSuccess: done,
  })
}

export function useRemoveUnavailability() {
  const done = useInvalidate()
  return useMutation({
    mutationFn: (id: string) => api(`/escala/indisponivel/${id}`, { method: 'DELETE' }),
    onSuccess: done,
  })
}
