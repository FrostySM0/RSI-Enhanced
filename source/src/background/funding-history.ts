import {
  FUNDING_HISTORY_REQUEST,
  FUNDING_YEARLY_REQUEST,
  loadFundingHistory,
  loadFundingYearlyTotals,
  type FundingHistoryResponse,
  type FundingHistoryStorage,
  type FundingYearlyTotalsResponse,
} from '../shared/funding-stats.ts';

type FundingWorkerResponse = FundingHistoryResponse | FundingYearlyTotalsResponse | { error: string };

interface FundingMessageRuntime {
  onMessage: {
    addListener(listener: (
      message: unknown,
      sender: { url?: string },
      sendResponse: (response: FundingWorkerResponse) => void,
    ) => boolean | void): void;
  };
}

function isFundingPage(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:'
      && parsed.hostname === 'robertsspaceindustries.com'
      && /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?funding-goals\/?$/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

/** Registers fixed, read-only funding-history requests accepted by this worker. */
export function registerFundingHistoryListener(
  runtime: FundingMessageRuntime,
  load: () => Promise<FundingHistoryResponse> = () => loadFundingHistory(chrome.storage.local as FundingHistoryStorage),
  loadYearly: () => Promise<FundingYearlyTotalsResponse> = () => loadFundingYearlyTotals(chrome.storage.local as FundingHistoryStorage),
): void {
  let pending: Promise<FundingHistoryResponse> | null = null;
  let pendingYearly: Promise<FundingYearlyTotalsResponse> | null = null;
  runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message !== 'object') return false;
    const type = (message as { type?: unknown }).type;
    if (type !== FUNDING_HISTORY_REQUEST && type !== FUNDING_YEARLY_REQUEST) return false;
    if (!isFundingPage(sender.url)) {
      sendResponse({ error: 'Funding history is only available to the RSI Funding Goals page.' });
      return false;
    }
    if (type === FUNDING_HISTORY_REQUEST) pending ??= load();
    else pendingYearly ??= loadYearly();
    const request = type === FUNDING_HISTORY_REQUEST ? pending! : pendingYearly!;
    void request.then(sendResponse).catch(() => {
      sendResponse({ error: type === FUNDING_HISTORY_REQUEST
        ? 'The hourly funding history could not be loaded.'
        : 'The yearly funding totals could not be loaded.' });
    }).finally(() => {
      if (type === FUNDING_HISTORY_REQUEST && pending === request) pending = null;
      if (type === FUNDING_YEARLY_REQUEST && pendingYearly === request) pendingYearly = null;
    });
    return true;
  });
}

if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  registerFundingHistoryListener(chrome.runtime);
}
