// Onde cada músico ouve as músicas (Spotify, Deezer, YouTube ou Apple Music): escolha do
// aparelho. O botão de ouvir abre a referência, se for desse serviço, ou a busca nele.
import { listenLink, MUSIC_SERVICES, type MusicService, type SongRef } from '@ensaio/shared'
import { useSyncExternalStore } from 'react'

const KEY = 'ef-listen-service'
const listeners = new Set<() => void>()

function read(): MusicService {
  try {
    const v = localStorage.getItem(KEY)
    return (MUSIC_SERVICES as readonly string[]).includes(v ?? '') ? (v as MusicService) : 'youtube'
  } catch {
    return 'youtube'
  }
}

export function setListenService(service: MusicService) {
  try {
    localStorage.setItem(KEY, service)
  } catch {
    // sem armazenamento (aba anônima): vale só até fechar
  }
  current = service
  listeners.forEach((l) => l())
}

let current: MusicService | null = null

export function useListenService(): MusicService {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => (current ??= read()),
  )
}

/** Link para ouvir a música no serviço da pessoa. */
export function useListen(song: SongRef & { referenceUrl?: string | null }) {
  const service = useListenService()
  return { service, ...listenLink(service, song) }
}
