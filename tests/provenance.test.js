import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const reference = readFileSync(new URL('../reference/van-goghs-town.original.html', import.meta.url));
const original = reference.toString('utf8');
const map = readFileSync(new URL('../src/map.js', import.meta.url), 'utf8');

function fragment(source, start, end) {
  const from = source.indexOf(start);
  assert.ok(from >= 0, `Missing source boundary: ${start}`);
  assert.equal(source.indexOf(start, from + start.length), -1, `Ambiguous source boundary: ${start}`);
  const to = source.indexOf(end, from + start.length);
  assert.ok(to > from, `Missing source boundary: ${end}`);
  return source.slice(from, to + end.length);
}

test('untouched map reference retains the supplied checksum and exact byte length', () => {
  assert.equal(reference.byteLength, 79047);
  assert.equal(createHash('sha256').update(reference).digest('hex'),
    'fae8f5213a56e3b14fea3f5c43860f24896f539daf12874052560b2ed2cf12cd');
});

test('town retains the original deterministic seed and random sequence', () => {
  const begin = 'let rng=18881890;';
  const end = 'const rr=(a,b)=>a+(b-a)*rand(), pick=a=>a[Math.floor(rand()*a.length)];';
  assert.equal(fragment(map, begin, end), fragment(original, begin, end));
});

test('palette, brush shaders, geometry, terrain, landmarks and build order are verbatim', () => {
  const begin = 'const palettes=[';
  const end = 'for(const mesh of brushBatches){mesh.computeBoundingSphere();mesh.boundingSphere.radius+=2;mesh.frustumCulled=true;}';
  const expected = fragment(original, begin, end);
  assert.ok(expected.includes('function terrain(){'));
  assert.ok(expected.includes('terrain();makeSky();makeBedroom();warmHall();makeCafe();makeRhone();makeCountry();makeMarkers();'));
  assert.equal(fragment(map, begin, end), expected);
});
