/** Preserve the town's exposure while giving the portraits a less chalky fill.
 * Direct light stays physical; local baked occlusion supplies the small creases.
 */
export function refinePortraitMaterial(material) {
  const skin=/_skin(?:\.|$)/i.test(material.name);
  if(skin){
    // The authored roughness texture is around .72; this yields a satin .66.
    material.roughness*=.92;
    if('specularIntensity' in material)material.specularIntensity*=.78;
  }
  material.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>', `
      #include <lights_fragment_end>
      reflectedLight.indirectDiffuse *= 0.72;
      reflectedLight.indirectSpecular *= 0.65;
    `);
  };
  material.customProgramCacheKey=()=> 'portrait-surface-v8';
  return material;
}
