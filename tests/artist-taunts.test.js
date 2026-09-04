import test from 'node:test';
import assert from 'node:assert/strict';
import {FACTIONS} from '../src/factions.js';
import {getArtistTaunt, sampleTaunt} from '../src/artist-taunts.js';

const artists = FACTIONS.flatMap(faction => faction.roster);
const definitions = () => artists.map(artist => getArtistTaunt(artist));
const coordinates = pose => [
  ...pose.body, ...pose.torso, ...pose.head, ...pose.shift,
  ...pose.leftHand, ...pose.rightHand,
  ...pose.legs.flatMap(leg => [...leg.hip, leg.knee, leg.stance]),
];
function assertPose(pose, label) {
  assert.equal(typeof pose.active, 'boolean', label);
  assert.ok(Number.isFinite(pose.weight) && pose.weight >= 0 && pose.weight <= 1, `${label}: envelope`);
  for (const key of ['body', 'torso', 'head', 'shift', 'leftHand', 'rightHand']) {
    assert.ok(Array.isArray(pose[key]) && pose[key].length === 3, `${label}: ${key} vector`);
  }
  assert.ok(Array.isArray(pose.legs) && pose.legs.length === 2, `${label}: two legs`);
  for (const leg of pose.legs) assert.ok(Array.isArray(leg.hip) && leg.hip.length === 3, `${label}: hip vector`);
  assert.ok(coordinates(pose).every(Number.isFinite), `${label}: every motion coordinate is finite`);
}
function assertNeutral(pose, label) {
  assertPose(pose, label);
  assert.equal(pose.active, false, `${label}: inactive`);
  assert.equal(pose.weight, 0, `${label}: no blend`);
  assert.ok(coordinates(pose).every(value => value === 0), `${label}: no residual pose`);
}

test('all twelve artists resolve to individually named taunts with valid timing', () => {
  const taunts = definitions();
  assert.equal(artists.length, 12);
  assert.equal(new Set(taunts.map(taunt => taunt.id)).size, 12, 'each artist has its own definition');
  assert.equal(new Set(taunts.map(taunt => taunt.name)).size, 12, 'each gesture has a distinct display name');
  for (let i = 0; i < artists.length; i++) {
    const taunt = taunts[i];
    assert.ok(typeof taunt.id === 'string' && taunt.id.length > 0);
    assert.ok(typeof taunt.name === 'string' && taunt.name.length > 0);
    assert.ok(Number.isFinite(taunt.duration) && taunt.duration > 0, `${artists[i].name}: duration`);
    assert.ok(Number.isFinite(taunt.cooldown) && taunt.cooldown > 0, `${artists[i].name}: cooldown`);
    assert.deepEqual(getArtistTaunt(artists[i].name), taunt, 'name and roster-object lookup agree');
  }
});

test('taunt sampling is finite and repeatable throughout every complete performance', () => {
  for (const taunt of definitions()) {
    const before = JSON.stringify(taunt);
    let visiblyActive = false;
    for (let step = 0; step <= 120; step++) {
      const elapsed = taunt.duration * step / 120;
      const pose = sampleTaunt(taunt, elapsed);
      assertPose(pose, `${taunt.id} at ${step}/120`);
      assert.deepEqual(sampleTaunt(taunt.id, elapsed), pose, 'definition and id sampling agree');
      assert.deepEqual(sampleTaunt(taunt, elapsed), pose, 'sampling has no hidden clock or randomness');
      visiblyActive ||= pose.active && pose.weight > .5 && coordinates(pose).some(value => Math.abs(value) > .05);
    }
    assert.ok(visiblyActive, `${taunt.id}: the performance must contain a visible gesture`);
    assert.equal(JSON.stringify(taunt), before, 'sampling does not mutate its definition');
  }
});

test('every gesture returns to a neutral pose at and outside both endpoints', () => {
  for (const taunt of definitions()) {
    for (const elapsed of [-1, 0, taunt.duration, taunt.duration + 1]) {
      assertNeutral(sampleTaunt(taunt, elapsed), `${taunt.id} at ${elapsed}`);
    }
    // Close to each boundary, the motion should already be visually neutral;
    // this rejects a pose that abruptly appears or vanishes on the endpoint.
    for (const elapsed of [taunt.duration * .0001, taunt.duration * .9999]) {
      const pose = sampleTaunt(taunt, elapsed);
      assert.ok(Math.max(pose.weight, ...coordinates(pose).map(Math.abs)) < .01,
        `${taunt.id}: discontinuous entry or exit`);
    }
  }
});

test('the twelve performances have distinct motion, beyond labels or tiny numeric differences', () => {
  // Compare full performances at matching normalized times, with coordinates
  // rounded to a centimetre/radian hundredth. IDs, labels, duration and blend
  // weights cannot make two otherwise identical performances pass this check.
  const signatures = definitions().map(taunt => ({id: taunt.id,
    motion: JSON.stringify(Array.from({length: 31}, (_, step) =>
      coordinates(sampleTaunt(taunt, taunt.duration * step / 30)).map(value => Math.round(value * 100) / 100))),
  }));
  assert.equal(new Set(signatures.map(signature => signature.motion)).size, 12,
    `repeated choreography among ${signatures.map(signature => signature.id).join(', ')}`);
});
