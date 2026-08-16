const SUPPORTED_HOSTS = new Set(['www.jw.org', 'jw.org', 'wol.jw.org', 'stream.jw.org']);
const TRACKING_PARAMS = new Set(['srcid', 'wtlocale', 'prefer']);

export type OfficialFinderMetadata = {
  pub?: string | null;
  bible?: string | null;
  docId?: string | null;
  wtLocale?: string | null;
};

export type CitationInput = {
  title: string;
  url: string;
  quote?: string | null;
  reference?: string | null;
};

function finiteToken(value: string | null | undefined, pattern: RegExp, maxLength: number): string | null {
  const token = String(value || '').trim();
  return token && token.length <= maxLength && pattern.test(token) ? token : null;
}

export function isSupportedJwHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && SUPPORTED_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function canonicalStudyUrl(currentUrl: string, canonicalHref?: string | null): string | null {
  const candidate = canonicalHref && isSupportedJwHttpsUrl(canonicalHref) ? canonicalHref : currentUrl;
  if (!isSupportedJwHttpsUrl(candidate)) return null;
  const url = new URL(candidate);
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(key.toLowerCase()) || key.toLowerCase().startsWith('utm_')) {
      url.searchParams.delete(key);
    }
  }
  return url.toString();
}

export function preciseStudyUrl(baseUrl: string, fragment?: string | null): string | null {
  if (!isSupportedJwHttpsUrl(baseUrl)) return null;
  const url = new URL(baseUrl);
  const cleanFragment = finiteToken(fragment, /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/, 128);
  if (cleanFragment) url.hash = cleanFragment;
  return url.toString();
}

export function buildOfficialFinderUrl(metadata: OfficialFinderMetadata): string | null {
  const wtLocale = finiteToken(metadata.wtLocale, /^[A-Za-z][A-Za-z0-9-]{0,7}$/, 8);
  if (!wtLocale) return null;

  const pub = finiteToken(metadata.pub, /^[A-Za-z0-9-]{1,32}$/, 32);
  const bible = finiteToken(metadata.bible, /^\d{7,12}$/, 12);
  const docId = finiteToken(metadata.docId, /^\d{6,16}$/, 16);
  const url = new URL('https://www.jw.org/finder');

  if (pub && bible) {
    url.searchParams.set('pub', pub);
    url.searchParams.set('bible', bible);
  } else if (docId) {
    url.searchParams.set('docid', docId);
  } else {
    return null;
  }

  url.searchParams.set('wtlocale', wtLocale.toUpperCase());
  url.searchParams.set('srcid', 'share');
  return url.toString();
}

export function cleanCitationText(value: string): string {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncateCitationQuote(value: string, maxLength = 500): string {
  const clean = cleanCitationText(value);
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}

export function formatOnlineCitation(input: CitationInput): string | null {
  if (!isSupportedJwHttpsUrl(input.url)) return null;
  const title = cleanCitationText(input.title) || 'JW.ORG';
  const quote = truncateCitationQuote(input.quote || '');
  const reference = cleanCitationText(input.reference || '');
  if (!quote) return `${title}. JW.ORG: ${input.url}`;
  const source = reference ? `${reference}. ${title}` : title;
  return `“${quote}” — ${source}. JW.ORG: ${input.url}`;
}
