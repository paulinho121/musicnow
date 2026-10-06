// Título, descrição, endereço oficial (canonical) e indexação de cada tela.
// Só as páginas públicas entram no Google; as telas do app ficam com "noindex".
import { PUBLIC_PAGES, publicPageFor } from '../seo-pages'

const SITE_URL: string = import.meta.env.VITE_SITE_URL ?? location.origin
const APP_TITLE = 'Ensaio Fácil'

function meta(name: string, content: string, attr: 'name' | 'property' = 'name') {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, name)
    document.head.appendChild(el)
  }
  el.content = content
}

export function applyRouteMeta(pathname: string) {
  const page = publicPageFor(pathname)
  const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  // Mostra o conteúdo pré-gerado só na página a que ele pertence (ver theme.js e index.html).
  document.documentElement.dataset.path = pathname
  if (page) {
    document.title = page.title
    meta('description', page.description)
    meta('robots', 'index, follow')
    if (canonical) canonical.href = `${SITE_URL}${pathname}`
  } else {
    // Tela do app: o título é definido pela própria tela quando fizer sentido.
    if (!document.title || Object.values(PUBLIC_PAGES).some((p) => p.title === document.title)) document.title = APP_TITLE
    meta('robots', 'noindex, nofollow')
    if (canonical) canonical.href = `${SITE_URL}/`
  }
}
