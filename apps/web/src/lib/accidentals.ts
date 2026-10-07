// Sustenido (A#) ou bemol (Bb): escolha de cada músico, guardada no aparelho.
// "Automático" segue a grafia convencional do tom.
import type { Accidentals } from '@ensaio/shared'
import { useSyncExternalStore } from 'react'

const KEY = 'ef-accidentals'
const listeners = new Set<() => void>()
let current: Accidentals | null = null

function read(): Accidentals {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'sharp' || v === 'flat' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

export function setAccidentals(value: Accidentals) {
  try {
    localStorage.setItem(KEY, value)
  } catch {
    // sem armazenamento (aba anônima): vale só até fechar
  }
  current = value
  listeners.forEach((l) => l())
}

export function useAccidentals(): Accidentals {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => (current ??= read()),
  )
}
