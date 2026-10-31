type OrganizationProfileParts = {
  root: HTMLElement;
  pageShell?: HTMLElement | null;
  heading: HTMLElement;
  banner?: HTMLElement | null;
  inner: HTMLElement;
  logo: HTMLElement;
  count?: HTMLElement | null;
  title: HTMLElement;
  tags?: HTMLElement | null;
  focus?: HTMLElement | null;
  joinUs?: HTMLElement | null;
  subnavWrapper?: HTMLElement | null;
  joinButton?: HTMLElement | null;
  body?: HTMLElement | null;
  description?: HTMLElement | null;
  nativeCover?: HTMLElement | null;
  coverImage?: HTMLImageElement | null;
  nativeVideo?: HTMLElement | null;
  iframe?: HTMLIFrameElement | null;
  sid?: string;
  isMembersPage?: boolean;
};

type MovedNode = { node: Node; placeholder: Comment };

const TAG_LABELS: Record<string, string> = {
  model: 'Archetype',
  commitment: 'Commitment',
  roleplay: 'Playstyle',
};

const SECTION_TAB_LABELS = [
  ['history', 'History'],
  ['manifesto', 'Manifesto'],
  ['charter', 'Charter'],
] as const;

function createElement<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

function moveNode(node: Node | null | undefined, parent: Node, doc: Document, moved: MovedNode[]): void {
  if (!node?.parentNode) return;
  const placeholder = doc.createComment(' RSI Enhanced organization profile position ');
  node.parentNode.insertBefore(placeholder, node);
  parent.appendChild(node);
  moved.push({ node, placeholder });
}

function directChildWithClasses(parent: HTMLElement, ...classes: string[]): HTMLElement | null {
  return [...parent.children].find((child): child is HTMLElement => classes.every(name => child.classList.contains(name))) ?? null;
}

function memberCountText(count?: HTMLElement | null): string {
  const value = count?.textContent?.trim().replace(/\s+members?\s*$/i, '').trim() ?? '';
  const numeric = Number(value.replace(/,/g, ''));
  return value && Number.isFinite(numeric)
    ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(numeric)
    : value;
}

function makeMediaCaption(doc: Document, title: string, label: string, actionUrl?: string | null): HTMLElement {
  const caption = createElement(doc, 'div', 'rsi-org-media-caption');
  const action = createElement(doc, actionUrl ? 'a' : 'span', 'rsi-org-media-action', ` - ${label}`);
  if (actionUrl && action.tagName.toLowerCase() === 'a') {
    const link = action as HTMLAnchorElement;
    link.href = actionUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', `Open organization video on ${label.replace(/\s*↗$/, '')}`);
  }
  caption.append(createElement(doc, 'strong', '', title), action);
  return caption;
}

function simplifyDescriptionTabs(description: HTMLElement | null | undefined, cleanup: (() => void)[]): void {
  const nav = description?.querySelector<HTMLElement>('.nav');
  if (!nav) return;

  for (const item of [...nav.children].filter((child): child is HTMLElement => child.nodeType === 1)) {
    const directTag = item.tagName.toLowerCase();
    const control = directTag === 'a' || directTag === 'button'
      ? item as HTMLAnchorElement | HTMLButtonElement
      : directTag === 'li'
        ? item.querySelector<HTMLAnchorElement>('a') ?? item.querySelector<HTMLButtonElement>('button')
        : null;
    if (!control) continue;
    const wrapper = control === item ? null : item;

    const source = [
      item.textContent,
      control.textContent,
      control.getAttribute('aria-label'),
      control.getAttribute('title'),
      control.getAttribute('href'),
      control.getAttribute('data-target'),
      control.getAttribute('data-content_id'),
      control.getAttribute('data-content-id'),
      control.getAttribute('aria-controls'),
    ].filter(Boolean).join(' ').toLowerCase();
    const label = SECTION_TAB_LABELS.find(([key]) => source.includes(key))?.[1];
    if (!label) continue;

    const originalItemChildren = [...item.childNodes];
    const originalControlChildren = [...control.childNodes];
    control.textContent = label;
    if (wrapper) wrapper.replaceChildren(control);
    cleanup.push(() => {
      control.replaceChildren(...originalControlChildren);
      if (wrapper) wrapper.replaceChildren(...originalItemChildren);
    });
  }
}

