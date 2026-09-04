/**
 * Procedural weapon audio. No samples, network requests, or combat-module imports.
 * Each sound owns a bounded route; native AudioContext scheduling keeps reloads
 * and actions in time, and every scheduled source is retained until it ends.
 */
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const IDS = ['pistol', 'smg', 'rifle', 'shotgun', 'sniper'];
const SIGNATURES = Object.freeze({
  pistol: { pitch: 151, tail: .17, crack: 7300, body: 1700, reload: 1.35 },
  smg: { pitch: 183, tail: .105, crack: 5600, body: 2400, reload: 1.8 },
  rifle: { pitch: 105, tail: .25, crack: 6500, body: 1700, reload: 2.2 },
  shotgun: { pitch: 67, tail: .43, crack: 4200, body: 1100, reload: 2.65 },
  sniper: { pitch: 88, tail: .56, crack: 8500, body: 1600, reload: 2.8 },
});

function weaponInfo(value) {
  const id = typeof value === 'string' ? value : typeof value === 'number' ? IDS[value] : value?.id;
  const key = Object.hasOwn(SIGNATURES, id) ? id : 'rifle';
  return { id: key, ...SIGNATURES[key], reload: Math.max(.25, finite(value?.reloadTime, SIGNATURES[key].reload)) };
}
function disconnect(node) { try { node?.disconnect(); } catch { /* Already disconnected or context closed. */ } }
function vector(value, fallback) {
  return { x: finite(value?.x ?? value?.[0], fallback.x), y: finite(value?.y ?? value?.[1], fallback.y), z: finite(value?.z ?? value?.[2], fallback.z) };
}

export class AudioEngine {
  constructor() {
    this.context = null;
    this.master = null;
    this.volume = .65;
    this.enabled = true;
    this.noiseBuffer = null;
    this.position = { x: 0, y: 0, z: 0 };
    this.forward = { x: 0, y: 0, z: -1 };
    this.right = { x: 1, y: 0, z: 0 };
    this.maxVoices = 32;
    this.activeVoices = 0;
    this._routes = new Set();
    this._reloadRoute = null;
    this._limiter = null;
    this._destroyed = false;
    this._closePromise = null;
  }

  async unlock() {
    if (this._destroyed) return false;
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext || globalThis.window?.AudioContext || globalThis.window?.webkitAudioContext;
    if (!Context) return false;
    try {
      if (!this.context) {
        const ctx = new Context();
        this.context = ctx;
        this.master = ctx.createGain();
        this.master.gain.value = this.enabled ? this.volume : 0;
        // A short limiter controls overlapping automatic fire without flattening
        // each weapon's transient. Older WebAudio implementations can omit it.
        if (ctx.createDynamicsCompressor) {
          const limiter = ctx.createDynamicsCompressor();
          limiter.threshold.value = -9; limiter.knee.value = 5; limiter.ratio.value = 9;
          limiter.attack.value = .003; limiter.release.value = .13;
          this.master.connect(limiter); limiter.connect(ctx.destination); this._limiter = limiter;
        } else this.master.connect(ctx.destination);
        this.noiseBuffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 2), ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
      const ctx = this.context;
      if (ctx.state !== 'running' && ctx.state !== 'closed') await ctx.resume();
      return !this._destroyed && this.context === ctx && ctx.state === 'running';
    } catch {
      // An interrupted resume can be retried by the next user gesture. A context
      // that failed during construction has no complete output to retain.
      if (this.context && !this.noiseBuffer) this._discardContext();
      return false;
    }
  }

  setVolume(value) {
    this.volume = clamp(finite(value), 0, 1);
    if (this.master && this.context?.state !== 'closed') {
      try { this.master.gain.setTargetAtTime(this.enabled ? this.volume : 0, this.context.currentTime, .025); } catch { /* Closing context. */ }
    }
  }

  setEnabled(value) { this.enabled = !!value; this.setVolume(this.volume); }

