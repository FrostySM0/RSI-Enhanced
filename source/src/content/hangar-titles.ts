import { sourceImageUrl } from './hangar-image.ts';

interface ShipItem { name: string; imageUrl: string | null; }
interface ShipTitle { heading: HTMLHeadingElement; source: Text; stack: HTMLSpanElement; ship: HTMLSpanElement; image: HTMLElement | null; originalBackgroundImage: string; }

function ships(row: Element, doc: Document): ShipItem[] {
  const ships = new Map<string, ShipItem>();
  for (const item of row.querySelectorAll<HTMLElement>('.more .with-images .item')) {
    const kind = item.querySelector('.text .kind, .kind')?.textContent?.trim().toLocaleLowerCase();
    if (kind !== 'ship') continue;
    const title = item.querySelector('.text .title, .title')?.textContent?.trim();
    if (!title) continue;
    const surface = item.querySelector<HTMLElement>('.image');
    const image = surface?.querySelector<HTMLImageElement>('img') || item.querySelector<HTMLImageElement>('img');
    const background = surface?.style.backgroundImage || (surface && doc.defaultView?.getComputedStyle(surface).backgroundImage) || '';
    ships.set(title.toLocaleLowerCase(), {
      name: title,
      imageUrl: sourceImageUrl(image?.currentSrc || image?.src || '', background, doc.baseURI),
    });
  }
  return [...ships.values()];
}

export function installHangarTitles(enabled: () => boolean, doc: Document = document): () => void {
  const titles = new Map<HTMLHeadingElement, ShipTitle>();
  const restore = () => {
    for (const [heading, title] of titles) {
      if (title.stack.parentNode === heading) title.stack.replaceWith(title.source);
      if (title.image) title.image.style.backgroundImage = title.originalBackgroundImage;
      heading.classList.remove('rsi-hangar-ship-focused');
    }
    titles.clear();
  };

  return () => {
    if (!enabled()) { restore(); return; }
    if (doc.readyState === 'loading') return;
    for (const heading of titles.keys()) if (!heading.isConnected) titles.delete(heading);
    for (const heading of doc.querySelectorAll<HTMLHeadingElement>('#billing.pledges .list-items .row .title-col h3')) {
      const row = heading.closest('.row');
      if (!row) continue;
      const existing = titles.get(heading);
      const items = ships(row, doc);
      if (existing) {
        if (items.length) {
          existing.ship.textContent = items.map(item => item.name).join(' · ');
          if (existing.image && items[0].imageUrl) existing.image.style.backgroundImage = `url(${JSON.stringify(items[0].imageUrl)})`;
        }
        else {
          existing.stack.replaceWith(existing.source);
          if (existing.image) existing.image.style.backgroundImage = existing.originalBackgroundImage;
          heading.classList.remove('rsi-hangar-ship-focused');
          titles.delete(heading);
        }
        continue;
      }
      if (!items.length) continue;
      const source = [...heading.childNodes].find((node): node is Text => node.nodeType === Node.TEXT_NODE && !!node.textContent?.trim());
      const packageName = source?.textContent?.trim() || '';
      if (!source || !/^package\b/i.test(packageName)) continue;

      const stack = doc.createElement('span'); stack.className = 'rsi-hangar-title-stack';
      const ship = doc.createElement('span'); ship.className = 'rsi-hangar-ship-title'; ship.textContent = items.map(item => item.name).join(' · ');
      const original = doc.createElement('span'); original.className = 'rsi-hangar-package-title'; original.textContent = packageName;
      stack.append(ship, original);
      source.replaceWith(stack);
      heading.classList.add('rsi-hangar-ship-focused');
      const image = row.querySelector<HTMLElement>('.item-image-wrapper .image');
      const originalBackgroundImage = image?.style.backgroundImage || '';
      if (image && items[0].imageUrl) image.style.backgroundImage = `url(${JSON.stringify(items[0].imageUrl)})`;
      titles.set(heading, { heading, source, stack, ship, image, originalBackgroundImage });
    }
  };
}
