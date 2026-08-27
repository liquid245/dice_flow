import { spawnSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { get } from 'node:http';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const rolldown = join(root, 'node_modules', '.bin', 'rolldown');
const tmp = '/tmp/dice-flow-icons';
const port = 8123;

const target = process.argv[2] ?? 'all';

function run(cmd, args) {
  const res = spawnSync(cmd, args, { stdio: 'inherit' });
  if (res.status !== 0) {
    console.error(`Failed: ${cmd} ${args.join(' ')}`);
    process.exit(res.status ?? 1);
  }
}

function waitForServer() {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 5000;
    const attempt = () => {
      const req = get(`http://127.0.0.1:${port}/icon-render.html`, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() > deadline) reject(new Error('icon server did not start'));
        else setTimeout(attempt, 100);
      });
    };
    attempt();
  });
}

function render(out, fill) {
  const query = fill ? `?fill=${fill}` : '';
  const url = `http://127.0.0.1:${port}/icon-render.html${query}`;
  run(chrome, [
    '--headless=new',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--run-all-compositor-stages-before-draw',
    '--window-size=1024,1024',
    '--default-background-color=00000000',
    '--virtual-time-budget=15000',
    `--screenshot=${out}`,
    url,
  ]);
}

mkdirSync(tmp, { recursive: true });

const serverCode = `
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = ${JSON.stringify(tmp)};
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.png': 'image/png' };
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = decodeURIComponent(url.pathname) === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  fs.readFile(path.join(root, p), (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(p)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(${port});
`;

writeFileSync(
  join(tmp, 'rolldown.config.mjs'),
  [
    'export default {',
    "  input: " + JSON.stringify(join(here, 'icon-render.ts')) + ',',
    "  platform: 'browser',",
    '  output: {',
    "    file: " + JSON.stringify(join(tmp, 'icon-render.bundle.js')) + ',',
    "    format: 'iife',",
    '  },',
    '};',
  ].join('\n'),
);

run(rolldown, ['--config', join(tmp, 'rolldown.config.mjs')]);

writeFileSync(
  join(tmp, 'icon-render.html'),
  '<!doctype html><html><head><meta charset="utf-8">' +
    '<style>html,body{margin:0;padding:0;width:100%;height:100%;background:transparent;overflow:hidden}canvas{display:block;border-radius:22.37%}</style>' +
    '</head><body><script src="./icon-render.bundle.js"></script></body></html>',
);

copyFileSync(join(root, 'public', 'models', 'dice-2.glb'), join(tmp, 'dice-2.glb'));

const server = spawn(process.execPath, ['-e', serverCode], { stdio: 'ignore' });
try {
  await waitForServer();

  const master = join(tmp, 'die-master.png');
  render(master, null);

  if (target === 'preview') {
    run('open', ['-a', 'Preview', master]);
    console.log(`Preview: ${master}`);
    console.log(`Open again: open -a Preview ${master}`);
    process.exit(0);
  }

  const maskableMaster = join(tmp, 'die-maskable-master.png');
  render(maskableMaster, 0.78);

  const icons = [
    [512, 512, join(root, 'public', 'icons', 'icon-512.png')],
    [192, 192, join(root, 'public', 'icons', 'icon-192.png')],
    [32, 32, join(root, 'public', 'icons', 'favicon-32.png')],
    [16, 16, join(root, 'public', 'icons', 'favicon-16.png')],
    [180, 180, join(root, 'public', 'apple-touch-icon.png')],
  ];
  for (const [w, h, out] of icons) run('sips', ['-z', String(h), String(w), master, '--out', out]);

  run('sips', ['-z', '512', '512', maskableMaster, '--out', join(root, 'public', 'icons', 'maskable-512.png')]);

  console.log('Icons generated.');
} finally {
  server.kill();
}
