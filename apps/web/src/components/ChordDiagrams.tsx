import { GUITAR_TUNING, type Voicing } from '@ensaio/shared'

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
const noteName = (midi: number, flats: boolean) => (flats ? FLATS : SHARPS)[midi % 12]

/**
 * Desenho do acorde no braço do violão, como nas revistinhas de cifra:
 * cordas na vertical (6ª à esquerda), casas na horizontal, X = não tocar, O = solta.
 */
export function GuitarDiagram({
  voicing,
  flats = false,
  showNotes = true,
  className,
}: {
  voicing: Voicing
  flats?: boolean
  showNotes?: boolean
  className?: string
}) {
  const ROWS = 5
  const left = 26
  const top = 26
  const gap = 18
  const rowH = 22
  const strings = voicing.frets.length
  const x = (s: number) => left + s * gap
  const width = left + (strings - 1) * gap + 14
  const bottom = top + ROWS * rowH
  const height = bottom + (showNotes ? 20 : 6)
  const rowOf = (fret: number) => fret - voicing.baseFret // 0 = primeira casa desenhada
  const y = (fret: number) => top + (rowOf(fret) + 0.5) * rowH
  const label = voicing.frets.map((f) => (f < 0 ? 'x' : String(f))).join(' ')

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} role="img" aria-label={`Violão: ${label}`}>
      {/* casas */}
      {Array.from({ length: ROWS + 1 }, (_, r) => (
        <line key={r} x1={x(0)} x2={x(strings - 1)} y1={top + r * rowH} y2={top + r * rowH} stroke="var(--border)" strokeWidth={1.5} />
      ))}
      {/* pestana do braço (só quando o desenho começa na 1ª casa) */}
      {voicing.baseFret === 1 && <rect x={x(0) - 1} y={top - 4} width={x(strings - 1) - x(0) + 2} height={5} rx={1.5} fill="var(--text)" />}
      {voicing.baseFret > 1 && (
        <text x={x(0) - 9} y={y(voicing.baseFret) + 4} textAnchor="end" fontSize={11} fontWeight={700} fill="var(--muted)">
          {voicing.baseFret}ª
        </text>
      )}
      {/* cordas: as graves um pouco mais grossas */}
      {voicing.frets.map((_, s) => (
        <line key={s} x1={x(s)} x2={x(s)} y1={top} y2={bottom} stroke="var(--muted)" strokeWidth={1.8 - s * 0.18} />
      ))}
      {/* X / O em cima */}
      {voicing.frets.map((f, s) =>
        f < 0 ? (
          <g key={s} stroke="var(--muted)" strokeWidth={1.6} strokeLinecap="round">
            <line x1={x(s) - 4} x2={x(s) + 4} y1={top - 18} y2={top - 10} />
            <line x1={x(s) + 4} x2={x(s) - 4} y1={top - 18} y2={top - 10} />
          </g>
        ) : f === 0 ? (
          <circle key={s} cx={x(s)} cy={top - 14} r={4.2} fill="none" stroke="var(--text)" strokeWidth={1.6} />
        ) : null,
      )}
      {/* pestana */}
      {voicing.barre && (
        <rect
          x={x(voicing.barre.from) - 7}
          y={y(voicing.barre.fret) - 7}
          width={x(voicing.barre.to) - x(voicing.barre.from) + 14}
          height={14}
          rx={7}
          fill="var(--accent)"
        />
      )}
      {/* dedos */}
      {voicing.frets.map((f, s) =>
        f > 0 && !(voicing.barre && f === voicing.barre.fret && s >= voicing.barre.from) ? (
          <circle key={s} cx={x(s)} cy={y(f)} r={7} fill="var(--accent)" />
        ) : null,
      )}
      {/* nota de cada corda */}
      {showNotes &&
        voicing.frets.map((f, s) =>
          f < 0 ? null : (
            <text key={s} x={x(s)} y={bottom + 15} textAnchor="middle" fontSize={9.5} fontWeight={600} fill="var(--muted)">
              {noteName(GUITAR_TUNING[s] + f, flats)}
            </text>
          ),
        )}
    </svg>
  )
}

const WHITE = [0, 2, 4, 5, 7, 9, 11]
const BLACK_AFTER: Record<number, number> = { 1: 0, 3: 1, 6: 3, 8: 4, 10: 5 } // tecla preta → branca à esquerda

/** Teclado de duas oitavas (ou mais) com as notas do acorde destacadas. */
export function PianoDiagram({ notes, flats = false, className }: { notes: number[]; flats?: boolean; className?: string }) {
  if (notes.length === 0) return null
  const lowC = Math.floor(Math.min(...notes) / 12) * 12
  const octaves = Math.max(2, Math.ceil((Math.max(...notes) - lowC + 1) / 12))
  const W = 18
  const H = 78
  const BW = 11
  const BH = 48
  const on = new Set(notes)
  const whites: { midi: number; i: number }[] = []
  const blacks: { midi: number; x: number }[] = []
  for (let o = 0; o < octaves; o++) {
    WHITE.forEach((pc, k) => whites.push({ midi: lowC + o * 12 + pc, i: o * 7 + k }))
    for (const [pc, k] of Object.entries(BLACK_AFTER)) blacks.push({ midi: lowC + o * 12 + Number(pc), x: (o * 7 + k + 1) * W - BW / 2 })
  }
  const width = whites.length * W + 2
  return (
    <svg viewBox={`0 0 ${width} ${H + 18}`} className={className} role="img" aria-label={`Teclado: ${notes.map((n) => noteName(n, flats)).join(', ')}`}>
      {whites.map((k) => (
        <g key={k.midi}>
          <rect x={1 + k.i * W} y={1} width={W} height={H} rx={2.5} fill={on.has(k.midi) ? 'var(--accent)' : '#f4f4f5'} stroke="var(--border)" />
          {on.has(k.midi) && (
            <text x={1 + k.i * W + W / 2} y={H + 14} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="var(--text)">
              {noteName(k.midi, flats)}
            </text>
          )}
        </g>
      ))}
      {blacks.map((k) => (
        <g key={k.midi}>
          <rect x={1 + k.x} y={1} width={BW} height={BH} rx={2} fill={on.has(k.midi) ? 'var(--accent)' : '#1c1c22'} stroke={on.has(k.midi) ? '#1c1c22' : 'none'} />
          {on.has(k.midi) && (
            <text x={1 + k.x + BW / 2} y={H + 14} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="var(--text)">
              {noteName(k.midi, flats)}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}

// ---------------------------------------------------------------- som

let ctx: AudioContext | null = null

/** Toca as notas (MIDI) como um violão dedilhado rápido — só para conferir o som. */
export function playNotes(midis: number[], strum = 0.045) {
  try {
    ctx ??= new AudioContext()
    void ctx.resume()
    const now = ctx.currentTime + 0.02
    const master = ctx.createGain()
    master.gain.value = 0.6 / Math.sqrt(midis.length)
    master.connect(ctx.destination)
    midis.forEach((m, i) => {
      const t = now + i * strum
      const osc = ctx!.createOscillator()
      const env = ctx!.createGain()
      osc.type = 'triangle'
      osc.frequency.value = 440 * 2 ** ((m - 69) / 12)
      env.gain.setValueAtTime(0, t)
      env.gain.linearRampToValueAtTime(1, t + 0.008)
      env.gain.exponentialRampToValueAtTime(0.001, t + 2.2)
      osc.connect(env).connect(master)
      osc.start(t)
      osc.stop(t + 2.3)
    })
  } catch {
    // Sem áudio no navegador: o desenho continua valendo.
  }
}
