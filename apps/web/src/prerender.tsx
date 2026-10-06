// Gera no build o HTML das páginas públicas (scripts/prerender.mjs): o Google, o Bing e as
// redes sociais leem o conteúdo sem precisar rodar o app.
import { chordFromSlug, formatBRL, PLANS, TRIAL_DAYS } from '@ensaio/shared'
import { renderToString } from 'react-dom/server'
import { Route, Routes, StaticRouter } from 'react-router'
import { Privacy, Terms } from './pages/Legal'
import { ChordPage, ChordsIndex } from './pages/PublicChords'
import { Transposer, TRANSPOSER_FAQ } from './pages/Transposer'
import { FAQ, Welcome } from './pages/Welcome'
import { allPublicPages, chordNamePt, robotsTxt, sitemapXml } from './seo-pages'

export { allPublicPages, robotsTxt, sitemapXml }

/** Páginas com conteúdo pré-gerado (entrar e criar conta só ganham título e descrição). */
const RENDERED = /^\/($|acordes(\/|$)|transpor-cifra$|termos$|privacidade$)/
export const isRendered = (path: string) => RENDERED.test(path)

export function renderPage(path: string) {
  return renderToString(
    <StaticRouter location={path}>
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/acordes" element={<ChordsIndex />} />
        <Route path="/acordes/:slug" element={<ChordPage />} />
        <Route path="/transpor-cifra" element={<Transposer />} />
        <Route path="/termos" element={<Terms />} />
        <Route path="/privacidade" element={<Privacy />} />
      </Routes>
    </StaticRouter>,
  )
}

const faqPage = (items: { q: string; a: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
})

const breadcrumb = (siteUrl: string, items: [string, string][]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: `${siteUrl}${path}` })),
})

/** Dados estruturados (schema.org) de cada página. */
export function structuredData(siteUrl: string, path: string): object[] {
  if (path === '/') {
    const offer = (name: string, price: number, unit: string) => ({
      '@type': 'Offer',
      name,
      price: price.toFixed(2),
      priceCurrency: 'BRL',
      url: `${siteUrl}/criar-conta`,
      description: `${formatBRL(price)} ${unit}, com ${TRIAL_DAYS} dias grátis sem cartão`,
    })
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Ensaio Fácil',
        url: `${siteUrl}/`,
        image: `${siteUrl}/og-image.jpg`,
        applicationCategory: 'MultimediaApplication',
        operatingSystem: 'Web, Android, iOS, Windows, macOS',
        inLanguage: 'pt-BR',
        description:
          'App de cifras e repertório para bandas, ministérios de louvor e músicos: transposição de tom, repertório por blocos e Modo Palco que sincroniza a banda ao vivo.',
        offers: [offer('Plano mensal', PLANS.monthly.price, 'por mês'), offer('Plano anual', PLANS.yearly.price, 'por ano')],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Ensaio Fácil',
        url: `${siteUrl}/`,
        logo: `${siteUrl}/apple-touch-icon.png`,
      },
      faqPage(FAQ),
    ]
  }
  if (path === '/transpor-cifra') {
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'Transpor cifra online',
        url: `${siteUrl}/transpor-cifra`,
        applicationCategory: 'MultimediaApplication',
        operatingSystem: 'Web',
        inLanguage: 'pt-BR',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'BRL' },
      },
      faqPage(TRANSPOSER_FAQ),
      breadcrumb(siteUrl, [
        ['Início', '/'],
        ['Transpor cifra', '/transpor-cifra'],
      ]),
    ]
  }
  if (path === '/acordes') {
    return [
      breadcrumb(siteUrl, [
        ['Início', '/'],
        ['Acordes', '/acordes'],
      ]),
    ]
  }
  const m = /^\/acordes\/([a-z0-9-]+)$/.exec(path)
  const symbol = m && chordFromSlug(m[1])
  if (symbol) {
    return [
      breadcrumb(siteUrl, [
        ['Início', '/'],
        ['Acordes', '/acordes'],
        [`${symbol} (${chordNamePt(symbol)})`, path],
      ]),
    ]
  }
  return []
}
