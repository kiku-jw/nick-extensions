import * as esbuild from 'esbuild';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = join(__dirname, '..', 'packages/shared');
mkdirSync(join(pkg, 'dist'), { recursive: true });

await esbuild.build({
  entryPoints: [join(pkg, 'src/index.ts')],
  outfile: join(pkg, 'dist/index.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'chrome120',
  sourcemap: true,
});

writeFileSync(join(pkg, 'dist/index.d.ts'), `export declare function hostnameFromUrl(url: string | undefined | null): string | null;
export declare function originPattern(hostname: string): string;
export declare function getActiveTab(): Promise<chrome.tabs.Tab | null>;
export declare function clamp(n: number, min: number, max: number): number;
export declare function downloadText(filename: string, text: string, mime?: string): void;
export declare function copyToClipboard(text: string): Promise<boolean>;
export type StorageArea = 'sync' | 'local';
export declare function storageGet<T extends Record<string, unknown>>(defaults: T, area?: StorageArea): Promise<T>;
export declare function storageSet(values: Record<string, unknown>, area?: StorageArea): Promise<void>;
`);
console.log('shared built');
