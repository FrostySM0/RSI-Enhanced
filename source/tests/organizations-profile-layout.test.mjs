import assert from 'node:assert/strict';
import { test } from 'node:test';
import { enhanceOrganizationProfile } from '../src/content/organization-profile.ts';

class FakeNode {
  constructor(tagName, className = '', text = '') {
    this.tagName = tagName.toUpperCase();
    this.className = className;
    this.nodeType = tagName === '#comment' ? 8 : 1;
    this._text = text;
    this.children = [];
    this.parentNode = null;
    this.dataset = {};
    this.attributes = {};
    this.src = '';
    this.currentSrc = '';
    this.href = '';
    this.title = '';
    this.alt = '';
  }

  get classList() {
    const names = () => this.className.split(/\s+/).filter(Boolean);
    return {
      contains: name => names().includes(name),
      add: (...items) => { this.className = [...new Set([...names(), ...items])].join(' '); },
      remove: (...items) => { this.className = names().filter(name => !items.includes(name)).join(' '); },
    };
  }

  get parentElement() { return this.parentNode?.nodeType === 1 ? this.parentNode : null; }
  get childNodes() { return this.children; }

  get textContent() {
    return this._text + this.children.map(child => child.textContent).join('');
  }

  set textContent(value) {
    this._text = String(value ?? '');
    for (const child of this.children) child.parentNode = null;
    this.children = [];
  }

  append(...nodes) { for (const node of nodes) this.appendChild(node); }

  appendChild(node) {
    node.remove();
    node.parentNode = this;
    this.children.push(node);
    return node;
  }

  insertBefore(node, reference) {
    node.remove();
    const index = reference ? this.children.indexOf(reference) : -1;
    node.parentNode = this;
    this.children.splice(index < 0 ? this.children.length : index, 0, node);
    return node;
  }

  removeChild(node) {
    const index = this.children.indexOf(node);
    if (index >= 0) this.children.splice(index, 1);
    node.parentNode = null;
    return node;
  }

  replaceChildren(...nodes) {
    for (const child of [...this.children]) this.removeChild(child);
    this._text = '';
    for (const node of nodes) this.appendChild(node);
  }

  replaceChild(replacement, current) {
    const index = this.children.indexOf(current);
    if (index < 0) throw new Error('Node to replace was not found.');
    replacement.remove();
    replacement.parentNode = this;
    this.children[index] = replacement;
    current.parentNode = null;
    return current;
  }

  remove() { this.parentNode?.removeChild(this); }

  after(node) {
    if (!this.parentNode) return;
    const siblings = this.parentNode.children;
    this.parentNode.insertBefore(node, siblings[siblings.indexOf(this) + 1] ?? null);
  }

  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }

  matches(selector) {
    const tag = selector.match(/^[a-z][a-z0-9-]*/i)?.[0];
    if (tag && this.tagName.toLowerCase() !== tag.toLowerCase()) return false;
    const classes = [...selector.matchAll(/\.([a-z0-9_-]+)/gi)].map(match => match[1]);
    if (!classes.every(name => this.classList.contains(name))) return false;
    if (selector.includes('[href]') && !this.href && !this.attributes.href) return false;
    return Boolean(tag || classes.length || selector === '*');
  }

  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }

  querySelectorAll(selector) {
    const matches = [];
    const visit = node => {
      for (const child of node.children) {
        if (child.matches(selector)) matches.push(child);
        visit(child);
      }
    };
    visit(this);
    return matches;
  }

  cloneNode(deep = false) {
    const clone = new FakeNode(this.tagName.toLowerCase(), this.className, this._text);
    Object.assign(clone, {
      dataset: { ...this.dataset }, attributes: { ...this.attributes }, src: this.src,
      currentSrc: this.currentSrc, href: this.href, title: this.title, alt: this.alt,
    });
    if (deep) for (const child of this.children) clone.appendChild(child.cloneNode(true));
    return clone;
  }
}

