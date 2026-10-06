// Agenda do músico: shows, apresentações e cachês (só da própria pessoa).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'

export { parseBRL } from '@ensaio/shared'

export type GigStatus = 'confirmed' | 'tentative' | 'canceled'
export interface Gig {
  id: string
  title: string
  startsAt: string
  location: string | null
  contractor: string | null
  contact: string | null
  feeCents: number | null
  paidAt: string | null
  status: GigStatus
  notes: string | null
  setlistId: string | null
  setlistName: string | null
}
export type GigInput = Omit<Gig, 'id' | 'setlistName'>

export const gigKeys = { all: ['gigs'] as const }

export function useGigs() {
  return useQuery({ queryKey: gigKeys.all, queryFn: async () => (await api<{ gigs: Gig[] }>('/gigs')).gigs })
}

export function useSaveGig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: GigInput & { id?: string }) =>
      id ? api(`/gigs/${id}`, { method: 'PUT', json: input }) : api('/gigs', { method: 'POST', json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: gigKeys.all }),
  })
}

export function useGigPaid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, paid }: { id: string; paid: boolean }) => api(`/gigs/${id}/paid`, { method: 'PATCH', json: { paid } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: gigKeys.all }),
  })
}

export function useDeleteGig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api(`/gigs/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: gigKeys.all }),
  })
}

export const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** Só os números do telefone, com o 55 do Brasil (para o link do WhatsApp). */
export function whatsappOf(contact: string | null) {
  const digits = contact?.replace(/\D/g, '') ?? ''
  if (digits.length < 10) return null
  return `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}`
}

export const mapsUrl = (place: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`

/** Duração padrão de um show na agenda do celular. */
const DURATION_MS = 3 * 60 * 60 * 1000
const utc = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')

/** Descrição do evento no calendário (sem o valor do cachê: o calendário pode ser compartilhado). */
function details(g: Gig) {
  return [
    g.contractor && `Contratante: ${g.contractor}`,
    g.contact && `Contato: ${g.contact}`,
    g.setlistName && `Repertório: ${g.setlistName}`,
    g.notes,
  ]
    .filter(Boolean)
    .join('\n')
}

export function googleCalendarUrl(g: Gig) {
  const start = new Date(g.startsAt)
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: g.title,
    dates: `${utc(start)}/${utc(new Date(start.getTime() + DURATION_MS))}`,
    details: details(g),
    location: g.location ?? '',
  })
  return `https://calendar.google.com/calendar/render?${params}`
}

/** Arquivo .ics: abre no calendário do iPhone, do Android e do Outlook. */
export function downloadIcs(g: Gig) {
  const start = new Date(g.startsAt)
  const esc = (s: string) =>
    s
      .replace(/\\/g, '\\\\')
      .replace(/\n/g, '\\n')
      .replace(/[,;]/g, (c) => `\\${c}`)
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ensaio Facil//Agenda//PT',
    'BEGIN:VEVENT',
    `UID:${g.id}@ensaiofacil`,
    `DTSTAMP:${utc(new Date())}`,
    `DTSTART:${utc(start)}`,
    `DTEND:${utc(new Date(start.getTime() + DURATION_MS))}`,
    `SUMMARY:${esc(g.title)}`,
    g.location ? `LOCATION:${esc(g.location)}` : null,
    details(g) ? `DESCRIPTION:${esc(details(g))}` : null,
    'BEGIN:VALARM',
    'TRIGGER:-PT3H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(g.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
  a.download = `${g.title.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}.ics`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
