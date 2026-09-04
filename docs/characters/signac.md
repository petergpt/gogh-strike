# Paul Signac · 25 at 31 December 1888

Signac should read as a young, solidly built man with a clear horizontal cap and collar silhouette. The three gameplay-distance features are the pale flat sailor cap, the broad naval collar over cuffed sleeves, and a shoulder-led torso that tapers gently to a free waist above substantial legs. A dark compact full beard remains visible below the pale cap. The existing support role and weapon are unchanged.

[Pissarro’s etching, c.1890, National Gallery of Art](https://www.nga.gov/artworks/10105-paul-signac-portrait-de-paul-signac) was opened and visually inspected through the museum zoom. Three likeness anchors are the prominent straight nose, cheekbone planes that narrow toward the lower face, and dense compact beard below short parted hair. The portrait is about two years later than the setting: low age and eyelid weights preserve an adult of 25. Colours and the exact facial ratios are interpretation of a monochrome print. The NGA’s automated description is not treated as age evidence.

The [Musée d’Orsay educational brochure, p.5](https://www.musee-orsay.fr/sites/default/files/2022-03/Brochure%20educative%20Orsay_0.pdf) captions van Rysselberghe’s *Signac at the helm of his boat*, 1896. That later maritime association informs the fictional cap, collar and blue wool blouse; it does not authenticate an 1888 uniform. The solid build, colour palette, brown beard, green-gray eyes, mild wear and all dimensions are game art direction, with no historical weight or height claim.

Movement is grounded and quietly brisk: a slightly wider stance, modest shoulder counter-motion, little hip drift, and a steady attentive head. Turns gather promptly through the body. Small breathing and hand movements keep him alive without a rocking sailor caricature. These values change visual style only, with gait phases and weapon grip left to the shared animation system.

Exact supported controls live in [signac.js](../../src/character-designs/signac.js):

| Controls | Values |
| --- | --- |
| Costume | `presentation man`, `hat sailor`, `hair short`, `beard full`, `beardShape square`, `glasses false`, `coat sailor`, `build broad`, `accessory none`, `sleeves cuffed`, `neckwear kerchief` |
| Palette | `skin #dfb28f`, `hairColor #513d32`, `beardColor #614334`, `eyeColor #59635a`, `coatColor #304d58`, `shirtColor #ded8bd`, `pantsColor #35444b`, `trim #bfba94`, `hatColor #d5cfb5`, `hatBandColor #263a43`, `apronColor #b9ad8b` (inactive fallback) |
| Body | `stature 1.03`, `shoulderWidth 1.17`, `waistWidth 1.04`, `hipWidth 1.02`, `torsoDepth 1.08`, `belly .16`, `chest .42`, `legLength 1.03`, `torsoLength 1.03`, `legThickness 1.08`, `neckWidth 1.04`, `handScale 1.04`, `headWidth 1.04`, `headLength .98`, `stoop .004` |
| Legacy face aliases | `hairline .05`, `ageLines .06`, `jawWidth 1.04`, `noseLength 1.13`, `noseWidth .98`, `browWeight 1.06` |
| Facial planes | `jawWidth 1.04`, `chinWidth .94`, `cheekbone 1.13`, `cheekFullness .47`, `foreheadSlope .23` |
| Nose | `noseLength 1.13`, `noseWidth .98`, `noseBridge 1.12`, `noseTip .98` |
| Eyes and brows | `eyeSpacing 1.01`, `eyeSize .95`, `eyeTilt .025`, `eyeDepth .34`, `browWeight 1.06`, `lidWeight .27` |
| Mouth and detail | `mouthWidth 1.03`, `lipFullness .87`, `earSize 1.06`, `age .10`, `asymmetry .055`, `freckles .04` |
| Facial hair | `beardLength 1.14`, `beardDensity 1.17`, `moustacheShape trimmed`, `hairPart -.23`, `hairWave .24` |
| Motion | `cadence 1.06`, `stride 1.03`, `hipSway .94`, `shoulderSway 1.10`, `forwardLean .025`, `headSteadiness 1.10`, `stanceWidth 1.10`, `footLift 1.02`, `idleBreath 1.04`, `turnLag .91`, `handEnergy 1.02` |
| Tailoring | `fabric wool`, `weave .58`, `roughness .87`, `wear .22`, `foldScale .92`, `buttonMetal horn`, `seamContrast .76` |

The slightly coarse, matte wool and shallow folds keep the broad collar readable in town light; horn buttons and restrained seams avoid bright jewellery-like highlights. Keep the beard below the lower lip and clear of the collar. Final integration should inspect front/three-quarter faces, floor contact, support-weapon grip and the full movement set before accepting this design.
