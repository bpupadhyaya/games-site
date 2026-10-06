// Geometry, as a function of the LIVE screen size (kit 1.7.x fluid viewport: the SHORT side is always 720 units).
// `layoutFor(w, h)` returns every rectangle for that size (cached by size + insets). Two shapes:
//   portrait  w = 720, h = 960..1728. Header on top, north seat, the table plays, then the action zone (panel / TRUCO button),
//             your hand and the button bar at the bottom. A single factor f (0 = a 4:3 tablet, 1 = a tall phone) interpolates
//             every height, so tablets, small phones and tall phones all keep the approved phone look in proportion.
//   wide      h = 720, w >= 720. Left card: score / stake / vira / tricks. Centre: the table with your hand at the bottom.
//             Right card: Menu / Hint / Signal, and below them TRUCO or the answer buttons (a tall column, easy for a thumb).
export const CW = 150, CH = 210;
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const AUTO_THINK_STEPS = [2, 5, 8, 10];
export const AUTO_REVEAL_SECS = 2;
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
// px = css pixels per virtual unit: text never goes below ~11 css px, so minFont = 11 / px units.
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

const cache = new Map();
export function layoutFor(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}|${Math.round(host.px * 100)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }); L.key = key; cache.set(key, L); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  return L;
}

function build(w, h, ins) {
  const land = w > h;
  const U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b }; U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const back = ins.back > 0, bsz = Math.max(ins.back, 56);
  const bb = back ? R(ins.l, ins.t, bsz + 8, bsz + 8) : R(0, 0, 0, 0);
  const bgap = Math.max(6, 12 / Math.max(0.3, ins.px));   // ~12 css px of air between the host back disc and anything beside / below it
  const L = { w, h, land, mode: land ? 'wide' : 'portrait', ins, U, backBox: bb, back, minFont: Math.max(8, 11 / Math.max(0.15, ins.px)) };
  const A = U.h, f = land ? 1 : clamp((A - 960) / 600, 0, 1), lp = (a, b) => a + (b - a) * f;
  L.f = f;

  // ---- text-zoom pills: top right (the top left belongs to the host's back button) ----------------------------------------
  const pw0 = 112, ph0 = 64;
  L.inc = R(U.x1 - 12 - pw0, U.y0 + 14, pw0, ph0);
  L.dec = R(L.inc.x - 8 - pw0, U.y0 + 14, pw0, ph0);
  L.pct = { x: L.dec.x - 12, y: U.y0 + 14 + 42 };

  // ---- reference pages (About / How to Play / Rules) ----------------------------------------------------------------------
  {
    const pw = Math.min(w - 40, 860), px = (w - pw) / 2, bh = land ? 76 : lp(76, 104), bw = Math.min(330, (pw - 16) / 2);
    const rb = U.y1 - 14 - bh;
    L.refBack = R(w / 2 - bw - 8, rb, bw, bh); L.refNext = R(w / 2 + 8, rb, bw, bh);
    let py = U.y0 + 96;
    if (back && px < bb.x + bb.w) py = Math.max(py, bb.y + bb.h + 4);
    L.refPanel = R(px, py, pw, rb - 12 - py);
  }
  // ---- settings -----------------------------------------------------------------------------------------------------------
  {
    const bh = land ? 76 : 84, by = U.y1 - 14 - bh, pw = Math.min(w - 40, 760);
    L.back = R(w / 2 - 165, by, 330, bh);
    const ry = U.y0 + 130;
    L.settings = { titleY: U.y0 + 92, region: R((w - pw) / 2, ry, pw, by - 12 - ry) };
  }
  // ---- overlays: match over, hand summary, preview ended ------------------------------------------------------------------
  {
    if (!land) {
      const bH = lp(80, 104), b2H = lp(72, 90), by = U.y1 - lp(16, 100) - bH;
      L.ov = { btn: R(w / 2 - 200, by, 400, bH), btn2: R(w / 2 - 200, by - 14 - b2H, 400, b2H) };
      const x = 10, y = U.y0 + (back ? 118 : 96);
      L.ov.box = { x: 30, y, w: w - 60 }; L.ov.boxBottom = L.ov.btn.y - 12; L.ov.boxBottom2 = L.ov.btn2.y - 12;
      L.ov.content = R(x, y, w - 20, L.ov.btn2.y - 12 - y);
      L.ov.cx = w / 2;
    } else {
      const bw = 360, bx = U.x1 - 20 - bw;
      L.ov = { btn: R(bx, h / 2 + 10, bw, 96), btn2: R(bx, h / 2 - 100, bw, 90) };
      const x0 = back ? bb.x + bb.w + 8 : U.x0 + 12, y = U.y0 + 24;
      L.ov.box = { x: x0, y, w: bx - 20 - x0 }; L.ov.boxBottom = U.y1 - 12; L.ov.boxBottom2 = U.y1 - 12;
      L.ov.content = R(x0, y, bx - 20 - x0, U.y1 - 12 - y);
      L.ov.cx = x0 + (bx - 20 - x0) / 2;
    }
  }

  // ====================================================================================================================
  // THE TABLE
  // ====================================================================================================================
  const T = L.t = {};
  const BTNH = land ? 56 : lp(58, 86);
  if (!land) {
    const top = U.y0 + (Math.max(back ? 4 : lp(8, 40), Math.min(60, Math.ceil(6 / Math.max(0.3, ins.px) + 1.7 * Math.max(16, 11.5 / Math.max(0.3, ins.px)) + 3))));   // clear of the kit's preview clock (top centre)
    const r1h = lp(56, 84), g1 = lp(6, 12), r2h = lp(84, 96);
    const x0 = back ? bb.x + bb.w + 6 : Math.max(24, U.x0 + 12), x1 = w - Math.max(24, ins.r + 12);
    const stakeW = clamp((x1 - x0) * 0.3, 140, 208), gp = 10, pw = (x1 - x0 - stakeW - 2 * gp) / 2;
    T.usPlate = R(x0, top, pw, r1h); T.stake = R(x0 + pw + gp, top - 4, stakeW, r1h + 8); T.themPlate = R(x0 + pw + gp + stakeW + gp, top, pw, r1h);
    let y2 = top + r1h + g1; if (back) y2 = Math.max(y2, bb.y + bb.h + bgap);
    const xr0 = 24, xr1 = w - 24, vw = Math.round((xr1 - xr0 - 16) * 352 / 656);
    T.vira = R(xr0, y2, vw, r2h); T.tricks = R(xr0 + vw + 16, y2, xr1 - xr0 - vw - 16, r2h);
    const hb = y2 + r2h;
    // bottom
    const barY = U.y1 - lp(8, 22) - BTNH, bw3 = (w - 48 - 72) / 3;
    T.btn = { hint: R(24, barY, bw3, BTNH), sig: R(24 + bw3 + 36, barY, bw3, BTNH), menu: R(24 + 2 * (bw3 + 36), barY, bw3, BTNH) };
    const hs = lp(0.78, 1), LIFT = lp(30, 46), handY = barY - LIFT - CH * hs;
    T.hs = hs; T.LIFT = LIFT; T.handY = handY; T.hcx = w / 2; T.handW = w - 40;
    const panelH = lp(150, 224), panelY = handY - panelH;
    T.panel = R(16, panelY, w - 32, panelH);
    const aH = lp(72, 104), ay = panelY + panelH - lp(10, 14) - aH, abw = (w - 56 - 34) / 3;
    T.ans = [0, 1, 2].map((i) => R(28 + i * (abw + 17), ay, abw, aH));
    const cbw = (w - 60 - 28) / 2;
    T.act = { a: R(30, ay, cbw, aH), b: R(30 + cbw + 28, ay, cbw, aH) };
    const gridTop = panelY + lp(44, 64), gh = (panelY + panelH - 6 - gridTop - 8) / 2, sbw = (w - 60 - 18) / 2;
    T.sigpop = [0, 1, 2, 3].map((i) => R(30 + (i % 2) * (sbw + 18), gridTop + Math.floor(i / 2) * (gh + 8), sbw, gh));
    T.sigclose = R(w - 16 - 104, panelY, 104, 40);
    T.panelText = { x: w / 2, y: panelY + lp(28, 38), w: w - 80, size: 23, lh: 28, wrap: false };
    const tH = lp(66, 84); T.truco = R(w / 2 - 210, handY - LIFT - 4 - tH, 420, tH);
    T.prompt = { x: w / 2, y: handY - 14, yNoTruco: handY - 46, w: w - 60, size: 24, wrap: false };
    // north seat, side seats
    const nsc = lp(0.38, 0.5), nTop = hb + lp(70, 76), plateH = lp(34, 40), nCH = CH * nsc;
    T.nsc = nsc; T.nTop = nTop;
    const plateNy = nTop + nCH + 16;
    T.plateN = R(w / 2 - 80, plateNy, 160, plateH);
    const tz0 = plateNy + plateH + 14 + 22, tz1 = panelY + lp(30, 33), zone = tz1 - tz0;
    const pr = lp(0.72, 0.925), tsc = clamp(zone * 0.97 / (2 * pr + 1) / CH, 0.3, 0.757), ch = CH * tsc, cw = CW * tsc;
    const pV = pr * ch, pH = Math.max(pV, cw * 1.15), cx = w / 2, cy = tz0 + zone / 2 + lp(0, 36);
    Object.assign(T, { cx, cy, tsc, pV, pH });
    const fx0 = Math.max(28, U.x0 + 26); T.felt = R(fx0, tz0 + 2, w - 2 * fx0, cy + pV + ch / 2 + lp(26, 37) - tz0 - 2);
    T.winY = cy + pV + ch / 2 + 24; T.thinkY = T.winY - 14;
    const plateSy = tz0 + lp(26, 30), feltBot = T.felt.y + T.felt.h - 12, psc = clamp((feltBot - (plateSy + plateH + 16)) / 386 / 1, 0.16, nsc);
    const sCH = CH * psc, sCW = CW * psc, sideCx = fx0 + 16 + sCH / 2, pw2 = lp(100, 116);
    const yc0 = plateSy + plateH + 16 + sCH / 2, sstep = 88 * psc;
    const eCx = w - sideCx;
    T.side = { w: R(Math.max(fx0 + 12, sideCx - pw2 / 2), plateSy, pw2, plateH), e: R(Math.min(w - fx0 - 12 - pw2, eCx - pw2 / 2), plateSy, pw2, plateH), cxW: sideCx, cxE: eCx, yc0, step: sstep, sCW, sCH };
    T.nStep = 68 * nsc;
    T.seat = [{ x: w / 2, y: handY + CH * hs / 2 }, { x: T.side.cxE, y: yc0 + sstep }, { x: cx, y: nTop + nCH / 2 }, { x: T.side.cxW, y: yc0 + sstep }];
    T.trick = [{ x: cx, y: cy + pV }, { x: cx + pH, y: cy }, { x: cx, y: cy - pV }, { x: cx - pH, y: cy }];
    T.deck = { x: cx, y: cy - 38 };
    T.bub = [{ x: w / 2 + 210, y: panelY + lp(46, 60) }, { x: w / 2 + 180, y: cy - 88 }, { x: w / 2 + 180, y: nTop + lp(45, 60) }, { x: w / 2 - 180, y: cy - 88 }];
    T.banner = { x: cx, y: cy - 78, s: Math.min(1, (w - 40) / 660) };
    T.burst = { x: cx, y: cy }; T.burst2 = { x: cx, y: handY };
    T.toast = R(Math.max(24, (w - 640) / 2), hb + 8, Math.min(640, w - 48), lp(54, 66));
    const abH = lp(58, 66); T.auto = { bar: R(24, hb + 6, w - 48, abH), narrow: false };
    T.auto.inc = R(T.auto.bar.x + T.auto.bar.w - 12 - 60, T.auto.bar.y + (abH - 44) / 2, 60, 44);
    T.auto.dec = R(T.auto.inc.x - 8 - 60, T.auto.inc.y, 60, 44);
    T.auto.pausedY = T.auto.bar.y - 6; T.auto.pausedX = w / 2;
  } else {
    // ---------------- wide ----------------------------------------------------------------------------------------
    const g = 10, colW = clamp((U.w - 540) / 2, 160, 260);
    const lc = { x: U.x0 + 8, w: colW }, rc = { x: U.x1 - 8 - colW, w: colW };
    const RIM = 22, GUT = 16, C = { x0: lc.x + colW + RIM + GUT, x1: rc.x - RIM - GUT }; C.w = C.x1 - C.x0; const cx = (C.x0 + C.x1) / 2;
    const ly = back ? bb.y + bb.h + bgap : U.y0 + 10, barH = 100, avail = U.y1 - 10 - ly - barH - 8;
    const base = [64, 64, 78, 124, 84], gaps = 8 * 4, k = Math.min(1, Math.max(0.8, (avail - gaps) / base.reduce((a, b) => a + b, 0)));
    let yy = ly; const hh = base.map((v) => v * k), nx = [];
    for (let i = 0; i < 5; i++) { nx.push(R(lc.x, yy, colW, hh[i])); yy += hh[i] + 8; }
    [T.usPlate, T.themPlate, T.stake, T.vira, T.tricks] = nx;
    T.auto = { bar: R(lc.x, U.y1 - 10 - barH, colW, barH), narrow: true };
    T.auto.inc = R(lc.x + colW - 12 - 56, T.auto.bar.y + barH - 46, 56, 38); T.auto.dec = R(T.auto.inc.x - 8 - 56, T.auto.inc.y, 56, 38);
    const top = U.y0 + 10, bh = 56;
    T.btn = { menu: R(rc.x, top, colW, bh), hint: R(rc.x, top + bh + 8, colW, bh), sig: R(rc.x, top + 2 * (bh + 8), colW, bh) };
    const azY = top + 3 * (bh + 8) + 8, azH = U.y1 - 10 - azY;
    T.panel = R(rc.x, azY, colW, azH);
    T.truco = R(rc.x, U.y1 - 10 - 96, colW, 96);
    T.prompt = { x: rc.x + colW / 2, y: T.truco.y - 12, yNoTruco: T.truco.y - 12, w: colW - 8, size: 22, wrap: true, up: true };
    const pTextH = 118, abh = clamp((azH - pTextH - 24) / 3, 54, 84);
    T.ans = [0, 1, 2].map((i) => R(rc.x + 6, azY + pTextH + i * (abh + 8), colW - 12, abh));
    T.act = { a: R(rc.x + 6, azY + pTextH, colW - 12, abh + 10), b: R(rc.x + 6, azY + pTextH + abh + 18, colW - 12, abh + 10) };
    const sTop = azY + 62, sClose = 44, sh = clamp((azH - 62 - sClose - 8 * 5) / 4, 54, 82);
    T.sigpop = [0, 1, 2, 3].map((i) => R(rc.x + 6, sTop + i * (sh + 8), colW - 12, sh));
    T.sigclose = R(rc.x + 6, U.y1 - 10 - 6 - sClose, colW - 12, sClose);
    T.panelText = { x: rc.x + colW / 2, y: azY + 28, w: colW - 20, size: 22, lh: 26, wrap: true };
    const nsc = 0.4, nTop = U.y0 + 12, nCH = CH * nsc; T.nsc = nsc; T.nTop = nTop;
    const plateH = 34, plateNy = nTop + nCH + 16; T.plateN = R(cx - 70, plateNy, 140, plateH);
    const hs = 0.8, LIFT = 30, handY = U.y1 - 8 - CH * hs;
    T.hs = hs; T.LIFT = LIFT; T.handY = handY; T.hcx = cx; T.handW = C.w - 16;
    const tz0 = plateNy + plateH + 14 + RIM, tz1 = handY - LIFT - 4, zone = tz1 - tz0, pr = 0.85;
    const tsc = clamp(zone * 0.97 / (2 * pr + 1) / CH, 0.38, 0.7), ch = CH * tsc, cw = CW * tsc, pV = pr * ch;
    const pH = Math.max(pV, clamp(C.w * 0.16, 0, 190), cw * 1.15), cy = tz0 + zone / 2;
    Object.assign(T, { cx, cy, tsc, pV, pH });
    T.felt = R(C.x0, tz0 - 4, C.w, cy + pV + ch / 2 + 22 - tz0 + 4);
    T.winY = cy + pV + ch / 2 + 24; T.thinkY = T.winY - 14;
    const room = (cx - pH - cw / 2 - 8) - (C.x0 + 18);
    const feltBot = T.felt.y + T.felt.h - 12, plateSy0 = tz0 + 16 + plateH + 16, sns = clamp(Math.min(nsc, room / CH, (feltBot - plateSy0) / 386), 0.2, nsc), sCH = CH * sns, sCW = CW * sns;
    const sideCx = C.x0 + 18 + sCH / 2, plateSy = tz0 + 16, sw = 92, yc0 = plateSy + plateH + 16 + sCH / 2;
    const sideE = C.x1 - 18 - sCH / 2;
    T.side = { w: R(Math.max(C.x0 + 12, sideCx - sw / 2), plateSy, sw, plateH), e: R(Math.min(C.x1 - 12 - sw, sideE - sw / 2), plateSy, sw, plateH), cxW: sideCx, cxE: sideE, yc0, step: 88 * sns, sCW, sCH };
    T.nStep = 68 * nsc;
    T.seat = [{ x: cx, y: handY + CH * hs / 2 }, { x: T.side.cxE, y: yc0 + T.side.step }, { x: cx, y: nTop + nCH / 2 }, { x: T.side.cxW, y: yc0 + T.side.step }];
    T.trick = [{ x: cx, y: cy + pV }, { x: cx + pH, y: cy }, { x: cx, y: cy - pV }, { x: cx - pH, y: cy }];
    T.deck = { x: cx, y: cy - 38 };
    T.bub = [{ x: cx + 110, y: handY - LIFT - 6 }, { x: cx + pH + 20, y: cy - 80 }, { x: cx + 120, y: nTop + 50 }, { x: cx - pH - 20, y: cy - 80 }];
    T.banner = { x: cx, y: cy - 60, s: Math.min(1, (C.w - 16) / 660, zone / 200) };
    T.burst = { x: cx, y: cy }; T.burst2 = { x: cx, y: handY };
    T.toast = R(C.x0 + 8, U.y0 + 8, C.w - 16, 56);
    T.auto.pausedY = tz0 + 16; T.auto.pausedX = cx;
    T.C = C;
    T.previewBadge = { x: cx - CW * nsc / 2 - 68 * nsc * 2 - 24, y: U.y0 + 8, align: 'right' };   // park the kit's preview clock beside the partner's cards, not on them
  }
  T.handSlot = (i, n) => {
    const hcw = CW * T.hs, step = n <= 1 ? 0 : Math.min(1.226 * hcw, (T.handW - hcw) / (n - 1)), total = hcw + step * (n - 1);
    return { x: T.hcx - total / 2 + step * i, y: T.handY, step };
  };
  return L;
}