  setListener(position, forward) {
    if (position) this.position = vector(position, this.position);
    if (forward) {
      const f = vector(forward, this.forward), length = Math.hypot(f.x, f.y, f.z);
      if (length > .0001) this.forward = { x: f.x / length, y: f.y / length, z: f.z / length };
      const horizontal = Math.hypot(this.forward.x, this.forward.z);
      if (horizontal > .0001) this.right = { x: -this.forward.z / horizontal, y: 0, z: this.forward.x / horizontal };
    }
  }

  _route(position, local = false, level = 1, options = {}) {
    const ctx = this.context;
    if (this._destroyed || !ctx || ctx.state !== 'running' || !this.enabled || this.volume <= 0) return null;
    let distance = 0, pan = 0;
    if (position && !local) {
      const p = vector(position, this.position), dx = p.x - this.position.x, dy = p.y - this.position.y, dz = p.z - this.position.z;
      distance = Math.hypot(dx, dy, dz);
      if (distance > 150) return null;
      if (distance > .001) pan = clamp((dx * this.right.x + dz * this.right.z) / distance * .9, -.9, .9);
    }
    const occlusion = local ? 0 : clamp(finite(options.occluded === true ? 1 : options.occluded), 0, 1);
    const priority = finite(options.priority, local || !position ? 2 : 1);
    if (this.activeVoices >= this.maxVoices) {
      // Prioritize the human's feedback over distant fire. Steal at most one
      // complete route, including its still-queued mechanical sounds.
      let oldest = null;
      for (const route of this._routes) if (route.priority <= priority && (!oldest || route.priority < oldest.priority)) oldest = route;
      if (!oldest) return null;
      oldest.cleanup();
    }
    const gain = ctx.createGain(), filter = ctx.createBiquadFilter();
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const attenuation = Math.pow(1 + distance / 12, -1.12) * (1 - occlusion * .64);
    gain.gain.value = clamp(finite(level, 1), 0, 2) * attenuation;
    filter.type = 'lowpass';
    filter.frequency.value = clamp(19000 / (1 + distance / 23) * (1 - occlusion * .82), 620, 19000);
    filter.Q.value = .45;
    gain.connect(filter);
    if (panner) { panner.pan.value = pan; filter.connect(panner); panner.connect(this.master); }
    else filter.connect(this.master);
    const route = { context: ctx, gain, filter, panner, priority, parts: new Set(), sealed: false, closed: false, cleanup: null };
    route.cleanup = () => {
      if (route.closed) return;
      route.closed = true;
      for (const part of route.parts) {
        part.source.onended = null;
        try { part.source.stop(); } catch { /* Source may have already ended. */ }
        part.nodes.forEach(disconnect);
      }
      route.parts.clear();
      disconnect(gain); disconnect(filter); disconnect(panner);
      this._routes.delete(route); this.activeVoices = this._routes.size;
      if (this._reloadRoute === route) this._reloadRoute = null;
    };
    this._routes.add(route); this.activeVoices = this._routes.size;
    return route;
  }

  _start(route, source, nodes, at, duration, offset = null) {
    if (route.closed) { nodes.forEach(disconnect); return; }
    const part = { source, nodes };
    route.parts.add(part);
    source.onended = () => {
      source.onended = null;
      nodes.forEach(disconnect); route.parts.delete(part);
      if (route.sealed && !route.parts.size) route.cleanup();
    };
    try {
      if (offset === null) source.start(at); else source.start(at, offset);
      source.stop(at + duration + .012);
    } catch {
      source.onended = null; nodes.forEach(disconnect); route.parts.delete(part);
      if (route.sealed && !route.parts.size) route.cleanup();
    }
  }

