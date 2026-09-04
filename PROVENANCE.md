# Source provenance

## Town

Gogh Strike adapts the project's original **Van Gogh’s Town** procedural scene. An untouched source copy is included at `reference/van-goghs-town.original.html`.

| File | SHA-256 |
| --- | --- |
| `reference/van-goghs-town.original.html` (79,047 bytes) | `fae8f5213a56e3b14fea3f5c43860f24896f539daf12874052560b2ed2cf12cd` |
| `src/map.js` | `298c334bd44138622a902cfedefb256a633c728e6210b494221c86412928783d` |

The deterministic seed is 18881890. Palette definitions, brush shaders, geometry helpers, terrain, rooms, landmarks and generation order are preserved in `createTown()`. Tests compare the full preserved generation block to the original reference. Game controls, collision adapters, UI, combat, characters and bots are separate additions. The original reference includes its original CDN imports; the playable game serves its dependencies locally.

The scene generates geometry and pigment without downloading paintings or textures. Its named compositions reference The Bedroom, Café Terrace at Night, Starry Night Over the Rhône, Wheatfield with Crows and Sunflowers. The original scene and its game adaptation are distributed under this project's MIT license.

## Characters

The heads use the official MakeHuman hm08 anatomical mesh and 30 morph targets from commit `a8bc2d54ff0ac92e78ff71431b1023eda42bf482`, released under **CC0 1.0 Universal**. [The pinned manifest](vendor/makehuman/SOURCES.json) records upstream URLs and hashes; [the asset license](vendor/makehuman/LICENSE.ASSETS.md) is included.

Original Blender builders reshape the head, add fitted hair and facial hair, generate skin materials, and bake subtle local shading into vertex colours. They export high/low-detail GLBs with a Blink morph on the detailed head and save an editable Blender scene. Bodies, hats and clothes are authored runtime geometry. The same assembled models appear in gameplay, the inspector and portrait cards. No museum portrait pixels or external skin photographs are embedded.

Historical likeness research and artistic choices are separated in [the character design notes](docs/CHARACTER-DESIGN.md). Body sizes, costumes, tactical roles and movement personalities are game interpretations; documented historical facts are cited separately. Rival crews, graffiti slogans and victory dances are fictional.

## Other artwork and dependencies

Weapon previews are renders of the actual in-game weapon geometry. Crew logos and graffiti are original SVG compositions inspired by each artist's work. Effects, environment materials and audio are generated locally. No third-party fonts are bundled.

Three.js **0.170.0** and the required addons are included under MIT, with their notice at `vendor/THREE-LICENSE.txt`. The build tools do not distribute Blender or MakeHuman application code. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the licensing boundaries.

## Verification

`npm test` checks source preservation alongside movement, weapons, bots and UI-state logic. Browser checks are also needed to assess actual rendering, input capture, visual quality and performance; automated tests alone do not establish those outcomes.
