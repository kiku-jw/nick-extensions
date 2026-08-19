#!/usr/bin/env node

import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

if (process.platform !== 'darwin') throw new Error('Safari verification requires macOS and Xcode');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const project = join(root, 'packages', 'studynav', 'apple', 'StudyNav', 'StudyNav.xcodeproj');
const dist = join(root, 'packages', 'studynav', 'dist-safari-ios');
const tempRoot = mkdtempSync(join(tmpdir(), 'studynav-safari-verify-'));

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${command} failed with exit code ${result.status}`);
}

try {
  run(process.execPath, [join(root, 'scripts', 'sync-studynav-safari.mjs')]);
  if (!existsSync(project)) throw new Error(`Missing Xcode project: ${project}`);

  run('xcrun', [
    'safari-web-extension-packager',
    dist,
    '--project-location', join(tempRoot, 'packager'),
    '--app-name', 'StudyNav',
    '--bundle-identifier', 'org.kiku.StudyNav',
    '--swift',
    '--ios-only',
    '--copy-resources',
    '--no-open',
    '--no-prompt',
    '--force',
  ]);

  run('xcodebuild', [
    '-project', project,
    '-scheme', 'StudyNav',
    '-configuration', 'Debug',
    '-sdk', 'iphonesimulator',
    '-destination', 'generic/platform=iOS Simulator',
    '-derivedDataPath', join(tempRoot, 'DerivedData'),
    '-quiet',
    'CODE_SIGNING_ALLOWED=NO',
    'CODE_SIGNING_REQUIRED=NO',
    'build',
  ]);
  console.log('StudyNav Safari package and unsigned iOS Simulator build verified');
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
