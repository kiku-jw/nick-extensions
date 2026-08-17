export const STUDYNAV_PAGE_HOSTS = ['jw.org', 'www.jw.org', 'wol.jw.org'] as const;

const allowedHosts = new Set<string>(STUDYNAV_PAGE_HOSTS);

export function isAllowedStudyNavHostname(hostname: string): boolean {
  return allowedHosts.has(String(hostname || '').toLowerCase());
}

export function isAllowedStudyNavPageUrl(value: string | URL): boolean {
  try {
    const url = typeof value === 'string' ? new URL(value) : value;
    return url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      isAllowedStudyNavHostname(url.hostname);
  } catch {
    return false;
  }
}
