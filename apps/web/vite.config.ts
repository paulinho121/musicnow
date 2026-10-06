import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { robotsTxt, sitemapXml } from './src/seo-pages'

// Endereço público do site: prévias de link, canonical, sitemap e robots.txt.
// Ao trocar de domínio, troque aqui (ou defina VITE_SITE_URL no build).
const SITE_URL = (process.env.VITE_SITE_URL ?? 'https://ensaio.152-67-63-31.sslip.io').replace(/\/$/, '')
process.env.VITE_SITE_URL = SITE_URL

/** robots.txt e sitemap.xml gerados no build, sempre com o endereço certo. */
function seoFiles(): Plugin {
  return {
    name: 'ensaio-seo-files',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt(SITE_URL) })
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml(SITE_URL, new Date().toISOString().slice(0, 10)) })
    },
  }
}

export default defineConfig({
  // Versão do app (commit), enviada junto com os avisos de erro.
  define: { __RELEASE__: JSON.stringify(process.env.GITHUB_SHA?.slice(0, 7) ?? 'dev') },
  plugins: [
    react(),
    tailwindcss(),
    seoFiles(),
    VitePWA({
      // O app decide quando trocar de versão (src/lib/updates.ts): nunca no meio de uma música.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'theme.js'],
      manifest: {
        name: 'Ensaio Fácil',
        short_name: 'Ensaio Fácil',
        description: 'Cifras, transposição e repertórios para ensaiar e tocar ao vivo.',
        lang: 'pt-BR',
        theme_color: '#0e0f13',
        background_color: '#0e0f13',
        display: 'standalone',
        orientation: 'any',
        start_url: '/inicio',
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Fontes latinas entram no cache offline; os outros alfabetos só se forem usados.
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        globIgnores: [
          '**/*-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese}-*.woff2',
          // Leitores pesados (Guitar Pro ~1,2 MB, PDF ~1,3 MB): só baixam para quem usar.
          '**/alphaTab-*.js',
          '**/pdf-*.js',
          '**/pdf.worker*',
          // Fonte musical do Guitar Pro (~310 KB): só para quem abrir arquivo .gp.
          'alphatab/**',
        ],
        navigateFallback: '/index.html',
        // API e arquivos para robôs (robots.txt, sitemap, imagem de prévia) nunca viram o app.
        navigateFallbackDenylist: [/^\/api\//, /^\/(robots\.txt|sitemap\.xml|og-image\.jpg)$/],
        runtimeCaching: [
          {
            // Músicas já abertas continuam disponíveis sem internet (palco sem sinal).
            urlPattern: ({ url }) => url.pathname.startsWith('/api/songs') || url.pathname.startsWith('/api/me'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Páginas de partitura nunca mudam (cada envio ganha um id novo): depois de abertas,
            // funcionam sem internet no palco.
            urlPattern: ({ url }) => url.pathname.startsWith('/api/scores/') && url.pathname.endsWith('.webp'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'scores',
              expiration: { maxEntries: 1500, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Leitores pesados: guardados no primeiro uso.
            urlPattern: ({ url }) => /\/assets\/(alphaTab|pdf)[-.]|^\/alphatab\/font\//.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'readers', expiration: { maxEntries: 10 }, cacheableResponse: { statuses: [200] } },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:3001' },
  },
})
