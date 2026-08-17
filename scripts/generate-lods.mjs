import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { BufferGeometry, BufferAttribute } from 'three';
import { SimplifyModifier } from 'three/examples/jsm/modifiers/SimplifyModifier.js';

const SOURCE_DIR = new URL('../assets/models/', import.meta.url).pathname;
const OUT_DIR = new URL('../public/models/lod/', import.meta.url).pathname;

// Keep-ratios per LOD level. LOD 0 is an exact copy of the source model.
const LOD_RATIOS = [1, 0.4, 0.15];

const COMPONENT = {
  BYTE: 5120,
  UNSIGNED_BYTE: 5121,
  SHORT: 5122,
  UNSIGNED_SHORT: 5123,
  UNSIGNED_INT: 5125,
  FLOAT: 5126,
};

const COMPONENT_SIZE = {
  [COMPONENT.BYTE]: 1,
  [COMPONENT.UNSIGNED_BYTE]: 1,
  [COMPONENT.SHORT]: 2,
  [COMPONENT.UNSIGNED_SHORT]: 2,
  [COMPONENT.UNSIGNED_INT]: 4,
  [COMPONENT.FLOAT]: 4,
};

const TYPE_COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

const ATTR_MAP = { position: 'POSITION', normal: 'NORMAL', tangent: 'TANGENT', uv: 'TEXCOORD_0', color: 'COLOR_0' };

function parseGlb(bytes) {
  const magic = bytes.readUInt32LE(0);
  if (magic !== 0x46546c67) throw new Error('Not a GLB file');
  const jsonChunkLength = bytes.readUInt32LE(12);
  const jsonType = bytes.readUInt32LE(16);
  if (jsonType !== 0x4e4f534a) throw new Error('Missing JSON chunk');
  const json = JSON.parse(bytes.toString('utf8', 20, 20 + jsonChunkLength));

  const offset = 20 + jsonChunkLength;
  const binType = bytes.readUInt32LE(offset + 4);
  if (binType !== 0x004e4942) throw new Error('Missing BIN chunk');
  const binStart = offset + 8;
  const binLength = json.buffers?.[0]?.byteLength ?? 0;
  const bin = bytes.subarray(binStart, binStart + binLength);
  return { json, bin };
}

function typedArrayFor(componentType, length) {
  switch (componentType) {
    case COMPONENT.BYTE:
      return new Int8Array(length);
    case COMPONENT.UNSIGNED_BYTE:
      return new Uint8Array(length);
    case COMPONENT.SHORT:
      return new Int16Array(length);
    case COMPONENT.UNSIGNED_SHORT:
      return new Uint16Array(length);
    case COMPONENT.UNSIGNED_INT:
      return new Uint32Array(length);
    case COMPONENT.FLOAT:
      return new Float32Array(length);
    default:
      throw new Error(`Unsupported componentType ${componentType}`);
  }
}

function readAccessor(json, bin, accessorIndex) {
  const accessor = json.accessors[accessorIndex];
  const bufferView = json.bufferViews[accessor.bufferView];
  const componentType = accessor.componentType;
  const numComponents = TYPE_COMPONENTS[accessor.type];
  const componentBytes = COMPONENT_SIZE[componentType];
  const stride = bufferView.byteStride ?? numComponents * componentBytes;
  const byteStart = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const count = accessor.count * numComponents;
  const result = typedArrayFor(componentType, count);
  const view = new DataView(bin.buffer, bin.byteOffset + byteStart);
  const read = (off) => {
    switch (componentType) {
      case COMPONENT.FLOAT:
        return view.getFloat32(off, true);
      case COMPONENT.UNSIGNED_INT:
        return view.getUint32(off, true);
      case COMPONENT.UNSIGNED_SHORT:
        return view.getUint16(off, true);
      case COMPONENT.SHORT:
        return view.getInt16(off, true);
      case COMPONENT.UNSIGNED_BYTE:
        return view.getUint8(off);
      default:
        return view.getInt8(off);
    }
  };
  for (let i = 0; i < accessor.count; i++) {
    const base = i * stride;
    for (let c = 0; c < numComponents; c++) {
      result[i * numComponents + c] = read(base + c * componentBytes);
    }
  }
  return result;
}

