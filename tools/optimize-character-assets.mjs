#!/usr/bin/env node
/** Losslessly share embedded character PNGs. No mesh, material or image conversion. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const options = {
  assets: 'assets/characters',
  backup: 'work/deployment/original-embedded-heads',
  report: 'work/deployment/head-texture-dedup.json',
};
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i].replace(/^--/, '');
  if (!(key in options) || !process.argv[i + 1]) {
    throw new Error('Usage: node tools/optimize-character-assets.mjs [--assets PATH] [--backup PATH] [--report PATH]');
  }
  options[key] = process.argv[i + 1];
}
const assets = path.resolve(options.assets);
const backup = path.resolve(options.backup);
assert.notEqual(assets, backup, 'Backup must be separate from production assets');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
const align4 = n => (n + 3) & ~3;
const canonical = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);

function parse(bytes) {
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, 'Expected GLB');
  assert.equal(bytes.readUInt32LE(4), 2, 'Expected glTF 2');
  assert.equal(bytes.readUInt32LE(8), bytes.length, 'Invalid GLB length');
  const chunks = [];
  for (let offset = 12; offset < bytes.length;) {
    const length = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4);
    assert.equal(length % 4, 0, 'Unaligned GLB chunk');
    assert.ok(offset + 8 + length <= bytes.length, 'Truncated GLB chunk');
    chunks.push({type, bytes: bytes.subarray(offset + 8, offset + 8 + length)});
    offset += length + 8;
  }
  assert.equal(chunks.length, 2, 'Only standard JSON and BIN chunks are supported');
  assert.equal(chunks[0].type, 0x4e4f534a);
  assert.equal(chunks[1].type, 0x004e4942);
  const doc = JSON.parse(chunks[0].bytes.toString('utf8'));
  assert.equal(doc.buffers.length, 1, 'Only one embedded buffer is supported');
  assert.equal(doc.buffers[0].uri, undefined);
  assert.ok(doc.buffers[0].byteLength <= chunks[1].bytes.length);
  assert.ok(chunks[1].bytes.length - doc.buffers[0].byteLength < 4);
  // These extensions address byte ranges directly, so fail rather than relocate them incorrectly.
  assert.ok(!(doc.extensionsUsed || []).some(name => /meshopt|draco/i.test(name)), 'Compressed buffer extensions are not supported');
  return {doc, bin: chunks[1].bytes.subarray(0, doc.buffers[0].byteLength), bytes};
}

function viewBytes(model, index) {
  const view = model.doc.bufferViews[index];
  assert.ok(view, `Missing bufferView ${index}`);
  assert.equal(view.buffer, 0);
  const start = view.byteOffset || 0, end = start + view.byteLength;
  assert.ok(start >= 0 && end <= model.bin.length, `Invalid bufferView ${index}`);
  return model.bin.subarray(start, end);
}

async function imageBytes(model, image, directory) {
  if (image.bufferView !== undefined) return viewBytes(model, image.bufferView);
  assert.equal(typeof image.uri, 'string', 'Image has no data');
  assert.ok(!image.uri.includes(':') && !image.uri.startsWith('/'), 'Only local relative image files are supported');
  const resolved = path.resolve(directory, image.uri);
  assert.ok(resolved.startsWith(directory + path.sep), 'Image URI leaves asset directory');
  return fs.readFile(resolved);
}

const componentBytes = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4};
function layout(accessor) {
  const size = componentBytes[accessor.componentType];
  assert.ok(size, 'Unsupported accessor component type');
  const vector = {SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4}[accessor.type];
  if (vector) return {offsets: Array.from({length: vector}, (_, i) => i * size), stride: size * vector, size};
  const dim = {MAT2: 2, MAT3: 3, MAT4: 4}[accessor.type];
  assert.ok(dim, 'Unsupported accessor shape');
  const columnStride = align4(dim * size);
  return {offsets: Array.from({length: dim * dim}, (_, i) => Math.floor(i / dim) * columnStride + (i % dim) * size), stride: columnStride * dim, size};
}

// Compare logical accessor components, including interleaved data, sparse replacements
// and padded matrix columns. Float bytes are never decoded/re-encoded or rounded.
function decodeAccessor(model, accessor) {
  const info = layout(accessor), elementBytes = info.offsets.length * info.size;
  const output = Buffer.alloc(accessor.count * elementBytes);
  function copyElement(source, base, destinationIndex) {
    for (let c = 0; c < info.offsets.length; c++) {
      const start = base + info.offsets[c];
      assert.ok(start >= 0 && start + info.size <= source.length, 'Accessor exceeds its bufferView');
      source.copy(output, destinationIndex * elementBytes + c * info.size, start, start + info.size);
    }
  }
  if (accessor.bufferView !== undefined) {
    const source = viewBytes(model, accessor.bufferView);
    const stride = model.doc.bufferViews[accessor.bufferView].byteStride || info.stride;
    for (let i = 0; i < accessor.count; i++) copyElement(source, (accessor.byteOffset || 0) + i * stride, i);
  }
  if (accessor.sparse) {
    const {count, indices, values} = accessor.sparse;
    const source = viewBytes(model, indices.bufferView), replacements = viewBytes(model, values.bufferView);
    const width = componentBytes[indices.componentType];
    assert.ok([5121, 5123, 5125].includes(indices.componentType));
    for (let i = 0; i < count; i++) {
      const at = (indices.byteOffset || 0) + i * width;
      const index = source.readUIntLE(at, width);
      assert.ok(index < accessor.count, 'Sparse accessor index out of range');
      copyElement(replacements, (values.byteOffset || 0) + i * info.stride, index);
    }
  }
  return output;
}

async function semanticSignature(model, directory) {
  const doc = clone(model.doc);
  const imageViews = new Set(doc.images.filter(image => image.bufferView !== undefined).map(image => image.bufferView));
  const views = doc.bufferViews.map((view, index) => {
    const result = {...view, dataSha256: hash(viewBytes(model, index))};
    delete result.byteOffset; delete result.buffer;
    return result;
  });
  doc.images = await Promise.all(doc.images.map(async image => {
    const result = {...image, dataSha256: hash(await imageBytes(model, image, directory))};
    delete result.uri; delete result.bufferView;
    return result;
  }));
  doc.bufferViews = views.filter((_, index) => !imageViews.has(index));
  delete doc.buffers[0].byteLength;
  function expand(value) {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(expand);
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key,
      key === 'bufferView' && Number.isInteger(entry) ? views[entry] : expand(entry)]));
  }
  return hash(canonical(expand(doc)));
}

function encode(doc, bin) {
  const json = Buffer.from(JSON.stringify(doc));
  const jsonPadded = Buffer.alloc(align4(json.length), 0x20); json.copy(jsonPadded);
  const binPadded = Buffer.alloc(align4(bin.length)); bin.copy(binPadded);
  const output = Buffer.alloc(12 + 8 + jsonPadded.length + 8 + binPadded.length);
  output.writeUInt32LE(0x46546c67, 0); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(jsonPadded.length, 12); output.writeUInt32LE(0x4e4f534a, 16); jsonPadded.copy(output, 20);
  const at = 20 + jsonPadded.length;
  output.writeUInt32LE(binPadded.length, at); output.writeUInt32LE(0x004e4942, at + 4); binPadded.copy(output, at + 8);
  return output;
}

async function optimize(model, directory, shared) {
  const doc = clone(model.doc), imageViews = new Set();
  for (const image of doc.images) {
    assert.equal(image.mimeType, 'image/png', 'Only existing PNG images are supported');
    const bytes = await imageBytes(model, image, directory), sha256 = hash(bytes);
    assert.ok(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'Image is not PNG');
    if (image.bufferView !== undefined) imageViews.add(image.bufferView);
    delete image.bufferView;
    image.uri = `textures/${sha256}.png`;
    shared.set(sha256, bytes);
  }
  const remap = new Map(), views = [], chunks = [];
  let length = 0;
  model.doc.bufferViews.forEach((view, index) => {
    if (imageViews.has(index)) return;
    const aligned = align4(length);
    if (aligned !== length) chunks.push(Buffer.alloc(aligned - length));
    const bytes = viewBytes(model, index);
    remap.set(index, views.length);
    views.push({...view, byteOffset: aligned}); chunks.push(bytes); length = aligned + bytes.length;
  });
  // Every remaining bufferView reference is remapped, including sparse/morph data
  // and extension references. An image view reused for mesh data fails closed.
  function remapReferences(value) {
    if (!value || typeof value !== 'object') return;
    for (const [key, entry] of Object.entries(value)) {
      if (key === 'bufferView' && Number.isInteger(entry)) {
        assert.ok(remap.has(entry), 'An image bufferView is also used by non-image data');
        value[key] = remap.get(entry);
      } else remapReferences(entry);
    }
  }
  remapReferences(doc);
  doc.bufferViews = views; doc.buffers[0].byteLength = length;
  return parse(encode(doc, Buffer.concat(chunks)));
}

async function exists(file) { try { await fs.access(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } }
async function writeAtomic(file, bytes) {
  await fs.mkdir(path.dirname(file), {recursive: true});
  const temporary = `${file}.tmp-${process.pid}`;
  await fs.writeFile(temporary, bytes); await fs.rename(temporary, file);
}

const names = (await fs.readdir(assets)).filter(name => name.endsWith('-head.glb')).sort();
assert.ok(names.length, 'No character heads found');
await fs.mkdir(backup, {recursive: true});
const manifestFile = path.join(assets, 'manifest.json');
const backupManifest = path.join(backup, 'manifest.json');
if (await exists(manifestFile) && !(await exists(backupManifest))) await fs.copyFile(manifestFile, backupManifest, 1);
const shared = new Map(), records = [], pending = [];
for (const name of names) {
  const currentPath = path.join(assets, name), originalPath = path.join(backup, name);
  const current = parse(await fs.readFile(currentPath));
  if (!(await exists(originalPath))) {
    assert.ok(current.doc.images.every(image => image.bufferView !== undefined), 'First optimization requires original embedded heads for a complete backup');
    await fs.copyFile(currentPath, originalPath, 1);
  }
  const original = parse(await fs.readFile(originalPath));
  const originalSemantic = await semanticSignature(original, backup);
  assert.equal(await semanticSignature(current, assets), originalSemantic, `${name} differs from its backup; use a fresh --backup for a newly sculpted cast`);
  const optimized = await optimize(current, assets, shared);
  // Resolve the new shared images without writing production files during preflight.
  const accessorHashes = original.doc.accessors.map((accessor, index) => {
    const before = decodeAccessor(original, accessor), after = decodeAccessor(optimized, optimized.doc.accessors[index]);
    assert.ok(before.equals(after), `${name} accessor ${index} changed`);
    return hash(before);
  });
  for (let i = 0; i < original.doc.images.length; i++) {
    const originalImage = await imageBytes(original, original.doc.images[i], backup);
    assert.ok(originalImage.equals(shared.get(path.basename(optimized.doc.images[i].uri, '.png'))), `${name} image ${i} changed`);
  }
  const record = {
    file: name, beforeBytes: original.bytes.length, afterBytes: optimized.bytes.length,
    beforeSha256: hash(original.bytes), afterSha256: hash(optimized.bytes),
    semanticSha256: originalSemantic,
    accessorCount: accessorHashes.length, accessorSha256: accessorHashes,
    images: optimized.doc.images.map(image => ({name: image.name, uri: image.uri, sha256: path.basename(image.uri, '.png')})),
  };
  records.push(record); pending.push({currentPath, current, optimized, record});
}
// Save content-addressed files only after every head passes accessor/image preflight.
for (const [sha256, bytes] of shared) {
  const file = path.join(assets, 'textures', `${sha256}.png`);
  if (await exists(file)) assert.ok((await fs.readFile(file)).equals(bytes), `Shared texture hash collision: ${file}`);
  else await writeAtomic(file, bytes);
}
for (const item of pending) {
  assert.equal(await semanticSignature(item.optimized, assets), item.record.semanticSha256, `${item.record.file} semantic change`);
}
for (const item of pending) if (!item.current.bytes.equals(item.optimized.bytes)) await writeAtomic(item.currentPath, item.optimized.bytes);

const beforeBytes = records.reduce((sum, record) => sum + record.beforeBytes, 0);
const headBytes = records.reduce((sum, record) => sum + record.afterBytes, 0);
const textureBytes = [...shared.values()].reduce((sum, bytes) => sum + bytes.length, 0);
const summary = {
  method: 'Lossless shared external PNG textures; embedded geometry and all image bytes preserved',
  characterCount: records.length, uniqueTextures: shared.size, beforeBytes,
  headBytes, textureBytes, afterBytes: headBytes + textureBytes,
  savedBytes: beforeBytes - headBytes - textureBytes,
  reductionPercent: Number(((1 - (headBytes + textureBytes) / beforeBytes) * 100).toFixed(3)),
};
if (await exists(manifestFile)) {
  const originalManifest = JSON.parse(await fs.readFile(backupManifest, 'utf8'));
  const manifest = clone(originalManifest);
  for (const character of manifest.characters) {
    const record = records.find(entry => entry.file === character.file);
    assert.ok(record, `Manifest character has no head: ${character.id}`);
    character.bytes = record.afterBytes;
  }
  manifest.optimization = {...summary, textures: [...shared].map(([sha256, bytes]) => ({file: `textures/${sha256}.png`, bytes: bytes.length, sha256})).sort((a, b) => a.file.localeCompare(b.file))};
  await writeAtomic(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
}
await writeAtomic(path.resolve(options.report), JSON.stringify({summary, characters: records, verification: {decodedAccessorsIdentical: true, imageBytesIdentical: true, semanticDocumentsIdentical: true}}, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
