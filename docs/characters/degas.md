# Edgar Degas · 54 in 1888

Degas is a mature, formally dressed figure with restrained motion. The intended reading is concentration and composure; the stern expression comes from the brow, eyelids and mouth proportions rather than an exaggerated scowl. The model is a sculptural interpretation, not a verified reconstruction.

At gameplay distance, three shapes identify him: an uncovered high crown edged by close side hair; a compact, square-ended beard beneath the longer face; and a long, nearly straight double-breasted coat with a slight forward inclination at the upper back. The coat is intentionally narrow through the hips, avoiding the broader apron and loose-smock silhouettes elsewhere in the cast.

The [1885 *Apothéose de Degas* photograph at Musée d’Orsay](https://www.musee-orsay.fr/fr/oeuvres/apotheose-de-degas-141886), made by Walter Barnes and arranged by Degas, was opened and visually inspected. Its central figure guides the high forehead, strongly marked brows and compact beard. The [Met’s *Self-Portrait in Library (Hand to Chin)*, probably 1895](https://www.metmuseum.org/art/collection/search/296287), was also opened and visually inspected. It clarifies three-quarter/profile structure: a long substantial bridge ending in a rounded nose tip, the recessed eye under the brow, and the broad cheek plane above a relatively compact lower face. This second reference is about seven years after the setting. Its stronger ageing is moderated, and its obscured mouth is not treated as evidence of exact lip shape.

Motion has a steady head, quiet shoulders, little lateral hip motion, low foot clearance and restrained idle hands. A slight delayed torso turn adds weight without increasing gameplay speed or affecting combat. These choices, including the upper-back inclination, are invented animation direction; the arranged seated pose in the 1885 photograph does not establish habitual movement.

All exact controls are in [`src/character-designs/degas.js`](../../src/character-designs/degas.js). The full selected values are:

| Control group | Values |
| --- | --- |
| Construction | `hat:none`, `hair:bald`, `beard:short`, `beardShape:square`, `build:average`, `coat:doublebreast`, `sleeves:cuffed`, `neckwear:cravat`, `accessory:none`. The formal coat construction supplies the long hem. |
| Palette | `skin:#d3af94`, `hairColor:#756f65`, `beardColor:#79736b`, `eyeColor:#514e46`, `coatColor:#373b45`, `shirtColor:#d7d3c4`, `pantsColor:#303740`, `trim:#a5abb5`. Dormant hat/apron palette: `hatColor:#373b45`, `hatBandColor:#303740`, `apronColor:#a5abb5`. |
| Body | `stature:1.025`, `shoulderWidth:1.02`, `waistWidth:1.06`, `hipWidth:0.98`, `torsoDepth:1.06`, `belly:0.18`, `chest:0.21`, `legLength:1.04`, `torsoLength:1.02`, `legThickness:0.95`, `neckWidth:0.93`, `handScale:1.0`, `headWidth:0.97`, `headLength:1.07`, `stoop:0.06`. |
| Existing face fallbacks | `hairline:0.89`, `ageLines:0.67`, `jawWidth:1.07`, `noseLength:1.20`, `noseWidth:1.02`, `browWeight:1.26`. |
| Face planes and nose | `jawWidth:1.07`, `chinWidth:1.06`, `cheekbone:1.09`, `cheekFullness:0.38`, `foreheadSlope:0.40`, `noseLength:1.20`, `noseWidth:1.02`, `noseBridge:1.18`, `noseTip:1.08`. |
| Eyes and age | `eyeSpacing:0.98`, `eyeSize:0.91`, `eyeTilt:-0.035`, `eyeDepth:0.69`, `browWeight:1.26`, `lidWeight:0.66`, `mouthWidth:0.94`, `lipFullness:0.77`, `earSize:1.05`, `age:0.67`, `asymmetry:0.045`, `freckles:0.0`. |
| Hair sculpture | `beardLength:0.78`, `beardDensity:0.93`, `moustacheShape:trimmed`, `hairPart:0.0`, `hairWave:0.08`. |
| Motion | `cadence:0.92`, `stride:0.97`, `hipSway:0.72`, `shoulderSway:0.69`, `forwardLean:0.032`, `headSteadiness:1.24`, `stanceWidth:1.04`, `footLift:0.89`, `idleBreath:0.78`, `turnLag:1.08`, `handEnergy:0.69`. |
| Tailoring | `fabric:wool`, `weave:0.62`, `roughness:0.89`, `wear:0.18`, `foldScale:1.08`, `buttonMetal:horn`, `seamContrast:0.72`. |

The charcoal wool, gray cravat, pale cuffs, precise tailoring, build factors, skin/eye/hair colours and motion are artistic choices. Neither photograph establishes exact body dimensions, natural colour or a permanent wardrobe. No height or weight is claimed. Dark horn buttons and modest wear keep the coat formal, with broad folds and low seam contrast rather than decorative noise.

Validation: the profile passes `node --check src/character-designs/degas.js` and a full required-control/range check. Final front/three-quarter likeness, floor contact and moving-coat acceptance belong to integration review of the rendered model.
