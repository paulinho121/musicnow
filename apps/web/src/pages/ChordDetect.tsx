import { analysisToChart, mainProgression, type AudioAnalysis, type ChordSegment } from '@ensaio/shared'
import clsx from 'clsx'
import { ArrowLeft, AudioLines, Copy, FileAudio, Mic, PenLine, ShieldCheck, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useToast } from '../components/ui'
import { analyzeInWorker, decodeToMono, MAX_SECONDS, startRecording } from '../lib/audioInput'

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const MAX_RECORD = 5 * 60
const MAX_FILE_MB = 60

type Phase = { step: 'idle' } | { step: 'recording'; since: number } | { step: 'working'; label: string; p: number } | { step: 'done' }

/** Protótipo: detecta acordes, tom e BPM de uma gravação, no próprio aparelho. */
export function ChordDetect() {
  const toast = useToast()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const recRef = useRef<Awaited<ReturnType<typeof startRecording>> | null>(null)
  const [phase, setPhase] = useState<Phase>({ step: 'idle' })
  const [result, setResult] = useState<AudioAnalysis | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [sourceName, setSourceName] = useState('')
  const [now, setNow] = useState(0)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => () => {
    recRef.current?.cancel()
    if (audioUrl) URL.revokeObjectURL(audioUrl)
  }, [audioUrl])

  // Cronômetro da gravação, com parada automática no limite.
  useEffect(() => {
    if (phase.step !== 'recording') return
    const t = setInterval(() => {
      const s = (Date.now() - phase.since) / 1000
      setElapsed(s)
      if (s >= MAX_RECORD) void stopRecording()
    }, 250)
    return () => clearInterval(t)
    // Só a fase importa; stopRecording lê o gravador atual pela ref.
  }, [phase])

  const analyze = async (blob: Blob, name: string) => {
    setResult(null)
    setSourceName(name)
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioUrl(URL.createObjectURL(blob))
    try {
      setPhase({ step: 'working', label: 'Lendo o áudio...', p: 0 })
      const { samples, duration } = await decodeToMono(await blob.arrayBuffer())
      if (duration > MAX_SECONDS) toast(`Analisando só os primeiros ${MAX_SECONDS / 60} minutos.`)
      if (duration < 8) throw new Error('Gravação muito curta: use pelo menos 10 segundos de música.')
      setPhase({ step: 'working', label: 'Ouvindo os acordes...', p: 0.05 })
      const r = await analyzeInWorker(samples, (p) => setPhase({ step: 'working', label: p < 0.85 ? 'Ouvindo os acordes...' : 'Calculando tom e andamento...', p }))
      if (!r.segments.some((s) => s.chord !== 'N')) throw new Error('Não foi possível ouvir acordes nesta gravação. Tente com o som mais alto ou mais perto do instrumento.')
      setResult(r)
      setPhase({ step: 'done' })
    } catch (e) {
      toast((e as Error).message, 'error')
      setPhase({ step: 'idle' })
    }
  }

  const onFile = (file: File | undefined) => {
    if (!file) return
    if (file.size > MAX_FILE_MB * 1024 * 1024) return toast(`Arquivo maior que ${MAX_FILE_MB} MB.`, 'error')
    void analyze(file, file.name)
  }

  const record = async () => {
    try {
      recRef.current = await startRecording()
      setElapsed(0)
      setPhase({ step: 'recording', since: Date.now() })
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  const stopRecording = async () => {
    const rec = recRef.current
    recRef.current = null
    if (!rec) return
    const blob = await rec.stop()
    void analyze(blob, 'Gravação pelo microfone')
  }

  const chords = result?.segments.filter((s) => s.chord !== 'N') ?? []
  const loop = result ? mainProgression(result.segments) : null
  const current = chords.find((s) => now >= s.start && now < s.end)

  const toEditor = () => {
    if (!result) return
    navigate('/musicas/nova', {
      state: {
        draft: {
          content: analysisToChart(result) + '\n\n[Verso]\n(cole ou escreva a letra aqui e posicione os acordes)',
          originalKey: result.key,
          bpm: result.bpm,
          notes: `Acordes detectados automaticamente${loop ? ` (sequência principal: ${loop.join(' – ')})` : ''}. Revise antes de tocar.`,
        },
      },
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link to="/musicas/importar" className="btn-icon border-transparent bg-transparent" aria-label="Voltar">
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            Detectar acordes <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-xs font-semibold text-accent">beta</span>
          </h1>
          <p className="text-sm text-muted">O app ouve uma gravação e sugere acordes, tom e BPM.</p>
        </div>
      </div>

      {phase.step === 'recording' ? (
        <div className="card flex flex-col items-center gap-4 p-8 text-center">
          <span className="relative flex size-16 items-center justify-center">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-danger/40" />
            <span className="relative grid size-16 place-items-center rounded-full bg-danger">
              <Mic className="size-7 text-white" />
            </span>
          </span>
          <p className="font-mono text-3xl font-bold">{fmtTime(elapsed)}</p>
          <p className="text-sm text-muted">Toque a música perto do celular. Mínimo de 20 segundos; para sozinho em {MAX_RECORD / 60} min.</p>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={stopRecording} disabled={elapsed < 8}>
              <Square className="size-4" /> Parar e analisar
            </button>
            <button
              className="btn-ghost"
              onClick={() => {
                recRef.current?.cancel()
                recRef.current = null
                setPhase({ step: 'idle' })
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : phase.step === 'working' ? (
        <div className="card space-y-3 p-8 text-center">
          <AudioLines className="mx-auto size-10 animate-pulse text-accent" />
          <p className="font-semibold">{phase.label}</p>
          <div className="mx-auto h-2 max-w-sm overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${Math.round(phase.p * 100)}%` }} />
          </div>
          <p className="text-xs text-muted">{sourceName}</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <button className="card flex min-h-36 flex-col items-center justify-center gap-2 p-6 text-center transition hover:border-accent/50" onClick={() => fileRef.current?.click()}>
            <FileAudio className="size-8 text-accent" />
            <span className="font-semibold">Escolher arquivo de áudio</span>
            <span className="text-xs text-muted">MP3, M4A, WAV, OGG · até {MAX_FILE_MB} MB · até {MAX_SECONDS / 60} min</span>
          </button>
          <button className="card flex min-h-36 flex-col items-center justify-center gap-2 p-6 text-center transition hover:border-accent/50" onClick={record}>
            <Mic className="size-8 text-accent" />
            <span className="font-semibold">Gravar pelo microfone</span>
            <span className="text-xs text-muted">Toque ou cante perto do celular</span>
          </button>
          <input ref={fileRef} type="file" accept="audio/*,video/mp4,video/webm" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
      )}

      {result && phase.step === 'done' && (
        <>
          <section className="grid grid-cols-3 gap-3">
            <Stat label="Tom" value={result.key ?? '—'} mono />
            <Stat label="BPM" value={result.bpm ? String(result.bpm) : '—'} mono />
            <Stat label="Duração" value={fmtTime(result.duration)} mono />
          </section>

          {loop && (
            <section className="card p-4">
              <p className="mb-2 text-sm text-muted">Sequência principal</p>
              <p className="font-mono text-2xl font-bold tracking-wide text-chord">{loop.join('  ')}</p>
            </section>
          )}

          <section className="card space-y-3 p-4">
            {audioUrl && (
              <audio ref={audioRef} src={audioUrl} controls className="w-full" onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)} />
            )}
            <p className="text-xs text-muted">Dê play: o acorde do momento acende. Toque num acorde para ir até ele.</p>
            <div className="flex max-h-72 flex-wrap gap-1.5 overflow-y-auto">
              {chords.map((s) => (
                <ChordChip
                  key={s.start}
                  seg={s}
                  active={s === current}
                  onClick={() => {
                    if (!audioRef.current) return
                    audioRef.current.currentTime = s.start
                    void audioRef.current.play()
                  }}
                />
              ))}
            </div>
          </section>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button className="btn-primary" onClick={toEditor}>
              <PenLine className="size-4" /> Criar música com estes acordes
            </button>
            <button
              className="btn-ghost"
              onClick={async () => {
                await navigator.clipboard.writeText(analysisToChart(result))
                toast('Acordes copiados.')
              }}
            >
              <Copy className="size-4" /> Copiar acordes
            </button>
            <button className="btn-ghost" onClick={() => setPhase({ step: 'idle' })}>
              Analisar outra
            </button>
          </div>
        </>
      )}

      <section className="space-y-2 rounded-2xl bg-surface-2 p-4 text-sm text-muted">
        <p className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ok" />
          O áudio é analisado no seu aparelho e não é enviado para nenhum servidor.
        </p>
        <p>
          <b className="text-text">É um rascunho:</b> funciona melhor com voz e violão ou teclado e acordes simples. Acordes com extensões (7M,
          7(9)...), muitos instrumentos ou distorção confundem a detecção. Use gravações suas ou que você tenha direito de usar.
        </p>
      </section>
    </div>
  )
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="card p-3 text-center">
      <p className="text-xs text-muted">{label}</p>
      <p className={clsx('text-xl font-bold', mono && 'font-mono text-chord')}>{value}</p>
    </div>
  )
}

function ChordChip({ seg, active, onClick }: { seg: ChordSegment; active: boolean; onClick: () => void }) {
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [active])
  return (
    <button
      ref={ref}
      onClick={onClick}
      title={`${fmtTime(seg.start)} · confiança ${Math.round(seg.confidence * 100)}%`}
      className={clsx(
        'flex min-w-14 flex-col items-center rounded-lg border px-2 py-1 font-mono transition',
        active ? 'scale-105 border-accent bg-accent text-accent-ink' : 'border-border bg-surface hover:border-accent/50',
        !active && seg.confidence < 0.55 && 'opacity-60',
      )}
    >
      <span className="text-base font-bold">{seg.chord}</span>
      <span className={clsx('text-[10px]', active ? 'text-accent-ink/70' : 'text-muted')}>{fmtTime(seg.start)}</span>
    </button>
  )
}
