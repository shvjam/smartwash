import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    // React and Tailwind power the production application build.
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Don't include favicon/icons that might not exist
      includeAssets: [],
      // Self-destroying service worker in case of install errors
      selfDestroying: false,
      manifest: {
        name: 'SmartWash',
        short_name: 'SmartWash',
        description: 'SmartWash — سامانه مدیریت کارواش',
        theme_color: '#dc2626',
        background_color: '#f5f5f7',
        display: 'standalone',
        dir: 'rtl',
        lang: 'fa',
        start_url: '/',
        // Local files, generated from the same SVG the header renders — see
        // scripts/make-icons.mjs. The previous entries pointed one absolute URL at two
        // different declared sizes, which no single file can satisfy, and hard-coded the
        // domain so the icon 404'd on any other host.
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          // Android crops icons to the launcher's shape; this one keeps the mark inside
          // the safe area so the corners are not shaved off.
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MiB
        // Only cache html, css, js — skip external images that might fail
        globPatterns: ['**/*.{js,css,html}'],
        // Don't precache manifest to avoid 404 failures
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/api\//,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
