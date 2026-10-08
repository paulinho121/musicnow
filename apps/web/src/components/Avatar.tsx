import clsx from 'clsx'
import { useState } from 'react'

/** Foto de perfil redonda; sem foto (ou se ela não carregar), a inicial do nome. */
export function Avatar({ name, image, className }: { name: string; image?: string | null; className?: string }) {
  const [broken, setBroken] = useState<string | null>(null)
  const show = image && broken !== image
  return (
    <span
      className={clsx(
        'grid shrink-0 place-items-center overflow-hidden rounded-full bg-surface-2 font-semibold text-text select-none',
        className ?? 'size-10',
      )}
      aria-hidden
    >
      {show ? (
        <img src={image} alt="" className="size-full object-cover" referrerPolicy="no-referrer" onError={() => setBroken(image)} />
      ) : (
        (name.trim()[0] ?? '?').toUpperCase()
      )}
    </span>
  )
}
