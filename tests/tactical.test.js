import test from 'node:test';
import assert from 'node:assert/strict';
import { TacticalRules, TACTICAL_ECONOMY } from '../src/tactical.js';

const actor = (id, team, extra = {}) => ({ id, team, name: `Painter ${id}`, alive: true, health: 100, position: { x: 0, y: 0, z: 0 }, ...extra });
const sites = () => [
  { id: 'cafe', name: 'Café', position: { x: 10, y: 0, z: 0 }, radius: 3 },
  { id: 'rhone', name: 'Rhône', position: { x: -20, y: 0, z: 20 }, radius: 3 },
];
const roster = () => [actor(0, 0, { isPlayer: true }), actor(1, 0), actor(2, 1), actor(3, 1)];
const die = (target) => { target.alive = false; target.health = 0; };
const revive = (actors) => { for (const target of actors) { target.alive = true; target.health = 100; } };
const atSite = (target, site) => { target.position = { ...site.position }; };
function start(config = {}) {
  const rules = new TacticalRules(config);
  const actors = roster();
  const objectives = sites();
  rules.update(18, actors, objectives);
  return { rules, actors, objectives };
}
function plant({ rules, actors, objectives }, site = objectives[0]) {
  const carrier = actors.find((target) => target.id === rules.carrierId);
  atSite(carrier, site);
  return rules.interact(carrier, rules.plantDuration, { active: true });
}

test('staging registers credits and a deterministic human carrier, then starts a full active clock', () => {
  const rules = new TacticalRules();
  const actors = roster();
  let event = rules.update(17, actors, sites());
  assert.equal(rules.phase, 'staging');
  assert.equal(rules.timeRemaining, 1);
  assert.equal(rules.carrierId, 0);
  assert.equal(rules.beaconState, 'carried');
  assert.deepEqual(actors.map((target) => target.credits), [3800, 3800, 3800, 3800]);
  assert.equal(event.deviceAssigned, true);
  event = rules.update(1, actors, sites());
  assert.deepEqual(event, { stageChanged: true, phase: 'playing' });
  assert.equal(rules.timeRemaining, 150);
  assert.equal(rules.attackingTeam, 0);
  assert.equal(rules.defendingTeam, 1);
});

test('ready preserves the button gesture and emits one stage transition on update', () => {
  const rules = new TacticalRules();
  const actors = roster();
  assert.equal(rules.ready(), true);
  assert.equal(rules.phase, 'staging');
  assert.equal(rules.update(0, actors, sites()).stageChanged, true);
  assert.equal(rules.phase, 'playing');
  assert.equal(rules.timeRemaining, 150);
  assert.equal(rules.ready(), false);
  assert.equal(rules.update(0, actors, sites()).stageChanged, undefined);
});

test('carrier preference supports squad roles and an explicit stable ID', () => {
  const actors = [actor(0, 0), actor(1, 0, { role: 'scout' }), actor(2, 0, { role: 'vanguard' }), actor(3, 1)];
  const rules = new TacticalRules();
  rules.update(0, actors, sites());
  assert.equal(rules.carrierId, 2);
  const selected = new TacticalRules({ carrierId: 1 });
  selected.update(0, actors, sites());
  assert.equal(selected.carrierId, 1);
});

test('purchases require staging and real integer credit balances', () => {
  const rules = new TacticalRules();
  const buyer = actor(0, 0, { credits: 3400 });
  assert.equal(rules.spendCredits(buyer, 2500), true);
  assert.equal(buyer.credits, 900);
  assert.equal(rules.spendCredits(buyer, 1000), false);
  assert.equal(rules.spendCredits(buyer, -1), false);
  assert.equal(rules.spendCredits(buyer, 0.5), false);
  assert.equal(rules.spendCredits(buyer, NaN), false);
  rules.ready();
  rules.update(0, [buyer, actor(1, 1)], sites());
  assert.equal(rules.spendCredits(buyer, 100), false);
  assert.equal(buyer.credits, 900);
});

