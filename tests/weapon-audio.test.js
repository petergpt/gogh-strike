import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioEngine } from '../src/weapon-audio.js';

// Keep ended events under test control. Scheduling stop() must not immediately
// end a source: reloads and distant gunfire can have future layers queued.
class FakeParam {
  constructor(value = 0) { this.value = value; this.events = []; }
  schedule(method, value, time, extra) {
    assert.ok(Number.isFinite(value), `${method} needs a finite value`);
    assert.ok(Number.isFinite(time), `${method} needs a finite time`);
    this.value = value;
    this.events.push({ method, value, time, extra });
    return this;
  }
  setValueAtTime(value, time) { return this.schedule('set', value, time); }
  linearRampToValueAtTime(value, time) { return this.schedule('linear', value, time); }
  exponentialRampToValueAtTime(value, time) {
    assert.ok(value > 0, 'exponential ramps need a positive target');
    return this.schedule('exponential', value, time);
  }
  setTargetAtTime(value, time, constant) { return this.schedule('target', value, time, constant); }
  setValueCurveAtTime(values, time, duration) {
    assert.ok(values.length > 0);
    return this.schedule('curve', values[values.length - 1], time, duration);
  }
  cancelScheduledValues(time) { this.events.push({ method: 'cancel', time }); return this; }
  cancelAndHoldAtTime(time) { this.events.push({ method: 'hold', time }); return this; }
}

class FakeNode {
  constructor(context, kind) {
    this.context = context;
    this.kind = kind;
    this.connections = new Set();
    this.connectionHistory = new Set();
    this.disconnectCalls = 0;
    context.nodes.push(this);
  }
  connect(destination) {
    assert.ok(destination, `${this.kind} connected to an absent destination`);
    this.connections.add(destination);
    this.connectionHistory.add(destination);
    return destination;
  }
  disconnect(destination) {
    this.disconnectCalls++;
    if (destination) this.connections.delete(destination);
    else this.connections.clear();
  }
}

class FakeSource extends FakeNode {
  constructor(context, kind) {
    super(context, kind);
    this.frequency = new FakeParam(440);
    this.detune = new FakeParam();
    this.playbackRate = new FakeParam(1);
    this.starts = [];
    this.stops = [];
    this.onended = null;
    this.ended = false;
    context.sources.push(this);
  }
  start(time = 0, ...args) {
    assert.ok(Number.isFinite(time) && time >= 0, 'source start time is valid');
    assert.equal(this.starts.length, 0, 'one-shot source started once');
    this.starts.push({ time, args });
  }
  stop(time = 0) {
    assert.ok(Number.isFinite(time) && time >= 0, 'source stop time is valid');
    this.stops.push(time);
  }
  finish() {
    if (this.ended) return;
    this.ended = true;
    this.onended?.({ target: this });
  }
}

class FakeAudioContext {
  static instances = [];
  constructor() {
    this.nodes = [];
    this.sources = [];
    this.currentTime = 12;
    this.sampleRate = 8000;
    this.state = 'suspended';
    this.closeCalls = 0;
    this.resumeCalls = 0;
    this.destination = new FakeNode(this, 'destination');
    FakeAudioContext.instances.push(this);
  }
  async resume() { this.resumeCalls++; this.state = 'running'; }
  async close() { this.closeCalls++; this.state = 'closed'; }
  createGain() { return Object.assign(new FakeNode(this, 'gain'), { gain: new FakeParam(1) }); }
  createStereoPanner() { return Object.assign(new FakeNode(this, 'panner'), { pan: new FakeParam() }); }
  createBiquadFilter() {
    return Object.assign(new FakeNode(this, 'filter'), {
      type: 'lowpass', frequency: new FakeParam(350), Q: new FakeParam(1), gain: new FakeParam(), detune: new FakeParam(),
    });
  }
  createDynamicsCompressor() {
    return Object.assign(new FakeNode(this, 'compressor'), Object.fromEntries(
      ['threshold', 'knee', 'ratio', 'attack', 'release'].map(key => [key, new FakeParam()]),
    ));
  }
  createWaveShaper() { return new FakeNode(this, 'shaper'); }
  createConvolver() { return new FakeNode(this, 'convolver'); }
  createDelay() { return Object.assign(new FakeNode(this, 'delay'), { delayTime: new FakeParam() }); }
  createOscillator() { return new FakeSource(this, 'oscillator'); }
  createBufferSource() { return new FakeSource(this, 'bufferSource'); }
  createBuffer(channels, length, sampleRate) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { numberOfChannels: channels, length, sampleRate, duration: length / sampleRate,
      getChannelData: channel => data[channel], copyToChannel: (values, channel) => data[channel].set(values) };
  }
  finishAll() {
    // onended may remove voices from the engine, but should never spawn audio.
    for (const source of [...this.sources]) source.finish();
  }
}

