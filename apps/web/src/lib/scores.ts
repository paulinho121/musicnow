import type { Instrument } from '@ensaio/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from './api'
import type { ProcessedPage } from './scoreProcess'

export const scorePageUrl = (scoreId: string, n: number) => `/api/scores/${scoreId}/${n}.webp`

/** Envia as páginas já convertidas, com progresso (o envio pode levar alguns segundos no 4G). */
export function uploadScore(
  input: { songId: string; label: string; instrument: Instrument | null; pages: ProcessedPage[] },
  onProgress: (fraction: number) => void,
) {
  const fd = new FormData()
  fd.set('songId', input.songId)
  fd.set('label', input.label)
  if (input.instrument) fd.set('instrument', input.instrument)
  fd.set('sizes', JSON.stringify(input.pages.map((p) => [p.w, p.h])))
  input.pages.forEach((p, i) => fd.set(`page${i}`, p.blob, `${i}.webp`))
  return new Promise<{ id: string; pages: number; totalBytes: number }>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/scores')
    xhr.withCredentials = true
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total)
    xhr.onload = () => {
      const data = (() => {
        try {
          return JSON.parse(xhr.responseText)
        } catch {
          return null
        }
      })()
      if (xhr.status >= 200 && xhr.status < 300) resolve(data)
      else reject(new ApiError(data?.error ?? `Erro ${xhr.status}`, xhr.status))
    }
    xhr.onerror = () => reject(new ApiError('Sem conexão com o servidor. Verifique sua internet.', 0))
    xhr.send(fd)
  })
}

/** Renomear ou apagar uma parte; recarrega a música. */
export function useScoreActions(songId: string) {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: ['song', songId] })
  const update = useMutation({
    mutationFn: ({ id, ...body }: { id: string; label: string; instrument: Instrument | null }) =>
      api(`/scores/${id}`, { method: 'PATCH', json: body }),
    onSuccess: refresh,
  })
  const remove = useMutation({
    mutationFn: (id: string) => api(`/scores/${id}`, { method: 'DELETE' }),
    onSuccess: refresh,
  })
  return { update, remove, refresh }
}
