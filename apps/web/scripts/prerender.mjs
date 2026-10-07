// Depois do build: gera o HTML de cada página pública (página inicial, dicionário de acordes,
// transpositor, termos...) com título, descrição, canonical e dados estruturados próprios,
// mais o robots.txt e o sitemap.xml. O conteúdo pré-gerado só aparece na página a que pertence
// (theme.js marca o endereço; o <style> esconde nas outras) e o React desenha por cima ao carregar.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
// O mesmo endereço do vite.config.ts.
const siteUrl = (process.env.VITE_SITE_URL ?? 'https://ensaiofacil.app.br').replace(/\/$/, '')

const ssr = await import(pathToFileURL(path.join(root, 'dist-ssr/prerender.js')).href)
const template = await readFile(path.join(dist, 'index.html'), 'utf8')
// O build compacta o <style> (o seletor pode sair como [data-path=\/]): procura com folga.
const GUARD = /html:not\(\[data-path=[^\]]*\]\)/
for (const needle of ['<div id="root"></div>', '<title>', 'rel="canonical"']) {
  if (!template.includes(needle)) throw new Error(`index.html sem ${needle}`)
}
if (!GUARD.test(template)) throw new Error('index.html sem o seletor do conteúdo pré-gerado')

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const setMeta = (html, attr, name, value) =>
  html.replace(new RegExp(`(<meta\\s+${attr}="${name}"\\s+content=")[^"]*(")`), `$1${esc(value)}$2`)

function pageHtml(page) {
  const url = `${siteUrl}${page.path}`
  let html = template
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(page.title)}</title>`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`)
    .replace(GUARD, `html:not([data-path="${page.path}"])`)
  // A descrição do index.html está quebrada em linhas: troca pelo bloco inteiro.
  html = html.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/>/,
    `<meta name="description" content="${esc(page.description)}" />`,
  )
  html = setMeta(html, 'property', 'og:url', url)
  html = setMeta(html, 'property', 'og:title', page.title)
  html = html.replace(
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/,
    `<meta property="og:description" content="${esc(page.description)}" />`,
  )
  html = setMeta(html, 'name', 'twitter:title', page.title)
  html = setMeta(html, 'name', 'twitter:description', page.description)
  if (ssr.isRendered(page.path)) {
    html = html.replace('<div id="root"></div>', `<div id="root"><div data-prerender>${ssr.renderPage(page.path)}</div></div>`)
  }
  // JSON-LD é só dado (não roda): a política de segurança (CSP) não bloqueia.
  const ld = ssr
    .structuredData(siteUrl, page.path)
    .map((d) => `<script type="application/ld+json">${JSON.stringify(d).replace(/</g, '\\u003c')}</script>`)
    .join('\n    ')
  if (ld) html = html.replace('</head>', `    ${ld}\n  </head>`)
  return html
}

const pages = ssr.allPublicPages()
for (const page of pages) {
  // "/" → dist/index.html (também é a página de reserva do app); o resto → dist/<endereço>/index.html.
  const out = page.path === '/' ? path.join(dist, 'index.html') : path.join(dist, page.path, 'index.html')
  await mkdir(path.dirname(out), { recursive: true })
  await writeFile(out, pageHtml(page))
}

await writeFile(path.join(dist, 'robots.txt'), ssr.robotsTxt(siteUrl))
await writeFile(path.join(dist, 'sitemap.xml'), ssr.sitemapXml(siteUrl, new Date().toISOString().slice(0, 10)))
await rm(path.join(root, 'dist-ssr'), { recursive: true, force: true })
console.log(`${pages.length} páginas públicas pré-geradas + robots.txt e sitemap.xml para ${siteUrl}`)
