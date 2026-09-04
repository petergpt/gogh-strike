import * as THREE from 'three';

// The garment's vertex colours remain its pigment. These nearly neutral maps
// describe thread structure, never a painted highlight or a lighting direction.
const SIZE = 256;
const TAU = Math.PI * 2;
const textureCache = new Map();
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const FABRICS = {
  linen: { seed: 109, relief: 0.00075, contrast: 0.013, repeat: 6, sheen: 0.10, specular: 0.52 },
  wool: { seed: 227, relief: 0.00050, contrast: 0.008, repeat: 7, sheen: 0.18, specular: 0.42 },
  velvet: { seed: 347, relief: 0.00018, contrast: 0.004, repeat: 6, sheen: 0.32, specular: 0.32 },
  tweed: { seed: 461, relief: 0.00080, contrast: 0.016, repeat: 5, sheen: 0.17, specular: 0.44 },
  cotton: { seed: 593, relief: 0.00040, contrast: 0.009, repeat: 8, sheen: 0.08, specular: 0.48 },
};
const BUTTON_COLOURS = { brass: '#a39162', horn: '#514638', pewter: '#969a99' };

function settingsFor(look = {}) {
  const input = look.tailoring || {};
  const numeric = (key, fallback, low, high) => {
    const value = Number(input[key]);
    return Number.isFinite(value) ? clamp(value, low, high) : fallback;
  };
  return {
    fabric: Object.hasOwn(FABRICS, input.fabric) ? input.fabric : 'wool',
    weave: numeric('weave', 0.45, 0.2, 1),
    roughness: numeric('roughness', 0.86, 0.65, 0.95),
    wear: numeric('wear', 0.25, 0.1, 0.6),
    foldScale: numeric('foldScale', 1, 0.6, 1.4),
    buttonMetal: Object.hasOwn(BUTTON_COLOURS, input.buttonMetal) ? input.buttonMetal : 'horn',
    seamContrast: numeric('seamContrast', 0.75, 0.5, 1.2),
  };
}

function hash(x, y, seed) {
  let n = Math.imul(x ^ seed, 374761393) ^ Math.imul(y + seed, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

// Integer cell counts and wrapped lattice points keep every mip level tileable.
function periodicNoise(u, v, cells, seed) {
  const x = u * cells, y = v * cells;
  const ix = Math.floor(x), iy = Math.floor(y);
  const tx = x - ix, ty = y - iy;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const at = (a, b) => hash((a + cells) % cells, (b + cells) % cells, seed);
  return lerp(lerp(at(ix, iy), at(ix + 1, iy), sx),
    lerp(at(ix, iy + 1), at(ix + 1, iy + 1), sx), sy) * 2 - 1;
}

function newCanvas() {
  if (typeof document !== 'undefined' && document.createElement) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    return canvas;
  }
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(SIZE, SIZE);
  return null;
}

function makeTexture(canvas, name, repeat, colour = false) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = name;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  // Individual actors own their material, but must not dispose these textures.
  texture.userData.characterShared = true;
  return texture;
}

