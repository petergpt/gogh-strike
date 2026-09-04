import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {PhysicsWorld} from '../src/physics.js';

function box(x, y, z, w, h, d) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial());
  mesh.position.set(x, y, z);
  return mesh;
}

function world(meshes) {
  return new PhysicsWorld({ground: () => 0, solidMeshes: meshes,
    bounds: {minX: -9, maxX: 9, minZ: -9, maxZ: 9}, navCellSize: .5});
}

test('real door geometry blocks wall shots and permits doorway shots and movement', () => {
  const physics = world([box(-3, 2, 0, 4, 4, .18), box(3, 2, 0, 4, 4, .18), box(0, 3.5, 0, 2, 1, .18)]);
  assert.equal(physics.lineOfSight(new THREE.Vector3(3, 1.6, 2), new THREE.Vector3(3, 1.6, -2)), false);
  assert.equal(physics.lineOfSight(new THREE.Vector3(0, 1.6, 2), new THREE.Vector3(0, 1.6, -2)), true);
  const actor = {position: new THREE.Vector3(0, 0, 2), velocity: new THREE.Vector3(), grounded: true};
  for (let i = 0; i < 60; i++) physics.move(actor, new THREE.Vector3(0, 0, -3), 1 / 60);
  assert.ok(actor.position.z < -.4, 'walks through the actual open doorway');
  actor.position.set(3, 0, 2); actor.velocity.set(0, 0, 0);
  for (let i = 0; i < 90; i++) physics.move(actor, new THREE.Vector3(0, 0, -7), 1 / 60);
  assert.ok(actor.position.z >= .43, 'sprinting cannot tunnel through the wall');
});

test('pathfinding routes around a closed building and rejects its sealed interior', () => {
  const physics = world([box(0, 2, 0, 4, 4, 5)]);
  assert.equal(physics.isWalkable(0, 0), false);
  const start = new THREE.Vector3(-5, 0, 0), end = new THREE.Vector3(5, 0, 0);
  const path = physics.findPath(start, end);
  assert.ok(path.length >= 2);
  assert.ok(path.some(point => Math.abs(point.z) > 2.8));
  let previous = start;
  for (const point of path) {
    assert.ok(physics._clearWalk(previous, point), 'each final waypoint segment clears solid geometry');
    previous = point;
  }
});

test('jump, landing, step support and bounds preserve grounded feet', () => {
  const physics = world([box(0, .12, -1.5, 3, .24, 3)]);
  const actor = {position: new THREE.Vector3(0, 0, 2), velocity: new THREE.Vector3(), grounded: true};
  let peak = 0;
  for (let i = 0; i < 120; i++) {
    physics.move(actor, new THREE.Vector3(), 1 / 60, {jump: i === 0});
    peak = Math.max(peak, actor.position.y);
  }
  assert.ok(peak > .9 && peak < 1.3);
  assert.equal(actor.position.y, 0);
  assert.equal(actor.grounded, true);
  for (let i = 0; i < 75; i++) physics.move(actor, new THREE.Vector3(0, 0, -3), 1 / 60);
  assert.ok(Math.abs(actor.position.y - .24) < .005, 'small physical step supports feet');
  for (let i = 0; i < 120; i++) physics.move(actor, new THREE.Vector3(0, 0, -12), 1 / 60);
  assert.ok(actor.position.z >= -8.66);
  assert.ok(actor.position.y >= 0);
});

test('world transforms preserve collision for rotated furniture', () => {
  const parent = new THREE.Group();
  parent.position.set(2, 0, 2); parent.rotation.y = Math.PI / 4;
  const leaf = box(0, 1, 0, .15, 2, 2.2); parent.add(leaf);
  const physics = world([leaf]);
  assert.equal(physics.lineOfSight(new THREE.Vector3(0, 1, 2), new THREE.Vector3(4, 1, 2)), false);
  assert.equal(physics.canOccupy(new THREE.Vector3(2, 0, 2)), false);
});

