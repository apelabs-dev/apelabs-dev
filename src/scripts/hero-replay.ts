// Hero scroll replay: maps how far the reader has scrolled through the six chapters to --p (0–6)
// on the hero and the active chapter number on the trace. RunTrace's CSS turns --p into part
// states with smoothstep easing. Scroll is only read, never written: no wheel or touch handlers,
// no snapping, no smooth-scroll library. Outside REPLAY_QUERY nothing runs and the page keeps
// its static final state, which is also what no-JS and reduced-motion readers get.
const REPLAY_QUERY = '(min-width: 1024px) and (min-height: 760px) and (prefers-reduced-motion: no-preference)';
const CHAPTERS = 6;
/** The chapter whose top has passed this fraction of the viewport height is the active one. */
const READ_LINE = 0.6;

const hero = document.querySelector<HTMLElement>('[data-hero]');
const list = hero?.querySelector<HTMLElement>('[data-chapters]');
const trace = hero?.querySelector<HTMLElement>('[data-trace]');

if (hero && list && trace) {
  const items = [...list.querySelectorAll<HTMLElement>('[data-step]')];
  const mq = window.matchMedia(REPLAY_QUERY);
  let top = 0;
  let span = 1;
  let chapter = 0;
  let frame = 0;

  const measure = () => {
    const first = items[0].getBoundingClientRect();
    const last = items[items.length - 1].getBoundingClientRect();
    top = first.top + window.scrollY;
    span = Math.max(1, last.bottom - first.top);
  };

  const update = () => {
    frame = 0;
    const line = window.scrollY + window.innerHeight * READ_LINE;
    const p = Math.min(1, Math.max(0, (line - top) / span)) * CHAPTERS;
    hero.style.setProperty('--p', p.toFixed(3));
    const next = Math.min(CHAPTERS, Math.floor(p) + 1);
    if (next !== chapter) {
      chapter = next;
      trace.dataset.chapter = String(next);
      items.forEach((li, i) => li.classList.toggle('is-active', i + 1 === next));
    }
  };

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  const remeasure = () => {
    measure();
    schedule();
  };
  const resize = new ResizeObserver(remeasure);

  const start = () => {
    measure();
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', remeasure, { passive: true });
    resize.observe(list);
  };

  const stop = () => {
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', remeasure);
    resize.disconnect();
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    chapter = 0;
    hero.style.removeProperty('--p');
    delete trace.dataset.chapter;
    items.forEach((li) => li.classList.remove('is-active'));
  };

  mq.addEventListener('change', () => (mq.matches ? start() : stop()));
  if (mq.matches) start();
}
