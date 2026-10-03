import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.PORT || 4173);
const pages = new Set(['index.html', 'styles.css', 'script.js', 'pinball.js', 'cards.js', 'gallery.js']);
const asset = /^(?:assets\/vincent-spiderman-sanitized\.png|assets\/(?:art|memories|pokemon|hero|fonts|planet-voices|theme)\/[a-zA-Z0-9._-]+\.(?:jpg|png|webp|mp3|woff2|txt))$/;
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };

const server = http.createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    return response.end();
  }
  let relative;
  try {
    relative = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\//, '') || 'index.html';
  } catch {
    response.writeHead(400);
    return response.end('Bad request');
  }
  // Only public assets are previewed; originals, scripts, and .git stay private.
  if (!pages.has(relative) && !asset.test(relative)) {
    response.writeHead(404);
    return response.end('Not found');
  }
  try {
    const content = await readFile(path.join(root, relative));
    response.writeHead(200, { 'Content-Type': types[path.extname(relative)], 'Content-Length': content.length });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Vincent's little world: http://127.0.0.1:${server.address().port}`);
});
