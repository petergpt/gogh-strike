# Georges Seurat · 29 in 1888

The marksman reads as a tall, young, quietly alert figure. Keep `stature: 1.08` exactly for the existing physical-proxy invariant and keep his head bare. This is a sculptural game likeness; the build factors are not verified historical measurements.

## Portrait evidence

Opened the [Louvre’s record for Ernest Laurent’s 1883 portrait, RF 23518](https://collections.louvre.fr/ark:/53355/cl020229715) and visually inspected its museum image. The original Orsay link returned HTTP 429; the Louvre identifies this drawing within the Orsay collection. The [National Gallery of Art’s *Picturing France*, printed p.100 / PDF p.104](https://www.nga.gov/content/dam/ngaweb/Education/learning-resources/teaching-packets/pdfs/picturing_france.pdf#page=104) was also opened and confirms the same portrait’s attribution and date. It is one likeness reproduced by two museums, five years before the game’s setting.

Three face anchors from Laurent’s drawing:

1. The projecting, long nose defines the three-quarter profile; preserve a substantial bridge and a modest tip instead of using a thin triangular spike.
2. Dark upper sockets and brows frame relatively restrained eye openings. The clear forehead and softly modelled cheeks keep him young; shading in a charcoal drawing is not evidence for deep age wrinkles.
3. The dark hair sweeps away from the forehead, while a dense moustache and beard gather into a downward taper. Keep a visible mouth separation and a little cheek volume above the beard.

Hair, eye and skin colours are painterly approximations because this reference is monochrome. The precise part, asymmetry and beard grooming are interpretation. Do not infer exact height, weight, gait or personality from the drawing.

## Gameplay silhouette and movement

Three readable features are the long upright leg-to-body line, the narrow shoulders and waist of the frock coat, and the bare rounded hair mass above a compact pointed beard. The coat has a restrained skirt, cuffed sleeves and a pale stock to articulate the neck; he has no broad brim or accessory mass. Charcoal teal, warm ivory and muted ochre keep the costume coherent in the town light. The slim build, tailored wool costume, colours and clean horn buttons are invented game art direction.

Use a slightly longer, less hurried step with close foot placement, low but positive toe clearance, and small pelvis/shoulder counter-motion. The head stays comparatively steady without locking to the torso. Turns settle promptly; the hands and idle breath remain alive but economical. Crouching must still articulate hips, knees and ankles, and the existing weapon grip, aim and reload timing stay authoritative. These weights describe fictional movement and never change movement speed or combat balance.

## Exact supported controls

The profile is [src/character-designs/seurat.js](../../src/character-designs/seurat.js). Every framework face, motion and tailoring control is set explicitly.

| Group | Values |
| --- | --- |
| Body | `stature 1.08`, `shoulderWidth .89`, `waistWidth .83`, `hipWidth .88`, `torsoDepth .86`, `belly .04`, `chest .18`, `legLength 1.12`, `torsoLength .98`, `legThickness .85`, `neckWidth .87`, `handScale .97`, `headWidth .92`, `headLength 1.07`, `stoop .008` |
| Construction | `hat none`, `hair short`, `beard full`, `beardShape pointed`, `hairline .06`, `ageLines .12`, `coat frock`, `sleeves cuffed`, `neckwear stock`, `accessory none`, `build slim` |
| Palette | `skin #d8b291`, `hairColor #302923`, `beardColor #352b25`, `eyeColor #4a4034`, `coatColor #38494a`, `shirtColor #e5dcc5`, `pantsColor #353f3f`, `trim #cbbd92`; dormant `hatColor #38494a`, `hatBandColor #cbbd92`, `apronColor #afa185` |
| Face structure | `jawWidth .91`, `chinWidth .89`, `cheekbone 1.06`, `cheekFullness .25`, `foreheadSlope .24`, `noseLength 1.19`, `noseWidth .93`, `noseBridge 1.16`, `noseTip .99` |
| Eyes and mouth | `eyeSpacing .98`, `eyeSize .95`, `eyeTilt .012`, `eyeDepth .52`, `browWeight 1.08`, `lidWeight .47`, `mouthWidth .93`, `lipFullness .88`, `earSize 1.06` |
| Surface and grooming | `age .16`, `asymmetry -.025`, `freckles .015`, `beardLength 1.03`, `beardDensity 1.10`, `moustacheShape trimmed`, `hairPart -.38`, `hairWave .28` |
| Motion | `cadence .92`, `stride 1.08`, `hipSway .73`, `shoulderSway .69`, `forwardLean .012`, `headSteadiness 1.23`, `stanceWidth .91`, `footLift .86`, `idleBreath .78`, `turnLag .84`, `handEnergy .70` |
| Tailoring | `fabric wool`, `weave .38`, `roughness .82`, `wear .16`, `foldScale .74`, `buttonMetal horn`, `seamContrast .67` |

Legacy `look.jawWidth`, `look.noseLength`, `look.noseWidth` and `look.browWeight` mirror the face values so the existing fallback renderer preserves the direction. Bare-head and no-apron colours are dormant defaults, not additional costume pieces.

Syntax is checked with `node --check src/character-designs/seurat.js`. Final front/three-quarter likeness, long-coat leg clearance, planted feet, crouch, strafe, aim/reload and emote checks belong to the integrated renderer pass; data validation alone does not establish movement quality.
