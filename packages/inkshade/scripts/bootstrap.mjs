import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = path.resolve(packageRoot, '..', '..');
const upstreamRoot = path.join(packageRoot, 'upstream');
const patchPath = path.join(packageRoot, 'patches', 'inkshade.patch');
const provenancePath = path.join(packageRoot, 'UPSTREAM.json');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || packageRoot,
    encoding: options.capture ? 'utf8' : undefined,
    stdio: options.capture ? 'pipe' : 'inherit',
  });
  if (result.error) throw result.error;
  if (!options.allowFailure && result.status !== 0) {
    const detail = options.capture
      ? `\n${String(result.stderr || result.stdout || '').trim()}`
      : '';
    throw new Error(`${command} ${args.join(' ')} exited with code ${result.status}${detail}`);
  }
  return result;
}

if (!existsSync(path.join(upstreamRoot, '.git'))) {
  run('git', ['submodule', 'update', '--init', '--recursive', 'packages/inkshade/upstream'], {
    cwd: repositoryRoot,
  });
}

const provenance = JSON.parse(await readFile(provenancePath, 'utf8'));
const head = String(run('git', ['-C', upstreamRoot, 'rev-parse', 'HEAD'], {capture: true}).stdout).trim();
if (head !== provenance.commit) {
  throw new Error(`InkShade upstream is ${head}; expected pinned commit ${provenance.commit}.`);
}

const applyCheck = run(
  'git',
  ['-C', upstreamRoot, 'apply', '--check', '--whitespace=nowarn', patchPath],
  {allowFailure: true, capture: true},
);
if (applyCheck.status === 0) {
  run('git', ['-C', upstreamRoot, 'apply', '--whitespace=nowarn', patchPath]);
  console.log('Applied the reviewed InkShade downstream patch.');
} else {
  const reverseCheck = run(
    'git',
    ['-C', upstreamRoot, 'apply', '--reverse', '--check', '--whitespace=nowarn', patchPath],
    {allowFailure: true, capture: true},
  );
  if (reverseCheck.status !== 0) {
    throw new Error(
      'InkShade upstream is neither clean nor exactly patched. Preserve local edits and resolve the patch conflict explicitly.',
    );
  }
  console.log('The reviewed InkShade downstream patch is already applied.');
}

run('npm', ['ci', '--ignore-scripts'], {cwd: upstreamRoot});
