// Geometry, as a function of the LIVE screen size (kit 1.7 fluid viewport: the short side is always 720 units).
// `layoutFor(w, h)` returns every position for that size; it is cached, so a frame never recomputes it. Two shapes:
//   port  portrait (and anything taller than wide): a header on top, the board in the middle, a message panel and the button bar below.
//   wide  landscape / squarish: a card on the left (status, message), the board in the middle, a card on the right (buttons).
// The BOARD is always drawn in its canonical 720 x 1560 coordinates (the boat stands upright, your houses are the right-hand column) and is only
// translated + scaled into place, so the rules text ("your column on the right", "your storehouse at the bottom") is true at every size.
// `L.toBoard(x, y)` / `L.toScreen(x, y)` convert between screen and board coordinates.
export const W = 720, H = 1560;                       // canonical board canvas (art.js paints the board once at this size)
export const PIT_R = 44, PITCH = 86, COL_X = [478, 242], Y_BOT = 1056;
export const STORE_BOX = [{ x: 255, y: 1110, w: 210, h: 86 }, { x: 255, y: 400, w: 210, h: 86 }];   // [own (bottom), opponent's (top)]
export const HULL = { top: 308, bot: 1288, cx: 360, cy: 798, A: 280 };
const BB = { cx: 360, cy: 798, w: 572, h: 1034 };      // the boat's bounding box (horns included) in board coordinates

export function posXY(pos) {
  if (pos < 7) return { x: COL_X[0], y: Y_BOT - PITCH * pos };
  if (pos === 7) return { x: 360, y: STORE_BOX[1].y + 43 };
  if (pos < 15) return { x: COL_X[1], y: Y_BOT - PITCH * 6 + PITCH * (pos - 8) };
  return { x: 360, y: STORE_BOX[0].y + 43 };
}
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Index into this, never a raw float, so the stepper can cleanly disable at either end and a stale
// saved index (e.g. from a build with a shorter array) always clamps instead of producing NaN sizes.
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
// Auto Play ("Watch & Learn"): configurable THINK pause, index-based steps, hard-capped at 10s.
export const AUTO_THINK_STEPS = [2, 5, 8, 10];
export const AUTO_REVEAL_SECS = 2;

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
// Tap zone of the Arcforge lockup: at least 44 x 44 css px, grown sideways/downwards only.
export const creditHit = (r) => { const m = 44 / Math.max(host.px, 1e-6), w = Math.max(r.w, m), h = Math.max(r.h, m); return { x: Math.round(r.x + r.w / 2 - w / 2), y: Math.round(r.y), w: Math.round(w), h: Math.round(h) }; };
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cache = new Map();
export function layoutFor(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }); L.key = key; cache.set(key, L); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  return L;
}

