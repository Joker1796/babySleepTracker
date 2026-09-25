import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/icon-180.png'],
      manifest: {
        name: 'Режим малыша',
        short_name: 'Малыш',
        description: 'Трекер режима ребёнка: сон, прогулки и умные подсказки по укладыванию',
        lang: 'ru',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        theme_color: '#f6f1e7',
        background_color: '#f6f1e7',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html'
      }
    })
  ],
  test: {
    environment: 'node'
  }
})