class FakeDocument {
  createElement(tagName) { return new FakeNode(tagName); }
  createComment(text) { return new FakeNode('#comment', '', text); }
}

function makeProfile({ cover = true, video = true } = {}) {
  const doc = new FakeDocument();
  const root = new FakeNode('div', 'content-wrapper');
  const heading = new FakeNode('div', 'heading');
  const inner = new FakeNode('div', 'inner');
  const logo = new FakeNode('div', 'logo');
  const count = new FakeNode('span', 'count', '4,464 MEMBERS');
  const title = new FakeNode('h1', '', 'Interstellar Trading Corporation / ITCN');
  const tags = new FakeNode('ul', 'tags');
  tags.append(new FakeNode('li', 'model', 'Corporation'), new FakeNode('li', 'commitment', 'Casual'), new FakeNode('li', 'roleplay', 'Role play'));
  const focus = new FakeNode('ul', 'focus');
  const activity = new FakeNode('li');
  const icon = new FakeNode('img');
  icon.src = icon.currentSrc = 'https://robertsspaceindustries.com/media/security.png';
  const tooltip = new FakeNode('div', 'rsi-tooltip', 'Security');
  activity.append(icon, tooltip);
  focus.append(activity);
  logo.append(count);
  inner.append(logo, title, tags, focus);
  heading.append(inner);

  const joinUs = new FakeNode('div', 'content join-us');
  const subnavWrapper = new FakeNode('div', 'subnav-wrapper');
  const subnav = new FakeNode('ul', 'subnav');
  const joinButton = new FakeNode('a', 'holobtn', 'Join us now');
  subnavWrapper.append(subnav, joinButton);
  const body = new FakeNode('div', 'body markitup-text', 'We are ITC. Get rich. Blast pirates. Own the Universe.');
  joinUs.append(subnavWrapper, body);
  const description = new FakeNode('div', 'content block description');
  const sectionNav = new FakeNode('div', 'nav clearfix');
  const sectionTabs = ['History', 'Manifesto', 'Charter'].map((label, index) => {
    const slug = label.toLowerCase();
    const control = new FakeNode('a', `${slug}${index === 0 ? ' active' : ''} js-show-description-content`);
    control.href = `#${label.toLowerCase()}`;
    control.setAttribute('href', `#${slug}`);
    control.setAttribute('data-content_id', `tab-${slug}`);
    const text = new FakeNode('strong', '', label);
    const glyph = new FakeNode('span', 'ico');
    control.append(glyph, text);
    sectionNav.append(control);
    return { item: control, control, originalItemChildren: [...control.children], originalControlChildren: [...control.children], label };
  });
  description.append(sectionNav);
  const nativeCover = cover ? new FakeNode('div', 'content block cover') : null;
  const coverImage = cover ? new FakeNode('img') : null;
  if (coverImage) {
    coverImage.src = coverImage.currentSrc = 'https://robertsspaceindustries.com/media/itcn-cover.jpg';
    coverImage.alt = 'ITC artwork';
    nativeCover.append(coverImage);
  }
  const nativeVideo = video ? new FakeNode('div', 'content block youtube') : null;
  const iframe = video ? new FakeNode('iframe') : null;
  if (iframe) {
    iframe.src = 'https://static.robertsspaceindustries.com/rsi/static/cookiebot-embed.html';
    iframe.title = 'Join ITC';
    iframe.setAttribute('data-src', '//www.youtube.com/embed/G0Pmsp9tyhQ');
    nativeVideo.append(iframe);
  }
  root.append(heading, joinUs, description);
  if (nativeCover) root.append(nativeCover);
  if (nativeVideo) root.append(nativeVideo);

  return { doc, root, heading, inner, logo, count, title, tags, focus, joinUs, subnavWrapper, subnav, joinButton, body, description, sectionNav, sectionTabs, nativeCover, coverImage, nativeVideo, iframe };
}

