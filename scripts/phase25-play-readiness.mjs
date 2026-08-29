#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { readPngMetadata } from './phase24-release-audit.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJson(root, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function isHttpsUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && Boolean(parsed.hostname) && parsed.hostname !== 'example.com';
  } catch {
    return false;
  }
}

export function validateListing(listing) {
  const failures = [];
  const checks = [
    ['App name', listing?.appName, 30],
    ['Short description', listing?.shortDescription, 80],
    ['Full description', listing?.fullDescription, 4000],
    ['Release notes', listing?.releaseNotes, 500],
  ];

  for (const [label, value, maximum] of checks) {
    if (typeof value !== 'string' || value.trim().length === 0) failures.push(`${label} is required.`);
    else if ([...value].length > maximum) failures.push(`${label} exceeds the ${maximum}-character Play limit.`);
  }

  if (listing?.language !== 'en-US') failures.push('The canonical listing language must remain en-US.');
  if (/\b(end-to-end encrypted|voice calls?|video calls?|stories|bots|channels)\b/i.test(
    String(listing?.shortDescription ?? ''),
  )) failures.push('The short description claims a feature outside Prototype V1.');
  return failures;
}

export function validateOwnerInputs(input) {
  const failures = [];
  if (typeof input?.developerName !== 'string' || input.developerName.trim().length < 2) {
    failures.push('Owner developerName is required.');
  }
  if (typeof input?.supportEmail !== 'string'
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.supportEmail)
    || /example\.(com|org|net)$/i.test(input.supportEmail)) {
    failures.push('Owner supportEmail must be a real monitored email address.');
  }
  for (const field of ['privacyPolicyUrl', 'accountDeletionUrl', 'supportUrl']) {
    if (!isHttpsUrl(input?.[field])) failures.push(`Owner ${field} must be a real public HTTPS URL.`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input?.effectiveDate ?? ''))) {
    failures.push('Owner effectiveDate must use YYYY-MM-DD.');
  }
  if (input?.appAccess?.reviewerAccountReady !== true) {
    failures.push('A dedicated Play reviewer account must be ready.');
  }
  if (input?.appAccess?.instructionsStoredOutsideSource !== true) {
    failures.push('Reviewer instructions/credentials must be stored outside source.');
  }
  const confirmations = input?.policyConfirmation ?? {};
  for (const field of [
    'adultsOnlyInternalBeta',
    'noAds',
    'deletionWorkflowTested',
    'processorTermsReviewed',
    'dataSafetyAnswersReviewedInPlayConsole',
  ]) {
    if (confirmations[field] !== true) failures.push(`Owner policy confirmation ${field} must be true.`);
  }
  return failures;
}

