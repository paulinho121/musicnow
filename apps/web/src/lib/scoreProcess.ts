// Conversão da partitura NO APARELHO: PDF ou foto → páginas WebP leves e limpas.
// O arquivo original nunca é enviado ao servidor (economiza espaço e dados móveis).

/** Largura das páginas (boa para ler na tela do celular e do tablet). */
const PAGE_WIDTH = 1600
const MAX_HEIGHT = 4000
const QUALITY = 0.62

export interface ProcessedPage {
  blob: Blob
  w: number
  h: number
  /** Prévia (object URL) para mostrar antes de enviar. */
  url: string
}

export interface SourcePage {
  /** Desenha a página na largura pedida e devolve o canvas. */
  render: (width: number) => Promise<HTMLCanvasElement>
  label: string
}

const tick = () => new Promise((r) => setTimeout(r, 0))

/** Lê os arquivos escolhidos (um PDF e/ou várias fotos, na ordem) e lista as páginas. */
export async function readSources(files: File[]): Promise<SourcePage[]> {
  const pages: SourcePage[] = []
  for (const file of files) {
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      const pdfjs = await import('pdfjs-dist')
      const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
      const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise
      for (let n = 1; n <= doc.numPages; n++) {
        pages.push({
          label: `${file.name} · pág. ${n}`,
          render: async (width) => {
            const page = await doc.getPage(n)
            const base = page.getViewport({ scale: 1 })
            const scale = Math.min(width / base.width, MAX_HEIGHT / base.height)
            const vp = page.getViewport({ scale })
            const canvas = document.createElement('canvas')
            canvas.width = Math.round(vp.width)
            canvas.height = Math.round(vp.height)
            const ctx = canvas.getContext('2d')!
            ctx.fillStyle = '#fff'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            await page.render({ canvasContext: ctx, viewport: vp }).promise
            return canvas
          },
        })
      }
    } else if (file.type.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(file.name)) {
      let bitmap: ImageBitmap
      try {
        // imageOrientation: foto do celular já na posição certa (EXIF).
        bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      } catch {
        throw new Error(`Não foi possível abrir "${file.name}". Use foto em JPG ou PNG (no iPhone: Ajustes → Câmera → Formatos → Mais compatível).`)
      }
      pages.push({
        label: file.name,
        render: async (width) => {
          const scale = Math.min(1, width / bitmap.width, MAX_HEIGHT / bitmap.height)
          const canvas = document.createElement('canvas')
          canvas.width = Math.round(bitmap.width * scale)
          canvas.height = Math.round(bitmap.height * scale)
          const ctx = canvas.getContext('2d')!
          ctx.imageSmoothingQuality = 'high'
          ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
          return canvas
        },
      })
    } else if (/\.(gp|gp3|gp4|gp5|gpx)$/i.test(file.name)) {
      const { readGuitarProScorePages } = await import('./guitarPro')
      const gpPages = await readGuitarProScorePages(file)
      pages.push(...gpPages)
    } else {
      throw new Error(`"${file.name}" não é PDF, foto nem arquivo do Guitar Pro.`)
    }
  }
  return pages
}

/** Gira o canvas em múltiplos de 90°. */
function rotate(src: HTMLCanvasElement, turns: number) {
  const t = ((turns % 4) + 4) % 4
  if (t === 0) return src
  const out = document.createElement('canvas')
  out.width = t % 2 ? src.height : src.width
  out.height = t % 2 ? src.width : src.height
  const ctx = out.getContext('2d')!
  ctx.translate(out.width / 2, out.height / 2)
  ctx.rotate((t * Math.PI) / 2)
  ctx.drawImage(src, -src.width / 2, -src.height / 2)
  return out
}

/**
 * Limpa a página: estima a cor do papel em cada região (com as notas "apagadas" por um
 * filtro de máximo) e divide a imagem por ela. Some a sombra do celular, o amarelado e a
 * luz desigual; depois o contraste é reforçado para as notas ficarem bem pretas.
 */
function clean(canvas: HTMLCanvasElement) {
  const { width: w, height: h } = canvas
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data

  // Fundo: imagem bem reduzida → filtro de máximo (tira as notas) → ampliada suavemente.
  const sw = Math.max(8, Math.round(w / 24))
  const sh = Math.max(8, Math.round(h / 24))
  const small = document.createElement('canvas')
  small.width = sw
  small.height = sh
  const sctx = small.getContext('2d', { willReadFrequently: true })!
  sctx.imageSmoothingQuality = 'high'
  sctx.drawImage(canvas, 0, 0, sw, sh)
  const sd = sctx.getImageData(0, 0, sw, sh)
  let lum = new Float32Array(sw * sh)
  for (let i = 0; i < sw * sh; i++) lum[i] = 0.299 * sd.data[i * 4] + 0.587 * sd.data[i * 4 + 1] + 0.114 * sd.data[i * 4 + 2]
  for (let pass = 0; pass < 2; pass++) {
    const next = new Float32Array(sw * sh)
    for (let y = 0; y < sh; y++)
      for (let x = 0; x < sw; x++) {
        let m = 0
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = Math.min(sw - 1, Math.max(0, x + dx))
            const yy = Math.min(sh - 1, Math.max(0, y + dy))
            m = Math.max(m, lum[yy * sw + xx])
          }
        next[y * sw + x] = m
      }
    lum = next
  }
  for (let i = 0; i < sw * sh; i++) {
    const v = Math.max(lum[i], 40)
    sd.data[i * 4] = sd.data[i * 4 + 1] = sd.data[i * 4 + 2] = v
    sd.data[i * 4 + 3] = 255
  }
  sctx.putImageData(sd, 0, 0)
  const bgCanvas = document.createElement('canvas')
  bgCanvas.width = w
  bgCanvas.height = h
  const bctx = bgCanvas.getContext('2d', { willReadFrequently: true })!
  bctx.imageSmoothingQuality = 'high'
  bctx.drawImage(small, 0, 0, w, h)
  const bg = bctx.getImageData(0, 0, w, h).data

  // Normaliza pelo papel e aplica níveis (preto em 70, branco em 225).
  const BLACK = 70
  const WHITE = 225
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    const n = Math.min(255, (g / Math.max(bg[i], 1)) * 255)
    const v = Math.max(0, Math.min(255, ((n - BLACK) * 255) / (WHITE - BLACK)))
    d[i] = d[i + 1] = d[i + 2] = v
  }
  ctx.putImageData(img, 0, 0)
}

const toWebp = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Este navegador não conseguiu gerar a imagem.'))), 'image/webp', QUALITY),
  )

/** Converte uma página: tamanho de tela, giro, limpeza e WebP. */
export async function processPage(source: SourcePage, turns = 0): Promise<ProcessedPage> {
  const canvas = rotate(await source.render(PAGE_WIDTH), turns)
  await tick()
  clean(canvas)
  const blob = await toWebp(canvas)
  if (blob.type !== 'image/webp') throw new Error('Este navegador não gera WebP. Use o Chrome, Edge, Firefox ou o Safari 16+.')
  return { blob, w: canvas.width, h: canvas.height, url: URL.createObjectURL(blob) }
}

export const formatBytes = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(n / 1024))} KB`