function installContext(t, Context = FakeAudioContext) {
  const originals = new Map(['AudioContext', 'webkitAudioContext', 'window'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const key of ['AudioContext', 'webkitAudioContext']) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: key === 'AudioContext' ? Context : undefined });
  }
  Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: { AudioContext: Context } });
  t.after(() => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
}

async function engineWithContext(t, Context = FakeAudioContext) {
  installContext(t, Context);
  const engine = new AudioEngine();
  t.after(() => engine.destroy());
  assert.equal(await engine.unlock(), true);
  const context = FakeAudioContext.instances.at(-1);
  assert.equal(context.state, 'running');
  return { engine, context };
}

const position = (x = 0, y = 0, z = 0) => ({ x, y, z });
const soundCalls = [
  engine => engine.shot('rifle', position(8), false),
  engine => engine.reload(1.8, { empty: true, weapon: 'smg' }),
  engine => engine.lowAmmo(),
  engine => engine.action('equip'),
  engine => engine.hit(),
  engine => engine.hit(true),
  engine => engine.kill(),
  engine => engine.elimination({streak: 7, multi: 3, headshot: true}),
  engine => engine.dry(),
  engine => engine.footstep(position(2), true),
  engine => engine.land(),
  engine => engine.hurt(),
  engine => engine.countdown(3),
  engine => engine.countdown(2),
  engine => engine.countdown(1),
  engine => engine.countdown('GO'),
  engine => engine.objective(),
  engine => engine.end(true),
  engine => engine.end(false),
];

test('audio calls remain safe before unlock and when WebAudio is unavailable', async t => {
  installContext(t, null);
  const engine = new AudioEngine();
  assert.equal(await engine.unlock(), false);
  assert.doesNotThrow(() => {
    engine.setVolume(.6);
    engine.setEnabled(true);
    engine.setListener(position(), position(0, 0, -1));
    engine.cancelReload();
    engine.cancelReload();
    for (const play of soundCalls) play(engine);
    engine.destroy();
    engine.destroy();
    for (const play of soundCalls) play(engine);
    engine.cancelReload();
  });
  assert.equal(engine.activeVoices, 0);
  assert.equal(await engine.unlock(), false);
});

test('every sound releases its sources and route after natural ended events', async t => {
  const { engine, context } = await engineWithContext(t);
  const initialNodes = new Set(context.nodes);
  for (const play of soundCalls) {
    context.currentTime += 10;
    const before = context.sources.length;
    play(engine);
    assert.ok(context.sources.length > before, 'sound schedules audible sources');
    assert.ok(engine.activeVoices > 0 && engine.activeVoices <= 32);
    context.finishAll();
    assert.equal(engine.activeVoices, 0, 'all route sources ended');
    assert.ok(context.sources.slice(before).every(source => source.connections.size === 0), 'ended sources disconnect');
  }
  assert.ok(context.nodes.filter(node => !initialNodes.has(node)).every(node => node.connections.size === 0), 'per-sound processing nodes disconnect');
});

test('a route stays alive for scheduled reload layers and cleans up after the last source', async t => {
  const { engine, context } = await engineWithContext(t);
  engine.reload(3.1, { empty: true, weapon: 'rifle' });
  const sources = [...context.sources];
  assert.ok(sources.length > 1);
  assert.ok(sources.some(source => source.starts[0].time > context.currentTime));
  sources[0].finish();
  assert.equal(sources[0].connections.size, 0, 'an individual ended source is disconnected promptly');
  assert.ok(engine.activeVoices > 0, 'future reload layers keep the route alive');
  for (const source of sources.slice(1).reverse()) source.finish();
  assert.equal(engine.activeVoices, 0, 'source completion order does not affect cleanup');
  assert.equal(engine._reloadRoute, null, 'natural completion releases the tracked reload route');
});

