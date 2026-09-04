/** Competitive Exhibition Contest rules. Rendering, navigation and gear live in the game. */
const EPSILON = 1e-8;
const teamOf = (actor) => actor?.team === 0 || actor?.team === 1 ? actor.team : null;
const living = (actor) => teamOf(actor) !== null && actor.alive !== false && actor.dead !== true && actor.spectator !== true && (actor.health ?? 100) > 0;
const positive = (value, fallback) => Number.isFinite(value) && value > 0 ? value : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const positionOf = (actor) => actor?.position ?? actor?.mesh?.position;
const copyPosition = (position) => position && Number.isFinite(position.x) && Number.isFinite(position.z) ? { x: position.x, y: Number.isFinite(position.y) ? position.y : 0, z: position.z } : null;
const distanceSquared = (a, b) => a && b ? (a.x - b.x) ** 2 + (a.z - b.z) ** 2 : Infinity;
const byId = (a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true });

export const TACTICAL_ECONOMY = Object.freeze({
  startingCredits: 3800,
  creditLimit: 10000,
  killReward: 200,
  plantReward: 300,
  removeReward: 300,
  winReward: 2700,
  lossReward: 2100,
  lossStreakBonus: 500,
});

const newStatistics = (actor) => ({
  actorId: actor.id, name: actor.name ?? String(actor.id), team: actor.team,
  kills: 0, deaths: 0, damage: 0, plants: 0, removals: 0,
  objectivePoints: 0, roundWins: 0, mvpAwards: 0, creditsEarned: 0,
});

/**
 * Best-of-three, alternating attack and defence. Stable actor IDs are required.
 * update(dt, actors, sites) receives the two current sites {id,name,position,radius}.
 * Call interact(actor, dt, {active, interrupted, nearSite, hasLineOfSight}) once
 * per actor per frame after update. Inactive/released holds must pass active:false.
 * nearSite optionally selects a site by object or id; it never bypasses range.
 * Damage and moving >0.4m from the hold origin cancel interaction progress.
 * The world should block firing/movement during staging as desired, prevent
 * respawns in active rounds, and implement purchased gear only after spendCredits.
 */
export class TacticalRules {
  constructor(config = {}) {
    this.mode = 'tactical';
    this.roundsToWin = Math.max(1, Math.floor(positive(config.roundsToWin, 2)));
    this.scoreLimit = this.roundsToWin;
    this.stagingDuration = positive(config.stagingDuration, 18);
    this.roundDuration = positive(config.roundDuration, 150);
    this.beaconDuration = positive(config.beaconDuration, 45);
    this.plantDuration = positive(config.plantDuration, 4);
    this.removeDuration = positive(config.removeDuration ?? config.defuseDuration, 6);
    this.intermissionDuration = positive(config.intermissionDuration, 5);
    this.pickupRadius = positive(config.pickupRadius, 1.8);
    this.removeRadius = positive(config.removeRadius, 2.6);
    this.movementTolerance = positive(config.movementTolerance, 0.4);
    this.preferredCarrierId = config.carrierId ?? null;
    this.economy = { ...TACTICAL_ECONOMY };
    for (const key of Object.keys(this.economy)) {
      if (Number.isFinite(config[key]) && config[key] >= 0) this.economy[key] = Math.floor(config[key]);
    }
    this.economy.creditLimit = Math.max(1, this.economy.creditLimit);
    this.phase = 'staging';
    this.scores = [0, 0];
    this.round = 1;
    this.winner = null;
    this.roundWinner = null;
    this.roundReason = null;
    this.roundCountdown = 0;
    this.attackingTeam = config.firstAttackingTeam === 1 ? 1 : 0;
    this.defendingTeam = 1 - this.attackingTeam;
    this.timeRemaining = this.stagingDuration;
    this.roundTimeRemaining = this.roundDuration;
    this.beaconTimeRemaining = 0;
    this.beaconState = 'waiting';
    this.carrierId = null;
    this.devicePosition = null;
    this.plantedAt = null;
    this.plantedSiteId = null;
    this.plantedSiteName = null;
    this.plantedById = null;
    this.interaction = null;
    this.plantProgress = 0;
    this.removeProgress = 0;
    this.sites = [];
    this.roundHistory = [];
    this.mvp = null;
    this.matchMVP = null;
    this._actors = new Map();
    this._stats = new Map();
    this._roundStats = new Map();
    this._interactions = new Map();
    this._deaths = new Set();
    this._lossStreaks = [0, 0];
    this._frame = 0;
    this._elapsed = 0;
    this._readyRequested = false;
  }

