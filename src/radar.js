const TEAM_COLOURS = ['#f1ca63', '#70cbed'];
const NEUTRAL = '#dfd8ba';
const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function position(value) {
  if (!value) return null;
  const source = value.position ?? value;
  const x = source.x ?? source[0];
  const z = source.z ?? (source.length > 2 ? source[2] : source[1]);
  return Number.isFinite(x) && Number.isFinite(z) ? {x, z} : null;
}

function team(value) {
  return value === 0 || value === '0' ? 0 : value === 1 || value === '1' ? 1 : null;
}

function validBounds(bounds) {
  return bounds && ['minX', 'maxX', 'minZ', 'maxZ'].every(key => Number.isFinite(bounds[key])) &&
    bounds.maxX > bounds.minX && bounds.maxZ > bounds.minZ;
}

/**
 * North-up, player-centred radar made only from the supplied world geometry.
 *
 * new TacticalRadar(canvasOrContainer, {range: 34})
 * radar.update({bounds, walls, markers, objectives, yaw}, player)
 *
 * Positions accept {x,z}, {position: Vector3}, [x,z], or [x,y,z].
 * Walls are {a, b}; keep the array stable, or increment radar.mapRevision when
 * editing it in place. Offscreen allies/objectives remain visible at the rim.
 * Opponents require observed === true, including after a player death.
 */
export class TacticalRadar {
  constructor(target, options = {}) {
    if (!target) throw new TypeError('TacticalRadar needs a canvas or container.');
    this.document = target.ownerDocument || document;
    this.ownsCanvas = typeof target.getContext !== 'function';
    this.canvas = this.ownsCanvas ? this.document.createElement('canvas') : target;
    if (this.ownsCanvas) {
      this.canvas.style.width = '100%';
      this.canvas.style.height = '100%';
      this.canvas.style.display = 'block';
      target.appendChild(this.canvas);
    }
    this.context = this.canvas.getContext('2d', {alpha: true});
    this.range = clamp(Number(options.range) || 34, 12, 100);
    this.defaultSize = Math.max(64, Number(options.size) || 142);
    this.width = this.defaultSize;
    this.height = this.defaultSize;
    this.dpr = 1;
    this.destroyed = false;
    this.state = null;
    this.map = null;
    this.canvas.hidden = true;
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', 'Tactical radar. North is up. Allies are circles; spotted opponents are diamonds.');
    this.onResize = () => this.resize();
    const view = this.document.defaultView;
    this.view = view;
    if (view?.ResizeObserver) {
      this.observer = new view.ResizeObserver(this.onResize);
      this.observer.observe(this.ownsCanvas ? target : this.canvas);
    }
    view?.addEventListener('resize', this.onResize);
    this.resize();
  }

