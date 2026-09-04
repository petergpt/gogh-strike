# Character reference and art direction — v7

The cast represents twelve adult artists at **31 December 1888**, aged 24–58. The roster, ages and fictional crew relationships are documented in [ART-WORLD.md](ART-WORLD.md). Portraits guide recognisable features; the character models remain artistic interpretations rather than authenticated likenesses or exact reconstructions of physique.

## Models and inspection

Version 7 combines an official **CC0 MakeHuman** anatomical foundation with independently designed artist profiles. Blender applies age/sex macro targets, normalizes the extracted head and neck, then shapes the artist's face, surface-fitted hair and beard, eyelids and `Blink` morph. Generated normal and roughness maps add restrained skin and fiber detail. The head joins the game's tailored body, clothing and hat; body proportions, materials and movement weights belong to each artist's profile.

Choose **Inspect artist** beside the selected name in the picker. **Face**, **Full body**, **Walk** and **Crouch** show the actual gameplay model and animation. Drag to rotate, scroll to zoom, use the previous/next arrows to compare artists, and press **Esc** to close. The focused canvas also supports arrow-key rotation, **+ / −** zoom and **Home** to reset. Portrait cards are rendered from these same assembled models.

The build exports `assets/characters/<id>-head.glb` with close and reduced distance geometry, plus editable `assets/characters/Artist-Portrait-Sculpts.blend`. Production builders and source licensing are documented in [CHARACTER-FRAMEWORK.md](CHARACTER-FRAMEWORK.md) and [PROVENANCE.md](../PROVENANCE.md). Museum artwork remains reference material; portrait pixels are not embedded in the faces or avatar cards.

## Reference sheet

The direction below describes the game’s visual choices. A portrait records how an artist was depicted at a particular time; it does not establish exact anatomy, natural colour or a permanent wardrobe. Earlier and later references are dated explicitly.

