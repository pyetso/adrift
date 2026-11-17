# 001 — Add location-aware daylight

- **Status**: TODO
- **Commit**: b326308
- **Severity**: HIGH
- **Category**: Missed opportunities
- **Estimated scope**: 3 files, about 100 lines plus tests

## Problem

The sky and ocean always point at the same sunset, even though the scene is
meant to feel like a real place and time. The water and sky each hard-code the
same sun direction:

```glsl
/* lib/ocean.js:77 — current water shader */
vec3 sunDir=normalize(vec3(.44,.115,-1.));
```

```glsl
/* lib/ocean.js:131 — current sky shader */
vec3 sun=normalize(vec3(.44,.115,-1.));
```

The Three.js light also has a fixed position at `lib/ocean.js:161`:

```js
const sun=new THREE.DirectionalLight(0xffd4a8,2.7);sun.position.set(40,22,-80);scene.add(sun);
```

There is no use of `navigator.geolocation`, the browser time zone, or the
current local clock in the project. Changing only a palette by hour would not
give the correct sunrise/sunset for a latitude and season.

## Target

- Request location once in the browser using `navigator.geolocation` with
  `enableHighAccuracy: false`, `maximumAge: 600000`, and `timeout: 2500`.
- Do not send coordinates to an API, put them in Supabase, or persist them.
- If permission is denied, the API is unavailable, or the request times out,
  use the visitor's local clock for an explicitly approximate day cycle.
- Add a pure helper in `lib/solar.mjs` that returns solar elevation, azimuth,
  and a unit sun direction for a given `Date`, latitude, and longitude. Use the
  NOAA fractional-year equation-of-time and declination equations:

  ```text
  gamma = 2*pi/365 * (dayOfYear - 1 + (utcHour - 12)/24)
  eqtime = 229.18 * (0.000075 + 0.001868*cos(gamma)
          - 0.032077*sin(gamma) - 0.014615*cos(2*gamma)
          - 0.040849*sin(2*gamma))
  declination = 0.006918 - 0.399912*cos(gamma)
          + 0.070257*sin(gamma) - 0.006758*cos(2*gamma)
          + 0.000907*sin(2*gamma) - 0.002697*cos(3*gamma)
          + 0.00148*sin(3*gamma)
  trueSolarMinutes = modulo(utcMinutes + eqtime + 4*longitude, 1440)
  hourAngle = radians(trueSolarMinutes/4 - 180)
  sinElevation = sin(latitude)*sin(declination)
          + cos(latitude)*cos(declination)*cos(hourAngle)
  azimuth = atan2(sin(hourAngle),
          cos(hourAngle)*sin(latitude) - tan(declination)*cos(latitude)) + pi
  ```

- Use east `+X`, up `+Y`, and north `-Z` for the scene direction:
  `x=cos(elevation)*sin(azimuth)`, `y=sin(elevation)`,
  `z=-cos(elevation)*cos(azimuth)`.
- Share the resulting `uSunDir` and sun elevation with both GLSL shaders.
  Update the Three.js directional light from the same vector. Make the sun disk
  disappear below the horizon, and blend sky tint, light intensity, and water
  glints from the same elevation so the reflection does not remain a sunset
  when the sun is below or high above the horizon.
- Initialize immediately with the local-time approximation, then replace it
  with geolocation-derived solar data if permission succeeds. Recalculate once
  per minute and smoothly damp the current vector/palette to the new target;
  do not jump when a minute boundary or geolocation result arrives.
- Keep the initial camera path, water geometry, and bottle behavior unchanged.

## Repo conventions to follow

- `components/OceanScene.jsx` dynamically imports `lib/ocean.js` in an effect,
  so all geolocation access stays client-only.
- `lib/ocean.js` already centralizes shader uniforms and updates them in
  `animate()`; follow that pattern for the sun uniforms.
- Pure data logic is tested with Node's built-in test runner in
  `tests/validation.test.mjs`; keep the solar calculation independent from
  `window` and browser APIs so it can be tested directly.
- Do not add a location service, dependency, API route, or database field.

## Steps

1. Add `lib/solar.mjs` with the pure NOAA solar-position calculation and a
   separate local-clock approximation for missing/denied coordinates.
2. Add `tests/solar.test.mjs`. Assert that the same date/location produces the
   same normalized direction, a daytime case is above the horizon, and a
   nighttime case is below it. Include a local-time fallback case that needs
   no browser globals.
3. In `lib/ocean.js`, start the local-clock state before requesting geolocation.
   Handle geolocation denial, timeout, and unsupported browsers by retaining
   the fallback; do not log coordinates or failure details.
4. Replace the hard-coded sun vectors in both shader strings with uniforms.
   Update the light, sky gradient, sun disk/glow, and water reflection from the
   same solar state.
5. Recalculate solar state every 60 seconds and use the frame loop to ease
   direction and lighting to their targets. Remove any interval/listener in
   `destroy()`.
6. Update `README.md` to describe the permission prompt, on-device calculation,
   and approximate local-time fallback.

## Boundaries

- Do NOT alter `components/AdriftApp.jsx`, bottle CRUD, API routes, Supabase
  authentication, schema, or stored letter records.
- Do NOT use IP geolocation or send coordinates to any server.
- Do NOT add dependencies or prompt more than once per page load.
- If the shader's coordinate convention differs from the stated ENU mapping,
  verify the sun against a known morning/noon/evening vector before proceeding.

## Verification

- **Mechanical**: run `npm run check:logic` and `npm run build`; expect solar
  tests to pass and the production build to compile.
- **Feel check**: in a secure browser context, test morning, midday, and night
  timestamps at one northern and one southern latitude. Confirm the sun and
  water glints move together, and night has no visible sun disk. Deny location
  permission and confirm the scene uses local time without blocking startup.
- Confirm coordinates never appear in network requests, local storage, or
  Supabase requests.
- **Done when**: both shaders and the Three.js light use one solar state; the
  local-time fallback works without location permission; no location is stored
  or transmitted.
