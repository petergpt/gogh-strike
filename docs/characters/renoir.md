# Pierre-Auguste Renoir · 47 in 1888

The game interpretation is a lean, bareheaded middle-aged man with a small reddish hair sweep, a narrow face and a fitted waistcoat. It retains the existing fictional flanker role. Both museum pages below were opened and their enlarged portrait images visually inspected; no portrait imagery is bundled in the character.

At gameplay distance, three large features carry the identity:

- An uncovered high forehead with short hair at the temples and a small parted crown, paired with a compact tapering beard.
- Narrow shoulders, a narrow waist and shallow torso, with restrained hip volume and slender legs. These dimensionless silhouette choices deliberately keep him slimmer than Monet and Cézanne; they are not claims about his historical height or weight.
- A short fitted waistcoat and rolled shirt sleeves leave the forearms and long leg line visible. The warm brown, flax and smoke palette has a small cool blue bow/crew trim.

Face decisions come from specific visible portrait cues:

- Renoir's [*Portrait de l'artiste*, 1879, Musée d'Orsay](https://www.musee-orsay.fr/fr/oeuvres/portrait-de-lartiste-487) shows an exposed forehead between short parted hair and a reddish-brown beard with a narrower chin end. The game increases the recession moderately for 1888 and keeps the beard compact.
- The same 1879 image supplies small clear eyes under lightly drawn brows. Moderate lid weight and age relief preserve a 47-year-old face without borrowing Renoir's much older appearance. The iris and skin colours are painterly approximations, not authenticated natural colours.
- Bazille's [*Pierre Auguste Renoir*, 1867, Musée d'Orsay](https://www.musee-orsay.fr/en/artworks/pierre-auguste-renoir-63) makes the narrow projecting nose, slim cheek-to-jaw transition and visible ear especially legible. The nose bridge, narrow jaw and slightly larger ear support that likeness in three-quarter view. This younger portrait precedes the setting by 21 years.

Motion is invented, natural game choreography: compact, brisk steps; little lateral hip or shoulder travel; slight forward intent; a steady head; and quick, soft turns. The cadence/stride pair provides personality without modifying travel speed, weapon timing or combat statistics. Idle breath stays quiet. The same narrow stance and restrained sway should continue through strafe, crouch, aim and reload; the existing emote remains compatible.

The waistcoat, rolled sleeves, bow, exact palette, cloth treatment and entire build are art direction. The portraits show tailored clothing but do not document this specific outfit. A modest wool weave, matte finish, horn buttons and restrained seam contrast make the outer garment feel worn and pliable without covering the silhouette in decoration.

The complete supported controls are set explicitly in [the profile](../../src/character-designs/renoir.js):

| Control group | Exact choices |
| --- | --- |
| Head / hair | `hat none`, `hair short`, `beard short`, `beardShape pointed`, `hairline .71`, `ageLines .52`; hair `#79533d`, beard `#89593f`, skin `#deb79d`, eyes `#526166` |
| Wardrobe | `coat vest`, `build slim`, `accessory none`, `sleeves rolled`, `neckwear bow`; coat `#77554f`, shirt `#d8c6ab`, pants `#505057`, trim `#8fa9b9` |
| Body | `stature .97`, `shoulderWidth .83`, `waistWidth .78`, `hipWidth .86`, `torsoDepth .83`, `belly .035`, `chest .14`, `legLength 1.055`, `torsoLength .97`, `legThickness .79`, `neckWidth .81`, `handScale .90`, `headWidth .90`, `headLength 1.055`, `stoop .022` |
| Face structure | `jawWidth .81`, `chinWidth .80`, `cheekbone .99`, `cheekFullness .24`, `foreheadSlope .22`, `noseLength 1.09`, `noseWidth .80`, `noseBridge 1.08`, `noseTip .95` |
| Eyes / mouth | `eyeSpacing 1.03`, `eyeSize .90`, `eyeTilt -.017`, `eyeDepth .42`, `browWeight .78`, `lidWeight .48`, `mouthWidth .93`, `lipFullness .83`, `earSize 1.06` |
| Surface / grooming | `age .52`, `asymmetry .055`, `freckles .025`, `beardLength .93`, `beardDensity .87`, `moustacheShape drooping`, `hairPart -.36`, `hairWave .28` |
| Motion | `cadence 1.09`, `stride .96`, `hipSway .79`, `shoulderSway .83`, `forwardLean .026`, `headSteadiness 1.15`, `stanceWidth .92`, `footLift .94`, `idleBreath .88`, `turnLag .87`, `handEnergy .96` |
| Tailoring | `fabric wool`, `weave .42`, `roughness .86`, `wear .26`, `foldScale .82`, `buttonMetal horn`, `seamContrast .72` |

Legacy `look.jawWidth`, `look.noseLength`, `look.noseWidth` and `look.browWeight` mirror the face values so any remaining older consumer agrees. Colours for absent hats and aprons are intentionally unnecessary.

Validation for this isolated profile: JavaScript syntax and schema/range checks. Final acceptance belongs to the integrated model: front and three-quarter face views, comparison beside Monet/Cézanne under town light, and floor/grip/cloth inspection during the full movement set. This note does not claim those integrated checks have already passed.