function youtubeWatchUrl(iframe?: HTMLIFrameElement | null): string | null {
  if (!iframe) return null;
  const sources = [iframe.getAttribute('data-src'), iframe.getAttribute('src'), iframe.src].filter(Boolean);
  for (const source of sources) {
    try {
      const url = new URL(source!, 'https://robertsspaceindustries.com');
      const host = url.hostname.toLowerCase();
      let videoId = '';
      if (host === 'youtube.com' || host === 'www.youtube.com' || host === 'm.youtube.com'
        || host === 'youtube-nocookie.com' || host === 'www.youtube-nocookie.com') {
        if (url.pathname === '/watch') videoId = url.searchParams.get('v') ?? '';
        else videoId = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/)?.[1] ?? '';
      } else if (host === 'youtu.be' || host === 'www.youtu.be') {
        videoId = url.pathname.split('/').filter(Boolean)[0] ?? '';
      }
      if (videoId && /^[a-zA-Z0-9_-]{6,}$/.test(videoId)) {
        return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
      }
    } catch {
      // Ignore malformed or non-YouTube iframe sources.
    }
  }
  return null;
}

function appendFact(doc: Document, list: HTMLElement, label: string, value: string): void {
  if (!value) return;
  const row = createElement(doc, 'div', 'rsi-org-fact-row');
  row.append(createElement(doc, 'dt', '', label), createElement(doc, 'dd', '', value));
  list.appendChild(row);
}

