# Adrift — an ocean of unsent letters

An immersive, browser-based Three.js experience. The ocean fills the entire screen; the illustrated pen and letter remain the one writing control.

## Try it locally

Install Node.js 20.9 or newer, extract this project, open a terminal in `adrift-next`, then run:

```bash
npm install
npm run dev
```

Open **http://localhost:3000**. The app uses a browser-local demo store until you configure Supabase. You need an internet connection for the first npm install; Caveat and DM Sans load from Google Fonts when available and fall back to local fonts.

## How the experience works

1. On arrival, the Three.js camera begins high above the ocean and descends in a gentle arc toward the horizon over about 6.2 seconds. With reduced-motion enabled, the camera starts at water level.
   The scene asks once for your location to calculate the sun's position entirely in your browser. Coordinates are not sent or saved. If location is unavailable or denied, the ocean uses an explicitly approximate day cycle based on your device's local clock.
   Drag to look, use **WASD** to move across the ocean, and use the arrow keys to adjust your view. Touch screens have a four-way movement pad and swipe-to-look controls.
2. Click the pen-and-paper illustration at the bottom-right. A textured letter opens. Its textarea uses a handwriting-style font.
3. Click **Seal the letter**. The paper rolls into an animated bottle. The message is *not published yet*.
4. A 3D bottle follows the pointer in front of the ocean. Drag it to a spot and release to drop it into the water. The bottle falls toward the wave surface, generates a ripple, and becomes a real drifting bottle.
5. To open an existing bottle, click it. The camera approaches, the bottle lifts, the cork rises, and the paper starts coming out. A paper sheet unrolls so you can read the message. Closing the sheet reverses the animation and returns the bottle to the ocean.
6. Hit Escape while carrying a bottle or click **Cancel** to discard an unpublished letter. Select the bottle icon in the bottom-left corner to browse and manage your letters.

Bottles follow seeded, time-based currents across the navigable ocean. Their positions can be reconstructed from each letter's creation time and `drift_seed`; no continuously running physics server or database location updates are required. The navigable field stays within the coordinate limits already accepted by `database/schema.sql`.

The water uses a 104-segment mobile / 120-segment desktop triangular grid with flat reflections and a restrained sea-glass palette. Procedural, flattened sphere-lobe clouds use jittered low-poly geometry and shift with the local sky light. The horizon fog follows the same solar palette. Bottles, corks, and splash rings use simplified low-sided geometry. The clouds use an original implementation inspired by the broad technique in [Procedural Geometry for Low-Poly Clouds](https://medium.com/@joshmarinacci/procedural-geometry-low-poly-clouds-b86a0e66bcad); the water shader is original and inspired by [Three.js water](https://github.com/jeantimex/threejs-water).

## Project structure

- `components/AdriftApp.jsx` — letter UI, sealing animation, release workflow, database operations
- `components/OceanScene.jsx` — React wrapper for the Three.js scene, interaction callbacks
- `lib/ocean.js` — Three.js scene, atmospheric shaders, camera descent and flight, clouds, bottle drift, pickup/drop, read/reseal animation
- `lib/bottle-drift.mjs` — deterministic current paths for bottles
- `lib/ocean-bounds.mjs` — shared exploration and storage bounds
- `app/globals.css` — minimalist ocean UI, illustrated pen and paper, parchment and animation keyframes
- `app/api/bottles/` — REST API with GET/POST/PUT/DELETE and report endpoint
- `lib/validation.mjs` — input validation and safe release coordinates
- `lib/demo-store.js` — localStorage demo persistence
- `database/schema.sql` — Supabase database schema + access controls

## Make it public

Create a Supabase project and run `database/schema.sql` in its SQL editor. Copy `.env.example` to `.env.local`, then supply Supabase URL, publishable/anon key, and server credentials as described in that file. Restart the dev server. Messages will then be stored in Supabase and shared between visitors. Do not expose a service-role key in client code.

## Tests

```bash
npm run check:logic
npm run build
```

## Important notes

- The water and bottles are real 3D WebGL objects, not an image; the sealing/unrolling parchment transitions use CSS animations layered over the 3D scene.
- This build is intended to be reviewed in Chrome or Edge on a WebGL-capable computer. Performance can vary by GPU.
- If the browser cannot render WebGL, the page falls back to a painted ocean scene. Public multiplayer letters require Supabase configuration; demo letters are local to the current browser.
- Reduced-motion settings disable or shorten immersive motion.
- For classroom documentation, credit the Three.js water reference and any external 3D/typography resources used.