function fabricTextures(settings) {
  const { fabric, weave, wear, foldScale } = settings;
  const key = JSON.stringify([fabric, weave, wear, foldScale]);
  if (textureCache.has(key)) return textureCache.get(key);
  const canvases = [newCanvas(), newCanvas(), newCanvas()];
  if (canvases.some(canvas => !canvas)) return null;
  const contexts = canvases.map(canvas => canvas.getContext('2d'));
  if (contexts.some(context => !context)) return null;
  const pixels = contexts.map(context => context.createImageData(SIZE, SIZE));
  const recipe = FABRICS[fabric];
  const seed = recipe.seed;
  const coarseCells = Math.max(3, Math.round(6 / foldScale));

  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const u = x / SIZE, v = y / SIZE;
    const fine = periodicNoise(u, v, 64, seed);
    const nap = periodicNoise(u, v, 24, seed + 7);
    const soft = periodicNoise(u, v, coarseCells, seed + 19);
    // Every thread has some long-axis irregularity; nothing is pixel-white noise.
    const warp = Math.cos(TAU * (u * 48 + 0.035 * Math.sin(v * TAU * 4)));
    const weft = Math.cos(TAU * (v * 48 + 0.035 * Math.sin(u * TAU * 5)));
    let structure;
    if (fabric === 'linen') {
      const slub = Math.sin(u * TAU * 12) * Math.sin(v * TAU * 3);
      structure = warp * 0.30 + weft * 0.28 + fine * 0.15 + slub * 0.12 + nap * 0.15;
    } else if (fabric === 'cotton') {
      structure = warp * 0.34 + weft * 0.34 + fine * 0.18 + nap * 0.14;
    } else if (fabric === 'tweed') {
      // A continuous triangular phase makes the twill reverse into herringbone.
      const chevron = Math.abs(((u * 8) % 1) * 2 - 1);
      const twill = Math.cos(TAU * (v * 48 + chevron * 2));
      structure = twill * 0.52 + fine * 0.16 + warp * 0.10 + nap * 0.22;
    } else if (fabric === 'velvet') {
      const direction = Math.sin(v * TAU * 32 + Math.sin(u * TAU * 4) * 0.3);
      structure = direction * 0.14 + nap * 0.47 + fine * 0.12 + soft * 0.27;
    } else {
      structure = nap * 0.53 + fine * 0.27 + warp * weft * 0.12 + soft * 0.08;
    }

    const contrast = recipe.contrast * lerp(0.55, 1, weave);
    const wornFibre = Math.max(0, soft - 0.20) * wear;
    const pigment = clamp(0.982 + structure * contrast + wornFibre * 0.009, 0.955, 0.998);
    const height = clamp(0.5 + structure * lerp(0.065, 0.14, weave) + soft * 0.018, 0.27, 0.73);
    // Wear changes how fibres catch light more than it bleaches their pigment.
    // Smooth, low-contrast variation avoids a grainy surface at portrait scale.
    const roughness = clamp(0.960 + nap * 0.029 + soft * 0.012 - wornFibre * 0.022, 0.91, 1);
    const offset = (y * SIZE + x) * 4;
    for (let channel = 0; channel < 3; channel++) {
      pixels[0].data[offset + channel] = Math.round(pigment * 255);
      pixels[1].data[offset + channel] = Math.round(height * 255);
      pixels[2].data[offset + channel] = Math.round(roughness * 255);
    }
    for (const buffer of pixels) buffer.data[offset + 3] = 255;
  }

  contexts.forEach((context, index) => context.putImageData(pixels[index], 0, 0));
  // Fine fibres disappear through mip filtering at gameplay distance instead of
  // sparkling. Large folds are supplied by the body geometry, not tiled stripes.
  const repeat = Math.round(recipe.repeat + (1 - weave) * 3);
  const textures = {
    map: makeTexture(canvases[0], `character ${fabric} pigment`, repeat, true),
    bumpMap: makeTexture(canvases[1], `character ${fabric} thread relief`, repeat),
    roughnessMap: makeTexture(canvases[2], `character ${fabric} fibre roughness`, repeat),
  };
  textureCache.set(key, textures);
  return textures;
}

/**
 * One independently disposable material per actor; its tiny fabric maps are
 * shared by equivalent tailoring settings. UVs must be retained on the body.
 */
