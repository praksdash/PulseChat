#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

await build({
  stdin: {
    contents: `
      export { gcm } from '@noble/ciphers/aes.js';
      export { bytesToHex, bytesToUtf8, hexToBytes, utf8ToBytes } from '@noble/ciphers/utils.js';
    `,
    loader: 'js',
    resolveDir: projectRoot,
    sourcefile: 'noble-ciphers-runtime-entry.js',
  },
  absWorkingDir: projectRoot,
  banner: {
    js: '/* Generated from @noble/ciphers 1.3.0 (MIT). See noble-ciphers-LICENSE.txt. */',
  },
  bundle: true,
  format: 'cjs',
  legalComments: 'none',
  logLevel: 'info',
  outfile: path.join(projectRoot, 'src/vendor/noble-ciphers-runtime.js'),
  platform: 'neutral',
  sourcemap: false,
  target: ['es2020'],
});
