import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const name = process.argv[2];
if (!name) {
  console.error('usage: node scripts/build-extension.mjs <pkg>');
  process.exit(1);
}
const pkg = join(root, 'packages', name);
const dist = join(pkg, 'dist');
const src = join(pkg, 'src');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const entries = ['background.ts', 'content.ts', 'popup.ts', 'options.ts', 'offscreen.ts']
  .map((f) => join(src, f))
  .filter((p) => existsSync(p));

for (const entry of entries) {
  const base = entry.split('/').pop().replace(/\.tsx?$/, '.js');
  await esbuild.build({
    entryPoints: [entry],
    outfile: join(dist, base),
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'chrome120',
    sourcemap: true,
    alias: {
      '@nick/shared': join(root, 'packages/shared/src/index.ts'),
    },
    logLevel: 'info',
  });
}

const publicDir = join(pkg, 'public');
if (existsSync(publicDir)) cpSync(publicDir, dist, { recursive: true });

for (const htmlName of ['popup.html', 'options.html', 'offscreen.html']) {
  const htmlSrc = join(src, htmlName);
  if (existsSync(htmlSrc)) cpSync(htmlSrc, join(dist, htmlName));
}
for (const cssName of ['popup.css', 'options.css', 'content.css']) {
  const cssSrc = join(src, cssName);
  if (existsSync(cssSrc)) cpSync(cssSrc, join(dist, cssName));
}

const manifest = JSON.parse(readFileSync(join(pkg, 'manifest.json'), 'utf8'));
writeFileSync(join(dist, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(name, 'built ->', dist);
