// Screen geometry: one place for every rectangle so game.js (hit-testing) and view.js (drawing) never disagree.
// FLUID (kit 1.7): the SHORT side of the screen is always 720 units and the long side grows with the aspect ratio, so the
// live size is W x H = 720 x (960..1728) in portrait and (960..1728) x 720 in landscape. `meta` is the object the kit
// updates on every resize; `syncSize()` copies it into the live bindings W and H (the game calls it every frame).
// The mat is 600 x 900 world units. It is drawn upright (your side at the bottom) or turned a quarter turn (your side on
// the left), whichever lets it be bigger on this screen; every pointer position goes through toWorld().
export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
export let W = 720;
export let H = 1280;
export function syncSize() { W = meta.width; H = meta.height; }

// Safe areas and the host's floating back button, in virtual units (main.js keeps this current; browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0 };

export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const R = (x, y, w, h) => ({ x, y, w, h });
const tap = (base) => (host.px > 0 ? clamp(Math.round(44 / host.px), base, base + 20) : base);
const minFs = () => (host.px > 0 ? Math.ceil(11 / host.px) : 0);

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const MAT_W = 600, MAT_H = 900, FRAME = 46;

const cache = new Map();
// z = text zoom (1..3), watch = Watch & Learn (no squidger row)
export function playLayout(z = 1, watch = false) {
  const key = `${W}x${H}|${z}|${watch ? 1 : 0}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}|${host.px.toFixed(2)}`;
  let L = cache.get(key);
  if (!L) {
    const land = W > H;
    for (let ze = Math.min(z, 3); ; ze -= 0.25) {
      L = land ? landscape(Math.max(1, ze), watch) : portrait(Math.max(1, ze), watch);
      const need = land ? 0.62 * H : 0.62 * W;
      if ((L.mat.s * (L.mat.rot ? MAT_H : MAT_W) >= need && !L.overflow) || ze <= 1.01) break;
    }
    L.key = key; cache.set(key, L);
    if (cache.size > 60) cache.delete(cache.keys().next().value);
  }
  return L;
}

const fontsFor = (z) => {
  const mf = minFs(), f = (b) => Math.round(Math.max(b, mf) * z);
  return { name: f(22), sub: f(16), score: f(38), info: f(22), btn: f(25), small: f(17), label: f(18), z };
};

// the mat fitted into a box (the box includes the frame margin around the 600 x 900 mat)
function fitMat(bx, by, bw, bh, forceRot) {
  const cand = (rot) => {
    const mw = rot ? MAT_H : MAT_W, mh = rot ? MAT_W : MAT_H;
    const s = Math.max(0.05, Math.min(bw / (mw + 2 * FRAME), bh / (mh + 2 * FRAME)));
    return { rot, s, mw, mh };
  };
  const a = cand(false), b = cand(true);
  const c = forceRot === undefined ? (b.s > a.s * 1.02 ? b : a) : forceRot ? b : a;
  const w = c.mw * c.s, h = c.mh * c.s;
  return { rot: c.rot, s: c.s, x: bx + (bw - w) / 2, y: by + (bh - h) / 2, w, h };
}

