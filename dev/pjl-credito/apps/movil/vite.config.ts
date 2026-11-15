import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// App del socio: PWA instalable. Las llamadas a /api van a core-api (proxy en desarrollo, nginx en producción).
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'logo-pjl-192.png'],
      manifest: {
        name: 'PJL Móvil · Crédito',
        short_name: 'PJL Móvil',
        description: 'Solicita y sigue tu crédito con la Cooperativa Padre Julián Lorente.',
        lang: 'es-EC',
        theme_color: '#0e3a60',
        background_color: '#f2f6fb',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'logo-pjl-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'logo-pjl-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'logo-pjl-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        // Solo información pública de la nube privada se guarda para uso sin conexión; nunca datos del socio.
        runtimeCaching: [{ urlPattern: /\/api\/v1\/info\//, handler: 'StaleWhileRevalidate', options: { cacheName: 'pjl-info' } }],
      },
    }),
  ],
  server: { port: 5173, host: '127.0.0.1', proxy: { '/api': 'http://localhost:8080' } },
  preview: { port: 4173 },
});
