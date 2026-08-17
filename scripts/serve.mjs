import { readFileSync, existsSync, statSync } from 'node:fs';
import { createServer as createHttpsServer } from 'node:https';
import { join, normalize, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', 'dist');
const certPath = join(here, '..', 'certs', 'cert.pem');
const keyPath = join(here, '..', 'certs', 'key.pem');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.glb': 'model/gltf-binary',
  '.wav': 'audio/wav',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function lanIp() {
  const ifaces = networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

function handler(req, res) {
  let pathname = new URL(req.url, 'http://localhost').pathname;
  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    res.writeHead(400);
    res.end();
    return;
  }
  if (pathname.endsWith('/')) pathname += 'index.html';

  let filePath = normalize(join(root, pathname));
  if (!filePath.startsWith(root) || (!existsSync(filePath) || !statSync(filePath).isFile())) {
    filePath = join(root, 'index.html');
  }

  const ext = extname(filePath);
  res.writeHead(200, {
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
    'Cache-Control': 'no-cache',
  });
  res.end(readFileSync(filePath));
}

if (!existsSync(certPath) || !existsSync(keyPath)) {
  console.error('No TLS cert found. Run: make cert');
  process.exit(1);
}

const PORT = 8443;
createHttpsServer(
  { key: readFileSync(keyPath), cert: readFileSync(certPath) },
  handler,
).listen(PORT, '0.0.0.0', () => {
  console.log('DiceFlow serving dist/ over HTTPS');
  console.log(`  Local:  https://localhost:${PORT}`);
  console.log(`  Phone:  https://${lanIp()}:${PORT}`);
  console.log('Trust the mkcert CA on the phone first (see README).');
});
