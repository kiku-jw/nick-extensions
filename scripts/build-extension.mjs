import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const name = process.argv[2];
const targetArg = process.argv.find((arg) => arg.startsWith('--target='));
const target = targetArg?.slice('--target='.length) || 'desktop';
if (!name) {
  console.error('usage: node scripts/build-extension.mjs <pkg> [--target=edge-mobile]');
  process.exit(1);
}
if (target !== 'desktop' && !(name === 'studynav' && target === 'edge-mobile')) {
  console.error(`unsupported build target: ${name}/${target}`);
  process.exit(1);
}
const edgeMobile = name === 'studynav' && target === 'edge-mobile';
const pkg = join(root, 'packages', name);
const dist = join(pkg, edgeMobile ? 'dist-edge-mobile' : 'dist');
const src = join(pkg, 'src');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const entries = ['background.ts', 'content.ts', 'popup.ts', 'options.ts', ...(edgeMobile ? [] : ['offscreen.ts'])]
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
    sourcemap: !edgeMobile,
    minify: edgeMobile,
    dropLabels: edgeMobile ? ['STUDYNAV_DESKTOP_ONLY'] : [],
    define: {
      __STUDYNAV_EDGE_MOBILE__: edgeMobile ? 'true' : 'false',
    },
    alias: {
      '@nick/shared': join(root, 'packages/shared/src/index.ts'),
    },
    logLevel: 'info',
  });
}

const publicDir = join(pkg, 'public');
if (existsSync(publicDir)) cpSync(publicDir, dist, { recursive: true });

for (const htmlName of ['popup.html', 'options.html', ...(edgeMobile ? [] : ['offscreen.html'])]) {
  const htmlSrc = join(src, htmlName);
  if (!existsSync(htmlSrc)) continue;
  if (edgeMobile && htmlName === 'popup.html') {
    const html = readFileSync(htmlSrc, 'utf8').replace(
      '<html lang="en">',
      '<html lang="en" data-studynav-target="edge-mobile">',
    );
    writeFileSync(join(dist, htmlName), html);
  } else {
    cpSync(htmlSrc, join(dist, htmlName));
  }
}
for (const cssName of ['popup.css', 'options.css', 'content.css']) {
  const cssSrc = join(src, cssName);
  if (existsSync(cssSrc)) cpSync(cssSrc, join(dist, cssName));
}

if (edgeMobile) {
  const contentCssPath = join(dist, 'content.css');
  if (existsSync(contentCssPath)) {
    const desktopBlocks = [
      /\/\* STUDYNAV_DESKTOP_MEDIA_START \*\/[\s\S]*?\/\* STUDYNAV_DESKTOP_MEDIA_END \*\//,
      /\/\* STUDYNAV_DESKTOP_PALETTE_START \*\/[\s\S]*?\/\* STUDYNAV_DESKTOP_PALETTE_END \*\//,
    ];
    const mobileCss = readFileSync(join(src, 'content.edge-mobile.css'), 'utf8');
    let contentCss = readFileSync(contentCssPath, 'utf8');
    for (const desktopBlock of desktopBlocks) {
      if (!desktopBlock.test(contentCss)) {
        throw new Error('StudyNav mobile build could not find a desktop-only CSS boundary');
      }
      contentCss = contentCss.replace(desktopBlock, '');
    }
    writeFileSync(contentCssPath, `${contentCss}\n${mobileCss}`);
  }
}

const manifestName = edgeMobile ? 'manifest.edge-mobile.json' : 'manifest.json';
const manifest = JSON.parse(readFileSync(join(pkg, manifestName), 'utf8'));
writeFileSync(join(dist, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`${name}/${target}`, 'built ->', dist);