test('crouching passes a low lintel, prevents standing inside it, and standing recovers outside', () => {
  const physics = world([box(0, 2, 0, 3, 1.4, 2)]);
  const actor = {position: new THREE.Vector3(0, 0, 2), velocity: new THREE.Vector3(), grounded: true};
  for (let i = 0; i < 60; i++) physics.move(actor, new THREE.Vector3(0, 0, -2), 1 / 60, {crouch: true});
  assert.ok(actor.position.z < .5);
  physics.move(actor, new THREE.Vector3(), 1 / 60, {crouch: false});
  assert.equal(actor.crouched, true);
  for (let i = 0; i < 90; i++) physics.move(actor, new THREE.Vector3(0, 0, -2), 1 / 60);
  assert.equal(actor.crouched, false);
});

test('actor separation preserves velocity and jump state while respecting walls and ground', () => {
  const physics = world([box(0, 2, 0, 8, 4, .18), box(0, .12, 3, 3, .24, 2)]);
  const actor = {position: new THREE.Vector3(0, 0, 2), velocity: new THREE.Vector3(1.5, 3.2, -2),
    grounded: true, _jumpHeld: true, landed: false, landingSpeed: 7};
  const velocity = actor.velocity.clone();
  physics.displace(actor, new THREE.Vector3(0, 99, -4));
  assert.ok(actor.position.z >= .43, 'separation cannot tunnel through a solid wall');
  assert.equal(actor.position.y, 0, 'delta.y never advances vertical movement');
  assert.deepEqual(actor.velocity.toArray(), velocity.toArray());
  assert.equal(actor._jumpHeld, true);
  assert.equal(actor.landed, false);
  assert.equal(actor.landingSpeed, 7);
  physics.displace(actor, new THREE.Vector3(0, 0, 2.5));
  assert.ok(Math.abs(actor.position.y - .24) < .005, 'grounded separation follows a small physical step');
  assert.equal(actor.grounded, true);
  actor.grounded = false; actor.position.set(3, 2, 3);
  physics.displace(actor, new THREE.Vector3(.3, -99, 0));
  assert.equal(actor.position.y, 2, 'airborne separation preserves exact height');
  assert.deepEqual(actor.velocity.toArray(), velocity.toArray());
});

test('tall characters route around low lintels and never spawn inside them', () => {
  const physics = world([box(0, 2.03, 0, 3, .34, 1)]);
  const start = new THREE.Vector3(0, 0, 3), end = new THREE.Vector3(0, 0, -3);
  const radius = .2852, height = 1.944;
  assert.equal(physics.findPath(start, end, {radius, height: 1.8}).length, 1, 'ordinary-height body fits below the lintel');
  const path = physics.findPath(start, end, {radius, height});
  assert.ok(path.length >= 2, 'the taller body must take a different route');
  assert.ok(path.some(point => Math.abs(point.x) > 1.7));
  let previous = start;
  for (const point of path) {
    assert.ok(physics.canOccupy(point, radius, height));
    assert.ok(physics._clearWalk(previous, point, radius, height));
    previous = point;
  }
  const spawn = physics.nearestWalkable(new THREE.Vector3(0, 0, 0), {radius, height});
  assert.ok(physics.canOccupy(spawn, radius, height), 'shape-aware spawn selection must leave the low roof');
  assert.deepEqual(physics.findPath(start, end, {radius, height}).map(p => p.toArray()), path.map(p => p.toArray()), 'cached shape clearance preserves the safe route');
});

test('broad characters cannot follow a narrow-body route through a doorway', () => {
  const physics = world([box(-2.185, 2, 0, 3.63, 4, .25), box(2.185, 2, 0, 3.63, 4, .25)]);
  const start = new THREE.Vector3(0, 0, 3), end = new THREE.Vector3(0, 0, -3);
  assert.equal(physics.findPath(start, end, {radius: .35, height: 1.8}).length, 1);
  const radius = .39, height = 1.8;
  const path = physics.findPath(start, end, {radius, height});
  assert.ok(path.length >= 2);
  assert.ok(path.some(point => Math.abs(point.x) > 4.3));
  let previous = start;
  for (const point of path) {
    assert.ok(physics.canOccupy(point, radius, height));
    assert.ok(physics._clearWalk(previous, point, radius, height));
    previous = point;
  }
});
