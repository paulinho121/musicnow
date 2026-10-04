import {
  LICENSES,
  MAJOR_KEYS,
  MINOR_KEYS,
  parseSongFile,
  PUBLIC_LICENSES,
  VISIBILITY,
  type ImportedSong,
  type License,
  type Visibility,
} from '@ensaio/shared'
import clsx from 'clsx'
import { AlertTriangle, ArrowLeft, AudioLines, CheckCircle2, ChevronDown, ClipboardPaste, FileUp, Loader2, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState, type DragEvent } from 'react'
import { Link } from 'react-router'
import { ChordSheet, useSheet } from '../components/ChordSheet'
import { useToast } from '../components/ui'
import { checkDuplicates, useImportSongs } from '../lib/queries'
import type { ImportResult } from '../lib/types'

const MAX_FILES = 100
const MAX_BYTES = 512 * 1024
const ACCEPT = '.cho,.chopro,.chordpro,.crd,.pro,.txt,.onsong,.xml,.gp,.gp3,.gp4,.gp5,.gpx,text/plain'

const FORMAT_LABEL: Record<ImportedSong['format'], string> = {
  chordpro: 'ChordPro',
  onsong: 'OnSong',
  opensong: 'OpenSong',
  text: 'Texto',
  guitarpro: 'Guitar Pro',
}

interface Item {
  uid: number
  source: string
  song: ImportedSong
  include: boolean
  duplicateOf: string | null
  file?: File
}

let nextUid = 1

/** Lê o arquivo em UTF-8; se vier com acentos quebrados, tenta Windows-1252 (comum em .txt antigos). */
async function readText(file: File) {
  const buf = await file.arrayBuffer()
  const utf8 = new TextDecoder('utf-8').decode(buf)
  return utf8.includes('�') ? new TextDecoder('windows-1252').decode(buf) : utf8
}

