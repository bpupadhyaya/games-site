// Async key/value JSON storage: native app storage when running in a shell,
// localStorage in a browser, in-memory in headless tests.
export function createStorage({ bridge, namespace }) {
  const memory = new Map();
  const key = (k) => `${namespace}:${k}`;
  let local = null;
  try {
    // Only touch localStorage in a real browser (Node exposes a warning-emitting stub).
    local = typeof globalThis.document !== 'undefined' ? (globalThis.localStorage ?? null) : null;
  } catch {
    local = null;
  }

  return {
    async get(k, fallback = null) {
      let raw = null;
      if (bridge?.native) raw = (await bridge.call('storage.get', { key: key(k) }))?.value ?? null;
      else if (local) raw = local.getItem(key(k));
      else raw = memory.get(key(k)) ?? null;
      if (raw === null) return fallback;
      try {
        return JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    async set(k, value) {
      const raw = JSON.stringify(value);
      if (bridge?.native) await bridge.call('storage.set', { key: key(k), value: raw });
      else if (local) local.setItem(key(k), raw);
      else memory.set(key(k), raw);
    },
    async remove(k) {
      if (bridge?.native) await bridge.call('storage.remove', { key: key(k) });
      else if (local) local.removeItem(key(k));
      else memory.delete(key(k));
    },
  };
}
