// Páginas públicas (as únicas que o Google deve indexar): título, descrição e prioridade no
// sitemap. Usado no build (sitemap.xml, robots.txt) e no app (título e canonical de cada tela).
// Sem import.meta aqui: o vite.config.ts também lê este arquivo.

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

/**
 * Telas do app (com login): fora do Google (robots.txt + noindex). Convites e músicas
 * compartilhadas não entram aqui de propósito: os robôs de prévia (WhatsApp, Facebook)
 * precisam abrir esses links. Eles ficam fora do Google pelo noindex do app.
 */
export const PRIVATE_PREFIXES = [
  '/inicio',
  '/comecar',
  '/musicas',
  '/repertorios',
  '/acordes',
  '/perfil',
  '/assinatura',
  '/admin',
  '/redefinir-senha',
  '/esqueci-senha',
]

export function sitemapXml(siteUrl: string, lastmod: string) {
  const urls = Object.entries(PUBLIC_PAGES)
    .map(
      ([path, p]) =>
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
