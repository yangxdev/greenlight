import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAG } from './src/app/site.ts';

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * The page title and link previews, from src/app/site.ts: what a browser tab, a search result, and a link shared in
 * Slack, Discord, Mastodon or LinkedIn show. Without them a shared link is a bare URL.
 */
function linkPreview(): Plugin {
  const title = `${SITE_NAME} · ${SITE_TAG}`;
  // Vite escapes attribute values itself; only the <title> text below needs escaping by hand.
  const meta = (attrs: Record<string, string>) => ({
    tag: 'meta',
    attrs,
    injectTo: 'head' as const,
  });
  return {
    name: 'greenlight:link-preview',
    transformIndexHtml(html) {
      return {
        html: html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`),
        tags: [
          meta({ name: 'description', content: SITE_DESCRIPTION }),
          meta({ property: 'og:type', content: 'website' }),
          meta({ property: 'og:site_name', content: SITE_NAME }),
          meta({ property: 'og:title', content: title }),
          meta({ property: 'og:description', content: SITE_DESCRIPTION }),
          meta({ name: 'twitter:card', content: 'summary' }),
        ],
      };
    },
  };
}

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
  plugins: [react(), tailwindcss(), linkPreview(), webAnalytics()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'worker/**/*.test.ts', 'scripts/**/*.test.ts'],
    restoreMocks: true,
  },
});
