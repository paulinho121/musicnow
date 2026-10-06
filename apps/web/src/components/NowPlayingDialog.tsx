import { Download, Loader2, MessageCircle, Share2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { nowPlayingText, renderNowPlaying, type NowPlaying } from '../lib/nowPlayingImage'
import { InstagramMark, ShareTarget } from './setlist/ShareSetlistDialog'
import { Sheet } from './Sheet'
import { useToast } from './ui'

const slug = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'tocando-agora'

/**
 * "Tocando agora": imagem para Stories e Status com a música e o show, mais o texto pronto.
 * No celular abre o menu do aparelho (Instagram, WhatsApp...); no computador, baixa a imagem.
 */
export function NowPlayingDialog({ song, open, onClose }: { song: NowPlaying; open: boolean; onClose: () => void }) {
  const toast = useToast()
  const [withKey, setWithKey] = useState(false)
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null)
  const key = `${song.title}|${song.artist}|${song.coverUrl}|${song.show}|${song.location}|${song.key}|${withKey}`

  useEffect(() => {
    if (!open) return
    let alive = true
    let url: string | null = null
    setImage(null)
    renderNowPlaying(song, { withKey })
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
  }, [open, key])

  const fileName = `tocando-agora-${slug(song.title)}.jpg`
  const download = () => {
    if (!image) return
    const a = document.createElement('a')
    a.href = image.url
    a.download = fileName
    a.click()
  }
  const shareImage = async (site: string | null, withText = false) => {
    if (!image) return
    const file = new File([image.blob], fileName, { type: 'image/jpeg' })
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], ...(withText ? { text: nowPlayingText(song) } : {}) })
      } catch (e) {
        if ((e as Error).name !== 'AbortError') toast('Não foi possível compartilhar. Baixe a imagem e publique.', 'error')
      }
      return
    }
    download()
    if (site) window.open(site, '_blank', 'noopener')
    toast('Imagem baixada. Agora é só publicar.')
  }
  const canShareFiles = typeof navigator !== 'undefined' && !!navigator.canShare

  return (
    <Sheet open={open} onClose={onClose} title="Tocando agora" wide>
      <div className="grid gap-5 sm:grid-cols-[minmax(0,14rem)_1fr]">
        <div className="mx-auto w-full max-w-[9rem] sm:max-w-[14rem]">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-2" style={{ aspectRatio: '1080 / 1920' }}>
            {image ? (
              <img src={image.url} alt={`Prévia: tocando agora ${song.title}`} className="size-full object-cover" />
            ) : (
              <Loader2 className="absolute inset-0 m-auto size-6 animate-spin text-muted" />
            )}
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-muted">
            Poste nos Stories ou no Status do WhatsApp enquanto toca: o público vê a música
            {song.show ? ` e o show (${song.show})` : ''}.
          </p>
          {song.key && (
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[var(--accent)]"
                checked={withKey}
                onChange={(e) => setWithKey(e.target.checked)}
              />
              Mostrar o tom ({song.key})
            </label>
          )}
          <div className="grid grid-cols-4 gap-2">
            <ShareTarget
              label="Instagram"
              bg="linear-gradient(45deg,#f9a52b,#ee2a7b 50%,#6228d7)"
              onClick={() => shareImage('https://www.instagram.com/')}
              disabled={!image}
            >
              <InstagramMark />
            </ShareTarget>
            <ShareTarget
              label="WhatsApp"
              bg="#25D366"
              onClick={() =>
                canShareFiles
                  ? shareImage(null, true)
                  : window.open(`https://wa.me/?text=${encodeURIComponent(nowPlayingText(song))}`, '_blank', 'noopener')
              }
              disabled={canShareFiles && !image}
            >
              <MessageCircle className="size-6" />
            </ShareTarget>
            <ShareTarget label="Facebook" bg="#1877F2" onClick={() => shareImage('https://www.facebook.com/')} disabled={!image}>
              <span className="text-3xl leading-none font-black">f</span>
            </ShareTarget>
            <ShareTarget
              label="X"
              bg="#000"
              onClick={() =>
                window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(nowPlayingText(song))}`, '_blank', 'noopener')
              }
            >
              <span className="text-2xl leading-none font-black">𝕏</span>
            </ShareTarget>
          </div>
          <div className="flex flex-wrap gap-2">
            {canShareFiles && (
              <button className="btn-ghost" onClick={() => shareImage(null, true)} disabled={!image}>
                <Share2 className="size-4" /> Mais opções
              </button>
            )}
            <button className="btn-ghost" onClick={download} disabled={!image}>
              <Download className="size-4" /> Baixar imagem
            </button>
          </div>
        </div>
      </div>
    </Sheet>
  )
}