// ---- title screen -----------------------------------------------------------------------------------------------------
// rows + header positions for the current size; cached per layout object and per "has a saved match".
export function titleFor(L, hasSave) {
  const ck = hasSave ? 'tS' : 'tN';
  if (L[ck]) return L[ck];
  const { w, U, f, land } = L, lp = (a, b) => a + (b - a) * f, o = {};
  // Arcforge lockup under the last menu row (>= ~125 css px wide, aspect 1200:327); its tap zone is padded to >= 44 css px
  const lkw = Math.max(240, 125 / Math.max(0.2, L.ins.px || 0.6)), lh = Math.round(lkw * 327 / 1200);
  const tapOf = (k) => { const m = 44 / Math.max(0.2, L.ins.px || 0.6), tw = Math.max(lkw + 24, m), th = Math.max(k.h + 12, m); return R(k.cx - tw / 2, k.y - 4, tw, Math.max(th, k.h + 8)); };
  if (!land) {
    const x = w / 2 - 270, rw = 540, ph = lp(84, 104), rh = lp(76, 92), g = lp(8, 14), segH = lp(56, 68), segG = lp(8, 12), duoH = lp(68, 80), triH = lp(68, 80);
    const total = (hasSave ? rh + 12 : 0) + ph + g + 3 * (segH + segG) + 6 + duoH + 12 + triH;
    const rowsBottom = U.y1 - Math.max(lp(110, 190), lh + 64), rowsTop = rowsBottom - total;
    let y = rowsTop; const row = (hgt, gap) => { const r = R(x, y, rw, hgt); y += hgt + gap; return r; };
    if (hasSave) o.resume = row(rh, 12);
    o.play = row(ph, g);
    const seg = (n) => { const rs = []; for (let i = 0; i < n; i++) rs.push(R(x + i * ((rw - (n - 1) * 12) / n + 12), y, (rw - (n - 1) * 12) / n, segH)); y += segH + segG; return rs; };
    o.variant = seg(2); o.players = seg(2); o.level = seg(3); y += 6;
    const half = (rw - 12) / 2, third = (rw - 24) / 3;
    o.how = R(x, y, half, duoH); o.rules = R(x + half + 12, y, half, duoH); y += duoH + 12;
    o.about = R(x, y, third, triH); o.settings = R(x + third + 12, y, third, triH); o.auto = R(x + 2 * (third + 12), y, third, triH);
    o.lockup = { cx: w / 2, y: rowsBottom + 10, h: lh, w: lkw };
    o.blurbY = o.lockup.y + lh + 30; o.blurbX = w / 2; o.blurbW = w - 40;
    const room = rowsTop - U.y0, tt = Math.max(0, Math.min(1, (room - 400) / 420)), q = (a, b) => a + (b - a) * tt, sq = room < 412 ? room / 412 : 1;
    const extra = Math.max(0, U.h - 1560) * 0.3, sk = sq < 1 ? Math.max(0.8, sq) : 1;
    o.hd = { mode: 'p', cx: w / 2, aw: w, titleSize: Math.max(90, q(112, 190) * sk), titleY: U.y0 + (q(160, 262) + extra) * sq, ribbonY: U.y0 + (q(196, 318) + extra) * sq, ribbonH: q(36, 56), ribbonW: q(380, 500),
      tagY: U.y0 + (q(244, 394) + extra) * sq, fanY: U.y0 + (q(306, 600) + extra) * sq, fanS: Math.max(0.36, q(0.42, 1) * sk), fanGap: q(54, 120), subY: U.y0 + (q(384, 790) + extra) * sq };
    // the fanned cards (the outer two sit lower and tilt) must end above the line of text under them
    o.hd.fanS = Math.max(0.3, Math.min(o.hd.fanS, (o.hd.subY - 26 - o.hd.fanY) / (CH * 0.5 + 42)));
  } else {
    const pw = clamp(w * 0.4, 400, 520), x = U.x1 - pw - 20, ph = 88, rh = 76, segH = 58, duoH = 70, triH = 70;
    let total = (hasSave ? rh + 10 : 0) + ph + 12 + 3 * (segH + 10) + 6 + duoH + 10 + triH + 36 + lh + 14;
    const topMin = U.y0 + 92, availH = U.y1 - 8 - topMin, kk = Math.min(1, availH / total);
    const s = (v) => v * kk; total *= kk;
    let y = topMin + Math.max(0, (availH - total) / 2); const rw = pw;
    const row = (hgt, gap) => { const r = R(x, y, rw, hgt); y += hgt + gap; return r; };
    if (hasSave) o.resume = row(s(rh), 10);
    o.play = row(s(ph), 12);
    const seg = (n) => { const rs = []; for (let i = 0; i < n; i++) rs.push(R(x + i * ((rw - (n - 1) * 12) / n + 12), y, (rw - (n - 1) * 12) / n, s(segH))); y += s(segH) + 10; return rs; };
    o.variant = seg(2); o.players = seg(2); o.level = seg(3); y += 6;
    const half = (rw - 12) / 2, third = (rw - 24) / 3;
    o.how = R(x, y, half, s(duoH)); o.rules = R(x + half + 12, y, half, s(duoH)); y += s(duoH) + 10;
    o.about = R(x, y, third, s(triH)); o.settings = R(x + third + 12, y, third, s(triH)); o.auto = R(x + 2 * (third + 12), y, third, s(triH)); y += s(triH);
    o.lockup = { cx: x + rw / 2, y: y + 12, h: lh, w: Math.min(lkw, rw) };
    o.blurbY = y + 12 + lh + 26; o.blurbX = x + rw / 2; o.blurbW = rw + 30;
    const ax0 = (L.back ? L.backBox.x + L.backBox.w : U.x0) + 10, ax1 = x - 20, aw = ax1 - ax0, acx = (ax0 + ax1) / 2, tS = Math.min(150, aw / 3.3);
    const ty = U.y0 + 70 + tS * 0.82;
    o.hd = { mode: 'w', cx: acx, aw, titleSize: tS, titleY: ty, ribbonY: ty + 44, ribbonH: 44, ribbonW: Math.min(440, aw - 20), tagY: ty + 104, fanY: ty + 220, fanS: Math.min(0.85, aw / 640), fanGap: Math.min(100, aw / 5), subY: U.y1 - 80 };
  }
  o.lockTap = tapOf(o.lockup);
  return (L[ck] = o);
}

