import { isRoadmapReleaseView } from '../shared/site-sections.ts';

function eventElement(target: EventTarget | null): Element | null {
  return target && typeof (target as Element).closest === 'function' ? target as Element : null;
}

function backgroundImageUrl(background: string): string {
  const match = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/i.exec(background);
  return (match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim();
}

export function roadmapImageUrl(media: string, background: string, base: string): string | null {
  for (const candidate of [media.trim(), backgroundImageUrl(background)]) {
    if (!candidate) continue;
    try {
      const url = new URL(candidate, base);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) continue;
      if (url.hostname === 'media.robertsspaceindustries.com') {
        url.pathname = url.pathname.replace(/\/product_thumb_large(?=\.(?:jpe?g|png|webp|avif)$)/i, '/source');
      }
      return url.href;
    } catch {
      // Try the CSS background fallback if the explicit media attribute is malformed.
    }
  }
  return null;
}

export function installRoadmapImageViewer(
  enabled: () => boolean,
  win: Window = window,
  doc: Document = document,
): () => void {
  let dialog: HTMLDialogElement | null = null;
  let opener: HTMLAnchorElement | null = null;

  const isRoadmapCard = (anchor: HTMLAnchorElement): boolean => {
    try {
      const url = new URL(anchor.href, win.location.href);
      return url.origin === win.location.origin && isRoadmapReleaseView(url.pathname);
    } catch {
      return false;
    }
  };

  const openViewer = (anchor: HTMLAnchorElement, figure: HTMLElement): boolean => {
    if (dialog || !doc.body) return false;
    const source = roadmapImageUrl(
      figure.getAttribute('media') ?? '',
      win.getComputedStyle(figure).backgroundImage,
      win.location.href,
    );
    if (!source) return false;

    const title = anchor.querySelector('h3')?.textContent?.trim() || 'Roadmap card image';
    const viewer = doc.createElement('dialog');
    viewer.className = 'rsi-roadmap-image-dialog';
    viewer.setAttribute('aria-labelledby', 'rsi-roadmap-image-title');

    const panel = doc.createElement('div');
    panel.className = 'rsi-roadmap-image-panel';
    const header = doc.createElement('header');
    header.className = 'rsi-roadmap-image-header';
    const heading = doc.createElement('h2');
    heading.id = 'rsi-roadmap-image-title';
    heading.textContent = title;
    const close = doc.createElement('button');
    close.type = 'button';
    close.className = 'rsi-roadmap-image-close';
    close.textContent = 'Close';
    close.addEventListener('click', () => viewer.close());
    header.append(heading, close);

    const image = doc.createElement('img');
    image.className = 'rsi-roadmap-image-source';
    image.alt = title;
    image.referrerPolicy = 'no-referrer';
    image.src = source;

    const actions = doc.createElement('nav');
    actions.className = 'rsi-roadmap-image-actions';
    actions.setAttribute('aria-label', 'Image actions');
    const sourceLink = doc.createElement('a');
    sourceLink.href = source;
    sourceLink.textContent = 'Open source image';
    sourceLink.target = '_blank';
    sourceLink.rel = 'noopener noreferrer';
    actions.append(sourceLink);

    panel.append(header, image, actions);
    viewer.append(panel);
    viewer.addEventListener('click', event => {
      if (event.target === viewer) viewer.close();
    });
    viewer.addEventListener('close', () => {
      viewer.remove();
      dialog = null;
      if (opener?.isConnected) opener.focus();
      opener = null;
    }, { once: true });

    opener = anchor;
    dialog = viewer;
    doc.body.append(viewer);
    viewer.showModal();
    return true;
  };

  win.addEventListener('click', event => {
    const click = event as MouseEvent;
    if (!enabled() || click.button !== 0 || click.ctrlKey || click.metaKey || click.shiftKey || click.altKey) return;
    const figure = eventElement(click.target)?.closest<HTMLElement>('figure[media]') ?? null;
    const anchor = figure?.closest<HTMLAnchorElement>('a[href]') ?? null;
    if (figure && anchor && isRoadmapCard(anchor) && openViewer(anchor, figure)) {
      click.preventDefault();
      click.stopPropagation();
    }
  }, true);

  win.addEventListener('keydown', event => {
    const key = event as KeyboardEvent;
    if (!enabled() || key.key !== ' ' || key.altKey || key.ctrlKey || key.metaKey || key.shiftKey) return;
    const anchor = eventElement(key.target)?.closest<HTMLAnchorElement>('a[href]') ?? null;
    const figure = anchor?.querySelector<HTMLElement>('figure[media]') ?? null;
    if (anchor && figure && isRoadmapCard(anchor) && openViewer(anchor, figure)) key.preventDefault();
  });

  return () => {
    if (!enabled()) dialog?.close();
  };
}
