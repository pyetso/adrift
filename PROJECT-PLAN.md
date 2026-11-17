# Adrift — Project 2 notes

**Goal:** Build a shared 3D ocean where people leave anonymous notes in floating bottles and later discover messages left by other visitors.

**Persistent data concept:** Each bottle is a stored record. The ocean turns database entries into three-dimensional, interactive objects that remain discoverable after their author leaves.

## Essential user journeys

1. Arrive and watch a bird's-eye camera descend to water level.
2. Open the pen-and-paper illustration, write a handwritten-looking letter and seal it in a bottle.
3. Carry the bottle with the cursor and drop it into a chosen area of the ocean.
4. Discover a moving bottle, open it, read a stranger's message and return it to the sea.
5. Reopen owned letters for editing or deletion.

## Technology

- Next.js and React for the browser interface and server endpoints.
- Three.js, WebGL and GLSL for the sky, ocean, bottle meshes, and camera movements.
- Supabase PostgreSQL for cloud storage and anonymous owner authentication.
- CSS transitions and keyframes for parchment rolling and unfolding.

## Diagramming tasks for the course

Produce a UML use-case diagram, architecture diagram, data schema and feature specification. Document design precedents, screenshots of the actual 3D scene, limitations (GPU performance, accessibility, anonymity/moderation), and what was learned about API/database persistence.

## Outstanding verification and next steps

- Install npm packages on a machine with internet and run `npm run build`.
- Test bird's-eye shot and bottle interactions on a real WebGL browser; refine lighting, transparency, and camera framing based on visual review.
- Validate touch placement on mobile.
- Connect Supabase and test anonymous cross-browser access and owner-only editing/deletion.
- Publish to Vercel and verify that it works for visitors who aren't logged in to the developer's browser.
- Capture examples of AI prompts, code sources and decisions in the class process document.

This is a complete interaction prototype in source form, not yet a production-hardened public service. The current implementation includes working data APIs and a local demonstration mode.
