// The CRM window shows whole rows only. The CSS wraps a row the window has no room for into a second column,
// outside the window, so it is out of sight; this marks it hidden as well (.is-off: visibility hidden), so
// nothing that reads the board counts a row nobody can see (the note router takes every visible word as an
// obstacle, and assistive tech would read it too).
//
// A ResizeObserver on each list and each of its rows catches every change: the window's size, and a scene
// showing or hiding a row (which moves the ones after it). A row is off when its layout box (offsetLeft, so a
// GSAP transform mid-flight never counts) is right of the first column.
export function watchRows(view: HTMLElement): { destroy(): void } | null {
  const lists = [...view.querySelectorAll<HTMLElement>('.ui-rows')];
  if (!lists.length || !('ResizeObserver' in window)) return null;
  const mark = () => {
    for (const list of lists) {
      const rows = [...list.children] as HTMLElement[];
      const shown = rows.filter((row) => row.offsetParent);
      const first = Math.min(...shown.map((row) => row.offsetLeft));
      for (const row of rows) row.classList.toggle('is-off', !!row.offsetParent && row.offsetLeft > first + 1);
    }
  };
  const ro = new ResizeObserver(mark);
  for (const list of lists) {
    ro.observe(list);
    for (const row of list.children) ro.observe(row);
  }
  return { destroy: () => ro.disconnect() };
}
