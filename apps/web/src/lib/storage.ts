import { useCallback, useState } from 'react'

/** Objeto persistido no navegador (preferências de leitura). Chaves novas herdam o padrão. */
export function useLocalState<T extends object>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? { ...initial, ...JSON.parse(raw) } : initial
    } catch {
      return initial
    }
  })
  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const v = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
        try {
          localStorage.setItem(key, JSON.stringify(v))
        } catch {
          // navegação privada: segue só em memória
        }
        return v
      })
    },
    [key],
  )
  return [value, update] as const
}

export type Theme = 'dark' | 'light'

export function getTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

export function setTheme(t: Theme) {
  document.documentElement.dataset.theme = t
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'light' ? '#f6f5f2' : '#0e0f13')
  try {
    localStorage.setItem('ef-theme', t)
  } catch {
    // ignora
  }
}