test('canceling a reload stops its queued cues while unrelated feedback keeps playing', async t => {
  const { engine, context } = await engineWithContext(t);
  engine.hit(true);
  const unrelated = [...context.sources];
  engine.reload(3.1, { empty: true, weapon: 'sniper' });
  const reload = context.sources.slice(unrelated.length);
  const stopCounts = reload.map(source => source.stops.length);
  assert.equal(engine.activeVoices, 2);
  assert.ok(reload.some(source => source.starts[0].time > context.currentTime + 1),
    'fixture includes future magazine and bolt cues');
  engine.cancelReload();
  assert.equal(engine.activeVoices, 1);
  assert.equal(engine._reloadRoute, null);
  reload.forEach((source, index) => {
    assert.equal(source.stops.length, stopCounts[index] + 1, 'queued sources are stopped immediately');
    assert.equal(source.stops.at(-1), 0);
    assert.equal(source.connections.size, 0);
    assert.equal(source.onended, null);
  });
  assert.ok(unrelated.every(source => source.connections.size > 0 && source.stops.length === 1),
    'hit feedback retains its original scheduled playback');
  const disconnectCounts = reload.map(source => source.disconnectCalls);
  engine.cancelReload();
  reload.forEach((source, index) => {
    assert.equal(source.stops.length, stopCounts[index] + 1, 'repeated cancellation is harmless');
    assert.equal(source.disconnectCalls, disconnectCounts[index]);
    source.finish();
  });
  assert.equal(engine.activeVoices, 1, 'late ended events cannot clean up unrelated sounds');
  context.finishAll();
  assert.equal(engine.activeVoices, 0);
});

test('starting a new reload replaces only its previous queued audio', async t => {
  const { engine, context } = await engineWithContext(t);
  engine.action('equip');
  const unrelated = [...context.sources];
  engine.reload(2.75, { empty: true, weapon: 'rifle' });
  const previous = context.sources.slice(unrelated.length);
  const previousRoute = engine._reloadRoute;
  const before = context.sources.length;
  engine.reload(1.35, { empty: false, weapon: 'pistol' });
  const current = context.sources.slice(before);
  assert.notEqual(engine._reloadRoute, previousRoute);
  assert.equal(previousRoute.closed, true);
  assert.ok(previous.every(source => source.connections.size === 0 && source.stops.length === 2));
  assert.ok(unrelated.every(source => source.connections.size > 0 && source.stops.length === 1));
  assert.equal(engine.activeVoices, 2, 'there is only one active reload route');
  for (const source of current) source.finish();
  assert.equal(engine._reloadRoute, null, 'replacement reload also clears on natural completion');
  assert.equal(engine.activeVoices, 1);
  engine.cancelReload();
  assert.equal(engine.activeVoices, 1);
});

test('repeated fire cannot grow voices or queued sources without bound', async t => {
  const { engine, context } = await engineWithContext(t);
  for (let i = 0; i < 1000; i++) {
    engine.shot(i % 5, position(5, 0, -4), false);
    assert.ok(engine.activeVoices >= 0 && engine.activeVoices <= 32, `voice count after shot ${i}`);
  }
  const connected = context.sources.filter(source => source.connections.size > 0);
  assert.ok(connected.length > 0, 'fire remains audible at capacity');
  assert.ok(connected.length <= 32 * 24, 'each bounded voice has a finite set of synthesis layers');
  assert.ok(context.nodes.filter(node => node.connections.size > 0).length <= 32 * 80, 'saturated calls leave only a bounded live processing graph');
  for (const source of context.sources.filter(source => source.connections.size === 0)) {
    assert.ok(source.stops.length > 1 || source.ended, 'evicted sources were stopped as well as disconnected');
  }
  context.finishAll();
  assert.equal(engine.activeVoices, 0);
  const before = context.sources.length;
  engine.shot('rifle', null, true);
  assert.ok(context.sources.length > before, 'voices can be reused after cleanup');
});

test('destroy stops queued layers, disconnects processing nodes, and cannot reopen', async t => {
  const { engine, context } = await engineWithContext(t);
  engine.reload(3.2, { empty: true, weapon: 'sniper' });
  engine.shot('shotgun', position(20), false);
  engine.end(true);
  assert.ok(context.sources.some(source => source.starts.some(start => start.time > context.currentTime)), 'fixture includes future layers');
  const sources = context.sources.filter(source => !source.ended);
  const stopCounts = sources.map(source => source.stops.length);
  assert.ok(engine.activeVoices > 0);
  engine.destroy();
  assert.equal(engine.activeVoices, 0);
  assert.equal(context.closeCalls, 1);
  assert.equal(context.state, 'closed');
  sources.forEach((source, index) => {
    assert.ok(source.stops.length > stopCounts[index], 'destroy cancels even a source with a previously scheduled stop');
    assert.equal(source.connections.size, 0);
  });
  assert.ok(context.nodes.every(node => node.connections.size === 0), 'destroy disconnects the full audio graph');
  context.finishAll();
  assert.equal(engine.activeVoices, 0, 'late ended events do not make the counter negative');
  const contextCount = FakeAudioContext.instances.length;
  assert.equal(await engine.unlock(), false);
  assert.equal(FakeAudioContext.instances.length, contextCount);
  engine.destroy();
  assert.equal(context.closeCalls, 1, 'destroy is idempotent');
});

