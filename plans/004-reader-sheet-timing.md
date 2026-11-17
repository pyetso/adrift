# 004 — Tighten the reader sheet reveal

- **Status**: TODO
- **Commit**: b326308
- **Severity**: MEDIUM
- **Category**: Easing & duration
- **Estimated scope**: 2 files, about 15 lines

## Problem

The general parchment entrance is 580ms and the reader unroll is 780ms; the
reader close is 620ms. The current transitions are:

```css
/* app/globals.css:28 */
animation:paper-arrive .58s cubic-bezier(.17,.81,.28,1.0) both
```

```css
/* app/globals.css:51,56 */
.reader-dialog{...animation:unroll-paper .78s cubic-bezier(.2,.75,.25,1) both}
.reader-closing{animation:reroll-paper .62s cubic-bezier(.64,0,.75,.16) both!important}
```

The close timer duplicates the 620ms CSS duration:

```js
/* components/AdriftApp.jsx:11 */
const CLOSE_DURATION=620;
```

The reader is an occasional sheet transition, but the reveal currently exceeds
the audit guide's 500ms maximum for sheets; the `ease-in`-shaped close also
starts slowly when the visitor is waiting for the ocean again.

## Target

- Add shared CSS tokens in `:root` using the exact guide values:

  ```css
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
  ```

- Set the generic sheet entrance to `420ms var(--ease-out)`.
- Set the reader unroll to `480ms var(--ease-out)`.
- Set the reader close keyframe to `400ms var(--ease-out)` and set
  `CLOSE_DURATION=400` in `components/AdriftApp.jsx` so React removes the sheet
  on the same frame the CSS close ends.
- Keep the existing transform keyframes and paper-roll silhouette. Do not
  replace the paper metaphor with a generic fade.
- Keep the 1.85-second seal choreography unchanged; it is a rare, explanatory
  sequence whose CSS bottle entrance currently completes at 1.8 seconds.

## Repo conventions to follow

- CSS motion is currently defined in `app/globals.css`; there is no animation
  package or pre-existing easing-token system.
- `components/AdriftApp.jsx` owns the completion timer for the reader close.
  Keep that timer synchronized with its CSS duration.
- The reader camera focus delay is 760ms in `lib/ocean.js:397`; leave it
  unchanged so the camera still approaches before the paper opens.

## Steps

1. Add `--ease-out` and `--ease-in-out` to the existing `:root` declaration in
   `app/globals.css`, using the exact cubic-bezier values above.
2. Change only the generic paper entrance, reader open, and reader close
   durations/easings to the targets above.
3. Change `CLOSE_DURATION` from 620 to 400 in `components/AdriftApp.jsx`.
4. Confirm the reduced-motion rule in plan 005 still overrides these normal
   motion values without reintroducing movement.

## Boundaries

- Do NOT alter `SEAL_DURATION`, sealing SVG keyframes, Three.js camera timing,
  bottle opening, or the database/API flow.
- Do NOT use `transition: all`.
- If the paper appears to snap because the unroll transform is too large for
  480ms, preserve the 480ms target and adjust only the keyframe's intermediate
  opacity—not its end transform—then report the visual difference.

## Verification

- **Mechanical**: run `npm run check:logic` and `npm run build`; expect both to
  pass.
- **Feel check**: open a bottle, confirm the camera still arrives before the
  parchment reveal, then close it and confirm the sheet and selected bottle
  return to the ocean together. Use DevTools at 10% playback to verify no
  duplicate state is visible after the 400ms close.
- **Done when**: sheet open and close are each at or below 500ms, with the
  physical paper-roll reveal intact and the timer/CSS close synchronized.
