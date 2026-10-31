interface Reply {
  id: string; thread_id?: string; parent_reply_id?: string; parent_reply_reference?: { id: string };
  content_reply_id?: string; is_thread_content?: boolean; is_erased?: boolean; subject?: string;
  member?: { displayname?: string; nickname?: string; avatar?: string | null };
  time_created?: number; content_blocks?: { type: string; data: unknown }[]; lexical_content?: string;
}
type Read = (endpoint: string, body: Record<string, string>) => Promise<unknown>;

export const DEVTRACKER_REPLY_QUERY = 'rsi-enhanced-reply';
export const DEVTRACKER_REPLY_ID_QUERY = 'rsi-enhanced-reply-id';
const PENDING_REPLY_STORAGE_KEY = 'rsiEnhanced.pendingSpectrumReply';

export function devTrackerReplyRequested(search: string): boolean {
  return new URLSearchParams(search).get(DEVTRACKER_REPLY_QUERY) === '1';
}

/** Direct-route fallback for browsers where Spectrum's native thread link is unavailable. */
export function conversationReplyHref(threadPath: string, replyId: string): string | null {
  if (!/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?spectrum\/community\/[^/?#]+\/forum\/\d+\/thread\/[^/?#]+$/i.test(threadPath) || !/^\d+$/.test(replyId)) return null;
  const query = new URLSearchParams([[DEVTRACKER_REPLY_QUERY, '1'], [DEVTRACKER_REPLY_ID_QUERY, replyId]]);
  return `${threadPath}/${replyId}?${query}`;
}

interface PendingReplyIntent { threadPath: string; replyId: string; createdAt: number }

function savePendingReplyIntent(win: Window, intent: PendingReplyIntent): boolean {
  try { win.sessionStorage.setItem(PENDING_REPLY_STORAGE_KEY, JSON.stringify(intent)); return true; }
  catch { return false; }
}

function readPendingReplyIntent(win: Window): PendingReplyIntent | null {
  try {
    const raw = win.sessionStorage.getItem(PENDING_REPLY_STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<PendingReplyIntent>;
    const threadPath = typeof value.threadPath === 'string' ? value.threadPath.replace(/\/+$/, '') : '';
    const replyId = typeof value.replyId === 'string' ? value.replyId : '';
    const createdAt = typeof value.createdAt === 'number' ? value.createdAt : 0;
    const now = Date.now();
    if (!/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?spectrum\/community\/[^/?#]+\/forum\/\d+\/thread\/[^/?#]+$/i.test(threadPath)
      || !/^\d+$/.test(replyId) || createdAt > now || now - createdAt > 60_000) {
      win.sessionStorage.removeItem(PENDING_REPLY_STORAGE_KEY);
      return null;
    }
    return { threadPath, replyId, createdAt };
  } catch { return null; }
}

function clearPendingReplyIntent(win: Window): void {
  try { win.sessionStorage.removeItem(PENDING_REPLY_STORAGE_KEY); } catch { /* Storage can be unavailable in restricted tabs. */ }
}

/** Activates Spectrum's own Reply control on the exact linked post. */
export function openNativeReplyControl(target: Pick<HTMLElement, 'querySelectorAll'>): boolean {
  const controls = target.querySelectorAll<HTMLElement>('button,[role="button"]');
  const reply = [...controls].find(control => {
    if ((control as HTMLButtonElement).disabled || control.hidden || control.getAttribute('aria-hidden') === 'true') return false;
    const owner = control.closest?.('.forum-thread-item');
    if (owner && owner !== target) return false;
    const label = (control.getAttribute('aria-label') || control.getAttribute('title') || control.textContent || '').replace(/\s+/g, ' ').trim();
    return /^(?:reply|reply to\b|respond|respond to\b)(?:\s|$)/i.test(label);
  });
  if (!reply) return false;
  reply.click();
  return true;
}

export function conversationRoute(path: string): { threadPath: string; slug: string; replyId: string } | null {
  const match = /^(\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?spectrum\/community\/[^/]+\/forum\/\d+\/thread\/([^/]+))\/(\d+)\/?$/i.exec(path);
  return match ? { threadPath: match[1], slug: match[2], replyId: match[3] } : null;
}

export async function loadConversation(slug: string, replyId: string, read: Read): Promise<Reply[]> {
  const thread = await read('/forum/thread/nested', { slug, sort: 'oldest', target_reply_id: replyId }) as Reply | null;
  if (!thread?.id || !thread.content_reply_id) throw new Error('Original post unavailable');
  const chain: Reply[] = [], seen = new Set<string>();
  let id: string | undefined = replyId;
  while (id && id !== thread.content_reply_id) {
    if (!/^\d+$/.test(id) || seen.has(id) || seen.size >= 128) throw new Error('Invalid parent chain');
    seen.add(id);
    const reply = await read('/forum/thread/reply', { reply_id: id }) as Reply | null;
    if (!reply || reply.id !== id || reply.thread_id !== thread.id) throw new Error('Parent reply unavailable');
    if (id !== replyId) chain.unshift(reply);
    id = reply.parent_reply_id || reply.parent_reply_reference?.id;
  }
  return [{ ...thread, id: thread.content_reply_id, is_thread_content: true }, ...chain];
}

/** Reads the linked Dev Tracker reply and the exact post it answers. */
export async function loadReplyAndParent(slug: string, replyId: string, read: Read): Promise<{ target: Reply; parent: Reply }> {
  if (!/^\d+$/.test(replyId)) throw new Error('Invalid reply ID');
  const target = await read('/forum/thread/reply', { reply_id: replyId }) as Reply | null;
  if (!target || target.id !== replyId || !/^\d+$/.test(target.thread_id || '')) throw new Error('Reply unavailable');

  const parentId = target.parent_reply_id?.trim() || target.parent_reply_reference?.id?.trim() || '';
  if (parentId) {
    if (!/^\d+$/.test(parentId) || parentId === replyId) throw new Error('Invalid parent reply ID');
    const parent = await read('/forum/thread/reply', { reply_id: parentId }) as Reply | null;
    if (!parent || parent.id !== parentId || parent.thread_id !== target.thread_id) throw new Error('Parent reply unavailable');
    return { target, parent };
  }

  const thread = await read('/forum/thread/nested', { slug, sort: 'oldest', target_reply_id: replyId }) as Reply | null;
  if (!thread || thread.id !== target.thread_id || !/^\d+$/.test(thread.content_reply_id || '')) throw new Error('Original post unavailable');
  return { target, parent: { ...thread, id: thread.content_reply_id!, is_thread_content: true } };
}

/** Reads only the post directly answered by the linked Dev Tracker reply. */
export async function loadReplyParent(slug: string, replyId: string, read: Read): Promise<Reply> {
  return (await loadReplyAndParent(slug, replyId, read)).parent;
}

const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
export function lexicalText(value: unknown): string {
  const node = object(value);
  if (typeof node.text === 'string') return node.text;
  if (node.type === 'linebreak') return '\n';
  return Array.isArray(node.children) ? node.children.map(lexicalText).join(node.type === 'root' ? '\n\n' : '') : '';
}
export function replyText(reply: Reply): string {
  if (reply.is_erased) return 'This post has been deleted.';
  let text = '';
  if (reply.lexical_content) {
    try { text = lexicalText(object(JSON.parse(reply.lexical_content)).root).trim(); } catch { /* Fall back to legacy content blocks. */ }
  }
  if (!text) {
    text = (reply.content_blocks || []).flatMap(block => {
      if (block.type !== 'text') return [];
      const blocks = object(block.data).blocks;
      return Array.isArray(blocks) ? blocks.map(item => object(item).text).filter((value): value is string => typeof value === 'string') : [];
    }).join('\n').trim();
  }
  const subject = reply.subject?.trim() || '';
  if (text) return subject ? `${subject}\n\n${text}` : text;
  if (subject) return subject;
  return (reply.content_blocks || []).some(block => block.type === 'image') ? 'This post contains an image attachment.' : 'This post has no text content.';
}
export function safeConversationAssetUrl(value: unknown, base: string): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value, base), host = url.hostname.toLowerCase();
    const isRsiHost = host === 'robertsspaceindustries.com' || host.endsWith('.robertsspaceindustries.com');
    return url.protocol === 'https:' && url.port === '' && isRsiHost && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function conversationAuthor(member: Reply['member'], base: string): { name: string; avatar: string } {
  return { name: member?.displayname?.trim() || member?.nickname?.trim() || 'Unavailable author',
    avatar: safeConversationAssetUrl(member?.avatar, base) || 'https://cdn.robertsspaceindustries.com/static/images/account/avatar_default_big.jpg' };
}

export function placeConversationControls(banner: HTMLElement, action: HTMLButtonElement, panel: HTMLElement): void {
  banner.append(action);
  banner.after(panel);
}

export function installConversation(enabled: () => boolean, win: Window = window, doc: Document = document): () => void {
  let observer: MutationObserver | null = null, controller: AbortController | null = null;
  let line: HTMLButtonElement | null = null, panel: HTMLElement | null = null, target: HTMLElement | null = null, replyStatus: HTMLElement | null = null, routeKey = '';
  let autoReplyOpened = false;
  let observerTimeout: ReturnType<typeof setTimeout> | undefined;
  let originalDepth = '';
  const cleanup = () => {
    observer?.disconnect(); observer = null; controller?.abort(); controller = null;
    if (observerTimeout !== undefined) clearTimeout(observerTimeout);
    line?.remove(); panel?.remove(); replyStatus?.remove(); target?.classList.remove('rsi-conversation-target', 'rsi-conversation-nested-target');
    if (target) { if (originalDepth) target.style.setProperty('--rsi-conversation-depth', originalDepth); else target.style.removeProperty('--rsi-conversation-depth'); }
    line = null; panel = null; target = null; replyStatus = null; autoReplyOpened = false;
  };
  const refresh = () => {
    let pendingReply = readPendingReplyIntent(win);
    const devTrackerReplyIntent = devTrackerReplyRequested(win.location.search);
    const requestedReplyId = new URLSearchParams(win.location.search).get(DEVTRACKER_REPLY_ID_QUERY);
    const route = conversationRoute(win.location.pathname);
    const replyId = requestedReplyId && /^\d+$/.test(requestedReplyId) ? requestedReplyId : route?.replyId;
    const currentThreadPath = route?.threadPath || win.location.pathname.replace(/\/+$/, '');
    if (pendingReply && pendingReply.threadPath !== currentThreadPath) {
      clearPendingReplyIntent(win);
      pendingReply = null;
    }
    const pendingMatchesRoute = Boolean(pendingReply);
    const autoReplyRequested = devTrackerReplyIntent || pendingMatchesRoute;
    const selectedReplyId = pendingMatchesRoute ? pendingReply!.replyId : replyId;
    if (!enabled() && !autoReplyRequested) { cleanup(); routeKey = ''; return; }
    if (doc.readyState === 'loading') return;
    if (!selectedReplyId) { cleanup(); routeKey = ''; return; }
    const currentRouteKey = `${win.location.pathname}${win.location.search}`;
    if (routeKey !== currentRouteKey) { cleanup(); routeKey = currentRouteKey; }
    const mount = () => {
      const banner = route ? [...doc.querySelectorAll<HTMLElement>('#react #page.forum-thread h3')].find(el => /viewing a single reply/i.test(el.textContent || '')) : null;
      const reply = doc.querySelector<HTMLElement>(`#react .forum-thread-item[data-reply-id="${selectedReplyId}"]`);
      if (!reply || (enabled() && route && !banner && !autoReplyRequested)) return false;
      if (enabled() && route && banner && !line?.isConnected) {
        target = reply; originalDepth = target.style.getPropertyValue('--rsi-conversation-depth'); target.classList.add('rsi-conversation-target');
        line = doc.createElement('button'); line.type = 'button'; line.className = 'rsi-extend-conversation';
        line.textContent = '↑ EXTEND CONVERSATION';
        line.setAttribute('aria-label', 'Extend conversation to show replies back to the original post');
        line.setAttribute('aria-expanded', 'false');
        panel = doc.createElement('section'); panel.className = 'rsi-conversation-context'; panel.hidden = true;
        panel.id = 'rsi-conversation-context'; panel.setAttribute('aria-label', 'Conversation leading to the linked reply');
        line.setAttribute('aria-controls', panel.id); placeConversationControls(banner, line, panel);
      let loaded = false;
      const appendReply = (entry: Reply, parent: HTMLElement, replyingTo: string) => {
        const card = doc.createElement('article'); card.className = 'rsi-conversation-card';
        const body = doc.createElement('div'); body.className = 'rsi-conversation-body'; card.append(body);
        const header = doc.createElement('header'), author = doc.createElement('strong'), link = doc.createElement('a');
        const member = conversationAuthor(entry.member, win.location.href);
        if (entry.member?.nickname) body.dataset.rsiAuthorHandle = entry.member.nickname;
        body.dataset.rsiAuthorName = member.name;
        author.textContent = member.name;
        const avatarSlot = doc.createElement('span'); avatarSlot.className = 'rsi-conversation-avatar-slot';
        const initials = doc.createElement('span'); initials.className = 'rsi-conversation-avatar-initials'; initials.textContent = member.name.slice(0, 2).toUpperCase(); initials.setAttribute('aria-hidden', 'true');
        const avatar = doc.createElement('img'); avatar.src = member.avatar; avatar.alt = `${member.name}'s profile picture`; avatar.className = 'rsi-conversation-avatar'; avatar.loading = 'lazy'; avatar.referrerPolicy = 'no-referrer';
        avatar.addEventListener('error', () => { avatar.remove(); avatarSlot.setAttribute('role', 'img'); avatarSlot.setAttribute('aria-label', `${member.name}'s avatar unavailable`); }, { once: true });
        avatarSlot.append(initials, avatar); header.append(avatarSlot);
        const identity = doc.createElement('div'); identity.className = 'rsi-conversation-identity'; identity.append(author);
        if (entry.member?.nickname) { const nickname = doc.createElement('span'); nickname.textContent = ` @${entry.member.nickname}`; identity.append(nickname); }
        if (entry.time_created) { const time = doc.createElement('time'); time.dateTime = new Date(entry.time_created * 1000).toISOString(); time.textContent = new Date(entry.time_created * 1000).toLocaleString(); identity.append(time); }
        link.href = entry.is_thread_content ? route.threadPath : `${route.threadPath}/${entry.id}`;
        link.textContent = entry.is_thread_content ? 'Original post' : 'Parent reply';
        header.append(identity, link); body.append(header);
        if (replyingTo) { const reference = doc.createElement('p'); reference.className = 'rsi-conversation-replying-to'; reference.textContent = `↳ Replying to ${replyingTo}`; body.append(reference); }
        if (entry.is_erased) { const p = doc.createElement('p'); p.textContent = 'This post has been deleted.'; body.append(p); }
        else {
          if (entry.subject) { const h = doc.createElement('h3'); h.textContent = entry.subject; body.append(h); }
          let lexical = '';
          if (entry.lexical_content) { try { lexical = lexicalText(object(JSON.parse(entry.lexical_content)).root); } catch { /* Fall back to legacy blocks. */ } }
          if (lexical) { const p = doc.createElement('p'); p.textContent = lexical; body.append(p); }
          for (const block of entry.content_blocks || []) {
            if (block.type === 'text' && !lexical) {
              const blocks = object(block.data).blocks;
              if (Array.isArray(blocks)) for (const value of blocks) {
                const data = object(value), p = doc.createElement(data.type === 'blockquote' ? 'blockquote' : data.type === 'code-block' ? 'pre' : 'p');
                p.textContent = typeof data.text === 'string' ? data.text : ''; body.append(p);
              }
            } else if (block.type === 'image' && Array.isArray(block.data)) {
              for (const item of block.data) {
                const data = object(object(item).data), url = safeConversationAssetUrl(data.url, win.location.href);
                if (!url) continue;
                const a = doc.createElement('a'), image = doc.createElement('img'); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
                image.src = url; image.alt = 'Post attachment'; image.loading = 'lazy'; image.referrerPolicy = 'no-referrer'; a.append(image); body.append(a);
              }
            }
          }
        }
        const replyHref = conversationReplyHref(route.threadPath, entry.id);
        if (replyHref) {
          const actions = doc.createElement('div'), replyAction = doc.createElement('a');
          actions.className = 'rsi-conversation-actions';
          replyAction.className = 'rsi-conversation-reply-action'; replyAction.href = replyHref;
          replyAction.textContent = `REPLY TO ${member.name}`; replyAction.title = `Reply to ${member.name}`;
          replyAction.setAttribute('aria-label', `Reply to ${member.name} on Spectrum`);
          replyAction.addEventListener('click', event => {
            const nativeThreadLink = [...banner!.querySelectorAll<HTMLAnchorElement>('a')]
              .find(anchor => /view the rest of the replies/i.test(anchor.textContent || ''));
            const intent = { threadPath: route.threadPath, replyId: entry.id, createdAt: Date.now() };
            if (!nativeThreadLink || !savePendingReplyIntent(win, intent)) return;
            event.preventDefault();
            nativeThreadLink.click();
          });
          actions.append(replyAction); body.append(actions);
        }
        const children = doc.createElement('div'); children.className = 'rsi-conversation-children'; card.append(children);
        parent.append(card); return children;
      };
      line.addEventListener('click', async () => {
        if (loaded) {
          panel!.hidden = !panel!.hidden;
          target?.classList.toggle('rsi-conversation-nested-target', !panel!.hidden);
          line!.setAttribute('aria-expanded', String(!panel!.hidden));
          line!.textContent = panel!.hidden ? '↑ SHOW EARLIER REPLIES' : '↑ HIDE EARLIER REPLIES';
          line!.setAttribute('aria-label', panel!.hidden ? 'Show earlier replies' : 'Hide earlier replies');
          return;
        }
        const button = line!, context = panel!, abort = new AbortController(); controller = abort;
        button.disabled = true; button.textContent = 'LOADING CONVERSATION…'; button.setAttribute('aria-label', 'Loading earlier replies'); button.setAttribute('aria-expanded', 'true'); context.hidden = false; context.replaceChildren();
        try {
          const chain = await loadConversation(route!.slug, route!.replyId, async (endpoint, body) => {
            const response = await win.fetch(`/api/spectrum${endpoint}`, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: abort.signal });
            if (!response.ok) throw new Error('Reply unavailable');
            const payload = await response.json();
            if (payload.success !== 1) throw new Error('Reply unavailable');
            return payload.data;
          });
          if (abort.signal.aborted) return;
          let parent = context, replyingTo = '';
          for (const entry of chain) { parent = appendReply(entry, parent, replyingTo); replyingTo = entry.member?.displayname || entry.member?.nickname || 'Unavailable author'; }
          const liveTarget = doc.querySelector<HTMLElement>(`#react .forum-thread-item[data-reply-id="${route!.replyId}"]`);
          if (liveTarget && liveTarget !== target) {
            target?.classList.remove('rsi-conversation-target', 'rsi-conversation-nested-target');
            if (target) { if (originalDepth) target.style.setProperty('--rsi-conversation-depth', originalDepth); else target.style.removeProperty('--rsi-conversation-depth'); }
            target = liveTarget; originalDepth = target.style.getPropertyValue('--rsi-conversation-depth');
          }
          target?.style.setProperty('--rsi-conversation-depth', String(Math.min(chain.length, 6)));
          target?.classList.add('rsi-conversation-target', 'rsi-conversation-nested-target');
          target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
          const marker = doc.createElement('p'); marker.className = 'rsi-conversation-marker'; marker.textContent = `↓ Replying to ${replyingTo} — originally linked reply highlighted in yellow below`; parent.append(marker);
          button.textContent = '↑ HIDE EARLIER REPLIES'; button.setAttribute('aria-label', 'Hide earlier replies'); button.setAttribute('aria-expanded', 'true'); loaded = true;
        } catch {
          if (abort.signal.aborted) return;
          const message = doc.createElement('p'); message.setAttribute('role', 'status'); message.textContent = 'Some earlier replies could not be loaded. They may be private or unavailable. Try again, or use “View the rest of the replies”.'; context.append(message);
          button.textContent = '↑ RETRY EXTENSION'; button.setAttribute('aria-label', 'Retry loading earlier replies');
        } finally { if (!abort.signal.aborted) button.disabled = false; }
      });
      }
      if (autoReplyRequested && !autoReplyOpened) {
        reply.scrollIntoView({ block: 'center', behavior: 'smooth' });
        if (!openNativeReplyControl(reply)) return false;
        autoReplyOpened = true;
        if (pendingMatchesRoute) clearPendingReplyIntent(win);
        replyStatus?.remove(); replyStatus = null;
      }
      if (autoReplyOpened || !autoReplyRequested) {
        observer?.disconnect(); observer = null;
        if (observerTimeout !== undefined) clearTimeout(observerTimeout);
        return true;
      }
      return false;
    };
    if (!mount() && !observer && doc.body) {
      // Only while a known single-reply route is waiting for its React content.
      // Disconnect immediately after mounting; no polling or permanent observer.
      observer = new MutationObserver(() => { mount(); });
      observer.observe(doc.getElementById('react') || doc.body, { childList: true, subtree: true });
      observerTimeout = win.setTimeout(() => {
        observer?.disconnect(); observer = null;
        if (autoReplyRequested && !autoReplyOpened) {
          if (pendingMatchesRoute) clearPendingReplyIntent(win);
          replyStatus = doc.createElement('p'); replyStatus.className = 'rsi-devtracker-reply-status';
          replyStatus.setAttribute('role', 'status'); replyStatus.textContent = 'Spectrum could not open the reply composer automatically. Use the Reply control on the developer post.';
          const host = doc.querySelector<HTMLElement>('#react #page.forum-thread') || [...doc.querySelectorAll<HTMLElement>('#react #page.forum-thread h3')].find(el => /viewing a single reply/i.test(el.textContent || ''));
          if (host) { replyStatus.textContent = 'Spectrum could not open the reply composer automatically. Use the Reply control on the selected post.'; host.append(replyStatus); }
        }
      }, 15000);
    }
  };
  return refresh;
}
