#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const buildScript = join(root, 'scripts', 'build-extension.mjs');
const dist = join(root, 'packages', 'studynav', 'dist-safari-ios');
const resources = join(
  root,
  'packages',
  'studynav',
  'apple',
  'StudyNav',
  'StudyNav Extension',
  'Resources',
);
const expectedSuffix = join('packages', 'studynav', 'apple', 'StudyNav', 'StudyNav Extension', 'Resources');

if (!resources.endsWith(expectedSuffix)) throw new Error(`Refusing to replace unexpected path: ${resources}`);

const build = spawnSync(process.execPath, [buildScript, 'studynav', '--target=safari-ios'], {
  cwd: root,
  stdio: 'inherit',
});
if (build.status !== 0 || !existsSync(join(dist, 'manifest.json'))) {
  throw new Error('StudyNav Safari extension build failed');
}

rmSync(resources, { recursive: true, force: true });
mkdirSync(dirname(resources), { recursive: true });
cpSync(dist, resources, { recursive: true });
console.log(`StudyNav Safari resources synced -> ${resources}`);