  get statistics() { return [...this._stats.values()].map((entry) => ({ ...entry })); }
  get roundStatistics() { return [...this._roundStats.values()].map((entry) => ({ ...entry })); }
  get defending() { return this.defendingTeam; }
  get attacking() { return this.attackingTeam; }

  _register(actor) {
    if (!actor || actor.id === null || actor.id === undefined || teamOf(actor) === null || actor.spectator) return null;
    const previous = this._actors.get(actor.id);
    if (!this._stats.has(actor.id)) {
      actor.credits = clamp(Math.floor(Number.isFinite(actor.credits) ? actor.credits : this.economy.startingCredits), 0, this.economy.creditLimit);
      this._stats.set(actor.id, newStatistics(actor));
    } else if (!Number.isFinite(actor.credits)) {
      actor.credits = previous?.credits ?? Math.min(this.economy.startingCredits, this.economy.creditLimit);
    }
    actor.credits = clamp(Math.floor(actor.credits), 0, this.economy.creditLimit);
    if (!this._roundStats.has(actor.id)) this._roundStats.set(actor.id, newStatistics(actor));
    this._actors.set(actor.id, actor);
    return actor;
  }

  /** Root applies the actual item only when this returns true. */
  spendCredits(actor, amount) {
    if (this.phase !== 'staging' || !Number.isFinite(amount) || amount < 0 || !Number.isInteger(amount) || !this._register(actor) || actor.credits < amount) return false;
    actor.credits -= amount;
    return true;
  }

  /** A ready button can retain its user gesture for pointer lock. */
  ready() {
    if (this.phase !== 'staging') return false;
    this._readyRequested = true;
    return true;
  }

  _reward(actor, amount) {
    if (!this._register(actor)) return;
    const earned = Math.min(Math.max(0, Math.floor(amount)), this.economy.creditLimit - actor.credits);
    actor.credits += earned;
    this._stats.get(actor.id).creditsEarned += earned;
    this._roundStats.get(actor.id).creditsEarned += earned;
  }

  _addStatistic(actor, key, amount) {
    if (!this._register(actor)) return;
    this._stats.get(actor.id)[key] += amount;
    this._roundStats.get(actor.id)[key] += amount;
  }

  recordDamage(attacker, victim, actualDamage) {
    if (this.phase !== 'playing' || !attacker || !victim || attacker === victim || teamOf(attacker) === null || teamOf(victim) === null || attacker.team === victim.team || !Number.isFinite(actualDamage) || actualDamage <= 0) return false;
    this._addStatistic(attacker, 'damage', actualDamage);
    this._cancelInteraction(victim.id);
    return true;
  }

  /** Called once on death; duplicate victim reports in this round are ignored. */
  recordKill(killer, victim) {
    if (this.phase !== 'playing' || !this._register(victim) || this._deaths.has(victim.id)) return false;
    this._deaths.add(victim.id);
    this._addStatistic(victim, 'deaths', 1);
    this._cancelInteraction(victim.id);
    if (victim.id === this.carrierId) this._dropDevice(victim);
    if (killer && killer !== victim && teamOf(killer) !== null && killer.team !== victim.team) {
      this._addStatistic(killer, 'kills', 1);
      this._reward(killer, this.economy.killReward);
    }
    return true;
  }

  _dropDevice(carrier) {
    if (this.beaconState === 'planted' || this.carrierId === null) return;
    this.devicePosition = copyPosition(positionOf(carrier)) ?? this.devicePosition;
    this.carrierId = null;
    this.beaconState = 'dropped';
    this._cancelInteraction(carrier?.id);
  }