function portrait(z, watch) {
  const fs = fontsFor(z), pad = Math.max(16, host.l, host.r), g = 10, GW = W - 2 * pad;
  const topY = 40 + Math.max(host.t, host.back ? host.t + host.back + 4 : 0);   // the kit's preview pill sits at y 6..34
  const stacked = z > 1.5;
  const cardH = stacked ? Math.round(Math.max(fs.score, fs.name * 1.2 + fs.sub * 1.2) + 18) : Math.round(fs.name * 1.25 + fs.score * 0.9 + 22);
  const cards = stacked ? [R(pad, topY, GW, cardH), R(pad, topY + cardH + 8, GW, cardH)] : [R(pad, topY, (GW - g) / 2, cardH), R(pad + (GW + g) / 2, topY, (GW - g) / 2, cardH)];
  const cardsB = topY + (stacked ? 2 * cardH + 8 : cardH);
  const info = R(pad, cardsB + 6, GW, Math.round(fs.info * (z > 1.5 ? 3.4 : 2.5) + 8));
  const bb = Math.max(0, host.b - 6);
  const btnH = tap(Math.round(fs.btn * 1.1 + 26)), dBtn = tap(Math.round(Math.min(fs.btn, 30) * 1.1 + 24));
  const sqH = tap(Math.round(fs.btn * 1.05 + 52));
  const bTop = (h) => H - 10 - bb - h;
  let bottomH, demo = null, sqBtns = null, btns = null;
  if (watch) {
    bottomH = z <= 2.01 ? 2 * dBtn + g : 3 * dBtn + 2 * g;
    const y = bTop(bottomH);
    if (z <= 2.01) {
      const wide = Math.round((GW - 2 * g) * 0.27), mid = GW - 2 * wide - 2 * g;
      demo = { dec: R(pad, y, wide, dBtn), pause: R(pad + wide + g, y, mid, dBtn), inc: R(pad + wide + g + mid + g, y, wide, dBtn), exit: R(pad, y + dBtn + g, GW, dBtn) };
    } else {
      const half = (GW - g) / 2;
      demo = { pause: R(pad, y, GW, dBtn), dec: R(pad, y + dBtn + g, half, dBtn), inc: R(pad + half + g, y + dBtn + g, half, dBtn), exit: R(pad, y + 2 * (dBtn + g), GW, dBtn) };
    }
  } else {
    bottomH = sqH + g + btnH;
    const y = bTop(bottomH), cw = (GW - 2 * g) / 3;
    sqBtns = [0, 1, 2].map((i) => R(pad + i * (cw + g), y, cw, sqH));
    const by = y + sqH + g, half = (GW - g) / 2;
    btns = { hint: R(pad, by, half, btnH), menu: R(pad + half + g, by, half, btnH) };
  }
  const y1 = info.y + info.h + 6, y2 = bTop(bottomH) - 6;
  const mat = fitMat(pad, y1, GW, Math.max(120, y2 - y1));
  return { land: false, z, fs, cards, info, mat, sqBtns, btns, demo, pad, stacked, mode: 'portrait', overflow: y2 - y1 < 200 };
}

function landscape(z, watch) {
  const fs = fontsFor(z), g = 12;
  const U = { x0: host.l + 10, x1: W - host.r - 10, y0: Math.max(host.t, 34) + 4, y1: H - Math.max(host.b, 10) };
  U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const btnH = tap(Math.round(fs.btn * 1.1 + 26)), dBtn = tap(Math.round(Math.min(fs.btn, 30) * 1.1 + 24));
  const cardH = Math.round(Math.max(fs.score * 0.95, fs.name * 1.2 + fs.sub * 1.2) + 14);
  const infoH = Math.round(fs.info * (z > 1.5 ? 5.2 : 4.0) + 8);
  const pwMin = 340 + Math.round(70 * (z - 1)), pwMax = 560 + Math.round(70 * (z - 1));
  // the mat gets what is left after the minimum panel
  let mat = fitMat(U.x0, U.y0, U.w - pwMin - g, U.h);
  let pw = clamp(U.w - mat.w - 2 * FRAME * mat.s - 3 * g, pwMin, pwMax);
  const groupW = mat.w + 2 * FRAME * mat.s + g + pw, gx = U.x0 + (U.w - groupW) / 2;
  mat = fitMat(gx, U.y0, mat.w + 2 * FRAME * mat.s, U.h, mat.rot);
  const px = gx + mat.w + 2 * FRAME * mat.s + g, bp = host.back ? R(host.l, host.t, host.back + 8, host.back + 8) : null;
  let y = U.y0;
  if (bp && px < bp.x + bp.w) y = Math.max(y, bp.y + bp.h + 4);
  const cards = [R(px, y, pw, cardH), R(px, y + cardH + 8, pw, cardH)];
  y += 2 * cardH + 8 + g;
  const info = R(px, y, pw, infoH); y += infoH + g;
  let sqBtns = null, btns = null, demo = null;
  const bottom = U.y1;
  if (watch) {
    const total = 3 * dBtn + 2 * g, y0 = Math.max(y, bottom - total), half = (pw - g) / 2;
    demo = { pause: R(px, y0, pw, dBtn), dec: R(px, y0 + dBtn + g, half, dBtn), inc: R(px + half + g, y0 + dBtn + g, half, dBtn), exit: R(px, y0 + 2 * (dBtn + g), pw, dBtn) };
    y = y0;
  } else {
    const sqH = tap(Math.round(fs.btn * 1.05 + 40)), cw = (pw - 2 * g) / 3;
    const total = sqH + g + btnH;
    const y0 = Math.max(y, bottom - total);
    sqBtns = [0, 1, 2].map((i) => R(px + i * (cw + g), y0, cw, sqH));
    const by = y0 + sqH + g, half = (pw - g) / 2;
    btns = { hint: R(px, by, half, btnH), menu: R(px + half + g, by, half, btnH) };
    y = by + btnH;
  }
  const overflow = !watch && y > U.y1 + 1;
  return { land: true, z, fs, cards, info, mat, sqBtns, btns, demo, pad: g, stacked: true, mode: 'landscape', overflow, panel: R(px, U.y0, pw, U.h) };
}

