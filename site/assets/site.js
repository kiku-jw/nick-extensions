const filter = document.querySelector('[data-feature-filter]');
const rows = Array.from(document.querySelectorAll('[data-feature-row]'));
const empty = document.querySelector('[data-filter-empty]');

filter?.addEventListener('input', () => {
  const query = filter.value.trim().toLocaleLowerCase(document.documentElement.lang);
  let visible = 0;
  for (const row of rows) {
    const matches = !query || (row.textContent || '').toLocaleLowerCase(document.documentElement.lang).includes(query);
    row.hidden = !matches;
    if (matches) visible += 1;
  }
  if (empty) empty.hidden = visible !== 0;
});

for (const link of document.querySelectorAll('a[href^="#"]')) {
  link.addEventListener('click', () => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target instanceof HTMLElement) target.focus({preventScroll: true});
  });
}

const video = document.querySelector('video[data-tutorial]');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (video && !reduceMotion) video.setAttribute('preload', 'metadata');

for (const chapter of document.querySelectorAll('[data-seek]')) {
  chapter.addEventListener('click', async () => {
    if (!(video instanceof HTMLVideoElement)) return;
    video.currentTime = Number(chapter.dataset.seek || 0);
    video.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    try { await video.play(); } catch { video.focus(); }
  });
}
