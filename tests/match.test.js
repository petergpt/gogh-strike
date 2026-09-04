import test from 'node:test';
import assert from 'node:assert/strict';
import { MatchRules } from '../src/match.js';

const actor = (team, health = 100, x = 0, z = 0) => ({ team, health, alive: health > 0, position: { x, z } });
const objective = (extra = {}) => ({ id: 'cafe', name: 'Café', position: { x: 0, z: 0 }, radius: 5, progress: 0, owner: null, contested: false, ...extra });
const approx = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} differs from ${expected}`);

test('TDM counts enemy kills, ends at limit, and freezes after the result', () => {
  const rules = new MatchRules({ scoreLimit: 2 });
  const ally = actor(0), enemy = actor(1);
  assert.equal(rules.recordKill(ally, ally), false);
  assert.equal(rules.recordKill(ally, actor(0)), false);
  assert.equal(rules.recordKill(null, enemy), false);
  rules.recordKill(ally, enemy);
  assert.deepEqual(rules.scores, [1, 0]);
  rules.recordKill(enemy, ally);
  rules.recordKill(ally, enemy);
  assert.equal(rules.phase, 'ended');
  assert.equal(rules.winner, 0);
  rules.recordKill(enemy, ally);
  rules.update(500);
  assert.deepEqual(rules.scores, [2, 1]);
});

test('TDM timer resolves wins and honest draws', () => {
  const winner = new MatchRules({ timeLimit: 2 });
  winner.recordKill(actor(1), actor(0));
  winner.update(9);
  assert.equal(winner.timeRemaining, 0);
  assert.equal(winner.winner, 1);
  const draw = new MatchRules({ timeLimit: 2 });
  draw.update(2);
  assert.equal(draw.phase, 'ended');
  assert.equal(draw.winner, null);
});

test('neutral control capture takes five seconds and only then awards owner points', () => {
  const rules = new MatchRules({ mode: 'control' });
  const point = objective();
  const roster = [actor(0), actor(1, 100, 50)];
  rules.update(4, roster, [point]);
  approx(point.progress, -0.8);
  assert.equal(point.owner, null);
  assert.deepEqual(rules.scores, [0, 0]);
  rules.update(1, roster, [point]);
  assert.equal(point.owner, 0);
  assert.deepEqual(rules.scores, [0, 0]);
  rules.update(2.5, roster, [point]);
  assert.deepEqual(rules.scores, [2, 0]);
  rules.update(0.5, roster, [point]);
  assert.deepEqual(rules.scores, [3, 0]);
});

test('contested points freeze capture and scoring, ignoring dead or distant actors', () => {
  const rules = new MatchRules({ mode: 'control' });
  const point = objective({ owner: 0, progress: -1 });
  rules.update(7, [actor(0), actor(1)], [point]);
  assert.equal(point.contested, true);
  assert.equal(point.progress, -1);
  assert.deepEqual(point.counts, [1, 1]);
  assert.deepEqual(rules.scores, [0, 0]);
  rules.update(2, [actor(0), actor(1, 0), actor(1, 100, 6)], [point]);
  assert.equal(point.contested, false);
  assert.deepEqual(point.counts, [1, 0]);
  assert.deepEqual(rules.scores, [2, 0]);
});

test('enemy takeover neutralizes then captures, with correct scoring across long frames', () => {
  const rules = new MatchRules({ mode: 'control' });
  const point = objective({ owner: 0, progress: -1 });
  rules.update(5, [actor(1)], [point]);
  assert.equal(point.owner, null);
  assert.equal(point.progress, 0);
  assert.deepEqual(rules.scores, [5, 0]);
  rules.update(7, [actor(1)], [point]);
  assert.equal(point.owner, 1);
  assert.equal(point.progress, 1);
  assert.deepEqual(rules.scores, [5, 2]);
});

test('unoccupied points retain progress, ownership, and earned scoring', () => {
  const rules = new MatchRules({ mode: 'control' });
  const point = objective({ owner: 1, progress: 0.4 });
  rules.update(3, [], [point]);
  assert.equal(point.progress, 0.4);
  assert.equal(point.owner, 1);
  assert.deepEqual(rules.scores, [0, 3]);
});

test('control match ends at the first exact limit crossing, including simultaneous draws', () => {
  const rules = new MatchRules({ mode: 'control', scoreLimit: 3 });
  const points = [objective({ owner: 0, progress: -1 }), objective({ owner: 0, progress: -1 }), objective({ owner: 1, progress: 1 })];
  rules.update(20, [], points);
  assert.equal(rules.phase, 'ended');
  assert.equal(rules.winner, 0);
  assert.deepEqual(rules.scores, [3, 1]);
  approx(rules.timeRemaining, 358.5);
  const draw = new MatchRules({ mode: 'control', scoreLimit: 3 });
  draw.update(20, [], points.slice(1));
  assert.equal(draw.phase, 'ended');
  assert.equal(draw.winner, null);
  assert.deepEqual(draw.scores, [3, 3]);
});

test('control timer never scores beyond match duration and kill reports add no points', () => {
  const rules = new MatchRules({ mode: 'control', timeLimit: 2 });
  rules.recordKill(actor(0), actor(1));
  rules.update(50, [], [objective({ owner: 1, progress: 1 })]);
  assert.equal(rules.phase, 'ended');
  assert.equal(rules.winner, 1);
  assert.deepEqual(rules.scores, [0, 2]);
  assert.equal(rules.timeRemaining, 0);
});

test('elimination intermission emits a single new-round signal and retains round wins', () => {
  const rules = new MatchRules({ mode: 'elimination' });
  rules.recordKill(actor(0), actor(1));
  assert.deepEqual(rules.scores, [0, 0]);
  rules.update(0.016, [actor(0), actor(1, 0)]);
  assert.equal(rules.phase, 'roundEnd');
  assert.equal(rules.roundWinner, 0);
  assert.deepEqual(rules.scores, [1, 0]);
  assert.deepEqual(rules.update(3.99), {});
  assert.deepEqual(rules.update(0.01), { newRound: true });
  assert.equal(rules.phase, 'playing');
  assert.equal(rules.round, 2);
  assert.equal(rules.timeRemaining, 90);
  assert.equal(rules.roundWinner, null);
  assert.deepEqual(rules.update(0, [actor(0), actor(1)]), {});
});

test('elimination first to three finishes best-of-five and cannot reset a finished match', () => {
  const rules = new MatchRules({ mode: 'elimination' });
  for (const winner of [0, 1, 0, 1, 1]) {
    const roster = [actor(0, winner === 0 ? 100 : 0), actor(1, winner === 1 ? 100 : 0)];
    rules.update(1, roster);
    if (rules.phase !== 'ended') assert.deepEqual(rules.update(4), { newRound: true });
  }
  assert.equal(rules.round, 5);
  assert.deepEqual(rules.scores, [2, 3]);
  assert.equal(rules.phase, 'ended');
  assert.equal(rules.winner, 1);
  assert.equal(rules.resetRound(), false);
});

test('elimination timer resolves living count first, then health, and replays exact draws', () => {
  const count = new MatchRules({ mode: 'elimination', roundDuration: 2 });
  count.update(2, [actor(0, 1), actor(0, 1), actor(1, 100)]);
  assert.equal(count.roundWinner, 0);
  const health = new MatchRules({ mode: 'elimination', roundDuration: 2 });
  health.update(2, [actor(0, 10), actor(1, 20)]);
  assert.equal(health.roundWinner, 1);
  const draw = new MatchRules({ mode: 'elimination', roundDuration: 2 });
  draw.update(2, [actor(0, 50), actor(1, 50)]);
  assert.equal(draw.phase, 'roundEnd');
  assert.equal(draw.roundWinner, null);
  assert.deepEqual(draw.scores, [0, 0]);
  assert.deepEqual(draw.update(4), { newRound: true });
  assert.equal(draw.round, 1);
});

test('simultaneous elimination is a draw; an empty initial roster does not lose instantly', () => {
  const rules = new MatchRules({ mode: 'elimination' });
  rules.update(0.016, []);
  assert.equal(rules.phase, 'playing');
  rules.update(0, [actor(0, 0), actor(1, 0)]);
  assert.equal(rules.phase, 'roundEnd');
  assert.equal(rules.roundWinner, null);
  assert.deepEqual(rules.scores, [0, 0]);
});

test('invalid elapsed times are harmless and an unsupported mode fails clearly', () => {
  const rules = new MatchRules();
  rules.update(-5);
  rules.update(NaN);
  assert.equal(rules.timeRemaining, 360);
  assert.throws(() => new MatchRules({ mode: 'placeholder' }), RangeError);
});
