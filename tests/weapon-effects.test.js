import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Effects} from '../src/weapon-effects.js';

test('prolonged firing reuses fixed pools and match reset removes all effects', () => {
  const scene = new THREE.Scene();
  const effects = new Effects(scene);
  const source = new THREE.Vector3(0, 2, 0), hit = new THREE.Vector3(0, 2, -4), normal = new THREE.Vector3(0, 0, 1);
  const velocity = new THREE.Vector3(2, 2, 0);
  const geometryIds = scene.children.map(mesh => mesh.geometry.uuid);
  for (let i = 0; i < 1200; i++) {
    effects.tracer(source, hit, i % 2);
    effects.impact(hit, normal);
    effects.muzzle(source, i % 2);
    effects.shell(source, velocity, i % 5 ? 'rifle' : 'shotgun');
    effects.update(1 / 120);
  }
  assert.equal(scene.children.length, 6);
  assert.deepEqual(scene.children.map(mesh => mesh.geometry.uuid), geometryIds);
  assert.equal(effects.shellMesh.count, 32);
  assert.equal(effects.decals.count, 72);
  assert.ok(effects.particleGeometry.drawRange.count <= 320);
  assert.ok(effects._smoke.geometry.drawRange.count <= 72);
  assert.ok(effects.tracerGeometry.drawRange.count <= 160);
  effects.clear();
  assert.equal(effects.shellMesh.count, 0);
  assert.equal(effects.decals.count, 0);
  assert.equal(effects.tracerGeometry.drawRange.count, 0);
  assert.equal(effects.particleGeometry.drawRange.count, 0);
  effects.shell(source, velocity);
  assert.equal(effects.shellMesh.count, 1);
  effects.destroy();
  assert.equal(scene.children.length, 0);
});

test('elimination blooms have a fixed pool, preserve sight lines, and fully expire', () => {
  const scene = new THREE.Scene(), effects = new Effects(scene);
  const ids = scene.children.map(mesh => mesh.geometry.uuid);
  const feet = new THREE.Vector3(4, 2, -8);
  for (let i = 0; i < 100; i++) effects.elimination(feet, i % 2);
  effects.update(1 / 60);
  assert.equal(effects._paint.geometry.drawRange.count, 12);
  assert.equal(effects.eliminations.length, 12);
  assert.deepEqual(scene.children.map(mesh => mesh.geometry.uuid), ids);
  assert.equal(effects.particleGeometry.drawRange.count, 0, 'a kill must not create a cloud of tiny particles');
  assert.equal(effects._smoke.geometry.drawRange.count, 0, 'a kill must not conceal the next target in smoke');
  assert.ok(effects.eliminations.every(p => p.position.y > feet.y + 1 && p.position.y < feet.y + 1.1));
  assert.deepEqual(feet.toArray(), [4, 2, -8], 'the actor position must not be mutated');
  for (let i = 0; i < 36; i++) effects.update(1 / 60);
  assert.equal(effects._paint.geometry.drawRange.count, 0);
  assert.ok(effects.eliminations.every(p => p.life === 0));
  effects.elimination(feet, 0);
  effects.update(1 / 60);
  assert.equal(effects._paint.geometry.drawRange.count, 1);
  effects.clear();
  assert.equal(effects._paint.geometry.drawRange.count, 0);
  assert.equal(effects.elimination(new THREE.Vector3(NaN, 1, 1)), false);
  assert.equal(effects.paintBurst(feet, 1), true);
  effects.update(1 / 60);
  assert.equal(effects._paint.geometry.drawRange.count, 1);
  assert.ok(effects.eliminations[0].size > 2);
  assert.ok(effects.eliminations[0].position.y < feet.y + .4);
  for (let i = 0; i < 48; i++) effects.update(1 / 60);
  assert.equal(effects._paint.geometry.drawRange.count, 0);
  effects.destroy();
  assert.equal(effects.elimination(feet), false);
  assert.equal(scene.children.length, 0);
});

