// Financeiro do show: receitas, despesas e cachês por repertório; resumo do mês do líder.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'

export type EntryKind = 'receita' | 'despesa' | 'cache'

export interface Entry {
  id: string
  kind: EntryKind
  description: string
  amountCents: number
  userId: string | null
  userName: string | null
  settledAt: string | null
}

export interface EntryInput {
  kind: EntryKind
  description: string
  amountCents: number
  userId?: string | null
  settled?: boolean
}

export interface MonthRow {
  id: string
  name: string
  eventDate: string
  receita: number
  despesa: number
  cache: number
  aReceber: number
  aPagar: number
}

export const KIND_LABEL: Record<EntryKind, string> = { receita: 'Receitas', despesa: 'Despesas', cache: 'Cachês dos músicos' }

export const financeKeys = {
  setlist: (id: string) => ['financeiro', 'setlist', id] as const,
  month: (mes: string) => ['financeiro', 'resumo', mes] as const,
}

export function useFinance(setlistId: string) {
  return useQuery({
    queryKey: financeKeys.setlist(setlistId),
    queryFn: () => api<{ canEdit: boolean; entries: Entry[] }>(`/financeiro/setlist/${setlistId}`),
  })
}

export function useMonthFinance(mes: string) {
  return useQuery({ queryKey: financeKeys.month(mes), queryFn: () => api<MonthRow[]>(`/financeiro/resumo?mes=${mes}`) })
}

function useDone() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['financeiro'] })
}

export function useAddEntries(setlistId: string) {
  const done = useDone()
  return useMutation({
    mutationFn: (entries: EntryInput[]) => api(`/financeiro/setlist/${setlistId}`, { method: 'POST', json: { entries } }),
    onSuccess: done,
  })
}

export function useSettle() {
  const done = useDone()
  return useMutation({
    mutationFn: ({ id, settled }: { id: string; settled: boolean }) => api(`/financeiro/${id}/acerto`, { method: 'PATCH', json: { settled } }),
    onSuccess: done,
  })
}

export function useDeleteEntry() {
  const done = useDone()
  return useMutation({ mutationFn: (id: string) => api(`/financeiro/${id}`, { method: 'DELETE' }), onSuccess: done })
}

/** Somas do show: o lucro é o que entrou menos despesas e cachês. */
export function totalsOf(entries: Entry[]) {
  const sum = (k: EntryKind, open = false) => entries.filter((e) => e.kind === k && (!open || !e.settledAt)).reduce((n, e) => n + e.amountCents, 0)
  const receita = sum('receita')
  const despesa = sum('despesa')
  const cache = sum('cache')
  return { receita, despesa, cache, lucro: receita - despesa - cache, aReceber: sum('receita', true), aPagar: sum('despesa', true) + sum('cache', true) }
}
