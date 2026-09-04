# Character framework — v8 surface refinement

Purpose: recognisable, richly modelled adult artists in the existing playable Three.js game. Improve the actual figures, facial close-ups and movement together. Preserve the original town and combat/input/respawn rules. This is a sculptural game interpretation, not a claim of photoreal documentary likeness.

## Production technique

The head begins with the official **CC0 MakeHuman hm08 authored topology**, including its eyelids, lips, nostrils, ears and UVs. `tools/human_base_head.py` applies matching sex and age macro targets using original vertex indices, extracts the head and neck, then re-anchors and normalizes them. The targets' whole-body stature changes therefore do not replace the game's body proportions. The adult age blend uses MakeHuman's 25- and 90-year endpoints; the 24-year-old character uses the young adult endpoint as a starting shape.

Artist-specific Blender deformations shape the face from each design profile. Native eyelids receive a `Blink` shape key; embedded, generated normal and roughness maps provide restrained surface detail. The v8 skin pigment adds gentle anatomical variation around cheeks, nose, ears and eyelids, aligned with each artist's actual facial landmarks. `tools/character_groom.py` fits hair, eyebrows, facial hair and spectacles to the actual head surface, with fuller fitted brows and moustaches, softer beard edges and fewer redundant strands. No museum portrait is projected onto the face and no downloaded skin photograph is used. 

`tools/character_surface.py` then measures local occlusion against the real skin, eye and groom geometry: 20 deterministic hemisphere rays per vertex, reaching at most 3.8 cm. It gently darkens existing skin/groom vertex colours in creases and at hair roots; eyes and metallic spectacles keep their own material. This pass changes colours only, preserving positions, UVs and Blink deformation, and adds no runtime geometry, texture or material. It does not bake a directional sun shadow into the face.

`tools/build-character-heads.py` combines the three production builders before making the reduced mesh. It exports `assets/characters/<id>-head.glb`, containing close and reduced distance mesh groups, and the editable `assets/characters/Artist-Portrait-Sculpts.blend`. The close mesh retains `Blink`; the reduced distance mesh omits that morph. `src/character-assets.js` changes to reduced detail beyond 11 metres and returns to close detail inside 9 metres, avoiding repeated swaps around a single distance boundary. The builder accepts `--output` and `--only` for staging a subset before publication:

```sh
node tools/export-character-designs.mjs
blender --background --python tools/build-character-heads.py -- --output work/character-staging --only van-gogh,morisot
```

The heads attach to runtime-built tailored bodies and hats in `src/actors.js`. Continuous shoulder-to-neck shaping, rounded fabric patches and real hems give the clothes volume while retaining the artist's proportions. Joint and hand geometry is distributed more efficiently instead of increasing the overall body triangle budget. Articulated hands and feet retain weapon IK.

`src/character-materials.js` distinguishes cloth, leather and exposed skin through the `aSurface` vertex attribute on the existing merged geometry. Cloth receives restrained fibre sheen and weave; leather and skin have smooth surfaces with their own roughness. Character-only indirect light is reduced to keep colour and facial form readable without changing the town's exposure or direct lights. `src/character-lighting.js` applies the matching portrait treatment, while the inspector uses a controlled studio light arrangement. Existing shared textures remain shared; surface classification does not require separate draw calls.

`src/character-motion.js` drives steps by travelled distance, holding support feet in world space and solving leg placement with body counter-motion and individual motion weights. These visual systems do not change combat balance. The game, inspector and portrait renderer use the same assembled models; `tools/render-character-portraits.py` captures cards from a verified, unchanged source and GLB snapshot. Surface refinement aims for more natural human form within the game's sculptural style; it does not establish photoreal likeness or authenticated historic appearance.

Source files, hashes and license evidence are recorded in `vendor/makehuman/SOURCES.json`; see [PROVENANCE.md](../PROVENANCE.md). Authored anatomical topology improves the modelling foundation but does not establish photoreal likeness or an artist's exact physique.

## Artist profiles

Each artist has a `src/character-designs/<id>.js` profile and a matching `docs/characters/<id>.md` design note. Each profile exports a default plain object. Do not modify gameplay statistics. Age is anchored to the end of 1888. Museum portraits supply qualitative likeness; undocumented exact body weight/height must not be invented as historical fact. Silhouette ratios are game art direction, with Lautrec's approximately 1.52 m documented height as the stated exception. Use first-party museum references; open the actual reference pages before relying on them.

