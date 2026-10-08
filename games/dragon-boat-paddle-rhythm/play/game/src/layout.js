// Fluid layout (kit fluid viewport: the short side is always 720 virtual units, the long side follows the screen).
//   port    portrait phone / tablet: progress and meters on top, the 3D river in the middle, stick left and drum pad right
//   wide    landscape: the same HUD, pad and stick tucked into the bottom corners so the river stays centre stage
// The race HUD rectangles are computed once per size and cached.
export { TEXT_SCALES, THINK_STEPS } from './common.js';

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
  L.back = ins.back ? R(ins.l, ins.t, Math.max(ins.back, 56) + 8, Math.max(ins.back, 56) + 8) : R(0, 0, 0, 0);
  // ---- race HUD
  const hud = {};
  const backW = ins.back ? Math.max(ins.back, 56) + 12 : 0;
  const y0 = U.y + 10;
  hud.pause = R(U.x + U.w - 12 - 60, y0, 60, 60);
  hud.hint = R(hud.pause.x - 12 - 60, y0, 60, 60);
  hud.place = R(hud.hint.x - 12 - 112, y0, 112, 60);
  const px0 = U.x + 12 + backW;
  hud.prog = R(px0, y0 + 6, Math.max(120, hud.place.x - 14 - px0), 48);
  hud.bannerY = y0 + 100;
  hud.meters = R(U.x + 16 + backW * 0.0, y0 + 124, Math.min(U.w - 32, 640), 54);
  if (mode === 'wide') { hud.meters = R(U.x + 16 + backW, y0 + 124, Math.min(U.w * 0.42, 520), 54); }
  const padR = clamp(Math.min(U.w * (land ? 0.15 : 0.2), U.h * (land ? 0.21 : 0.15)), 90, 170);
  const padCx = land ? U.x + U.w - padR - 34 : U.x + U.w * 0.68;
  const padCy = U.y + U.h - padR - 34 - ins.b * 0.0;
  hud.pad = { cx: padCx, cy: padCy, r: padR };
  hud.surge = { cx: land ? padCx - padR - 56 : clamp(padCx + padR + 4, U.x + U.w - 78, U.x + U.w - 78), cy: land ? padCy - 12 : padCy - padR - 92, r: clamp(padR * 0.46, 50, 76) };
  if (!land) { hud.surge.cx = U.x + U.w - hud.surge.r - 22; }
  hud.stick = { cx: land ? U.x + 150 : U.x + U.w * 0.2, cy: padCy, r: clamp(padR * 0.62, 70, 118) };
  const splitX = land ? U.x + U.w * 0.34 : U.x + U.w * 0.42;
  hud.steerZone = R(U.x, y0 + 190, splitX - U.x, U.y + U.h - (y0 + 190));
  hud.tapZone = R(splitX, y0 + 190, U.x + U.w - splitX, U.y + U.h - (y0 + 190));
  L.hud = hud;
  L.camMode = mode === 'wide' ? 'wide' : 'tall';
  // 3D framing hint: where on screen the boat should sit (fraction of the height), used for the lens shift
  L.boatY = mode === 'wide' ? 0.5 : 0.42;
  return L;
}
