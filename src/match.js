/** Pure match rules. Team 0 captures toward -1; team 1 captures toward +1. */
const MODES = new Set(['tdm', 'control', 'elimination']);
const EPSILON = 1e-8;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const validTeam = (team) => team === 0 || team === 1;
const positive = (value, fallback) => Number.isFinite(value) && value > 0 ? value : fallback;
const isAlive = (actor) => actor && validTeam(actor.team) && actor.alive !== false && actor.dead !== true && actor.spectator !== true && (actor.health ?? 100) > 0;

/**
 * Actors remain in the roster after death: {team, health, alive, position:{x,z}}.
 * A victim's death must be reported once by the combat system. Respawning, actor
 * statistics, and the human player's presentation are deliberately owned there.
 */
export class MatchRules {
  constructor(config = {}) {
    this.mode = config.mode ?? 'tdm';
    if (!MODES.has(this.mode)) throw new RangeError(`Unknown match mode: ${this.mode}`);
    this.roundsToWin = Math.max(1, Math.floor(positive(config.roundsToWin, 3)));
    this.scoreLimit = positive(config.scoreLimit, this.mode === 'tdm' ? 40 : this.mode === 'control' ? 180 : this.roundsToWin);
    this.timeLimit = positive(config.timeLimit, this.mode === 'elimination' ? 90 : 360);
    this.roundDuration = positive(config.roundDuration, this.timeLimit);
    this.intermissionDuration = positive(config.intermissionDuration, 4);
    this.captureTime = positive(config.captureTime, 5);
    this.pointRate = positive(config.pointRate, 1);
    this.scores = [0, 0];
    this._fractions = [0, 0];
    this.phase = 'playing';
    this.timeRemaining = this.mode === 'elimination' ? this.roundDuration : this.timeLimit;
    this.round = 1;
    this.winner = null;
    this.roundWinner = null;
    this.roundCountdown = 0;
  }

  /** Reset the next elimination round, retaining earned round wins. */
  resetRound() {
    if (this.phase === 'ended') return false;
    this.phase = 'playing';
    this.timeRemaining = this.roundDuration;
    this.roundCountdown = 0;
    this.roundWinner = null;
    // A drawn round is replayed under the same round number.
    this.round = this.scores[0] + this.scores[1] + 1;
    return true;
  }

  recordKill(killer, victim) {
    if (this.phase !== 'playing' || this.mode !== 'tdm' || !killer || !victim || killer === victim || !validTeam(killer.team) || !validTeam(victim.team) || killer.team === victim.team) return false;
    this.scores[killer.team] += 1;
    if (this.scores[killer.team] >= this.scoreLimit) this._endMatch(killer.team);
    return true;
  }

  /** Advance time in seconds. A newRound event is returned exactly once. */
  update(dt, actors = [], objectives = []) {
    if (!Number.isFinite(dt) || dt < 0 || this.phase === 'ended') return {};
    if (this.phase === 'roundEnd') {
      this.roundCountdown = Math.max(0, this.roundCountdown - dt);
      if (this.roundCountdown <= EPSILON) {
        this.resetRound();
        return { newRound: true };
      }
      return {};
    }

    const elapsed = Math.min(dt, this.timeRemaining);
    if (this.mode === 'control') {
      const played = this._updateControl(elapsed, actors, objectives);
      this.timeRemaining = Math.max(0, this.timeRemaining - played);
    } else {
      this.timeRemaining = Math.max(0, this.timeRemaining - elapsed);
    }
    if (this.phase === 'ended') return {};

    if (this.mode === 'elimination') {
      const living = [0, 0];
      const health = [0, 0];
      let rosterSize = 0;
      for (const actor of actors) {
        if (!actor || !validTeam(actor.team) || actor.spectator) continue;
        rosterSize += 1;
        if (!isAlive(actor)) continue;
        living[actor.team] += 1;
        health[actor.team] += Math.max(0, actor.health ?? 100);
      }
      if (rosterSize > 0 && (living[0] === 0 || living[1] === 0)) {
        this._endRound(living[0] === living[1] ? null : living[0] > living[1] ? 0 : 1);
      } else if (this.timeRemaining <= EPSILON) {
        this._endRound(living[0] !== living[1] ? (living[0] > living[1] ? 0 : 1) : health[0] !== health[1] ? (health[0] > health[1] ? 0 : 1) : null);
      }
    } else if (this.timeRemaining <= EPSILON) {
      this._endMatch(this.scores[0] === this.scores[1] ? null : this.scores[0] > this.scores[1] ? 0 : 1);
    }
    return {};
  }

