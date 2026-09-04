# Paul Gauguin · 40 in 1888

The character is a sculptural interpretation of an adult artist at 31 December 1888. All dimensions, gait weights and material values are art direction, not recorded body measurements or observations of his movement.

## Three distance reads

1. A low, asymmetric **wine-red slouch beret** extends sideways over dark nape hair. The assigned `hat: 'slouchberet'` is retained.
2. An **upper-body wedge** combines `shoulderWidth: 1.31`, `chest: 0.66`, `torsoDepth: 1.22` and `waistWidth: 1.09`. The restrained belly separates his broad chest from a rounder, waist-led silhouette.
3. A **solid, upright double-breasted coat over substantial straight legs** uses `legThickness: 1.17`, `neckWidth: 1.21` and `stoop: 0.012`. No apron, dangling accessory or oversized beard obscures the body outline.

## Portrait evidence and facial construction

- **Prominent nose:** the [Van Gogh Museum's 1888 self-portrait catalogue](https://catalogues.vangoghmuseum.com/contemporaries-of-van-gogh-1/cat57) anchors the period; the [NGA's 1889 self-portrait](https://www.nga.gov/artworks/46625-self-portrait) explicitly describes a hooked nose. `noseLength: 1.25`, `noseWidth: 1.17`, `noseBridge: 1.24`, `noseTip: 1.10` give a continuous strong profile without enlarging every feature.
- **Set-back eyes and substantial chin:** the [NGA's Self-Portrait Dedicated to Carrière, 1888 or 1889](https://www.nga.gov/artworks/66418-self-portrait-dedicated-carriere) describes under-eye hollows, unequal brows, a broad bridge and projecting chin. `eyeDepth: 0.62`, `lidWeight: 0.58`, `eyeSize: 0.91`, `browWeight: 1.26`, `chinWidth: 1.16` and `asymmetry: 0.06` translate those relationships into subtle anatomy.
- **Dark hair and weighty moustache:** the NGA's 1889 portrait describes dark hair, arched brows and a brushy moustache. `beard: 'moustache'`, `moustacheShape: 'drooping'`, `beardDensity: 1.22`, `beardLength: 1.12`, `hairPart: -0.24` and `hairWave: 0.36` preserve an exposed jaw beneath the moustache. The longer nape under the beret is a silhouette choice.

All three museum pages were opened during design. Both main self-portraits use symbolic colour and form; the Van Gogh Museum specifically explains that the 1888 facial drawing is abstract. The warm skin, brown eyes, chest size, hair length, red beret, rust coat, cream kerchief and charcoal-green trousers are game choices. The 1889 painting is a dated cross-check, not evidence of an exact 1888 appearance.

## Complete control choices

`look`: `stature 1.04`, `shoulderWidth 1.31`, `waistWidth 1.09`, `hipWidth 1.07`, `torsoDepth 1.22`, `belly 0.20`, `chest 0.66`, `legLength 1.00`, `torsoLength 1.05`, `legThickness 1.17`, `neckWidth 1.21`, `handScale 1.10`, `headWidth 1.07`, `headLength 1.05`, `stoop 0.012`, `hairline 0.14`, `ageLines 0.40`. Costume enums are `slouchberet`, `long` hair, `moustache`, `broad`, `doublebreast`, `cuffed`, `kerchief`, accessory `none`. Palette: skin `#bd947c`, hair `#352c27`, moustache `#302923`, eyes `#655b42`, coat `#805445`, shirt `#d2c5a6`, trousers `#3c4846`, trim `#ab8766`, beret `#703f42`, band `#482f32`.

`face`: `jawWidth 1.18`, `chinWidth 1.16`, `cheekbone 1.18`, `cheekFullness 0.38`, `foreheadSlope 0.34`, `noseLength 1.25`, `noseWidth 1.17`, `noseBridge 1.24`, `noseTip 1.10`, `eyeSpacing 0.98`, `eyeSize 0.91`, `eyeTilt -0.018`, `eyeDepth 0.62`, `browWeight 1.26`, `lidWeight 0.58`, `mouthWidth 1.10`, `lipFullness 0.86`, `earSize 1.07`, `age 0.40`, `asymmetry 0.06`, `freckles 0.025`, `beardLength 1.12`, `beardDensity 1.22`, `moustacheShape drooping`, `hairPart -0.24`, `hairWave 0.36`. The slightly fuller mouth and cheeks keep the strong nose and chin attached to a believable middle-aged face.

`motion`: `cadence 0.94`, `stride 1.10`, `hipSway 0.75`, `shoulderSway 1.05`, `forwardLean 0.029`, `headSteadiness 1.22`, `stanceWidth 1.18`, `footLift 0.92`, `idleBreath 1.04`, `turnLag 1.10`, `handEnergy 0.78`. Long, grounded steps, quiet hips, a steady head and slight shoulder follow-through give weight without lumbering. These are visual weights; combat speed and role remain unchanged.

`tailoring`: `fabric wool`, `weave 0.62`, `roughness 0.88`, `wear 0.28`, `foldScale 1.12`, `buttonMetal horn`, `seamContrast 0.72`. Soft wool highlights and broad folds suit the heavy coat, with moderate edge wear and restrained seams to keep the face readable.

## Verification boundary

The profile is a complete plain-object export and passes `node --check src/character-designs/gauguin.js`. Final model integration still needs front/three-quarter portrait inspection, neutral-lineup comparison and motion review in town lighting, including feet and weapon grip. Syntax validation does not establish visual or animation quality.
