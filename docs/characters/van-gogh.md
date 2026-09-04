# Vincent van Gogh · 35 in 1888

The three gameplay-distance cues are a broad **frayed straw brim**, a **narrow blue smock with exposed rolled-sleeve forearms and pale apron**, and **long slim legs beneath a tapered torso**. Copper facial hair remains the colour signature; the silhouette also reads in monochrome. Keep the expression concentrated and alive, with a steady gaze rather than a permanent grimace.

## Likeness and evidence

The source pages were opened on 4 September 2026. These are qualitative portrait cues, not authenticated anatomical measurements. The image endpoints did not return images in this research pass; the directions below rely on the museums' accessible descriptions and retain the established angular-face interpretation.

| Face-level cue | Portrait evidence and modelling decision |
| --- | --- |
| Deep-set green eyes below a slightly weighted brow | [Van Gogh Museum's interpretation of *Self-Portrait as a Painter*, 1887–1888](https://ontrafel.vangogh.nl/en/story/23/a-cheap-model/) identifies the green eyes and frowning expression. Recessed sockets, modest lids and a quiet brow give concentration without a caricature scowl. |
| Distinct copper beard against quieter hair and skin | The [Courtauld's interpretation of the same painting, December 1887–February 1888](https://virtualtour.courtauld.ac.uk/gal-hotspot/self-portrait-as-a-painter/) reproduces Van Gogh's description of his red, unkempt beard and ash-toned hair. A close square beard, narrow jaw and low cheek fullness create a long facial contour; exact jaw and nose factors are sculptural inference. |
| Fuller lips and visible but restrained forehead/mouth age | The same Courtauld source specifies full lips and facial lines. Moderate lip volume and age factors preserve an adult of 35; the long, narrow nose is a qualitative identity choice, not a measured claim. |

The work belongs to the [Van Gogh Museum](https://www.vangoghmuseum.nl/en/collection/s0022V1962); the Courtauld page is exhibition interpretation. [The Met's *Self-Portrait with a Straw Hat*, 1887](https://www.metmuseum.org/art/collection/search/436532), supplies the second near-period portrait and straw-hat motif. No museum image is bundled or used as a texture.

## Exact profile controls

The values below are dimensionless factors in `src/character-designs/van-gogh.js`; they do not establish height, weight or historical movement.

| Group | Controls |
| --- | --- |
| Body | `stature 1`, `shoulderWidth .88`, `waistWidth .82`, `hipWidth .88`, `torsoDepth .87`, `belly .06`, `chest .13`, `legLength 1.06`, `torsoLength .97`, `legThickness .86`, `neckWidth .88`, `handScale 1.04`, `headWidth .92`, `headLength 1.08`, `stoop .025` |
| Face structure | `jawWidth .88`, `chinWidth .90`, `cheekbone 1.13`, `cheekFullness .20`, `foreheadSlope .28`, `noseLength 1.16`, `noseWidth .88`, `noseBridge 1.14`, `noseTip .94`, `earSize 1.04` |
| Eyes and mouth | `eyeSpacing .96`, `eyeSize .91`, `eyeTilt -.025`, `eyeDepth .64`, `browWeight 1.10`, `lidWeight .37`, `mouthWidth .98`, `lipFullness 1.10` |
| Age and hair | `age .34`, `asymmetry .045`, `freckles .08`, `beardLength 1.08`, `beardDensity 1.16`, `moustacheShape trimmed`, `hairPart -.35`, `hairWave .18`; compatible look controls `hairline .16`, `ageLines .34`, `jawWidth .88`, `noseLength 1.16`, `noseWidth .88` |
| Motion | `cadence 1.06`, `stride 1.07`, `hipSway .78`, `shoulderSway 1.07`, `forwardLean .042`, `headSteadiness 1.10`, `stanceWidth .94`, `footLift 1.04`, `idleBreath 1.03`, `turnLag .89`, `handEnergy 1.06` |
| Tailoring | `fabric linen`, `weave .83`, `roughness .90`, `wear .47`, `foldScale 1.18`, `buttonMetal horn`, `seamContrast .86` |
| Costume | `hat frayedstraw`, `hair short`, `beard short`, `beardShape square`, `coat smock`, `build slim`, `accessory apron`, `sleeves rolled`, `neckwear none` |
| Palette | `skin #d5a48c`, `hairColor #886348`, `beardColor #a6532e`, `eyeColor #68765b`, `coatColor #496773`, `shirtColor #ddd0b4`, `pantsColor #4b5148`, `trim #e7c764`, `hatColor #bea364`, `hatBandColor #78603b`, `apronColor #bca987` |

The invented movement is purposeful and grounded: a slightly brisk stride, little lateral hip motion, moderate shoulder counter-motion and a gaze that stays readable through turns. The forward inclination is small; avoid hunching, jitter, bouncing or turning artistic intensity into a diagnosis. Gait factors change appearance only, preserving role, weapon and combat speed.

Coarse blue linen is portrait-supported. The exact muted palette, hat fraying, rolled sleeves, apron, horn buttons, slender body ratios, skin variation, asymmetry and motion are fictional game direction. The smock should show broad soft folds and worn seams rather than glossy plastic; beard density should leave mouth and chin structure readable. Final likeness, lineup separation, ground contact, grip and every locomotion/action state require inspection in the integrated renderer; syntax validation alone does not establish them.
