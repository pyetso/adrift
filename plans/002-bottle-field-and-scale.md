# 002 — Expand bottle drift coverage

- **Status**: TODO
- **Commit**: b326308
- **Severity**: MEDIUM
- **Category**: Purpose & frequency
- **Estimated scope**: 3 files, about 50 lines plus tests

## Problem

Each bottle stays near its saved release point. The current horizontal drift
has a maximum offset of about 7.5 units and the depth drift about 5.8 units:

```js
/* lib/ocean.js:438-442 — current trajectory */
const x=(Number(d.b.start_x)||0)+(reduced?0:
  2.6*(Math.sin(age*waveA+seed)-Math.sin(seed))+
  1.15*(Math.sin(age*waveB+seed*.77)-Math.sin(seed*.77)));
const z=(Number(d.b.start_z)||-6)+(reduced?0:
  2.1*(Math.sin(age*.018+seed*1.3)-Math.sin(seed*1.3))+
  .8*(Math.cos(age*.047+seed*.8)-Math.cos(seed*.8)));
```

Random fallback positions are narrower than the valid release bounds:

```js
/* lib/validation.mjs:28-29 — current random range and placement clamp */
start_x: Number.isFinite(input.start_x) ? Math.max(-17, Math.min(17, Math.round(input.start_x * 100) / 100)) : Math.round((Math.random() * 18 - 9) * 100) / 100,
start_z: Number.isFinite(input.start_z) ? Math.max(-30, Math.min(1, Math.round(input.start_z * 100) / 100)) : Math.round((-5 - Math.random() * 20) * 100) / 100,
```

The held bottle is also larger than a floating one: `object.scale.setScalar(1.34)`
at `lib/ocean.js:230` is multiplied by `group.scale.setScalar(1.1)` at line 333.

## Target

- Keep all stored `start_x`, `start_z`, `drift_seed`, and creation timestamps.
  Keep the existing valid coordinate domain `x[-17,17]`, `z[-30,1]`.
- Make new random fallback positions uniform across that entire domain:
  `x = Math.random()*34 - 17`, `z = Math.random()*31 - 30`.
- Expand the deterministic drift while keeping the position anchored at the
  saved release coordinates when `age === 0`. For the expanded path, use:

  ```js
  const expandedX = startX
    + 8.5*(Math.sin(age*.008+seed)-Math.sin(seed))
    + 4*(Math.sin(age*.019+seed*.77)-Math.sin(seed*.77));
  const expandedZ = startZ
    + 13*(Math.sin(age*.006+seed*1.3)-Math.sin(seed*1.3))
    + 5*(Math.cos(age*.014+seed*.8)-Math.cos(seed*.8));
  ```

- Clamp the final position to the same valid domain; do not clamp the stored
  origin or change API validation.
- Avoid an initial position jump for existing records. For the first 1200ms
  after scene initialization, interpolate from the current trajectory to the
  expanded trajectory using `THREE.MathUtils.smoothstep`; after that, use the
  expanded path. Both paths must be calculated from the same stored record and
  current time, never from per-frame randomness.
- Keep normal bottles at `object.scale.setScalar(1.15)`. Remove the extra
  `group.scale.setScalar(1.1)` on the carried bottle so it uses the same visible
  model scale. Do not shrink `pickGeometry` or its pick mesh scale; preserve the
  generous invisible selection target.
- In reduced-motion mode, preserve the saved position and do not advance drift.

## Repo conventions to follow

- Bottle movement is derived from stored fields in `lib/ocean.js`; do not write
  position updates to Supabase.
- `positionForNewBottle()` in `lib/validation.mjs` owns release bounds. Keep its
  supplied-coordinate clamp unchanged.
- Tests use `node:test` and `node:assert/strict` in
  `tests/validation.test.mjs`.

## Steps

1. Change only the no-coordinate random ranges in `positionForNewBottle()` to
   cover `x[-17,17]` and `z[-30,1]`; retain the existing finite-coordinate
   clamp exactly.
2. Update the random-position test to assert the broader bounds over many
   samples, and keep the existing custom-coordinate clamp test.
3. In `lib/ocean.js`, retain the current formula as the rollout trajectory,
   add the expanded anchored formula above, and blend the two trajectories for
   1200ms from scene initialization. Clamp only the displayed position.
4. Set the bottle model scale to `1.15` for both carried and floating bottles;
   remove the extra group multiplier from `beginCarry()`.
5. Update `HOW-IT-WORKS.md` to explain that bottle motion remains deterministic
   and is bounded to the visible ocean field.

## Boundaries

- Do NOT change database schema, API request/response fields, ownership,
  placement callbacks, or report/edit/delete behavior.
- Do NOT make bottle paths random per frame or remove the saved release origin.
- Do NOT shrink the invisible pick target.
- If the 1200ms transition causes visible clustering or an edge pile-up, stop
  and report it rather than changing the domain bounds.

## Verification

- **Mechanical**: run `npm run check:logic` and `npm run build`; expect random
  range, clamping, and CRUD logic tests to pass.
- **Feel check**: observe at least eight bottles for two minutes at desktop and
  mobile widths. Confirm they spread across the visible water, never bunch at
  the bounds, and do not jump on load. Compare held and floating bottle size.
- **Done when**: random bottles can start anywhere in the valid field, drift
  remains deterministic and bounded, and carried/floating visible scales match.
