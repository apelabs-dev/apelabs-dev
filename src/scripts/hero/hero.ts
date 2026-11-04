// Hero: mounts the circuit canvas behind the headline. The traces keep out of the copy block, which is
// measured from the live layout (and re-measured when it changes size, e.g. once the fonts load).
import { createCircuit, type PhaseLabels } from './circuit';
import type { Layout } from './network';

export interface HeroHandle {
  destroy(): void;
}

const round = Math.round;

function parseLabels(raw: string | undefined): PhaseLabels | undefined {
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length === 4 && parsed.every((s) => typeof s === 'string')) {
      return [parsed[0], parsed[1], parsed[2], parsed[3]];
    }
  } catch {
    // Fall through to the circuit's own labels.
  }
  return undefined;
}

export function initHero(root: Element): HeroHandle | null {
  const canvas = root.querySelector<HTMLCanvasElement>('.hero-canvas');
  const copy = root.querySelector<HTMLElement>('.hero-copy');
  const frame = root.querySelector<HTMLElement>('.hero-in');
  if (!canvas || !copy || !frame || !(root instanceof HTMLElement)) return null;
  let destroyed = false;

  const measure = (): Layout => {
    const r = root.getBoundingClientRect();
    const f = frame.getBoundingClientRect();
    const c = copy.getBoundingClientRect();
    return {
      width: round(r.width),
      height: round(r.height),
      frameLeft: round(f.left - r.left),
      frameWidth: round(f.width),
      top: document.getElementById('01-nav')?.offsetHeight ?? 0,
      quiet: [{ x: round(c.left - r.left), y: round(c.top - r.top), w: round(c.width), h: round(c.height) }],
    };
  };

  const circuit = createCircuit(canvas, {
    measure,
    seed: 7,
    labels: parseLabels(root.dataset.labels),
    observe: [copy],
    onFirstFrame: () => root.classList.add('is-live'),
    onState: (state) => {
      root.dataset.circuit = state;
    },
  });
  if (!circuit) return null;

  // The canvas tags are set in Geist Mono; redraw once it is in, and re-route if the copy block moved.
  void document.fonts?.ready.then(() => {
    if (destroyed) return;
    circuit.remeasure();
    circuit.refresh();
  });

  return {
    destroy() {
      destroyed = true;
      circuit.destroy();
      root.classList.remove('is-live');
      delete root.dataset.circuit;
    },
  };
}
