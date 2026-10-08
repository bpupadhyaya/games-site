// Fluid layout (kit fluid viewport: the short side is always 720 virtual units, the long side follows the screen).
//   port   portrait phone / tablet: scoreboard on top, the 3D table in the middle, controls below
//   wide   landscape (aspect >= 1.5): player card left, the table in the middle, opponent/controls card right
//   square landscape closer to 4:3 (some tablets, split windows): laid out like portrait with the wide camera
export const TEXT_SCALES = [1, 1.25, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zeros).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.55 };

const cache = new Map();
const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function layoutFor(w, h, zoom = 1) {
  w = Math.round(w); h = Math.round(h);
  const z = Math.round(zoom * 100);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}|${z}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }, zoom); cache.set(key, L); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  return L;
}

function build(w, h, ins, zoom) {
  const land = w > h;
  const aspect = Math.max(w, h) / Math.min(w, h);
  const mode = !land ? 'port' : aspect >= 1.3 ? 'wide' : 'square';
  const U = { x: ins.l, y: ins.t, w: w - ins.l - ins.r, h: h - ins.t - ins.b };
  const L = { w, h, land, aspect, mode, U, ins };
  const hz = Math.min(zoom, 1.3);                    // scoreboard text zoom is capped so the match stays playable
  L.back = ins.back ? R(ins.l, ins.t, Math.max(ins.back, 56) + 8, Math.max(ins.back, 56) + 8) : R(0, 0, 0, 0);
  if (mode === 'wide') {
    const pw = clamp(Math.round(U.w * 0.2), 170, 330);
    L.left = R(U.x + 8, U.y + 8, pw - 8, U.h - 16);
    L.right = R(U.x + U.w - pw, U.y + 8, pw - 8, U.h - 16);
    L.top = R(U.x + pw, U.y, U.w - 2 * pw, 0);
    L.bottom = R(U.x + pw, U.y + U.h - 96, U.w - 2 * pw, 96);
    L.region = R(U.x + pw + 6, U.y + 14, U.w - 2 * pw - 12, U.h - 14 - 90);
    L.camMode = 'wide';
    L.panelW = pw;
  } else {
    const topH = Math.round(150 * hz) + (ins.back ? 0 : 0);
    const botH = Math.round((mode === 'port' ? 150 : 104) + ins.b * 0.4);
    L.top = R(U.x, U.y, U.w, topH);
    L.bottom = R(U.x, h - ins.b - botH, U.w, botH);
    L.region = R(U.x + 6, U.y + topH + 4, U.w - 12, Math.max(200, h - ins.b - botH - (U.y + topH) - 8));
    L.camMode = mode === 'port' ? (L.region.h / L.region.w > 1.55 ? 'tall' : 'mid') : 'wide';
  }
  // the "playfield" where fingers move the paddle: the whole match region plus the strip below it
  L.play = R(L.region.x, L.region.y, L.region.w, (L.bottom.y + L.bottom.h) - L.region.y);
  return L;
}
