import { HIDDEN_USER_PREFIX, initializeHiddenUsers, normalizeHandle, readHiddenUsers, setUserHidden } from '../shared/hidden-users.ts';
import type { HiddenUser } from '../shared/hidden-users.ts';

export function installEnhancedBlocks(enabled: () => boolean, doc: Document = document): () => void {
  let users: HiddenUser[] = [], observer: MutationObserver | null = null, started = false, scheduled = false;
  let initializationTask: Promise<void> | null = null;
  let revision = 0;
  const pending = new Set<Element>();
  const postSelector = '.forum-thread-item,.message-item,.orion-tavern-c-ThreadListItem,.rsi-conversation-body,.blocked-content';
  const controls = new Set<HTMLElement>();
  const hidden = new Set<HTMLElement>();
  const select = (root: ParentNode, selector: string): HTMLElement[] => [
    ...(root instanceof Element && root.matches(selector) ? [root as HTMLElement] : []), ...root.querySelectorAll<HTMLElement>(selector),
  ];
  const identity = (root: ParentNode | null): { handle: string; name: string } | null => {
    if (!root) return null;
    if (root instanceof HTMLElement && root.dataset.rsiAuthorHandle) {
      const handle = normalizeHandle(root.dataset.rsiAuthorHandle);
      if (handle) return {handle,name:root.dataset.rsiAuthorName || handle};
    }
    const candidates = root.querySelectorAll<HTMLElement>('.member-name > .nickname,.member-nickname,.profile-member-nickname');
    let handle: string | null = null;
    for (const candidate of candidates) { const text = candidate.textContent?.trim(); if (text?.startsWith('@')) { handle = normalizeHandle(text); if (handle) break; } }
    if (!handle) for (const link of root.querySelectorAll<HTMLAnchorElement>('a.member-name[href]')) {
      try { const match = /\/citizens\/([^/]+)\/?$/i.exec(new URL(link.href, doc.baseURI).pathname); if (match) { handle = normalizeHandle(decodeURIComponent(match[1])); if (handle) break; } } catch { /* Not an identity link. */ }
    }
    return handle ? {handle,name:root.querySelector('.displayname')?.textContent?.trim() || handle} : null;
  };
  const isHidden = (who: {handle:string} | null) => !!who && users.some(user=>user.handle === who.handle);
  const togglePost = (post: HTMLElement) => {
    let who: {handle:string;name:string} | null = null;
    if (post.matches('.forum-thread-item')) {
      // Keep the lookup inside this post's own content. The native header's
      // inner structure changes periodically, while nested replies must never
      // be mistaken for the parent author's identity.
      const main = post.querySelector(':scope > .content > .content-main');
      who = identity(main?.querySelector(':scope > .content-header') || main);
    }
    else if (post.matches('.rsi-conversation-body')) who = identity(post);
    else if (post.matches('.orion-tavern-c-ThreadListItem')) who = identity(post.querySelector('.orion-tavern-c-ThreadListItem__subtitle'));
    else if (post.matches('.message-item')) {
      let source: Element | null = post;
      while (source?.matches('.message-item.type-small')) source = source.previousElementSibling;
      who = identity(source?.querySelector(':scope > .content > .top') || null);
    } else {
      who = identity(post);
      // Native blocked placeholders sometimes expose only a display name.
      // Use only an exact, unambiguous name from a user explicitly selected.
      if (!who) { const name = post.querySelector('.displayname')?.textContent?.trim(); const matches = users.filter(user=>user.name === name); if (matches.length === 1) who = matches[0]; }
    }
    // RSI renders its native "Post by a blocked user" notice without an author
    // identity. When it sits beside the post body, inherit the already-matched
    // parent post state so the notice disappears with that author too.
    const inheritedRemoval = post.matches('.blocked-content') &&
      post.closest('.forum-thread-item')?.classList.contains('rsi-remove-author') === true;
    // On a single-reply thread RSI can render the notice without an author card
    // at all. Its native modifier is the reliable signal in that layout.
    const nativeBlockedNotice = post.matches('.blocked-content.blocked-content--block');
    const remove = enabled() && (isHidden(who) || inheritedRemoval || nativeBlockedNotice);
    post.classList.toggle('rsi-remove-author', remove);
    if (remove) hidden.add(post); else hidden.delete(post);
  };
  const updateProfile = (profile: HTMLElement) => {
    const actions = profile.querySelector<HTMLElement>('.profile-actions'), who = identity(profile);
    if (!actions || !who) return;
    const native = [...actions.querySelectorAll<HTMLElement>('.profile-action')].find(node=> /^(?:block|unblock)$/i.test(node.textContent?.trim() || ''));
    if (!native) return; // Never offer account actions for self or signed-out profiles.
    let button = actions.querySelector<HTMLButtonElement>('.rsi-enhanced-block-control');
    const isNewButton = !button;
    if (!button) {
      button = doc.createElement('button'); button.type = 'button'; button.className = 'profile-action rsi-enhanced-block-control'; actions.append(button); controls.add(button);
    }
    const actionButton = button;
    const existingLabel = actionButton.textContent?.trim() || '';
    let icon = actionButton.querySelector<SVGSVGElement>('svg.rsi-enhanced-block-icon');
    if (!icon) {
      icon = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('class', 'icon rsi-enhanced-block-icon'); icon.setAttribute('viewBox', '0 0 12 12');
      icon.setAttribute('fill', 'currentColor'); icon.setAttribute('aria-hidden', 'true'); icon.setAttribute('focusable', 'false');
      const skullPath = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
      skullPath.setAttribute('d', 'M6 1C3.25 1 1 3.25 1 6c0 1.5.68 2.84 1.75 3.74V11h6.5V9.74A4.97 4.97 0 0 0 11 6c0-2.75-2.25-5-5-5ZM4.4 5.8a.7.7 0 1 0 0-1.4.7.7 0 0 0 0 1.4Zm3.2 0a.7.7 0 1 0 0-1.4.7.7 0 0 0 0 1.4Z');
      skullPath.setAttribute('fill-rule', 'evenodd'); icon.append(skullPath);
    }
    let label = actionButton.querySelector<HTMLSpanElement>('.rsi-enhanced-block-label');
    if (!label) {
      label = doc.createElement('span'); label.className = 'rsi-enhanced-block-label'; label.textContent = existingLabel;
      actionButton.replaceChildren(icon, label);
    }
    if (isNewButton) {
      actionButton.addEventListener('click', async event => {
        event.preventDefault(); event.stopPropagation();
        const current = identity(profile); if (!current) return;
        const remove = !isHidden(current); actionButton.disabled = true;
        try {
          await setUserHidden(current.handle, current.name, remove);
          // Reuse Spectrum's native handler; do not issue guessed block APIs.
          if (remove) [...actions.querySelectorAll<HTMLElement>('.profile-action')].find(node=>node !== actionButton && /^block$/i.test(node.textContent?.trim() || ''))?.click();
          await reload();
        } catch { label!.textContent = 'Could not save — click to retry'; }
        finally { actionButton.disabled = false; }
      });
    }
    const text = isHidden(who) ? 'Show posts again' : 'Block and remove posts';
    if (label.textContent !== text) label.textContent = text;
    actionButton.title = 'Post removal is saved in this browser. Use Spectrum’s Unblock separately to undo account blocking.';
  };
  const updateRow = (row: HTMLElement) => {
    if (!row.querySelector('.blocked-users__profile')) return;
    const cells = row.querySelectorAll<HTMLElement>(':scope > .table-cell');
    const handle = normalizeHandle(cells[1]?.textContent), cell = cells[cells.length-1];
    if (!handle || !cell) return;
    const name = row.querySelector('.displayname')?.textContent?.trim() || handle;
    let input = row.querySelector<HTMLInputElement>('.rsi-enhanced-block-control input');
    if (!input) {
      const label = doc.createElement('label'); label.className = 'rsi-enhanced-block-control rsi-remove-posts-toggle';
      input = doc.createElement('input'); input.type = 'checkbox'; input.setAttribute('aria-label', `Remove posts by ${name}`);
      label.append(input, doc.createTextNode(' Remove posts')); cell.append(label); controls.add(label);
      input.addEventListener('change', async event => {
        event.stopPropagation(); input!.disabled = true;
        try { await setUserHidden(handle,name,input!.checked); await reload(); }
        catch { input!.checked = !input!.checked; label.title = 'Could not save. Please try again.'; }
        finally { input!.disabled = false; }
      });
    }
    input.checked = isHidden({handle});
  };
  const scan = (root: ParentNode) => {
    if (!enabled()) return;
    for (const settings of select(root, '.blocked-users')) {
      let input = settings.querySelector<HTMLInputElement>('.rsi-j3pt-block input');
      if (!input) {
        const label = doc.createElement('label'); label.className = 'rsi-enhanced-block-control rsi-j3pt-block';
        input = doc.createElement('input'); input.type = 'checkbox'; input.setAttribute('aria-label', 'Block/unblock J3PT');
        const text = doc.createElement('span'); text.textContent = 'Block/unblock J3PT — hide posts locally when checked';
        label.append(input,text); settings.prepend(label); controls.add(label);
        input.addEventListener('change', async event => {
          event.stopPropagation(); input!.disabled = true;
          try { await setUserHidden('J3PT','J3PT',input!.checked); await reload(); }
          catch { input!.checked = !input!.checked; label.title = 'Could not save. Please try again.'; }
          finally { input!.disabled = false; }
        });
      }
      input.checked = isHidden({handle:'j3pt'});
    }
    for (const post of select(root, postSelector)) togglePost(post);
    for (const profile of select(root, '.member-profile')) updateProfile(profile);
    for (const row of select(root, '.blocked-users .table-row')) updateRow(row);
    for (const node of hidden) if (!node.isConnected) hidden.delete(node);
    for (const node of controls) if (!node.isConnected) controls.delete(node);
  };
  const reload = async () => {
    const current = ++revision, saved = await readHiddenUsers();
    if (current !== revision) return;
    users = saved; if (enabled()) scan(doc);
  };
  const initializeAndReload = (): Promise<void> => {
    if (initializationTask) return initializationTask;
    const task = (async () => {
      try {
        let lastError: unknown;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await initializeHiddenUsers();
            await reload();
            return;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (/extension context invalidated/i.test(message)) {
              console.info('[RSI Enhanced] The extension was reloaded. Refresh this page to reconnect removed users.');
              return;
            }
            lastError = error;
            if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
          }
        }
        console.warn('[RSI Enhanced] Could not load removed users.', lastError);
      } finally {
        initializationTask = null;
      }
    })();
    initializationTask = task;
    return task;
  };
  const queue = (element: Element) => {
    if (element.closest('.rsi-enhanced-block-control')) return;
    pending.add(element);
    const parent = element.parentElement?.closest(`${postSelector},.member-profile,.blocked-users .table-row`);
    if (parent) pending.add(parent);
    // Grouped rows inherit identity from the preceding full message. Rescan only
    // its contiguous follow-ups when React changes that message's author/content.
    const message = element.closest('.message-item');
    if (message) for (let next = message.nextElementSibling; next?.matches('.message-item.type-small'); next = next.nextElementSibling) pending.add(next);
    if (!scheduled) { scheduled = true; queueMicrotask(() => { scheduled = false; const work = [...pending]; pending.clear(); for (const root of work) if (root.isConnected) scan(root); }); }
  };
  return () => {
    if (!enabled()) {
      observer?.disconnect(); observer = null; pending.clear(); doc.documentElement.setAttribute('data-rsi-enhanced-blocks','off');
      for (const node of hidden) node.classList.remove('rsi-remove-author'); hidden.clear();
      for (const node of controls) node.remove(); controls.clear(); return;
    }
    if (doc.readyState === 'loading' || !doc.body) return;
    doc.documentElement.setAttribute('data-rsi-enhanced-blocks','on');
    if (!started) {
      started = true;
      chrome.storage.onChanged.addListener((changes,area) => {
        if (area === 'local' && Object.keys(changes).some(key=>key.startsWith(HIDDEN_USER_PREFIX))) void initializeAndReload();
      });
      void initializeAndReload();
    }
    if (!observer) {
      observer = new MutationObserver(records => {
        for (const record of records) {
          if (record.type === 'characterData') { if (record.target.parentElement) queue(record.target.parentElement); }
          else {
            for (const node of record.addedNodes) if (node instanceof Element) queue(node);
            // Removed messages are detached already, so their surviving followers
            // must be reached through the mutation's original sibling boundary.
            if ([...record.removedNodes].some(node => node instanceof Element && node.matches('.message-item'))) {
              let next = record.nextSibling;
              while (next && !(next instanceof Element)) next = next.nextSibling;
              if (next instanceof Element && next.matches('.message-item.type-small')) queue(next);
            }
            if (record.target instanceof Element && !record.target.closest('.rsi-enhanced-block-control')) {
              const owner = record.target.closest(`${postSelector},.member-profile,.blocked-users .table-row`); if (owner) queue(owner);
            }
          }
        }
      });
      observer.observe(doc.body,{childList:true,subtree:true,characterData:true});
    }
    scan(doc);
  };
}
