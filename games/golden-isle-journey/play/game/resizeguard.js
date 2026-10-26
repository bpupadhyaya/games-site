// Resize guard: keeps "canvas pixels == CSS box x dpr" true even when a rotation lands while the main thread is busy and the
// kit's own resize/ResizeObserver/orientationchange pass was missed or ran against a stale box (canvas stayed landscape-sized,
// bottom half black). On a mismatch it re-dispatches `resize`, which the kit's view already listens to. Never draws, never
// touches game state. `win` is injected (window in the browser, a fake in tests).
export function installResizeGuard({ canvas, win, setTimer = (f, ms) => win.setTimeout(f, ms), frames = true }) {
  const dpr = () => Math.min(win.devicePixelRatio || 1, 3);
  const stale = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return false;                       // no layout box yet: the kit skips too
    const d = dpr();
    return canvas.width !== Math.round(w * d) || canvas.height !== Math.round(h * d);
  };
  const check = () => { if (stale()) { win.dispatchEvent(new win.Event('resize')); return true; } return false; };
  const burst = () => { check(); setTimer(check, 120); setTimer(check, 450); };
  if (frames && win.requestAnimationFrame) { const loop = () => { check(); win.requestAnimationFrame(loop); }; win.requestAnimationFrame(loop); }
  for (const ev of ['orientationchange', 'pageshow', 'focus']) win.addEventListener(ev, burst);
  win.visualViewport?.addEventListener('resize', check);
  if (typeof win.ResizeObserver === 'function') new win.ResizeObserver(check).observe(win.document.documentElement);
  return { check, stale, burst };
}