  resize(width, height) {
    if (this.destroyed || !this.context) return;
    const box = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, width || box.width || this.width);
    this.height = Math.max(1, height || box.height || this.height);
    this.dpr = clamp(this.view?.devicePixelRatio || 1, 1, 2);
    const pixelsX = Math.round(this.width * this.dpr);
    const pixelsY = Math.round(this.height * this.dpr);
    if (this.canvas.width !== pixelsX || this.canvas.height !== pixelsY) {
      this.canvas.width = pixelsX;
      this.canvas.height = pixelsY;
    }
    if (this.state && !this.canvas.hidden) this.draw();
  }

  update(radar, player) {
    if (this.destroyed || !this.context) return;
    if (!radar || !validBounds(radar.bounds)) {
      this.state = null;
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.canvas.hidden = true;
      return;
    }
    this.canvas.hidden = false;
    this.state = {radar, player};
    this.cacheMap(radar);
    this.resize();
  }

  cacheMap(radar) {
    const bounds = radar.bounds;
    const walls = Array.isArray(radar.walls) ? radar.walls : EMPTY;
    const key = `${bounds.minX},${bounds.maxX},${bounds.minZ},${bounds.maxZ},${radar.mapRevision ?? ''}`;
    if (this.map?.walls === walls && this.map.key === key && this.map.count === walls.length) return;
    const extentX = bounds.maxX - bounds.minX;
    const extentZ = bounds.maxZ - bounds.minZ;
    const scale = Math.min(4, 2040 / Math.max(extentX, extentZ));
    const padding = 4;
    const canvas = this.map?.canvas || this.document.createElement('canvas');
    canvas.width = Math.ceil(extentX * scale) + padding * 2;
    canvas.height = Math.ceil(extentZ * scale) + padding * 2;
    const context = canvas.getContext('2d');
    if (!context) { this.map = null; return; }
    const originX = bounds.minX - padding / scale;
    const originZ = bounds.minZ - padding / scale;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.beginPath();
    for (const wall of walls) {
      const a = position(wall?.a), b = position(wall?.b);
      if (!a || !b) continue;
      context.moveTo((a.x - originX) * scale, (a.z - originZ) * scale);
      context.lineTo((b.x - originX) * scale, (b.z - originZ) * scale);
    }
    context.strokeStyle = 'rgba(11, 20, 25, .85)';
    context.lineWidth = 6;
    context.stroke();
    context.strokeStyle = '#b8bb9c';
    context.lineWidth = 2.7;
    context.stroke();
    this.map = {canvas, walls, count: walls.length, key, scale, originX, originZ};
  }

  draw() {
    if (!this.state || this.destroyed) return;
    const {radar, player} = this.state;
    const ctx = this.context;
    const markers = Array.isArray(radar.markers) ? radar.markers : EMPTY;
    const playerMarker = markers.find(marker => marker?.isPlayer === true ||
      (player?.id != null && marker?.id === player.id));
    const localPosition = position(player) || position(playerMarker);
    const localTeam = team(player?.team) ?? team(playerMarker?.team);
    const bounds = radar.bounds;
    const centre = localPosition || {
      x: (bounds.minX + bounds.maxX) / 2,
      z: (bounds.minZ + bounds.maxZ) / 2,
    };
    const cx = this.width / 2, cy = this.height / 2;
    const radius = Math.max(1, Math.min(this.width, this.height) / 2 - 3);
    const range = localPosition ? this.range : Math.hypot(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) / 2;
    const scale = (radius - 9) / range;
    this.projection = {cx, cy, radius, range, scale, centre};
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, TAU);
    ctx.clip();
    const background = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    background.addColorStop(0, '#213944');
    background.addColorStop(1, '#0d1c25');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, this.width, this.height);

    // World-aligned measurement grid. The buildings always come from the map.
    ctx.strokeStyle = 'rgba(192, 208, 191, .065)';
    ctx.lineWidth = .6;
    ctx.beginPath();
    const gridSize = range > 60 ? 20 : 10;
    for (let x = Math.ceil((centre.x - range * 1.2) / gridSize) * gridSize; x < centre.x + range * 1.2; x += gridSize) {
      const screenX = cx + (x - centre.x) * scale;
      ctx.moveTo(screenX, cy - radius); ctx.lineTo(screenX, cy + radius);
    }
    for (let z = Math.ceil((centre.z - range * 1.2) / gridSize) * gridSize; z < centre.z + range * 1.2; z += gridSize) {
      const screenY = cy + (z - centre.z) * scale;
      ctx.moveTo(cx - radius, screenY); ctx.lineTo(cx + radius, screenY);
    }
    ctx.stroke();
    if (this.map) {
      const map = this.map;
      ctx.drawImage(map.canvas,
        cx + (map.originX - centre.x) * scale,
        cy + (map.originZ - centre.z) * scale,
        map.canvas.width / map.scale * scale,
        map.canvas.height / map.scale * scale);
    }
    ctx.strokeStyle = 'rgba(218, 222, 198, .1)';
    ctx.lineWidth = .7;
    ctx.beginPath();
    ctx.arc(cx, cy, (radius - 9) * .5, 0, TAU);
    ctx.stroke();

    for (const objective of radar.objectives || EMPTY) this.drawObjective(objective);
    for (const marker of markers) {
      if (!marker || marker.alive === false || marker === playerMarker || marker.isPlayer) continue;
      const friendly = localTeam !== null && team(marker.team) === localTeam;
      // Never infer visibility from the presence of an enemy in the actor list.
      if (!friendly && marker.observed !== true) continue;
      this.drawActor(marker, friendly);
    }
    if (localPosition) {
      const yaw = Number.isFinite(radar.yaw) ? radar.yaw : Number.isFinite(player?.yaw) ? player.yaw : 0;
      const alive = player?.alive !== false && playerMarker?.alive !== false;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-yaw);
      if (alive) {
        const cone = ctx.createRadialGradient(0, 0, 2, 0, 0, radius * .64);
        cone.addColorStop(0, 'rgba(245, 236, 201, .13)');
        cone.addColorStop(1, 'rgba(245, 236, 201, 0)');
        ctx.fillStyle = cone;
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius * .64, -Math.PI / 2 - .46, -Math.PI / 2 + .46);
        ctx.closePath(); ctx.fill();
      }
      ctx.beginPath();
      ctx.moveTo(0, -7); ctx.lineTo(4.8, 5); ctx.lineTo(0, 2.5); ctx.lineTo(-4.8, 5); ctx.closePath();
      ctx.fillStyle = alive ? '#fff8dd' : '#78909a';
      ctx.strokeStyle = '#0a1820'; ctx.lineWidth = 2.3;
      ctx.stroke(); ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // Fine painted rim; cardinal ticks keep the north-up orientation legible.
    ctx.strokeStyle = 'rgba(237, 214, 144, .4)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(242, 225, 173, .7)';
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI / 2;
      ctx.moveTo(cx + Math.sin(angle) * (radius - 3), cy - Math.cos(angle) * (radius - 3));
      ctx.lineTo(cx + Math.sin(angle) * radius, cy - Math.cos(angle) * radius);
    }
    ctx.stroke();
  }

  project(value, inset = 9) {
    const point = position(value);
    if (!point) return null;
    const {cx, cy, radius, scale, centre} = this.projection;
    let x = (point.x - centre.x) * scale, y = (point.z - centre.z) * scale;
    const distance = Math.hypot(x, y), edge = distance > radius - inset;
    if (edge && distance > 0) {
      const factor = Math.max(0, radius - inset) / distance;
      x *= factor; y *= factor;
    }
    return {x: cx + x, y: cy + y, edge, angle: Math.atan2(y, x)};
  }

  drawActor(marker, friendly) {
    const point = this.project(marker, 7);
    if (!point) return;
    const ctx = this.context;
    const colour = TEAM_COLOURS[team(marker.team)] || NEUTRAL;
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.fillStyle = colour;
    ctx.strokeStyle = '#10222c';
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    if (point.edge) {
      ctx.rotate(point.angle);
      ctx.moveTo(3.3, 0); ctx.lineTo(-2.8, -2.6); ctx.lineTo(-2.8, 2.6); ctx.closePath();
    } else if (friendly) {
      ctx.arc(0, 0, 3.1, 0, TAU);
    } else {
      ctx.moveTo(0, -4); ctx.lineTo(3.8, 0); ctx.lineTo(0, 4); ctx.lineTo(-3.8, 0); ctx.closePath();
    }
    ctx.stroke(); ctx.fill();
    if (!friendly && !point.edge) {
      ctx.fillStyle = '#10222c'; ctx.fillRect(-.8, -.8, 1.6, 1.6);
    }
    ctx.restore();
  }

  drawObjective(objective) {
    const point = this.project(objective, 12);
    if (!point) return;
    const ctx = this.context;
    const owner = team(objective.owner);
    const colour = owner === null ? NEUTRAL : TEAM_COLOURS[owner];
    const size = point.edge ? 6 : 7.5;
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.fillStyle = '#132831';
    ctx.strokeStyle = colour;
    ctx.lineWidth = objective.contested ? 2 : 1.2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = i * TAU / 6 - Math.PI / 2;
      const x = Math.cos(angle) * size, y = Math.sin(angle) * size;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = colour;
    ctx.font = `700 ${point.edge ? 7 : 8}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(objective.label ?? objective.id ?? '').slice(0, 1).toUpperCase(), 0, .5);
    ctx.restore();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.observer?.disconnect();
    this.view?.removeEventListener('resize', this.onResize);
    this.context?.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.canvas.hidden = true;
    if (this.ownsCanvas) this.canvas.remove();
    this.state = null;
    this.map = null;
  }
}

const EMPTY = Object.freeze([]);
