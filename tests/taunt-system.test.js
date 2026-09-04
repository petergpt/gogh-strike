import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {beginTaunt, requestTaunt, cancelTaunt, isTaunting, canTaunt, tauntAvailability} from '../src/taunt-system.js';
import {getArtistTaunt} from '../src/artist-taunts.js';
import {FACTIONS} from '../src/factions.js';

function actor(extra = {}) {
  return {artistName:'Vincent van Gogh', alive:true, grounded:true, crouched:false, sprinting:false,
    position:new Vector3(4, 0, 9), velocity:new Vector3(2, 0, -1), yaw:1.2, pitch:.4, ads:true, aiming:true,
    health:117, maxHealth:150, armor:37, stamina:63, ammo:17, reserve:56, kills:4, deaths:2,
    speed:4.5, damage:400, nextShotAt:10.2, reloadUntil:0, healUntil:0, sprayUntil:0, protectedUntil:12,
    respawnAt:0, burstRemaining:2, ...extra};
}

test('beginning a taunt holds the actor without changing combat stats or action timers', () => {
  const a=actor(), before={...a}, position=a.position.clone(), velocity=a.velocity;
  assert.equal(canTaunt(a,10),true);
  const result=beginTaunt(a,10);
  assert.equal(result.ok,true);
  assert.equal(a.tauntId,getArtistTaunt(a).id);
  assert.equal(a.tauntStarted,10);
  assert.equal(a.tauntUntil,10+result.duration);
  assert.equal(a.nextTauntAt,16);
  assert.equal(a.protectedUntil,0,'a cosmetic gesture cannot retain spawn invulnerability');
  assert.equal(a.velocity,velocity);assert.deepEqual(a.velocity.toArray(),[0,0,0]);
  assert.deepEqual(a.position.toArray(),position.toArray());
  assert.equal(a.yaw,1.2);assert.equal(a.pitch,0);assert.equal(a.ads,false);assert.equal(a.aiming,false);assert.equal(a.burstRemaining,0);
  for(const key of ['health','maxHealth','armor','stamina','ammo','reserve','kills','deaths','speed','damage','nextShotAt','reloadUntil','respawnAt']) assert.equal(a[key],before[key],key);
});

test('availability and begin share every busy-state guard without mutating rejected actors', () => {
  for(const extra of [{alive:false},{health:0},{grounded:false},{crouched:true},{sprinting:true},{sliding:true},{slideUntil:11},
    {reloadUntil:11},{healUntil:11},{sprayUntil:11},{interactingUntil:11},{nextTauntAt:11}]) {
    const a=actor(extra), before=JSON.stringify(a);
    assert.equal(canTaunt(a,10),false,JSON.stringify(extra));
    assert.deepEqual(beginTaunt(a,10),tauntAvailability(a,10));
    assert.equal(JSON.stringify(a),before,'a rejected gesture must not clear protection or a reload');
  }
  assert.equal(canTaunt(null,10),false);assert.equal(canTaunt(actor(),NaN),false);
  assert.equal(beginTaunt(actor(),Infinity).ok,false);
});

test('cancel is immediate and idempotent while preserving cooldown, reload and respawn', () => {
  const a=actor();requestTaunt(a,10);a.reloadUntil=12;a.respawnAt=12;
  assert.equal(isTaunting(a,10.3),true);
  assert.equal(cancelTaunt(a),true);
  assert.equal(isTaunting(a,10.3),false);
  assert.equal(a.tauntUntil,0);assert.equal(a.tauntId,null);
  assert.equal(a.nextTauntAt,16);assert.equal(a.nextShotAt,10.2);assert.equal(a.reloadUntil,12);assert.equal(a.respawnAt,12);
  assert.equal(cancelTaunt(a),false);assert.equal(cancelTaunt(null),false);
  assert.equal(tauntAvailability(a,12.5).reason,'cooldown');
  assert.equal(canTaunt(a,16),true);
});

test('expiry boundaries are read-only and a held request cannot extend a gesture', () => {
  const a=actor();const started=beginTaunt(a,0);const until=a.tauntUntil;
  assert.equal(isTaunting(a,0),true);
  assert.equal(beginTaunt(a,.2).reason,'active');assert.equal(a.tauntUntil,until);
  assert.equal(isTaunting(a,started.until-1e-6),true);
  const before=JSON.stringify(a);
  assert.equal(isTaunting(a,started.until),false);assert.equal(JSON.stringify(a),before);
  assert.equal(beginTaunt(a,5.99).reason,'cooldown');assert.equal(beginTaunt(a,6).ok,true);
  a.alive=false;assert.equal(isTaunting(a,6.1),false);
});

test('every artist can finish a longer gesture without extending the defeated player’s respawn', () => {
  for(const identity of FACTIONS.flatMap(f=>f.roster)) {
    const a=actor({artistName:identity.name,identity,respawnAt:12});
    const result=beginTaunt(a,10);
    assert.equal(result.ok,true,identity.name);
    assert.equal(result.id,getArtistTaunt(identity).id);
    assert.ok(result.duration>=2.7&&result.duration<=3.2);
    assert.equal(a.respawnAt,12);assert.equal(a.nextTauntAt,16);
    assert.equal(isTaunting(a,12),true,'a living killer can continue dancing after the victim respawns');
    assert.equal(isTaunting(a,result.until),false);
  }
});
