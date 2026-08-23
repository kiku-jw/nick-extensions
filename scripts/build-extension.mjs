import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const name = process.argv[2];
const targetArg = process.argv.find((arg) => arg.startsWith('--target='));
const target = targetArg?.slice('--target='.length) || 'desktop';
const studyNavMobileTargets = new Set(['safari-ios', 'firefox-android', 'edge-mobile']);
if (!name) {
  console.error('usage: node scripts/build-extension.mjs <pkg> [--target=safari-ios|firefox-android|edge-mobile]');
  process.exit(1);
}
if (target !== 'desktop' && !(name === 'studynav' && studyNavMobileTargets.has(target))) {
  console.error(`unsupported build target: ${name}/${target}`);
  process.exit(1);
}
const mobile = name === 'studynav' && studyNavMobileTargets.has(target);
const mobileDistNames = {
  'edge-mobile': 'dist-edge-mobile',
  'firefox-android': 'dist-firefox-android',
  'safari-ios': 'dist-safari-ios',
};
const mobileManifestNames = {
  'edge-mobile': 'manifest.edge-mobile.json',
  'firefox-android': 'manifest.firefox-android.json',
  'safari-ios': 'manifest.safari-ios.json',
};
const pkg = join(root, 'packages', name);
const dist = join(pkg, mobile ? mobileDistNames[target] : 'dist');
const src = join(pkg, 'src');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const entries = ['background.ts', 'content.ts', 'popup.ts', 'options.ts', ...(mobile ? [] : ['offscreen.ts'])]
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
    target: mobile ? ['chrome120', 'firefox142', 'safari15.4'] : 'chrome120',
    sourcemap: !mobile,
    minify: mobile,
    dropLabels: mobile ? ['STUDYNAV_DESKTOP_ONLY'] : [],
    define: {
      __STUDYNAV_MOBILE__: mobile ? 'true' : 'false',
    },
    alias: {
      '@nick/shared': join(root, 'packages/shared/src/index.ts'),
    },
    logLevel: 'info',
  });
}

if (mobile) {
  for (const fileName of readdirSync(dist).filter((item) => item.endsWith('.js'))) {
    const outputPath = join(dist, fileName);
    const output = readFileSync(outputPath, 'utf8').replace(/[ \t]+$/gm, '');
    writeFileSync(outputPath, output);
  }
}

const publicDir = join(pkg, 'public');
if (existsSync(publicDir)) cpSync(publicDir, dist, { recursive: true });
if (mobile) rmSync(join(dist, 'icons', 'icon-source.svg'), { force: true });

for (const htmlName of ['popup.html', 'options.html', ...(mobile ? [] : ['offscreen.html'])]) {
  const htmlSrc = join(src, htmlName);
  if (!existsSync(htmlSrc)) continue;
  if (mobile && htmlName === 'popup.html') {
    const html = readFileSync(htmlSrc, 'utf8').replace(
      '<html lang="en">',
      '<html lang="en" data-studynav-target="mobile">',
    ).replace(
      /\s*<!-- STUDYNAV_DESKTOP_IMAGE_SEARCH_START -->[\s\S]*?<!-- STUDYNAV_DESKTOP_IMAGE_SEARCH_END -->/,
      '',
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

if (mobile) {
  const contentCssPath = join(dist, 'content.css');
  if (existsSync(contentCssPath)) {
    const desktopBlocks = [
      /\/\* STUDYNAV_DESKTOP_MEDIA_START \*\/[\s\S]*?\/\* STUDYNAV_DESKTOP_MEDIA_END \*\//,
      /\/\* STUDYNAV_DESKTOP_PALETTE_START \*\/[\s\S]*?\/\* STUDYNAV_DESKTOP_PALETTE_END \*\//,
    ];
    const mobileCss = readFileSync(join(src, 'content.mobile.css'), 'utf8');
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

const manifestName = mobile ? mobileManifestNames[target] : 'manifest.json';
const manifest = JSON.parse(readFileSync(join(pkg, manifestName), 'utf8'));
writeFileSync(join(dist, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`${name}/${target}`, 'built ->', dist);
