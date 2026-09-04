import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createActorModel} from './actors.js';
import {FACTIONS} from './factions.js';

const MODES = Object.freeze({face: 'Face', full: 'Full body', walk: 'Walk', crouch: 'Crouch'});
const clamp = THREE.MathUtils.clamp;
let nextInspectorId = 0;

function loadStyles() {
  const href = new URL('./character-inspector.css', import.meta.url).href;
  if ([...document.querySelectorAll('link[rel="stylesheet"]')].some(link => link.href === href)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.append(link);
}

/** Optional, isolated studio. Nothing is mounted or rendered until open(). */
export function createCharacterInspector({onClose} = {}) {
  loadStyles();
  const roster = FACTIONS.flatMap(faction => faction.roster.map(member => ({faction, member})));
  const id = `character-inspector-${++nextInspectorId}`;
  const dialog = document.createElement('dialog');
  dialog.className = 'ci-dialog';
  dialog.setAttribute('aria-labelledby', `${id}-name`);
  dialog.setAttribute('aria-describedby', `${id}-silhouette`);
  dialog.innerHTML = `
    <div class="ci-shell">
      <header class="ci-header">
        <div class="ci-heading">
          <p class="ci-eyebrow">THE ARTISTS <span class="ci-count"></span></p>
          <h2 id="${id}-name"></h2>
          <p class="ci-age"></p>
        </div>
        <div class="ci-artist-nav" aria-label="Browse artists">
          <button class="ci-icon-button ci-previous" type="button" aria-label="Previous artist" title="Previous artist">‹</button>
          <button class="ci-icon-button ci-next" type="button" aria-label="Next artist" title="Next artist">›</button>
        </div>
        <button class="ci-icon-button ci-close" type="button" aria-label="Close character studio" title="Close · Esc">×</button>
      </header>
      <div class="ci-stage">
        <button class="ci-reset" type="button" title="Return to the three-quarter view">↺ <span>Reset view</span></button>
        <p class="ci-status" role="status">Opening the studio…</p>
        <p class="ci-stage-hint" aria-hidden="true">Drag to rotate <span>·</span> Scroll to zoom</p>
      </div>
      <footer class="ci-footer">
        <div class="ci-modes" role="group" aria-label="Character view">
          ${Object.entries(MODES).map(([mode, label]) => `<button type="button" data-mode="${mode}" aria-pressed="${mode === 'face'}">${label}</button>`).join('')}
        </div>
        <p class="ci-silhouette" id="${id}-silhouette"></p>
      </footer>
    </div>`;

  const query = selector => dialog.querySelector(selector);
  const stage = query('.ci-stage');
  const nameLabel = query('h2');
  const ageLabel = query('.ci-age');
  const countLabel = query('.ci-count');
  const silhouetteLabel = query('.ci-silhouette');
  const closeButton = query('.ci-close');
  const statusLabel = query('.ci-status');
  const listeners = new AbortController();
  const signal = listeners.signal;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let selectedIndex = 0;
  let mode = 'face';
  let renderer, scene, camera, model, environmentTarget, observer;
  let studioObjects = [];
  let animationFrame = 0, lastTime = 0, elapsed = 0, renderedFrames = 0;
  let previousFocus, disposed = false, errorMessage = '', dragging = null;
  let azimuth = -0.36, elevation = 0.045, zoom = 1;
  const target = new THREE.Vector3();
  const headBounds = new THREE.Box3();
  const headSize = new THREE.Vector3();
  const figureBounds = new THREE.Box3();
  const partBounds = new THREE.Box3();
  const figureSize = new THREE.Vector3();
  const actor = {
    position: new THREE.Vector3(), velocity: new THREE.Vector3(), yaw: 0, pitch: 0,
    alive: true, crouched: false, grounded: true, ads: false, aiming: false,
    ammo: 30, reloadUntil: 0, protectedUntil: 0, lastShotAt: -Infinity,
    lastDamageAt: -Infinity, lastSprayAt: -Infinity, sprayUntil: 0,
    tauntStarted: -Infinity, tauntUntil: 0,
  };

  function current() { return roster[selectedIndex]; }

  function resolveIndex(selection) {
    if (Number.isInteger(selection)) return ((selection % roster.length) + roster.length) % roster.length;
    if (typeof selection === 'string') {
      const value = selection.toLowerCase();
      return roster.findIndex(({faction, member}) => [member.design?.id, member.name, member.shortName, `${faction.id}-${member.role}`].some(key => key?.toLowerCase() === value));
    }
    if (selection && typeof selection === 'object') {
      return roster.findIndex(({faction, member}) => faction.id === Number(selection.team ?? current()?.faction.id ?? 0) && member.role === (selection.role ?? current()?.member.role));
    }
    return selectedIndex;
  }

  function updateLabels() {
    const {faction, member} = current();
    nameLabel.textContent = member.name;
    ageLabel.textContent = `${member.age1888} years old · 1888`;
    countLabel.textContent = `${String(selectedIndex + 1).padStart(2, '0')} / ${roster.length}`;
    silhouetteLabel.textContent = member.design?.silhouette || member.design?.signature?.join(' · ') || member.epithet;
    dialog.style.setProperty('--ci-accent', faction.color);
    if (renderer) renderer.domElement.setAttribute('aria-label', `${member.name}, ${MODES[mode]} view. Drag or use arrow keys to rotate; plus and minus to zoom; Home to reset.`);
    query('.ci-previous').title = `Previous: ${roster[(selectedIndex + roster.length - 1) % roster.length].member.shortName}`;
    query('.ci-next').title = `Next: ${roster[(selectedIndex + 1) % roster.length].member.shortName}`;
  }

  function hideGameLabels() {
    if (!model) return;
    if (model.marker) model.marker.visible = false;
    if (model.shadow) model.shadow.visible = false;
    model.setIndicator?.({visible: false});
  }

  function releaseModel() {
    // The actor owns its clone and knows which materials/textures are shared.
    // A generic traversal disposer here would damage the live game's cache.
    model?.dispose();
    model = null;
  }

  function buildModel() {
    releaseModel();
    const {faction, member} = current();
    actor.position.set(0, 0, 0);
    actor.velocity.set(0, 0, 0);
    actor.team = faction.id;
    actor.role = member.role;
    actor.artistName = member.name;
    actor.identity = member;
    actor.crouched = mode === 'crouch';
    model = createActorModel(scene, {team: faction.id, color: faction.color, role: member.role, look: member.look, name: member.shortName});
    model.group.traverse(object => {
      if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; }
    });
    hideGameLabels();
    // Settle an initial crouch without changing any gameplay values.
    for (let i = 0; i < 12; i++) model.update(1 / 30, actor, elapsed, camera);
    model.group.position.set(0, 0, 0);
    hideGameLabels();
    resetView();
  }

  function setupStudio() {
    if (renderer) return;
    renderer = new THREE.WebGLRenderer({antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const canvas = renderer.domElement;
    canvas.className = 'ci-canvas';
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img');
    stage.prepend(canvas);
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#141d25');
    scene.fog = new THREE.Fog('#141d25', 8, 18);
    camera = new THREE.PerspectiveCamera(32, 1, 0.025, 30);

    const environment = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    environmentTarget = pmrem.fromScene(environment, 0.07);
    scene.environment = environmentTarget.texture;
    scene.environmentIntensity = 0.18;
    environment.dispose();
    pmrem.dispose();
    scene.add(new THREE.HemisphereLight('#dae8ff', '#615044', 0.6));
    const key = new THREE.DirectionalLight('#fff0dc', 2.5);
    key.position.set(-3, 5, -4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, {left: -2.2, right: 2.2, top: 2.7, bottom: -2.2, near: 0.1, far: 12});
    key.shadow.bias = -0.00025;
    key.shadow.normalBias = 0.016;
    key.shadow.radius = 4;
    key.target.position.set(0, 1, 0);
    scene.add(key, key.target);
    const fill = new THREE.DirectionalLight('#c9ddff', 0.45);
    fill.position.set(3, 2.6, -1.5);
    scene.add(fill);
    const rim = new THREE.DirectionalLight('#e3e8e9', 1.2);
    rim.position.set(1, 3.4, 3);
    scene.add(rim);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({color: '#1b252d', roughness: 0.94, metalness: 0}));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.006;
    floor.receiveShadow = true;
    scene.add(floor);
    studioObjects = [floor, key];

    canvas.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      dragging = {id: event.pointerId, x: event.clientX, y: event.clientY};
      canvas.setPointerCapture(event.pointerId);
      canvas.focus({preventScroll: true});
      canvas.classList.add('ci-dragging');
    }, {signal});
    canvas.addEventListener('pointermove', event => {
      if (!dragging || dragging.id !== event.pointerId) return;
      azimuth -= (event.clientX - dragging.x) * 0.008;
      elevation = clamp(elevation + (event.clientY - dragging.y) * 0.006, -0.3, 0.72);
      dragging.x = event.clientX;
      dragging.y = event.clientY;
      positionCamera();
    }, {signal});
    const stopDrag = () => { dragging = null; canvas.classList.remove('ci-dragging'); };
    canvas.addEventListener('pointerup', stopDrag, {signal});
    canvas.addEventListener('pointercancel', stopDrag, {signal});
    canvas.addEventListener('lostpointercapture', stopDrag, {signal});
    canvas.addEventListener('wheel', event => {
      event.preventDefault();
      zoom = clamp(zoom * Math.exp(event.deltaY * 0.001), 0.7, 1.65);
      positionCamera();
    }, {passive: false, signal});
    canvas.addEventListener('keydown', event => {
      const key = event.key;
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_', 'Home'].includes(key)) return;
      event.preventDefault();
      if (key === 'Home') return resetView();
      if (key === 'ArrowLeft') azimuth -= 0.12;
      if (key === 'ArrowRight') azimuth += 0.12;
      if (key === 'ArrowUp') elevation = clamp(elevation + 0.08, -0.3, 0.72);
      if (key === 'ArrowDown') elevation = clamp(elevation - 0.08, -0.3, 0.72);
      if (key === '+' || key === '=') zoom = clamp(zoom * 0.9, 0.7, 1.65);
      if (key === '-' || key === '_') zoom = clamp(zoom / 0.9, 0.7, 1.65);
      positionCamera();
    }, {signal});
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      errorMessage = 'The 3D view was interrupted.';
      statusLabel.textContent = 'The 3D view was interrupted. Reload the page to reopen the studio.';
      statusLabel.hidden = false;
      cancelAnimationFrame(animationFrame);
    }, {signal});
    observer = new ResizeObserver(resize);
    observer.observe(stage);
    resize();
  }

  function resize() {
    if (!renderer || !dialog.open) return;
    const {width, height} = stage.getBoundingClientRect();
    if (width < 1 || height < 1) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    positionCamera();
  }

  function positionCamera() {
    if (!camera || !model) return;
    const profile = model.profile;
    const height = profile.standingHeight || 1.8;
    let span;
    if (mode === 'face') {
      const head = model.group.getObjectByName('head and portrait details');
      if (head) {
        model.group.updateMatrixWorld(true);
        headBounds.setFromObject(head);
        headBounds.getCenter(target);
        headBounds.getSize(headSize);
        // Fill three quarters of the height, then protect broad hats on mobile.
        span = Math.max(headSize.y / 0.76, Math.max(headSize.x, headSize.z) / (camera.aspect * 0.87));
      } else {
        target.set(0, (profile.eyeStanding || height * 0.89) + 0.02, -0.025);
        span = Math.max(0.48 * (profile.headScale?.y || 1), 0.58 / camera.aspect);
      }
    } else {
      // Use the rendered pose: limb grounding can differ from a static proxy.
      model.group.updateMatrixWorld(true);
      figureBounds.makeEmpty();
      model.group.traverseVisible(object => {
        if (!object.isMesh || !object.geometry) return;
        if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
        partBounds.copy(object.geometry.boundingBox).applyMatrix4(object.matrixWorld);
        figureBounds.union(partBounds);
      });
      figureBounds.getSize(figureSize);
      figureBounds.getCenter(target);
      target.x = 0;
      target.z = -0.025;
      const poseHeight = figureSize.y || (mode === 'crouch' ? profile.crouchHeight : height);
      span = Math.max(poseHeight * 1.2, Math.max(figureSize.x * 1.15, 1.05) / camera.aspect);
    }
    const radius = span / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * zoom;
    camera.position.set(target.x + Math.sin(azimuth) * Math.cos(elevation) * radius, target.y + Math.sin(elevation) * radius, target.z - Math.cos(azimuth) * Math.cos(elevation) * radius);
    camera.lookAt(target);
    camera.updateMatrixWorld();
  }

  function resetView() {
    azimuth = -0.36;
    elevation = mode === 'face' ? 0.045 : 0.06;
    zoom = 1;
    positionCamera();
  }

  function animate(now) {
    if (!dialog.open || disposed || !model) return;
    const dt = Math.min((now - (lastTime || now)) / 1000, 0.05);
    lastTime = now;
    elapsed += dt;
    const speed = mode === 'walk' ? 2.7 : 0;
    actor.velocity.set(0, 0, -speed);
    // Travel drives the real gait, while the display keeps the figure centred.
    actor.position.z -= speed * dt;
    actor.crouched = mode === 'crouch';
    model.update(dt, actor, reducedMotion.matches && mode !== 'walk' ? 0 : elapsed, camera);
    model.group.position.set(0, 0, 0);
    hideGameLabels();
    renderer.render(scene, camera);
    renderedFrames++;
    animationFrame = requestAnimationFrame(animate);
  }

  function chooseArtist(selection) {
    if (disposed) return state();
    const index = resolveIndex(selection);
    if (index < 0) throw new RangeError('Unknown artist selection');
    selectedIndex = index;
    updateLabels();
    if (renderer && dialog.open) buildModel();
    return state();
  }

  function setMode(value) {
    const normalized = value === 'fullbody' || value === 'full-body' ? 'full' : String(value).toLowerCase();
    if (!Object.hasOwn(MODES, normalized)) throw new RangeError(`Unknown character view: ${value}`);
    mode = normalized;
    for (const button of dialog.querySelectorAll('[data-mode]')) button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
    updateLabels();
    if (model) {
      actor.crouched = mode === 'crouch';
      actor.velocity.set(0, 0, mode === 'walk' ? -2.7 : 0);
      // Frame the requested pose, including when coming out of a crouch.
      for (let i = 0; i < 12; i++) model.update(1 / 30, actor, elapsed, camera);
      model.group.position.set(0, 0, 0);
      hideGameLabels();
    }
    resetView();
    return state();
  }

  function open(selection = {}) {
    if (disposed) throw new Error('This character studio has been disposed');
    if (!dialog.isConnected) document.body.append(dialog);
    if (!dialog.open) {
      previousFocus = document.activeElement;
      if (document.pointerLockElement) document.exitPointerLock?.();
      dialog.showModal();
    }
    try {
      errorMessage = '';
      // Keep the requested identity visible even if WebGL is unavailable.
      const index = resolveIndex(selection);
      if (index >= 0) selectedIndex = index;
      updateLabels();
      setupStudio();
      chooseArtist(selection);
      resize();
      statusLabel.hidden = true;
      lastTime = 0;
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(animate);
      closeButton.focus({preventScroll: true});
    } catch (error) {
      errorMessage = error?.message || String(error);
      statusLabel.textContent = 'The studio could not open. Close it and try again.';
      statusLabel.hidden = false;
      closeButton.focus({preventScroll: true});
    }
    return state();
  }

  function close() {
    if (!dialog.open) return;
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    lastTime = 0;
    dragging = null;
    releaseModel();
    dialog.close();
    previousFocus?.isConnected && previousFocus.focus?.({preventScroll: true});
    onClose?.();
  }

  function dispose() {
    if (disposed) return;
    close();
    releaseModel();
    disposed = true;
    listeners.abort();
    observer?.disconnect();
    for (const object of studioObjects) {
      object.geometry?.dispose();
      object.material?.dispose();
      object.shadow?.map?.dispose();
    }
    studioObjects = [];
    environmentTarget?.dispose();
    renderer?.dispose();
    renderer?.forceContextLoss();
    dialog.remove();
    model = renderer = scene = camera = null;
  }

  function state() {
    const {faction, member} = current();
    return {
      open: dialog.open, disposed, mode, artist: member.name, artistId: member.design?.id || `${faction.id}-${member.role}`,
      team: faction.id, role: member.role, age1888: member.age1888, index: selectedIndex,
      ready: !!model && !errorMessage, error: errorMessage || null, frames: renderedFrames,
      camera: {azimuth, elevation, zoom}, viewport: renderer ? {width: renderer.domElement.width, height: renderer.domElement.height} : null,
      motion: model ? {speed: model.state?.speed ?? 0, crouched: model.state?.crouched ?? 0} : null,
      renderer: renderer ? {calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures} : null,
    };
  }

  function screenshot() {
    if (!renderer || !model || !dialog.open) return null;
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL('image/png');
  }

  closeButton.addEventListener('click', close, {signal});
  query('.ci-previous').addEventListener('click', () => chooseArtist(selectedIndex - 1), {signal});
  query('.ci-next').addEventListener('click', () => chooseArtist(selectedIndex + 1), {signal});
  query('.ci-reset').addEventListener('click', resetView, {signal});
  query('.ci-modes').addEventListener('click', event => {
    const button = event.target.closest('[data-mode]');
    if (button) setMode(button.dataset.mode);
  }, {signal});
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); }, {signal});
  // Keep menu/game keyboard handlers out of a focused modal without pointer lock.
  dialog.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); close(); } event.stopPropagation(); }, {signal});
  dialog.addEventListener('keyup', event => event.stopPropagation(), {signal});
  dialog.addEventListener('click', event => { if (event.target === dialog) close(); }, {signal});
  document.addEventListener('visibilitychange', () => { lastTime = 0; }, {signal});
  updateLabels();
  return {open, close, dispose, chooseArtist, setMode, state, screenshot};
}

export default createCharacterInspector;
