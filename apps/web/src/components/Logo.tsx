import clsx from 'clsx'

const SIZES = {
  md: { text: 'text-lg', mark: 'h-8' },
  lg: { text: 'text-3xl', mark: 'h-12' },
  xl: { text: 'text-4xl sm:text-5xl', mark: 'h-16 sm:h-20' },
}

export function Logo({ size = 'md' }: { size?: keyof typeof SIZES }) {
  return (
    <span className={clsx('inline-flex items-center gap-3 font-extrabold tracking-tight', SIZES[size].text)}>
      <img src="/logo-mark.svg" alt="" className={clsx('w-auto shrink-0', SIZES[size].mark)} />
      <span>
        Ensaio <span className="text-accent">Fácil</span>
      </span>
    </span>
  )
}