test('organization profile composition matches the mockup structure and restores native content', () => {
  const profile = makeProfile();
  const originalChildren = [...profile.root.children];
  const originalFocusParent = profile.focus.parentNode;
  const originalCoverImageParent = profile.coverImage.parentNode;
  const originalFrameSrc = profile.iframe.src;
  const originalFrameDataSrc = profile.iframe.getAttribute('data-src');

  const restore = enhanceOrganizationProfile(profile, profile.doc);
  assert.equal(typeof restore, 'function');
  assert.equal(profile.root.dataset.rsiProfileEnhanced, 'true');

  const identityStats = profile.inner.querySelector('.rsi-org-identity-stats');
  const sidebar = profile.root.querySelector('.rsi-org-overview-sidebar');
  const mediaPanel = profile.root.querySelector('.rsi-org-media-panel');
  assert.ok(identityStats, 'hero includes the live member/activity stats group');
  assert.ok(sidebar, 'overview gets a profile/activity sidebar');
  assert.ok(mediaPanel, 'optional native image and video share the mockup media panel');
  assert.equal(profile.focus.parentNode, identityStats, 'native activity icons remain in the hero');
  assert.equal(profile.joinButton.parentNode, profile.subnavWrapper, 'the native Join action keeps its delegated-event ancestry');
  assert.match(sidebar.textContent, /Corporation/);
  assert.match(sidebar.textContent, /Casual/);
  assert.match(sidebar.textContent, /4,464/);
  assert.equal(profile.nativeCover.parentNode.className, 'rsi-org-media-grid');
  assert.equal(profile.nativeVideo.parentNode.className, 'rsi-org-media-grid');
  for (const { item, control, label } of profile.sectionTabs) {
    assert.equal(item, control, `${label} keeps the original direct native tab control`);
    assert.equal(control.children.length, 0, `${label} removes the native glyph markup`);
    assert.equal(control.textContent, label, `${label} label replaces native icon artwork`);
  }
  assert.equal(profile.iframe.src, originalFrameSrc);
  assert.equal(profile.iframe.getAttribute('data-src'), originalFrameDataSrc);
  const imageLink = profile.nativeCover.querySelector('a');
  assert.equal(imageLink.href, profile.coverImage.src, 'full-size artwork link uses the native image URL');
  const captions = [...profile.root.querySelectorAll('.rsi-org-media-caption')];
  assert.equal(captions.length, 2);
  assert.equal(captions[0].textContent, 'Organization artwork - Full size ↗');
  assert.doesNotMatch(captions[0].textContent, /Image\s*·/);
  assert.equal(captions[1].textContent, 'Organization video - YouTube ↗');
  assert.doesNotMatch(captions[1].textContent, /Video\s*·/);
  const videoLink = captions[1].querySelector('a');
  assert.ok(videoLink, 'the YouTube action is a link to the native organization video');
  assert.equal(videoLink.href, 'https://www.youtube.com/watch?v=G0Pmsp9tyhQ');
  assert.equal(videoLink.target, '_blank');
  assert.equal(videoLink.rel, 'noopener noreferrer');

  restore();
  assert.equal(profile.root.dataset.rsiProfileEnhanced, undefined);
  assert.deepEqual(profile.root.children, originalChildren);
  assert.equal(profile.focus.parentNode, originalFocusParent);
  assert.equal(profile.coverImage.parentNode, originalCoverImageParent);
  assert.equal(profile.nativeCover.parentNode, profile.root);
  assert.equal(profile.nativeVideo.parentNode, profile.root);
  for (const { item, control, originalItemChildren, originalControlChildren } of profile.sectionTabs) {
    assert.deepEqual(item.children, originalItemChildren, 'restore the native tab and marker nodes in order');
    assert.deepEqual(control.children, originalControlChildren, 'restore the native tab glyph and label nodes');
  }
  assert.equal(profile.iframe.src, originalFrameSrc);
  assert.equal(profile.iframe.getAttribute('data-src'), originalFrameDataSrc);
});

