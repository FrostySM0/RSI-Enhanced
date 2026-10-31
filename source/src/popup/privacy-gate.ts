import {
  recordPrivacyConsent,
  watchPrivacyConsent,
} from '../shared/privacy-consent.ts';

interface GateElement {
  hidden: boolean | string;
  textContent: string | null;
  addEventListener(type: 'click', listener: EventListener): void;
  removeEventListener(type: 'click', listener: EventListener): void;
}

interface GateButton extends GateElement {
  disabled: boolean;
}

interface GateFields extends GateElement {
  disabled: boolean;
}

export interface PrivacyGateElements {
  disclosure: GateElement;
  settingsArea: GateElement;
  fields: GateFields;
  agree: GateButton;
  notNow: GateButton;
  status: GateElement;
}

interface LocalStorage {
  get(key: string): Promise<Record<string, unknown>>;
  set(values: Record<string, unknown>): Promise<void>;
}

interface ChangeEvent {
  addListener(listener: (changes: Record<string, { newValue?: unknown }>, areaName: string) => void): void;
  removeListener(listener: (changes: Record<string, { newValue?: unknown }>, areaName: string) => void): void;
}

export function startPrivacyGate(
  elements: PrivacyGateElements,
  storage: LocalStorage,
  changeEvent: ChangeEvent,
  onAccepted: () => void,
): () => void {
  let accepted = false;
  let stopped = false;

  const applyConsent = (nextAccepted: boolean): void => {
    if (stopped) return;
    const changed = accepted !== nextAccepted;
    accepted = nextAccepted;
    elements.disclosure.hidden = accepted;
    elements.settingsArea.hidden = !accepted;
    elements.fields.disabled = !accepted;
    if (accepted) {
      elements.status.textContent = 'Loading preferences…';
      if (changed) onAccepted();
    } else if (changed) {
      elements.status.textContent = '';
    }
  };

  const onAgree: EventListener = () => {
    if (accepted || elements.agree.disabled) return;
    elements.agree.disabled = true;
    elements.status.textContent = 'Saving your choice…';
    void recordPrivacyConsent(storage).then(() => {
      applyConsent(true);
    }).catch(() => {
      elements.status.textContent = 'Could not save your choice. Please try again.';
    }).finally(() => {
      elements.agree.disabled = false;
    });
  };
  const onNotNow: EventListener = () => {
    if (accepted) return;
    elements.status.textContent = 'RSI Enhanced stays off until you choose “Agree and enable”.';
  };

  elements.disclosure.hidden = false;
  elements.settingsArea.hidden = true;
  elements.fields.disabled = true;
  elements.agree.addEventListener('click', onAgree);
  elements.notNow.addEventListener('click', onNotNow);
  const stopWatching = watchPrivacyConsent(storage, changeEvent, applyConsent);

  return () => {
    if (stopped) return;
    stopped = true;
    stopWatching();
    elements.agree.removeEventListener('click', onAgree);
    elements.notNow.removeEventListener('click', onNotNow);
  };
}
