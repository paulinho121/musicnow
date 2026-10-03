import type { Permission } from '@ensaio/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { api } from './api'
import { keys as songKeys } from './queries'
import type { HistoryEntry, InvitePreview, SetlistDetail, SetlistInput, SetlistInvite, SetlistSummary } from './types'

export const setlistKeys = {
  all: ['setlists'] as const,
  detail: (id: string) => ['setlist', id] as const,
  history: (id: string) => ['setlist', id, 'history'] as const,
  invite: (code: string) => ['invite', code] as const,
}

export function useSetlists() {
  return useQuery({ queryKey: setlistKeys.all, queryFn: () => api<SetlistSummary[]>('/setlists') })
}

export function useSetlist(id: string | undefined) {
  return useQuery({
    queryKey: setlistKeys.detail(id ?? ''),
    queryFn: () => api<SetlistDetail>(`/setlists/${id}`),
    enabled: Boolean(id),
  })
}

/**
 * Mantém a banda em dia: a cada 15 s (com a tela visível) pergunta só a revisão do
 * repertório — uma resposta minúscula — e recarrega tudo apenas quando ela mudou.
 */
export function useSetlistSync(id: string | undefined, revision: number | undefined) {
  const qc = useQueryClient()
  const known = useRef(revision)
  known.current = revision
  useEffect(() => {
    if (!id) return
    const check = async () => {
      if (document.visibilityState !== 'visible' || known.current === undefined) return
      try {
        const { revision: latest } = await api<{ revision: number }>(`/setlists/${id}/revision`)
        if (latest !== known.current) {
          qc.invalidateQueries({ queryKey: setlistKeys.detail(id) })
          qc.invalidateQueries({ queryKey: ['song'] })
        }
      } catch {
        // sem rede: tenta de novo no próximo ciclo
      }
    }
    const timer = setInterval(check, 15_000)
    document.addEventListener('visibilitychange', check)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
    }
  }, [id, qc])
}

export function useSetlistHistory(id: string, enabled: boolean) {
  return useQuery({
    queryKey: setlistKeys.history(id),
    queryFn: () => api<HistoryEntry[]>(`/setlists/${id}/history`),
    enabled,
  })
}

/** Mutação que, ao terminar, recarrega o repertório (e a lista, se preciso). */
function useSetlistMutation<TVars, TRes = unknown>(id: string, fn: (vars: TVars) => Promise<TRes>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: setlistKeys.detail(id) })
      qc.invalidateQueries({ queryKey: setlistKeys.all })
      qc.invalidateQueries({ queryKey: songKeys.dashboard })
    },
  })
}

export function useCreateSetlist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SetlistInput) => api<{ id: string }>('/setlists', { method: 'POST', json: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: setlistKeys.all })
      qc.invalidateQueries({ queryKey: songKeys.dashboard })
    },
  })
}

export const useUpdateSetlist = (id: string) =>
  useSetlistMutation(id, (input: SetlistInput) => api(`/setlists/${id}`, { method: 'PUT', json: input }))

export const useArchiveSetlist = (id: string) =>
  useSetlistMutation(id, (archived: boolean) => api(`/setlists/${id}/archive`, { method: 'POST', json: { archived } }))

export const useDeleteSetlist = (id: string) => useSetlistMutation(id, () => api(`/setlists/${id}`, { method: 'DELETE' }))

export const useDuplicateSetlist = (id: string) =>
  useSetlistMutation(id, (body: { asVersion: boolean; name?: string }) =>
    api<{ id: string }>(`/setlists/${id}/duplicate`, { method: 'POST', json: body }),
  )

export const useAddItem = (id: string) =>
  useSetlistMutation(id, (body: { songId: string; key?: string | null; blockId?: string | null }) =>
    api<{ id: string }>(`/setlists/${id}/items`, { method: 'POST', json: body }),
  )

export const useUpdateItem = (id: string) =>
  useSetlistMutation(
    id,
    ({ itemId, ...body }: { itemId: string; key: string | null; bpm: number | null; notes: string | null }) =>
      api(`/setlists/${id}/items/${itemId}`, { method: 'PUT', json: body }),
  )

export const useRemoveItem = (id: string) =>
  useSetlistMutation(id, (itemId: string) => api(`/setlists/${id}/items/${itemId}`, { method: 'DELETE' }))

/** Reordenar é otimista: a lista muda na hora e volta se o servidor recusar. */
export function useReorder(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (itemIds: string[]) => api(`/setlists/${id}/order`, { method: 'PUT', json: { itemIds } }),
    onMutate: async (itemIds) => {
      await qc.cancelQueries({ queryKey: setlistKeys.detail(id) })
      const prev = qc.getQueryData<SetlistDetail>(setlistKeys.detail(id))
      if (prev) {
        const byId = new Map(prev.items.map((i) => [i.id, i]))
        qc.setQueryData<SetlistDetail>(setlistKeys.detail(id), {
          ...prev,
          items: itemIds.map((iid, position) => ({ ...byId.get(iid)!, position })),
        })
      }
      return { prev }
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(setlistKeys.detail(id), ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: setlistKeys.detail(id) }),
  })
}

