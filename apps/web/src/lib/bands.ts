// Página pública da banda e pedidos de orçamento.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'

export interface PublicBand {
  slug: string
  name: string
  city: string | null
  bio: string | null
  genres: string | null
  whatsapp: string | null
  instagram: string | null
  youtube: string | null
  image: string | null
  songs: { title: string; artist: string | null }[]
}

export interface BandPage {
  id: string
  slug: string
  name: string
  city: string | null
  bio: string | null
  genres: string | null
  whatsapp: string | null
  instagram: string | null
  youtube: string | null
  setlistId: string | null
  published: boolean
  newRequests: number
}
export type BandPageInput = Omit<BandPage, 'id' | 'newRequests'>

export type QuoteStatus = 'novo' | 'respondido' | 'arquivado'
export interface QuoteRequest {
  id: string
  name: string
  contact: string
  eventDate: string | null
  eventType: string | null
  location: string | null
  message: string | null
  status: QuoteStatus
  createdAt: string
}

export interface QuoteInput {
  name: string
  contact: string
  eventDate?: string | null
  eventType?: string | null
  location?: string | null
  message?: string | null
  website?: string
}

export const bandKeys = {
  mine: ['bandas'] as const,
  requests: (id: string) => ['bandas', id, 'pedidos'] as const,
  public: (slug: string) => ['banda-publica', slug] as const,
}

export function usePublicBand(slug: string) {
  return useQuery({ queryKey: bandKeys.public(slug), queryFn: () => api<PublicBand>(`/publico/bandas/${encodeURIComponent(slug)}`), retry: false })
}

export function useSendQuote(slug: string) {
  return useMutation({
    mutationFn: (input: QuoteInput) => api(`/publico/bandas/${encodeURIComponent(slug)}/orcamento`, { method: 'POST', json: input }),
  })
}

export function useMyBandPages() {
  return useQuery({ queryKey: bandKeys.mine, queryFn: () => api<BandPage[]>('/bandas') })
}

export function useSaveBandPage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: BandPageInput & { id?: string }) =>
      id ? api(`/bandas/${id}`, { method: 'PUT', json: input }) : api<{ id: string }>('/bandas', { method: 'POST', json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: bandKeys.mine }),
  })
}

export function useDeleteBandPage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api(`/bandas/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: bandKeys.mine }),
  })
}

export function useQuoteRequests(pageId: string | undefined) {
  return useQuery({
    queryKey: bandKeys.requests(pageId ?? ''),
    queryFn: () => api<QuoteRequest[]>(`/bandas/${pageId}/pedidos`),
    enabled: Boolean(pageId),
  })
}

export function useQuoteStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: QuoteStatus }) => api(`/bandas/pedidos/${id}`, { method: 'PATCH', json: { status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: bandKeys.mine }),
  })
}

export function slugify(name: string) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

/** "@banda", "banda" ou o link inteiro → link do Instagram. */
export function instagramUrl(v: string) {
  if (/^https?:\/\//i.test(v)) return v
  return `https://instagram.com/${v.replace(/^@/, '').trim()}`
}
