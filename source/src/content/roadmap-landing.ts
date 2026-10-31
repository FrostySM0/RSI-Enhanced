export type RoadmapLandingView = 'release-view' | 'progress-tracker';

const MAIN_ROADMAP_PATH = /^\/(?:([a-z]{2}(?:-[a-z]{2})?)\/)?roadmap\/?$/i;

export function roadmapLandingPath(pathname: string, view: RoadmapLandingView): string {
  const locale = MAIN_ROADMAP_PATH.exec(pathname)?.[1];
  const prefix = locale ? `/${locale}` : '';
  return view === 'progress-tracker'
    ? `${prefix}/roadmap/progress-tracker/teams`
    : `${prefix}/roadmap/release-view`;
}

interface ClickDocument {
  addEventListener(type: 'click', listener: EventListener, options?: boolean): void;
  removeEventListener(type: 'click', listener: EventListener, options?: boolean): void;
}

interface NavigationWindow {
  location: Pick<Location, 'href' | 'origin' | 'assign'>;
}

export function installRoadmapLandingPreference(
  documentRef: ClickDocument,
  windowRef: NavigationWindow,
  getView: () => RoadmapLandingView,
  settingsReady: Promise<void>,
): () => void {
  const onClick: EventListener = rawEvent => {
    const event = rawEvent as MouseEvent;
    if (event.defaultPrevented || (typeof event.button === 'number' && event.button !== 0)
      || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const target = event.target as Element | null;
    const anchor = target?.closest<HTMLAnchorElement>('a[href]');
    if (!anchor || anchor.closest('#root') || anchor.download
      || anchor.textContent?.trim().toLowerCase() !== 'roadmap'
      || (anchor.target && anchor.target.toLowerCase() !== '_self')) return;

    let destination: URL;
    try {
      destination = new URL(anchor.href, windowRef.location.href);
    } catch {
      return;
    }
    if (destination.origin !== windowRef.location.origin || !MAIN_ROADMAP_PATH.test(destination.pathname)) return;

    event.preventDefault();
    void settingsReady.then(() => {
      windowRef.location.assign(roadmapLandingPath(destination.pathname, getView()));
    });
  };

  documentRef.addEventListener('click', onClick, true);
  return () => documentRef.removeEventListener('click', onClick, true);
}
