import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { storeEditionHtmlPlugin } from './build/store-edition.mjs';

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [storeEditionHtmlPlugin(mode === 'store'), VitePWA({
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
}));
