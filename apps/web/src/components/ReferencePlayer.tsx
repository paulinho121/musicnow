import { youtubeId } from '@ensaio/shared'
import { ExternalLink, Headphones } from 'lucide-react'
import { useState } from 'react'
import { Sheet } from './Sheet'

/**
 * Gravação de referência no player oficial do YouTube (domínio youtube-nocookie:
 * sem cookies de rastreamento até a pessoa dar play). É a forma permitida de
 * ouvir a música dentro do app.
 */
export function ReferencePlayer({ url, title }: { url: string; title: string }) {
  const [open, setOpen] = useState(false)
  const id = youtubeId(url)
  if (!id) return null
  return (
    <>
      <button className="chip h-8 text-xs" onClick={() => setOpen(true)}>
        <Headphones className="size-3.5 text-accent" /> Ouvir referência
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Gravação de referência" wide>
        <div className="aspect-video overflow-hidden rounded-xl bg-black">
          {open && (
            <iframe
              className="size-full"
              src={`https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`}
              title={`Referência: ${title}`}
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          )}
        </div>
        <a href={url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text">
          <ExternalLink className="size-4" /> Abrir no YouTube
        </a>
      </Sheet>
    </>
  )
}
