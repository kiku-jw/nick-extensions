import { describe, expect, test } from 'bun:test';

import {
  buildAllowlistRuleSpecs,
  createSerialTaskQueue,
  isAllowlistedHost,
  normalizeAllowlistHosts,
  normalizeHostname,
  siteHostFromUrl,
  SUBRESOURCE_DNR_RESOURCE_TYPES,
} from '../packages/clearshield/src/hosts';
import { COSMETIC_SELECTORS } from '../packages/clearshield/src/cosmetic';
import { coerceSettings } from '../packages/clearshield/src/types';

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('normalizeHostname', () => {
  test('strips scheme, credentials, port, path, query, and fragment', () => {
    expect(normalizeHostname('  HTTPS://User:Pass@Sub.Example.com:8443/path?q=1#hash  ')).toBe('sub.example.com');
  });

  test('accepts bare hosts and host:port inputs', () => {
    expect(normalizeHostname('Example.com')).toBe('example.com');
    expect(normalizeHostname('localhost:3000/dashboard')).toBe('localhost');
  });

  test('rejects non-httpish and malformed hosts', () => {
    expect(normalizeHostname('chrome://extensions')).toBeNull();
    expect(normalizeHostname('mailto:test@example.com')).toBeNull();
    expect(normalizeHostname('exa_mple.com')).toBeNull();
    expect(normalizeHostname('http://[::1]:3000')).toBeNull();
  });
});

describe('allowlist helpers', () => {
  test('normalizes, deduplicates, sorts, and filters invalid entries', () => {
    expect(
      normalizeAllowlistHosts([
        ' Example.com ',
        'https://example.com/path',
        'sub.example.com',
        'chrome://extensions',
        'localhost:3000',
      ]),
    ).toEqual(['example.com', 'localhost', 'sub.example.com']);
  });

  test('matches exact hosts and subdomains', () => {
    expect(isAllowlistedHost(['example.com'], 'example.com')).toBe(true);
    expect(isAllowlistedHost(['example.com'], 'cdn.example.com')).toBe(true);
    expect(isAllowlistedHost(['example.com'], 'fakeexample.com')).toBe(false);
  });

  test('returns site host only for http-ish page urls', () => {
    expect(siteHostFromUrl('https://sub.example.com:8443/path')).toBe('sub.example.com');
    expect(siteHostFromUrl('chrome://extensions/')).toBeNull();
    expect(siteHostFromUrl('about:blank')).toBeNull();
  });
});

describe('buildAllowlistRuleSpecs', () => {
  test('builds stable allowlist rules from normalized hosts', () => {
    const rules = buildAllowlistRuleSpecs(['HTTPS://Example.com/path', 'sub.example.com']);

    expect(rules).toHaveLength(4);
    expect(rules[0]).toEqual({
      id: 10_000,
      priority: 100,
      actionType: 'allowAllRequests',
      initiatorDomains: ['example.com'],
      resourceTypes: ['main_frame', 'sub_frame'],
    });
    expect(rules[1]).toEqual({
      id: 20_000,
      priority: 100,
      actionType: 'allow',
      initiatorDomains: ['example.com'],
      resourceTypes: SUBRESOURCE_DNR_RESOURCE_TYPES,
    });
    expect(rules[2]?.initiatorDomains).toEqual(['sub.example.com']);
    expect(rules[3]?.initiatorDomains).toEqual(['sub.example.com']);
  });
});

describe('coerceSettings', () => {
  test('sanitizes imported settings without preserving malformed allowlist entries', () => {
    const settings = coerceSettings({
      enabled: false,
      cosmetic: false,
      blockedTotal: 7,
      allowlist: ['https://example.com/path', 'bad host', 'localhost:5173'],
      lists: { easylist: false },
    });

    expect(settings).toEqual({
      enabled: false,
      cosmetic: false,
      blockedTotal: 7,
      allowlist: ['example.com', 'localhost'],
      lists: {
        baseline: true,
        easylist: false,
        easyprivacy: true,
      },
    });
  });
});

describe('cosmetic selector safety', () => {
  test('keeps explicit ad markers without generic structural substring guesses', () => {
    expect(COSMETIC_SELECTORS).toContain('.ad-banner');
    expect(COSMETIC_SELECTORS).toContain('[data-ad-slot]');
    expect(COSMETIC_SELECTORS).toContain('iframe[src*="doubleclick.net"]');

    expect(COSMETIC_SELECTORS).not.toContain('[data-ad]');
    expect(COSMETIC_SELECTORS).not.toContain('[data-ads]');
    expect(COSMETIC_SELECTORS.some((selector) => selector.includes('[class*='))).toBe(false);
    expect(COSMETIC_SELECTORS.some((selector) => selector.includes('[id*='))).toBe(false);
  });
});

describe('createSerialTaskQueue', () => {
  test('serializes overlapping tasks in submission order', async () => {
    const queue = createSerialTaskQueue();
    const started = deferred<void>();
    const gate = deferred<void>();
    const order: string[] = [];

    const first = queue(async () => {
      order.push('first:start');
      started.resolve();
      await gate.promise;
      order.push('first:end');
      return 1;
    });

    const second = queue(async () => {
      order.push('second');
      return 2;
    });

    await started.promise;
    expect(order).toEqual(['first:start']);

    gate.resolve();

    await expect(first).resolves.toBe(1);
    await expect(second).resolves.toBe(2);
    expect(order).toEqual(['first:start', 'first:end', 'second']);
  });

  test('continues running later tasks after a failure', async () => {
    const queue = createSerialTaskQueue();

    await expect(
      queue(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    await expect(
      queue(async () => {
        return 'ok';
      }),
    ).resolves.toBe('ok');
  });
});
