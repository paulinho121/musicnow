import { MUSIC_SERVICE_LABEL, parseMusicLink } from '@ensaio/shared'
import { ExternalLink, Headphones } from 'lucide-react'
import { useState } from 'react'
import { Sheet } from './Sheet'

/**
 * Gravação de referência no player oficial do serviço (YouTube sem cookies de rastreamento,
 * Spotify, Deezer ou Apple Music). É a forma permitida de ouvir a música dentro do app.
 */
export function ReferencePlayer({ url, title }: { url: string; title: string }) {
  const [open, setOpen] = useState(false)
  const link = parseMusicLink(url)
  if (!link) return null
  const label = MUSIC_SERVICE_LABEL[link.service]
  return (
    <>
      <button className="chip h-8 text-xs" onClick={() => setOpen(true)}>
        <Headphones className="size-3.5 text-accent" /> Ouvir referência
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Gravação de referência" wide>
        <div
          className={link.embedHeight ? 'overflow-hidden rounded-xl' : 'aspect-video overflow-hidden rounded-xl bg-black'}
          style={link.embedHeight ? { height: link.embedHeight } : undefined}
        >
          {open && (
            <iframe
              className="size-full border-0"
              src={link.embedUrl}
              title={`Referência: ${title}`}
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          )}
        </div>
        <a
          href={link.openUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text"
        >
          <ExternalLink className="size-4" /> Abrir no {label}
        </a>
      </Sheet>
    </>
  )
}
