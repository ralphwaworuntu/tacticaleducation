import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const appName = env.VITE_APP_NAME || 'TACTICAL EDUCATION';
  // Opsional: arahkan proxy dev ke backend lain (mis. backend uji di port 5001). Default tetap 5000.
  const proxyTarget = process.env.DEV_PROXY_TARGET || 'http://127.0.0.1:5000';

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'Logo_tactical.png', 'pwa-192.png', 'pwa-512.png'],
        manifest: {
          name: appName,
          short_name: 'TacticalEdu',
          description: 'Bimbel & dashboard tryout terpadu untuk casis POLRI dan TNI.',
          theme_color: '#1e3a8a',
          background_color: '#0f172a',
          display: 'standalone',
          icons: [
            {
              src: '/pwa-192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: '/pwa-512.png',
              sizes: '512x512',
              type: 'image/png',
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
        '/uploads': {
          target: proxyTarget,
          changeOrigin: true,
        },
        // Live Quiz (Socket.IO) -- WebSocket harus ikut di-proxy agar HP bisa memakai satu origin.
        '/socket.io': {
          target: proxyTarget,
          changeOrigin: true,
          ws: true,
          // Tab ditutup/di-refresh memutus socket secara kasar; itu normal, jangan penuhi log dengan stack trace.
          configure: (proxy) => {
            proxy.on('error', () => undefined);
          },
        },
      },
    },
    build: {
      chunkSizeWarningLimit: 750,
    },
  };
});
