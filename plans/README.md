# Adrift animation plans

| Plan | Title | Severity | Status |
|---|---|---|---|
| [001](./001-location-aware-daylight.md) | Add location-aware daylight | HIGH | TODO |
| [002](./002-bottle-field-and-scale.md) | Expand bottle drift coverage | MEDIUM | TODO |
| [003](./003-physical-bottle-release.md) | Give bottle release physical weight | MEDIUM | TODO |
| [004](./004-reader-sheet-timing.md) | Tighten the reader sheet reveal | MEDIUM | TODO |
| [005](./005-reduced-motion-feedback.md) | Preserve feedback for reduced motion | MEDIUM | TODO |
| [006](./006-keyboard-ocean-orbit.md) | Make arrow keys orbit the ocean | LOW | TODO |

## Recommended execution order

Execute plans in numeric order. Plans 001–003 and 006 all change `lib/ocean.js`,
so applying them sequentially avoids conflicting edits. Plan 002 also changes
the release-coordinate tests; plan 003 adds focused tests for its drop-motion
helper. Plan 004 changes CSS timing and its React completion timer together.
Plan 005 follows the other motion work because it touches the same CSS and
Three.js frame loop.

Dependencies: 005 follows 001–004 so reduced-motion behavior covers the final
lighting, drift, release, and sheet transitions. Plan 006 has no behavioral
dependency, but is last to keep camera-control edits isolated.

All plans were prepared against commit `b326308`. The implementation must keep
location in the browser, preserve the existing bottle API and Supabase CRUD,
and verify both normal and reduced-motion behavior.