test('organization profile composition supports pages that provide only one media type', () => {
  const profile = makeProfile({ cover: false, video: true });
  enhanceOrganizationProfile(profile, profile.doc);
  const panel = profile.root.querySelector('.rsi-org-media-panel');
  assert.ok(panel);
  assert.match(panel.textContent, /1 video/);
  assert.doesNotMatch(panel.textContent, /image/);
});

test('organization connect links reject unsafe schemes and isolate new-tab links', () => {
  const profile = makeProfile();
  const addLink = (href, text, target = '', rel = '') => {
    const link = new FakeNode('a', '', text);
    link.href = href;
    link.target = target;
    link.rel = rel;
    profile.body.append(link);
  };

  addLink('javascript:alert(1)', 'Official site', '_blank', 'opener');
  addLink('data:text/html,unsafe', 'Community page');
  addLink('https://user:secret@example.com/', 'Credentialed URL');
  addLink('https://community.example/', 'Community', '_blank', 'opener');
  addLink('https://example.com/contact', 'Contact', '_top');

  enhanceOrganizationProfile(profile, profile.doc);

  const links = profile.root.querySelector('.rsi-org-overview-sidebar')
    .querySelector('.rsi-org-connect-links').querySelectorAll('a');
  assert.equal(links.length, 2, 'only credential-free HTTP(S) links are copied');
  assert.equal(links[0].href, 'https://community.example/');
  assert.equal(links[0].target, '_blank');
  assert.equal(links[0].rel, 'noopener noreferrer');
  assert.equal(links[1].href, 'https://example.com/contact');
  assert.equal(links[1].target || '', '', 'named targets are not copied');
  assert.equal(links[1].rel || '', '', 'page-provided rel values are not copied');
});

test('organization Members composition matches the shared organization header and omits profile-only panels', () => {
  const profile = makeProfile();
  profile.count.textContent = '4464 members';
  const membersTab = new FakeNode('a', '', 'Members');
  profile.subnav.appendChild(membersTab);
  const organization = new FakeNode('div', 'public members');
  const organizationWrapper = new FakeNode('div', 'wrapper');
  const pageShell = new FakeNode('div', 'contentbody public members');
  organization.append(organizationWrapper, profile.subnavWrapper);
  organizationWrapper.appendChild(profile.heading);
  pageShell.appendChild(organization);
  const banner = new FakeNode('div', 'banner');
  profile.heading.appendChild(banner);

  enhanceOrganizationProfile({
    ...profile,
    root: organization,
    pageShell,
    banner,
    joinUs: null,
    subnavWrapper: profile.subnavWrapper,
    sid: 'ITCN',
    isMembersPage: true,
  }, profile.doc);

  assert.equal(banner.querySelector('.rsi-org-profile-label')?.textContent, 'Organization members');
  assert.match(pageShell.querySelector('.rsi-org-profile-breadcrumb')?.textContent ?? '', /ITCN\s*\/\s*Members$/);
  assert.equal(pageShell.children[1], organization, 'breadcrumb sits before the organization root');
  assert.ok(profile.inner.querySelector('.rsi-org-identity-stats'), 'member header includes the organization-size card from the mockup');
  assert.equal(profile.inner.querySelector('.rsi-org-stat-value')?.textContent, '4,464');
  assert.equal(profile.subnavWrapper.querySelector('.rsi-org-tab-count')?.textContent, '4,464');
  assert.equal(profile.focus.parentNode, profile.inner.querySelector('.rsi-org-identity-stats'), 'member activity icons share the size card');
  assert.equal(profile.joinButton.parentNode, profile.subnavWrapper, 'native Join action keeps its original click ancestry');
  assert.equal(profile.root.querySelector('.rsi-org-overview-sidebar'), null);
  assert.equal(profile.root.querySelector('.rsi-org-media-panel'), null);
  assert.equal(profile.root.querySelector('.rsi-org-mission-panel'), null);
});
