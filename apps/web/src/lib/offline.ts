// "Baixar para o show": guarda no aparelho o repertório inteiro (lista, cada música no tom do
// repertório e partituras) para tocar sem internet. Quem guarda é o service worker
// (vite.config.ts → runtimeCaching): aqui só pedimos cada endereço uma vez, como o app pediria.
import { useEffect, useState } from 'react'
import { scorePageUrl } from './scores'
import type { SetlistDetail, SongDetail } from './types'

const KEY = (id: string) => `ef-offline:${id}`

export interface OfflineRecord {
  /** Versão do repertório baixada: se mudou, é preciso atualizar. */
  revision: number
  at: number
  songs: number
  bytes: number
}

export function offlineRecord(id: string): OfflineRecord | null {
  try {
    return JSON.parse(localStorage.getItem(KEY(id)) ?? 'null')
  } catch {
    return null
  }
}

function saveRecord(id: string, r: OfflineRecord | null) {
  try {
    if (r) localStorage.setItem(KEY(id), JSON.stringify(r))
    else localStorage.removeItem(KEY(id))
  } catch {
    // sem localStorage: o conteúdo fica guardado, só não mostramos a marca "baixado"
  }
  window.dispatchEvent(new Event('ef-offline'))
}

/** O modo sem internet precisa do service worker ativo (o app instalado/aberto uma vez). */
export const offlineReady = () => Boolean(navigator.serviceWorker?.controller)

async function get(url: string) {
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) throw new Error(`Não foi possível baixar (${res.status}).`)
  return res
}

/** Endereços que o app usa para este repertório (os mesmos da tela de tocar). */
function urlsOf(setlist: SetlistDetail) {
  return {
    setlist: `/api/setlists/${setlist.id}`,
    songs: setlist.items.map((it) => ({
      inSetlist: `/api/songs/${it.song.id}?setlistId=${setlist.id}`,
      alone: `/api/songs/${it.song.id}`,
    })),
  }
}

export async function downloadSetlist(setlist: SetlistDetail, onProgress: (done: number, total: number) => void) {
  if (!offlineReady()) throw new Error('Feche e abra o app uma vez (com internet) para ativar o modo sem internet.')
  const urls = urlsOf(setlist)
  const total = urls.songs.length
  let bytes = 0
  await get(urls.setlist)
  onProgress(0, total)
  let done = 0
  // De 3 em 3: rápido sem travar a conexão do celular.
  const queue = [...urls.songs]
  const worker = async () => {
    for (let u = queue.shift(); u; u = queue.shift()) {
      const song = (await (await get(u.inSetlist)).json()) as SongDetail
      await get(u.alone).catch(() => null)
      for (const part of song.scores ?? []) {
        for (let n = 0; n < part.pages.length; n++) await get(scorePageUrl(part.id, n))
        bytes += part.totalBytes
      }
      // Capa (outro site): o navegador guarda no cache dele ao carregar a imagem.
      if (song.coverUrl) new Image().src = song.coverUrl
      bytes += song.content.length
      onProgress(++done, total)
    }
  }
  await Promise.all([worker(), worker(), worker()])
  saveRecord(setlist.id, { revision: setlist.revision, at: Date.now(), songs: total, bytes })
}

/** Tira do aparelho (libera espaço). As partituras ficam se outras músicas usarem. */
export async function removeDownload(setlist: SetlistDetail) {
  const urls = urlsOf(setlist)
  const cache = await caches.open('api').catch(() => null)
  if (cache) {
    await cache.delete(urls.setlist)
    for (const u of urls.songs) {
      await cache.delete(u.inSetlist)
      await cache.delete(u.alone)
    }
  }
  saveRecord(setlist.id, null)
}

/** Situação do download deste repertório (atualiza ao baixar/remover). */
export function useOfflineRecord(id: string) {
  const [rec, setRec] = useState(() => offlineRecord(id))
  useEffect(() => {
    const update = () => setRec(offlineRecord(id))
    update()
    window.addEventListener('ef-offline', update)
    return () => window.removeEventListener('ef-offline', update)
  }, [id])
  return rec
}

/** Está sem internet agora? */
export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}