function build(w, h, ins) {
  const wide = w >= h, L = { w, h, wide, mode: wide ? 'wide' : 'port', ins };
  const backSz = ins.back ? Math.max(ins.back, 56) : 0;
  L.backBox = ins.back ? R(ins.l, ins.t, backSz + 8, backSz + 8) : R(0, 0, 0, 0);
  const U = L.U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b };      // the area clear of notch / home indicator
  U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const bandT = wide ? 44 : 92, bandB = wide ? 30 : 54;                         // the patterned bands top and bottom (art.js) are decoration, not content area
  const B1 = Math.min(U.y1, h - bandB + 12), top = Math.max(U.y0, bandT) + 6, botPad = 14;
  const backRight = ins.back ? L.backBox.x + L.backBox.w + 8 : 0;                // centred text never runs under the back button
  const cxScreen = (U.x0 + U.x1) / 2;

  // ---- play / lesson / puzzle / auto -----------------------------------------------------------------------------------------
  const BTN = L.BTN = {}, AUTO = L.AUTO = {};
  if (!wide) {
    const btnY = B1 - botPad - 74, msgY = btnY - 8 - 94, hdrH = 140, subH = 60;
    const bw = Math.min(200, (U.w - 80 - 30) / 3);
    const bx = (i) => U.x0 + (U.w - (bw * 3 + 30)) / 2 + i * (bw + 15);
    L.hdr = R(U.x0 + Math.max(10, backRight - U.x0), top, U.w - 2 * Math.max(10, backRight - U.x0), hdrH);
    L.sub = R(U.x0 + 30, top + hdrH, U.w - 60, subH);
    const bTop = top + hdrH + subH, bBot = msgY - 8, s = Math.min(1, (bBot - bTop) / BB.h, (U.w - 16) / BB.w);
    L.board = { s, cx: cxScreen, cy: (bTop + bBot) / 2 };
    L.msg = R(U.x0 + 40, msgY, U.w - 80, 94);
    Object.assign(BTN, { menu: R(bx(0), btnY, bw, 74), undo: R(bx(1), btnY, bw, 74), hint: R(bx(2), btnY, bw, 74), next: R(bx(1) - 15, btnY, bw * 2 + 30 - 0, 74) });
    BTN.share = BTN.next;
    Object.assign(AUTO, { bar: R(L.sub.x, L.sub.y + 2, L.sub.w, 56), dec: R(L.sub.x + L.sub.w - 160, L.sub.y + 7, 70, 46), inc: R(L.sub.x + L.sub.w - 76, L.sub.y + 7, 70, 46) });
  } else {
    const g = 14, minSide = 240;
    const s = Math.min(1, (B1 - top - 8) / BB.h, Math.max(0.3, (U.w - 2 * (minSide + g) - 12) / BB.w));
    L.board = { s, cx: cxScreen, cy: (top + B1) / 2 };
    const bwid = BB.w * s, side = Math.min((U.w - bwid) / 2 - g, 400);
    const cardTop = ins.back ? Math.max(top, L.backBox.y + L.backBox.h + 4) : top, cardH = B1 - 6 - cardTop;
    L.leftCard = R(cxScreen - bwid / 2 - g - (side - 8), cardTop, side - 8, cardH);
    L.rightCard = R(cxScreen + bwid / 2 + g, cardTop, side - 8, cardH);
    const lc = L.leftCard, pad = 16;
    L.hdr = R(lc.x + pad, lc.y + 8, lc.w - 2 * pad, 140);
    L.sub = R(lc.x + pad, lc.y + 150, lc.w - 2 * pad, 34);
    const rest = lc.y + lc.h - (lc.y + 188) - pad;
    const autoH = 56, msgH = Math.max(80, Math.min(300, rest - autoH - 12));
    L.msg = R(lc.x + pad, lc.y + 188, lc.w - 2 * pad, msgH);
    Object.assign(AUTO, { bar: R(lc.x + pad, L.msg.y + msgH + 12, lc.w - 2 * pad, autoH) });
    AUTO.dec = R(AUTO.bar.x + AUTO.bar.w - 150, AUTO.bar.y + 5, 68, 46); AUTO.inc = R(AUTO.bar.x + AUTO.bar.w - 76, AUTO.bar.y + 5, 68, 46);
    // the right card: a computed vertical stack of three big buttons (Menu / Undo / Hint, or Exit / Pause / Skip), centred
    const rc = L.rightCard, bw = clamp(rc.w - 40, 140, 340);
    let bh = 84, gap = 16; if (3 * bh + 2 * gap > rc.h - 24) { bh = Math.max(50, (rc.h - 24 - 2 * gap) / 3); gap = 12; }
    const bx0 = rc.x + (rc.w - bw) / 2, y0 = rc.y + (rc.h - (3 * bh + 2 * gap)) / 2;
    const slot = (i) => R(bx0, y0 + i * (bh + gap), bw, bh);
    Object.assign(BTN, { menu: slot(0), undo: slot(1), hint: slot(2), next: slot(1), share: slot(1) });
  }
  const bs = L.board.s;
  L.toBoard = (x, y) => ({ x: BB.cx + (x - L.board.cx) / bs, y: BB.cy + (y - L.board.cy) / bs });
  L.toScreen = (x, y) => ({ x: L.board.cx + (x - BB.cx) * bs, y: L.board.cy + (y - BB.cy) * bs });
  // the house nearest a tap (screen coordinates), or -1 (generous: the whole column band counts)
  L.houseNear = (sx, sy) => {
    const q = L.toBoard(sx, sy); let best = -1, bd = 1e9;
    for (let i = 0; i < 16; i++) {
      if (i === 7 || i === 15) continue;
      const p = posXY(i), dx = Math.abs(q.x - p.x), dy = Math.abs(q.y - p.y);
      if (dx > 74 || dy > 44) continue;
      const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = i; }
    }
    return best;
  };

  // ---- reference pages: About / Controls / Rules (scrolling body, text zoom to 300 %) -------------------------------------
  {
    const rowH = wide ? 64 : 86, rowY = B1 - botPad - rowH, pageY = rowY - 8 - 54, titleH = wide ? 66 : 92;
    const pw = wide ? Math.min(1040, U.w - 60) : Math.min(648, U.w - 72);
    const px = cxScreen - pw / 2, py = top + titleH, ph = (wide ? rowY : pageY) - 8 - py;
    const panel = R(px, py, pw, ph), body = R(px + 34, py + 20, pw - 68 - 14, ph - 40);
    const bw = wide ? 220 : 220, bgap = 20;
    L.READ = wide ? {
      title: { x: cxScreen, y: top + 48, w: U.w - 2 * Math.max(20, backRight - U.x0 + 8), size: 50 }, panel, body, bar: R(px + pw - 22, py + 26, 8, ph - 52),
      back: R(cxScreen - 190 - 16 - bw, rowY, bw, rowH), next: R(cxScreen + 190 + 16, rowY, bw, rowH),
      dec: R(cxScreen - 190, rowY + 5, 100, 54), inc: R(cxScreen + 90, rowY + 5, 100, 54), page: { x: cxScreen, y: rowY + 40 },
    } : {
      title: { x: cxScreen, y: top + 64, w: U.w - 2 * Math.max(20, backRight - U.x0 + 8), size: 64 }, panel, body, bar: R(px + pw - 22, py + 26, 8, ph - 52),
      back: R(cxScreen - bw - bgap / 2, rowY, bw, rowH), next: R(cxScreen + bgap / 2, rowY, bw, rowH),
      dec: R(cxScreen - 190, pageY, 100, 54), inc: R(cxScreen + 90, pageY, 100, 54), page: { x: cxScreen, y: pageY + 36 },
    };
    L.BTN.rulesBack = L.BTN.aboutBack = L.READ.back; L.BTN.rulesNext = L.BTN.aboutNext = L.READ.next;
    L.STEP = { dec: L.READ.dec, inc: L.READ.inc };
  }

  // ---- settings ---------------------------------------------------------------------------------------------------------------
  {
    const names = ['level', 'match', 'sound', 'calm', 'big', 'seeds', 'wood'], SET = L.SET = {};
    const backY = B1 - botPad - 80;
    if (!wide) {
      const px = U.x0 + 30, pw = U.w - 60, py = top + 6, ph = backY - 12 - py, bw = Math.min(580, pw - 60), bx = cxScreen - bw / 2;
      const titleY = py + 88, y0 = py + 122, extra = 270;                       // blurbs + shell row below the stack
      const pitch = clamp((ph - 122 - extra - 16) / 7, 62, 100), bh = Math.min(84, pitch - 10);
      names.forEach((n, i) => { SET[n] = R(bx, y0 + i * pitch, bw, bh); });
      const ty = y0 + 7 * pitch + 24;
      L.setView = { panel: R(px, py, pw, ph), title: { x: cxScreen, y: titleY }, blurb: { x: cxScreen, y: ty - 8, w: Math.min(600, pw - 40) }, blurb2: { x: cxScreen, y: ty + 52, w: Math.min(590, pw - 40) }, seeds: { cx: cxScreen, y: Math.min(backY - 40, ty + 200) } };
    } else {
      const pw = Math.min(1100, U.w - 40), px = cxScreen - pw / 2, py = top + 4, ph = backY - 10 - py;
      const colW = Math.min(440, (pw - 90) / 2), gx = 30, x0 = cxScreen - colW - gx / 2, x1 = cxScreen + gx / 2, y0 = py + 92;
      const pitch = clamp((ph - 92 - 12) / 4, 60, 92), bh = Math.min(80, pitch - 10);
      names.forEach((n, i) => { SET[n] = R(i < 4 ? x0 : x1, y0 + (i % 4) * pitch, colW, bh); });
      const ry = y0 + 3 * pitch + 20;
      L.setView = { panel: R(px, py, pw, ph), title: { x: cxScreen, y: py + 66 }, blurb: { x: x1 + colW / 2, y: ry + 12, w: colW }, blurb2: { x: x1 + colW / 2, y: ry + 58, w: colW }, seeds: { cx: x0 + colW / 2, y: y0 + 4 * pitch + 12 }, compact: true };
    }
    SET.back = R(cxScreen - 230, backY, 460, 80);
  }

  // ---- the title ---------------------------------------------------------------------------------------------------------------
  const titleCache = {};
  L.titleRows = (hasSave) => {
    const key = hasSave ? 1 : 0; if (titleCache[key]) return titleCache[key];
    const T = {};
    if (!wide) {
      const rw = Math.min(580, U.w - 140), rx = cxScreen - rw / 2, bh = 84, pitch = 96, n = hasSave ? 5 : 4;
      const lockW = Math.min(rw, Math.max(0.35 * 720, 120 / Math.max(host.px, 1e-6))), lockH = lockW / 3.67, blockH = n * pitch + 84 + 14 + 78 + 14 + lockH;
      const y0 = Math.max(top + 150, B1 - botPad - blockH);
      let y = y0;
      if (hasSave) { T.resume = R(rx, y, rw, bh); y += pitch; }
      T.learn = R(rx, y, rw, bh); y += pitch; T.play = R(rx, y, rw, bh); y += pitch; T.two = R(rx, y, rw, bh); y += pitch; T.daily = R(rx, y, rw, bh); y += pitch;
      small(T, rx, y, rw, 84); T.stats = { x: cxScreen, y: y + 84 + 38 };
      T.lock = R(cxScreen - lockW / 2, y + 84 + 14 + 78 + 4, lockW, lockH);
      T.msg = R(U.x0 + 40, y0 - 70, U.w - 80, 60);
      T.hero = R(U.x0, top + 4, U.w, Math.max(120, y0 - 12 - (top + 4)));
    } else {
      const left = clamp(U.w * 0.46, 380, 760), rx0 = U.x0 + left + 10, rw = U.x1 - rx0 - 24, gap = 14;
      const bw = (rw - gap) / 2, bh = 84, pitch = 96;
      const n = hasSave ? 3 : 2, lockW = Math.min(rw, Math.max(0.28 * 720, 120 / Math.max(host.px, 1e-6))), lockH = lockW / 3.67, blockH = n * pitch + 84 + 14 + 78 + 14 + lockH;
      let y = Math.max(top + 4, top + (B1 - top - blockH) / 2); const y0 = y;
      if (hasSave) { T.resume = R(rx0, y, rw, bh); y += pitch; }
      T.learn = R(rx0, y, bw, bh); T.play = R(rx0 + bw + gap, y, bw, bh); y += pitch;
      T.two = R(rx0, y, bw, bh); T.daily = R(rx0 + bw + gap, y, bw, bh); y += pitch;
      small(T, rx0, y, rw, 84); T.stats = { x: rx0 + rw / 2, y: y + 84 + 38 };
      T.lock = R(rx0 + rw / 2 - lockW / 2, y + 84 + 14 + 78 + 4, lockW, lockH);
      T.msg = R(rx0, Math.max(top, y0 - 66), rw, 56);
      T.hero = R(U.x0, top, left, B1 - top);
    }
    return (titleCache[key] = T);
  };
  function small(T, x, y, rw, hh) {                                                  // About / Controls / Rules / Settings / Auto
    const gap = 10, qw = (rw - gap * 4) / 5;
    ['about', 'how', 'rules', 'settings', 'auto'].forEach((n, i) => { T[n] = R(x + i * (qw + gap), y, qw, hh); });
  }

  // ---- demo-limit card ---------------------------------------------------------------------------------------------------------
  L.demo = R(cxScreen - 300, (U.y0 + U.y1) / 2 - 130, 600, 380);

  // ---- round-over and game-over screens ----------------------------------------------------------------------------------------
  // `res.y(c)` maps the portrait design's y (canonical 400..1222) to this screen; text is centred on res.cx, buttons on res.bcx.
  {
    const res = L.res = {};
    if (!wide) {
      const k = Math.min(1, (U.h - 40) / 830), top0 = k === 1 ? (U.y0 + U.y1) / 2 - 415 : U.y0 + 20;
      res.cx = res.bcx = cxScreen; res.k = k; res.y = (c) => top0 + (c - 400) * k;
      res.again = R(cxScreen - 230, res.y(1010), 460, 96); res.back = R(cxScreen - 230, res.y(1126), 460, 96); res.cont = res.back;
      res.more = { x: cxScreen, y: res.y(1222) + 56 };
    } else {
      const textTop = Math.max(U.y0 + 20, (U.y0 + U.y1) / 2 - 270), cy = (U.y0 + U.y1) / 2;
      res.cx = U.x0 + U.w * 0.29; res.bcx = U.x0 + U.w * 0.73; res.k = 1; res.y = (c) => textTop + (c - 400);
      const bw = Math.min(460, U.w * 0.36);
      res.again = R(res.bcx - bw / 2, cy - 110, bw, 96); res.back = R(res.bcx - bw / 2, cy + 6, bw, 96); res.cont = R(res.bcx - bw / 2, cy - 48, bw, 96);
      res.more = { x: res.bcx, y: cy + 6 + 96 + 56 };
    }
    L.BTN.again = res.again; L.BTN.back = res.back; L.BTN.cont = res.cont;
  }
  return L;
}

// ---- the tall phone layout as plain constants, for the scenario tests (headless runs at 720 x 1560 with no insets) ----------------
const T0 = layoutFor(W, H);
export const BTN = T0.BTN, SET = T0.SET, TEXT_STEPPER = T0.STEP, titleRows = (hasSave) => T0.titleRows(hasSave);
export const houseNear = (x, y) => T0.houseNear(x, y);
