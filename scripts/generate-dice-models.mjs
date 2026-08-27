import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const modelsDir = join(root, 'public', 'models');
const src = join(modelsDir, 'dice-2.glb');

const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;
const ROUGHNESS = 0.2;

const variants = [
  { name: 'dice-2.glb', body: [1, 1, 1, 1], pips: [0, 0, 0, 1] },
  { name: 'dice-dark.glb', body: [0, 0, 0, 1], pips: [1, 1, 1, 1] },
  { name: 'dice-tinted.glb', body: [46 / 255, 46 / 255, 54 / 255, 1], pips: [1, 1, 1, 1] },
];

function parseGlb(buf) {
  const magic = buf.readUInt32LE(0);
  if (magic !== 0x46546c67) throw new Error('not a GLB file');
  const version = buf.readUInt32LE(4);
  if (version !== 2) throw new Error(`unsupported GLB version ${version}`);
  let json = null;
  let bin = null;
  let pos = 12;
  while (pos + 8 <= buf.length) {
    const clen = buf.readUInt32LE(pos);
    const ctype = buf.readUInt32LE(pos + 4);
    const chunk = buf.subarray(pos + 8, pos + 8 + clen);
    if (ctype === CHUNK_JSON) json = JSON.parse(chunk.toString('utf8'));
    else if (ctype === CHUNK_BIN) bin = chunk;
    pos += 8 + clen;
  }
  if (!json) throw new Error('no JSON chunk');
  return { json, bin };
}

function buildGlb(json, bin) {
  let jsonBuf = Buffer.from(JSON.stringify(json), 'utf8');
  while (jsonBuf.length % 4 !== 0) jsonBuf = Buffer.concat([jsonBuf, Buffer.from(' ')]);
  const binBuf = bin ? bin : Buffer.alloc(0);
  const total = 12 + 8 + jsonBuf.length + 8 + binBuf.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(total, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonBuf.length, 0);
  jsonHeader.writeUInt32LE(CHUNK_JSON, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binBuf.length, 0);
  binHeader.writeUInt32LE(CHUNK_BIN, 4);
  return Buffer.concat([header, jsonHeader, jsonBuf, binHeader, binBuf]);
}

const { json, bin } = parseGlb(readFileSync(src));

for (const variant of variants) {
  const doc = JSON.parse(JSON.stringify(json));
  for (const material of doc.materials) {
    const pbr = material.pbrMetallicRoughness;
    if (!pbr) continue;
    const color = pbr.baseColorFactor ?? [1, 1, 1, 1];
    const isBody = color[0] + color[1] + color[2] >= 0.9;
    pbr.baseColorFactor = isBody ? variant.body : variant.pips;
    pbr.roughnessFactor = ROUGHNESS;
  }
  const out = join(modelsDir, variant.name);
  writeFileSync(out, buildGlb(doc, bin));
  console.log('wrote', out);
}
