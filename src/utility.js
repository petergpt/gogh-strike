import * as THREE from 'three';
import {bodyPoint} from './actor-body.js';

const clamp = THREE.MathUtils.clamp;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const GRAVITY = 14;
const THROW_SPEED = 24.5;
const MAX_THROW_RANGE = 40;
const MAX_PROJECTILES = 16;
const MAX_CLOUDS = 10;
const PUFFS_PER_CLOUD = 8;
const MAX_BURSTS = 12;

export const UTILITY = Object.freeze({
  smoke: Object.freeze({name: 'Pigment smoke', fuse: 1.6, duration: 14, radius: 5.5, height: 3.15}),
  frag: Object.freeze({name: 'Fragment grenade', fuse: 2.4, radius: 8.5, damage: 90}),
});

/** Length of a finite line inside an ellipsoidal cloud; never extends past either endpoint. */
export function smokeSegmentLength(a, b, center, radius, height = radius) {
  if (!(radius > 0) || !(height > 0)) return 0;
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  const x = (a.x - center.x) / radius, y = (a.y - center.y) / height, z = (a.z - center.z) / radius;
  const vx = dx / radius, vy = dy / height, vz = dz / radius;
  const aa = vx * vx + vy * vy + vz * vz;
  if (aa < 1e-12) return 0;
  const bb = 2 * (x * vx + y * vy + z * vz), cc = x * x + y * y + z * z - 1;
  const discriminant = bb * bb - 4 * aa * cc;
  if (discriminant <= 0) return 0;
  const root = Math.sqrt(discriminant);
  const entry = Math.max(0, (-bb - root) / (2 * aa));
  const exit = Math.min(1, (-bb + root) / (2 * aa));
  return Math.max(0, exit - entry) * Math.hypot(dx, dy, dz);
}

function cloudEnvelope(age) {
  return {growth: clamp(age / .8, 0, 1), opacity: clamp(age / .45, 0, 1) * clamp((UTILITY.smoke.duration - age) / 3, 0, 1)};
}

/** Local ballistics and optical cover, shared by player and bots. All times use simulation seconds. */
export class UtilitySystem {
  constructor(scene, physics, {onDamage = () => {}, onSound = () => {}, onBurst = () => {}} = {}) {
    this.scene = scene;
    this.physics = physics;
    this.onDamage = onDamage;
    this.onSound = onSound;
    this.onBurst = onBurst;
    this.projectiles = [];
    this.clouds = [];
    this.bursts = [];
    this.projectilePool = [];
    this.burstPool = [];
    this.time = 0;
    this.serial = 0;
    this._matrix = new THREE.Matrix4();
    this._quaternion = new THREE.Quaternion();
    this._scale = V();
    this._position = V();
    this._materials = {
      shell: new THREE.MeshBasicMaterial({color: 0x435c63}),
      seam: new THREE.MeshBasicMaterial({color: 0x182f3e}),
      metal: new THREE.MeshBasicMaterial({color: 0xa6b4a6}),
      smoke: new THREE.MeshBasicMaterial({color: 0x83b1b1}),
      frag: new THREE.MeshBasicMaterial({color: 0xdcaa49}),
      pigment: new THREE.MeshBasicMaterial({color: 0xdad5b0}),
    };
    this._geometries = {
      body: new THREE.CylinderGeometry(.09, .087, .23, 10),
      cap: new THREE.CylinderGeometry(.094, .094, .04, 10),
      seam: new THREE.TorusGeometry(.09, .009, 3, 10),
      pin: new THREE.TorusGeometry(.035, .006, 3, 10),
      lever: new THREE.BoxGeometry(.038, .115, .012),
      mark: new THREE.BoxGeometry(.018, .086, .003),
      flash: new THREE.IcosahedronGeometry(1, 1),
    };
    this._buildSmoke();
  }