test('only the living carrier can plant, in a real site range, after the entire four-second hold', () => {
  const state = start();
  const { rules, actors, objectives } = state;
  atSite(actors[1], objectives[0]);
  assert.equal(rules.interact(actors[1], 10, { active: true }).complete, false);
  assert.equal(rules.interact(actors[0], 10, { active: true, nearSite: true }).complete, false);
  atSite(actors[0], objectives[0]);
  assert.equal(rules.interact(actors[0], 3.9, { active: true }).complete, false);
  assert.equal(rules.beaconState, 'carried');
  assert.equal(rules.plantProgress, 0.975);
  assert.equal(rules.interact(actors[0], 0.1, { active: true }).planted, true);
  assert.equal(rules.beaconState, 'planted');
  assert.equal(rules.carrierId, null);
  assert.equal(rules.plantedSiteId, 'cafe');
  assert.deepEqual(rules.plantedAt, objectives[0].position);
  assert.equal(rules.beaconTimeRemaining, 45);
  assert.equal(rules.timeRemaining, 45);
  assert.equal(actors[0].credits, 4100);
});

test('release, damage and movement each cancel accumulated planting progress', () => {
  const { rules, actors, objectives } = start();
  const carrier = actors[0];
  atSite(carrier, objectives[0]);
  rules.interact(carrier, 3, { active: true });
  rules.interact(carrier, 0, { active: false });
  assert.equal(rules.plantProgress, 0);
  rules.interact(carrier, 3, { active: true });
  carrier.health -= 10;
  assert.equal(rules.interact(carrier, 1, { active: true }).interrupted, true);
  assert.equal(rules.plantProgress, 0);
  rules.interact(carrier, 3, { active: true });
  carrier.position.x += 0.5;
  assert.equal(rules.interact(carrier, 1, { active: true }).interrupted, true);
  assert.equal(rules.beaconState, 'carried');
});

test('forgotten holds expire, explicit interruption and geometry denial cannot keep progress', () => {
  const { rules, actors, objectives } = start();
  atSite(actors[0], objectives[0]);
  rules.interact(actors[0], 3, { active: true });
  rules.update(0.1, actors, objectives);
  rules.update(0.1, actors, objectives);
  assert.equal(rules.interaction, null);
  assert.equal(rules.interact(actors[0], 1, { active: true }).progress, 0.25);
  rules.interact(actors[0], 0, { active: true, interrupted: true });
  assert.equal(rules.plantProgress, 0);
  rules.interact(actors[0], 3, { active: true });
  rules.interact(actors[0], 1, { active: true, hasLineOfSight: false });
  assert.equal(rules.plantProgress, 0);
  assert.equal(rules.beaconState, 'carried');
});

test('carrier death drops at its real position and only nearby living attackers recover it', () => {
  const { rules, actors, objectives } = start();
  actors[0].position = { x: 4, y: 0, z: 5 };
  actors[1].position = { x: 20, y: 0, z: 5 };
  actors[2].position = { x: 4, y: 0, z: 5 };
  die(actors[0]);
  rules.recordKill(actors[2], actors[0]);
  assert.equal(rules.beaconState, 'dropped');
  assert.equal(rules.carrierId, null);
  assert.deepEqual(rules.devicePosition, { x: 4, y: 0, z: 5 });
  rules.update(0.1, actors, objectives);
  assert.equal(rules.beaconState, 'dropped');
  actors[1].position.x = 5;
  const event = rules.update(0.1, actors, objectives);
  assert.equal(event.devicePickedUp, true);
  assert.equal(rules.carrierId, 1);
  assert.equal(rules.beaconState, 'carried');
});

test('device pickup chooses the closest ally and rejects a different floor', () => {
  const rules = new TacticalRules();
  const actors = [actor(0, 0, { isPlayer: true }), actor(1, 0), actor(2, 0), actor(3, 1)];
  rules.update(18, actors, sites());
  die(actors[0]);
  rules.recordKill(actors[3], actors[0]);
  actors[1].position = { x: 0.2, y: 5, z: 0 };
  actors[2].position = { x: 1, y: 0, z: 0 };
  rules.update(0, actors, sites());
  assert.equal(rules.carrierId, 2);
});

