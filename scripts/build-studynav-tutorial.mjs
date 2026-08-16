#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = path.join(ROOT, 'scripts', 'studynav-tutorial-scenes.json');
const SCREENSHOT_DIR = path.join(ROOT, 'site', 'assets', 'screenshots');
const OUTPUT_DIR = path.join(ROOT, 'site', 'assets', 'video');
const ARTIFACT_DIR = path.join(ROOT, '.tutorial-artifacts');
const RENDERER = process.env.STUDYNAV_VIDEO_RENDERER || path.join(
  os.homedir(),
  '.codex',
  'skills',
  'video-builder',
  'scripts',
  'render_video.py',
);
const FONT = '/System/Library/Fonts/SFNS.ttf';

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => code === 0
      ? resolve()
      : reject(new Error(`${command} exited with code ${code}`)));
  });
}

function wrap(text, width) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && next.length > width) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.join('\n');
}

function ffmpegTextPath(value) {
  return value.replaceAll('\\', '/').replaceAll(':', '\\:').replaceAll("'", "\\'");
}

async function buildLanguage(manifest, language) {
  const [width, height] = manifest.size;
  const fps = manifest.fps;
  const copy = manifest.languages[language];
  const languageDir = path.join(ARTIFACT_DIR, language);
  const clipDir = path.join(languageDir, 'clips');
  const textDir = path.join(languageDir, 'text');
  await mkdir(clipDir, { recursive: true });
  await mkdir(textDir, { recursive: true });

  const cardDuration = manifest.introSeconds + manifest.outroSeconds;
  const silencePath = path.join(languageDir, 'silent.wav');
  await run('ffmpeg', [
    '-y', '-loglevel', 'error', '-f', 'lavfi', '-i',
    'anullsrc=channel_layout=stereo:sample_rate=48000', '-t', String(cardDuration), silencePath,
  ]);

  const rendererSpec = {
    size: manifest.size,
    fps,
    title: 'StudyNav',
    font: FONT,
    bg_palette: ['#43669F', '#182334'],
    voice: {
      audio_path: silencePath,
      line_durations: [manifest.introSeconds, manifest.outroSeconds],
    },
    lines: [
      { text: copy.intro, bg: '#43669F', accent: '#FFFFFF' },
      { text: copy.outro, bg: '#182334', accent: '#43669F' },
    ],
  };
  const specPath = path.join(languageDir, `studynav-guide-${language}.spec.json`);
  const cardVideo = path.join(languageDir, 'cards.mp4');
  await writeFile(specPath, `${JSON.stringify(rendererSpec, null, 2)}\n`, 'utf8');
  await run('python3', [RENDERER, '--spec', specPath, '--out', cardVideo, '--workdir', path.join(languageDir, 'render')]);

  const normalize = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-r', String(fps),
    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2'];
  const introPath = path.join(clipDir, '00-intro.mp4');
  const outroPath = path.join(clipDir, '99-outro.mp4');
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', cardVideo, '-t', String(manifest.introSeconds), ...normalize, introPath]);
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(manifest.introSeconds), '-i', cardVideo,
    '-t', String(manifest.outroSeconds), ...normalize, outroPath]);

  const clipPaths = [introPath];
  for (const [index, feature] of manifest.features.entries()) {
    const ordinal = String(index + 1).padStart(2, '0');
    const titlePath = path.join(textDir, `${ordinal}-title.txt`);
    const descriptionPath = path.join(textDir, `${ordinal}-description.txt`);
    const fixturePath = path.join(textDir, `${ordinal}-fixture.txt`);
    await writeFile(titlePath, `${wrap(feature[language].title, language === 'ru' ? 17 : 19)}\n`, 'utf8');
    await writeFile(descriptionPath, `${wrap(feature[language].description, language === 'ru' ? 28 : 31)}\n`, 'utf8');
    await writeFile(fixturePath, `${copy.fixture}\n`, 'utf8');

    const screenshotName = language === 'ru' && feature.ruScreenshot ? feature.ruScreenshot : feature.screenshot;
    const screenshotPath = path.join(SCREENSHOT_DIR, screenshotName);
    await access(screenshotPath);
    const clipPath = path.join(clipDir, `${ordinal}-${feature.id}.mp4`);
    const scale = feature.fit === 'portrait'
      ? 'scale=-2:810,pad=1320:810:(ow-iw)/2:(oh-ih)/2:color=white'
      : 'scale=1320:810:force_original_aspect_ratio=decrease,pad=1320:810:(ow-iw)/2:(oh-ih)/2:color=white';
    const filter = [
      `[0:v]${scale},zoompan=z='min(zoom+0.00018,1.018)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1320x810:fps=${fps}[shot]`,
      `color=c=0xF5F7FB:s=${width}x${height}:r=${fps}:d=${manifest.featureSeconds}[bg]`,
      '[bg]drawbox=x=486:y=112:w=1370:h=854:color=0x1F3150@0.13:t=fill,drawbox=x=494:y=104:w=1354:h=854:color=white:t=fill[frame]',
      '[frame][shot]overlay=x=511:y=126:shortest=1[base]',
      `[base]drawbox=x=0:y=0:w=${Math.round(width * (index + 1) / manifest.features.length)}:h=9:color=0x43669F:t=fill,` +
        `drawtext=fontfile=${ffmpegTextPath(FONT)}:text='StudyNav':fontcolor=0x43669F:fontsize=28:x=72:y=58,` +
        `drawtext=fontfile=${ffmpegTextPath(FONT)}:text='${String(index + 1).padStart(2, '0')} / ${manifest.features.length}':fontcolor=0x5D6878:fontsize=24:x=72:y=176,` +
        `drawtext=fontfile=${ffmpegTextPath(FONT)}:textfile=${ffmpegTextPath(titlePath)}:fontcolor=0x182334:fontsize=44:line_spacing=10:x=72:y=240,` +
        `drawtext=fontfile=${ffmpegTextPath(FONT)}:textfile=${ffmpegTextPath(descriptionPath)}:fontcolor=0x4E5C70:fontsize=25:line_spacing=10:x=72:y=480,` +
        `drawtext=fontfile=${ffmpegTextPath(FONT)}:textfile=${ffmpegTextPath(fixturePath)}:fontcolor=0x6B7788:fontsize=18:x=72:y=985,` +
        `fade=t=in:st=0:d=0.16,fade=t=out:st=${manifest.featureSeconds - 0.22}:d=0.22,format=yuv420p[v]`,
    ].join(';');

    await run('ffmpeg', [
      '-y', '-loglevel', 'error', '-loop', '1', '-framerate', String(fps), '-i', screenshotPath,
      '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
      '-filter_complex', filter, '-map', '[v]', '-map', '1:a', '-t', String(manifest.featureSeconds),
      ...normalize, '-shortest', clipPath,
    ]);
    clipPaths.push(clipPath);
  }
  clipPaths.push(outroPath);

  const concatPath = path.join(languageDir, 'concat.txt');
  await writeFile(concatPath, clipPaths.map((clip) => `file '${clip.replaceAll("'", "'\\''")}'`).join('\n') + '\n', 'utf8');
  const outputPath = path.join(OUTPUT_DIR, `studynav-guide-${language}.mp4`);
  await run('ffmpeg', [
    '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', concatPath,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-r', String(fps), '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', outputPath,
  ]);

  const posterPath = path.join(SCREENSHOT_DIR, `tutorial-poster-${language}.jpg`);
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '1.0', '-i', outputPath,
    '-frames:v', '1', '-vf', 'scale=1280:-2', '-q:v', '2', posterPath]);
  return { outputPath, clipPaths, specPath };
}

async function main() {
  await run('ffmpeg', ['-version']);
  await run('ffprobe', ['-version']);
  await run('python3', ['--version']);
  await access(RENDERER);
  await access(FONT);
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  if (manifest.features.length !== 22) throw new Error(`Expected 22 features, found ${manifest.features.length}`);

  await rm(ARTIFACT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });
  const outputs = [];
  for (const language of ['en', 'ru']) outputs.push(await buildLanguage(manifest, language));

  for (const output of outputs) {
    await run('ffprobe', ['-v', 'error', '-show_entries',
      'format=duration:stream=index,codec_name,codec_type,width,height,pix_fmt,r_frame_rate',
      '-of', 'json', output.outputPath]);
  }
  console.log(`Built ${outputs.length} tutorials and ${outputs.reduce((total, item) => total + item.clipPaths.length - 2, 0)} feature clips.`);
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
