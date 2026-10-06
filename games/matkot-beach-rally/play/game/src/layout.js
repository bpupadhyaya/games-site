// Screen geometry for every screen as a pure function of the LIVE screen size (kit fluid viewport: the short side is always 720
// units, the long side grows with the aspect ratio). `layoutFor(w, h)` returns every rectangle and anchor, cached by size + host
// insets, so game.js (hit-testing) and view.js / menus.js (drawing) never disagree.
//   tall   (h / w >= 1.3: phones and tablets in portrait): the approved phone look. The camera scales down on short screens and the
//          extra height of tall phones becomes sky/sea above and sand below. HUD sits in the top band, as before.
//   wide   (everything else: landscape, squarish windows): a left HUD column, the court centred in the rest of the screen, the beach
//          art filling the whole canvas (no bars). Pause / hint sit top right.
// The kit draws its preview badge at top centre (y 6..34): the HUD stays clear of it. When the host app floats a back button
// (host.back > 0) the top-left corner stays clear; standalone builds (host.back = 0) use it.
import { setCam, CAM0 } from './cam.js';

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Safe areas and the host's floating back button in virtual units. main.js keeps this current (browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 1 };

const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const FK = 15.5 * (1 / 10 - 1 / 22);   // depth extent of the court on screen = FK * F (near baseline to far baseline)

const cache = new Map();
let cur = null;
export function layoutFor(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }); L.key = key; cache.set(key, L); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  return L;
}
// Makes layout L the live one (camera + W/H bindings). Returns it. Idempotent.
export function syncLayout(w, h) {
  const L = layoutFor(w, h);
  if (L !== cur) { cur = L; setCam(L.cam, L.w, L.h); }
  return L;
}
export const liveLayout = () => cur ?? syncLayout(720, 1280);

