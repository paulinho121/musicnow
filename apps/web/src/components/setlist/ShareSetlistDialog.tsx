import { setlistShareText, setlistShortText, type ShareSetlist } from '@ensaio/shared'
import clsx from 'clsx'
import { Copy, Download, Loader2, MessageCircle, Share2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { renderShareImage, SHARE_SIZES, type ImageGroup, type ShareFormat } from '../../lib/shareImage'
import type { SetlistDetail } from '../../lib/types'
import { Sheet } from '../Sheet'
import { useToast } from '../ui'
import { blockColor, blockSubtitle } from './Blocks'

const dateFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })

function eventDetails(s: SetlistDetail) {
  let when: string | null = null
  if (s.eventDate) {
    const d = new Date(s.eventDate)
    when = dateFmt.format(d) + (d.getHours() || d.getMinutes() ? `, ${timeFmt.format(d)}` : '')
  }
  return [when, s.location, s.groupName].filter(Boolean).join(' · ') || null
}

/** Monta o que vai para a divulgação: o repertório inteiro ou só um bloco. */
function shareData(s: SetlistDetail, blockId: string | null) {
  const song = (it: SetlistDetail['items'][number]) => ({
    title: it.song.title,
    artist: it.song.artist,
    key: it.key ?? it.song.originalKey,
  })
  const byPos = [...s.items].sort((a, b) => a.position - b.position)
  const blockIds = new Set(s.blocks.map((b) => b.id))
  if (blockId) {
    const bi = s.blocks.findIndex((b) => b.id === blockId)
    const b = s.blocks[bi]
    const groups: ImageGroup[] = [
      { name: null, subtitle: null, color: blockColor(bi), songs: byPos.filter((i) => i.blockId === blockId).map(song) },
    ]
    const details = [blockSubtitle(b), eventDetails(s)].filter(Boolean).join(' · ') || null
    return { kicker: s.name, accent: blockColor(bi), title: b.name, textTitle: `${s.name} — ${b.name}`, details, groups }
  }
  const groups: ImageGroup[] = [
    { name: null, subtitle: null, color: null, songs: byPos.filter((i) => !i.blockId || !blockIds.has(i.blockId)).map(song) },
    ...s.blocks.map((b, bi) => ({
      name: b.name,
      subtitle: blockSubtitle(b) || null,
      color: blockColor(bi),
      songs: byPos.filter((i) => i.blockId === b.id).map(song),
    })),
  ]
  return { kicker: 'Repertório', title: s.name, textTitle: s.name, details: eventDetails(s), groups }
}

const slug = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'repertorio'

/**
 * Divulgar o repertório (ou um bloco) no WhatsApp, Instagram, Facebook e X.
 * WhatsApp e X recebem o texto pronto; Instagram e Facebook recebem a imagem
 * (eles não aceitam texto vindo de site). Vai só nome e artista, nunca a letra.
 */
