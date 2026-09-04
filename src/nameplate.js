import * as THREE from 'three';

const RESOLUTION = 3;
const HEIGHT = 25;
const FONT = '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const COLORS = {friendly: '#8be5b5', enemy: '#ff9185'};

function drawNameplate(data) {
  const {canvas, context: ctx, logicalWidth: width, friendly} = data;
  ctx.setTransform(RESOLUTION, 0, 0, RESOLUTION, 0, 0);
  ctx.clearRect(0, 0, width, HEIGHT);
  ctx.beginPath();
  ctx.roundRect(.5, .5, width - 1, HEIGHT - 1, 5);
  ctx.fillStyle = 'rgba(9, 25, 32, .84)';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(230, 241, 228, .24)';
  ctx.stroke();

  ctx.fillStyle = friendly ? COLORS.friendly : COLORS.enemy;
  ctx.beginPath();
  const points = friendly
    ? [[9, 10], [13.5, 13.2], [18, 10], [18, 13], [13.5, 16.2], [9, 13]]
    : [[13.5, 7.5], [18, 12.5], [13.5, 17.5], [9, 12.5]];
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
  ctx.fill();

  ctx.font = FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f1f2e8';
  ctx.fillText(data.name, 26, HEIGHT / 2 + .3);
  if (data.texture) data.texture.needsUpdate = true;
  data.redraws += 1;
}

export function createNameplate(name) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const label = String(name || 'Artist').trim().replace(/\s+/g, ' ');
  context.font = FONT;
  const logicalWidth = Math.ceil(context.measureText(label).width) + 37;
  canvas.width = logicalWidth * RESOLUTION;
  canvas.height = HEIGHT * RESOLUTION;

  const data = {
    name: label, canvas, context, logicalWidth, logicalHeight: HEIGHT,
    friendly: true, opacity: 0, requested: false, redraws: 0,
    worldPerPixel: 0, pixelScale: 1, anchor: new THREE.Vector3(),
  };
  drawNameplate(data);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  data.texture = texture;

  const material = new THREE.SpriteMaterial({
    map: texture, transparent: true, opacity: 0,
    toneMapped: false, depthTest: true, depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.name = `${label} nameplate`;
  sprite.center.set(.5, 0);
  sprite.visible = false;
  sprite.userData.nameplate = data;
  return sprite;
}

export function setNameplateRelation(sprite, friendly) {
  const data = sprite.userData.nameplate;
  const next = Boolean(friendly);
  if (data.friendly === next) return false;
  data.friendly = next;
  drawNameplate(data);
  return true;
}

export function updateNameplate(sprite, {
  camera, viewportHeight = 720, headHeight = 1.95,
  visible = false, focused = false, dt = 0,
} = {}) {
  const data = sprite.userData.nameplate;
  data.requested = Boolean(visible && focused);
  if (!visible || !camera) {
    data.opacity = 0;
    sprite.material.opacity = 0;
    sprite.visible = false;
    return;
  }

  const height = Math.max(1, Number.isFinite(viewportHeight) ? viewportHeight : 720);
  data.pixelScale = THREE.MathUtils.clamp(height / 420, .8, 1);
  sprite.position.set(0, Number.isFinite(headHeight) ? headHeight : 1.95, 0);
  camera.updateMatrixWorld();
  sprite.parent?.updateWorldMatrix(true, false);
  data.anchor.copy(sprite.position);
  if (sprite.parent) data.anchor.applyMatrix4(sprite.parent.matrixWorld);
  data.anchor.applyMatrix4(camera.matrixWorldInverse);
  const depth = -data.anchor.z;
  if (depth <= camera.near || !Number.isFinite(depth)) {
    data.opacity = 0;
    data.requested = false;
    sprite.material.opacity = 0;
    sprite.visible = false;
    return;
  }

  // Camera-space depth preserves text size even at the edges of the view.
  // The projection matrix includes both FOV changes and camera zoom.
  const worldPerPixel = 2 * depth / (camera.projectionMatrix.elements[5] * height);
  sprite.position.y += 8 * worldPerPixel * data.pixelScale;
  data.anchor.copy(sprite.position);
  if (sprite.parent) data.anchor.applyMatrix4(sprite.parent.matrixWorld);
  data.anchor.applyMatrix4(camera.matrixWorldInverse);
  data.worldPerPixel = -2 * data.anchor.z / (camera.projectionMatrix.elements[5] * height);
  sprite.scale.set(
    data.logicalWidth * data.worldPerPixel * data.pixelScale,
    data.logicalHeight * data.worldPerPixel * data.pixelScale,
    1,
  );

  const target = data.requested ? 1 : 0;
  const elapsed = THREE.MathUtils.clamp(Number.isFinite(dt) ? dt : 0, 0, .1);
  const fadeSeconds = target ? .09 : .13;
  data.opacity += (target - data.opacity) * (1 - Math.exp(-elapsed / fadeSeconds));
  if (Math.abs(target - data.opacity) < .004) data.opacity = target;
  sprite.material.opacity = data.opacity;
  sprite.visible = data.opacity > .004;
}
