# PulseChat — Phase 3

This source package contains the complete PulseChat project through Phase 3 (Design System).

## Included
- Expo SDK 57 / Expo Router project configuration
- EAS configuration
- App assets
- Phase 2 navigation
- Phase 3 reusable UI system
- Light/dark system theme support
- Updated project documentation

## Intentionally excluded
- `node_modules/`
- `.expo/`
- `.git/`
- `.idea/`
- generated build/output folders

These are machine-specific or regenerated locally.

## Install / update

If opening this package as a new copy:

```bash
npm install
npx tsc --noEmit
npx expo start -c
```

If copying it over your existing PulseChat project, keep your existing `.git` folder and replace the source/config files from this package. Then run the same checks.

## Phase 3 scope

This phase is UI architecture only. Authentication, database operations, realtime messaging and server-backed search are deliberately not implemented yet.
