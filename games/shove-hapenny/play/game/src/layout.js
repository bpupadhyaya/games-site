// Screen geometry: one place for every rectangle so game.js (hit-testing) and view.js (drawing) never disagree.
// FLUID (kit 1.7): the SHORT side of the screen is always 720 units and the long side grows with the aspect ratio, so the
// live size is W x H = 720 x (960..1728) in portrait and (960..1728) x 720 in landscape. `meta` is the object the kit
// updates on every resize; `syncSize()` copies it into the live bindings W and H (the game calls it every frame).
// The board is drawn with the far bed at the top (tall screens) or at the right (wide screens and 4:3 portrait), always as
// large as the HUD leaves room for. Everything below is a pure function of (W, H, safe insets, text zoom), cached by key.
import { WX0, WX1, WY0, WY1 } from './sim.js';
import { v3 } from './v3.js';
export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
export let W = 720;
export let H = 1280;
export function syncSize() { W = meta.width; H = meta.height; }

export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0 };

export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const R = (x, y, w, h) => ({ x, y, w, h });
const tap = (base) => (host.px > 0 ? clamp(Math.round(44 / host.px), base, base + 20) : base);
const minFs = () => (host.px > 0 ? Math.ceil(11 / host.px) : 0);

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];

// The board's bounding box in world units (rails and the back board included).
export { WX0, WX1, WY0, WY1 };
export const BW = WX1 - WX0, BH = WY1 - WY0;

const cache = new Map();
export function playLayout(z = 1, watch = false) {
  const key = `${W}x${H}|${z}|${watch ? 1 : 0}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}|${host.px.toFixed(2)}`;
  let L = cache.get(key);
  if (!L) {
    const land = W > H;
    const minS = 0.9;
    for (let ze = Math.min(z, 3); ; ze -= 0.25) {
      L = land ? landscape(Math.max(1, ze), watch) : portrait(Math.max(1, ze), watch);
      if ((L.s >= minS && !L.overflow) || ze <= 1.01) break;
    }
    // Portrait with height to spare (a tall phone: the board is as wide as the screen and the HUD is small): scale the HUD up, as far as the
    // board stays exactly as wide, so the spare height becomes bigger score cards, text and buttons instead of an empty band.
    if (!land && L.rect.w >= W - 2 * L.pad - 1) {
      const w0 = L.rect.w;
      for (let zz = Math.max(z, 2); zz > z + 0.01; zz -= 0.125) {
        const c = portrait(zz, watch);
        if (c.rect.w >= w0 - 0.5 && !c.overflow) { L = c; break; }
      }
    }
    L.key = key; cache.set(key, L);
    if (cache.size > 60) cache.delete(cache.keys().next().value);
  }
  return L;
}

const fontsFor = (z) => {
  const mf = minFs(), f = (b) => Math.round(Math.max(b, mf) * z);
  return { name: f(22), sub: f(16), score: f(38), info: f(21), btn: f(26), small: f(17), z };
};

// Fit the board (rotated or not) into a rectangle; returns the transform.
function fit(rect, rot) {
  const bw = rot ? BH : BW, bh = rot ? BW : BH;
  const s = Math.min(rect.w / bw, rect.h / bh);
  return { s, ox: rect.x + (rect.w - bw * s) / 2, oy: rect.y + (rect.h - bh * s) / 2, rot, rect: R(rect.x + (rect.w - bw * s) / 2, rect.y + (rect.h - bh * s) / 2, bw * s, bh * s) };
}

function portrait(z, watch) {
  const fs = fontsFor(z), pad = Math.max(16, host.l, host.r), g = 10, GW = W - 2 * pad;
  const topY = 46 + Math.max(host.t, host.back ? host.t + host.back + 4 : 0);   // the kit's preview pill sits at y 6..42
  const stacked = z > 1.5;
  const cardH = stacked ? Math.round(Math.max(fs.score, fs.name * 1.2 + fs.sub * 1.2) + 18) : Math.round(fs.name * 1.25 + fs.score * 0.9 + 22);
  const cards = stacked ? [R(pad, topY, GW, cardH), R(pad, topY + cardH + 8, GW, cardH)] : [R(pad, topY, (GW - g) / 2, cardH), R(pad + (GW + g) / 2, topY, (GW - g) / 2, cardH)];
  const cardsB = topY + (stacked ? 2 * cardH + 8 : cardH);
  const info = R(pad, cardsB + 6, GW, Math.round(fs.info * 2.5 + 8));
  const topEnd = info.y + info.h;
  const bb = Math.max(0, host.b - 6);
  const btnH = tap(Math.round(fs.btn * 1.1 + 26)), dBtn = tap(Math.round(Math.min(fs.btn, 30) * 1.1 + 24));
  let bottomH, btns = null, demo = null;
  const bTop = (h) => H - 10 - bb - h;
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
    bottomH = z > 2.01 ? 2 * btnH + g : btnH;
    const y = bTop(bottomH);
    if (z > 2.01) { btns = { hint: R(pad, y, GW, btnH), menu: R(pad, y + btnH + g, GW, btnH) }; }
    else { const half = (GW - g) / 2; btns = { hint: R(pad, y, half, btnH), menu: R(pad + half + g, y, half, btnH) }; }
  }
  const y1 = topEnd + 6, y2 = bTop(bottomH) - 6;
  const area = R(pad, y1, GW, Math.max(60, y2 - y1));
  // tall screens keep the arches at the top; 4:3 tablets turn the board so it can use the width
  // take whichever orientation gives the larger board (the upright board on a 3:4 tablet leaves empty bands above and below the turned one)
  const tR = fit(area, true), tU = fit(area, false);
  const t = H / W < 1.5 && tR.s > tU.s * 1.02 ? tR : H / W < 1.5 ? tU : tU;
  return { land: false, z, fs, cards, info, ...t, area, btns, demo, pad, stacked, mode: 'portrait', overflow: false };
}

