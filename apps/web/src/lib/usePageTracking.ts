import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'
import { api } from './api'

export function usePageTracking() {
  const location = useLocation()
  const lastPath = useRef<string | null>(null)

  useEffect(() => {
    const currentPath = location.pathname
    // Evita chamadas duplicadas no mesmo path
    if (lastPath.current === currentPath) return
    lastPath.current = currentPath

    // Envia visita de forma transparente sem travar navegação
    api('/analytics/visit', {
      method: 'POST',
      json: {
        path: currentPath,
        referrer: document.referrer || null,
      },
    }).catch(() => {
      // Ignora falha silenciosamente
    })
  }, [location.pathname])
}