  _updateDevice(actors) {
    if (this.beaconState === 'waiting') {
      const candidates = actors.filter((actor) => living(actor) && actor.team === this.attackingTeam && actor.id !== undefined).sort(byId);
      const role = (actor) => actor.role ?? actor.botRole ?? actor.squadRole ?? actor.botState?.role;
      const carrier = candidates.find((actor) => actor.id === this.preferredCarrierId) ?? candidates.find((actor) => actor.isPlayer) ?? candidates.find((actor) => role(actor) === 'vanguard') ?? candidates.find((actor) => role(actor) === 'scout') ?? candidates[0];
      if (carrier) {
        this.carrierId = carrier.id;
        this.devicePosition = copyPosition(positionOf(carrier));
        this.beaconState = 'carried';
        return { deviceAssigned: true, carrierId: carrier.id };
      }
    } else if (this.beaconState === 'carried') {
      const carrier = actors.find((actor) => actor.id === this.carrierId);
      if (living(carrier)) this.devicePosition = copyPosition(positionOf(carrier)) ?? this.devicePosition;
      else {
        this._dropDevice(carrier);
        return { deviceDropped: true };
      }
    } else if (this.beaconState === 'dropped' && this.devicePosition) {
      const candidates = actors.filter((actor) => living(actor) && actor.team === this.attackingTeam && distanceSquared(positionOf(actor), this.devicePosition) <= this.pickupRadius ** 2 && Math.abs((positionOf(actor)?.y ?? 0) - this.devicePosition.y) <= 2);
      candidates.sort((a, b) => distanceSquared(positionOf(a), this.devicePosition) - distanceSquared(positionOf(b), this.devicePosition) || byId(a, b));
      if (candidates.length) {
        const carrier = candidates[0];
        this.carrierId = carrier.id;
        this.devicePosition = copyPosition(positionOf(carrier));
        this.beaconState = 'carried';
        return { devicePickedUp: true, carrierId: carrier.id };
      }
    }
    return {};
  }

  update(dt, actors = [], objectives = []) {
    if (!Number.isFinite(dt) || dt < 0 || this.phase === 'ended') return {};
    this._frame += 1;
    this._elapsed += dt;
    for (const actor of actors) this._register(actor);
    this.sites = objectives.filter((site) => site && site.active !== false && copyPosition(site.position));
    if (this.phase === 'roundEnd') {
      this.roundCountdown = Math.max(0, this.roundCountdown - dt);
      if (this.roundCountdown <= EPSILON) {
        this.resetRound();
        return { newRound: true, stageChanged: true, phase: 'staging' };
      }
      return {};
    }

    const events = this._updateDevice(actors);
    for (const [id, hold] of this._interactions) {
      const actor = actors.find((candidate) => candidate.id === id);
      if (!living(actor) || hold.frame < this._frame - 1 || (actor.health ?? 100) < hold.health || distanceSquared(positionOf(actor), hold.origin) > this.movementTolerance ** 2) this._interactions.delete(id);
    }
    this._refreshInteraction();

    if (this.phase === 'staging') {
      this.timeRemaining = Math.max(0, this.timeRemaining - dt);
      if (this._readyRequested || this.timeRemaining <= EPSILON) {
        this._readyRequested = false;
        this.phase = 'playing';
        this.timeRemaining = this.roundDuration;
        this.roundTimeRemaining = this.roundDuration;
        return { ...events, stageChanged: true, phase: 'playing' };
      }
      return events;
    }

    const roster = actors.filter((actor) => teamOf(actor) !== null && !actor.spectator);
    const attackers = roster.filter((actor) => actor.team === this.attackingTeam && living(actor));
    const defenders = roster.filter((actor) => actor.team === this.defendingTeam && living(actor));
    if (roster.length > 0 && defenders.length === 0) {
      this._finishRound(this.attackingTeam, 'defenders-eliminated');
      return { ...events, roundEnded: true };
    }
    if (roster.length > 0 && attackers.length === 0 && this.beaconState !== 'planted') {
      this._finishRound(this.defendingTeam, 'attackers-eliminated');
      return { ...events, roundEnded: true };
    }
    if (this.beaconState === 'planted') {
      this.beaconTimeRemaining = Math.max(0, this.beaconTimeRemaining - dt);
      this.timeRemaining = this.beaconTimeRemaining;
      if (this.beaconTimeRemaining <= EPSILON) {
        this.beaconState = 'completed';
        this._finishRound(this.attackingTeam, 'beacon-completed');
        return { ...events, beaconCompleted: true, roundEnded: true };
      }
    } else {
      this.roundTimeRemaining = Math.max(0, this.roundTimeRemaining - dt);
      this.timeRemaining = this.roundTimeRemaining;
      if (this.roundTimeRemaining <= EPSILON) {
        this._finishRound(this.defendingTeam, 'time-expired');
        return { ...events, roundEnded: true };
      }
    }
    return events;
  }

