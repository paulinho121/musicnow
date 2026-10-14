import clsx from 'clsx'
import { Archive, Check, Copy, ExternalLink, Globe, Inbox, MessageCircle, Save, Trash2, Undo2 } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { ErrorState, PageSpinner, useToast } from '../components/ui'
import { api } from '../lib/api'
import {
  type BandPage,
  type BandPageInput,
  type QuoteRequest,
  slugify,
  useDeleteBandPage,
  useMyBandPages,
  useQuoteRequests,
  useQuoteStatus,
  useSaveBandPage,
} from '../lib/bands'
import { whatsappOf } from '../lib/gigs'
import { useSetlists } from '../lib/setlists'

const EMPTY: BandPageInput = {
  slug: '',
  name: '',
  city: '',
  bio: '',
  genres: '',
  whatsapp: '',
  instagram: '',
  youtube: '',
  setlistId: null,
  published: true,
}

const pageUrl = (slug: string) => `${location.origin}/banda/${slug}`
const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
const sentFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

/** /minha-banda — a página pública da banda (para quem contrata) e os pedidos de orçamento. */
export function MyBand() {
  const { data, isLoading, error, refetch } = useMyBandPages()
  if (isLoading) return <PageSpinner />
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />
  const page = data[0]

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Página da banda</h1>
        <p className="text-sm text-muted">
          Um endereço para mandar a quem quer contratar: apresentação, repertório e um botão de pedir orçamento.
        </p>
      </div>
      {page && <ShareCard page={page} />}
      {page && <Requests page={page} />}
      <PageForm page={page} />
    </div>
  )
}

function ShareCard({ page }: { page: BandPage }) {
  const toast = useToast()
  const url = pageUrl(page.slug)
  return (
    <section className={clsx('card p-4', !page.published && 'opacity-70')}>
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Globe className="size-4 text-accent" /> {page.published ? 'Sua página está no ar' : 'Página escondida (só você sabe o endereço)'}
      </p>
      <p className="mt-1 font-mono text-sm break-all">{url}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a className="btn-primary h-10 text-sm" href={url} target="_blank" rel="noopener">
          <ExternalLink className="size-4" /> Abrir
        </a>
        <button
          className="btn-ghost h-10 text-sm"
          onClick={() => navigator.clipboard.writeText(url).then(() => toast('Link copiado.'))}
        >
          <Copy className="size-4" /> Copiar link
        </button>
        <a
          className="btn-ghost h-10 text-sm"
          href={`https://wa.me/?text=${encodeURIComponent(`Conheça a ${page.name} e peça seu orçamento: ${url}`)}`}
          target="_blank"
          rel="noopener"
        >
          <MessageCircle className="size-4" /> Mandar no WhatsApp
        </a>
      </div>
      <p className="mt-2 text-xs text-muted">Dica: coloque esse link na bio do Instagram da banda.</p>
    </section>
  )
}

function Requests({ page }: { page: BandPage }) {
  const { data } = useQuoteRequests(page.id)
  const [showArchived, setShowArchived] = useState(false)
  if (!data) return null
  const list = data.filter((r) => (showArchived ? r.status === 'arquivado' : r.status !== 'arquivado'))
  const archived = data.filter((r) => r.status === 'arquivado').length
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <Inbox className="size-5 text-accent" /> Pedidos de orçamento
          {page.newRequests > 0 && <span className="rounded-full bg-accent px-2 text-xs font-bold text-accent-ink">{page.newRequests} novos</span>}
        </h2>
        {archived > 0 && (
          <button className="text-xs text-muted hover:text-text" onClick={() => setShowArchived((s) => !s)}>
            {showArchived ? 'Ver os pedidos' : `Arquivados (${archived})`}
          </button>
        )}
      </div>
      {list.length === 0 ? (
        <p className="card p-4 text-sm text-muted">
          {showArchived ? 'Nenhum pedido arquivado.' : 'Nenhum pedido ainda. Mande o link da página para quem quer contratar a banda.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {list.map((r) => (
            <RequestCard key={r.id} r={r} band={page.name} />
          ))}
        </ul>
      )}
    </section>
  )
}