function build(w, h, ins) {
  const wide = h / w < 1.3;
  const L = { w, h, wide, ins };
  const backSz = ins.back ? Math.max(ins.back, 56) : 0;
  L.backBox = ins.back ? R(ins.l, ins.t, backSz + 8, backSz + 8) : R(0, 0, 0, 0);
  const sl = Math.max(14, ins.l + 10), sr = Math.max(14, ins.r + 10), sb = Math.max(14, ins.b + 10);
  const topY = Math.max(14, ins.t + 10);
  L.safe = { l: sl, r: sr, b: sb, t: topY };

  if (!wide) {
    // ---- tall ------------------------------------------------------------------------------------------------------------
    const s = Math.min(1, h / 1280), extra = Math.max(0, h - 1280 * s), oy = extra * 0.5;
    L.s = s;
    L.cam = { F: CAM0.F * s, D: CAM0.D, CH: CAM0.CH, HZ: CAM0.HZ * s + oy, cx: w / 2 };
    L.horizon = 232 * s + oy; L.shore = 326 * s + oy;
    const top = Math.max(46, ins.t + 14), dy = top - 46;
    L.hudDy = dy + 8; L.hudTop = top;
    const lx = ins.back ? ins.l + backSz + 22 : sl + 4;
    L.pause = R(lx, top, 82, 82);
    L.hint = R(w - sr - 82 - 4, top, 82, 82);
    L.wind = { x: w - 58 - Math.max(0, ins.r - 4), y: 256 + dy };
    L.windWatch = { x: w - 70 - Math.max(0, ins.r - 4), y: 170 + dy };
    const x0 = Math.max(20, ins.l + 14), x1 = w - Math.max(20, ins.r + 14), bw = x1 - x0;
    const by = h - 130 - Math.max(0, ins.b - 10);
    L.watch = {
      dec: R(x0, by, 150, 84), pause: R(x0 + 164, by, bw - 328, 84), inc: R(x1 - 150, by, 150, 84), exit: R(x0, by - 98, 150, 84), label: { x: w / 2, y: by + 112 },
    };
    L.think = R(Math.max(12, ins.l + 8), 132 + dy, Math.min(672, w - Math.max(24, ins.l + ins.r + 16)), 218);
    L.bannerCx = w / 2; L.bannerW = Math.min(600, w - 40); L.bannerY = Math.round(L.horizon + 88 * s);
    L.toast = { x: w / 2, y: h - 270 - Math.max(0, ins.b - 10) };
    L.tip = R(w / 2 - 300, h - 84 - Math.max(0, ins.b - 10), 600, 48);
    L.scoreCx = w / 2;
  } else {
    // ---- wide ------------------------------------------------------------------------------------------------------------
    const pw = clamp(Math.round(w * 0.29), 250, 360);
    const lcY = ins.back ? ins.t + backSz + 14 : topY;
    L.lc = R(sl, lcY, pw - sl - 8, h - lcY - sb);
    const regionX0 = pw, regionX1 = w - sr, regionW = regionX1 - regionX0;
    const cx = regionX0 + regionW / 2;
    const yN = h - Math.max(26, ins.b + 14);
    const Fw = (regionW - 36) / 0.84;
    const yFmin = Math.max(190, ins.t + 150);
    const F = Math.min(Fw, (yN - yFmin) / FK);
    const yF = yN - FK * F;
    L.s = F / CAM0.F;
    L.cam = { F, D: CAM0.D, CH: CAM0.CH, HZ: yN - CAM0.CH * F / CAM0.D, cx };
    L.horizon = Math.max(54, yF * 0.4); L.shore = Math.max(110, yF * 0.74);
    L.courtCx = cx; L.region = R(regionX0, 0, regionW, h);
    L.hudDy = 0; L.hudTop = lcY;
    L.hint = R(w - sr - 82, topY, 82, 82);
    L.pause = R(L.hint.x - 12 - 82, topY, 82, 82);
    L.wind = { x: w - sr - 44, y: topY + 82 + 44 };
    const lc = L.lc;
    // Watch & Learn controls sit top right (that corner is free: no pause / hint in Auto Play); the left column keeps the score and the thinking card.
    const cw = 190, cx0 = w - sr - cw;
    L.watch = {
      pause: R(cx0, topY, cw, 82), dec: R(cx0, topY + 90, (cw - 8) / 2, 82), inc: R(cx0 + (cw + 8) / 2, topY + 90, (cw - 8) / 2, 82),
      exit: R(cx0, topY + 180, cw, 82), label: { x: lc.x + lc.w / 2, y: lc.y + 110 + 30 },
    };
    L.windWatch = { x: cx0 + cw / 2, y: topY + 262 + 40 };
    L.hudH = { coop: 268, match: 122, watch: 176 };
    L.think = R(lc.x, lc.y + 276, lc.w, h - sb - (lc.y + 276));   // y is re-set per mode by thinkRect()
    L.bannerCx = cx; L.bannerW = Math.min(600, regionW - 24); L.bannerY = Math.round(h * 0.36);
    L.toast = { x: cx, y: 54 };
    L.tip = R(lc.x, h - sb - 92, lc.w, 84);
    L.scoreCx = lc.x + lc.w / 2;
  }
  L.thinkRect = (mode) => {
    if (!wide) return L.think;
    const y = L.lc.y + L.hudH[mode === 'coop' ? 'coop' : mode === 'watch' ? 'watch' : 'match'] + 8;
    return R(L.lc.x, y, L.lc.w, Math.max(120, h - L.safe.b - y));
  };

  // ---- flows (title, setup, settings, result, demo limit, pause): a centred column, two columns in wide mode -----------------------
  const colW = Math.min(640, w - 2 * Math.max(40, Math.max(ins.l, ins.r) + 20));
  L.flow = { top: Math.max(0, ins.t) + (ins.back && !wide ? backSz + 10 : 0), bottom: h - ins.b, x0: (w - colW) / 2, w0: colW };
  const gap = 36, wideW = Math.min(1500, w - 2 * Math.max(30, Math.max(ins.l, ins.r) + 18));
  L.cols = { x: (w - wideW) / 2, w: wideW, gap, lw: (wideW - gap) / 2 };
  // ---- setup pins ------------------------------------------------------------------------------------------------------------
  if (!wide) {
    const sx = Math.max(30, ins.l + 16), ex = w - Math.max(30, ins.r + 16), tw = ex - sx, y = h - 124 - Math.max(0, ins.b - 10);
    L.pins = { start: R(sx, y, tw - 216, 96), back: R(sx + tw - 204, y, 204, 96) };
    L.setupBottom = y - 26;
  } else {
    const y = h - 96 - Math.max(0, ins.b - 6), sw = 340, bw = 170;
    L.pins = { start: R(w / 2 - (sw + bw + 16) / 2, y, sw, 82), back: R(w / 2 - (sw + bw + 16) / 2 + sw + 16, y, bw, 82) };
    L.setupBottom = y - 14;
  }
  // ---- reference reader (About / How to Play / Rules): one scrolling card ---------------------------------------------------------
  {
    const T0 = Math.max(14, ins.t + 8), barH = (wide ? 104 : 112) + ins.b;
    const cw = Math.min(wide ? 900 : w - 36, w - 2 * Math.max(16, Math.max(ins.l, ins.r) + 8));
    const cxm = w / 2, card = R(cxm - cw / 2, T0, cw, h - T0 - barH);
    const hdrH = 96;
    const inc = R(card.x + card.w - 20 - 92, card.y + 6, 92, 82), dec = R(inc.x - 82 - 92, card.y + 6, 92, 82);
    const vp = R(card.x + 6, card.y + hdrH, card.w - 12, card.h - hdrH - 10);
    const bh = 84, byy = h - ins.b - (wide ? 94 : 100);
    L.ref = { card, hdrH, title: { x: ins.back && L.backBox.y + L.backBox.h > card.y && L.backBox.x + L.backBox.w > card.x + 8 ? Math.max(card.x + 28, L.backBox.x + L.backBox.w + 10) : card.x + 28, y: card.y + 54 }, dec, inc, pct: { x: (dec.x + dec.w + inc.x) / 2, y: card.y + 48 }, viewport: vp, textW: Math.min(vp.w - 64, 760), cx: vp.x + vp.w / 2,
      scrollbar: R(card.x + card.w - 14, vp.y + 6, 8, vp.h - 12), close: R(cxm - Math.min(170, cw / 2), byy, Math.min(340, cw), bh) };
  }
  L.brand = { size: clamp(Math.round(h * 0.05), 40, 64) };
  return L;
}
