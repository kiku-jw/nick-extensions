import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = join(__dirname, '..');
const rawDir = join(pkg, 'rules-raw');
const outDir = join(pkg, 'public', 'rules');
mkdirSync(rawDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

const LISTS = [
  { id: 'easylist', url: 'https://easylist.to/easylist/easylist.txt', max: 12000 },
  { id: 'easyprivacy', url: 'https://easylist.to/easylist/easyprivacy.txt', max: 8000 },
];

async function download(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': 'ClearShield-build/1.1 (local; filter conversion)' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const text = await res.text();
  writeFileSync(dest, text);
  return text;
}

function convert(text, startId, maxRules) {
  const lines = text.split(/\r?\n/);
  const rules = [];
  const seen = new Set();
  let id = startId;
  const resourceTypes = [
    'main_frame','sub_frame','stylesheet','script','image','font','object',
    'xmlhttprequest','ping','media','websocket','other'
  ];

  for (const raw of lines) {
    if (rules.length >= maxRules) break;
    let line = raw.trim();
    if (!line || line.startsWith('!') || line.startsWith('[') || line.startsWith('##') || line.startsWith('#@#') || line.startsWith('#?#') || line.startsWith('#$#')) continue;
    if (line.startsWith('@@')) continue;
    if (line.includes('##') || line.includes('#@#')) continue;

    let options = '';
    const dollar = line.indexOf('$');
    if (dollar !== -1) {
      options = line.slice(dollar + 1);
      line = line.slice(0, dollar);
    }
    if (options && /csp=|redirect=|rewrite=|removeparam|permissions=/.test(options)) continue;

    let thirdParty = false;
    let types = null;
    if (options) {
      const partsOpt = options.split(',');
      let skip = false;
      for (const p of partsOpt) {
        if (p === 'third-party' || p === '3p') thirdParty = true;
        else if (p === 'first-party' || p === '1p') { skip = true; break; }
        else if (p.startsWith('domain=')) { skip = true; break; } // domain-limited rules need requestDomains; skip to stay under budgets safely
        else if (p === 'script') types = ['script'];
        else if (p === 'image') types = ['image'];
        else if (p === 'xmlhttprequest' || p === 'xhr') types = ['xmlhttprequest'];
        else if (p === 'subdocument') types = ['sub_frame'];
        else if (p === 'websocket') types = ['websocket'];
        else if (p === 'ping') types = ['ping'];
        else if (p === 'media') types = ['media'];
        else if (p === 'font') types = ['font'];
        else if (p === 'stylesheet') types = ['stylesheet'];
        else if (p.startsWith('~')) continue;
        else if (['popup','document','elemhide','generichide','inline-script','match-case'].includes(p)) { skip = true; break; }
      }
      if (skip) continue;
    }

    let urlFilter = null;
    if (line.startsWith('||')) urlFilter = '||' + line.slice(2);
    else if (line.startsWith('|http')) urlFilter = line.slice(1);
    else if (line.startsWith('/') && line.endsWith('/') && line.length > 2) continue; // regex unsupported
    else if (/^[a-z0-9.*_-]+$/i.test(line) && line.includes('.')) urlFilter = '||' + line.replace(/^\|+/, '');
    else if (/^[a-z0-9/_.?=*&%-]+$/i.test(line) && line.length >= 4) urlFilter = line;
    else continue;

    // Normalize trailing separators that confuse DNR
    urlFilter = urlFilter.replace(/\^+$/, '^');
    if (!urlFilter || urlFilter.length < 4 || urlFilter.length > 1000) continue;
    if (urlFilter === '||' || urlFilter === '*' || urlFilter === '||^') continue;
    if (/[\u0000-\u001f<>`]/.test(urlFilter)) continue;
    // Avoid filters that are only wildcards
    if (/^\|+[\*\^]+$/.test(urlFilter)) continue;

    const key = urlFilter + '|' + (types ? types.join(',') : '') + (thirdParty ? '|3p' : '');
    if (seen.has(key)) continue;
    seen.add(key);

    const condition = {
      urlFilter,
      resourceTypes: types || resourceTypes.filter((t) => t !== 'main_frame'),
    };
    if (thirdParty) condition.domainType = 'thirdParty';

    rules.push({ id: id++, priority: 1, action: { type: 'block' }, condition });
  }
  return rules;
}

const attribution = `# Filter list attribution

ClearShield downloads EasyList and EasyPrivacy at build time and converts a practical subset into Chrome declarativeNetRequest JSON.

- EasyList / EasyPrivacy: https://easylist.to/
- About/license: https://easylist.to/pages/about.html

ClearShield converter and extension code are MIT-licensed.
Complex features (scriptlets, redirects, full cosmetic engine) are out of scope for v1.x.

Static rule budget targets used by this converter:
- EasyList: max 12000
- EasyPrivacy: max 8000
- Baseline: small bundled host list
`;
writeFileSync(join(outDir, 'ATTRIBUTION.md'), attribution);

const baselineHosts = [
  'doubleclick.net','googleadservices.com','googlesyndication.com','adservice.google.com',
  'pagead2.googlesyndication.com','static.ads-twitter.com','scorecardresearch.com',
  'quantserve.com','hotjar.com','clarity.ms','mixpanel.com','segment.io','segment.com',
  'adnxs.com','adsrvr.org','criteo.com','taboola.com','outbrain.com',
  'openx.net','pubmatic.com','rubiconproject.com','casalemedia.com','moatads.com',
  'amazon-adsystem.com','media.net','yieldmo.com','adsafeprotected.com',
  'facebook.net','connect.facebook.net','ads-twitter.com','analytics.twitter.com',
];
const baseline = baselineHosts.map((host, i) => ({
  id: i + 1,
  priority: 2,
  action: { type: 'block' },
  condition: {
    urlFilter: '||' + host + '^',
    resourceTypes: ['script','image','xmlhttprequest','sub_frame','ping','websocket','media','other'],
  },
}));

let easylistRules = [];
let easyprivacyRules = [];

async function loadOrFetch(list) {
  const rawPath = join(rawDir, list.id + '.txt');
  try {
    const text = await download(list.url, rawPath);
    return text;
  } catch (e) {
    console.warn(list.id, 'download failed:', e.message);
    if (existsSync(rawPath)) {
      console.warn('using cached', rawPath);
      return readFileSync(rawPath, 'utf8');
    }
    throw e;
  }
}

try {
  const el = await loadOrFetch(LISTS[0]);
  easylistRules = convert(el, 1, LISTS[0].max);
  console.log('easylist rules', easylistRules.length);
} catch (e) {
  console.warn('EasyList unavailable', e.message);
  const prev = join(outDir, 'easylist.json');
  if (existsSync(prev)) {
    easylistRules = JSON.parse(readFileSync(prev, 'utf8'));
    console.warn('kept previous easylist.json', easylistRules.length);
  }
}
try {
  const ep = await loadOrFetch(LISTS[1]);
  easyprivacyRules = convert(ep, 1, LISTS[1].max);
  console.log('easyprivacy rules', easyprivacyRules.length);
} catch (e) {
  console.warn('EasyPrivacy unavailable', e.message);
  const prev = join(outDir, 'easyprivacy.json');
  if (existsSync(prev)) {
    easyprivacyRules = JSON.parse(readFileSync(prev, 'utf8'));
    console.warn('kept previous easyprivacy.json', easyprivacyRules.length);
  }
}

if (easylistRules.length < 100) console.warn('WARNING: easylist rules suspiciously low:', easylistRules.length);
if (easyprivacyRules.length < 100) console.warn('WARNING: easyprivacy rules suspiciously low:', easyprivacyRules.length);

writeFileSync(join(outDir, 'easylist.json'), JSON.stringify(easylistRules));
writeFileSync(join(outDir, 'easyprivacy.json'), JSON.stringify(easyprivacyRules));
writeFileSync(join(outDir, 'baseline.json'), JSON.stringify(baseline));
const counts = {
  easylist: easylistRules.length,
  easyprivacy: easyprivacyRules.length,
  baseline: baseline.length,
  caps: { easylist: LISTS[0].max, easyprivacy: LISTS[1].max },
  generatedAt: new Date().toISOString(),
};
writeFileSync(join(outDir, 'counts.json'), JSON.stringify(counts, null, 2));
console.log('wrote rules to', outDir, counts);