export function Importer() {
  const toast = useToast()
  const importer = useImportSongs()
  const fileRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<Item[]>([])
  const [pasted, setPasted] = useState('')
  const [dragging, setDragging] = useState(false)
  const [rejected, setRejected] = useState<string[]>([])
  const [visibility, setVisibility] = useState<Visibility>('private')
  const [license, setLicense] = useState<License>('unknown')
  const [lyricsAuthorized, setLyricsAuthorized] = useState(false)
  const [extraTags, setExtraTags] = useState('importada')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attachingScores, setAttachingScores] = useState(false)

  // Marca as que já existem na biblioteca sempre que a lista (ou um título) muda.
  const dupSignature = items.map((i) => `${i.song.title}|${i.song.artist ?? ''}`).join('\n')
  useEffect(() => {
    if (!items.length) return
    const t = setTimeout(() => {
      checkDuplicates(items.map((i) => ({ title: i.song.title, artist: i.song.artist })))
        .then(({ duplicates }) =>
          setItems((list) =>
            list.map((it, idx) => {
              const dup = duplicates[idx] ?? null
              // Recém-detectada como duplicada: desmarca; deixou de ser: volta a marcar.
              if (dup && !it.duplicateOf) return { ...it, duplicateOf: dup, include: false }
              if (!dup && it.duplicateOf) return { ...it, duplicateOf: null, include: true }
              return it
            }),
          ),
        )
        .catch(() => {})
    }, 400)
    return () => clearTimeout(t)
    // Depende só da assinatura: marcar/desmarcar itens não deve disparar nova checagem.
  }, [dupSignature])

  const addFiles = async (files: FileList | File[]) => {
    const list = Array.from(files)
    const bad: string[] = []
    const room = MAX_FILES - items.length
    if (list.length > room) bad.push(`${list.length - room} arquivo(s) além do limite de ${MAX_FILES} por importação`)
    const parsed: Item[] = []
    for (const f of list.slice(0, Math.max(0, room))) {
      const isGp = /\.(gp|gp3|gp4|gp5|gpx)$/i.test(f.name)
      const maxSize = isGp ? 10 * 1024 * 1024 : MAX_BYTES
      if (f.size > maxSize) {
        bad.push(`${f.name}: maior que ${isGp ? '10 MB' : '512 KB'}`)
        continue
      }
      if (/\.(pdf|docx?|jpe?g|png)$/i.test(f.name)) {
        bad.push(`${f.name}: formato não suportado (PDF e imagens entram como anexo na próxima etapa)`)
        continue
      }
      if (isGp) {
        try {
          const { parseGuitarProSong } = await import('../lib/guitarPro')
          const song = await parseGuitarProSong(f)
          parsed.push({ uid: nextUid++, source: f.name, song, include: true, duplicateOf: null, file: f })
        } catch (e) {
          bad.push(`${f.name}: ${(e as Error).message || 'não foi possível ler o arquivo Guitar Pro'}`)
        }
        continue
      }
      try {
        const text = await readText(f)
        if (!text.trim()) {
          bad.push(`${f.name}: arquivo vazio`)
          continue
        }
        parsed.push({ uid: nextUid++, source: f.name, song: parseSongFile(text, f.name), include: true, duplicateOf: null })
      } catch {
        bad.push(`${f.name}: não foi possível ler`)
      }
    }
    setRejected(bad)
    setItems((prev) => [...prev, ...parsed])
    setResult(null)
  }

  const addPasted = () => {
    if (!pasted.trim()) return
    setItems((prev) => [
      ...prev,
      { uid: nextUid++, source: 'Texto colado', song: parseSongFile(pasted), include: true, duplicateOf: null },
    ])
    setPasted('')
    setResult(null)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
  }

  const update = (uid: number, patch: Partial<ImportedSong>) =>
    setItems((list) => list.map((i) => (i.uid === uid ? { ...i, song: { ...i.song, ...patch } } : i)))

  const selected = items.filter((i) => i.include)
  const needsLicense = visibility === 'public' && !PUBLIC_LICENSES.includes(license)

  const submit = () => {
    setError(null)
    if (needsLicense) return setError('Para importar como públicas, informe a licença das músicas.')
    if (selected.some((i) => !i.song.title.trim())) return setError('Há músicas sem título. Preencha antes de importar.')
    const tags = extraTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    importer.mutate(
      {
        skipDuplicates: true,
        songs: selected.map(({ song }) => ({
          title: song.title.trim(),
          artist: song.artist,
          composer: song.composer,
          originalKey: song.originalKey,
          bpm: song.bpm,
          timeSignature: song.timeSignature,
          style: null,
          notes: null,
          tags,
          content: song.content,
          lyricsAuthorized,
          visibility,
          license,
          importedFrom: song.format,
          referenceUrl: null,
        })),
      },
      {
        onSuccess: async (res) => {
          const gpItems = selected.filter((it) => it.file && /\.(gp|gp3|gp4|gp5|gpx)$/i.test(it.file.name))
          if (gpItems.length > 0) {
            setAttachingScores(true)
            for (const it of gpItems) {
              const match = res.created.find((c) => c.title.toLowerCase() === it.song.title.trim().toLowerCase())
              if (match && it.file) {
                try {
                  const { readGuitarProScorePages } = await import('../lib/guitarPro')
                  const { processPage } = await import('../lib/scoreProcess')
                  const { uploadScore } = await import('../lib/scores')
                  const sources = await readGuitarProScorePages(it.file)
                  const pages = []
                  for (const s of sources) {
                    const p = await processPage(s, 0)
                    pages.push(p)
                  }
                  await uploadScore(
                    {
                      songId: match.id,
                      label: 'Grade / Tablatura',
                      instrument: null,
                      pages,
                    },
                    () => {},
                  )
                  pages.forEach((p) => URL.revokeObjectURL(p.url))
                } catch {
                  // Se a renderização falhar, a música continua salva com a cifra
                }
              }
            }
            setAttachingScores(false)
          }
          setResult(res)
          setItems([])
          toast(`${res.created.length} música(s) importada(s)${gpItems.length > 0 ? ' com partitura(s) anexa(s)' : ''}.`)
        },
        onError: (err) => setError(err.message),
      },
    )
  }

  if (result) return <ImportDone result={result} onMore={() => setResult(null)} />

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link to="/musicas" className="btn-icon border-transparent bg-transparent" aria-label="Voltar">
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Importar cifras</h1>
          <p className="text-sm text-muted">ChordPro, OnSong, OpenSong ou texto copiado de qualquer lugar.</p>
        </div>
      </div>

      <Link
        to="/musicas/detectar"
        className="card flex items-center gap-3 border-accent/30 p-4 transition hover:border-accent/60"
      >
        <AudioLines className="size-6 shrink-0 text-accent" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">
            Tem só a gravação? Detectar acordes <span className="ml-1 rounded-md bg-accent/15 px-1.5 py-0.5 text-xs text-accent">beta</span>
          </span>
          <span className="block text-sm text-muted">O app ouve um áudio seu ou o microfone e sugere acordes, tom e BPM.</span>
        </span>
      </Link>

      <div className="grid gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={clsx(
            'card flex min-h-44 flex-col items-center justify-center gap-2 border-2 border-dashed p-6 text-center transition',
            dragging ? 'border-accent bg-accent/10' : 'hover:border-accent/50',
          )}
        >
          <FileUp className="size-8 text-accent" />
          <span className="font-semibold">Arraste arquivos ou toque para escolher</span>
          <span className="text-xs text-muted">.cho, .pro, .crd, .onsong, .txt, .gp, .gp5 e arquivos do OpenSong · até {MAX_FILES} por vez</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files)
            e.target.value = ''
          }}
        />

        <div className="card flex flex-col gap-3 p-4">
          <label htmlFor="paste" className="flex items-center gap-2 font-semibold">
            <ClipboardPaste className="size-4 text-accent" /> Colar cifra
          </label>
          <textarea
            id="paste"
            className="sheet input min-h-28 flex-1 resize-y py-2 text-sm"
            placeholder={'Título\nArtista\n\nTom: G\n\nG        D\nLetra da música...'}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            spellCheck={false}
            wrap="off"
          />
          <button type="button" className="btn-ghost" onClick={addPasted} disabled={!pasted.trim()}>
            Adicionar à lista
          </button>
        </div>
      </div>

      {rejected.length > 0 && (
        <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm">
          <p className="mb-1 font-semibold text-danger">Alguns arquivos ficaram de fora:</p>
          <ul className="list-disc pl-5 text-muted">
            {rejected.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {items.length > 0 && (
        <>
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">
                {items.length} {items.length === 1 ? 'música' : 'músicas'} · {selected.length} selecionada(s)
              </h2>
              <button type="button" className="text-sm text-muted hover:text-text" onClick={() => setItems([])}>
                Limpar lista
              </button>
            </div>
            <div className="card divide-y divide-border">
              {items.map((it) => (
                <ImportRow
                  key={it.uid}
                  item={it}
                  onToggle={() => setItems((l) => l.map((x) => (x.uid === it.uid ? { ...x, include: !x.include } : x)))}
                  onChange={(patch) => update(it.uid, patch)}
                  onRemove={() => setItems((l) => l.filter((x) => x.uid !== it.uid))}
                />
              ))}
            </div>
          </section>

          <section className="card space-y-4 p-4 md:p-5">
            <h2 className="font-semibold">Como salvar</h2>
            <div>
              <p className="label">Quem pode ver</p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(VISIBILITY) as Visibility[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={clsx('chip', visibility === v && 'chip-on')}
                    onClick={() => setVisibility(v)}
                    aria-pressed={visibility === v}
                  >
                    {VISIBILITY[v]}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="label">Licença</span>
                <select className="input" value={license} onChange={(e) => setLicense(e.target.value as License)}>
                  {(Object.keys(LICENSES) as License[]).map((l) => (
                    <option key={l} value={l}>
                      {LICENSES[l]}
                    </option>
                  ))}
                </select>
                {needsLicense && <span className="mt-1 block text-xs text-danger">Obrigatória para músicas públicas.</span>}
              </label>
              <label className="block">
                <span className="label">Tags adicionadas a todas</span>
                <input className="input" value={extraTags} onChange={(e) => setExtraTags(e.target.value)} />
              </label>
            </div>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]"
                checked={lyricsAuthorized}
                onChange={(e) => setLyricsAuthorized(e.target.checked)}
              />
              <span>
                Tenho autorização para exibir as letras
                <span className="block text-xs text-muted">
                  Você sempre vê a letra das suas músicas. Sem esta opção, músicos dos seus repertórios veem só os acordes.
                </span>
              </span>
            </label>
            <p className="rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">
              Importe apenas cifras que você tem direito de usar. Músicas públicas podem ser denunciadas por detentores de
              direitos e removidas.
            </p>
          </section>

          {error && (
            <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              className="btn-primary w-full sm:w-auto sm:min-w-56"
              onClick={submit}
              disabled={!selected.length || importer.isPending || attachingScores}
            >
              {importer.isPending || attachingScores ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {attachingScores
                ? 'Gerando partituras...'
                : importer.isPending
                  ? 'Importando...'
                  : `Importar ${selected.length} ${selected.length === 1 ? 'música' : 'músicas'}`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function ImportRow({
  item,
  onToggle,
  onChange,
  onRemove,
}: {
  item: Item
  onToggle: () => void
  onChange: (patch: Partial<ImportedSong>) => void
  onRemove: () => void
}) {
  const [open, setOpen] = useState(false)
  const { song } = item
  const lines = useSheet(open ? song.content : '', 0, song.originalKey)
  return (
    <div className={clsx('p-3 md:p-4', !item.include && 'opacity-60')}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-3 size-5 shrink-0 accent-[var(--accent)]"
          checked={item.include}
          onChange={onToggle}
          aria-label={`Importar ${song.title}`}
        />
        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[1fr_1fr_6rem]">
          <input
            className="input h-10 font-semibold"
            value={song.title}
            onChange={(e) => onChange({ title: e.target.value })}
            aria-label="Título"
            placeholder="Título"
          />
          <input
            className="input h-10"
            value={song.artist ?? ''}
            onChange={(e) => onChange({ artist: e.target.value || null })}
            aria-label="Artista"
            placeholder="Artista"
          />
          <select
            className="input h-10 font-mono"
            value={song.originalKey ?? ''}
            onChange={(e) => onChange({ originalKey: e.target.value || null })}
            aria-label="Tom"
          >
            <option value="">Tom?</option>
            {[...MAJOR_KEYS, ...MINOR_KEYS].map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </div>
        <button type="button" className="btn-icon size-10 shrink-0 border-transparent bg-transparent" onClick={onRemove} aria-label="Remover da lista">
          <Trash2 className="size-4" />
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 pl-8 text-xs">
        <span className="rounded-md bg-surface-2 px-2 py-1 text-muted">{FORMAT_LABEL[song.format]}</span>
        <span className="truncate text-muted" title={item.source}>
          {item.source}
        </span>
        {item.duplicateOf && (
          <span className="rounded-md bg-accent/15 px-2 py-1 font-medium text-accent">
            Já existe na sua biblioteca ·{' '}
            <Link to={`/musicas/${item.duplicateOf}`} className="underline" target="_blank">
              ver
            </Link>
          </span>
        )}
        <button type="button" className="ml-auto inline-flex items-center gap-1 text-muted hover:text-text" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? 'Ocultar cifra' : 'Ver cifra'} <ChevronDown className={clsx('size-4 transition', open && 'rotate-180')} />
        </button>
      </div>

      {song.warnings.length > 0 && (
        <ul className="mt-2 space-y-1 pl-8">
          {song.warnings.map((w) => (
            <li key={w} className="flex gap-1.5 text-xs text-muted">
              <AlertTriangle className="size-3.5 shrink-0 text-accent" /> {w}
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="mt-3 max-h-96 overflow-auto rounded-xl bg-bg p-3 md:ml-8">
          {song.content.trim() ? (
            <ChordSheet lines={lines} fontSize={14} lineHeight={1.4} wrap />
          ) : (
            <p className="text-sm text-muted">Arquivo sem conteúdo.</p>
          )}
        </div>
      )}
    </div>
  )
}

function ImportDone({ result, onMore }: { result: ImportResult; onMore: () => void }) {
  return (
    <div className="space-y-5">
      <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
        <CheckCircle2 className="size-10 text-ok" />
        <h1 className="text-xl font-bold">
          {result.created.length} {result.created.length === 1 ? 'música importada' : 'músicas importadas'}
        </h1>
        {result.skipped.length > 0 && <p className="text-sm text-muted">{result.skipped.length} ignorada(s) por já existirem.</p>}
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Link to="/musicas?escopo=mine" className="btn-primary">
            Ver minhas músicas
          </Link>
          <button type="button" className="btn-ghost" onClick={onMore}>
            Importar mais
          </button>
        </div>
      </div>
      {result.created.length > 0 && (
        <div className="card divide-y divide-border">
          {result.created.map((s) => (
            <Link key={s.id} to={`/musicas/${s.id}`} className="block px-4 py-3 text-sm hover:bg-surface-2">
              {s.title}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