export function characterClothMaterial(look = {}) {
  const settings = settingsFor(look);
  const textures = fabricTextures(settings);
  const recipe = FABRICS[settings.fabric];
  const material = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    color: '#ffffff',
    roughness: settings.roughness,
    metalness: 0,
    flatShading: false,
    // Broad, pigment-coloured fibre reflection preserves rich fabric colour;
    // reducing the white dielectric lobe keeps dark wool from reading as chalk.
    sheen: recipe.sheen,
    sheenColor: '#ffffff',
    sheenRoughness: settings.fabric === 'velvet' ? 0.74 : 0.90,
    specularIntensity: 1,
    ...(textures || {}),
    bumpScale: FABRICS[settings.fabric].relief * lerp(0.55, 1, settings.weave)
      * lerp(0.9, 1.1, (settings.foldScale - 0.6) / 0.8),
  });
  material.name = `character ${settings.fabric} cloth`;
  material.userData.characterFabric = settings.fabric;
  material.userData.characterSurface = {cloth: 0, leather: 0.5, skin: 1};
  // Sculpture supplies one scalar per vertex, retaining the existing merged
  // draw calls. Old/standalone geometry without the attribute remains cloth.
  material.defaultAttributeValues = {color: [1, 1, 1], uv: [0, 0], aSurface: [0]};
  material.customProgramCacheKey = () => 'artist-surface-response-v1';
  material.onBeforeCompile = shader => {
    shader.uniforms.uClothSpecular = {value: recipe.specular};
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aSurface;\nvarying float vCharacterSurface;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCharacterSurface = aSurface;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vCharacterSurface;\nuniform float uClothSpecular;')
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        float characterLeather = smoothstep(0.25, 0.40, vCharacterSurface)
          * (1.0 - smoothstep(0.60, 0.75, vCharacterSurface));
        float characterSkin = smoothstep(0.75, 0.90, vCharacterSurface);
        float characterCloth = 1.0 - max(characterLeather, characterSkin);
        roughnessFactor = mix(roughnessFactor, 0.53, characterLeather);
        roughnessFactor = mix(roughnessFactor, 0.66, characterSkin);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        // Woven bump belongs to cloth, not to exposed hands or smooth leather.
        normal = normalize(mix(nonPerturbedNormal, normal, characterCloth));`)
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
        float characterSpecular = uClothSpecular * characterCloth
          + 0.78 * characterLeather + 0.58 * characterSkin;
        material.specularColor *= characterSpecular;
        material.specularF90 *= characterSpecular;
        #ifdef USE_SHEEN
          material.sheenColor *= diffuseColor.rgb * characterCloth;
        #endif`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        // The town's broad sky fill suits painted buildings, but buries the
        // figure's modelling. Preserve direct lights and soften only fill.
        reflectedLight.indirectDiffuse *= 0.72;
        reflectedLight.indirectSpecular *= 0.65;
        #ifdef USE_SHEEN
          sheenSpecularIndirect *= 0.65;
        #endif`);
  };
  return material;
}

function pigment(value, scale) {
  return new THREE.Color(value?.isColor ? value : value || '#696253').multiplyScalar(scale);
}

// Intersect the real unwarped Sculpture surface along -Z, rather than guessing
// a fixed depth that would float off a round chest, lapel or narrower waist.
function frontSurface(sculpture) {
  const triangles = [];
  for (const geometry of sculpture.pieces || []) {
    const positions = geometry.getAttribute('position');
    if (!positions) continue;
    const indices = geometry.getIndex();
    const count = indices ? indices.count : positions.count;
    for (let i = 0; i + 2 < count; i += 3) {
      const ids = indices ? [indices.getX(i), indices.getX(i + 1), indices.getX(i + 2)] : [i, i + 1, i + 2];
      const [a, b, c] = ids.map(index => new THREE.Vector3().fromBufferAttribute(positions, index));
      if (Math.max(a.y, b.y, c.y) < 0.065 || Math.min(a.y, b.y, c.y) > 0.545) continue;
      const denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
      if (Math.abs(denominator) < 1e-10) continue;
      triangles.push({ a, b, c, denominator,
        minX: Math.min(a.x, b.x, c.x), maxX: Math.max(a.x, b.x, c.x),
        minY: Math.min(a.y, b.y, c.y), maxY: Math.max(a.y, b.y, c.y) });
    }
  }
  return (x, y) => {
    let z = Infinity;
    for (const triangle of triangles) {
      if (x < triangle.minX || x > triangle.maxX || y < triangle.minY || y > triangle.maxY) continue;
      const { a, b, c, denominator } = triangle;
      const wa = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / denominator;
      const wb = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / denominator;
      const wc = 1 - wa - wb;
      if (wa >= -1e-6 && wb >= -1e-6 && wc >= -1e-6) z = Math.min(z, wa * a.z + wb * b.z + wc * c.z);
    }
    return Number.isFinite(z) ? z : null;
  };
}

