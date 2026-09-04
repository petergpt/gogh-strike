/** Distance-driven visual locomotion. This module has no renderer or game-state
 * writes. Local forward is -Z; angles use the existing THREE.Euler XYZ joints.
 * Supporting ankle targets are held in world space. A separate boot joint at
 * lower-leg y=-.300*legScale is needed for the returned ankle compensation.
 */
import {bodyProfile, bodyPose} from './actor-profile.js';

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const finite = (v, fallback = 0) => Number.isFinite(v) ? v : fallback;
const mix = (a, b, t) => a + (b - a) * t;
const fract = v => v - Math.floor(v);
const smooth = v => { const t = clamp(v, 0, 1); return t * t * (3 - 2 * t); };
const smoother = v => { const t = clamp(v, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
const swingProgress = v => { const t = clamp(v, 0, 1); return t * .68 + smoother(t) * .32; };
const ease = (a, b, rate, dt) => mix(a, b, -Math.expm1(-rate * dt));
const angle = v => Math.atan2(Math.sin(v), Math.cos(v));
const BOUNDS = {
  cadence: [.8, 1.2, 1], stride: [.85, 1.2, 1], hipSway: [.65, 1.25, 1],
  shoulderSway: [.6, 1.3, 1], forwardLean: [0, .1, .025],
  headSteadiness: [.75, 1.3, 1], stanceWidth: [.85, 1.25, 1],
  footLift: [.8, 1.2, 1], idleBreath: [.7, 1.3, 1],
  turnLag: [.75, 1.3, 1], handEnergy: [.6, 1.2, 1],
};

function yawRotate(v, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return [c * v[0] + s * v[2], v[1], -s * v[0] + c * v[2]];
}

// THREE's XYZ Euler matrix is Rx * Ry * Rz; its inverse applies X, Y, Z.
function inverseXYZ(v, r) {
  let [x, y, z] = v;
  let c = Math.cos(r[0]), s = Math.sin(r[0]);
  [y, z] = [c * y + s * z, -s * y + c * z];
  c = Math.cos(r[1]); s = Math.sin(r[1]);
  [x, z] = [c * x - s * z, s * x + c * z];
  c = Math.cos(r[2]); s = Math.sin(r[2]);
  return [c * x + s * y, -s * x + c * y, z];
}

function quaternion(r) {
  const [x, y, z] = r.map(v => v / 2), sx = Math.sin(x), cx = Math.cos(x);
  const sy = Math.sin(y), cy = Math.cos(y), sz = Math.sin(z), cz = Math.cos(z);
  return [sx * cy * cz + cx * sy * sz, cx * sy * cz - sx * cy * sz,
    cx * cy * sz + sx * sy * cz, cx * cy * cz - sx * sy * sz];
}
function multiplyQuaternion(a, b) {
  const [x, y, z, w] = a, [X, Y, Z, W] = b;
  return [w * X + x * W + y * Z - z * Y, w * Y - x * Z + y * W + z * X,
    w * Z + x * Y - y * X + z * W, w * W - x * X - y * Y - z * Z];
}
function euler(q) {
  const [x, y, z, w] = q, m13 = 2 * (x * z + y * w);
  return Math.abs(m13) < .9999999 ? [
    Math.atan2(2 * (x * w - y * z), 1 - 2 * (x * x + y * y)), Math.asin(clamp(m13, -1, 1)),
    Math.atan2(2 * (z * w - x * y), 1 - 2 * (y * y + z * z)),
  ] : [Math.atan2(2 * (y * z + x * w), 1 - 2 * (x * x + z * z)), Math.asin(clamp(m13, -1, 1)), 0];
}

function solveLeg(target, a, b) {
  const original = [...target];
  const radius = Math.hypot(...target);
  const reach = clamp(radius, a - b + .004, a + b);
  if (radius > 1e-9 && reach !== radius) target = target.map(v => v * reach / radius);
  const [tx, ty, tz] = target;
  const knee = -Math.acos(clamp((reach * reach - a * a - b * b) / (2 * a * b), -1, 1));
  const d = a + b * Math.cos(knee), e = b * Math.sin(knee);
  const x = clamp(tx, -d * .985, d * .985);
  const roll = Math.asin(clamp(x / d, -1, 1));
  const pitch = Math.atan2(-tz, -ty) - Math.atan2(e, d * Math.cos(roll));
  return {
    hip: [pitch, 0, roll], knee,
    // This diagnoses real geometric saturation; it is not hidden by the floor pass.
    reachError: Math.hypot(original[0] - x, original[1] - ty, original[2] - tz),
    target: [x, ty, tz],
  };
}

/** profile is bodyProfile(look); motion is look.motion, not the whole look. */
export function createCharacterMotion(profile = bodyProfile(), motion = {}) {
  const defaults = bodyProfile();
  const rig = {...defaults, ...profile};
  for (const key of ['legScale', 'torsoScale', 'waistScale', 'hipScale']) {
    const fallback = key === 'hipScale' ? finite(profile?.waistScale, 1) : defaults[key];
    rig[key] = clamp(finite(profile?.[key], fallback), .35, 1.65);
  }
  const weights = Object.fromEntries(Object.entries(BOUNDS).map(([key, [lo, hi, fallback]]) =>
    [key, clamp(finite(motion?.[key], fallback), lo, hi)]));
  return {
    profile: rig, motion: weights, cycles: 0, distance: 0, clock: 0,
    previous: null, previousAlive: true, speed: 0, turn: 0,
    direction: [0, 0, -1], feet: [], lastSample: null,
    seed: rig.legScale * 2.17 + rig.hipScale * .73 + weights.idleBreath * 1.31,
  };
}

function restPoint(state, side, position, yaw, crouch) {
  const p = state.profile, a = .393 * p.legScale, b = .300 * p.legScale;
  const pose = bodyPose(p, {crouch}), hip = 1.32 * crouch, knee = -2.18 * crouch;
  const local = [side * .107 * p.hipScale * state.motion.stanceWidth, 0,
    pose.pelvisZ - a * Math.sin(hip) - b * Math.sin(hip + knee)];
  const v = yawRotate(local, yaw);
  return [position[0] + v[0], position[1] + .008 + .092 * p.legScale, position[2] + v[2]];
}

function resetFeet(state, position, yaw, crouch) {
  state.feet = [-1, 1].map(side => {
    const world = restPoint(state, side, position, yaw, crouch);
    return {side, world, from: [...world], to: [...world], stage: 'support', lift: 0, progress: 0,
      distanceStart: state.distance, distanceEnd: Infinity, stoppedSwing: false};
  });
  state.speed = 0; state.turn = 0; state.needsStart = true;
}

function startSwing(state, foot, position, yaw, crouch, cycleDistance, duty, at, duration = cycleDistance * (1 - duty)) {
  const landing = restPoint(state, foot.side, position, yaw, crouch);
  // The body travels through the entire swing before this foot touches down.
  const ahead = duration + cycleDistance * duty * .5;
  landing[0] += state.direction[0] * ahead;
  landing[2] += state.direction[2] * ahead;
  foot.from = [...foot.world]; foot.to = landing; foot.stage = 'swing';
  foot.distanceStart = at; foot.distanceEnd = at + duration;
  foot.direction = [...state.direction]; foot.planCrouch = crouch;
  foot.startLift = foot.lift; foot.duty = duty; foot.stoppedSwing = false;
}

function sampleFoot(state, foot, old, current, options) {
  const {position, previous, yaw, crouch, cycleDistance, duty, active, dt, activity} = options;
  if (active) {
    // Each support/swing interval is latched in metres, not rescaled by the
    // next frame's speed, crouch blend or duty factor.
    for (let event = 0; event < 8 && foot.distanceEnd <= current; event++) {
      const at = foot.distanceEnd;
      const t = clamp((at - old) / Math.max(1e-12, current - old), 0, 1);
      const eventPosition = position.map((v, i) => mix(previous[i], v, t));
      if (foot.stage === 'support') startSwing(state, foot, eventPosition, yaw, crouch, cycleDistance, duty, at);
      else {
        foot.world = [...foot.to];
        foot.stage = 'support'; foot.lift = 0;
        foot.distanceStart = at; foot.distanceEnd = at + cycleDistance * duty; foot.duty = duty;
      }
    }
    const rest = restPoint(state, foot.side, position, yaw, crouch);
    const separation = Math.hypot(foot.world[0] - rest[0], foot.world[2] - rest[2]);
    const remaining = Math.max(.12 * state.profile.legScale, foot.distanceEnd - current);
    const headingChanged = foot.direction && foot.direction[0] * state.direction[0] + foot.direction[2] * state.direction[2] < .65;
    const expected = [rest[0] + state.direction[0] * (remaining + cycleDistance * duty * .5),
      rest[2] + state.direction[2] * (remaining + cycleDistance * duty * .5)];
    const obsoleteLanding = Math.hypot(foot.to[0] - expected[0], foot.to[2] - expected[1]) > .30 * state.profile.legScale;
    const release = foot.stage === 'support' && separation > mix(.50, .34, crouch) * state.profile.legScale;
    const replan = foot.stage === 'swing' && (foot.stoppedSwing || headingChanged || obsoleteLanding || Math.abs(crouch - foot.planCrouch) > .14);
    if (release || replan) {
      startSwing(state, foot, position, yaw, crouch, cycleDistance, duty, current,
        Math.min(.40 * state.profile.legScale, remaining));
    }
    foot.progress = clamp((current - foot.distanceStart) / Math.max(1e-8, foot.distanceEnd - foot.distanceStart), 0, 1);
    if (foot.stage === 'swing') {
      const u = clamp(foot.progress, 0, 1), t = swingProgress(u);
      foot.world = foot.from.map((v, i) => mix(v, foot.to[i], t));
      const lift = mix(.045, .135, activity) * Math.sqrt(activity) * state.profile.legScale * state.motion.footLift * (1 - crouch * .60);
      foot.lift = (1 - smoother(u)) * foot.startLift + Math.sin(Math.PI * u) ** 2 * lift;
    }
  } else {
    // Do not advance phase or drag the foot horizontally while settling a stop.
    if (foot.stage === 'swing') foot.stoppedSwing = true;
    foot.lift *= Math.exp(-dt * 22);
    if (foot.lift < 1e-5) foot.lift = 0;
  }
  const support = active ? foot.stage === 'support' : foot.lift === 0;
  return {support, progress: foot.progress,
    phase: foot.stage === 'support' ? finite(foot.duty, duty) * foot.progress : finite(foot.duty, duty) + (1 - finite(foot.duty, duty)) * foot.progress};
}

/**
 * Returns complete left/right hip and knee rotations. Use ankleQuaternion for
 * the separated boot; ankle is a pitch-only fallback for an older rig.
 * Pass actual renderYaw when the actor model smooths its root yaw. turnDelta
 * controls anticipation and may be clamped independently by the caller.
 * bodyOffset is added to bodyPose's pelvis position; breath is separate.
 * bodyRotation is the pelvis rotation. torsoRotation is additive to the pose's
 * lean/aim/hurt. headRotation compensates ONLY the returned locomotion rotations;
 * do not counter torsoRotation again when assembling the head's base aim pose.
 * tailSwing is the complete idle/walk/crouch tail pitch before emote/death blends.
 * The caller owns floor correction, hands, combat statistics and death/taunt poses.
 */
export function sampleCharacterMotion(state, {
  dt = 0, actor = {}, time = 0, crouch = 0, aimBlend = 0, turnDelta = 0, renderYaw,
} = {}) {
  const p = state.profile, m = state.motion;
  dt = clamp(finite(dt), 0, .25);
  crouch = clamp(finite(crouch), 0, 1); aimBlend = clamp(finite(aimBlend), 0, 1);
  const velocity = [finite(actor.velocity?.x), finite(actor.velocity?.y), finite(actor.velocity?.z)];
  const hasPosition = Number.isFinite(actor.position?.x) && Number.isFinite(actor.position?.z);
  const prior = state.previous || [0, 0, 0];
  const position = hasPosition ? [actor.position.x, finite(actor.position.y), actor.position.z] :
    prior.map((v, i) => v + velocity[i] * dt);
  const yaw = angle(finite(renderYaw, finite(actor.yaw) - angle(finite(turnDelta))));
  const alive = actor.alive !== false, grounded = actor.grounded !== false;
  const first = !state.previous;
  if (first) {
    state.previous = [...position]; state.previousAlive = alive;
    state.clock = finite(time); resetFeet(state, position, yaw, crouch);
  }
  const previous = state.previous;
  const delta = position.map((v, i) => v - previous[i]);
  // Paused inspection may reposition a model. Rebase contacts, never integrate a jump.
  if (!first && dt === 0 && state.lastSample) {
    for (const foot of state.feet) for (const key of ['world', 'from', 'to'])
      foot[key] = foot[key].map((v, i) => v + delta[i]);
    state.previous = [...position]; state.previousAlive = alive;
    if (delta.some(v => v !== 0)) {
      const previousSample = state.lastSample;
      state.lastSample = {...previousSample, debug: {...previousSample.debug}};
      for (const key of ['left', 'right']) state.lastSample.debug[key] = {...previousSample.debug[key],
        contact: previousSample.debug[key].contact.map((v, i) => v + delta[i])};
    }
    return state.lastSample;
  }
  state.clock += dt;
  const reportedSpeed = Math.hypot(velocity[0], velocity[2]);
  const rawDistance = Math.hypot(delta[0], delta[2]);
  const threshold = Math.max(.7 * p.legScale, dt * Math.max(12, reportedSpeed * 1.7, state.speed * 1.7) + .12);
  const respawn = alive && !state.previousAlive;
  const teleport = !first && (rawDistance > threshold || Math.abs(delta[1]) > Math.max(1.2, dt * 20));
  const discontinuity = first || respawn || teleport;
  if (discontinuity) resetFeet(state, position, yaw, crouch);
  else if (!grounded || actor.sliding) {
    // Airborne/sliding displacement carries the held pose; it is not a footstep.
    for (const foot of state.feet) for (const key of ['world', 'from', 'to'])
      foot[key] = foot[key].map((v, i) => v + delta[i]);
  }
  const travel = !discontinuity && alive && grounded && !actor.sliding ? rawDistance : 0;
  const active = dt > 0 && travel > 1e-6;
  const speed = active ? travel / dt : 0;
  state.speed = ease(state.speed, speed, active ? 15 : 18, dt);
  if (active) state.direction = [delta[0] / travel, 0, delta[2] / travel];
  else if (discontinuity && reportedSpeed > .05) state.direction = [velocity[0] / reportedSpeed, 0, velocity[2] / reportedSpeed];
  const activity = clamp(state.speed / 4.8, 0, 1);
  const run = smooth((speed - 1.3) / 4.8);
  const cycleDistance = p.legScale * m.stride / m.cadence * mix(.86, 2.40, run) * mix(1, .72, crouch);
  const duty = Math.min(mix(.64, .34, run) + crouch * .07,
    p.legScale * mix(mix(.48, .70, run), .50, crouch) / cycleDistance);
  // An initial neutral foot is at mid-stance, not the front of a full stride.
  if (active && state.needsStart) {
    const left = state.feet[0];
    left.distanceStart = state.distance - cycleDistance * duty * .5;
    left.distanceEnd = state.distance + cycleDistance * duty * .5; left.duty = duty;
    startSwing(state, state.feet[1], previous, yaw, crouch, cycleDistance, duty,
      state.distance, cycleDistance * (1 - duty) * .5);
    state.needsStart = false;
  }
  const previousDistance = state.distance;
  if (active) { state.cycles += travel / cycleDistance; state.distance += travel; }
  const feet = state.feet.map(foot => sampleFoot(state, foot, previousDistance, state.distance,
    {position, previous, yaw, crouch, cycleDistance, duty, active, dt, activity}));
  const phase = state.needsStart ? finite(state.lastSample?.phase) : fract(feet[0].phase) * TAU;

  const localDirection = yawRotate(state.direction, -yaw);
  const forward = -localDirection[2], side = localDirection[0];
  state.turn = ease(state.turn, clamp(angle(finite(turnDelta)), -.55, .55), 12 / m.turnLag, dt);
  const aimQuiet = mix(1, .45, aimBlend), crouchQuiet = 1 - crouch * .48;
  const wave = Math.sin(phase), counter = Math.sin(phase + .24);
  const bodyRotation = [0,
    state.turn * .10 * m.turnLag + wave * .023 * m.hipSway * activity * crouchQuiet,
    clamp(-side * activity * .045 + counter * .018 * m.hipSway * activity, -.08, .08) * crouchQuiet,
  ];
  const torsoRotation = [
    -forward * m.forwardLean * activity * crouchQuiet,
    -bodyRotation[1] * .62 - counter * .030 * m.shoulderSway * m.handEnergy * activity * aimQuiet + state.turn * .14,
    -bodyRotation[2] * .55 + Math.sin(phase - .31) * .010 * m.shoulderSway * m.handEnergy * activity * aimQuiet,
  ];
  const compensation = clamp(.76 * m.headSteadiness, .57, .98);
  const headRotation = [
    -(bodyRotation[0] + torsoRotation[0]) * compensation,
    -(bodyRotation[1] + torsoRotation[1]) * compensation + state.turn * .22,
    -(bodyRotation[2] + torsoRotation[2]) * compensation,
  ];
  const breath = alive ? Math.sin(state.clock * (1.77 + m.idleBreath * .16) + state.seed) *
    .0032 * p.torsoScale * m.idleBreath * (1 - activity * .4) : 0;
  const pose = bodyPose(p, {crouch});
  const bodyOffset = [wave * .013 * p.legScale * m.hipSway * activity * crouchQuiet, 0,
    -forward * .008 * p.legScale * activity * crouchQuiet];
  const a = .393 * p.legScale, b = .300 * p.legScale, ankleHeight = .008 + .092 * p.legScale;
  const restDrop = a * Math.cos(1.32 * crouch) + b * Math.cos(-.86 * crouch);
  let hipHeight = ankleHeight + restDrop - .017 * p.legScale * activity * (1 - crouch);
  // Lower the pelvis only enough to accommodate the longest current contact.
  // This is shared by both legs, rather than solving independently floating hips.
  const localFeet = state.feet.map(foot => yawRotate(foot.world.map((v, i) => v - position[i]), -yaw));
  for (let i = 0; i < 2; i++) {
    const foot = state.feet[i], local = localFeet[i];
    const x = local[0] - bodyOffset[0] - foot.side * .107 * p.hipScale;
    const z = local[2] - pose.pelvisZ - bodyOffset[2];
    const reach = a + b - .0015 * p.legScale * activity;
    const possible = local[1] + foot.lift + Math.sqrt(Math.max(.04 * p.legScale ** 2, reach * reach - x * x - z * z));
    hipHeight = Math.min(hipHeight, possible);
  }
  hipHeight = Math.max(ankleHeight + .22 * p.legScale, hipHeight);
  bodyOffset[1] = hipHeight - (pose.pelvisY - .006 * p.legScale);
  const legResults = state.feet.map((foot, i) => {
    const local = [...localFeet[i]]; local[1] += foot.lift;
    const bodyRelative = inverseXYZ([
      local[0] - bodyOffset[0], local[1] - pose.pelvisY - bodyOffset[1],
      local[2] - pose.pelvisZ - bodyOffset[2],
    ], bodyRotation);
    const target = [bodyRelative[0] - foot.side * .107 * p.hipScale,
      bodyRelative[1] + .006 * p.legScale, bodyRelative[2]];
    // Let deeply bent knees open toward lateral travel instead of demanding a
    // large sideways ankle bend. Convert the resulting chain back to XYZ Euler.
    const heading = -clamp(target[0] / (a + b) * 1.4, -.55, .55) * crouch;
    const solved = solveLeg(yawRotate(target, -heading), a, b);
    solved.hip = euler(multiplyQuaternion(quaternion([0, heading, 0]), quaternion(solved.hip)));
    const u = clamp(foot.progress, 0, 1);
    const roll = active ? (feet[i].support ? mix(.07, -.10, smoother(u)) :
      .09 * Math.sin(Math.PI * u) + .05 * smoother((u - .8) * 5)) * (1 - crouch * .70) : 0;
    const ankle = clamp(-solved.hip[0] - solved.knee - bodyRotation[0] + roll, -.75, 1.18);
    const parentRotation = multiplyQuaternion(multiplyQuaternion(quaternion(bodyRotation), quaternion(solved.hip)), quaternion([solved.knee, 0, 0]));
    const inverseParent = parentRotation.map((v, j) => j === 3 ? v : -v);
    const ankleQuaternion = multiplyQuaternion(inverseParent, quaternion([roll, 0, 0]));
    return {...solved, ankle, ankleQuaternion, support: feet[i].support, lift: foot.lift, progress: foot.progress,
      contact: [foot.world[0], foot.world[1] + foot.lift, foot.world[2]]};
  });
  const result = {
    phase, bodyOffset, bodyRotation, torsoRotation, headRotation,
    left: {hip: legResults[0].hip, knee: legResults[0].knee, ankle: legResults[0].ankle, ankleQuaternion: legResults[0].ankleQuaternion},
    right: {hip: legResults[1].hip, knee: legResults[1].knee, ankle: legResults[1].ankle, ankleQuaternion: legResults[1].ankleQuaternion},
    tailSwing: Math.sin(phase - .45) * .068 * activity * m.stride - crouch * .28,
    breath,
    debug: {
      active, grounded, travel, totalDistance: state.distance, speed, cycleDistance, duty,
      teleport, respawn, positionSource: hasPosition ? 'position' : 'velocity',
      left: legResults[0], right: legResults[1],
    },
  };
  state.previous = [...position]; state.previousAlive = alive; state.lastSample = result;
  return result;
}