function safeOrganizationLinkUrl(value: string): string | null {
  try {
    const url = new URL(value, 'https://robertsspaceindustries.com');
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

function makeBreadcrumb(parts: OrganizationProfileParts, doc: Document, generated: HTMLElement[]): void {
  if (!parts.pageShell || !parts.sid) return;
  const nav = createElement(doc, 'nav', 'rsi-org-profile-breadcrumb');
  nav.setAttribute('aria-label', 'Breadcrumb');
  const community = createElement(doc, 'a', '', 'Community');
  community.href = '/en/community';
  const organizations = createElement(doc, 'a', '', 'Organizations');
  organizations.href = '/en/community/orgs';
  nav.append(community, createElement(doc, 'span', 'rsi-org-breadcrumb-separator', '/'), organizations);
  nav.append(createElement(doc, 'span', 'rsi-org-breadcrumb-separator', '/'), createElement(doc, 'strong', '', parts.sid));
  if (parts.isMembersPage) {
    nav.append(createElement(doc, 'span', 'rsi-org-breadcrumb-separator', '/'), createElement(doc, 'strong', '', 'Members'));
  }
  parts.pageShell.insertBefore(nav, parts.root);
  generated.push(nav);
}

function makeSidebar(parts: OrganizationProfileParts, doc: Document): HTMLElement {
  const aside = createElement(doc, 'aside', 'rsi-org-overview-sidebar');
  aside.setAttribute('aria-label', 'Organization information');

  const profilePanel = createElement(doc, 'section', 'rsi-org-panel rsi-org-profile-panel');
  profilePanel.appendChild(createElement(doc, 'h2', 'rsi-org-panel-heading', 'Organization profile'));
  const facts = createElement(doc, 'dl', 'rsi-org-fact-list');
  for (const tag of parts.tags?.querySelectorAll<HTMLElement>('li') ?? []) {
    const tagClass = Object.keys(TAG_LABELS).find(name => tag.classList.contains(name));
    if (tagClass) appendFact(doc, facts, TAG_LABELS[tagClass], tag.textContent?.trim() ?? '');
  }
  appendFact(doc, facts, 'Members', memberCountText(parts.count));
  profilePanel.appendChild(facts);
  aside.appendChild(profilePanel);

  const activityNodes = [...(parts.focus?.querySelectorAll<HTMLElement>('li') ?? [])];
  if (activityNodes.length) {
    const activitiesPanel = createElement(doc, 'section', 'rsi-org-panel rsi-org-activities-panel');
    activitiesPanel.appendChild(createElement(doc, 'h2', 'rsi-org-panel-heading', 'Primary activities'));
    const activityList = createElement(doc, 'div', 'rsi-org-activity-list');
    for (const source of activityNodes) {
      const label = source.querySelector<HTMLElement>('.rsi-tooltip')?.textContent?.trim()
        || source.querySelector<HTMLImageElement>('img')?.alt?.trim()
        || source.textContent?.trim();
      if (!label) continue;
      const card = createElement(doc, 'div', 'rsi-org-activity-card');
      const image = source.querySelector<HTMLImageElement>('img')?.cloneNode(true) as HTMLImageElement | undefined;
      if (image) {
        image.setAttribute('alt', '');
        card.appendChild(image);
      }
      card.appendChild(createElement(doc, 'strong', '', label));
      activityList.appendChild(card);
    }
    activitiesPanel.appendChild(activityList);
    aside.appendChild(activitiesPanel);
  }

  const links = [...(parts.body?.querySelectorAll<HTMLAnchorElement>('a[href]') ?? [])];
  if (links.length) {
    const connectPanel = createElement(doc, 'section', 'rsi-org-panel rsi-org-connect-panel');
    connectPanel.appendChild(createElement(doc, 'h2', 'rsi-org-panel-heading', 'Connect with the organization'));
    const linkList = createElement(doc, 'div', 'rsi-org-connect-links');
    for (const link of links) {
      const href = safeOrganizationLinkUrl(link.href);
      if (!href) continue;
      const copy = createElement(doc, 'a', '', link.textContent?.trim() || href);
      copy.href = href;
      if (link.target.trim().toLowerCase() === '_blank') {
        copy.target = '_blank';
        copy.rel = 'noopener noreferrer';
      }
      linkList.appendChild(copy);
    }
    if (linkList.children.length) {
      connectPanel.appendChild(linkList);
      aside.appendChild(connectPanel);
    }
  }
  return aside;
}

function makeMediaPanel(parts: OrganizationProfileParts, doc: Document, generated: HTMLElement[], moved: MovedNode[], cleanup: (() => void)[]): HTMLElement | null {
  const media = [parts.nativeCover, parts.nativeVideo].filter((node): node is HTMLElement => Boolean(node));
  if (!media.length) return null;

  const panel = createElement(doc, 'section', 'rsi-org-panel rsi-org-media-panel');
  const suffix = [parts.coverImage ? '1 image' : '', parts.iframe ? '1 video' : ''].filter(Boolean).join(' · ');
  const heading = createElement(doc, 'h2', 'rsi-org-panel-heading', 'Organization media');
  if (suffix) heading.appendChild(createElement(doc, 'span', 'rsi-org-media-count', suffix));
  panel.appendChild(heading);
  const grid = createElement(doc, 'div', 'rsi-org-media-grid');
  panel.appendChild(grid);
  generated.push(panel, grid);

  if (parts.nativeCover) {
    const originalClass = parts.nativeCover.className;
    parts.nativeCover.className = `${originalClass} rsi-org-media-card`.trim();
    cleanup.push(() => { parts.nativeCover!.className = originalClass; });
    moveNode(parts.nativeCover, grid, doc, moved);
    if (parts.coverImage) {
      const image = parts.coverImage;
      const originalParent = image.parentNode;
      if (originalParent && (originalParent as HTMLElement).tagName !== 'A') {
        const link = createElement(doc, 'a', 'rsi-org-media-visual');
        link.href = image.currentSrc || image.src;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.setAttribute('aria-label', image.alt ? `Open full-size ${image.alt}` : 'Open full-size organization artwork');
        moveNode(image, link, doc, moved);
        parts.nativeCover.appendChild(link);
        generated.push(link);
      }
    }
    const caption = makeMediaCaption(doc, 'Organization artwork', 'Full size ↗');
    parts.nativeCover.appendChild(caption);
    generated.push(caption);
  }

  if (parts.nativeVideo) {
    const originalClass = parts.nativeVideo.className;
    parts.nativeVideo.className = `${originalClass} rsi-org-media-card`.trim();
    cleanup.push(() => { parts.nativeVideo!.className = originalClass; });
    moveNode(parts.nativeVideo, grid, doc, moved);
    const caption = makeMediaCaption(doc, 'Organization video', 'YouTube ↗', youtubeWatchUrl(parts.iframe));
    parts.nativeVideo.appendChild(caption);
    generated.push(caption);
  }
  return panel;
}

/** Adds the approved page hierarchy around native RSI organization content and returns a full DOM restore. */
export function enhanceOrganizationProfile(parts: OrganizationProfileParts, doc: Document = document): () => void {
  const moved: MovedNode[] = [];
  const generated: HTMLElement[] = [];
  const cleanup: (() => void)[] = [];
  const originalDataset = parts.root.dataset.rsiProfileEnhanced;
  const originalInnerClass = parts.inner.className;

  parts.root.dataset.rsiProfileEnhanced = 'true';
  parts.inner.className = `${originalInnerClass} rsi-org-identity-bar`.trim();
  makeBreadcrumb(parts, doc, generated);
  if (!parts.isMembersPage) simplifyDescriptionTabs(parts.description, cleanup);

  const copy = createElement(doc, 'div', 'rsi-org-identity-copy');
  copy.appendChild(createElement(doc, 'p', 'rsi-org-eyebrow', 'Star Citizen organization'));
  moveNode(parts.title, copy, doc, moved);
  moveNode(parts.tags, copy, doc, moved);
  parts.inner.appendChild(copy);
  generated.push(copy);

  const stats = createElement(doc, 'div', 'rsi-org-identity-stats');
  const memberStat = createElement(doc, 'div', 'rsi-org-member-stat');
  memberStat.append(
    createElement(doc, 'span', 'rsi-org-stat-label', 'Organization size'),
    createElement(doc, 'span', 'rsi-org-stat-value', memberCountText(parts.count)),
    createElement(doc, 'span', 'rsi-org-stat-caption', 'Members'),
  );
  stats.appendChild(memberStat);
  moveNode(parts.focus, stats, doc, moved);
  parts.inner.appendChild(stats);
  generated.push(stats);

  if (parts.banner) {
    parts.banner.appendChild(createElement(doc, 'span', 'rsi-org-profile-label', parts.isMembersPage ? 'Organization members' : 'Organization profile'));
    generated.push(parts.banner.querySelector<HTMLElement>('.rsi-org-profile-label')!);
  }
  const memberTab = [...(parts.subnavWrapper?.querySelectorAll<HTMLAnchorElement>('a') ?? [])]
    .find(anchor => anchor.textContent?.trim().toLowerCase() === 'members');
  const countText = memberCountText(parts.count);
  if (memberTab && countText) {
    const tabCount = createElement(doc, 'span', 'rsi-org-tab-count', countText);
    memberTab.appendChild(tabCount);
    generated.push(tabCount);
  }

  if (parts.body && !parts.isMembersPage && parts.joinUs) {
    const mission = createElement(doc, 'section', 'rsi-org-mission-panel');
    mission.appendChild(createElement(doc, 'h2', 'rsi-org-panel-heading', 'Mission briefing'));
    const content = createElement(doc, 'div', 'rsi-org-mission-content');
    moveNode(parts.body, content, doc, moved);
    mission.appendChild(content);
    parts.joinUs.appendChild(mission);
    generated.push(mission, content);
  }

  if (!parts.isMembersPage) {
    const sidebar = makeSidebar(parts, doc);
    parts.root.appendChild(sidebar);
    generated.push(sidebar);

    const mediaPanel = makeMediaPanel(parts, doc, generated, moved, cleanup);
    if (mediaPanel) parts.root.appendChild(mediaPanel);
  }

  return () => {
    for (const item of [...moved].reverse()) {
      const parent = item.placeholder.parentNode;
      if (parent) parent.replaceChild(item.node, item.placeholder);
    }
    for (const element of [...generated].reverse()) element.remove();
    for (const undo of cleanup.reverse()) undo();
    parts.inner.className = originalInnerClass;
    if (originalDataset === undefined) delete parts.root.dataset.rsiProfileEnhanced;
    else parts.root.dataset.rsiProfileEnhanced = originalDataset;
  };
}

type ProfileWindow = Pick<Window, 'setTimeout' | 'clearTimeout' | 'location'>;

/** Installs a route-gated, one-shot DOM enhancer; it disconnects discovery as soon as the profile appears. */
export function installOrganizationProfile(
  enabled: () => boolean,
  win: ProfileWindow = window,
  doc: Document = document,
): () => void {
  let currentRoot: HTMLElement | null = null;
  let currentRouteKey: string | null = null;
  let restore: (() => void) | null = null;
  let observer: MutationObserver | null = null;
  let timeout: number | null = null;

  const stopDiscovery = () => {
    observer?.disconnect();
    observer = null;
    if (timeout !== null) win.clearTimeout(timeout);
    timeout = null;
  };

  const restoreCurrent = () => {
    stopDiscovery();
    restore?.();
    restore = null;
    currentRoot = null;
    currentRouteKey = null;
  };

  const profileParts = (): OrganizationProfileParts | null => {
    const memberOrganization = doc.querySelector<HTMLElement>('#organization-page #organization.public:has(#members-data)');
    const profileRoot = doc.querySelector<HTMLElement>([
      '#organization-page #bodyWrapper > .page-wrapper > #contentbody.public.profile > #organization.public > .wrapper > .content-wrapper',
    ].join(', '));
    const isMembersPage = Boolean(memberOrganization);
    const root = isMembersPage ? memberOrganization : profileRoot;
    if (!root) return null;
    const headingRoot = isMembersPage
      ? root.querySelector<HTMLElement>(':scope > .wrapper') ?? root
      : root;
    const heading = isMembersPage
      ? headingRoot.querySelector<HTMLElement>(':scope > .heading') ?? headingRoot.querySelector<HTMLElement>('.heading:has(> .inner)')
      : headingRoot.querySelector<HTMLElement>('.heading');
    const inner = heading?.querySelector<HTMLElement>('.inner');
    const logo = inner?.querySelector<HTMLElement>('.logo');
    const title = inner?.querySelector<HTMLElement>('h1');
    const joinUs = isMembersPage ? null : root.querySelector<HTMLElement>('.content.join-us');
    if (!heading || !inner || !logo || !title || (!isMembersPage && !joinUs)) return null;
    const subnavWrapper = isMembersPage
      ? headingRoot.querySelector<HTMLElement>(':scope > .subnav-wrapper')
      : joinUs?.querySelector<HTMLElement>('.subnav-wrapper');
    const count = logo.querySelector<HTMLElement>('.count');
    const focus = inner.querySelector<HTMLElement>('.focus');
    const cover = directChildWithClasses(root, 'content', 'block', 'cover');
    const video = directChildWithClasses(root, 'content', 'block', 'youtube');
    const pathSegments = win.location.pathname.split('/').filter(Boolean);
    return {
      root,
      heading,
      pageShell: root.parentElement,
      banner: heading.querySelector<HTMLElement>('.banner'),
      inner,
      logo,
      count,
      title,
      tags: inner.querySelector<HTMLElement>('.tags'),
      focus,
      joinUs,
      subnavWrapper,
      joinButton: subnavWrapper?.querySelector<HTMLElement>('.holobtn'),
      body: joinUs?.querySelector<HTMLElement>('.body'),
      description: directChildWithClasses(root, 'content', 'block', 'description'),
      nativeCover: cover,
      coverImage: cover?.querySelector<HTMLImageElement>('img'),
      nativeVideo: video,
      iframe: video?.querySelector<HTMLIFrameElement>('iframe'),
      sid: (isMembersPage ? pathSegments.at(-2) : pathSegments.at(-1))?.toUpperCase(),
      isMembersPage,
    };
  };

  const apply = () => {
    if (!enabled()) { restoreCurrent(); return; }
    const parts = profileParts();
    if (parts) {
      const routeKey = `${parts.sid ?? ''}:${parts.isMembersPage ? 'members' : 'profile'}`;
      if (currentRoot === parts.root && currentRouteKey === routeKey) return;
      restoreCurrent();
      currentRoot = parts.root;
      currentRouteKey = routeKey;
      restore = enhanceOrganizationProfile(parts, doc);
      stopDiscovery();
      return;
    }
    if (observer || doc.readyState === 'loading') return;
    const target = doc.querySelector<HTMLElement>('#bodyWrapper') ?? doc.documentElement;
    if (!target) return;
    const activeObserver = new MutationObserver(() => {
      const next = profileParts();
      if (!next) return;
      activeObserver.disconnect();
      if (observer === activeObserver) observer = null;
      currentRoot = next.root;
      currentRouteKey = `${next.sid ?? ''}:${next.isMembersPage ? 'members' : 'profile'}`;
      restore = enhanceOrganizationProfile(next, doc);
      if (timeout !== null) win.clearTimeout(timeout);
      timeout = null;
    });
    observer = activeObserver;
    activeObserver.observe(target, { childList: true, subtree: true });
    timeout = win.setTimeout(stopDiscovery, 15_000);
  };

  return () => apply();
}
