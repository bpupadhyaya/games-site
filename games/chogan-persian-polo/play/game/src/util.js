export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const hyp = Math.hypot;
export const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
export const sgn = (v) => (v < 0 ? -1 : 1);
export const r2 = (v) => Math.round(v * 100) / 100;
