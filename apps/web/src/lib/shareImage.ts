import { SHARE_SIGNATURE, type ShareSetlist } from '@ensaio/shared'

export type ShareFormat = 'story' | 'post'
export const SHARE_SIZES: Record<ShareFormat, { w: number; h: number }> = {
  story: { w: 1080, h: 1920 }, // Stories / Status do WhatsApp
  post: { w: 1080, h: 1350 }, // Feed do Instagram / Facebook (4:5)
}

/** Grupo com a cor do bloco (a mesma da tela). */
export type ImageGroup = ShareSetlist['groups'][number] & { color: string | null }

const ACCENT = '#f5a524'
const BG = '#0e0f13'
const TEXT = '#f4f4f5'
const MUTED = '#9a9caa'
const FONT = '"Inter Variable", Inter, system-ui, sans-serif'

/** Corta com "…" para caber na largura. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1)
  return `${t.trimEnd()}…`
}

/** Quebra o título em até `lines` linhas. */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number, lines: number) {
  const words = text.split(/\s+/)
  const out: string[] = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (ctx.measureText(next).width <= max || !cur) cur = next
    else {
      out.push(cur)
      cur = w
    }
  }
  if (cur) out.push(cur)
  if (out.length > lines) {
    const rest = out.slice(lines - 1).join(' ')
    out.splice(lines - 1, out.length, fit(ctx, rest, max))
  }
  return out.map((l) => fit(ctx, l, max))
}

/**
 * Desenha a imagem de divulgação (no aparelho, sem servidor): nome do show, data/local,
 * blocos nas cores da tela e as músicas. O tamanho da letra se ajusta à quantidade de músicas;
 * se não couber nem com letra pequena, mostra "+ N músicas".
 */
export async function renderShareImage(
  data: { kicker: string; title: string; details: string | null; groups: ImageGroup[]; accent?: string | null },
  opts: { format: ShareFormat; withKeys: boolean },
): Promise<Blob> {
  await Promise.all(['800 80px', '600 40px', '400 40px'].map((f) => document.fonts?.load(`${f} ${FONT}`).catch(() => null)))
  const { w: W, h: H } = SHARE_SIZES[opts.format]
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const P = 88
  const inner = W - P * 2

  // Fundo: escuro com um brilho da cor da marca no alto.
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(W * 0.85, 0, 0, W * 0.85, 0, W * 1.1)
  glow.addColorStop(0, `${ACCENT}55`)
  glow.addColorStop(1, `${ACCENT}00`)
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  let y = opts.format === 'story' ? 200 : 120
  ctx.textBaseline = 'alphabetic'

  // Cabeçalho
  const accent = data.accent ?? ACCENT
  ctx.fillStyle = accent
  ctx.font = `800 30px ${FONT}`
  ctx.letterSpacing = '6px'
  ctx.fillText(data.kicker.toUpperCase(), P, y)
  ctx.letterSpacing = '0px'
  y += 30

  ctx.fillStyle = TEXT
  const titleSize = opts.format === 'story' ? 88 : 76
  ctx.font = `800 ${titleSize}px ${FONT}`
  for (const line of wrap(ctx, data.title, inner, 2)) {
    y += titleSize * 1.08
    ctx.fillText(line, P, y)
  }
  if (data.details) {
    ctx.fillStyle = MUTED
    ctx.font = `500 34px ${FONT}`
    y += 60
    ctx.fillText(fit(ctx, data.details, inner), P, y)
  }
  y += 50
  ctx.fillStyle = accent
  ctx.fillRect(P, y, 96, 6)
  y += 30

  // Lista: acha o maior tamanho de letra que cabe.
  const footerTop = H - (opts.format === 'story' ? 170 : 110)
  const groups = data.groups.filter((g) => g.songs.length)
  const total = groups.reduce((n, g) => n + g.songs.length, 0)
  const heightAt = (f: number, songs: number) => {
    let h = 0
    let left = songs
    for (const g of groups) {
      if (left <= 0) break
      if (g.name) h += f * 2.3
      const n = Math.min(left, g.songs.length)
      h += n * f * 1.62
      left -= n
    }
    return h + f
  }
  let f = 60
  while (f > 20 && y + heightAt(f, total) > footerTop) f -= 2
  let shown = total
  while (shown > 1 && y + heightAt(f, shown) + (shown < total ? f * 1.62 : 0) > footerTop) shown--

  let n = 0
  for (const g of groups) {
    if (n >= shown) break
    if (g.name) {
      y += f * 1.85
      const color = g.color ?? ACCENT
      ctx.fillStyle = color
      ctx.fillRect(P, y - f * 0.95, 8, f * 1.1)
      ctx.font = `800 ${Math.round(f * 1.02)}px ${FONT}`
      const name = fit(ctx, g.name.toUpperCase(), inner * 0.62)
      ctx.fillText(name, P + 28, y)
      if (g.subtitle) {
        const nameW = ctx.measureText(name).width
        ctx.fillStyle = MUTED
        ctx.font = `500 ${Math.round(f * 0.7)}px ${FONT}`
        ctx.fillText(fit(ctx, g.subtitle, inner - nameW - 56), P + 28 + nameW + 22, y)
      }
      y += f * 0.45
    }
    for (const s of g.songs) {
      if (n >= shown) break
      n++
      y += f * 1.62
      ctx.fillStyle = MUTED
      ctx.font = `600 ${Math.round(f * 0.72)}px ${FONT}`
      ctx.fillText(String(n).padStart(2, '0'), P + 28, y)
      const x = P + 28 + f * 1.45
      let right = W - P
      if (opts.withKeys && s.key) {
        ctx.font = `800 ${Math.round(f * 0.78)}px ${FONT}`
        const kw = ctx.measureText(s.key).width + f * 0.7
        ctx.fillStyle = `${ACCENT}26`
        ctx.beginPath()
        ctx.roundRect(right - kw, y - f * 0.86, kw, f * 1.12, f * 0.3)
        ctx.fill()
        ctx.fillStyle = ACCENT
        ctx.fillText(s.key, right - kw + f * 0.35, y - f * 0.05)
        right -= kw + f * 0.5
      }
      ctx.fillStyle = TEXT
      ctx.font = `700 ${f}px ${FONT}`
      const title = fit(ctx, s.title, right - x)
      ctx.fillText(title, x, y)
      if (s.artist) {
        const tw = ctx.measureText(title).width
        ctx.fillStyle = MUTED
        ctx.font = `400 ${Math.round(f * 0.72)}px ${FONT}`
        const room = right - x - tw - f * 0.5
        if (room > f * 3) ctx.fillText(fit(ctx, s.artist, room), x + tw + f * 0.5, y)
      }
    }
  }
  if (shown < total) {
    y += f * 1.62
    ctx.fillStyle = MUTED
    ctx.font = `600 ${Math.round(f * 0.8)}px ${FONT}`
    const rest = total - shown
    ctx.fillText(`+ ${rest} ${rest === 1 ? 'música' : 'músicas'}`, P + 28, y)
  }

  // Rodapé
  ctx.fillStyle = MUTED
  ctx.font = `600 28px ${FONT}`
  ctx.textAlign = 'center'
  ctx.fillText(`♪  ${SHARE_SIGNATURE}`, W / 2, H - (opts.format === 'story' ? 110 : 60))

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não foi possível gerar a imagem.'))), 'image/png'),
  )
}