function geometryFromPrimitive(json, bin, primitive) {
  const geometry = new BufferGeometry();
  const attributes = primitive.attributes ?? {};
  const add = (accessorIndex, name) => {
    if (accessorIndex == null) return;
    const accessor = json.accessors[accessorIndex];
    geometry.setAttribute(name, new BufferAttribute(readAccessor(json, bin, accessorIndex), TYPE_COMPONENTS[accessor.type]));
  };
  add(attributes.POSITION, 'position');
  add(attributes.NORMAL, 'normal');
  add(attributes.TANGENT, 'tangent');
  add(attributes.TEXCOORD_0, 'uv');
  add(attributes.COLOR_0, 'color');
  if (primitive.indices != null) {
    geometry.setIndex(new BufferAttribute(readAccessor(json, bin, primitive.indices), 1));
  }
  return geometry;
}

function positionBounds(array) {
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < array.length; i += 3) {
    for (let c = 0; c < 3; c++) {
      if (array[i + c] < min[c]) min[c] = array[i + c];
      if (array[i + c] > max[c]) max[c] = array[i + c];
    }
  }
  return { min, max };
}

function serializeGeometry(geometry) {
  const attributes = {};
  for (const name of Object.keys(geometry.attributes)) {
    const gltfName = ATTR_MAP[name];
    if (!gltfName) continue;
    const attribute = geometry.attributes[name];
    const entry = {
      array: attribute.array,
      componentType: COMPONENT.FLOAT,
      type: attribute.itemSize === 4 ? 'VEC4' : attribute.itemSize === 3 ? 'VEC3' : attribute.itemSize === 2 ? 'VEC2' : 'SCALAR',
    };
    if (gltfName === 'POSITION') {
      const bounds = positionBounds(attribute.array);
      entry.min = bounds.min;
      entry.max = bounds.max;
    }
    attributes[gltfName] = entry;
  }
  let index = null;
  if (geometry.index) {
    const array = geometry.index.array;
    let max = 0;
    for (let i = 0; i < array.length; i++) if (array[i] > max) max = array[i];
    index = {
      array: max < 65536 ? new Uint16Array(array) : new Uint32Array(array),
      componentType: max < 65536 ? COMPONENT.UNSIGNED_SHORT : COMPONENT.UNSIGNED_INT,
      type: 'SCALAR',
    };
  }
  return { attributes, index };
}

// Rewrites the source GLB keeping only image buffer views (textures) plus the
// decimated geometry, dropping the original geometry so LOD files stay small.
function buildLodGlb(source, decimated) {
  const { json, bin } = parseGlb(source);

  const imageViews = [];
  const imageViewOrder = new Map();
  for (const image of json.images ?? []) {
    if (image.bufferView == null || imageViewOrder.has(image.bufferView)) continue;
    imageViewOrder.set(image.bufferView, imageViews.length);
    const view = json.bufferViews[image.bufferView];
    imageViews.push(bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength));
  }

  const parts = [];
  const newBufferViews = [];
  const newAccessors = [];
  let cursor = 0;
  const align4 = () => {
    const pad = (4 - (cursor % 4)) % 4;
    if (pad > 0) {
      parts.push(Buffer.alloc(pad));
      cursor += pad;
    }
  };
  const append = (typedArray, componentType, type, min, max) => {
    align4();
    const bytes = Buffer.from(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
    newBufferViews.push({ buffer: 0, byteOffset: cursor, byteLength: bytes.byteLength });
    const accessor = {
      bufferView: newBufferViews.length - 1,
      componentType,
      count: typedArray.length / TYPE_COMPONENTS[type],
      type,
    };
    if (min) accessor.min = min;
    if (max) accessor.max = max;
    newAccessors.push(accessor);
    parts.push(bytes);
    cursor += bytes.byteLength;
    return newAccessors.length - 1;
  };

  const newImageViewIndex = [];
  for (const bytes of imageViews) {
    align4();
    newImageViewIndex.push(newBufferViews.length);
    newBufferViews.push({ buffer: 0, byteOffset: cursor, byteLength: bytes.byteLength });
    parts.push(bytes);
    cursor += bytes.byteLength;
  }

  let primitiveIndex = 0;
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      const dec = decimated[primitiveIndex++];
      if (!dec) continue;
      const attributes = {};
      for (const name of Object.keys(dec.attributes)) {
        const a = dec.attributes[name];
        attributes[name] = append(a.array, a.componentType, a.type, a.min, a.max);
      }
      primitive.attributes = attributes;
      if (dec.index) {
        primitive.indices = append(dec.index.array, dec.index.componentType, dec.index.type);
      } else {
        delete primitive.indices;
      }
      delete primitive.targets;
    }
  }

  for (const image of json.images ?? []) {
    if (image.bufferView != null) image.bufferView = newImageViewIndex[imageViewOrder.get(image.bufferView)];
  }

  json.bufferViews = newBufferViews;
  json.accessors = newAccessors;
  json.buffers[0].byteLength = cursor;
  return writeGlb(json, Buffer.concat(parts));
}

