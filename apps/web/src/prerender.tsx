// Gera o HTML da página inicial no build (scripts/prerender.mjs): o Google, o Bing e as
// redes sociais leem o conteúdo sem precisar rodar o app.
import { formatBRL, PLANS, TRIAL_DAYS } from '@ensaio/shared'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router'
import { FAQ, Welcome } from './pages/Welcome'

export function renderHome() {
  return renderToString(
    <StaticRouter location="/">
      <Welcome />
    </StaticRouter>,
  )
}

/** Dados estruturados (schema.org): o app, os preços e as perguntas frequentes. */
export function structuredData(siteUrl: string) {
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
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
  ]
}
