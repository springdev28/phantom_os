import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { COMMON_HEADERS, productionHeaders, STATIC_META_POLICY } from './src/security/policy.ts';
import { DOS_HOST_PATH } from './src/runtime/dos/host-manifest.ts';

export default defineConfig(({ mode }) => ({
  plugins: [react(), {
    name: 'phantom-security-headers',
    transformIndexHtml: { order: 'post', handler(html, context) {
      if (context.server) return html; // Vite's development transforms need a different script policy.
      return { html, tags: [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: STATIC_META_POLICY }, injectTo: 'head-prepend' }] };
    } },
    configurePreviewServer(server) {
      const frame = readFileSync(new URL(`./dist/${DOS_HOST_PATH}`, import.meta.url), 'utf8');
      const framePolicy = frame.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
      if (!framePolicy) throw new Error('Missing runtime policy');
      server.middlewares.use((request, response, next) => {
        // Preview is loopback only. Reject an arbitrary Host instead of reflecting it into CSP.
        const host = request.headers.host ?? '';
        if (!/^(127\.0\.0\.1|localhost)(:\d{1,5})?$/.test(host)) { response.writeHead(400).end(); return; }
        const url = new URL(request.url ?? '/', `http://${host}`);
        if (!['GET', 'HEAD'].includes(request.method ?? '') || url.search) { response.writeHead(404).end(); return; }
        const isFrame = url.pathname === `/${DOS_HOST_PATH}`;
        for (const [name, value] of Object.entries(productionHeaders(url.origin, DOS_HOST_PATH, isFrame ? framePolicy : undefined))) response.setHeader(name, value);
        response.setHeader('Cache-Control', /^\/(assets|runtimes)\//.test(url.pathname)
          ? 'public, max-age=31536000, immutable' : url.pathname === '/favicon.svg' ? 'public, max-age=86400' : 'no-cache');
        next();
      });
    },
  }],
  server: { host: '127.0.0.1', hmr: mode !== 'test', headers: COMMON_HEADERS },
  preview: { host: '127.0.0.1' },
  build: { sourcemap: false },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    clearMocks: true,
  },
}));