function RequestCard({ r, band }: { r: QuoteRequest; band: string }) {
  const status = useQuoteStatus()
  const wa = whatsappOf(r.contact)
  const email = /\S+@\S+\.\S+/.test(r.contact) ? r.contact : null
  const hello = `Olá, ${r.name.split(' ')[0]}! Aqui é da ${band}. Recebemos seu pedido de orçamento${r.eventType ? ` para ${r.eventType.toLowerCase()}` : ''}${
    r.eventDate ? ` no dia ${r.eventDate.split('-').reverse().join('/')}` : ''
  }.`
  const set = (s: QuoteRequest['status']) => status.mutate({ id: r.id, status: s })
  return (
    <li className={clsx('card p-4', r.status === 'novo' && 'border-accent/50')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">
            {r.name}
            {r.status === 'novo' && <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">Novo</span>}
            {r.status === 'respondido' && <span className="ml-2 rounded-full bg-ok/15 px-2 py-0.5 text-xs text-ok">Respondido</span>}
          </p>
          <p className="text-sm text-muted">{r.contact}</p>
        </div>
        <span className="text-xs text-muted">{sentFmt.format(new Date(r.createdAt))}</span>
      </div>
      <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
        {r.eventDate && (
          <div>
            <dt className="text-xs text-muted">Data</dt>
            <dd>{dateFmt.format(new Date(`${r.eventDate}T00:00:00Z`))}</dd>
          </div>
        )}
        {r.eventType && (
          <div>
            <dt className="text-xs text-muted">Evento</dt>
            <dd>{r.eventType}</dd>
          </div>
        )}
        {r.location && (
          <div>
            <dt className="text-xs text-muted">Local</dt>
            <dd>{r.location}</dd>
          </div>
        )}
      </dl>
      {r.message && <p className="mt-2 rounded-xl bg-surface-2 p-3 text-sm whitespace-pre-line">{r.message}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {wa && (
          <a
            className="btn-primary h-9 text-sm"
            href={`${wa}?text=${encodeURIComponent(hello)}`}
            target="_blank"
            rel="noopener"
            onClick={() => r.status === 'novo' && set('respondido')}
          >
            <MessageCircle className="size-4" /> Responder no WhatsApp
          </a>
        )}
        {email && (
          <a className="btn-ghost h-9 text-sm" href={`mailto:${email}?subject=${encodeURIComponent(`Orçamento ${band}`)}&body=${encodeURIComponent(hello)}`}>
            Responder por e-mail
          </a>
        )}
        {r.status === 'novo' && (
          <button className="btn-ghost h-9 text-sm" onClick={() => set('respondido')}>
            <Check className="size-4" /> Já respondi
          </button>
        )}
        {r.status !== 'arquivado' ? (
          <button className="btn-ghost h-9 text-sm" onClick={() => set('arquivado')}>
            <Archive className="size-4" /> Arquivar
          </button>
        ) : (
          <button className="btn-ghost h-9 text-sm" onClick={() => set('respondido')}>
            <Undo2 className="size-4" /> Desarquivar
          </button>
        )}
      </div>
    </li>
  )
}

function PageForm({ page }: { page?: BandPage }) {
  const save = useSaveBandPage()
  const del = useDeleteBandPage()
  const toast = useToast()
  const { data: setlists } = useSetlists()
  const [form, setForm] = useState<BandPageInput>(() => (page ? { ...EMPTY, ...stripNulls(page) } : EMPTY))
  const [slugTouched, setSlugTouched] = useState(Boolean(page))
  const [slugFree, setSlugFree] = useState<boolean | null>(null)
  const set = <K extends keyof BandPageInput>(k: K, v: BandPageInput[K]) => setForm((f) => ({ ...f, [k]: v }))

  // Endereço livre? Confere enquanto a pessoa digita (meio segundo depois).
  useEffect(() => {
    if (!form.slug || form.slug === page?.slug) return setSlugFree(null)
    const t = setTimeout(() => {
      api<{ free: boolean }>(`/bandas/endereco/${encodeURIComponent(form.slug)}`)
        .then((r) => setSlugFree(r.free))
        .catch(() => setSlugFree(null))
    }, 500)
    return () => clearTimeout(t)
  }, [form.slug, page?.slug])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const clean = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, typeof v === 'string' ? v.trim() || null : v])) as BandPageInput
    save.mutate(
      { ...clean, slug: form.slug, name: form.name.trim(), id: page?.id },
      {
        onSuccess: () => toast(page ? 'Página atualizada.' : 'Página criada! Já pode mandar o link.'),
        onError: (err) => toast(err.message, 'error'),
      },
    )
  }

  const mine = (setlists ?? []).filter((s) => s.role === 'owner' || s.role === 'admin')

  return (
    <form onSubmit={submit} className="card space-y-4 p-4 sm:p-5">
      <h2 className="font-semibold">{page ? 'Editar a página' : 'Criar a página da banda'}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Nome da banda</span>
          <input
            className="input"
            value={form.name}
            onChange={(e) => {
              set('name', e.target.value)
              if (!slugTouched) set('slug', slugify(e.target.value))
            }}
            required
            maxLength={80}
          />
        </label>
        <label className="block">
          <span className="label">Endereço da página</span>
          <div className="flex items-center rounded-xl border border-border bg-surface focus-within:border-accent">
            <span className="pl-3 text-sm text-muted">/banda/</span>
            <input
              className="h-11 min-w-0 flex-1 bg-transparent pr-3 text-base outline-none"
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true)
                set('slug', slugify(e.target.value))
              }}
              required
              minLength={3}
              maxLength={40}
              aria-label="Endereço da página"
            />
          </div>
          {slugFree === false && <span className="mt-1 block text-xs text-danger">Esse endereço já é de outra banda.</span>}
          {slugFree === true && <span className="mt-1 block text-xs text-ok">Endereço livre.</span>}
        </label>
        <label className="block">
          <span className="label">Cidade</span>
          <input className="input" value={form.city ?? ''} onChange={(e) => set('city', e.target.value)} placeholder="Fortaleza, CE" maxLength={80} />
        </label>
        <label className="block">
          <span className="label">Estilos</span>
          <input className="input" value={form.genres ?? ''} onChange={(e) => set('genres', e.target.value)} placeholder="Pop rock, MPB, Sertanejo" maxLength={160} />
        </label>
      </div>
      <label className="block">
        <span className="label">Sobre a banda</span>
        <textarea
          className="input min-h-28"
          value={form.bio ?? ''}
          onChange={(e) => set('bio', e.target.value)}
          placeholder="Quem são vocês, onde já tocaram, que tipo de evento fazem..."
          maxLength={1500}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="label">WhatsApp</span>
          <input className="input" inputMode="tel" value={form.whatsapp ?? ''} onChange={(e) => set('whatsapp', e.target.value)} placeholder="(85) 9..." maxLength={30} />
        </label>
        <label className="block">
          <span className="label">Instagram</span>
          <input className="input" value={form.instagram ?? ''} onChange={(e) => set('instagram', e.target.value)} placeholder="@suabanda" maxLength={80} />
        </label>
        <label className="block">
          <span className="label">Vídeo no YouTube</span>
          <input className="input" type="url" value={form.youtube ?? ''} onChange={(e) => set('youtube', e.target.value)} placeholder="https://youtu.be/..." maxLength={300} />
        </label>
      </div>
      <label className="block">
        <span className="label">Repertório mostrado na página</span>
        <select className="input" value={form.setlistId ?? ''} onChange={(e) => set('setlistId', e.target.value || null)}>
          <option value="">Não mostrar repertório</option>
          {mine.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-muted">Aparecem só o nome e o artista de cada música (nunca a letra ou a cifra).</span>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={form.published} onChange={(e) => set('published', e.target.checked)} />
        Página no ar (desmarque para esconder sem apagar)
      </label>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        {page ? (
          <button
            type="button"
            className="btn-ghost text-danger"
            onClick={() => confirm('Apagar a página da banda? Os pedidos de orçamento também somem.') && del.mutate(page.id)}
          >
            <Trash2 className="size-4" /> Apagar página
          </button>
        ) : (
          <span />
        )}
        <button className="btn-primary" disabled={save.isPending || slugFree === false}>
          <Save className="size-4" /> {page ? 'Salvar' : 'Criar página'}
        </button>
      </div>
    </form>
  )
}

function stripNulls(p: BandPage): BandPageInput {
  return {
    slug: p.slug,
    name: p.name,
    city: p.city ?? '',
    bio: p.bio ?? '',
    genres: p.genres ?? '',
    whatsapp: p.whatsapp ?? '',
    instagram: p.instagram ?? '',
    youtube: p.youtube ?? '',
    setlistId: p.setlistId,
    published: p.published,
  }
}