test('destroy during a pending unlock cannot revive the audio context', async t => {
  class DeferredAudioContext extends FakeAudioContext {
    resume() {
      this.resumeCalls++;
      return new Promise(resolve => {
        this.completeResume = () => {
          if (this.state !== 'closed') this.state = 'running';
          resolve();
        };
      });
    }
  }
  installContext(t, DeferredAudioContext);
  const engine = new AudioEngine();
  t.after(() => engine.destroy());
  const unlocking = engine.unlock();
  const context = FakeAudioContext.instances.at(-1);
  assert.equal(context.resumeCalls, 1);
  await engine.destroy();
  context.completeResume();
  assert.equal(await unlocking, false);
  assert.equal(context.state, 'closed');
  assert.equal(context.closeCalls, 1);
  assert.equal(engine.activeVoices, 0);
  for (const play of soundCalls) play(engine);
  assert.equal(context.sources.length, 0);
  assert.equal(await engine.unlock(), false);
});

test('mute and zero volume suppress new sounds, and unmuting restores playback', async t => {
  const { engine, context } = await engineWithContext(t);
  engine.setEnabled(false);
  for (const play of soundCalls) play(engine);
  assert.equal(context.sources.length, 0);
  engine.setEnabled(true);
  engine.setVolume(0);
  for (const play of soundCalls) play(engine);
  assert.equal(context.sources.length, 0);
  engine.setVolume(.5);
  engine.shot('pistol', null, true);
  assert.ok(context.sources.length > 0);
});

test('weapon strings, indices, and objects all resolve to usable sounds', async t => {
  const { engine, context } = await engineWithContext(t);
  for (const [index, id] of ['pistol', 'smg', 'rifle', 'shotgun', 'sniper'].entries()) {
    for (const weapon of [id, index, { id, reloadTime: 2.1 }]) {
      context.currentTime += 10;
      const before = context.sources.length;
      engine.shot(weapon, null, true, { lowAmmo: true });
      assert.ok(context.sources.length > before, `${id} resolves from ${typeof weapon}`);
      context.finishAll();
      engine.reload(typeof weapon === 'number' ? id : weapon, { empty: false, weapon });
      assert.ok(engine.activeVoices > 0, 'reload accepts the same weapon representations');
      context.finishAll();
      assert.equal(engine.activeVoices, 0);
    }
  }
});

test('distance and obstruction attenuate and muffle gunfire relative to the listener', async t => {
  const { engine, context } = await engineWithContext(t);
  engine.setListener(position(100, 0, 100), position(0, 0, -1));

  function sampleShot(sourcePosition, options = {}) {
    const existing = new Set(context.nodes);
    engine.shot('rifle', sourcePosition, false, options);
    const created = context.nodes.filter(node => !existing.has(node));
    // Read the shared output path rather than weapon-specific synthesis filters.
    const panner = created.find(node => node.kind === 'panner' && [...node.connections].some(target => existing.has(target)));
    assert.ok(panner, 'spatial sound reaches the master through a panner');
    const filter = created.find(node => node.kind === 'filter' && node.type === 'lowpass' && node.connections.has(panner));
    assert.ok(filter, 'spatial route includes a shared lowpass');
    const gain = created.find(node => node.kind === 'gain' && node.connections.has(filter));
    assert.ok(gain, 'route has a distance gain');
    const result = { gain: gain.gain.value, cutoff: filter.frequency.value, pan: panner.pan.value };
    context.finishAll();
    context.currentTime += 1;
    return result;
  }

  const near = sampleShot(position(104, 0, 100));
  const distant = sampleShot(position(180, 0, 100));
  const occluded = sampleShot(position(104, 0, 100), { occluded: true });
  const left = sampleShot(position(96, 0, 100));
  assert.ok(distant.gain < near.gain, 'far gunfire is quieter');
  assert.ok(distant.cutoff < near.cutoff, 'far gunfire loses high frequencies');
  assert.ok(occluded.gain < near.gain, 'an obstruction reduces level');
  assert.ok(occluded.cutoff < near.cutoff, 'an obstruction muffles the report');
  assert.ok(near.pan > 0 && left.pan < 0, 'left and right positions pan relative to facing direction');
  const nodeCount = context.nodes.length;
  engine.shot('rifle', position(300, 0, 100), false);
  assert.equal(context.nodes.length, nodeCount, 'inaudible distance is rejected before allocating a graph');
  assert.equal(engine.activeVoices, 0);
});