// Large-text title: a single scrolling column of rows whose height grows with the text zoom.
export function largeTitle(w, scale, hasSave) {
  const ids = [...(hasSave ? ['resume'] : []), 'play', 'variant', 'players', 'level', 'how', 'rules', 'about', 'settings', 'auto'];
  const hh = Math.round(64 * scale + 24), g = 14, rw = Math.min(640, w - 80), x = (w - rw) / 2; let y = 330; const rows = {};
  for (const id of ids) { rows[id] = R(x, y, rw, hh); y += hh + g; }
  const lkw = Math.max(240, 125 / Math.max(0.2, host.px || 0.6)), lh = Math.round(lkw * 327 / 1200), m = 44 / Math.max(0.2, host.px || 0.6), tw = Math.max(lkw + 24, m), th = Math.max(lh + 12, m);
  const lock = { cx: w / 2, y: y + 4, h: lh, w: lkw };
  return { rows, lock, lockTap: R(w / 2 - tw / 2, y, tw, Math.max(th, lh + 8)), contentH: y + 60 + lh + 14, h: hh };
}

// ---- seat geometry shared by the view and the overlap test -----------------------------------------------------------------
// The dealer badge sits centred on the top-right corner of its name tag (never over the name text).
export const badgeRect = (r) => R(r.x + r.w - 10, r.y - 10, 20, 20);
export const TABLE_RIM = 22;
export const rimRect = (T) => R(T.felt.x - TABLE_RIM, T.felt.y - TABLE_RIM, T.felt.w + 2 * TABLE_RIM, T.felt.h + 2 * TABLE_RIM);
// Card-stack footprints of the other seats for a hand of m cards (face up or face down), for n players.
export function seatRects(T, n, m = 3, faceUp = false) {
  const ns = T.nsc, nCW = CW * ns, nCH = CH * ns, SD = T.side, out = { stacks: {}, tags: {}, badges: {} };
  const sp = faceUp ? (m > 1 ? Math.min(nCW * 1.12, 260 * (ns / 0.5) / (m - 1)) : 0) : T.nStep;
  const total = nCW + sp * (m - 1), x0 = faceUp ? T.cx - total / 2 : T.cx - (nCW + T.nStep * 2) / 2;
  out.stacks.N = R(x0, T.nTop, faceUp ? total : nCW + T.nStep * 2, nCH);
  out.tags.N = T.plateN;
  if (n === 4) {
    const w = SD.sCW, h = SD.sCH, sw = faceUp ? w : h, sh = faceUp ? h : w, len = SD.step * (m - 1) + sh;
    out.stacks.W = R(SD.cxW - sw / 2, SD.yc0 - sh / 2, sw, len); out.stacks.E = R(SD.cxE - sw / 2, SD.yc0 - sh / 2, sw, len);
    out.tags.W = SD.w; out.tags.E = SD.e;
  }
  for (const k of Object.keys(out.tags)) out.badges[k] = badgeRect(out.tags[k]);
  return out;
}
