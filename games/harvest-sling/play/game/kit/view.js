// Virtual-resolution canvas: the game always draws in meta.width x meta.height units;
// this scales + letterboxes to any screen and handles devicePixelRatio. Browser only.
//
// FLUID MODE (kit 1.7.0, opt in with `meta.fluid = { short: 720 }`): there is NO letterbox. The virtual size follows the real
// screen: the SHORT side is always `short` units and the long side grows with the aspect ratio, so the game fills every
// phone/tablet in portrait and in landscape. `meta.width`, `meta.height`, `view.width`, `view.height`, `view.landscape` and
// `view.sizeKey` (changes on every resize) are live; the game must lay itself out from them each frame (cache by `sizeKey`).
// `view.cssPerUnit` / `meta.cssPerUnit` = CSS pixels per virtual unit (kit 1.8.0; used to keep kit text >= 11 css px).
// Optional limits: `maxAspect` (default 2.4) caps the long side so extreme shapes still look composed (bars appear only beyond it).
export function createView(canvas, { width, height, background = '#000', meta = null }) {
  const ctx = canvas.getContext('2d');
  const fluid = meta?.fluid ?? null;
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  const api = { ctx, width, height, landscape: width > height, sizeKey: 0 };

  const resize = () => {
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 3);
    const w = canvas.clientWidth || globalThis.innerWidth;
    const h = canvas.clientHeight || globalThis.innerHeight;
    // Some WebViews (seen on iOS: a game's very first load, before "leaving and coming back"
    // fixes it) can run this synchronous first call before the canvas has a real layout box, so
    // clientWidth/Height read 0. Skip the update rather than let scale become 0/0 (NaN), which
    // would silently break every tap's coordinate mapping until something else forces a fresh
    // layout - the requestAnimationFrame retry below is what actually recovers it.
    if (!w || !h) return;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    if (fluid) {
      const short = fluid.short ?? 720;
      const maxAspect = fluid.maxAspect ?? 2.4;
      const land = canvas.width > canvas.height;
      const aspect = Math.min(Math.max(canvas.width, canvas.height) / Math.min(canvas.width, canvas.height), maxAspect);
      width = land ? short * aspect : short;
      height = land ? short : short * aspect;
      scale = (land ? canvas.height : canvas.width) / short;
      if (land ? canvas.width / canvas.height > maxAspect : canvas.height / canvas.width > maxAspect) scale = Math.min(canvas.width / width, canvas.height / height);
      offsetX = (canvas.width - width * scale) / 2;
      offsetY = (canvas.height - height * scale) / 2;
      if (meta) { meta.width = width; meta.height = height; meta.cssPerUnit = scale / dpr; }
      Object.assign(api, { width, height, landscape: land, sizeKey: api.sizeKey + 1, cssPerUnit: scale / dpr });
      return;
    }
    scale = Math.min(canvas.width / width, canvas.height / height);
    offsetX = (canvas.width - width * scale) / 2;
    offsetY = (canvas.height - height * scale) / 2;
    api.cssPerUnit = scale / dpr;
    if (meta) meta.cssPerUnit = scale / dpr;
  };
  resize();
  // Belt-and-suspenders: a WebView's first layout pass can still land after this script runs even
  // when clientWidth/Height aren't literally 0 (an intermediate, not-yet-final box) - re-measure
  // once real frames have actually been painted. Cheap and idempotent once layout has settled.
  globalThis.requestAnimationFrame?.(() => globalThis.requestAnimationFrame(resize));
  globalThis.addEventListener('resize', resize);
  // WebViews can fire `resize` BEFORE the canvas has its new CSS box (seen on iOS: after a rotation the canvas kept its old
  // pixel size and the game looked stretched). Re-measure whenever the canvas box itself changes, on orientationchange (with
  // delayed passes) and on visualViewport changes. resize() is idempotent, so extra calls are harmless.
  if (typeof globalThis.ResizeObserver === 'function') new globalThis.ResizeObserver(() => resize()).observe(canvas);
  globalThis.addEventListener('orientationchange', () => { resize(); setTimeout(resize, 150); setTimeout(resize, 500); });
  globalThis.visualViewport?.addEventListener('resize', resize);

  return Object.assign(api, {
    resize,
    toVirtual(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return { x: -1, y: -1 }; // no real layout yet; matches no button
      const px = ((clientX - rect.left) / rect.width) * canvas.width;
      const py = ((clientY - rect.top) / rect.height) * canvas.height;
      return { x: (px - offsetX) / scale, y: (py - offsetY) / scale };
    },
    // Wrap one frame of drawing: clears, letterboxes, then calls draw(ctx) in virtual units.
    frame(draw) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width, height);
      ctx.clip();
      draw(ctx);
      ctx.restore();
    },
  });
}
