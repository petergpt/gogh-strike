import * as THREE from 'three';

// Gameplay uses the source painting's actual solid triangles. Brush instances,
// people, boats and the sky are deliberately not part of this static index.
const EPS = 1e-5;
const clamp = THREE.MathUtils.clamp;
const DIST_EPS = .015;

function pointInTriangleXZ(x, z, t) {
  const denominator = (t.b.z - t.c.z) * (t.a.x - t.c.x) + (t.c.x - t.b.x) * (t.a.z - t.c.z);
  if (Math.abs(denominator) < EPS) return null;
  const u = ((t.b.z - t.c.z) * (x - t.c.x) + (t.c.x - t.b.x) * (z - t.c.z)) / denominator;
  const v = ((t.c.z - t.a.z) * (x - t.c.x) + (t.a.x - t.c.x) * (z - t.c.z)) / denominator;
  if (u < -EPS || v < -EPS || u + v > 1 + EPS) return null;
  return u * t.a.y + v * t.b.y + (1 - u - v) * t.c.y;
}

function clipAtHeight(poly, height, above) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const ai = above ? a.y >= height : a.y <= height;
    const bi = above ? b.y >= height : b.y <= height;
    if (ai) out.push(a);
    if (ai !== bi) {
      const f = (height - a.y) / (b.y - a.y);
      out.push({x: a.x + (b.x - a.x) * f, y: height, z: a.z + (b.z - a.z) * f});
    }
  }
  return out;
}

// A circle against the real triangle's horizontal slice; vertical triangles
// naturally reduce to wall segments, horizontal triangles remain solid tops.
function circleTriangle(x, z, radius, low, high, t, fallbackX = 1, fallbackZ = 0) {
  if (t.maxY <= low + EPS || t.minY >= high - EPS ||
      x + radius < t.minX || x - radius > t.maxX || z + radius < t.minZ || z - radius > t.maxZ) return null;
  let poly = [t.a, t.b, t.c];
  if (t.minY < low) poly = clipAtHeight(poly, low, true);
  if (t.maxY > high) poly = clipAtHeight(poly, high, false);
  if (poly.length < 2) return null;
  let distanceSq = Infinity, qx = 0, qz = 0, area = 0, inside = false;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const dx = b.x - a.x, dz = b.z - a.z;
    const f = clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1), 0, 1);
    const px = a.x + f * dx, pz = a.z + f * dz;
    const d = (x - px) ** 2 + (z - pz) ** 2;
    if (d < distanceSq) { distanceSq = d; qx = px; qz = pz; }
    area += a.x * b.z - b.x * a.z;
    if (((a.z > z) !== (b.z > z)) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) inside = !inside;
  }
  if (Math.abs(area) < .00001) inside = false;
  if (!inside && distanceSq >= radius * radius) return null;
  const distance = Math.sqrt(distanceSq);
  let nx = x - qx, nz = z - qz;
  if (inside) { nx = -nx; nz = -nz; }
  if (distance < .000001) {
    nx = fallbackX; nz = fallbackZ;
    const n = Math.hypot(nx, nz);
    if (n < EPS) { nx = t.normal.x; nz = t.normal.z; }
    if (Math.hypot(nx, nz) < EPS) { nx = 1; nz = 0; }
  }
  const inv = 1 / (Math.hypot(nx, nz) || 1);
  return {x: nx * inv, z: nz * inv, depth: inside ? radius + distance : radius - distance};
}

class MinHeap {
  constructor() { this.values = []; }
  push(id, score) {
    const values = this.values, item = {id, score};
    let i = values.length; values.push(item);
    while (i > 0) { const p = (i - 1) >> 1; if (values[p].score <= score) break; values[i] = values[p]; i = p; }
    values[i] = item;
  }
  pop() {
    const values = this.values, first = values[0], last = values.pop();
    if (values.length) {
      let i = 0;
      while (true) {
        let child = i * 2 + 1;
        if (child >= values.length) break;
        if (child + 1 < values.length && values[child + 1].score < values[child].score) child++;
        if (last.score <= values[child].score) break;
        values[i] = values[child]; i = child;
      }
      values[i] = last;
    }
    return first;
  }
  get length() { return this.values.length; }
}

