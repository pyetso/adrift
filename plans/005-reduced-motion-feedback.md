# 005 — Preserve feedback for reduced motion

- **Status**: TODO
- **Commit**: b326308
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 2 files, about 30 lines

## Problem

The reduced-motion preference currently stops the ocean clock and bottle drift:

```js
/* lib/ocean.js:425,438-442 — current behavior */
if(!reduced)elapsed+=dt;
...
(reduced?0:
  2.6*(Math.sin(age*waveA+seed)-Math.sin(seed))+
  1.15*(Math.sin(age*waveB+seed*.77)-Math.sin(seed*.77)))
```

The CSS then collapses every listed animation to 0.01ms:

```css
/* app/globals.css:86 — current behavior */
@media(prefers-reduced-motion:reduce){...animation-duration:.01ms!important;animation-delay:0ms!important}
```

This removes not just spatial movement but also the opacity feedback that
helps explain opening, closing, and sealing. The preference is sampled once in
`lib/ocean.js:284`, so changing it while the page is open has no effect.

## Target

- Keep the current reduced-motion behavior that skips the aerial camera path
  and stops ambient wave/bottle displacement; do not reintroduce automatic
  spatial motion for visitors who request reduced motion.
- Replace the blanket `.01ms` override with 160ms opacity-only feedback using
  `var(--ease-out)`:
  - modal/paper arrival and the sealing bottle: fade in;
  - reader close and sealing paper: fade out;
  - do not animate `transform`, `filter`, or position in the reduced-motion
    keyframes.
- Keep color/focus feedback on buttons. Do not add a movement transition to
  focus states.
- Gate the pen's hover lift/rotation behind
  `@media (hover: hover) and (pointer: fine)` so touch does not leave a false
  hover state.
- Keep bottle click/open, release, cancellation, and persistence fully
  functional in reduced-motion mode.
- Listen for changes to the existing media query while the page is open and
  remove the listener in `destroy()`. When the preference turns on, stop
  advancing the scene clock; when it turns off, resume from the paused time
  without replaying the initial camera descent.

## Repo conventions to follow

- `lib/ocean.js` already branches on `window.matchMedia('(prefers-reduced-motion: reduce)')`.
  Extend that existing browser-only path rather than adding React state or a
  dependency.
- CSS motion is in `app/globals.css`; keep the reduced-motion rules adjacent
  to the existing media query.
- The rest of the site has a single ocean canvas and minimal UI; do not add a
  reduced-motion toggle or extra interface.

## Steps

1. In `lib/ocean.js`, keep the `MediaQueryList`, make the preference mutable,
   add a `change` listener, and remove it in `destroy()`.
2. Preserve the no-camera-intro and no-ambient-position-drift behavior when
   the preference is on.
3. In `app/globals.css`, define reduced-motion fade-in and fade-out keyframes
   that animate only `opacity` for 160ms with `var(--ease-out)`. Assign them
   to the modal, paper, reader-close, sealing-dialog, bottle, and caption
   states that currently receive the `.01ms` override.
4. Wrap `.write-trigger:hover` movement in the fine-pointer/hover media query.
   Keep its focus-visible outline available on all inputs.
5. Test toggling the emulated preference both before page load and while the
   ocean is open.

## Boundaries

- Do NOT add ambient movement under reduced motion.
- Do NOT remove the fixed end states needed to read letters, carry/release
  bottles, or close sheets.
- Do NOT change normal-motion durations or the seal/drop physics.
- Do NOT remove keyboard focus outlines or touch targets.

## Verification

- **Mechanical**: run `npm run check:logic` and `npm run build`; expect both to
  pass.
- **Feel check**: with reduced motion enabled, confirm the camera starts at
  water level, the water and bottles remain still, and opening/closing still
  has a short opacity cue without translation, scale, rotation, or blur.
  Toggle the setting while the page is open and confirm the scene stops/resumes
  without replaying the descent.
- Test the pen on touch emulation and confirm tapping does not trigger a stuck
  hover lift.
- **Done when**: reduced motion removes automatic spatial movement but retains
  brief state feedback and all interactions.
