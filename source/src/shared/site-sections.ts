export const RSI_SECTIONS = { store: 'Pledge Store', matrix: 'Ship Matrix', organizations: 'Organizations', commlink: 'Comm-Link', account: 'Account & profile', hangar: 'My Hangar', roadmap: 'Roadmap', funding: 'Funding Goals', devtracker: 'Dev Tracker' } as const;
export type RsiSection = keyof typeof RSI_SECTIONS;

function routeFromPath(path: string): string {
  return path.replace(/^\/[a-z]{2}(?:-[a-z]{2})?(?=\/|$)/i, '').toLowerCase();
}

export function isRoadmapReleaseView(path: string): boolean {
  return /^\/roadmap\/release-view(?:\/|$)/.test(routeFromPath(path));
}

export function isSpectrumHome(path: string): boolean {
  return /^\/spectrum\/community\/sc\/?$/.test(routeFromPath(path));
}

export function sectionForPath(path: string): RsiSection | 'spectrum' | null {
  const route = routeFromPath(path);
  if (/^\/spectrum(?:\/|$)/.test(route)) return 'spectrum';
  if (/^\/account\/(?:pledges|game-access-management|roms|buy-back-pledges|rsvp|settings\/games-library)\/?$/.test(route) || /^\/electronic-access\/?$/.test(route)) return 'hangar';
  if (/^\/account(?:\/(?:settings|profile))?\/?$/.test(route)) return 'account';
  if (/^\/pledge\/?$/.test(route) || /^\/pledge\/(packages|standalone-ships|gear|paint|packs|ships)(?:\/|$)/.test(route) || /^\/store\/pledge\/browse(?:\/|$)/.test(route)) return 'store';
  if (/^\/ship-matrix\/?$/.test(route)) return 'matrix';
  if (/^\/community\/orgs(?:\/listing)?\/?$/.test(route) || /^\/orgs\/[^/]+(?:\/members)?\/?$/.test(route)) return 'organizations';
  if (/^\/comm-link(?:\/|$)/.test(route) || /^\/patch-notes\/?$/.test(route)) return 'commlink';
  if (/^\/roadmap\/(?:release-view|progress-tracker)(?:\/|$)/.test(route)) return 'roadmap';
  if (/^\/funding-goals\/?$/.test(route)) return 'funding';
  if (/^\/community\/devtracker\/?$/.test(route)) return 'devtracker';
  return null;
}

