#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const defaultProjectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function channelToLinear(value) {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`Expected a six-digit hex color, received ${hex}.`);
  const value = match[1];
  const red = channelToLinear(Number.parseInt(value.slice(0, 2), 16));
  const green = channelToLinear(Number.parseInt(value.slice(2, 4), 16));
  const blue = channelToLinear(Number.parseInt(value.slice(4, 6), 16));
  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
}

export function contrastRatio(foreground, background) {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

export function hasSafeBackNavigation(source) {
  return !source.includes('router.back()') || source.includes('router.canGoBack()');
}

function read(projectRoot, relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

function listSourceFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listSourceFiles(fullPath));
    else if (/\.(?:ts|tsx)$/.test(entry.name)) files.push(fullPath);
  }
  return files;
}

function parseTheme(source, name) {
  const block = new RegExp(`export const ${name} = \\{([\\s\\S]*?)\\} as const;`).exec(source)?.[1] ?? '';
  return Object.fromEntries(
    [...block.matchAll(/(\w+):\s*'(#[0-9A-Fa-f]{6})'/g)].map((match) => [match[1], match[2].toUpperCase()]),
  );
}

export function auditProject(projectRoot = defaultProjectRoot) {
  const findings = [];
  const requireSource = (relativePath, pattern, reason) => {
    const source = read(projectRoot, relativePath);
    if (!pattern.test(source)) findings.push(`${relativePath}: ${reason}`);
  };

  const tokensSource = read(projectRoot, 'src/theme/tokens.ts');
  const light = parseTheme(tokensSource, 'LightColors');
  const dark = parseTheme(tokensSource, 'DarkColors');
  const contrastChecks = [
    ['Light primary action', light.primary, light.onPrimary],
    ['Light destructive action', light.danger, light.onDanger],
    ['Light warning banner', light.warning, light.onWarning],
    ['Light success text', light.success, light.surface],
    ['Light secondary text', light.textSecondary, light.surface],
    ['Light tertiary text', light.textTertiary, light.surface],
    ['Dark primary action', dark.primary, dark.onPrimary],
    ['Dark destructive action', dark.danger, dark.onDanger],
    ['Dark warning banner', dark.warning, dark.onWarning],
    ['Dark tertiary text', dark.textTertiary, dark.surface],
  ];

  for (const [label, foreground, background] of contrastChecks) {
    if (!foreground || !background) {
      findings.push(`${label}: required semantic color token is missing.`);
      continue;
    }
    const ratio = contrastRatio(foreground, background);
    if (ratio < 4.5) findings.push(`${label}: contrast ${ratio.toFixed(2)}:1 is below 4.5:1.`);
  }

  requireSource('src/components/ui/app-text.tsx', /allowFontScaling = true[\s\S]*maxFontSizeMultiplier = 2/, 'shared text must support bounded device font scaling.');
  requireSource('src/components/ui/app-button.tsx', /accessibilityLabel=\{accessibilityLabel \?\? label\}/, 'shared buttons must expose their visible label.');
  requireSource('src/components/ui/app-button.tsx', /busy: loading/, 'loading buttons must expose a busy accessibility state.');
  requireSource('src/components/ui/search-bar.tsx', /accessibilityLabel=\{accessibilityLabel \?\? 'Search'\}/, 'search fields need a default accessible name.');
  requireSource('src/components/ui/settings-toggle-row.tsx', /accessibilityRole="switch"/, 'the complete toggle row must operate as a switch.');
  requireSource('src/components/ui/report-modal.tsx', /accessibilityViewIsModal/, 'report form must isolate modal accessibility focus.');
  requireSource('src/components/ui/message-actions-modal.tsx', /accessibilityViewIsModal/, 'message actions must isolate modal accessibility focus.');
  requireSource('src/app/(app)/(tabs)/search.tsx', /accessibilityRole="tab"[\s\S]*accessibilityState=\{\{ selected: active \}\}/, 'search filters must expose tab selection.');

  const targetChecks = [
    ['src/app/(app)/groups/new.tsx', /roundButton: \{ width: 44, height: 44/],
    ['src/app/(app)/groups/[conversationId].tsx', /roundButton: \{ width: 44, height: 44/],
    ['src/app/(app)/chat/[conversationId].tsx', /roundButton: \{ width: 44, height: 44/],
    ['src/app/(app)/chat/[conversationId].tsx', /contextClose: \{ width: 44, height: 44/],
    ['src/components/ui/media-viewer.tsx', /closeButton: \{ width: 44, height: 44/],
    ['src/components/ui/message-reaction-bar.tsx', /minHeight: 44/],
    ['src/app/(app)/(tabs)/search.tsx', /segment: \{[^\n]*minHeight: 44/],
  ];
  for (const [relativePath, pattern] of targetChecks) {
    requireSource(relativePath, pattern, 'known interactive target must be at least 44 by 44 points.');
  }

  const sourceRoot = path.join(projectRoot, 'src');
  const hardcodedWhiteAllowlist = new Set([
    'src/components/ui/media-message-bubble.tsx',
    'src/components/ui/media-viewer.tsx',
    'src/constants/theme.ts',
    'src/theme/tokens.ts',
  ]);

  for (const filePath of listSourceFiles(sourceRoot)) {
    const relativePath = path.relative(projectRoot, filePath).split(path.sep).join('/');
    const source = fs.readFileSync(filePath, 'utf8');
    if (!hasSafeBackNavigation(source)) {
      findings.push(`${relativePath}: router.back() needs a deterministic deep-link fallback.`);
    }
    if (!hardcodedWhiteAllowlist.has(relativePath) && /#FFFFFF/i.test(source)) {
      findings.push(`${relativePath}: replace hardcoded white with a semantic foreground token.`);
    }
  }

  for (const relativePath of ['src/components/ui/report-modal.tsx', 'src/components/ui/message-actions-modal.tsx']) {
    if (/<Pressable[^>]*style=\{\[styles\.backdrop/.test(read(projectRoot, relativePath))) {
      findings.push(`${relativePath}: modal backdrop must not wrap interactive dialog controls.`);
    }
  }

  return findings;
}

function run() {
  const findings = auditProject();
  if (findings.length === 0) {
    process.stdout.write('[PASS] Phase 23 contrast, navigation, modal, scaling, and target checks passed.\n');
    process.stdout.write('Phase 23 accessibility audit: 0 finding(s).\n');
    return;
  }

  findings.forEach((finding) => process.stdout.write(`[FAIL] ${finding}\n`));
  process.stdout.write(`Phase 23 accessibility audit: ${findings.length} finding(s).\n`);
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) run();
