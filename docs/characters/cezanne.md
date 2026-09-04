# Paul Cézanne · 49 in 1888

The anchor reads as a substantial, mature man. His proportions are deliberate game sculpture, with no claim about historical height or weight. All three museum pages below were opened during design research. The portraits predate 1888; the face receives moderate additional age, not the white-haired appearance of his final years.

At gameplay distance, three forms identify him: **a bare domed head over a broad fan beard**; **a deep belly and waist wider than the shoulders under a short waistcoat**; **rolled pale sleeves above an ochre waist apron and thick, relatively short legs**. Earth colours support the silhouette; they do not carry its recognition alone.

| Face feature | Evidence and interpretation |
| --- | --- |
| Exposed rounded forehead; quiet, slightly unequal eyes | [National Gallery, *Self Portrait*, about 1880–81](https://www.nationalgallery.org.uk/paintings/paul-cezanne-self-portrait). Its account identifies the cranial dome and unequal eyes. Recession, eyelid weight and restrained asymmetry preserve those distinctions. |
| Broad nose, eyes sitting beneath strong brows | [National Gallery of Art, *Self-Portrait [recto]*, c. 1880/1882](https://www.nga.gov/artworks/66485-self-portrait-recto). The graphite three-quarter head is the form reference. Its page's visual description is explicitly automated, so these are qualitative design cues, not anatomical findings. |
| Full uneven facial planes; heavy beard partly concealing the mouth | [The Phillips Collection, *Self-Portrait*, 1878–80](https://www.phillipscollection.org/collection/self-portrait). The museum discusses the balding head, ruddy face, and beard obscuring mouth and neck. Moderate cheeks, a dense fan beard and drooping moustache carry that reading. |

Movement is grounded: compact strides, wider foot placement, subdued lateral sway and hands, a steady gaze, and a little torso lag on turns. Gentle breathing gives the substantial torso life. These weights alter visual motion only; speed, weapon, combat role and balance stay with the existing character.

The complete supported choices are in [cezanne.js](../../src/character-designs/cezanne.js):

| Group | Exact controls |
| --- | --- |
| Body | `stature .99`, `shoulderWidth 1.18`, `waistWidth 1.40`, `hipWidth 1.18`, `torsoDepth 1.30`, `belly .74`, `chest .30`, `legLength .94`, `torsoLength 1.10`, `legThickness 1.23`, `neckWidth 1.16`, `handScale 1.07`, `headWidth 1.12`, `headLength .99`, `stoop .05`, `build broad`. |
| Hair and face | `hair bald`, `hat none`, `hairline .90`, `ageLines .64`, `beard full`, `beardShape fan`; `jawWidth 1.16`, `chinWidth 1.10`, `cheekbone 1.12`, `cheekFullness .65`, `foreheadSlope .38`, `noseLength 1.08`, `noseWidth 1.21`, `noseBridge 1.09`, `noseTip 1.10`, `eyeSpacing .98`, `eyeSize .90`, `eyeTilt -.025`, `eyeDepth .65`, `browWeight 1.23`, `lidWeight .64`, `mouthWidth 1.06`, `lipFullness .82`, `earSize 1.10`, `age .64`, `asymmetry .08`, `freckles .04`, `beardLength 1.20`, `beardDensity 1.25`, `moustacheShape drooping`, `hairPart 0`, `hairWave .32`. Legacy jaw/nose/brow values match. |
| Costume and palette | `coat vest`, `sleeves rolled`, `neckwear none`, `accessory waistapron`; skin `#d2a681`, eyes `#615345`, hair `#65594d`, beard `#706252`, waistcoat `#575348`, shirt `#cfc2a8`, trousers `#4f483c`, trim `#b9a466`, apron `#aa9471`. No inactive hat palette is supplied. |
| Motion | `cadence .91`, `stride .91`, `hipSway .74`, `shoulderSway .86`, `forwardLean .025`, `headSteadiness 1.20`, `stanceWidth 1.18`, `footLift .90`, `idleBreath 1.08`, `turnLag 1.17`, `handEnergy .72`. |
| Material | `fabric wool`, `weave .72`, `roughness .89`, `wear .34`, `foldScale .93`, `buttonMetal horn`, `seamContrast .73`. The dominant wool waistcoat is matte and modestly worn, with readable folds and quiet seams. |

The stocky build, belly, relative limb lengths, waistcoat-and-apron ensemble, exact colours and movement are invented. Portrait light and paint do not establish natural skin or eye colour. The grey-brown hair is a restrained age interpretation. The character remains bareheaded as assigned. Front, three-quarter and moving-game inspection remain integration acceptance gates; syntax validation alone does not establish final visual quality.