export class PhysicsWorld {
  constructor({ground, wallSegments = [], solidMeshes = [], bounds = {}, cellSize = 2.5, navCellSize = .5} = {}) {
    this.ground = ground || (() => 0);
    this.bounds = {minX: -46, maxX: 108, minZ: -48, maxZ: 34, ...bounds};
    this.cellSize = cellSize;
    this.triangles = [];
    this.cells = new Map();
    this._nearCache = new Map();
    this._ray = new THREE.Ray();
    this._hit = new THREE.Vector3();
    this._stamp = 0;
    this.wallSegments = wallSegments;
    const visitedMeshes = new Set();
    for (const root of solidMeshes) {
      root.updateWorldMatrix(true, true);
      root.traverse(mesh => {
        if (!mesh.isMesh || mesh.isInstancedMesh || visitedMeshes.has(mesh) || mesh.userData?.collision === false) return;
        visitedMeshes.add(mesh);
        const geometry = mesh.geometry;
        const p = geometry?.getAttribute('position');
        if (!p) return;
        const index = geometry.index;
        const n = index ? index.count : p.count;
        for (let i = 0; i < n; i += 3) {
          const a = new THREE.Vector3().fromBufferAttribute(p, index ? index.getX(i) : i).applyMatrix4(mesh.matrixWorld);
          const b = new THREE.Vector3().fromBufferAttribute(p, index ? index.getX(i + 1) : i + 1).applyMatrix4(mesh.matrixWorld);
          const c = new THREE.Vector3().fromBufferAttribute(p, index ? index.getX(i + 2) : i + 2).applyMatrix4(mesh.matrixWorld);
          this._addTriangle(a, b, c);
        }
      });
    }
    // Useful for small isolated rule tests, and a safe fallback for callers
    // that only have the original map's segments available.
    if (!solidMeshes.length) for (const segment of wallSegments) {
      const a = segment.a.clone(), b = segment.b.clone();
      const base = segment.minY ?? Math.min(this.ground(a.x, a.z), this.ground(b.x, b.z));
      const top = segment.maxY ?? base + 8;
      a.y = b.y = base;
      this._addTriangle(a.clone(), b.clone(), b.clone().setY(top));
      this._addTriangle(a.clone(), b.clone().setY(top), a.clone().setY(top));
    }
    this._seen = new Uint32Array(this.triangles.length);
    this._buildNavigation(navCellSize);
    this.stats = {triangles: this.triangles.length, spatialCells: this.cells.size, navCells: this.nav.walkable.length,
      walkableCells: this.nav.walkable.reduce((sum, value) => sum + value, 0)};
  }

  _addTriangle(a, b, c) {
    const normal = b.clone().sub(a).cross(c.clone().sub(a));
    if (normal.lengthSq() < 1e-12) return;
    normal.normalize();
    const t = {a, b, c, normal, minX: Math.min(a.x, b.x, c.x), maxX: Math.max(a.x, b.x, c.x),
      minY: Math.min(a.y, b.y, c.y), maxY: Math.max(a.y, b.y, c.y),
      minZ: Math.min(a.z, b.z, c.z), maxZ: Math.max(a.z, b.z, c.z)};
    const bounds = this.bounds, margin = 4;
    if (t.maxX < bounds.minX - margin || t.minX > bounds.maxX + margin ||
        t.maxZ < bounds.minZ - margin || t.minZ > bounds.maxZ + margin) return;
    const id = this.triangles.length;
    this.triangles.push(t);
    const minX = Math.floor(Math.max(t.minX, bounds.minX - margin) / this.cellSize);
    const maxX = Math.floor(Math.min(t.maxX, bounds.maxX + margin) / this.cellSize);
    const minZ = Math.floor(Math.max(t.minZ, bounds.minZ - margin) / this.cellSize);
    const maxZ = Math.floor(Math.min(t.maxZ, bounds.maxZ + margin) / this.cellSize);
    for (let z = minZ; z <= maxZ; z++) for (let x = minX; x <= maxX; x++) {
      const key = `${x},${z}`;
      let cell = this.cells.get(key);
      if (!cell) this.cells.set(key, cell = []);
      cell.push(id);
    }
  }

