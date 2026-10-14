// Screen geometry: one place for every rectangle so game.js (hit-testing) and view.js (drawing) never disagree.
// FLUID (kit 1.7): the SHORT side of the screen is always 720 units and the long side grows with the aspect ratio, so the
// live size is W x H = 720 x (960..1728) in portrait and (960..1728) x 720 in landscape. `meta` is the object the kit
// updates on every resize; `syncSize()` copies it into the live bindings W and H (the game calls it every frame).
// Portrait: score cards on top, the lawn, then the buttons. Landscape: the lawn on the left, a panel on the right.
export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
export let W = 720;
export let H = 1280;
export function syncSize() {
  W = meta.width; H = meta.height;
  // The kit's preview pill: top centre in portrait; tucked into the top-right corner in landscape so it never sits on the hint toast.
  meta.previewBadge = W > H ? { x: W - Math.max(host.r, 0) - 12, y: Math.max(host.t, 0) + 6, align: 'right' } : null;
}

export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0 };

export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const R = (x, y, w, h) => ({ x, y, w, h });
const tap = (base) => (host.px > 0 ? clamp(Math.round(44 / host.px), base, base + 20) : base);
const minFs = () => (host.px > 0 ? Math.ceil(11 / host.px) : 0);

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];

const cache = new Map();
export function playLayout(z = 1, watch = false, n = 2) {
  const key = `${W}x${H}|${z}|${watch ? 1 : 0}|${n}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}|${host.px.toFixed(2)}`;
  let L = cache.get(key);
  if (!L) {
    const land = W > H;
    for (let ze = Math.min(z, 3); ; ze -= 0.25) {
      L = land ? landscape(Math.max(1, ze), watch, n) : portrait(Math.max(1, ze), watch, n);
      if ((!L.overflow && L.field.h >= (land ? H * 0.5 : H * 0.48) && L.field.w >= 220) || ze <= 1.01) break;
    }
    L.key = key; cache.set(key, L);
    if (cache.size > 60) cache.delete(cache.keys().next().value);
  }
  return L;
}

const fontsFor = (z) => {
  const mf = minFs(), f = (b) => Math.round(Math.max(b, mf) * z);
  return { name: f(21), sub: f(16), score: f(42), info: f(21), btn: f(26), small: f(17), z };
};

function cardGrid(n, x, y, w, fs, g, cols) {
  const rows = Math.ceil(n / cols), cw = (w - g * (cols - 1)) / cols;
  const h = Math.round(Math.max(fs.score * 1.05, fs.name * 1.25 + fs.sub * 0.4) + 26);
  const out = [];
  for (let i = 0; i < n; i++) out.push(R(x + (i % cols) * (cw + g), y + Math.floor(i / cols) * (h + 8), cw, h));
  return { rects: out, h: rows * h + (rows - 1) * 8 };
}

function toggles(field, fs, tapH, land) {
  // two small switches sitting on the lawn, near the player's end (bottom corners of the field)
  const bh = Math.round(Math.max(tapH * 0.92, fs.small * 2.4)), g = 10, m = 10;
  const w = Math.min((field.w - 3 * m) / 2, Math.round(fs.small * 11));
  const y = field.y + field.h - bh - m;
  return { style: R(field.x + m, y, w, bh), spin: R(field.x + field.w - m - w, y, w, bh), g, land };
}

function portrait(z, watch, n) {
  const fs = fontsFor(z), pad = Math.max(14, host.l, host.r), g = 8, GW = W - 2 * pad;
  const topY = 40 + Math.max(host.t, host.back ? host.t + host.back + 4 : 0);   // the kit's preview pill sits at y 6..34
  const cols = z > 1.5 ? 1 : n <= 2 ? n : 2;
  const grid = cardGrid(n, pad, topY, GW, fs, g, cols);
  const info = R(pad, topY + grid.h + 6, GW, Math.round(fs.info * (z > 1.8 ? 3.7 : 2.45) + 6));
  const topEnd = info.y + info.h;
  const bb = Math.max(0, host.b - 6);
  const btnH = tap(Math.round(fs.btn * 1.1 + 22)), dBtn = tap(Math.round(Math.min(fs.btn, 30) * 1.1 + 22));
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
    const stack = z > 2.01;
    bottomH = stack ? 3 * btnH + 2 * g : btnH;
    const y = bTop(bottomH);
    if (stack) btns = { hint: R(pad, y, GW, btnH), card: R(pad, y + btnH + g, GW, btnH), menu: R(pad, y + 2 * (btnH + g), GW, btnH) };
    else { const third = (GW - 2 * g) / 3; btns = { hint: R(pad, y, third, btnH), card: R(pad + third + g, y, third, btnH), menu: R(pad + 2 * (third + g), y, third, btnH) }; }
  }
  const y1 = topEnd + 4, y2 = bTop(bottomH) - 6;
  const field = R(0, y1, W, Math.max(60, y2 - y1));
  const tg = toggles(field, fs, tap(54), false);
  return { land: false, z, fs, cards: grid.rects, info, field, btns, demo, pad, mode: 'portrait', overflow: false, tg };
}

function landscape(z, watch, n) {
  const fs = fontsFor(z), g = 10;
  const U = { x0: host.l + 10, x1: W - host.r - 10, y0: Math.max(Math.max(host.t, 34), host.px > 0 ? Math.ceil(30 / host.px) : 0) + 4,   // below the kit's preview pill (top right)
    y1: H - Math.max(host.b, 10) };
  U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const btnH = tap(Math.round(fs.btn * 1.1 + 22)), dBtn = tap(Math.round(Math.min(fs.btn, 30) * 1.1 + 22));
  const pw = Math.min(520, (n > 2 ? 410 : 320) + Math.round(70 * (z - 1)));
  const px = U.x1 - pw, bp = host.back ? R(host.l, host.t, host.back + 8, host.back + 8) : null;
  let y = U.y0;
  if (bp && px < bp.x + bp.w) y = Math.max(y, bp.y + bp.h + 4);
  const grid = cardGrid(n, px, y, pw, fs, g, z > 1.5 || n <= 2 ? 1 : 2);
  y += grid.h + g;
  const infoH = Math.round(fs.info * (z > 1.8 ? 4.6 : 3.9) + 8);
  const info = R(px, y, pw, infoH); y += infoH + g;
  let btns = null, demo = null;
  if (watch) {
    const total = 3 * dBtn + 2 * g, y0 = Math.max(y, U.y1 - total), half = (pw - g) / 2;
    demo = { pause: R(px, y0, pw, dBtn), dec: R(px, y0 + dBtn + g, half, dBtn), inc: R(px + half + g, y0 + dBtn + g, half, dBtn), exit: R(px, y0 + 2 * (dBtn + g), pw, dBtn) };
  } else {
    const total = 3 * btnH + 2 * g, y0 = Math.max(y, U.y1 - total);
    btns = { hint: R(px, y0, pw, btnH), card: R(px, y0 + btnH + g, pw, btnH), menu: R(px, y0 + 2 * (btnH + g), pw, btnH) };
    y = y0 + total;
  }
  const overflow = (!watch && y > U.y1 + 1) || info.y + info.h > U.y1;
  const field = R(0, 0, px - 8, H);
  const tg = toggles(R(field.x, U.y0, field.w, U.h), fs, tap(54), true);
  return { land: true, z, fs, cards: grid.rects, info, field, btns, demo, pad: g, mode: 'landscape', overflow, panel: R(px, U.y0, pw, U.h), tg };
}

// The lawn filling the whole screen, behind the menus.
export function bgLayout() { return { field: R(0, 0, W, H), mode: 'bg' }; }

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
