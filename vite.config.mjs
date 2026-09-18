import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [VitePWA({
    strategies: 'generateSW',
    // Keep the existing manifest and explicitly guard registration in the app.
    manifest: false,
    injectRegister: false,
    registerType: 'prompt',
    workbox: {
      globPatterns: ['**/*.{html,js,css,png,webmanifest}'],
      navigateFallback: 'index.html',
      cleanupOutdatedCaches: true,
      skipWaiting: false,
      clientsClaim: false,
    },
  })],
});
