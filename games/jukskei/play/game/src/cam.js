// The camera: a side-on oblique view of the lane. World x runs left to right along the lane, y is across it (+ toward the viewer,
// drawn lower on screen, foreshortened by K), z is height. A camera is { cx, s }: the world x at the centre of the rect and pixels
// per metre. The ground line of the lane (y = 0, z = 0) sits at GY of the rect height.
export const K = 0.42;
export const GY = 0.72;
export const S_MIN = 12, S_MAX = 120;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function projector(rect, cam) {
  const ox = rect.x + rect.w / 2, gy = rect.y + rect.h * (rect.gyF ?? GY), s = cam.s;
  return {
    s, rect, gy, ox,
    p: (x, y, z = 0) => ({ x: ox + (x - cam.cx) * s, y: gy + y * K * s - z * s }),
    // the ground point under a screen position
    inv: (sx, sy) => ({ x: cam.cx + (sx - ox) / s, y: (sy - gy) / (K * s) }),
  };
}

// The camera that shows the lane stretch [x0, x1] (metres) across `rect`, and keeps `apex` metres of sky visible.
export function fitSpan(rect, x0, x1, o = {}) {
  const m = o.margin ?? 18, aw = Math.max(40, rect.w - 2 * m);
  let s = aw / Math.max(1, x1 - x0);
  const sky = rect.h * (rect.gyF ?? GY) - 16;
  if (o.apex) s = Math.min(s, sky / Math.max(2, o.apex));
  s = clamp(s, o.min ?? S_MIN, o.max ?? S_MAX);
  return { cx: (x0 + x1) / 2, s };
}
