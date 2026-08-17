#!/usr/bin/env node
/**
 * Validates each extension dist/ for Brave load readiness.
 * Usage: node scripts/smoke-check.mjs
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkgs = ['clearshield', 'inkshade', 'studynav'];
const displayContracts = {
  clearshield: {
    name: 'Ad & Tracker Blocker (ClearShield)',
    shortName: 'Ad Blocker',
    popupTitle: 'Ad & Tracker Blocker (ClearShield)',
    popupHeading: 'Ad &amp; Tracker Blocker',
  },
  inkshade: {
    name: 'InkShade – Dark Mode for Every Site',
    shortName: 'InkShade',
    popupTitle: 'InkShade settings',
  },
  studynav: {
    name: 'StudyNav — Unofficial Study Tools',
    shortName: 'StudyNav',
    popupTitle: 'StudyNav — Unofficial Study Tools',
  },
};
const rootPackage = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
let failed = 0;

function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else {
    console.log('OK  ', msg);
  }
}

function nonEmpty(file) {
  return existsSync(file) && statSync(file).size > 0;
}

function resolveManifestString(value, manifest, dist) {
  const match = /^__MSG_([A-Za-z0-9_]+)__$/.exec(String(value || ''));
  if (!match) return value;
  const locale = manifest.default_locale || 'en';
  const localePath = join(dist, '_locales', locale, 'messages.json');
  if (!existsSync(localePath)) return value;
  const messages = JSON.parse(readFileSync(localePath, 'utf8'));
  return messages[match[1]]?.message || value;
}

for (const name of pkgs) {
  console.log('\n==', name, '==');
  const dist = join(root, 'packages', name, 'dist');
  const manifestPath = join(dist, 'manifest.json');
  const sourceManifestPath = join(root, 'packages', name, 'manifest.json');
  const packagePath = join(root, 'packages', name, 'package.json');
  ok(existsSync(manifestPath), `${name}: dist/manifest.json exists`);
  if (!existsSync(manifestPath)) continue;

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    ok(false, `${name}: manifest JSON parse — ${e.message}`);
    continue;
  }

  ok(manifest.manifest_version === 3, `${name}: manifest_version === 3`);
  ok(typeof manifest.name === 'string' && manifest.name.length > 0, `${name}: name`);
  ok(typeof manifest.version === 'string' && /^\d+\.\d+/.test(manifest.version), `${name}: version`);
  const sourceManifest = JSON.parse(readFileSync(sourceManifestPath, 'utf8'));
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
  const display = displayContracts[name];
  const popupHtml = readFileSync(join(dist, manifest.action.default_popup), 'utf8');
  const resolvedName = resolveManifestString(manifest.name, manifest, dist);
  const resolvedShortName = resolveManifestString(manifest.short_name, manifest, dist);
  const resolvedTitle = resolveManifestString(manifest.action.default_title, manifest, dist);
  const resolvedDescription = resolveManifestString(manifest.description, manifest, dist);
  ok(resolvedName === display.name, `${name}: exact purpose-first display name`);
  ok(resolvedShortName === display.shortName, `${name}: understandable short_name`);
  ok(resolvedTitle === display.name, `${name}: toolbar title matches display name`);
  ok(popupHtml.includes(`<title>${display.popupTitle.replace('&', '&amp;')}</title>`), `${name}: popup title matches display contract`);
  if (display.popupHeading) {
    ok(popupHtml.includes(`<strong>${display.popupHeading}</strong>`), `${name}: purpose-first popup heading`);
  }
  ok(manifest.version === sourceManifest.version, `${name}: dist/source manifest versions match`);
  ok(manifest.version === packageJson.version, `${name}: manifest/package versions match`);
  if (name === 'clearshield') {
    ok(manifest.version === rootPackage.version, `${name}: extension/root versions match`);
  }
  if (existsSync(join(dist, '_metadata'))) {
    console.log('INFO', `${name}: ignored Chromium runtime metadata present in dist/_metadata`);
  }
  ok(manifest.icons && manifest.icons['16'] && manifest.icons['128'], `${name}: icons 16+128`);
  ok(nonEmpty(join(dist, manifest.icons['16'])), `${name}: icon16 file`);
  ok(nonEmpty(join(dist, manifest.icons['128'])), `${name}: icon128 file`);
  ok(manifest.background?.service_worker, `${name}: service_worker`);
  ok(nonEmpty(join(dist, manifest.background.service_worker)), `${name}: background.js non-empty`);
  ok(manifest.action?.default_popup, `${name}: default_popup`);
  ok(nonEmpty(join(dist, manifest.action.default_popup)), `${name}: popup.html`);
  const popupJs = manifest.action.default_popup.replace(/\.html$/, '.js');
  ok(nonEmpty(join(dist, popupJs)), `${name}: popup.js`);
  ok(!manifest.update_url, `${name}: no hidden update URL`);
  ok(!manifest.externally_connectable, `${name}: no external messaging surface`);

  const runtimeJs = [
    manifest.background.service_worker,
    popupJs,
    manifest.options_ui?.page?.replace(/\.html$/, '.js'),
    ...(manifest.content_scripts || []).flatMap((script) => script.js || []),
    'popup.js',
    'content.js',
    'options.js',
    'offscreen.js',
  ]
    .filter((entry, index, entries) => entry && entries.indexOf(entry) === index)
    .filter((entry) => existsSync(join(dist, entry)))
    .map((entry) => readFileSync(join(dist, entry), 'utf8'))
    .join('\n');
  ok(!/\beval\s*\(|\bnew\s+Function\s*\(/.test(runtimeJs), `${name}: no eval/new Function runtime code`);

  if (manifest.content_scripts?.length) {
    for (const cs of manifest.content_scripts) {
      for (const js of cs.js || []) ok(nonEmpty(join(dist, js)), `${name}: content script ${js}`);
      for (const css of cs.css || []) ok(nonEmpty(join(dist, css)), `${name}: content css ${css}`);
    }
  }

  if (name === 'clearshield') {
    const dnr = manifest.declarative_net_request?.rule_resources || [];
    ok(dnr.length >= 3, `${name}: DNR rule_resources >= 3`);
    for (const rr of dnr) {
      const p = join(dist, rr.path);
      ok(nonEmpty(p), `${name}: ruleset ${rr.id} file`);
      try {
        const rules = JSON.parse(readFileSync(p, 'utf8'));
        ok(Array.isArray(rules) && rules.length > 0, `${name}: ruleset ${rr.id} non-empty (${rules.length})`);
        if (rules[0]) {
          ok(rules[0].id && rules[0].action && rules[0].condition, `${name}: ruleset ${rr.id} shape`);
        }
      } catch (e) {
        ok(false, `${name}: ruleset ${rr.id} JSON — ${e.message}`);
      }
    }
    ok(manifest.permissions?.includes('declarativeNetRequest'), `${name}: declarativeNetRequest perm`);
    ok(manifest.permissions?.includes('storage'), `${name}: storage perm`);
    ok(manifest.permissions?.includes('contextMenus'), `${name}: contextMenus perm`);
    ok(runtimeJs.includes('clearshield-toggle-site'), `${name}: context-menu toggle handler bundled`);
    ok(nonEmpty(join(dist, 'options.html')), `${name}: options.html`);
    ok(nonEmpty(join(dist, 'options.js')), `${name}: options.js`);
  }

  if (name === 'inkshade') {
    const scripts = manifest.content_scripts || [];
    ok(scripts.length === 3, `${name}: dedicated MV3 proxy, engine, and color-scheme scripts`);
    ok(scripts[0]?.run_at === 'document_start' && scripts[0]?.world === 'MAIN', `${name}: MAIN-world proxy at document_start`);
    ok(scripts[1]?.run_at === 'document_start' && scripts[1]?.world === 'ISOLATED', `${name}: isolated dynamic engine at document_start`);
    ok(
      JSON.stringify(manifest.permissions) === JSON.stringify(['alarms', 'fontSettings', 'scripting', 'storage']),
      `${name}: exact required API permissions`,
    );
    ok(JSON.stringify(manifest.host_permissions) === JSON.stringify(['*://*/*']), `${name}: explicit website theming scope`);
    ok(nonEmpty(join(dist, 'THIRD_PARTY_NOTICES.txt')), `${name}: upstream MIT notice`);
    ok(
      JSON.stringify(readdirSync(join(dist, '_locales')).sort()) === JSON.stringify(['en', 'ru', 'uk']),
      `${name}: reviewed locale set only`,
    );
    ok(runtimeJs.includes('InkShade'), `${name}: InkShade branding bundled`);
    ok(
      !/posts\.json|support@darkreader|twitter\.com\/darkreaderapp|raw\.githubusercontent\.com\/darkreader|Dark Reader Plus|original Dark Reader/i.test(runtimeJs),
      `${name}: no upstream news, marketing, premium, or remote-config runtime`,
    );
  }

  if (name === 'studynav') {
    const popupCss = readFileSync(join(dist, 'popup.css'), 'utf8');
    const contentCss = readFileSync(join(dist, 'content.css'), 'utf8');
    const iconSource = readFileSync(join(dist, 'icons/icon-source.svg'), 'utf8');
    const featureDefaultsSource = readFileSync(join(root, 'packages/studynav/src/features.ts'), 'utf8');
    const featureImplSource = readFileSync(join(root, 'packages/studynav/src/feature-impl.ts'), 'utf8');
    const utilSource = readFileSync(join(root, 'packages/studynav/src/util.ts'), 'utf8');
    const studyDataSource = readFileSync(join(root, 'packages/studynav/src/study-data.ts'), 'utf8');
    const studyStorageSource = readFileSync(join(root, 'packages/studynav/src/study-storage.ts'), 'utf8');
    const featureIds = [...featureDefaultsSource.matchAll(/\{ id: '([^']+)'/g)].map((match) => match[1]);
    const hosts = manifest.host_permissions || [];
    ok(manifest.version === '1.6.0', `${name}: expected 1.6.0 release version`);
    ok(
      JSON.stringify(hosts) === JSON.stringify([
        'https://jw.org/*',
        'https://www.jw.org/*',
        'https://wol.jw.org/*',
        'https://*.jw-cdn.org/*',
      ]),
      `${name}: exact page hosts plus official HTTPS media permission`,
    );
    ok(
      JSON.stringify(manifest.content_scripts?.[0]?.matches) === JSON.stringify([
        'https://jw.org/*',
        'https://www.jw.org/*',
        'https://wol.jw.org/*',
      ]),
      `${name}: content script runs only on the main site and WOL`,
    );
    ok(
      runtimeJs.includes('wol.jw.org') &&
        !runtimeJs.includes('stream.jw.org') &&
        !runtimeJs.includes('hub.jw.org'),
      `${name}: runtime bundle contains no denied JW subdomain exception`,
    );
    ok(
      (manifest.permissions || []).length === 2 &&
        manifest.permissions.includes('storage') &&
        manifest.permissions.includes('offscreen'),
      `${name}: only storage and offscreen API permissions`,
    );
    ok(nonEmpty(join(dist, 'offscreen.html')), `${name}: offscreen.html`);
    ok(nonEmpty(join(dist, 'offscreen.js')), `${name}: offscreen.js`);
    ok(/unofficial/i.test(resolvedDescription || ''), `${name}: description says unofficial`);
    ok(!/JW Web Add-on/i.test(resolvedName || ''), `${name}: name does not impersonate JW Web Add-on`);
    ok(manifest.default_locale === 'en', `${name}: English fallback locale`);
    ok(
      JSON.stringify(readdirSync(join(dist, '_locales')).sort()) === JSON.stringify(['en', 'ru']),
      `${name}: reviewed English and Russian locale set`,
    );
    ok(manifest.commands?.['adv-search'], `${name}: adv-search command`);
    ok(
      popupCss.includes('--sn-accent: #43669f') && contentCss.includes('background: #43669f'),
      `${name}: popup and injected UI share the #43669F primary accent`,
    );
    ok(
      !/#148264|#39c995|rgba\(20[, ]+1(?:20|30)[, ]+100/i.test(`${popupCss}\n${contentCss}\n${runtimeJs}`),
      `${name}: old green accent literals are absent`,
    );
    ok(
      runtimeJs.includes('M12 3v12') && runtimeJs.includes('Download image') && !runtimeJs.includes('↓ img'),
      `${name}: image helper bundles a semantic icon instead of the textual img label`,
    );
    ok(
      featureIds.length === 23 && new Set(featureIds).size === 23 &&
        ['annotations', 'bookmarks', 'citations', 'continueWatching', 'mediaClip', 'qrShare', 'officialOpen'].every((id) => featureIds.includes(id)),
      `${name}: exactly 23 independently identified feature settings`,
    );
    ok(
      ['open-notes', 'save-place', 'copy-citation', 'show-qr', 'open-official'].every((id) => popupHtml.includes(`id="${id}"`)),
      `${name}: five clear popup study actions`,
    );
    ok(
      /annotations:\s*true/.test(featureDefaultsSource) &&
        /bookmarks:\s*true/.test(featureDefaultsSource) &&
        /citations:\s*true/.test(featureDefaultsSource) &&
        /continueWatching:\s*true/.test(featureDefaultsSource) &&
        /qrShare:\s*true/.test(featureDefaultsSource) &&
        /officialOpen:\s*true/.test(featureDefaultsSource),
      `${name}: six inert or user-triggered study features default on`,
    );
    ok(
      /actionBar:\s*false/.test(featureDefaultsSource) &&
        /cstblView:\s*false/.test(featureDefaultsSource) &&
        /expandWidth:\s*false/.test(featureDefaultsSource) &&
        featureDefaultsSource.includes('migrateFlagsForInstall') &&
        featureDefaultsSource.includes('safeDefaultRelease = [1, 2, 4]') &&
        runtimeJs.includes('migrateFlagsForInstall'),
      `${name}: layout-changing helpers default off with a bounded legacy migration`,
    );
    ok(
      featureImplSource.includes('flags.actionBar && !isWol') &&
        featureImplSource.includes('if (flags.expandWidth)') &&
        featureImplSource.includes('padding-left: 48px') &&
        featureImplSource.includes('if (flags.cstblView)') &&
        featureImplSource.includes('border-bottom: 1px solid rgba(67,102,159,.32)') &&
        featureImplSource.includes('box-sizing: border-box') &&
        !runtimeJs.includes('.jsLockedChrome') &&
        !runtimeJs.includes('#regionPrimaryNav'),
      `${name}: native WOL header plus scoped WOL/JW article layout helpers are bundled`,
    );
    ok(
      utilSource.includes("tokens.has('PageNotFound')") && runtimeJs.includes('PageNotFound'),
      `${name}: PageNotFound surfaces fail closed`,
    );
    ok(
      studyDataSource.includes("STUDY_DATA_V2_STORAGE_KEY = 'studynavStudyDataV2'") &&
        studyDataSource.includes("STUDY_DATA_LEGACY_STORAGE_KEY = 'studynavStudyDataV1'") &&
        studyDataSource.includes('MAX_BACKUP_JSON_BYTES = 5 * 1024 * 1024') &&
        studyStorageSource.includes('chrome.storage.local') &&
        !studyStorageSource.includes('chrome.storage.sync'),
      `${name}: bounded personal study envelope uses local storage only`,
    );
    ok(
      contentCss.includes('::highlight(studynav-yellow)') &&
        contentCss.includes('.studynav-study-panel') && contentCss.includes('position: fixed') &&
        contentCss.includes('@media (max-width: 480px)') &&
        contentCss.includes('@media (prefers-reduced-motion: reduce)'),
      `${name}: highlight and viewport-bounded overlay styles are bundled`,
    );
    ok(
      runtimeJs.includes('paulmillr-qr') && runtimeJs.includes('Apache 2.0 OR MIT') &&
        runtimeJs.includes('studynavStudyDataV2') && runtimeJs.includes('studynavStudyDataV1') &&
        runtimeJs.includes('Resume at '),
      `${name}: audited local QR notice, study schema, and explicit resume runtime are bundled`,
    );
    ok(iconSource.includes('fill="#43669F"'), `${name}: toolbar icon source uses the primary accent`);
  }
}