// ---- world <-> screen ---------------------------------------------------------------------------------------------
// Upright: sx = x0 + wx s, sy = y0 + wy s.  Turned: sx = x0 + (900 - wy) s, sy = y0 + wx s (your side, wy = 900, on the left).
// The 3D presenter installs `lens` while the perspective camera is up: the mat is then seen at a tilt, so screen <-> world goes
// through the camera instead of the flat fit below. With `lens.on` false (no WebGL) the flat maths are used unchanged.
export const lens = { on: false, to: null, from: null };
export function toScreen(L, wx, wy) {
  if (lens.on && lens.to) return lens.to(wx, wy);
  const m = L.mat;
  return m.rot ? { x: m.x + (MAT_H - wy) * m.s, y: m.y + wx * m.s } : { x: m.x + wx * m.s, y: m.y + wy * m.s };
}
export function toWorld(L, sx, sy) {
  if (lens.on && lens.from) { const p = lens.from(sx, sy); if (p) return p; }
  const m = L.mat;
  return m.rot ? { x: (sy - m.y) / m.s, y: MAT_H - (sx - m.x) / m.s } : { x: (sx - m.x) / m.s, y: (sy - m.y) / m.s };
}
// a screen-space vector (dx, dy) in world units
export function vecToWorld(L, dx, dy) {
  const m = L.mat;
  return m.rot ? { x: dy / m.s, y: -dx / m.s } : { x: dx / m.s, y: dy / m.s };
}
// canvas transform arguments for drawing in world units (ctx.transform)
export function matTransform(L) {
  const m = L.mat;
  return m.rot ? [0, m.s, -m.s, 0, m.x + MAT_H * m.s, m.y] : [m.s, 0, 0, m.s, m.x, m.y];
}
// the mat's screen rectangle (world 0..600 x 0..900) plus the table frame around it
export function matBox(L, margin = 0) {
  const m = L.mat, e = (FRAME + margin) * m.s;
  return { x: m.x - e, y: m.y - e, w: m.w + 2 * e, h: m.h + 2 * e };
}

// ---- reference pages (About / How to play / Rules) --------------------------------------------------------------------
const refCache = new Map();
export function refLayout() {
  const key = `${W}x${H}|${Math.round(host.t)},${Math.round(host.l)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.back)}|${host.px.toFixed(2)}`;
  let r = refCache.get(key);
  if (r) return r;
  if (W > H) {
    const margin = host.back ? Math.max(34, host.l + host.back + 10) : 34;
    const pw = Math.min(W - 2 * margin, 920), barH = tap(76), barY = H - Math.max(14, host.b + 8) - barH, py = Math.max(10, host.t + 6);
    const gw = Math.min(pw, 860), x0 = (W - gw) / 2, bw = Math.round(gw * 0.27), g = 12, mw = gw - 2 * bw - 2 * g, sw = Math.round(mw * 0.3);
    r = {
      land: true, panel: R((W - pw) / 2, py, pw, barY - 10 - py), back: R(x0, barY, bw, barH), next: R(x0 + gw - bw, barY, bw, barH),
      dec: R(x0 + bw + g, barY, sw, barH), inc: R(x0 + gw - bw - g - sw, barY, sw, barH), pct: { x: x0 + bw + g + sw + (mw - 2 * sw) / 2, y: barY + barH / 2 },
    };
  } else {
    const rowY = Math.max(18, host.t + 6), M = Math.max(20, host.l, host.r);
    const py = Math.max(100, rowY + 70, host.back ? host.t + host.back + 10 : 0);
    const barH = 100, barY = H - Math.max(116, host.b + barH + 10);
    const half = (W - 2 * M - 16) / 2;
    r = {
      land: false, panel: R(34, py, W - 68, barY - 34 - py), back: R(M, barY, half, barH), next: R(M + half + 16, barY, half, barH),
      inc: R(W - M - 120, rowY, 120, 60), dec: R(W - M - 252, rowY, 120, 60), pct: { x: W - M - 268, y: rowY + 30, right: true },
    };
  }
  refCache.set(key, r); if (refCache.size > 30) refCache.delete(refCache.keys().next().value);
  return r;
}
// Setup screen pins (Start / Back) for the portrait list; landscape lays them out itself (menus.js).
export function setupPins() {
  const bb = Math.max(0, host.b - 10), h = tap(96);
  return { start: R(30, H - 124 - bb + (96 - h), 440, h), back: R(486, H - 124 - bb + (96 - h), 204, h) };
}
