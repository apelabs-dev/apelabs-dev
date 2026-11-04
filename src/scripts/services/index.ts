import { createServices, type ServicesApi } from './controller';

export type { ServicesApi, ServicesState } from './controller';
export { createServices, DURATION } from './controller';

type ServicesRoot = HTMLElement & { __services?: ServicesApi };

/**
 * Wire the services deck once. The controller is exposed as `root.__services` (open, seek, state,
 * destroy) so tests and integrations can drive a deterministic frame instead of waiting on timers.
 */
export function init(root: Element): ServicesApi | null {
  const host = root as ServicesRoot;
  if (host.__services) return null;
  const api = createServices(host);
  const destroy = api.destroy;
  host.__services = {
    ...api,
    destroy() {
      destroy();
      delete host.__services;
    },
  };
  return host.__services;
}
