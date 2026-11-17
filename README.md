# Adrift — an ocean of unsent letters

An immersive, browser-based Three.js experience. The ocean fills the entire screen. The only persistent on-screen control is an illustrated pen and letter in the bottom-right corner.

## Try it locally

Install Node.js 20.9 or newer, extract this project, open a terminal in `adrift-next`, then run:

```bash
npm install
npm run dev
```

Open **http://localhost:3000**. The app uses a browser-local demo store until you configure Supabase. You need an internet connection for the first npm install; the handwritten Caveat font loads from Google Fonts when available and falls back to local cursive fonts.

## How the experience works

1. On arrival, the Three.js camera begins high above the ocean and descends toward the waves over about 5.5 seconds. With reduced-motion enabled, the camera starts at water level.
2. Click the pen-and-paper illustration at the bottom-right. A textured letter opens. Its textarea uses a handwriting-style font.
3. Click **Seal the letter**. The paper rolls into an animated bottle. The message is *not published yet*.
4. A 3D bottle follows the pointer in front of the ocean. Move it to a spot and click or tap the water to release it. The bottle drops toward the wave surface, generates a ripple, and becomes a real drifting bottle.
5. To open an existing bottle, click it. The camera approaches, the bottle lifts, the cork rises, and the paper starts coming out. A paper sheet unrolls so you can read the message. Closing the sheet reverses the animation and returns the bottle to the ocean.
6. Hit Escape while carrying a bottle or click **Cancel** to discard an unpublished letter. Your personal letters can be edited/deleted via **My letters** at the bottom of the writing sheet.

Bottles change position continuously, using time-based currents that can be reconstructed from each letter's creation time and `drift_seed`. No continuously running physics server is required. The water uses an original GLSL shader inspired by the user's Three.js water reference: https://github.com/jeantimex/threejs-water.

## Project structure

- `components/AdriftApp.jsx` — letter UI, sealing animation, release workflow, database operations
- `components/OceanScene.jsx` — React wrapper for the Three.js scene, interaction callbacks
- `lib/ocean.js` — Three.js scene, water shader, camera descent, bottle mesh, bobbing/drift, cursor pickup/drop, read/reseal animation
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
