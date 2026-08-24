import { afterEach, describe, expect, test } from 'bun:test';

import {
  createTab,
  queryTabs,
  runtimeMessage,
  sendTabMessage,
  storageGet,
  storageSet,
} from '../packages/studynav/src/webext-compat.ts';

afterEach(() => {
  delete globalThis.chrome;
});

describe('StudyNav WebExtension API compatibility', () => {
  test('uses callback-only Firefox Android APIs', async () => {
    const stored = { value: 1 };
    globalThis.chrome = {
      runtime: {
        lastError: null,
        sendMessage(_message, callback) {
          callback({ ok: true });
        },
      },
      storage: {
        local: {
          get(_keys, callback) {
            callback({ ...stored });
          },
          set(items, callback) {
            Object.assign(stored, items);
            callback();
          },
        },
      },
      tabs: {
        query(_query, callback) {
          callback([{ id: 7 }]);
        },
        sendMessage(_tabId, _message, callback) {
          callback({ received: true });
        },
        create(properties, callback) {
          callback({ id: 8, url: properties.url });
        },
      },
    };

    expect(await runtimeMessage({ type: 'PING' })).toEqual({ ok: true });
    expect(await storageGet(chrome.storage.local, 'value')).toEqual({ value: 1 });
    await storageSet(chrome.storage.local, { other: 2 });
    expect(stored).toEqual({ value: 1, other: 2 });
    expect(await queryTabs({ active: true })).toEqual([{ id: 7 }]);
    expect(await sendTabMessage(7, { type: 'PING' })).toEqual({ received: true });
    expect(await createTab({ url: 'https://www.jw.org/' })).toEqual({
      id: 8,
      url: 'https://www.jw.org/',
    });
  });

  test('uses Promise-returning Chrome APIs and test doubles', async () => {
    globalThis.chrome = {
      runtime: {
        async sendMessage() {
          return { ok: true };
        },
      },
      storage: {
        local: {
          async get() {
            return { value: 3 };
          },
          async set() {},
        },
      },
      tabs: {
        async query() {
          return [{ id: 9 }];
        },
        async sendMessage() {
          return { received: true };
        },
        async create(properties) {
          return { id: 10, url: properties.url };
        },
      },
    };

    expect(await runtimeMessage({ type: 'PING' })).toEqual({ ok: true });
    expect(await storageGet(chrome.storage.local, 'value')).toEqual({ value: 3 });
    await expect(storageSet(chrome.storage.local, { value: 4 })).resolves.toBeUndefined();
    expect(await queryTabs({})).toEqual([{ id: 9 }]);
    expect(await sendTabMessage(9, { type: 'PING' })).toEqual({ received: true });
    expect(await createTab({ url: 'https://wol.jw.org/' })).toEqual({
      id: 10,
      url: 'https://wol.jw.org/',
    });
  });

  test('reports callback lastError instead of pretending the call succeeded', async () => {
    globalThis.chrome = {
      runtime: {
        lastError: null,
        sendMessage(_message, callback) {
          this.lastError = { message: 'permission denied' };
          callback(undefined);
          this.lastError = null;
        },
      },
    };

    await expect(runtimeMessage({ type: 'PING' })).rejects.toThrow('permission denied');
  });
});