test('countdown schedules only the requested short beat and releases every voice', async t => {
  const {engine,context}=await engineWithContext(t);
  const pitches=[];
  for(const beat of [3,2,1,'GO']) {
    const before=context.sources.length;
    assert.equal(engine.countdown(beat),true);
    const sources=context.sources.slice(before);
    assert.equal(engine.activeVoices,1,'one countdown call owns one bounded route');
    assert.ok(sources.length<=3,'a beat uses at most three short synthesis layers');
    assert.ok(sources.every(source=>source.starts[0].time-context.currentTime<=.006),'later countdown beats are never prequeued');
    assert.ok(sources.every(source=>source.stops[0]-context.currentTime<.25),'a cue finishes before the GO fade ends');
    const tones=sources.filter(source=>source.kind==='oscillator');
    if(beat!=='GO')pitches.push(tones[0].frequency.events.find(event=>event.method==='set').value);
    else assert.ok(tones.some(source=>source.frequency.events[0].value<200)&&tones.some(source=>source.frequency.events[0].value>500),'GO has both low and bright tones');
    context.finishAll();assert.equal(engine.activeVoices,0);
    assert.ok(sources.every(source=>source.connections.size===0));
    context.currentTime+=.8;
  }
  assert.ok(pitches[0]<pitches[1]&&pitches[1]<pitches[2],'the three restrained ticks rise in pitch');
  const count=context.nodes.length;
  for(const beat of [0,4,NaN,undefined,'START','toString','constructor'])assert.equal(engine.countdown(beat),false);
  assert.equal(context.nodes.length,count,'invalid or stale beat labels allocate nothing');
});

test('frag fanfare rises for rapid kills, distinguishes precision, and ends within half a second', async t => {
  const {engine, context} = await engineWithContext(t);
  const samples = [];
  for (const options of [{}, {multi: 2}, {multi: 3, streak: 5}, {multi: 3, streak: 5, headshot: true}]) {
    const before = context.sources.length;
    assert.equal(engine.elimination(options), true);
    const sources = context.sources.slice(before);
    const pitches = sources.filter(source => source.kind === 'oscillator').map(source => source.frequency.events[0].value);
    samples.push({sources: sources.length, root: pitches[1], pitches});
    assert.equal(engine.activeVoices, 1, 'a frag uses one route, including future notes');
    assert.ok(sources.length <= 12, 'celebration has a strict synthesis layer budget');
    assert.ok(sources.every(source => source.stops[0] - context.currentTime < .5), 'no long tail or delayed fanfare overlaps later action');
    sources[0].finish();
    assert.equal(engine.activeVoices, 1, 'queued flourish notes retain their route after the initial strike');
    context.finishAll();
    assert.equal(engine.activeVoices, 0);
    assert.ok(sources.every(source => source.connections.size === 0));
    context.currentTime += 1;
  }
  assert.ok(samples[0].root < samples[1].root && samples[1].root < samples[2].root, 'rapid kills rise in pitch');
  assert.equal(samples[3].sources - samples[2].sources, 2, 'headshots add a distinct two-part glass ping');
  assert.ok(samples[3].pitches.includes(1567.98) && samples[3].pitches.includes(2093));
});

test('frag bursts cannot exceed voice or layer budgets, including malformed counters and early disposal', async t => {
  const {engine, context} = await engineWithContext(t);
  for (let i = 0; i < 100; i++) {
    assert.equal(engine.elimination({multi: i % 3 ? 100000 : NaN, streak: Infinity, headshot: true}), true);
    assert.ok(engine.activeVoices <= engine.maxVoices);
  }
  const connected = context.sources.filter(source => source.connections.size > 0);
  assert.ok(connected.length <= engine.maxVoices * 12);
  const stopCounts = connected.map(source => source.stops.length);
  await engine.destroy();
  connected.forEach((source, index) => {
    assert.equal(source.connections.size, 0);
    assert.ok(source.stops.length > stopCounts[index], 'destroy stops queued notes immediately');
  });
  assert.equal(engine.elimination({multi: 3, headshot: true}), false);
  assert.equal(engine.activeVoices, 0);
});
