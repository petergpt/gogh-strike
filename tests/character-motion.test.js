import test from 'node:test';
import assert from 'node:assert/strict';
import {Euler, Quaternion, Vector3} from 'three';
import {bodyProfile, bodyPose} from '../src/actor-profile.js';
import {createCharacterMotion, sampleCharacterMotion} from '../src/character-motion.js';

const makeActor = () => ({position: {x: 0, y: 0, z: 0}, velocity: {x: 0, y: 0, z: 0}, yaw: 0, alive: true, grounded: true});
const close = (a, b, epsilon = 1e-8) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
const finiteTree = value => {
  if (typeof value === 'number') assert.ok(Number.isFinite(value));
  else if (value && typeof value === 'object') Object.values(value).forEach(finiteTree);
};
function advance(state, actor, dt, options = {}) {
  actor.position.x += actor.velocity.x * dt;
  actor.position.z += actor.velocity.z * dt;
  return sampleCharacterMotion(state, {dt, actor, ...options});
}
function ankleWorld(state, actor, sample, key, crouch = 0, turnDelta = 0) {
  const p = state.profile, leg = sample[key], side = key === 'left' ? -1 : 1;
  const pose = bodyPose(p, {crouch});
  return new Vector3(0, -.300 * p.legScale, 0)
    .applyAxisAngle(new Vector3(1, 0, 0), leg.knee)
    .add(new Vector3(0, -.393 * p.legScale, 0))
    .applyEuler(new Euler(...leg.hip))
    .add(new Vector3(side * .107 * p.hipScale, -.006 * p.legScale, 0))
    .applyEuler(new Euler(...sample.bodyRotation))
    .add(new Vector3(sample.bodyOffset[0], pose.pelvisY + sample.bodyOffset[1], pose.pelvisZ + sample.bodyOffset[2]))
    .applyAxisAngle(new Vector3(0, 1, 0), actor.yaw - turnDelta)
    .add(new Vector3(actor.position.x, actor.position.y, actor.position.z));
}

test('real displacement drives gait; blocked velocity and a stopped swing do not move contacts', () => {
  const state = createCharacterMotion(bodyProfile()), actor = makeActor();
  actor.velocity.z = -4.5;
  let sample = sampleCharacterMotion(state, {dt: 0, actor});
  for (let i = 0; i < 30; i++) sample = sampleCharacterMotion(state, {dt: 1 / 60, actor});
  assert.equal(sample.phase, 0);
  assert.equal(sample.debug.totalDistance, 0);
  for (let i = 0; i < 17; i++) sample = advance(state, actor, 1 / 60);
  const phase = sample.phase;
  const contacts = ['left', 'right'].map(key => [sample.debug[key].contact[0], sample.debug[key].contact[2]]);
  for (let i = 0; i < 90; i++) sample = sampleCharacterMotion(state, {dt: 1 / 60, actor});
  assert.equal(sample.phase, phase);
  for (const [i, key] of ['left', 'right'].entries()) {
    close(sample.debug[key].contact[0], contacts[i][0]);
    close(sample.debug[key].contact[2], contacts[i][1]);
    assert.equal(sample.debug[key].lift, 0);
  }
});

test('support contacts stay fixed in world space and joint FK reaches targets in each travel direction', () => {
  for (const [vx, vz, crouch] of [[0, -3.8, 0], [0, 2.5, 0], [2.5, 0, 0], [1.5, -1.5, 1]]) {
    const state = createCharacterMotion(bodyProfile()), actor = makeActor();
    actor.velocity.x = vx; actor.velocity.z = vz;
    sampleCharacterMotion(state, {dt: 0, actor, crouch});
    let previous, checked = 0;
    for (let i = 0; i < 150; i++) {
      const sample = advance(state, actor, 1 / 60, {crouch, aimBlend: .4});
      finiteTree(sample);
      for (const key of ['left', 'right']) {
        const foot = sample.debug[key], before = previous?.debug[key];
        if (foot.support && before?.support && foot.progress >= before.progress) {
          close(foot.contact[0], before.contact[0]); close(foot.contact[2], before.contact[2]); checked++;
        }
        const actual = ankleWorld(state, actor, sample, key, crouch);
        assert.ok(actual.distanceTo(new Vector3(...foot.contact)) < .008, `${key}: joint/contact residual`);
      }
      previous = sample;
    }
    assert.ok(checked > 20, 'must inspect multiple genuine support intervals');
  }
});

test('pause, teleport and respawn rebase without advancing gait or retaining distant feet', () => {
  const state = createCharacterMotion(bodyProfile()), actor = makeActor();
  sampleCharacterMotion(state, {dt: 0, actor});
  actor.velocity.z = -3;
  for (let i = 0; i < 12; i++) advance(state, actor, 1 / 60);
  const paused = state.lastSample, cycles = state.cycles;
  assert.deepEqual(sampleCharacterMotion(state, {dt: 0, actor, time: 999}), paused);
  actor.position.x = 150;
  const repositioned = sampleCharacterMotion(state, {dt: 0, actor});
  assert.deepEqual(repositioned.left, paused.left);
  assert.equal(repositioned.phase, paused.phase);
  close(repositioned.debug.left.contact[0], paused.debug.left.contact[0] + 150);
  assert.equal(state.cycles, cycles);
  const resumed = sampleCharacterMotion(state, {dt: 1 / 60, actor});
  assert.equal(resumed.debug.teleport, false, 'paused reposition was rebased');
  actor.position.x = -100;
  const teleported = sampleCharacterMotion(state, {dt: 1 / 60, actor});
  assert.equal(teleported.debug.teleport, true);
  assert.equal(teleported.debug.travel, 0); assert.equal(state.cycles, cycles);
  actor.alive = false; sampleCharacterMotion(state, {dt: 1 / 60, actor});
  actor.alive = true; actor.position.x += .4;
  const respawned = sampleCharacterMotion(state, {dt: 1 / 60, actor});
  assert.equal(respawned.debug.respawn, true); assert.equal(respawned.debug.travel, 0);
  assert.ok(respawned.debug.left.reachError < .001);
});

