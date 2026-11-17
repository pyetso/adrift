# 006 — Make arrow keys orbit the ocean

- **Status**: TODO
- **Commit**: b326308
- **Severity**: LOW
- **Category**: Accessibility
- **Estimated scope**: 1 file, about 15 lines

## Problem

Pointer dragging already changes yaw and pitch:

```js
/* lib/ocean.js:358-360 — current drag behavior */
if(!focused){
  yaw=clamp(yaw-dx*.0023,-.60,.60);
  pitch=clamp(pitch+dy*.003,-.25,.28);
}
```

ArrowLeft/ArrowRight rotate yaw, but ArrowUp/ArrowDown change zoom:

```js
/* lib/ocean.js:409-412 — current keyboard behavior */
if(event.key==='ArrowLeft')yaw=clamp(yaw+.08,-.6,.6);
if(event.key==='ArrowRight')yaw=clamp(yaw-.08,-.6,.6);
if(event.key==='ArrowUp')zoom=clamp(zoom-.8,-3,6);
if(event.key==='ArrowDown')zoom=clamp(zoom+.8,-3,6);
```

This means the keyboard does not mirror the drag-to-look-around interaction.
The canvas has an accessible label at `lib/ocean.js:154`, but is not focusable;
the key listener is global instead.

## Target

- Preserve pointer drag for yaw/pitch and wheel input for zoom.
- Make ArrowLeft/ArrowRight change yaw by the existing `0.08` step.
- Make ArrowUp decrement pitch by `0.08`; make ArrowDown increment pitch by
  `0.08`. Clamp pitch to the existing drag range `[-0.25, 0.28]`.
- Keep zoom bounds `[-3, 6]` for wheel input only.
- Set `renderer.domElement.tabIndex = 0`, and update its accessible label to
  say that dragging or focusing the canvas and using arrow keys looks around.
  Add `aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"`.
- Attach the key handler to the canvas rather than `window`, and remove that
  same handler from the canvas in `destroy()`. Ignore keys while a dialog is
  open or a bottle is being carried. Call `preventDefault()` only for handled
  arrow keys.
- Do not add permanent instructional UI over the ocean.

## Repo conventions to follow

- The canvas is created in `lib/ocean.js`; it already owns pointer, wheel,
  keyboard, resize, and teardown listeners.
- Camera yaw/pitch/zoom are scalar state variables updated in the event
  handlers and eased by the existing animation frame; do not move the camera
  directly inside the key handler.
- `components/OceanScene.jsx` keeps the Three.js implementation client-only.

## Steps

1. Make the renderer canvas focusable and update its accessible label and
   `aria-keyshortcuts`.
2. Change the key handler to map vertical arrows to pitch using the existing
   `0.08` step and `[-0.25,0.28]` range. Keep horizontal arrows and wheel zoom
   unchanged.
3. Register/unregister the key handler on `renderer.domElement`; do not leave a
   global arrow-key listener.
4. Confirm the existing dialog and carrier guards still prevent camera
   movement during letter entry and bottle placement.

## Boundaries

- Do NOT change camera intro/focus trajectories, mouse drag sensitivity,
  bottle selection, or wheel zoom.
- Do NOT add a help panel, visible keyboard legend, or dependency.
- Do NOT change Supabase or bottle CRUD behavior.

## Verification

- **Mechanical**: run `npm run check:logic` and `npm run build`; expect both to
  pass.
- **Feel check**: tab to the canvas, use each arrow, and confirm the view moves
  in the same directions as pointer dragging. Confirm wheel zoom still works.
  Focus the writing sheet and verify arrows no longer move the ocean.
- **Done when**: keyboard and drag both orbit yaw/pitch, and only the wheel
  changes zoom.
