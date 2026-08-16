import {spawn} from 'node:child_process';
import {access, cp, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const upstreamRoot = path.join(packageRoot, 'upstream');
const upstreamBuild = path.join(upstreamRoot, 'build', 'release', 'chrome-mv3');
const dist = path.join(packageRoot, 'dist');
const shippedLocales = new Set(['en', 'ru', 'uk']);

async function run(command, args, cwd) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {cwd, stdio: 'inherit'});
    child.once('error', reject);
    child.once('exit', (code) => code === 0
      ? resolve()
      : reject(new Error(`${command} exited with code ${code}`)));
  });
}

try {
  await access(path.join(upstreamRoot, 'node_modules'));
} catch {
  throw new Error('InkShade upstream dependencies are missing. Run `bun run bootstrap:inkshade`.');
}

await run('npm', ['run', 'build', '--', '--chrome-mv3', '--release'], upstreamRoot);
await access(path.join(upstreamBuild, 'manifest.json'));

await rm(dist, {recursive: true, force: true});
await cp(upstreamBuild, dist, {recursive: true});

await rm(path.join(dist, 'icons'), {recursive: true, force: true});
await cp(path.join(packageRoot, 'public', 'icons'), path.join(dist, 'icons'), {recursive: true});

const localeRoot = path.join(dist, '_locales');
for (const locale of await readdir(localeRoot)) {
  if (!shippedLocales.has(locale)) {
    await rm(path.join(localeRoot, locale), {recursive: true, force: true});
  }
}

for (const asset of [
  'birthday-icon.svg',
  'darkreader-icon-256x256.png',
  'darkreader-thumb-up.svg',
  'darkreader-type.svg',
  'icon-android-dark.svg',
  'icon-apple-white.svg',
  'mobile-qr-code-firefox.png',
  'mobile-qr-code.png',
  'mobile-icon-40x64.svg',
]) {
  await rm(path.join(dist, 'ui', 'assets', 'images', asset), {force: true});
}

const manifestPath = path.join(dist, 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const packageJson = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'));
manifest.name = 'InkShade – Dark Mode for Every Site';
manifest.short_name = 'InkShade';
manifest.version = packageJson.version;
manifest.author = 'KikuAI Lab';
manifest.icons = {
  16: 'icons/icon16.png',
  32: 'icons/icon32.png',
  48: 'icons/icon48.png',
  128: 'icons/icon128.png',
};
manifest.action.default_title = manifest.name;
manifest.action.default_icon = {
  16: 'icons/icon16.png',
  32: 'icons/icon32.png',
};
delete manifest.update_url;
delete manifest.externally_connectable;
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

await cp(
  path.join(packageRoot, 'THIRD_PARTY_NOTICES.txt'),
  path.join(dist, 'THIRD_PARTY_NOTICES.txt'),
);

console.log(`InkShade built from pinned upstream source -> ${dist}`);
