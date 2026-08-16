/**
 * Original mnemonic -> URL resolver for public jw.org / wol.jw.org library content.
 * Uses public publication symbols and search/finder URLs only.
 */
export type NavTarget = { label: string; url: string };

export const WOL_ROUTE_BY_LANG = {
  en: { route: 'r1', locale: 'lp-e' },
  ru: { route: 'r2', locale: 'lp-u' },
  uk: { route: 'r15', locale: 'lp-k' },
} as const;

type WolRoute = (typeof WOL_ROUTE_BY_LANG)[keyof typeof WOL_ROUTE_BY_LANG];

const MONTHS = ['', 'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

export function langFromPath(pathname: string): string {
  const m = pathname.match(/^\/([a-z]{2}(?:-[a-z]+)?)(\/|$)/i);
  return (m?.[1] || 'en').toLowerCase();
}

export function wolRouteForLang(lang: string): WolRoute | null {
  return WOL_ROUTE_BY_LANG[lang as keyof typeof WOL_ROUTE_BY_LANG] ?? null;
}

function jwSearch(lang: string, q: string) {
  return `https://www.jw.org/${lang}/search/?q=${encodeURIComponent(q)}`;
}

function libraryFinder(lang: string, q: string) {
  return `https://www.jw.org/${lang}/library/?q=${encodeURIComponent(q)}`;
}

export function wolSearchUrl(lang: string, q: string): string | null {
  const route = wolRouteForLang(lang);
  if (!route) return null;
  return `https://wol.jw.org/${lang}/wol/s/${route.route}/${route.locale}?q=${encodeURIComponent(q)}`;
}

export function wolDocumentUrl(lang: string, docId: string): string | null {
  const route = wolRouteForLang(lang);
  if (!route) return null;
  return `https://wol.jw.org/${lang}/wol/d/${route.route}/${route.locale}/${docId}`;
}

function pushIfUrl(out: NavTarget[], label: string, url: string | null) {
  if (url) out.push({ label, url });
}

export function resolveQueryForLang(q: string, lang: string): NavTarget[] {
  const query = q.trim();
  if (!query) return [];

  const out: NavTarget[] = [];

  if (/^\d{6,}$/.test(query)) {
    out.push({ label: `DOCID ${query} - jw.org search`, url: jwSearch(lang, query) });
    pushIfUrl(out, `DOCID ${query} - WOL document`, wolDocumentUrl(lang, query));
    out.push({ label: `DOCID ${query} - library finder`, url: libraryFinder(lang, query) });
    return out;
  }

  let m = query.match(/^w\s*(\d{2})\.(\d{1,2})$/i) || query.match(/^w\s*(\d{2})\s+(\d{1,2})$/i);
  if (m) {
    const yy = m[1];
    const mm = m[2].padStart(2, '0');
    const month = MONTHS[Number(mm)] || mm;
    out.push({
      label: `Watchtower Study w${yy}.${mm}`,
      url: `https://www.jw.org/${lang}/library/magazines/?contentLanguageFilter=${lang}&pubFilter=w&yearFilter=20${yy}`,
    });
    out.push({
      label: `Search Watchtower Study ${month} 20${yy}`,
      url: jwSearch(lang, `w${yy}.${mm}`),
    });
    pushIfUrl(out, `WOL search w${yy}.${mm}`, wolSearchUrl(lang, `w${yy}.${mm}`));
  }

  m = query.match(/^wp\s*(\d{2})\.(\d{1,2})$/i);
  if (m) {
    const yy = m[1];
    const mm = m[2].padStart(2, '0');
    out.push({ label: `Watchtower (Public) wp${yy}.${mm}`, url: jwSearch(lang, `wp${yy}.${mm}`) });
    out.push({
      label: `Magazines filter wp 20${yy}`,
      url: `https://www.jw.org/${lang}/library/magazines/?pubFilter=wp&yearFilter=20${yy}`,
    });
  }

  m = query.match(/^g\s*(\d{2})\.(\d{1,2})$/i);
  if (m) {
    out.push({ label: `Awake! g${m[1]}.${m[2]}`, url: jwSearch(lang, `g${m[1]}.${m[2]}`) });
    out.push({
      label: `Awake! magazines 20${m[1]}`,
      url: `https://www.jw.org/${lang}/library/magazines/?pubFilter=g&yearFilter=20${m[1]}`,
    });
  }

  m = query.match(/^mwb\s*(\d{2})\.(\d{1,2})$/i) || query.match(/^mw\s*(\d{2})\.(\d{1,2})$/i);
  if (m) {
    const yy = m[1];
    const mm = m[2].padStart(2, '0');
    out.push({ label: `Meeting Workbook mwb${yy}.${mm}`, url: jwSearch(lang, `mwb${yy}.${mm}`) });
    pushIfUrl(out, `WOL search mwb${yy}.${mm}`, wolSearchUrl(lang, `mwb${yy}.${mm}`));
  }

  const pubs: Record<string, { title: string; paths: Array<string | null> }> = {
    lff: {
      title: 'Enjoy Life Forever!',
      paths: [
        `https://www.jw.org/${lang}/library/books/enjoy-life-forever/`,
        jwSearch(lang, 'lff'),
      ],
    },
    nwtsty: {
      title: 'NWT Study Bible',
      paths: [
        `https://www.jw.org/${lang}/library/bible/study-bible/books/`,
        jwSearch(lang, 'nwtsty'),
      ],
    },
    nwt: {
      title: 'New World Translation',
      paths: [
        `https://www.jw.org/${lang}/library/bible/`,
        jwSearch(lang, 'nwt'),
      ],
    },
    bh: {
      title: 'What Does the Bible Really Teach?',
      paths: [jwSearch(lang, 'bh'), libraryFinder(lang, 'bh')],
    },
    bt: {
      title: 'Bible Teach',
      paths: [jwSearch(lang, 'bt')],
    },
    jy: {
      title: 'Jesus-The Way',
      paths: [jwSearch(lang, 'jy'), libraryFinder(lang, 'jy')],
    },
    it: {
      title: 'Insight on the Scriptures',
      paths: [wolSearchUrl(lang, 'it'), jwSearch(lang, 'insight')],
    },
    w: {
      title: 'The Watchtower',
      paths: [
        `https://www.jw.org/${lang}/library/magazines/?pubFilter=w`,
        jwSearch(lang, 'watchtower'),
      ],
    },
    wp: {
      title: 'Watchtower (Public)',
      paths: [
        `https://www.jw.org/${lang}/library/magazines/?pubFilter=wp`,
        jwSearch(lang, 'wp'),
      ],
    },
    g: {
      title: 'Awake!',
      paths: [
        `https://www.jw.org/${lang}/library/magazines/?pubFilter=g`,
        jwSearch(lang, 'awake'),
      ],
    },
    mwb: {
      title: 'Meeting Workbook',
      paths: [jwSearch(lang, 'mwb'), wolSearchUrl(lang, 'mwb')],
    },
    sjj: {
      title: 'Sing Out Joyfully',
      paths: [jwSearch(lang, 'sjj'), libraryFinder(lang, 'sjj')],
    },
    ijwbq: {
      title: 'Research Guide / index',
      paths: [jwSearch(lang, 'ijwbq'), wolSearchUrl(lang, 'ijwbq')],
    },
  };

  const key = query.toLowerCase();
  if (pubs[key]) {
    const pub = pubs[key];
    pub.paths.forEach((url, i) => {
      if (!url) return;
      out.push({ label: `${pub.title} (${key})${i ? ` - alt ${i}` : ''}`, url });
    });
  }

  out.push({ label: `Search "${query}" on jw.org`, url: jwSearch(lang, query) });
  pushIfUrl(out, `Search "${query}" on WOL`, wolSearchUrl(lang, query));
  out.push({ label: `Library finder "${query}"`, url: libraryFinder(lang, query) });

  const seen = new Set<string>();
  return out.filter((target) => (seen.has(target.url) ? false : (seen.add(target.url), true)));
}

export function resolveQuery(q: string): NavTarget[] {
  return resolveQueryForLang(q, langFromPath(location.pathname));
}
