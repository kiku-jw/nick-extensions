export const DNR_RESOURCE_TYPES = [
  'main_frame',
  'sub_frame',
  'stylesheet',
  'script',
  'image',
  'font',
  'object',
  'xmlhttprequest',
  'ping',
  'media',
  'websocket',
  'other',
] as const;

export const FRAME_DNR_RESOURCE_TYPES = ['main_frame', 'sub_frame'] as const;

export const SUBRESOURCE_DNR_RESOURCE_TYPES = [
  'sub_frame',
  'stylesheet',
  'script',
  'image',
  'font',
  'object',
  'xmlhttprequest',
  'ping',
  'media',
  'websocket',
  'other',
] as const;

export type DnrResourceTypeValue = (typeof DNR_RESOURCE_TYPES)[number];
export type AllowlistRuleActionType = 'allowAllRequests' | 'allow';

export type AllowlistRuleSpec = {
  id: number;
  priority: number;
  actionType: AllowlistRuleActionType;
  initiatorDomains: [string];
  resourceTypes: readonly DnrResourceTypeValue[];
};

export type SerialTaskQueue = <T>(task: () => Promise<T> | T) => Promise<T>;

const RULE_ID_ALLOW_ALL_BASE = 10_000;
const RULE_ID_ALLOW_BASE = 20_000;

function isValidIpv4(host: string): boolean {
  const parts = host.split('.');
  if (parts.length !== 4) return false;
  return parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
}

function isValidDomainLabel(label: string): boolean {
  if (!/^(xn--)?[a-z0-9-]+$/.test(label)) return false;
  return !label.startsWith('-') && !label.endsWith('-');
}

function isValidHostname(host: string): boolean {
  if (!host || host.length > 253 || host.includes(':')) return false;
  if (isValidIpv4(host)) return true;
  const labels = host.split('.');
  return labels.every((label) => label.length > 0 && label.length <= 63 && isValidDomainLabel(label));
}

function looksLikeHostWithPort(raw: string): boolean {
  return /^(?:localhost|[a-z0-9-]+(?:\.[a-z0-9-]+)*):\d+(?:[/?#]|$)/i.test(raw);
}

export function normalizeHostname(raw: string | null | undefined): string | null {
  const input = String(raw ?? '').trim();
  if (!input) return null;

  let candidate = input;
  const lower = input.toLowerCase();
  if (candidate.startsWith('//')) {
    candidate = `https:${candidate}`;
  } else if (!lower.startsWith('http://') && !lower.startsWith('https://')) {
    const hasExplicitScheme = /^[a-z][a-z0-9+.-]*:/i.test(candidate);
    if (hasExplicitScheme && !looksLikeHostWithPort(candidate)) return null;
    candidate = `https://${candidate}`;
  }

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const hostname = url.hostname.trim().toLowerCase().replace(/^\.+/, '').replace(/\.+$/, '');
    return isValidHostname(hostname) ? hostname : null;
  } catch {
    return null;
  }
}

export function normalizeAllowlistHosts(values: Iterable<unknown>): string[] {
  const normalized = new Set<string>();
  for (const value of values) {
    const host = normalizeHostname(typeof value === 'string' ? value : String(value ?? ''));
    if (host) normalized.add(host);
  }
  return [...normalized].sort();
}

export function siteHostFromUrl(raw: string | null | undefined): string | null {
  const input = String(raw ?? '').trim();
  if (!input) return null;
  try {
    const url = new URL(input);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return normalizeHostname(url.hostname);
  } catch {
    return null;
  }
}

export function isAllowlistedHost(allowlist: Iterable<string>, host: string | null | undefined): boolean {
  const candidate = normalizeHostname(host);
  if (!candidate) return false;
  for (const entry of allowlist) {
    const normalized = normalizeHostname(entry);
    if (!normalized) continue;
    if (candidate === normalized || candidate.endsWith(`.${normalized}`)) return true;
  }
  return false;
}

export function buildAllowlistRuleSpecs(allowlist: Iterable<unknown>): AllowlistRuleSpec[] {
  return normalizeAllowlistHosts(allowlist).flatMap((domain, index) => [
    {
      id: RULE_ID_ALLOW_ALL_BASE + index,
      priority: 100,
      actionType: 'allowAllRequests' as const,
      initiatorDomains: [domain],
      resourceTypes: FRAME_DNR_RESOURCE_TYPES,
    },
    {
      id: RULE_ID_ALLOW_BASE + index,
      priority: 100,
      actionType: 'allow' as const,
      initiatorDomains: [domain],
      resourceTypes: SUBRESOURCE_DNR_RESOURCE_TYPES,
    },
  ]);
}

export function createSerialTaskQueue(): SerialTaskQueue {
  let tail = Promise.resolve();

  return async function enqueue<T>(task: () => Promise<T> | T): Promise<T> {
    const run = tail.catch(() => undefined).then(task);
    tail = run.then(() => undefined, () => undefined);
    return run;
  };
}
