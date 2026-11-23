# Adrift submission status - 23 November 2026

## Verified in the supplied source and local update

- Original ZIP: 15 Node logic tests passed.
- Updated source: 18 logic tests passed, including three new forecast normalization and mapping tests.
- Added GET /api/environment with independent weather and marine fallbacks.
- Added weather-based cloud density and movement, and offshore wave-height-based visual waves.
- Public browsing, letter writing, and author-only update/delete routes are present in the source.
- No visible report button was found in the described UI. An older report endpoint remains in the code.

## Not yet verified

- Production build: blocked in the test container by the source ZIP's Windows node_modules and unavailable Linux SWC package download (registry DNS failure). Run npm ci and npm run build in a normal networked environment.
- Live Open-Meteo API availability and correctness of marine values.
- Actual Three.js ocean appearance and controls in Chrome, Edge and mobile.
- Supabase anonymous authentication, schema installation, and cross-browser persistent data.
- GitHub/Vercel deployments and whether the public site matches this update.

## Documentation gaps in uploaded systems.pdf

- The PDF is 14 pages, not the 22-slide handoff version.
- Page 9 describes a report UI feature; the intended UI has no report button. Remove that row or call it residual backend only.
- Page 12's second prompt repeats drifting logic instead of showing a distinct genuine user prompt.
- Page 14 is titled Sources but repeats the reflection verbatim. Replace with real MLA citations.
- Add genuine screenshot evidence of the live ocean, letter interface, edit/delete controls, and a Supabase row.
- Include a UML use case, audience, AI use, and process specifics per course brief if not already shown elsewhere.
- Add credits for Open-Meteo, Three.js, and any tutorials actually used.
- Add actual student name, GitHub link, deployed public URL, and presentation/Teams evidence only when available.

## Deployment

1. Run `npm ci && npm run check:logic && npm run build` in a fresh environment.
2. Configure Supabase with `database/schema.sql`, enable anonymous sign-in, and supply only the two NEXT_PUBLIC_SUPABASE environment variables. Never commit `.env.local` or any service-role key.
3. Use two separate browser sessions to create, read, edit, and delete letters, and check refresh persistence.
4. Visit `/api/environment`, look for `sources.weather` and `sources.marine` = `live`; inspect real wave/cloud changes and mobile layout.
5. Push this exact project version to GitHub, deploy on Vercel, and verify URLs before submission.
