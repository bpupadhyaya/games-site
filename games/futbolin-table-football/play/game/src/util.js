export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
// A cheap deterministic hash in [0, 1) for presentation effects (never used by the simulation).
export const hash = (n) => { const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