test('defenders remove an armed beacon with six uninterrupted seconds', () => {
  const state = start();
  const { rules, actors, objectives } = state;
  plant(state);
  atSite(actors[2], objectives[0]);
  assert.equal(rules.interact(actors[2], 5.9, { active: true }).complete, false);
  assert.equal(rules.phase, 'playing');
  const result = rules.interact(actors[2], 0.1, { active: true });
  assert.equal(result.removed, true);
  assert.equal(rules.beaconState, 'removed');
  assert.equal(rules.roundWinner, 1);
  assert.equal(rules.roundReason, 'beacon-removed');
  assert.deepEqual(rules.scores, [0, 1]);
  assert.equal(rules.phase, 'roundEnd');
  assert.equal(actors[2].credits, 3800 + 300 + 2700);
});

test('attacker elimination after planting leaves the beacon alive and able to win', () => {
  const state = start();
  const { rules, actors, objectives } = state;
  plant(state);
  die(actors[0]); die(actors[1]);
  rules.update(44.9, actors, objectives);
  assert.equal(rules.phase, 'playing');
  assert.equal(rules.beaconState, 'planted');
  const event = rules.update(0.1, actors, objectives);
  assert.equal(event.beaconCompleted, true);
  assert.equal(rules.roundWinner, 0);
  assert.equal(rules.roundReason, 'beacon-completed');
  assert.equal(rules.beaconState, 'completed');
});

test('defenders can still remove the beacon after all attackers are gone', () => {
  const state = start();
  const { rules, actors, objectives } = state;
  plant(state);
  die(actors[0]); die(actors[1]);
  atSite(actors[2], objectives[0]);
  rules.update(1, actors, objectives);
  assert.equal(rules.interact(actors[2], 6, { active: true }).removed, true);
  assert.equal(rules.roundWinner, 1);
});

test('defender elimination wins immediately; unarmed attacker elimination wins for defenders', () => {
  const attacking = start();
  die(attacking.actors[2]); die(attacking.actors[3]);
  attacking.rules.update(0, attacking.actors, attacking.objectives);
  assert.equal(attacking.rules.roundWinner, 0);
  assert.equal(attacking.rules.roundReason, 'defenders-eliminated');
  const defending = start();
  die(defending.actors[0]); die(defending.actors[1]);
  defending.rules.update(0, defending.actors, defending.objectives);
  assert.equal(defending.rules.roundWinner, 1);
  assert.equal(defending.rules.roundReason, 'attackers-eliminated');
});

test('unplanted round timeout belongs to defenders and no interaction can revive that result', () => {
  const state = start({ roundDuration: 1 });
  const { rules, actors, objectives } = state;
  rules.update(100, actors, objectives);
  assert.equal(rules.roundWinner, 1);
  assert.equal(rules.roundReason, 'time-expired');
  assert.equal(rules.timeRemaining, 0);
  assert.equal(plant(state).planted, undefined);
  assert.deepEqual(rules.scores, [0, 1]);
});

test('a last-moment plant gets its complete beacon countdown beyond the old round timer', () => {
  const state = start({ roundDuration: 10 });
  const { rules, actors, objectives } = state;
  rules.update(9.9, actors, objectives);
  plant(state);
  rules.update(44, actors, objectives);
  assert.equal(rules.phase, 'playing');
  assert.equal(rules.timeRemaining, 1);
  rules.update(1, actors, objectives);
  assert.equal(rules.roundWinner, 0);
});

test('round transition emits once, swaps sides, clears the device and preserves economy', () => {
  const { rules, actors, objectives } = start({ roundDuration: 1 });
  rules.update(1, actors, objectives);
  const balances = actors.map((target) => target.credits);
  assert.deepEqual(rules.update(4.9, actors, objectives), {});
  assert.deepEqual(rules.update(0.1, actors, objectives), { newRound: true, stageChanged: true, phase: 'staging' });
  assert.equal(rules.round, 2);
  assert.equal(rules.attackingTeam, 1);
  assert.equal(rules.defendingTeam, 0);
  assert.equal(rules.timeRemaining, 18);
  assert.equal(rules.beaconState, 'waiting');
  assert.equal(rules.carrierId, null);
  assert.deepEqual(actors.map((target) => target.credits), balances);
  const newSites = [{ id: 'wheat', position: { x: 50, z: 5 } }, { id: 'flowers', position: { x: -50, z: 0 } }];
  const event = rules.update(0, actors, newSites);
  assert.equal(event.newRound, undefined);
  assert.equal(rules.sites[0].id, 'wheat');
  assert.equal(actors.find((target) => target.id === rules.carrierId).team, 1);
});

