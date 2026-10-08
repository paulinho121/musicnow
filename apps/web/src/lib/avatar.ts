import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from './api'
import { keys } from './queries'

const SIZE = 512

/**
 * Prepara a foto de perfil NO APARELHO: recorta o quadrado do centro e reduz para 512 px
 * em WebP (~30–60 KB), respeitando a rotação da foto do celular.
 */
export async function prepareAvatar(file: File): Promise<Blob> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error(`Não foi possível abrir "${file.name}". Use uma foto em JPG, PNG ou WebP.`)
  }
  const side = Math.min(bitmap.width, bitmap.height)
  const out = Math.min(SIZE, side)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = out
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, out, out)
  bitmap.close()
  const encode = (q: number) =>
    new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b && b.type === 'image/webp' ? resolve(b) : reject(new Error('Este navegador não gera WebP.'))), 'image/webp', q),
    )
  let blob = await encode(0.85)
  if (blob.size > 380 * 1024) blob = await encode(0.6)
  return blob
}

export function useAvatar() {
  const qc = useQueryClient()
  const refresh = () => {
    qc.invalidateQueries({ queryKey: keys.me })
    qc.invalidateQueries({ queryKey: ['setlist'] })
  }
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.set('image', await prepareAvatar(file), 'foto.webp')
      const res = await fetch('/api/me/avatar', { method: 'POST', body: fd, credentials: 'include' }).catch(() => null)
      if (!res) throw new ApiError('Sem conexão com o servidor. Verifique sua internet.', 0)
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new ApiError(data?.error ?? `Erro ${res.status}`, res.status)
      return data as { image: string }
    },
    onSuccess: refresh,
  })
  const remove = useMutation({
    mutationFn: () => api<{ image: null }>('/me/avatar', { method: 'DELETE' }),
    onSuccess: refresh,
  })
  return { upload, remove }
}
