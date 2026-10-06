// Geometry for every screen, as a function of the LIVE screen size (kit 1.7.1 fluid viewport: the short side is always 720 units).
// `layoutFor(w, h)` returns every rect and anchor for that size and is cached, so a frame never recomputes it.
//   portrait, h >= 1280  the approved phone composition (world scale z = 1; extra height is sky and ground).
//   portrait, h <  1280  the same composition scaled down to fit (tablets, 4:3).
//   landscape            the field is wide (z = 0.78): HUD in pills along the top and bottom, title art left + buttons right,
//                        result screen in two columns.
// Two coordinate systems: the WORLD (sky, trees, birds, sling, physics; drawn scaled by z) and the SCREEN (HUD, buttons, text).
// Pointer input arrives in screen units; the world point is (x / z, y / z).
import { SLING, V } from './tuning.js';

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Safe areas and the host's floating back button in virtual units. main.js keeps this current (browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mapRect = (f, r) => R(f.ox + r.x * f.s, f.oy + r.y * f.s, r.w * f.s, r.h * f.s);

const cache = new Map();
export function layoutFor(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }); L.key = key; cache.set(key, L); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  return L;
}

// Publishes the world geometry of layout L to the simulation (idempotent).
export function applyView(L) {
  V.WW = L.WW; V.WH = L.WH; V.z = L.z; V.hy = L.hy; V.top = L.skyTop; V.bot = L.skyBot; V.key = L.key;
  SLING.x = L.sling.x; SLING.y = L.sling.y; SLING.dragZoneTop = L.dragTop;
}

// The design frame: the original 720 x 1280 composition fitted into the portrait screen (scaled down if short, centred if tall).
function fit(w, h, ins, reserve = 0) {
  const ah = h - ins.t - ins.b - reserve;
  const s = Math.min(1, ah / 1280, w / 720);
  return { s, ox: (w - 720 * s) / 2, oy: ins.t + Math.max(0, (ah - 1280 * s) / 2) };
}

// Brand lockup size (icon edge): about 5 % of the screen height, never tiny, never loud.
export const lockupSize = (h) => clamp(Math.round(h * 0.05), 44, 76);