function writeGlb(json, bin) {
  const jsonStr = JSON.stringify(json);
  const jsonPad = (4 - (jsonStr.length % 4)) % 4;
  const jsonChunk = Buffer.from(jsonStr + ' '.repeat(jsonPad), 'utf8');
  const binPad = (4 - (bin.length % 4)) % 4;
  const binChunk = Buffer.concat([bin, Buffer.alloc(binPad)]);
  const total = 12 + 8 + jsonChunk.length + 8 + binChunk.length;
  const out = Buffer.alloc(total);
  out.writeUInt32LE(0x46546c67, 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(total, 8);
  out.writeUInt32LE(jsonChunk.length, 12);
  out.writeUInt32LE(0x4e4f534a, 16);
  jsonChunk.copy(out, 20);
  const o = 20 + jsonChunk.length;
  out.writeUInt32LE(binChunk.length, o);
  out.writeUInt32LE(0x004e4942, o + 4);
  binChunk.copy(out, o + 8);
  return out;
}

function vertexCount(json) {
  let count = 0;
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      if (primitive.attributes?.POSITION != null) count += json.accessors[primitive.attributes.POSITION].count;
    }
  }
  return count;
}

function simplify(modifier, geometry, ratio) {
  const count = geometry.attributes.position?.count ?? 0;
  if (count === 0) return geometry;
  const collapses = Math.max(1, Math.round(count * (1 - ratio)));
  const simplified = modifier.modify(geometry, collapses);
  if (simplified.attributes.position?.count === 0) return simplified;
  // SimplifyModifier corrupts tangent handedness (w) by averaging Vector4 w;
  // regenerate tangents from position/normal/uv so normal maps stay clean.
  simplified.deleteAttribute('tangent');
  if (simplified.index && simplified.attributes.normal && simplified.attributes.uv) {
    simplified.computeTangents();
  }
  return simplified;
}

function processModel(sourceBytes, name) {
  const { json, bin } = parseGlb(sourceBytes);
  const sourceVertices = vertexCount(json);

  const geometries = [];
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      geometries.push(geometryFromPrimitive(json, bin, primitive));
    }
  }

  const modifier = new SimplifyModifier();
  const lods = [];
  for (let level = 0; level < LOD_RATIOS.length; level++) {
    const ratio = LOD_RATIOS[level];
    const file = `${name}.lod${level}.glb`;
    if (ratio >= 1) {
      writeFileSync(join(OUT_DIR, file), sourceBytes);
      lods.push({ file, vertices: sourceVertices });
      continue;
    }
    const simplified = geometries.map((geometry) => serializeGeometry(simplify(modifier, geometry, ratio)));
    writeFileSync(join(OUT_DIR, file), buildLodGlb(sourceBytes, simplified));
    const vertices = simplified.reduce((sum, s) => sum + (s.attributes.POSITION?.array.length ?? 0) / 3, 0);
    lods.push({ file, vertices: Math.round(vertices) });
  }
  return lods;
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const files = readdirSync(SOURCE_DIR).filter((f) => f.toLowerCase().endsWith('.glb'));
  if (files.length === 0) {
    console.log('generate-lods: no .glb models found in assets/models/');
    return;
  }
  const models = [];
  for (const file of files) {
    const name = basename(file, '.glb');
    const sourceBytes = readFileSync(join(SOURCE_DIR, file));
    const lods = processModel(sourceBytes, name);
    models.push({ name, source: file, lods });
    console.log(`generate-lods: ${file} -> ${lods.map((l) => `${l.file} (${l.vertices} verts)`).join(', ')}`);
  }
  writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify({ models }, null, 2));
  console.log(`generate-lods: wrote ${models.length} model(s) to public/models/lod/`);
}

main();