  _endMatch(winner) {
    this.phase = 'ended';
    this.winner = winner;
    this.roundCountdown = 0;
  }

  _endRound(winner) {
    this.roundWinner = winner;
    if (winner !== null) this.scores[winner] += 1;
    if (winner !== null && this.scores[winner] >= this.roundsToWin) {
      this._endMatch(winner);
    } else {
      this.phase = 'roundEnd';
      this.roundCountdown = this.intermissionDuration;
    }
  }

  _updateControl(dt, actors, objectives) {
    const schedules = objectives.map((objective) => this._objectiveSchedule(objective, dt, actors));
    const boundaries = [0, dt];
    for (const schedule of schedules) {
      for (const interval of schedule.scoring) boundaries.push(interval.start, interval.end);
    }
    boundaries.sort((a, b) => a - b);
    const times = boundaries.filter((value, index) => index === 0 || value - boundaries[index - 1] > EPSILON);
    const rawScores = this.scores.map((score, team) => score + this._fractions[team]);
    let played = dt;
    let limitWinner;

    // Integrate at ownership changes so long frames cannot give a point before
    // capture, score while contested, or award the wrong team a close finish.
    for (let i = 0; i < times.length - 1; i += 1) {
      const start = times[i];
      const end = times[i + 1];
      const midpoint = (start + end) / 2;
      const rates = [0, 0];
      for (const schedule of schedules) {
        for (const interval of schedule.scoring) {
          if (midpoint >= interval.start && midpoint < interval.end) rates[interval.team] += this.pointRate;
        }
      }
      const finishTimes = rates.map((rate, team) => rate > 0 ? Math.max(0, this.scoreLimit - rawScores[team]) / rate : Infinity);
      const firstFinish = Math.min(...finishTimes);
      const duration = Math.min(end - start, firstFinish);
      for (let team = 0; team < 2; team += 1) rawScores[team] += rates[team] * duration;
      if (firstFinish <= end - start + EPSILON) {
        played = start + duration;
        limitWinner = Math.abs(finishTimes[0] - finishTimes[1]) < EPSILON ? null : finishTimes[0] < finishTimes[1] ? 0 : 1;
        break;
      }
    }
    for (let team = 0; team < 2; team += 1) {
      const raw = Math.min(rawScores[team], this.scoreLimit);
      this.scores[team] = Math.floor(raw + EPSILON);
      this._fractions[team] = Math.max(0, raw - this.scores[team]);
    }
    for (const schedule of schedules) schedule.apply(played);
    if (limitWinner !== undefined) this._endMatch(limitWinner);
    return played;
  }

  _objectiveSchedule(objective, dt, actors) {
    const owner = validTeam(objective.owner) ? objective.owner : null;
    const progress = clamp(Number.isFinite(objective.progress) ? objective.progress : owner === 0 ? -1 : owner === 1 ? 1 : 0, -1, 1);
    const counts = [0, 0];
    const radius = positive(objective.radius, 6);
    const center = objective.position ?? objective;
    for (const actor of actors) {
      if (!isAlive(actor)) continue;
      const position = actor.position ?? actor.mesh?.position;
      if (!position) continue;
      const dx = position.x - center.x;
      const dz = position.z - center.z;
      if (dx * dx + dz * dz <= radius * radius) counts[actor.team] += 1;
    }
    const contested = counts[0] > 0 && counts[1] > 0;
    const capturing = contested ? null : counts[0] > 0 ? 0 : counts[1] > 0 ? 1 : null;
    const direction = capturing === 0 ? -1 : 1;
    const neutralTime = capturing !== null && owner !== null && owner !== capturing ? Math.max(0, -progress * direction * this.captureTime) : Infinity;
    const captureTime = capturing !== null ? Math.max(0, (1 - progress * direction) * this.captureTime) : Infinity;
    const scoring = [];
    if (!contested && owner !== null) {
      const end = Math.min(dt, neutralTime);
      if (end > 0) scoring.push({ team: owner, start: 0, end });
    }
    if (!contested && capturing !== null && capturing !== owner && captureTime < dt) {
      scoring.push({ team: capturing, start: captureTime, end: dt });
    }
    return {
      scoring,
      apply: (elapsed) => {
        objective.contested = contested;
        objective.counts = counts;
        objective.capturing = capturing;
        objective.progress = capturing === null ? progress : clamp(progress + direction * elapsed / this.captureTime, -1, 1);
        objective.owner = owner;
        if (capturing !== null) {
          if (elapsed + EPSILON >= neutralTime) objective.owner = null;
          if (elapsed + EPSILON >= captureTime) objective.owner = capturing;
        }
      },
    };
  }
}

export default MatchRules;
