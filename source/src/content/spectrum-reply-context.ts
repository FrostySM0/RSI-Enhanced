type ReplyContextWindow = Pick<Window, 'location' | 'requestAnimationFrame' | 'cancelAnimationFrame'> & {
  MutationObserver: typeof MutationObserver;
};

const THREAD_SELECTOR = '#react #page.forum-thread';
const REPLY_SELECTOR = '.forum-thread-item.type-forum_thread_reply';
const CONTEXT_CLASS = 'rsi-reply-context';

function parentReply(reply: HTMLElement): HTMLElement | null {
  const childReplies = reply.parentElement?.closest<HTMLElement>('.forum-thread-item-children-replies');
  const ancestor = childReplies?.parentElement?.closest<HTMLElement>('.forum-thread-item');
  if (ancestor) return ancestor;
  return reply.closest<HTMLElement>('.forum-thread')
    ?.querySelector<HTMLElement>('.forum-thread-item.type-forum_thread') ?? null;
}

function contextText(reply: HTMLElement): string {
  const parent = parentReply(reply);
  const handle = parent?.querySelector<HTMLElement>('.member-handle')?.textContent?.trim();
  const name = parent?.querySelector<HTMLElement>('.member-name')?.textContent?.trim();
  const author = handle || name;
  if (!author) return 'Replying to parent post';
  return `Replying to ${author.startsWith('@') ? author : `@${author}`}`;
}

function updateReply(reply: HTMLElement, doc: Document): void {
  const main = reply.querySelector<HTMLElement>(':scope > .content > .content-main');
  if (!main) return;
  let label = main.querySelector<HTMLElement>(`:scope > .${CONTEXT_CLASS}`);
  if (!label) {
    label = doc.createElement('div');
    label.className = CONTEXT_CLASS;
    const body = main.querySelector(':scope > .content-blocks');
    main.insertBefore(label, body);
  }
  const text = contextText(reply);
  if (label.textContent !== text) label.textContent = text;
  if (label.getAttribute('aria-label') !== text) label.setAttribute('aria-label', text);
}

/** Adds themeable parent labels to a native Spectrum reply tree in stream mode. */
export function installReplyContexts(
  enabled: () => boolean,
  win: ReplyContextWindow = window,
  doc: Document = document,
): () => void {
  let observer: MutationObserver | null = null;
  let observed: Element | null = null;
  let frame: number | undefined;

  const clear = (): void => {
    observer?.disconnect();
    observer = null;
    observed = null;
    if (frame !== undefined) win.cancelAnimationFrame(frame);
    frame = undefined;
    for (const label of doc.querySelectorAll(`.${CONTEXT_CLASS}`)) label.remove();
  };

  const sync = (thread: HTMLElement): void => {
    for (const reply of thread.querySelectorAll<HTMLElement>(REPLY_SELECTOR)) updateReply(reply, doc);
  };

  const refresh = (): void => {
    if (!enabled() || !/\/spectrum\/community\/[^/]+\/forum\/\d+\/thread\/[^/]+/i.test(win.location.pathname)) {
      clear();
      return;
    }

    const thread = doc.querySelector<HTMLElement>(THREAD_SELECTOR);
    const target = thread ?? doc.documentElement;
    if (!target) return;

    if (!observer) {
      observer = new win.MutationObserver(() => {
        const currentThread = doc.querySelector<HTMLElement>(THREAD_SELECTOR);
        if (!currentThread || observed !== currentThread) {
          refresh();
          return;
        }
        if (frame === undefined) frame = win.requestAnimationFrame(() => {
          frame = undefined;
          if (enabled() && doc.querySelector(THREAD_SELECTOR) === currentThread) sync(currentThread);
        });
      });
    }
    if (observed !== target) {
      observer.disconnect();
      observer.observe(target, { childList: true, characterData: true, subtree: true });
      observed = target;
    }
    if (thread) sync(thread);
  };

  return refresh;
}
