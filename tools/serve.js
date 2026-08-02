import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

const ROOT = new URL('../src/', import.meta.url);
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let p = decodeURIComponent(url.pathname);
    if (p === '/') p = '/index.html';
    const file = await readFile(new URL('.' + p, ROOT));
    res.setHeader('Content-Type', MIME[extname(p)] ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.end(file);
  } catch (e) {
    res.statusCode = 404;
    res.end('404');
  }
}).listen(8000, () => console.log('dev: http://localhost:8000/'));
