# Claude Monet · 48 in 1888

Monet reads as a substantial, rounded adult with a dark beard. The three gameplay-distance features are his broad olive **garden brim**, the **deep rounded smock and wide waist**, and **thick trouser legs beneath broad hips**. A pale kerchief separates his beard from the moss-green cloth. These masses should remain distinct from the lean artists even in a monochrome lineup.

[Sargent’s *Claude Monet* in the National Academy of Design’s museum-authored record](https://artsandculture.google.com/asset/claude-monet-john-singer-sargent/PgEv2gbWxFOD8A?hl=en) supplies the strongest near-period facial reference. Its heading dates the work 1887; the accompanying museum text also allows 1885. The page and displayed image were inspected. Three features guide the sculpture: **a projecting nose with a strong bridge**, **a firm brow over a shaded eye**, and **a dense dark beard joined to swept dark hair with some gray at the temple**. The visible ear and receding temple help the three-quarter view. This is a middle-aged face, not the elderly white-bearded garden-painter image.

[Renoir’s *Claude Monet*, 1875, Musée d’Orsay](https://www.musee-orsay.fr/en/artworks/claude-monet-496) was also opened and visually inspected. It corroborates the dark full beard, moustache and prominent nose from a different angle. It is thirteen years earlier than the setting; its small round hat is not the game’s garden hat. Neither painting verifies body weight, exact anatomy, skin or eye colour. The wider cheeks, substantial belly and hips, olive garden hat, linen smock, kerchief, palette and material wear are explicit game art direction. All measurements below are dimensionless controls.

Movement should feel planted and purposeful: wider support, modest foot clearance, a steady gaze and contained shoulder swing. A little torso lag and visible breathing carry the body’s volume without making him slow or comic. These visual weights do not change speed, combat statistics or weapon choice.

The exact profile is [monet.js](../../src/character-designs/monet.js). Supported controls are set as follows:

| Group | Exact settings |
| --- | --- |
| Body | `stature 1.01`, `shoulderWidth 1.20`, `waistWidth 1.40`, `hipWidth 1.26`, `torsoDepth 1.32`, `belly .74`, `chest .39`, `legLength .97`, `torsoLength 1.08`, `legThickness 1.22`, `neckWidth 1.18`, `handScale 1.08`, `headWidth 1.10`, `headLength 1.02`, `stoop .025` |
| Construction | `hat garden`, `hair short`, `beard full`, `beardShape fan`, `build broad`, `coat smock`, `sleeves cuffed`, `neckwear kerchief`, `accessory none` |
| Palette | `skin #d0a080`, `hairColor #403d35`, `beardColor #473d30`, `eyeColor #4a4b3b`, `coatColor #617361`, `shirtColor #d2ceb6`, `pantsColor #40534d`, `trim #a9c2bc`, `hatColor #85835b`, `hatBandColor #59563d` |
| Legacy face compatibility | `jawWidth 1.17`, `noseLength 1.20`, `noseWidth 1.06`, `hairline .39`, `ageLines .52`, `browWeight 1.19` |
| Facial structure | `jawWidth 1.17`, `chinWidth 1.08`, `cheekbone 1.05`, `cheekFullness .62`, `foreheadSlope .40`, `noseLength 1.20`, `noseWidth 1.06`, `noseBridge 1.21`, `noseTip 1.10` |
| Eyes and mouth | `eyeSpacing .96`, `eyeSize .92`, `eyeTilt -.025`, `eyeDepth .58`, `browWeight 1.19`, `lidWeight .60`, `mouthWidth .98`, `lipFullness .86` |
| Face finish | `earSize 1.10`, `age .52`, `asymmetry .07`, `freckles .02`, `beardLength 1.16`, `beardDensity 1.19`, `moustacheShape drooping`, `hairPart -.40`, `hairWave .45` |
| Motion | `cadence .90`, `stride .97`, `hipSway .80`, `shoulderSway .79`, `forwardLean .032`, `headSteadiness 1.18`, `stanceWidth 1.18`, `footLift .88`, `idleBreath 1.12`, `turnLag 1.18`, `handEnergy .78` |
| Tailoring | `fabric linen`, `weave .78`, `roughness .88`, `wear .34`, `foldScale 1.22`, `buttonMetal horn`, `seamContrast .82` |

Profile verification: `node --check src/character-designs/monet.js`. Integrated front/three-quarter rendering, lineup separation, movement, floor contact and weapon grip still require the shared renderer’s acceptance pass.