  _buildSmoke() {
    const count = MAX_CLOUDS * PUFFS_PER_CLOUD;
    const geometry = new THREE.PlaneGeometry(1, 1);
    this._smokeOpacity = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
    this._smokeSeed = new THREE.InstancedBufferAttribute(Float32Array.from({length: count}, (_, i) => i * 7.139), 1);
    geometry.setAttribute('smokeOpacity', this._smokeOpacity);
    geometry.setAttribute('smokeSeed', this._smokeSeed);
    const material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: {uTime: {value: 0}},
      vertexShader: `
        attribute float smokeOpacity;
        attribute float smokeSeed;
        varying vec2 vUv;
        varying float vAlpha;
        varying float vSeed;
        void main() {
          vUv = uv; vAlpha = smokeOpacity; vSeed = smokeSeed;
          vec4 center = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          vec2 size = vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
          center.xy += position.xy * size;
          gl_Position = projectionMatrix * center;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        varying float vAlpha;
        varying float vSeed;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
        }
        void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          float r = length(p);
          vec2 brush = vec2(p.x * 2.4 + p.y * 1.2, p.y * 6.0) + vec2(vSeed, uTime * -0.065);
          float n = noise(brush) * 0.62 + noise(brush * 2.1) * 0.25 + noise(brush * 4.3) * 0.13;
          float edge = 1.0 - smoothstep(0.54 + n * 0.11, 1.0, r);
          float alpha = edge * vAlpha * (0.92 + n * 0.08);
          if (alpha < 0.012) discard;
          vec3 shadow = vec3(0.13, 0.19, 0.23);
          vec3 pigment = vec3(0.43, 0.50, 0.44);
          vec3 color = mix(shadow, pigment, clamp(0.18 + n * 0.86 + p.y * 0.10, 0.0, 1.0));
          gl_FragColor = vec4(color, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    this.smokeMesh = new THREE.InstancedMesh(geometry, material, count);
    this.smokeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.smokeMesh.frustumCulled = false;
    this.smokeMesh.renderOrder = 6;
    this.smokeMesh.count = 0;
    this.scene.add(this.smokeMesh);
  }

  _grenadeMesh(type) {
    const group = new THREE.Group(), geometries = this._geometries, materials = this._materials;
    const part = (geometry, material, x = 0, y = 0, z = 0) => {
      const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); group.add(mesh); return mesh;
    };
    part(geometries.body, materials.shell);
    const cap = part(geometries.cap, materials[type], 0, .121, 0);
    for (const y of [-.094, -.033, .033, .094]) { const band = part(geometries.seam, materials.seam, 0, y, 0); band.rotation.x = Math.PI / 2; }
    const pin = part(geometries.pin, materials.metal, .028, .17, 0); pin.rotation.y = .5;
    const lever = part(geometries.lever, materials.metal, .078, .101, 0); lever.rotation.z = -.27;
    for (let i = 0; i < 3; i++) {
      const mark = part(geometries.mark, materials.pigment, -.03 + i * .026, -.006 + i * .009, .089);
      mark.rotation.z = -.13 + i * .07;
    }
    group.userData.cap = cap;
    group.visible = false;
    this.scene.add(group);
    return group;
  }

  /** Aim target is optional world-space feet position. Without one, use the actor's aim. */
  throw(actor, type, target = null, time = this.time) {
    if (!actor?.alive || !UTILITY[type] || !actor.position || !Number.isFinite(time) ||
        !Number.isFinite(actor.utility?.[type]) || !(actor.utility[type] > 0) || this.projectiles.length >= MAX_PROJECTILES ||
        (actor.utilityReadyAt ?? 0) > time) return false;
    const origin = actor.bodyProfile ? V().fromArray(bodyPoint(actor)).add(V(0,-.06,0)) : actor.position.clone().add(V(0, (actor.height ?? 1.8) - .22, 0));
    const destination = target?.position ?? target;
    let velocity;
    if (destination && Number.isFinite(destination.x) && Number.isFinite(destination.y) && Number.isFinite(destination.z)) {
      const dx = destination.x - origin.x, dz = destination.z - origin.z;
      const distance = Math.hypot(dx, dz);
      if (distance > MAX_THROW_RANGE || distance < .25) return false;
      const dy = destination.y + .13 - origin.y, speed2 = THROW_SPEED * THROW_SPEED;
      const discriminant = speed2 * speed2 - GRAVITY * (GRAVITY * distance * distance + 2 * dy * speed2);
      if (discriminant < 0) return false;
      const angle = Math.atan((speed2 - Math.sqrt(discriminant)) / (GRAVITY * distance));
      const horizontal = Math.cos(angle) * THROW_SPEED;
      velocity = V(dx / distance * horizontal, Math.sin(angle) * THROW_SPEED, dz / distance * horizontal);
    } else {
      const yaw = Number.isFinite(actor.yaw) ? actor.yaw : 0;
      const pitch = clamp((Number.isFinite(actor.pitch) ? actor.pitch : 0) + .19, -.78, 1.22);
      velocity = V(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(THROW_SPEED);
      // Preserve some running momentum while keeping target throws accurate for bots.
      if (actor.velocity) velocity.addScaledVector(actor.velocity, .22);
    }
    const direction = velocity.clone().normalize();
    const muzzleHit = this.physics.raycast(origin, direction, .38);
    // A hand flush against solid scenery cannot create a grenade on the other side.
    if (muzzleHit && muzzleHit.distance < .16) return false;
    if (muzzleHit) origin.copy(muzzleHit.point).addScaledVector(muzzleHit.normal, .115);
    else origin.addScaledVector(direction, .30);
    const mesh = this.projectilePool.pop() ?? this._grenadeMesh(type);
    mesh.userData.cap.material = this._materials[type]; mesh.visible = true;
    mesh.position.copy(origin); mesh.rotation.set(.4, (this.serial % 9) * .7, .2);
    const id = ++this.serial;
    this.projectiles.push({id, type, source: actor, position: origin, start: origin.clone(), velocity,
      mesh, thrownAt: time, detonateAt: time + UTILITY[type].fuse, radius: .10, sleeping: false,
      nextBounceSound: time, spin: V(3.8 + id % 3, 5.4, 1.8), bounces: 0});
    actor.utility[type] = Math.max(0, Math.floor(actor.utility[type]) - 1);
    actor.utilityReadyAt = time + .75;
    actor.protectedUntil = 0;
    this.onSound('throw', origin);
    return true;
  }

  _bounce(projectile, normal, point, time) {
    const impact = -projectile.velocity.dot(normal);
    if (impact > 0) {
      projectile.velocity.addScaledVector(normal, impact * 1.43);
      if (normal.y > .55) { projectile.velocity.x *= .76; projectile.velocity.z *= .76; }
      else projectile.velocity.multiplyScalar(.83);
    }
    projectile.position.copy(point).addScaledVector(normal, projectile.radius + .022);
    projectile.spin.multiplyScalar(.73);
    projectile.bounces++;
    if (impact > 1.2 && time >= projectile.nextBounceSound) {
      this.onSound('bounce', projectile.position);
      projectile.nextBounceSound = time + .11;
    }
    if (normal.y > .55 && Math.abs(projectile.velocity.y) < .65 && Math.hypot(projectile.velocity.x, projectile.velocity.z) < .75) {
      projectile.velocity.set(0, 0, 0); projectile.sleeping = true;
    }
  }

  _move(projectile, dt, time) {
    if (projectile.sleeping) return;
    const steps = Math.max(1, Math.ceil(dt / .012));
    const step = dt / steps;
    for (let i = 0; i < steps && !projectile.sleeping; i++) {
      const previous = projectile.position.clone();
      projectile.velocity.y -= GRAVITY * step;
      const travel = projectile.velocity.clone().multiplyScalar(step), distance = travel.length();
      const hit = distance > 1e-7 ? this.physics.raycast(previous, travel, distance + projectile.radius) : null;
      if (hit) this._bounce(projectile, hit.normal, hit.point, time);
      else projectile.position.add(travel);
      const floor = this.physics.floorHeight(projectile.position.x, projectile.position.z, Math.max(previous.y, projectile.position.y) + .11);
      if (projectile.position.y < floor + projectile.radius && projectile.velocity.y <= 0) {
        this._bounce(projectile, UP, V(projectile.position.x, floor, projectile.position.z), time);
      }
      const bounds = this.physics.bounds;
      if (bounds) {
        for (const axis of ['x', 'z']) {
          const lower = bounds[axis === 'x' ? 'minX' : 'minZ'] + .12;
          const upper = bounds[axis === 'x' ? 'maxX' : 'maxZ'] - .12;
          if (projectile.position[axis] < lower || projectile.position[axis] > upper) {
            projectile.position[axis] = clamp(projectile.position[axis], lower, upper);
            projectile.velocity[axis] *= -.42;
          }
        }
      }
      const dx = projectile.position.x - projectile.start.x, dz = projectile.position.z - projectile.start.z;
      const range = Math.hypot(dx, dz);
      if (range > MAX_THROW_RANGE) {
        projectile.position.x = projectile.start.x + dx / range * MAX_THROW_RANGE;
        projectile.position.z = projectile.start.z + dz / range * MAX_THROW_RANGE;
        projectile.velocity.x = projectile.velocity.z = 0;
      }
      projectile.mesh.rotation.x += projectile.spin.x * step;
      projectile.mesh.rotation.y += projectile.spin.y * step;
      projectile.mesh.rotation.z += projectile.spin.z * step;
    }
    projectile.mesh.position.copy(projectile.position);
  }

  _detonate(projectile, actors, time) {
    const position = projectile.position.clone();
    if (projectile.type === 'smoke') {
      if (this.clouds.length >= MAX_CLOUDS) this.clouds.shift();
      const floor = this.physics.floorHeight(position.x, position.z, position.y + .15);
      // Smoke gathers around its canister, including elevated balconies and furniture.
      position.y = Math.max(floor + 1.8, position.y + 1.2);
      this.clouds.push({id: projectile.id, position, source: projectile.source, bornAt: time,
        expiresAt: time + UTILITY.smoke.duration, radius: 0, height: 0, opacity: 0});
      this.onSound('smoke', projectile.position);
      this.onBurst(projectile.position.clone(), 'smoke');
    } else {
      for (const victim of actors) {
        if (!victim.alive || (victim.team === projectile.source.team && victim !== projectile.source)) continue;
        const center = victim.bodyProfile ? V().fromArray(bodyPoint(victim,'chest')) : victim.position.clone().add(V(0, (victim.height ?? 1.8) * .52, 0));
        const distance = position.distanceTo(center);
        if (distance >= UTILITY.frag.radius) continue;
        // Cover is the exact static geometry. Smoke never absorbs a physical blast.
        if (!this.physics.lineOfSight(position, center)) continue;
        const amount = UTILITY.frag.damage * clamp((UTILITY.frag.radius - distance) / (UTILITY.frag.radius - 1.25), 0, 1);
        if (amount > .5) this.onDamage(victim, amount, projectile.source);
      }
      this._flash(position, time);
      this.onSound('frag', position);
      this.onBurst(position.clone(), 'frag', projectile.source);
    }
    projectile.mesh.visible = false;
    this.projectilePool.push(projectile.mesh);
  }

  _flash(position, time) {
    if (this.bursts.length >= MAX_BURSTS) {
      const oldest = this.bursts.shift(); oldest.mesh.visible = false; this.burstPool.push(oldest.mesh);
    }
    let mesh = this.burstPool.pop();
    if (!mesh) {
      mesh = new THREE.Mesh(this._geometries.flash, new THREE.MeshBasicMaterial({color: 0xf4b647,
        transparent: true, depthWrite: false, wireframe: false}));
      this.scene.add(mesh);
    }
    mesh.position.copy(position); mesh.visible = true; mesh.scale.setScalar(.1);
    this.bursts.push({mesh, bornAt: time});
  }

  update(dt, time, actors = []) {
    if (!Number.isFinite(dt) || !Number.isFinite(time) || dt < 0) return;
    this.time = time;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];
      this._move(projectile, Math.min(dt, .10), time);
      if (time >= projectile.detonateAt) { this._detonate(projectile, actors, time); this.projectiles.splice(i, 1); }
    }
    for (let i = this.clouds.length - 1; i >= 0; i--) {
      const cloud = this.clouds[i], age = time - cloud.bornAt;
      if (time >= cloud.expiresAt) { this.clouds.splice(i, 1); continue; }
      const envelope = cloudEnvelope(age);
      cloud.radius = UTILITY.smoke.radius * envelope.growth;
      cloud.height = UTILITY.smoke.height * envelope.growth;
      cloud.opacity = envelope.opacity;
    }
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const burst = this.bursts[i], age = time - burst.bornAt;
      if (age >= .48) { burst.mesh.visible = false; this.burstPool.push(burst.mesh); this.bursts.splice(i, 1); continue; }
      burst.mesh.scale.setScalar(.35 + age * 5.4);
      burst.mesh.rotation.set(age * 2, age * 3, age * .8);
      burst.mesh.material.opacity = Math.pow(1 - age / .48, 2) * .86;
      burst.mesh.material.color.setRGB(1, .42 + .35 * (1 - age / .48), .1);
    }
    this._renderSmoke(time);
  }

  _renderSmoke(time) {
    let instance = 0;
    for (const cloud of this.clouds) {
      const age = time - cloud.bornAt;
      for (let j = 0; j < PUFFS_PER_CLOUD; j++) {
        const angle = j * 2.399963 + cloud.id * .4;
        const ring = j === 0 ? 0 : Math.sqrt(j / (PUFFS_PER_CLOUD - 1)) * .48;
        const drift = Math.sin(age * .24 + j * 1.9) * .10;
        this._position.set(cloud.position.x + Math.cos(angle) * cloud.radius * ring,
          cloud.position.y + Math.sin(j * 2.13) * cloud.height * .29 + drift,
          cloud.position.z + Math.sin(angle) * cloud.radius * ring);
        this._scale.set(cloud.radius * (j === 0 ? 1.9 : 1.42), cloud.height * (j === 0 ? 2.1 : 1.6), 1);
        this._matrix.compose(this._position, this._quaternion, this._scale);
        this.smokeMesh.setMatrixAt(instance, this._matrix);
        this._smokeOpacity.setX(instance, cloud.opacity * (j === 0 ? .98 : .86));
        this._smokeSeed.setX(instance, cloud.id * 3.71 + j * 7.139);
        instance++;
      }
    }
    this.smokeMesh.count = instance;
    this.smokeMesh.visible = instance > 0;
    this.smokeMesh.instanceMatrix.needsUpdate = true;
    this._smokeOpacity.needsUpdate = true;
    this._smokeSeed.needsUpdate = true;
    this.smokeMesh.material.uniforms.uTime.value = time;
  }

  /** Same wall and smoke visibility query for AI targeting and HUD enemy contacts. */
  lineOfSight(a, b) {
    if (!this.physics.lineOfSight(a, b)) return false;
    let depth = 0;
    for (const cloud of this.clouds) {
      if (cloud.opacity <= .02) continue;
      depth += smokeSegmentLength(a, b, cloud.position, cloud.radius, cloud.height) * cloud.opacity;
      if (depth > 1.65) return false;
    }
    return true;
  }

  /** Density around a camera/eye position; useful for a restrained in-smoke veil. */
  obscurity(point) {
    let clear = 1;
    for (const cloud of this.clouds) {
      if (cloud.radius < .01 || cloud.height < .01) continue;
      const d = Math.hypot((point.x - cloud.position.x) / cloud.radius,
        (point.y - cloud.position.y) / cloud.height, (point.z - cloud.position.z) / cloud.radius);
      clear *= 1 - clamp((1 - d) * 2.2, 0, 1) * cloud.opacity;
    }
    return clamp(1 - clear, 0, 1);
  }

  clear() {
    for (const projectile of this.projectiles) { projectile.mesh.visible = false; this.projectilePool.push(projectile.mesh); }
    for (const burst of this.bursts) { burst.mesh.visible = false; this.burstPool.push(burst.mesh); }
    this.projectiles.length = this.clouds.length = this.bursts.length = 0;
    this.smokeMesh.count = 0; this.smokeMesh.visible = false; this.time = 0;
  }

  getState() {
    return {
      projectiles: this.projectiles.map(p => ({id: p.id, type: p.type, team: p.source.team,
        position: p.position.toArray(), velocity: p.velocity.toArray(), fuse: Math.max(0, p.detonateAt - this.time), bounces: p.bounces})),
      clouds: this.clouds.map(c => ({id: c.id, team: c.source.team, position: c.position.toArray(),
        radius: c.radius, opacity: c.opacity, remaining: Math.max(0, c.expiresAt - this.time)})),
    };
  }
}
