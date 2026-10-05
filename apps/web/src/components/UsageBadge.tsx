import clsx from 'clsx'
import { Users } from 'lucide-react'

/** "9 músicos" / "1 músico" */
const people = (n: number) => `${n} ${n === 1 ? 'músico' : 'músicos'}`

/** Texto completo: "Usada por 9 músicos em 23 repertórios". */
export function usageText(usagePeople: number, usageSetlists: number) {
  if (usagePeople <= 0) return null
  return `Usada por ${people(usagePeople)} em ${usageSetlists} ${usageSetlists === 1 ? 'repertório' : 'repertórios'}`
}

/**
 * Prova social da cifra: quantos outros músicos colocaram a música nos seus repertórios.
 * Só aparece quando alguém além da dona usou.
 */
export function UsageBadge({
  usagePeople,
  usageSetlists,
  compact = false,
  className,
}: {
  usagePeople: number
  usageSetlists: number
  /** Lista: só o ícone e o número de músicos. */
  compact?: boolean
  className?: string
}) {
  const text = usageText(usagePeople, usageSetlists)
  if (!text) return null
  return (
    <span className={clsx('inline-flex items-center gap-1 text-ok', className)} title={text}>
      <Users className="size-3.5 shrink-0" />
      {compact ? <span className="font-semibold">{usagePeople}</span> : <span>{text}</span>}
      {compact && <span className="sr-only">{text}</span>}
    </span>
  )
}
