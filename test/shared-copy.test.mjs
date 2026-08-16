import { afterEach, describe, expect, test } from 'bun:test';

import { copyToClipboard } from '../packages/shared/src/index.ts';

const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
const originalDocumentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');

afterEach(() => {
  if (originalNavigatorDescriptor) Object.defineProperty(globalThis, 'navigator', originalNavigatorDescriptor);
  else delete globalThis.navigator;
  if (originalDocumentDescriptor) Object.defineProperty(globalThis, 'document', originalDocumentDescriptor);
  else delete globalThis.document;
});

function installCopyEnvironment({ clipboardFails, execSucceeds }) {
  const textarea = {
    value: '',
    style: {},
    select() {},
    remove() {},
  };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      clipboard: {
        async writeText() {
          if (clipboardFails) throw new Error('clipboard unavailable');
        },
      },
    },
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      body: { appendChild() {} },
      createElement() { return textarea; },
      execCommand(command) { return command === 'copy' && execSucceeds; },
    },
  });
}

describe('shared clipboard boundary', () => {
  test('uses the fallback only when the Clipboard API fails', async () => {
    installCopyEnvironment({ clipboardFails: true, execSucceeds: true });
    expect(await copyToClipboard('citation')).toBe(true);
  });

  test('reports failure when both browser copy paths reject', async () => {
    installCopyEnvironment({ clipboardFails: true, execSucceeds: false });
    expect(await copyToClipboard('citation')).toBe(false);
  });
});