| Artist · age | Portrait reference | Character direction |
| --- | --- | --- |
| Van Gogh · 35 | [Self-Portrait as a Painter, 1888 — Courtauld](https://virtualtour.courtauld.ac.uk/gal-hotspot/self-portrait-as-a-painter/) | Red beard, angular face; frayed straw hat, rolled sleeves and painter’s apron make the silhouette readable. |
| Gauguin · 40 | [Self-Portrait with Portrait of Émile Bernard, 1888 — Van Gogh Museum](https://catalogues.vangoghmuseum.com/contemporaries-of-van-gogh-1/cat57) | Dark hair, strong moustache and nose; broad build, red slouch beret and rust-coloured coat are art direction. The self-portrait itself is deliberately symbolic. |
| Cézanne · 49 | [Self-Portrait, about 1880–81 — National Gallery](https://www.nationalgallery.org.uk/paintings/paul-cezanne-self-portrait) | Exposed forehead, full beard and broad facial planes; heavier waist and apron distinguish the anchor. |
| Seurat · 29 | [Ernest Laurent’s portrait, 1883 — Musée d’Orsay](https://www.musee-orsay.fr/fr/oeuvres/portrait-de-georges-seurat-1859-1891-200796) | Young face, dark hair and beard; a narrow, upright silhouette is an invented contrast to the older artists. |
| Signac · 25 | [Pissarro’s portrait, c.1890 — National Gallery of Art](https://www.nga.gov/artworks/10105-paul-signac-portrait-de-paul-signac) | Youthful face and full beard; a flat sailor cap and broad naval collar suggest his maritime interests. The reference is approximately two years later. |
| Toulouse-Lautrec · 24 | [Henri Rachou’s portrait, 1883 — GrandPalaisRmn guide, p.55](https://grandpalaisrmn.fr/sites/default/files/media/files/Livret_HDA_MicroFolies_Portraitdanslart.pdf); [full-length photograph, c.1892 — Fondation Gianadda catalogue, p.25](https://www.gianadda.ch/wp-content/uploads/2017/12/DP-TOULOUSE-LAUTREC-_-FONDATION-PIERRE-GIANADDA.pdf) | Dark hair, beard, glasses and a small bowler; adult upper-body proportions with shorter legs. The later photograph is a proportion reference, not an 1888 snapshot. |
| Monet · 48 | [Renoir’s portrait, 1875 — Musée d’Orsay](https://www.musee-orsay.fr/en/artworks/claude-monet-496) | Broad olive gardening hat and full beard; a broader, middle-aged face avoids using the much older garden-painter image. This portrait precedes the setting by thirteen years. |
| Renoir · 47 | [Self-Portrait, 1879 — Musée d’Orsay](https://www.musee-orsay.fr/en/artworks/portrait-de-lartiste-487) | Reddish beard and receding hair; a slimmer silhouette separates him from Monet. |
| Degas · 54 | [Apothéose de Degas, 1885 — Musée d’Orsay](https://www.musee-orsay.fr/fr/oeuvres/apotheose-de-degas-141886) | Mature face, balding head, short beard and long coat. Walter Barnes photographed this group arranged by Degas. |
| Morisot · 47 | [Self-Portrait, 1885 — Musée Marmottan Monet](https://www.marmottan.fr/collections/berthe-morisot/) | Waved gray hair, compact ribbon bonnet, long mature face and a light high-collared silhouette; the near-period self-portrait guides the character’s age. |
| Pissarro · 58 | [Self-Portrait, c.1890 — National Gallery of Art](https://www.nga.gov/artworks/42668-self-portrait-camille-pissarro-par-lui-meme) | White beard, glasses and a soft drooping cloth hat; slight stoop is animation direction. The reference is approximately two years later. |
| Cassatt · 44 | [Self-Portrait, c.1880 — Smithsonian](https://www.si.edu/object/mary-cassatt-self-portrait%3Anpg_NPG.76.33); [inventory description](https://www.si.edu/object/mary-cassatt-self-portrait-1844-1926-painting%3Asiris_ari_177533) | Asymmetric plum hat with ribbon and feather, pinned hair, mature face and high collar; distinct facial proportions and costume from Morisot. |

Morisot and Cassatt are prominent Impressionists with their own documented careers and self-portraits. Morisot was a principal member of the group; Cassatt exhibited with it four times after Degas invited her. Their inclusion and middle-aged appearance follow that history. Their combat roles are fictional. [Musée Marmottan Monet](https://www.marmottan.fr/collections/berthe-morisot/), [The Met](https://www.metmuseum.org/essays/mary-stevenson-cassatt-1844-1926)

## Proportions and limits

Toulouse-Lautrec is the exception with a cited overall height: museum exhibition material gives approximately **1.52 m** and describes shorter legs relative to his torso. The character therefore retains adult head and upper-body proportions while shortening the legs. The mesh’s precise ratios are artistic choices; the design makes no medical diagnosis or weight claim. [Fondation Gianadda, p.10](https://www.gianadda.ch/wp-content/uploads/2017/11/CahierNF_TLautrec.pdf), [GrandPalaisRmn, p.55](https://grandpalaisrmn.fr/sites/default/files/media/files/Livret_HDA_MicroFolies_Portraitdanslart.pdf)

Each `src/character-designs/<id>.js` profile supplies **dimensionless modelling factors** through `src/factions.js`: stature, shoulder/waist/hip widths, torso depth, chest and belly volume, limb lengths and thickness, hands, neck and facial proportions. Labels such as `slim` or `broad` are silhouette choices, not documented body weight. Hairline, age lines, posture, skin and eye colours are painterly approximations. No centimetres, kilograms or exact limb measurements should be inferred from these values. The notes in `docs/characters/` separate each artist's portrait evidence from invented proportions, clothing and motion.

Rounded cloth volumes, seams, cuffs, buttons, fabric weave and wear give those shapes costume structure. Eight distinct hat constructions remain, while Cézanne, Seurat, Renoir and Degas are bareheaded. Aprons, vests, smocks, frock coats and cape-like shoulders use coherent palettes; small gold/blue armbands retain crew readability. These are fictional wardrobes, not claims that an artist wore that exact costume.

Walking now uses travelled distance and planted support feet, with individual stride, head steadiness, shoulder/hip counter-motion and breathing. Crouching bends the articulated legs and torso while weapon IK keeps the grip. These body, tailoring and movement changes preserve gameplay statistics, including health, movement speed and weapon damage. The original town remains unchanged. After appearance or builder changes, rebuild the heads and regenerate the full portrait set from one stable model snapshot; exports alone do not establish final visual or gameplay acceptance.

## Fictional victory gestures

Twelve original short emotes use individual arm, torso, head and foot rhythms. They are invented competitive-game performances inspired by artistic motifs, not claims about how the historical artists moved. The shared dimensions and hit volumes stay unchanged; choreography returns to neutral and can be cancelled immediately. Weapons are slung while both hands gesture.