  _siteInRange(actor, selected) {
    const position = positionOf(actor);
    const selectedId = selected && typeof selected === 'object' ? selected.id : selected;
    return this.sites.find((site) => (selectedId === undefined || selectedId === true || selectedId === null || site.id === selectedId) && distanceSquared(position, site.position) <= positive(site.radius, 3.8) ** 2 && Math.abs((position?.y ?? 0) - (site.position.y ?? 0)) <= 2.5);
  }

  _cancelInteraction(id) {
    this._interactions.delete(id);
    this._refreshInteraction();
  }

  _refreshInteraction() {
    const holds = [...this._interactions.values()].sort((a, b) => b.elapsed / b.duration - a.elapsed / a.duration || String(a.actorId).localeCompare(String(b.actorId)));
    this.interaction = holds.length ? { actorId: holds[0].actorId, kind: holds[0].kind, progress: clamp(holds[0].elapsed / holds[0].duration, 0, 1), duration: holds[0].duration, siteId: holds[0].siteId } : null;
    this.plantProgress = Math.max(0, ...holds.filter((hold) => hold.kind === 'plant').map((hold) => clamp(hold.elapsed / hold.duration, 0, 1)));
    this.removeProgress = Math.max(0, ...holds.filter((hold) => hold.kind === 'remove').map((hold) => clamp(hold.elapsed / hold.duration, 0, 1)));
  }

  /** Returns {kind,progress,complete} plus planted/removed on successful completion. */
  interact(actor, dt, options = {}) {
    const id = actor?.id;
    if (this.phase !== 'playing' || !living(actor) || !Number.isFinite(dt) || dt < 0 || options.active === false || options.interrupted || options.hasLineOfSight === false || options.nearSite === false) {
      this._cancelInteraction(id);
      return { kind: null, progress: 0, complete: false };
    }
    let kind, site, duration;
    if (actor.team === this.attackingTeam && this.beaconState === 'carried' && id === this.carrierId) {
      site = this._siteInRange(actor, options.nearSite);
      if (site) { kind = 'plant'; duration = this.plantDuration; }
    } else if (actor.team === this.defendingTeam && this.beaconState === 'planted' && distanceSquared(positionOf(actor), this.plantedAt) <= this.removeRadius ** 2 && Math.abs((positionOf(actor)?.y ?? 0) - (this.plantedAt?.y ?? 0)) <= 2.5) {
      site = this.sites.find((candidate) => candidate.id === this.plantedSiteId) ?? { id: this.plantedSiteId, name: this.plantedSiteName, position: this.plantedAt };
      kind = 'remove'; duration = this.removeDuration;
    }
    if (!kind) {
      this._cancelInteraction(id);
      return { kind: null, progress: 0, complete: false };
    }
    let hold = this._interactions.get(id);
    if (hold && ((actor.health ?? 100) < hold.health || distanceSquared(positionOf(actor), hold.origin) > this.movementTolerance ** 2)) {
      this._cancelInteraction(id);
      return { kind, progress: 0, complete: false, interrupted: true };
    }
    if (!hold || hold.kind !== kind || hold.siteId !== site.id || hold.frame < this._frame - 1) {
      hold = { actorId: id, kind, siteId: site.id, elapsed: 0, duration, origin: copyPosition(positionOf(actor)), health: actor.health ?? 100, frame: this._frame };
      this._interactions.set(id, hold);
    }
    hold.frame = this._frame;
    hold.elapsed = Math.min(duration, hold.elapsed + dt);
    this._refreshInteraction();
    const result = { kind, progress: hold.elapsed / duration, complete: hold.elapsed + EPSILON >= duration };
    if (!result.complete) return result;
    if (kind === 'plant') {
      this.beaconState = 'planted';
      this.plantedAt = copyPosition(positionOf(actor));
      this.devicePosition = { ...this.plantedAt };
      this.plantedSiteId = site.id;
      this.plantedSiteName = site.name ?? String(site.id);
      this.plantedById = id;
      this.carrierId = null;
      this.beaconTimeRemaining = this.beaconDuration;
      this.timeRemaining = this.beaconTimeRemaining;
      this._addStatistic(actor, 'plants', 1);
      this._addStatistic(actor, 'objectivePoints', 2);
      this._reward(actor, this.economy.plantReward);
      this._interactions.clear();
      this._refreshInteraction();
      return { ...result, planted: true, actorId: id, siteId: site.id };
    }
    this.beaconState = 'removed';
    this._addStatistic(actor, 'removals', 1);
    this._addStatistic(actor, 'objectivePoints', 3);
    this._reward(actor, this.economy.removeReward);
    this._finishRound(this.defendingTeam, 'beacon-removed');
    return { ...result, removed: true, roundEnded: true, actorId: id, siteId: site.id };
  }

