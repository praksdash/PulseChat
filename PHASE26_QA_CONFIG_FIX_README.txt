PULSECHAT PHASE 26 — CONFIG-AWARE QA HOTFIX
============================================

This hotfix resolves the QA failures reported after owner configuration:

1. The Phase 23 accessibility audit allows src/constants/theme.ts to declare
   the base white color because that file defines semantic theme tokens.
2. The Phase 25 source test supports both valid states: clean shareable source
   warns that private owner inputs are absent, while an owner-configured project
   correctly has no Owner Play warning.
3. The Android native smoke test uses a Windows directory junction for its
   temporary node_modules link, avoiding the administrator/Developer Mode
   permission required by a normal symbolic link.
4. Expo prebuild starts through the current Node executable and Expo's
   JavaScript CLI entrypoint, avoiding a null process status from attempting
   to launch the Unix-style .bin/expo shim on Windows.
5. Generated Android resource paths are normalized before checking for the
   notification icon, supporting both Windows and POSIX path separators.
6. Phase-scoped Android and web exports launch Expo through Node, avoiding the
   Windows ENOENT error from directly spawning the Unix .bin/expo shim.

No product feature, dependency, database migration, or private owner value is
changed by this hotfix.

After copying the files into the project, run:

  npm run qa:phase26

Suggested commit message:

  fix(qa): make phase 26 checks Windows-compatible