test('first to two completes a real three-round match and retains immutable result history', () => {
  const { rules, actors, objectives } = start();
  const winRound = (team) => {
    for (const target of actors) if (target.team !== team) die(target);
    rules.update(0, actors, objectives);
  };
  winRound(0);
  assert.deepEqual(rules.scores, [1, 0]);
  rules.update(5, actors, objectives);
  revive(actors); rules.ready(); rules.update(0, actors, objectives);
  winRound(1);
  assert.deepEqual(rules.scores, [1, 1]);
  rules.update(5, actors, objectives);
  revive(actors); rules.ready(); rules.update(0, actors, objectives);
  winRound(1);
  assert.equal(rules.round, 3);
  assert.equal(rules.phase, 'ended');
  assert.equal(rules.winner, 1);
  assert.deepEqual(rules.scores, [1, 2]);
  assert.deepEqual(rules.roundHistory.map((entry) => entry.attackingTeam), [0, 1, 0]);
  assert.deepEqual(rules.roundHistory.map((entry) => entry.winner), [0, 1, 1]);
  assert.equal(rules.resetRound(), false);
  assert.deepEqual(rules.update(500, actors, objectives), {});
  assert.equal(rules.roundHistory.length, 3);
  assert.equal(rules.matchMVP.team, 1);
});

test('kill, damage, round and objective stats are separate from actor totals and deduplicate deaths', () => {
  const { rules, actors, objectives } = start();
  actors[0].kills = 9;
  rules.recordDamage(actors[0], actors[2], 75);
  assert.equal(rules.recordDamage(actors[0], actors[1], 50), false);
  die(actors[2]);
  assert.equal(rules.recordKill(actors[0], actors[2]), true);
  assert.equal(rules.recordKill(actors[0], actors[2]), false);
  assert.equal(actors[0].kills, 9);
  assert.equal(actors[0].credits, 4000);
  die(actors[3]); rules.recordKill(actors[1], actors[3]);
  rules.update(0, actors, objectives);
  const stats = rules.statistics.find((entry) => entry.actorId === 0);
  assert.equal(stats.kills, 1);
  assert.equal(stats.damage, 75);
  assert.equal(stats.roundWins, 1);
  assert.equal(stats.mvpAwards, 1);
  assert.equal(rules.mvp.actorId, 0);
  assert.equal(rules.roundHistory[0].mvp.actorId, 0);
});

test('loss credit bonuses persist across rounds and balances stop at the cap', () => {
  const { rules, actors, objectives } = start({ startingCredits: 0 });
  for (const target of actors) if (target.team === 0) die(target);
  rules.update(0, actors, objectives);
  assert.equal(actors[0].credits, TACTICAL_ECONOMY.lossReward);
  assert.equal(actors[2].credits, TACTICAL_ECONOMY.winReward);
  rules.update(5, actors, objectives); revive(actors); rules.ready(); rules.update(0, actors, objectives);
  for (const target of actors) if (target.team === 0) die(target);
  rules.update(0, actors, objectives);
  assert.equal(actors[0].credits, 2100 + 2600);
  assert.equal(actors[2].credits, 5400);
  const capped = start({ startingCredits: 9990 });
  die(capped.actors[2]);
  capped.rules.recordKill(capped.actors[0], capped.actors[2]);
  assert.equal(capped.actors[0].credits, 10000);
});

test('invalid time steps do nothing and staging deaths cannot settle an active round', () => {
  const rules = new TacticalRules();
  rules.update(-1, roster(), sites());
  rules.update(NaN, roster(), sites());
  assert.equal(rules.timeRemaining, 18);
  const actors = roster();
  die(actors[0]); die(actors[1]);
  rules.update(1, actors, sites());
  assert.equal(rules.phase, 'staging');
  assert.equal(rules.recordKill(actors[2], actors[0]), false);
  assert.deepEqual(rules.scores, [0, 0]);
});
