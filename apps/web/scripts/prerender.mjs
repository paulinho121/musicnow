// Depois do build: põe o HTML da página inicial e os dados estruturados dentro do dist/index.html.
// Nas telas do app esse conteúdo fica escondido (theme.js + <style> no index.html) e o React
// desenha a tela por cima assim que carrega.
import { readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const siteUrl = (process.env.VITE_SITE_URL ?? 'https://ensaio.152-67-63-31.sslip.io').replace(/\/$/, '')

const { renderHome, structuredData } = await import(pathToFileURL(path.join(root, 'dist-ssr/prerender.js')).href)
const file = path.join(root, 'dist/index.html')
let html = await readFile(file, 'utf8')

if (!html.includes('<div id="root"></div>')) throw new Error('index.html sem <div id="root"></div>')
html = html.replace('<div id="root"></div>', `<div id="root"><div data-prerender>${renderHome()}</div></div>`)

// JSON-LD é só dado (não roda): a política de segurança (CSP) não bloqueia.
const ld = structuredData(siteUrl)
  .map((d) => `<script type="application/ld+json">${JSON.stringify(d).replace(/</g, '\\u003c')}</script>`)
  .join('\n    ')
html = html.replace('</head>', `    ${ld}\n  </head>`)

await writeFile(file, html)
await rm(path.join(root, 'dist-ssr'), { recursive: true, force: true })
console.log(`Página inicial pré-gerada (${Math.round(html.length / 1024)} KB) para ${siteUrl}`)
