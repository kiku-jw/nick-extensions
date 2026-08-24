function runtimeError(): Error | null {
  try {
    const error = chrome.runtime?.lastError;
    return error ? new Error(error.message) : null;
  } catch {
    return null;
  }
}

function compatibleCall<T>(
  invoke: (callback: (value: T) => void) => unknown,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (value: T) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const callback = (value: T) => {
      const error = runtimeError();
      if (error) fail(error);
      else finish(value);
    };

    try {
      const result = invoke(callback);
      if (result && typeof (result as PromiseLike<T>).then === 'function') {
        Promise.resolve(result as PromiseLike<T>).then(finish, fail);
      }
    } catch (error) {
      fail(error);
    }
  });
}

export function runtimeMessage<T = unknown>(message: unknown): Promise<T> {
  return compatibleCall<T>((callback) => chrome.runtime.sendMessage(message, callback));
}

export function storageGet(
  area: chrome.storage.StorageArea,
  keys?: string | string[] | Record<string, unknown> | null,
): Promise<Record<string, unknown>> {
  return compatibleCall<Record<string, unknown>>((callback) => area.get(keys ?? null, callback));
}

export function storageSet(
  area: chrome.storage.StorageArea,
  items: Record<string, unknown>,
): Promise<void> {
  return compatibleCall<void>((callback) => area.set(items, callback));
}

export function queryTabs(queryInfo: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> {
  return compatibleCall<chrome.tabs.Tab[]>((callback) => chrome.tabs.query(queryInfo, callback));
}

export function sendTabMessage<T = unknown>(tabId: number, message: unknown): Promise<T> {
  return compatibleCall<T>((callback) => chrome.tabs.sendMessage(tabId, message, callback));
}

export function createTab(createProperties: chrome.tabs.CreateProperties): Promise<chrome.tabs.Tab> {
  return compatibleCall<chrome.tabs.Tab>((callback) => chrome.tabs.create(createProperties, callback));
}
