// Mount the proof section: adopt its two rail strips, start the spark, and expose a test hook.
import { createRailSpark, type RailSparkController } from '../proof/rail-spark';

declare global {
  interface Window {
    __proofSpark?: RailSparkController;
  }
}

export function init(root: Element): { destroy(): void } | null {
  if (root.getAttribute('data-proof-mounted') === 'true') return null;
  root.setAttribute('data-proof-mounted', 'true');
  const spark = createRailSpark(root);
  window.__proofSpark = spark;
  return {
    destroy() {
      spark.destroy();
      if (window.__proofSpark === spark) delete window.__proofSpark;
      root.removeAttribute('data-proof-mounted');
    },
  };
}
