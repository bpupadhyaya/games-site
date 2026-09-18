// Ads + in-app purchases behind one API. Products and ad formats come from game.json.
// Modes:  native = real StoreKit / Play Billing / ads through the shell
//         demo   = public web demo: nothing can be bought, purchase() reports reason "demo"
//         mock   = local development + headless tests: purchases succeed instantly
export function createMonetization({ bridge, manifest, mode }) {
  const config = manifest.monetization ?? { model: 'premium' };
  const products = config.products ?? [];
  const owned = new Set();
  const listeners = new Set();
  const resolvedMode = mode ?? (bridge?.native ? 'native' : 'mock');
  const changed = () => listeners.forEach((fn) => fn());

  const adsAllowed = (format) => Boolean(config.ads?.[format]) && !owned.has('remove_ads');

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
    async showInterstitial(placement) {
      if (resolvedMode !== 'native' || !adsAllowed('interstitial')) return { shown: false };
      return bridge.call('ads.show', { format: 'interstitial', placement }).catch(() => ({ shown: false }));
    },
    // Resolves { rewarded: true } when the player earned the reward.
    async showRewarded(placement) {
      if (!config.ads?.rewarded) return { rewarded: false };
      if (resolvedMode !== 'native') return { rewarded: true };
      return bridge.call('ads.show', { format: 'rewarded', placement }).catch(() => ({ rewarded: false }));
    },
    track(event, params = {}) {
      if (resolvedMode === 'native') bridge.call('analytics.event', { event, params }).catch(() => {});
    },
  };
}
