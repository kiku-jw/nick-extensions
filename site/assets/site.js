const locale = document.documentElement.lang.startsWith('ru') ? 'ru' : 'en';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const filter = document.querySelector('[data-feature-filter]');
const rows = Array.from(document.querySelectorAll('[data-feature-row]'));
const empty = document.querySelector('[data-filter-empty]');

filter?.addEventListener('input', () => {
  const query = filter.value.trim().toLocaleLowerCase(locale);
  let visible = 0;
  for (const row of rows) {
    const matches = !query || (row.textContent || '').toLocaleLowerCase(locale).includes(query);
    row.hidden = !matches;
    if (matches) visible += 1;
  }
  if (empty) empty.hidden = visible !== 0;
});

for (const link of document.querySelectorAll('a[href^="#"]')) {
  link.addEventListener('click', () => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target instanceof HTMLElement) target.focus({ preventScroll: true });
  });
}

const demo = document.querySelector('[data-demo-root]');
if (demo) {
  const popup = demo.querySelector('.demo-popup');
  const master = demo.querySelector('[data-demo-master]');
  const toggles = Array.from(demo.querySelectorAll('[data-demo-toggle]'));
  const count = demo.querySelector('[data-demo-count]');
  const status = demo.querySelector('[data-demo-status]');
  const notes = demo.querySelector('[data-demo-notes]');
  const highlight = demo.querySelector('[data-demo-highlight]');
  const reading = demo.querySelector('.demo-reading-main');
  const copyToggle = demo.querySelector('[data-demo-toggle="copy"]');
  const mediaToggle = demo.querySelector('[data-demo-toggle="media"]');

  const words = locale === 'ru'
    ? {
        off: 'Инструменты выключены',
        verse: 'Выбран стих 3',
        range: 'Выбраны стихи 3–4 · одна ссылка',
        note: 'Заметка показана справа',
        audio: 'Введите начало и конец фрагмента',
        copy: 'Будет скопирован только текст стиха',
        shading: 'Затемнение плеера убрано',
      }
    : {
        off: 'Tools are off',
        verse: 'Verse 3 is selected',
        range: 'Verses 3–4 selected · one link',
        note: 'The note is visible on the right',
        audio: 'Enter the segment start and end',
        copy: 'Only the verse words will be copied',
        shading: 'Player shading is removed',
      };

  const setStatus = (message) => {
    if (status) status.textContent = message;
    status?.classList.remove('flash');
    requestAnimationFrame(() => status?.classList.add('flash'));
  };

  const refreshDemo = () => {
    const enabled = master instanceof HTMLInputElement && master.checked;
    if (popup) popup.dataset.disabled = String(!enabled);
    const enabledCount = toggles.filter((toggle) => toggle instanceof HTMLInputElement && toggle.checked).length;
    if (count) count.textContent = String(enabled ? enabledCount : 0);
    const notesOn = enabled && toggles.find((toggle) => toggle.dataset.demoToggle === 'notes')?.checked;
    notes?.classList.toggle('hidden', !notesOn);
    highlight?.classList.toggle('off', !notesOn);
    if (!enabled) setStatus(words.off);
    else if (status?.textContent === words.off) setStatus(words.verse);
  };

  master?.addEventListener('change', refreshDemo);
  for (const toggle of toggles) toggle.addEventListener('change', refreshDemo);

  demo.querySelector('[data-demo-action="note"]')?.addEventListener('click', () => {
    if (master instanceof HTMLInputElement && !master.checked) {
      master.checked = true;
    }
    const noteToggle = toggles.find((toggle) => toggle.dataset.demoToggle === 'notes');
    if (noteToggle instanceof HTMLInputElement) noteToggle.checked = true;
    refreshDemo();
    setStatus(words.note);
    notes?.classList.add('pulse');
    setTimeout(() => notes?.classList.remove('pulse'), 650);
  });

  demo.querySelector('[data-demo-action="range"]')?.addEventListener('click', () => {
    if (master instanceof HTMLInputElement && !master.checked) master.checked = true;
    refreshDemo();
    reading?.classList.toggle('range-selected');
    setStatus(reading?.classList.contains('range-selected') ? words.range : words.verse);
  });

  demo.querySelector('[data-demo-action="audio"]')?.addEventListener('click', () => {
    if (master instanceof HTMLInputElement && !master.checked) master.checked = true;
    refreshDemo();
    setStatus(words.audio);
  });

  copyToggle?.addEventListener('change', () => {
    if (copyToggle.checked) setStatus(words.copy);
  });
  mediaToggle?.addEventListener('change', () => {
    if (mediaToggle.checked) setStatus(words.shading);
  });
  refreshDemo();
}

const tutorialVideo = document.querySelector('video[data-tutorial]');
if (tutorialVideo && !reduceMotion) tutorialVideo.setAttribute('preload', 'metadata');

const manifestPath = locale === 'ru'
  ? '../assets/video/studynav-guide-manifest.json'
  : 'assets/video/studynav-guide-manifest.json';

fetch(manifestPath)
  .then((response) => response.ok ? response.json() : Promise.reject(new Error(String(response.status))))
  .then((manifest) => {
    const starts = new Map((manifest.scenes || []).map((scene) => [scene.id, Number(scene.start)]));
    for (const chapter of document.querySelectorAll('[data-scene]')) {
      const start = starts.get(chapter.dataset.scene);
      if (Number.isFinite(start)) chapter.dataset.seek = String(start);
    }
  })
  .catch(() => {
    // The chapter buttons stay visible while a missing optional timing manifest is rebuilt.
  });

for (const chapter of document.querySelectorAll('[data-scene]')) {
  chapter.addEventListener('click', async () => {
    if (!(tutorialVideo instanceof HTMLVideoElement)) return;
    const start = Number(chapter.dataset.seek);
    if (!Number.isFinite(start)) {
      tutorialVideo.focus();
      return;
    }
    tutorialVideo.currentTime = start;
    tutorialVideo.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    try { await tutorialVideo.play(); } catch { tutorialVideo.focus(); }
  });
}
