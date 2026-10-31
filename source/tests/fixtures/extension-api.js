/* Local preview only. This file is never bundled into the extension. */
(() => {
  const key = 'rsiEnhanced.preview';
  const listeners = new Set();
  const flags = new URLSearchParams(location.search);
  const load = () => JSON.parse(localStorage.getItem(key) || '{}');
  const notify = (before, after) => {
    const changes = {};
    for (const name of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (JSON.stringify(before[name]) !== JSON.stringify(after[name])) changes[name] = { oldValue: before[name], newValue: after[name] };
    }
    for (const listener of listeners) listener(changes, 'local');
  };
  window.addEventListener('storage', (event) => {
    if (event.key === key) notify(JSON.parse(event.oldValue || '{}'), JSON.parse(event.newValue || '{}'));
  });
  window.chrome = {
    runtime: { getManifest: () => ({ version: '__RSI_ENHANCED_VERSION__' }) },
    storage: {
      local: {
        get: async (name) => {
          if (flags.has('failRead')) throw new Error('Preview read failure');
          const saved = load();
          if (name === null) return saved;
          if (Array.isArray(name)) return Object.fromEntries(name.map(key => [key,saved[key]]));
          return { [name]: saved[name] };
        },
        set: async (values) => {
          if (flags.has('failSave')) throw new Error('Preview save failure');
          const before = load(); const after = { ...before, ...values };
          localStorage.setItem(key, JSON.stringify(after)); notify(before, after);
        },
      },
      onChanged: { addListener: (listener) => listeners.add(listener) },
    },
  };
})();