  _selectMVP(entries, winningTeam) {
    const ranked = entries.filter((entry) => entry.team === winningTeam).map((entry) => ({ ...entry, score: entry.kills * 100 + entry.damage * 0.25 + entry.objectivePoints * 100 }));
    ranked.sort((a, b) => b.score - a.score || b.objectivePoints - a.objectivePoints || b.kills - a.kills || String(a.actorId).localeCompare(String(b.actorId), undefined, { numeric: true }));
    if (!ranked.length) return null;
    const best = ranked[0];
    return { ...best, reason: best.removals > 0 ? 'Beacon removed' : best.plants > 0 ? 'Beacon planted' : best.kills > 0 ? `${best.kills} elimination${best.kills === 1 ? '' : 's'}` : 'Team victory' };
  }

  _finishRound(winner, reason) {
    if (this.phase !== 'playing') return;
    this.roundWinner = winner;
    this.roundReason = reason;
    this.scores[winner] += 1;
    this._lossStreaks[winner] = 0;
    this._lossStreaks[1 - winner] += 1;
    for (const actor of this._actors.values()) {
      if (actor.team === winner) {
        this._addStatistic(actor, 'roundWins', 1);
        this._reward(actor, this.economy.winReward);
      } else {
        this._reward(actor, this.economy.lossReward + this.economy.lossStreakBonus * Math.max(0, this._lossStreaks[actor.team] - 1));
      }
    }
    this.mvp = this._selectMVP([...this._roundStats.values()], winner);
    if (this.mvp) {
      const actor = this._actors.get(this.mvp.actorId);
      if (actor) this._addStatistic(actor, 'mvpAwards', 1);
    }
    this.roundHistory.push({ round: this.round, winner, reason, attackingTeam: this.attackingTeam, siteId: this.plantedSiteId, mvp: this.mvp ? { ...this.mvp } : null });
    this._interactions.clear();
    this._refreshInteraction();
    if (this.scores[winner] >= this.roundsToWin) {
      this.phase = 'ended';
      this.winner = winner;
      this.roundCountdown = 0;
      this.matchMVP = this._selectMVP([...this._stats.values()], winner);
    } else {
      this.phase = 'roundEnd';
      this.roundCountdown = this.intermissionDuration;
    }
  }

  /** The update newRound event asks the root game to respawn everyone and move sites. */
  resetRound() {
    if (this.phase !== 'roundEnd') return false;
    this.round = this.scores[0] + this.scores[1] + 1;
    this.attackingTeam = 1 - this.attackingTeam;
    this.defendingTeam = 1 - this.attackingTeam;
    this.phase = 'staging';
    this.timeRemaining = this.stagingDuration;
    this.roundTimeRemaining = this.roundDuration;
    this.roundCountdown = 0;
    this.roundWinner = null;
    this.roundReason = null;
    this.beaconTimeRemaining = 0;
    this.beaconState = 'waiting';
    this.carrierId = null;
    this.devicePosition = null;
    this.plantedAt = null;
    this.plantedSiteId = null;
    this.plantedSiteName = null;
    this.plantedById = null;
    this.sites = [];
    this.mvp = null;
    this._roundStats.clear();
    this._interactions.clear();
    this._deaths.clear();
    this._readyRequested = false;
    this._refreshInteraction();
    return true;
  }
}

export default TacticalRules;
