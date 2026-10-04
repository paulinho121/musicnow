import { INSTRUMENTS, type Instrument } from '@ensaio/shared'
import clsx from 'clsx'
import { Camera, FileUp, Loader2, RotateCw, Sparkles, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { formatBytes, type ProcessedPage, processPage, readSources, type SourcePage } from '../../lib/scoreProcess'
import { uploadScore } from '../../lib/scores'
import { Sheet } from '../Sheet'
import { useToast } from '../ui'

const LABELS = ['Grade', 'Piano', 'Voz', 'Violino', 'Flauta', 'Clarinete (Si♭)', 'Sax alto (Mi♭)', 'Sax tenor (Si♭)', 'Trompete (Si♭)', 'Trombone', 'Baixo', 'Bateria']

/** Instrumento do perfil a partir do nome da parte ("Sax alto" → sopro). */
function guessInstrument(label: string): Instrument | null {
  const l = label.toLowerCase()
  if (/sax|trompete|trombone|flauta|clarinete|tuba|trompa|obo|fagote|sopro|metais/.test(l)) return 'sopro'
  if (/violino|viola|violoncelo|cello|contrabaixo ac|cordas/.test(l)) return 'cordas'
  if (/piano|teclado|órgão|orgao|synth/.test(l)) return 'teclado'
  if (/voz|vocal|coral|soprano|contralto|tenor\b|baixo vocal/.test(l)) return 'voz'
  if (/viol[aã]o/.test(l)) return 'violao'
  if (/guitarra/.test(l)) return 'guitarra'
  if (/baixo/.test(l)) return 'baixo'
  if (/bateria/.test(l)) return 'bateria'
  if (/percuss/.test(l)) return 'percussao'
  return null
}

interface Item {
  key: number
  source: SourcePage
  turns: number
  page?: ProcessedPage
  error?: string
}

let nextKey = 0

/** Enviar uma parte da partitura: o PDF/foto vira páginas WebP leves NO APARELHO. */
export function ScoreUploadDialog({ songId, open, onClose, onDone }: { songId: string; open: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast()
  const [label, setLabel] = useState('')
  const [instrument, setInstrument] = useState<Instrument | null>(null)
  const [instrumentTouched, setInstrumentTouched] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [originalBytes, setOriginalBytes] = useState(0)
  const [reading, setReading] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const working = useRef(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setLabel('')
    setInstrument(null)
    setInstrumentTouched(false)
    setItems((old) => {
      old.forEach((i) => i.page && URL.revokeObjectURL(i.page.url))
      return []
    })
    setOriginalBytes(0)
    setProgress(null)
  }, [open])

  // Converte as páginas pendentes, uma por vez (não trava o celular).
  useEffect(() => {
    if (working.current) return
    const next = items.find((i) => !i.page && !i.error)
    if (!next) return
    working.current = true
    processPage(next.source, next.turns)
      .then((page) => setItems((all) => all.map((i) => (i.key === next.key ? { ...i, page } : i))))
      .catch((e: Error) => setItems((all) => all.map((i) => (i.key === next.key ? { ...i, error: e.message } : i))))
      .finally(() => {
        working.current = false
        setItems((all) => [...all]) // dispara a próxima
      })
  }, [items])

  const addFiles = async (list: FileList | null) => {
    const files = [...(list ?? [])]
    if (!files.length) return
    setReading(true)
    try {
      const sources = await readSources(files)
      if (items.length + sources.length > 30) throw new Error('Uma parte pode ter até 30 páginas.')
      setOriginalBytes((n) => n + files.reduce((s, f) => s + f.size, 0))
      setItems((all) => [...all, ...sources.map((source) => ({ key: nextKey++, source, turns: 0 }))])
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setReading(false)
    }
  }

  const rotate = (key: number) =>
    setItems((all) =>
      all.map((i) => {
        if (i.key !== key) return i
        if (i.page) URL.revokeObjectURL(i.page.url)
        return { ...i, turns: i.turns + 1, page: undefined, error: undefined }
      }),
    )
  const remove = (key: number) =>
    setItems((all) =>
      all.filter((i) => {
        if (i.key === key && i.page) URL.revokeObjectURL(i.page.url)
        return i.key !== key
      }),
    )

  const done = items.filter((i) => i.page)
  const pending = items.some((i) => !i.page && !i.error)
  const finalBytes = done.reduce((n, i) => n + i.page!.blob.size, 0)
  const canSend = label.trim() && items.length > 0 && !pending && done.length === items.length && progress === null

  const send = async () => {
    setProgress(0)
    try {
      const r = await uploadScore({ songId, label: label.trim(), instrument, pages: done.map((i) => i.page!) }, setProgress)
      toast(`Partitura enviada: ${r.pages} ${r.pages === 1 ? 'página' : 'páginas'}, ${formatBytes(r.totalBytes)}.`)
      onDone()
      onClose()
    } catch (e) {
      toast((e as Error).message, 'error')
      setProgress(null)
    }
  }

  const setLabelAndGuess = (v: string) => {
    setLabel(v)
    if (!instrumentTouched) setInstrument(guessInstrument(v))
  }

  return (
    <Sheet open={open} onClose={onClose} title="Anexar partitura" wide>
      <div className="space-y-5">
        <div>
          <label className="block">
            <span className="label">Qual parte é esta?</span>
            <input className="input" value={label} onChange={(e) => setLabelAndGuess(e.target.value)} maxLength={80} placeholder="Ex.: Piano, Sax alto (Mi♭), Grade" />
          </label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {LABELS.map((l) => (
              <button key={l} type="button" className={clsx('chip h-7 px-2.5 text-xs', label === l && 'chip-on')} onClick={() => setLabelAndGuess(l)}>
                {l}
              </button>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-muted">
            Abre direto para quem toca
            <select
              className="h-9 rounded-lg border border-border bg-surface-2 px-2 text-text"
              value={instrument ?? ''}
              onChange={(e) => {
                setInstrumentTouched(true)
                setInstrument((e.target.value || null) as Instrument | null)
              }}
            >
              <option value="">qualquer instrumento</option>
              {Object.entries(INSTRUMENTS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn-ghost h-auto flex-col gap-1 py-4" onClick={() => fileInput.current?.click()} disabled={reading}>
            {reading ? <Loader2 className="size-6 animate-spin" /> : <FileUp className="size-6 text-accent" />}
            <span>PDF, fotos ou Guitar Pro</span>
          </button>
          <button type="button" className="btn-ghost h-auto flex-col gap-1 py-4" onClick={() => cameraInput.current?.click()} disabled={reading}>
            <Camera className="size-6 text-accent" />
            <span>Tirar foto</span>
          </button>
          <input ref={fileInput} type="file" accept="application/pdf,image/*,.gp,.gp3,.gp4,.gp5,.gpx" multiple hidden onChange={(e) => (addFiles(e.target.files), (e.target.value = ''))} />
          <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => (addFiles(e.target.files), (e.target.value = ''))} />
        </div>

        {items.length > 0 && (
          <>
            <ol className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {items.map((it, i) => (
                <li key={it.key} className="relative overflow-hidden rounded-lg border border-border bg-white">
                  <div className="grid aspect-[3/4] place-items-center">
                    {it.page ? (
                      <img src={it.page.url} alt={`Página ${i + 1}`} className="size-full object-contain" />
                    ) : it.error ? (
                      <p className="p-2 text-center text-xs text-danger">{it.error}</p>
                    ) : (
                      <Loader2 className="size-5 animate-spin text-neutral-400" />
                    )}
                  </div>
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/60 px-1.5 py-1 text-xs text-white">
                    <span className="font-semibold">{i + 1}</span>
                    {it.page && <span className="opacity-80">{formatBytes(it.page.blob.size)}</span>}
                    <span className="flex">
                      <button type="button" className="grid size-7 place-items-center" onClick={() => rotate(it.key)} aria-label={`Girar a página ${i + 1}`}>
                        <RotateCw className="size-3.5" />
                      </button>
                      <button type="button" className="grid size-7 place-items-center" onClick={() => remove(it.key)} aria-label={`Tirar a página ${i + 1}`}>
                        <Trash2 className="size-3.5" />
                      </button>
                    </span>
                  </div>
                </li>
              ))}
            </ol>
            <p className="flex items-start gap-2 rounded-xl bg-ok/10 px-3 py-2 text-sm">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-ok" />
              {pending ? (
                <span>Convertendo as páginas ({done.length} de {items.length})… o arquivo original não é enviado.</span>
              ) : (
                <span>
                  {items.length} {items.length === 1 ? 'página' : 'páginas'} · original <b>{formatBytes(originalBytes)}</b> → <b>{formatBytes(finalBytes)}</b>
                  {originalBytes > finalBytes && <> ({Math.round((1 - finalBytes / originalBytes) * 100)}% menor)</>}. Só esta versão leve vai para o
                  servidor.
                </span>
              )}
            </p>
          </>
        )}

        {progress !== null && (
          <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(progress * 100)}>
            <div className="h-full bg-accent transition-[width]" style={{ width: `${Math.max(4, progress * 100)}%` }} />
          </div>
        )}

        <button className="btn-primary w-full" onClick={send} disabled={!canSend}>
          {progress !== null ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {progress !== null ? 'Enviando…' : 'Enviar partitura'}
        </button>
        <p className="text-xs text-muted">
          Dica para foto: papel numa mesa, boa luz, o celular reto em cima da folha. O app tira a sombra e deixa as notas mais nítidas.
        </p>
      </div>
    </Sheet>
  )
}
