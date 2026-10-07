import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Endereço público do site: prévias de link, canonical, sitemap e robots.txt (estes dois
// gerados em scripts/prerender.mjs). Ao trocar de domínio, troque aqui e no prerender.mjs
// (ou defina VITE_SITE_URL no build).
const SITE_URL = (process.env.VITE_SITE_URL ?? 'https://ensaiofacil.app.br').replace(/\/$/, '')
process.env.VITE_SITE_URL = SITE_URL

export default defineConfig({
  // Versão do app (commit), enviada junto com os avisos de erro.
  define: { __RELEASE__: JSON.stringify(process.env.GITHUB_SHA?.slice(0, 7) ?? 'dev') },
  plugins: [
    react(),
    tailwindcss(),
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
            // Repertórios também (a lista e cada um; o "ao vivo" /events nunca é guardado),
            // para o "Baixar para o show" (src/lib/offline.ts).
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/api/songs') ||
              url.pathname.startsWith('/api/me') ||
              /^\/api\/setlists(\/[0-9a-f-]{36})?$/.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api',
              networkTimeoutSeconds: 4,
              // Servidor fora do ar (502/503): usa a cópia do aparelho, como se estivesse sem internet.
              plugins: [
                {
                  fetchDidSucceed: async ({ response }) => {
                    if (response.status >= 500) throw new Error(`Servidor respondeu ${response.status}`)
                    return response
                  },
                },
              ],
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
          // Capas de álbum NÃO passam pelo service worker: a política de segurança (CSP connect-src
          // 'self') bloqueia o service worker de buscar em outro site, e a capa sumia. As <img> buscam
          // direto (img-src https:), e o navegador guarda no cache dele.
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
