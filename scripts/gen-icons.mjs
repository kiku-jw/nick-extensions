import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pvs = ['clearshield', 'inkshade', 'studynav'];
let ok = true;
for (const name of pvs) {
  for (const size of [16, 32, 48, 128]) {
    const p = join(root, 'packages', name, 'public', 'icons', `icon${size}.png`);
    if (!existsSync(p)) {
      console.warn('missing', p);
      ok = false;
    }
  }
}
if (!ok) process.exit(1);
console.log(' icons ok (prebundled PNG in public/icons)');
