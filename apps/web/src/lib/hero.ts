import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from './api'
import { keys } from './queries'

export type HeroImage = { id: string; w: number; h: number }
export const heroImageUrl = (id: string) => `/api/me/hero/${id}.webp`

/**
 * Reduz a foto NO APARELHO antes de enviar: no máximo 1920 px no lado maior, em WebP.
 * Uma foto de celular de 4–8 MB vira ~200–400 KB (rápido no 4G e leve no servidor).
 */
export async function prepareHeroImage(file: File): Promise<{ blob: Blob; w: number; h: number }> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error(`Não foi possível abrir "${file.name}". Use uma foto em JPG, PNG ou WebP.`)
  }
  const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const encode = (q: number) =>
    new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b && b.type === 'image/webp' ? resolve(b) : reject(new Error('Este navegador não gera WebP.'))), 'image/webp', q),
    )
  let blob = await encode(0.82)
  if (blob.size > 1.4 * 1024 * 1024) blob = await encode(0.65)
  return { blob, w: canvas.width, h: canvas.height }
}

export function useHeroImages() {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: keys.me })
  const add = useMutation({
    mutationFn: async (file: File) => {
      const img = await prepareHeroImage(file)
      const fd = new FormData()
      fd.set('image', img.blob, 'imagem.webp')
      fd.set('w', String(img.w))
      fd.set('h', String(img.h))
      const res = await fetch('/api/me/hero', { method: 'POST', body: fd, credentials: 'include' }).catch(() => null)
      if (!res) throw new ApiError('Sem conexão com o servidor. Verifique sua internet.', 0)
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new ApiError(data?.error ?? `Erro ${res.status}`, res.status)
      return data as { heroImages: HeroImage[] }
    },
    onSuccess: refresh,
  })
  const remove = useMutation({
    mutationFn: (id: string) => api<{ heroImages: HeroImage[] }>(`/me/hero/${id}`, { method: 'DELETE' }),
    onSuccess: refresh,
  })
  return { add, remove }
}
