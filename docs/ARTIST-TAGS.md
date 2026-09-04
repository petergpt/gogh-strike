# Personal artist tags

Twelve original graffiti posters give the artists individual signatures. Each combines a large motif, its own composition and a short rival taunt with a work, subject or technique from that artist’s career. All slogans are newly written game dialogue. The symbols, typography and rivalry are invented; they are not historical artist signatures or quotations.

Full wall art uses detailed **512 × 512 SVGs**. Separate **256 × 256 compact emblems** keep HUD icons, weapon marks and elimination stamps legible at small sizes. Both variants retain the same artist IDs and palettes.

## Designs and sources

IDs follow the roster order in `src/factions.js`: vanguard, flanker, anchor, marksman, support, scout on each team. Colours belong to the emblem; team identification continues to use the existing ally/enemy indicators.

| Artist | Tag ID | Original emblem | Primary reference |
| --- | --- | --- | --- |
| Vincent van Gogh | `sunflower` | **STILL BLOOMING** — a many-petalled gold flower, spiral seed head and sweeping blue strokes; the headline rises across a dark brush ribbon. | [*Sunflowers*, 1888 — National Gallery](https://www.nationalgallery.org.uk/paintings/vincent-van-gogh-sunflowers). The curved accents are graphic invention, without backdating *The Starry Night*. |
| Paul Gauguin | `red_tree` | **YOUR REALITY NEEDS WORK** — a diagonal apple-tree trunk splits a crimson field into unequal planes, with oversized staggered lettering. | [*Vision of the Sermon (Jacob Wrestling with the Angel)*, 1888 — National Galleries of Scotland](https://www.nationalgalleries.org/art-and-artists/4940/vision-sermon-jacob-wrestling-angel-1888). The red ground and dividing tree guide the design. |
| Paul Cézanne | `mountain_apple` | **STILL LIFE. YOUR MOVE.** — a faceted mountain over a tilted tabletop and large apple; two assertive lines balance the composition. | [*Mont Sainte-Victoire*, 1886–87 — Phillips Collection](https://www.phillipscollection.org/sites/default/files/2024-04/up-close-with-paul-cezanne-digital-press-kit-the-phillips-collection_0.pdf); [*Still-life with apples*, 1877–78 — Fitzwilliam Museum](https://french-impressionists.fitzmuseum.cam.ac.uk/artists/cezanne/still-life-with-apples). The emblem combines two recurring subjects. |
| Georges Seurat | `dot_sun` | **POINT TAKEN** — a divided-colour sun framed by separate colour marks and two crisp diagonal text panels. | [*A Sunday on La Grande Jatte—1884*, 1884–86 — Art Institute of Chicago](https://archive.artic.edu/seurat/seurat_themes.html). Divided colour is the reference; the sun is an invented symbol. |
| Paul Signac | `dotted_sail` | **EAT MY WAKE** — a steep two-colour sail, small hull and broad curling wake; dotted sailcloth contrasts with solid headline letters. | [*Les Andelys. La Berge*, 1886 — Musée d’Orsay](https://www.musee-orsay.fr/fr/oeuvres/les-andelys-la-berge-78700), with [Signac’s maritime interests — Musée d’Orsay](https://www.musee-orsay.fr/en/program/whats-on/exhibitions/presentation/paul-signac-1863-1935). The river scene and divided colour inform a newly drawn sailing emblem. |
| Henri de Toulouse-Lautrec | `poster_star` | **YOU’RE THE WARMUP** — a kicking silhouette cuts across an oversized red star on a crooked cream-and-black showbill. | [*Moulin Rouge: La Goulue*, 1891 — The Met](https://www.metmuseum.org/art/collection/search/333990). A later-career reference to bold silhouettes and dance posters; the star and dancer outline are original. |
| Claude Monet | `lily_bridge` | **OUT OF FOCUS** — an arched bridge, water lilies and broad broken reflections fill an irregular painted field around large pastel letters. | [*Bridge over a Pond of Water Lilies*, 1899 — The Met](https://www.metmuseum.org/art/collection/search/437127). This recognisable garden motif is a deliberate later-career allusion. |
| Pierre-Auguste Renoir | `umbrella` | **THROWING BETTER SHADE** — a sweeping canopy forms the poster’s silhouette, with a curved handle and stacked warm lettering below it. | [*The Umbrellas*, about 1881–86 — National Gallery](https://www.nationalgallery.org.uk/paintings/pierre-auguste-renoir-the-umbrellas). The canopy creates a stronger silhouette than another flower or dancer. |
| Edgar Degas | `ballet_ribbon` | **MIND YOUR TURNOUT** — a dancer and a large looping ribbon cross diagonals of lilac and coral; the compact version uses tied ballet slippers. | [*The Dance Class*, 1874 — The Met](https://www.metmuseum.org/art/collection/search/438817). Dance and costume inspire the original figure and slippers; the looping gesture differs from Lautrec’s showbill. |
| Berthe Morisot | `butterfly` | **CAN’T PIN ME DOWN** — an asymmetric butterfly crosses a tilted garden panel, with loose trailing strokes and a broad green headline ribbon. | [*Chasse aux papillons* (*The Butterfly Hunt*), 1874 — Musée d’Orsay](https://www.musee-orsay.fr/en/artworks/chasse-aux-papillons-309). The motif comes from a specific work. |
| Camille Pissarro | `orchard` | **RIPE FOR DEFEAT** — receding orchard rows, blossom dabs and a foreground apple lead into a blunt harvest-coloured headline. | [*Orchard in Bloom, Louveciennes*, 1872 — National Gallery of Art](https://www.nga.gov/artworks/52195-orchard-bloom-louveciennes). Trees, cultivated ground and broken brushwork supply the reference. |
| Mary Cassatt | `opera_glasses` | **SEEN ENOUGH** — large reflective opera-glass lenses fill a theatre box, framed by plum curtains and two emphatic lines of type. | [*In the Loge*, 1878 — Museum of Fine Arts, Boston](https://collections.mfa.org/objects/31365/in-the-loge). This foregrounds Cassatt’s treatment of looking and modern public life. |

Morisot’s butterfly and Cassatt’s opera glasses follow particular artworks. Their motifs have the same status as the other ten artists’ subjects; they do not imply gendered abilities or historical combat personalities. The two later references above do not change the cast’s **31 December 1888** age anchor.

## Runtime contract

- **T** places the selected artist’s spray on a nearby wall, with a **4-second cooldown**. Placement respects the surface and clips the graphic to the geometry.
- An elimination briefly displays the successful artist’s small personal stamp. Bots may occasionally tag between fights.
- These are expressive cosmetic actions. They add no health reward, progression grind, HUD counters or separate score.

Wall art uses integrated typography and large contrasting forms. Small stamps use the separate motif-only SVGs. Seurat’s dot sun and Signac’s dotted sail remain distinct at a glance, as do the slippers and poster dancer, and the two tree designs.

## Asset API

`getArtistTag(artist)` retains `id`, `artist`, `name`, `palette` and the full `svg`, and adds `taunt`, `compactSVG` and its alias `stampSVG`. `tagDataURI(artist)` defaults to full wall art; use `tagDataURI(artist, 'compact')` for small UI marks and `'stamp'` for elimination effects. SVG lettering has explicit widths and local system-font fallbacks. There are no external font, image or filter dependencies.

The graphics are drawn locally as original interpretations. Museum images are research references and are not downloaded, traced or bundled as tag textures. Temporary decals and stamps are game effects; the source map, original town artwork and preserved reference files remain unchanged. No museum endorsement is implied.
