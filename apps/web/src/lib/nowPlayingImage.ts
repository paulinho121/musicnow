// Imagem "Tocando agora" (Stories do Instagram, Status do WhatsApp): capa, música, artista e
// o show. Desenhada no aparelho. Sem a capa do álbum (ou se o site dela não deixar usar),
// usa a capa colorida que o app já desenha para a música.
import { SHARE_SIGNATURE } from '@ensaio/shared'
import { coverColors } from '../components/SongCover'

export interface NowPlaying {
  title: string
  artist: string | null
  coverUrl?: string | null
  /** Nome do show/repertório (quando está tocando dentro de um). */
  show?: string | null
  location?: string | null
  /** Tom em que a banda está tocando (opcional na imagem). */
  key?: string | null
}

const W = 1080
const H = 1920
const FONT = '"Inter Variable", Inter, system-ui, sans-serif'

function fit(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1)
  return `${t.trimEnd()}…`
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number, lines: number) {
  const out: string[] = []
  let cur = ''
  for (const w of text.split(/\s+/)) {
    const next = cur ? `${cur} ${w}` : w
    if (ctx.measureText(next).width <= max || !cur) cur = next
    else {
      out.push(cur)
      cur = w
    }
  }
  if (cur) out.push(cur)
  if (out.length > lines) out.splice(lines - 1, out.length, fit(ctx, out.slice(lines - 1).join(' '), max))
  return out.map((l) => fit(ctx, l, max))
}

/** Capa do álbum, se o site dela permitir desenhar (senão, null e usamos a capa do app). */
function loadCover(url: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null)
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url.replace(/front-250$/, 'front-500')
    setTimeout(() => resolve(null), 4000)
  })
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

