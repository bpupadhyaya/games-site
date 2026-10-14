// Fast first screen: the game boots at once on its flat 2D art (styled, interactive title in the first frames) and the 3D
// presenter is built afterwards, once the title has painted. When it is ready the game swaps to 3D with a short fade.
// Without WebGL, or if the presenter fails, the flat art simply stays (the same fallback the game always had).
// `?shot` / `?scene` / `?icon` runs (store shots, icon render) pass eager:true and still wait for the 3D scene before booting.
export function createLazy3d({ canvas, flatBg, load, eager = false, readyTimeout = 2500, ready = (p) => p && p.ready_p, usable = (p) => !!(p && (p.stage || p.ok)), onAdopt = null }) {
  let presenter = null, raw = null, cur = null, adopted = false, started = false, failed = false;
  const fns = new Map();
  const background = { toString: () => (adopted ? 'rgba(0,0,0,0)' : flatBg) };   // the kit reads this every frame, so the swap is instant
  const frames = (n) => new Promise((r) => { const step = () => (n-- <= 0 ? r() : requestAnimationFrame(step)); requestAnimationFrame(step); });
  const swap = () => {
    if (adopted || !raw || !presenter) return;
    try { cur = presenter.wrap(raw); } catch (e) { console.warn('3D wrap failed; staying flat', e); failed = true; return; }
    adopted = true;
    if (onAdopt) { try { onAdopt(presenter, raw); } catch (e) { console.warn(e); } }
    canvas.style.transition = 'none'; canvas.style.opacity = '0.25';
    requestAnimationFrame(() => { canvas.style.transition = 'opacity 320ms ease-out'; canvas.style.opacity = '1'; });
  };
  const build = async () => {
    try { presenter = await load(); } catch (e) { console.warn('3D presenter unavailable', e); failed = true; return null; }
    if (!usable(presenter)) { failed = true; return presenter; }
    return presenter;
  };
  async function finish() {
    const rp = ready(presenter);
    if (rp) await Promise.race([Promise.resolve(rp).catch(() => {}), new Promise((r) => setTimeout(r, readyTimeout))]);
    if (failed) return;
    for (let i = 0; i < 400 && !raw; i++) await new Promise((r) => setTimeout(r, 25));   // the game object is created by the kit shortly after boot
    swap();
  }
  return {
    background,
    get presenter() { return presenter; },
    get adopted() { return adopted; },
    // Call before boot(): eager runs build the whole presenter first, exactly as before.
    async prepare() { if (eager) { await build(); if (!failed) { const rp = ready(presenter); if (rp) await Promise.race([Promise.resolve(rp).catch(() => {}), new Promise((r) => setTimeout(r, readyTimeout))]); } } },
    // Wrap the raw game for the kit. Returns a stable proxy whose methods delegate to the current (flat or 3D) game object.
    wrap(game) {
      raw = game; cur = game;
      if (eager && presenter && usable(presenter)) { try { cur = presenter.wrap(game); adopted = true; if (onAdopt) onAdopt(presenter, game); } catch (e) { console.warn(e); } }
      return new Proxy(game, {
        get(t, k) {
          const v = cur[k];
          if (typeof v !== 'function') return v;
          if (!fns.has(k)) fns.set(k, (...a) => cur[k](...a));
          return fns.get(k);
        },
        set(t, k, v) { cur[k] = v; if (cur !== raw) raw[k] = v; return true; },
        has(t, k) { return k in cur; },
      });
    },
    // Call after boot(): builds the presenter once the first frames have painted.
    start() {
      if (started) return; started = true;
      if (eager) { if (!failed) finish(); return; }
      frames(3).then(() => new Promise((r) => setTimeout(r, 30))).then(build).then((p) => { if (p && !failed) return finish(); });
    },
  };
}
