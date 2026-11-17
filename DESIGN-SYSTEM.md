# Adrift — immersive visual system

The ocean is the interface. There is no fixed header, navigation bar, hero text or footer when a visitor arrives.

## On arrival

A five-and-a-half-second camera path moves from a near bird's-eye view to a low perspective over the water. Existing message bottles gently bob and drift. Only one persistent UI element sits over the scene: a small hand-drawn pen-and-paper control in the bottom-right corner. The control scales and tilts slightly on hover.

## Writing

The pen opens a warm, textured parchment sheet in the middle of the screen. The note feels like a piece of physical stationery rather than a form: understated small heading, handwritten content, faint ruled paper, handwritten signature. The current typed message is a true textarea and remains editable. The `Caveat` handwriting font loads from Google Fonts where available; local cursive alternatives take over if it is unavailable.

## Releasing

The action is called **Seal the letter**. The sheet rolls into a narrow strip while a small illustrated glass bottle appears, the scroll slides inside and a cork closes it. The 3D bottle then follows the visitor's cursor in the ocean scene. Clicking/tapping the water drops the bottle with a short fall and ripple. The letter is persisted only when placement is confirmed.

## Finding

Click a floating bottle. The camera moves closer, the bottle rises and straightens, the cork lifts, and the inner paper rises. A parchment sheet unrolls so the note can be read. Closing it rolls the paper away and returns the bottle to its floating state.

## Motion principles

- Ambient waves and drift continue independently of user actions.
- The aerial camera path makes the 3D scene the first experience.
- Writing and reading are physical metaphors: paper, cork, glass, water.
- Entering and leaving a modal do not reset or reload the ocean.
- `prefers-reduced-motion` bypasses the long camera movement and drastically shortens UI transitions.

## Palette

- Deep sea: `#0c3646` to muted dusk blue, with warm reflected light.
- Parchment: `#f5ecd8`.
- Ink: `#30291f`.
- Handwriting: `Caveat` with native cursive fallbacks.
- Letter-release action: subdued dark sea-green `#3c4f46`.

The previously supplied Ramp editorial reference informed an intermediate iteration, but the current version intentionally removes its header, cards and neon actions to match the new immersive direction.
