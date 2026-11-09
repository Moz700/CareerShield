import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Two targets:
//   default  -> dist/ with relative asset paths; runs under a GitHub Pages sub-path or at the root
//               of a custom domain without changes (routes live in the URL hash)
//   offline  -> dist-offline/CareerShield.html, one self-contained file that opens from disk
//
// SITE_URL is the public address, used only for absolute links that crawlers and social previews
// need (canonical URL, Open Graph image, sitemap). Set it in the deploy workflow for a custom domain.
const SITE_URL = (process.env.SITE_URL || 'https://moz700.github.io/CareerShield/').replace(/\/?$/, '/');

function site(offline: boolean): Plugin {
  return {
    name: 'careershield-site',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const out = html.replace(/%SITE_URL%/g, SITE_URL);
        // the single file has no companion files, so links to them are dropped
        return offline ? out.replace(/<!-- online -->[\s\S]*?<!-- \/online -->/g, '') : out.replace(/ *<!-- \/?online -->\n/g, '');
      },
    },
    generateBundle() {
      if (offline) return;
      const today = new Date().toISOString().slice(0, 10);
      // GitHub Pages serves 404.html for unknown paths; send visitors back to the app's start page
      const basePath = new URL(SITE_URL).pathname;
      this.emitFile({
        type: 'asset',
        fileName: '404.html',
        source: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="robots" content="noindex" />
    <title>CareerShield</title>
    <script>location.replace(${JSON.stringify(basePath)} + location.search + location.hash);</script>
  </head>
  <body><p><a href="${basePath}">Open CareerShield</a></p></body>
</html>
`,
      });
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}sitemap.xml\n` });
      // pages live behind the URL hash, which crawlers ignore, so the sitemap lists the start page
      const urls = `  <url><loc>${SITE_URL}</loc><lastmod>${today}</lastmod></url>`;
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
      });
    },
  };
}

// The heading and body fonts (Red Hat Display and Red Hat Text) are referenced from script, so the browser would find them late; preload
// links in the page let them download alongside the main bundle.
function preloadFonts(): Plugin {
  return {
    name: 'careershield-preload-fonts',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        if (!ctx.bundle) return [];
        return Object.keys(ctx.bundle)
          .filter((f) => /red-hat-(display|text)-latin-wght-normal-[\w-]+\.woff2$/.test(f))
          .map((f) => ({ tag: 'link', attrs: { rel: 'preload', href: './' + f, as: 'font', type: 'font/woff2', crossorigin: '' }, injectTo: 'head' as const }));
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  const offline = mode === 'offline';
  return {
    base: './',
    publicDir: offline ? false : 'public',
    plugins: [
      react(),
      site(offline),
      ...(offline ? [] : [preloadFonts()]),
      ...(offline
        ? [
            viteSingleFile({ removeViteModuleLoader: true }),
            {
              // the single file matches on the main thread, so the worker is never built into it
              name: 'offline-no-match-worker',
              enforce: 'pre' as const,
              resolveId(id: string) {
                return id.endsWith('matchWorker?worker') ? '\0no-match-worker' : null;
              },
              load(id: string) {
                return id === '\0no-match-worker' ? 'export default null;' : null;
              },
            },
            {
              name: 'offline-file-name',
              enforce: 'post' as const,
              generateBundle(_: unknown, bundle: Record<string, { fileName: string }>) {
                const page = bundle['index.html'];
                if (page) page.fileName = 'CareerShield.html';
              },
            },
          ]
        : []),
    ],
    json: { stringify: true },
    define: { __OFFLINE__: JSON.stringify(offline) },
    worker: { format: 'es' },
    build: offline
      ? {
          outDir: 'dist-offline',
          emptyOutDir: true,
          assetsInlineLimit: 100_000_000,
          chunkSizeWarningLimit: 20_000,
          cssCodeSplit: false,
          rollupOptions: { output: { inlineDynamicImports: true } },
        }
      : {
          outDir: 'dist',
          emptyOutDir: true,
          chunkSizeWarningLimit: 4_000,
        },
  };
});
