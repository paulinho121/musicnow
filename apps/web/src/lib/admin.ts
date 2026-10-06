import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import type { AdminAppError, AdminOverview, AdminReport, AdminTraffic, AdminUsersResponse } from './types'

export const adminKeys = {
  overview: ['admin', 'overview'] as const,
  online: ['admin', 'online'] as const,
  traffic: (days: number) => ['admin', 'traffic', days] as const,
  users: (params: { q?: string; role?: string; page?: number; limit?: number }) => ['admin', 'users', params] as const,
  reports: ['admin', 'reports'] as const,
  errors: ['admin', 'errors'] as const,
}

export function useAdminOverview() {
  return useQuery({
    queryKey: adminKeys.overview,
    queryFn: () => api<AdminOverview>('/admin/overview'),
    refetchInterval: 10_000,
  })
}

export function useAdminOnlineUsers() {
  return useQuery({
    queryKey: adminKeys.online,
    queryFn: () => api<{ online: AdminOverview['online']['users'] }>('/admin/online'),
    refetchInterval: 8_000,
  })
}

export function useAdminTraffic(days = 14) {
  return useQuery({
    queryKey: adminKeys.traffic(days),
    queryFn: () => api<AdminTraffic>(`/admin/traffic?days=${days}`),
  })
}

export function useAdminUsers(params: { q?: string; role?: string; page?: number; limit?: number }) {
  const query = new URLSearchParams()
  if (params.q) query.set('q', params.q)
  if (params.role) query.set('role', params.role)
  if (params.page) query.set('page', String(params.page))
  if (params.limit) query.set('limit', String(params.limit))

  return useQuery({
    queryKey: adminKeys.users(params),
    queryFn: () => api<AdminUsersResponse>(`/admin/users?${query.toString()}`),
    placeholderData: (prev) => prev,
  })
}

export function useUpdateUserRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: 'admin' | 'user' }) =>
      api<{ ok: boolean }>(`/admin/users/${id}/role`, {
        method: 'PATCH',
        json: { role },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] })
      qc.invalidateQueries({ queryKey: adminKeys.overview })
    },
  })
}

export function useUpdateUserStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, banned }: { id: string; banned: boolean }) =>
      api<{ ok: boolean }>(`/admin/users/${id}/status`, {
        method: 'PATCH',
        json: { banned },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
  })
}

export function useAdminReports() {
  return useQuery({
    queryKey: adminKeys.reports,
    queryFn: () => api<{ reports: AdminReport[] }>('/admin/reports'),
  })
}

export function useResolveReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status, hideSong }: { id: string; status: 'open' | 'resolved' | 'dismissed'; hideSong?: boolean }) =>
      api<{ ok: boolean }>(`/admin/reports/${id}`, {
        method: 'PATCH',
        json: { status, hideSong },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.reports })
      qc.invalidateQueries({ queryKey: adminKeys.overview })
    },
  })
}

export function useAdminErrors() {
  return useQuery({
    queryKey: adminKeys.errors,
    queryFn: () => api<{ errors: AdminAppError[] }>('/admin/errors'),
    refetchInterval: 60_000,
  })
}

/** Marcar como resolvido (id) ou limpar tudo (sem id). */
export function useResolveError() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id?: string) => api<{ ok: boolean }>(id ? `/admin/errors/${id}` : '/admin/errors', { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.errors })
      qc.invalidateQueries({ queryKey: adminKeys.overview })
    },
  })
}
