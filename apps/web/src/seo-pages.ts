// Páginas públicas (as únicas que o Google deve indexar): título, descrição e prioridade no
// sitemap. Usado no build (páginas pré-geradas, sitemap.xml, robots.txt) e no app (título e
// canonical de cada tela). Sem import.meta e sem window: também roda no build (Node).
import { allChordPages, chordFromSlug, chordInfo, noteNamePt, TUNER_INSTRUMENTS } from '@ensaio/shared'

export interface PublicPage {
  title: string
  description: string
  /** Prioridade no sitemap (0 a 1). */
  priority: number
  changefreq: 'weekly' | 'monthly' | 'yearly'
}

export const PUBLIC_PAGES: Record<string, PublicPage> = {
  '/': {
    title: 'Ensaio Fácil · App de cifras e repertório para banda, louvor e show',
    description:
      'Cifras em qualquer tom, repertório por blocos e o Modo Palco que deixa a banda inteira no mesmo tom, ao vivo. Para louvor, bar, baile e show. Teste grátis por 14 dias.',
    priority: 1,
    changefreq: 'weekly',
  },
  '/criar-conta': {
    title: 'Criar conta grátis · Ensaio Fácil',
    description: 'Crie sua conta e teste o Ensaio Fácil por 14 dias, sem cartão. Monte o repertório da banda em 1 minuto.',
    priority: 0.8,
    changefreq: 'monthly',
  },
  '/entrar': {
    title: 'Entrar · Ensaio Fácil',
    description: 'Acesse suas cifras e repertórios no Ensaio Fácil.',
    priority: 0.5,
    changefreq: 'yearly',
  },
  '/acordes': {
    title: 'Dicionário de acordes para violão, guitarra e teclado · Ensaio Fácil',
    description:
      'Dicionário de acordes grátis: maiores, menores, com sétima, nona, diminutos e mais, com diagramas de violão, guitarra e teclado em várias posições.',
    priority: 0.9,
    changefreq: 'monthly',
  },
  '/transpor-cifra': {
    title: 'Transpor cifra online grátis: mude o tom da música · Ensaio Fácil',
    description:
      'Cole a cifra, escolha o novo tom e pronto: transpositor de cifras online e grátis, com sugestão de capotraste. Funciona no celular, sem cadastro.',
    priority: 0.9,
    changefreq: 'monthly',
  },
  '/afinador-online': {
    title: 'Afinador online grátis: violão, guitarra, baixo, cavaquinho e ukulele · Ensaio Fácil',
    description:
      'Afinador online grátis pelo microfone: violão, guitarra, baixo, cavaquinho, ukulele, viola caipira, violino e bandolim. Funciona no celular, sem instalar nada.',
    priority: 0.9,
    changefreq: 'monthly',
  },
  '/termos': {
    title: 'Termos de uso · Ensaio Fácil',
    description: 'Termos de uso do Ensaio Fácil: assinatura, teste grátis, cancelamento e regras de uso.',
    priority: 0.2,
    changefreq: 'yearly',
  },
  '/privacidade': {
    title: 'Política de privacidade · Ensaio Fácil',
    description: 'Como o Ensaio Fácil trata os seus dados pessoais, de acordo com a LGPD.',
    priority: 0.2,
    changefreq: 'yearly',
  },
}

/** Nome por extenso: "Fá sustenido menor com sétima". */
export function chordNamePt(symbol: string) {
  const info = chordInfo(symbol)
  if (!info) return null
  const name = `${noteNamePt(info.notes[0])} ${info.quality}`
  return info.bassNote ? `${name}, com baixo em ${noteNamePt(info.bassNote)}` : name
}

function chordPage(symbol: string): PublicPage {
  const name = chordNamePt(symbol) ?? symbol
  return {
    title: `Acorde ${symbol} (${name}): como tocar no violão e teclado · Ensaio Fácil`,
    description: `Como fazer o acorde ${symbol} (${name}) no violão, na guitarra e no teclado, em várias posições. Notas: ${chordInfo(symbol)?.notes.join(', ')}.`,
    priority: 0.6,
    changefreq: 'yearly',
  }
}

function tunerPage(slug: string): PublicPage | null {
  const inst = TUNER_INSTRUMENTS.find((i) => i.slug === slug)
  if (!inst) return null
  const strings = inst.tunings[0].strings.map((s) => s.replace(/-?\d$/, '')).join(' ')
  if (inst.id === 'chromatic') {
    return {
      title: 'Afinador cromático online grátis · Ensaio Fácil',
      description: 'Afinador cromático online e grátis: reconhece qualquer nota pelo microfone, para qualquer instrumento ou para a voz.',
      priority: 0.7,
      changefreq: 'yearly',
    }
  }
  const name = inst.name.toLowerCase()
  return {
    title: `Afinador de ${name} online grátis (${strings}) · Ensaio Fácil`,
    description: `Afine o ${name} pelo microfone do celular ou computador, grátis. Afinação padrão: ${strings}. Mostra a corda, a nota e se precisa apertar ou afrouxar.`,
    priority: 0.8,
    changefreq: 'yearly',
  }
}

/** A página pública deste endereço (inclui as de acorde e de afinador), ou null se for tela do app. */
export function publicPageFor(path: string): PublicPage | null {
  if (PUBLIC_PAGES[path]) return PUBLIC_PAGES[path]
  const t = /^\/afinador-online\/([a-z0-9-]+)$/.exec(path)
  if (t) return tunerPage(t[1])
  const m = /^\/acordes\/([a-z0-9-]+)$/.exec(path)
  const symbol = m && chordFromSlug(m[1])
  return symbol ? chordPage(symbol) : null
}

/** Todas as páginas públicas, com o endereço (build: pré-geração e sitemap). */
export function allPublicPages(): (PublicPage & { path: string })[] {
  return [
    ...Object.entries(PUBLIC_PAGES).map(([path, p]) => ({ path, ...p })),
    ...allChordPages().map((c) => ({ path: `/acordes/${c.slug}`, ...chordPage(c.symbol) })),
    ...TUNER_INSTRUMENTS.map((i) => ({ path: `/afinador-online/${i.slug}`, ...tunerPage(i.slug)! })),
  ]
}

/**
 * Telas do app (com login): fora do Google (robots.txt + noindex). Convites e músicas
 * compartilhadas não entram aqui de propósito: os robôs de prévia (WhatsApp, Facebook)
 * precisam abrir esses links. Eles ficam fora do Google pelo noindex do app.
 */
export const PRIVATE_PREFIXES = [
  '/inicio',
  // "$" = só o afinador do app (o /afinador-online é público).
  '/afinador$',
  '/comecar',
  '/musicas',
  '/repertorios',
  '/perfil',
  '/assinatura',
  '/parceiro',
  '/agenda',
  '/ajuda',
  '/admin',
  '/redefinir-senha',
  '/esqueci-senha',
]

export function sitemapXml(siteUrl: string, lastmod: string) {
  const urls = allPublicPages()
    .map(
      ({ path, ...p }) =>
        `  <url><loc>${siteUrl}${path}</loc><lastmod>${lastmod}</lastmod><changefreq>${p.changefreq}</changefreq><priority>${p.priority.toFixed(1)}</priority></url>`,
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

export function robotsTxt(siteUrl: string) {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    ...PRIVATE_PREFIXES.map((p) => `Disallow: ${p}`),
    '',
    `Sitemap: ${siteUrl}/sitemap.xml`,
    '',
  ].join('\n')
}
