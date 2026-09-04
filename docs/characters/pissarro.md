# Camille Pissarro · 58 in 1888

The profile represents Pissarro at 31 December 1888. Portrait evidence guides a sculptural interpretation. Body ratios, posture, movement and garment construction are invented game art direction, not measured historical anatomy.

Three gameplay-distance features carry his identity:

1. A **low, asymmetrically drooping cloth hat**, retained as `hat: 'floppy'`, makes a soft silhouette above the head. Its light taupe crown sits over a dark smock.
2. A **long flowing gray-white beard** extends below the chin and narrows toward the chest. `beardShape: 'flowing'`, `beardLength: 1.31` and `beardDensity: 1.18` make length, rather than a round beard mass, the main facial silhouette.
3. **Gently inclined shoulders and a loose cuffed smock** give the torso a modest waist-led fullness. `shoulderWidth: 0.97`, `waistWidth: 1.07`, `belly: 0.22` and `stoop: 0.075` keep a natural adult build and ordinary leg proportions.

Three facial features are grounded in opened museum references:

- **Eyes and glasses:** the [NGA self-portrait, c.1890](https://www.nga.gov/artworks/42668-self-portrait-camille-pissarro-par-lui-meme) describes deep-set eyes looking above low half-moon glasses. `eyeDepth: 0.68`, `eyeSize: 0.91`, `lidWeight: 0.72` and the existing glasses accessory keep the eyes visible within a mature orbital structure. The reference is approximately two years later.
- **Beard and moustache:** that NGA print supports the pale extended beard and mouth obscured by moustache. A warm gray-white beard and `moustacheShape: 'drooping'` form an unbroken, directional hair mass; the underlying lips remain modelled. Natural eye, hair and skin colours are approximations because the print is monochrome.
- **Forehead, brow and nose:** the [Musée d'Orsay self-portrait, 1873](https://www.musee-orsay.fr/fr/oeuvres/portrait-de-lartiste-366), whose image was visually inspected, shows a high exposed forehead, substantial brow and long nose. `hairline: 0.92`, `browWeight: 1.18`, `noseLength: 1.21` and `noseBridge: 1.17` translate those relationships. This earlier portrait is used for structure, not copied as his age in 1888.

The bark-brown linen smock, taupe hat, sage shirt, blue-gray trousers, pale blue trim, kerchief, horn buttons, modest waist fullness and gait are intentional inventions. The chosen colours make the pale beard readable in the town; no exact height, weight or personal wardrobe claim follows from them.

The full supported control choices in [pissarro.js](../../src/character-designs/pissarro.js) are:

| Group | Values |
| --- | --- |
| Body | `stature 0.985`, `shoulderWidth 0.97`, `waistWidth 1.07`, `hipWidth 1.03`, `torsoDepth 1.04`, `belly 0.22`, `chest 0.20`, `legLength 0.98`, `torsoLength 1.04`, `legThickness 0.98`, `neckWidth 0.94`, `handScale 1.02`, `headWidth 0.98`, `headLength 1.08`, `stoop 0.075`, `hairline 0.92`, `ageLines 0.72` |
| Costume | `hat floppy`, `hair bald`, `beard full`, `beardShape flowing`, `build slim`, `coat smock`, `sleeves cuffed`, `neckwear kerchief`, `accessory glasses` |
| Palette | `skin #cba58b`, `hairColor #aaa99d`, `beardColor #dad8cb`, `eyeColor #47473e`, `coatColor #655e4b`, `shirtColor #c0c3af`, `pantsColor #505b5d`, `trim #94b6bd`, `hatColor #a29c87`, `hatBandColor #756f60` |
| Face | `jawWidth 0.98`, `chinWidth 0.91`, `cheekbone 1.07`, `cheekFullness 0.38`, `foreheadSlope 0.44`, `noseLength 1.21`, `noseWidth 1.03`, `noseBridge 1.17`, `noseTip 1.06`, `eyeSpacing 0.97`, `eyeSize 0.91`, `eyeTilt -0.024`, `eyeDepth 0.68`, `browWeight 1.18`, `lidWeight 0.72`, `mouthWidth 0.99`, `lipFullness 0.77`, `earSize 1.10`, `age 0.72`, `asymmetry 0.045`, `freckles 0.04`, `beardLength 1.31`, `beardDensity 1.18`, `moustacheShape drooping`, `hairPart 0.08`, `hairWave 0.30` |
| Motion | `cadence 0.94`, `stride 0.96`, `hipSway 0.78`, `shoulderSway 0.83`, `forwardLean 0.026`, `headSteadiness 1.20`, `stanceWidth 1.08`, `footLift 0.92`, `idleBreath 0.88`, `turnLag 1.13`, `handEnergy 0.77` |
| Tailoring | `fabric linen`, `weave 0.72`, `roughness 0.91`, `wear 0.34`, `foldScale 1.17`, `buttonMetal horn`, `seamContrast 0.65` |

Movement uses quiet shoulders and hips, a steady gaze, modest foot clearance and a small torso follow-through on turns. The gentle resting stoop stays restrained when combined with forward lean. Grounded weight transfer should still read as capable movement, with no shaking, shuffling or age gag. These weights do not alter combat speed or statistics.

The linen is matte, moderately worn and softly folded; restrained seams prevent the smock competing with facial detail. No artwork is embedded in the character. `node --check src/character-designs/pissarro.js` verifies syntax; final integrated front/three-quarter portraits, lineup comparison and locomotion, crouch, aim/reload, emotes, foot contact and weapon grip still require visual review by the integration owner.
