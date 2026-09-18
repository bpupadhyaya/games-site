// In-app purchases behind one API (no ads). Products come from game.json.
// Modes:  native = real StoreKit / Play Billing through the shell
//         demo   = public web demo: nothing can be bought, purchase() reports reason "demo"
//         mock   = local development + headless tests: purchases succeed instantly
export function createMonetization({ bridge, manifest, mode }) {
  const config = manifest.monetization ?? { model: 'premium' };
  const products = config.products ?? [];
  const owned = new Set();
  const listeners = new Set();
  const resolvedMode = mode ?? (bridge?.native ? 'native' : 'mock');
  const changed = () => listeners.forEach((fn) => fn());

  return {
    mode: resolvedMode,
    model: config.model,
    products,
    async init() {
      if (resolvedMode !== 'native') return;
      const res = await bridge.call('iap.entitlements', { products });
      for (const id of res?.owned ?? []) owned.add(id);
      changed();
    },
    owns: (productId) => owned.has(productId),
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    async purchase(productId) {
      const product = products.find((p) => p.id === productId);
      if (!product) return { ok: false, reason: 'unknown-product' };
      if (resolvedMode === 'demo') return { ok: false, reason: 'demo' };
      if (resolvedMode === 'native') {
        const res = await bridge.call('iap.purchase', { productId, type: product.type }).catch((e) => ({ ok: false, reason: e.message }));
        if (!res?.ok) return { ok: false, reason: res?.reason ?? 'failed' };
      }
      if (product.type !== 'consumable') owned.add(productId);
      changed();
      return { ok: true };
    },
    async restore() {
      if (resolvedMode !== 'native') return { ok: true, owned: [...owned] };
      const res = await bridge.call('iap.restore', { products });
      for (const id of res?.owned ?? []) owned.add(id);
      changed();
      return { ok: true, owned: [...owned] };
    },
    // Arcforge ships without advertising. These stay so older game code keeps working: no ad is
    // ever requested, and a "reward" is simply granted.
    async showInterstitial() {
      return { shown: false };
    },
    async showRewarded() {
      return { rewarded: true };
    },
    track(event, params = {}) {
      if (resolvedMode === 'native') bridge.call('analytics.event', { event, params }).catch(() => {});
    },
  };
}
