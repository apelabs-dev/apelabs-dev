// Mount the proof section: adopt its two rail strips, start the spark, and expose a test hook.
import { createRailSpark, type RailSparkController } from '../proof/rail-spark';

declare global {
  interface Window {
    __proofSpark?: RailSparkController;
  }
}

export function init(root: Element): void {
  if (root.getAttribute('data-proof-mounted') === 'true') return;
  root.setAttribute('data-proof-mounted', 'true');
  window.__proofSpark = createRailSpark(root);
}
