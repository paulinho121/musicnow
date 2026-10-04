import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'
import { api } from './api'

export function usePageTracking() {
  const location = useLocation()
  const lastPath = useRef<string | null>(null)

  useEffect(() => {
    const currentPath = location.pathname
    // Evita chamadas duplicadas no mesmo path
    if (lastPath.current !== currentPath) {
      lastPath.current = currentPath
      // Envia visita de forma transparente sem travar navegação
      api('/analytics/visit', {
        method: 'POST',
        json: {
          path: currentPath,
          referrer: document.referrer || null,
        },
      }).catch(() => {})
    }

    // Heartbeat a cada 25 segundos para manter o status online ativo em tempo real
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        api('/analytics/heartbeat', {
          method: 'POST',
          json: { path: location.pathname },
        }).catch(() => {})
      }
    }, 25_000)

    return () => clearInterval(interval)
  }, [location.pathname])
}
