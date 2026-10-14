import clsx from 'clsx'
import { Camera, CheckCircle2, CirclePlay, Loader2, MapPin, MessageCircle, Music2, Search, Send } from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Avatar } from '../components/Avatar'
import { Logo } from '../components/Logo'
import { PageSpinner } from '../components/ui'
import { instagramUrl, type PublicBand, usePublicBand, useSendQuote } from '../lib/bands'
import { whatsappOf } from '../lib/gigs'

const EVENT_TYPES = ['Casamento', 'Aniversário', 'Formatura', 'Evento de empresa', 'Bar / restaurante', 'Culto / evento religioso', 'Outro']

/** /banda/:slug — página da banda para quem quer contratar: apresentação, repertório e orçamento. */
export function BandPublic() {
  const { slug = '' } = useParams()
  const { data, isLoading, error } = usePublicBand(slug)

  useEffect(() => {
    if (data) document.title = `${data.name}${data.city ? ` · ${data.city}` : ''} · Banda`
  }, [data])

  if (isLoading) return <PageSpinner />
  if (error || !data)
    return (
      <main className="mx-auto grid min-h-dvh max-w-md place-items-center px-5 text-center">
        <div>
          <p className="text-lg font-semibold">Página não encontrada</p>
          <p className="mt-1 text-sm text-muted">Confira o endereço com a banda.</p>
          <Link to="/" className="btn-ghost mt-5">
            Conhecer o Ensaio Fácil
          </Link>
        </div>
      </main>
    )

  return (
    <div className="min-h-dvh bg-bg">
      <main className="mx-auto max-w-3xl space-y-8 px-5 py-10">
        <Hero band={data} />
        {data.bio && <p className="text-[15px] leading-relaxed whitespace-pre-line text-text/90">{data.bio}</p>}
        {data.youtube && <YoutubeEmbed url={data.youtube} />}
        {data.songs.length > 0 && <Repertoire songs={data.songs} />}
        <QuoteForm band={data} slug={slug} />
      </main>
      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted">
        <Link to="/" className="inline-flex items-center gap-2 hover:text-text">
          Página criada com <Logo />
        </Link>
      </footer>
    </div>
  )
}

function Hero({ band }: { band: PublicBand }) {
  const wa = whatsappOf(band.whatsapp)
  const genres = band.genres?.split(/[,;·]/).map((g) => g.trim()).filter(Boolean) ?? []
  return (
    <header className="text-center">
      <Avatar name={band.name} image={band.image} className="mx-auto size-24 text-3xl" />
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">{band.name}</h1>
      {band.city && (
        <p className="mt-1 flex items-center justify-center gap-1 text-muted">
          <MapPin className="size-4" /> {band.city}
        </p>
      )}
      {genres.length > 0 && (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {genres.map((g) => (
            <span key={g} className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold">
              {g}
            </span>
          ))}
        </div>
      )}
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <a href="#orcamento" className="btn-primary">
          <Send className="size-4" /> Pedir orçamento
        </a>
        {wa && (
          <a href={wa} target="_blank" rel="noopener" className="btn-ghost">
            <MessageCircle className="size-4" /> WhatsApp
          </a>
        )}
        {band.instagram && (
          <a href={instagramUrl(band.instagram)} target="_blank" rel="noopener" className="btn-ghost">
            <Camera className="size-4" /> Instagram
          </a>
        )}
        {band.youtube && (
          <a href={band.youtube} target="_blank" rel="noopener" className="btn-ghost">
            <CirclePlay className="size-4" /> YouTube
          </a>
        )}
      </div>
    </header>
  )
}

/** Vídeo do YouTube embutido (só links do YouTube; outros viram só o botão). */
function YoutubeEmbed({ url }: { url: string }) {
  const id = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/)?.[1]
  if (!id) return null
  return (
    <div className="aspect-video overflow-hidden rounded-2xl border border-border">
      <iframe
        className="size-full"
        src={`https://www.youtube-nocookie.com/embed/${id}`}
        title="Vídeo da banda"
        allow="accelerometer; encrypted-media; picture-in-picture"
        allowFullScreen
        loading="lazy"
      />
    </div>
  )
}