function landscape(z, watch) {
  const fs = fontsFor(z), g = 12;
  const U = { x0: host.l + 10, x1: W - host.r - 10, y0: Math.max(host.t, 40) + 8, y1: H - Math.max(host.b, 10) };
  U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const btnH = tap(Math.round(fs.btn * 1.1 + 26)), dBtn = tap(Math.round(Math.min(fs.btn, 30) * 1.1 + 24));
  const cardH = Math.round(Math.max(fs.score * 0.95, fs.name * 1.2 + fs.sub * 1.2) + 14);
  const infoH = Math.round(fs.info * 2.5 + 8);
  const pwMin = Math.min(520, 320 + Math.round(70 * (z - 1)));
  const area0 = R(U.x0, U.y0, U.w - pwMin - g, U.h);
  // turn the board whichever way gives the larger board (a 4:3 tablet in landscape fits it upright; wider screens turn it sideways)
  const tR = fit(area0, true), tU = fit(area0, false), t0 = tU.s > tR.s * 1.02 ? tU : tR;
  // a very wide screen: the board is height-limited, so the spare width widens the side panel (up to 680) and the whole group is centred
  const free = Math.max(0, area0.w - t0.rect.w), pw = Math.min(Math.max(pwMin, 680), pwMin + free * 0.75);
  const groupW = t0.rect.w + g + pw, gx = U.x0 + Math.max(0, (U.w - groupW) / 2);
  const area = R(gx, U.y0, t0.rect.w, U.h);
  const t = fit(area, t0.rot);
  const px = gx + t0.rect.w + g, bp = host.back ? R(host.l, host.t, host.back + 8, host.back + 8) : null;
  let y = U.y0;
  if (bp && px < bp.x + bp.w) y = Math.max(y, bp.y + bp.h + 4);
  const cards = [R(px, y, pw, cardH), R(px, y + cardH + 8, pw, cardH)];
  y += 2 * cardH + 8 + g;
  const info = R(px, y, pw, infoH); y += infoH + g;
  let btns = null, demo = null;
  if (watch) {
    const total = 3 * dBtn + 2 * g, y0 = Math.max(y, U.y1 - total), half = (pw - g) / 2;
    demo = { pause: R(px, y0, pw, dBtn), dec: R(px, y0 + dBtn + g, half, dBtn), inc: R(px + half + g, y0 + dBtn + g, half, dBtn), exit: R(px, y0 + 2 * (dBtn + g), pw, dBtn) };
  } else {
    const total = 2 * btnH + g, y0 = Math.max(y, U.y1 - total);
    btns = { hint: R(px, y0, pw, btnH), menu: R(px, y0 + btnH + g, pw, btnH) };
    y = y0 + total;
  }
  const overflow = (!watch && y > U.y1 + 1) || info.y + info.h > U.y1;
  return { land: true, z, fs, cards, info, ...t, area, btns, demo, pad: g, stacked: true, mode: 'landscape', overflow, panel: R(px, U.y0, pw, U.h) };
}

// The board filling the whole screen, behind the menus.
export function bgLayout() {
  const key = `bg${W}x${H}`;
  let L = cache.get(key);
  if (!L) { L = { ...fit(R(24, 24, W - 48, H - 48), W > H || H / W < 1.5), mode: 'bg' }; cache.set(key, L); }
  return L;
}

// world <-> screen for the board
export const toScreen = (L, wx, wy, lift = 0) => (v3.on && v3.project ? v3.project(wx, wy, lift) : L.rot ? { x: L.ox + (WY1 - wy) * L.s, y: L.oy + (wx - WX0) * L.s } : { x: L.ox + (wx - WX0) * L.s, y: L.oy + (wy - WY0) * L.s });
export const toWorld = (L, sx, sy) => (v3.on && v3.toWorld ? v3.toWorld(sx, sy) : L.rot ? { x: (sy - L.oy) / L.s + WX0, y: WY1 - (sx - L.ox) / L.s } : { x: (sx - L.ox) / L.s + WX0, y: (sy - L.oy) / L.s + WY0 });
// Apply the board transform to a canvas context: afterwards draw in world units.
export function applyBoard(ctx, L) {
  ctx.translate(L.ox, L.oy); ctx.scale(L.s, L.s);
  if (L.rot) ctx.transform(0, 1, -1, 0, WY1, -WX0); else ctx.translate(-WX0, -WY0);
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
