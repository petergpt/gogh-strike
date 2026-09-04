import {getArtistTaunt} from './artist-taunts.js';

export const TAUNT_COOLDOWN = 6;
const activeUntil = (value, now) => Number.isFinite(value) && value > now;

/** Read-only lifecycle check. Expiration never extends or changes respawn time. */
export function isTaunting(actor, now) {
  return !!actor && actor.alive === true && !(Number.isFinite(actor.health) && actor.health <= 0) &&
    Number.isFinite(now) && Number.isFinite(actor.tauntStarted) && actor.tauntStarted <= now &&
    typeof actor.tauntId === 'string' && actor.tauntId.length > 0 && activeUntil(actor.tauntUntil, now);
}

/** No game globals: the caller owns match phase, held input and safe placement. */
export function tauntAvailability(actor, now) {
  if (!actor || !Number.isFinite(now) || now < 0) return {ok: false, reason: 'unavailable', readyIn: 0};
  if (actor.alive !== true || Number.isFinite(actor.health) && actor.health <= 0) return {ok: false, reason: 'dead', readyIn: 0};
  if (!actor.grounded) return {ok: false, reason: 'airborne', readyIn: 0};
  if (actor.crouched || actor.sprinting || actor.sliding || activeUntil(actor.slideUntil, now)) return {ok: false, reason: 'stance', readyIn: 0};
  if (['reloadUntil', 'healUntil', 'sprayUntil', 'interactingUntil'].some(key => activeUntil(actor[key], now))) return {ok: false, reason: 'busy', readyIn: 0};
  const readyIn = Math.max(0, Number.isFinite(actor.nextTauntAt) ? actor.nextTauntAt - now : 0);
  if (isTaunting(actor, now)) return {ok: false, reason: 'active', readyIn};
  if (readyIn > 0) return {ok: false, reason: 'cooldown', readyIn};
  return {ok: true, readyIn: 0};
}

export function canTaunt(actor, now) {return tauntAvailability(actor, now).ok;}

/** Begin a cosmetic gesture. No health, ammo, combat timing or movement-stat
 * changes. The controller cancels on movement/actions/damage before applying
 * that input, so leaving the pose never adds an action delay.
 */
export function beginTaunt(actor, now, {definition} = {}) {
  const available = tauntAvailability(actor, now);
  if (!available.ok) return available;
  const taunt = definition || getArtistTaunt(actor);
  const duration = Number.isFinite(taunt?.duration) && taunt.duration > 0 ? Math.min(taunt.duration, 3.2) : 2.8;
  const cooldown = Number.isFinite(taunt?.cooldown) ? Math.max(TAUNT_COOLDOWN, taunt.cooldown) : TAUNT_COOLDOWN;
  const id = typeof taunt?.id === 'string' && taunt.id ? taunt.id : 'artist-taunt';
  actor.tauntStarted = now;
  actor.tauntUntil = now + duration;
  actor.tauntId = id;
  actor.nextTauntAt = now + cooldown;
  actor.protectedUntil = 0;
  if (actor.velocity?.set) actor.velocity.set(0, 0, 0);
  else if (actor.velocity) {actor.velocity.x = 0; actor.velocity.y = 0; actor.velocity.z = 0;}
  actor.ads = false; actor.aiming = false; actor.pitch = 0; actor.burstRemaining = 0;
  return {ok: true, id, name: taunt?.name || 'Artist taunt', duration, until: actor.tauntUntil, readyAt: actor.nextTauntAt};
}

export const requestTaunt = beginTaunt;

/** Cancellation retains cooldown and combat timers, including an active reload. */
export function cancelTaunt(actor) {
  if (!actor) return false;
  const hadGesture = typeof actor.tauntId === 'string' && actor.tauntId.length > 0 && Number.isFinite(actor.tauntUntil) && actor.tauntUntil > 0;
  actor.tauntUntil = 0;
  actor.tauntId = null;
  return hadGesture;
}
