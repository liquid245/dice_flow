import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'models/*.glb', 'sounds/*.wav'],
      manifest: {
        name: 'DiceFlow',
        short_name: 'DiceFlow',
        description: '3D dice assistant for tabletop wargames',
        theme_color: '#1a1a1a',
        background_color: '#1a1a1a',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
