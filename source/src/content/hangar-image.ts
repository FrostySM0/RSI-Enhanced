// Verified against RSI's provided Aurora asset: 165x165 heap image -> 2420x1606 source.
export function fullSizeImageUrl(value: string): string {
  const url = new URL(value);
  if (url.hostname === 'robertsspaceindustries.com' && /^\/media\/[^/]+\/heap_infobox\/[^/]+$/.test(url.pathname)) {
    url.pathname = url.pathname.replace('/heap_infobox/', '/source/');
    return url.href;
  }
  if (url.hostname === 'media.robertsspaceindustries.com' && /^\/[^/]+\/(?:subscribers_vault_thumbnail|heap_infobox)\.jpg$/.test(url.pathname)) {
    url.pathname = url.pathname.replace(/\/[^/]+$/, '/source.jpg');
    return url.href;
  }
  return value;
}

export function sourceImageUrl(src: string, background: string, base: string): string | null {
  const match = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/i.exec(background);
  for (const value of [src, match?.[1] ?? match?.[2] ?? match?.[3] ?? '']) {
    if (!value.trim()) continue;
    try {
      const url = new URL(value.trim(), base);
      if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) return url.href;
    } catch { /* Ignore unsupported image sources. */ }
  }
  return null;
}

export function installHangarImagePreview(enabled: () => boolean, win: Window = window, doc: Document = document): () => void {
  let dialog: HTMLDialogElement | null = null;
  const originals = new Map<HTMLElement, (string | null)[]>();
  const attributes = ['role', 'tabindex', 'aria-label'];
  const selector = '#billing.pledges .item-image-wrapper, #billing.pledges .items .with-images .item .image, #billing.pledges .hangar-info .hangar-info-image img';
  const source = (thumb: HTMLElement) => {
    const image = thumb.matches('img') ? thumb as HTMLImageElement : thumb.querySelector<HTMLImageElement>('img');
    const surface = thumb.querySelector('.image') ?? thumb;
    return sourceImageUrl(image?.currentSrc || image?.src || '', win.getComputedStyle(surface).backgroundImage, win.location.href);
  };
  const open = (thumb: HTMLElement): boolean => {
    const url = source(thumb);
    if (!url || dialog) return false;
    const fullSize = fullSizeImageUrl(url);
    const caption = thumb.closest('.row')?.querySelector('h3')?.childNodes;
    // Heading buttons have their own labels; use the title's text nodes only.
    const title = thumb.closest('.item')?.querySelector('.text .title')?.textContent?.trim()
      || (caption ? [...caption].filter(node => node.nodeType === 3).map(node => node.textContent).join(' ').trim() : '');
    const card = doc.createElement('dialog');
    card.className = 'rsi-hangar-image-dialog';
    card.setAttribute('aria-label', title || 'Hangar image preview');
    const panel = doc.createElement('div'); panel.className = 'rsi-hangar-image-panel';
    const header = doc.createElement('div'); header.className = 'rsi-hangar-image-header';
    const heading = doc.createElement('h2'); heading.textContent = title || 'Hangar image';
    const close = doc.createElement('button'); close.type = 'button'; close.textContent = 'Close';
    close.addEventListener('click', () => card.close());
    header.append(heading, close);
    const image = doc.createElement('img'); image.alt = title || 'Hangar item'; image.referrerPolicy = 'no-referrer';
    const status = doc.createElement('p'); status.textContent = 'Loading image…'; status.setAttribute('role', 'status');
    let fallback = false;
    image.addEventListener('load', () => {
      status.hidden = !fallback;
      if (fallback) status.textContent = 'Full-size image unavailable; showing the thumbnail.';
    });
    image.addEventListener('error', () => {
      status.hidden = false;
      if (fullSize !== url && !fallback) {
        fallback = true; status.textContent = 'Loading available thumbnail…';
        link.href = url; image.src = url;
      } else status.textContent = 'The source image could not be loaded.';
    });
    const link = doc.createElement('a'); link.href = fullSize; link.textContent = 'Open source image'; link.target = '_blank'; link.rel = 'noopener noreferrer';
    panel.append(header, image, status, link); card.append(panel);
    card.addEventListener('click', event => { if (event.target === card) card.close(); });
    card.addEventListener('close', () => { card.remove(); dialog = null; if (thumb.isConnected) thumb.focus(); }, { once: true });
    doc.body.append(card); dialog = card; image.src = fullSize; card.showModal();
    return true;
  };
  win.addEventListener('click', event => {
    if (!enabled() || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const target = event.target as Element | null;
    const thumb = typeof target?.closest === 'function' ? target.closest<HTMLElement>(selector) : null;
    if (thumb && open(thumb)) { event.preventDefault(); event.stopPropagation(); }
  }, true);
  win.addEventListener('keydown', event => {
    if (!enabled() || !['Enter', ' '].includes(event.key)) return;
    const target = event.target as HTMLElement | null;
    if (typeof target?.matches === 'function' && target.matches(selector) && open(target)) event.preventDefault();
  });
  const refresh = () => {
    if (!enabled()) {
      dialog?.close();
      for (const [thumb, values] of originals) attributes.forEach((attribute, index) => {
        const value = values[index]; if (value === null) thumb.removeAttribute(attribute); else thumb.setAttribute(attribute, value);
      });
      originals.clear();
      return;
    }
    if (doc.readyState === 'loading') return;
    for (const thumb of doc.querySelectorAll<HTMLElement>(selector)) {
      if (originals.has(thumb) || !source(thumb)) continue;
      originals.set(thumb, attributes.map(attribute => thumb.getAttribute(attribute)));
      thumb.setAttribute('role', 'button'); thumb.setAttribute('tabindex', '0'); thumb.setAttribute('aria-label', 'Enlarge item image');
    }
  };
  doc.addEventListener('DOMContentLoaded', refresh, { once: true });
  return refresh;
}