  _near(x, z, radius = 0) {
    const minX = Math.floor((x - radius) / this.cellSize), maxX = Math.floor((x + radius) / this.cellSize);
    const minZ = Math.floor((z - radius) / this.cellSize), maxZ = Math.floor((z + radius) / this.cellSize);
    if (minX === maxX && minZ === maxZ) return this.cells.get(`${minX},${minZ}`) || [];
    // Static geometry makes a cell rectangle's candidates immutable. Reuse
    // their deduplicated order instead of allocating a Set at every path sample.
    const key = `${minX},${minZ},${maxX},${maxZ}`;
    const cached = this._nearCache.get(key);
    if (cached) return cached;
    const found = new Set();
    for (let zz = minZ; zz <= maxZ; zz++) for (let xx = minX; xx <= maxX; xx++) {
      const cell = this.cells.get(`${xx},${zz}`);
      if (cell) for (const id of cell) found.add(id);
    }
    const candidates = [...found];
    this._nearCache.set(key, candidates);
    return candidates;
  }

  /** Highest supporting real surface at or below maxHeight. */
  floorHeight(x, z, maxHeight = this.ground(x, z) + .4) {
    const terrain = this.ground(x, z);
    let height = terrain;
    for (const id of this._near(x, z)) {
      const t = this.triangles[id];
      if (Math.abs(t.normal.y) < .52 || t.minY > maxHeight + EPS || t.maxY < height - EPS) continue;
      const y = pointInTriangleXZ(x, z, t);
      // Fine floorboard contours and painted path ribbons should not bounce
      // the camera. Genuine steps and furniture tops still support the feet.
      if (y !== null && y <= maxHeight + EPS && y > height && y > terrain + .065) height = y;
    }
    return height;
  }

  _ceilingHeight(x, z, minHeight) {
    let height = Infinity;
    for (const id of this._near(x, z)) {
      const t = this.triangles[id];
      if (Math.abs(t.normal.y) < .35 || t.maxY < minHeight || t.minY > height) continue;
      const y = pointInTriangleXZ(x, z, t);
      if (y !== null && y >= minHeight - EPS && y < height) height = y;
    }
    return height;
  }

  _blocked(x, z, feet, radius = .34, height = 1.8, stepHeight = .31) {
    const bounds = this.bounds;
    if (x < bounds.minX + radius || x > bounds.maxX - radius || z < bounds.minZ + radius || z > bounds.maxZ - radius) return true;
    for (const id of this._near(x, z, radius)) {
      if (circleTriangle(x, z, radius, feet + stepHeight, feet + height, this.triangles[id])) return true;
    }
    return false;
  }

  /** Tests the character volume against solid scenery, independently of nav. */
  canOccupy(position, radius = .34, height = 1.8) {
    return !this._blocked(position.x, position.z, position.y, radius, height);
  }

  _resolveHorizontal(position, previous, radius, height, stepHeight) {
    let collided = false;
    const fallbackX = previous.x - position.x, fallbackZ = previous.z - position.z;
    for (let pass = 0; pass < 4; pass++) {
      let changed = false;
      for (const id of this._near(position.x, position.z, radius + .03)) {
        const low = Math.max(position.y + stepHeight, this.ground(position.x, position.z) + .065);
        const hit = circleTriangle(position.x, position.z, radius + .015, low,
          position.y + height - .015, this.triangles[id], fallbackX, fallbackZ);
        if (!hit) continue;
        position.x += hit.x * (hit.depth + .0005);
        position.z += hit.z * (hit.depth + .0005);
        collided = changed = true;
      }
      if (!changed) break;
    }
    const b = this.bounds;
    const x = clamp(position.x, b.minX + radius, b.maxX - radius);
    const z = clamp(position.z, b.minZ + radius, b.maxZ - radius);
    collided ||= x !== position.x || z !== position.z;
    position.x = x; position.z = z;
    return collided;
  }

