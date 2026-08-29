#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { validateOwnerInputs } from './phase25-play-readiness.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inputsPath = path.join(projectRoot, 'release/play-store/owner-inputs.json');
const templatesDirectory = path.join(projectRoot, 'release/play-store/public');
const outputDirectory = path.join(projectRoot, 'dist-phase25-public');

if (!fs.existsSync(inputsPath)) {
  throw new Error('Create release/play-store/owner-inputs.json from the example before rendering public pages.');
}

const inputs = JSON.parse(fs.readFileSync(inputsPath, 'utf8'));
const failures = validateOwnerInputs(inputs);
if (failures.length > 0) throw new Error(`Owner inputs are incomplete:\n- ${failures.join('\n- ')}`);

const tokens = {
  DEVELOPER_NAME: inputs.developerName,
  SUPPORT_EMAIL: inputs.supportEmail,
  PRIVACY_POLICY_URL: inputs.privacyPolicyUrl,
  ACCOUNT_DELETION_URL: inputs.accountDeletionUrl,
  SUPPORT_URL: inputs.supportUrl,
  EFFECTIVE_DATE: inputs.effectiveDate,
};

fs.mkdirSync(outputDirectory, { recursive: true });
for (const templateName of fs.readdirSync(templatesDirectory).filter((name) => name.endsWith('.template.html'))) {
  let rendered = fs.readFileSync(path.join(templatesDirectory, templateName), 'utf8');
  for (const [token, value] of Object.entries(tokens)) rendered = rendered.replaceAll(`{{${token}}}`, value);
  if (/{{[A-Z_]+}}/.test(rendered)) throw new Error(`Unresolved template token in ${templateName}.`);
  const outputName = templateName.replace('.template.html', '.html');
  fs.writeFileSync(path.join(outputDirectory, outputName), rendered, 'utf8');
  process.stdout.write(`[PASS] Rendered ${outputName}\n`);
}

process.stdout.write(`Phase 25 public pages are ready in ${path.relative(projectRoot, outputDirectory)}.\n`);
