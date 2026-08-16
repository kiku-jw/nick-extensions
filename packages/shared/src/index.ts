/** Tiny shared helpers for Nick's clean-room extensions. */

export function hostnameFromUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function originPattern(hostname: string): string {
  return `*://${hostname}/*`;
}

export async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] ?? null;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function downloadText(filename: string, text: string, mime = 'text/plain'): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export type StorageArea = 'sync' | 'local';

export async function storageGet<T extends Record<string, unknown>>(
  defaults: T,
  area: StorageArea = 'local',
): Promise<T> {
  const bag = await chrome.storage[area].get(defaults);
  return { ...defaults, ...bag } as T;
}

export async function storageSet(values: Record<string, unknown>, area: StorageArea = 'local'): Promise<void> {
  await chrome.storage[area].set(values);
}
