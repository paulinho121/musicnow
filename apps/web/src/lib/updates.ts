import { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

// Atualização do app instalado / em cache (service worker).
//
// Quando sai uma versão nova, o app troca sozinho — exceto se a pessoa estiver
// tocando (modo Tocar / Palco): aí só avisa, para não recarregar no meio da música.

const READY = 'ef-update-ready'
const isPlaying = () => /\/tocar\//.test(window.location.pathname)

let applyUpdate: ((reload?: boolean) => Promise<void>) | null = null
let pending = false

export function setupUpdates() {
  if (!('serviceWorker' in navigator)) return
  applyUpdate = registerSW({
    immediate: true,
    onNeedRefresh() {
      if (!isPlaying()) {
        void applyUpdate?.(true)
        return
      }
      pending = true
      window.dispatchEvent(new Event(READY))
    },
    onRegisteredSW(_url, reg) {
      if (!reg) return
      // Procura versão nova a cada 30 min e sempre que o app volta para a frente
      // (o app instalado no celular pode ficar dias aberto em segundo plano).
      const check = () => reg.update().catch(() => {})
      setInterval(check, 30 * 60 * 1000)
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check())
    },
  })
}

/** Chamado a cada troca de tela: saiu do modo Tocar com versão nova esperando, aplica agora. */
export function onRouteChange() {
  if (pending && !isPlaying()) void applyUpdate?.(true)
}

/** true quando há versão nova esperando o fim da música. */
export function useUpdateReady() {
  const [ready, setReady] = useState(pending)
  useEffect(() => {
    const on = () => setReady(true)
    window.addEventListener(READY, on)
    return () => window.removeEventListener(READY, on)
  }, [])
  return { ready, apply: () => applyUpdate?.(true) }
}
