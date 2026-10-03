import clsx from 'clsx'
import { useState } from 'react'

export interface CoverSong {
  title: string
  artist: string | null
  coverUrl?: string | null
}

// Gradientes escolhidos a dedo: escuros o bastante para o texto branco, vivos no palco.
const PALETTES: [string, string][] = [
  ['#ff7a59', '#7b2ff7'],
  ['#f5a524', '#c2410c'],
  ['#22d3ee', '#7c3aed'],
  ['#14b8a6', '#1e3a8a'],
  ['#f472b6', '#be123c'],
  ['#34d399', '#065f46'],
  ['#fb7185', '#6d28d9'],
  ['#fbbf24', '#b91c1c'],
  ['#a78bfa', '#312e81'],
  ['#38bdf8', '#1d4ed8'],
  ['#f97316', '#831843'],
  ['#4ade80', '#0e7490'],
]

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Cores da capa gerada (as mesmas sempre para a mesma música). */
export function coverColors(song: CoverSong) {
  const h = hash(`${song.title}|${song.artist ?? ''}`.toLowerCase())
  return { colors: PALETTES[h % PALETTES.length], pattern: (h >>> 8) % 3, angle: 120 + ((h >>> 12) % 5) * 15 }
}

const initials = (title: string) =>
  title
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 || /^\p{N}/u.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || title.slice(0, 1).toUpperCase()

/** Capa real do álbum se houver; senão, uma capa desenhada pelo app com o nome da música. */
export function SongCover({
  song,
  className,
  hd = false,
}: {
  song: CoverSong
  className?: string
  /** Imagem em resolução maior (telas de destaque). */
  hd?: boolean
}) {
  const [failed, setFailed] = useState<string | null>(null)
  const [loaded, setLoaded] = useState<Set<string>>(() => new Set())
  const url = song.coverUrl && song.coverUrl !== failed ? song.coverUrl : null
  // A versão grande do acervo pode demorar: mostra a pequena e troca quando a grande chegar.
  const big = url && hd ? url.replace(/front-250$/, 'front-500') : null
  const markLoaded = (u: string) => setLoaded((s) => new Set(s).add(u))
  const fade = (u: string) => clsx('absolute inset-0 size-full object-cover transition-opacity duration-300', loaded.has(u) ? 'opacity-100' : 'opacity-0')

  return (
    <div className={clsx('@container relative isolate shrink-0 overflow-hidden bg-surface-2', className)}>
      {url && !loaded.has(url) && <div className="absolute inset-0 animate-pulse bg-surface-2" />}
      {url ? (
        <>
          <img
            src={url}
            alt=""
            decoding="async"
            className={fade(url)}
            onLoad={() => markLoaded(url)}
            onError={() => setFailed(song.coverUrl ?? null)}
          />
          {big && <img src={big} alt="" decoding="async" className={fade(big)} onLoad={() => markLoaded(big)} />}
        </>
      ) : (
        <GeneratedCover song={song} />
      )}
      {/* Brilho sutil na borda, como capa impressa. */}
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-white/10 ring-inset" />
    </div>
  )
}

function GeneratedCover({ song }: { song: CoverSong }) {
  const { colors, pattern, angle } = coverColors(song)
  return (
    <div className="absolute inset-0" style={{ background: `linear-gradient(${angle}deg, ${colors[0]}, ${colors[1]})` }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden>
        {pattern === 0 &&
          // Disco de vinil saindo pelo canto
          [44, 36, 28, 20].map((r, i) => <circle key={r} cx="88" cy="18" r={r} fill="none" stroke="white" strokeOpacity={0.1 + i * 0.04} strokeWidth="1.2" />)}
        {pattern === 1 &&
          // Ondas sonoras
          [0, 1, 2, 3, 4].map((i) => (
            <path
              key={i}
              d={`M-5 ${30 + i * 9} C 20 ${18 + i * 9}, 40 ${42 + i * 9}, 60 ${30 + i * 9} S 95 ${18 + i * 9}, 110 ${30 + i * 9}`}
              fill="none"
              stroke="white"
              strokeOpacity={0.08 + i * 0.03}
              strokeWidth="1.4"
            />
          ))}
        {pattern === 2 && (
          // Sol / holofote
          <>
            <circle cx="72" cy="30" r="30" fill="white" fillOpacity="0.1" />
            <circle cx="72" cy="30" r="18" fill="white" fillOpacity="0.12" />
          </>
        )}
      </svg>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent from-45% to-black/35" />
      {/* Miniatura: só as iniciais. Maior: o nome da música, como capa de disco. */}
      <span className="absolute inset-0 grid place-items-center text-[38cqw] leading-none font-black tracking-tight text-white/95 @min-[110px]:hidden">
        {initials(song.title)}
      </span>
      <div className="absolute inset-x-0 bottom-0 hidden p-[8cqw] text-white @min-[110px]:block">
        <p className="line-clamp-3 text-[11cqw] leading-[1.05] font-extrabold tracking-tight break-words drop-shadow-sm">{song.title}</p>
        {song.artist && <p className="mt-[2cqw] truncate text-[6.5cqw] font-medium text-white/80">{song.artist}</p>}
      </div>
    </div>
  )
}

/** Fundo desfocado com as cores da capa (atrás do destaque da música). */
export function CoverGlow({ song, className }: { song: CoverSong; className?: string }) {
  const { colors, angle } = coverColors(song)
  return (
    <div aria-hidden className={clsx('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      {song.coverUrl ? (
        <img src={song.coverUrl} alt="" className="absolute inset-0 size-full scale-150 object-cover opacity-45 blur-3xl saturate-150" />
      ) : (
        <div className="absolute inset-0 opacity-35 blur-2xl" style={{ background: `linear-gradient(${angle}deg, ${colors[0]}, ${colors[1]})` }} />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-surface/90" />
    </div>
  )
}
