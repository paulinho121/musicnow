import clsx from 'clsx'
import { Check, Trash2, X } from 'lucide-react'

/** Caixinha de seleção das listas (músicas e repertórios). */
export function SelectBox({ checked, disabled = false }: { checked: boolean; disabled?: boolean }) {
  return (
    <span
      aria-hidden
      className={clsx(
        'grid size-6 shrink-0 place-items-center rounded-md border-2 transition',
        checked ? 'border-accent bg-accent text-accent-ink' : 'border-border',
        disabled && 'opacity-30',
      )}
    >
      {checked && <Check className="size-4" strokeWidth={3} />}
    </span>
  )
}

/** Barra de baixo no modo de seleção: quantos, selecionar todos e excluir. */
export function SelectionBar({
  count,
  total,
  onAll,
  onCancel,
  onDelete,
}: {
  count: number
  /** Quantos dá para selecionar na lista atual. */
  total: number
  onAll: () => void
  onCancel: () => void
  onDelete: () => void
}) {
  const all = total > 0 && count === total
  return (
    // No celular fica acima da barra de navegação de baixo.
    <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 px-3 md:bottom-6">
      <div className="mx-auto flex max-w-xl items-center gap-2 rounded-2xl border border-border bg-surface/95 p-2 shadow-2xl shadow-black/40 backdrop-blur">
        <button className="btn-icon shrink-0 border-transparent bg-transparent" onClick={onCancel} aria-label="Sair da seleção">
          <X className="size-5" />
        </button>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">
          {count} {count === 1 ? 'selecionado' : 'selecionados'}
        </p>
        <button className="btn-ghost h-10 shrink-0 px-3 text-sm" onClick={onAll} disabled={!total}>
          {all ? 'Limpar' : 'Todos'}
        </button>
        <button className="btn h-10 shrink-0 bg-danger px-3 text-sm text-white hover:brightness-110" onClick={onDelete} disabled={!count}>
          <Trash2 className="size-4" /> Excluir
        </button>
      </div>
    </div>
  )
}
