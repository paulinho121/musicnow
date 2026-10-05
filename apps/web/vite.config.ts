import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // O app decide quando trocar de versão (src/lib/updates.ts): nunca no meio de uma música.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icon.svg', 'theme.js'],
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
        ],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
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
            urlPattern: ({ url }) => /\/assets\/(alphaTab|pdf)[-.]/.test(url.pathname),
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
