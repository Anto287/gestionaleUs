import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// In produzione (build per GitHub Pages) l'app vive sotto /gestionaleUs/.
// In sviluppo resta alla radice.
// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/gestionaleUs/' : '/',
  plugins: [
    react(),
    // App installabile sul telefono: manifest + service worker che si
    // auto-aggiorna. I dati restano sul Drive: qui si mette in cache solo
    // l'app (i file js/css/font), non le chiamate allo script.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['logo.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'U.S. Riolunato · Gestionale',
        short_name: 'Riolunato',
        description:
          'Gestionale U.S. Riolunato — rosa, allenamenti, distinte, magazzino, conti e documenti.',
        lang: 'it',
        theme_color: '#c22026',
        background_color: '#f5f2eb',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        // Fuori dal precarico i pezzi grossi che servono in una pagina sola
        // (anteprima PDF, export Excel, editor delle grafiche): all'installazione
        // erano 2,7 MB scaricati da tutti per funzioni usate da pochi. Se ne
        // occupa runtimeCaching qui sotto: scaricati al primo uso e poi tenuti.
        globIgnores: [
          '**/assets/pdf.worker*.js',
          '**/assets/pdf-*.js',
          '**/assets/xlsx-*.js',
          '**/assets/Social-*.js',
        ],
        // l'app carica jspdf/konva su richiesta: alza il limite dei file precache
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // le chiamate al Drive (Apps Script) non vanno mai in cache
        navigateFallbackDenylist: [/script\.google\.com/],
        runtimeCaching: [
          {
            // i pezzi dell'app non precaricati: al primo uso finiscono in cache
            // e da lì in poi si aprono anche senza rete (i nomi hanno l'hash,
            // quindi una versione nuova non pesca mai il file vecchio)
            urlPattern: /\/assets\/[^/]+\.(?:js|css)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'pezzi-app',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 90 },
            },
          },
        ],
      },
    }),
  ],
}))
