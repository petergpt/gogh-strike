# Development

## Runtime

The game is an ES-module Three.js application without a bundler. `index.html` maps Three.js imports to the pinned `vendor/` files. `server.mjs` is a small loopback-only development server. `npm run build` copies an explicit browser-only set into `dist/`; the result can be hosted at a domain root over HTTPS.

- `src/map.js`: preserved procedural town.
- `src/game.js`: fixed-step simulation, match integration and input.
- `src/loadout.js`, `src/combat.js`, `src/weapon-view.js`: equipment, shooting and first-person handling.
- `src/bots.js`, `src/physics.js`: bot decisions, navigation and collision.
- `src/ui.js`, `src/style.css`: HUD, menus and match presentation.
- `src/actors.js`, `src/character-motion.js`: bodies, costumes, IK and animation.
- `src/character-designs/`: twelve character profiles.

`npm ci && npm test` runs the Node test suite. `?test=1` enables a local diagnostic game API for browser fixtures; normal visits do not enable it. `character-studio.html` is the development cast inspection page. Use browser play-tests to verify pointer capture, pause/resume, a full match, low/high frame rates, and the actual visual result after meaningful changes.

## Rebuild characters

Prebuilt models are included, so these tools are optional. To change head geometry or materials, use Blender 5.x with Python support:

```sh
node tools/export-character-designs.mjs
blender --background --factory-startup --python tools/build-character-heads.py
npm run optimize:characters
```

The profile export is generated under `build/characters/`. The Blender build writes the twelve GLBs, manifest and editable `Artist-Portrait-Sculpts.blend` to `assets/characters/`. Generated Blender scene files stay out of Git. The optimizer losslessly extracts shared textures from the GLBs, avoiding repeated downloads; it preserves all geometry, materials, morphs and image pixels. You can build a subset in a separate folder:

```sh
blender --background --factory-startup --python tools/build-character-heads.py -- --output build/character-preview --only van-gogh,morisot
```

On macOS, Blender needs access to the GPU even in background mode. Run it in a normal user shell with working Metal access. The [character framework](CHARACTER-FRAMEWORK.md) documents proportions, facial controls and materials.

## Render portraits

Install the `agent-browser` CLI separately and run `npm start`. The portrait script captures the same models used by the game. Python 3 and a browser with WebGL support are required; the script does not install dependencies.

```sh
python3 tools/render-character-portraits.py --new-session portraits --artist van-gogh
```

Use `--help` for preview, browser and output options. Once the complete cast has been visually checked, `--finalize` captures and validates all cards and faces before replacing any shipped portraits. A failed capture leaves existing portraits in place. The render manifest verifies the exact served source and GLB hashes. Temporary previews, build directories and evidence are intentionally ignored by Git.

## Contributions

Keep the town source-preservation tests passing. Make changes in the relevant gameplay or presentation modules, add regression tests for real behavioral fixes, and inspect rendering in a hardware-accelerated browser. Character art changes need both close-up and full-body checks, including walking, crouching, aiming and held-weapon alignment.