console.log('\n== public StudyNav guide ==');
const guideCss = readFileSync(join(root, 'site', 'assets', 'site.css'), 'utf8');
const musicPrompt = readFileSync(join(root, 'site', 'assets', 'narration', 'studynav-music-prompt.md'), 'utf8');
const musicPromptBody = (musicPrompt.match(/## Prompt\s+([\s\S]*?)(?:\n## |$)/)?.[1] ?? '').replace(/\s+/g, ' ');
const musicPromptExclusions = (musicPrompt.match(/## Exclude Styles\s+([\s\S]*?)(?:\n## |$)/)?.[1] ?? '').replace(/\s+/g, ' ');
ok(
  guideCss.includes('color-scheme: dark') &&
    guideCss.includes('--paper: #0b1018') &&
    guideCss.includes('--accent: #43669f'),
  'StudyNav guide uses the dark default palette and product accent',
);
ok(
  musicPrompt.includes('# Eleven Music setup') &&
    musicPrompt.includes('Eleven Music v2') &&
    musicPrompt.includes('4 minute 40 second instrumental-only') &&
    musicPrompt.includes('## Include Styles') &&
    musicPrompt.includes('## Exclude Styles'),
  'StudyNav Eleven Music setup separates the prompt and style controls',
);
ok(
  ['drums', 'percussion', 'rhythmic pulse', 'sustained synth pads', 'humming', 'swelling pads', 'rising layers', 'dominant melody', 'noise', 'hiss'].every((term) =>
    musicPromptExclusions.includes(term)) &&
    musicPromptBody.includes('ethereal guitar ambient') &&
    musicPromptBody.includes('delicate clean electric guitar') &&
    musicPromptBody.includes('silence') &&
    !/Suno|V5\.5|92 BPM|4\/4 pulse|warm electric-piano|soft sustained synth pads/i.test(musicPromptBody),
  'StudyNav Eleven Music setup uses sparse ethereal guitar and excludes hum, builds, rhythm, dominance, and noise',
);
for (const relativeHtml of ['site/index.html', 'site/ru/index.html']) {
  const htmlPath = join(root, relativeHtml);
  const html = readFileSync(htmlPath, 'utf8');
  const htmlDir = dirname(htmlPath);
  ok((html.match(/data-feature-row/g) || []).length === 23, `${relativeHtml}: documents all 23 settings`);
  ok((html.match(/data-scene=/g) || []).length === 23, `${relativeHtml}: exposes all 23 tutorial chapters`);
  ok(
    html.includes('data-demo-root') &&
      !/<(?:img|video|source)[^>]+(?:jw\.org|jw-cdn\.org)/i.test(html),
    `${relativeHtml}: uses a self-contained interactive extension demo`,
  );
  ok(/not produced, endorsed|не выпускается, не поддерживается и не одобряется/i.test(html), `${relativeHtml}: clear non-affiliation statement`);
  const expectedDuration = relativeHtml.includes('/ru/') ? '4:35' : '4:17';
  ok(html.includes(`23 ${relativeHtml.includes('/ru/') ? 'главы' : 'chapters'} · ${expectedDuration}`),
    `${relativeHtml}: final narrated tutorial duration is visible`);
  ok(/1\.6\.0/.test(html), `${relativeHtml}: current release is visible`);
  const releaseGuideTokens = relativeHtml.includes('/ru/')
    ? ['Нажмите на цветное выделение', 'Запятая или Enter', 'StudyNav · видео', 'Путь к папке не меняйте']
    : ['Click the colored highlight', 'Comma or Enter', 'StudyNav video', 'Keep that folder at the same path'];
  ok(
    html.includes('id="release-160"') &&
      html.includes('assets/screenshots/19-note-rail.png') &&
      html.includes('assets/screenshots/20-media-tools-menu.png') &&
      releaseGuideTokens.every((token) => html.includes(token)),
    `${relativeHtml}: explains the StudyNav 1.6.0 note, media, and safe-update workflows`,
  );
  ok(
    html.includes('demo-note-tags') && html.includes('demo-note-actions'),
    `${relativeHtml}: interactive preview shows tag chips plus visible note actions`,
  );
  ok(/several consecutive verses|несколько стихов подряд/i.test(html), `${relativeHtml}: consecutive verse audio is explained`);
  ok(
    !/slower learning|red (?:ring|circle)|product choices|production note|animation direction|focus marker|render pipeline|более медленное(?: и понятное)? обучение|красное кольцо|продуктовые решения|внутренн(?:ий|его) беклог|указани[ея] для анимации|маркер показывает, куда смотреть|процесс монтажа/i.test(html),
    `${relativeHtml}: internal production copy is absent`,
  );

  const localRefs = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)]
    .map((match) => match[1])
    .filter((value) => !/^(?:https?:|mailto:|data:)/.test(value));
  for (const reference of localRefs) {
    ok(existsSync(join(htmlDir, reference)), `${relativeHtml}: local asset ${reference}`);
  }
}

for (const language of ['en', 'ru']) {
  const video = join(root, 'site', 'assets', 'video', `studynav-guide-${language}.mp4`);
  const poster = join(root, 'site', 'assets', 'screenshots', `tutorial-poster-${language}.jpg`);
  ok(nonEmpty(video) && statSync(video).size > 500_000 && statSync(video).size < 99_500_000,
    `StudyNav ${language}: bounded publishable tutorial MP4`);
  ok(nonEmpty(poster) && statSync(poster).size > 10_000,
    `StudyNav ${language}: non-empty tutorial poster`);
  if (nonEmpty(video)) {
    const header = readFileSync(video).subarray(0, 32).toString('ascii');
    ok(header.includes('ftyp'), `StudyNav ${language}: MP4 container signature`);
  }
}

for (const language of ['en', 'ru']) {
  const voiceoverPath = join(root, 'site', 'assets', 'narration', `studynav-voiceover-${language}.md`);
  const elevenLabsPath = join(root, 'site', 'assets', 'narration', `studynav-elevenlabs-${language}.txt`);
  ok(nonEmpty(voiceoverPath), `StudyNav ${language}: non-empty narration and edit map`);
  ok(nonEmpty(elevenLabsPath), `StudyNav ${language}: non-empty clean ElevenLabs input`);
  if (!nonEmpty(voiceoverPath) || !nonEmpty(elevenLabsPath)) continue;

  const voiceover = readFileSync(voiceoverPath, 'utf8');
  const elevenLabs = readFileSync(elevenLabsPath, 'utf8').trim();
  const cleanParagraphs = elevenLabs.split(/\n\s*\n/).map((paragraph) => paragraph.replace(/\s+/g, ' ').trim());
  const label = language === 'ru' ? 'Озвучка' : 'Voice-over';
  const spokenLines = [...voiceover.matchAll(new RegExp(`\\*\\*${label}:\\*\\*\\s+(.+)`, 'g'))]
    .map((match) => match[1].replace(/\s+/g, ' ').trim());

  ok(cleanParagraphs.length === 25, `StudyNav ${language}: ElevenLabs input has exactly 25 spoken paragraphs`);
  ok(spokenLines.length === 25, `StudyNav ${language}: edit map has exactly 25 spoken scenes`);
  ok(
    JSON.stringify(cleanParagraphs) === JSON.stringify(spokenLines),
    `StudyNav ${language}: ElevenLabs input exactly matches the edit-map narration`,
  );
  ok(
    !/^(?:#|\*\*(?:Edit|Voice-over|Монтаж|Озвучка):)|(?:Edit|Монтаж):/m.test(elevenLabs),
    `StudyNav ${language}: ElevenLabs input contains speech only`,
  );
}

const tutorialManifest = JSON.parse(readFileSync(join(root, 'scripts', 'studynav-tutorial-scenes.json'), 'utf8'));
ok(tutorialManifest.features?.length === 23 && new Set(tutorialManifest.features.map((item) => item.id)).size === 23 &&
  tutorialManifest.size?.[0] === 2560 && tutorialManifest.size?.[1] === 1440 && tutorialManifest.fps === 60,
  'StudyNav tutorial manifest has 23 unique high-resolution feature chapters');
const publishedTutorialManifest = JSON.parse(readFileSync(
  join(root, 'site', 'assets', 'video', 'studynav-guide-manifest.json'),
  'utf8',
));
const vttTimeSeconds = (value) => {
  const [hours, minutes, seconds] = value.split(':').map(Number);
  return hours * 3_600 + minutes * 60 + seconds;
};
for (const language of ['en', 'ru']) {
  const durations = tutorialManifest.timelines?.[language];
  const expected = tutorialManifest.audio?.expectedDurations?.[language];
  ok(
    Array.isArray(durations) && durations.length === 25 &&
      durations.every((duration) => Number.isFinite(duration) && duration >= 5) &&
      Math.abs(durations.reduce((sum, duration) => sum + duration, 0) - expected) < 0.05,
    `StudyNav ${language}: 25 narration-aligned scene durations match the final recording`,
  );
  const timeline = publishedTutorialManifest.languages?.[language];
  const expectedFinalDuration = expected + tutorialManifest.audio.voiceLeadSeconds +
    tutorialManifest.audio.outroHoldSeconds;
  let expectedStart = tutorialManifest.audio.voiceLeadSeconds + durations[0];
  const publishedScenesMatch = timeline?.scenes?.length === tutorialManifest.features.length &&
    timeline.scenes.every((scene, index) => {
      const matches = scene.id === tutorialManifest.features[index].id &&
        Math.abs(scene.start - expectedStart) < 0.002 &&
        Math.abs(scene.duration - durations[index + 1]) < 0.002;
      expectedStart += durations[index + 1];
      return matches;
    });
  ok(
    publishedScenesMatch && Math.abs(timeline.duration - expectedFinalDuration) < 0.002,
    `StudyNav ${language}: published chapter manifest matches the final narration timeline`,
  );

  const chapterVtt = readFileSync(
    join(root, 'site', 'assets', 'video', `studynav-guide-${language}-chapters.vtt`),
    'utf8',
  );
  const vttCues = [...chapterVtt.matchAll(
    /^(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})\n(.+)$/gm,
  )];
  ok(
    vttCues.length === timeline.scenes.length && vttCues.every((cue, index) => {
      const scene = timeline.scenes[index];
      return Math.abs(vttTimeSeconds(cue[1]) - scene.start) < 0.002 &&
        Math.abs(vttTimeSeconds(cue[2]) - (scene.start + scene.duration)) < 0.002 &&
        cue[3].trim() === tutorialManifest.features[index][language].title;
    }),
    `StudyNav ${language}: all published VTT cues match the localized chapter manifest`,
  );
}
const guideScript = readFileSync(join(root, 'site', 'assets', 'site.js'), 'utf8');
ok(guideScript.includes("manifest.languages?.[locale]"),
  'StudyNav guide selects the chapter timeline for its current language');
const tutorialBuilder = readFileSync(join(root, 'scripts', 'build-studynav-tutorial.mjs'), 'utf8');
ok(
  ['STUDYNAV_NARRATION_EN', 'STUDYNAV_NARRATION_RU', 'STUDYNAV_MUSIC', 'sidechaincompress', 'loudnorm=I=']
    .every((token) => tutorialBuilder.includes(token)) && !tutorialBuilder.includes('atempo='),
  'StudyNav tutorial builder uses the supplied voices, ducks music, and never time-stretches narration',
);

console.log('\n' + (failed ? `FAILED (${failed})` : 'ALL CHECKS PASSED'));
process.exit(failed ? 1 : 0);
