PulseChat Phase 26 npm clean-install compatibility fix
=====================================================

Problem
-------
On npm 10.9.4, `npm ci` reported:

  Missing: typescript@5.9.3 from lock file

Cause
-----
The npm 11-generated lockfile omitted the optional nested TypeScript peer used
by an EAS CLI helper. The app's own TypeScript remains 6.0.3; only the nested
EAS CLI compatibility entry was missing.

Fix
---
- Regenerated the dependency graph using npm 10.9.4, the oldest npm version
  allowed by package.json.
- Added the exact nested `eas-cli/node_modules/typescript` 5.9.3 lock entry.
- Added a Phase 26 audit regression check for this cross-npm contract.

Verified
--------
- clean `npm ci` with npm 10.9.4: passed;
- clean `npm ci` with npm 11.9.0: passed;
- the app still uses root TypeScript 6.0.3.

Recommended commit
------------------
fix(build): restore npm 10 clean-install compatibility