  /** Positional separation only; never advances the actor's movement clock. */
  displace(actor, delta) {
    const dx = Number.isFinite(delta?.x) ? delta.x : 0;
    const dz = Number.isFinite(delta?.z) ? delta.z : 0;
    const radius = actor.radius ?? .34;
    const height = actor.height ?? (actor.crouched ? (actor.crouchHeight ?? 1.12) : (actor.standingHeight ?? 1.8));
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (radius * .45)));
    const position = actor.position;
    for (let i = 0; i < steps; i++) {
      const previous = position.clone();
      const grounded = !!actor.grounded;
      position.x += dx / steps;
      position.z += dz / steps;
      if (grounded) {
        const support = this.floorHeight(position.x, position.z, previous.y + .31);
        if (support > previous.y && support - previous.y <= .31) position.y = support;
      }
      this._resolveHorizontal(position, previous, radius, height, grounded ? .31 : .035);
      if (grounded) {
        const support = this.floorHeight(position.x, position.z, previous.y + .31);
        if (Math.abs(support - previous.y) <= .31) position.y = support;
        else {
          // A separation off a ledge begins falling on the next normal move.
          position.y = previous.y;
          actor.grounded = false;
        }
      } else position.y = previous.y;
    }
    return actor;
  }

  /** Accelerated, grounded first-person movement. Actor position is its feet. */
  move(actor, desiredVelocity, dt, options = {}) {
    dt = Math.min(Math.max(0, dt), .08);
    const position = actor.position;
    if (!actor.velocity) actor.velocity = new THREE.Vector3();
    const velocity = actor.velocity;
    const radius = actor.radius ?? .34;
    const standingHeight = actor.standingHeight ?? 1.8;
    const crouchHeight = actor.crouchHeight ?? 1.12;
    const wasGrounded = !!actor.grounded;
    actor.crouched = !!options.crouch || (actor.crouched && !this.canOccupy(position, radius, standingHeight));
    actor.height = actor.crouched ? crouchHeight : standingHeight;
    actor.eyeHeight = actor.height - .12;
    const targetX = Number.isFinite(desiredVelocity?.x) ? desiredVelocity.x : 0;
    const targetZ = Number.isFinite(desiredVelocity?.z) ? desiredVelocity.z : 0;
    const acceleration = Math.hypot(targetX, targetZ) > .01 ? (options.acceleration ?? 32) : (options.braking ?? 38);
    const factor = wasGrounded ? 1 : .33;
    const changeX = targetX - velocity.x, changeZ = targetZ - velocity.z;
    const changeLength = Math.hypot(changeX, changeZ);
    const change = Math.min(1, acceleration * factor * dt / (changeLength || 1));
    velocity.x += changeX * change; velocity.z += changeZ * change;
    if (options.jump && wasGrounded && !actor._jumpHeld) {
      velocity.y = options.jumpSpeed ?? 6.8;
      actor.grounded = false;
    }
    actor._jumpHeld = !!options.jump;
    const steps = Math.max(1, Math.ceil(dt / .012), Math.ceil(Math.hypot(velocity.x, velocity.z) * dt / (radius * .45)));
    const step = dt / steps;
    let blocked = false, landingSpeed = 0;
    for (let i = 0; i < steps; i++) {
      const previous = position.clone();
      const grounded = !!actor.grounded;
      velocity.y -= (options.gravity ?? 21) * step;
      position.x += velocity.x * step;
      position.z += velocity.z * step;
      const walkFloor = this.floorHeight(position.x, position.z, previous.y + (grounded ? .34 : .015));
      if (grounded && walkFloor > previous.y && walkFloor - previous.y <= .34) position.y = walkFloor;
      blocked = this._resolveHorizontal(position, previous, radius, actor.height, grounded ? .31 : .035) || blocked;
      const horizontalDistance = Math.hypot(position.x - previous.x, position.z - previous.z);
      // Keep sliding velocity, but shed the component driven directly into a wall.
      if (horizontalDistance < Math.hypot(velocity.x, velocity.z) * step * .25 && step > 0) {
        velocity.x *= .7; velocity.z *= .7;
      }
      const beforeVertical = position.y;
      position.y += velocity.y * step;
      if (velocity.y > 0) {
        const ceiling = this._ceilingHeight(position.x, position.z, beforeVertical + actor.height - .04);
        if (position.y + actor.height >= ceiling) { position.y = ceiling - actor.height - .005; velocity.y = 0; }
      }
      const support = this.floorHeight(position.x, position.z, Math.max(beforeVertical, previous.y) + .035);
      if (velocity.y <= 0 && position.y <= support + .005) {
        if (!grounded) landingSpeed = Math.max(landingSpeed, -velocity.y);
        position.y = support;
        velocity.y = 0;
        actor.grounded = true;
      } else actor.grounded = false;
    }
    actor.blocked = blocked;
    actor.landed = !wasGrounded && actor.grounded;
    actor.landingSpeed = landingSpeed;
    if (!Number.isFinite(position.y) || position.y < -8) {
      position.copy(this.nearestWalkable(position, {radius, height: standingHeight})); velocity.set(0, 0, 0); actor.grounded = true;
    }
    return actor;
  }

  /** First actual solid hit, with two-sided faces and spatial DDA traversal. */
  raycast(origin, direction, maxDistance = 150) {
    const length = direction.length();
    if (length < EPS || maxDistance <= 0) return null;
    this._ray.origin.copy(origin);
    this._ray.direction.copy(direction).multiplyScalar(1 / length);
    const d = this._ray.direction;
    let cx = Math.floor(origin.x / this.cellSize), cz = Math.floor(origin.z / this.cellSize);
    const sx = d.x >= 0 ? 1 : -1, sz = d.z >= 0 ? 1 : -1;
    const deltaX = Math.abs(d.x) > EPS ? this.cellSize / Math.abs(d.x) : Infinity;
    const deltaZ = Math.abs(d.z) > EPS ? this.cellSize / Math.abs(d.z) : Infinity;
    let nextX = Math.abs(d.x) > EPS ? ((cx + (sx > 0 ? 1 : 0)) * this.cellSize - origin.x) / d.x : Infinity;
    let nextZ = Math.abs(d.z) > EPS ? ((cz + (sz > 0 ? 1 : 0)) * this.cellSize - origin.z) / d.z : Infinity;
    let travel = 0, distance = maxDistance, best = null;
    this._stamp = (this._stamp + 1) >>> 0;
    if (!this._stamp) { this._seen.fill(0); this._stamp = 1; }
    for (let step = 0; step < 700 && travel <= distance + EPS; step++) {
      const cell = this.cells.get(`${cx},${cz}`);
      if (cell) for (const id of cell) {
        if (this._seen[id] === this._stamp) continue;
        this._seen[id] = this._stamp;
        const t = this.triangles[id];
        if (!this._ray.intersectTriangle(t.a, t.b, t.c, false, this._hit)) continue;
        const hitDistance = origin.distanceTo(this._hit);
        if (hitDistance < DIST_EPS || hitDistance > distance) continue;
        distance = hitDistance;
        const normal = t.normal.clone();
        if (normal.dot(d) > 0) normal.negate();
        best = {distance, point: this._hit.clone(), normal, triangleIndex: id};
      }
      if (nextX === Infinity && nextZ === Infinity) break;
      if (nextX < nextZ) { travel = nextX; nextX += deltaX; cx += sx; }
      else { travel = nextZ; nextZ += deltaZ; cz += sz; }
    }
    return best;
  }

  lineOfSight(a, b) {
    const direction = b.clone().sub(a), distance = direction.length();
    return distance < .025 || !this.raycast(a, direction, Math.max(0, distance - .045));
  }

  _buildNavigation(cell) {
    const b = this.bounds;
    const width = Math.ceil((b.maxX - b.minX) / cell), depth = Math.ceil((b.maxZ - b.minZ) / cell);
    const walkable = new Uint8Array(width * depth), heights = new Float32Array(width * depth);
    this.nav = {cell, width, depth, minX: b.minX, minZ: b.minZ, walkable, heights};
    for (let z = 0; z < depth; z++) for (let x = 0; x < width; x++) {
      const wx = b.minX + (x + .5) * cell, wz = b.minZ + (z + .5) * cell, id = z * width + x;
      const floor = this.floorHeight(wx, wz);
      heights[id] = floor;
      if (!this._blocked(wx, wz, floor, .36, 1.8, .31)) walkable[id] = 1;
    }
    // Sealed building interiors may have ground below their roofs. Only the
    // largest physically connected component belongs to this continuous town.
    const labels = new Int32Array(walkable.length), queue = new Int32Array(walkable.length);
    let label = 0, largestLabel = 0, largestSize = 0;
    for (let start = 0; start < walkable.length; start++) {
      if (!walkable[start] || labels[start]) continue;
      let read = 0, write = 1;
      queue[0] = start; labels[start] = ++label;
      while (read < write) {
        const id = queue[read++], x = id % width, z = Math.floor(id / width);
        for (const next of [x > 0 ? id - 1 : -1, x + 1 < width ? id + 1 : -1, z > 0 ? id - width : -1, z + 1 < depth ? id + width : -1]) {
          if (next < 0 || !walkable[next] || labels[next] || Math.abs(heights[next] - heights[id]) > .34) continue;
          labels[next] = label; queue[write++] = next;
        }
      }
      if (write > largestSize) { largestSize = write; largestLabel = label; }
    }
    for (let i = 0; i < walkable.length; i++) if (labels[i] !== largestLabel) walkable[i] = 0;
    this._pathStamp = 0;
    this._pathSeen = new Uint32Array(walkable.length);
    this._pathClosed = new Uint32Array(walkable.length);
    this._pathCost = new Float32Array(walkable.length);
    this._pathParent = new Int32Array(walkable.length);
    this._shapeNavigation = new Map();
  }

  _cellOf(point) {
    const n = this.nav;
    return {x: clamp(Math.floor((point.x - n.minX) / n.cell), 0, n.width - 1),
      z: clamp(Math.floor((point.z - n.minZ) / n.cell), 0, n.depth - 1)};
  }

  _pointOf(id) {
    const n = this.nav;
    return new THREE.Vector3(n.minX + ((id % n.width) + .5) * n.cell, n.heights[id], n.minZ + (Math.floor(id / n.width) + .5) * n.cell);
  }

  // The original grid remains a conservative shared navigation region. Larger
  // bodies filter its cells against their own volume; smaller bodies retain the
  // same connected town rather than discovering sealed decorative interiors.
  // Cache clearance and checked edges so body variety does not repeat geometry
  // work every time a bot replans. The fixed LRU bound also covers custom looks.
  _navigationForShape(radius = .35, height = 1.8) {
    const key = `${radius}:${height}`;
    const cached = this._shapeNavigation.get(key);
    if (cached) {
      this._shapeNavigation.delete(key); this._shapeNavigation.set(key, cached);
      return cached;
    }
    const n = this.nav;
    const walkable = radius > .36 || height > 1.8 ? n.walkable.slice() : n.walkable;
    if (walkable !== n.walkable) for (let id = 0; id < walkable.length; id++) {
      if (!walkable[id]) continue;
      const x = n.minX + ((id % n.width) + .5) * n.cell;
      const z = n.minZ + (Math.floor(id / n.width) + .5) * n.cell;
      if (this._blocked(x, z, n.heights[id], radius, height)) walkable[id] = 0;
    }
    const entry = {walkable, testedEdges: new Uint8Array(walkable.length), clearEdges: new Uint8Array(walkable.length)};
    this._shapeNavigation.set(key, entry);
    if (this._shapeNavigation.size > 32) this._shapeNavigation.delete(this._shapeNavigation.keys().next().value);
    return entry;
  }

  _nearestCell(point, walkable = this.nav.walkable) {
    const n = this.nav, {x, z} = this._cellOf(point);
    let best = -1, distance = Infinity;
    for (let radius = 0; radius < Math.max(n.width, n.depth); radius++) {
      for (let zz = Math.max(0, z - radius); zz <= Math.min(n.depth - 1, z + radius); zz++) {
        for (let xx = Math.max(0, x - radius); xx <= Math.min(n.width - 1, x + radius); xx++) {
          if (radius && Math.abs(xx - x) !== radius && Math.abs(zz - z) !== radius) continue;
          const id = zz * n.width + xx;
          if (!walkable[id]) continue;
          const d = (n.minX + (xx + .5) * n.cell - point.x) ** 2 + (n.minZ + (zz + .5) * n.cell - point.z) ** 2;
          if (d < distance) { best = id; distance = d; }
        }
      }
      if (best >= 0 && radius * n.cell > Math.sqrt(distance) + n.cell) return best;
    }
    return best;
  }

  nearestWalkable(point, options = {}) {
    const radius = options.radius ?? .36, height = options.height ?? 1.8;
    const {walkable} = this._navigationForShape(radius, height);
    const id = this._nearestCell(point, walkable);
    if (id < 0) return new THREE.Vector3(point.x, this.ground(point.x, point.z), point.z);
    const candidate = this._pointOf(id);
    const floor = this.floorHeight(point.x, point.z);
    const own = this._cellOf(point);
    if (walkable[own.z * this.nav.width + own.x] && !this._blocked(point.x, point.z, floor, radius, height)) candidate.set(point.x, floor, point.z);
    return candidate;
  }

  isWalkable(x, z, radius = .34, height = 1.8) {
    const n = this.nav, point = {x, z}, cell = this._cellOf(point);
    if (!n.walkable[cell.z * n.width + cell.x]) return false;
    return !this._blocked(x, z, this.floorHeight(x, z), radius, height);
  }

  _clearWalk(a, b, radius = .35, actorHeight = 1.8) {
    const distance = Math.hypot(b.x - a.x, b.z - a.z);
    const samples = Math.max(1, Math.ceil(distance / .25));
    let lastHeight = this.floorHeight(a.x, a.z);
    for (let i = 1; i <= samples; i++) {
      const t = i / samples, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
      const height = this.floorHeight(x, z, lastHeight + .34);
      if (Math.abs(height - lastHeight) > .35 || this._blocked(x, z, height, radius, actorHeight)) return false;
      lastHeight = height;
    }
    return true;
  }

  /** A* with no diagonal corner cutting, followed by physically checked smoothing. */
  findPath(start, target, options = {}) {
    const radius = options.radius ?? .35, height = options.height ?? 1.8;
    const shape = this._navigationForShape(radius, height), {walkable} = shape;
    const sourceId = this._nearestCell(start, walkable), targetId = this._nearestCell(target, walkable);
    if (sourceId < 0 || targetId < 0) return [];
    const end = this.nearestWalkable(target, {radius, height});
    if (this._clearWalk(start, end, radius, height)) return [end];
    const n = this.nav, width = n.width;
    this._pathStamp = (this._pathStamp + 1) >>> 0;
    if (!this._pathStamp) { this._pathSeen.fill(0); this._pathClosed.fill(0); this._pathStamp = 1; }
    const stamp = this._pathStamp, heap = new MinHeap();
    const targetX = targetId % width, targetZ = Math.floor(targetId / width);
    const heuristic = id => Math.hypot(id % width - targetX, Math.floor(id / width) - targetZ);
    this._pathSeen[sourceId] = stamp; this._pathCost[sourceId] = 0; this._pathParent[sourceId] = -1;
    heap.push(sourceId, heuristic(sourceId));
    let found = false, iterations = 0;
    while (heap.length && iterations++ < n.walkable.length) {
      const {id} = heap.pop();
      if (this._pathClosed[id] === stamp) continue;
      this._pathClosed[id] = stamp;
      if (id === targetId) { found = true; break; }
      const x = id % width, z = Math.floor(id / width);
      const fromPoint = this._pointOf(id);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dz) || x + dx < 0 || x + dx >= width || z + dz < 0 || z + dz >= n.depth) continue;
        const next = id + dx + dz * width;
        if (!walkable[next] || this._pathClosed[next] === stamp || Math.abs(n.heights[next] - n.heights[id]) > .34) continue;
        if (dx && dz && (!walkable[id + dx] || !walkable[id + dz * width])) continue;
        const directionIndex = (dz + 1) * 3 + dx + 1, edgeBit = 1 << (directionIndex > 4 ? directionIndex - 1 : directionIndex);
        if (!(shape.testedEdges[id] & edgeBit)) {
          shape.testedEdges[id] |= edgeBit;
          if (this._clearWalk(fromPoint, this._pointOf(next), radius, height)) shape.clearEdges[id] |= edgeBit;
        }
        if (!(shape.clearEdges[id] & edgeBit)) continue;
        const cost = this._pathCost[id] + (dx && dz ? Math.SQRT2 : 1);
        if (this._pathSeen[next] === stamp && cost >= this._pathCost[next]) continue;
        this._pathSeen[next] = stamp; this._pathCost[next] = cost; this._pathParent[next] = id;
        heap.push(next, cost + heuristic(next));
      }
    }
    if (!found) return [];
    const raw = [];
    for (let id = targetId; id !== sourceId && id >= 0; id = this._pathParent[id]) raw.push(this._pointOf(id));
    raw.reverse();
    if (!raw.length) return [];
    raw[raw.length - 1] = end;
    const path = [];
    let current = start, index = 0;
    while (index < raw.length) {
      let best = index;
      // Limit lookahead to keep repeated bot replanning bounded.
      for (let i = Math.min(raw.length - 1, index + 18); i > index; i--) {
        if (this._clearWalk(current, raw[i], radius, height)) { best = i; break; }
      }
      // The first raw waypoint and the exact destination need the same check
      // as shortcuts; an unvalidated fallback can push a large body into a wall.
      if (!this._clearWalk(current, raw[best], radius, height)) return [];
      path.push(raw[best]); current = raw[best]; index = best + 1;
    }
    return path;
  }
}

export default PhysicsWorld;
