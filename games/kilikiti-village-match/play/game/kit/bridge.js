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
