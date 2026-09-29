import clsx from 'clsx'

export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <span className={clsx('inline-flex items-center gap-2.5 font-bold tracking-tight', size === 'lg' ? 'text-3xl' : 'text-lg')}>
      <img src="/icon.svg" alt="" className={size === 'lg' ? 'size-12' : 'size-8'} />
      <span>
        Ensaio <span className="text-accent">Fácil</span>
      </span>
    </span>
  )
}