function build(w, h, ins) {
  const land = w >= h;
  const z = land ? 0.78 : Math.min(1, h / 1280);
  const L = { w, h, land, ins, z, WW: w / z, WH: h / z };
  L.hy = Math.round(0.617 * L.WH);
  const U = L.U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b }; U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const backSz = ins.back ? Math.max(ins.back, 56) : 0;
  L.backBox = ins.back ? R(ins.l, ins.t, backSz + 8, backSz + 8) : R(0, 0, 0, 0);
  const cxm = (U.x0 + U.x1) / 2;
  const T = Math.max(land ? 8 : 14, ins.t + 6);
  const bx = ins.back ? ins.l + backSz + 16 : land ? ins.l + 14 : 14;

  // ---- play field: sling + bird band (world units) ---------------------------------------------------------------------
  L.sling = { x: L.WW / 2, y: L.WH - 230 };
  L.dragTop = L.hy - 150;
  L.skyTop = land ? (T + 112) / z : 80 + Math.max(0, T - 14) / z;
  L.skyBot = L.hy - 150;

  // ---- HUD (screen units) ----------------------------------------------------------------------------------------------
  const hud = L.hud = { land };
  if (!land) {
    const bar = R(bx, T, w - 14 - ins.r - bx, 96);
    Object.assign(hud, { bar, score: { x: bar.x + 20, y: T + 34 }, level: { x: bar.x + 20, y: T + 72 }, quota: { x: bar.x + bar.w / 2, y: T + 32 }, combo: { x: bar.x + bar.w / 2, y: T + 70 },
      wind: { x: bar.x + bar.w - 78, y: T + 32, ly: T + 70 }, crop: R((w - 300) / 2, T + 108, 300, 18) });
  } else {
    const lp = R(bx, T, 210, 80), cp = R(cxm - 130, T, 260, 80), rp = R(U.x1 - 14 - 170, T, 170, 80);
    Object.assign(hud, { lp, cp, rp, score: { x: lp.x + 18, y: T + 32 }, level: { x: lp.x + 18, y: T + 62 }, quota: { x: cp.x + cp.w / 2, y: T + 30 }, combo: { x: cp.x + cp.w / 2, y: T + 60 },
      wind: { x: rp.x + rp.w / 2, y: T + 30, ly: T + 62 }, crop: R(cxm - 150, T + 90, 300, 16) });
  }
  const by = h - ins.b - 84;
  hud.stones = R(Math.max(14, ins.l + 14), by, 300, 64);
  L.btn = {};
  L.btn.playColors = R(w - ins.r - 124, by, 108, 64);
  L.btn.sound = R(L.btn.playColors.x - 120, by, 108, 64);
  L.btn.menu = R(L.btn.sound.x - 120, by, 108, 64);
  L.btn.zenDone = R(hud.stones.x + 182, by, 150, 64);

  // ---- title ---------------------------------------------------------------------------------------------------------
  const bs = lockupSize(h);
  L.brand = { size: bs };
  const TD = { play: R(140, 560, 440, 112), daily: R(140, 694, 440, 92), endless: R(140, 806, 215, 92), zen: R(365, 806, 215, 92), colors: R(140, 918, 440, 80), rules: R(140, 1018, 215, 80), calm: R(365, 1018, 215, 80), auto: R(140, 1118, 440, 80), soundTitle: R(610, 24, 84, 64) };
  if (!land) {
    const f = fit(w, h, ins, bs + 38);
    L.brand.x = w / 2; L.brand.y = h - Math.max(ins.b, 10) - 18 - bs; L.brand.align = 'center';
    L.title = { f, r: TD, hit: Object.fromEntries(Object.entries(TD).map(([k, r]) => [k, mapRect(f, r)])), title: { x: 360, y: 250, size: 84 }, tag: { x: 360, y: 330, size: 28 }, stats: { x: 360, y: 470, size: 26 }, sling: null };
    L.title.hit.soundTitle = R(Math.min(L.title.hit.soundTitle.x, w - ins.r - 90), Math.max(L.title.hit.soundTitle.y, ins.t + 8), L.title.hit.soundTitle.w, L.title.hit.soundTitle.h);
    L.title.r = { ...TD, soundTitle: R((L.title.hit.soundTitle.x - f.ox) / f.s, (L.title.hit.soundTitle.y - f.oy) / f.s, 84, 64) };
  } else {
    const colW = clamp(w * 0.34, 330, 470), colX = U.x1 - colW - Math.max(24, w * 0.05);
    const cxL = (U.x0 + colX) / 2, ah = U.h - 40, u = Math.min(64, (ah - 50) / 6.7);
    const hs = [1.4, 1.15, 1.15, 1, 1, 1].map((k) => Math.round(k * u)), total = hs.reduce((a, b) => a + b, 0) + 50;
    let y = U.y0 + 20 + (ah - total) / 2;
    const names = ['play', 'daily', 'endless', 'colors', 'rules', 'auto'], r = {};
    names.forEach((n, i) => { r[n] = R(colX, y, colW, hs[i]); y += hs[i] + 10; });
    r.zen = R(colX + colW / 2 + 5, r.endless.y, colW / 2 - 5, r.endless.h); r.endless = R(colX, r.endless.y, colW / 2 - 5, r.endless.h);
    r.calm = R(colX + colW / 2 + 5, r.rules.y, colW / 2 - 5, r.rules.h); r.rules = R(colX, r.rules.y, colW / 2 - 5, r.rules.h);
    r.soundTitle = R(U.x1 - 84 - 14, ins.t + 10, 84, 64);
    const tsz = Math.min(84, (colX - U.x0) * 0.17);
    L.brand.x = U.x0 + 24; L.brand.y = h - Math.max(ins.b, 10) - 16 - bs; L.brand.align = 'left';
    const f = { s: 1, ox: 0, oy: 0 };
    L.title = { f, r, hit: r, title: { x: cxL, y: h * 0.28, size: tsz }, tag: { x: cxL, y: h * 0.28 + tsz * 0.8, size: Math.max(20, tsz * 0.33) }, stats: { x: cxL, y: h * 0.28 + tsz * 1.35, size: Math.max(20, tsz * 0.31) }, sling: { x: cxL / z, y: L.sling.y } };
  }

  // ---- result (tally) -------------------------------------------------------------------------------------------------
  const chipP = (i) => R(90 + (i % 2) * 280, 892 + Math.floor(i / 2) * 72, 260, 60);
  if (!land) {
    const f = fit(w, h, ins);
    const r = { panel: R(60, 190, 600, 1060), title: { x: 360, y: 260, size: 52 }, score: { x: 360, y: 350, size: 84 }, best: { x: 360, y: 420 }, lines: { x: 360, y0: 490, dy: 44, size: 28 }, kinds: { x: 360, y: 680 },
      squares: { cx: 360, y: 730 }, msg: { x: 360, y: 828 }, more: { x: 360, y: 868 }, chips: [0, 1, 2, 3].map(chipP), again: R(140, 1040, 440, 104), share: R(90, 1156, 250, 76), home: R(380, 1156, 250, 76), badge: null };
    L.tally = { f, r, hit: { again: mapRect(f, r.again), share: mapRect(f, r.share), home: mapRect(f, r.home), chips: r.chips.map((c) => mapRect(f, c)) } };
  } else {
    const pw = Math.min(U.w - 32, 1180), px = cxm - pw / 2, py = Math.max(U.y0 + 100, 108), ph = U.y1 - 12 - py;
    const cxL = px + pw * 0.27, cxR = px + pw * 0.74, cw = Math.min(250, pw * 0.2);
    const r = { panel: R(px, py, pw, ph), title: { x: cxL, y: py + 48, size: 44 }, score: { x: cxL, y: py + 124, size: 76 }, best: { x: cxL, y: py + 184 }, lines: { x: cxL, y0: py + 240, dy: 38, size: 26 }, kinds: { x: cxL, y: py + 400 },
      squares: { cx: cxL, y: py + 428 }, msg: { x: cxL, y: py + ph - 56 }, more: { x: cxR, y: py + 44 }, chips: [0, 1, 2, 3].map((i) => R(cxR - cw - 6 + (i % 2) * (cw + 12), py + 72 + Math.floor(i / 2) * 68, cw, 58)),
      again: R(cxR - 200, py + 232, 400, 92), share: R(cxR - 200, py + 344, 194, 68), home: R(cxR + 6, py + 344, 194, 68), badge: { x: px + pw - 30 - 22, y: py + ph - 22 - 30, size: 44 } };
    L.tally = { f: { s: 1, ox: 0, oy: 0 }, r, hit: { again: r.again, share: r.share, home: r.home, chips: r.chips } };
  }

  // ---- Level clear / preview limit panels: centred whatever the shape ---------------------------------------------------
  L.centerFrame = { s: 1, ox: w / 2 - 360, oy: h / 2 - 590 };

  // ---- Rules reference ---------------------------------------------------------------------------------------------------
  {
    const T0 = Math.max(land ? 8 : 14, ins.t + (land ? 6 : 8)), barH = land ? ins.b + 90 : ins.b + 110;
    const cw = land ? Math.min(U.w - 40, 1180) : w - 60, cx = land ? cxm - cw / 2 : 30;
    const card = R(cx, T0, cw, h - T0 - barH);
    const hdr = land ? { sepY: 72, titleCY: 108, vpTop: 84, foot: 44 } : { sepY: 94, titleCY: 138, vpTop: 106, foot: 56 };
    const inc = R(card.x + card.w - 24 - 96, card.y + (land ? 8 : 16), 96, 56), dec = R(inc.x - 12 - 96, inc.y, 96, 56);
    const vp = R(card.x + 8, card.y + hdr.vpTop, card.w - 16, card.h - hdr.vpTop - hdr.foot);
    const bw = land ? 240 : 250, bh = land ? 64 : 76, byy = h - ins.b - (land ? 78 : 96);
    L.rules = { card, hdr, headerY: card.y + (land ? 38 : 54), dec, inc, viewport: vp, textW: Math.min(vp.w - 70, 860), cx: card.x + card.w / 2, scrollbar: R(card.x + card.w - 22, vp.y + 6, 10, vp.h - 12),
      counterY: card.y + card.h - hdr.foot / 2 - 2, back: land ? R(cxm - bw - 10, byy, bw, bh) : R(90 + (w - 720) / 2, byy, bw, bh), next: land ? R(cxm + 10, byy, bw, bh) : R(380 + (w - 720) / 2, byy, bw, bh) };
  }

  // ---- Auto Play control band ---------------------------------------------------------------------------------------------
  // Compact banner (one text line + one row of controls), capped in width, always BELOW the HUD (score / level / quota / wind + crop bar)
  // and below the host back disc, so it never hides the score or level.
  {
    const y0 = hud.crop.y + hud.crop.h + 10, bw2 = Math.min(U.w - 20, land ? 760 : 700), x0 = cxm - bw2 / 2, mid = cxm, by2 = y0 + 40;
    const row = 112 * 3 + 8 * 2 + 28 + 54 + 8 + 150 + 8 + 54, sx = mid - row / 2;
    L.ap = { band: R(x0, y0, bw2, 96), head: { x: mid, y: y0 + 20 }, status: { x: mid, y: y0 + 20 }, exit: R(sx, by2, 112, 46), pause: R(sx + 120, by2, 112, 46), skip: R(sx + 240, by2, 112, 46),
      dec: R(sx + 380, by2, 54, 46), inc: R(sx + row - 54, by2, 54, 46), think: { x: sx + 380 + 54 + 8 + 75, y: by2 + 23 }, hint: { x: mid, y: y0 + 64 } };
  }
  return L;
}
