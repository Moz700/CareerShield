// Minimal static server that behaves like GitHub Pages: the site lives under a sub-path and unknown
// paths get 404.html with status 404. Used by the end-to-end tests; no dependencies.
const http = require('http');
const fs = require('fs');
const path = require('path');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json', '.txt': 'text/plain', '.xml': 'application/xml', '.ico': 'image/x-icon',
};

function serve(root, base = '/CareerShield/', port = 0) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const notFound = () => {
      const p = path.join(root, '404.html');
      res.writeHead(404, { 'content-type': TYPES['.html'] });
      res.end(fs.existsSync(p) ? fs.readFileSync(p) : 'not found');
    };
    if (!url.startsWith(base)) return notFound();
    let rel = url.slice(base.length) || 'index.html';
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.normalize(path.join(root, rel));
    if (!file.startsWith(path.normalize(root)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return notFound();
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}${base}` })));
}

module.exports = { serve };

if (require.main === module) {
  const root = process.argv[2] || path.join(__dirname, '..', 'dist');
  serve(root, process.argv[3] || '/CareerShield/', +(process.argv[4] || 4180)).then(({ url }) => console.log('serving', root, 'at', url));
}
