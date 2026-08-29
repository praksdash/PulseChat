import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  auditProject,
  contrastRatio,
  hasSafeBackNavigation,
} from '../scripts/phase23-accessibility-audit.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('Phase 23 contrast calculation matches the WCAG reference pair', () => {
  assert.equal(contrastRatio('#000000', '#FFFFFF'), 21);
  assert.ok(contrastRatio('#0969DA', '#FFFFFF') >= 4.5);
});

test('Phase 23 safe-back check rejects navigation without a deep-link fallback', () => {
  assert.equal(hasSafeBackNavigation('router.back();'), false);
  assert.equal(hasSafeBackNavigation("if (router.canGoBack()) router.back(); else router.replace('/chats');"), true);
});

test('Phase 23 project accessibility audit has no static findings', () => {
  assert.deepEqual(auditProject(projectRoot), []);
});
