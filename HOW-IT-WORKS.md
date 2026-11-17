# Interaction and persistence flow

## A visitor arrives

`OceanScene.jsx` loads `lib/ocean.js` only on the client, because Three.js needs WebGL and the browser DOM. `initOcean()` creates a perspective camera, animated water geometry with GLSL shaders, a sky dome, lights, and glass-bottle meshes. Its camera starts at `(0,72,14)` and eases toward `(0,4.1,12.5)` over 6.2 seconds, following a slight arc while turning toward the horizon.

## A visitor writes

`AdriftApp.jsx` contains the state for the letter: text, optional signature and editing mode. The letter uses a real HTML textarea, so typing, selection, pasting and keyboard accessibility still work. Pressing **Seal the letter** validates the text and starts a 1.85-second visual animation in `globals.css`. At this point the content is a draft only; it hasn't been sent to the server.

## A visitor places the bottle

Once sealing is complete, `AdriftApp` tells `OceanScene` to enter carry mode. `lib/ocean.js` creates a temporary 3D bottle, follows pointer movement using a camera ray and plane intersection, and places it on release. On placement, the bottle falls to the animated water surface and calls the `onPlace()` callback with clamped world coordinates. The React app then uses either the localStorage demo store or an authenticated POST `/api/bottles` request to create the record. The released bottle becomes part of the shared/preview scene, and a ripple marks impact. If saving fails, the ghost bottle returns to carry mode rather than silently discarding the message.

## A visitor reads

The Three.js raycaster detects clicks on enlarged invisible hit meshes, not on the fragile transparent surface. Selection triggers a 3D transition: camera focus, lifting bottle, moving cork and paper. The application opens a parchment reading overlay; the unroll animation is CSS. Closing reverses the paper transition, resets focus and lets the bottle resume drifting.

## Drift algorithm

Each record stores `start_x`, `start_z`, `drift_seed` and `created_at`. On every frame, the client calculates movement from the letter's age and several low-frequency sine currents, then applies the current water height as buoyancy. The calculation is deterministic from stored fields and current time, so visitors can see consistent approximate motion without writing location updates to the database.

## Data lifecycle

- POST `/api/bottles` creates a bottle with validated message and bounded release coordinates.
- GET `/api/bottles` retrieves floating letters to display.
- GET `/api/bottles/mine` returns the signed-in anonymous user's bottles.
- PUT `/api/bottles/[id]` edits the author's own message.
- DELETE `/api/bottles/[id]` removes the author's bottle.
- POST `/api/bottles/[id]/report` reports harmful messages for review.

Demo mode stores letters in the visitor's local browser only. Supabase authentication and database settings are needed before messages are shared across devices. The user can find edit/delete controls within the writing sheet's **My letters** link; they are deliberately not part of the ocean's permanent screen interface.

## Verification limits

Logic tests and JSX parsing were checked in the development environment. A complete Next.js build and visual WebGL interaction still require running the project locally with npm dependencies installed.
