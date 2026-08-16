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
  os.homedir(), '.codex', 'skills', 'video-builder', 'scripts', 'render_video.py',
);
const FONT = '/System/Library/Fonts/SFNS.ttf';
const RING_FONT = '/System/Library/Fonts/Apple Symbols.ttf';

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code}`)));
  });
}

function wrap(text, width) {
  const lines = [];
  let line = '';
  for (const word of String(text).split(/\s+/)) {
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

function ffmpegTime(value) {
  const seconds = Math.max(0, value);
  const minutes = Math.floor(seconds / 60);
  const rest = (seconds % 60).toFixed(3).padStart(6, '0');
  return `00:${String(minutes).padStart(2, '0')}:${rest}`;
}

function chapterManifest(manifest) {
  return {
    version: manifest.version,
    duration: manifest.introSeconds + manifest.features.length * manifest.featureSeconds + manifest.outroSeconds,
    scenes: manifest.features.map((feature, index) => ({
      id: feature.id,
      start: Number((manifest.introSeconds + index * manifest.featureSeconds).toFixed(3)),
      duration: manifest.featureSeconds,
    })),
  };
}

async function writeChapterVtt(manifest, language) {
  const cues = ['WEBVTT', ''];
  manifest.features.forEach((feature, index) => {
    const start = manifest.introSeconds + index * manifest.featureSeconds;
    const end = start + manifest.featureSeconds;
    cues.push(`${ffmpegTime(start)} --> ${ffmpegTime(end)}`);
    cues.push(feature[language].title);
    cues.push('');
  });
  await writeFile(path.join(OUTPUT_DIR, `studynav-guide-${language}-chapters.vtt`), cues.join('\n'), 'utf8');
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
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i',
    'anullsrc=channel_layout=stereo:sample_rate=48000', '-t', String(cardDuration), silencePath]);

  const rendererSpec = {
    size: manifest.size,
    fps,
    title: 'StudyNav',
    font: FONT,
    bg_palette: ['#43669F', '#172234'],
    voice: { audio_path: silencePath, line_durations: [manifest.introSeconds, manifest.outroSeconds] },
    lines: [
      { text: copy.intro, bg: '#43669F', accent: '#FFFFFF' },
      { text: copy.outro, bg: '#172234', accent: '#7FA0D2' },
    ],
  };
  const specPath = path.join(languageDir, `studynav-guide-${language}.spec.json`);
  const cardVideo = path.join(languageDir, 'cards.mp4');
  await writeFile(specPath, `${JSON.stringify(rendererSpec, null, 2)}\n`, 'utf8');
  await run('python3', [RENDERER, '--spec', specPath, '--out', cardVideo, '--workdir', path.join(languageDir, 'render')]);

  const videoEncode = process.platform === 'darwin'
    ? ['-c:v', 'h264_videotoolbox', '-profile:v', 'high', '-level', '5.2', '-q:v', '65',
        '-prio_speed', 'true', '-allow_sw', 'true', '-r', String(fps), '-pix_fmt', 'yuv420p']
    : ['-c:v', 'libx264', '-preset', 'faster', '-crf', '18', '-r', String(fps), '-pix_fmt', 'yuv420p'];
  const encode = [
    ...videoEncode,
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
    '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2',
  ];
  const introPath = path.join(clipDir, '00-intro.mp4');
  const outroPath = path.join(clipDir, '99-outro.mp4');
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', cardVideo, '-t', String(manifest.introSeconds), ...encode, introPath]);
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(manifest.introSeconds), '-i', cardVideo,
    '-t', String(manifest.outroSeconds), ...encode, outroPath]);

  const shotWidth = 1760;
  const shotHeight = 1080;
  const shotX = 720;
  const shotY = 180;
  const clipPaths = [introPath];

  for (const [index, feature] of manifest.features.entries()) {
    const ordinal = String(index + 1).padStart(2, '0');
    const titlePath = path.join(textDir, `${ordinal}-title.txt`);
    const descriptionPath = path.join(textDir, `${ordinal}-description.txt`);
    const fixturePath = path.join(textDir, `${ordinal}-fixture.txt`);
    await writeFile(titlePath, `${wrap(feature[language].title, language === 'ru' ? 21 : 23)}\n`, 'utf8');
    await writeFile(descriptionPath, `${wrap(feature[language].description, language === 'ru' ? 34 : 38)}\n`, 'utf8');
    await writeFile(fixturePath, `${copy.fixture}\n`, 'utf8');

    const screenshotName = language === 'ru' && feature.ruScreenshot ? feature.ruScreenshot : feature.screenshot;
    const screenshotPath = path.join(SCREENSHOT_DIR, screenshotName);
    await access(screenshotPath);
    const clipPath = path.join(clipDir, `${ordinal}-${feature.id}.mp4`);
    const languageFocus = language === 'ru' ? feature.ruFocus : null;
    const [focusX, focusY, radius] = languageFocus || feature.focus || [shotWidth / 2, shotHeight / 2, 120];
    const scale = feature.fit === 'portrait'
      ? `scale=-2:${shotHeight},pad=${shotWidth}:${shotHeight}:(ow-iw)/2:(oh-ih)/2:color=white`
      : `scale=${shotWidth}:${shotHeight}:force_original_aspect_ratio=decrease,pad=${shotWidth}:${shotHeight}:(ow-iw)/2:(oh-ih)/2:color=white`;
    const framesBeforeMove = Math.round(fps * 1.15);
    const zoomIncrement = 0.035 / Math.max(1, manifest.featureSeconds * fps - framesBeforeMove);
    const zoomExpression = `if(lte(on,${framesBeforeMove}),1,min(zoom+${zoomIncrement.toFixed(7)},1.035))`;
    const xExpression = `max(0,min(iw-iw/zoom,${focusX}-iw/zoom/2))`;
    const yExpression = `max(0,min(ih-ih/zoom,${focusY}-ih/zoom/2))`;
    const ringX = Math.round(shotX + focusX - radius * 1.12);
    const ringY = Math.round(shotY + focusY - radius * 1.2);
    const ringSize = Math.round(radius * 2.35);
    const progressWidth = Math.round(width * (index + 1) / manifest.features.length);
    const ringAlpha = `if(lt(t,1.05),0,0.72+0.22*sin(6.283*(t-1.05)))`;

    const filter = [
      `[0:v]${scale},zoompan=z='${zoomExpression}':x='${xExpression}':y='${yExpression}':d=1:s=${shotWidth}x${shotHeight}:fps=${fps}[shot]`,
      `color=c=0xF5F7FB:s=${width}x${height}:r=${fps}:d=${manifest.featureSeconds}[bg]`,
      `[bg]drawbox=x=690:y=150:w=1820:h=1140:color=0x1F3150@0.13:t=fill,drawbox=x=700:y=140:w=1800:h=1140:color=white:t=fill[frame]`,
      `[frame][shot]overlay=x=${shotX}:y=${shotY}:shortest=1[base]`,
      `[base]drawbox=x=0:y=0:w=${progressWidth}:h=11:color=0x43669F:t=fill,` +
        `drawtext=fontfile=${ffmpegTextPath(FONT)}:text='StudyNav':fontcolor=0x43669F:fontsize=36:x=86:y=72,` +
        `drawtext=fontfile=${ffmpegTextPath(FONT)}:text='${ordinal} / ${manifest.features.length}':fontcolor=0x687589:fontsize=29:x=86:y=220,` +
        `drawtext=fontfile=${ffmpegTextPath(FONT)}:textfile=${ffmpegTextPath(titlePath)}:fontcolor=0x172234:fontsize=54:line_spacing=14:x=86:y=310,` +
        `drawtext=fontfile=${ffmpegTextPath(FONT)}:textfile=${ffmpegTextPath(descriptionPath)}:fontcolor=0x536176:fontsize=31:line_spacing=13:x=86:y=650,` +
        `drawtext=fontfile=${ffmpegTextPath(FONT)}:textfile=${ffmpegTextPath(fixturePath)}:fontcolor=0x6B7788:fontsize=22:x=86:y=1322,` +
        `drawtext=fontfile=${ffmpegTextPath(RING_FONT)}:text='◯':fontcolor=0xE33B3B:fontsize=${ringSize}:x=${ringX}:y=${ringY}:alpha='${ringAlpha}',` +
        `drawbox=x=${Math.round(shotX + focusX - 4)}:y=${Math.round(shotY + focusY - 4)}:w=8:h=8:color=0xE33B3B@0.9:t=fill:enable='gte(t,1.05)',` +
        `fade=t=in:st=0:d=0.28,fade=t=out:st=${(manifest.featureSeconds - .38).toFixed(2)}:d=0.38,format=yuv420p[v]`,
    ].join(';');

    await run('ffmpeg', [
      '-y', '-loglevel', 'error', '-loop', '1', '-framerate', String(fps), '-i', screenshotPath,
      '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
      '-filter_complex', filter, '-map', '[v]', '-map', '1:a', '-t', String(manifest.featureSeconds),
      ...encode, '-shortest', clipPath,
    ]);
    clipPaths.push(clipPath);
  }
  clipPaths.push(outroPath);

  const concatPath = path.join(languageDir, 'concat.txt');
  await writeFile(concatPath, `${clipPaths.map((clip) => `file '${clip.replaceAll("'", "'\\''")}'`).join('\n')}\n`, 'utf8');
  const outputPath = path.join(OUTPUT_DIR, `studynav-guide-${language}.mp4`);
  await run('ffmpeg', [
    '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', concatPath,
    '-c', 'copy', '-movflags', '+faststart', outputPath,
  ]);

  const posterPath = path.join(SCREENSHOT_DIR, `tutorial-poster-${language}.jpg`);
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '1.5', '-i', outputPath,
    '-frames:v', '1', '-vf', 'scale=1600:-2', '-q:v', '2', posterPath]);
  await writeChapterVtt(manifest, language);
  return { outputPath, clipPaths, specPath };
}

async function main() {
  await run('ffmpeg', ['-version']);
  await run('ffprobe', ['-version']);
  await run('python3', ['--version']);
  await access(RENDERER);
  await access(FONT);
  await access(RING_FONT);
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  if (manifest.features.length !== 23) throw new Error(`Expected 23 features, found ${manifest.features.length}`);
  if (manifest.size[0] !== 2560 || manifest.size[1] !== 1440 || manifest.fps !== 60) {
    throw new Error('Tutorial must render at 2560x1440 and 60 fps');
  }

  await rm(ARTIFACT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(
    path.join(OUTPUT_DIR, 'studynav-guide-manifest.json'),
    `${JSON.stringify(chapterManifest(manifest), null, 2)}\n`,
    'utf8',
  );
  const outputs = [];
  for (const language of ['en', 'ru']) outputs.push(await buildLanguage(manifest, language));

  for (const output of outputs) {
    await run('ffprobe', ['-v', 'error', '-show_entries',
      'format=duration:stream=index,codec_name,codec_type,width,height,pix_fmt,r_frame_rate,color_space,color_transfer,color_primaries',
      '-of', 'json', output.outputPath]);
  }
  console.log(`Built ${outputs.length} tutorials and ${manifest.features.length * outputs.length} feature clips.`);
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
