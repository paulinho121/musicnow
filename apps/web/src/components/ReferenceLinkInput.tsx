import {
  isShortMusicLink,
  MUSIC_SERVICE_COLOR,
  MUSIC_SERVICE_LABEL,
  MUSIC_SERVICES,
  musicSearchUrl,
  parseMusicLink,
  type SongRef,
} from '@ensaio/shared'
import { Search } from 'lucide-react'

/**
 * Link da gravação de referência (a versão que a banda toca): YouTube, Spotify, Deezer ou
 * Apple Music. Os botões abrem a busca da música em cada serviço para copiar o link de lá.
 */
export function ReferenceLinkInput({
  value,
  onChange,
  song,
  autoFocus,
}: {
  value: string | null
  onChange: (v: string | null) => void
  song: SongRef
  autoFocus?: boolean
}) {
  const link = parseMusicLink(value)
  const invalid = Boolean(value) && !link && !isShortMusicLink(value)
  return (
    <div>
      <input
        className="input"
        type="url"
        inputMode="url"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value.trim() || null)}
        placeholder="Cole o link do YouTube, Spotify, Deezer ou Apple Music"
        autoFocus={autoFocus}
      />
      {invalid ? (
        <span className="mt-1 block text-xs text-danger">Use um link do YouTube, Spotify, Deezer ou Apple Music.</span>
      ) : link ? (
        <span className="mt-1 block text-xs text-muted">
          {MUSIC_SERVICE_LABEL[link.service]} · {link.kind === 'track' ? 'música' : link.kind === 'album' ? 'álbum' : 'playlist'}
        </span>
      ) : null}
      {song.title.trim() && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1 text-xs text-muted">
            <Search className="size-3.5" /> Achar a versão no
          </span>
          {MUSIC_SERVICES.map((s) => (
            <a
              key={s}
              href={musicSearchUrl(s, song)}
              target="_blank"
              rel="noopener noreferrer"
              className="chip h-7 text-xs"
              title={`Procura "${song.title}" no ${MUSIC_SERVICE_LABEL[s]}: copie o link da versão e cole aqui`}
            >
              <span className="size-2 rounded-full" style={{ background: MUSIC_SERVICE_COLOR[s] }} />
              {MUSIC_SERVICE_LABEL[s]}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
