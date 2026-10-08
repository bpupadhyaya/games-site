// Optional stylus pressure. The kit's input snapshot carries x/y only, so main.js watches the canvas for pen pointers and stores the latest pressure here.
// Fingers and mice report no useful pressure (0.5 or 1), so only pointerType "pen" counts; everything else stays null and the brush falls back to speed.
export const pen = { p: null };
export function attachPen(canvas) {
  const f = (e) => { pen.p = e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : null; };
  canvas.addEventListener('pointerdown', f, true);
  canvas.addEventListener('pointermove', f, true);
  const clear = () => { pen.p = null; };
  canvas.addEventListener('pointerup', clear, true);
  canvas.addEventListener('pointercancel', clear, true);
}
