import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const ignoredDirectories = new Set(['.git', '.expo', 'node_modules', 'android', 'ios']);
const ignoredFiles = new Set(['package-lock.json', 'check-secrets.mjs']);
const textExtensions = new Set([
  '.js', '.json', '.md', '.mjs', '.sql', '.toml', '.ts', '.tsx', '.txt', '.yml', '.yaml',
]);

const patterns = [
  ['private key block', new RegExp(`BEGIN (?:RSA |EC |OPENSSH )?PRIVATE ${'KEY'}`)],
  ['Supabase secret key', new RegExp(`sb_${'secret'}_[A-Za-z0-9_-]{16,}`)],
  ['live provider secret', new RegExp(`${'sk'}_live_[A-Za-z0-9]{16,}`)],
  ['embedded JWT', /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{16,}/],
  ['service-account private key', new RegExp(`"private_${'key'}"\\s*:\\s*"-----BEGIN`)],
];

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith('dist-') || ignoredDirectories.has(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(absolutePath));
    else if (
      entry.isFile()
      && !ignoredFiles.has(entry.name)
      && textExtensions.has(path.extname(entry.name).toLowerCase())
    ) files.push(absolutePath);
  }

  return files;
}

const findings = [];
for (const file of await collectFiles(root)) {
  const content = await readFile(file, 'utf8');
  for (const [label, pattern] of patterns) {
    if (pattern.test(content)) findings.push(`${path.relative(root, file)}: ${label}`);
  }
}

if (findings.length > 0) {
  console.error('Potential committed secrets found:');
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exitCode = 1;
} else {
  console.log('Secret scan passed.');
}
