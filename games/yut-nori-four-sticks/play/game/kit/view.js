// Virtual-resolution canvas: the game always draws in meta.width x meta.height units;
// this scales + letterboxes to any screen and handles devicePixelRatio. Browser only.
export function createView(canvas, { width, height, background = '#000' }) {
  const ctx = canvas.getContext('2d');
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

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
    scale = Math.min(canvas.width / width, canvas.height / height);
    offsetX = (canvas.width - width * scale) / 2;
    offsetY = (canvas.height - height * scale) / 2;
  };
  resize();
  // Belt-and-suspenders: a WebView's first layout pass can still land after this script runs even
  // when clientWidth/Height aren't literally 0 (an intermediate, not-yet-final box) - re-measure
  // once real frames have actually been painted. Cheap and idempotent once layout has settled.
  globalThis.requestAnimationFrame?.(() => globalThis.requestAnimationFrame(resize));
  globalThis.addEventListener('resize', resize);

  return {
    ctx,
    width,
    height,
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
  };
}
