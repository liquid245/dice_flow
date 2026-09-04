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

function render(out, { theme = 'light', fill = null, view = null, face = null, radius = 0 } = {}) {
  const params = new URLSearchParams();
  params.set('theme', theme);
  if (fill) params.set('fill', String(fill));
  if (view !== null) params.set('view', String(view));
  if (face !== null) params.set('face', String(face));
  if (radius > 0) params.set('radius', String(radius));
  const url = `http://127.0.0.1:${port}/icon-render.html?${params}`;
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
    '--timeout=25000',
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
    '<style>html,body{margin:0;padding:0;width:100%;height:100%;background:transparent;overflow:hidden}canvas{display:block}</style>' +
    '</head><body><script src="./icon-render.bundle.js"></script></body></html>',
);

copyFileSync(join(root, 'public', 'models', 'dice-2.glb'), join(tmp, 'dice-2.glb'));

const server = spawn(process.execPath, ['-e', serverCode], { stdio: 'ignore' });
try {
  await waitForServer();

  const radius = 0.2237;
  const masters = {
    light: { master: join(tmp, 'die-light-master.png'), maskable: join(tmp, 'die-light-maskable.png') },
    dark: { master: join(tmp, 'die-dark-master.png'), maskable: join(tmp, 'die-dark-maskable.png') },
  };

  render(masters.light.master, { theme: 'light', radius });
  render(masters.light.maskable, { theme: 'light', fill: 0.78 });
  render(masters.dark.master, { theme: 'dark', radius });
  render(masters.dark.maskable, { theme: 'dark', fill: 0.78 });

  const iosMaster = join(tmp, 'die-cutout.png');
  render(iosMaster, { theme: 'cutout', fill: 0.78 });

  if (target === 'probe') {
    const probes = [];
    for (let v = 0; v < 7; v++) {
      probes.push(join(tmp, `probe-light-${v}.png`));
    }
    for (let v = 0; v < 7; v++) {
      render(probes[v], { theme: 'light', view: v });
    }
    run('open', ['-a', 'Preview', ...probes]);
    console.log('Probes:', probes.join(' '));
    process.exit(0);
  }

  if (target === 'preview') {
    run('open', ['-a', 'Preview', masters.light.master, masters.dark.master]);
    console.log(`Preview: ${masters.light.master}`);
    console.log(`Open again: open -a Preview ${masters.light.master} ${masters.dark.master}`);
    process.exit(0);
  }

  const resize = (w, h, src, out) => run('sips', ['-z', String(h), String(w), src, '--out', out]);

  const anyOutputs = [
    [512, 512, join(root, 'public', 'icons', 'icon-512.png')],
    [192, 192, join(root, 'public', 'icons', 'icon-192.png')],
  ];
  for (const [w, h, out] of anyOutputs) resize(w, h, iosMaster, out);

  const faviconOutputs = [
    [32, 32, join(root, 'public', 'icons', 'favicon-32.png')],
    [16, 16, join(root, 'public', 'icons', 'favicon-16.png')],
  ];
  for (const [w, h, out] of faviconOutputs) resize(w, h, masters.light.master, out);

  const darkOutputs = [
    [512, 512, join(root, 'public', 'icons', 'icon-dark-512.png')],
    [192, 192, join(root, 'public', 'icons', 'icon-dark-192.png')],
    [32, 32, join(root, 'public', 'icons', 'favicon-32-dark.png')],
    [16, 16, join(root, 'public', 'icons', 'favicon-16-dark.png')],
  ];
  for (const [w, h, out] of darkOutputs) resize(w, h, masters.dark.master, out);

  resize(512, 512, masters.light.maskable, join(root, 'public', 'icons', 'maskable-512.png'));
  resize(512, 512, masters.dark.maskable, join(root, 'public', 'icons', 'maskable-dark-512.png'));

  const iosOutputs = [
    [180, 180, join(root, 'public', 'icons', 'apple-touch-icon-180.png')],
    [152, 152, join(root, 'public', 'icons', 'apple-touch-icon-152.png')],
  ];
  for (const [w, h, out] of iosOutputs) resize(w, h, iosMaster, out);

  console.log('Icons generated.');
} finally {
  server.kill();
}
