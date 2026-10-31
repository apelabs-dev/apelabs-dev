// Marks [data-reveal] figures with .is-in the first time a third of one is on screen. The CSS in
// global.css only holds back decorative marks, so if this never runs nothing is lost but the fade.
const figures = document.querySelectorAll<HTMLElement>('[data-reveal]');

if (figures.length) {
  if (!('IntersectionObserver' in window)) {
    figures.forEach((f) => f.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      },
      { threshold: 0.33 },
    );
    figures.forEach((f) => io.observe(f));
  }
}
