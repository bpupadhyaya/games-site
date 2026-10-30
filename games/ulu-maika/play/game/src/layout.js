// Screen geometry as a function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
// `layoutFor(w, h)` returns every rectangle for that size, cached by size + safe-area key, so game.js (hit-testing) and
// view.js / menus.js (drawing) never disagree.
//
//   portrait  (narrower than 1.25:1): score cards on top, the scope (first-person view down the lane), the whole-course strip,
//                                     then the lean row and the ROLL pad at the bottom.
//   wide      (landscape): left column = cards, scope and strip; right column = info, lean, hint / menu and a tall ROLL pad.
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Safe areas and the host's floating back button in virtual units; main.js keeps this current (browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };   // px: css pixels per virtual unit

const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const cache = new Map();
export function layoutFor(w, h, watch = false) {
  w = Math.round(w); h = Math.round(h);
  const key = `${watch ? 'W' : 'P'}${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }, watch); L.key = key; cache.set(key, L); if (cache.size > 30) cache.delete(cache.keys().next().value); }
  return L;
}

function build(w, h, ins, watch = false) {
  const wide = w >= h * 1.25;
  const L = { w, h, wide, mode: wide ? 'wide' : 'portrait', ins };
  const backSz = ins.back ? Math.max(ins.back, 56) : 0;
  L.backBox = ins.back ? R(ins.l, ins.t, backSz + 8, backSz + 8) : R(0, 0, 0, 0);
  const liftB = Math.max(0, ins.b - 6), sb = (L.sb = h - liftB);
  const minH = Math.ceil(46 / Math.max(0.2, ins.px || 0.6));    // a tap target of about 46 css px
  const P = (L.play = {});
  const pad = 14, g = 10;
  if (!wide) {
    const lx = ins.back ? Math.max(14 + ins.l, L.backBox.x + L.backBox.w + 4) : 14 + ins.l, rx = 14 + ins.r;
    const inner = w - pad - ins.l - pad - ins.r;
    const rowH = Math.max(minH, 78), padH = clamp(Math.round(sb * 0.115), Math.max(minH, 120), 170), mapH = clamp(Math.round(w * 0.235), 150, 200);
    // Watch & Learn has no ROLL pad: the lane view takes that space (only the slim button row stays under the map)
    const barH = watch ? rowH + 2 * g : rowH + padH + 3 * g;
    const bar = sb - barH, hy = ins.t + 8, ch = 84;
    const infoW = 150, cw = Math.floor((w - lx - rx - infoW - 2 * g) / 2);
    P.cards = [R(lx, hy, cw, ch), R(w - rx - cw, hy, cw, ch)];
    P.info = { x: w / 2, y: hy + 34, y2: hy + 62 };
    const top = hy + ch + 8;
    P.map = R(pad + ins.l, bar - mapH - 6, inner, mapH);
    P.scope = R(pad + ins.l, top, inner, Math.max(180, P.map.y - 8 - top));
    const y1 = bar + g, uw = (inner - 3 * g) / 10, x0 = pad + ins.l;
    P.leanDec = R(x0, y1, uw * 2.5, rowH); P.leanShow = R(x0 + uw * 2.5 + g, y1, uw * 3.5, rowH);
    P.leanInc = R(x0 + uw * 6 + 2 * g, y1, uw * 2.5, rowH); P.hint = R(x0 + uw * 8.5 + 3 * g, y1, uw * 1.5, rowH);
    const y2 = y1 + rowH + g, mw = Math.round(inner * 0.2);   // (Watch: y2 is below the screen edge and unused)
    P.menu = R(pad + ins.l, y2, mw, padH); P.pad = R(pad + ins.l + mw + g, y2, inner - mw - g, padH);
    P.demo = { dec: P.leanDec, pause: P.leanShow, inc: P.leanInc, exit: P.hint, wide: R(pad + ins.l, y2, inner, padH) };
    P.toast = { x: w / 2, y: P.scope.y + P.scope.h * 0.2, maxW: Math.min(640, w - 40) };
    P.explain = R(P.scope.x + 8, P.scope.y + 8, P.scope.w - 16, 0);
    P.score = R(w / 2 - Math.min(330, (w - 40) / 2), top + 10, Math.min(660, w - 40), Math.min(P.scope.h + mapH, sb - top - 20));
  } else {
    const lx = ins.back ? Math.max(14 + ins.l, L.backBox.x + L.backBox.w + 4) : 14 + ins.l, rx = 14 + ins.r;
    const total = w - lx - rx, leftW = Math.round(total * 0.62), colGap = 14, rightW = total - leftW - colGap;
    const rowH = Math.max(minH, 76), hy = ins.t + 8, ch = 80, mapH = clamp(Math.round(leftW * 0.2), 120, 190);
    const infoW = 140, cw = Math.floor((leftW - infoW - 2 * g) / 2);
    P.cards = [R(lx, hy, cw, ch), R(lx + leftW - cw, hy, cw, ch)];
    P.info = { x: lx + leftW / 2, y: hy + 32, y2: hy + 58 };
    const top = hy + ch + 8;
    P.map = R(lx, sb - 8 - mapH, leftW, mapH);
    P.scope = R(lx, top, leftW, Math.max(160, P.map.y - 8 - top));
    const rxx = lx + leftW + colGap;
    P.leanDec = R(rxx, hy, Math.round(rightW * 0.24), rowH); P.leanInc = R(rxx + rightW - P.leanDec.w, hy, P.leanDec.w, rowH);
    P.leanShow = R(P.leanDec.x + P.leanDec.w + g, hy, rightW - 2 * P.leanDec.w - 2 * g, rowH);
    const y2 = hy + rowH + g, hw = (rightW - g) / 2;
    P.hint = R(rxx, y2, hw, rowH); P.menu = R(rxx + hw + g, y2, hw, rowH);
    const y3 = y2 + rowH + g;
    P.pad = R(rxx, y3, rightW, Math.max(minH + 40, sb - 8 - y3));
    P.demo = { dec: R(P.leanDec.x, hy, P.leanDec.w, rowH), pause: R(P.leanShow.x, hy, P.leanShow.w, rowH), inc: R(P.leanInc.x, hy, P.leanInc.w, rowH), exit: R(rxx, y2, rightW, rowH), wide: P.pad };
    P.toast = { x: lx + leftW / 2, y: P.scope.y + P.scope.h * 0.2, maxW: Math.min(560, leftW - 24) };
    P.explain = R(P.scope.x + 8, P.scope.y + 8, P.scope.w - 16, 0);
    const pw = clamp(w * 0.6, 460, 720), ph = Math.min(sb - 24 - ins.t, 580);
    P.score = R(w / 2 - pw / 2, ins.t + 12, pw, ph);
  }
  // the power gauge: a vertical bar down the right edge of the scope
  P.gauge = R(P.scope.x + P.scope.w - 54, P.scope.y + 14, 34, Math.max(120, P.scope.h - 28));
  // pad drag distance for full power (virtual units)
  P.padDrag = clamp(Math.round(Math.min(P.scope.h * 0.8, 360)), 160, 420);

  // ---- setup pins and reference pages -----------------------------------------------------------------------------------
  const su = (L.setup = {});
  if (!wide) {
    const sw = Math.round((w - 60) * 0.62), cw = Math.min(640, w - 80);
    L.pins = { start: R(30, sb - 124, sw, 96), back: R(30 + sw + 16, sb - 124, w - 30 - (30 + sw + 16), 96) };
    const stTop = Math.max(ins.t, 14), stBot = L.pins.start.y - 26;
    if (sb < 1150 && w >= 600) {                 // short portrait (tablets about 3:4): rivals left, courses right
      const c2 = Math.floor((Math.min(w - 40, 720) - 20) / 2), x0 = (w - (2 * c2 + 20)) / 2;
      su.cols = [{ x: x0, w: c2, top: stTop, bottom: stBot + 14 }, { x: x0 + c2 + 20, w: c2, top: stTop, bottom: stBot + 14 }];
    } else su.cols = [{ x: (w - cw) / 2, w: cw, top: stTop, bottom: stBot }];
  } else {
    const tw = Math.min(1320, w - 2 * (Math.max(ins.l, ins.r) + 16)), cw = (tw - 48) / 3, x0 = (w - tw) / 2, top = Math.max(ins.t, 0) + 18, bot = sb - 8;
    const x3 = x0 + 2 * (cw + 24), ph = 84;
    L.pins = { start: R(x3, bot - 2 * ph - 12, cw, ph), back: R(x3, bot - ph, cw, ph) };
    su.cols = [{ x: x0, w: cw, top, bottom: bot }, { x: x0 + cw + 24, w: cw, top, bottom: bot }, { x: x3, w: cw, top, bottom: L.pins.start.y - 12 }];
  }
  const ref = (L.ref = {});
  if (!wide) {
    const py = Math.max(100, ins.t + (ins.back ? backSz + 12 : 24)), navY = sb - 116, mx = 34 + Math.max(0, ins.l - 14, ins.r - 14);
    ref.panel = R(mx, py, w - 2 * mx, navY - 34 - py);
    const bw = (w - 56) / 2;
    ref.back = R(20, navY, bw, 100); ref.next = R(20 + bw + 16, navY, bw, 100);
  } else {
    const mx = Math.max(ins.l, ins.r, 0) + (ins.back ? backSz + 14 : 18), py = Math.max(ins.t, 0) + 14, nh = 72, navY = sb - 14 - nh;
    ref.panel = R(mx, py, w - 2 * mx, navY - 12 - py);
    const bw = Math.min(300, (ref.panel.w - 16) / 2);
    ref.back = R(ref.panel.x, navY, bw, nh); ref.next = R(ref.panel.x + ref.panel.w - bw, navY, bw, nh);
  }
  ref.dec = R(ref.panel.x + 12, ref.panel.y + 6, 96, 68); ref.inc = R(ref.panel.x + ref.panel.w - 108, ref.panel.y + 6, 96, 68);
  return L;
}
