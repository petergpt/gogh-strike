import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {PhysicsWorld} from '../src/physics.js';
import {UtilitySystem, smokeSegmentLength} from '../src/utility.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const actor = (id = 0, team = 0, position = V()) => ({id, team, position, height: 1.8,
  alive: true, yaw: 0, pitch: 0, velocity: V(), utility: {smoke: 1, frag: 1, medkit: 1}, protectedUntil: 3});
function world(wallZ = null) {
  const meshes = [];
  if (wallZ !== null) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(12, 5, .2), new THREE.MeshBasicMaterial());
    wall.position.set(0, 2.5, wallZ); meshes.push(wall);
  }
  return new PhysicsWorld({ground: () => 0, solidMeshes: meshes,
    bounds: {minX: -12, maxX: 12, minZ: -12, maxZ: 12}, navCellSize: 1});
}

test('smoke intersects only the finite sight segment, including endpoints inside a cloud', () => {
  assert.equal(smokeSegmentLength(V(-8), V(8), V(), 5), 10);
  assert.equal(smokeSegmentLength(V(-8), V(-6), V(), 5), 0);
  assert.equal(smokeSegmentLength(V(6), V(8), V(), 5), 0);
  assert.ok(Math.abs(smokeSegmentLength(V(), V(8), V(), 5) - 5) < 1e-9);
  assert.equal(smokeSegmentLength(V(-8, 4), V(8, 4), V(), 5, 3), 0);
  assert.equal(smokeSegmentLength(V(-2), V(2), V(), 5), 4);
});

test('throws consume finite inventory only after succeeding and remove spawn protection', () => {
  const utility = new UtilitySystem(new THREE.Scene(), world());
  const source = actor();
  assert.equal(utility.throw(source, 'medkit', null, 0), false);
  assert.equal(utility.throw(source, 'smoke', V(80, 0, 0), 0), false);
  assert.equal(source.utility.smoke, 1);
  assert.equal(utility.throw(source, 'smoke', V(8, 0, 0), 0), true);
  assert.equal(source.utility.smoke, 0);
  assert.equal(source.protectedUntil, 0);
  assert.equal(utility.throw(source, 'frag', null, .3), false, 'utility recovery stops instant spam');
  assert.equal(source.utility.frag, 1);
  assert.equal(utility.throw(source, 'smoke', null, 1), false);
  source.alive = false;
  assert.equal(utility.throw(source, 'frag', null, 1), false);
  assert.equal(source.utility.frag, 1);
});

test('ballistic grenade sweeps bounce from actual wall geometry and cannot tunnel through', () => {
  const utility = new UtilitySystem(new THREE.Scene(), world(-2));
  assert.equal(utility.throw(actor(), 'frag', null, 0), true);
  let closest = Infinity, bounced = false;
  for (let i = 1; i <= 60; i++) {
    utility.update(1 / 60, i / 60, []);
    const grenade = utility.projectiles[0];
    closest = Math.min(closest, grenade.position.z);
    bounced ||= grenade.bounces > 0;
  }
  assert.ok(closest > -1.91, 'grenade remains on the near side of the solid wall');
  assert.equal(bounced, true);
  assert.ok(utility.projectiles[0].position.y >= .10, 'grenade remains above supporting floor');
});

test('fragment damage has radial falloff, respects solid cover and teammates, and permits self-damage', () => {
  const hits = [], utility = new UtilitySystem(new THREE.Scene(), world(1), {
    onDamage: (victim, amount, source) => hits.push({victim: victim.id, amount, source: source.id}),
  });
  const source = actor(0, 0, V(0, 0, -3));
  const near = actor(1, 1, V(0, 0, -.5)), far = actor(2, 1, V(5, 0, -.5));
  const hidden = actor(3, 1, V(0, 0, 2)), friendly = actor(4, 0, V(0, 0, -.7));
  assert.equal(utility.throw(source, 'frag', null, 0), true);
  const grenade = utility.projectiles[0];
  grenade.position.set(0, .12, 0); grenade.sleeping = true;
  utility.update(0, 2.4, [source, near, far, hidden, friendly]);
  assert.deepEqual(hits.map(h => h.victim).sort(), [0, 1, 2]);
  assert.ok(hits.find(h => h.victim === 1).amount > hits.find(h => h.victim === 2).amount);
  assert.ok(hits.every(h => h.amount > 0 && h.amount <= 90));
  assert.equal(utility.projectiles.length, 0, 'detonated grenade leaves simulation immediately');
});

test('smoke grows into optical cover for fourteen seconds, fades, and clear removes all effects', () => {
  const utility = new UtilitySystem(new THREE.Scene(), world());
  const source = actor();
  utility.throw(source, 'smoke', null, 0);
  const grenade = utility.projectiles[0];
  grenade.position.set(0, .12, 0); grenade.sleeping = true;
  utility.update(0, 1.6, []);
  assert.equal(utility.clouds.length, 1);
  utility.update(0, 2.6, []);
  assert.equal(utility.lineOfSight(V(-8, 1.6), V(8, 1.6)), false);
  assert.equal(utility.lineOfSight(V(-8, 1.6, 8), V(8, 1.6, 8)), true);
  assert.equal(utility.lineOfSight(V(-8, 1.6), V(-6, 1.6)), true, 'cloud beyond target does not occlude');
  assert.ok(utility.obscurity(V(0, 1.6)) > .95);
  assert.equal(utility.obscurity(V(9, 1.6)), 0);
  assert.ok(utility.smokeMesh.count > 0 && utility.smokeMesh.count <= 80);
  utility.update(0, 14.6, []);
  assert.ok(utility.clouds[0].opacity < .4, 'last three seconds visibly fade');
  utility.update(0, 15.6, []);
  assert.equal(utility.clouds.length, 0);
  assert.equal(utility.lineOfSight(V(-8, 1.6), V(8, 1.6)), true);
  source.utility.frag = 1;
  assert.equal(utility.throw(source, 'frag', null, 16), true);
  utility.clear();
  assert.deepEqual(utility.getState(), {projectiles: [], clouds: []});
  assert.equal(utility.smokeMesh.count, 0);
  assert.equal(utility.smokeMesh.visible, false);
});

test('wall cover still blocks sight when there is no smoke', () => {
  const utility = new UtilitySystem(new THREE.Scene(), world(1));
  assert.equal(utility.lineOfSight(V(0, 1.6, 0), V(0, 1.6, 2)), false);
});
