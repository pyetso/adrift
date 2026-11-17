# 003 — Give bottle release physical weight

- **Status**: TODO
- **Commit**: b326308
- **Severity**: MEDIUM
- **Category**: Physicality & origin
- **Estimated scope**: 2 files, about 70 lines plus tests

## Problem

The bottle's vertical release is a 1.07-second smoothstep:

```js
/* lib/ocean.js:466-472 — current drop */
const alpha=clamp(age/(reduced?.12:1.07),0,1);
const ease=alpha*alpha*(3-2*alpha);
group.position.x=THREE.MathUtils.lerp(group.position.x,d.dropX,Math.min(1,dt*13));
group.position.z=THREE.MathUtils.lerp(group.position.z,d.dropZ,Math.min(1,dt*13));
const h=waveHeight(d.dropX,d.dropZ,t)+.29;
group.position.y=THREE.MathUtils.lerp(d.fromY,h,ease);
if(alpha>=1&&!d.shownImpact){makeRipple(d.dropX,d.dropZ,.2);d.shownImpact=true;}
```

Smoothstep has zero velocity at both ends, so the bottle eases to a stop before
it meets the water rather than accelerating into a small impact. The ripple
does not affect the bottle's landing motion.

## Target

- Keep `onPlace()` and its rounded world coordinates called on release, so the
  existing create/persistence flow is unchanged.
- Replace only the visual fall with a gravity step using `dt`, gravity
  `9.8 world-units/s²`, and the current `waveHeight(dropX, dropZ, t)+.29`
  surface.
- On the first surface crossing, clamp the bottle to the surface, trigger one
  ripple, and set a small bounce with restitution `0.12`; cap the bounce height
  at `0.18` world units. Dampen the bounce at `4.5 s⁻¹` and settle within
  `1.1s`. The bottle must not sink below the animated surface.
- Keep the existing horizontal arrival interpolation and stop changing `x/z`
  once the bottle contacts the water.
- Keep the ghost bottle until the save callback succeeds, as in the current
  `d.saved` flow. On save failure, restore carry mode and clear fall/settle
  velocities so the next release starts cleanly.
- In reduced-motion mode, skip the bounce and complete the vertical move in
  `120ms`; still emit the release ripple.
- Put the numeric integration in a pure helper at `lib/drop-motion.mjs` so
  collision and damping can be tested without WebGL. Use seconds for `dt` and
  world units for positions/velocities.

## Repo conventions to follow

- `lib/ocean.js` owns the Three.js render loop and current water height.
- `makeRipple()` is the existing single impact feedback; use it once per drop.
- Existing logic tests use Node's built-in runner and `tests/*.test.mjs`.
- Do not add a physics engine or an animation library for one bottle.

## Steps

1. Add `lib/drop-motion.mjs` with a pure step function for airborne, impact,
   and settling states; return updated state and an `impacted` flag.
2. Add `tests/drop-motion.test.mjs` for three cases: falling positions descend
   under gravity, the first water crossing clamps to the surface and reports
   one impact, and the damped bounce settles by 1.1 seconds without crossing
   below the surface.
3. In `lib/ocean.js`, initialize vertical velocity when the carrier enters
   `dropping`, call the helper from `animate()`, and invoke `makeRipple()` only
   when its `impacted` flag first becomes true.
4. Preserve the current save-pending behavior and return-to-carry behavior on
   errors; reset the helper state on both successful removal and failed save.
5. Run the existing browser release flow in addition to the pure tests.

## Boundaries

- Do NOT change `components/AdriftApp.jsx`, API payloads, Supabase operations,
  validation, or CRUD behavior.
- Do NOT add a second ripple or start the save request later than the current
  pointer release.
- Do NOT let a failed save discard the draft or ghost bottle.

## Verification

- **Mechanical**: run `npm run check:logic` and `npm run build`; expect the new
  integration tests and all existing validation tests to pass.
- **Feel check**: release a bottle from a high cursor position. In slow motion,
  confirm it accelerates down, touches the live wave surface, gives one modest
  bounce, and settles without sinking. Repeat with reduced motion enabled.
- Simulate a rejected save and confirm the bottle returns to pointer-following
  mode and can be released again.
- **Done when**: release reads as a short fall and buoyant landing, with one
  impact ripple and unchanged persistence semantics.
