export const PRIVACY_CONSENT_KEY = 'rsiEnhanced.privacyConsent';
export const PRIVACY_NOTICE_VERSION = 1;

type ConsentValue = {
  accepted?: unknown;
  noticeVersion?: unknown;
};

type StorageChange = { newValue?: unknown };
type ConsentChangeEvent = {
  addListener(listener: (changes: Record<string, StorageChange>, areaName: string) => void): void;
  removeListener(listener: (changes: Record<string, StorageChange>, areaName: string) => void): void;
};
type LocalStorage = {
  get(key: string): Promise<Record<string, unknown>>;
  set(values: Record<string, unknown>): Promise<void>;
};

export function hasCurrentPrivacyConsent(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const consent = value as ConsentValue;
  return consent.accepted === true && consent.noticeVersion === PRIVACY_NOTICE_VERSION;
}

export async function recordPrivacyConsent(storage: Pick<LocalStorage, 'set'>): Promise<void> {
  await storage.set({
    [PRIVACY_CONSENT_KEY]: { accepted: true, noticeVersion: PRIVACY_NOTICE_VERSION },
  });
}

export function watchPrivacyConsent(
  storage: Pick<LocalStorage, 'get'>,
  changeEvent: ConsentChangeEvent,
  apply: (accepted: boolean) => void,
): () => void {
  let changed = false;
  let stopped = false;
  const listener = (changes: Record<string, StorageChange>, areaName: string) => {
    if (areaName !== 'local' || !Object.hasOwn(changes, PRIVACY_CONSENT_KEY)) return;
    changed = true;
    if (!stopped) apply(hasCurrentPrivacyConsent(changes[PRIVACY_CONSENT_KEY].newValue));
  };

  changeEvent.addListener(listener);
  void storage.get(PRIVACY_CONSENT_KEY).then(result => {
    if (!changed && !stopped) apply(hasCurrentPrivacyConsent(result[PRIVACY_CONSENT_KEY]));
  }).catch(() => {
    if (!changed && !stopped) apply(false);
  });

  return () => {
    stopped = true;
    changeEvent.removeListener(listener);
  };
}
