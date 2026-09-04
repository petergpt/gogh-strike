# Henri de Toulouse-Lautrec · 24 in 1888

The figure keeps an adult head, hands and upper torso above distinctly short legs. The approximate **1.52 m** stature comes from [GrandPalaisRmn, p.55](https://grandpalaisrmn.fr/sites/default/files/media/files/Livret_HDA_MicroFolies_Portraitdanslart.pdf). All mesh ratios below are artistic choices. This design assigns no medical condition or historical gait.

At gameplay distance the three principal cues are the small domed bowler; the long adult torso above short trouser legs; and the straight, split silhouette of a dark frock coat with a pale collar. The glasses and close beard reinforce recognition in the portrait view. The body is not uniformly miniaturised.

The [Musée des Augustins Rachou portrait, 1883, RO 1020](https://collections.augustins.toulouse.fr/fr/notice/ro-1020-portrait-du-peintre-henri-de-toulouse-lautrec-0b227dc2-9fe3-42c4-baa9-4398ff06a82b) was opened and visually inspected. Three face cues guide the sculpture: strong dark brows above contained eyes; a long projecting nose; and a full mouth with youthful cheeks and a narrower chin. It predates the setting by five years. [The museum’s portrait discussion](https://augustins.toulouse.fr/conferences-en-ligne/) also describes the smooth, full young face and careful clothing. The [Gianadda catalogue, p.25](https://www.gianadda.ch/wp-content/uploads/2017/12/DP-TOULOUSE-LAUTREC-_-FONDATION-PIERRE-GIANADDA.pdf), opened as text, identifies Guibert’s full-length photograph as **c.1892** and credits Musée Toulouse-Lautrec; it remains a dated proportion reference, not an 1888 snapshot. Its image could not be rendered by the web screenshot tool in this pass.

Movement direction is composed and observant: compact travelled-distance steps, modest cadence, low vertical lift, restrained shoulder counter-motion and a steady head. Turning and hand activity stay responsive. These are invented game animation choices; there is no comic waddle, artificial limp or diagnostic claim. Aim, crouch, reload and emotes use the shared rig and unchanged gameplay rules.

The supported controls in [the profile](../../src/character-designs/lautrec.js) are explicit:

| Group | Exact values |
| --- | --- |
| Body | `stature .8444444444`, `shoulderWidth 1.06`, `waistWidth 1.06`, `hipWidth 1.03`, `torsoDepth 1.04`, `belly .12`, `chest .18`, `legLength .65`, `torsoLength 1.13`, `legThickness .96`, `neckWidth 1.04`, `handScale 1.04`, `headWidth 1.05`, `headLength 1.03`, `stoop .014` |
| Face structure | `jawWidth 1.05`, `chinWidth .94`, `cheekbone 1.03`, `cheekFullness .43`, `foreheadSlope .21`, `noseLength 1.22`, `noseWidth 1.12`, `noseBridge 1.21`, `noseTip 1.1`, `earSize 1.02` |
| Eyes and mouth | `eyeSpacing .96`, `eyeSize .93`, `eyeTilt -.035`, `eyeDepth .46`, `browWeight 1.24`, `lidWeight .35`, `mouthWidth 1.06`, `lipFullness 1.13` |
| Age and hair | `age .08`, `asymmetry .045`, `freckles .025`, `beardLength .88`, `beardDensity 1.07`, `moustacheShape trimmed`, `hairPart -.28`, `hairWave .62`; legacy `hairline .1`, `ageLines .1` |
| Motion | `cadence 1.1`, `stride .88`, `hipSway .72`, `shoulderSway .76`, `forwardLean .026`, `headSteadiness 1.22`, `stanceWidth 1.08`, `footLift .9`, `idleBreath .87`, `turnLag .9`, `handEnergy .9` |
| Construction | `hat bowler`, `hair curly`, `beard short`, `beardShape square`, `coat frock`, `sleeves cuffed`, `neckwear bow`, `accessory glasses`, `build broad` |
| Surface | `fabric wool`, `weave .42`, `roughness .83`, `wear .18`, `foldScale .78`, `buttonMetal horn`, `seamContrast .74` |
| Palette | Skin `#d8b395`, eyes `#4f4a3a`, hair `#332b28`, beard `#3a2e2a`, coat `#52454e`, shirt `#e3d6bd`, trousers `#48454a`, trim `#bc9b6a`, hat `#322e32`, band `#514346` |

The smoky plum wool, subdued band, horn buttons, bow, precise build and facial measurements are invented art direction. The short square beard advances the younger portrait toward the game’s adult 1888 interpretation; colour values are not claims about natural complexion or eye colour. The prescribed body factors yield `legScale / torsoScale = .65 / 1.13 ≈ .5752`, preserving the `< .65` invariant while leaving adult upper-body proportions.

Profile syntax and direct body-profile invariants are checked locally. Final front/three-quarter portraits, foot contact and all shared-rig movement states require the integrated renderer review.
