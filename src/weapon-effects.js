import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const clamp = THREE.MathUtils.clamp;
const finiteVector = value => value && Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z);
const positive = (value, fallback) => Number.isFinite(value) && value > 0 ? value : fallback;

const pointVertex = /* glsl */`
  attribute float aSize;
  attribute float aAlpha;
  uniform float uScale;
  varying vec3 vPigment;
  varying float vAlpha;
  void main() {
    vPigment = color;
    vAlpha = aAlpha;
    vec4 p = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = clamp(aSize * uScale / max(0.1, -p.z), 1.0, 160.0);
    gl_Position = projectionMatrix * p;
  }
`;

const sparkFragment = /* glsl */`
  varying vec3 vPigment;
  varying float vAlpha;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float edge = abs(p.x * 0.84 + p.y * 0.28) + abs(p.y * 0.82 - p.x * 0.28);
    float alpha = (1.0 - smoothstep(0.43, 1.0, edge)) * vAlpha;
    if (alpha < 0.015) discard;
    gl_FragColor = vec4(vPigment, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const smokeFragment = /* glsl */`
  varying vec3 vPigment;
  varying float vAlpha;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float angle = atan(p.y, p.x);
    float contour = length(p) + sin(angle * 5.0 + p.x * 8.0) * 0.065;
    float wisps = 0.76 + sin(p.x * 15.0 + sin(p.y * 9.0) * 2.0) * 0.12;
    float alpha = (1.0 - smoothstep(0.02, 0.98, contour)) * wisps * vAlpha;
    if (alpha < 0.006) discard;
    gl_FragColor = vec4(vPigment, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// One broad brush ring reads as a single event, even in a busy firefight. The
// transparent centre keeps the eliminated actor and the next target visible.
const paintFragment = /* glsl */`
  varying vec3 vPigment;
  varying float vAlpha;
  varying float vAccent;
  varying float vAge;
  float glint(vec2 p, vec2 centre, float width) {
    vec2 q = abs(p - centre);
    float rays = min(q.x * 4.4 + q.y, q.x + q.y * 4.4);
    return 1.0 - smoothstep(width * 0.68, width, rays);
  }
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float angle = atan(p.y, p.x);
    float radius = length(p);
    float contour = 0.67 + sin(angle * 3.0 + 0.5) * 0.11 + sin(angle * 5.0) * 0.035;
    float outer = 1.0 - smoothstep(contour - 0.015, contour + 0.025, radius);
    float inner = smoothstep(contour - 0.27, contour - 0.20, radius);
    float brush = 0.83 + sin(angle * 16.0 + radius * 18.0) * 0.10;
    float alpha = outer * inner * brush * vAlpha;
    vec3 paint = mix(vPigment, vec3(1.0, 0.95, 0.77), smoothstep(contour - 0.06, contour + 0.04, radius) * 0.30);
    if (vAccent > 0.5) {
      // Four large brush glints celebrate the frag around the open centre.
      // They recede before the bloom, leaving the next target easy to see.
      float sparkle = glint(p, vec2(-0.62, 0.36), 0.14)
        + glint(p, vec2(0.58, -0.37), 0.12)
        + glint(p, vec2(0.36, 0.66), 0.105)
        + glint(p, vec2(-0.31, -0.66), 0.09);
      if (vAccent > 1.5) sparkle += glint(p, vec2(0.0, 0.82), 0.16);
      float accent = clamp(sparkle, 0.0, 1.0) * (1.0 - smoothstep(0.25, 0.76, vAge)) * vAlpha;
      paint = mix(paint, vec3(1.0, 0.96, 0.76), accent / max(0.001, alpha + accent));
      alpha = max(alpha, accent);
    }
    if (alpha < 0.015) discard;
    gl_FragColor = vec4(paint, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const paintVertex = pointVertex
  .replace('attribute float aAlpha;', 'attribute float aAlpha;\n  attribute float aAccent;\n  attribute float aAge;\n  varying float vAccent;\n  varying float vAge;')
  .replace('vAlpha = aAlpha;', 'vAlpha = aAlpha;\n    vAccent = aAccent;\n    vAge = aAge;');

const decalVertex = /* glsl */`
  attribute vec3 pigmentColor;
  varying vec2 vPaintUv;
  varying vec3 vPigment;
  void main() {
    vPaintUv = uv;
    vPigment = pigmentColor;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

const decalFragment = /* glsl */`
  varying vec2 vPaintUv;
  varying vec3 vPigment;
  void main() {
    vec2 p = vPaintUv * 2.0 - 1.0;
    float angle = atan(p.y, p.x);
    float radius = length(p);
    float edge = 0.72 + sin(angle * 7.0) * 0.095 + sin(angle * 11.0 + 0.7) * 0.055;
    float alpha = 1.0 - smoothstep(edge - 0.10, edge, radius);
    float grain = 0.75 + sin(p.x * 34.0 + sin(p.y * 27.0)) * 0.15;
    float core = 1.0 - smoothstep(0.06, 0.3, radius);
    vec3 paint = mix(vPigment, vPigment * 0.24, core);
    if (alpha < 0.025) discard;
    gl_FragColor = vec4(paint, alpha * grain * 0.85);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function makePointPool(capacity, smoke, fragment = null, vertex = pointVertex) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(capacity * 3);
  const colors = new Float32Array(capacity * 3);
  const sizes = new Float32Array(capacity);
  const alphas = new Float32Array(capacity);
  for (const [name, array, components] of [['position', positions, 3], ['color', colors, 3], ['aSize', sizes, 1], ['aAlpha', alphas, 1]]) {
    geometry.setAttribute(name, new THREE.BufferAttribute(array, components).setUsage(THREE.DynamicDrawUsage));
  }
  geometry.setDrawRange(0, 0);
  const material = new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment || (smoke ? smokeFragment : sparkFragment),
    vertexColors: true,
    uniforms: {uScale: {value: 720}},
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: smoke || fragment ? THREE.NormalBlending : THREE.AdditiveBlending,
  });
  const mesh = new THREE.Points(geometry, material);
  mesh.name = smoke ? 'Weapon smoke pool' : 'Pigment fleck pool';
  mesh.frustumCulled = false;
  const items = Array.from({length: capacity}, () => ({
    life: 0, total: 0, size: 0, opacity: 1,
    position: new THREE.Vector3(), velocity: new THREE.Vector3(), color: new THREE.Color(),
  }));
  return {geometry, material, mesh, items, positions, colors, sizes, alphas};
}

/**
 * Fixed-size reusable combat effects. Static surface marks and settled casings
 * persist until their ring buffer is reused or the match calls clear().
 *
 * floorHeight(x, z, maxHeight) can use PhysicsWorld.floorHeight to keep the
 * shell simulation on the original map's real supporting triangles.
 */
export class Effects {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.maxTracers = 80;
    this.maxParticles = 320;
    this.maxSmoke = 72;
    this.maxDecals = 72;
    this.maxShells = 32;
    this.maxEliminations = 12;
    this.nextTracer = this.nextParticle = this.nextSmoke = this.nextDecal = this.nextShell = this.nextElimination = 0;
    this.destroyed = false;
    this.floorHeight = typeof options.floorHeight === 'function' ? options.floorHeight : () => 0;
    this.onShellBounce = typeof options.onShellBounce === 'function' ? options.onShellBounce : null;
    this._scratchPosition = new THREE.Vector3();
    this._scratchVelocity = new THREE.Vector3();
    this._scratchNormal = new THREE.Vector3();
    this._scratchColor = new THREE.Color();
    this._matrix = new THREE.Matrix4();
    this._quaternion = new THREE.Quaternion();
    this._roll = new THREE.Quaternion();
    this._scale = new THREE.Vector3();
    this._euler = new THREE.Euler();
    this.teamColors = [new THREE.Color('#f1ca63'), new THREE.Color('#70cbed')];
    this.celebrationColors = ['#ffe9a4', '#f08a68', '#75d8c3', '#a79be5'].map(color => new THREE.Color(color));

    this.tracers = Array.from({length: this.maxTracers}, () => ({
      life: 0, duration: .08, from: new THREE.Vector3(), to: new THREE.Vector3(), color: new THREE.Color(),
    }));
    this.tracerPositions = new Float32Array(this.maxTracers * 6);
    this.tracerColors = new Float32Array(this.maxTracers * 6);
    this.tracerGeometry = new THREE.BufferGeometry();
    this.tracerGeometry.setAttribute('position', new THREE.BufferAttribute(this.tracerPositions, 3).setUsage(THREE.DynamicDrawUsage));
    this.tracerGeometry.setAttribute('color', new THREE.BufferAttribute(this.tracerColors, 3).setUsage(THREE.DynamicDrawUsage));
    this.tracerGeometry.setDrawRange(0, 0);
    this.tracerMaterial = new THREE.LineBasicMaterial({vertexColors: true, transparent: true, opacity: .60, blending: THREE.AdditiveBlending, depthWrite: false});
    this.lines = new THREE.LineSegments(this.tracerGeometry, this.tracerMaterial);
    this.lines.name = 'Weapon tracer pool';
    this.lines.frustumCulled = false;

    this._sparks = makePointPool(this.maxParticles, false);
    this._smoke = makePointPool(this.maxSmoke, true);
    this._paint = makePointPool(this.maxEliminations, false, paintFragment, paintVertex);
    this._paint.accents = new Float32Array(this.maxEliminations);
    this._paint.ages = new Float32Array(this.maxEliminations);
    this._paint.geometry.setAttribute('aAccent', new THREE.BufferAttribute(this._paint.accents, 1).setUsage(THREE.DynamicDrawUsage));
    this._paint.geometry.setAttribute('aAge', new THREE.BufferAttribute(this._paint.ages, 1).setUsage(THREE.DynamicDrawUsage));
    this._paint.mesh.name = 'Elimination paint bloom pool';
    this.eliminations = this._paint.items;
    // These names remain available for callers that previously inspected them.
    this.particles = this._sparks.items;
    this.particleGeometry = this._sparks.geometry;
    this.particleMaterial = this._sparks.material;
    this.particlePositions = this._sparks.positions;
    this.particleColors = this._sparks.colors;
    this.points = this._sparks.mesh;
    this.smoke = this._smoke.items;

    this.decalGeometry = new THREE.PlaneGeometry(1, 1);
    this.decalColors = new Float32Array(this.maxDecals * 3);
    this.decalGeometry.setAttribute('pigmentColor', new THREE.InstancedBufferAttribute(this.decalColors, 3).setUsage(THREE.DynamicDrawUsage));
    this.decalMaterial = new THREE.ShaderMaterial({
      vertexShader: decalVertex, fragmentShader: decalFragment,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
    });
    this.decals = new THREE.InstancedMesh(this.decalGeometry, this.decalMaterial, this.maxDecals);
    this.decals.name = 'Surface pigment mark pool';
    this.decals.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.decals.frustumCulled = false;
    this.decals.count = 0;

    this.shellGeometry = new THREE.CylinderGeometry(.022, .025, .09, 7, 1);
    this.shellMaterial = new THREE.MeshBasicMaterial({color: '#ffffff'});
    this.shellMesh = new THREE.InstancedMesh(this.shellGeometry, this.shellMaterial, this.maxShells);
    this.shellMesh.name = 'Spent casing pool';
    this.shellMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.shellMesh.frustumCulled = false;
    this.shellMesh.count = 0;
    this.shells = Array.from({length: this.maxShells}, () => ({
      active: false, sleeping: false, age: 0, bounces: 0, weapon: 'rifle', radius: .025,
      position: new THREE.Vector3(), velocity: new THREE.Vector3(), rotation: new THREE.Vector3(), angularVelocity: new THREE.Vector3(),
      scale: new THREE.Vector3(1, 1, 1),
    }));
    // Allocate instanceColor once, before the first shot.
    for (let i = 0; i < this.maxShells; i++) this.shellMesh.setColorAt(i, this._scratchColor.set('#d9ad42'));
    this.shellMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.lines, this.points, this._smoke.mesh, this.decals, this.shellMesh, this._paint.mesh);
  }

  setSurfaceQuery(floorHeight) {
    if (typeof floorHeight === 'function') this.floorHeight = floorHeight;
    return this;
  }

  tracer(from, to, team = 0) {
    if (this.destroyed || !finiteVector(from) || !finiteVector(to)) return;
    const t = this.tracers[this.nextTracer++ % this.maxTracers];
    t.life = t.duration = .055 + Math.random() * .025;
    t.from.copy(from); t.to.copy(to);
    t.color.copy(this.teamColors[team === 1 || team === 'amber' || team === 'red' ? 1 : 0]);
  }

  _particle(position, velocity, color, life, size = .065) {
    const p = this.particles[this.nextParticle++ % this.maxParticles];
    p.life = p.total = positive(life, .25); p.size = size; p.opacity = .94;
    p.position.copy(position); p.velocity.copy(velocity); p.color.set(color);
  }

  _puff(position, velocity, color, life, size = .15, opacity = .22) {
    const p = this.smoke[this.nextSmoke++ % this.maxSmoke];
    p.life = p.total = life; p.size = size; p.opacity = opacity;
    p.position.copy(position); p.velocity.copy(velocity); p.color.set(color);
  }

  impact(position, normal = null, isActor = false, material = null) {
    if (this.destroyed || !finiteVector(position)) return;
    const n = this._scratchNormal;
    if (finiteVector(normal) && (normal.x * normal.x + normal.y * normal.y + normal.z * normal.z) > .0001) n.copy(normal).normalize();
    else n.copy(UP);
    const start = this._scratchPosition.copy(position).addScaledVector(n, .024);
    for (let i = 0; i < (isActor ? 3 : 2); i++) {
      const velocity = this._scratchVelocity.set((Math.random() - .5) * 2.5, (Math.random() - .3) * 2.3, (Math.random() - .5) * 2.5);
      // Keep the flecks on the exposed side of the struck surface.
      const inward = velocity.dot(n);
      if (inward < 0) velocity.addScaledVector(n, -inward * 1.7);
      velocity.addScaledVector(n, .9);
      this._particle(start, velocity, isActor ? '#f7e1a0' : '#d7b573', .14 + Math.random() * .14, .060 + Math.random() * .025);
    }
    for (let i = 0; i < (isActor ? 0 : 1); i++) {
      const velocity = this._scratchVelocity.copy(n).multiplyScalar(.22 + i * .18);
      velocity.y += .16;
      this._puff(start, velocity, '#9c9782', .24 + Math.random() * .16, .12, .10);
    }
    // Only a known surface normal can make a reliable surface mark. Actor
    // contacts intentionally leave flecks, never floating marks in mid-air.
    if (!isActor && finiteVector(normal)) this.decal(position, normal, material);
  }

  muzzle(position, team = 0) {
    if (this.destroyed || !finiteVector(position)) return;
    this._scratchVelocity.set(0, .04, 0);
    this._particle(position, this._scratchVelocity, '#ffe5a1', .055, .16);
    this._scratchVelocity.set(0, .22, 0);
    this._puff(position, this._scratchVelocity, team === 1 ? '#a5bac0' : '#c5af82', .20, .12, .10);
  }

  /** A short brush bloom; the player's frag adds glints and a few broad paint flicks. */
  elimination(position, team = 0, options = {}) {
    if (this.destroyed || !finiteVector(position)) return false;
    options ||= {};
    const playerKill = !!options.playerKill;
    const multi = clamp(Number.isFinite(options.multi) ? Math.floor(options.multi) : 1, 1, 4);
    const p = this.eliminations[this.nextElimination++ % this.maxEliminations];
    p.life = p.total = playerKill ? .62 : .48;
    // Keep the player's celebratory arc above the falling torso and frag card.
    p.position.copy(position); p.position.y += playerKill ? 1.48 : 1.03;
    p.velocity.set(0, playerKill ? .19 : .12, 0);
    p.size = playerKill ? 1.68 + (multi - 1) * .10 : 1.25;
    p.opacity = 1;
    p.accent = playerKill ? options.headshot ? 2 : 1 : 0;
    p.color.copy(this.teamColors[team === 1 ? 1 : 0]);
    if (playerKill) {
      const count = 6 + multi - 1, phase = Math.random() * Math.PI * 2;
      for (let i = 0; i < count; i++) {
        const angle = phase + i / count * Math.PI * 2;
        this._scratchPosition.copy(p.position);
        this._scratchPosition.y += Math.sin(angle * 2) * .14;
        this._scratchVelocity.set(Math.cos(angle) * 1.65, .55 + (i % 3) * .42, Math.sin(angle) * 1.65);
        this._particle(this._scratchPosition, this._scratchVelocity, i % 3 ? p.color : this.celebrationColors[i % 4], .32 + (i % 3) * .07, .12 + (i % 2) * .025);
      }
    }
    return true;
  }

  /** A canister's wider, low paint burst; shares the same bounded bloom pool. */
  paintBurst(position, team = 0) {
    if (!this.elimination(position, team)) return false;
    const p = this.eliminations[(this.nextElimination - 1) % this.maxEliminations];
    p.position.copy(position); p.position.y += .32;
    p.life = p.total = .65; p.size = 2.9; p.opacity = .82;
    p.velocity.set(0, .25, 0);
    return true;
  }

  /** Adds a persistent, surface-aligned irregular paint scar. */
  decal(position, normal, material = null) {
    if (this.destroyed || !finiteVector(position) || !finiteVector(normal)) return;
    const n = this._scratchNormal.copy(normal);
    if (n.lengthSq() < .0001) return;
    n.normalize();
    const id = this.nextDecal++ % this.maxDecals;
    this._scratchPosition.copy(position).addScaledVector(n, .012);
    this._quaternion.setFromUnitVectors(Z_AXIS, n);
    this._roll.setFromAxisAngle(Z_AXIS, Math.random() * Math.PI * 2);
    this._quaternion.multiply(this._roll);
    const size = .12 + Math.random() * .065;
    this._scale.set(size, size * (.7 + Math.random() * .45), 1);
    this._matrix.compose(this._scratchPosition, this._quaternion, this._scale);
    this.decals.setMatrixAt(id, this._matrix);
    const color = this._scratchColor;
    if (material?.color?.isColor) color.copy(material.color).multiplyScalar(.43);
    else if (material?.isColor) color.copy(material).multiplyScalar(.43);
    else if (typeof material === 'number' || typeof material === 'string' && /^(#|rgb|hsl)/.test(material)) color.set(material).multiplyScalar(.43);
    else color.set(material === 'wood' ? '#79552e' : material === 'metal' ? '#536c76' : '#81724f');
    color.toArray(this.decalColors, id * 3);
    this.decals.count = Math.min(this.nextDecal, this.maxDecals);
    this.decals.instanceMatrix.needsUpdate = true;
    this.decalGeometry.attributes.pigmentColor.needsUpdate = true;
  }

  /** Ejects a casing in world space; the oldest of 32 is recycled. */
  shell(position, velocity, weapon = 'rifle') {
    if (this.destroyed || !finiteVector(position) || !finiteVector(velocity)) return;
    const id = this.nextShell++ % this.maxShells;
    const s = this.shells[id];
    s.weapon = typeof weapon === 'string' ? weapon : weapon?.id || 'rifle';
    s.active = true; s.sleeping = false; s.age = 0; s.bounces = 0;
    s.position.copy(position); s.velocity.copy(velocity);
    s.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI * 2, Math.random() * Math.PI);
    s.angularVelocity.set(6 + Math.random() * 11, 4 + Math.random() * 8, 8 + Math.random() * 12);
    const shotgun = s.weapon === 'shotgun';
    s.scale.setScalar(shotgun ? 1.5 : s.weapon === 'sniper' ? 1.2 : s.weapon === 'pistol' || s.weapon === 'smg' ? .8 : 1);
    s.scale.y *= shotgun ? 1.05 : s.weapon === 'pistol' || s.weapon === 'smg' ? .75 : 1;
    s.radius = .025 * s.scale.x;
    this.shellMesh.setColorAt(id, this._scratchColor.set(shotgun ? '#bf733e' : '#ddb653'));
    this.shellMesh.instanceColor.needsUpdate = true;
    this.shellMesh.count = Math.min(this.nextShell, this.maxShells);
    this._writeShell(id, s);
  }

  _writeShell(id, shell) {
    this._euler.set(shell.rotation.x, shell.rotation.y, shell.rotation.z);
    this._quaternion.setFromEuler(this._euler);
    this._matrix.compose(shell.position, this._quaternion, shell.scale);
    this.shellMesh.setMatrixAt(id, this._matrix);
    this.shellMesh.instanceMatrix.needsUpdate = true;
  }

  _updateShells(dt) {
    for (let i = 0; i < this.shellMesh.count; i++) {
      const s = this.shells[i];
      if (!s.active || s.sleeping) continue;
      s.age += dt;
      // Short steps keep fast ejected shells above narrow ledges. The callback
      // only samples the local collision index, never dense painterly meshes.
      const steps = Math.max(1, Math.ceil(dt / (1 / 60))), step = dt / steps;
      for (let j = 0; j < steps; j++) {
        const oldY = s.position.y;
        s.velocity.y -= 9.8 * step;
        s.position.addScaledVector(s.velocity, step);
        s.rotation.addScaledVector(s.angularVelocity, step);
        const sampled = this.floorHeight(s.position.x, s.position.z, oldY + s.radius);
        const floor = Number.isFinite(sampled) ? sampled : 0;
        if (s.position.y < floor + s.radius) {
          const energy = Math.max(0, -s.velocity.y);
          s.position.y = floor + s.radius;
          s.velocity.y = energy * .31;
          s.velocity.x *= .56; s.velocity.z *= .56;
          s.angularVelocity.multiplyScalar(.52);
          s.bounces++;
          if (energy > .8 && s.bounces <= 2 && this.onShellBounce) this.onShellBounce(s.position, s.weapon, energy);
          if (energy < .65 || s.bounces >= 5 || s.age > 3.5) {
            s.velocity.set(0, 0, 0); s.angularVelocity.set(0, 0, 0);
            s.rotation.x = Math.PI / 2; s.rotation.z = 0;
            s.sleeping = true;
            break;
          }
        }
      }
      this._writeShell(i, s);
    }
  }

  _updatePoints(pool, dt, smoke) {
    let count = 0;
    for (const p of pool.items) {
      p.life = Math.max(0, p.life - dt);
      if (!p.life) continue;
      const age = 1 - p.life / p.total;
      p.velocity.multiplyScalar(Math.exp(-dt * (smoke ? 2.8 : .5)));
      p.velocity.y += dt * (smoke ? .28 : -5.6);
      p.position.addScaledVector(p.velocity, dt);
      const i = count * 3;
      p.position.toArray(pool.positions, i); p.color.toArray(pool.colors, i);
      pool.sizes[count] = p.size * (smoke ? 1 + age * 2.8 : 1 - age * .25);
      pool.alphas[count] = p.opacity * (smoke ? Math.min(1, age * 9 + .18) * (1 - age) : Math.min(1, (1 - age) * 2.4));
      count++;
    }
    pool.geometry.setDrawRange(0, count);
    if (count) for (const attribute of Object.values(pool.geometry.attributes)) attribute.needsUpdate = true;
  }

  _updateEliminations(dt) {
    const pool = this._paint;
    let count = 0;
    for (const p of this.eliminations) {
      p.life = Math.max(0, p.life - dt);
      if (!p.life) continue;
      const age = 1 - p.life / p.total;
      p.position.addScaledVector(p.velocity, dt);
      p.position.toArray(pool.positions, count * 3);
      p.color.toArray(pool.colors, count * 3);
      pool.sizes[count] = p.size * (.72 + (1 - Math.pow(1 - age, 3)) * .64);
      pool.alphas[count] = p.opacity * Math.min(1, age * 24 + .55) * Math.pow(1 - age, .75);
      pool.accents[count] = p.accent || 0;
      pool.ages[count] = age;
      count++;
    }
    pool.geometry.setDrawRange(0, count);
    if (count) for (const attribute of Object.values(pool.geometry.attributes)) attribute.needsUpdate = true;
  }

  update(dt) {
    if (this.destroyed) return;
    dt = clamp(Number.isFinite(dt) ? dt : 0, 0, .1);
    let count = 0;
    for (const t of this.tracers) {
      t.life = Math.max(0, t.life - dt);
      if (!t.life) continue;
      const i = count * 6, fade = Math.min(1, t.life / t.duration * 1.7);
      t.from.toArray(this.tracerPositions, i); t.to.toArray(this.tracerPositions, i + 3);
      for (let v = 0; v < 2; v++) {
        const brightness = fade * (v ? 1 : .65);
        this.tracerColors[i + v * 3] = t.color.r * brightness;
        this.tracerColors[i + v * 3 + 1] = t.color.g * brightness;
        this.tracerColors[i + v * 3 + 2] = t.color.b * brightness;
      }
      count++;
    }
    this.tracerGeometry.setDrawRange(0, count * 2);
    if (count) {
      this.tracerGeometry.attributes.position.needsUpdate = true;
      this.tracerGeometry.attributes.color.needsUpdate = true;
    }
    this._updatePoints(this._sparks, dt, false);
    this._updatePoints(this._smoke, dt, true);
    this._updateEliminations(dt);
    this._updateShells(dt);
    if (typeof window !== 'undefined') {
      const scale = window.innerHeight * Math.min(window.devicePixelRatio || 1, 2);
      this._sparks.material.uniforms.uScale.value = scale;
      this._smoke.material.uniforms.uScale.value = scale;
      this._paint.material.uniforms.uScale.value = scale;
    }
  }

  clear() {
    if (this.destroyed) return;
    for (const t of this.tracers) t.life = 0;
    for (const p of this.particles) p.life = 0;
    for (const p of this.smoke) p.life = 0;
    for (const p of this.eliminations) p.life = 0;
    for (const s of this.shells) { s.active = false; s.sleeping = true; }
    this.nextTracer = this.nextParticle = this.nextSmoke = this.nextDecal = this.nextShell = this.nextElimination = 0;
    this.tracerGeometry.setDrawRange(0, 0);
    this.particleGeometry.setDrawRange(0, 0);
    this._smoke.geometry.setDrawRange(0, 0);
    this._paint.geometry.setDrawRange(0, 0);
    this.decals.count = this.shellMesh.count = 0;
  }

  destroy() {
    if (this.destroyed) return;
    this.clear();
    this.destroyed = true;
    this.scene.remove(this.lines, this.points, this._smoke.mesh, this.decals, this.shellMesh, this._paint.mesh);
    for (const resource of [this.tracerGeometry, this.tracerMaterial, this.particleGeometry, this.particleMaterial,
      this._smoke.geometry, this._smoke.material, this._paint.geometry, this._paint.material,
      this.decalGeometry, this.decalMaterial, this.shellGeometry, this.shellMaterial]) resource.dispose();
    this.onShellBounce = null;
  }
}
