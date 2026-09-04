import * as THREE from 'three';

const DEFAULT_PALETTE = ['#efb93d', '#c67a26', '#417e68'];

/** A small reusable paint can. Grip origin is (0,0,0), upright is +Y,
 * nozzle and mist aim along -Z. Body is 0.068m wide and 0.194m tall.
 * Each instance owns its geometry/materials; dispose() is idempotent.
 */
export function createSprayCan({palette = DEFAULT_PALETTE} = {}) {
  const group = new THREE.Group(); group.name = 'Artist paint can';
  const geometries = new Set(), materials = new Set();
  let disposed = false, clock = 0;
  const material = options => {const m = new THREE.MeshStandardMaterial(options); materials.add(m); return m;};
  const paint = material({color: palette[0], roughness: .37, metalness: .28});
  const label = material({color: '#f7e5bd', roughness: .7, metalness: .02});
  const second = material({color: palette[1], roughness: .52, metalness: .12});
  const accent = material({color: palette[2], roughness: .52, metalness: .12});
  const metal = material({color: '#c4c8ba', roughness: .3, metalness: .82});
  const dark = material({color: '#1c3034', roughness: .54, metalness: .16});
  function mesh(geometry, m, x = 0, y = 0, z = 0) {
    geometries.add(geometry); const result = new THREE.Mesh(geometry, m);
    result.position.set(x, y, z); group.add(result); return result;
  }
  mesh(new THREE.CylinderGeometry(.032, .033, .146, 20), paint);
  mesh(new THREE.CylinderGeometry(.0335, .0335, .007, 20), metal, 0, -.073);
  mesh(new THREE.CylinderGeometry(.033, .033, .052, 20), label, 0, .006);
  mesh(new THREE.CylinderGeometry(.0334, .0334, .014, 20), second, 0, .015);
  mesh(new THREE.CylinderGeometry(.0335, .0335, .007, 20), accent, 0, -.003);
  const shoulder = mesh(new THREE.SphereGeometry(.0315, 20, 10), metal, 0, .073); shoulder.scale.y = .37;
  mesh(new THREE.CylinderGeometry(.026, .027, .006, 20), dark, 0, .084);
  const nozzle = mesh(new THREE.CylinderGeometry(.0105, .012, .020, 14), label, 0, .099);
  const outlet = mesh(new THREE.CylinderGeometry(.007, .007, .010, 12), dark, 0, .100, -.012);
  outlet.rotation.x = Math.PI / 2;
  const tip = mesh(new THREE.CircleGeometry(.003, 10), metal, 0, .100, -.0172); tip.rotation.y = Math.PI;

  // One translucent expanding cone gives a legible puff without a particle
  // cloud or an opaque beam. Its local tip remains at the nozzle opening.
  const jetMaterial = new THREE.ShaderMaterial({
    uniforms: {uColor: {value: new THREE.Color(palette[0])}, uTime: {value: 0}, uOpacity: {value: 0}},
    vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `uniform vec3 uColor;uniform float uTime;uniform float uOpacity;varying vec2 vUv;
      void main(){float fade=smoothstep(0.0,0.09,vUv.y)*(1.0-smoothstep(0.2,1.0,vUv.y));
      float streak=.75+.25*sin(vUv.x*37.0+vUv.y*16.0-uTime*32.0);
      float alpha=fade*streak*uOpacity;if(alpha<.005)discard;gl_FragColor=vec4(uColor,alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  materials.add(jetMaterial);
  const jet = mesh(new THREE.CylinderGeometry(.052, .004, .26, 14, 1, true), jetMaterial, 0, .100, -.151);
  jet.name = 'Short pigment mist'; jet.rotation.x = -Math.PI / 2; jet.visible = false;
  function setPalette(next = DEFAULT_PALETTE) {
    if (disposed) return false;
    const colors = Array.isArray(next) ? next : next?.palette || DEFAULT_PALETTE;
    paint.color.set(colors[0] || DEFAULT_PALETTE[0]);
    second.color.set(colors[1] || DEFAULT_PALETTE[1]);
    accent.color.set(colors[2] || DEFAULT_PALETTE[2]);
    jetMaterial.uniforms.uColor.value.copy(paint.color).lerp(new THREE.Color('#fff0cd'), .18);
    return true;
  }
  function update(dt = 0, {spraying = false, time} = {}) {
    if (disposed) return false;
    clock = Number.isFinite(time) ? time : clock + Math.max(0, Number(dt) || 0);
    jet.visible = !!spraying;
    jetMaterial.uniforms.uTime.value = clock;
    jetMaterial.uniforms.uOpacity.value = spraying ? .20 : 0;
    nozzle.position.y = spraying ? .097 : .099;
    return true;
  }
  function dispose() {
    if (disposed) return;
    disposed = true; jet.visible = false; group.visible = false; group.removeFromParent();
    for (const geometry of geometries) geometry.dispose();
    for (const m of materials) m.dispose();
    geometries.clear(); materials.clear(); group.clear();
  }
  setPalette(palette);
  return {group, nozzle, jet, setPalette, update, dispose, get disposed() {return disposed;}};
}