test('constant travel has frame-rate independent phase and contacts; shorter legs and cadence affect steps', () => {
  function run(dt, motion = {}, look = {}) {
    const state = createCharacterMotion(bodyProfile(look), motion), actor = makeActor();
    actor.velocity.z = -3.6;
    sampleCharacterMotion(state, {dt: 0, actor});
    for (let i = 0; i < Math.round(2 / dt); i++) advance(state, actor, dt);
    return state;
  }
  const slow = run(1 / 30), fast = run(1 / 120);
  close(slow.cycles, fast.cycles);
  close(slow.lastSample.phase, fast.lastSample.phase);
  for (const key of ['left', 'right']) for (let i = 0; i < 3; i++)
    close(slow.lastSample.debug[key].contact[i], fast.lastSample.debug[key].contact[i], 1e-7);
  assert.ok(run(1 / 60, {cadence: 1.2}).cycles > run(1 / 60, {cadence: .8}).cycles);
  assert.ok(run(1 / 60, {}, {legLength: .65, torsoLength: 1.1}).cycles > run(1 / 60).cycles);
});

test('short and long bodies remain finite in crouch, turns, airborne travel and malformed motion inputs', () => {
  for (const legLength of [.65, 1.15]) {
    const state = createCharacterMotion(bodyProfile({legLength}), {cadence: Infinity, footLift: NaN}), actor = makeActor();
    sampleCharacterMotion(state, {dt: 0, actor, crouch: 1});
    for (let i = 0; i < 100; i++) {
      actor.yaw = Math.PI - .01 + i * .003;
      actor.velocity.x = 1.3; actor.velocity.z = -.8;
      actor.grounded = i < 50;
      const sample = advance(state, actor, 1 / 60, {crouch: 1, aimBlend: 1, turnDelta: .08});
      finiteTree(sample);
      assert.ok(sample.left.knee <= 0 && sample.right.knee <= 0, 'knees retain the anatomical branch');
      assert.ok(Math.abs(sample.left.ankle) <= 1.18 && Math.abs(sample.right.ankle) <= 1.18);
      if (i >= 50) assert.equal(sample.debug.travel, 0);
    }
  }
});

test('speed changes, physics-rate reversal, crouch and restart preserve reachable continuous steps', () => {
  for (const mode of ['speedDown', 'speedUp', 'reverse', 'crouch', 'stopRestart']) {
    const state = createCharacterMotion(bodyProfile()), actor = makeActor();
    actor.velocity.z = mode === 'speedUp' ? -1 : -4.5;
    let previous = sampleCharacterMotion(state, {dt: 0, actor}), crouch = 0;
    for (let i = 1; i <= 220; i++) {
      if (i >= 75) {
        if (mode === 'speedDown') actor.velocity.z = -1;
        if (mode === 'speedUp') actor.velocity.z = -6.4;
        if (mode === 'reverse') actor.velocity.z = Math.min(4.5, actor.velocity.z + 34 / 60);
        if (mode === 'crouch') {
          actor.velocity.z = Math.min(-2.15, actor.velocity.z + 39 / 60);
          crouch += (1 - crouch) * (1 - Math.exp(-13 / 60));
        }
        if (mode === 'stopRestart') actor.velocity.z = i < 160 ? 0 : -4.5;
      }
      const sample = advance(state, actor, 1 / 60, {crouch});
      for (const key of ['left', 'right']) {
        const contact = sample.debug[key].contact, before = previous.debug[key].contact;
        const distance = Math.hypot(...contact.map((v, j) => v - before[j]));
        assert.ok(distance < .35, `${mode}: discontinuous swing target ${distance}`);
        assert.ok(sample.debug[key].reachError < .01, `${mode}: unreachable step`);
        if (mode === 'stopRestart' && i === 160) close(contact[0], before[0]);
      }
      previous = sample;
    }
  }
});

test('full ankle compensation levels boots during strafe and bent-knee turns', () => {
  for (const crouch of [0, 1]) {
    const state = createCharacterMotion(bodyProfile()), actor = makeActor();
    actor.velocity.x = crouch ? 2.15 : 4.5;
    sampleCharacterMotion(state, {dt: 0, actor, crouch});
    for (let i = 0; i < 100; i++) {
      const sample = advance(state, actor, 1 / 60, {crouch, turnDelta: .08});
      for (const key of ['left', 'right']) {
        const leg = sample[key];
        const orientation = new Quaternion().setFromEuler(new Euler(...sample.bodyRotation))
          .multiply(new Quaternion().setFromEuler(new Euler(...leg.hip)))
          .multiply(new Quaternion().setFromEuler(new Euler(leg.knee, 0, 0)))
          .multiply(new Quaternion().fromArray(leg.ankleQuaternion));
        const up = new Vector3(0, 1, 0).applyQuaternion(orientation);
        close(up.x, 0);
        assert.ok(up.y > .994, 'only the restrained deliberate heel/toe roll remains');
      }
    }
  }
});
