#!/usr/bin/env node

import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { appendFile, chmod, cp, mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SCREENSHOT_DIR = String(process.env.NICK_EXT_SCREENSHOT_DIR || '').trim();
const EXTENSIONS = {
  ClearShield: path.join(ROOT, 'packages', 'clearshield', 'dist'),
  InkShade: path.join(ROOT, 'packages', 'inkshade', 'dist'),
  StudyNav: path.join(ROOT, 'packages', 'studynav', 'dist'),
  StudyNavMobile: path.join(ROOT, 'packages', 'studynav', 'dist-safari-ios'),
};
const DISPLAY_NAMES = {
  ClearShield: 'Ad & Tracker Blocker (ClearShield)',
  InkShade: 'InkShade – Dark Mode for Every Site',
  StudyNav: 'StudyNav — Unofficial Study Tools',
  StudyNavMobile: 'StudyNav Mobile — Unofficial Study Tools',
};
const HOSTS = {
  ordinary: 'fixture.test',
  assets: 'assets.test',
  ad: 'doubleclick.net',
  darkList: 'darkreader.org',
  selectorHint: 'selector-hint.fixture.test',
  systemHint: 'system-hint.fixture.test',
  jw: 'www.jw.org',
  wol: 'wol.jw.org',
  jwApi: 'b.jw-cdn.org',
  jwMedia: 'cfp2.jw-cdn.org',
};
const PNG_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y0XWv4AAAAASUVORK5CYII=',
  'base64',
);
const VIDEO_MP4 = Buffer.from(
  'AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAPbbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAATiAAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAwZ0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAATiAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAABAAAAAQAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAE4gAACAAAABAAAAAAJ+bWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAABAAAAFAABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAACKW1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAelzdGJsAAAAwXN0c2QAAAAAAAAAAQAAALFhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAABAAEABIAAAASAAAAAAAAAABFUxhdmM2MS4xOS4xMDAgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAAN2F2Y0MBZAAK/+EAGWdkAAqscgRewEQAAAMABAAAAwAIPEiWEYABAAdo6EOBNLIs/fj4AAAAABBwYXNwAAAAAQAAAAEAAAAUYnRydAAAAAAAAAGDAAABgwAAABhzdHRzAAAAAAAAAAEAAAAUAABAAAAAABRzdHNzAAAAAAAAAAEAAAABAAAAYGN0dHMAAAAAAAAACgAAAAEAAIAAAAAAAQACgAAAAAABAAEAAAAAAAMAAAAAAAAABAAAQAAAAAABAAKAAAAAAAEAAQAAAAAAAwAAAAAAAAAEAABAAAAAAAEAAIAAAAAAHHN0c2MAAAAAAAAAAQAAAAEAAAAUAAAAAQAAAGRzdHN6AAAAAAAAAAAAAAAUAAACxQAAAA0AAAANAAAADQAAAA0AAAANAAAADQAAAA0AAAANAAAADQAAABMAAAANAAAADQAAAA0AAAANAAAADQAAAA0AAAANAAAADQAAABQAAAAUc3RjbwAAAAAAAAABAAAECwAAAGF1ZHRhAAAAWW1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAG1kaXJhcHBsAAAAAAAAAAAAAAAALGlsc3QAAAAkqXRvbwAAABxkYXRhAAAAAQAAAABMYXZmNjEuNy4xMDAAAAAIZnJlZQAAA9FtZGF0AAACrwYF//+r3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE2NCByMzEwOCAzMWUxOWY5IC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAyMyAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTEgcmVmPTE2IGRlYmxvY2s9MTowOjAgYW5hbHlzZT0weDM6MHgxMzMgbWU9dW1oIHN1Ym1lPTEwIHBzeT0xIHBzeV9yZD0xLjAwOjAuMDAgbWl4ZWRfcmVmPTEgbWVfcmFuZ2U9MjQgY2hyb21hX21lPTEgdHJlbGxpcz0yIDh4OGRjdD0xIGNxbT0wIGRlYWR6b25lPTIxLDExIGZhc3RfcHNraXA9MSBjaHJvbWFfcXBfb2Zmc2V0PS0yIHRocmVhZHM9MSBsb29rYWhlYWRfdGhyZWFkcz0xIHNsaWNlZF90aHJlYWRzPTAgbnI9MCBkZWNpbWF0ZT0xIGludGVybGFjZWQ9MCBibHVyYXlfY29tcGF0PTAgY29uc3RyYWluZWRfaW50cmE9MCBiZnJhbWVzPTggYl9weXJhbWlkPTIgYl9hZGFwdD0yIGJfYmlhcz0wIGRpcmVjdD0zIHdlaWdodGI9MSBvcGVuX2dvcD0wIHdlaWdodHA9MiBrZXlpbnQ9MjUwIGtleWludF9taW49MSBzY2VuZWN1dD00MCBpbnRyYV9yZWZyZXNoPTAgcmNfbG9va2FoZWFkPTYwIHJjPWNyZiBtYnRyZWU9MSBjcmY9NDUuMCBxY29tcD0wLjYwIHFwbWluPTAgcXBtYXg9NjkgcXBzdGVwPTQgaXBfcmF0aW89MS40MCBhcT0xOjEuMDAAgAAAAA5liIEAA1/+8dzwKZrl2QAAAAlBmgktiDP//sAAAAAJQZ4QhxBj/9qBAAAACQGeGCaIK//ggAAAAAkBnhhGiCv/4IEAAAAJAZ4YZogr/+CBAAAACQGeGK1IK//ggQAAAAkBnhjNSCv/4IEAAAAJAZ4Y7Ugr/+CAAAAACQGeGQ1IK//ggAAAAA9BmhpJNQIC0TKYEFv/koEAAAAJQZ4hpcQY/9qAAAAACQGeKUWiCv/ggAAAAAkBnillogr/4IEAAAAJAZ4phaIK/+CBAAAACQGeKcySCv/ggQAAAAkBninskgr/4IAAAAAJAZ4qDJIK/+CAAAAACQGeKiySCv/ggQAAABBBmipptQIC2tEymAEFf5eA',
  'base64',
);
const VERSE_AUDIO_URL = `https://${HOSTS.jwMedia}/audio/nwt_01_Ge_E_01.mp3`;
const VERSE_AUDIO_API_URL =
  `https://${HOSTS.jwApi}/apis/pub-media/GETPUBMEDIALINKS?booknum=1&output=json&pub=nwt&fileformat=MP3&alllangs=0&track=1&langwritten=E&txtCMSLang=E`;
const MEDIA_VIDEO_LIVE_URL = `https://${HOSTS.jwMedia}/a/5afcbf3/1/o/thv_U_05_r720P.mp4`;
const VERSE_AUDIO_LIVE_CASES = [
  {
    id: 'studynav-verse-audio-live',
    language: 'E',
    label: 'English',
    url: 'https://www.jw.org/en/library/bible/study-bible/books/genesis/1/',
    apiUrl: VERSE_AUDIO_API_URL,
    filename: 'Genesis_1_3-5.wav',
  },
  {
    id: 'studynav-verse-audio-live-ru',
    language: 'U',
    label: 'Russian',
    url: 'https://www.jw.org/ru/%D0%B1%D0%B8%D0%B1%D0%BB%D0%B8%D0%BE%D1%82%D0%B5%D0%BA%D0%B0/%D0%B1%D0%B8%D0%B1%D0%BB%D0%B8%D1%8F/%D1%83%D1%87%D0%B5%D0%B1%D0%BD%D0%B0%D1%8F-%D0%B1%D0%B8%D0%B1%D0%BB%D0%B8%D1%8F/%D0%BA%D0%BD%D0%B8%D0%B3%D0%B8/%D0%91%D1%8B%D1%82%D0%B8%D0%B5/1/',
    apiUrl: `https://${HOSTS.jwApi}/apis/pub-media/GETPUBMEDIALINKS?booknum=1&output=json&pub=nwt&fileformat=MP3&alllangs=0&track=1&langwritten=U&txtCMSLang=U`,
    filename: 'Бытие_1_3-5.wav',
  },
  {
    id: 'studynav-verse-audio-live-uk',
    language: 'K',
    label: 'Ukrainian',
    url: 'https://www.jw.org/uk/%D0%B1%D1%96%D0%B1%D0%BB%D1%96%D0%BE%D1%82%D0%B5%D0%BA%D0%B0/%D0%B1%D1%96%D0%B1%D0%BB%D1%96%D1%8F/%D0%BD%D0%B0%D0%B2%D1%87%D0%B0%D0%BB%D1%8C%D0%BD%D0%B5-%D0%B2%D0%B8%D0%B4%D0%B0%D0%BD%D0%BD%D1%8F-%D0%B1%D1%96%D0%B1%D0%BB%D1%96%D1%97/%D0%BA%D0%BD%D0%B8%D0%B3%D0%B8/%D0%91%D1%83%D1%82%D1%82%D1%8F/1/',
    apiUrl: `https://${HOSTS.jwApi}/apis/pub-media/GETPUBMEDIALINKS?booknum=1&output=json&pub=nwt&fileformat=MP3&alllangs=0&track=1&langwritten=K&txtCMSLang=K`,
    filename: 'Буття_1_3-5.wav',
  },
];
const DEFAULT_CLEARSHIELD = {
  enabled: true,
  allowlist: [],
  lists: { easylist: true, easyprivacy: true, baseline: true },
  cosmetic: true,
  blockedTotal: 0,
};
const DEFAULT_STUDYNAV_FLAGS = {
  masterEnabled: true,
  annotations: true,
  bookmarks: true,
  advSearch: true,
  actionBar: false,
  altText: true,
  copyText: true,
  citations: true,
  continueWatching: true,
  cstblView: false,
  expandWidth: false,
  langCount: true,
  parLink: true,
  qrShare: true,
  officialOpen: true,
  verseAudio: true,
  mediaPlayerUI: true,
  customSub: true,
  imgGet: false,
  mediaCtrl: true,
  mediaTS: true,
  mediaClip: true,
  sndDisp: true,
  transcCreate: true,
};
const DEFAULT_STUDYNAV_MOBILE_FLAGS = {
  ...DEFAULT_STUDYNAV_FLAGS,
  advSearch: false,
  actionBar: false,
  continueWatching: false,
  cstblView: false,
  expandWidth: false,
  verseAudio: false,
  mediaPlayerUI: false,
  customSub: false,
  imgGet: false,
  mediaCtrl: false,
  mediaTS: false,
  mediaClip: false,
  sndDisp: false,
  transcCreate: false,
};
const LIVE_CHROME_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36';
const LIVE_CHROME_HEADERS = {
  'accept-language': 'en-US,en;q=0.9',
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isoNow() {
  return new Date().toISOString();
}

function cleanHost(raw) {
  return String(raw || '').replace(/:\d+$/, '').toLowerCase();
}

function httpUrl(host, port, pathname) {
  return `http://${host}:${port}${pathname}`;
}

function httpsUrl(host, pathname) {
  return `https://${host}${pathname}`;
}

function json(value) {
  return JSON.stringify(value, null, 2);
}

async function fulfillFixtureVideo(route) {
  const range = /^bytes=(\d+)-(\d*)$/i.exec(String(route.request().headers().range || ''));
  if (!range) {
    await route.fulfill({
      status: 200,
      contentType: 'video/mp4',
      headers: {
        'accept-ranges': 'bytes',
        'access-control-allow-origin': '*',
        'content-length': String(VIDEO_MP4.length),
      },
      body: VIDEO_MP4,
    });
    return;
  }
  const start = Math.min(VIDEO_MP4.length - 1, Number(range[1]));
  const requestedEnd = range[2] ? Number(range[2]) : VIDEO_MP4.length - 1;
  const end = Math.min(VIDEO_MP4.length - 1, Math.max(start, requestedEnd));
  const body = VIDEO_MP4.subarray(start, end + 1);
  await route.fulfill({
    status: 206,
    contentType: 'video/mp4',
    headers: {
      'accept-ranges': 'bytes',
      'access-control-allow-origin': '*',
      'content-length': String(body.length),
      'content-range': `bytes ${start}-${end}/${VIDEO_MP4.length}`,
    },
    body,
  });
}

async function captureScreenshot(page, filename, options = {}) {
  if (!SCREENSHOT_DIR) return null;
  const directory = path.isAbsolute(SCREENSHOT_DIR)
    ? SCREENSHOT_DIR
    : path.resolve(ROOT, SCREENSHOT_DIR);
  await mkdir(directory, { recursive: true });
  const target = path.join(directory, filename.replace(/[^a-z0-9._-]+/gi, '-'));
  await page.screenshot({ path: target, animations: 'disabled', ...options });
  return target;
}

function makeAssertion(name, pass, details = undefined) {
  return { name, pass: !!pass, details };
}

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

function colorLuminance(value) {
  const match = String(value || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) return null;
  const [, red, green, blue] = match.map(Number);
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
}

function isDarkColor(value) {
  const luminance = colorLuminance(value);
  return luminance != null && luminance < 0.35;
}

function rectsMatch(left, right, tolerance = 1) {
  if (!left || !right) return false;
  return ['x', 'y', 'width', 'height'].every((key) => Math.abs(left[key] - right[key]) <= tolerance);
}

function displayNameFor(extensionKey) {
  const displayName = DISPLAY_NAMES[extensionKey];
  ensure(displayName, `Unknown extension key: ${extensionKey}`);
  return displayName;
}

function workerMatchesExtension(worker, extensionKey) {
  return worker.name === displayNameFor(extensionKey);
}

function workerInfoFor(workers, extensionKey) {
  const worker = workers.find((item) => workerMatchesExtension(item, extensionKey));
  ensure(worker, `Missing service worker for ${extensionKey}`);
  return worker;
}

async function pathExists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function readManifestName(extensionDir) {
  const manifestPath = path.join(extensionDir, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const match = /^__MSG_([A-Za-z0-9_]+)__$/.exec(String(manifest.name || ''));
  if (!match) return manifest.name;
  const locale = String(manifest.default_locale || 'en');
  const messages = JSON.parse(await readFile(
    path.join(extensionDir, '_locales', locale, 'messages.json'),
    'utf8',
  ));
  return messages[match[1]]?.message || manifest.name;
}

async function validateExtensionDirs() {
  const missing = [];
  for (const [name, dir] of Object.entries(EXTENSIONS)) {
    if (!(await pathExists(dir))) missing.push(`${name}: ${dir}`);
    else if (!(await pathExists(path.join(dir, 'manifest.json')))) missing.push(`${name}: missing manifest.json`);
  }
  if (missing.length) {
    throw new Error(`Extension dist directories missing or incomplete: ${missing.join('; ')}`);
  }
}

async function snapshotDirectory(rootDir) {
  const entries = [];

  async function visit(currentDir) {
    const children = await readdir(currentDir, { withFileTypes: true });
    for (const child of children.sort((a, b) => a.name.localeCompare(b.name))) {
      if (child.name === '_metadata') continue;
      const absolutePath = path.join(currentDir, child.name);
      const relativePath = path.relative(rootDir, absolutePath) || '.';
      if (child.isDirectory()) {
        entries.push({ type: 'dir', path: relativePath });
        await visit(absolutePath);
        continue;
      }

      const fileStat = await stat(absolutePath);
      entries.push({
        type: child.isSymbolicLink() ? 'symlink' : 'file',
        path: relativePath,
        size: fileStat.size,
        sha256: createHash('sha256').update(await readFile(absolutePath)).digest('hex'),
      });
    }
  }

  await visit(rootDir);
  return entries;
}

async function prepareExtensionCopies(names, tempRoot) {
  const extensionRoot = path.join(tempRoot, 'extensions');
  await mkdir(extensionRoot, { recursive: true });

  const copies = [];
  for (const name of names) {
    const sourceDir = EXTENSIONS[name];
    const targetDir = path.join(extensionRoot, name);
    const sourceSnapshot = await snapshotDirectory(sourceDir);
    await cp(sourceDir, targetDir, {
      recursive: true,
      force: false,
      errorOnExist: true,
      filter(sourcePath) {
        return !sourcePath.split(path.sep).includes('_metadata');
      },
    });
    if (name === 'InkShade') {
      await appendFile(path.join(targetDir, 'config', 'detector-hints.config'), `

system-hint.fixture.test

SYSTEM THEME

================================

selector-hint.fixture.test

TARGET
html

MATCH
.fixture-native-dark
`);
    }
    copies.push({ name, sourceDir, targetDir, sourceSnapshot });
  }

  return copies;
}

async function assertSourceExtensionsUnchanged(copies) {
  for (const copy of copies) {
    const nextSnapshot = await snapshotDirectory(copy.sourceDir);
    if (json(nextSnapshot) !== json(copy.sourceSnapshot)) {
      const before = new Map(copy.sourceSnapshot.map((entry) => [entry.path, entry]));
      const after = new Map(nextSnapshot.map((entry) => [entry.path, entry]));
      const changed = [...new Set([...before.keys(), ...after.keys()])]
        .filter((entryPath) => json(before.get(entryPath)) !== json(after.get(entryPath)));
      throw new Error(
        `Source extension dist mutated during harness run: ${copy.name} (${copy.sourceDir}); changed=${changed.join(',')}`,
      );
    }
  }
}

async function resolveChromiumExecutable() {
  const envPath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  if (envPath) {
    if (!existsSync(envPath)) {
      throw new Error(
        `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH is set but missing: ${envPath}`,
      );
    }
    return { executablePath: envPath, source: 'env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH' };
  }

  let candidate = null;
  try {
    candidate = chromium.executablePath();
  } catch {
    candidate = null;
  }

  if (candidate && existsSync(candidate)) {
    return { executablePath: candidate, source: 'playwright-core default' };
  }

  const systemCandidates = process.platform === 'darwin'
    ? [
        '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      ]
    : process.platform === 'win32'
      ? [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
        ]
      : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/brave-browser'];
  const systemExecutable = systemCandidates.find((entry) => existsSync(entry));
  if (systemExecutable) {
    return { executablePath: systemExecutable, source: 'installed Chromium browser' };
  }

  throw new Error(
    'No compatible Chromium executable found. Install Chromium/Chrome/Brave, install the Playwright Chromium cache, or set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH.',
  );
}

function hostResolverRules() {
  return [
    `MAP ${HOSTS.ordinary} 127.0.0.1`,
    `MAP ${HOSTS.assets} 127.0.0.1`,
    `MAP ${HOSTS.ad} 127.0.0.1`,
    `MAP ${HOSTS.darkList} 127.0.0.1`,
    `MAP ${HOSTS.selectorHint} 127.0.0.1`,
    `MAP ${HOSTS.systemHint} 127.0.0.1`,
    `MAP ${HOSTS.jw} 127.0.0.1`,
    `MAP ${HOSTS.wol} 127.0.0.1`,
  ].join(',');
}

function extensionPageUrl(extensionId, resource) {
  return `chrome-extension://${extensionId}/${resource}`;
}

function classifyHost(req) {
  return cleanHost(req.headers.host);
}

function ordinaryFixtureHtml(port) {
  const adScript = httpUrl(HOSTS.ad, port, '/ads/ad.js');
  const adImage = httpUrl(HOSTS.ad, port, '/ads/pixel.png');
  const adFrame = httpUrl(HOSTS.ad, port, '/ads/frame');
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Ordinary Fixture</title>
    <style>
      body { font-family: sans-serif; background: #fafafa; color: #111; margin: 0; padding: 24px; }
      main { max-width: 840px; margin: 0 auto; }
      .ad-banner { width: 320px; min-height: 48px; background: #ffd4d4; border: 1px solid #d44; margin: 16px 0; }
      #content-card { padding: 16px; background: white; border: 1px solid #ddd; }
      iframe { width: 320px; height: 80px; border: 1px solid #999; }
    </style>
    <script>
      window.fixture = {
        coreScriptLoaded: false,
        adScriptLoaded: false,
        adFrameLoaded: false,
        adImageLoaded: false,
        coreClicks: 0
      };
      window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'fixture-ad-frame-loaded') {
          window.fixture.adFrameLoaded = true;
        }
      });
      document.addEventListener('DOMContentLoaded', () => {
        window.fixture.coreScriptLoaded = true;
        const btn = document.getElementById('core-action');
        btn.addEventListener('click', () => {
          window.fixture.coreClicks += 1;
          btn.dataset.clicked = String(window.fixture.coreClicks);
        });
      });
    </script>
    <script async src="${adScript}"></script>
  </head>
  <body>
    <main>
      <h1 id="ordinary-title">Ordinary Fixture</h1>
      <div id="content-card">
        <p id="ordinary-copy">Core content should stay usable with blocking enabled.</p>
        <button id="core-action" type="button">Click me</button>
        <section
          id="chatgpt-turn"
          data-testid="conversation-turn-1"
          class="text-token-text-primary scroll-mb-[calc(var(--thread-response-height))]"
        >Chat application content with an incidental ad- substring.</section>
        <aside id="thread-adapter" class="thread-adapter">Thread adapter controls.</aside>
        <div id="adaptive-panel" data-ad="adaptive-layout">Adaptive application panel.</div>
        <div id="ad-hoc-panel" class="ad-hoc-layout">Ad hoc workspace content.</div>
      </div>
      <div class="ad-banner" id="ad-banner">Ad banner placeholder</div>
      <img
        id="ad-pixel"
        src="${adImage}"
        alt="ad pixel"
        width="1"
        height="1"
        onload="window.fixture.adImageLoaded = true"
      />
      <iframe id="ad-frame" src="${adFrame}" title="ad frame"></iframe>
    </main>
  </body>
</html>`;
}

function lightFixtureHtml(port) {
  const crossOriginCss = httpUrl(HOSTS.assets, port, '/theme/complex.css');
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Light Fixture</title>
    <link rel="stylesheet" href="${crossOriginCss}" crossorigin="anonymous" />
    <style>
      :root {
        --page-bg: #f8f5ef;
        --surface: #ffffff;
        --ink: #202124;
        --accent: #3157a4;
      }
      html, body { margin: 0; padding: 0; background: var(--page-bg); color: var(--ink); }
      body { font-family: Georgia, serif; padding: 24px; }
      main { background: var(--surface); border: 1px solid #ddd; padding: 16px; }
      .layout-shell { display: grid; grid-template-columns: 2fr 1fr; gap: 18px; width: 720px; }
      .fixture-card { background: var(--surface); border: 1px solid #ddd; padding: 12px; min-height: 96px; }
      .gradient-panel { background: linear-gradient(135deg, #ffffff 0%, #dbe7ff 100%); color: #18233a; }
      .pseudo-badge::before { content: "New"; display: inline-block; background: #ffe08a; color: #332400; padding: 3px 8px; }
      .fixture-scroll { height: 48px; overflow: auto; }
      video { width: 240px; height: 135px; background: #ddd; display: block; margin-top: 16px; }
      iframe { width: 320px; height: 120px; border: 1px solid #555; display: block; margin-top: 16px; }
    </style>
    <script>
      customElements.define('fixture-panel', class extends HTMLElement {
        connectedCallback() {
          if (this.shadowRoot) return;
          const root = this.attachShadow({ mode: 'open' });
          root.innerHTML = '<style>.shadow-card{background:#fff;color:#222;border:1px solid #ccc;padding:10px}</style><div class="shadow-card">Shadow surface</div>';
        }
      });
      document.addEventListener('DOMContentLoaded', () => {
        const dynamic = document.createElement('div');
        dynamic.id = 'dynamic-card';
        dynamic.className = 'fixture-card';
        dynamic.textContent = 'Dynamically inserted surface';
        document.getElementById('dynamic-host').append(dynamic);
        window.fixtureDynamicReady = true;
      });
    </script>
  </head>
  <body>
    <main>
      <h1>Light Fixture</h1>
      <p id="light-copy">InkShade should darken this page.</p>
      <div id="layout-shell" class="layout-shell">
        <section id="light-card" class="fixture-card">
          <label for="light-input">Fixture input</label>
          <input id="light-input" placeholder="Type here" />
          <div id="light-scroll" class="fixture-scroll"><p>Scrollable fixture content.</p><p>Second line.</p><p>Third line.</p></div>
        </section>
        <aside id="gradient-panel" class="fixture-card gradient-panel">
          <span id="pseudo-badge" class="pseudo-badge">Gradient panel</span>
        </aside>
        <article id="cross-origin-card" class="cross-origin-card">Cross-origin stylesheet surface</article>
        <fixture-panel id="shadow-panel"></fixture-panel>
      </div>
      <div id="dynamic-host"></div>
      <img id="light-image" alt="fixture image" src="data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=" />
      <video id="light-video" controls></video>
      <iframe id="blank-probe" name="blank-probe" src="about:blank" title="blank probe"></iframe>
    </main>
  </body>
</html>`;
}

function darkFixtureHtml() {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="color-scheme" content="dark" />
    <title>Native Dark Fixture</title>
    <style>
      html, body { margin: 0; padding: 0; background: #111111; color: #eeeeee; }
      body { font-family: Georgia, serif; padding: 24px; }
      main { background: #181818; border: 1px solid #444; padding: 16px; }
    </style>
  </head>
  <body>
    <main>
      <h1>Native Dark Fixture</h1>
      <p>InkShade should preserve this native dark presentation by default.</p>
    </main>
  </body>
</html>`;
}

function detectorFixtureHtml(caseName) {
  const darkStyle = `
    html, body { margin: 0; min-height: 100%; background: #111; color: #eee; }
    body { font-family: system-ui, sans-serif; padding: 24px; }
    main { min-height: 720px; background: #181818; border: 1px solid #444; padding: 18px; }
    .detector-card { background: #242424; border: 1px solid #555; padding: 14px; margin-top: 18px; }
    button, input { background: #303030; color: #eee; border: 1px solid #777; padding: 8px; }
  `;
  const lightStyle = `
    html, body { margin: 0; min-height: 100%; background: #fff; color: #111; }
    body { font-family: system-ui, sans-serif; padding: 24px; }
    main { min-height: 720px; background: #fff; border: 1px solid #ddd; padding: 18px; }
    .detector-card { background: #f5f5f5; border: 1px solid #ccc; padding: 14px; margin-top: 18px; }
    button, input { background: #fff; color: #111; border: 1px solid #888; padding: 8px; }
  `;
  const cases = {
    'meta-dark': {meta: '<meta name="color-scheme" content="dark">', style: darkStyle},
    'meta-mixed-dark': {meta: '<meta name="color-scheme" content="light dark">', style: darkStyle},
    'html-dark': {html: 'class="dark"', style: darkStyle},
    'body-dark': {body: 'class="dark"', style: darkStyle},
    'data-theme': {html: 'data-theme="dark"', style: darkStyle},
    'data-color-scheme': {html: 'data-color-scheme="dark"', style: darkStyle},
    'visual-dark': {style: darkStyle},
    'transparent-dark': {style: `${darkStyle} html, body, main { background: #111; } body, main { background-color: transparent; }`},
    'root-filter-invert': {style: `${lightStyle} html { filter: invert(1); }`},
    'meta-light': {meta: '<meta name="color-scheme" content="light">', style: lightStyle},
    'misleading-html-dark': {html: 'class="dark"', style: lightStyle},
    'meta-dark-light': {meta: '<meta name="color-scheme" content="dark">', style: lightStyle},
    'dark-hero-light-body': {style: `${lightStyle} .detector-hero { min-height: 180px; background: #111; color: #eee; padding: 12px; }`},
    'transparent-light': {style: `${lightStyle} html, body, main { background: #fff; } body, main { background-color: transparent; }`},
    'prefers-dark-light': {style: `${lightStyle} @media (prefers-color-scheme: dark) { html, body, main { background: #fff; color: #111; } }`},
    'counter-invert-light': {style: `${lightStyle} html, body { filter: invert(1); }`},
    'viewport-dark-hero-light-document': {style: `${lightStyle}
      body { padding: 0; }
      main { min-height: 2600px; padding: 0; }
      .detector-hero { min-height: 1100px; background: #16243a; color: #fff; padding: 24px; }
      .detector-light-content { min-height: 1400px; background: #fff; color: #111; padding: 24px; }
    `},
    delayed: {style: lightStyle, delayed: true},
  };
  const fixture = cases[caseName] || cases['meta-dark'];
  const delayedScript = fixture.delayed ? `
    setTimeout(() => {
      document.documentElement.dataset.theme = 'dark';
      document.body.classList.add('native-dark');
      document.documentElement.style.background = '#111';
      document.body.style.background = '#111';
      document.body.style.color = '#eee';
      const main = document.querySelector('main');
      if (main) main.style.background = '#181818';
    }, 700);
  ` : '';
  const content = caseName === 'viewport-dark-hero-light-document' ? `
    <main>
      <section class="detector-hero"><h1>Dark hero</h1><p>The initial viewport is intentionally dark.</p></section>
      <section class="detector-light-content"><h2>Light document</h2><p>InkShade must still theme the light content below the fold.</p></section>
    </main>` : `
    <main>
      <h1>Native-dark detector fixture</h1>
      <p id="detector-copy">Case: ${caseName}. This copy must remain readable.</p>
      ${caseName === 'dark-hero-light-body' ? '<section class="detector-hero">Dark hero only; the page remains light.</section>' : ''}
      <section class="detector-card"><label for="detector-input">Fixture input</label> <input id="detector-input" value="Readable control" /></section>
    </main>`;
  return `<!doctype html>
<html ${fixture.html || ''}>
  <head>
    <meta charset="utf-8" />
    ${fixture.meta || ''}
    <title>Detector Fixture: ${caseName}</title>
    <style>${fixture.style}</style>
    <script>${delayedScript}</script>
  </head>
  <body ${fixture.body || ''}>
    ${content}
  </body>
</html>`;
}

const STUDYNAV_FIXTURE_PATH = '/en/library/bible/demo-edition/books/sample/1/';
const STUDYNAV_FIXTURE_CANONICAL = `https://${HOSTS.jw}${STUDYNAV_FIXTURE_PATH}`;

function jwFixtureHtml() {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>StudyNav demo reading</title>
    <link rel="canonical" href="${STUDYNAV_FIXTURE_CANONICAL}" />
    <style>
      :root { color-scheme: light; background: #f3f6fa; }
      * { box-sizing: border-box; }
      body { font-family: system-ui, sans-serif; margin: 0; padding: 0; background: #f3f6fa; color: #172234; }
      #regionHeader {
        min-height: 68px; padding: 13px 32px; border-bottom: 1px solid #29466f;
        background: #172234; color: #fff; display: grid; align-content: center; gap: 2px;
      }
      #regionHeader strong { font-size: 18px; letter-spacing: -.01em; }
      #regionHeader span { color: #bdcbe0; font-size: 12px; }
      #language-shell {
        position: absolute; z-index: 2; top: 14px; right: 32px; display: flex; align-items: center; gap: 8px;
        color: #e8eef8; font-size: 13px;
      }
      #language-shell select { min-height: 38px; padding: 6px 34px 6px 10px; border: 1px solid #6d83a3; border-radius: 8px; background: #fff; color: #172234; }
      #language-shell input { position: absolute; left: -10000px; width: 1px; height: 1px; }
      #article {
        max-width: 760px; margin: 36px auto; padding: 42px 52px 56px; border: 1px solid #d9e1ec; border-radius: 18px;
        background: #fff; box-shadow: 0 18px 48px rgba(31,49,80,.10);
      }
      #article h1 { margin: 0 0 30px; font-size: 36px; letter-spacing: -.035em; }
      #article p { font-size: 17px; line-height: 1.62; }
      #bibleText { display: grid; gap: 8px; margin: 24px 0; }
      #bibleText .verse { display: block; padding: 10px 12px; border-radius: 9px; background: #f7f9fc; font-size: 17px; line-height: 1.55; }
      #bibleText .verseNum { margin-right: 7px; }
      #bibleText .verseNum a { color: #43669f; font-weight: 750; text-decoration: none; }
      #nonarticle-dialog { position: absolute; left: -10000px; top: 0; width: 280px; max-width: 280px; }
      #footer { padding: 22px 32px; border-top: 1px solid #d9e1ec; background: #e9eef5; color: #536176; }
      figure { margin: 30px 0; }
      img {
        width: 100%; height: 220px; display: block; border-radius: 13px;
        background:
          radial-gradient(circle at 76% 24%, #f2c667 0 8%, transparent 8.5%),
          linear-gradient(150deg, transparent 0 47%, #7ca174 47.5% 64%, #43669f 64.5% 100%),
          #dce7f4;
      }
      figcaption { margin-top: 8px; color: #637087; font-size: 14px; }
      #compact-publication-card {
        display: grid; grid-template-columns: 116px minmax(0, 1fr); gap: 12px; align-items: start;
        margin: 24px 0; padding: 10px; border: 1px solid #d9e1ec; border-radius: 10px;
      }
      #compact-publication-card img { width: 116px; height: 72px; border-radius: 7px; }
      #compact-publication-card p { margin: 0; font-size: 14px; }
      #article-table { width: 100%; margin: 28px 0; border-collapse: separate; border-spacing: 0; }
      #article-table th, #article-table td { padding: 8px 0; text-align: left; }
      #jw-player { position: relative; }
      video { width: 100%; height: 280px; background: #101827; display: block; margin-top: 22px; border-radius: 12px; }
      #jw-seek { position: absolute; z-index: 4; left: 12px; bottom: 54px; width: calc(100% - 24px); margin: 0; }
      #jw-controls { margin-top: -43px; padding: 10px 14px; border-radius: 0 0 12px 12px; color: #fff; background: linear-gradient(transparent, rgba(0,0,0,.78)); }
      #jw-player.vjs-user-active #jw-controls { opacity: 1; }
      #jw-player.vjs-user-inactive #jw-controls { opacity: 0; }
      #fixture-caption {
        position: absolute; z-index: 2; left: 50%; bottom: 54px; transform: translateX(-50%);
        width: max-content; max-width: calc(100% - 48px); pointer-events: none; text-align: center;
      }
      #fixture-caption > div { padding: 5px 10px; border-radius: 5px; background: rgba(0,0,0,.72); color: #fff; font-size: 18px; }
      #fixture-transcript { margin-top: 18px; padding: 14px 16px; border-left: 4px solid #43669f; border-radius: 8px; background: #eef3fa; color: #40516a; }
      #fixture-transcript p { margin: 3px 0; font-size: 14px; }
    </style>
  </head>
  <body class="PublicationArticle docId-1001070103 ml-E">
    <header id="regionHeader"><strong>StudyNav demo</strong><span>Reading tools preview</span></header>
    <aside id="language-shell">
      <label for="otherAvailLangsChooser">Language</label>
      <select id="otherAvailLangsChooser">
        <option>English</option>
        <option>Spanish</option>
        <option>German</option>
        <option>French</option>
        <option>Italian</option>
        <option>Ukrainian</option>
      </select>
      <input type="text" id="otherAvailLangsChooser" class="jsAutoCompleteInput" aria-label="Language autocomplete" />
    </aside>
    <div id="nonarticle-dialog" class="jwac" role="dialog">
      <p>Page menu outside the reading article.</p>
      <table id="dialog-table"><tr><td>Menu cell</td></tr></table>
    </div>
    <div class="jsGlobalShareData" data-is-current-page="1">
      <div class="link" data-pub="nwtsty" data-bible="1001000" data-wtlocale="E"></div>
    </div>
    <main id="article" class="jwac docId-1001070103 ml-E pub-nwtsty"
      data-bible-pub="nwtsty" data-booknum="1" data-bookname="Sample Reading" data-chapter="1">
      <h1>Sample Reading 1:1–3</h1>
      <p data-pid="p1" id="p1">A useful thought is easier to revisit when it stays beside the text.</p>
      <p data-pid="p2" id="p2">A precise link returns to the same place without searching again.</p>
      <div id="bibleText">
        <span class="verse jsHasMediaMarker" id="v1001001"><sup class="verseNum"><a href="#v1001001" class="jsHighlightOnly">1</a></sup> A quiet path began near the hills.</span>
        <span class="verse jsHasMediaMarker" id="v1001002"><sup class="verseNum"><a href="#v1001002" class="jsHighlightOnly">2</a></sup> Travelers paused to study the map.</span>
        <span class="verse jsHasMediaMarker" id="v1001003"><sup class="verseNum"><a href="#v1001003" class="jsHighlightOnly">3</a></sup> A small lamp marked the next step.</span>
      </div>
      <audio id="chapter-audio" preload="none" src="${VERSE_AUDIO_URL}"></audio>
      <figure>
        <img id="article-image" alt="A mountain trail at sunrise" src="data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=" />
        <figcaption>A clear path through the hills.</figcaption>
      </figure>
      <a id="compact-publication-card" class="publication-card" href="/en/library/books/compact-preview/">
        <img id="compact-card-image" alt="Compact publication preview" src="data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=" />
        <p>Small publication preview text must remain unobstructed.</p>
      </a>
      <table id="article-table"><thead><tr><th>Study step</th></tr></thead><tbody><tr><td>Read</td></tr><tr><td>Review</td></tr></tbody></table>
      <div class="video-js vjs-user-active vjs-paused" id="jw-player">
        <video id="jw-video" controls preload="metadata" src="https://${HOSTS.jwMedia}/media/fixture.mp4"></video>
        <div class="vjs-text-track-display"><div id="fixture-caption" class="vjs-text-track-cue"><div>Sample caption remains readable.</div></div></div>
        <input id="jw-seek" type="range" min="0" max="100" value="84" aria-label="Seek video" />
        <div class="vjs-control-bar" id="jw-controls">Player controls</div>
      </div>
      <div id="fixture-transcript" class="transcript">
        <p>First transcript line is ready for search and download.</p>
        <p>Second searchable transcript line mentions lantern.</p>
      </div>
    </main>
    <footer id="footer" class="jsLockedChrome">End of demo page</footer>
  </body>
</html>`;
}

function wolFixtureHtml() {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>WOL Fixture</title>
    <link rel="canonical" href="https://wol.jw.org/en/wol/d/r1/lp-e/999" />
    <style>
      html, body { margin: 0; padding: 0; background: #fff; color: #181818; }
      body { font: 16px/1.55 system-ui, sans-serif; }
      #regionHeader { position: static; min-height: 88px; padding: 12px 20px; box-sizing: border-box; background: #eceff3; }
      #regionHeader .mejs-container { margin-top: 8px; height: 28px; }
      #wol-shell { display: grid; grid-template-columns: 184px minmax(0, 900px); gap: 28px; width: 1112px; margin: 22px auto; }
      #wol-nav { min-height: 380px; padding: 12px; background: #f3f5f7; }
      .bodyTxt { width: 720px; max-width: 720px; margin: 0; padding: 18px; box-sizing: border-box; border: 1px solid #ccd2da; }
      .scalableui { width: 100%; }
      .bodyTxt table { width: 410px; border-collapse: separate; border-spacing: 2px; }
      .bodyTxt td, .bodyTxt th { border: 0; padding: 2px 4px; }
      @media (max-width: 980px) {
        #wol-shell { grid-template-columns: 1fr; width: min(720px, calc(100vw - 24px)); }
        #wol-nav { display: none; }
        .bodyTxt { width: 100%; }
      }
    </style>
  </head>
  <body>
    <header id="regionHeader">
      <span>Synthetic reference-library fixture</span>
      <div class="mejs-container" role="application" aria-label="audio player">
        <audio id="wolplayer" preload="none" src="${VERSE_AUDIO_URL}"></audio>
      </div>
    </header>
    <div id="wol-shell">
      <nav id="wol-nav">Reference navigation must not move.</nav>
      <main class="bodyTxt document" id="article">
        <div class="scalableui" id="wol-article">
          <h1>Stable synthetic reference article</h1>
          <p id="p1" data-pid="p1">Reference paragraph one remains in its original layout.</p>
          <p id="p2" data-pid="p2">Reference paragraph two can receive local notes safely.</p>
          <table id="wol-table"><tbody><tr><th>Heading</th><td>Cell</td></tr><tr><th>Second row</th><td>More detail</td></tr></tbody></table>
        </div>
      </main>
    </div>
  </body>
</html>`;
}

function createFixtureServer() {
  const server = http.createServer((req, res) => {
    const host = classifyHost(req);
    const url = new URL(req.url || '/', 'http://fixture.local');

    if (url.pathname === '/favicon.ico') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (host === HOSTS.ad && url.pathname === '/ads/ad.js') {
      res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8' });
      res.end('window.fixture && (window.fixture.adScriptLoaded = true);');
      return;
    }

    if (host === HOSTS.ad && url.pathname === '/ads/frame') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(`<!doctype html><html><body><script>parent.postMessage({ type: 'fixture-ad-frame-loaded' }, '*');</script><p>ad frame</p></body></html>`);
      return;
    }

    if (host === HOSTS.ad && url.pathname === '/ads/pixel.png') {
      res.writeHead(200, { 'content-type': 'image/png', 'content-length': String(PNG_PIXEL.length) });
      res.end(PNG_PIXEL);
      return;
    }

    if (host === HOSTS.jw && url.pathname === '/media/fixture.mp4') {
      const range = /^bytes=(\d+)-(\d*)$/i.exec(String(req.headers.range || ''));
      if (range) {
        const start = Math.min(VIDEO_MP4.length - 1, Number(range[1]));
        const requestedEnd = range[2] ? Number(range[2]) : VIDEO_MP4.length - 1;
        const end = Math.min(VIDEO_MP4.length - 1, Math.max(start, requestedEnd));
        const body = VIDEO_MP4.subarray(start, end + 1);
        res.writeHead(206, {
          'content-type': 'video/mp4',
          'content-length': String(body.length),
          'content-range': `bytes ${start}-${end}/${VIDEO_MP4.length}`,
          'accept-ranges': 'bytes',
        });
        res.end(body);
        return;
      }
      res.writeHead(200, {
        'content-type': 'video/mp4',
        'content-length': String(VIDEO_MP4.length),
        'accept-ranges': 'bytes',
      });
      res.end(VIDEO_MP4);
      return;
    }

    if (host === HOSTS.assets && url.pathname === '/theme/complex.css') {
      res.writeHead(200, {
        'content-type': 'text/css; charset=utf-8',
        'cache-control': 'public, max-age=60',
        'access-control-allow-origin': '*',
      });
      res.end(`
        .cross-origin-card {
          display: flex;
          align-items: center;
          min-height: 72px;
          padding: 12px;
          background: #fff3d6;
          color: #35280d;
          border: 2px solid #d6aa43;
        }
      `);
      return;
    }

    if (host === HOSTS.ordinary && url.pathname === '/ordinary') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(ordinaryFixtureHtml(server.address().port));
      return;
    }

    if (host === HOSTS.ordinary && url.pathname === '/light') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(lightFixtureHtml(server.address().port));
      return;
    }

    if (host === HOSTS.ordinary && url.pathname === '/dark') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(darkFixtureHtml());
      return;
    }

    if (host === HOSTS.darkList && url.pathname === '/dark') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(darkFixtureHtml());
      return;
    }

    if (
      [HOSTS.ordinary, HOSTS.selectorHint, HOSTS.systemHint].includes(host) &&
      url.pathname.startsWith('/detector/')
    ) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(detectorFixtureHtml(decodeURIComponent(url.pathname.substring('/detector/'.length))));
      return;
    }

    if (
      host === HOSTS.jw &&
      (url.pathname === '/en/library/test' ||
        url.pathname === STUDYNAV_FIXTURE_PATH ||
        url.pathname === '/ru/biblioteka/bibliya/izuchenie-biblii/knigi/bytie/1/')
    ) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(jwFixtureHtml());
      return;
    }

    if (host === HOSTS.wol && url.pathname === '/en/wol/d/r1/lp-e/999') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(wolFixtureHtml());
      return;
    }

    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`No fixture for host=${host} path=${url.pathname}`);
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve({
        server,
        port: server.address().port,
        close: () =>
          new Promise((done, closeReject) => {
            server.close((error) => (error ? closeReject(error) : done()));
          }),
      });
    });
  });
}

async function routeStudyNavFixtures(context) {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `https://${HOSTS.jw}` });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `https://${HOSTS.wol}` });
  await context.route(`https://${HOSTS.jw}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/missing-image.png') {
      const isNavigation = route.request().resourceType() === 'document';
      await route.fulfill({
        status: isNavigation ? 200 : 404,
        contentType: 'text/plain; charset=utf-8',
        body: isNavigation ? 'Missing image fallback fixture' : 'Missing image fixture',
      });
      return;
    }
    if ([
      '/en/library/test',
      STUDYNAV_FIXTURE_PATH,
      '/ru/biblioteka/bibliya/izuchenie-biblii/knigi/bytie/1/',
    ].includes(url.pathname)) {
      await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: jwFixtureHtml() });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'text/plain; charset=utf-8', body: 'No HTTPS JW fixture' });
  });
  await context.route(`https://${HOSTS.wol}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/en/wol/d/r1/lp-e/999') {
      await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: wolFixtureHtml() });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'text/plain; charset=utf-8', body: 'No HTTPS WOL fixture' });
  });
}

function createScenario(id, extensions) {
  return {
    id,
    extensions,
    skipped: false,
    assertions: [],
    pageErrors: [],
    consoleErrors: [],
    requestFailures: [],
    pages: [],
    serviceWorkers: [],
    notes: [],
    launchMode: null,
  };
}

function recordPageCapture(scenario, page, label) {
  page.on('pageerror', (error) => {
    scenario.pageErrors.push({
      label,
      message: String(error?.message || error),
      stack: String(error?.stack || ''),
    });
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      scenario.consoleErrors.push({
        label,
        text: message.text(),
        location: message.location(),
      });
    }
  });
  page.on('requestfailed', (request) => {
    scenario.requestFailures.push({
      label,
      url: request.url(),
      resourceType: request.resourceType(),
      errorText: request.failure()?.errorText || 'unknown',
    });
  });
}

async function waitFor(predicate, timeoutMs, message) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await predicate()) return;
    await sleep(100);
  }
  throw new Error(message);
}

async function collectServiceWorkers(context) {
  const infos = [];
  for (const worker of context.serviceWorkers()) {
    try {
      const info = await worker.evaluate(async () => {
        const manifest = chrome.runtime.getManifest();
        return {
          id: chrome.runtime.id,
          name: manifest.name,
          version: manifest.version,
          url: self.location.href,
        };
      });
      infos.push(info);
    } catch (error) {
      infos.push({
        id: null,
        name: 'unknown',
        version: null,
        url: worker.url(),
        error: String(error?.message || error),
      });
    }
  }
  return infos.sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

async function waitForNamedWorkers(context, names) {
  await waitFor(async () => {
    const workers = await collectServiceWorkers(context);
    return names.every((name) => workers.some((worker) => workerMatchesExtension(worker, name)));
  }, 15000, `Timed out waiting for service workers: ${names.join(', ')}`);
  return collectServiceWorkers(context);
}

async function getWorkerByName(context, name) {
  await waitFor(async () => context.serviceWorkers().length > 0, 15000, 'No service workers appeared');
  const started = Date.now();
  while (Date.now() - started < 15000) {
    for (const worker of context.serviceWorkers()) {
      try {
        const workerName = await worker.evaluate(() => chrome.runtime.getManifest().name);
        if (workerName === displayNameFor(name)) return worker;
      } catch {
        continue;
      }
    }
    await sleep(100);
  }
  throw new Error(`Timed out finding service worker for ${name}`);
}

async function withContext(options, run) {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'nick-ext-diff-'));
  const profileDir = path.join(tempRoot, 'profile');
  let launchExecutablePath = options.executablePath;
  const extensionCopies = await prepareExtensionCopies(options.extensions || [], tempRoot);
  const extensionDirs = extensionCopies.map((copy) => copy.targetDir);
  const args = [
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-domain-reliability',
    '--disable-sync',
  ];

  if (options.locale) {
    args.push(`--lang=${options.locale}`);
    args.push(`--accept-lang=${options.locale}`);
    if (process.platform === 'darwin') {
      const appleLocale = options.locale.toLowerCase() === 'ru' ? 'ru_RU' : options.locale;
      const quoteForShell = (value) => `'${String(value).replaceAll("'", `'\"'\"'`)}'`;
      const wrapperPath = path.join(tempRoot, 'localized-chromium');
      await writeFile(
        wrapperPath,
        `#!/bin/sh\nexec ${quoteForShell(options.executablePath)} -AppleLanguages ${quoteForShell(`(${options.locale})`)} -AppleLocale ${quoteForShell(appleLocale)} "$@"\n`,
        'utf8',
      );
      await chmod(wrapperPath, 0o700);
      launchExecutablePath = wrapperPath;
    }
  }

  if (options.useFixtureHostResolverRules !== false) {
    args.push(`--host-resolver-rules=${hostResolverRules()}`);
  }

  if (extensionDirs.length) {
    args.push(`--disable-extensions-except=${extensionDirs.join(',')}`);
    args.push(`--load-extension=${extensionDirs.join(',')}`);
  }

  const attempts = [{ headless: true, launchMode: 'headless' }];
  if (process.env.DISPLAY || process.platform === 'darwin' || process.platform === 'win32') {
    attempts.push({ headless: false, launchMode: 'headed-fallback' });
  }

  let context = null;
  let launchMeta = null;
  let lastError = null;

  try {
    for (const attempt of attempts) {
      try {
        context = await chromium.launchPersistentContext(profileDir, {
          executablePath: launchExecutablePath,
          headless: attempt.headless,
          args,
          env: options.locale
            ? {
                ...process.env,
                LANG: `${options.locale.toLowerCase() === 'ru' ? 'ru_RU' : options.locale}.UTF-8`,
                LC_ALL: `${options.locale.toLowerCase() === 'ru' ? 'ru_RU' : options.locale}.UTF-8`,
                LANGUAGE: options.locale,
              }
            : process.env,
          userAgent: options.userAgent,
          extraHTTPHeaders: options.extraHTTPHeaders,
          locale: options.locale,
          deviceScaleFactor: options.deviceScaleFactor || 1,
          hasTouch: options.hasTouch === true,
        });
        launchMeta = attempt;
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!context) {
      throw lastError || new Error('Failed to launch Chromium persistent context');
    }

    return await run(context, launchMeta);
  } finally {
    if (context) {
      try {
        await context.close();
      } catch {
        // Ignore close failures during cleanup.
      }
    }
    try {
      await assertSourceExtensionsUnchanged(extensionCopies);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }
}

async function openPage(context, scenario, label, url, navigationOptions = {}) {
  const page = await context.newPage();
  recordPageCapture(scenario, page, label);
  const response = await page.goto(url, {
    waitUntil: navigationOptions.waitUntil ?? 'load',
    timeout: navigationOptions.timeout ?? 30000,
  });
  const details = await page.evaluate(() => ({
    title: document.title,
    dataPidCount: document.querySelectorAll('[data-pid]').length,
  }));
  const navigation = {
    label,
    url,
    finalUrl: page.url(),
    status: response?.status() ?? null,
    ok: response?.ok() ?? null,
    title: details.title,
    dataPidCount: details.dataPidCount,
  };
  page.__navMeta = navigation;
  scenario.pages.push(navigation);
  return page;
}

function getPageNavigation(page) {
  return page.__navMeta || null;
}

function getLiveTransportBlocker(navigation) {
  if (!navigation) return 'missing navigation metadata';
  if (navigation.status == null) return `missing navigation response (title=${navigation.title || 'n/a'})`;
  if (navigation.status < 200 || navigation.status >= 300) {
    return `HTTP ${navigation.status} (title=${navigation.title || 'n/a'}, dataPidCount=${navigation.dataPidCount})`;
  }
  if (navigation.finalUrl.startsWith('chrome-error://')) {
    return `chrome-error navigation (${navigation.finalUrl})`;
  }
  if (String(navigation.title || '').trim().toUpperCase() === 'ERROR') {
    return `error-page title=${navigation.title} dataPidCount=${navigation.dataPidCount}`;
  }
  return null;
}

function isLiveTransportException(error) {
  const message = String(error?.message || error);
  return /page\.goto:|net::ERR_|ERR_NAME_|ERR_CONNECTION_|navigation.*timeout/i.test(message);
}

async function getOrdinaryState(page) {
  return page.evaluate(() => {
    const cosmeticSafetyIds = ['chatgpt-turn', 'thread-adapter', 'adaptive-panel', 'ad-hoc-panel'];
    const cosmeticSafetyDisplays = Object.fromEntries(cosmeticSafetyIds.map((id) => {
      const element = document.getElementById(id);
      const style = element ? getComputedStyle(element) : null;
      return [id, style ? { display: style.display, visibility: style.visibility } : null];
    }));
    return {
      title: document.title,
      fixture: { ...window.fixture },
      adBannerDisplay: getComputedStyle(document.getElementById('ad-banner')).display,
      adStyleCount: document.querySelectorAll('#clearshield-cosmetic').length,
      contentVisible: !!document.getElementById('ordinary-copy')?.innerText,
      cosmeticSafetyDisplays,
      cosmeticSafetyVisible: Object.values(cosmeticSafetyDisplays).every((style) =>
        style?.display !== 'none' && style?.visibility !== 'hidden'),
      clicked: document.getElementById('core-action')?.dataset.clicked || '0',
    };
  });
}

async function getPublicPageState(page) {
  return page.evaluate(() => ({
    title: document.title,
    heading: document.querySelector('h1, h2, h3')?.textContent?.trim() || '',
    bodyLength: document.body?.innerText?.length || 0,
    linkCount: document.querySelectorAll('a[href]').length,
    visibleImageCount: Array.from(document.images).filter((image) => {
      const style = getComputedStyle(image);
      return style.display !== 'none' && style.visibility !== 'hidden';
    }).length,
  }));
}

async function getInkShadeState(page) {
  return page.evaluate(() => {
    const style = (selector) => {
      const element = document.querySelector(selector);
      return element ? getComputedStyle(element) : null;
    };
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
      };
    };
    const shadowCard = document.getElementById('shadow-panel')?.shadowRoot?.querySelector('.shadow-card');
    return {
      dataset: document.documentElement.getAttribute('data-darkreader-scheme'),
      darkReaderMode: document.documentElement.getAttribute('data-darkreader-mode'),
      darkReaderScheme: document.documentElement.getAttribute('data-darkreader-scheme'),
      themeStyleCount: document.querySelectorAll('.darkreader').length,
      themeMarkerCount: document.querySelectorAll('meta[name="darkreader"]').length,
      bodyBackground: style('body')?.backgroundColor || null,
      cardBackground: style('#light-card')?.backgroundColor || null,
      cardColor: style('#light-card')?.color || null,
      inputBackground: style('#light-input')?.backgroundColor || null,
      inputColor: style('#light-input')?.color || null,
      scrollbarColor: style('#light-scroll')?.scrollbarColor || null,
      crossOriginBackground: style('#cross-origin-card')?.backgroundColor || null,
      crossOriginDisplay: style('#cross-origin-card')?.display || null,
      gradientBackground: style('#gradient-panel')?.backgroundImage || null,
      pseudoBackground: (() => {
        const element = document.getElementById('pseudo-badge');
        return element ? getComputedStyle(element, '::before').backgroundColor : null;
      })(),
      dynamicBackground: style('#dynamic-card')?.backgroundColor || null,
      shadowBackground: shadowCard ? getComputedStyle(shadowCard).backgroundColor : null,
      imageFilter: style('#light-image')?.filter || null,
      imageOpacity: style('#light-image')?.opacity || null,
      hasVideo: !!document.getElementById('light-video'),
      bodyElementCount: document.body?.querySelectorAll('*').length || 0,
      layout: {
        display: style('#layout-shell')?.display || null,
        columns: style('#layout-shell')?.gridTemplateColumns || null,
        gap: style('#layout-shell')?.gap || null,
        shell: rect('#layout-shell'),
        card: rect('#light-card'),
        gradient: rect('#gradient-panel'),
        image: rect('#light-image'),
      },
      frame: (() => {
        const iframe = document.getElementById('blank-probe');
        const doc = iframe?.contentDocument;
        return doc ? {
          dataset: doc.documentElement.getAttribute('data-darkreader-scheme'),
          darkReaderMode: doc.documentElement.getAttribute('data-darkreader-mode'),
          themeStyleCount: doc.querySelectorAll('.darkreader').length,
          themeMarkerCount: doc.querySelectorAll('meta[name="darkreader"]').length,
        } : null;
      })(),
    };
  });
}

async function getInkShadeDetectorState(page) {
  return page.evaluate(() => {
    const style = (selector) => {
      const element = document.querySelector(selector);
      return element ? getComputedStyle(element) : null;
    };
    return {
      caseName: document.title.replace(/^Detector Fixture: /, ''),
      darkReaderMode: document.documentElement.getAttribute('data-darkreader-mode'),
      darkReaderScheme: document.documentElement.getAttribute('data-darkreader-scheme'),
      themeStyleCount: document.querySelectorAll('.darkreader').length,
      themeMarkerCount: document.querySelectorAll('meta[name="darkreader"]').length,
      rootBackground: style('html')?.backgroundColor || null,
      bodyBackground: style('body')?.backgroundColor || null,
      mainBackground: style('main')?.backgroundColor || null,
      copyColor: style('#detector-copy')?.color || null,
      inputBackground: style('#detector-input')?.backgroundColor || null,
      delayedTheme: document.documentElement.dataset.theme || null,
    };
  });
}

async function settleInkShade(page, timeoutMs = 3000, expectedMode = 'dark') {
  try {
    await page.waitForFunction(
      (mode) => mode == null
        ? !document.documentElement.hasAttribute('data-darkreader-mode')
        : document.documentElement.getAttribute('data-darkreader-mode') === 'dynamic' &&
          document.documentElement.getAttribute('data-darkreader-scheme') === mode,
      expectedMode,
      { timeout: timeoutMs },
    );
  } catch {
    // Capture the final state even if InkShade never arrives.
  }
}

async function getStudyNavState(page) {
  return page.evaluate(() => {
    const style = (selector) => {
      const element = document.querySelector(selector);
      return element ? getComputedStyle(element) : null;
    };
    const articleRect = document.getElementById('article')?.getBoundingClientRect();
    const selectedToolbar = document.querySelector(
      '.verse.jwac-textHighlight > .studynav-para-tools, .verse.studynav-verse-selected > .studynav-para-tools',
    );
    const selectedAudioButton = selectedToolbar?.querySelector('.studynav-verse-audio');
    const selectedToolbarRect = selectedToolbar?.getBoundingClientRect();
    const selectedToolbarOverlapsVerse = !!selectedToolbarRect &&
      Array.from(document.querySelectorAll('.verse')).some((verse) => {
        const rect = verse.getBoundingClientRect();
        return selectedToolbarRect.left < rect.right && selectedToolbarRect.right > rect.left &&
          selectedToolbarRect.top < rect.bottom && selectedToolbarRect.bottom > rect.top;
      });
    const selectedButtonRect = selectedAudioButton?.getBoundingClientRect();
    const selectedButtonHit = selectedButtonRect
      ? document.elementFromPoint(
          selectedButtonRect.left + selectedButtonRect.width / 2,
          selectedButtonRect.top + selectedButtonRect.height / 2,
        )
      : null;
    return {
      dataset: document.documentElement.dataset.studynav || null,
      palettePresent: !!document.getElementById('studynav-palette'),
      toolRoots: document.querySelectorAll('[data-sn-tools="1"]').length,
      paraTools: document.querySelectorAll('.studynav-para-tools').length,
      paragraphButtons: Array.from(document.querySelectorAll('.studynav-para-tools button'))
        .map((button) => button.textContent?.trim() || ''),
      altBlocks: document.querySelectorAll('.studynav-alt').length,
      langBadge: document.getElementById('studynav-langcount')?.textContent?.trim() || null,
      langBadgeTitle: document.getElementById('studynav-langcount')?.getAttribute('title') || null,
      langBadgeParent: document.getElementById('studynav-langcount')?.parentElement?.id || null,
      langBadgePlacement: document.getElementById('studynav-langcount')?.dataset.placement || null,
      langBadgePosition: style('#studynav-langcount')?.position || null,
      languageSelectOptions: document.querySelector('#otherAvailLangsChooser')?.options?.length || 0,
      stylePresent: !!document.getElementById('studynav-dynamic-style'),
      mediaBar: !!document.getElementById('studynav-media-bar'),
      mediaHostCount: document.querySelectorAll('[data-studynav-media-host]').length,
      mediaButtons: Array.from(document.querySelectorAll('#studynav-media-bar button')).map((button) => button.textContent?.trim()),
      mediaBarParent: document.getElementById('studynav-media-bar')?.parentElement?.id || null,
      mediaBarPlacement: document.getElementById('studynav-media-bar')?.dataset.placement || null,
      mediaBarPosition: style('#studynav-media-bar')?.position || null,
      mediaBarVisibility: style('#studynav-media-bar')?.visibility || null,
      mediaMenuOpen: document.querySelector('#studynav-media-bar details')?.hasAttribute('open') || false,
      mediaSummaryText: document.querySelector('#studynav-media-bar summary')?.textContent?.replace(/\s+/g, ' ').trim() || null,
      mediaSummaryRect: (() => {
        const rect = document.querySelector('#studynav-media-bar summary')?.getBoundingClientRect();
        return rect ? { width: rect.width, height: rect.height } : null;
      })(),
      qrOpen: !!document.getElementById('studynav-qr-overlay'),
      studyPanelOpen: !!document.getElementById('studynav-study-panel'),
      selectionTools: !!document.getElementById('studynav-selection-tools'),
      highlightRangeCount: ['yellow', 'green', 'blue', 'pink', 'purple', 'orange'].reduce((total, color) =>
        total + (CSS.highlights?.get(`studynav-${color}`)?.size || 0), 0),
      imageButtons: document.querySelectorAll('.studynav-imgdl').length,
      verseAudioButtons: document.querySelectorAll('.studynav-verse-audio').length,
      selectedVerse: document.querySelector('.verse.jwac-textHighlight, .verse.studynav-verse-selected')?.id || null,
      selectedVerses: Array.from(document.querySelectorAll('.verse.jwac-textHighlight, .verse.studynav-verse-selected'))
        .map((verse) => verse.id),
      selectedToolbarDisplay: style(
        '.verse.jwac-textHighlight > .studynav-para-tools, .verse.studynav-verse-selected > .studynav-para-tools',
      )?.display || null,
      selectedToolbarFloating: selectedToolbar?.getAttribute('data-sn-verse-floating') === '1',
      selectedToolbarInViewport: !!selectedToolbarRect &&
        selectedToolbarRect.left >= 0 && selectedToolbarRect.right <= innerWidth &&
        selectedToolbarRect.top >= 0 && selectedToolbarRect.bottom <= innerHeight,
      selectedToolbarOverlapsVerse,
      selectedAudioButtonClickable: !!selectedAudioButton &&
        (selectedButtonHit === selectedAudioButton || selectedAudioButton.contains(selectedButtonHit)),
      articleMarked: document.getElementById('article')?.getAttribute('data-studynav-article') || null,
      dialogMarked: document.getElementById('nonarticle-dialog')?.hasAttribute('data-studynav-article') ?? false,
      articleMaxWidth: style('#article')?.maxWidth || null,
      dialogMaxWidth: style('#nonarticle-dialog')?.maxWidth || null,
      articleTableBorder: style('#article-table td')?.borderTopStyle || null,
      dialogTableBorder: style('#dialog-table td')?.borderTopStyle || null,
      headerPosition: style('#regionHeader')?.position || null,
      footerPosition: style('#footer')?.position || null,
      articlePosition: style('#article')?.position || null,
      articleRect: articleRect ? {
        left: articleRect.left,
        right: articleRect.right,
        width: articleRect.width,
      } : null,
      documentClientWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      dynamicCss: document.getElementById('studynav-dynamic-style')?.textContent || '',
      mediaControlOpacity: style('#jw-controls')?.opacity || null,
      mediaControlBackground: style('#jw-controls')?.backgroundColor || null,
      mediaControlBackgroundImage: style('#jw-controls')?.backgroundImage || null,
      transcriptPresent: !!document.getElementById('studynav-transcript'),
      mediaClipPanelPresent: !!document.getElementById('studynav-clip-panel'),
      resumePresent: !!document.getElementById('studynav-resume-media'),
    };
  });
}

async function getPopupState(page) {
  return page.evaluate(() => ({
    title: document.title,
    heading: document.querySelector('header strong')?.textContent?.trim(),
    headingVisible: (document.querySelector('header strong')?.getBoundingClientRect().height || 0) > 0,
    bodyOverflows: document.body.scrollWidth > document.body.clientWidth,
    rowCount: document.querySelectorAll('.row').length,
    groupCount: document.querySelectorAll('.group').length,
    actionButtons: Array.from(document.querySelectorAll('.action-grid button')).map((button) => ({
      id: button.id,
      text: button.textContent?.trim(),
      disabled: button.disabled,
    })),
    masterChecked: document.getElementById('master')?.checked ?? null,
    settingsOpen: document.getElementById('settings')?.hasAttribute('open') ?? null,
    statusTitle: document.getElementById('status-title')?.textContent?.trim(),
    statusHint: document.getElementById('status-hint')?.textContent?.trim(),
    enabledCount: document.getElementById('enabled-count')?.textContent?.trim(),
    imageDownloadChecked: document.querySelector('[data-id="imgGet"]')?.checked ?? null,
    masterAccent: (() => {
      const track = document.querySelector('#master + span');
      return track ? getComputedStyle(track).backgroundColor : null;
    })(),
    statusAccent: (() => {
      const dot = document.querySelector('.page-status[data-state="ready"] .status-dot');
      return dot ? getComputedStyle(dot).backgroundColor : null;
    })(),
    guideText: document.querySelector('.guide')?.textContent?.replace(/\s+/g, ' ').trim(),
    visibleRows: Array.from(document.querySelectorAll('.row')).filter((row) => !row.classList.contains('hidden')).length,
  }));
}

async function activateTabByUrl(worker, url) {
  await worker.evaluate(async (targetUrl) => {
    const tabs = await chrome.tabs.query({});
    const target = tabs.find((tab) => tab.url === targetUrl);
    if (!target?.id) throw new Error(`No browser tab found for ${targetUrl}`);
    await chrome.tabs.update(target.id, { active: true });
  }, url);
}

async function waitForWorkerState(worker, read, predicate, message, timeoutMs = 5000, arg = undefined) {
  let last;
  await waitFor(async () => {
    last = await worker.evaluate(read, arg);
    return predicate(last);
  }, timeoutMs, `${message}; last=${json(last)}`);
  return last;
}

async function installCopyCapture(page) {
  await page.evaluate(() => {
    window.__studynavCopyCapture = [];
    document.addEventListener('copy', () => {
      const active = document.activeElement;
      const controlSelection = active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement
        ? active.value.slice(active.selectionStart || 0, active.selectionEnd || 0)
        : '';
      window.__studynavCopyCapture.push(controlSelection || document.getSelection()?.toString() || '');
    }, true);
  });
}

async function waitForCopiedText(page, predicate, message, timeoutMs = 3000) {
  let last = '';
  let captured = [];
  let match = '';
  let toast = '';
  await waitFor(async () => {
    captured = await page.evaluate(() => window.__studynavCopyCapture || []);
    const clipboardText = await page.evaluate(async () => {
      try {
        return await navigator.clipboard.readText();
      } catch {
        return '';
      }
    });
    if (clipboardText && !captured.includes(clipboardText)) captured.push(clipboardText);
    toast = await page.evaluate(() => document.getElementById('studynav-toast')?.textContent || '');
    last = captured.at(-1) || '';
    match = [...captured].reverse().find((value) => predicate(value)) || '';
    return !!match;
  }, timeoutMs, `${message}; toast=${toast}; last=${last}; captured=${json(captured)}`);
  return match;
}

async function setClearShieldSettings(worker, settings) {
  return worker.evaluate(async (next) => {
    await chrome.storage.local.set(next);
    return chrome.storage.local.get(null);
  }, settings);
}

async function sendInkShadeMessage(page, type, data = undefined) {
  return page.evaluate(({messageType, messageData}) =>
    new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({type: messageType, data: messageData}, (response) => {
        const error = chrome.runtime.lastError;
        if (error) {
          if (/message port closed before a response/i.test(error.message)) {
            resolve(null);
          } else {
            reject(new Error(error.message));
          }
        } else {
          resolve(response?.data ?? response ?? null);
        }
      });
    }),
  {messageType: type, messageData: data});
}

async function getInkShadeData(page) {
  return sendInkShadeMessage(page, 'ui-bg-get-data');
}

async function changeInkShadeSettings(page, settings) {
  await sendInkShadeMessage(page, 'ui-bg-change-settings', settings);
}

async function setInkShadeTheme(page, theme) {
  await sendInkShadeMessage(page, 'ui-bg-set-theme', theme);
}

async function waitForInkShadeData(page, predicate, message) {
  let state = null;
  await waitFor(async () => {
    state = await getInkShadeData(page);
    return predicate(state);
  }, 5000, message);
  return state;
}

async function setStudyNavFlags(worker, flags) {
  return worker.evaluate(async (nextFlags) => {
    await chrome.storage.sync.set({ flags: nextFlags });
    return chrome.storage.sync.get(null);
  }, flags);
}

async function seedStudyNavMobileLegacyFlags(worker, flags) {
  return worker.evaluate(async (legacyFlags) => {
    await chrome.storage.local.remove('flags');
    await chrome.storage.sync.set({ flags: legacyFlags });
  }, flags);
}

async function setStudyNavMobileFlags(worker, flags) {
  return worker.evaluate(async (nextFlags) => {
    await chrome.storage.local.set({ flags: nextFlags });
    return chrome.storage.local.get(null);
  }, flags);
}

async function readStudyNavLocalData(worker) {
  return worker.evaluate(async () => {
    const key = 'studynavStudyDataV2';
    return (await chrome.storage.local.get(key))[key] || null;
  });
}

async function sendStudyNavPageAction(worker, targetUrl, type) {
  return worker.evaluate(async ({ url, messageType }) => {
    const target = (await chrome.tabs.query({})).find((tab) => tab.url === url);
    if (!target?.id) return { ok: false, message: 'Fixture tab unavailable' };
    return chrome.tabs.sendMessage(target.id, { type: messageType });
  }, { url: targetUrl, messageType: type });
}

async function openStudyNavMediaMenu(page) {
  await page.waitForFunction(async () => {
    const details = document.querySelector('#studynav-media-bar details');
    if (!(details instanceof HTMLDetailsElement)) return false;
    if (!details.open) details.querySelector('summary')?.click();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const stable = details.isConnected &&
      details === document.querySelector('#studynav-media-bar details') &&
      details.open;
    if (stable) details.querySelector('summary')?.focus();
    return stable;
  });
}

async function selectFixtureText(page, selector, needle) {
  const selected = await page.evaluate(({ rootSelector, exact }) => {
    const root = document.querySelector(rootSelector);
    if (!root) return false;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || parent.closest('[data-studynav-owned], .studynav-para-tools')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let node;
    while ((node = walker.nextNode())) {
      const start = (node.nodeValue || '').indexOf(exact);
      if (start < 0) continue;
      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, start + exact.length);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
      return selection?.toString() === exact;
    }
    return false;
  }, { rootSelector: selector, exact: needle });
  ensure(selected, `Could not select ${JSON.stringify(needle)} inside ${selector}`);
  await page.waitForFunction(() => !!document.getElementById('studynav-selection-tools'));
}

function studyNavFlagSurfaceEnabled(flag, state) {
  switch (flag) {
    case 'advSearch': return state.palettePresent === true;
    case 'actionBar': return state.headerPosition === 'sticky';
    case 'altText': return state.altBlocks > 0;
    case 'copyText': return state.paragraphButtons.includes('Copy');
    case 'cstblView': return state.articleTableBorder === 'solid';
    case 'expandWidth': return state.articleMaxWidth !== '760px';
    case 'langCount': return state.langBadge === '6';
    case 'parLink': return state.paragraphButtons.includes('Link');
    case 'verseAudio': return state.verseAudioButtons === 3;
    case 'mediaPlayerUI': return state.dynamicCss.includes('.video-js .vjs-control-bar') &&
      state.dynamicCss.includes('background-image: none');
    case 'customSub': return state.dynamicCss.includes('::cue');
    case 'imgGet': return state.imageButtons === 1;
    case 'mediaTS': return state.mediaButtons.includes('Copy video link and time');
    case 'mediaClip': return state.mediaButtons.includes('Download a media segment');
    case 'sndDisp': return state.mediaButtons.includes('Open in a separate window');
    case 'transcCreate': return state.mediaButtons.includes('Transcript');
    case 'annotations': return state.paragraphButtons.includes('Mark') && state.highlightRangeCount > 0;
    case 'continueWatching': return state.resumePresent === true;
    case 'qrShare': return state.qrOpen === true;
    default: return null;
  }
}

function studyNavFlagSurfaceDisabled(flag, state) {
  switch (flag) {
    case 'annotations':
      return !state.paragraphButtons.includes('Mark') && state.highlightRangeCount === 0 &&
        !state.selectionTools;
    case 'transcCreate':
      return !state.mediaButtons.includes('Transcript') && !state.transcriptPresent;
    case 'qrShare':
      return state.qrOpen === false;
    default: {
      const enabled = studyNavFlagSurfaceEnabled(flag, state);
      return enabled == null ? null : !enabled;
    }
  }
}

async function waitForStudyNavFlagSurface(page, flag, enabled) {
  if (enabled && flag === 'qrShare') {
    await page.waitForTimeout(240);
    return;
  }
  const firstState = await getStudyNavState(page);
  const firstValue = enabled
    ? studyNavFlagSurfaceEnabled(flag, firstState)
    : studyNavFlagSurfaceDisabled(flag, firstState);
  if (firstValue == null) {
    await page.waitForTimeout(240);
    return;
  }
  await waitFor(async () => {
    const state = await getStudyNavState(page);
    const value = enabled
      ? studyNavFlagSurfaceEnabled(flag, state)
      : studyNavFlagSurfaceDisabled(flag, state);
    return value === true;
  }, 5000, `StudyNav ${flag} did not reach its ${enabled ? 'enabled' : 'disabled'} surface`);
}

async function runBaselineScenario(executablePath, port) {
  const scenario = createScenario('baseline', []);
  await withContext({ executablePath, extensions: [] }, async (context, launchMeta) => {
    scenario.launchMode = launchMeta.launchMode;
    const ordinary = await openPage(
      context,
      scenario,
      'ordinary',
      httpUrl(HOSTS.ordinary, port, '/ordinary'),
    );
    await ordinary.click('#core-action');
    await ordinary.waitForTimeout(600);

    const state = await getOrdinaryState(ordinary);
    scenario.assertions.push(
      makeAssertion('ordinary fixture loaded', state.title === 'Ordinary Fixture', state),
      makeAssertion('baseline ad script loaded', state.fixture.adScriptLoaded === true, state.fixture),
      makeAssertion('baseline ad image loaded', state.fixture.adImageLoaded === true, state.fixture),
      makeAssertion('baseline ad frame loaded', state.fixture.adFrameLoaded === true, state.fixture),
      makeAssertion('baseline core action still works', state.clicked === '1', state),
      makeAssertion('baseline cosmetic-safety content remains visible', state.cosmeticSafetyVisible === true, state.cosmeticSafetyDisplays),
      makeAssertion('baseline ad banner remains visible', state.adBannerDisplay !== 'none', state),
      makeAssertion('baseline has no request failures', scenario.requestFailures.length === 0, scenario.requestFailures),
    );
  });
  return scenario;
}

async function runClearShieldScenario(executablePath, port) {
  const scenario = createScenario('clearshield-only', ['ClearShield']);
  await withContext({ executablePath, extensions: ['ClearShield'] }, async (context, launchMeta) => {
    scenario.launchMode = launchMeta.launchMode;
    const workers = await waitForNamedWorkers(context, ['ClearShield']);
    scenario.serviceWorkers = workers;
    const worker = await getWorkerByName(context, 'ClearShield');

    await setClearShieldSettings(worker, DEFAULT_CLEARSHIELD);

    const ordinary = await openPage(
      context,
      scenario,
      'ordinary',
      httpUrl(HOSTS.ordinary, port, '/ordinary'),
    );
    await ordinary.click('#core-action');
    await ordinary.waitForTimeout(1200);

    const blockedState = await getOrdinaryState(ordinary);
    const blockedFailures = scenario.requestFailures.filter((entry) => entry.label === 'ordinary');

    scenario.assertions.push(
      makeAssertion('ClearShield service worker discovered', workers.some((item) => workerMatchesExtension(item, 'ClearShield')), workers),
      makeAssertion('ClearShield blocks ad script', blockedState.fixture.adScriptLoaded === false, blockedState.fixture),
      makeAssertion('ClearShield blocks ad image', blockedState.fixture.adImageLoaded === false, blockedState.fixture),
      makeAssertion('ClearShield blocks ad frame', blockedState.fixture.adFrameLoaded === false, blockedState.fixture),
      makeAssertion('ClearShield cosmetic banner hidden', blockedState.adBannerDisplay === 'none', blockedState),
      makeAssertion(
        'ClearShield cosmetics do not hide ChatGPT-like or incidental ad-marker content',
        blockedState.cosmeticSafetyVisible === true,
        blockedState.cosmeticSafetyDisplays,
      ),
      makeAssertion('ClearShield core content remains usable', blockedState.clicked === '1' && blockedState.contentVisible, blockedState),
      makeAssertion(
        'ClearShield request failures show blocking',
        blockedFailures.some((entry) => entry.errorText.includes('ERR_BLOCKED_BY_CLIENT')),
        blockedFailures,
      ),
    );

    const extensionId = workerInfoFor(workers, 'ClearShield').id;
    const popup = await openPage(
      context,
      scenario,
      'clearshield-popup',
      extensionPageUrl(extensionId, 'popup.html'),
    );
    await activateTabByUrl(worker, ordinary.url());
    await popup.reload({ waitUntil: 'load' });
    await popup.waitForFunction((expectedHost) =>
      document.getElementById('host')?.textContent?.trim() === expectedHost,
    HOSTS.ordinary);
    const popupInitial = await popup.evaluate(() => ({
      title: document.title,
      heading: document.querySelector('header strong')?.textContent?.trim(),
      headingVisible: (document.querySelector('header strong')?.getBoundingClientRect().height || 0) > 0,
      bodyOverflows: document.body.scrollWidth > document.body.clientWidth,
      host: document.getElementById('host')?.textContent?.trim(),
      status: document.getElementById('statusLine')?.textContent?.trim(),
      enabled: document.getElementById('enabled')?.checked,
      lists: ['easylist', 'easyprivacy', 'baseline'].map((id) =>
        document.getElementById(`list-${id}`)?.checked),
      cosmetic: document.getElementById('cosmetic')?.checked,
      siteToggle: document.getElementById('siteToggle')?.textContent?.trim(),
      tabBlocked: Number(document.getElementById('tabBlocked')?.textContent || 0),
      totalBlocked: Number(document.getElementById('totalBlocked')?.textContent || 0),
    }));
    const initialBadgeState = await worker.evaluate(async (targetUrl) => {
      const target = (await chrome.tabs.query({})).find((tab) => tab.url === targetUrl);
      return target?.id == null ? null : {
        tabId: target.id,
        text: await chrome.action.getBadgeText({ tabId: target.id }),
      };
    }, ordinary.url());

    await popup.evaluate(() => document.getElementById('list-easyprivacy').click());
    const listOffState = await waitForWorkerState(
      worker,
      async () => ({
        settings: await chrome.storage.local.get(null),
        enabledRulesets: await chrome.declarativeNetRequest.getEnabledRulesets(),
      }),
      (state) => state.settings.lists?.easyprivacy === false && !state.enabledRulesets.includes('easyprivacy'),
      'ClearShield popup did not disable EasyPrivacy',
    );
    // The popup persists a checkbox change and then refreshes itself. Reload
    // between opposite toggles so the next click cannot race that async
    // refresh and accidentally reuse an intermediate checkbox value.
    await popup.reload({ waitUntil: 'load' });
    await popup.waitForFunction(() => document.getElementById('list-easyprivacy')?.checked === false);
    await popup.evaluate(() => document.getElementById('list-easyprivacy').click());
    await waitForWorkerState(
      worker,
      async () => ({
        settings: await chrome.storage.local.get(null),
        enabledRulesets: await chrome.declarativeNetRequest.getEnabledRulesets(),
      }),
      (state) => state.settings.lists?.easyprivacy === true && state.enabledRulesets.includes('easyprivacy'),
      'ClearShield popup did not restore EasyPrivacy',
    );
    await popup.reload({ waitUntil: 'load' });
    await popup.waitForFunction(() => document.getElementById('list-easyprivacy')?.checked === true);

    await popup.evaluate(() => document.getElementById('cosmetic').click());
    await waitForWorkerState(
      worker,
      async () => chrome.storage.local.get(null),
      (state) => state.cosmetic === false,
      'ClearShield popup did not disable cosmetic filtering',
    );
    await ordinary.waitForFunction(() => document.querySelectorAll('#clearshield-cosmetic').length === 0);
    const cosmeticOffState = await getOrdinaryState(ordinary);
    await popup.reload({ waitUntil: 'load' });
    await popup.waitForFunction(() => document.getElementById('cosmetic')?.checked === false);
    await popup.evaluate(() => document.getElementById('cosmetic').click());
    await waitForWorkerState(
      worker,
      async () => chrome.storage.local.get(null),
      (state) => state.cosmetic === true,
      'ClearShield popup did not restore cosmetic filtering',
    );
    await ordinary.waitForFunction(() => document.querySelectorAll('#clearshield-cosmetic').length === 1);

    await popup.evaluate(() => document.getElementById('enabled').click());
    await waitForWorkerState(
      worker,
      async () => ({
        settings: await chrome.storage.local.get(null),
        enabledRulesets: await chrome.declarativeNetRequest.getEnabledRulesets(),
      }),
      (state) => state.settings.enabled === false && state.enabledRulesets.length === 0,
      'ClearShield popup did not disable global protection',
    );
    scenario.requestFailures = [];
    await ordinary.reload({ waitUntil: 'load' });
    await ordinary.waitForTimeout(700);
    const globallyOffState = await getOrdinaryState(ordinary);
    await popup.evaluate(() => document.getElementById('enabled').click());
    await waitForWorkerState(
      worker,
      async () => ({
        settings: await chrome.storage.local.get(null),
        enabledRulesets: await chrome.declarativeNetRequest.getEnabledRulesets(),
      }),
      (state) => state.settings.enabled === true && ['easylist', 'easyprivacy', 'baseline'].every((id) => state.enabledRulesets.includes(id)),
      'ClearShield popup did not restore global protection',
    );

    await popup.evaluate(() => document.getElementById('siteToggle').click());
    const siteToggleState = await waitForWorkerState(
      worker,
      async (targetUrl) => {
        const target = (await chrome.tabs.query({})).find((tab) => tab.url === targetUrl);
        return {
          settings: await chrome.storage.local.get(null),
          dynamicRules: await chrome.declarativeNetRequest.getDynamicRules(),
          badgeText: target?.id == null ? null : await chrome.action.getBadgeText({ tabId: target.id }),
        };
      },
      (state) => state.settings.allowlist?.includes(HOSTS.ordinary) && state.dynamicRules.length === 2 && state.badgeText === 'ok',
      'ClearShield popup did not allowlist the active site',
      5000,
      ordinary.url(),
    );

    scenario.requestFailures = [];
    await ordinary.reload({ waitUntil: 'load' });
    await ordinary.waitForTimeout(1200);
    await ordinary.click('#core-action');
    const allowlistedState = await getOrdinaryState(ordinary);

    scenario.assertions.push(
      makeAssertion(
        'ClearShield popup identifies its purpose before its handle',
        popupInitial.title === 'Ad & Tracker Blocker (ClearShield)' &&
          popupInitial.heading === 'Ad & Tracker Blocker' &&
          popupInitial.headingVisible === true && popupInitial.bodyOverflows === false,
        popupInitial,
      ),
      makeAssertion(
        'ClearShield popup reflects the active page and enabled controls',
        popupInitial.host === HOSTS.ordinary &&
          popupInitial.status === 'Blocking active' &&
          popupInitial.enabled === true &&
          popupInitial.lists.every(Boolean) &&
          popupInitial.cosmetic === true &&
          /blocking/i.test(popupInitial.siteToggle || '') &&
          popupInitial.tabBlocked > 0 && popupInitial.totalBlocked >= popupInitial.tabBlocked &&
          /^\d+$/.test(initialBadgeState?.text || ''),
        { popupInitial, initialBadgeState },
      ),
      makeAssertion(
        'ClearShield popup list toggle updates the active DNR rulesets',
        listOffState.settings.lists.easyprivacy === false && !listOffState.enabledRulesets.includes('easyprivacy'),
        listOffState,
      ),
      makeAssertion(
        'ClearShield popup cosmetic toggle removes only cosmetic hiding',
        cosmeticOffState.adStyleCount === 0 && cosmeticOffState.fixture.adScriptLoaded === false &&
          cosmeticOffState.contentVisible && cosmeticOffState.cosmeticSafetyVisible,
        cosmeticOffState,
      ),
      makeAssertion(
        'ClearShield popup global off restores the unblocked baseline',
        globallyOffState.fixture.adScriptLoaded === true &&
          globallyOffState.fixture.adImageLoaded === true &&
          globallyOffState.fixture.adFrameLoaded === true &&
          globallyOffState.adBannerDisplay !== 'none',
        globallyOffState,
      ),
      makeAssertion(
        'ClearShield popup site toggle uses the persisted allowlist path',
        siteToggleState.settings.allowlist.length === 1 && siteToggleState.dynamicRules.length === 2 && siteToggleState.badgeText === 'ok',
        siteToggleState,
      ),
      makeAssertion('ClearShield allowlist restores ad script', allowlistedState.fixture.adScriptLoaded === true, allowlistedState.fixture),
      makeAssertion('ClearShield allowlist restores ad image', allowlistedState.fixture.adImageLoaded === true, allowlistedState.fixture),
      makeAssertion('ClearShield allowlist restores ad frame', allowlistedState.fixture.adFrameLoaded === true, allowlistedState.fixture),
      makeAssertion('ClearShield allowlist removes cosmetic hiding', allowlistedState.adBannerDisplay !== 'none', allowlistedState),
      makeAssertion(
        'ClearShield allowlist keeps content usable',
        allowlistedState.contentVisible === true && allowlistedState.cosmeticSafetyVisible === true,
        allowlistedState,
      ),
      makeAssertion('ClearShield allowlist removes block failures', scenario.requestFailures.length === 0, scenario.requestFailures),
    );

    const options = await openPage(
      context,
      scenario,
      'clearshield-options',
      extensionPageUrl(extensionId, 'options.html'),
    );
    await options.waitForFunction(() => /Bundled static rules:\s*[\d,]+/.test(document.getElementById('ruleSummary')?.textContent || ''));
    const optionsCounts = await options.evaluate(() => ({
      baseline: document.getElementById('count-baseline')?.textContent?.trim(),
      easylist: document.getElementById('count-easylist')?.textContent?.trim(),
      easyprivacy: document.getElementById('count-easyprivacy')?.textContent?.trim(),
      cosmetic: document.getElementById('count-cosmetic')?.textContent?.trim(),
      summary: document.getElementById('ruleSummary')?.textContent?.trim(),
    }));
    await options.fill('#allowlist', `https://${HOSTS.ordinary}/path\n${HOSTS.ordinary}\nbrave://settings`);
    await options.click('#saveAllow');
    await options.waitForFunction(() => /Saved 1 allowlist host/.test(document.getElementById('status')?.textContent || ''));

    const downloadPromise = options.waitForEvent('download');
    await options.click('#exportBtn');
    const download = await downloadPromise;
    const exportPath = await download.path();
    const exportedSettings = JSON.parse(await readFile(exportPath, 'utf8'));

    const importedSettings = {
      ...DEFAULT_CLEARSHIELD,
      blockedTotal: 23,
      allowlist: [HOSTS.ordinary],
    };
    await options.setInputFiles('#importFile', {
      name: 'clearshield-settings.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(importedSettings)),
    });
    await options.waitForFunction(() => /Imported settings/.test(document.getElementById('status')?.textContent || ''));
    const importedState = await waitForWorkerState(
      worker,
      async () => ({
        settings: await chrome.storage.local.get(null),
        enabledRulesets: await chrome.declarativeNetRequest.getEnabledRulesets(),
      }),
      (state) => state.settings.blockedTotal === 23 && state.settings.allowlist?.length === 1,
      'ClearShield options import did not persist normalized settings',
    );

    scenario.assertions.push(
      makeAssertion(
        'ClearShield options shows nonzero bundled rule and cosmetic counts',
        [optionsCounts.baseline, optionsCounts.easylist, optionsCounts.easyprivacy, optionsCounts.cosmetic]
          .every((value) => /^\d[\d,]* (rules|selectors)$/.test(value || '') && !/^0 /.test(value || '')),
        optionsCounts,
      ),
      makeAssertion(
        'ClearShield options normalizes allowlist and exports current settings',
        exportedSettings.allowlist?.length === 1 && exportedSettings.allowlist[0] === HOSTS.ordinary,
        exportedSettings,
      ),
      makeAssertion(
        'ClearShield options imports a complete settings backup',
        importedState.settings.blockedTotal === 23 &&
          importedState.settings.allowlist[0] === HOSTS.ordinary &&
          ['easylist', 'easyprivacy', 'baseline'].every((id) => importedState.enabledRulesets.includes(id)),
        importedState,
      ),
    );

    const restartToken = `clearshield-before-restart-${Date.now()}`;
    await worker.evaluate((token) => {
      globalThis.__clearShieldRestartToken = token;
      return true;
    }, restartToken);
    const browser = context.browser();
    ensure(browser, 'ClearShield restart proof requires a browser-level CDP session');
    const browserCdp = await browser.newBrowserCDPSession();
    const workerTargetUrl = `chrome-extension://${extensionId}/background.js`;
    const targets = await browserCdp.send('Target.getTargets');
    const workerTarget = targets.targetInfos.find((target) =>
      target.type === 'service_worker' && target.url === workerTargetUrl);
    ensure(workerTarget, `Could not find ClearShield service-worker target: ${workerTargetUrl}`);
    const closeResult = await browserCdp.send('Target.closeTarget', { targetId: workerTarget.targetId });
    ensure(closeResult.success === true, 'DevTools refused to stop the ClearShield service worker');
    await waitFor(async () => {
      const nextTargets = await browserCdp.send('Target.getTargets');
      return !nextTargets.targetInfos.some((target) => target.targetId === workerTarget.targetId);
    }, 10000, 'ClearShield worker target remained alive after explicit stop');

    const restartPopup = await openPage(
      context,
      scenario,
      'clearshield-restart-popup',
      extensionPageUrl(extensionId, 'popup.html'),
    );
    await restartPopup.waitForTimeout(500);
    const restartedWorker = await getWorkerByName(context, 'ClearShield');
    const restartProbe = await restartedWorker.evaluate(() => ({
      name: chrome.runtime.getManifest().name,
      volatileToken: globalThis.__clearShieldRestartToken ?? null,
    }));
    await browserCdp.detach();
    const restartState = await restartedWorker.evaluate(async () => ({
      settings: await chrome.storage.local.get(null),
      dynamicRules: await chrome.declarativeNetRequest.getDynamicRules(),
      enabledRulesets: await chrome.declarativeNetRequest.getEnabledRulesets(),
    }));
    scenario.assertions.push(
      makeAssertion(
        'ClearShield service worker cold-restarts after explicit stop',
        restartProbe.name === displayNameFor('ClearShield') && restartProbe.volatileToken !== restartToken,
        { restartToken, restartProbe },
      ),
      makeAssertion(
        'ClearShield settings survive service-worker restart',
        restartState.settings.enabled === true &&
          Array.isArray(restartState.settings.allowlist) &&
          restartState.settings.allowlist.length === 1 &&
          restartState.settings.allowlist[0] === HOSTS.ordinary,
        restartState,
      ),
      makeAssertion(
        'ClearShield allowlist rules survive service-worker restart',
        restartState.dynamicRules.length === 2 &&
          restartState.dynamicRules.every((rule) =>
            rule.condition?.initiatorDomains?.includes(HOSTS.ordinary)),
        restartState.dynamicRules,
      ),
      makeAssertion(
        'ClearShield static lists stay enabled after service-worker restart',
        ['easylist', 'easyprivacy', 'baseline'].every((id) =>
          restartState.enabledRulesets.includes(id)),
        restartState.enabledRulesets,
      ),
    );
  });
  return scenario;
}

async function runClearShieldLiveSmokeScenario(executablePath) {
  const scenario = createScenario('clearshield-live-smoke', ['ClearShield']);
  const url = 'https://animevost.org/';
  let baselineState;
  let enabledState;
  let baselineNav;
  let enabledNav;

  try {
    await withContext(
      {
        executablePath,
        extensions: [],
        useFixtureHostResolverRules: false,
        userAgent: LIVE_CHROME_USER_AGENT,
        extraHTTPHeaders: LIVE_CHROME_HEADERS,
      },
      async (context, launchMeta) => {
        scenario.launchMode = launchMeta.launchMode;
        const page = await openPage(context, scenario, 'baseline-live', url, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(5000);
        baselineNav = getPageNavigation(page);
        baselineState = await getPublicPageState(page);
      },
    );

    const baselineBlocker = getLiveTransportBlocker(baselineNav);
    if (baselineBlocker) {
      scenario.skipped = true;
      scenario.notes.push(`SKIP: ClearShield live baseline unavailable (${baselineBlocker})`);
      return scenario;
    }

    await withContext(
      {
        executablePath,
        extensions: ['ClearShield'],
        useFixtureHostResolverRules: false,
        userAgent: LIVE_CHROME_USER_AGENT,
        extraHTTPHeaders: LIVE_CHROME_HEADERS,
      },
      async (context, launchMeta) => {
        scenario.launchMode = launchMeta.launchMode;
        const workers = await waitForNamedWorkers(context, ['ClearShield']);
        scenario.serviceWorkers = workers;
        const worker = await getWorkerByName(context, 'ClearShield');
        await setClearShieldSettings(worker, DEFAULT_CLEARSHIELD);

        const page = await openPage(context, scenario, 'clearshield-live', url, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(5000);
        enabledNav = getPageNavigation(page);
        enabledState = await getPublicPageState(page);
      },
    );

    const enabledBlocker = getLiveTransportBlocker(enabledNav);
    if (enabledBlocker) {
      scenario.skipped = true;
      scenario.notes.push(`SKIP: ClearShield live enabled page unavailable (${enabledBlocker})`);
      return scenario;
    }

    const baselineBlocked = scenario.requestFailures.filter(
      (entry) => entry.label === 'baseline-live' && entry.errorText.includes('ERR_BLOCKED_BY_CLIENT'),
    );
    const enabledBlocked = scenario.requestFailures.filter(
      (entry) => entry.label === 'clearshield-live' && entry.errorText.includes('ERR_BLOCKED_BY_CLIENT'),
    );
    const bodyRatio = enabledState.bodyLength / Math.max(1, baselineState.bodyLength);
    const linkRatio = enabledState.linkCount / Math.max(1, baselineState.linkCount);
    const imageRatio = enabledState.visibleImageCount / Math.max(1, baselineState.visibleImageCount);

    scenario.assertions.push(
      makeAssertion('Live ClearShield worker discovered', scenario.serviceWorkers.some((item) => workerMatchesExtension(item, 'ClearShield')), scenario.serviceWorkers),
      makeAssertion('Live ClearShield blocks additional tracker/ad requests', enabledBlocked.length > baselineBlocked.length, { baselineBlocked, enabledBlocked }),
      makeAssertion('Live ClearShield preserves page identity', enabledState.title === baselineState.title && enabledState.heading === baselineState.heading, { baselineState, enabledState }),
      makeAssertion('Live ClearShield preserves core text and links', bodyRatio >= 0.7 && linkRatio >= 0.7, { bodyRatio, linkRatio, baselineState, enabledState }),
      makeAssertion('Live ClearShield preserves representative content images', imageRatio >= 0.7, { imageRatio, baselineState, enabledState }),
    );
  } catch (error) {
    if (isLiveTransportException(error)) {
      scenario.skipped = true;
      scenario.notes.push(`SKIP: ClearShield live smoke unavailable (${String(error?.message || error)})`);
    } else {
      scenario.assertions.push(makeAssertion(
        'Live ClearShield harness and extension complete without internal failure',
        false,
        String(error?.stack || error),
      ));
    }
  }

  return scenario;
}

async function runInkShadeForkScenario(executablePath, port) {
  const scenario = createScenario('inkshade-only', ['InkShade']);
  await withContext({executablePath, extensions: ['InkShade']}, async (context, launchMeta) => {
    scenario.launchMode = launchMeta.launchMode;
    const workers = await waitForNamedWorkers(context, ['InkShade']);
    scenario.serviceWorkers = workers;
    const worker = await getWorkerByName(context, 'InkShade');
    const extensionId = workerInfoFor(workers, 'InkShade').id;

    const popup = await openPage(
      context,
      scenario,
      'inkshade-popup',
      extensionPageUrl(extensionId, 'ui/popup/index.html'),
    );
    await popup.waitForFunction(() => document.body?.innerText.includes('InkShade'));

    const clickGlobalMode = async (label) => {
      await popup.evaluate((text) => {
        const option = Array.from(document.querySelectorAll('.app-switch .multi-switch__option'))
          .find((element) => element.textContent?.trim() === text);
        if (!option) throw new Error(`Missing InkShade global mode: ${text}`);
        option.click();
      }, label);
    };

    await clickGlobalMode('Off');
    const globallyOff = await waitForInkShadeData(
      popup,
      (data) => data?.settings?.enabled === false && data?.settings?.automation?.enabled === false,
      'InkShade global Off control did not persist',
    );

    const page = await openPage(
      context,
      scenario,
      'light',
      httpUrl(HOSTS.ordinary, port, '/light'),
    );
    await page.waitForFunction(() => window.fixtureDynamicReady === true);
    await settleInkShade(page, 2500, null);
    const baselineState = await getInkShadeState(page);

    await activateTabByUrl(worker, page.url());
    await popup.reload({waitUntil: 'load'});
    await popup.waitForFunction((host) => document.body?.innerText.includes(host), HOSTS.ordinary);
    await clickGlobalMode('On');
    const globallyOn = await waitForInkShadeData(
      popup,
      (data) => data?.settings?.enabled === true && data?.settings?.automation?.enabled === false,
      'InkShade global On control did not persist',
    );
    await settleInkShade(page, 10_000);
    await page.waitForTimeout(1200);
    const activeState = await getInkShadeState(page);

    const popupState = await popup.evaluate(() => ({
      title: document.title,
      text: document.body.innerText,
      bodyOverflows: document.body.scrollWidth > document.body.clientWidth,
      links: Array.from(document.querySelectorAll('a[href]')).map((link) => link.href),
      globalOptions: Array.from(document.querySelectorAll('.app-switch .multi-switch__option'))
        .map((option) => option.textContent?.trim()),
      siteTogglePresent: Boolean(document.querySelector('.site-toggle')),
    }));

    await setInkShadeTheme(popup, {
      brightness: 88,
      contrast: 108,
      sepia: 12,
    });
    const toneState = await waitForInkShadeData(
      popup,
      (data) => data?.settings?.theme?.brightness === 88 &&
        data?.settings?.theme?.contrast === 108 &&
        data?.settings?.theme?.sepia === 12,
      'InkShade tone settings did not persist',
    );
    await settleInkShade(page, 5000);

    await popup.locator('.site-toggle').click();
    await settleInkShade(page, 5000, null);
    await page.waitForTimeout(600);
    const siteDisabledPage = await getInkShadeState(page);
    const siteDisabledData = await waitForInkShadeData(
      popup,
      (data) => data?.settings?.disabledFor?.some((entry) => entry.includes(HOSTS.ordinary)),
      'InkShade site toggle did not disable fixture.test',
    );
    const manualDisabledDescription = await popup.locator('.site-toggle-group__description').innerText();

    // The site toggle updates background state and then re-renders the popup.
    // Re-open its UI before the opposite click so a slow render cannot replay
    // the stale disabled state.
    await popup.reload({waitUntil: 'load'});
    await popup.waitForFunction((host) => document.body?.innerText.includes(host), HOSTS.ordinary);
    await waitForInkShadeData(
      popup,
      (data) => data?.settings?.disabledFor?.some((entry) => entry.includes(HOSTS.ordinary)),
      'InkShade popup did not settle after disabling fixture.test',
    );
    await popup.locator('.site-toggle').click();
    await settleInkShade(page, 5000);
    const siteEnabledData = await waitForInkShadeData(
      popup,
      (data) => !data?.settings?.disabledFor?.some((entry) => entry.includes(HOSTS.ordinary)),
      'InkShade site toggle did not restore fixture.test',
    );

    await setInkShadeTheme(popup, {brightness: 94});
    await setInkShadeTheme(popup, {brightness: 84});
    const repeatedState = await waitForInkShadeData(
      popup,
      (data) => data?.settings?.theme?.brightness === 84,
      'InkShade repeated theme updates did not settle on the latest value',
    );
    await settleInkShade(page, 5000);
    const updatedState = await getInkShadeState(page);

    // Start the detector matrix in a fresh document. Reusing the heavily
    // mutated light-fixture tab couples this check to an old frame record in
    // Chromium's MV3 worker, which can disappear during worker suspension.
    const detectorPage = await openPage(
      context,
      scenario,
      'native-dark',
      httpUrl(HOSTS.ordinary, port, '/dark'),
    );
    await activateTabByUrl(worker, detectorPage.url());
    let runtimeDetectedData = null;
    try {
      await waitFor(async () => {
        runtimeDetectedData = await getInkShadeData(popup);
        return runtimeDetectedData?.activeTab?.url === detectorPage.url() &&
          runtimeDetectedData?.activeTab?.isDarkThemeDetected === true;
      }, 15_000, 'InkShade background did not report the native dark fixture');
    } catch (error) {
      const activeTabs = await worker.evaluate(async () => (await chrome.tabs.query({active: true}))
        .map((tab) => ({id: tab.id, url: tab.url, windowId: tab.windowId})));
      const currentNativeState = await getInkShadeState(detectorPage);
      throw new Error(`${error.message}; data=${json(runtimeDetectedData)}; activeTabs=${json(activeTabs)}; page=${json(currentNativeState)}`);
    }
    const nativeDarkState = await getInkShadeState(detectorPage);
    await popup.reload({waitUntil: 'load'});
    await popup.waitForFunction((host) => document.body?.innerText.includes(host), HOSTS.ordinary);
    await popup.waitForFunction(() =>
      /Dark theme detected/i.test(document.querySelector('.site-toggle-group__description')?.textContent || ''));
    const runtimeDetectedDescription = await popup.locator('.site-toggle-group__description').innerText();

    const detectorPositiveCases = [
      'meta-dark',
      'meta-mixed-dark',
      'html-dark',
      'body-dark',
      'data-theme',
      'data-color-scheme',
      'visual-dark',
      'transparent-dark',
      'root-filter-invert',
    ];
    const detectorNegativeCases = [
      'meta-light',
      'misleading-html-dark',
      'meta-dark-light',
      'dark-hero-light-body',
      'transparent-light',
      'prefers-dark-light',
      'counter-invert-light',
      'viewport-dark-hero-light-document',
    ];
    const detectorPositiveResults = [];
    for (const caseName of detectorPositiveCases) {
      await detectorPage.goto(httpUrl(HOSTS.ordinary, port, `/detector/${caseName}`), {waitUntil: 'load'});
      await detectorPage.waitForTimeout(1000);
      await settleInkShade(detectorPage, 4000, null);
      const state = await getInkShadeDetectorState(detectorPage);
      detectorPositiveResults.push({caseName, state});
      scenario.assertions.push(makeAssertion(
        `InkShade native-dark detector accepts ${caseName}`,
        state.darkReaderMode == null && state.themeStyleCount === 0 && state.themeMarkerCount === 0,
        state,
      ));
    }
    const detectorNegativeResults = [];
    for (const caseName of detectorNegativeCases) {
      await detectorPage.goto(httpUrl(HOSTS.ordinary, port, `/detector/${caseName}`), {waitUntil: 'load'});
      await settleInkShade(detectorPage, 5000, 'dark');
      const state = await getInkShadeDetectorState(detectorPage);
      detectorNegativeResults.push({caseName, state});
      scenario.assertions.push(makeAssertion(
        `InkShade keeps light/mixed page active for ${caseName}`,
        state.darkReaderMode === 'dynamic' && state.themeStyleCount > 0 && state.themeMarkerCount === 1,
        state,
      ));
    }
    await detectorPage.goto(httpUrl(HOSTS.ordinary, port, '/detector/delayed'), {waitUntil: 'load'});
    await detectorPage.waitForTimeout(250);
    const delayedInitialState = await getInkShadeDetectorState(detectorPage);
    await detectorPage.waitForTimeout(1600);
    await settleInkShade(detectorPage, 4000, null);
    const delayedFinalState = await getInkShadeDetectorState(detectorPage);

    await detectorPage.emulateMedia({colorScheme: 'dark'});
    await detectorPage.goto(httpUrl(HOSTS.systemHint, port, '/detector/meta-light'), {waitUntil: 'load'});
    await settleInkShade(detectorPage, 5000, 'dark');
    const systemHintLightState = await getInkShadeDetectorState(detectorPage);

    await detectorPage.emulateMedia({colorScheme: 'light'});
    await detectorPage.goto(httpUrl(HOSTS.selectorHint, port, '/detector/visual-dark'), {waitUntil: 'load'});
    await settleInkShade(detectorPage, 4000, null);
    const staleSelectorHintDarkState = await getInkShadeDetectorState(detectorPage);

    await detectorPage.goto(httpUrl(HOSTS.darkList, port, '/dark'), {waitUntil: 'load'});
    await detectorPage.waitForTimeout(1000);
    const bundledDarkState = await getInkShadeState(detectorPage);
    await activateTabByUrl(worker, detectorPage.url());
    await popup.reload({waitUntil: 'load'});
    await popup.waitForFunction((host) => document.body?.innerText.includes(host), HOSTS.darkList);
    const bundledDarkDescription = await popup.locator('.site-toggle-group__description').innerText();
    scenario.assertions.push(
      makeAssertion(
        'InkShade covers the explicit native-dark detector fixture matrix',
        detectorPositiveCases.length >= 8 && detectorNegativeCases.length >= 6 &&
          detectorPositiveResults.every(({state}) => state.darkReaderMode == null && state.themeStyleCount === 0) &&
          detectorNegativeResults.every(({state}) => state.darkReaderMode === 'dynamic' && state.themeStyleCount > 0),
        {
          positiveCount: detectorPositiveCases.length,
          negativeCount: detectorNegativeCases.length,
          positives: detectorPositiveResults,
          negatives: detectorNegativeResults,
        },
      ),
      makeAssertion(
        'InkShade removes its theme after a delayed native-dark transition',
        delayedFinalState.delayedTheme === 'dark' &&
          delayedFinalState.darkReaderMode == null &&
          delayedFinalState.themeStyleCount === 0,
        {initial: delayedInitialState, final: delayedFinalState},
      ),
      makeAssertion(
        'InkShade does not treat SYSTEM THEME preference as rendered-dark proof',
        systemHintLightState.darkReaderMode === 'dynamic' &&
          systemHintLightState.themeStyleCount > 0 &&
          systemHintLightState.themeMarkerCount === 1,
        systemHintLightState,
      ),
      makeAssertion(
        'InkShade visual detection survives a stale curated selector hint',
        staleSelectorHintDarkState.darkReaderMode == null &&
          staleSelectorHintDarkState.themeStyleCount === 0 &&
          staleSelectorHintDarkState.themeMarkerCount === 0,
        staleSelectorHintDarkState,
      ),
      makeAssertion(
        'InkShade distinguishes manual exclusion, bundled dark-list, and runtime detection status',
        /Off.*Site list/i.test(manualDisabledDescription) &&
          /Dark theme detected/i.test(runtimeDetectedDescription) &&
          /global\s+Dark List/i.test(bundledDarkDescription) &&
          bundledDarkState.darkReaderMode == null &&
          bundledDarkState.themeStyleCount === 0,
        {
          manualDisabledDescription,
          runtimeDetectedDescription,
          runtimeDetectedData,
          bundledDarkDescription,
          bundledDarkState,
        },
      ),
    );
    const extensionOriginConsoleErrors = scenario.consoleErrors.filter((entry) =>
      String(entry.location?.url || '').startsWith('chrome-extension://'));

    scenario.assertions.push(
      makeAssertion('InkShade service worker discovered', workers.some((item) => workerMatchesExtension(item, 'InkShade')), workers),
      makeAssertion(
        'InkShade popup has distinct store-safe branding and no upstream marketing',
        popupState.title === 'InkShade settings' &&
          popupState.text.includes('InkShade') &&
          !/Donate|News|Upgrade|Dark Reader Plus/i.test(popupState.text) &&
          popupState.bodyOverflows === false &&
          popupState.globalOptions.join(',') === 'On,Auto,Off' &&
          popupState.siteTogglePresent &&
          popupState.links.every((url) => !/darkreader\.org|twitter\.com\/darkreaderapp/i.test(url)),
        popupState,
      ),
      makeAssertion(
        'InkShade defaults are local-first',
        globallyOff.settings.fetchNews === false &&
          globallyOn.settings.fetchNews === false &&
          globallyOn.settings.syncSettings === false &&
          globallyOn.settings.syncSitesFixes === false,
        {globallyOff, globallyOn},
      ),
      makeAssertion(
        'InkShade full MV3 dynamic engine applies one owned theme instance',
        activeState.dataset === 'dark' &&
          activeState.darkReaderMode === 'dynamic' &&
          activeState.themeMarkerCount === 1 &&
          activeState.themeStyleCount > 3,
        activeState,
      ),
      makeAssertion(
        'InkShade themes inherited about:blank frames',
        activeState.frame?.dataset === 'dark' &&
          activeState.frame?.darkReaderMode === 'dynamic' &&
          activeState.frame?.themeMarkerCount === 1 &&
          activeState.frame?.themeStyleCount > 0,
        activeState.frame,
      ),
      makeAssertion(
        'InkShade transforms variables, cross-origin CSS, gradients, pseudo-elements, shadow DOM, forms, and dynamic content',
        !isDarkColor(baselineState.cardBackground) &&
          isDarkColor(activeState.cardBackground) &&
          isDarkColor(activeState.inputBackground) &&
          isDarkColor(activeState.crossOriginBackground) &&
          isDarkColor(activeState.pseudoBackground) &&
          isDarkColor(activeState.dynamicBackground) &&
          isDarkColor(activeState.shadowBackground) &&
          /linear-gradient/i.test(activeState.gradientBackground || ''),
        {baselineState, activeState},
      ),
      makeAssertion(
        'InkShade preserves layout geometry and media dimensions against baseline',
        activeState.bodyElementCount === baselineState.bodyElementCount &&
          activeState.layout.display === baselineState.layout.display &&
          activeState.layout.columns === baselineState.layout.columns &&
          activeState.layout.gap === baselineState.layout.gap &&
          activeState.crossOriginDisplay === 'flex' &&
          rectsMatch(activeState.layout.shell, baselineState.layout.shell) &&
          rectsMatch(activeState.layout.card, baselineState.layout.card) &&
          rectsMatch(activeState.layout.gradient, baselineState.layout.gradient) &&
          rectsMatch(activeState.layout.image, baselineState.layout.image) &&
          activeState.hasVideo === true,
        {baseline: baselineState.layout, active: activeState.layout},
      ),
      makeAssertion(
        'InkShade tone controls and repeated updates preserve one engine instance',
        toneState.settings.theme.brightness === 88 &&
          repeatedState.settings.theme.brightness === 84 &&
          updatedState.darkReaderScheme === 'dark' &&
          updatedState.themeMarkerCount === 1 &&
          updatedState.themeStyleCount > 3,
        {toneState, repeatedState, updatedState},
      ),
      makeAssertion(
        'InkShade per-site control fully tears down and restores the theme',
        siteDisabledData.settings.disabledFor.some((entry) => entry.includes(HOSTS.ordinary)) &&
          siteDisabledPage.darkReaderMode == null &&
          siteDisabledPage.themeStyleCount === 0 &&
          !siteEnabledData.settings.disabledFor.some((entry) => entry.includes(HOSTS.ordinary)),
        {
          disabledFor: siteDisabledData.settings.disabledFor,
          disabledPage: {
            darkReaderMode: siteDisabledPage.darkReaderMode,
            darkReaderScheme: siteDisabledPage.darkReaderScheme,
            themeStyleCount: siteDisabledPage.themeStyleCount,
            themeMarkerCount: siteDisabledPage.themeMarkerCount,
          },
          restoredDisabledFor: siteEnabledData.settings.disabledFor,
        },
      ),
      makeAssertion(
        'InkShade preserves an already-dark page by default',
        nativeDarkState.darkReaderMode == null &&
          nativeDarkState.themeStyleCount === 0 &&
          nativeDarkState.bodyBackground === 'rgb(17, 17, 17)',
        nativeDarkState,
      ),
      makeAssertion('InkShade pages emit no uncaught errors', scenario.pageErrors.length === 0, scenario.pageErrors),
      makeAssertion(
        'InkShade extension pages emit no console errors',
        extensionOriginConsoleErrors.length === 0,
        extensionOriginConsoleErrors,
      ),
    );
  });
  return scenario;
}

async function runStudyNavScenario(executablePath, port) {
  const scenario = createScenario('studynav-only', ['StudyNav']);
  await withContext({ executablePath, extensions: ['StudyNav'], deviceScaleFactor: 2 }, async (context, launchMeta) => {
    scenario.launchMode = launchMeta.launchMode;
    const workers = await waitForNamedWorkers(context, ['StudyNav']);
    scenario.serviceWorkers = workers;
    const worker = await getWorkerByName(context, 'StudyNav');

    await setStudyNavFlags(worker, DEFAULT_STUDYNAV_FLAGS);
    await routeStudyNavFixtures(context);
    for (const hostname of ['stream.jw.org', 'hub.jw.org']) {
      await context.route(`https://${hostname}/**`, (route) => route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: '<!doctype html><title>Denied JW subdomain fixture</title><main data-pid="p1">No StudyNav here</main>',
      }));
    }
    await context.route(`https://${HOSTS.jwMedia}/media/fixture.mp4`, fulfillFixtureVideo);

    const ordinary = await openPage(
      context,
      scenario,
      'ordinary',
      httpUrl(HOSTS.ordinary, port, '/ordinary'),
    );
    await ordinary.waitForTimeout(600);
    const ordinaryState = await ordinary.evaluate(() => ({
      dataset: document.documentElement.dataset.studynav || null,
      palettePresent: !!document.getElementById('studynav-palette'),
    }));
    const deniedOriginStates = [];
    for (const hostname of ['stream.jw.org', 'hub.jw.org']) {
      const deniedPage = await openPage(context, scenario, `denied-${hostname}`, `https://${hostname}/fixture`);
      await deniedPage.waitForTimeout(400);
      deniedOriginStates.push(await deniedPage.evaluate(() => ({
        hostname: location.hostname,
        dataset: document.documentElement.dataset.studynav || null,
        palettePresent: !!document.getElementById('studynav-palette'),
        ownedNodes: document.querySelectorAll('[data-studynav-owned]').length,
      })));
      await deniedPage.close();
    }
    scenario.assertions.push(makeAssertion(
      'StudyNav does not inject into Stream or Hub',
      deniedOriginStates.every((state) =>
        state.dataset == null && state.palettePresent === false && state.ownedNodes === 0),
      deniedOriginStates,
    ));

    const jwPage = await openPage(
      context,
      scenario,
      'jw',
      httpsUrl(HOSTS.jw, STUDYNAV_FIXTURE_PATH),
    );
    await jwPage.waitForTimeout(1400);
    const jwState = await getStudyNavState(jwPage);
    await jwPage.evaluate(() => {
      const blank = document.createElement('img');
      blank.id = 'blank-alt-image';
      blank.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
      document.getElementById('article')?.appendChild(blank);
    });
    await jwPage.waitForTimeout(220);
    await jwPage.evaluate(() => {
      const probe = document.createElement('span');
      probe.id = 'repeat-apply-probe';
      document.getElementById('article')?.appendChild(probe);
      probe.remove();
    });
    await jwPage.waitForTimeout(220);
    const altTextEdgeState = await jwPage.evaluate(() => ({
      blocks: document.querySelectorAll('.studynav-alt').length,
      blankHasMarker: document.getElementById('blank-alt-image')?.hasAttribute('data-sn-alt') || false,
      blankHasDescription: document.getElementById('blank-alt-image')?.nextElementSibling?.classList.contains('studynav-alt') || false,
      articleDescription: document.querySelector('figure + .studynav-alt')?.textContent?.trim() || '',
      compactHasMarker: document.getElementById('compact-card-image')?.hasAttribute('data-sn-alt') || false,
      compactHasDescription: !!document.querySelector('#compact-publication-card .studynav-alt, #compact-publication-card + .studynav-alt'),
    }));
    await jwPage.evaluate(() => document.getElementById('blank-alt-image')?.remove());

    await setStudyNavFlags(worker, {
      ...DEFAULT_STUDYNAV_FLAGS,
      actionBar: true,
      cstblView: true,
      expandWidth: true,
    });
    await jwPage.waitForFunction(() =>
      getComputedStyle(document.getElementById('regionHeader')).position === 'sticky' &&
      getComputedStyle(document.querySelector('#article-table td')).borderTopStyle === 'solid');
    const layoutOptInState = await getStudyNavState(jwPage);

    await setStudyNavFlags(worker, DEFAULT_STUDYNAV_FLAGS);
    await jwPage.waitForFunction(() =>
      getComputedStyle(document.getElementById('regionHeader')).position === 'static' &&
      getComputedStyle(document.querySelector('#article-table td')).borderTopStyle !== 'solid');
    await installCopyCapture(jwPage);

    await selectFixtureText(jwPage, '#p1', 'A useful thought is easier to revisit when it stays beside the text.');
    await jwPage.locator('#studynav-selection-tools button', { hasText: 'Copy' }).click();
    const copiedParagraph = await waitForCopiedText(
      jwPage,
      (text) => text === 'A useful thought is easier to revisit when it stays beside the text.',
      'StudyNav paragraph copy did not reach the browser clipboard boundary',
    );
    await selectFixtureText(jwPage, '#p1', 'A useful thought is easier to revisit when it stays beside the text.');
    await jwPage.locator('#studynav-selection-tools button', { hasText: 'Link' }).click();
    const copiedLink = await waitForCopiedText(
      jwPage,
      (text) => text.endsWith('#p1'),
      'StudyNav paragraph link did not reach the browser clipboard boundary',
    );
    await jwPage.evaluate(() => {
      const collision = document.createElement('span');
      collision.id = 'studynav-pid-generated-pid';
      collision.textContent = 'Link target example';
      const paragraph = document.createElement('p');
      paragraph.dataset.pid = 'Generated PID';
      paragraph.textContent = 'StudyNav can create a precise link for this paragraph.';
      document.getElementById('article')?.append(collision, paragraph);
    });
    await jwPage.waitForFunction(() =>
      document.querySelector('p[data-pid="Generated PID"]')?.getAttribute('data-sn-tools') === '1');
    await selectFixtureText(
      jwPage,
      'p[data-pid="Generated PID"]',
      'StudyNav can create a precise link for this paragraph.',
    );
    await jwPage.locator('#studynav-selection-tools button', { hasText: 'Link' }).click();
    const generatedLink = await waitForCopiedText(
      jwPage,
      (text) => text.endsWith('#studynav-pid-generated-pid-2'),
      'StudyNav did not create a collision-safe paragraph anchor',
    );
    await setStudyNavFlags(worker, { ...DEFAULT_STUDYNAV_FLAGS, parLink: false });
    await jwPage.waitForFunction(() => {
      const paragraph = document.querySelector('p[data-pid="Generated PID"]');
      return paragraph && !paragraph.id && !paragraph.hasAttribute('data-sn-owned-anchor');
    });
    const generatedAnchorRemoved = await jwPage.evaluate(() => {
      const paragraph = document.querySelector('p[data-pid="Generated PID"]');
      return paragraph ? { id: paragraph.id, owned: paragraph.hasAttribute('data-sn-owned-anchor') } : null;
    });
    await setStudyNavFlags(worker, DEFAULT_STUDYNAV_FLAGS);

    await jwPage.keyboard.press(process.platform === 'darwin' ? 'Meta+Shift+K' : 'Control+Shift+K');
    await jwPage.waitForFunction(() => !document.getElementById('studynav-palette')?.classList.contains('hidden'));
    await jwPage.fill('#studynav-palette-input', 'w25.03');
    const mnemonicResults = await jwPage.locator('#studynav-palette-results li').count();
    await jwPage.fill('#studynav-palette-input', '123456');
    const docIdResults = await jwPage.locator('#studynav-palette-results li').count();
    await captureScreenshot(jwPage, '12-quick-search.png');
    await jwPage.keyboard.press('Escape');

    const fulfillPaletteDestination = (route) => route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>Palette destination</title><p>Palette destination fixture</p>',
    });
    await context.route('https://www.jw.org/**', fulfillPaletteDestination);
    const paletteNavigationPage = await openPage(
      context,
      scenario,
      'study-palette-navigation',
      httpsUrl(HOSTS.jw, STUDYNAV_FIXTURE_PATH),
    );
    await paletteNavigationPage.waitForFunction(() => document.documentElement.dataset.studynav === '1');
    await paletteNavigationPage.keyboard.press(process.platform === 'darwin' ? 'Meta+Shift+K' : 'Control+Shift+K');
    await paletteNavigationPage.fill('#studynav-palette-input', 'lff');
    await paletteNavigationPage.press('#studynav-palette-input', 'Enter');
    await paletteNavigationPage.waitForURL('https://www.jw.org/en/library/books/enjoy-life-forever/');
    const paletteEnterUrl = paletteNavigationPage.url();
    await paletteNavigationPage.goto(
      httpsUrl(HOSTS.jw, STUDYNAV_FIXTURE_PATH),
      { waitUntil: 'load' },
    );
    await paletteNavigationPage.waitForFunction(() => document.documentElement.dataset.studynav === '1');
    await paletteNavigationPage.keyboard.press(process.platform === 'darwin' ? 'Meta+Shift+K' : 'Control+Shift+K');
    await paletteNavigationPage.fill('#studynav-palette-input', '123456');
    await paletteNavigationPage.click('#studynav-palette-results li:first-child');
    await paletteNavigationPage.waitForURL('https://www.jw.org/en/search/?q=123456');
    const paletteClickUrl = paletteNavigationPage.url();
    await paletteNavigationPage.close();
    await context.unroute('https://www.jw.org/**', fulfillPaletteDestination);

    const commandApiProbe = await worker.evaluate(async (targetUrl) => {
      const target = (await chrome.tabs.query({})).find((tab) => tab.url === targetUrl);
      if (!target?.id) return { sent: false, tabId: null, permissions: chrome.runtime.getManifest().permissions || [] };
      await chrome.tabs.sendMessage(target.id, { type: 'OPEN_PALETTE' });
      return { sent: true, tabId: target.id, permissions: chrome.runtime.getManifest().permissions || [] };
    }, jwPage.url());
    await jwPage.waitForFunction(() => !document.getElementById('studynav-palette')?.classList.contains('hidden'));
    await jwPage.keyboard.press('Escape');

    const languageShellHtml = await jwPage.locator('#language-shell').innerHTML();
    await jwPage.evaluate(() => {
      document.getElementById('language-shell').replaceChildren();
      const fallback = document.createElement('p');
      fallback.id = 'language-text-fallback';
      fallback.textContent = 'This publication is available in 12 languages.';
      document.getElementById('article')?.appendChild(fallback);
    });
    await jwPage.waitForFunction(() => document.getElementById('studynav-langcount')?.textContent === '12 languages');
    const languageFallbackBadge = await jwPage.locator('#studynav-langcount').textContent();
    const languageFallbackPlacement = await jwPage.locator('#studynav-langcount').evaluate((badge) => ({
      placement: badge.dataset.placement,
      position: getComputedStyle(badge).position,
      previousId: badge.previousElementSibling?.id || null,
    }));
    await jwPage.evaluate(() => document.getElementById('language-text-fallback')?.remove());
    await jwPage.waitForFunction(() => !document.getElementById('studynav-langcount'));
    const languageAbsent = await jwPage.evaluate(() => !document.getElementById('studynav-langcount'));
    await jwPage.locator('#language-shell').evaluate((shell, html) => { shell.innerHTML = html; }, languageShellHtml);
    await jwPage.waitForFunction(() => {
      const badge = document.getElementById('studynav-langcount');
      return badge?.textContent === '6' && badge.isConnected &&
        badge.parentElement?.id === 'language-shell' &&
        badge.previousElementSibling?.tagName === 'SELECT' &&
        getComputedStyle(badge).position === 'static';
    });
    const languageRestoredBadge = await jwPage.locator('#studynav-langcount').textContent();
    const languageRestoredCount = await jwPage.locator('#studynav-langcount').count();
    const languageRestoredPlacement = await jwPage.locator('#studynav-langcount').evaluate((badge) => ({
      label: badge.getAttribute('aria-label'),
      placement: badge.dataset.placement,
      position: getComputedStyle(badge).position,
      parentId: badge.parentElement?.id || null,
      previousTag: badge.previousElementSibling?.tagName || null,
    }));

    const videoMutedBefore = await jwPage.locator('#jw-video').evaluate((video) => video.muted);
    await jwPage.bringToFront();
    await jwPage.locator('#jw-video').focus();
    await jwPage.keyboard.press('m');
    await jwPage.waitForFunction(() => document.getElementById('jw-video')?.muted === true);
    const videoMutedAfter = await jwPage.locator('#jw-video').evaluate((video) => video.muted);

    const mediaAnchorState = await jwPage.evaluate(() => {
      const bar = document.getElementById('studynav-media-bar');
      const summary = bar?.querySelector('summary');
      const barRect = bar?.getBoundingClientRect();
      const playerRect = document.getElementById('jw-player')?.getBoundingClientRect();
      const seek = document.getElementById('jw-seek');
      const seekRect = seek?.getBoundingClientRect();
      const summaryRect = summary?.getBoundingClientRect();
      const seekEndHit = seekRect
        ? document.elementFromPoint(seekRect.right - 3, seekRect.top + seekRect.height / 2)
        : null;
      return {
        parentId: bar?.parentElement?.id || null,
        placement: bar?.dataset.placement || null,
        position: bar ? getComputedStyle(bar).position : null,
        summaryText: summary?.textContent?.replace(/\s+/g, ' ').trim() || null,
        summaryTitle: summary?.getAttribute('title') || null,
        summaryRect: summaryRect ? { width: summaryRect.width, height: summaryRect.height } : null,
        insidePlayer: !!barRect && !!playerRect &&
          barRect.left >= playerRect.left && barRect.right <= playerRect.right &&
          barRect.top >= playerRect.top && barRect.bottom <= playerRect.bottom,
        belowPlayer: !!barRect && !!playerRect && barRect.top >= playerRect.bottom,
        overlapsSeek: !!barRect && !!seekRect &&
          barRect.left < seekRect.right && barRect.right > seekRect.left &&
          barRect.top < seekRect.bottom && barRect.bottom > seekRect.top,
        seekEndClickable: seekEndHit === seek || !!seek?.contains(seekEndHit),
      };
    });
    await openStudyNavMediaMenu(jwPage);
    const mediaMenuState = await jwPage.evaluate(() => ({
      open: document.querySelector('#studynav-media-bar details')?.hasAttribute('open') || false,
      heading: document.querySelector('.studynav-media-menu > strong')?.textContent?.trim() || null,
      buttons: Array.from(document.querySelectorAll('.studynav-media-actions > button')).map((button) => ({
        text: button.textContent?.trim() || '',
        visible: getComputedStyle(button).display !== 'none' && button.getBoundingClientRect().height > 0,
      })),
    }));
    await captureScreenshot(jwPage, '20-media-tools-menu.png');
    await jwPage.keyboard.press('Escape');
    await jwPage.waitForFunction(() => !document.querySelector('#studynav-media-bar details')?.hasAttribute('open'));
    const mediaMenuClosedByEscape = await jwPage.evaluate(() =>
      !document.querySelector('#studynav-media-bar details')?.hasAttribute('open') &&
      document.activeElement === document.querySelector('#studynav-media-bar summary'));

    await jwPage.evaluate(() => {
      const player = document.getElementById('jw-player');
      player?.classList.remove('vjs-user-active', 'vjs-paused');
      player?.classList.add('vjs-user-inactive', 'vjs-playing', 'vjs-has-started');
    });
    const focusedInactiveVisibility = await jwPage.locator('#studynav-media-bar').evaluate((bar) =>
      getComputedStyle(bar).visibility);
    await jwPage.locator('#jw-video').focus();
    await jwPage.waitForFunction(() => getComputedStyle(document.getElementById('studynav-media-bar')).visibility === 'hidden');
    const mediaIdleState = await jwPage.evaluate(() => ({
      barOpacity: getComputedStyle(document.getElementById('studynav-media-bar')).opacity,
      barVisibility: getComputedStyle(document.getElementById('studynav-media-bar')).visibility,
      barPointerEvents: getComputedStyle(document.getElementById('studynav-media-bar')).pointerEvents,
      nativeControlsOpacity: getComputedStyle(document.getElementById('jw-controls')).opacity,
    }));
    await jwPage.evaluate(() => document.getElementById('jw-player')?.classList.add('vjs-paused'));
    await jwPage.waitForFunction(() => getComputedStyle(document.getElementById('studynav-media-bar')).visibility === 'visible');
    const pausedInactiveVisibility = await jwPage.locator('#studynav-media-bar').evaluate((bar) =>
      getComputedStyle(bar).visibility);
    await jwPage.evaluate(() => {
      const player = document.getElementById('jw-player');
      player?.classList.remove('vjs-user-inactive', 'vjs-playing', 'vjs-has-started');
      player?.classList.add('vjs-user-active', 'vjs-paused');
    });

    await openStudyNavMediaMenu(jwPage);
    await jwPage.locator('#studynav-media-bar button', { hasText: 'Transcript' }).click();
    await jwPage.waitForFunction(() => /First transcript line/.test(document.getElementById('studynav-tr-body')?.textContent || ''));
    await jwPage.fill('#studynav-tr-q', 'lantern');
    const transcriptState = await jwPage.evaluate(() => ({
      panelVisible: !document.getElementById('studynav-transcript')?.classList.contains('hidden'),
      text: document.getElementById('studynav-tr-body')?.textContent?.trim(),
    }));
    await captureScreenshot(jwPage, '13-transcript-search.png');
    await jwPage.fill('#studynav-tr-q', '');
    await jwPage.waitForFunction(() =>
      /First transcript line/.test(document.getElementById('studynav-tr-body')?.textContent || '') &&
      /lantern/.test(document.getElementById('studynav-tr-body')?.textContent || ''));
    const transcriptDownloadPromise = jwPage.waitForEvent('download');
    await jwPage.click('#studynav-tr-dl');
    const transcriptDownload = await transcriptDownloadPromise;
    const transcriptDownloadPath = await transcriptDownload.path();
    const transcriptDownloadText = transcriptDownloadPath ? await readFile(transcriptDownloadPath, 'utf8') : '';
    await jwPage.click('#studynav-tr-x');
    await jwPage.waitForFunction(() => document.getElementById('studynav-transcript')?.classList.contains('hidden'));
    await jwPage.evaluate(() => document.getElementById('fixture-transcript')?.remove());
    await openStudyNavMediaMenu(jwPage);
    await jwPage.locator('#studynav-transcript-button').click();
    await jwPage.waitForFunction(() => /No transcript text was detected/i.test(
      document.getElementById('studynav-tr-body')?.textContent || '',
    ));
    const transcriptMissingState = await jwPage.evaluate(() => ({
      buttonPresent: !!document.getElementById('studynav-transcript-button'),
      panelVisible: !document.getElementById('studynav-transcript')?.classList.contains('hidden'),
      text: document.getElementById('studynav-tr-body')?.textContent?.trim() || '',
    }));
    await jwPage.click('#studynav-tr-x');

    const mediaClock = await jwPage.locator('#jw-video').evaluate(async (video) => {
      if (video.readyState < 1) {
        await new Promise((resolve) => {
          video.addEventListener('loadedmetadata', resolve, { once: true });
          setTimeout(resolve, 1_000);
        });
      }
      const target = Number.isFinite(video.duration) && video.duration > 0
        ? Math.min(1, video.duration / 2)
        : 0;
      try { video.currentTime = target; } catch { /* fixture media may not be seekable */ }
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { currentTime: video.currentTime, duration: video.duration, target };
    });
    await openStudyNavMediaMenu(jwPage);
    await jwPage.locator('#studynav-media-bar button', { hasText: 'Copy video link and time' }).click();
    await jwPage.waitForFunction(() => document.getElementById('studynav-toast')?.textContent === 'Video link and time copied');
    const pageAndTimeCopied = await jwPage.evaluate(() =>
      document.getElementById('studynav-toast')?.textContent === 'Video link and time copied');
    const timestampPageUrl = jwPage.url();

    await openStudyNavMediaMenu(jwPage);
    await jwPage.locator('#studynav-media-bar button', { hasText: 'Download a media segment' }).click();
    await jwPage.waitForFunction(() => !!document.getElementById('studynav-clip-panel'));
    const clipPanelState = await jwPage.evaluate(() => ({
      title: document.querySelector('#studynav-clip-panel strong')?.textContent?.trim(),
      labels: Array.from(document.querySelectorAll('#studynav-clip-panel label')).map((label) => label.childNodes[0]?.textContent?.trim()),
      formats: Array.from(document.querySelectorAll('#studynav-clip-panel select option')).map((option) => option.textContent?.trim()),
      values: Array.from(document.querySelectorAll('#studynav-clip-panel input')).map((input) => input.value),
      maxLengthHint: /5 minutes/.test(document.getElementById('studynav-clip-panel')?.textContent || '') &&
        /3 minutes/.test(document.getElementById('studynav-clip-panel')?.textContent || ''),
    }));
    await captureScreenshot(jwPage, '17-audio-segment.png');
    const clipInputs = jwPage.locator('#studynav-clip-panel input');
    await clipInputs.nth(0).fill('0:20');
    await clipInputs.nth(1).fill('0:10');
    await jwPage.locator('#studynav-clip-panel button[type="submit"]').click();
    await jwPage.waitForFunction(() => /end must be after the start/i.test(document.querySelector('.studynav-clip-error')?.textContent || ''));
    const clipInvalidError = await jwPage.locator('.studynav-clip-error').textContent();
    await jwPage.locator('#studynav-clip-panel button[type="button"]').click();

    const secondDisplayNetwork = [];
    const recordSecondDisplayRequest = (request) => {
      if (request.url().includes('/media/fixture.mp4')) {
        secondDisplayNetwork.push({ event: 'request', url: request.url(), headers: request.headers() });
      }
    };
    const recordSecondDisplayResponse = (response) => {
      if (response.url().includes('/media/fixture.mp4')) {
        secondDisplayNetwork.push({ event: 'response', url: response.url(), status: response.status() });
      }
    };
    const recordSecondDisplayFailure = (request) => {
      if (request.url().includes('/media/fixture.mp4')) {
        secondDisplayNetwork.push({ event: 'failed', url: request.url(), failure: request.failure() });
      }
    };
    context.on('request', recordSecondDisplayRequest);
    context.on('response', recordSecondDisplayResponse);
    context.on('requestfailed', recordSecondDisplayFailure);
    const transferSourceState = await jwPage.locator('#jw-video').evaluate(async (video) => {
      if (video.readyState < 1) {
        await new Promise((resolve) => {
          video.addEventListener('loadedmetadata', resolve, { once: true });
          setTimeout(resolve, 1_000);
        });
      }
      const target = Number.isFinite(video.duration) && video.duration > 0
        ? Math.min(0.5, video.duration / 4)
        : 0;
      try { video.currentTime = target; } catch { /* fixture media may not be seekable */ }
      await video.play();
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { currentTime: video.currentTime, playing: !video.paused, target };
    });
    const secondDisplayPromise = context.waitForEvent('page');
    await openStudyNavMediaMenu(jwPage);
    await jwPage.locator('#studynav-media-bar button', { hasText: 'Open in a separate window' }).click();
    const secondDisplay = await secondDisplayPromise;
    await secondDisplay.waitForLoadState('domcontentloaded');
    await secondDisplay.bringToFront();
    await secondDisplay.waitForTimeout(1_500);
    const secondDisplayUrl = secondDisplay.url();
    const secondDisplayState = await secondDisplay.evaluate(() => ({
      name: window.name,
      innerWidth,
      innerHeight,
      playerTag: document.querySelector('video, audio')?.tagName || null,
      playerSource: document.querySelector('video, audio')?.src || null,
      autoplay: document.querySelector('video, audio')?.autoplay ?? null,
      currentTime: document.querySelector('video, audio')?.currentTime ?? null,
      paused: document.querySelector('video, audio')?.paused ?? null,
      readyState: document.querySelector('video, audio')?.readyState ?? null,
      networkState: document.querySelector('video, audio')?.networkState ?? null,
      errorCode: document.querySelector('video, audio')?.error?.code ?? null,
    }));
    const transferOriginalState = await jwPage.locator('#jw-video').evaluate((video) => ({
      paused: video.paused,
      currentTime: video.currentTime,
    }));
    await secondDisplay.close();

    await jwPage.evaluate(() => {
      const video = document.getElementById('jw-video');
      if (!(video instanceof HTMLVideoElement)) return;
      video.src = URL.createObjectURL(new Blob(['temporary player stream'], { type: 'video/mp4' }));
      video.load();
    });
    const recoveredDisplayPromise = context.waitForEvent('page');
    await openStudyNavMediaMenu(jwPage);
    await jwPage.locator('#studynav-media-bar button', { hasText: 'Open in a separate window' }).click();
    const recoveredDisplay = await recoveredDisplayPromise;
    await recoveredDisplay.waitForLoadState('domcontentloaded');
    const recoveredDisplaySource = await recoveredDisplay.locator('video, audio').getAttribute('src');
    await recoveredDisplay.close();
    context.off('request', recordSecondDisplayRequest);
    context.off('response', recordSecondDisplayResponse);
    context.off('requestfailed', recordSecondDisplayFailure);
    await jwPage.evaluate((officialSource) => {
      const video = document.getElementById('jw-video');
      if (!(video instanceof HTMLVideoElement)) return;
      if (video.src.startsWith('blob:')) URL.revokeObjectURL(video.src);
      video.src = officialSource;
      video.load();
    }, `https://${HOSTS.jwMedia}/media/fixture.mp4`);

    await setStudyNavFlags(worker, { ...DEFAULT_STUDYNAV_FLAGS, imgGet: true });
    await jwPage.waitForFunction(() => document.querySelectorAll('.studynav-imgdl').length === 1);
    const compactImageState = await jwPage.evaluate(() => ({
      markedForDownload: document.getElementById('compact-card-image')?.hasAttribute('data-sn-dl') || false,
      helperInside: !!document.querySelector('#compact-publication-card .studynav-imgdl, #compact-publication-card .studynav-alt'),
      helperAfter: !!document.querySelector('#compact-publication-card + .studynav-imgdl, #compact-publication-card + .studynav-alt'),
      text: document.querySelector('#compact-publication-card p')?.textContent?.trim() || '',
    }));
    const imageButton = jwPage.locator('.studynav-imgdl');
    await imageButton.scrollIntoViewIfNeeded();
    await captureScreenshot(jwPage, '14-image-download.png');
    const imageButtonState = await imageButton.evaluate((button) => {
      const style = getComputedStyle(button);
      const rect = button.getBoundingClientRect();
      return {
        text: button.textContent?.trim() || '',
        ariaLabel: button.getAttribute('aria-label'),
        title: button.getAttribute('title'),
        childTag: button.firstElementChild?.tagName || null,
        pathCount: button.querySelectorAll('svg path').length,
        width: rect.width,
        height: rect.height,
        background: style.backgroundColor,
      };
    });
    await jwPage.bringToFront();
    await imageButton.hover();
    await jwPage.waitForFunction(() =>
      getComputedStyle(document.querySelector('.studynav-imgdl')).backgroundColor === 'rgb(82, 120, 179)');
    const imageButtonHoverState = await imageButton.evaluate((button) => ({
      background: getComputedStyle(button).backgroundColor,
      hovered: button.matches(':hover'),
      pointerTarget: document.elementFromPoint(
        button.getBoundingClientRect().left + button.getBoundingClientRect().width / 2,
        button.getBoundingClientRect().top + button.getBoundingClientRect().height / 2,
      )?.className || null,
    }));
    const imageDownloadPromise = jwPage.waitForEvent('download');
    await imageButton.click();
    const imageDownload = await imageDownloadPromise;
    const imageDownloadName = imageDownload.suggestedFilename();
    const missingImageUrl = httpsUrl(HOSTS.jw, '/missing-image.png');
    await jwPage.evaluate((src) => new Promise((resolve) => {
      const image = document.getElementById('article-image');
      if (!image) {
        resolve(false);
        return;
      }
      image.addEventListener('error', () => resolve(true), { once: true });
      image.src = src;
    }), missingImageUrl);
    const imageFallbackPagePromise = context.waitForEvent('page');
    await imageButton.click();
    const imageFallbackPage = await imageFallbackPagePromise;
    await imageFallbackPage.waitForLoadState('domcontentloaded');
    const imageFallbackUrl = imageFallbackPage.url();
    await imageFallbackPage.close();
    await jwPage.evaluate(() => {
      const image = document.getElementById('article-image');
      if (image instanceof HTMLImageElement) {
        image.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=';
      }
    });

    await jwPage.locator('#v1001003 .jsHighlightOnly').click();
    await jwPage.waitForFunction(() => {
      const verse = document.getElementById('v1001003');
      const toolbar = document.querySelector('#v1001003 > .studynav-para-tools');
      return (
        verse?.classList.contains('jwac-textHighlight') ||
        verse?.classList.contains('studynav-verse-selected')
      ) &&
        toolbar && getComputedStyle(toolbar).display !== 'none' &&
        toolbar.getAttribute('data-sn-verse-floating') === '1';
    });
    const selectedVerseState = await getStudyNavState(jwPage);

    await jwPage.locator('#v1001001 .jsHighlightOnly').click();
    await jwPage.locator('#v1001001 > .studynav-para-tools .studynav-verse-range-control').click();
    await jwPage.locator('#v1001003 .jsHighlightOnly').click();
    await jwPage.waitForFunction(() =>
      document.querySelectorAll('.verse.studynav-verse-selected').length === 3 &&
      document.querySelector('#v1001003 > .studynav-para-tools')?.getAttribute('data-sn-verse-floating') === '1');
    const selectedRangeState = await getStudyNavState(jwPage);
    await captureScreenshot(jwPage, '18-verse-range.png');
    const rangeSingleVerseControlsHidden = await jwPage.locator('#v1001003 > .studynav-para-tools').evaluate((toolbar) =>
      Array.from(toolbar.querySelectorAll('[data-single-verse-only="1"]')).every((control) => control.hidden));
    const rangeToolbar = jwPage.locator('#v1001003 > .studynav-para-tools');
    const rangeAudioLabel = await rangeToolbar.locator('.studynav-verse-audio').textContent();
    const rangeClearLabel = await rangeToolbar.locator('.studynav-verse-range-control').textContent();
    await rangeToolbar.locator('button', { hasText: 'Copy' }).click();
    const copiedVerseRange = await waitForCopiedText(
      jwPage,
      (text) => text === [
        'A quiet path began near the hills.',
        'Travelers paused to study the map.',
        'A small lamp marked the next step.',
      ].join('\n'),
      'StudyNav range copy retained verse numbers or did not copy every selected verse',
    );
    await rangeToolbar.locator('button', { hasText: 'Link' }).click();
    const copiedVerseRangeLink = await waitForCopiedText(
      jwPage,
      (text) => text.endsWith('#v1001001-v1001003'),
      'StudyNav range link did not preserve the selected contiguous verse range',
    );
    const rangeStatus = await sendStudyNavPageAction(worker, jwPage.url(), 'GET_STUDYNAV_STATUS');
    await rangeToolbar.locator('.studynav-verse-range-control').click();
    await jwPage.waitForFunction(() =>
      document.querySelectorAll('.verse.studynav-verse-selected').length === 0);
    await jwPage.locator('#v1001001 .jsHighlightOnly').click();
    await jwPage.locator('#v1001003 .jsHighlightOnly').click({ modifiers: ['Shift'] });
    await jwPage.waitForFunction(() =>
      document.querySelectorAll('.verse.studynav-verse-selected').length === 3);
    const shiftRangeIds = await jwPage.locator('.verse.studynav-verse-selected').evaluateAll((verses) =>
      verses.map((verse) => verse.id));
    await jwPage.locator('#v1001003 .studynav-verse-range-control').click();
    await jwPage.waitForFunction(() =>
      document.querySelectorAll('.verse.studynav-verse-selected').length === 0);
    await jwPage.locator('#v1001003 .jsHighlightOnly').click();
    await jwPage.waitForFunction(() =>
      document.querySelectorAll('.verse.studynav-verse-selected').length === 1 &&
      document.getElementById('v1001003')?.classList.contains('studynav-verse-selected'));

    const popup = await openPage(
      context,
      scenario,
      'popup',
      extensionPageUrl(workerInfoFor(workers, 'StudyNav').id, 'popup.html'),
    );
    await activateTabByUrl(worker, jwPage.url());
    await popup.reload({ waitUntil: 'load' });
    await popup.waitForFunction(() =>
      document.querySelectorAll('.row').length >= 16 &&
      document.getElementById('status-title')?.textContent === 'Ready on this Bible chapter');
    const popupState = await getPopupState(popup);
    await popup.click('#settings > summary');
    await popup.fill('#filter', 'captions');
    const filteredPopupState = await getPopupState(popup);

    await popup.evaluate(() => document.querySelector('[data-id="copyText"]').click());
    const copyOffFlags = await waitForWorkerState(
      worker,
      async () => (await chrome.storage.sync.get('flags')).flags,
      (flags) => flags.copyText === false,
      'StudyNav popup did not disable Copy Text',
    );
    await jwPage.waitForFunction(() =>
      Array.from(document.querySelectorAll('.studynav-para-tools')).every((toolbar) =>
        Array.from(toolbar.querySelectorAll('button')).every((button) => button.textContent?.trim() !== 'Copy')),
    );
    await selectFixtureText(jwPage, '#p1', 'A useful thought');
    const copyOffButtons = await jwPage.locator('#studynav-selection-tools button').allTextContents();
    await jwPage.evaluate(() => {
      window.getSelection()?.removeAllRanges();
      document.dispatchEvent(new Event('selectionchange'));
    });
    await popup.evaluate(() => document.querySelector('[data-id="copyText"]').click());
    await waitForWorkerState(
      worker,
      async () => (await chrome.storage.sync.get('flags')).flags,
      (flags) => flags.copyText === true,
      'StudyNav popup did not restore Copy Text',
    );
    await jwPage.waitForFunction(() => Array.from(document.querySelectorAll('.studynav-para-tools button'))
      .some((button) => button.textContent?.trim() === 'Copy'));
    await selectFixtureText(jwPage, '#p1', 'A useful thought');
    await jwPage.waitForFunction(() => !!Array.from(document.querySelectorAll('#studynav-selection-tools button'))
      .find((button) => button.textContent?.trim() === 'Copy'));
    await jwPage.evaluate(() => {
      window.getSelection()?.removeAllRanges();
      document.dispatchEvent(new Event('selectionchange'));
    });

    await popup.evaluate(() => document.querySelector('[data-id="verseAudio"]').click());
    const verseAudioOffFlags = await waitForWorkerState(
      worker,
      async () => (await chrome.storage.sync.get('flags')).flags,
      (flags) => flags.verseAudio === false,
      'StudyNav popup did not disable verse audio',
    );
    await jwPage.waitForFunction(() =>
      document.querySelectorAll('.studynav-verse-audio').length === 0 &&
      document.querySelectorAll('.studynav-verse-selected').length === 1);
    const verseAudioOffState = await getStudyNavState(jwPage);
    await popup.evaluate(() => document.querySelector('[data-id="verseAudio"]').click());
    await jwPage.waitForFunction(() => document.querySelectorAll('.studynav-verse-audio').length === 3);

    scenario.assertions.push(
      makeAssertion('StudyNav service worker discovered', workers.some((item) => workerMatchesExtension(item, 'StudyNav')), workers),
      makeAssertion('StudyNav stays off ordinary host', ordinaryState.dataset == null && ordinaryState.palettePresent === false, ordinaryState),
      makeAssertion('StudyNav activates on mapped jw host', jwState.dataset === '1', jwState),
      makeAssertion('StudyNav injects palette shell', jwState.palettePresent === true, jwState),
      makeAssertion(
        'StudyNav initializes reading actions without adding controls inside ordinary paragraphs',
        jwState.toolRoots >= 5 && jwState.paraTools === 3,
        jwState,
      ),
      makeAssertion('StudyNav injects alt text blocks', jwState.altBlocks >= 1, jwState),
      makeAssertion(
        'StudyNav image descriptions stay idempotent and ignore images without alt text or captions',
        altTextEdgeState.blocks === 1 && altTextEdgeState.blankHasMarker === false &&
          altTextEdgeState.blankHasDescription === false &&
          altTextEdgeState.compactHasMarker === false && altTextEdgeState.compactHasDescription === false &&
          altTextEdgeState.articleDescription === 'A mountain trail at sunrise - A clear path through the hills.',
        altTextEdgeState,
      ),
      makeAssertion(
        'StudyNav keeps the language count beside the page chooser instead of floating over content',
        jwState.langBadge === '6' && jwState.langBadgeTitle === '6 languages' &&
          jwState.langBadgeParent === 'language-shell' && jwState.langBadgePlacement === 'control' &&
          jwState.langBadgePosition === 'static',
        jwState,
      ),
      makeAssertion(
        'StudyNav language count uses an anchored article fallback, handles absence, and restores without duplicates',
        languageFallbackBadge === '12 languages' && languageAbsent === true &&
          languageFallbackPlacement.placement === 'content' && languageFallbackPlacement.position === 'static' &&
          languageFallbackPlacement.previousId === 'language-text-fallback' &&
          languageRestoredBadge === '6' && languageRestoredCount === 1 &&
          languageRestoredPlacement.label === '6 languages' &&
          languageRestoredPlacement.placement === 'control' && languageRestoredPlacement.position === 'static' &&
          languageRestoredPlacement.parentId === 'language-shell' && languageRestoredPlacement.previousTag === 'SELECT',
        {
          languageFallbackBadge,
          languageFallbackPlacement,
          languageAbsent,
          languageRestoredBadge,
          languageRestoredCount,
          languageRestoredPlacement,
        },
      ),
      makeAssertion(
        'StudyNav preserves native page geometry with layout helpers off by default',
        jwState.articleMarked === '1' && jwState.dialogMarked === false &&
          jwState.articleMaxWidth === '760px' && jwState.dialogMaxWidth === '280px' &&
          jwState.articleTableBorder !== 'solid' && jwState.dialogTableBorder !== 'solid' &&
          jwState.headerPosition === 'static' && jwState.footerPosition === 'static' &&
          jwState.documentScrollWidth <= jwState.documentClientWidth,
        jwState,
      ),
      makeAssertion(
        'StudyNav scopes opt-in layout CSS to the article and real header without overflow',
        layoutOptInState.articleMaxWidth !== '760px' &&
          layoutOptInState.articleTableBorder === 'solid' &&
          layoutOptInState.dialogMaxWidth === '280px' &&
          layoutOptInState.dialogTableBorder !== 'solid' &&
          layoutOptInState.headerPosition === 'sticky' &&
          layoutOptInState.footerPosition === 'static' &&
          layoutOptInState.articlePosition === 'static' &&
          layoutOptInState.articleRect?.right <= layoutOptInState.documentClientWidth &&
          layoutOptInState.documentScrollWidth <= layoutOptInState.documentClientWidth &&
          !layoutOptInState.dynamicCss.includes('.jsLockedChrome') &&
          !layoutOptInState.dynamicCss.includes('#regionPrimaryNav'),
        layoutOptInState,
      ),
      makeAssertion(
        'StudyNav removes player shading without overriding the native control visibility',
        jwState.mediaControlOpacity === '1' &&
          jwState.mediaControlBackground === 'rgba(0, 0, 0, 0)' &&
          jwState.mediaControlBackgroundImage === 'none' &&
          !jwState.dynamicCss.includes('opacity: 1 !important') &&
          mediaIdleState.nativeControlsOpacity === '0',
        { jwState, mediaIdleState },
      ),
      makeAssertion(
        'StudyNav media actions stay below the player, leave the seek bar clickable, and follow player idle state',
        jwState.imageButtons === 0 &&
          ['Copy video link and time', 'Download a media segment', 'Open in a separate window', 'Transcript']
            .every((label) => jwState.mediaButtons.includes(label)) &&
          mediaAnchorState.parentId === 'article' && mediaAnchorState.placement === 'below-player' &&
          mediaAnchorState.position === 'relative' && mediaAnchorState.insidePlayer === false &&
          mediaAnchorState.belowPlayer === true && mediaAnchorState.overlapsSeek === false &&
          mediaAnchorState.seekEndClickable === true &&
          mediaAnchorState.summaryText === 'StudyNav video · Video tools' && mediaAnchorState.summaryTitle === 'Video tools' &&
          mediaAnchorState.summaryRect?.width <= 150 && mediaAnchorState.summaryRect?.height <= 40 &&
          mediaMenuState.open === true && mediaMenuState.heading === 'Video tools' &&
          mediaMenuState.buttons.length === 4 && mediaMenuState.buttons.every((button) => button.visible) &&
          mediaMenuClosedByEscape === true && focusedInactiveVisibility === 'visible' &&
          mediaIdleState.barOpacity === '0' && mediaIdleState.barVisibility === 'hidden' &&
          mediaIdleState.barPointerEvents === 'none' && pausedInactiveVisibility === 'visible',
        {
          jwState,
          mediaAnchorState,
          mediaMenuState,
          mediaMenuClosedByEscape,
          focusedInactiveVisibility,
          mediaIdleState,
          pausedInactiveVisibility,
        },
      ),
      makeAssertion(
        'StudyNav paragraph Copy and Link buttons write clean clipboard values',
        copiedParagraph === 'A useful thought is easier to revisit when it stays beside the text.' && copiedLink.endsWith('#p1') &&
          generatedLink.endsWith('#studynav-pid-generated-pid-2') &&
          generatedAnchorRemoved?.id === '' && generatedAnchorRemoved?.owned === false,
        { copiedParagraph, copiedLink, generatedLink, generatedAnchorRemoved },
      ),
      makeAssertion(
        'StudyNav mnemonic and DOCID palette routes are available from the hotkey',
        mnemonicResults >= 4 && docIdResults === 3 && commandApiProbe.sent === true &&
          paletteEnterUrl === 'https://www.jw.org/en/library/books/enjoy-life-forever/' &&
          paletteClickUrl === 'https://www.jw.org/en/search/?q=123456' &&
          commandApiProbe.permissions.length === 2 &&
          commandApiProbe.permissions.includes('storage') &&
          commandApiProbe.permissions.includes('offscreen'),
        { mnemonicResults, docIdResults, paletteEnterUrl, paletteClickUrl, commandApiProbe },
      ),
      makeAssertion(
        'StudyNav media keys, page time, media segment, second display, and transcript helpers execute',
        videoMutedBefore === false && videoMutedAfter === true &&
          Number.isFinite(mediaClock.duration) && mediaClock.duration > 0 &&
          Number.isFinite(mediaClock.currentTime) && mediaClock.currentTime >= 0 && pageAndTimeCopied === true &&
          clipPanelState.title === 'Download an audio or video segment' &&
          clipPanelState.labels.join('|') === 'Format|Start|End' &&
          clipPanelState.formats.join('|') === 'Audio (.wav) · up to 5 minutes|Video (.webm) · up to 3 minutes' &&
          clipPanelState.maxLengthHint === true &&
          /end must be after the start/i.test(clipInvalidError || '') &&
          transferSourceState.playing === true && transferOriginalState.paused === true &&
          secondDisplayUrl.startsWith('blob:https://www.jw.org/') &&
          secondDisplayState.name === 'studynav-second' &&
          secondDisplayState.playerTag === 'VIDEO' &&
          secondDisplayState.playerSource === `https://${HOSTS.jwMedia}/media/fixture.mp4` &&
          secondDisplayState.autoplay === true && secondDisplayState.paused === false &&
          typeof secondDisplayState.currentTime === 'number' &&
          secondDisplayState.currentTime >= transferSourceState.currentTime &&
          secondDisplayState.currentTime - transferSourceState.currentTime < 2.5 &&
          recoveredDisplaySource === `https://${HOSTS.jwMedia}/media/fixture.mp4` &&
          secondDisplayState.innerWidth > 0 && secondDisplayState.innerHeight > 0 &&
          transcriptState.panelVisible && transcriptState.text === 'Second searchable transcript line mentions lantern.' &&
          transcriptDownload.suggestedFilename() === 'transcript.txt' &&
          /First transcript line/.test(transcriptDownloadText) && /lantern/.test(transcriptDownloadText) &&
          transcriptMissingState.buttonPresent === true && transcriptMissingState.panelVisible === true &&
          /No transcript text was detected/i.test(transcriptMissingState.text),
        {
          videoMutedBefore,
          videoMutedAfter,
          mediaClock,
          pageAndTimeCopied,
          timestampPageUrl,
          clipPanelState,
          clipInvalidError,
          transferSourceState,
          transferOriginalState,
          secondDisplayUrl,
          secondDisplayState,
          recoveredDisplaySource,
          secondDisplayNetwork,
          transcriptState,
          transcriptDownloadText,
          transcriptMissingState,
        },
      ),
      makeAssertion(
        'StudyNav opt-in image helper is a labeled blue button and produces a local download',
        imageButtonState.text === 'Download image' &&
          imageButtonState.ariaLabel === 'Download image' &&
          imageButtonState.title === 'Download image' &&
          imageButtonState.childTag === 'svg' &&
          imageButtonState.pathCount === 1 &&
          imageButtonState.width >= 100 && imageButtonState.height >= 36 &&
          imageButtonState.background === 'rgb(67, 102, 159)' &&
          imageButtonHoverState.hovered === true &&
          imageButtonHoverState.background === 'rgb(82, 120, 179)' &&
          typeof imageDownloadName === 'string' && imageDownloadName.length > 0 &&
          imageFallbackUrl === missingImageUrl && compactImageState.markedForDownload === false &&
          compactImageState.helperInside === false && compactImageState.helperAfter === false &&
          compactImageState.text === 'Small publication preview text must remain unobstructed.',
        { imageButtonState, imageButtonHoverState, imageDownloadName, imageFallbackUrl, missingImageUrl, compactImageState },
      ),
      makeAssertion(
        'StudyNav exposes verse audio on the natively selected Bible verse',
        selectedVerseState.verseAudioButtons === 3 &&
          selectedVerseState.selectedVerse === 'v1001003' &&
          selectedVerseState.selectedToolbarDisplay !== 'none' &&
          selectedVerseState.selectedToolbarFloating === true &&
          selectedVerseState.selectedToolbarInViewport === true &&
          selectedVerseState.selectedToolbarOverlapsVerse === false &&
          selectedVerseState.selectedAudioButtonClickable === true,
        selectedVerseState,
      ),
      makeAssertion(
        'StudyNav touch-friendly controls select and clear a contiguous range for audio, copy, and links',
        JSON.stringify(selectedRangeState.selectedVerses) === JSON.stringify(['v1001001', 'v1001002', 'v1001003']) &&
          rangeSingleVerseControlsHidden === true &&
          rangeAudioLabel === 'Download audio 1–3' &&
          rangeClearLabel === 'Clear selection' &&
          copiedVerseRange === [
            'A quiet path began near the hills.',
            'Travelers paused to study the map.',
            'A small lamp marked the next step.',
          ].join('\n') &&
          copiedVerseRangeLink.endsWith('#v1001001-v1001003') &&
          rangeStatus?.selectedVerseRange?.chapter === 1 &&
          rangeStatus?.selectedVerseRange?.startVerse === 1 &&
          rangeStatus?.selectedVerseRange?.endVerse === 3,
        {
          selectedRangeState,
          rangeSingleVerseControlsHidden,
          rangeAudioLabel,
          rangeClearLabel,
          copiedVerseRange,
          copiedVerseRangeLink,
          rangeStatus,
        },
      ),
      makeAssertion(
        'StudyNav retains Shift-click as an optional contiguous range shortcut',
        JSON.stringify(shiftRangeIds) === JSON.stringify(['v1001001', 'v1001002', 'v1001003']),
        { shiftRangeIds },
      ),
      makeAssertion(
        'StudyNav popup identifies its site and purpose before its handle',
        popupState.title === 'StudyNav — Unofficial Study Tools' &&
          popupState.heading === 'StudyNav' &&
          popupState.headingVisible === true && popupState.bodyOverflows === false &&
          popupState.statusTitle === 'Ready on this Bible chapter' &&
          popupState.imageDownloadChecked === true &&
          popupState.masterAccent === 'rgb(67, 102, 159)' &&
          popupState.statusAccent === 'rgb(67, 102, 159)' &&
          /Verse 1:3 is selected/.test(popupState.statusHint || '') &&
          /select one verse, or choose select several/i.test(popupState.guideText || ''),
        popupState,
      ),
      makeAssertion(
        'StudyNav popup explains the workflow and progressively discloses all 23 settings',
        popupState.rowCount === 23 && popupState.groupCount === 4 &&
          popupState.masterChecked === true && popupState.settingsOpen === false &&
          popupState.enabledCount === '20 on' &&
          filteredPopupState.settingsOpen === true && filteredPopupState.visibleRows === 2,
        { popupState, filteredPopupState },
      ),
      makeAssertion(
        'StudyNav popup individual feature toggle removes only the requested control',
        copyOffFlags.copyText === false && !copyOffButtons.includes('Copy') &&
          copyOffButtons.includes('Add note') && copyOffButtons.includes('Link'),
        { copyOffFlags, copyOffButtons },
      ),
      makeAssertion(
        'StudyNav verse-audio toggle removes only audio controls while retaining verse selection tools',
        verseAudioOffFlags.verseAudio === false &&
          verseAudioOffState.verseAudioButtons === 0 &&
          verseAudioOffState.selectedVerse === 'v1001003' &&
          verseAudioOffState.paraTools >= 2,
        { verseAudioOffFlags, verseAudioOffState },
      ),
    );

    await popup.evaluate(() => document.getElementById('master').click());
    await jwPage.waitForFunction(() => document.documentElement.dataset.studynav === 'off');
    const disabledState = await getStudyNavState(jwPage);
    await popup.evaluate(() => document.getElementById('master').click());
    await jwPage.waitForFunction(() => document.documentElement.dataset.studynav === '1' && document.querySelectorAll('.studynav-para-tools').length >= 2);
    const reenabledState = await getStudyNavState(jwPage);

    await jwPage.evaluate(() => history.pushState({}, '', '/en/'));
    await jwPage.waitForFunction(() => document.documentElement.dataset.studynav === 'unsupported');
    const spaUnsupportedState = await getStudyNavState(jwPage);
    await jwPage.evaluate((fixturePath) => history.pushState({}, '', fixturePath), STUDYNAV_FIXTURE_PATH);
    await jwPage.waitForFunction(() => document.documentElement.dataset.studynav === '1' && document.querySelectorAll('.studynav-para-tools').length >= 2);
    const spaRestoredState = await getStudyNavState(jwPage);

    await jwPage.evaluate(() => {
      const notFound = document.createElement('section');
      notFound.id = 'fixture-page-not-found';
      notFound.className = 'PageNotFound';
      document.getElementById('article')?.appendChild(notFound);
    });
    await jwPage.waitForFunction(() => document.documentElement.dataset.studynav === 'unsupported');
    const pageNotFoundState = await getStudyNavState(jwPage);
    await jwPage.evaluate(() => document.getElementById('fixture-page-not-found')?.remove());
    await jwPage.waitForFunction(() => document.documentElement.dataset.studynav === '1' && document.querySelectorAll('.studynav-para-tools').length >= 2);
    const pageNotFoundRestoredState = await getStudyNavState(jwPage);

    scenario.assertions.push(
      makeAssertion(
        'StudyNav popup master off removes all owned UI, style, and scope markers',
        disabledState.dataset === 'off' && disabledState.palettePresent === false && disabledState.paraTools === 0 &&
          disabledState.altBlocks === 0 && disabledState.langBadge == null && disabledState.stylePresent === false &&
          disabledState.mediaBar === false && disabledState.mediaHostCount === 0 &&
          disabledState.imageButtons === 0 && disabledState.articleMarked == null &&
          disabledState.selectedVerse == null,
        disabledState,
      ),
      makeAssertion(
        'StudyNav popup master on restores the supported article state',
        reenabledState.dataset === '1' && reenabledState.paraTools >= 2 && reenabledState.articleMarked === '1',
        reenabledState,
      ),
      makeAssertion(
        'StudyNav SPA route reconciliation tears down unsupported routes and restores supported routes',
        spaUnsupportedState.dataset === 'unsupported' && spaUnsupportedState.paraTools === 0 &&
          spaUnsupportedState.stylePresent === false && spaUnsupportedState.articleMarked == null &&
          spaUnsupportedState.mediaHostCount === 0 &&
          spaRestoredState.dataset === '1' && spaRestoredState.paraTools >= 2 &&
          spaRestoredState.articleMarked === '1' && spaRestoredState.mediaHostCount === 1,
        { spaUnsupportedState, spaRestoredState },
      ),
      makeAssertion(
        'StudyNav fails closed on a Page Not Found surface and restores after navigation content changes',
        pageNotFoundState.dataset === 'unsupported' &&
          pageNotFoundState.palettePresent === false &&
          pageNotFoundState.paraTools === 0 &&
          pageNotFoundState.stylePresent === false &&
          pageNotFoundState.articleMarked == null &&
          pageNotFoundState.mediaHostCount === 0 &&
          pageNotFoundRestoredState.dataset === '1' &&
          pageNotFoundRestoredState.paraTools >= 2 && pageNotFoundRestoredState.mediaHostCount === 1,
        { pageNotFoundState, pageNotFoundRestoredState },
      ),
    );
  });
  return scenario;
}

async function runStudyNavStudySuiteScenario(executablePath, port) {
  const scenario = createScenario('studynav-study-suite', ['StudyNav']);
  await withContext({ executablePath, extensions: ['StudyNav'], deviceScaleFactor: 2 }, async (context, launchMeta) => {
    scenario.launchMode = launchMeta.launchMode;
    const workers = await waitForNamedWorkers(context, ['StudyNav']);
    scenario.serviceWorkers = workers;
    const worker = await getWorkerByName(context, 'StudyNav');
    await setStudyNavFlags(worker, DEFAULT_STUDYNAV_FLAGS);
    await routeStudyNavFixtures(context);
    await context.route(`https://${HOSTS.jwMedia}/media/fixture.mp4`, fulfillFixtureVideo);

    const page = await openPage(
      context,
      scenario,
      'study-suite-jw',
      httpsUrl(HOSTS.jw, STUDYNAV_FIXTURE_PATH),
    );
    await page.waitForFunction(() =>
      document.documentElement.dataset.studynav === '1' &&
      document.querySelectorAll('[data-sn-tools="1"]').length >= 5 &&
      document.querySelectorAll('#p1 > [data-studynav-owned]').length === 0);
    await installCopyCapture(page);
    await page.hover('#p1');
    await captureScreenshot(page, '16-unobstructed-paragraph.png');
    await captureScreenshot(page, '01-jw-default.png');

    const officialShapeBefore = await page.evaluate(() => ({
      p1OwnedChildren: document.querySelectorAll('#p1 > [data-studynav-owned]').length,
      p1OfficialChildren: Array.from(document.getElementById('p1')?.childNodes || [])
        .filter((node) => !(node instanceof Element) || !node.hasAttribute('data-studynav-owned')).length,
      articleRect: (() => {
        const rect = document.getElementById('article')?.getBoundingClientRect();
        return rect ? { left: rect.left, right: rect.right, width: rect.width } : null;
      })(),
      bodyWidth: document.body.getBoundingClientRect().width,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    const directHighlights = [
      ['yellow', 'A useful'],
      ['green', 'thought'],
      ['blue', 'text.'],
    ];
    for (const [color, exact] of directHighlights) {
      await selectFixtureText(page, '#p1', exact);
      if (color === 'yellow') await captureScreenshot(page, '02-selection-toolbar.png');
      await page.locator(`.studynav-color-button[data-color="${color}"]`).click();
      await waitForWorkerState(
        worker,
        async () => (await chrome.storage.local.get('studynavStudyDataV2')).studynavStudyDataV2,
        (data) => data?.annotations?.some((item) => item.color === color && item.selector.exact === exact),
        `StudyNav did not persist the ${color} selection`,
      );
    }

    const yellowHighlightPoint = await page.evaluate(() => {
      const root = document.getElementById('p1');
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const start = (node.nodeValue || '').indexOf('A useful');
        if (start < 0) continue;
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, start + 'A useful'.length);
        const rect = range.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      }
      return null;
    });
    ensure(yellowHighlightPoint, 'Could not resolve a click point for the saved yellow highlight');
    await page.mouse.click(yellowHighlightPoint.x, yellowHighlightPoint.y);
    await page.waitForSelector('#studynav-note-editor');
    const highlightClickEditorState = await page.evaluate(() => ({
      insideRail: !!document.querySelector('#studynav-note-rail #studynav-note-editor'),
      railMode: document.getElementById('studynav-note-rail')?.dataset.mode || null,
      title: document.getElementById('studynav-editor-title')?.textContent?.trim() || '',
      buttons: Array.from(document.querySelectorAll('#studynav-note-editor button'))
        .map((button) => button.textContent?.trim() || ''),
    }));
    await page.fill('#studynav-note-text', 'Note added by clicking the highlight');
    await page.evaluate(() => new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const clickedTagInput = page.locator('#studynav-note-tags');
    await clickedTagInput.focus();
    await clickedTagInput.fill('clicked');
    await clickedTagInput.press(',');
    await page.waitForFunction(() => document.querySelectorAll('#studynav-note-editor .studynav-tag-chip').length === 1);
    await page.locator('#studynav-note-editor button', { hasText: 'Save locally' }).click();
    const clickedHighlightData = await waitForWorkerState(
      worker,
      async () => (await chrome.storage.local.get('studynavStudyDataV2')).studynavStudyDataV2,
      (data) => data?.annotations?.some((item) =>
        item.selector.exact === 'A useful' && item.note === 'Note added by clicking the highlight' && item.tags.includes('clicked')),
      'StudyNav did not save a note opened from a highlight click',
    );

    await selectFixtureText(page, '#p2', 'A precise link returns to the same place without searching again.');
    await page.locator('#studynav-selection-tools button', { hasText: 'Add note' }).click();
    await page.waitForSelector('#studynav-note-editor');
    await captureScreenshot(page, '03-note-editor.png');
    const editorColors = await page.locator('#studynav-note-editor input[name="color"]').evaluateAll((inputs) =>
      inputs.map((input) => input.value));
    await page.keyboard.press('x');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('studynav-note-editor'));

    await selectFixtureText(page, '#p2', 'A precise link returns to the same place without searching again.');
    await page.locator('#studynav-selection-tools button', { hasText: 'Add note' }).click();
    await page.fill('#studynav-note-text', 'Private family note');
    const storageRerenderProbeReady = await page.evaluate(() => {
      const editor = document.getElementById('studynav-note-editor');
      const card = document.querySelector('#studynav-note-rail .studynav-note-rail-item');
      if (!editor || !(card instanceof HTMLElement)) return false;
      editor.dataset.storageProbe = 'keep-editor';
      card.dataset.storageProbeCard = 'replace-card';
      return true;
    });
    ensure(storageRerenderProbeReady, 'Could not prepare the active note-editor storage rerender probe');
    await worker.evaluate(async () => {
      const key = 'studynavStudyDataV2';
      const data = (await chrome.storage.local.get(key))[key];
      await chrome.storage.local.set({
        [key]: { ...data, annotations: [...data.annotations].reverse() },
      });
    });
    await page.waitForFunction(() => !document.querySelector('[data-storage-probe-card="replace-card"]'));
    const editorStorageRerenderState = await page.evaluate(() => ({
      sameEditor: document.getElementById('studynav-note-editor')?.dataset.storageProbe === 'keep-editor',
      noteValue: document.getElementById('studynav-note-text')?.value || '',
    }));
    await page.evaluate(() => new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const familyTagInput = page.locator('#studynav-note-tags');
    await familyTagInput.focus();
    await familyTagInput.fill('Faith,');
    await familyTagInput.fill(' family');
    await familyTagInput.press('Enter');
    await familyTagInput.fill('faith,');
    const tagChipState = await page.evaluate(() => ({
      values: Array.from(document.querySelectorAll('#studynav-note-editor .studynav-tag-chip'))
        .map((chip) => chip.firstChild?.textContent?.trim() || ''),
      removeLabels: Array.from(document.querySelectorAll('#studynav-note-editor .studynav-tag-chip button'))
        .map((button) => button.getAttribute('aria-label')),
      inputValue: document.getElementById('studynav-note-tags')?.value || '',
    }));
    await page.check('#studynav-note-editor input[value="pink"]');
    await page.locator('#studynav-note-editor button', { hasText: 'Save locally' }).click();
    const fourColorData = await waitForWorkerState(
      worker,
      async () => (await chrome.storage.local.get('studynavStudyDataV2')).studynavStudyDataV2,
      (data) => data?.annotations?.length === 4 &&
        ['yellow', 'green', 'blue', 'pink'].every((color) => data.annotations.some((item) => item.color === color)),
      'StudyNav did not persist the representative highlight colors',
    );
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.waitForFunction(() => document.getElementById('studynav-note-rail')?.dataset.mode === 'rail');
    const noteRailLayoutState = await page.evaluate(() => {
      const rail = document.getElementById('studynav-note-rail');
      const article = document.getElementById('article');
      const badge = document.getElementById('studynav-langcount');
      const rect = (element) => {
        const value = element?.getBoundingClientRect();
        return value ? { left: value.left, top: value.top, right: value.right, bottom: value.bottom } : null;
      };
      const railRect = rect(rail);
      const articleRect = rect(article);
      const badgeRect = rect(badge);
      const overlaps = (a, b) => !!a && !!b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      return {
        mode: rail?.dataset.mode || null,
        railRect,
        articleRect,
        badgeRect,
        overlapsArticle: overlaps(railRect, articleRect),
        overlapsBadge: overlaps(railRect, badgeRect),
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        cards: document.querySelectorAll('#studynav-note-rail .studynav-note-rail-item').length,
        explicitEditButtons: Array.from(document.querySelectorAll('#studynav-note-rail .studynav-note-rail-item button'))
          .filter((button) => ['Edit', 'Add note'].includes(button.textContent?.trim() || '')).length,
        explicitDeleteButtons: Array.from(document.querySelectorAll('#studynav-note-rail .studynav-note-rail-item button'))
          .filter((button) => button.textContent?.trim() === 'Delete').length,
      };
    });
    const pinkRailCard = page.locator('.studynav-note-rail-item', {
      has: page.locator('strong', { hasText: 'A precise link returns to the same place without searching again.' }),
    });
    await pinkRailCard.locator('button', { hasText: 'Edit' }).click();
    await page.waitForSelector('#studynav-note-editor');
    const railEditorState = await page.evaluate(() => ({
      insideRail: !!document.querySelector('#studynav-note-rail #studynav-note-editor'),
      railMode: document.getElementById('studynav-note-rail')?.dataset.mode || null,
      buttons: Array.from(document.querySelectorAll('#studynav-note-editor .studynav-panel-actions button'))
        .map((button) => button.textContent?.trim() || ''),
    }));
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('studynav-note-editor'));
    await captureScreenshot(page, '19-note-rail.png');
    await page.setViewportSize({ width: 1280, height: 720 });

    await selectFixtureText(page, '#p1', 'A useful');
    const selectionColors = await page.locator('.studynav-color-button').evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute('data-color')));
    await page.evaluate(() => {
      window.getSelection()?.removeAllRanges();
      document.dispatchEvent(new Event('selectionchange'));
    });

    await page.waitForFunction(() => {
      const registry = CSS.highlights;
      return ['yellow', 'green', 'blue', 'pink'].every((color) =>
        (registry?.get(`studynav-${color}`)?.size || 0) > 0);
    });
    const annotationRenderState = await page.evaluate(() => ({
      registrySizes: Object.fromEntries(['yellow', 'green', 'blue', 'pink'].map((color) => [
        color,
        CSS.highlights?.get(`studynav-${color}`)?.size || 0,
      ])),
      p1OwnedChildren: document.querySelectorAll('#p1 > [data-studynav-owned]').length,
      p1OfficialChildren: Array.from(document.getElementById('p1')?.childNodes || [])
        .filter((node) => !(node instanceof Element) || !node.hasAttribute('data-studynav-owned')).length,
      editorOpen: !!document.getElementById('studynav-note-editor'),
      bodyWidth: document.body.getBoundingClientRect().width,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    await page.evaluate(() => {
      const first = document.getElementById('p1')?.firstChild;
      const second = document.getElementById('p2')?.firstChild;
      if (!first || !second) return;
      const range = document.createRange();
      range.setStart(first, 0);
      range.setEnd(second, Math.min(9, second.textContent?.length || 0));
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
    });
    await page.waitForFunction(() =>
      /within one paragraph or verse/i.test(document.getElementById('studynav-toast')?.textContent || ''));
    const crossParagraphState = await page.evaluate(() => ({
      toolbarOpen: !!document.getElementById('studynav-selection-tools'),
      toast: document.getElementById('studynav-toast')?.textContent || '',
    }));
    const afterCrossData = await readStudyNavLocalData(worker);

    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() =>
      document.documentElement.dataset.studynav === '1' &&
      ['yellow', 'green', 'blue', 'pink'].every((color) =>
        (CSS.highlights?.get(`studynav-${color}`)?.size || 0) > 0));
    const reloadState = await page.evaluate(() => ({
      highlightColors: ['yellow', 'green', 'blue', 'pink'].filter((color) =>
        (CSS.highlights?.get(`studynav-${color}`)?.size || 0) > 0),
      verseMarkButtons: Array.from(document.querySelectorAll('.verse > .studynav-para-tools button'))
        .filter((button) => button.textContent?.trim() === 'Mark').length,
      officialChildren: Array.from(document.getElementById('p1')?.childNodes || [])
        .filter((node) => !(node instanceof Element) || !node.hasAttribute('data-studynav-owned')).length,
    }));

    const panelOpenResponse = await sendStudyNavPageAction(worker, page.url(), 'OPEN_STUDY_PANEL');
    await page.waitForSelector('#studynav-study-panel');
    await page.waitForFunction(() => document.getElementById('studynav-note-count')?.textContent === '4 notes');
    const initialPanelState = await page.evaluate(() => {
      const panel = document.getElementById('studynav-study-panel');
      const article = document.getElementById('article');
      const panelStyle = panel ? getComputedStyle(panel) : null;
      const panelRect = panel?.getBoundingClientRect();
      const articleRect = article?.getBoundingClientRect();
      return {
        noteCount: document.querySelectorAll('.studynav-note-card').length,
        position: panelStyle?.position || null,
        panelRect: panelRect ? { left: panelRect.left, right: panelRect.right, width: panelRect.width } : null,
        articleRect: articleRect ? { left: articleRect.left, right: articleRect.right, width: articleRect.width } : null,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        searchMinHeight: getComputedStyle(document.getElementById('studynav-note-search')).minHeight,
      };
    });
    await captureScreenshot(page, '04-study-panel.png');

    await page.locator('#studynav-study-panel button', { hasText: 'Close' }).click();
    await selectFixtureText(page, '#p1', 'thought');
    const paragraphBookmarkResponse = await sendStudyNavPageAction(
      worker,
      page.url(),
      'TOGGLE_STUDY_BOOKMARK',
    );
    await waitForWorkerState(
      worker,
      async () => (await chrome.storage.local.get('studynavStudyDataV2')).studynavStudyDataV2,
      (data) => data?.bookmarks?.length === 1 && data.bookmarks[0].targetUrl.endsWith('#p1'),
      'StudyNav did not save the selected paragraph place',
    );
    await page.evaluate(() => window.getSelection()?.removeAllRanges());
    await page.locator('#v1001003 .jsHighlightOnly').click();
    await page.waitForFunction(() => document.getElementById('v1001003')?.classList.contains('studynav-verse-selected'));
    const verseBookmarkResponse = await sendStudyNavPageAction(
      worker,
      page.url(),
      'TOGGLE_STUDY_BOOKMARK',
    );
    await captureScreenshot(page, '11-verse-audio.png');
    await waitForWorkerState(
      worker,
      async () => (await chrome.storage.local.get('studynavStudyDataV2')).studynavStudyDataV2,
      (data) => data?.bookmarks?.some((bookmark) => bookmark.targetUrl.endsWith('#v1001003')),
      'StudyNav did not save the selected verse place',
    );
    await page.locator('#v1001003 .jsHighlightOnly').click();
    await page.waitForFunction(() =>
      !document.getElementById('v1001003')?.classList.contains('studynav-verse-selected'));
    await page.evaluate(() => window.getSelection()?.removeAllRanges());
    const pageBookmarkResponse = await sendStudyNavPageAction(
      worker,
      page.url(),
      'TOGGLE_STUDY_BOOKMARK',
    );
    const pageBookmarkDataImmediately = await readStudyNavLocalData(worker);
    ensure(pageBookmarkDataImmediately, `StudyNav bookmark storage disappeared: ${json({
      paragraphBookmarkResponse,
      verseBookmarkResponse,
      pageBookmarkResponse,
    })}`);
    await sleep(500);
    const pageBookmarkDataAfterSettle = await readStudyNavLocalData(worker);
    ensure(pageBookmarkDataAfterSettle, `StudyNav bookmark storage disappeared after settle: ${json({
      paragraphBookmarkResponse,
      verseBookmarkResponse,
      pageBookmarkResponse,
      pageBookmarkDataImmediately,
    })}`);
    ensure(
      pageBookmarkDataAfterSettle.bookmarks.length === 3 &&
        pageBookmarkDataAfterSettle.bookmarks.some((bookmark) => !new URL(bookmark.targetUrl).hash),
      `StudyNav did not save page, paragraph, and verse places independently: ${json({
        paragraphBookmarkResponse,
        verseBookmarkResponse,
        pageBookmarkResponse,
        bookmarks: pageBookmarkDataAfterSettle.bookmarks,
      })}`,
    );
    const savedPlacesData = pageBookmarkDataAfterSettle;

    await sendStudyNavPageAction(worker, page.url(), 'OPEN_STUDY_PANEL');
    await page.click('#studynav-study-panel [data-view="bookmarks"]');
    await page.waitForFunction(() => document.getElementById('studynav-note-count')?.textContent === '3 saved places');
    const bookmarkPanelState = await page.evaluate(() => ({
      count: document.getElementById('studynav-note-count')?.textContent || '',
      cards: document.querySelectorAll('.studynav-bookmark-card').length,
      targets: Array.from(document.querySelectorAll('.studynav-bookmark-url')).map((node) => node.textContent || ''),
      tagHidden: document.getElementById('studynav-note-tag')?.hidden ?? false,
      notesPressed: document.querySelector('[data-view="notes"]')?.getAttribute('aria-pressed'),
      bookmarksPressed: document.querySelector('[data-view="bookmarks"]')?.getAttribute('aria-pressed'),
    }));
    await captureScreenshot(page, '10-saved-places.png');
    await page.fill('#studynav-note-search', '#p1');
    await page.waitForFunction(() => document.querySelectorAll('.studynav-bookmark-card').length === 1);
    const bookmarkSearchCount = await page.locator('.studynav-bookmark-card').count();
    const paragraphBookmarkCard = page.locator('.studynav-bookmark-card', {
      has: page.locator('.studynav-bookmark-url', { hasText: '#p1' }),
    });
    await context.route(STUDYNAV_FIXTURE_CANONICAL, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: '<!doctype html><title>Saved place destination</title><p id="p1">Saved place destination</p>',
      });
    });
    const savedPlacePagePromise = context.waitForEvent('page');
    await paragraphBookmarkCard.locator('button', { hasText: 'Open' }).click();
    const savedPlacePage = await savedPlacePagePromise;
    await savedPlacePage.waitForLoadState('domcontentloaded');
    const openedSavedPlaceUrl = savedPlacePage.url();
    await savedPlacePage.close();
    await context.unroute(STUDYNAV_FIXTURE_CANONICAL);
    page.once('dialog', (dialog) => void dialog.accept());
    await paragraphBookmarkCard.locator('button', { hasText: 'Remove' }).click();
    const savedPlacesAfterRemove = await waitForWorkerState(
      worker,
      async () => (await chrome.storage.local.get('studynavStudyDataV2')).studynavStudyDataV2,
      (data) => data?.bookmarks?.length === 2 && !data.bookmarks.some((bookmark) => bookmark.targetUrl.endsWith('#p1')),
      'StudyNav saved-place removal did not persist',
    );
    await page.click('#studynav-study-panel [data-view="notes"]');
    await page.waitForFunction(() => document.getElementById('studynav-note-count')?.textContent === '4 notes');

    await worker.evaluate(async () => {
      const key = 'studynavStudyDataV2';
      const data = (await chrome.storage.local.get(key))[key];
      const source = data.annotations.find((item) => item.color === 'yellow') || data.annotations[0];
      const external = {
        ...source,
        id: 'fixture-external-note',
        pageUrl: 'https://wol.jw.org/en/wol/d/r1/lp-e/999',
        title: 'External WOL note',
        updatedAt: Math.max(Date.now(), source.updatedAt + 1),
      };
      await chrome.storage.local.set({ [key]: { ...data, annotations: [...data.annotations, external] } });
    });
    await page.waitForFunction(() => document.getElementById('studynav-note-count')?.textContent === '4 notes');
    await page.click('#studynav-study-panel [data-scope="all"]');
    await page.waitForFunction(() => document.getElementById('studynav-note-count')?.textContent === '5 notes');
    const externalCard = page.locator('.studynav-note-card', {
      has: page.locator('strong', { hasText: 'External WOL note' }),
    });
    await externalCard.locator('button', { hasText: 'Edit' }).click();
    await page.fill('#studynav-note-text', 'Edited from another page');
    await page.locator('#studynav-note-editor button', { hasText: 'Save locally' }).click();
    const crossPageEditedData = await waitForWorkerState(
      worker,
      async () => (await chrome.storage.local.get('studynavStudyDataV2')).studynavStudyDataV2,
      (data) => data?.annotations?.some((item) =>
        item.id === 'fixture-external-note' && item.note === 'Edited from another page'),
      'StudyNav cross-page note edit did not persist',
    );
    await sendStudyNavPageAction(worker, page.url(), 'OPEN_STUDY_PANEL');
    await page.waitForSelector('#studynav-study-panel');
    await page.waitForFunction(() => document.getElementById('studynav-note-count')?.textContent === '5 notes');
    await page.fill('#studynav-note-search', 'Private family note');
    await page.waitForFunction(() => document.querySelectorAll('.studynav-note-card').length === 1);
    const searchResultCount = await page.locator('.studynav-note-card').count();
    await page.fill('#studynav-note-search', '');
    await page.selectOption('#studynav-note-tag', 'family');
    await page.waitForFunction(() => document.querySelectorAll('.studynav-note-card').length === 1);
    const tagFilterState = await page.evaluate(() => ({
      resultCount: document.querySelectorAll('.studynav-note-card').length,
      options: Array.from(document.querySelectorAll('#studynav-note-tag option')).map((option) => option.value),
    }));
    await page.selectOption('#studynav-note-tag', '');
    await page.click('#studynav-study-panel [data-scope="page"]');
    await page.waitForFunction(() => document.getElementById('studynav-note-count')?.textContent === '4 notes');

    const familyCard = page.locator('.studynav-note-card', {
      has: page.locator('blockquote', { hasText: 'A precise link returns to the same place without searching again.' }),
    });
    await familyCard.locator('button', { hasText: 'Edit' }).click();
    await page.fill('#studynav-note-text', 'Updated local note');
    await page.fill('#studynav-note-tags', 'faith, family, hope');
    await page.locator('#studynav-note-editor button', { hasText: 'Save locally' }).click();
    const editedData = await waitForWorkerState(
      worker,
      async () => (await chrome.storage.local.get('studynavStudyDataV2')).studynavStudyDataV2,
      (data) => data?.annotations?.some((item) => item.note === 'Updated local note' && item.tags.includes('hope')),
      'StudyNav panel edit did not persist',
    );

    await page.setViewportSize({ width: 1600, height: 900 });
    await page.waitForFunction(() => document.getElementById('studynav-note-rail')?.dataset.mode === 'rail');
    page.once('dialog', (dialog) => void dialog.accept());
    const blueCard = page.locator('.studynav-note-rail-item', {
      has: page.locator('strong', { hasText: /^text\.$/ }),
    });
    await blueCard.locator('button', { hasText: 'Delete' }).click();
    const afterDeleteData = await waitForWorkerState(
      worker,
      async () => (await chrome.storage.local.get('studynavStudyDataV2')).studynavStudyDataV2,
      (data) => data?.annotations?.length === 4 && !data.annotations.some((item) => item.selector.exact === 'text.'),
      'StudyNav panel delete did not persist',
    );
    await page.setViewportSize({ width: 1280, height: 720 });

    await sendStudyNavPageAction(worker, page.url(), 'OPEN_STUDY_PANEL');
    await page.waitForSelector('#studynav-study-panel');

    const exportPromise = page.waitForEvent('download');
    await page.locator('#studynav-study-panel button', { hasText: 'Export JSON' }).click();
    const exportDownload = await exportPromise;
    const exportPath = await exportDownload.path();
    const exportedJson = exportPath ? await readFile(exportPath, 'utf8') : '';
    const exportedBackup = JSON.parse(exportedJson);

    await worker.evaluate(async () => {
      const key = 'studynavStudyDataV2';
      const data = (await chrome.storage.local.get(key))[key];
      await chrome.storage.local.set({ [key]: { ...data, annotations: [], bookmarks: [] } });
    });
    await page.waitForFunction(() => document.getElementById('studynav-note-count')?.textContent === '0 notes');
    await page.locator('.studynav-import-label input').setInputFiles({
      name: 'studynav-roundtrip.json',
      mimeType: 'application/json',
      buffer: Buffer.from(exportedJson),
    });
    const roundTripData = await waitForWorkerState(
      worker,
      async () => (await chrome.storage.local.get('studynavStudyDataV2')).studynavStudyDataV2,
      (data) => data?.annotations?.length === 4 && data?.bookmarks?.length === 2,
      'StudyNav JSON round trip did not restore annotations and saved places',
    );
    const roundTripToast = await page.evaluate(() => document.getElementById('studynav-toast')?.textContent || '');

    const mixedSource = exportedBackup.annotations.find((item) => item.color === 'yellow') || exportedBackup.annotations[0];
    const mixedValid = {
      ...mixedSource,
      id: 'fixture-mixed-valid',
      updatedAt: Math.max(Date.now(), mixedSource.updatedAt + 1),
    };
    const mixedInvalid = { ...mixedValid, id: 'fixture-mixed-invalid', color: 'chartreuse' };
    const mixedJson = JSON.stringify({
      schemaVersion: 1,
      annotations: [mixedValid, mixedInvalid],
      mediaProgress: [],
    });
    await page.locator('.studynav-import-label input').setInputFiles({
      name: 'studynav-mixed.json',
      mimeType: 'application/json',
      buffer: Buffer.from(mixedJson),
    });
    const mixedImportData = await waitForWorkerState(
      worker,
      async () => (await chrome.storage.local.get('studynavStudyDataV2')).studynavStudyDataV2,
      (data) => data?.annotations?.some((item) => item.id === 'fixture-mixed-valid') &&
        !data.annotations.some((item) => item.id === 'fixture-mixed-invalid'),
      'StudyNav mixed import did not accept and reject records independently',
    );
    await page.waitForFunction(() => /1 added, 0 updated, 0 ignored, 1 rejected/.test(
      document.getElementById('studynav-toast')?.textContent || ''));
    const mixedImportToast = await page.evaluate(() => document.getElementById('studynav-toast')?.textContent || '');
    const countBeforeInvalidImport = mixedImportData.annotations.length;
    await page.locator('.studynav-import-label input').setInputFiles({
      name: 'invalid.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{'),
    });
    await page.waitForFunction(() => /not a valid StudyNav backup/i.test(
      document.getElementById('studynav-toast')?.textContent || ''));
    const invalidImportData = await readStudyNavLocalData(worker);
    await page.locator('.studynav-import-label input').setInputFiles({
      name: 'oversize.json',
      mimeType: 'application/json',
      buffer: Buffer.alloc(5 * 1024 * 1024 + 1, 120),
    });
    await page.waitForFunction(() => /larger than 5 MB/i.test(
      document.getElementById('studynav-toast')?.textContent || ''));
    const oversizeImportData = await readStudyNavLocalData(worker);

    const beforeAutoRecovery = await readStudyNavLocalData(worker);
    const p1RecoveryIds = beforeAutoRecovery.annotations
      .filter((item) => item.pageUrl.includes(STUDYNAV_FIXTURE_PATH) && item.root.id === 'p1')
      .map((item) => item.id);
    await page.evaluate(() => { document.getElementById('p1').id = 'p9'; });
    const autoRecoveredData = await waitForWorkerState(
      worker,
      async () => (await chrome.storage.local.get('studynavStudyDataV2')).studynavStudyDataV2,
      (data) => p1RecoveryIds.length > 0 && p1RecoveryIds.every((id) =>
        data?.annotations?.find((item) => item.id === id)?.root?.id === 'p9'),
      'StudyNav exact cross-root recovery did not update stable root identity',
    );

    const manualRecordBefore = autoRecoveredData.annotations.find((item) => item.note === 'Updated local note');
    ensure(manualRecordBefore, 'Missing fixture note before manual recovery');
    await page.evaluate(() => {
      const root = document.getElementById('p2');
      const text = Array.from(root?.childNodes || []).find((node) => node.nodeType === Node.TEXT_NODE);
      if (text) text.nodeValue = 'Replacement paragraph for manual recovery.';
    });
    await page.waitForFunction(() => {
      const card = Array.from(document.querySelectorAll('.studynav-note-card'))
        .find((item) => item.textContent?.includes('Updated local note'));
      return card?.textContent?.includes('Needs attention');
    });
    const orphanCard = page.locator('.studynav-note-card', { hasText: 'Updated local note' });
    await orphanCard.locator('button', { hasText: 'Reattach' }).click();
    await page.evaluate(() => {
      const next = 'https://www.jw.org/en/library/books/other-study-page/';
      document.querySelector('link[rel="canonical"]')?.setAttribute('href', next);
      history.pushState({}, '', '/en/library/books/other-study-page/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.waitForFunction(() => document.documentElement.dataset.studynav === '1');
    await selectFixtureText(page, '#p2', 'Replacement paragraph');
    await page.locator('#studynav-selection-tools button', { hasText: 'Reattach here' }).click();
    await page.waitForFunction(() => /source page before reattaching/i.test(
      document.getElementById('studynav-toast')?.textContent || ''));
    const crossPageReattachData = await readStudyNavLocalData(worker);
    await page.evaluate(({canonical, pathname}) => {
      document.querySelector('link[rel="canonical"]')?.setAttribute('href', canonical);
      history.pushState({}, '', pathname);
      window.dispatchEvent(new PopStateEvent('popstate'));
      window.getSelection()?.removeAllRanges();
      document.dispatchEvent(new Event('selectionchange'));
    }, {canonical: STUDYNAV_FIXTURE_CANONICAL, pathname: STUDYNAV_FIXTURE_PATH});
    await page.waitForFunction(() => document.documentElement.dataset.studynav === '1');
    await sendStudyNavPageAction(worker, page.url(), 'OPEN_STUDY_PANEL');
    await page.waitForFunction(() => Array.from(document.querySelectorAll('.studynav-note-card'))
      .some((item) => item.textContent?.includes('Updated local note') && item.textContent?.includes('Needs attention')));
    const restoredOrphanCard = page.locator('.studynav-note-card', { hasText: 'Updated local note' });
    await restoredOrphanCard.locator('button', { hasText: 'Reattach' }).click();
    await selectFixtureText(page, '#p2', 'Replacement paragraph');
    await page.locator('#studynav-selection-tools button', { hasText: 'Reattach here' }).click();
    const manualRecoveredData = await waitForWorkerState(
      worker,
      async () => (await chrome.storage.local.get('studynavStudyDataV2')).studynavStudyDataV2,
      (data) => data?.annotations?.find((item) => item.id === manualRecordBefore.id)?.selector?.exact === 'Replacement paragraph',
      'StudyNav manual reattach did not persist the replacement selector',
    );
    const manualRecordAfter = manualRecoveredData.annotations.find((item) => item.id === manualRecordBefore.id);

    await installCopyCapture(page);
    await selectFixtureText(page, '#p2', 'Replacement paragraph');
    const selectionCitationResponse = await sendStudyNavPageAction(worker, page.url(), 'COPY_STUDY_CITATION');
    const selectionCitation = selectionCitationResponse?.copiedText || '';
    await page.evaluate(() => {
      window.getSelection()?.removeAllRanges();
      document.dispatchEvent(new Event('selectionchange'));
    });
    const pageCitationResponse = await sendStudyNavPageAction(worker, page.url(), 'COPY_STUDY_CITATION');
    const pageCitation = pageCitationResponse?.copiedText || '';
    await page.click('#v1001003 .jsHighlightOnly');
    const verseCitationResponse = await sendStudyNavPageAction(worker, page.url(), 'COPY_STUDY_CITATION');
    const verseCitation = verseCitationResponse?.copiedText || '';
    await selectFixtureText(page, '#v1001003', 'A small lamp marked the next step.');
    await page.locator('.studynav-color-button[data-color="pink"]').click();
    const verseAnnotationData = await waitForWorkerState(
      worker,
      async () => (await chrome.storage.local.get('studynavStudyDataV2')).studynavStudyDataV2,
      (data) => data?.annotations?.some((item) =>
        item.root.id === 'v1001003' && item.selector.exact === 'A small lamp marked the next step.' && item.color === 'pink'),
      'StudyNav did not persist a verse-level highlight',
    );
    await page.evaluate(() => {
      history.pushState({}, '', '/en/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.waitForFunction(() =>
      document.documentElement.dataset.studynav === 'unsupported' &&
      ['yellow', 'green', 'blue', 'pink'].every((color) =>
        (CSS.highlights?.get(`studynav-${color}`)?.size || 0) === 0));
    await page.evaluate((fixturePath) => {
      history.pushState({}, '', fixturePath);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, STUDYNAV_FIXTURE_PATH);
    await page.waitForFunction(() =>
      document.documentElement.dataset.studynav === '1' &&
      (CSS.highlights?.get('studynav-pink')?.size || 0) >= 1);
    const annotationSpaState = await page.evaluate(() => ({
      dataset: document.documentElement.dataset.studynav,
      pinkRanges: CSS.highlights?.get('studynav-pink')?.size || 0,
      verseTools: document.querySelectorAll('#v1001003 .studynav-para-tools').length,
    }));
    await page.click('#v1001003 .jsHighlightOnly');
    await page.waitForFunction(() => document.getElementById('v1001003')?.classList.contains('studynav-verse-selected'));

    await page.evaluate(() => {
      const focusTarget = document.getElementById('p2');
      focusTarget?.setAttribute('tabindex', '-1');
      focusTarget?.focus();
    });
    const qrResponse = await sendStudyNavPageAction(worker, page.url(), 'SHOW_STUDY_QR');
    await page.waitForSelector('#studynav-qr-overlay');
    const qrState = await page.evaluate(() => {
      const overlay = document.getElementById('studynav-qr-overlay');
      const rect = overlay?.querySelector('.studynav-overlay-panel')?.getBoundingClientRect();
      return {
        svg: !!overlay?.querySelector('.studynav-qr-image svg path'),
        url: overlay?.querySelector('.studynav-target-url')?.textContent || '',
        closeFocused: document.activeElement?.getAttribute('aria-label') === 'Close QR',
        panelInViewport: !!rect && rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight,
      };
    });
    await captureScreenshot(page, '05-qr-overlay.png');
    await page.locator('#studynav-qr-overlay button', { hasText: 'Copy link' }).click();
    await page.waitForFunction(() => document.getElementById('studynav-toast')?.textContent === 'Link copied');
    const qrCopyToast = await page.evaluate(() => document.getElementById('studynav-toast')?.textContent || '');
    await page.keyboard.press('x');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('studynav-qr-overlay'));
    const qrRestoredFocus = await page.evaluate(() => document.activeElement?.id || null);

    await context.route('https://www.jw.org/finder?**', (route) => route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>Official Finder fixture</title><p>Official Finder fixture</p>',
    }));
    const officialPagePromise = context.waitForEvent('page');
    const officialResponse = await sendStudyNavPageAction(worker, page.url(), 'OPEN_OFFICIAL_JW_LINK');
    const officialPage = await officialPagePromise;
    await officialPage.waitForLoadState('domcontentloaded');
    const officialUrl = officialPage.url();
    const openerIsNull = await officialPage.evaluate(() => window.opener === null);
    await officialPage.close();

    const unavailablePage = await openPage(
      context,
      scenario,
      'study-suite-unavailable-official',
      httpsUrl(HOSTS.jw, '/en/library/test'),
    );
    await unavailablePage.waitForFunction(() => document.documentElement.dataset.studynav === '1');
    await unavailablePage.evaluate(() => {
      document.querySelector('.jsGlobalShareData')?.remove();
      document.body.className = '';
      const article = document.getElementById('article');
      article.className = 'jwac';
      for (const name of ['data-bible-pub', 'data-booknum', 'data-chapter', 'data-docid', 'data-wtlocale']) {
        article.removeAttribute(name);
      }
    });
    const unavailableOfficialResponse = await sendStudyNavPageAction(
      worker,
      unavailablePage.url(),
      'OPEN_OFFICIAL_JW_LINK',
    );
    await unavailablePage.evaluate(() => {
      document.body.className = 'PublicationArticle docId-1102021201 ml-U';
      const article = document.getElementById('article');
      article.className = 'jwac docId-1102021201 ml-U';
    });
    const russianArticlePagePromise = context.waitForEvent('page');
    const russianArticleOfficialResponse = await sendStudyNavPageAction(
      worker,
      unavailablePage.url(),
      'OPEN_OFFICIAL_JW_LINK',
    );
    const russianArticlePage = await russianArticlePagePromise;
    await russianArticlePage.waitForLoadState('domcontentloaded');
    const russianArticleOfficialUrl = russianArticlePage.url();
    await russianArticlePage.close();
    await unavailablePage.evaluate(() => {
      document.body.className = 'PublicationArticle docId-1102021201 ml-K';
      const article = document.getElementById('article');
      article.className = 'jwac docId-1102021201 ml-K';
    });
    const ukrainianArticlePagePromise = context.waitForEvent('page');
    const ukrainianArticleOfficialResponse = await sendStudyNavPageAction(
      worker,
      unavailablePage.url(),
      'OPEN_OFFICIAL_JW_LINK',
    );
    const ukrainianArticlePage = await ukrainianArticlePagePromise;
    await ukrainianArticlePage.waitForLoadState('domcontentloaded');
    const ukrainianArticleOfficialUrl = ukrainianArticlePage.url();
    await ukrainianArticlePage.close();
    await unavailablePage.evaluate(() => document.querySelector('link[rel="canonical"]')?.remove());
    const canonicalFallbackQrResponse = await sendStudyNavPageAction(
      worker,
      unavailablePage.url(),
      'SHOW_STUDY_QR',
    );
    await unavailablePage.close();

    const popup = await openPage(
      context,
      scenario,
      'study-suite-popup',
      extensionPageUrl(workerInfoFor(workers, 'StudyNav').id, 'popup.html'),
    );
    await activateTabByUrl(worker, page.url());
    await popup.reload({ waitUntil: 'load' });
    await popup.waitForFunction(() =>
      document.querySelectorAll('.row').length === 23 &&
      document.getElementById('status-title')?.textContent === 'Ready on this Bible chapter' &&
      document.getElementById('save-place')?.textContent?.trim() === 'Remove saved place');
    const studyPopupState = await getPopupState(popup);
    await popup.setViewportSize({ width: 380, height: 760 });
    await captureScreenshot(popup, '06-popup.png', { fullPage: true });
    await popup.click('#open-notes');
    await page.waitForSelector('#studynav-study-panel');
    const popupPanelOpened = await page.evaluate(() => !!document.getElementById('studynav-study-panel'));
    await page.locator('#studynav-study-panel button', { hasText: 'Close' }).click();

    await popup.evaluate(() => {
      for (const id of ['annotations', 'citations']) {
        const input = document.querySelector(`[data-id="${id}"]`);
        input.checked = false;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    const rapidOffFlags = await waitForWorkerState(
      worker,
      async () => (await chrome.storage.sync.get('flags')).flags,
      (flags) => flags?.annotations === false && flags?.citations === false,
      'StudyNav concurrent popup-off mutations lost an update',
    );
    await popup.evaluate(() => {
      for (const id of ['annotations', 'citations']) {
        const input = document.querySelector(`[data-id="${id}"]`);
        input.checked = true;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    const rapidRestoredFlags = await waitForWorkerState(
      worker,
      async () => (await chrome.storage.sync.get('flags')).flags,
      (flags) => flags?.annotations === true && flags?.citations === true,
      'StudyNav concurrent popup-on mutations lost an update',
    );

    const preMediaData = await readStudyNavLocalData(worker);
    ensure(preMediaData?.schemaVersion === 2, `StudyNav local envelope disappeared before media test: ${json(preMediaData)}`);
    const preMediaStatus = await sendStudyNavPageAction(worker, page.url(), 'GET_STUDYNAV_STATUS');
    ensure(
      preMediaStatus?.continueWatching?.enabled === true && preMediaStatus.continueWatching.trackedVideoCount === 1,
      `StudyNav continue-watching runtime was not active: ${json(preMediaStatus)}`,
    );
    await page.evaluate(() => {
      const recorderVideo = document.createElement('video');
      recorderVideo.id = 'studynav-owned-recorder-probe';
      recorderVideo.setAttribute('data-studynav-owned', '1');
      document.documentElement.appendChild(recorderVideo);
    });
    await page.waitForTimeout(250);
    const ownedMediaStatus = await sendStudyNavPageAction(worker, page.url(), 'GET_STUDYNAV_STATUS');
    await page.evaluate(() => document.getElementById('studynav-owned-recorder-probe')?.remove());
    ensure(
      ownedMediaStatus?.continueWatching?.trackedVideoCount === 1 &&
        ownedMediaStatus.continueWatching.listenerCount === 1,
      `StudyNav tracked its own recorder video: ${json(ownedMediaStatus)}`,
    );
    await page.reload({ waitUntil: 'load' });
    await waitFor(async () => {
      const status = await sendStudyNavPageAction(worker, page.url(), 'GET_STUDYNAV_STATUS');
      return status?.continueWatching?.enabled === true && status.continueWatching.trackedVideoCount === 1;
    }, 5_000, 'StudyNav media runtime did not recover after recorder isolation probe');

    await page.waitForTimeout(1_000);
    const mediaMetadataState = await page.evaluate(() => {
      const video = document.getElementById('jw-video');
      return {
        currentSrc: video?.currentSrc,
        duration: video?.duration,
        readyState: video?.readyState,
        networkState: video?.networkState,
        error: video?.error ? { code: video.error.code, message: video.error.message } : null,
      };
    });
    ensure(
      Math.round(mediaMetadataState.duration || 0) === 20,
      `StudyNav media fixture metadata did not load: ${json(mediaMetadataState)}`,
    );
    await page.evaluate(() => {
      const video = document.getElementById('jw-video');
      video.currentTime = 6;
      video.dispatchEvent(new Event('pause'));
    });
    const overriddenMediaStatus = await sendStudyNavPageAction(worker, page.url(), 'GET_STUDYNAV_STATUS');
    ensure(
      overriddenMediaStatus?.continueWatching?.activeRecordValid === true &&
        overriddenMediaStatus.continueWatching.listenerCount === 1,
      `StudyNav media fixture was not valid or listening: ${json(overriddenMediaStatus)}`,
    );
    const initialPausedProgress = await waitForWorkerState(
      worker,
      async () => (await chrome.storage.local.get('studynavStudyDataV2')).studynavStudyDataV2,
      (data) => data?.mediaProgress?.length === 1 && Math.abs(data.mediaProgress[0].currentTime - 6) < 0.1,
      'StudyNav initial pause progress did not persist',
    );
    await setStudyNavFlags(worker, { ...DEFAULT_STUDYNAV_FLAGS, continueWatching: false });
    await page.waitForFunction(() => !document.getElementById('studynav-resume-media'));
    const progressWhileDisabled = await readStudyNavLocalData(worker);
    await setStudyNavFlags(worker, DEFAULT_STUDYNAV_FLAGS);
    await waitFor(async () => {
      const status = await sendStudyNavPageAction(worker, page.url(), 'GET_STUDYNAV_STATUS');
      return status?.continueWatching?.enabled === true && status.continueWatching.trackedVideoCount === 1;
    }, 5000, 'StudyNav continue watching did not reattach after flag restore');
    await page.evaluate(() => {
      const video = document.getElementById('jw-video');
      video.currentTime = 7;
      video.dispatchEvent(new Event('timeupdate'));
    });
    const firstTimedProgress = await waitForWorkerState(
      worker,
      async () => (await chrome.storage.local.get('studynavStudyDataV2')).studynavStudyDataV2,
      (data) => Math.abs((data?.mediaProgress?.[0]?.currentTime || 0) - 7) < 0.1,
      'StudyNav timed media progress did not persist after listener reset',
    );
    await page.evaluate(() => {
      const video = document.getElementById('jw-video');
      video.currentTime = 8;
      video.dispatchEvent(new Event('timeupdate'));
    });
    await page.waitForTimeout(250);
    const throttledProgress = await readStudyNavLocalData(worker);
    await page.evaluate(() => {
      const video = document.getElementById('jw-video');
      video.currentTime = 9;
      video.dispatchEvent(new Event('pause'));
    });
    const pausedProgress = await waitForWorkerState(
      worker,
      async () => (await chrome.storage.local.get('studynavStudyDataV2')).studynavStudyDataV2,
      (data) => Math.abs((data?.mediaProgress?.[0]?.currentTime || 0) - 9) < 0.1,
      'StudyNav pause did not save immediately',
    );
    await page.evaluate(() => {
      document.getElementById('jw-video').currentTime = 10;
      window.dispatchEvent(new Event('pagehide'));
    });
    const hiddenProgress = await waitForWorkerState(
      worker,
      async () => (await chrome.storage.local.get('studynavStudyDataV2')).studynavStudyDataV2,
      (data) => Math.abs((data?.mediaProgress?.[0]?.currentTime || 0) - 10) < 0.1,
      'StudyNav pagehide did not save immediately',
    );
    await page.evaluate(() => {
      const video = document.getElementById('jw-video');
      video.currentTime = 17;
      video.dispatchEvent(new Event('pause'));
    });
    await waitForWorkerState(
      worker,
      async () => (await chrome.storage.local.get('studynavStudyDataV2')).studynavStudyDataV2,
      (data) => data?.mediaProgress?.length === 0,
      'StudyNav did not remove near-end progress',
    );
    await page.evaluate(() => {
      const video = document.getElementById('jw-video');
      video.currentTime = video.duration;
      video.dispatchEvent(new Event('ended'));
    });
    const endedProgress = await readStudyNavLocalData(worker);
    await page.evaluate(() => {
      const video = document.getElementById('jw-video');
      video.currentTime = 11;
      video.dispatchEvent(new Event('pause'));
    });
    await waitForWorkerState(
      worker,
      async () => (await chrome.storage.local.get('studynavStudyDataV2')).studynavStudyDataV2,
      (data) => Math.abs((data?.mediaProgress?.[0]?.currentTime || 0) - 11) < 0.1,
      'StudyNav did not retain valid progress for reload',
    );

    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => document.getElementById('studynav-resume-media')?.textContent === 'Resume at 0:11');
    await openStudyNavMediaMenu(page);
    await captureScreenshot(page, '07-resume-control.png');
    await page.click('#studynav-resume-media');
    const resumeState = await page.evaluate(() => {
      const video = document.getElementById('jw-video');
      return {
        currentTime: video.currentTime,
        duration: video.duration,
        paused: video.paused,
        ended: video.ended,
        menuOpen: document.querySelector('#studynav-media-bar details')?.hasAttribute('open') ?? null,
      };
    });

    await activateTabByUrl(worker, page.url());
    await page.evaluate(() => {
      const video = document.getElementById('jw-video');
      video.currentTime = 10;
      video.muted = false;
    });
    await page.locator('#jw-video').focus();
    await page.keyboard.press('j');
    const afterJ = await page.locator('#jw-video').evaluate((video) => video.currentTime);
    await page.keyboard.press('l');
    const afterL = await page.locator('#jw-video').evaluate((video) => video.currentTime);
    await page.keyboard.press('m');
    const afterM = await page.locator('#jw-video').evaluate((video) => video.muted);
    await page.keyboard.press('k');
    await page.waitForFunction(() => document.getElementById('jw-video')?.paused === false);
    const afterKPlay = await page.locator('#jw-video').evaluate((video) => video.paused);
    await page.keyboard.press('k');
    await page.waitForFunction(() => document.getElementById('jw-video')?.paused === true);
    const afterKPause = await page.locator('#jw-video').evaluate((video) => video.paused);
    await page.keyboard.press(' ');
    await page.waitForFunction(() => document.getElementById('jw-video')?.paused === false);
    const afterSpacePlay = await page.locator('#jw-video').evaluate((video) => video.paused);
    await page.keyboard.press(' ');
    await page.waitForFunction(() => document.getElementById('jw-video')?.paused === true);
    const afterSpacePause = await page.locator('#jw-video').evaluate((video) => video.paused);
    await page.keyboard.press('f');
    await page.waitForFunction(() => document.fullscreenElement?.id === 'jw-video');
    const fullscreenEntered = await page.evaluate(() => document.fullscreenElement?.id || null);
    await page.keyboard.press('f');
    await page.waitForFunction(() => document.fullscreenElement == null);
    await page.evaluate(() => { document.getElementById('jw-video').muted = false; });
    await page.locator('#otherAvailLangsChooser.jsAutoCompleteInput').focus();
    await page.keyboard.press('m');
    const editableGuardMuted = await page.locator('#jw-video').evaluate((video) => video.muted);
    const mediaControlMatrix = {
      afterJ,
      afterL,
      afterM,
      afterKPlay,
      afterKPause,
      afterSpacePlay,
      afterSpacePause,
      fullscreenEntered,
      editableGuardMuted,
    };

    const flagIds = Object.keys(DEFAULT_STUDYNAV_FLAGS).filter((flag) => flag !== 'masterEnabled');
    const flagResults = [];
    for (const flag of flagIds) {
      const enabledFlags = { ...DEFAULT_STUDYNAV_FLAGS, [flag]: true };
      await setStudyNavFlags(worker, enabledFlags);
      await waitForStudyNavFlagSurface(page, flag, true);

      let enabledAction = null;
      if (flag === 'citations') {
        enabledAction = await sendStudyNavPageAction(worker, page.url(), 'COPY_STUDY_CITATION');
      } else if (flag === 'bookmarks') {
        enabledAction = await sendStudyNavPageAction(worker, page.url(), 'GET_STUDYNAV_STATUS');
      } else if (flag === 'qrShare') {
        enabledAction = await sendStudyNavPageAction(worker, page.url(), 'SHOW_STUDY_QR');
        await page.waitForFunction(() => !!document.getElementById('studynav-qr-overlay'));
      } else if (flag === 'officialOpen') {
        enabledAction = officialResponse;
      } else if (flag === 'transcCreate') {
        await openStudyNavMediaMenu(page);
        await page.locator('#studynav-media-bar button', { hasText: 'Transcript' }).click();
        await page.waitForFunction(() => !!document.getElementById('studynav-transcript'));
      } else if (flag === 'mediaCtrl') {
        await page.evaluate(() => { document.getElementById('jw-video').muted = false; });
        await page.locator('#jw-video').focus();
        await page.keyboard.press('m');
        enabledAction = { toggled: await page.locator('#jw-video').evaluate((video) => video.muted) };
      }
      if (flag === 'continueWatching') {
        await page.waitForFunction(() => !!document.getElementById('studynav-resume-media'));
      }
      const enabledState = await getStudyNavState(page);
      const localBeforeOff = await readStudyNavLocalData(worker);

      await setStudyNavFlags(worker, { ...DEFAULT_STUDYNAV_FLAGS, [flag]: false });
      await waitForStudyNavFlagSurface(page, flag, false);
      let offAction = null;
      if (flag === 'citations') {
        offAction = await sendStudyNavPageAction(worker, page.url(), 'COPY_STUDY_CITATION');
      } else if (flag === 'qrShare') {
        offAction = await sendStudyNavPageAction(worker, page.url(), 'SHOW_STUDY_QR');
      } else if (flag === 'officialOpen') {
        offAction = await sendStudyNavPageAction(worker, page.url(), 'OPEN_OFFICIAL_JW_LINK');
      } else if (flag === 'annotations') {
        offAction = await sendStudyNavPageAction(worker, page.url(), 'OPEN_STUDY_PANEL');
      } else if (flag === 'bookmarks') {
        offAction = await sendStudyNavPageAction(worker, page.url(), 'TOGGLE_STUDY_BOOKMARK');
      } else if (flag === 'mediaCtrl') {
        await page.evaluate(() => { document.getElementById('jw-video').muted = false; });
        await page.locator('#jw-video').focus();
        await page.keyboard.press('m');
        offAction = { toggled: await page.locator('#jw-video').evaluate((video) => video.muted) };
      }
      const offState = await getStudyNavState(page);
      const localAfterOff = await readStudyNavLocalData(worker);
      const storedOffFlags = await worker.evaluate(async () => (await chrome.storage.sync.get('flags')).flags);

      await setStudyNavFlags(worker, DEFAULT_STUDYNAV_FLAGS);
      await waitForStudyNavFlagSurface(page, flag, DEFAULT_STUDYNAV_FLAGS[flag]);
      if (DEFAULT_STUDYNAV_FLAGS.continueWatching && flag === 'continueWatching') {
        await page.waitForFunction(() => !!document.getElementById('studynav-resume-media'));
      }
      const restoredState = await getStudyNavState(page);
      const restoredFlags = await worker.evaluate(async () => (await chrome.storage.sync.get('flags')).flags);

      const specialEnabled = flag === 'citations' || flag === 'qrShare' || flag === 'officialOpen'
        ? enabledAction?.ok === true
        : flag === 'bookmarks'
          ? enabledAction?.bookmarkAvailable === true
        : flag === 'mediaCtrl'
          ? enabledAction?.toggled === true
          : null;
      const staticEnabled = studyNavFlagSurfaceEnabled(flag, enabledState);
      const enabledPass = staticEnabled == null ? specialEnabled === true : staticEnabled;
      const specialDisabled = flag === 'citations'
        ? offAction?.ok === false && offAction?.message === 'Citations are off'
        : flag === 'qrShare'
          ? offAction?.ok === false && offAction?.message === 'QR sharing is off'
          : flag === 'officialOpen'
            ? offAction?.ok === false && offAction?.message === 'Publication links are off'
            : flag === 'annotations'
              ? offAction?.ok === true
              : flag === 'bookmarks'
                ? offAction?.ok === false && offAction?.message === 'Saved places are off'
              : flag === 'mediaCtrl'
                ? offAction?.toggled === false
                : null;
      const staticDisabled = studyNavFlagSurfaceDisabled(flag, offState);
      const disabledPass = staticDisabled == null ? specialDisabled === true :
        staticDisabled && (specialDisabled == null || specialDisabled === true);
      const retainedPass = flag === 'annotations'
        ? localAfterOff.annotations.length === localBeforeOff.annotations.length
        : flag === 'bookmarks'
          ? localAfterOff.bookmarks.length === localBeforeOff.bookmarks.length
        : flag === 'continueWatching'
          ? localAfterOff.mediaProgress.length === localBeforeOff.mediaProgress.length
          : true;
      const restoredSurface = DEFAULT_STUDYNAV_FLAGS[flag]
        ? studyNavFlagSurfaceEnabled(flag, restoredState)
        : studyNavFlagSurfaceDisabled(flag, restoredState);
      const specialRestoreOnly = ['bookmarks', 'citations', 'qrShare', 'officialOpen', 'mediaCtrl'].includes(flag);
      const restoredPass = restoredFlags[flag] === DEFAULT_STUDYNAV_FLAGS[flag] &&
        (specialRestoreOnly || restoredSurface === true);
      flagResults.push({
        flag,
        pass: enabledPass && disabledPass && retainedPass && restoredPass && storedOffFlags[flag] === false,
        enabledPass,
        disabledPass,
        retainedPass,
        restoredPass,
        enabledAction,
        offAction,
        enabledState,
        offState,
        restoredState,
      });
      if (await page.locator('#studynav-study-panel').count()) {
        await page.evaluate(() => {
          const close = document.querySelector('#studynav-study-panel .studynav-icon-button');
          if (close instanceof HTMLButtonElement) close.click();
        });
        await page.waitForFunction(() => !document.getElementById('studynav-study-panel'));
      }
    }

    const allFeaturesOn = Object.fromEntries(
      Object.keys(DEFAULT_STUDYNAV_FLAGS).map((flag) => [flag, true]),
    );
    await setStudyNavFlags(worker, allFeaturesOn);
    await page.waitForFunction(() =>
      !!document.getElementById('studynav-resume-media') &&
      document.querySelectorAll('.studynav-imgdl').length === 1 &&
      getComputedStyle(document.getElementById('regionHeader')).position === 'sticky' &&
      getComputedStyle(document.querySelector('#article-table td')).borderTopStyle === 'solid');
    const allOnState = await getStudyNavState(page);
    await captureScreenshot(page, '15-layout-options.png');
    await setStudyNavFlags(worker, DEFAULT_STUDYNAV_FLAGS);
    await page.waitForTimeout(300);

    await sendStudyNavPageAction(worker, page.url(), 'OPEN_STUDY_PANEL');
    await sendStudyNavPageAction(worker, page.url(), 'SHOW_STUDY_QR');
    const localBeforeMasterOff = await readStudyNavLocalData(worker);
    await setStudyNavFlags(worker, { ...DEFAULT_STUDYNAV_FLAGS, masterEnabled: false });
    await page.waitForFunction(() => document.documentElement.dataset.studynav === 'off');
    const masterOffState = await getStudyNavState(page);
    const localAfterMasterOff = await readStudyNavLocalData(worker);
    await setStudyNavFlags(worker, DEFAULT_STUDYNAV_FLAGS);
    await page.waitForFunction(() =>
      document.documentElement.dataset.studynav === '1' &&
      document.querySelectorAll('[data-sn-tools="1"]').length >= 5);
    const masterRestoredState = await getStudyNavState(page);

    const wolPage = await openPage(
      context,
      scenario,
      'study-suite-wol',
      httpsUrl(HOSTS.wol, '/en/wol/d/r1/lp-e/999'),
    );
    await wolPage.waitForFunction(() =>
      document.documentElement.dataset.studynav === '1' &&
      document.querySelectorAll('[data-sn-tools="1"]').length === 2 &&
      document.querySelectorAll('.studynav-para-tools').length === 0);
    const wolMediaState = await wolPage.evaluate(() => {
      const bar = document.getElementById('studynav-media-bar');
      const summary = bar?.querySelector('summary');
      const icon = summary?.querySelector('svg');
      const heading = document.querySelector('#wol-article h1');
      const barRect = bar?.getBoundingClientRect();
      const headingRect = heading?.getBoundingClientRect();
      const overlaps = !!barRect && !!headingRect &&
        barRect.left < headingRect.right && barRect.right > headingRect.left &&
        barRect.top < headingRect.bottom && barRect.bottom > headingRect.top;
      return {
        parentId: bar?.parentElement?.id || null,
        placement: bar?.dataset.placement || null,
        kind: bar?.dataset.kind || null,
        position: bar ? getComputedStyle(bar).position : null,
        summary: summary?.textContent?.replace(/\s+/g, ' ').trim() || '',
        title: summary?.getAttribute('title') || '',
        summaryColor: summary ? getComputedStyle(summary).color : null,
        iconStroke: icon ? getComputedStyle(icon).stroke : null,
        buttons: Array.from(bar?.querySelectorAll('button') || []).map((button) => button.textContent?.trim() || ''),
        insideHeader: !!bar?.closest('#regionHeader'),
        overlapsHeading: overlaps,
      };
    });
    const wolLayout = async () => wolPage.evaluate(() => {
      const rect = (selector) => {
        const value = document.querySelector(selector)?.getBoundingClientRect();
        return value ? { x: value.x, y: value.y, width: value.width, height: value.height } : null;
      };
      const table = document.getElementById('wol-table');
      const cell = table?.querySelector('td');
      const header = document.getElementById('regionHeader');
      return {
        header: rect('#regionHeader'),
        shell: rect('#wol-shell'),
        nav: rect('#wol-nav'),
        articleOuter: rect('#article'),
        article: rect('#wol-article'),
        table: rect('#wol-table'),
        headerPosition: header ? getComputedStyle(header).position : null,
        cellBorderBottom: cell ? getComputedStyle(cell).borderBottomStyle : null,
        cellPaddingTop: cell ? getComputedStyle(cell).paddingTop : null,
        tableCollapse: table ? getComputedStyle(table).borderCollapse : null,
        tableSpacing: table ? getComputedStyle(table).borderSpacing : null,
        articleMaxWidth: getComputedStyle(document.getElementById('article')).maxWidth,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      };
    });
    const wolBefore = await wolLayout();
    await setStudyNavFlags(worker, {
      ...DEFAULT_STUDYNAV_FLAGS,
      actionBar: true,
      expandWidth: true,
      cstblView: true,
    });
    await wolPage.waitForTimeout(250);
    const wolAfter = await wolLayout();
    await captureScreenshot(wolPage, '08-wol-layout-flags-on.png');

    await setStudyNavFlags(worker, DEFAULT_STUDYNAV_FLAGS);
    await wolPage.setViewportSize({ width: 360, height: 720 });
    await wolPage.waitForTimeout(150);
    const narrowBase = await wolPage.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    await sendStudyNavPageAction(worker, wolPage.url(), 'OPEN_STUDY_PANEL');
    await wolPage.waitForSelector('#studynav-study-panel');
    const narrowPanel = await wolPage.evaluate(() => {
      const rect = document.getElementById('studynav-study-panel')?.getBoundingClientRect();
      const close = document.querySelector('#studynav-study-panel button');
      return {
        rect: rect ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom } : null,
        closeHeight: close?.getBoundingClientRect().height || 0,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      };
    });
    await wolPage.locator('#studynav-study-panel button', { hasText: 'Close' }).click();

    await selectFixtureText(wolPage, '#p2', 'Reference paragraph two');
    await wolPage.waitForSelector('#studynav-selection-tools');
    const narrowToolbar = await wolPage.evaluate(() => {
      const rect = document.getElementById('studynav-selection-tools')?.getBoundingClientRect();
      return rect ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom } : null;
    });
    await wolPage.locator('#studynav-selection-tools button', { hasText: 'Add note' }).click();
    await wolPage.waitForSelector('#studynav-note-editor');
    await captureScreenshot(wolPage, '09-mobile-note-editor.png');
    const narrowEditor = await wolPage.evaluate(() => {
      const rail = document.getElementById('studynav-note-rail');
      const rect = rail?.getBoundingClientRect();
      const formRect = document.getElementById('studynav-note-editor')?.getBoundingClientRect();
      const buttons = Array.from(document.querySelectorAll('#studynav-note-editor button'));
      return {
        rect: rect ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom } : null,
        formRect: formRect ? { left: formRect.left, right: formRect.right } : null,
        mode: rail?.dataset.mode || null,
        insideRail: !!document.querySelector('#studynav-note-rail #studynav-note-editor'),
        minButtonHeight: Math.min(...buttons.map((button) => button.getBoundingClientRect().height)),
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      };
    });
    await wolPage.locator('#studynav-note-editor button', { hasText: 'Cancel' }).click();
    await sendStudyNavPageAction(worker, wolPage.url(), 'SHOW_STUDY_QR');
    await wolPage.waitForSelector('#studynav-qr-overlay');
    const narrowQr = await wolPage.evaluate(() => {
      const rect = document.querySelector('#studynav-qr-overlay .studynav-overlay-panel')?.getBoundingClientRect();
      return {
        rect: rect ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom } : null,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      };
    });
    await wolPage.keyboard.press('Escape');
    await wolPage.close();

    scenario.assertions.push(
      makeAssertion(
        'StudyNav media keyboard controls cover J/L/M/K/Space/F and ignore editable fields',
        afterJ < 0.1 && Math.abs(afterL - 10) < 0.2 && afterM === true &&
          afterKPlay === false && afterKPause === true &&
          afterSpacePlay === false && afterSpacePause === true &&
          fullscreenEntered === 'jw-video' && editableGuardMuted === false,
        mediaControlMatrix,
      ),
      ...flagResults.map((result) => makeAssertion(
        `StudyNav ${result.flag} passes enabled, off, cleanup, retention, and restore behavior`,
        result.pass,
        result,
      )),
      makeAssertion(
        'StudyNav all-feature combination remains scoped and overflow-free',
        allOnState.headerPosition === 'sticky' && allOnState.articleTableBorder === 'solid' &&
          allOnState.articleMaxWidth !== '760px' && allOnState.imageButtons === 1 &&
          allOnState.paragraphButtons.includes('Mark') && allOnState.resumePresent &&
          allOnState.documentScrollWidth <= allOnState.documentClientWidth &&
          allOnState.dialogMarked === false && allOnState.dialogTableBorder !== 'solid',
        allOnState,
      ),
      makeAssertion(
        'StudyNav master off cleans every new surface without deleting local study data and restores safely',
        masterOffState.dataset === 'off' && masterOffState.paraTools === 0 &&
          masterOffState.highlightRangeCount === 0 && !masterOffState.studyPanelOpen &&
          !masterOffState.qrOpen && !masterOffState.resumePresent && !masterOffState.mediaBar &&
          masterOffState.mediaHostCount === 0 &&
          localAfterMasterOff.annotations.length === localBeforeMasterOff.annotations.length &&
          localAfterMasterOff.mediaProgress.length === localBeforeMasterOff.mediaProgress.length &&
          localAfterMasterOff.bookmarks.length === localBeforeMasterOff.bookmarks.length &&
          masterRestoredState.dataset === '1' && masterRestoredState.paragraphButtons.includes('Mark') &&
          masterRestoredState.resumePresent && masterRestoredState.mediaHostCount === 1,
        { masterOffState, localBeforeMasterOff, localAfterMasterOff, masterRestoredState },
      ),
      makeAssertion(
        'StudyNav makes WOL reading and tables visibly wider while leaving its header and navigation in place',
        rectsMatch(wolBefore.header, wolAfter.header) &&
          wolBefore.shell?.x === wolAfter.shell?.x && wolBefore.shell?.width === wolAfter.shell?.width &&
          rectsMatch(wolBefore.nav, wolAfter.nav) &&
          (wolAfter.article?.width || 0) > (wolBefore.article?.width || 0) &&
          (wolAfter.table?.width || 0) > (wolBefore.table?.width || 0) &&
          wolAfter.headerPosition === wolBefore.headerPosition &&
          wolBefore.cellBorderBottom !== 'solid' && wolAfter.cellBorderBottom === 'solid' &&
          parseFloat(wolAfter.cellPaddingTop || '0') > parseFloat(wolBefore.cellPaddingTop || '0') &&
          wolAfter.tableCollapse === 'separate' && /^0px(?: 0px)?$/.test(wolAfter.tableSpacing || '') &&
          wolAfter.articleMaxWidth !== wolBefore.articleMaxWidth &&
          wolAfter.scrollWidth <= wolAfter.clientWidth,
        { wolBefore, wolAfter, wolMediaState },
      ),
      makeAssertion(
        'StudyNav places WOL audio actions in the article with audio-specific wording and no transcript action',
        wolMediaState.parentId === 'article' && wolMediaState.placement === 'inline' &&
          wolMediaState.kind === 'audio' && wolMediaState.position === 'relative' &&
          wolMediaState.summary === 'StudyNav audio · Audio tools' && wolMediaState.title === 'Audio tools' &&
          wolMediaState.buttons.includes('Copy audio link and time') &&
          wolMediaState.buttons.includes('Download a media segment') &&
          wolMediaState.buttons.includes('Open in a separate window') &&
          !wolMediaState.buttons.includes('Transcript') && wolMediaState.insideHeader === false &&
          wolMediaState.overlapsHeading === false && wolMediaState.summaryColor === 'rgb(24, 24, 24)' &&
          wolMediaState.iconStroke === 'rgb(67, 102, 159)',
        wolMediaState,
      ),
      makeAssertion(
        'StudyNav notes, selection editor, and QR stay usable and add no overflow at 360px',
        narrowPanel.rect?.left >= 0 && narrowPanel.rect?.right <= 360 &&
          narrowPanel.rect?.top >= 0 && narrowPanel.rect?.bottom <= 720 &&
          narrowPanel.closeHeight >= 36 && narrowPanel.scrollWidth === narrowBase.scrollWidth &&
          narrowToolbar?.left >= 0 && narrowToolbar?.right <= 360 &&
          narrowToolbar?.top >= 0 && narrowToolbar?.bottom <= 720 &&
          narrowEditor.rect?.left >= 0 && narrowEditor.rect?.right <= 360 &&
          narrowEditor.rect?.top >= 0 && narrowEditor.rect?.bottom <= 720 &&
          narrowEditor.formRect?.left >= narrowEditor.rect?.left && narrowEditor.formRect?.right <= narrowEditor.rect?.right &&
          narrowEditor.mode === 'drawer' && narrowEditor.insideRail === true &&
          narrowEditor.minButtonHeight >= 36 && narrowEditor.scrollWidth === narrowBase.scrollWidth &&
          narrowQr.rect?.left >= 0 && narrowQr.rect?.right <= 360 &&
          narrowQr.rect?.top >= 0 && narrowQr.rect?.bottom <= 720 &&
          narrowQr.scrollWidth === narrowBase.scrollWidth,
        { narrowBase, narrowPanel, narrowToolbar, narrowEditor, narrowQr },
      ),
    );

    scenario.assertions.push(
      makeAssertion(
        'StudyNav exposes six colors and persists representative local highlights',
        fourColorData.annotations.length === 4 &&
          ['yellow', 'green', 'blue', 'pink'].every((color) =>
            fourColorData.annotations.some((item) => item.color === color)) &&
          ['yellow', 'green', 'blue', 'pink', 'purple', 'orange'].every((color) =>
            selectionColors.includes(color) && editorColors.includes(color)) &&
          Object.values(annotationRenderState.registrySizes).every((size) => size > 0),
        { fourColorData, annotationRenderState, selectionColors, editorColors },
      ),
      makeAssertion(
        'StudyNav shows page notes with explicit edit/delete controls beside the article without covering content',
        noteRailLayoutState.mode === 'rail' && noteRailLayoutState.overlapsArticle === false &&
          noteRailLayoutState.overlapsBadge === false &&
          noteRailLayoutState.scrollWidth <= noteRailLayoutState.clientWidth &&
          noteRailLayoutState.cards === 4 && noteRailLayoutState.explicitEditButtons === 4 &&
          noteRailLayoutState.explicitDeleteButtons === 4 && railEditorState.insideRail === true &&
          railEditorState.railMode === 'rail' &&
          ['Delete', 'Cancel', 'Save locally'].every((label) => railEditorState.buttons.includes(label)),
        { noteRailLayoutState, railEditorState },
      ),
      makeAssertion(
        'StudyNav opens a clicked highlight in the side editor and turns comma-separated tags into chips',
        annotationRenderState.editorOpen === false &&
          highlightClickEditorState.insideRail === true && highlightClickEditorState.railMode === 'drawer' &&
          highlightClickEditorState.title === 'Edit highlight' && highlightClickEditorState.buttons.includes('Delete') &&
          clickedHighlightData.annotations.some((item) =>
            item.selector.exact === 'A useful' && item.note === 'Note added by clicking the highlight' &&
            JSON.stringify(item.tags) === JSON.stringify(['clicked'])) &&
          JSON.stringify(tagChipState.values) === JSON.stringify(['faith', 'family']) &&
          tagChipState.removeLabels.every((label) => /^Remove tag /.test(label || '')) && tagChipState.inputValue === '' &&
          editorStorageRerenderState.sameEditor === true &&
          editorStorageRerenderState.noteValue === 'Private family note' &&
          fourColorData.annotations.some((item) => item.color === 'pink' &&
            item.note === 'Private family note' &&
            JSON.stringify(item.tags) === JSON.stringify(['faith', 'family'])),
        { highlightClickEditorState, clickedHighlightData, editorStorageRerenderState, tagChipState, fourColorData },
      ),
      makeAssertion(
        'StudyNav CSS highlights do not wrap or resize official text DOM',
        officialShapeBefore.p1OfficialChildren === 1 &&
          annotationRenderState.p1OfficialChildren === officialShapeBefore.p1OfficialChildren &&
          annotationRenderState.p1OwnedChildren === officialShapeBefore.p1OwnedChildren &&
          annotationRenderState.bodyWidth === officialShapeBefore.bodyWidth &&
          annotationRenderState.scrollWidth <= annotationRenderState.clientWidth,
        { officialShapeBefore, annotationRenderState },
      ),
      makeAssertion(
        'StudyNav rejects a cross-paragraph selection without writing data',
        crossParagraphState.toolbarOpen === false &&
          /within one paragraph or verse/i.test(crossParagraphState.toast) &&
          afterCrossData.annotations.length === 4,
        { crossParagraphState, afterCrossData },
      ),
      makeAssertion(
        'StudyNav restores four highlight registries after a full page reload',
        reloadState.highlightColors.length === 4 && reloadState.verseMarkButtons === 3 && reloadState.officialChildren === 1,
        reloadState,
      ),
      makeAssertion(
        'StudyNav page/global panel is fixed, searchable, tag-filtered, and layout-neutral',
        panelOpenResponse?.ok === true && initialPanelState.noteCount === 4 &&
          initialPanelState.position === 'fixed' && initialPanelState.panelRect?.right <= initialPanelState.clientWidth &&
          initialPanelState.articleRect?.width === officialShapeBefore.articleRect?.width &&
          initialPanelState.scrollWidth <= initialPanelState.clientWidth &&
          searchResultCount === 1 && tagFilterState.resultCount === 1 &&
          tagFilterState.options.includes('family'),
        { panelOpenResponse, initialPanelState, searchResultCount, tagFilterState },
      ),
      makeAssertion(
        'StudyNav saves exact page, paragraph, and verse places and supports search, open, and removal',
        paragraphBookmarkResponse?.ok === true && paragraphBookmarkResponse?.saved === true &&
          verseBookmarkResponse?.ok === true && verseBookmarkResponse?.saved === true &&
          pageBookmarkResponse?.ok === true && pageBookmarkResponse?.saved === true &&
          savedPlacesData.bookmarks.length === 3 &&
          savedPlacesData.bookmarks.some((bookmark) => bookmark.targetUrl.endsWith('#p1')) &&
          savedPlacesData.bookmarks.some((bookmark) => bookmark.targetUrl.endsWith('#v1001003')) &&
          savedPlacesData.bookmarks.some((bookmark) => !new URL(bookmark.targetUrl).hash) &&
          bookmarkPanelState.count === '3 saved places' && bookmarkPanelState.cards === 3 &&
          bookmarkPanelState.tagHidden === true && bookmarkPanelState.notesPressed === 'false' &&
          bookmarkPanelState.bookmarksPressed === 'true' && bookmarkSearchCount === 1 &&
          openedSavedPlaceUrl.endsWith('#p1') && savedPlacesAfterRemove.bookmarks.length === 2,
        {
          paragraphBookmarkResponse,
          verseBookmarkResponse,
          pageBookmarkResponse,
          savedPlacesData,
          bookmarkPanelState,
          bookmarkSearchCount,
          openedSavedPlaceUrl,
          savedPlacesAfterRemove,
        },
      ),
      makeAssertion(
        'StudyNav global-note editing preserves the note source page and title',
        crossPageEditedData.annotations.some((item) =>
          item.id === 'fixture-external-note' &&
          item.pageUrl === 'https://wol.jw.org/en/wol/d/r1/lp-e/999' &&
          item.title === 'External WOL note' &&
          item.note === 'Edited from another page'),
        crossPageEditedData.annotations.find((item) => item.id === 'fixture-external-note'),
      ),
      makeAssertion(
        'StudyNav side-rail edit and delete preserve unrelated local notes',
        editedData.annotations.some((item) => item.note === 'Updated local note' && item.tags.includes('hope')) &&
          afterDeleteData.annotations.length === 4 &&
          afterDeleteData.annotations.some((item) => item.id === 'fixture-external-note') &&
          !afterDeleteData.annotations.some((item) => item.selector.exact === 'text.'),
        { editedData, afterDeleteData },
      ),
      makeAssertion(
        'StudyNav versioned JSON export/import round-trips only study data',
        exportedBackup.schemaVersion === 2 && exportedBackup.annotations.length === 4 &&
          exportedBackup.bookmarks.length === 2 &&
          Array.isArray(exportedBackup.mediaProgress) && exportedBackup.settings === undefined &&
          exportedBackup.cookies === undefined && roundTripData.annotations.length === 4 &&
          roundTripData.bookmarks.length === 2 &&
          /6 added, 0 updated, 0 ignored, 0 rejected/.test(roundTripToast),
        { exportedBackup, roundTripData, roundTripToast },
      ),
      makeAssertion(
        'StudyNav mixed import reports accepted/rejected records and invalid or oversized JSON leaves data unchanged',
        mixedImportData.annotations.some((item) => item.id === 'fixture-mixed-valid') &&
          !mixedImportData.annotations.some((item) => item.id === 'fixture-mixed-invalid') &&
          /1 added, 0 updated, 0 ignored, 1 rejected/.test(mixedImportToast) &&
          invalidImportData.annotations.length === countBeforeInvalidImport &&
          oversizeImportData.annotations.length === countBeforeInvalidImport,
        {
          mixedImportToast,
          countBeforeInvalidImport,
          invalidImportCount: invalidImportData.annotations.length,
          oversizeImportCount: oversizeImportData.annotations.length,
        },
      ),
      makeAssertion(
        'StudyNav manual reattach fails closed after navigation to a different source page',
        crossPageReattachData.annotations.some((item) =>
          item.id === manualRecordBefore.id &&
          item.pageUrl === manualRecordBefore.pageUrl &&
          item.selector.exact === manualRecordBefore.selector.exact &&
          item.updatedAt === manualRecordBefore.updatedAt),
        crossPageReattachData.annotations.find((item) => item.id === manualRecordBefore.id),
      ),
      makeAssertion(
        'StudyNav exact auto-recovery and manual orphan reattach preserve note metadata',
        p1RecoveryIds.length > 0 && p1RecoveryIds.every((id) =>
          autoRecoveredData.annotations.find((item) => item.id === id)?.root?.id === 'p9') &&
          manualRecordAfter?.selector.exact === 'Replacement paragraph' &&
          manualRecordAfter?.color === manualRecordBefore.color &&
          manualRecordAfter?.note === manualRecordBefore.note &&
          JSON.stringify(manualRecordAfter?.tags) === JSON.stringify(manualRecordBefore.tags) &&
          manualRecordAfter?.createdAt === manualRecordBefore.createdAt &&
          manualRecordAfter?.updatedAt > manualRecordBefore.updatedAt,
        { p1RecoveryIds, manualRecordBefore, manualRecordAfter },
      ),
      makeAssertion(
        'StudyNav creates verse highlights and restores annotation ranges after SPA teardown',
        verseAnnotationData.annotations.some((item) =>
          item.root.id === 'v1001003' && item.selector.exact === 'A small lamp marked the next step.' && item.color === 'pink') &&
          annotationSpaState.dataset === '1' && annotationSpaState.pinkRanges >= 1 &&
          annotationSpaState.verseTools === 1,
        { verseAnnotationData, annotationSpaState },
      ),
      makeAssertion(
        'StudyNav citations cover selected text, page, and selected Bible verse with precise HTTPS links',
        selectionCitationResponse?.ok === true && pageCitationResponse?.ok === true && verseCitationResponse?.ok === true &&
          selectionCitation.includes('Paragraph p2') && selectionCitation.endsWith('#p2') &&
          pageCitation.endsWith(STUDYNAV_FIXTURE_PATH) && !pageCitation.includes('“') &&
          verseCitation.includes('Sample Reading 1:3') && verseCitation.endsWith('#v1001003'),
        { selectionCitationResponse, selectionCitation, pageCitationResponse, pageCitation, verseCitationResponse, verseCitation },
      ),
      makeAssertion(
        'StudyNav QR overlay uses the exact precise URL, stays in the viewport, copies, closes, and restores focus',
        qrResponse?.ok === true && qrState.svg && qrState.url.endsWith('#v1001003') &&
          qrState.panelInViewport && qrState.closeFocused && qrCopyToast === 'Link copied' && qrRestoredFocus === 'p2' &&
          canonicalFallbackQrResponse?.ok === true && canonicalFallbackQrResponse?.message === 'QR opened',
        { qrResponse, qrState, qrCopyToast, qrRestoredFocus, canonicalFallbackQrResponse },
      ),
      makeAssertion(
        'StudyNav opens only the page-derived official Finder target and fails closed without metadata',
        officialResponse?.ok === true &&
          officialUrl === 'https://www.jw.org/finder?pub=nwtsty&bible=1001003&wtlocale=E&srcid=share' &&
          openerIsNull && unavailableOfficialResponse?.ok === false &&
          unavailableOfficialResponse?.message === 'Not available on this page' &&
          russianArticleOfficialResponse?.ok === true &&
          russianArticleOfficialUrl === 'https://www.jw.org/finder?docid=1102021201&wtlocale=U&srcid=share' &&
          ukrainianArticleOfficialResponse?.ok === true &&
          ukrainianArticleOfficialUrl === 'https://www.jw.org/finder?docid=1102021201&wtlocale=K&srcid=share',
        {
          officialResponse,
          officialUrl,
          openerIsNull,
          unavailableOfficialResponse,
          russianArticleOfficialResponse,
          russianArticleOfficialUrl,
          ukrainianArticleOfficialResponse,
          ukrainianArticleOfficialUrl,
        },
      ),
      makeAssertion(
        'StudyNav popup exposes five blue page actions and opens the local study library',
        studyPopupState.rowCount === 23 && studyPopupState.groupCount === 4 &&
          studyPopupState.enabledCount === '19 on' && studyPopupState.actionButtons.length === 5 &&
          studyPopupState.actionButtons.every((button) => button.disabled === false) &&
          studyPopupState.actionButtons.map((button) => button.text).join('|') ===
            'Study library|Remove saved place|Copy citation|Show QR|Open clean publication link' && popupPanelOpened,
        { studyPopupState, popupPanelOpened },
      ),
      makeAssertion(
        'StudyNav serializes rapid independent popup changes and persists the final values',
        rapidOffFlags.annotations === false && rapidOffFlags.citations === false &&
          rapidRestoredFlags.annotations === true && rapidRestoredFlags.citations === true,
        { rapidOffFlags, rapidRestoredFlags },
      ),
      makeAssertion(
        'StudyNav excludes its hidden recorder media from playback progress',
        ownedMediaStatus?.continueWatching?.trackedVideoCount === 1 &&
          ownedMediaStatus.continueWatching.listenerCount === 1,
        ownedMediaStatus,
      ),
      makeAssertion(
        'StudyNav throttles playback saves and persists pause/pagehide immediately',
        Math.abs(initialPausedProgress.mediaProgress[0].currentTime - 6) < 0.1 &&
          Math.abs(progressWhileDisabled.mediaProgress[0].currentTime - 6) < 0.1 &&
          Math.abs(firstTimedProgress.mediaProgress[0].currentTime - 7) < 0.1 &&
          Math.abs(throttledProgress.mediaProgress[0].currentTime - 7) < 0.1 &&
          throttledProgress.mediaProgress[0].updatedAt === firstTimedProgress.mediaProgress[0].updatedAt &&
          Math.abs(pausedProgress.mediaProgress[0].currentTime - 9) < 0.1 &&
          pausedProgress.mediaProgress[0].updatedAt > firstTimedProgress.mediaProgress[0].updatedAt &&
          Math.abs(hiddenProgress.mediaProgress[0].currentTime - 10) < 0.1,
        { initialPausedProgress, progressWhileDisabled, firstTimedProgress, throttledProgress, pausedProgress, hiddenProgress },
      ),
      makeAssertion(
        'StudyNav removes ended/near-end progress and resumes explicitly without autoplay',
        endedProgress.mediaProgress.length === 0 && Math.abs(resumeState.currentTime - 11) < 0.1 &&
          resumeState.paused === true && resumeState.ended === false && resumeState.menuOpen === false,
        { endedProgress, resumeState },
      ),
    );
  });
  return scenario;
}

async function runStudyNavSelectionRegressionScenario(executablePath, port) {
  const scenario = createScenario('studynav-selection-regression', ['StudyNav']);
  await withContext(
    { executablePath, extensions: ['StudyNav'], locale: 'ru', deviceScaleFactor: 2 },
    async (context, launchMeta) => {
      scenario.launchMode = launchMeta.launchMode;
      await waitFor(() => context.serviceWorkers().length > 0, 15_000, 'Russian StudyNav worker did not start');
      const worker = context.serviceWorkers()[0];
      scenario.serviceWorkers = await collectServiceWorkers(context);
      await setStudyNavFlags(worker, DEFAULT_STUDYNAV_FLAGS);
      await routeStudyNavFixtures(context);

      const page = await openPage(
        context,
        scenario,
        'studynav-selection-regression',
        httpsUrl(HOSTS.jw, STUDYNAV_FIXTURE_PATH),
      );
      await page.waitForFunction(() =>
        document.documentElement.dataset.studynav === '1' &&
        document.getElementById('p1')?.dataset.snTools === '1');
      await installCopyCapture(page);

      await page.hover('#p1');
      const hoverState = await page.evaluate(() => {
        const paragraph = document.getElementById('p1');
        const sourceRects = [];
        const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT, {
          acceptNode(node) {
            return node.parentElement?.closest('[data-studynav-owned], .studynav-para-tools')
              ? NodeFilter.FILTER_REJECT
              : NodeFilter.FILTER_ACCEPT;
          },
        });
        let node;
        while ((node = walker.nextNode())) {
          const range = document.createRange();
          range.selectNodeContents(node);
          sourceRects.push(...Array.from(range.getClientRects()).map((rect) => ({
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
          })));
        }
        const visibleButtons = Array.from(paragraph?.querySelectorAll(':scope > [data-studynav-owned] button') || [])
          .filter((button) => {
            const style = getComputedStyle(button);
            const rect = button.getBoundingClientRect();
            return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
          });
        const overlapCount = visibleButtons.filter((button) => {
          const rect = button.getBoundingClientRect();
          return sourceRects.some((source) =>
            rect.left < source.right && rect.right > source.left && rect.top < source.bottom && rect.bottom > source.top);
        }).length;
        const textNode = paragraph?.firstChild;
        let dragStart = null;
        let dragEnd = null;
        if (textNode?.nodeType === Node.TEXT_NODE && textNode.data.length > 1) {
          const firstRange = document.createRange();
          firstRange.setStart(textNode, 0);
          firstRange.setEnd(textNode, 1);
          const lastRange = document.createRange();
          lastRange.setStart(textNode, textNode.data.length - 1);
          lastRange.setEnd(textNode, textNode.data.length);
          const firstRect = firstRange.getBoundingClientRect();
          const lastRect = lastRange.getBoundingClientRect();
          dragEnd = { x: firstRect.left + 1, y: firstRect.top + firstRect.height / 2 };
          dragStart = { x: lastRect.right - 1, y: lastRect.top + lastRect.height / 2 };
          for (const button of visibleButtons) {
            const buttonRect = button.getBoundingClientRect();
            const source = sourceRects.find((candidate) =>
              buttonRect.left < candidate.right && buttonRect.right > candidate.left &&
              buttonRect.top < candidate.bottom && buttonRect.bottom > candidate.top);
            if (!source) continue;
            dragStart = {
              x: (Math.max(buttonRect.left, source.left) + Math.min(buttonRect.right, source.right)) / 2,
              y: (Math.max(buttonRect.top, source.top) + Math.min(buttonRect.bottom, source.bottom)) / 2,
            };
            break;
          }
        }
        return {
          ownedChildren: paragraph?.querySelectorAll(':scope > [data-studynav-owned]').length || 0,
          visibleButtons: visibleButtons.length,
          overlapCount,
          sourceText: paragraph?.textContent?.trim() || '',
          dragStart,
          dragEnd,
        };
      });

      if (hoverState.dragStart && hoverState.dragEnd) {
        await page.mouse.move(hoverState.dragStart.x, hoverState.dragStart.y);
        await page.mouse.down();
        await page.mouse.move(hoverState.dragEnd.x, hoverState.dragEnd.y, { steps: 12 });
        await page.mouse.up();
      }
      await page.waitForTimeout(180);
      const nativeSelectionState = await page.evaluate(() => ({
        selected: window.getSelection()?.toString().trim() || '',
        toolbarOpen: !!document.getElementById('studynav-selection-tools'),
        toast: document.getElementById('studynav-toast')?.textContent?.trim() || '',
      }));

      await page.evaluate(() => {
        window.getSelection()?.removeAllRanges();
        document.dispatchEvent(new Event('selectionchange'));
        const toast = document.getElementById('studynav-toast');
        if (toast) toast.textContent = '';
        const paragraph = document.getElementById('p1');
        if (!paragraph) return;
        const range = document.createRange();
        range.setStart(paragraph, 0);
        range.setEnd(paragraph, paragraph.childNodes.length);
        const selection = window.getSelection();
        selection?.addRange(range);
        document.dispatchEvent(new Event('selectionchange'));
      });
      await page.waitForTimeout(180);
      const elementBoundaryState = await page.evaluate(() => {
        const tools = document.getElementById('studynav-selection-tools');
        const toolbarRect = tools?.getBoundingClientRect();
        const selection = window.getSelection();
        const range = selection?.rangeCount === 1 ? selection.getRangeAt(0) : null;
        const selectionRects = range ? Array.from(range.getClientRects()) : [];
        const overlapsSelection = !!toolbarRect && selectionRects.some((rect) =>
          toolbarRect.left < rect.right && toolbarRect.right > rect.left &&
          toolbarRect.top < rect.bottom && toolbarRect.bottom > rect.top);
        return {
          toolbarOpen: !!tools,
          buttons: Array.from(tools?.querySelectorAll('button') || []).map((button) => button.textContent?.trim() || ''),
          selected: selection?.toString().trim() || '',
          toast: document.getElementById('studynav-toast')?.textContent?.trim() || '',
          placement: tools?.dataset.placement || null,
          overlapsSelection,
        };
      });
      let copiedText = '';
      if (elementBoundaryState.toolbarOpen) {
        await page.locator('#studynav-selection-tools button', { hasText: 'Копировать' }).click();
        copiedText = await waitForCopiedText(
          page,
          (text) => text === 'A useful thought is easier to revisit when it stays beside the text.',
          'StudyNav did not retain the element-boundary selection for Copy',
        );
      }

      await page.evaluate(() => {
        const paragraph = document.createElement('p');
        paragraph.id = 'p-selection-limit';
        paragraph.dataset.pid = 'p-selection-limit';
        paragraph.textContent = 'x'.repeat(10_001);
        document.getElementById('article')?.appendChild(paragraph);
      });
      await page.waitForFunction(() => document.getElementById('p-selection-limit')?.dataset.snTools === '1');
      await page.evaluate(() => {
        const toast = document.getElementById('studynav-toast');
        if (toast) toast.textContent = '';
        const text = document.getElementById('p-selection-limit')?.firstChild;
        if (!text) return;
        const range = document.createRange();
        range.setStart(text, 0);
        range.setEnd(text, text.textContent?.length || 0);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        document.dispatchEvent(new Event('selectionchange'));
      });
      await page.waitForTimeout(180);
      const overLimitState = await page.evaluate(() => ({
        toolbarOpen: !!document.getElementById('studynav-selection-tools'),
        toast: document.getElementById('studynav-toast')?.textContent?.trim() || '',
      }));
      await page.evaluate(() => {
        window.getSelection()?.removeAllRanges();
        document.dispatchEvent(new Event('selectionchange'));
      });
      await page.waitForTimeout(100);
      const emptySelectionState = await page.evaluate(() => ({
        toolbarOpen: !!document.getElementById('studynav-selection-tools'),
        selected: window.getSelection()?.toString() || '',
      }));

      scenario.assertions.push(
        makeAssertion(
          'StudyNav hover adds no controls inside or over ordinary reading text',
          hoverState.ownedChildren === 0 && hoverState.visibleButtons === 0 &&
            hoverState.overlapCount === 0 &&
            hoverState.sourceText === 'A useful thought is easier to revisit when it stays beside the text.',
          hoverState,
        ),
        makeAssertion(
          'StudyNav preserves native pointer selection across the former hover-control area',
          nativeSelectionState.selected.length >= 4 && nativeSelectionState.toolbarOpen === true &&
            !/10\s*000/.test(nativeSelectionState.toast),
          nativeSelectionState,
        ),
        makeAssertion(
          'StudyNav accepts element-boundary selections and keeps actions away from selected text',
          elementBoundaryState.toolbarOpen === true &&
            ['Добавить заметку', 'Копировать', 'Ссылка'].every((label) => elementBoundaryState.buttons.includes(label)) &&
            elementBoundaryState.selected === 'A useful thought is easier to revisit when it stays beside the text.' &&
            !/10\s*000/.test(elementBoundaryState.toast) &&
            ['top', 'bottom'].includes(elementBoundaryState.placement) &&
            elementBoundaryState.overlapsSelection === false &&
            copiedText === 'A useful thought is easier to revisit when it stays beside the text.',
          { elementBoundaryState, copiedText },
        ),
        makeAssertion(
          'StudyNav reports the 10,000-character limit only for an over-limit selection',
          overLimitState.toolbarOpen === false && /10\s*000/.test(overLimitState.toast),
          overLimitState,
        ),
        makeAssertion(
          'StudyNav opens no action surface for an empty selection',
          emptySelectionState.toolbarOpen === false && emptySelectionState.selected === '',
          emptySelectionState,
        ),
        makeAssertion('StudyNav selection regression page emits no uncaught errors', scenario.pageErrors.length === 0, scenario.pageErrors),
        makeAssertion(
          'StudyNav selection regression emits no extension console errors',
          scenario.consoleErrors.filter((entry) =>
            String(entry.location?.url || '').startsWith('chrome-extension://')).length === 0,
          scenario.consoleErrors,
        ),
      );
    },
  );
  return scenario;
}

async function runStudyNavMobileScenario(executablePath, port) {
  const scenario = createScenario('studynav-mobile', ['StudyNavMobile']);
  await withContext(
    { executablePath, extensions: ['StudyNavMobile'], deviceScaleFactor: 2, hasTouch: true },
    async (context, launchMeta) => {
      scenario.launchMode = launchMeta.launchMode;
      const workers = await waitForNamedWorkers(context, ['StudyNavMobile']);
      scenario.serviceWorkers = workers;
      let worker = await getWorkerByName(context, 'StudyNavMobile');
      await routeStudyNavFixtures(context);
      await context.route(`https://${HOSTS.jwMedia}/media/fixture.mp4`, fulfillFixtureVideo);

      // Simulate settings carried over from the desktop package. The mobile
      // runtime must still expose only its conservative feature allowlist.
      const legacyMobileFlags = { ...DEFAULT_STUDYNAV_FLAGS, imgGet: true };
      await seedStudyNavMobileLegacyFlags(worker, legacyMobileFlags);

      const page = await openPage(
        context,
        scenario,
        'studynav-mobile-jw',
        httpsUrl(HOSTS.jw, STUDYNAV_FIXTURE_PATH),
      );
      await page.setViewportSize({ width: 390, height: 844 });
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() =>
        document.documentElement.dataset.studynav === '1' &&
        document.querySelectorAll('[data-sn-tools="1"]').length >= 5);
      await installCopyCapture(page);
      const initialFlagStorageState = await waitForWorkerState(
        worker,
        async () => ({
          local: (await chrome.storage.local.get('flags')).flags,
          legacySync: (await chrome.storage.sync.get('flags')).flags,
        }),
        (state) => state.local?.imgGet === false && state.legacySync?.imgGet === true,
        'StudyNav Mobile did not migrate 1.6.0 settings into local storage',
      );

      const readMobileViewportState = () => page.evaluate(() => {
        const toolbar = document.getElementById('studynav-selection-tools');
        const toolbarRect = toolbar?.getBoundingClientRect();
        const ownedOverflowers = Array.from(document.querySelectorAll('[data-studynav-owned]')).map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            selector: element.id ? `#${element.id}` : element.className || element.tagName,
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
          };
        }).filter((item) => item.left < -1 || item.right > innerWidth + 1);
        return {
          viewport: { width: innerWidth, height: innerHeight },
          rootFontSize: getComputedStyle(document.documentElement).fontSize,
          pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          toolbarReachable: !!toolbarRect && toolbarRect.left >= 0 && toolbarRect.right <= innerWidth &&
            toolbarRect.top >= 0 && toolbarRect.bottom <= innerHeight,
          toolbarButtonHeights: Array.from(toolbar?.querySelectorAll('button') || []).map((button) =>
            button.getBoundingClientRect().height),
          toolbarHorizontalOverflow: !!toolbar && toolbar.scrollWidth > toolbar.clientWidth,
          ownedOverflowers,
        };
      });

      const initialState = await getStudyNavState(page);
      const mobilePageState = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        dynamicCss: document.getElementById('studynav-dynamic-style')?.textContent || '',
        paragraphHoverToolsAbsent: !document.querySelector('#p1 > .studynav-para-tools'),
      }));

      await page.locator('#v1001001 .jsHighlightOnly').click();
      await page.locator('#v1001001 > .studynav-para-tools button').filter({ hasText: /^Mark$/ }).click();
      await page.waitForSelector('#studynav-note-editor');
      const verseEditorLayerState = await page.evaluate(() => {
        const toolbar = document.querySelector('#v1001001 > .studynav-para-tools');
        const rail = document.getElementById('studynav-note-rail');
        const toolbarRect = toolbar?.getBoundingClientRect();
        const hit = toolbarRect
          ? document.elementFromPoint(
            toolbarRect.left + toolbarRect.width / 2,
            toolbarRect.top + toolbarRect.height / 2,
          )
          : null;
        return {
          toolbarZ: Number(getComputedStyle(toolbar).zIndex),
          railZ: Number(getComputedStyle(rail).zIndex),
          toolbarCoveredByRail: !!hit?.closest('#studynav-note-rail'),
          railMode: rail?.dataset.mode || null,
        };
      });
      await page.locator('#studynav-note-editor .studynav-panel-head button').click();
      await page.waitForFunction(() => !document.getElementById('studynav-note-editor'));
      await page.locator('#v1001001 .jsHighlightOnly').click();

      await selectFixtureText(page, '#p1', 'A useful');
      const selectionToolbarStability = await page.evaluate(async () => {
        const initial = document.getElementById('studynav-selection-tools');
        let replacements = 0;
        const observer = new MutationObserver((records) => {
          for (const record of records) {
            const changed = [...record.addedNodes, ...record.removedNodes].some((node) =>
              node instanceof HTMLElement && (
                node.id === 'studynav-selection-tools' || !!node.querySelector?.('#studynav-selection-tools')
              ));
            if (changed) replacements += 1;
          }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
        for (let index = 0; index < 12; index += 1) {
          document.dispatchEvent(new Event('selectionchange'));
        }
        await new Promise((resolve) => setTimeout(resolve, 140));
        observer.disconnect();
        const current = document.getElementById('studynav-selection-tools');
        return {
          sameNode: initial === current,
          replacements,
          visible: !!current && getComputedStyle(current).display !== 'none',
        };
      });
      const selectionToolbar = await page.evaluate(() => {
        const toolbar = document.getElementById('studynav-selection-tools');
        const rect = toolbar?.getBoundingClientRect();
        return {
          labels: Array.from(toolbar?.querySelectorAll('button') || []).map((button) =>
            button.textContent?.trim() || button.getAttribute('aria-label') || ''),
          buttonHeights: Array.from(toolbar?.querySelectorAll('button') || []).map((button) =>
            button.getBoundingClientRect().height),
          inViewport: !!rect && rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight,
        };
      });
      await captureScreenshot(page, 'mobile-selection-tools.png');
      await page.locator('#studynav-selection-tools button').filter({ hasText: /^Copy$/ }).click();
      const copiedSelection = await waitForCopiedText(
        page,
        (value) => value === 'A useful',
        'StudyNav Mobile did not copy selected text',
      );

      await selectFixtureText(page, '#p2', 'precise link');
      await page.locator('#studynav-selection-tools button').filter({ hasText: /^Link$/ }).click();
      const copiedLink = await waitForCopiedText(
        page,
        (value) => value === `${STUDYNAV_FIXTURE_CANONICAL}#p2`,
        'StudyNav Mobile did not copy the selected paragraph link',
      );

      await selectFixtureText(page, '#p2', 'A precise link');
      await page.evaluate(() => {
        const heading = document.querySelector('#article h1');
        if (heading) heading.innerHTML = '<span>Sample Reading</span>\n<span>1:1–3</span>';
      });
      const bookmarkResponse = await sendStudyNavPageAction(
        worker,
        page.url(),
        'TOGGLE_STUDY_BOOKMARK',
      );
      ensure(bookmarkResponse?.ok === true, `StudyNav Mobile rejected a valid saved place: ${json(bookmarkResponse)}`);
      const bookmarkedData = await waitForWorkerState(
        worker,
        async () => (await chrome.storage.local.get('studynavStudyDataV2')).studynavStudyDataV2,
        (data) => data?.bookmarks?.some((item) => item.targetUrl === `${STUDYNAV_FIXTURE_CANONICAL}#p2`),
        'StudyNav Mobile did not persist the selected paragraph place',
      );
      const citationResponse = await sendStudyNavPageAction(
        worker,
        page.url(),
        'COPY_STUDY_CITATION',
      );
      const copiedCitation = await waitForCopiedText(
        page,
        (value) => value.includes('“A precise link”') && value.includes(`${STUDYNAV_FIXTURE_CANONICAL}#p2`),
        'StudyNav Mobile did not copy the selected-text citation',
      );
      const qrResponse = await sendStudyNavPageAction(worker, page.url(), 'SHOW_STUDY_QR');
      await page.waitForSelector('#studynav-qr-overlay');
      const qrState = await page.evaluate(() => {
        const overlay = document.getElementById('studynav-qr-overlay');
        const panel = overlay?.querySelector('.studynav-overlay-panel');
        const rect = panel?.getBoundingClientRect();
        return {
          target: overlay?.querySelector('.studynav-target-url')?.textContent?.trim() || null,
          inViewport: !!rect && rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight,
          buttonHeights: Array.from(overlay?.querySelectorAll('button') || []).map((button) =>
            button.getBoundingClientRect().height),
        };
      });
      await page.locator('#studynav-qr-overlay button').filter({ hasText: /^Close$/ }).click();

      await selectFixtureText(page, '#p1', 'easier to revisit');
      await page.locator('#studynav-selection-tools button').filter({ hasText: /^Add note$/ }).click();
      await page.waitForSelector('#studynav-note-editor');
      await page.fill('#studynav-note-text', 'Review this thought on the phone.');
      await page.fill('#studynav-note-tags', 'phone,');
      await page.waitForFunction(() =>
        document.querySelector('.studynav-tag-chip')?.textContent?.includes('phone'));
      const editorState = await page.evaluate(() => {
        const rail = document.getElementById('studynav-note-rail');
        const editor = document.getElementById('studynav-note-editor');
        const rect = rail?.getBoundingClientRect();
        return {
          mode: rail?.dataset.mode || null,
          fillsViewport: !!rect && rect.left === 0 && rect.right === innerWidth && rect.top === 0 && rect.bottom === innerHeight,
          overflow: !!editor && editor.scrollWidth > editor.clientWidth,
          chip: document.querySelector('.studynav-tag-chip')?.textContent?.replace('×', '').trim() || null,
          actionHeights: Array.from(editor?.querySelectorAll('button') || []).map((button) =>
            button.getBoundingClientRect().height),
        };
      });
      await captureScreenshot(page, 'mobile-note-editor.png');
      await page.locator('#studynav-note-editor button').filter({ hasText: /^Save locally$/ }).click();
      await page.waitForFunction(() =>
        !document.getElementById('studynav-note-editor') || !!document.getElementById('studynav-toast')?.textContent);
      const noteSaveState = await page.evaluate(() => ({
        editorOpen: !!document.getElementById('studynav-note-editor'),
        toast: document.getElementById('studynav-toast')?.textContent || '',
      }));
      const panelResponse = await sendStudyNavPageAction(worker, page.url(), 'OPEN_STUDY_PANEL');
      await page.waitForSelector('#studynav-study-panel');
      const studyPanelState = await page.evaluate(() => {
        const panel = document.getElementById('studynav-study-panel');
        const rect = panel?.getBoundingClientRect();
        return {
          responseVisible: !!panel,
          fillsViewport: !!rect && rect.left === 0 && rect.right === innerWidth && rect.top === 0 && rect.bottom === innerHeight,
          overflow: !!panel && panel.scrollWidth > panel.clientWidth,
          phoneNoteVisible: panel?.textContent?.includes('Review this thought on the phone.') || false,
        };
      });
      await page.locator('#studynav-study-panel button').filter({ hasText: /^Close$/ }).click();

      const popup = await openPage(
        context,
        scenario,
        'studynav-mobile-popup',
        extensionPageUrl(workerInfoFor(workers, 'StudyNavMobile').id, 'popup.html'),
      );
      await popup.setViewportSize({ width: 390, height: 844 });
      await activateTabByUrl(worker, page.url());
      await popup.reload({ waitUntil: 'load' });
      await popup.waitForFunction(() =>
        document.querySelectorAll('.row').length === 9 &&
        document.getElementById('status-title')?.textContent === 'Ready on this Bible chapter');
      const mobileStudyData = await popup.evaluate(async () =>
        (await chrome.storage.local.get('studynavStudyDataV2')).studynavStudyDataV2);
      ensure(
        mobileStudyData?.annotations?.some((item) =>
          item.selector.exact === 'easier to revisit' &&
          item.note === 'Review this thought on the phone.' &&
          item.tags?.includes('phone')),
        `StudyNav Mobile did not persist the phone note and tag: ${json({ noteSaveState, mobileStudyData })}`,
      );
      await popup.click('#settings > summary');
      const popupState = await popup.evaluate(() => ({
        title: document.title,
        rowIds: Array.from(document.querySelectorAll('.row input[data-id]')).map((input) => input.dataset.id),
        groups: Array.from(document.querySelectorAll('.group')).map((group) => group.textContent?.trim()),
        enabledCount: document.getElementById('enabled-count')?.textContent?.trim(),
        overflows: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        mediaGuideVisible: getComputedStyle(document.querySelector('.guide-media')).display !== 'none',
        desktopFooterVisible: getComputedStyle(document.querySelector('.desktop-footer')).display !== 'none',
        imageSearchPresent: !!document.getElementById('image-search'),
        actionHeights: Array.from(document.querySelectorAll('.action-grid button')).map((button) =>
          button.getBoundingClientRect().height),
        switchHeights: Array.from(document.querySelectorAll('.switch')).map((control) =>
          control.getBoundingClientRect().height),
        inputFontSizes: Array.from(document.querySelectorAll('input[type="search"]')).map((input) =>
          parseFloat(getComputedStyle(input).fontSize)),
      }));
      await captureScreenshot(popup, 'mobile-popup.png', { fullPage: true });
      await popup.setViewportSize({ width: 768, height: 1024 });
      const tabletPopupState = await popup.evaluate(() => {
        const grid = document.querySelector('.action-grid');
        return {
          bodyWidth: document.body.getBoundingClientRect().width,
          overflows: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          gridHeight: grid?.getBoundingClientRect().height || 0,
          actionHeights: Array.from(document.querySelectorAll('.action-grid button')).map((button) =>
            button.getBoundingClientRect().height),
        };
      });
      await popup.setViewportSize({ width: 390, height: 844 });

      await selectFixtureText(page, '#p2', 'A precise link');
      await page.evaluate(() => {
        window.open = () => null;
      });
      await installCopyCapture(popup);
      await popup.evaluate(() => {
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: { writeText: async () => { throw new Error('simulated Safari popup clipboard rejection'); } },
        });
      });
      await popup.click('#copy-citation');
      const popupFallbackCitation = await waitForCopiedText(
        popup,
        (value) => value.includes('“A precise link”') && value.includes(`${STUDYNAV_FIXTURE_CANONICAL}#p2`),
        'StudyNav Mobile popup did not recover from the Safari content clipboard rejection',
      );

      await popup.click('#open-official');
      const officialTab = await waitForWorkerState(
        worker,
        async () => (await chrome.tabs.query({})).find((tab) =>
          String(tab.url || '').startsWith('https://www.jw.org/finder?')) || null,
        (tab) => !!tab?.id,
        'StudyNav Mobile did not open the page-derived official Finder link',
      );
      await worker.evaluate(async (tabId) => { await chrome.tabs.remove(tabId); }, officialTab.id);

      await selectFixtureText(page, '#p1', 'A useful');
      await popup.evaluate(() => document.querySelector('[data-id="copyText"]').click());
      await waitForWorkerState(
        worker,
        async () => (await chrome.storage.local.get('flags')).flags,
        (flags) => flags?.copyText === false,
        'StudyNav Mobile did not disable selection copy',
      );
      await page.waitForFunction(() => !document.getElementById('studynav-selection-tools'));
      await page.evaluate(() => document.dispatchEvent(new Event('selectionchange')));
      await page.waitForFunction(() => !!document.getElementById('studynav-selection-tools'));
      const copyDisabledSelectionLabels = await page.locator('#studynav-selection-tools button').allTextContents();
      await popup.evaluate(() => document.querySelector('[data-id="copyText"]').click());
      await waitForWorkerState(
        worker,
        async () => (await chrome.storage.local.get('flags')).flags,
        (flags) => flags?.copyText === true,
        'StudyNav Mobile did not restore selection copy',
      );

      await popup.evaluate(() => {
        const input = document.querySelector('[data-id="annotations"]');
        input.click();
        input.click();
      });
      const sanitizedFlags = await waitForWorkerState(
        worker,
        async () => (await chrome.storage.local.get('flags')).flags,
        (flags) => flags?.annotations === true && flags?.verseAudio === false &&
          flags?.mediaClip === false && flags?.imgGet === false && flags?.actionBar === false,
        'StudyNav Mobile did not sanitize desktop-only stored flags after a setting change',
      );

      await page.setViewportSize({ width: 768, height: 1_024 });
      await selectFixtureText(page, '#p1', 'A useful');
      const tabletState = await page.evaluate(() => {
        const toolbar = document.getElementById('studynav-selection-tools');
        const toolbarRect = toolbar?.getBoundingClientRect();
        const articleRect = document.getElementById('article')?.getBoundingClientRect();
        return {
          viewport: { width: innerWidth, height: innerHeight },
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          toolbarInViewport: !!toolbarRect && toolbarRect.left >= 0 && toolbarRect.right <= innerWidth &&
            toolbarRect.top >= 0 && toolbarRect.bottom <= innerHeight,
          toolbarButtonHeights: Array.from(toolbar?.querySelectorAll('button') || []).map((button) =>
            button.getBoundingClientRect().height),
          articleInViewport: !!articleRect && articleRect.left >= 0 && articleRect.right <= innerWidth,
        };
      });

      await page.setViewportSize({ width: 844, height: 390 });
      await page.evaluate(() => document.querySelector('#p1')?.scrollIntoView({ block: 'center' }));
      await selectFixtureText(page, '#p1', 'A useful');
      const phoneLandscapeState = await readMobileViewportState();
      await page.locator('#v1001003 .jsHighlightOnly').click();
      await page.waitForFunction(() =>
        document.querySelector('#v1001003 > .studynav-para-tools')?.getAttribute('data-sn-verse-floating') === '1');
      const phoneLandscapeVerseToolbarState = await page.evaluate(() => {
        const verse = document.getElementById('v1001003');
        const toolbar = document.querySelector('#v1001003 > .studynav-para-tools');
        const article = document.getElementById('article');
        const verseRect = verse?.getBoundingClientRect();
        const toolbarRect = toolbar?.getBoundingClientRect();
        const articleRect = article?.getBoundingClientRect();
        return {
          coarsePointer: window.matchMedia('(pointer: coarse)').matches,
          maxTouchPoints: navigator.maxTouchPoints,
          inViewport: !!toolbarRect && toolbarRect.left >= 0 && toolbarRect.right <= innerWidth &&
            toolbarRect.top >= 0 && toolbarRect.bottom <= innerHeight,
          staysInReadingColumn: !!toolbarRect && !!articleRect &&
            toolbarRect.left >= articleRect.left - 1 && toolbarRect.right <= articleRect.right + 1,
          aboveOrBelowVerse: !!toolbarRect && !!verseRect &&
            (toolbarRect.bottom <= verseRect.top + 1 || toolbarRect.top >= verseRect.bottom - 1),
        };
      });

      await page.setViewportSize({ width: 1_024, height: 768 });
      await page.evaluate(() => document.querySelector('#p1')?.scrollIntoView({ block: 'center' }));
      await selectFixtureText(page, '#p1', 'A useful');
      const tabletLandscapeState = await readMobileViewportState();

      await page.setViewportSize({ width: 390, height: 844 });
      await page.evaluate(() => document.querySelector('#p1')?.scrollIntoView({ block: 'center' }));
      await selectFixtureText(page, '#p1', 'A useful');
      await page.emulateMedia({ colorScheme: 'dark' });
      const darkAppearanceState = await page.evaluate(() => ({
        prefersDark: window.matchMedia('(prefers-color-scheme: dark)').matches,
        toolbarBackground: getComputedStyle(document.getElementById('studynav-selection-tools')).backgroundColor,
      }));
      await page.emulateMedia({ colorScheme: 'light' });
      const lightAppearanceState = await page.evaluate(() => ({
        prefersLight: window.matchMedia('(prefers-color-scheme: light)').matches,
        toolbarBackground: getComputedStyle(document.getElementById('studynav-selection-tools')).backgroundColor,
      }));

      await page.setViewportSize({ width: 320, height: 844 });
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '20px';
        document.querySelector('#p1')?.scrollIntoView({ block: 'center' });
      });
      await selectFixtureText(page, '#p1', 'A useful');
      const largeTextState = await readMobileViewportState();
      await page.evaluate(() => { document.documentElement.style.fontSize = ''; });

      await page.setViewportSize({ width: 390, height: 360 });
      await page.evaluate(() => document.querySelector('#p2')?.scrollIntoView({ block: 'center' }));
      await selectFixtureText(page, '#p2', 'A precise link');
      await page.locator('#studynav-selection-tools button').filter({ hasText: /^Add note$/ }).click();
      await page.waitForSelector('#studynav-note-editor');
      const compactEditorState = await page.evaluate(() => {
        const editor = document.getElementById('studynav-note-editor');
        const scroller = editor?.closest('.studynav-note-rail-list');
        const close = editor?.querySelector('.studynav-panel-head button');
        const save = Array.from(editor?.querySelectorAll('button') || [])
          .find((button) => button.textContent?.trim() === 'Save locally');
        const rectInViewport = (button) => {
          const rect = button?.getBoundingClientRect();
          return !!rect && rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight;
        };
        if (!editor || !scroller || !close || !save) return null;
        scroller.scrollTop = 0;
        close.scrollIntoView({ block: 'nearest' });
        const closeReachable = rectInViewport(close);
        scroller.scrollTop = scroller.scrollHeight;
        save.scrollIntoView({ block: 'nearest' });
        const saveReachable = rectInViewport(save);
        return {
          scrollable: scroller.scrollHeight > scroller.clientHeight,
          closeReachable,
          saveReachable,
          editorHeight: editor.getBoundingClientRect().height,
          viewportHeight: innerHeight,
          actionHeights: [close, save].map((button) => button.getBoundingClientRect().height),
        };
      });
      await page.locator('#studynav-note-editor .studynav-panel-head button').click();
      await page.waitForFunction(() => !document.getElementById('studynav-note-editor'));

      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ colorScheme: 'light' });
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() =>
        document.documentElement.dataset.studynav === '1' &&
        document.querySelectorAll('[data-sn-tools="1"]').length >= 5);
      const pageReloadData = await waitForWorkerState(
        worker,
        async () => (await chrome.storage.local.get('studynavStudyDataV2')).studynavStudyDataV2,
        (data) => data?.annotations?.some((item) =>
          item.note === 'Review this thought on the phone.' && item.tags?.includes('phone')) &&
          data?.bookmarks?.some((item) => item.targetUrl === `${STUDYNAV_FIXTURE_CANONICAL}#p2`),
        'StudyNav Mobile did not retain local study data after a page reload',
      );
      const pageReloadFlags = await worker.evaluate(async () =>
        (await chrome.storage.local.get('flags')).flags);
      const pageReloadState = await page.evaluate(() => {
        const rail = document.getElementById('studynav-note-rail');
        return {
          dataset: document.documentElement.dataset.studynav,
          noteRailCount: document.querySelectorAll('#studynav-note-rail').length,
          noteTextVisible: rail?.textContent?.includes('Review this thought on the phone.') || false,
          toolRootCount: document.querySelectorAll('[data-sn-tools="1"]').length,
          paraToolCount: document.querySelectorAll('.studynav-para-tools').length,
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      });

      await activateTabByUrl(worker, page.url());
      await context.setOffline(true);
      // Remove the fixture fulfillers for the transport probe so this check
      // exercises Chromium's offline boundary instead of a synthetic response.
      await context.unroute(`https://${HOSTS.jw}/**`);
      await context.unroute(`https://${HOSTS.wol}/**`);
      const offlineTransportState = await page.evaluate(async (probeUrl) => {
        try {
          await fetch(probeUrl, { cache: 'no-store' });
          return { blocked: false };
        } catch (error) {
          return { blocked: true, error: String(error?.message || error) };
        }
      }, `https://${HOSTS.jw}/en/library/test?studynav-offline-probe=1`);
      await popup.reload({ waitUntil: 'load' });
      await popup.waitForFunction(() =>
        document.querySelectorAll('.row').length === 9 &&
        document.getElementById('status-title')?.textContent === 'Ready on this Bible chapter');
      const offlinePopupState = await popup.evaluate(async () => ({
        online: navigator.onLine,
        rows: document.querySelectorAll('.row').length,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        localData: (await chrome.storage.local.get('studynavStudyDataV2')).studynavStudyDataV2,
      }));
      const offlinePanelResponse = await sendStudyNavPageAction(worker, page.url(), 'OPEN_STUDY_PANEL');
      await page.waitForSelector('#studynav-study-panel');
      const offlineNotesState = await page.evaluate(() => ({
        noteVisible: document.getElementById('studynav-study-panel')?.textContent?.includes('Review this thought on the phone.') || false,
        bookmarksTab: !!document.querySelector('#studynav-study-panel [data-view="bookmarks"]'),
      }));
      await page.locator('#studynav-study-panel [data-view="bookmarks"]').click();
      await page.waitForSelector('#studynav-study-panel .studynav-bookmark-card');
      const offlineBookmarksState = await page.evaluate((targetUrl) => ({
        bookmarkVisible: document.getElementById('studynav-study-panel')?.textContent?.includes('Sample Reading 1:1–3') || false,
        targetVisible: document.getElementById('studynav-study-panel')?.textContent?.includes(targetUrl) || false,
      }), `${STUDYNAV_FIXTURE_CANONICAL}#p2`);
      await page.locator('#studynav-study-panel button').filter({ hasText: /^Close$/ }).click();
      await context.setOffline(false);
      await routeStudyNavFixtures(context);
      const onlineRestored = await page.evaluate(() => navigator.onLine);
      const onlineProbe = await page.evaluate(async (probeUrl) => {
        try {
          const response = await fetch(probeUrl, { cache: 'no-store' });
          return response.ok;
        } catch {
          return false;
        }
      }, `https://${HOSTS.jw}/en/library/test?studynav-online-probe=1`);

      const longRecordState = await worker.evaluate(async () => {
        const key = 'studynavStudyDataV2';
        const stored = (await chrome.storage.local.get(key))[key];
        const base = stored?.annotations || [];
        const extras = Array.from({ length: 32 }, (_, index) => ({
          id: `mobile-stress-${index}`,
          pageUrl: 'https://www.jw.org/en/library/bible/demo-edition/books/sample/1/',
          title: `Stress note ${index}`,
          root: { id: 'p1' },
          selector: {
            exact: 'A useful',
            prefix: '',
            suffix: ' thought is easier to revisit',
            start: 0,
            end: 8,
          },
          color: ['yellow', 'green', 'blue', 'pink', 'purple', 'orange'][index % 6],
          note: `Bounded stress note ${index}`,
          tags: ['stress'],
          createdAt: 10_000 + index,
          updatedAt: 10_000 + index,
        }));
        const next = { ...stored, annotations: [...base, ...extras] };
        await chrome.storage.local.set({ [key]: next });
        return { annotationCount: next.annotations.length, extraCount: extras.length };
      });
      await page.waitForFunction((expectedCount) =>
        document.querySelectorAll('#studynav-note-rail .studynav-note-rail-item').length === expectedCount,
      longRecordState.annotationCount);
      const longPageState = await readMobileViewportState();
      const stressUiState = await page.evaluate(() => ({
        noteRailCount: document.querySelectorAll('#studynav-note-rail').length,
        noteCardCount: document.querySelectorAll('#studynav-note-rail .studynav-note-rail-item').length,
        uniqueCardIds: new Set(Array.from(document.querySelectorAll('#studynav-note-rail .studynav-note-rail-item'))
          .map((card) => card.dataset.annotationId)).size,
        p1ToolbarCount: document.querySelectorAll('#p1 > .studynav-para-tools').length,
        p2ToolbarCount: document.querySelectorAll('#p2 > .studynav-para-tools').length,
      }));
      await setStudyNavMobileFlags(worker, { ...sanitizedFlags, masterEnabled: false });
      await page.waitForFunction(() =>
        document.documentElement.dataset.studynav === 'off' &&
        document.querySelectorAll('[data-studynav-owned]').length === 0);
      const stressTeardownState = await page.evaluate(() => ({
        dataset: document.documentElement.dataset.studynav,
        ownedCount: document.querySelectorAll('[data-studynav-owned]').length,
      }));
      await setStudyNavMobileFlags(worker, { ...sanitizedFlags, masterEnabled: true });
      await page.waitForFunction((expectedCount) =>
        document.documentElement.dataset.studynav === '1' &&
        document.querySelectorAll('#studynav-note-rail .studynav-note-rail-item').length === expectedCount,
      longRecordState.annotationCount);
      const stressReapplyState = await page.evaluate(() => ({
        dataset: document.documentElement.dataset.studynav,
        noteRailCount: document.querySelectorAll('#studynav-note-rail').length,
        noteCardCount: document.querySelectorAll('#studynav-note-rail .studynav-note-rail-item').length,
        p1ToolbarCount: document.querySelectorAll('#p1 > .studynav-para-tools').length,
        p2ToolbarCount: document.querySelectorAll('#p2 > .studynav-para-tools').length,
      }));

      const wolPage = await openPage(
        context,
        scenario,
        'studynav-mobile-wol',
        httpsUrl(HOSTS.wol, '/en/wol/d/r1/lp-e/999'),
      );
      await wolPage.setViewportSize({ width: 390, height: 844 });
      await wolPage.reload({ waitUntil: 'load' });
      await wolPage.waitForFunction(() =>
        document.documentElement.dataset.studynav === '1' &&
        document.querySelectorAll('[data-sn-tools="1"]').length >= 2 &&
        document.querySelectorAll('.studynav-para-tools').length === 0);
      await selectFixtureText(wolPage, '#p2', 'local notes');
      const wolState = await wolPage.evaluate(() => ({
        selectionTools: !!document.getElementById('studynav-selection-tools'),
        mediaBar: !!document.getElementById('studynav-media-bar'),
        audioAction: !!document.querySelector('.studynav-verse-audio, .studynav-media-action'),
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        overflowers: Array.from(document.querySelectorAll('*')).map((element) => {
          const rect = element.getBoundingClientRect();
          return { selector: element.id ? `#${element.id}` : element.className || element.tagName, left: rect.left, right: rect.right };
        }).filter((item) => item.left < -1 || item.right > document.documentElement.clientWidth + 1).slice(0, 8),
        ownedOverflowers: Array.from(document.querySelectorAll('[data-studynav-owned]')).map((element) => {
          const rect = element.getBoundingClientRect();
          return { selector: element.id ? `#${element.id}` : element.className || element.tagName, left: rect.left, right: rect.right };
        }).filter((item) => item.left < -1 || item.right > document.documentElement.clientWidth + 1),
      }));

      const activeMobileFlags = Object.entries(sanitizedFlags)
        .filter(([key, value]) => key !== 'masterEnabled' && value === true)
        .map(([key]) => key)
        .sort();
      const expectedMobileFlags = Object.entries(DEFAULT_STUDYNAV_MOBILE_FLAGS)
        .filter(([key, value]) => key !== 'masterEnabled' && value === true)
        .map(([key]) => key)
        .sort();

      scenario.assertions.push(
        makeAssertion(
          'StudyNav Mobile worker uses the separate mobile package identity',
          workers.some((item) => workerMatchesExtension(item, 'StudyNavMobile')),
          workers,
        ),
        makeAssertion(
          'StudyNav Mobile keeps only the nine reliable tools even with desktop settings present',
          initialState.palettePresent === false && initialState.mediaBar === false &&
            initialState.imageButtons === 0 && initialState.verseAudioButtons === 0 &&
            initialState.mediaClipPanelPresent === false && initialState.transcriptPresent === false &&
            !mobilePageState.dynamicCss.includes('#regionHeader') &&
            !mobilePageState.dynamicCss.includes('.video-js') &&
            mobilePageState.paragraphHoverToolsAbsent === true && mobilePageState.overflow === false &&
            json(activeMobileFlags) === json(expectedMobileFlags),
          { initialState, mobilePageState, activeMobileFlags, initialFlagStorageState },
        ),
        makeAssertion(
          'StudyNav Mobile migrates 1.6.0 settings additively and writes the normalized copy locally',
          initialFlagStorageState.local?.imgGet === false &&
            initialFlagStorageState.local?.verseAudio === false &&
            initialFlagStorageState.local?.annotations === legacyMobileFlags.annotations &&
            initialFlagStorageState.legacySync?.imgGet === true &&
            initialFlagStorageState.legacySync?.verseAudio === legacyMobileFlags.verseAudio,
          { legacyMobileFlags, initialFlagStorageState },
        ),
        makeAssertion(
          'StudyNav Mobile selection toolbar fits the phone and copies text plus precise links',
          selectionToolbar.labels.length === 9 &&
            selectionToolbar.labels.includes('Add note') && selectionToolbar.labels.includes('Copy') &&
            selectionToolbar.labels.includes('Link') && selectionToolbar.inViewport === true &&
            selectionToolbar.buttonHeights.every((height) => height >= 44) &&
            selectionToolbarStability.sameNode === true && selectionToolbarStability.replacements === 0 &&
            selectionToolbarStability.visible === true && copiedSelection === 'A useful' &&
            copiedLink === `${STUDYNAV_FIXTURE_CANONICAL}#p2`,
          { selectionToolbar, selectionToolbarStability, copiedSelection, copiedLink },
        ),
        makeAssertion(
          'StudyNav Mobile saves places, copies citations, and shows a viewport-safe local QR',
          bookmarkResponse?.ok === true && bookmarkResponse?.saved === true &&
            bookmarkedData.bookmarks.some((item) =>
              item.targetUrl === `${STUDYNAV_FIXTURE_CANONICAL}#p2` &&
              item.title === 'Sample Reading 1:1–3') &&
            citationResponse?.ok === true && copiedCitation.includes('“A precise link”') &&
            popupFallbackCitation.includes('“A precise link”') &&
            qrResponse?.ok === true && qrState.target === `${STUDYNAV_FIXTURE_CANONICAL}#p2` &&
            qrState.inViewport === true && qrState.buttonHeights.every((height) => height >= 44),
          { bookmarkResponse, citationResponse, copiedCitation, popupFallbackCitation, qrResponse, qrState },
        ),
        makeAssertion(
          'StudyNav Mobile saves a tagged note in a full-screen touch editor and library',
          verseEditorLayerState.railMode === 'drawer' &&
            verseEditorLayerState.toolbarZ < verseEditorLayerState.railZ &&
            verseEditorLayerState.toolbarCoveredByRail === true &&
            editorState.mode === 'drawer' && editorState.fillsViewport === true &&
            editorState.overflow === false && editorState.chip === 'phone' &&
            editorState.actionHeights.every((height) => height >= 44) &&
            mobileStudyData.annotations.some((item) => item.tags?.includes('phone')) &&
            panelResponse?.ok === true && studyPanelState.fillsViewport === true &&
            studyPanelState.overflow === false && studyPanelState.phoneNoteVisible === true,
          { verseEditorLayerState, editorState, studyPanelState, panelResponse },
        ),
        makeAssertion(
          'StudyNav Mobile popup shows nine phone-safe settings with touch-sized controls',
          popupState.title === 'StudyNav Mobile — Unofficial Study Tools' &&
            json([...popupState.rowIds].sort()) === json(expectedMobileFlags) &&
            json(popupState.groups) === json(['Study & sharing', 'Bible & articles']) &&
            popupState.enabledCount === '9 on' && popupState.overflows === false &&
            popupState.mediaGuideVisible === false && popupState.desktopFooterVisible === false &&
            popupState.imageSearchPresent === false &&
            popupState.actionHeights.every((height) => height >= 48 && height <= 96) &&
            popupState.switchHeights.every((height) => height >= 44) &&
            popupState.inputFontSizes.every((size) => size >= 16) &&
            tabletPopupState.bodyWidth <= 480 && tabletPopupState.overflows === false &&
            tabletPopupState.gridHeight <= 240 &&
            tabletPopupState.actionHeights.every((height) => height >= 48 && height <= 96),
          { popupState, tabletPopupState },
        ),
        makeAssertion(
          'StudyNav Mobile opens only the page-derived official Finder target',
          String(officialTab.url).startsWith('https://www.jw.org/finder?') &&
            String(officialTab.url).includes('wtlocale=E'),
          { officialTab },
        ),
        makeAssertion(
          'StudyNav Mobile removes a disabled selection action without leaving a stale button',
          !copyDisabledSelectionLabels.some((label) => label.trim() === 'Copy') &&
            copyDisabledSelectionLabels.some((label) => label.trim() === 'Link'),
          copyDisabledSelectionLabels,
        ),
        makeAssertion(
          'StudyNav Mobile keeps the article and selection actions inside an iPad-sized viewport',
          tabletState.viewport.width === 768 && tabletState.viewport.height === 1_024 &&
            tabletState.overflow === false && tabletState.toolbarInViewport === true &&
            tabletState.toolbarButtonHeights.every((height) => height >= 44) &&
            tabletState.articleInViewport === true,
          tabletState,
        ),
        makeAssertion(
          'StudyNav Mobile keeps the selection toolbar reachable in phone and tablet landscape',
          phoneLandscapeState.viewport.width === 844 && phoneLandscapeState.viewport.height === 390 &&
            phoneLandscapeState.pageOverflow === false && phoneLandscapeState.toolbarReachable === true &&
            phoneLandscapeState.ownedOverflowers.length === 0 &&
            (phoneLandscapeVerseToolbarState.coarsePointer === true ||
              phoneLandscapeVerseToolbarState.maxTouchPoints > 0) &&
            phoneLandscapeVerseToolbarState.inViewport === true &&
            phoneLandscapeVerseToolbarState.staysInReadingColumn === true &&
            phoneLandscapeVerseToolbarState.aboveOrBelowVerse === true &&
            tabletLandscapeState.viewport.width === 1_024 && tabletLandscapeState.viewport.height === 768 &&
            tabletLandscapeState.pageOverflow === false && tabletLandscapeState.toolbarReachable === true &&
            tabletLandscapeState.ownedOverflowers.length === 0 &&
            phoneLandscapeState.toolbarButtonHeights.every((height) => height >= 44) &&
            tabletLandscapeState.toolbarButtonHeights.every((height) => height >= 44),
          { phoneLandscapeState, phoneLandscapeVerseToolbarState, tabletLandscapeState },
        ),
        makeAssertion(
          'StudyNav Mobile survives light/dark appearance and a large-text narrow viewport',
          darkAppearanceState.prefersDark === true && darkAppearanceState.toolbarBackground &&
            lightAppearanceState.prefersLight === true && lightAppearanceState.toolbarBackground &&
            largeTextState.viewport.width === 320 && largeTextState.rootFontSize === '20px' &&
            largeTextState.pageOverflow === false && largeTextState.toolbarReachable === true &&
            largeTextState.ownedOverflowers.length === 0,
          { darkAppearanceState, lightAppearanceState, largeTextState },
        ),
        makeAssertion(
          'StudyNav Mobile keeps note-editor Close and Save reachable in a compact keyboard-like viewport',
          compactEditorState?.scrollable === true && compactEditorState.closeReachable === true &&
            compactEditorState.saveReachable === true && compactEditorState.viewportHeight === 360 &&
            compactEditorState.actionHeights.every((height) => height >= 44),
          compactEditorState,
        ),
        makeAssertion(
          'StudyNav Mobile retains notes, tags, bookmarks, and settings after a page reload',
          pageReloadData.annotations.some((item) =>
            item.note === 'Review this thought on the phone.' && item.tags?.includes('phone')) &&
            pageReloadData.bookmarks.some((item) => item.targetUrl === `${STUDYNAV_FIXTURE_CANONICAL}#p2`) &&
            pageReloadFlags?.copyText === true && pageReloadFlags?.annotations === true &&
            pageReloadFlags?.verseAudio === false && pageReloadFlags?.imgGet === false &&
            pageReloadState.dataset === '1' && pageReloadState.noteRailCount === 1 &&
            pageReloadState.noteTextVisible === true && pageReloadState.toolRootCount >= 5 &&
            pageReloadState.paraToolCount === 3 &&
            pageReloadState.overflow === false,
          { pageReloadData, pageReloadFlags, pageReloadState },
        ),
        makeAssertion(
          'StudyNav Mobile exposes saved local notes and places while offline and restores connectivity',
          offlineTransportState.blocked === true && offlinePopupState.rows === 9 &&
            offlinePopupState.overflow === false &&
            offlinePopupState.localData?.annotations?.some((item) => item.tags?.includes('phone')) &&
            offlinePopupState.localData?.bookmarks?.some((item) => item.targetUrl === `${STUDYNAV_FIXTURE_CANONICAL}#p2`) &&
            offlinePanelResponse?.ok === true && offlineNotesState.noteVisible === true &&
            offlineNotesState.bookmarksTab === true && offlineBookmarksState.bookmarkVisible === true &&
            offlineBookmarksState.targetVisible === true && onlineRestored === true && onlineProbe === true,
          { offlineTransportState, offlinePopupState, offlinePanelResponse, offlineNotesState, offlineBookmarksState, onlineRestored, onlineProbe },
        ),
        makeAssertion(
          'StudyNav Mobile re-renders a bounded long-page record set without duplicate owned UI',
          longRecordState.extraCount === 32 && stressUiState.noteRailCount === 1 &&
            stressUiState.noteCardCount === longRecordState.annotationCount &&
            stressUiState.uniqueCardIds === stressUiState.noteCardCount &&
            stressUiState.p1ToolbarCount === 0 && stressUiState.p2ToolbarCount === 0 &&
            longPageState.ownedOverflowers.length === 0,
          { longRecordState, stressUiState, longPageState },
        ),
        makeAssertion(
          'StudyNav Mobile tears down and reapplies long-page UI without stale duplicates',
          stressTeardownState.dataset === 'off' && stressTeardownState.ownedCount === 0 &&
            stressReapplyState.dataset === '1' && stressReapplyState.noteRailCount === 1 &&
            stressReapplyState.noteCardCount === longRecordState.annotationCount &&
            stressReapplyState.p1ToolbarCount === 0 && stressReapplyState.p2ToolbarCount === 0,
          { stressTeardownState, stressReapplyState },
        ),
        makeAssertion(
          'StudyNav Mobile keeps WOL notes available without adding audio controls or overflow',
          wolState.selectionTools === true && wolState.mediaBar === false &&
            wolState.audioAction === false && wolState.ownedOverflowers.length === 0,
          wolState,
        ),
        makeAssertion('StudyNav Mobile pages emit no uncaught errors', scenario.pageErrors.length === 0, scenario.pageErrors),
        makeAssertion(
          'StudyNav Mobile extension pages emit no console errors',
          scenario.consoleErrors.filter((entry) =>
            String(entry.location?.url || '').startsWith('chrome-extension://')).length === 0,
          scenario.consoleErrors,
        ),
      );
    },
  );
  return scenario;
}

async function runStudyNavRussianLocaleScenario(executablePath, port) {
  const scenario = createScenario('studynav-russian-locale', ['StudyNav']);
  await withContext(
    { executablePath, extensions: ['StudyNav'], locale: 'ru', deviceScaleFactor: 2 },
    async (context, launchMeta) => {
      scenario.launchMode = launchMeta.launchMode;
      await waitFor(() => context.serviceWorkers().length > 0, 15_000, 'Russian StudyNav worker did not start');
      const worker = context.serviceWorkers()[0];
      scenario.serviceWorkers = await collectServiceWorkers(context);
      const manifestState = await worker.evaluate(() => ({
        id: chrome.runtime.id,
        uiLanguage: chrome.i18n.getUILanguage(),
        toolsMessage: chrome.i18n.getMessage('tools'),
        name: chrome.runtime.getManifest().name,
        shortName: chrome.runtime.getManifest().short_name,
        description: chrome.runtime.getManifest().description,
        command: chrome.runtime.getManifest().commands?.['adv-search']?.description,
      }));
      await setStudyNavFlags(worker, DEFAULT_STUDYNAV_FLAGS);
      await routeStudyNavFixtures(context);

      const page = await openPage(
        context,
        scenario,
        'studynav-russian-page',
        httpsUrl(HOSTS.jw, '/ru/biblioteka/bibliya/izuchenie-biblii/knigi/bytie/1/'),
      );
      await page.waitForFunction(() =>
        document.documentElement.dataset.studynav === '1' &&
        document.querySelectorAll('[data-sn-tools="1"]').length >= 5);
      await page.locator('#v1001003 .jsHighlightOnly').click();
      await page.waitForFunction(() =>
        !!document.querySelector('#v1001003 .studynav-verse-audio'));
      await selectFixtureText(page, '#p1', 'A useful thought');
      const contentLocaleState = await page.evaluate(() => ({
        selectionButtons: Array.from(document.querySelectorAll('#studynav-selection-tools button'))
          .map((button) => button.textContent?.trim()).filter(Boolean),
        toolbarAria: document.getElementById('studynav-selection-tools')?.getAttribute('aria-label'),
        paragraphOwnedControls: document.querySelectorAll('#p1 > [data-studynav-owned]').length,
        audioText: document.querySelector('#v1001003 .studynav-verse-audio')?.textContent?.trim(),
        audioTitle: document.querySelector('#v1001003 .studynav-verse-audio')?.getAttribute('title'),
      }));
      await captureScreenshot(page, 'ru-selection-tools.png');
      await page.evaluate(() => {
        window.getSelection()?.removeAllRanges();
        document.dispatchEvent(new Event('selectionchange'));
      });
      await openStudyNavMediaMenu(page);
      const mediaLocaleState = await page.evaluate(() => ({
        heading: document.querySelector('.studynav-media-menu > strong')?.textContent?.trim(),
        trigger: document.querySelector('#studynav-media-bar summary')?.textContent?.replace(/\s+/g, ' ').trim(),
        buttons: Array.from(document.querySelectorAll('.studynav-media-actions > button'))
          .map((button) => button.textContent?.trim()),
        languageCount: document.getElementById('studynav-langcount')?.textContent?.trim(),
        languageLabel: document.getElementById('studynav-langcount')?.getAttribute('aria-label'),
      }));
      await captureScreenshot(page, 'ru-media-tools.png');
      await page.keyboard.press('Escape');

      await page.locator('#v1001001 .jsHighlightOnly').click();
      await page.locator('#v1001001 > .studynav-para-tools .studynav-verse-range-control').click();
      await page.locator('#v1001003 .jsHighlightOnly').click();
      await page.waitForFunction(() =>
        document.querySelectorAll('.verse.studynav-verse-selected').length === 3 &&
        document.querySelector('#v1001003 .studynav-verse-audio')?.textContent?.includes('1–3'));
      const rangeLocaleState = await page.evaluate(() => ({
        selected: document.querySelectorAll('.verse.studynav-verse-selected').length,
        audioText: document.querySelector('#v1001003 .studynav-verse-audio')?.textContent?.trim(),
        clearText: document.querySelector('#v1001003 .studynav-verse-range-control')?.textContent?.trim(),
        toast: document.getElementById('studynav-toast')?.textContent?.trim(),
      }));
      await captureScreenshot(page, 'ru-verse-range.png');
      await page.locator('#v1001003 .studynav-verse-range-control').click();
      await page.locator('#v1001003 .jsHighlightOnly').click();

      await selectFixtureText(page, '#p1', 'A useful thought');
      await page.locator('#studynav-selection-tools button', { hasText: 'Добавить заметку' }).click();
      await page.waitForSelector('#studynav-note-editor');
      const editorLocaleState = await page.evaluate(() => ({
        title: document.getElementById('studynav-editor-title')?.textContent?.trim(),
        labels: Array.from(document.querySelectorAll('#studynav-note-editor label'))
          .map((label) => label.childNodes[0]?.textContent?.trim()).filter(Boolean),
        save: Array.from(document.querySelectorAll('#studynav-note-editor button'))
          .find((button) => button.type === 'submit')?.textContent?.trim(),
        closeAria: document.querySelector('#studynav-note-editor .studynav-icon-button')?.getAttribute('aria-label'),
      }));
      await captureScreenshot(page, 'ru-note-editor.png');
      await page.fill('#studynav-note-text', 'Личная заметка рядом с текстом');
      await page.fill('#studynav-note-tags', 'изучение');
      await page.check('#studynav-note-editor input[value="purple"]');
      await page.locator('#studynav-note-editor button[type="submit"]').click();
      await page.setViewportSize({ width: 1600, height: 900 });
      await page.waitForFunction(() => document.getElementById('studynav-note-rail')?.dataset.mode === 'rail');
      await captureScreenshot(page, 'ru-note-rail.png');
      await page.setViewportSize({ width: 1280, height: 720 });

      const panelResponse = await sendStudyNavPageAction(worker, page.url(), 'OPEN_STUDY_PANEL');
      await page.waitForSelector('#studynav-study-panel');
      const panelLocaleState = await page.evaluate(() => ({
        title: document.getElementById('studynav-study-title')?.textContent?.trim(),
        views: Array.from(document.querySelectorAll('#studynav-study-panel button[data-view]'))
          .map((button) => button.textContent?.trim()),
        scopes: Array.from(document.querySelectorAll('#studynav-study-panel [data-scope]'))
          .map((button) => button.textContent?.trim()),
        searchAria: document.getElementById('studynav-note-search')?.getAttribute('aria-label'),
        closeAria: document.querySelector('#studynav-study-panel .studynav-icon-button')?.getAttribute('aria-label'),
      }));
      await captureScreenshot(page, 'ru-study-panel.png');
      await page.locator('#studynav-study-panel .studynav-icon-button').click();

      const qrResponse = await sendStudyNavPageAction(worker, page.url(), 'SHOW_STUDY_QR');
      await page.waitForSelector('#studynav-qr-overlay');
      const qrLocaleState = await page.evaluate(() => ({
        title: document.getElementById('studynav-qr-title')?.textContent?.trim(),
        copy: Array.from(document.querySelectorAll('#studynav-qr-overlay button'))
          .map((button) => button.textContent?.trim()),
        closeAria: document.querySelector('#studynav-qr-overlay .studynav-icon-button')?.getAttribute('aria-label'),
      }));
      await captureScreenshot(page, 'ru-qr-overlay.png');
      await page.keyboard.press('Escape');

      await setStudyNavFlags(worker, { ...DEFAULT_STUDYNAV_FLAGS, bookmarks: false });
      await waitFor(async () => {
        const status = await sendStudyNavPageAction(worker, page.url(), 'GET_STUDYNAV_STATUS');
        return status?.enabledCount === 18;
      }, 5_000, 'Russian StudyNav content did not apply the bookmarks-off flag');
      const localizedOffResponse = await sendStudyNavPageAction(worker, page.url(), 'TOGGLE_STUDY_BOOKMARK');
      await setStudyNavFlags(worker, DEFAULT_STUDYNAV_FLAGS);

      const popup = await openPage(
        context,
        scenario,
        'studynav-russian-popup',
        extensionPageUrl(manifestState.id, 'popup.html'),
      );
      await activateTabByUrl(worker, page.url());
      await popup.reload({ waitUntil: 'load' });
      await popup.waitForFunction(() =>
        document.querySelectorAll('.row').length === 23);
      const popupLocaleState = await popup.evaluate(() => ({
        lang: document.documentElement.lang,
        uiLanguage: chrome.i18n.getUILanguage(),
        toolsMessage: chrome.i18n.getMessage('tools'),
        navigatorLanguage: navigator.language,
        title: document.title,
        heading: document.querySelector('header strong')?.textContent?.trim(),
        subtitle: document.querySelector('header .muted')?.textContent?.trim(),
        masterLabel: document.querySelector('.master-control > span')?.textContent?.trim(),
        masterAria: document.getElementById('master')?.getAttribute('aria-label'),
        statusTitle: document.getElementById('status-title')?.textContent?.trim(),
        statusHint: document.getElementById('status-hint')?.textContent?.trim(),
        actions: Array.from(document.querySelectorAll('.action-grid button'))
          .map((button) => button.textContent?.trim()),
        featureNames: Array.from(document.querySelectorAll('.row .name'))
          .map((node) => node.textContent?.trim()),
        enabledCount: document.getElementById('enabled-count')?.textContent?.trim(),
        bodyOverflows: document.body.scrollWidth > document.body.clientWidth,
      }));
      await popup.setViewportSize({ width: 380, height: 760 });
      await captureScreenshot(popup, 'ru-popup.png', { fullPage: true });

      scenario.assertions.push(
        makeAssertion(
          'StudyNav resolves Russian manifest identity from the browser locale',
          /^ru/i.test(manifestState.uiLanguage) &&
            manifestState.name === 'StudyNav — неофициальные инструменты для изучения' &&
            manifestState.shortName === 'StudyNav' &&
            /Без телеметрии/.test(manifestState.description) &&
            manifestState.command === 'Открыть быстрый поиск StudyNav',
          manifestState,
        ),
        makeAssertion(
          'StudyNav localizes injected article, verse, editor, panel, QR, error, and accessibility UI to Russian',
          contentLocaleState.selectionButtons.join('|') === 'Добавить заметку|Копировать|Ссылка' &&
            contentLocaleState.toolbarAria === 'Действия с выбранным текстом' &&
            contentLocaleState.paragraphOwnedControls === 0 &&
            contentLocaleState.audioText === 'Скачать аудио' &&
            contentLocaleState.audioTitle === 'Скачать аудио только этого стиха' &&
            mediaLocaleState.heading === 'Инструменты видео' &&
            mediaLocaleState.trigger === 'StudyNav · видео · Инструменты видео' &&
            mediaLocaleState.buttons.join('|') ===
              'Скопировать ссылку и время видео|Скачать фрагмент медиа|Открыть в отдельном окне|Транскрипт' &&
            mediaLocaleState.languageCount === '6' && mediaLocaleState.languageLabel === 'Языков: 6' &&
            rangeLocaleState.selected === 3 &&
            rangeLocaleState.audioText === 'Скачать аудио 1–3' &&
            rangeLocaleState.clearText === 'Снять выделение' &&
            rangeLocaleState.toast === 'Стихи 1–3 выбраны.' &&
            editorLocaleState.title === 'Новое выделение' && editorLocaleState.save === 'Сохранить локально' &&
            editorLocaleState.closeAria === 'Закрыть редактор выделения' &&
            panelResponse?.message === 'Библиотека изучения открыта' &&
            panelLocaleState.title === 'Библиотека изучения' &&
            panelLocaleState.views.join('|') === 'Заметки|Сохранённые места' &&
            panelLocaleState.scopes.join('|') === 'Эта страница|Все заметки' &&
            panelLocaleState.searchAria === 'Поиск по заметкам' &&
            panelLocaleState.closeAria === 'Закрыть библиотеку изучения' &&
            qrResponse?.message === 'QR-код открыт' && qrLocaleState.title === 'QR-код этой страницы' &&
            qrLocaleState.copy.includes('Копировать ссылку') && qrLocaleState.closeAria === 'Закрыть QR-код' &&
            localizedOffResponse?.message === 'Сохранённые места выключены',
          { contentLocaleState, mediaLocaleState, rangeLocaleState, editorLocaleState, panelResponse, panelLocaleState, qrResponse, qrLocaleState, localizedOffResponse },
        ),
        makeAssertion(
          'StudyNav Russian popup is complete, readable, and retains the product accent layout',
          popupLocaleState.lang === 'ru' &&
            popupLocaleState.title === 'StudyNav — неофициальные инструменты для изучения' &&
            popupLocaleState.heading === 'StudyNav' &&
            /локальная обработка/.test(popupLocaleState.subtitle || '') &&
            popupLocaleState.masterLabel === 'Инструменты' &&
            popupLocaleState.masterAria === 'Включить все инструменты StudyNav' &&
            popupLocaleState.statusTitle === 'Готово для этой главы Библии' &&
            /Выбран стих 1:3/.test(popupLocaleState.statusHint || '') &&
            popupLocaleState.actions.join('|') ===
              'Библиотека изучения|Сохранить место|Копировать ссылку с цитатой|Показать QR-код|Открыть чистую ссылку' &&
            popupLocaleState.featureNames.includes('Сохранить место, чтобы вернуться') &&
            popupLocaleState.enabledCount === 'Включено: 19' &&
            popupLocaleState.bodyOverflows === false,
          popupLocaleState,
        ),
      );
      await popup.close();
      await page.close();
    },
  );
  return scenario;
}

async function runCombinedScenario(executablePath, port) {
  const scenario = createScenario('combined', ['ClearShield', 'InkShade', 'StudyNav']);
  await withContext(
    { executablePath, extensions: ['ClearShield', 'InkShade', 'StudyNav'] },
    async (context, launchMeta) => {
      scenario.launchMode = launchMeta.launchMode;
      const workers = await waitForNamedWorkers(context, ['ClearShield', 'InkShade', 'StudyNav']);
      scenario.serviceWorkers = workers;

      const clearShieldWorker = await getWorkerByName(context, 'ClearShield');
      const studyNavWorker = await getWorkerByName(context, 'StudyNav');

      await setClearShieldSettings(clearShieldWorker, DEFAULT_CLEARSHIELD);
      await setStudyNavFlags(studyNavWorker, DEFAULT_STUDYNAV_FLAGS);
      await routeStudyNavFixtures(context);

      const ordinary = await openPage(
        context,
        scenario,
        'ordinary',
        httpUrl(HOSTS.ordinary, port, '/ordinary'),
      );
      await settleInkShade(ordinary, 4000);
      const ordinaryState = await ordinary.evaluate(() => ({
        clearshieldStyle: document.querySelectorAll('#clearshield-cosmetic').length,
        adBannerDisplay: getComputedStyle(document.getElementById('ad-banner')).display,
        inkshade: document.documentElement.getAttribute('data-darkreader-scheme'),
        studynav: document.documentElement.dataset.studynav || null,
      }));

      const jwPage = await openPage(
        context,
        scenario,
        'jw',
        httpsUrl(HOSTS.jw, '/en/library/test'),
      );
      await settleInkShade(jwPage, 4000);
      await jwPage.waitForTimeout(400);
      const jwState = await jwPage.evaluate(() => ({
        inkshade: document.documentElement.getAttribute('data-darkreader-scheme'),
        studynav: document.documentElement.dataset.studynav || null,
        palettePresent: !!document.getElementById('studynav-palette'),
        paraTools: document.querySelectorAll('.studynav-para-tools').length,
      }));

      const extensionOriginConsoleErrors = scenario.consoleErrors.filter((entry) =>
        String(entry.location?.url || '').startsWith('chrome-extension://'),
      );

      for (const workerInfo of workers) {
        const popup = await openPage(
          context,
          scenario,
          `${workerInfo.name}-popup`,
          extensionPageUrl(
            workerInfo.id,
            workerMatchesExtension(workerInfo, 'InkShade') ? 'ui/popup/index.html' : 'popup.html',
          ),
        );
        await popup.waitForTimeout(500);
      }

      scenario.assertions.push(
        makeAssertion('Combined context exposes 3 named workers', workers.length >= 3, workers),
        makeAssertion('Combined ordinary page keeps StudyNav isolated', ordinaryState.studynav == null, ordinaryState),
        makeAssertion('Combined ordinary page applies InkShade', ordinaryState.inkshade === 'dark', ordinaryState),
        makeAssertion('Combined ordinary page applies ClearShield cosmetic hide', ordinaryState.clearshieldStyle === 1 && ordinaryState.adBannerDisplay === 'none', ordinaryState),
        makeAssertion('Combined jw page activates StudyNav', jwState.studynav === '1' && jwState.palettePresent === true && jwState.paraTools >= 2, jwState),
        makeAssertion('Combined jw page still applies InkShade', jwState.inkshade === 'dark', jwState),
        makeAssertion('Combined extension pages had no page errors', scenario.pageErrors.length === 0, scenario.pageErrors),
        makeAssertion('Combined extension pages had no console errors', extensionOriginConsoleErrors.length === 0, extensionOriginConsoleErrors),
      );

      scenario.notes.push(
        'Service-worker responsiveness is verified by Playwright worker discovery and worker-side storage reads/writes. Playwright does not expose a first-class uncaught-exception feed for MV3 service workers, so extension-origin page errors and worker liveness are the observable proxy.',
      );
    },
  );
  return scenario;
}

async function runStudyNavLiveSmokeScenario(executablePath) {
  const scenario = createScenario('studynav-live-smoke', ['StudyNav']);
  const unsupportedUrl = 'https://www.jw.org/en/';
  const supportedUrl = 'https://www.jw.org/en/library/books/enjoy-life-forever/section-1/lesson-01/';
  const wolUrl = 'https://wol.jw.org/uk/wol/d/r15/lp-k/2026443';

  try {
    await withContext(
      {
        executablePath,
        extensions: ['StudyNav'],
        useFixtureHostResolverRules: false,
        userAgent: LIVE_CHROME_USER_AGENT,
        extraHTTPHeaders: LIVE_CHROME_HEADERS,
      },
      async (context, launchMeta) => {
        scenario.launchMode = launchMeta.launchMode;
        const workers = await waitForNamedWorkers(context, ['StudyNav']);
        scenario.serviceWorkers = workers;
        const worker = await getWorkerByName(context, 'StudyNav');
        await setStudyNavFlags(worker, DEFAULT_STUDYNAV_FLAGS);

        const unsupported = await openPage(context, scenario, 'unsupported-live', unsupportedUrl);
        await unsupported.waitForTimeout(2000);
        const unsupportedNav = getPageNavigation(unsupported);
        scenario.notes.push(`unsupported-live nav ${json(unsupportedNav)}`);
        const unsupportedBlocker = getLiveTransportBlocker(unsupportedNav);
        if (unsupportedBlocker) {
          scenario.skipped = true;
          scenario.notes.push(`SKIP: unsupported live jw.org transport denied (${unsupportedBlocker})`);
          return;
        }

        const unsupportedState = await unsupported.evaluate(() => ({
          dataset: document.documentElement.dataset.studynav || null,
          palettePresent: !!document.getElementById('studynav-palette'),
          paraTools: document.querySelectorAll('.studynav-para-tools').length,
          altBlocks: document.querySelectorAll('.studynav-alt').length,
          langBadge: !!document.getElementById('studynav-langcount'),
          mediaBar: !!document.getElementById('studynav-media-bar'),
        }));

        const supported = await openPage(context, scenario, 'supported-live', supportedUrl);
        await supported.waitForTimeout(3000);
        const supportedNav = getPageNavigation(supported);
        scenario.notes.push(`supported-live nav ${json(supportedNav)}`);
        const supportedBlocker = getLiveTransportBlocker(supportedNav);
        if (supportedBlocker) {
          scenario.skipped = true;
          scenario.notes.push(`SKIP: supported live jw.org transport denied (${supportedBlocker})`);
          return;
        }

        let supportedState = await getStudyNavState(supported);
        if (supportedState.languageSelectOptions > 0 &&
            supportedState.langBadge !== String(supportedState.languageSelectOptions)) {
          try {
            await supported.waitForFunction(() => {
              const count = document.querySelector('#otherAvailLangsChooser')?.options?.length || 0;
              return count > 0 && document.getElementById('studynav-langcount')?.textContent?.trim() === String(count);
            }, { timeout: 5000 });
          } catch {
            // Preserve the final mismatching state as assertion evidence.
          }
          supportedState = await getStudyNavState(supported);
        }

        const wol = await openPage(context, scenario, 'wol-layout-live', wolUrl);
        await wol.waitForTimeout(3000);
        const wolNav = getPageNavigation(wol);
        scenario.notes.push(`wol-layout-live nav ${json(wolNav)}`);
        const wolBlocker = getLiveTransportBlocker(wolNav);
        let wolState = null;
        if (wolBlocker) {
          scenario.notes.push(`SKIP: live WOL layout slice unavailable (${wolBlocker})`);
        } else {
          const readWolState = () => wol.evaluate(() => {
            const article = document.querySelector('#article, .bodyTxt, article');
            const articleRect = article?.getBoundingClientRect();
            const reading = article?.querySelector(':scope > .scalableui') || article;
            const readingRect = reading?.getBoundingClientRect();
            const bar = document.getElementById('studynav-media-bar');
            const barRect = bar?.getBoundingClientRect();
            const headingRect = article?.querySelector('h1')?.getBoundingClientRect();
            const overlapsHeading = !!barRect && !!headingRect &&
              barRect.left < headingRect.right && barRect.right > headingRect.left &&
              barRect.top < headingRect.bottom && barRect.bottom > headingRect.top;
            const dynamicCss = document.getElementById('studynav-dynamic-style')?.textContent || '';
            return {
              dataset: document.documentElement.dataset.studynav || null,
              toolRoots: document.querySelectorAll('[data-sn-tools="1"]').length,
              paraTools: document.querySelectorAll('.studynav-para-tools').length,
              documentClientWidth: document.documentElement.clientWidth,
              documentScrollWidth: document.documentElement.scrollWidth,
              articleRect: articleRect ? {
                left: articleRect.left,
                right: articleRect.right,
                width: articleRect.width,
              } : null,
              readingRect: readingRect ? {
                left: readingRect.left,
                right: readingRect.right,
                width: readingRect.width,
              } : null,
              articleMaxWidth: article ? getComputedStyle(article).maxWidth : null,
              regionHeaderPosition: document.getElementById('regionHeader')
                ? getComputedStyle(document.getElementById('regionHeader')).position
                : null,
              mediaParentInHeader: !!bar?.closest('#regionHeader'),
              mediaPlacement: bar?.dataset.placement || null,
              mediaKind: bar?.dataset.kind || null,
              mediaSummary: bar?.querySelector('summary')?.textContent?.replace(/\s+/g, ' ').trim() || null,
              mediaButtons: Array.from(bar?.querySelectorAll('button') || []).map((button) => button.textContent?.trim() || ''),
              mediaOverlapsHeading: overlapsHeading,
              dynamicCss,
            };
          });
          const before = await readWolState();
          await setStudyNavFlags(worker, {
            ...DEFAULT_STUDYNAV_FLAGS,
            actionBar: true,
            cstblView: true,
            expandWidth: true,
          });
          await wol.waitForFunction(() =>
            (document.getElementById('studynav-dynamic-style')?.textContent || '').includes('padding-left: 48px'));
          await wol.waitForTimeout(400);
          const after = await readWolState();
          wolState = { before, after };
        }

        scenario.assertions.push(
          makeAssertion(
            'Live unsupported jw.org homepage stays free of StudyNav UI',
            unsupportedState.palettePresent === false &&
              unsupportedState.paraTools === 0 &&
              unsupportedState.altBlocks === 0 &&
              unsupportedState.langBadge === false &&
              unsupportedState.mediaBar === false,
            unsupportedState,
          ),
          makeAssertion(
            'Live supported article receives StudyNav helpers',
            supportedState.palettePresent === true &&
              supportedState.toolRoots >= 1 &&
              supportedState.stylePresent === true &&
              (supportedState.languageSelectOptions === 0 ||
                supportedState.langBadge === String(supportedState.languageSelectOptions)),
            supportedState,
          ),
        );
        if (wolState) {
          scenario.assertions.push(makeAssertion(
            'Live Ukrainian WOL keeps audio tools out of the title and makes the reading column visibly wider',
            wolState.before.dataset === '1' && wolState.after.dataset === '1' &&
              wolState.after.toolRoots >= 1 &&
              wolState.after.documentScrollWidth <= wolState.after.documentClientWidth &&
              wolState.after.articleRect?.left >= 0 &&
              wolState.after.articleRect?.right <= wolState.after.documentClientWidth &&
              (wolState.after.readingRect?.width || 0) > (wolState.before.readingRect?.width || 0) &&
              wolState.after.articleMaxWidth !== wolState.before.articleMaxWidth &&
              wolState.after.regionHeaderPosition === wolState.before.regionHeaderPosition &&
              wolState.after.mediaPlacement === 'inline' && wolState.after.mediaKind === 'audio' &&
              wolState.after.mediaSummary?.includes('StudyNav') &&
              wolState.after.mediaButtons.some((label) => /audio/i.test(label)) &&
              !wolState.after.mediaButtons.includes('Transcript') &&
              wolState.after.mediaParentInHeader === false && wolState.after.mediaOverlapsHeading === false &&
              wolState.after.dynamicCss.includes('padding-left: 48px') &&
              wolState.after.dynamicCss.includes('border-bottom: 1px solid rgba(67,102,159,.32)'),
            wolState,
          ));
        }
      },
    );
  } catch (error) {
    if (isLiveTransportException(error)) {
      scenario.skipped = true;
      scenario.notes.push(
        `SKIP: live jw.org smoke unavailable (${String(error?.message || error)})`,
      );
    } else {
      scenario.assertions.push(makeAssertion(
        'Live StudyNav harness and extension complete without internal failure',
        false,
        String(error?.stack || error),
      ));
    }
  }

  return scenario;
}

function mediaClockSeconds(value) {
  const match = /^(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/.exec(String(value || ''));
  if (!match) return null;
  return Number(match[1]) * 3600 +
    Number(match[2]) * 60 +
    Number(match[3]) +
    Number((match[4] || '').padEnd(3, '0')) / 1000;
}

function liveVerseMarker(payload, book, chapter, verse) {
  for (const languageFiles of Object.values(payload?.files || {})) {
    for (const item of languageFiles?.MP3 || []) {
      if (
        Number(item?.markers?.bibleBookNumber) !== book ||
        Number(item?.markers?.bibleBookChapter) !== chapter
      ) continue;
      const marker = (item.markers.markers || []).find((candidate) =>
        Number(candidate?.verseNumber) === verse);
      const start = mediaClockSeconds(marker?.startTime);
      const duration = mediaClockSeconds(marker?.duration);
      if (start != null && duration != null) return { start, duration, source: item.file?.url || null };
    }
  }
  return null;
}

async function runStudyNavVerseAudioLiveScenario(executablePath, liveCase) {
  const scenario = createScenario(liveCase.id, ['StudyNav']);
  const url = liveCase.url;

  try {
    await withContext(
      {
        executablePath,
        extensions: ['StudyNav'],
        useFixtureHostResolverRules: false,
        userAgent: LIVE_CHROME_USER_AGENT,
        extraHTTPHeaders: LIVE_CHROME_HEADERS,
      },
      async (context, launchMeta) => {
        scenario.launchMode = launchMeta.launchMode;
        const workers = await waitForNamedWorkers(context, ['StudyNav']);
        scenario.serviceWorkers = workers;
        const worker = await getWorkerByName(context, 'StudyNav');
        await setStudyNavFlags(worker, DEFAULT_STUDYNAV_FLAGS);

        const page = await openPage(context, scenario, 'verse-audio-live', url);
        await page.waitForTimeout(3500);
        const navigation = getPageNavigation(page);
        scenario.notes.push(`verse-audio-live nav ${json(navigation)}`);
        const blocker = getLiveTransportBlocker(navigation);
        if (blocker) {
          scenario.skipped = true;
          scenario.notes.push(`SKIP: live Bible transport denied (${blocker})`);
          return;
        }

        await page.waitForFunction(() =>
          document.querySelectorAll('.verse[id^="v"] .studynav-verse-audio').length > 0,
        );

        const apiUrl = await page.evaluate((fallback) => {
          const resource = performance.getEntriesByType('resource')
            .map((entry) => entry.name)
            .findLast((name) => /b\.jw-cdn\.org\/apis\/pub-media\/GETPUBMEDIALINKS/i.test(name));
          return resource || fallback;
        }, liveCase.apiUrl);

        let metadata;
        try {
          metadata = await page.evaluate(async (endpoint) => {
            const response = await fetch(endpoint, { credentials: 'omit' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
          }, apiUrl);
        } catch (error) {
          scenario.skipped = true;
          scenario.notes.push(`SKIP: official verse markers unavailable (${String(error?.message || error)})`);
          return;
        }
        const verseMarkers = [3, 4, 5].map((verse) => liveVerseMarker(metadata, 1, 1, verse));
        if (verseMarkers.some((marker) => !marker)) {
          scenario.assertions.push(makeAssertion(
            'Live official media response contains every selected verse marker',
            false,
            { apiUrl },
          ));
          return;
        }
        const markers = verseMarkers.filter(Boolean);
        const marker = {
          start: markers[0].start,
          duration: markers.at(-1).start + markers.at(-1).duration - markers[0].start,
          source: markers[0].source,
        };
        if (markers.some((item) => item.source !== marker.source)) {
          throw new Error('Selected live verse markers use different chapter audio files');
        }

        const discoveryState = await page.evaluate((language) => {
          const embedded = document.querySelector('[data-bible_audio_data_api]')
            ?.getAttribute('data-bible_audio_data_api') || '';
          let embeddedLanguage = null;
          try {
            embeddedLanguage = new URL(embedded).searchParams.get('langwritten');
          } catch {
            // The assertion below reports malformed or missing embedded metadata.
          }
          const removedAudioElements = document.querySelectorAll('audio').length;
          document.querySelectorAll('audio').forEach((audio) => audio.remove());
          performance.clearResourceTimings();
          return {
            embeddedLanguage,
            expectedLanguage: language,
            removedAudioElements,
            remainingResourceEntries: performance.getEntriesByType('resource').length,
          };
        }, liveCase.language);

        const decline = page.locator('button', { hasText: /^(Decline|Отклонить|Відхилити)$/ });
        if (await decline.isVisible().catch(() => false)) await decline.click();

        const selectionSelector = liveCase.language === 'E'
          ? '#v1001003 .jsHighlightOnly'
          : '#v1001003 .verseNum a';
        await page.locator(selectionSelector).click();
        try {
          await page.waitForFunction(() => {
            const verse = document.getElementById('v1001003');
            const button = verse?.querySelector('.studynav-verse-audio');
            return (
              verse?.classList.contains('jwac-textHighlight') ||
              verse?.classList.contains('studynav-verse-selected')
            ) &&
              button && getComputedStyle(button).display !== 'none';
          }, undefined, { timeout: 5000 });
        } catch {
          const selectionState = await page.evaluate(() => {
            const verse = document.getElementById('v1001003');
            const button = verse?.querySelector('.studynav-verse-audio');
            return {
              verseClass: verse?.className || null,
              highlighted: Array.from(document.querySelectorAll(
                '.verse.jwac-textHighlight, .verse.studynav-verse-selected',
              )).map((item) => item.id),
              buttonDisplay: button ? getComputedStyle(button).display : null,
              buttonCount: document.querySelectorAll('.studynav-verse-audio').length,
            };
          });
          throw new Error(`Live native verse selection did not become visible: ${json(selectionState)}`);
        }
        await page.locator('#v1001003 .studynav-verse-range-control').click();
        const rangeEndSelector = liveCase.language === 'E'
          ? '#v1001005 .jsHighlightOnly'
          : '#v1001005 .verseNum a';
        await page.locator(rangeEndSelector).click();
        await page.waitForFunction(() =>
          document.querySelectorAll('.verse.studynav-verse-selected').length === 3 &&
          document.querySelector('#v1001005 .studynav-verse-audio')?.textContent?.includes('3–5'));
        await captureScreenshot(
          page,
          `10-verse-audio-${liveCase.language.toLowerCase()}.png`,
        );

        const audioButton = page.locator('#v1001005 .studynav-verse-audio');
        let download;
        try {
          [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 60_000 }),
            audioButton.click({ timeout: 10_000 }),
          ]);
        } catch (error) {
          const targetState = await audioButton.evaluate((button) => {
            const rect = button.getBoundingClientRect();
            const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
            return {
              button: {
                rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                pointerEvents: getComputedStyle(button).pointerEvents,
                zIndex: getComputedStyle(button).zIndex,
              },
              hit: hit ? {
                tag: hit.tagName,
                id: hit.id,
                className: typeof hit.className === 'string' ? hit.className : '',
              } : null,
            };
          }).catch(() => null);
          throw new Error(`Verse-audio click/download failed: ${String(error?.message || error)}; target ${json(targetState)}`);
        }
        const downloadPath = await download.path();
        const bytes = downloadPath ? await readFile(downloadPath) : null;
        const state = bytes && bytes.length >= 44
          ? {
              filename: download.suggestedFilename(),
              riff: bytes.subarray(0, 4).toString('ascii'),
              wave: bytes.subarray(8, 12).toString('ascii'),
              channels: bytes.readUInt16LE(22),
              sampleRate: bytes.readUInt32LE(24),
              dataBytes: bytes.readUInt32LE(40),
              duration: bytes.readUInt32LE(40) /
                (bytes.readUInt32LE(24) * bytes.readUInt16LE(22) * 2),
            }
          : null;

        let mediaClipState = null;
        let mediaVideoClipState = null;
        if (liveCase.id === 'studynav-verse-audio-live') {
          if (!marker.source) throw new Error('Official English audio source is missing from the live marker');
          await page.evaluate((source) => {
            document.querySelectorAll('video, audio').forEach((media) => media.remove());
            const audio = document.createElement('audio');
            audio.id = 'studynav-live-clip-source';
            audio.src = source;
            audio.controls = true;
            document.querySelector('#article, main, body')?.appendChild(audio);
          }, marker.source);
          await page.waitForFunction(() => Array.from(document.querySelectorAll('#studynav-media-bar button'))
            .some((button) => button.textContent?.trim() === 'Download a media segment'));
          await openStudyNavMediaMenu(page);
          await page.locator('#studynav-media-bar button', { hasText: 'Download a media segment' }).click();
          const inputs = page.locator('#studynav-clip-panel input');
          await inputs.nth(0).fill('0:00');
          await inputs.nth(1).fill('0:01');
          const clipDownloadWatcher = page.waitForEvent('download', { timeout: 60_000 })
            .then((clipDownload) => ({ kind: 'download', clipDownload }))
            .catch((clipError) => ({ kind: 'timeout', clipError }));
          const clipErrorWatcher = page.waitForFunction(() =>
            !!document.querySelector('.studynav-clip-error')?.textContent?.trim(),
          { timeout: 60_000 })
            .then(async () => ({
              kind: 'error',
              clipError: await page.locator('.studynav-clip-error').textContent(),
            }))
            .catch((clipError) => ({ kind: 'timeout', clipError }));
          await page.locator('#studynav-clip-panel button[type="submit"]').click();
          const clipOutcome = await Promise.race([clipDownloadWatcher, clipErrorWatcher]);
          if (clipOutcome.kind !== 'download') {
            throw new Error(`Live media audio export failed: ${clipOutcome.kind === 'error' ? clipOutcome.clipError : clipOutcome.clipError?.message}`);
          }
          const clipPath = await clipOutcome.clipDownload.path();
          const clipBytes = clipPath ? await readFile(clipPath) : null;
          mediaClipState = clipBytes && clipBytes.length >= 44
            ? {
                filename: clipOutcome.clipDownload.suggestedFilename(),
                riff: clipBytes.subarray(0, 4).toString('ascii'),
                wave: clipBytes.subarray(8, 12).toString('ascii'),
                channels: clipBytes.readUInt16LE(22),
                sampleRate: clipBytes.readUInt32LE(24),
                duration: clipBytes.readUInt32LE(40) /
                  (clipBytes.readUInt32LE(24) * clipBytes.readUInt16LE(22) * 2),
              }
            : null;

          await page.evaluate((source) => {
            document.querySelectorAll('video, audio').forEach((media) => media.remove());
            const video = document.createElement('video');
            video.id = 'studynav-live-video-clip-source';
            video.src = source;
            video.controls = true;
            document.querySelector('#article, main, body')?.appendChild(video);
          }, MEDIA_VIDEO_LIVE_URL);
          await page.waitForFunction(() => Array.from(document.querySelectorAll('#studynav-media-bar button'))
            .some((button) => button.textContent?.trim() === 'Download a media segment'));
          await openStudyNavMediaMenu(page);
          await page.locator('#studynav-media-bar button', { hasText: 'Download a media segment' }).click();
          await page.selectOption('#studynav-clip-panel select', 'video');
          const videoInputs = page.locator('#studynav-clip-panel input');
          await videoInputs.nth(0).fill('0:03');
          await videoInputs.nth(1).fill('0:04');
          const videoDownloadWatcher = page.waitForEvent('download', { timeout: 90_000 })
            .then((clipDownload) => ({ kind: 'download', clipDownload }))
            .catch((clipError) => ({ kind: 'timeout', clipError }));
          const videoErrorWatcher = page.waitForFunction(() =>
            !!document.querySelector('.studynav-clip-error')?.textContent?.trim(),
          { timeout: 90_000 })
            .then(async () => ({
              kind: 'error',
              clipError: await page.locator('.studynav-clip-error').textContent(),
            }))
            .catch((clipError) => ({ kind: 'timeout', clipError }));
          await page.locator('#studynav-clip-panel button[type="submit"]').click();
          const videoOutcome = await Promise.race([videoDownloadWatcher, videoErrorWatcher]);
          if (videoOutcome.kind !== 'download') {
            throw new Error(`Live media video export failed: ${videoOutcome.kind === 'error' ? videoOutcome.clipError : videoOutcome.clipError?.message}`);
          }
          const videoPath = await videoOutcome.clipDownload.path();
          const videoBytes = videoPath ? await readFile(videoPath) : null;
          if (SCREENSHOT_DIR && videoPath) {
            await mkdir(SCREENSHOT_DIR, { recursive: true });
            await cp(videoPath, path.join(SCREENSHOT_DIR, 'studynav-live-media-clip.webm'));
          }
          mediaVideoClipState = videoBytes
            ? {
                filename: videoOutcome.clipDownload.suggestedFilename(),
                bytes: videoBytes.length,
                ebml: videoBytes.subarray(0, 4).toString('hex'),
              }
            : null;
        }

        scenario.assertions.push(
          makeAssertion(
            `Live ${liveCase.label} page exposes its official embedded audio endpoint`,
            discoveryState.embeddedLanguage === liveCase.language &&
              discoveryState.remainingResourceEntries === 0,
            discoveryState,
          ),
          makeAssertion(
            `Live ${liveCase.label} Bible page exposes one audio action for verses 3–5`,
            await page.locator('#v1001005').evaluate((verse) =>
              document.querySelectorAll('.verse.studynav-verse-selected').length === 3 &&
              verse.classList.contains('studynav-verse-selected') &&
              getComputedStyle(verse.querySelector('.studynav-verse-audio')).display !== 'none' &&
              verse.querySelector('.studynav-verse-audio')?.textContent?.includes('3–5')),
            { verseIds: ['v1001003', 'v1001004', 'v1001005'] },
          ),
          makeAssertion(
            `Live ${liveCase.label} WAV spans the first selected marker through the last marker end`,
            state?.filename === liveCase.filename &&
              state.riff === 'RIFF' &&
              state.wave === 'WAVE' &&
              state.channels >= 1 &&
              state.channels <= 2 &&
              state.sampleRate >= 8000 &&
              Math.abs(state.duration - marker.duration) <= 1 / state.sampleRate,
            { marker, state },
          ),
        );
        if (liveCase.id === 'studynav-verse-audio-live') {
          scenario.assertions.push(makeAssertion(
            'Live media audio export downloads the requested one-second JW CDN interval as WAV',
            mediaClipState?.filename.endsWith('_0000-0001.wav') &&
              mediaClipState.riff === 'RIFF' &&
              mediaClipState.wave === 'WAVE' &&
              mediaClipState.channels >= 1 && mediaClipState.channels <= 2 &&
              mediaClipState.sampleRate >= 8_000 &&
              Math.abs(mediaClipState.duration - 1) <= 1 / mediaClipState.sampleRate,
            { source: marker.source, mediaClipState },
          ));
          scenario.assertions.push(makeAssertion(
            'Live media video export records the requested one-second JW CDN interval as WebM',
            mediaVideoClipState?.filename.endsWith('_0003-0004.webm') &&
              mediaVideoClipState.bytes > 10_000 &&
              mediaVideoClipState.ebml === '1a45dfa3',
            { source: MEDIA_VIDEO_LIVE_URL, mediaVideoClipState },
          ));
        }
      },
    );
  } catch (error) {
    if (isLiveTransportException(error)) {
      scenario.skipped = true;
      scenario.notes.push(`SKIP: live verse-audio smoke unavailable (${String(error?.message || error)})`);
    } else {
      scenario.assertions.push(makeAssertion(
        `Live ${liveCase.label} verse-audio harness and extension complete without internal failure`,
        false,
        String(error?.stack || error),
      ));
    }
  }

  return scenario;
}

function summarize(scenarios) {
  const failures = scenarios.flatMap((scenario) =>
    scenario.assertions.filter((assertion) => !assertion.pass).map((assertion) => ({
      scenario: scenario.id,
      assertion: assertion.name,
      details: assertion.details,
    })),
  );
  const skippedScenarioIds = scenarios.filter((scenario) => scenario.skipped).map((scenario) => scenario.id);
  const extensionOriginConsoleErrors = scenarios.flatMap((scenario) =>
    scenario.consoleErrors.filter((entry) => String(entry.location?.url || '').startsWith('chrome-extension://')),
  );
  const pageErrorCount = scenarios.reduce((total, scenario) => total + scenario.pageErrors.length, 0);
  return {
    ok: failures.length === 0 && pageErrorCount === 0 && extensionOriginConsoleErrors.length === 0,
    scenarioCount: scenarios.length,
    assertionCount: scenarios.reduce((total, scenario) => total + scenario.assertions.length, 0),
    failureCount: failures.length,
    skippedScenarioCount: skippedScenarioIds.length,
    skippedScenarioIds,
    pageErrorCount,
    extensionOriginConsoleErrorCount: extensionOriginConsoleErrors.length,
    failures,
  };
}

function scenarioRequested(id) {
  const requested = String(process.env.NICK_EXT_SCENARIOS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return requested.length === 0 || requested.includes(id);
}

async function main() {
  const report = {
    ok: false,
    timestamp: isoNow(),
    executable: null,
    server: null,
    scenarios: [],
    summary: null,
    blocker: null,
  };

  let fixture = null;

  try {
    await validateExtensionDirs();
    for (const [name, dir] of Object.entries(EXTENSIONS)) {
      const manifestName = await readManifestName(dir);
      ensure(manifestName === displayNameFor(name), `Manifest name mismatch for ${name}: found ${manifestName}`);
    }

    const executable = await resolveChromiumExecutable();
    report.executable = executable;

    fixture = await createFixtureServer();
    report.server = {
      port: fixture.port,
      ordinaryUrl: httpUrl(HOSTS.ordinary, fixture.port, '/ordinary'),
      lightUrl: httpUrl(HOSTS.ordinary, fixture.port, '/light'),
      darkUrl: httpUrl(HOSTS.ordinary, fixture.port, '/dark'),
      jwUrl: httpsUrl(HOSTS.jw, STUDYNAV_FIXTURE_PATH),
    };

    if (scenarioRequested('baseline')) report.scenarios.push(await runBaselineScenario(executable.executablePath, fixture.port));
    if (scenarioRequested('clearshield-only')) report.scenarios.push(await runClearShieldScenario(executable.executablePath, fixture.port));
    if (scenarioRequested('clearshield-live-smoke')) report.scenarios.push(await runClearShieldLiveSmokeScenario(executable.executablePath));
    if (scenarioRequested('inkshade-only')) report.scenarios.push(await runInkShadeForkScenario(executable.executablePath, fixture.port));
    if (scenarioRequested('studynav-only')) report.scenarios.push(await runStudyNavScenario(executable.executablePath, fixture.port));
    if (scenarioRequested('studynav-study-suite')) report.scenarios.push(await runStudyNavStudySuiteScenario(executable.executablePath, fixture.port));
    if (scenarioRequested('studynav-selection-regression')) report.scenarios.push(await runStudyNavSelectionRegressionScenario(executable.executablePath, fixture.port));
    if (scenarioRequested('studynav-mobile')) report.scenarios.push(await runStudyNavMobileScenario(executable.executablePath, fixture.port));
    if (scenarioRequested('studynav-russian-locale')) report.scenarios.push(await runStudyNavRussianLocaleScenario(executable.executablePath, fixture.port));
    if (scenarioRequested('combined')) report.scenarios.push(await runCombinedScenario(executable.executablePath, fixture.port));
    if (scenarioRequested('studynav-live-smoke')) report.scenarios.push(await runStudyNavLiveSmokeScenario(executable.executablePath));
    const verseAudioBatchRequested = scenarioRequested('studynav-verse-audio-live');
    const verseAudioCaseRequested = VERSE_AUDIO_LIVE_CASES.some((liveCase) =>
      liveCase.id !== 'studynav-verse-audio-live' && scenarioRequested(liveCase.id));
    if (verseAudioBatchRequested || verseAudioCaseRequested) {
      for (const liveCase of VERSE_AUDIO_LIVE_CASES) {
        if (!verseAudioBatchRequested && !scenarioRequested(liveCase.id)) continue;
        report.scenarios.push(await runStudyNavVerseAudioLiveScenario(executable.executablePath, liveCase));
      }
    }

    report.summary = summarize(report.scenarios);
    report.ok = report.summary.ok;
  } catch (error) {
    report.ok = false;
    report.blocker = {
      message: String(error?.message || error),
      stack: String(error?.stack || ''),
    };
  } finally {
    if (fixture) {
      try {
        await fixture.close();
      } catch {
        // Ignore fixture close failures in final report.
      }
    }
  }

  const output = process.argv.includes('--summary') ? {
    ok: report.ok,
    timestamp: report.timestamp,
    executable: report.executable,
    scenarios: report.scenarios.map((scenario) => ({
      id: scenario.id,
      skipped: scenario.skipped,
      assertions: scenario.assertions.length,
      failures: scenario.assertions.filter((assertion) => !assertion.pass).map((assertion) => assertion.name),
      pageErrors: scenario.pageErrors.length,
      pageErrorDetails: scenario.pageErrors,
      extensionOriginConsoleErrors: scenario.consoleErrors.filter((entry) =>
        String(entry.location?.url || '').startsWith('chrome-extension://')).length,
      extensionOriginConsoleErrorDetails: scenario.consoleErrors.filter((entry) =>
        String(entry.location?.url || '').startsWith('chrome-extension://')),
      serviceWorkers: scenario.serviceWorkers.map(({ name, version }) => ({ name, version })),
    })),
    summary: report.summary,
    blocker: report.blocker,
  } : report;
  process.stdout.write(`${json(output)}\n`);
  process.exit(report.ok ? 0 : 1);
}

await main();
