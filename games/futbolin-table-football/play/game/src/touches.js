// Multi-touch for the two-player match. The kit's pointer follows one finger; this module tracks every finger on the canvas by pointer id,
// in virtual units, so two people can slide and flick their rods at the same time on one screen.
import { W, H } from './layout.js';
export const touches = new Map();      // id -> { x, y, down, fresh }

export function attachTouches(canvas) {
  const at = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (W / Math.max(1, r.width)), y: (e.clientY - r.top) * (H / Math.max(1, r.height)) };
  };
  canvas.addEventListener('pointerdown', (e) => { touches.set(e.pointerId, { ...at(e), down: true, fresh: true }); });
  canvas.addEventListener('pointermove', (e) => { const t = touches.get(e.pointerId); if (t && t.down) Object.assign(t, at(e)); });
  const up = (e) => { const t = touches.get(e.pointerId); if (t) { Object.assign(t, at(e)); t.down = false; t.ended = true; } };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('lostpointercapture', up);
}
export const clearTouches = () => touches.clear();
