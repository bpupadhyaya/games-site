export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const hyp = Math.hypot;
export const r2 = (v) => Math.round(v * 100) / 100;
export const sgn = (v) => (v < 0 ? -1 : 1);
// deterministic hash noise for the picture only (no Math.random): same input, same value in [0, 1)
export const hash01 = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