test('player frags add a bounded star accent and broad paint flicks without smoke or extra render objects', () => {
  const scene = new THREE.Scene(), effects = new Effects(scene);
  const feet = new THREE.Vector3(3, 1, -5), ids = scene.children.map(mesh => mesh.geometry.uuid);
  assert.equal(effects.elimination(feet, 0, {playerKill: true}), true);
  effects.update(1 / 60);
  assert.equal(effects._paint.geometry.drawRange.count, 1);
  assert.equal(effects._paint.accents[0], 1);
  assert.equal(effects.particleGeometry.drawRange.count, 6, 'one frag makes a few broad strokes');
  assert.ok(effects.particles.filter(p => p.life > 0).every(p => p.size >= .12));
  assert.equal(effects._smoke.geometry.drawRange.count, 0);
  const normalSize = effects.eliminations[0].size;
  effects.clear();
  effects.elimination(feet, 1, {playerKill: true, multi: 3, headshot: true});
  effects.update(1 / 60);
  assert.equal(effects._paint.accents[0], 2, 'precision frag adds the crown glint');
  assert.equal(effects.particleGeometry.drawRange.count, 8);
  assert.ok(effects.eliminations[0].size > normalSize && effects.eliminations[0].size < 2);
  for (let i = 0; i < 1000; i++) effects.elimination(feet, i % 2, {playerKill: true, multi: 100000, headshot: true});
  effects.update(1 / 60);
  assert.equal(effects._paint.geometry.drawRange.count, 12);
  assert.ok(effects.particleGeometry.drawRange.count <= 320);
  assert.deepEqual(scene.children.map(mesh => mesh.geometry.uuid), ids, 'celebrations reuse the existing six render objects');
  assert.deepEqual(feet.toArray(), [3, 1, -5]);
  for (let i = 0; i < 42; i++) effects.update(1 / 60);
  assert.equal(effects._paint.geometry.drawRange.count, 0);
  assert.equal(effects.particleGeometry.drawRange.count, 0, 'every extra stroke expires in under 700ms');
  effects.clear();
  effects.elimination(feet, 0);
  effects.update(1 / 60);
  assert.equal(effects._paint.accents[0], 0, 'a recycled bot bloom never inherits a player crown');
  assert.equal(effects.particleGeometry.drawRange.count, 0);
  effects.clear();
  assert.equal(effects._paint.geometry.drawRange.count, 0);
  const resources = scene.children.flatMap(mesh => [mesh.geometry, mesh.material]);
  const disposed = new Set();
  resources.forEach(resource => resource.addEventListener('dispose', () => disposed.add(resource)));
  effects.destroy();
  assert.equal(disposed.size, new Set(resources).size, 'all celebration GPU resources are disposed');
  assert.equal(scene.children.length, 0);
});

test('casings bounce and settle on elevated map surfaces without tunnelling', () => {
  const events = [];
  const effects = new Effects(new THREE.Scene(), {
    floorHeight: (_x, _z, maxY) => maxY >= 1.25 ? 1.25 : 0,
    onShellBounce: (position, weapon, energy) => events.push({y: position.y, weapon, energy}),
  });
  effects.shell(new THREE.Vector3(0, 2.9, 0), new THREE.Vector3(2.5, 1.4, 0), 'shotgun');
  for (let i = 0; i < 180; i++) effects.update(1 / 60);
  const shell = effects.shells[0];
  assert.equal(shell.sleeping, true);
  assert.ok(Math.abs(shell.position.y - 1.25 - shell.radius) < 1e-7);
  assert.equal(shell.velocity.lengthSq(), 0);
  assert.ok(events.length >= 1 && events.length <= 2);
  assert.equal(events[0].weapon, 'shotgun');
  assert.ok(events[0].energy > .8);
  effects.update(.5);
  assert.ok(Math.abs(shell.position.y - 1.25 - shell.radius) < 1e-7);
  effects.destroy();
});

test('persistent pigment marks match their supplied surface normal', () => {
  const effects = new Effects(new THREE.Scene());
  const hit = new THREE.Vector3(1, 2, 3), normal = new THREE.Vector3(1, 1, 0).normalize();
  effects.decal(hit, normal, 'wood');
  const matrix = new THREE.Matrix4();
  effects.decals.getMatrixAt(0, matrix);
  const location = new THREE.Vector3().setFromMatrixPosition(matrix);
  const planeNormal = new THREE.Vector3(0, 0, 1).transformDirection(matrix);
  assert.ok(planeNormal.dot(normal) > .999999);
  assert.ok(Math.abs(location.distanceTo(hit) - .012) < .000001);
  for (let i = 0; i < 240; i++) effects.update(.1);
  assert.equal(effects.decals.count, 1);
  effects.impact(hit, null, true);
  effects.impact(hit, null, false);
  assert.equal(effects.decals.count, 1, 'unknown normals must not place scars in mid-air');
  effects.decal(hit, new THREE.Vector3());
  assert.equal(effects.decals.count, 1);
  effects.destroy();
});

test('invalid inputs and repeated disposal do not poison subsequent resources', () => {
  const effects = new Effects(new THREE.Scene());
  const invalid = new THREE.Vector3(NaN, 1, 2);
  effects.shell(invalid, new THREE.Vector3());
  effects.tracer(invalid, new THREE.Vector3());
  effects.impact(invalid);
  effects.update(NaN);
  effects.update(-3);
  assert.equal(effects.shellMesh.count, 0);
  assert.equal(effects.tracerGeometry.drawRange.count, 0);
  effects.destroy();
  effects.destroy();
  effects.update(.1);
  effects.shell(new THREE.Vector3(), new THREE.Vector3());
  assert.equal(effects.shellMesh.count, 0);
});