/** Ordem com blocos: cada grupo (bloco ou "sem bloco") com as suas músicas, na ordem da tela. */
export type BlockLayout = { blockId: string | null; itemIds: string[] }[]

/** Reordenar com blocos também é otimista. */
export function useReorderLayout(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (layout: BlockLayout) => api(`/setlists/${id}/order`, { method: 'PUT', json: { layout } }),
    onMutate: async (layout) => {
      await qc.cancelQueries({ queryKey: setlistKeys.detail(id) })
      const prev = qc.getQueryData<SetlistDetail>(setlistKeys.detail(id))
      if (prev) {
        const byId = new Map(prev.items.map((i) => [i.id, i]))
        const blocksById = new Map(prev.blocks.map((b) => [b.id, b]))
        const ordered = [...layout.filter((g) => !g.blockId), ...layout.filter((g) => g.blockId)]
        qc.setQueryData<SetlistDetail>(setlistKeys.detail(id), {
          ...prev,
          blocks: layout.flatMap((g) => (g.blockId ? [blocksById.get(g.blockId)!] : [])),
          items: ordered.flatMap((g) => g.itemIds.map((iid) => ({ ...byId.get(iid)!, blockId: g.blockId }))).map((it, position) => ({ ...it, position })),
        })
      }
      return { prev }
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(setlistKeys.detail(id), ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: setlistKeys.detail(id) }),
  })
}

export type BlockInput = { name: string; style: string | null; bpm: number | null; notes: string | null }

export const useSaveBlock = (id: string) =>
  useSetlistMutation(id, ({ blockId, ...body }: BlockInput & { blockId?: string }) =>
    blockId
      ? api(`/setlists/${id}/blocks/${blockId}`, { method: 'PUT', json: body })
      : api<{ id: string }>(`/setlists/${id}/blocks`, { method: 'POST', json: body }),
  )

export const useDeleteBlock = (id: string) =>
  useSetlistMutation(id, (blockId: string) => api(`/setlists/${id}/blocks/${blockId}`, { method: 'DELETE' }))

export interface ImportTextResult {
  songs: number
  blocks: number
  found: number
  created: string[]
}

export const useImportText = (id: string) =>
  useSetlistMutation(id, (text: string) => api<ImportTextResult>(`/setlists/${id}/import-text`, { method: 'POST', json: { text } }))

export const useUpdateMember = (id: string) =>
  useSetlistMutation(id, ({ userId, ...body }: { userId: string; permission?: Permission; instrument?: string | null }) =>
    api(`/setlists/${id}/members/${userId}`, { method: 'PUT', json: body }),
  )

export const useRemoveMember = (id: string) =>
  useSetlistMutation(id, (userId: string) => api(`/setlists/${id}/members/${userId}`, { method: 'DELETE' }))

export const useCreateInvite = (id: string) =>
  useSetlistMutation(id, (body: { permission: Permission; email?: string | null; maxUses?: number | null }) =>
    api<SetlistInvite>(`/setlists/${id}/invites`, { method: 'POST', json: body }),
  )

export const useRevokeInvite = (id: string) =>
  useSetlistMutation(id, (inviteId: string) => api(`/setlists/${id}/invites/${inviteId}`, { method: 'DELETE' }))

export const useSuggest = (id: string) =>
  useSetlistMutation(id, (body: { itemId: string | null; proposedKey: string | null; message: string | null }) =>
    api(`/setlists/${id}/suggestions`, { method: 'POST', json: body }),
  )

export const useResolveSuggestion = (id: string) =>
  useSetlistMutation(id, ({ sid, status }: { sid: string; status: 'accepted' | 'rejected' }) =>
    api(`/setlists/${id}/suggestions/${sid}`, { method: 'PUT', json: { status } }),
  )

export function useInvitePreview(code: string) {
  return useQuery({
    queryKey: setlistKeys.invite(code),
    queryFn: () => api<InvitePreview>(`/invites/${code}`),
    retry: false,
  })
}

export function useAcceptInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (code: string) => api<{ setlistId: string; alreadyMember: boolean }>(`/invites/${code}/accept`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: setlistKeys.all })
      qc.invalidateQueries({ queryKey: songKeys.dashboard })
    },
  })
}

/** Compartilha pelo menu do celular (WhatsApp etc.); no computador, copia o link. */
export async function shareLink(title: string, text: string, url: string): Promise<'shared' | 'copied' | 'cancelled'> {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url })
      return 'shared'
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled'
    }
  }
  await navigator.clipboard.writeText(`${text}\n${url}`)
  return 'copied'
}

export function whatsappUrl(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}