  _noise(route, duration, level, frequency, start = 0, band = false) {
    if (!route || route.closed) return;
    const ctx = route.context, t = ctx.currentTime + Math.max(0, start), d = Math.max(.006, duration);
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), envelope = ctx.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = band ? 'bandpass' : 'lowpass'; filter.frequency.value = clamp(frequency, 40, 18000); filter.Q.value = band ? .8 : .45;
    envelope.gain.setValueAtTime(.0001, t);
    envelope.gain.exponentialRampToValueAtTime(Math.max(.0002, level), t + Math.min(.003, d * .2));
    envelope.gain.exponentialRampToValueAtTime(.0001, t + d);
    source.connect(filter); filter.connect(envelope); envelope.connect(route.gain);
    this._start(route, source, [source, filter, envelope], t, d, Math.random() * .85);
  }

  _tone(route, frequency, endFrequency, duration, level, type = 'sine', start = 0) {
    if (!route || route.closed) return;
    const ctx = route.context, t = ctx.currentTime + Math.max(0, start), d = Math.max(.006, duration);
    const osc = ctx.createOscillator(), envelope = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(Math.max(20, frequency), t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), t + d);
    envelope.gain.setValueAtTime(.0001, t);
    envelope.gain.exponentialRampToValueAtTime(Math.max(.0002, level), t + Math.min(.003, d * .2));
    envelope.gain.exponentialRampToValueAtTime(.0001, t + d);
    osc.connect(envelope); envelope.connect(route.gain);
    this._start(route, osc, [osc, envelope], t, d);
  }

  _finish(route) { if (!route || route.closed) return; route.sealed = true; if (!route.parts.size) route.cleanup(); }

  _click(route, start = 0, level = .12, pitch = 1600) {
    this._noise(route, .022, level, pitch, start, true);
    this._tone(route, pitch * .19, pitch * .09, .023, level * .28, 'triangle', start);
  }

  _mechanism(route, name, start = 0, level = 1) {
    if (name === 'pump') {
      this._noise(route, .10, .12 * level, 950, start, true);
      this._click(route, start + .015, .18 * level, 1250);
      this._noise(route, .075, .09 * level, 1600, start + .16, true);
      this._click(route, start + .205, .22 * level, 2300);
    } else if (name === 'bolt') {
      this._click(route, start, .15 * level, 2900);
      this._noise(route, .10, .09 * level, 1100, start + .055, true);
      this._click(route, start + .19, .19 * level, 1900);
      this._click(route, start + .235, .09 * level, 3600);
    } else if (name === 'slide' || name === 'charge') {
      this._noise(route, .055, .13 * level, 1700, start, true);
      this._click(route, start + .055, .19 * level, 2800);
    } else if (name === 'mag-out') {
      this._click(route, start, .13 * level, 2700);
      this._noise(route, .08, .075 * level, 900, start + .025, true);
    } else if (name === 'mag-in') {
      this._noise(route, .065, .15 * level, 1000, start);
      this._click(route, start + .025, .22 * level, 2200);
    } else if (name === 'shell') {
      this._click(route, start, .11 * level, 1850);
      this._click(route, start + .035, .055 * level, 3300);
    } else if (name === 'equip' || name === 'switch') {
      this._noise(route, .10, .09 * level, 650, start);
      this._click(route, start + .085, .09 * level, 2100);
    } else this._click(route, start, .13 * level, name === 'dry' ? 1500 : 2300);
  }

  shot(value, position = null, local = false, options = {}) {
    options ||= {};
    const w = weaponInfo(value), suppressed = !!options.suppressed;
    const r = this._route(position, local, (local ? .67 : .59) * (suppressed ? .43 : 1), options);
    if (!r) return;
    const variation = .965 + Math.random() * .07, pitch = w.pitch * variation;
    const crack = w.crack * (suppressed ? .38 : 1);
    this._noise(r, w.id === 'shotgun' ? .065 : .027, suppressed ? .35 : .72, crack);
    this._noise(r, w.tail, .20, w.body * (suppressed ? .62 : 1), .008);
    this._tone(r, pitch, w.id === 'shotgun' ? 29 : 41, w.tail * .68, .43);
    this._tone(r, pitch * 3.7, pitch * 1.55, .027, suppressed ? .025 : .062, 'triangle');
    if (w.id === 'pistol') {
      this._noise(r, .031, .16, 3600, .013, true);
      this._click(r, .065, .10, 3100);
      this._click(r, .10, .06, 2300);
    } else if (w.id === 'smg') {
      this._noise(r, .045, .12, 2750, .013, true);
      this._click(r, .044, .075, 2400);
    } else if (w.id === 'rifle') {
      this._noise(r, .052, .18, 4400, .008, true);
      this._noise(r, .31, .052, 950, .035);
      this._click(r, .073, .10, 3000);
    } else if (w.id === 'shotgun') {
      this._tone(r, 48 * variation, 26, .28, .17);
      this._noise(r, .48, .075, 680, .04);
      this._mechanism(r, 'pump', .255, local ? .95 : .5);
    } else {
      this._noise(r, .055, .19, 6500, .014, true);
      this._noise(r, .63, .077, 1350, .045);
      this._tone(r, 220 * variation, 63, .14, .075, 'triangle', .02);
      this._mechanism(r, 'bolt', .345, local ? .95 : .5);
    }
    if (local && options.lowAmmo) this._click(r, .12, .11, 3900);
    this._finish(r);
  }

  action(name, position = null, local = true) {
    const r = this._route(position, local, .36, { priority: local ? 2 : .7 });
    if (!r) return;
    if(name==='spray'){this._click(r,0,.045,2200);this._noise(r,.27,.12,3300,.025);}else this._mechanism(r, String(name || 'equip')); this._finish(r);
  }

  cancelReload() { this._reloadRoute?.cleanup(); }

  reload(duration = 1.8, options = {}) {
    this.cancelReload();
    options ||= {};
    const w = weaponInfo(options.weapon ?? (typeof duration === 'number' ? 'rifle' : duration));
    const d = clamp(typeof duration === 'number' ? finite(duration, w.reload) : w.reload, .3, 8);
    const r = this._route(null, true, .35); if (!r) return;
    this._reloadRoute = r;
    if (w.id === 'shotgun') {
      this._noise(r, Math.min(.14, d * .1), .13, 730);
      const shells = clamp(Math.floor(d / .4), 2, 5);
      for (let i = 0; i < shells; i++) this._mechanism(r, 'shell', d * (.14 + i * .56 / shells), .85);
      if (options.empty) this._mechanism(r, 'pump', Math.max(.1, d - .28), .8);
      else this._click(r, d * .9, .14, 1600);
    } else {
      this._mechanism(r, 'mag-out', d * .05, .9);
      this._noise(r, Math.min(.18, d * .1), .065, 650, d * .32);
      this._mechanism(r, 'mag-in', d * .62, 1);
      const action = w.id === 'sniper' ? 'bolt' : w.id === 'pistol' ? 'slide' : 'charge';
      if (options.empty !== false) this._mechanism(r, action, Math.max(d * .72, d - (action === 'bolt' ? .29 : .15)), .85);
      else this._click(r, d * .88, .09, 2000);
    }
    this._finish(r);
  }

  lowAmmo(remaining = 1) {
    const r = this._route(null, true, .31, { priority: 3 }); if (!r) return;
    this._click(r, 0, .15, 3300 + clamp(finite(remaining, 1), 0, 5) * 180);
    this._click(r, .055, .055, 1950); this._finish(r);
  }

  hit(head = false) {
    const r = this._route(null, true, .39, { priority: 3 }); if (!r) return;
    this._noise(r, .042, .20, 3300, 0, true);
    this._tone(r, head ? 1690 : 1020, head ? 1320 : 710, .08, .17, 'triangle'); this._finish(r);
  }
  kill() {
    return this.elimination();
  }
  /** A compact rising paint-frag flourish; one route owns all queued layers. */
  elimination(options = {}) {
    options ||= {};
    const multi = clamp(Math.floor(finite(options.multi, 1)), 1, 4);
    const streak = clamp(Math.floor(finite(options.streak, 1)), 1, 20);
    const headshot = !!options.headshot;
    const r = this._route(null, true, .52, { priority: 4 });
    if (!r) return false;
    // A soft low strike gives the confirmation weight while the quick major
    // arpeggio stays clear of the next weapon report. Multiples climb, not swell.
    const transpose = Math.pow(2, ((multi - 1) * 2 + (streak >= 5 ? 1 : 0)) / 12);
    this._tone(r, 112, 48, .13, .17, 'sine');
    this._noise(r, .035, .10, 2400, 0, true);
    [523.25, 659.25, 783.99].forEach((note, index) => {
      const at = [0, .058, .126][index], duration = [.13, .16, .23][index];
      this._tone(r, note * transpose, note * transpose, duration, .15 - index * .018, 'triangle', at);
      this._tone(r, note * 2 * transpose, note * 2 * transpose, duration * .72, .027, 'sine', at + .003);
    });
    if (multi > 1) {
      this._tone(r, 1046.5 * transpose, 1046.5 * transpose, .26, .105, 'sine', .214);
      this._tone(r, 523.25 * transpose, 523.25 * transpose, .23, .055, 'triangle', .214);
    }
    if (headshot) {
      // A glassy two-part ping distinguishes precision without a louder cue.
      this._tone(r, 1567.98, 1567.98, .19, .053, 'sine', .024);
      this._tone(r, 2093, 2093, .28, .032, 'sine', .027);
    }
    this._finish(r);
    return true;
  }
  dry() {
    const r = this._route(null, true, .31, { priority: 3 }); if (!r) return;
    this._click(r, 0, .22, 1850); this._tone(r, 245, 135, .035, .035, 'square'); this._finish(r);
  }
  footstep(position = null, sprint = false) {
    const r = this._route(position, !position, sprint ? .20 : .13, { priority: position ? .5 : 1.5 }); if (!r) return;
    this._noise(r, .085, .24, 530 + Math.random() * 330);
    this._tone(r, 100 + Math.random() * 18, 45, .072, .20); this._finish(r);
  }
  land() {
    const r = this._route(null, true, .27); if (!r) return;
    this._noise(r, .16, .31, 560); this._tone(r, 95, 34, .14, .30); this._finish(r);
  }
  hurt() {
    const r = this._route(null, true, .27, { priority: 3 }); if (!r) return;
    this._noise(r, .11, .32, 730); this._tone(r, 85, 43, .17, .27); this._finish(r);
  }
  /** One short cue only. The match owns beat timing, pause and restart. */
  countdown(beat) {
    const go = beat === 'GO', pitch = beat === 3 ? 392 : beat === 2 ? 440 : beat === 1 ? 493.88 : 0;
    if (!go && !pitch) return false;
    const r = this._route(null, true, go ? .36 : .28, { priority: 3 });
    if (!r) return false;
    if (go) {
      this._tone(r, 130.81, 130.81, .18, .11, 'sine');
      this._tone(r, 523.25, 523.25, .20, .12, 'triangle');
      this._tone(r, 783.99, 783.99, .22, .06, 'sine', .005);
    } else {
      this._tone(r, pitch, pitch * .98, .085, .14, 'triangle');
      this._noise(r, .015, .024, 2200, 0, true);
    }
    this._finish(r);
    return true;
  }
  objective() {
    const r = this._route(null, true, .30, { priority: 3 }); if (!r) return;
    [440, 554, 660].forEach((n, i) => this._tone(r, n, n, .20, .14, 'sine', i * .08)); this._finish(r);
  }
  end(win = true) {
    const r = this._route(null, true, .40, { priority: 3 }); if (!r) return;
    (win ? [392, 494, 587, 784] : [392, 349, 294, 262]).forEach((n, i) => this._tone(r, n, n, .5, .16, 'triangle', i * .17)); this._finish(r);
  }

  _discardContext() {
    for (const route of [...this._routes]) route.cleanup();
    this._routes.clear(); this.activeVoices = 0;
    disconnect(this.master); disconnect(this._limiter);
    const ctx = this.context;
    this.context = null; this.master = null; this._limiter = null; this.noiseBuffer = null;
    if (ctx && ctx.state !== 'closed') {
      try { return Promise.resolve(ctx.close()).catch(() => {}); } catch { /* Context was already closing. */ }
    }
    return Promise.resolve();
  }

  destroy() {
    if (this._destroyed) return this._closePromise || Promise.resolve();
    this._destroyed = true;
    this._closePromise = this._discardContext();
    return this._closePromise;
  }
}