function validateScreenshot(filePath) {
  const failures = [];
  const extension = path.extname(filePath).toLowerCase();
  if (!['.png', '.jpg', '.jpeg'].includes(extension)) return [`Unsupported screenshot format: ${path.basename(filePath)}`];

  if (extension === '.png') {
    try {
      const { width, height } = readPngMetadata(filePath);
      const longest = Math.max(width, height);
      const shortest = Math.min(width, height);
      if (shortest < 320 || longest > 3840) failures.push(`${path.basename(filePath)} must keep both dimensions within Play's 320–3840 px range.`);
      if (longest / shortest > 2) failures.push(`${path.basename(filePath)} aspect ratio must not exceed 2:1.`);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }
  return failures;
}

export function auditPlayReadiness(root = projectRoot, { sourceOnly = false } = {}) {
  const failures = [];
  const warnings = [];
  const requiredFiles = [
    'PHASE25_README.txt',
    'docs/PHASE25_PRIVACY_POLICY.md',
    'docs/PHASE25_DATA_SAFETY.md',
    'docs/PHASE25_CONTENT_RATING.md',
    'docs/PHASE25_STORE_LISTING.md',
    'docs/PHASE25_INTERNAL_BETA_RUNBOOK.md',
    'docs/PHASE25_ACCEPTANCE.md',
    'docs/PHASE25_RELEASE_REPORT.md',
    'release/play-store/play-readiness.json',
    'release/play-store/listing/en-US.json',
    'release/play-store/data-safety.json',
    'release/play-store/content-rating.json',
    'release/play-store/owner-inputs.example.json',
    'release/play-store/public/privacy-policy.template.html',
    'release/play-store/public/account-deletion.template.html',
    'release/play-store/public/support.template.html',
    'release/play-store/assets/README.md',
  ];
  for (const relativePath of requiredFiles) {
    if (!fs.existsSync(path.join(root, relativePath))) failures.push(`Required Phase 25 file is missing: ${relativePath}`);
  }
  if (failures.length > 0) return { failures, warnings, identity: null };

  const manifest = readJson(root, 'release/play-store/play-readiness.json');
  const baseline = readJson(root, 'release/android-release-baseline.json');
  const listing = readJson(root, 'release/play-store/listing/en-US.json');
  const dataSafety = readJson(root, 'release/play-store/data-safety.json');
  const contentRating = readJson(root, 'release/play-store/content-rating.json');

  if (manifest.schemaVersion !== 1 || manifest.phase !== 25) failures.push('Play readiness manifest schema/phase is invalid.');
  if (manifest.applicationId !== baseline.applicationId
    || manifest.versionName !== baseline.versionName
    || manifest.versionCode !== baseline.versionCode) {
    failures.push('Phase 25 Play identity must match the reviewed Android release baseline.');
  }
  if (manifest.defaultLanguage !== 'en-US' || manifest.category !== 'COMMUNICATION') {
    failures.push('Default language/category must remain en-US/COMMUNICATION.');
  }
  if (manifest.containsAds !== false || manifest.offersInAppPurchases !== false) {
    failures.push('Prototype V1 must not declare ads or in-app purchases.');
  }
  if (manifest.endToEndEncrypted !== false) failures.push('Prototype V1 must not claim end-to-end encryption.');

  failures.push(...validateListing(listing));

  if (dataSafety.encryptedInTransit !== true || dataSafety.endToEndEncrypted !== false) {
    failures.push('Data safety must declare transport encryption and no V1 end-to-end encryption.');
  }
  if (dataSafety.containsAds !== false || dataSafety.sellsData !== false
    || dataSafety.sharesDataForIndependentThirdPartyPurposes !== false) {
    failures.push('Data safety advertising/sale/independent-sharing declarations differ from V1.');
  }
  if (dataSafety.accountDeletionAvailableInApp !== true
    || dataSafety.accountDeletionPublicRequestRequired !== true) {
    failures.push('Data safety must require both in-app and public account-deletion paths.');
  }
  const categories = new Set((dataSafety.dataCollected ?? []).map((entry) => entry.playCategory));
  for (const category of [
    'Personal info / Email address',
    'Personal info / Name',
    'Personal info / User IDs',
    'Messages / Other in-app messages',
    'Photos and videos / Photos',
    'App activity / App interactions',
    'App activity / In-app search history',
    'App activity / Other user-generated content',
    'Device or other IDs / Device or other IDs',
  ]) {
    if (!categories.has(category)) failures.push(`Data safety is missing ${category}.`);
  }
  const providers = (dataSafety.serviceProviders ?? []).join(' ');
  for (const provider of ['Supabase', 'Expo Push Service', 'Firebase Cloud Messaging']) {
    if (!providers.includes(provider)) failures.push(`Data safety is missing the ${provider} processor.`);
  }

  if (contentRating.interactiveElements?.usersInteract !== true
    || contentRating.interactiveElements?.usersShareText !== true
    || contentRating.interactiveElements?.usersSharePhotos !== true
    || contentRating.userGeneratedContent?.present !== true
    || contentRating.userGeneratedContent?.blockingAvailable !== true
    || contentRating.userGeneratedContent?.reportingAvailable !== true
    || contentRating.userGeneratedContent?.proactiveContentFiltering !== false) {
    failures.push('Content-rating answers must disclose UGC, interaction, text/photos, blocking/reporting and no proactive filter.');
  }

  for (const [name, asset] of Object.entries({
    icon: manifest.storeAssets?.icon,
    featureGraphic: manifest.storeAssets?.featureGraphic,
  })) {
    const assetPath = path.join(root, asset?.path ?? '');
    if (!asset?.path || !fs.existsSync(assetPath)) {
      failures.push(`Play ${name} asset is missing.`);
      continue;
    }
    try {
      const metadata = readPngMetadata(assetPath);
      if (metadata.width !== asset.width || metadata.height !== asset.height) {
        failures.push(`Play ${name} is ${metadata.width}x${metadata.height}; expected ${asset.width}x${asset.height}.`);
      }
      if (name === 'featureGraphic' && [4, 6].includes(metadata.colorType)) {
        failures.push('Play feature graphic must be an opaque PNG without an alpha channel.');
      }
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }

  const screenshotDirectory = path.join(root, manifest.storeAssets.screenshotsDirectory);
  const screenshots = fs.existsSync(screenshotDirectory)
    ? fs.readdirSync(screenshotDirectory).filter((name) => /\.(png|jpe?g)$/i.test(name))
    : [];
  const minimumScreenshots = manifest.storeAssets.minimumPhoneScreenshots;
  if (screenshots.length < minimumScreenshots) {
    const message = `Capture at least ${minimumScreenshots} authentic phone screenshots before Play submission.`;
    if (sourceOnly) warnings.push(message); else failures.push(message);
  }
  for (const screenshot of screenshots) failures.push(...validateScreenshot(path.join(screenshotDirectory, screenshot)));

  const ownerInputsPath = path.join(root, manifest.ownerInputsPath);
  if (!fs.existsSync(ownerInputsPath)) {
    const message = 'Owner Play contact/URL/app-access inputs are not configured.';
    if (sourceOnly) warnings.push(message); else failures.push(message);
  } else failures.push(...validateOwnerInputs(readJson(root, manifest.ownerInputsPath)));

  const gitIgnore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
  const easIgnore = fs.readFileSync(path.join(root, '.easignore'), 'utf8');
  for (const [label, content] of [['.gitignore', gitIgnore], ['.easignore', easIgnore]]) {
    if (!content.includes('release/play-store/owner-inputs.json')) {
      failures.push(`${label} must exclude release/play-store/owner-inputs.json.`);
    }
    if (!content.includes('*reviewer-credentials*')) failures.push(`${label} must exclude reviewer credentials.`);
  }

  return { failures, warnings, identity: manifest };
}

function run() {
  const sourceOnly = process.argv.includes('--source-only');
  const { failures, warnings, identity } = auditPlayReadiness(projectRoot, { sourceOnly });
  if (failures.length === 0 && identity) {
    process.stdout.write(`[PASS] ${identity.applicationId} Phase 25 Play identity matches the Android release baseline.\n`);
    process.stdout.write('[PASS] Listing limits, policy facts, Data safety, content rating and committed Play assets are consistent.\n');
  }
  warnings.forEach((warning) => process.stdout.write(`[WARN] ${warning}\n`));
  failures.forEach((failure) => process.stdout.write(`[FAIL] ${failure}\n`));
  process.stdout.write(`Phase 25 Play readiness audit: ${failures.length} failure(s), ${warnings.length} warning(s).\n`);
  if (failures.length > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) run();