```js
export default {
 id: 'van-gogh',
 signature: ['angular copper-bearded face', 'frayed straw silhouette', 'lean rolled-sleeve smock'],
 silhouette: 'Lean, long-legged, slightly forward posture',
 look: { /* existing supported look keys plus body keys below */ },
 face: { /* supported facial controls below */ },
 motion: { /* supported motion weights below */ },
 tailoring: { /* material controls below */ },
 references: [{title:'...',url:'https://...',date:'1888',observed:'...'}],
};
```

## Body and costume controls (`look`)

Existing supported palette/hair/hat/costume keys remain in src/factions.js. Preserve each person's assigned unique hat construction (bare heads are fine). Set coherent palette, not random parts. Primary silhouettes must differ even without colour, tiny accessories or a label.

- `stature`:0.84–1.10. Keep Lautrec0.8444444444 and Seurat1.08 (existing physical proxy invariants).
- `shoulderWidth`:.76–1.34, `waistWidth`:.72–1.48, `hipWidth`:.78–1.34.
- `torsoDepth`:.78–1.38, `belly`:0–.9, `chest`:0–.75.
- `legLength`:.65–1.15, `torsoLength`:.88–1.13, `legThickness`:.75–1.30.
- `neckWidth`:.75–1.25, `handScale`:.85–1.18.
- `headWidth`:.85–1.15, `headLength`:.92–1.12, `stoop`:0–.15.
- Existing `skin`, `hairColor`, `beardColor`, `eyeColor`, `coatColor`, `shirtColor`, `pantsColor`, `trim`, `hatColor`, `hatBandColor`, `apronColor` accept hex colours.
- Existing clothing enums: coat smock/doublebreast/vest/frock/sailor/cape/highcollar/long/short; sleeves rolled/cuffed; neckwear none/bow/cravat/stock/kerchief; accessory apron/waistapron/shawl/capelet/scarf/satchel/glasses/none. Keep role weapon unchanged.

## Facial sculpture controls (`face`)

Populate every field with artist-specific coherent values. Neutral is1 except controls explicitly0–1 or signed. Do not exaggerate all values.

`jawWidth` .75–1.30; `chinWidth` .70–1.30; `cheekbone` .75–1.30; `cheekFullness`0–1; `foreheadSlope`0–1;
`noseLength` .80–1.35; `noseWidth` .70–1.30; `noseBridge` .75–1.35; `noseTip` .80–1.25;
`eyeSpacing` .85–1.15; `eyeSize` .80–1.15; `eyeTilt` -.15–.15; `eyeDepth`0–1;
`browWeight` .60–1.40; `lidWeight`0–1; `mouthWidth` .80–1.20; `lipFullness` .55–1.30;
`earSize` .85–1.20; `age`0–1; `asymmetry` -.25–.25; `freckles`0–1;
`beardLength` .70–1.35; `beardDensity` .65–1.35; `moustacheShape` trimmed/drooping/handlebar/none;
`hairPart` -1–1; `hairWave`0–1.

## Motion weights (`motion`)

These adjust visual personality, never movement speed or combat balance. Grounded, natural and subtle rather than slapstick or theatrical.

`cadence` .80–1.20; `stride` .85–1.20; `hipSway` .65–1.25; `shoulderSway` .60–1.30;
`forwardLean`0–.10; `headSteadiness` .75–1.30; `stanceWidth` .85–1.25; `footLift` .80–1.20;
`idleBreath` .70–1.30; `turnLag` .75–1.30; `handEnergy` .60–1.20.

## Tailoring (`tailoring`)

`fabric`: linen/wool/velvet/tweed/cotton; `weave` .2–1; `roughness` .65–.95; `wear` .1–.6; `foldScale` .6–1.4; `buttonMetal`: brass/horn/pewter; `seamContrast` .5–1.2.

## Required per-artist evidence

Each design note must describe three gameplay-distance silhouette features, three facial features tied to dated portrait references, movement direction, exact supported controls, and intentionally invented clothing/build choices. Distinguish portrait observations from modelling decisions. Do not claim dimensions as verified facts. Verify exported JS syntax. Keep one profile and one concise design note per artist.

## Acceptance

All 12 must read differently in a neutral lineup and real town lighting. Compare front and three-quarter faces, open and closed eyelids, and close/distance transitions. Verify idle, walk/run, strafe, crouch, aim/reload and existing emotes; inspect floor contact, grip, collision/hit proxies and GPU cost. Rebuild the glTF assets after profile or builder changes, then regenerate every portrait card from one stable final model snapshot. A successful export, screenshot or unit test alone does not prove movement quality or final visual acceptance.
