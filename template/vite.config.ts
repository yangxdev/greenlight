import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * Cloudflare Web Analytics (free, cookie-less). Workers don't auto-inject the beacon the way Pages did, so the
 * build adds it when VITE_CF_BEACON_TOKEN is set (the Publisher passes the product repo's CF_BEACON_TOKEN variable).
 * The token is public by design: it ends up in every visitor's HTML.
 */
function webAnalytics(token = process.env.VITE_CF_BEACON_TOKEN): Plugin {
  return {
    name: 'greenlight:web-analytics',
    transformIndexHtml() {
      if (!token) return [];
      if (!/^[a-f0-9]{32}$/i.test(token))
        throw new Error('VITE_CF_BEACON_TOKEN must be the 32-character beacon token');
      return [
        {
          tag: 'script',
          attrs: {
            defer: true,
            src: 'https://static.cloudflareinsights.com/beacon.min.js',
            'data-cf-beacon': JSON.stringify({ token }),
          },
          injectTo: 'body',
        },
      ];
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), webAnalytics()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'worker/**/*.test.ts', 'scripts/**/*.test.ts'],
    restoreMocks: true,
  },
});