function drawGeneratedCover(ctx: CanvasRenderingContext2D, song: NowPlaying, x: number, y: number, size: number) {
  const { colors, angle } = coverColors(song)
  const a = (angle * Math.PI) / 180
  const g = ctx.createLinearGradient(x, y, x + size * Math.cos(a - Math.PI / 2) + size / 2, y + size * Math.sin(a) + size / 2)
  g.addColorStop(0, colors[0])
  g.addColorStop(1, colors[1])
  ctx.fillStyle = g
  ctx.fillRect(x, y, size, size)
  // Ondas suaves, como nas capas do app.
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'
  ctx.lineWidth = 6
  for (let i = 0; i < 6; i++) {
    ctx.beginPath()
    ctx.arc(x + size * 0.85, y + size * 0.2, size * (0.25 + i * 0.13), 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.fillStyle = '#fff'
  ctx.font = `800 ${Math.round(size * 0.3)}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const initials =
    song.title
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('') || song.title.slice(0, 1).toUpperCase()
  ctx.fillText(initials, x + size / 2, y + size / 2)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

export async function renderNowPlaying(song: NowPlaying, opts: { withKey: boolean }): Promise<Blob> {
  await Promise.all(['800 80px', '600 40px', '500 40px'].map((f) => document.fonts?.load(`${f} ${FONT}`).catch(() => null)))
  const cover = await loadCover(song.coverUrl)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  // Fundo: a própria capa, desfocada e escura (ou as cores da capa do app).
  ctx.fillStyle = '#0e0f13'
  ctx.fillRect(0, 0, W, H)
  if (cover) {
    ctx.save()
    ctx.filter = 'blur(70px) brightness(0.5) saturate(1.3)'
    ctx.drawImage(cover, -300, -200, W + 600, H + 400)
    ctx.restore()
  } else {
    const { colors } = coverColors(song)
    const g = ctx.createRadialGradient(W / 2, 600, 50, W / 2, 600, 1400)
    g.addColorStop(0, `${colors[0]}88`)
    g.addColorStop(0.5, `${colors[1]}44`)
    g.addColorStop(1, '#0e0f1300')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  }
  const shade = ctx.createLinearGradient(0, 0, 0, H)
  shade.addColorStop(0, 'rgba(14,15,19,0.2)')
  shade.addColorStop(0.55, 'rgba(14,15,19,0.35)')
  shade.addColorStop(1, 'rgba(14,15,19,0.92)')
  ctx.fillStyle = shade
  ctx.fillRect(0, 0, W, H)

  // "● TOCANDO AGORA"
  ctx.font = `800 34px ${FONT}`
  ctx.letterSpacing = '5px'
  const label = 'TOCANDO AGORA'
  const lw = ctx.measureText(label).width + 110
  roundRect(ctx, (W - lw) / 2, 190, lw, 76, 38)
  ctx.fillStyle = '#dc2626'
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc((W - lw) / 2 + 44, 228, 11, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillText(label, (W - lw) / 2 + 72, 241)
  ctx.letterSpacing = '0px'

  // Capa
  const size = 760
  const cx = (W - size) / 2
  const cy = 340
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.55)'
  ctx.shadowBlur = 80
  ctx.shadowOffsetY = 30
  roundRect(ctx, cx, cy, size, size, 44)
  ctx.fillStyle = '#16181e'
  ctx.fill()
  ctx.restore()
  ctx.save()
  roundRect(ctx, cx, cy, size, size, 44)
  ctx.clip()
  if (cover) ctx.drawImage(cover, cx, cy, size, size)
  else drawGeneratedCover(ctx, song, cx, cy, size)
  ctx.restore()

  // Música e artista
  let y = cy + size + 150
  ctx.textAlign = 'center'
  ctx.fillStyle = '#f4f4f5'
  ctx.font = `800 84px ${FONT}`
  for (const line of wrap(ctx, song.title, W - 160, 2)) {
    ctx.fillText(line, W / 2, y)
    y += 96
  }
  if (song.artist) {
    ctx.fillStyle = 'rgba(244,244,245,0.72)'
    ctx.font = `500 46px ${FONT}`
    ctx.fillText(fit(ctx, song.artist, W - 160), W / 2, y + 4)
    y += 70
  }
  if (opts.withKey && song.key) {
    ctx.font = `800 38px ${FONT}`
    const t = `Tom ${song.key}`
    const kw = ctx.measureText(t).width + 56
    roundRect(ctx, (W - kw) / 2, y + 10, kw, 66, 33)
    ctx.fillStyle = 'rgba(245,165,36,0.18)'
    ctx.fill()
    ctx.fillStyle = '#f5b84a'
    ctx.fillText(t, W / 2, y + 56)
    y += 90
  }

  // O show
  const where = [song.show, song.location].filter(Boolean).join(' · ')
  if (where) {
    ctx.fillStyle = '#f5a524'
    ctx.font = `700 40px ${FONT}`
    ctx.fillText(fit(ctx, `ao vivo · ${where}`, W - 160), W / 2, Math.min(y + 90, H - 230))
  }

  // Assinatura
  ctx.fillStyle = 'rgba(244,244,245,0.6)'
  ctx.font = `600 30px ${FONT}`
  ctx.fillText(`♪  ${SHARE_SIGNATURE}`, W / 2, H - 120)

  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não foi possível gerar a imagem.'))), 'image/jpeg', 0.9)
    } catch {
      // A capa "contaminou" o desenho (site sem permissão): refaz sem ela.
      renderNowPlaying({ ...song, coverUrl: null }, opts).then(resolve, reject)
    }
  })
}

/** Texto pronto (WhatsApp, X). */
export function nowPlayingText(song: NowPlaying) {
  const where = [song.show, song.location].filter(Boolean).join(' · ')
  return [
    `🎶 Tocando agora: ${song.title}${song.artist ? ` — ${song.artist}` : ''}`,
    where ? `📍 Ao vivo · ${where}` : null,
    '',
    SHARE_SIGNATURE,
  ]
    .filter((l) => l !== null)
    .join('\n')
}
