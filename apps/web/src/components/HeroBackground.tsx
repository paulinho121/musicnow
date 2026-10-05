import clsx from 'clsx'
import { ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { heroImageUrl, type HeroImage, useHeroImages } from '../lib/hero'
import { Sheet } from './Sheet'
import { useToast } from './ui'

const ROTATE_MS = 10_000
const MAX = 5

/**
 * Fundo do destaque do início com as imagens da pessoa. Várias imagens se alternam
 * (troca suave a cada 10 s; parado para quem pediu "reduzir movimento").
 * A imagem cobre o espaço todo em qualquer tela; a sombra mantém o texto legível.
 */
export function HeroBackground({ images }: { images: HeroImage[] }) {
  const [current, setCurrent] = useState(0)
  useEffect(() => {
    setCurrent(0)
    if (images.length < 2 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setCurrent((i) => (i + 1) % images.length), ROTATE_MS)
    return () => clearInterval(t)
  }, [images])
  if (!images.length) return null
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {images.map((img, i) => (
        <img
          key={img.id}
          src={heroImageUrl(img.id)}
          alt=""
          className={clsx('absolute inset-0 size-full object-cover transition-opacity duration-1000', i === current ? 'opacity-100' : 'opacity-0')}
          // Só baixa a próxima quando for a vez dela (economiza dados no celular).
          loading={i === 0 ? 'eager' : 'lazy'}
        />
      ))}
      {/* Sombra para o texto: de baixo para cima no celular, da esquerda no computador */}
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/70 to-bg/20 md:bg-gradient-to-r md:from-bg/95 md:via-bg/65 md:to-bg/10" />
    </div>
  )
}

/** Janela "Personalizar": adicionar e remover as imagens do destaque. */
export function HeroCustomizeDialog({ images, open, onClose }: { images: HeroImage[]; open: boolean; onClose: () => void }) {
  const { add, remove } = useHeroImages()
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const addFiles = async (list: FileList | null) => {
    const files = [...(list ?? [])].slice(0, MAX - images.length)
    if (!files.length) return
    setBusy(true)
    try {
      for (const f of files) await add.mutateAsync(f)
      toast(files.length === 1 ? 'Imagem adicionada.' : `${files.length} imagens adicionadas.`)
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Personalizar o início" wide>
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Coloque até {MAX} imagens suas no destaque do início. Com mais de uma, elas se alternam. Só você vê.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((img) => (
            <div key={img.id} className="group relative aspect-video overflow-hidden rounded-xl border border-border bg-surface-2">
              <img src={heroImageUrl(img.id)} alt="" className="size-full object-cover" />
              <button
                className="absolute top-1.5 right-1.5 grid size-8 place-items-center rounded-lg bg-black/60 text-white backdrop-blur hover:bg-danger"
                onClick={() => remove.mutate(img.id, { onError: (e) => toast(e.message, 'error') })}
                aria-label="Remover esta imagem"
                disabled={remove.isPending}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          {images.length < MAX && (
            <button
              className="grid aspect-video place-items-center rounded-xl border-2 border-dashed border-border text-muted transition hover:border-accent/50 hover:text-text"
              onClick={() => input.current?.click()}
              disabled={busy}
            >
              <span className="flex flex-col items-center gap-1 text-sm font-medium">
                {busy ? <Loader2 className="size-6 animate-spin" /> : <ImagePlus className="size-6" />}
                {busy ? 'Enviando…' : 'Adicionar imagem'}
              </span>
            </button>
          )}
        </div>
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => (addFiles(e.target.files), (e.target.value = ''))} />
        <p className="text-xs text-muted">
          Dica: fotos deitadas (na horizontal) ficam melhores. O meio da foto aparece sempre; as bordas podem ser cortadas em telas
          estreitas. A foto é reduzida no seu aparelho antes de enviar (fica leve e rápida).
        </p>
      </div>
    </Sheet>
  )
}
