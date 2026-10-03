import {
  guessKey,
  isChord,
  LICENSES,
  MAJOR_KEYS,
  MINOR_KEYS,
  PUBLIC_LICENSES,
  TIME_SIGNATURES,
  VISIBILITY,
  youtubeId,
  type License,
  type Visibility,
} from '@ensaio/shared'
import clsx from 'clsx'
import { ArrowLeft, Eye, HelpCircle, Save, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { ChordSheet, useSheet } from '../components/ChordSheet'
import { FindLinks } from '../components/FindLinks'
import { MetadataLookup } from '../components/MetadataLookup'
import { ErrorState, PageSpinner, useToast } from '../components/ui'
import { useDeleteSong, useFacets, useSaveSong, useSong } from '../lib/queries'
import type { SongInput } from '../lib/types'

const EMPTY: SongInput = {
  title: '',
  artist: null,
  composer: null,
  originalKey: null,
  bpm: null,
  timeSignature: '4/4',
  style: null,
  notes: null,
  tags: [],
  content: '',
  lyricsAuthorized: true,
  visibility: 'private',
  license: 'unknown',
  referenceUrl: null,
}

const PLACEHOLDER = `[Intro] G  D  Em  C

[Verso]
G              D
Escreva a letra aqui
Em             C
Com os acordes na linha de cima

[Refrão]
C       G       D
Seções entre colchetes`

export function SongEditor() {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const toast = useToast()
  const { data: song, isLoading, error } = useSong(id)
  const { data: facets } = useFacets()
  const save = useSaveSong(id)
  const del = useDeleteSong()

  // Rascunho vindo da detecção de acordes (ou de outra tela): já começa preenchido.
  const draft = (useLocation().state as { draft?: Partial<SongInput> } | null)?.draft
  const [form, setForm] = useState<SongInput>(() => (draft && !id ? { ...EMPTY, ...draft } : EMPTY))
  const [tagsText, setTagsText] = useState('')
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')
  const [fieldError, setFieldError] = useState<string | null>(null)

  useEffect(() => {
    if (!song) return
    const { title, artist, composer, originalKey, bpm, timeSignature, style, notes, tags, content, lyricsAuthorized, visibility, license, referenceUrl } = song
    setForm({ title, artist, composer, originalKey, bpm, timeSignature, style, notes, tags, content, lyricsAuthorized, visibility, license, referenceUrl })
    setTagsText(tags.join(', '))
  }, [song])

  const set = <K extends keyof SongInput>(k: K, v: SongInput[K]) => setForm((f) => ({ ...f, [k]: v }))
  const detectedKey = guessKey(form.content)
  const previewKey = form.originalKey ?? detectedKey
  const lines = useSheet(form.content, 0, previewKey)

  if (editing && isLoading) return <PageSpinner />
  if (editing && (error || !song)) return <ErrorState error={error ?? new Error('Música não encontrada.')} />
  if (editing && song && !song.canEdit) return <ErrorState error={new Error('Só quem cadastrou a música pode editá-la.')} />

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setFieldError(null)
    if (!form.title.trim()) {
      setFieldError('Informe o título da música.')
      return
    }
    if (form.visibility === 'public' && !PUBLIC_LICENSES.includes(form.license)) {
      setFieldError('Para deixar a música pública, informe a licença (própria, domínio público ou licenciada).')
      return
    }
    if (form.originalKey && !isChord(form.originalKey)) {
      setFieldError('Tom original inválido.')
      return
    }
    const tags = tagsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    const clean = (v: string | null) => (v && v.trim() ? v.trim() : null)
    save.mutate(
      {
        ...form,
        title: form.title.trim(),
        artist: clean(form.artist),
        composer: clean(form.composer),
        style: clean(form.style),
        notes: clean(form.notes),
        tags,
      },
      {
        onSuccess: (res) => {
          toast(editing ? 'Música atualizada.' : 'Música cadastrada.')
          navigate(`/musicas/${res.id}`, { replace: true })
        },
        onError: (err) => setFieldError(err.message),
      },
    )
  }

  const remove = () => {
    if (!id || !confirm('Excluir esta música? Esta ação não pode ser desfeita.')) return
    del.mutate(id, {
      onSuccess: () => {
        toast('Música excluída.')
        navigate('/musicas', { replace: true })
      },
      onError: (err) => toast(err.message, 'error'),
    })
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <div className="flex items-center gap-2">
        <Link to={editing ? `/musicas/${id}` : '/musicas'} className="btn-icon border-transparent bg-transparent" aria-label="Voltar">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="flex-1 text-xl sm:text-2xl font-bold">{editing ? 'Editar música' : 'Nova música'}</h1>
      </div>

      <section className="card grid gap-4 p-4 md:grid-cols-2 md:p-5">
        <div className="md:col-span-2">
          <Field label="Título *">
            <input className="input" value={form.title} onChange={(e) => set('title', e.target.value)} autoFocus={!editing} maxLength={200} />
          </Field>
          <div className="mt-1.5">
            <MetadataLookup
              title={form.title}
              artist={form.artist}
              onPick={(d) =>
                setForm((f) => ({
                  ...f,
                  artist: d.artist ?? f.artist,
                  composer: d.composer ?? f.composer,
                }))
              }
            />
          </div>
        </div>
        <Field label="Artista">
          <input className="input" value={form.artist ?? ''} onChange={(e) => set('artist', e.target.value)} maxLength={200} />
        </Field>
        <Field label="Compositor">
          <input className="input" value={form.composer ?? ''} onChange={(e) => set('composer', e.target.value)} maxLength={200} />
        </Field>
        <Field label="Tom original">
          <select className="input" value={form.originalKey ?? ''} onChange={(e) => set('originalKey', e.target.value || null)}>
            <option value="">{detectedKey ? `Detectar pela cifra (${detectedKey})` : 'Detectar pela cifra'}</option>
            <optgroup label="Maiores">
              {MAJOR_KEYS.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </optgroup>
            <optgroup label="Menores">
              {MINOR_KEYS.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </optgroup>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="BPM">
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={20}
              max={320}
              value={form.bpm ?? ''}
              onChange={(e) => set('bpm', e.target.value ? Math.round(Number(e.target.value)) : null)}
            />
          </Field>
          <Field label="Compasso">
            <select className="input" value={form.timeSignature ?? ''} onChange={(e) => set('timeSignature', e.target.value || null)}>
              <option value="">—</option>
              {TIME_SIGNATURES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Estilo">
          <input
            className="input"
            list="styles"
            value={form.style ?? ''}
            onChange={(e) => set('style', e.target.value)}
            placeholder="Louvor, Forró, Pop rock..."
          />
          <datalist id="styles">
            {facets?.styles.map((s) => <option key={s} value={s} />)}
          </datalist>
        </Field>
        <Field label="Tags (separadas por vírgula)">
          <input className="input" value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="abertura, lenta, ceia" />
        </Field>
        <Field label="Gravação de referência (link do YouTube)" className="md:col-span-2">
          <input
            className="input"
            type="url"
            inputMode="url"
            value={form.referenceUrl ?? ''}
            onChange={(e) => set('referenceUrl', e.target.value.trim() || null)}
            placeholder="https://www.youtube.com/watch?v=..."
          />
          {form.referenceUrl && !youtubeId(form.referenceUrl) && (
            <span className="mt-1 block text-xs text-danger">Use um link do YouTube (youtube.com ou youtu.be).</span>
          )}
        </Field>
        <Field label="Observações de execução" className="md:col-span-2">
          <textarea
            className="input h-20 py-2"
            value={form.notes ?? ''}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Ex.: começar só com violão; banda entra no refrão."
          />
        </Field>
      </section>

      <section className="card p-4 md:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-semibold">Cifra</h2>
          <div className="flex rounded-xl border border-border p-1" role="tablist">
            {(['edit', 'preview'] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={clsx('h-8 rounded-lg px-3 text-sm font-medium', tab === t ? 'bg-surface-2 text-text' : 'text-muted')}
              >
                {t === 'edit' ? 'Editar' : (
                  <span className="inline-flex items-center gap-1.5">
                    <Eye className="size-4" /> Ver
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
        {tab === 'edit' ? (
          <>
            <textarea
              className="sheet input min-h-[22rem] resize-y py-3 text-[15px] leading-relaxed"
              value={form.content}
              onChange={(e) => set('content', e.target.value)}
              placeholder={PLACEHOLDER}
              spellCheck={false}
              wrap="off"
            />
            <p className="mt-2 flex gap-2 text-xs text-muted">
              <HelpCircle className="size-4 shrink-0" />
              Escreva os acordes na linha de cima da letra. Seções entre colchetes: [Intro], [Verso], [Pré-refrão], [Refrão],
              [Ponte], [Solo], [Final]. Pode colar cifras de outros sites.
            </p>
            {form.title.trim() && !form.content.trim() && (
              <div className="mt-3 rounded-xl bg-surface-2 p-3">
                <p className="mb-2 text-xs text-muted">Procurar a cifra desta música (abre o site em outra aba):</p>
                <FindLinks song={{ title: form.title, artist: form.artist }} compact />
              </div>
            )}
          </>
        ) : form.content.trim() ? (
          <div className="rounded-xl bg-bg p-4">
            <ChordSheet lines={lines} fontSize={15} lineHeight={1.45} wrap />
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-muted">Nada para visualizar ainda.</p>
        )}
      </section>

      <section className="card space-y-4 p-4 md:p-5">
        <div>
          <p className="label">Quem pode ver</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(VISIBILITY) as Visibility[]).map((v) => (
              <button
                key={v}
                type="button"
                className={clsx('chip', form.visibility === v && 'chip-on')}
                onClick={() => set('visibility', v)}
                aria-pressed={form.visibility === v}
              >
                {VISIBILITY[v]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            {form.visibility === 'private' && 'Só você vê.'}
            {form.visibility === 'shared' && 'Você e os músicos dos repertórios em que ela estiver.'}
            {form.visibility === 'public' && 'Qualquer usuário do Ensaio Fácil pode encontrar e usar.'}
          </p>
        </div>
        <label className="block">
          <span className="label">Licença</span>
          <select className="input" value={form.license} onChange={(e) => set('license', e.target.value as License)}>
            {(Object.keys(LICENSES) as License[]).map((l) => (
              <option key={l} value={l}>
                {LICENSES[l]}
              </option>
            ))}
          </select>
          {form.visibility === 'public' && !PUBLIC_LICENSES.includes(form.license) && (
            <span className="mt-1 block text-xs text-danger">Obrigatória para músicas públicas.</span>
          )}
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]"
            checked={form.lyricsAuthorized}
            onChange={(e) => set('lyricsAuthorized', e.target.checked)}
          />
          <span>
            Tenho autorização para exibir a letra
            <span className="block text-xs text-muted">
              Música própria, de domínio público ou com licença. Sem isso, outras pessoas veem só os acordes.
            </span>
          </span>
        </label>
      </section>

      {fieldError && (
        <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {fieldError}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        {editing ? (
          <button type="button" className="btn-ghost text-danger" onClick={remove} disabled={del.isPending}>
            <Trash2 className="size-4" /> Excluir
          </button>
        ) : (
          <span />
        )}
        <button type="submit" className="btn-primary sm:min-w-44" disabled={save.isPending}>
          <Save className="size-4" /> {save.isPending ? 'Salvando...' : 'Salvar música'}
        </button>
      </div>
    </form>
  )
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={clsx('block', className)}>
      <span className="label">{label}</span>
      {children}
    </label>
  )
}
