import { useSyncExternalStore } from 'react';

export const routes = [
  { id: 'home', label: 'Home', index: '01' },
  { id: 'inspect', label: 'Inspect', index: '02' },
  { id: 'compatibility', label: 'Compatibility', index: '03' },
  { id: 'configure', label: 'Configure', index: '04' },
  { id: 'player', label: 'Player', index: '05' },
  { id: 'workspace', label: 'Workspace', index: '06' },
] as const;
export type RouteId = typeof routes[number]['id'];
export type Route = RouteId | 'not-found';

function currentRoute(): Route {
  const hash = window.location.hash;
  if (!hash || hash === '#' || hash === '#/') return 'home';
  return routes.find(route => hash === `#/${route.id}`)?.id ?? 'not-found';
}
function subscribe(callback: () => void) {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}
export function useRoute(): Route { return useSyncExternalStore(subscribe, currentRoute); }
export function navigate(route: RouteId): void { window.location.hash = `/${route}`; }
