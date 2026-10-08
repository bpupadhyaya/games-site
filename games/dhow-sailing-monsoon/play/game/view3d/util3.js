// Small helpers shared by the 3D modules (presentation only; may use the DOM).
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const DEG = Math.PI / 180;
export function rng(seed) { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
export function canvasTex(THREE, w, h, draw, { repeat = false, srgb = true } = {}) {
  const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
// Convert a sim position (x east, y north, metres) to three.js world coordinates (x east, y up, z = -north).
export const toWorld = (x, y, h = 0) => [x, h, -y];
// Compass heading (deg) -> rotation.y of an object whose forward is -Z.
export const headingRot = (h) => -h * DEG;
