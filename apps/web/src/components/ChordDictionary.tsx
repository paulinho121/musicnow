import { chordInfo, GUITAR_TUNING, guitarVoicings, isChord, keyboardNotes, noteNamePt, parseChord } from '@ensaio/shared'
import clsx from 'clsx'
import { Check, ChevronLeft, ChevronRight, Guitar, Loader2, PencilLine, Piano, Volume2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLocalState } from '../lib/storage'
import { GuitarDiagram, PianoDiagram, playNotes } from './ChordDiagrams'
import { Sheet } from './Sheet'

type Instrument = 'violao' | 'teclado'

/** Nome por extenso: "Fá sustenido menor, com sétima (baixo em Lá)". */
export function chordFullName(symbol: string) {
  const info = chordInfo(symbol)
  if (!info) return null
  const name = `${noteNamePt(info.notes[0])} ${info.quality}`
  return info.bassNote ? `${name}, com baixo em ${noteNamePt(info.bassNote)}` : name
}

/** Tudo sobre um acorde: nome, notas e como montar no violão e no teclado. */
export function ChordDetails({ symbol }: { symbol: string }) {
  const [prefs, setPrefs] = useLocalState('ef-chords', { instrument: 'violao' as Instrument })
  const info = useMemo(() => chordInfo(symbol), [symbol])
  const voicings = useMemo(() => guitarVoicings(symbol, 8), [symbol])
  const keys = useMemo(() => keyboardNotes(symbol), [symbol])
  const [pos, setPos] = useState(0)
  useEffect(() => setPos(0), [symbol])

  if (!info) {
    return <p className="py-6 text-center text-sm text-muted">Não reconhecemos “{symbol}” como acorde.</p>
  }
  const flats = info.notes.some((n) => n.includes('b'))
  const v = voicings[Math.min(pos, voicings.length - 1)]
  const play = () =>
    prefs.instrument === 'violao' && v
      ? playNotes(v.frets.flatMap((f, s) => (f < 0 ? [] : [GUITAR_TUNING[s] + f])))
      : playNotes(keys, 0.012)

  return (
    <div className="space-y-4">
      <div>
        <p className="font-mono text-3xl font-bold text-chord">{info.symbol}</p>
        <p className="text-sm text-muted">{chordFullName(symbol)}</p>
        <p className="mt-2 flex flex-wrap gap-1.5">
          {info.notes.map((n, i) => (
            <span key={n} className={clsx('rounded-lg border px-2 py-0.5 text-sm', i === 0 ? 'border-accent/50 bg-accent/10 font-semibold' : 'border-border')}>
              {n} <span className="text-xs text-muted">· {noteNamePt(n)}</span>
            </span>
          ))}
        </p>
      </div>

      <div className="flex gap-2">
        {(
          [
            ['violao', 'Violão', Guitar],
            ['teclado', 'Teclado', Piano],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            className={clsx('chip h-9', prefs.instrument === id && 'chip-on')}
            aria-pressed={prefs.instrument === id}
            onClick={() => setPrefs({ instrument: id })}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
        <button className="chip ml-auto h-9 max-[380px]:px-3" onClick={play} aria-label="Ouvir o acorde">
          <Volume2 className="size-4" /> <span className="max-[380px]:sr-only">Ouvir</span>
        </button>
      </div>

      {prefs.instrument === 'violao' ? (
        v ? (
          <div className="flex flex-col items-center gap-2">
            <GuitarDiagram voicing={v} flats={flats} className="h-56 w-auto" />
            {voicings.length > 1 && (
              <div className="flex items-center gap-3">
                <button className="btn-icon size-9" onClick={() => setPos((p) => (p - 1 + voicings.length) % voicings.length)} aria-label="Posição anterior">
                  <ChevronLeft className="size-4" />
                </button>
                <span className="min-w-28 text-center text-sm text-muted">
                  Posição {pos + 1} de {voicings.length}
                </span>
                <button className="btn-icon size-9" onClick={() => setPos((p) => (p + 1) % voicings.length)} aria-label="Próxima posição">
                  <ChevronRight className="size-4" />
                </button>
              </div>
            )}
            <p className="text-center text-xs text-muted">
              Cordas da 6ª (Mi grave, à esquerda) à 1ª. <b>X</b> = não tocar · <b>O</b> = corda solta
              {v.barre && ' · faixa = pestana'}
            </p>
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted">Não achamos uma posição confortável para este acorde no violão.</p>
        )
      ) : (
        <div className="space-y-2">
          <PianoDiagram notes={keys} flats={flats} className="w-full" />
          <p className="text-center text-xs text-muted">
            {info.bassNote ? `Mão esquerda: ${info.bassNote} no baixo. ` : ''}Posição fundamental, a partir do Dó central.
          </p>
        </div>
      )}
    </div>
  )
}

export type ChordFixScope = 'here' | 'all'

/** Atalhos de correção: baixo na 3ª/5ª, nona, sétima... (o resto, a pessoa digita). */
function chordVariants(symbol: string): { label: string; value: string }[] {
  const c = parseChord(symbol)
  const info = chordInfo(symbol)
  if (!c || !info) return []
  const bass = c.bass ? `/${c.bass}` : ''
  const out: { label: string; value: string }[] = []
  if (info.notes[1]) out.push({ label: 'Baixo na 3ª', value: `${c.root}${c.suffix}/${info.notes[1]}` })
  if (info.notes[2]) out.push({ label: 'Baixo na 5ª', value: `${c.root}${c.suffix}/${info.notes[2]}` })
  if (c.bass) out.push({ label: 'Sem baixo', value: `${c.root}${c.suffix}` })
  if (!c.suffix.includes('9')) out.push({ label: '+ 9ª', value: `${c.root}${c.suffix}${/7/.test(c.suffix) ? '(9)' : '9'}${bass}` })
  if (!/7/.test(c.suffix)) {
    out.push({ label: '+ 7', value: `${c.root}${c.suffix}7${bass}` })
    out.push({ label: '+ 7M', value: `${c.root}${c.suffix}7M${bass}` })
  }
  const minor = /^m(?!aj)/.test(c.suffix)
  out.push({ label: minor ? 'Maior' : 'Menor', value: `${c.root}${minor ? c.suffix.slice(1) : `m${c.suffix}`}${bass}` })
  return out.filter((v) => v.value !== symbol && isChord(v.value))
}

/** Corrigir o acorde: atalhos ou outro nome, só aqui ou na música toda. */
function ChordFix({
  symbol,
  canHere,
  onSave,
  onCancel,
}: {
  symbol: string
  canHere: boolean
  onSave: (next: string, scope: ChordFixScope) => Promise<void>
  onCancel: () => void
}) {
  const [value, setValue] = useState(symbol)
  const [scope, setScope] = useState<ChordFixScope>(canHere ? 'here' : 'all')
  const [saving, setSaving] = useState(false)
  const next = value.trim()
  const valid = isChord(next)
  const variants = useMemo(() => chordVariants(symbol), [symbol])
  const save = async () => {
    setSaving(true)
    try {
      await onSave(next, scope)
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="space-y-3 rounded-2xl border border-accent/40 bg-accent/5 p-3">
      <p className="text-sm font-semibold">
        Corrigir <span className="font-mono text-chord">{symbol}</span>
      </p>
      {variants.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {variants.map((v) => (
            <button
              key={v.label}
              type="button"
              className={clsx('chip h-8 text-xs', next === v.value && 'chip-on')}
              onClick={() => setValue(v.value)}
              title={v.value}
            >
              {v.label} <span className="font-mono font-bold text-chord">{v.value}</span>
            </button>
          ))}
        </div>
      )}
      <label className="block">
        <span className="label">Acorde certo</span>
        <input
          className="input font-mono text-lg font-bold"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\s+/g, ''))}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          maxLength={16}
          placeholder="Ex.: C, Am/C, G7(9)"
        />
        {next && !valid && <span className="mt-1 block text-xs text-danger">Não reconhecemos “{next}” como acorde.</span>}
        {valid && next !== symbol && <span className="mt-1 block text-xs text-muted">{chordFullName(next)}</span>}
      </label>
      <div className="grid grid-cols-2 gap-1 rounded-xl border border-border p-1" role="radiogroup" aria-label="Onde trocar">
        {(
          [
            ['here', 'Só neste lugar'],
            ['all', `Todos os ${symbol}`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={scope === id}
            disabled={id === 'here' && !canHere}
            className={clsx(
              'h-9 truncate rounded-lg px-2 text-xs font-semibold disabled:opacity-40',
              scope === id ? 'bg-accent text-accent-ink' : 'text-muted hover:text-text',
            )}
            onClick={() => setScope(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn-primary flex-1" disabled={!valid || next === symbol || saving} onClick={save}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Salvar na cifra
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

/** Janela do dicionário: abre ao tocar num acorde da cifra. */
export function ChordDialog({
  symbol,
  onClose,
  related = [],
  onPick,
  fix,
}: {
  symbol: string | null
  onClose: () => void
  /** Outros acordes da música, para trocar sem fechar. */
  related?: string[]
  onPick?: (symbol: string) => void
  /** Quem cadastrou a música pode corrigir o acorde (canHere: veio de um lugar da cifra). */
  fix?: { canHere: boolean; onSave: (next: string, scope: ChordFixScope) => Promise<void> }
}) {
  const [fixing, setFixing] = useState(false)
  useEffect(() => setFixing(false), [symbol])
  return (
    <Sheet open={symbol !== null} onClose={onClose} title="Dicionário de acordes">
      {symbol && (
        <div className="space-y-4">
          {fix &&
            (fixing ? (
              <ChordFix key={symbol} symbol={symbol} canHere={fix.canHere} onSave={fix.onSave} onCancel={() => setFixing(false)} />
            ) : (
              <button type="button" className="chip h-9 w-full justify-center" onClick={() => setFixing(true)}>
                <PencilLine className="size-4 text-accent" /> Corrigir este acorde
              </button>
            ))}
          {related.length > 1 && onPick && (
            <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
              {related.map((c) => (
                <button
                  key={c}
                  className={clsx('chip h-8 shrink-0 font-mono text-sm font-bold', c === symbol && 'chip-on')}
                  onClick={() => onPick(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
          <ChordDetails symbol={symbol} />
        </div>
      )}
    </Sheet>
  )
}