export function ShareSetlistDialog({
  setlist,
  blockId = null,
  open,
  onClose,
}: {
  setlist: SetlistDetail
  blockId?: string | null
  open: boolean
  onClose: () => void
}) {
  const toast = useToast()
  const [format, setFormat] = useState<ShareFormat>('story')
  const [withKeys, setWithKeys] = useState(false)
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null)
  const data = useMemo(() => shareData(setlist, blockId), [setlist, blockId])
  const text: ShareSetlist = { title: data.textTitle, details: data.details, groups: data.groups }
  const fileName = `${slug(data.textTitle)}.png`

  useEffect(() => {
    if (!open) return
    let alive = true
    let url: string | null = null
    setImage(null)
    renderShareImage(data, { format, withKeys })
      .then((blob) => {
        if (!alive) return
        url = URL.createObjectURL(blob)
        setImage({ blob, url })
      })
      .catch((e) => toast((e as Error).message, 'error'))
    return () => {
      alive = false
      if (url) URL.revokeObjectURL(url)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, data, format, withKeys])

  const download = () => {
    if (!image) return
    const a = document.createElement('a')
    a.href = image.url
    a.download = fileName
    a.click()
  }

  /** Celular: abre o menu do aparelho com a imagem. Computador: baixa a imagem e abre o site. */
  const shareImage = async (site: string | null, withText = false) => {
    if (!image) return
    const file = new File([image.blob], fileName, { type: 'image/png' })
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], ...(withText ? { text: setlistShareText(text, { withKeys }) } : {}) })
      } catch (e) {
        if ((e as Error).name !== 'AbortError') toast('Não foi possível compartilhar. Baixe a imagem e publique.', 'error')
      }
      return
    }
    download()
    if (site) window.open(site, '_blank', 'noopener')
    toast('Imagem baixada. Agora é só publicar.')
  }

  const copyText = async () => {
    await navigator.clipboard.writeText(setlistShareText(text, { withKeys, bold: false }))
    toast('Texto copiado.')
  }

  const canShareFiles = typeof navigator !== 'undefined' && !!navigator.canShare
  const { w, h } = SHARE_SIZES[format]

  return (
    <Sheet open={open} onClose={onClose} title={blockId ? 'Divulgar bloco' : 'Divulgar repertório'} wide>
      <div className="grid gap-5 sm:grid-cols-[minmax(0,15rem)_1fr]">
        {/* Prévia da imagem */}
        <div className="mx-auto w-full max-w-[9rem] sm:max-w-[15rem]">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-2" style={{ aspectRatio: `${w} / ${h}` }}>
            {image ? (
              <img src={image.url} alt="Prévia da imagem de divulgação" className="size-full object-contain" />
            ) : (
              <Loader2 className="absolute inset-0 m-auto size-6 animate-spin text-muted" />
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-border p-1" role="radiogroup" aria-label="Formato da imagem">
              {(
                [
                  ['story', 'Stories'],
                  ['post', 'Post'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  role="radio"
                  aria-checked={format === id}
                  onClick={() => setFormat(id)}
                  className={clsx(
                    'h-8 rounded-lg px-3 text-sm font-medium transition',
                    format === id ? 'bg-accent text-accent-ink' : 'text-muted hover:text-text',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 px-1 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[var(--accent)]"
                checked={withKeys}
                onChange={(e) => setWithKeys(e.target.checked)}
              />
              Mostrar os tons
            </label>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <ShareTarget
              label="WhatsApp"
              bg="#25D366"
              onClick={() =>
                window.open(`https://wa.me/?text=${encodeURIComponent(setlistShareText(text, { withKeys }))}`, '_blank', 'noopener')
              }
            >
              <MessageCircle className="size-6" />
            </ShareTarget>
            <ShareTarget
              label="Instagram"
              bg="linear-gradient(45deg,#f9a52b,#ee2a7b 50%,#6228d7)"
              onClick={() => shareImage('https://www.instagram.com/')}
              disabled={!image}
            >
              <InstagramMark />
            </ShareTarget>
            <ShareTarget label="Facebook" bg="#1877F2" onClick={() => shareImage('https://www.facebook.com/')} disabled={!image}>
              <span className="text-3xl leading-none font-black">f</span>
            </ShareTarget>
            <ShareTarget
              label="X"
              bg="#000"
              onClick={() =>
                window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(setlistShortText(text))}`, '_blank', 'noopener')
              }
            >
              <span className="text-2xl leading-none font-black">𝕏</span>
            </ShareTarget>
          </div>
          <p className="text-xs text-muted">
            WhatsApp e X recebem a lista em texto. Instagram e Facebook recebem a imagem
            {canShareFiles ? ' pelo menu do aparelho.' : ': ela é baixada e o site abre para você publicar.'}
          </p>

          <div className="flex flex-wrap gap-2">
            {canShareFiles && (
              <button className="btn-ghost" onClick={() => shareImage(null, true)} disabled={!image}>
                <Share2 className="size-4" /> Enviar imagem
              </button>
            )}
            <button className="btn-ghost" onClick={download} disabled={!image}>
              <Download className="size-4" /> Baixar imagem
            </button>
            <button className="btn-ghost" onClick={copyText}>
              <Copy className="size-4" /> Copiar texto
            </button>
          </div>
        </div>
      </div>
    </Sheet>
  )
}

export function ShareTarget({
  label,
  bg,
  onClick,
  disabled,
  children,
}: {
  label: string
  bg: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      className="flex flex-col items-center gap-1.5 rounded-xl p-1 text-xs font-medium text-muted transition hover:text-text disabled:opacity-50"
      onClick={onClick}
      disabled={disabled}
    >
      <span className="grid size-14 place-items-center rounded-2xl text-white shadow-md" style={{ background: bg }}>
        {children}
      </span>
      {label}
    </button>
  )
}

export function InstagramMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}
