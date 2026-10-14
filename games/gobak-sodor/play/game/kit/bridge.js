// Native bridge. The same web bundle runs inside the iOS shell (WKWebView), the Android
// shell (WebView) and a plain browser. Contract: docs/BRIDGE.md.
//   JS -> native : { id, method, params }  via webkit.messageHandlers.arcforge / ArcforgeAndroid
//   native -> JS : globalThis.__arcforgeReceive(jsonString) with { id, ok, result|error } or { event, data }
export function createBridge(target = globalThis) {
  const ios = target.webkit?.messageHandlers?.arcforge;
  const android = target.ArcforgeAndroid;
  const native = ios ? 'ios' : android ? 'android' : null;
  const pending = new Map();
  const listeners = new Map();
  let seq = 0;

  if (native) {
    target.__arcforgeReceive = (payload) => {
      const msg = typeof payload === 'string' ? JSON.parse(payload) : payload;
      if (msg.event) {
        for (const fn of listeners.get(msg.event) ?? []) fn(msg.data);
        return;
      }
      const entry = pending.get(msg.id);
      if (!entry) return;
      pending.delete(msg.id);
      if (msg.ok) entry.resolve(msg.result);
      else entry.reject(new Error(msg.error || 'bridge error'));
    };
  }

  return {
    native,
    call(method, params = {}) {
      if (!native) return Promise.reject(new Error('no native bridge'));
      const id = ++seq;
      const message = { id, method, params };
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        if (ios) ios.postMessage(message);
        else android.postMessage(JSON.stringify(message));
      });
    },
    on(event, fn) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(fn);
      return () => listeners.get(event).delete(fn);
    },
  };
}

// Public Arcforge hub page, opened in a new tab when a game runs in a plain browser (no native shell).
export const ARCFORGE_HOME_URL = 'https://equalinformation.com/games-site/';

// Kit 1.9.0 `env.openArcforgeHome()`. Native shells get the bridge method `app.home` (no params): the hub
// returns to its main screen scrolled to the top, a standalone app opens the Arcforge store listing.
// Never throws and never rejects.
export function openArcforgeHomeVia(bridge, target = globalThis) {
  if (bridge?.native) {
    bridge.call('app.home').catch(() => {});
    return;
  }
  try {
    target.open?.(ARCFORGE_HOME_URL, '_blank', 'noopener');
  } catch {
    /* no window (headless): nothing to open */
  }
}
