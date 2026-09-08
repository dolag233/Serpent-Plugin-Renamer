import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { writePosixZip } = require('./posix-zip.js');
const { releaseAssetName } = require('./release-asset-name.js');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(path.join(root, 'serpent-plugin.json'), 'utf8'));
const outputDirectory = path.join(root, 'out');
const stagingDirectory = path.join(outputDirectory, 'staging-any');
const outputPath = path.join(outputDirectory, releaseAssetName(manifest.id, manifest.version));
const entries = ['serpent-plugin.json', 'entry', 'src', 'README.md', 'LICENSE'];

rmSync(stagingDirectory, { recursive: true, force: true });
mkdirSync(stagingDirectory, { recursive: true });
mkdirSync(outputDirectory, { recursive: true });
try {
  for (const entry of entries) cpSync(path.join(root, entry), path.join(stagingDirectory, entry), { recursive: true });
  rmSync(outputPath, { force: true });
  writePosixZip(stagingDirectory, outputPath);
  const digest = createHash('sha256').update(readFileSync(outputPath)).digest('hex');
  console.log(`[package] wrote ${outputPath}`);
  console.log(`[package] sha256 ${digest}`);
} finally {
  rmSync(stagingDirectory, { recursive: true, force: true });
}