/**
 * Add to the existing torso Sculpture after collar/lapels, before apron/straps,
 * and before shapeTorso. Replaces the previous generic buttons/pocket boxes.
 * All samples share the later chest/belly/waist warp with the cloth surface.
 */
export function applyTailoring(sculpture, look = {}, palette = {}) {
  const settings = settingsFor(look);
  const surface = frontSurface(sculpture);
  const coat = palette.coat || look.coatColor || '#696253';
  const stitch = pigment(coat, 1 - 0.10 * settings.seamContrast);
  const welt = pigment(coat, 1 + 0.018 * settings.seamContrast);
  const radius = 0.00085 + settings.seamContrast * 0.00025;
  const coatType = look.coat || 'short';
  const hasCover = ['apron', 'shawl', 'capelet'].includes(look.accessory);

  const curve = (points, thickness = radius, colour = stitch, samples = 8) => {
    const path = new THREE.CatmullRomCurve3(points.map(([x, y]) => new THREE.Vector3(x, y, 0)));
    let previous = null;
    for (let i = 0; i <= samples; i++) {
      const point = path.getPoint(i / samples), z = surface(point.x, point.y);
      if (z === null) { previous = null; continue; }
      // The rear half of each thread sits within the surface, like real piping.
      point.z = z - thickness * 0.42;
      if (previous && previous.distanceToSquared(point) < 0.0025) sculpture.line(previous, point, thickness, colour);
      previous = point;
    }
  };

  if (coatType !== 'cape' && coatType !== 'sailor') {
    for (const side of [-1, 1]) curve([
      [side * 0.198, 0.468], [side * 0.168, 0.408],
      [side * 0.147, 0.313], [side * 0.143, 0.205],
    ], radius, stitch, 10);
  }

  if (!hasCover && !['cape', 'sailor', 'highcollar'].includes(coatType)) {
    const vest = coatType === 'vest';
    const pocketY = vest ? 0.265 : 0.312;
    const pocketWidth = vest ? 0.055 : 0.065;
    const pocketX = -0.098;
    const bend = 0.0025 * settings.foldScale;
    curve([[pocketX - pocketWidth / 2, pocketY], [pocketX, pocketY - bend],
      [pocketX + pocketWidth / 2, pocketY + 0.001]], radius * 1.45, welt, 6);
    for (const side of [-1, 1]) {
      const x = pocketX + side * pocketWidth / 2;
      curve([[x, pocketY - 0.0035], [x, pocketY + 0.0035]], radius * 0.8, stitch, 1);
    }
  }

  const button = (x, y, size = 0.006) => {
    const z = surface(x, y);
    if (z === null) return;
    // All hardware remains matte within the single merged cloth draw call.
    // buttonMetal chooses muted brass/pewter/horn pigment, not global metalness.
    const hardware = pigment(BUTTON_COLOURS[settings.buttonMetal], 1 - settings.wear * 0.12);
    sculpture.oval(x, y, z - 0.0012, size, size, 0.0024, hardware);
    if (settings.buttonMetal === 'horn') {
      sculpture.line(new THREE.Vector3(x - 0.0015, y, z - 0.0035),
        new THREE.Vector3(x + 0.0015, y, z - 0.0035), 0.00065, stitch);
    } else {
      sculpture.oval(x, y, z - 0.0030, size * 0.45, size * 0.45, 0.00045,
        pigment(BUTTON_COLOURS[settings.buttonMetal], 0.77));
    }
  };

  if (coatType === 'cape' || coatType === 'highcollar') {
    button(0.012, 0.472, 0.0075);
  } else if (coatType !== 'sailor' && !hasCover) {
    const positions = coatType === 'vest' ? [0.148, 0.204, 0.260, 0.316]
      : coatType === 'smock' ? [0.365, 0.412] : [0.174, 0.248, 0.322];
    for (const y of positions) for (const x of coatType === 'doublebreast' ? [-0.056, 0.056] : [0.012]) button(x, y);
  }
  return sculpture;
}