function Repertoire({ songs }: { songs: PublicBand['songs'] }) {
  const [q, setQ] = useState('')
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const list = useMemo(() => songs.filter((s) => norm(`${s.title} ${s.artist ?? ''}`).includes(norm(q))), [songs, q])
  return (
    <section>
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Music2 className="size-5 text-accent" /> Repertório <span className="text-sm font-normal text-muted">({songs.length} músicas)</span>
      </h2>
      {songs.length > 8 && (
        <label className="relative mt-3 block">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input className="input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar música ou artista" />
        </label>
      )}
      <ul className="card mt-3 max-h-[28rem] divide-y divide-border overflow-y-auto">
        {list.map((s, i) => (
          <li key={i} className="px-4 py-2.5">
            <p className="font-medium">{s.title}</p>
            {s.artist && <p className="text-xs text-muted">{s.artist}</p>}
          </li>
        ))}
        {list.length === 0 && <li className="px-4 py-3 text-sm text-muted">Nenhuma música com esse nome.</li>}
      </ul>
      <p className="mt-2 text-xs text-muted">Quer uma música que não está aqui? Peça no orçamento.</p>
    </section>
  )
}

function QuoteForm({ band, slug }: { band: PublicBand; slug: string }) {
  const send = useSendQuote(slug)
  const [form, setForm] = useState({ name: '', contact: '', eventDate: '', eventType: '', location: '', message: '', website: '' })
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const today = new Date().toISOString().slice(0, 10)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    send.mutate({
      ...form,
      eventDate: form.eventDate || null,
      eventType: form.eventType || null,
      location: form.location || null,
      message: form.message || null,
    })
  }

  if (send.isSuccess)
    return (
      <section id="orcamento" className="card p-6 text-center">
        <CheckCircle2 className="mx-auto size-10 text-ok" />
        <p className="mt-3 text-lg font-semibold">Pedido enviado!</p>
        <p className="mt-1 text-sm text-muted">A {band.name} recebeu seu pedido e vai responder no contato que você deixou.</p>
      </section>
    )

  return (
    <section id="orcamento" className="card scroll-mt-6 p-5 sm:p-6">
      <h2 className="text-lg font-bold">Pedir orçamento</h2>
      <p className="mt-1 text-sm text-muted">Conte sobre o seu evento: a banda responde no seu WhatsApp ou e-mail.</p>
      <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Seu nome</span>
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} required maxLength={80} autoComplete="name" />
        </label>
        <label className="block">
          <span className="label">WhatsApp ou e-mail</span>
          <input className="input" value={form.contact} onChange={(e) => set('contact', e.target.value)} required maxLength={120} autoComplete="tel" />
        </label>
        <label className="block">
          <span className="label">Data do evento</span>
          <input type="date" className="input" min={today} value={form.eventDate} onChange={(e) => set('eventDate', e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Tipo de evento</span>
          <select className="input" value={form.eventType} onChange={(e) => set('eventType', e.target.value)}>
            <option value="">Escolha...</option>
            {EVENT_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="label">Cidade / local</span>
          <input className="input" value={form.location} onChange={(e) => set('location', e.target.value)} maxLength={160} />
        </label>
        <label className="block sm:col-span-2">
          <span className="label">Detalhes (horário, duração, músicas que não podem faltar...)</span>
          <textarea className="input min-h-24" value={form.message} onChange={(e) => set('message', e.target.value)} maxLength={1500} />
        </label>
        {/* Campo escondido: pessoas não veem, robôs preenchem. */}
        <input
          className="hidden"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden
          value={form.website}
          onChange={(e) => set('website', e.target.value)}
          name="website"
        />
        {send.error && <p className="text-sm text-danger sm:col-span-2">{send.error.message}</p>}
        <button className={clsx('btn-primary sm:col-span-2')} disabled={send.isPending}>
          {send.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Enviar pedido
        </button>
      </form>
    </section>
  )
}
