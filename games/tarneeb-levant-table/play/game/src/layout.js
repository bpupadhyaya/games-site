// Geometry as a pure function of the LIVE screen size (kit 1.7 fluid viewport: the short side is always 720 units).
// applyLayout(w, h) fills the exported live objects below (BTN, BID, READER ...) and returns L; results are cached by size + safe insets,
// so a frame never recomputes. Drawing (view.js) and hit-testing (game.js) read the same rects.
//   tall     portrait phone (h >= 1500): the approved phone look (header on top, table, hand, button bar).
//   compact  portrait but shorter (small phones, tablets): the same stack, tighter.
//   wide     landscape / squarish: left info card, table in the middle, right button card, hand fan along the bottom.
// Seats: 0 South (you, bottom), 1 East (right), 2 North (partner, top), 3 West (left).
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const LIFT = 48;
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Safe areas and the host's floating back button in virtual units; main.js keeps this current (browsers: zeros).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

// Live objects, refilled in place by applyLayout (so importers always see the current screen).
export const L = {};
export const BTN = {};
export const BID = { panel: {}, nums: [], pass: {}, suits: [] };
export const RULES_BACK = {}, RULES_NEXT = {}, TEXT_DEC = {}, TEXT_INC = {};
export const ABOUT_BACK = RULES_BACK, ABOUT_NEXT = RULES_NEXT;
export const READER = { panel: {}, counter: { x: 0, y: 0 } };

const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cache = new Map();
const refill = (o, n) => { for (const k of Object.keys(o)) delete o[k]; Object.assign(o, n); };

export function applyLayout(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.px * 100)}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  if (L.key === key) return L;
  let B = cache.get(key);
  if (!B) { B = build(w, h, { ...host }); B.key = key; cache.set(key, B); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  refill(L, B); refill(BTN, B.BTN); refill(BID, B.BID); refill(RULES_BACK, B.reader.back); refill(RULES_NEXT, B.reader.next);
  refill(TEXT_DEC, B.reader.dec); refill(TEXT_INC, B.reader.inc); refill(READER, B.reader);
  return L;
}

// the table design box: 640 x ~540 units around a centre cross; everything is scaled by k and placed at (ox, oy)
const WD = 640;
function tableGeo(reg, o) {
  const spread = o.spread, cyD = 190 + 73 + spread, HD = cyD + spread + 73 + 4;
  const k = clamp(Math.min(o.kmax, reg.h / HD, reg.w / WD), 0.5, o.kmax);
  const ox = reg.x + (reg.w - WD * k) / 2, oy = reg.y + (reg.h - HD * k) / 2;
  const P = (x, y) => ({ x: ox + x * k, y: oy + y * k });
  const kk = Math.max(k, 0.85), cc = P(320, cyD);
  const colTop = 200, colBot = Math.min(cyD + spread + 73, 540) + (spread > 100 ? 40 : 0);
  return {
    k, kk, ox, oy, HD, ccx: cc.x, ccy: cc.y, spread,
    trick: { w: 100 * k, h: 146 * k }, back: { w: 58 * k, h: 84 * k }, open: { w: 66 * Math.max(k, 0.8), h: 97 * Math.max(k, 0.8) },
    slot: [P(320, cyD + spread), P(320 + 116, cyD), P(320, cyD - spread), P(320 - 116, cyD)],
    seat: [null, P(590, (colTop + colBot) / 2), P(320, 50), P(50, (colTop + colBot) / 2)],
    plate: [null, P(574, 160), P(320, 152), P(66, 160)],
    deck: cc, colTop: oy + colTop * k, colBot: oy + colBot * k, colX: [0, ox + 590 * k, 0, ox + 50 * k], nRow: { cx: ox + 320 * k, y: oy + 50 * k, w: 600 * k },
    plateW: 124 * kk, box: R(ox, oy, WD * k, HD * k),
  };
}

function build(w, h, ins) {
  const wide = w >= h, mode = wide ? 'wide' : h >= 1500 ? 'tall' : 'compact';
  const air = wide ? 0 : clamp((h - 960) / 600, 0, 1);
  const Lo = { w, h, wide, mode, ins, air, minFont: clamp(Math.ceil(11 / Math.max(0.3, ins.px)), 11, 22) };
  const U = Lo.U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b }; U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const ucx = (U.x0 + U.x1) / 2;
  const frameB = Lo.frameB = wide ? 30 : mode === 'tall' ? 46 : 36;
  const back = ins.back ? Math.max(ins.back, 56) : 0;
  const backBox = Lo.backBox = back ? R(ins.l, ins.t, back + 8, back + 8) : R(0, 0, 0, 0);
  const top0 = Lo.top0 = Math.max(ins.t + 8, wide ? frameB + 4 : 40 + 44 * air);
  const hx0 = back ? backBox.x + backBox.w + 4 : Math.max(24, ins.l + 14), hx1 = w - Math.max(24, ins.r + 14);
  Lo.hx0 = hx0; Lo.hx1 = hx1;

  // ---- bottom bar + hand -------------------------------------------------------------------------------------------
  const tapH = clamp(Math.ceil(44 / Math.max(0.3, ins.px)), 60, 84);   // ~44 css px tall where the screen allows
  const barH = Lo.barH = mode === 'compact' ? Math.min(tapH, 74) : Math.max(70, tapH);
  const barY = Lo.barY = wide ? 0 : h - 12 - barH - Math.max(0, ins.b - 6);
  const hs = wide ? clamp(h * 0.18 / 158, 0.7, 0.9) : mode === 'tall' ? 1 : 0.88;
  const ch = Math.round(158 * hs), cw = Math.round(108 * hs);
  const handBottom = wide ? U.y1 - Math.max(6, frameB - 20) - 4 : barY - 28;
  const handY = Lo.handY = handBottom - ch;
  const handArea = wide ? Math.min(U.w - 2 * (frameB + 10), 980) : w - 104;
  Lo.hand = { cx: ucx, y: handY, cw, ch, area: handArea };
  Lo.pillY = handY - 30;                                 // "Your turn" pill centre

  // ---- table region ---------------------------------------------------------------------------------------------------
  const bannerH = mode === 'tall' ? 86 : 72;
  const hudH = Math.round(84 * (0.86 + 0.14 * air));
  const hdr = Lo.hdr = {};           // portrait header block heights per mode
  const T = Lo.T = {};
  if (!wide) {
    hdr.play = hudH; hdr.lesson = 66 + 5 * 26; hdr.puzzle = 136; hdr.auto = mode === 'tall' ? 150 : 112;
    Lo.panelX = back ? hx0 : 24;
    const spread = mode === 'tall' ? 124 : 100;
    for (const m of ['play', 'lesson', 'puzzle', 'auto']) {
      const y0 = top0 + hdr[m] + 76, bottom = mode === 'tall' ? handY - 52 - bannerH - 4 : handY - 52;
      T[m] = tableGeo(R(frameB + 6, y0, w - 2 * frameB - 12, Math.max(200, bottom - y0)), { spread, kmax: 1.12 }); T[m].infoY = top0 + hdr[m] + 4;
    }
    Lo.banner = mode === 'tall' ? R(40, handY - 52 - bannerH, w - 80, bannerH) : R(24, T.play.infoY, w - 48, bannerH);
  } else {
    const yTop = top0, yBot = handY - 54, need = 150, gap = 14, regH = yBot - yTop;
    const kH = regH / 540, kW = (U.w - 2 * (need + gap + 8)) / WD;
    const k0 = clamp(Math.min(kH, kW, 1.1), 0.5, 1.1);
    const tw = WD * k0, pw = Math.min(360, (U.w - tw) / 2 - gap - 8);
    T.play = T.lesson = T.puzzle = T.auto = tableGeo(R(ucx - tw / 2, yTop, tw, regH), { spread: 100, kmax: 1.1 });
    const LP = R(ucx - tw / 2 - gap - pw, yTop, pw, yBot - yTop), RP = R(ucx + tw / 2 + gap, yTop, pw, yBot - yTop);
    if (back && LP.x < backBox.x + backBox.w) { const pTop = Math.max(yTop, backBox.y + backBox.h + 4); LP.h = yBot - pTop; LP.y = pTop; }
    Lo.LP = LP; Lo.RP = RP; Lo.banner = null;
  }

  // ---- buttons ---------------------------------------------------------------------------------------------------------
  const b = Lo.BTN = {};
  if (!wide) {
    Object.assign(b, { leave: R(40, barY, 190, barH), undo: R(265, barY, 190, barH), hint: R(490, barY, 190, barH),
      autoExit: R(31, barY, 154, barH), autoPause: R(199, barY, 154, barH), autoDec: R(367, barY, 154, barH), autoInc: R(535, barY, 154, barH) });
  } else {
    const RP = Lo.RP, bw = RP.w - 24, bx = RP.x + 12, bh = clamp((RP.h - 24 - 40 - 120) / 4, 52, Math.max(52, Math.min(tapH, 72))), y0 = RP.y + 12;
    const slot = (i) => R(bx, y0 + i * (bh + 10), bw, bh);
    Object.assign(b, { leave: slot(0), undo: slot(1), hint: slot(2), autoExit: slot(0), autoPause: slot(1), autoDec: slot(2), autoInc: slot(3) });
    Lo.rpBottom = y0 + 4 * (bh + 10);
  }
  // overlays: a design box (dw x dh) centred on the screen, scaled down to fit; button rects in screen units
  const fit = (dw, dh, items) => {
    const f = Math.min(1, (U.w - 20) / dw, (U.h - 24) / dh);
    const ox = ucx - dw * f / 2, oy = clamp((U.y0 + U.y1) / 2 - dh * f / 2, U.y0 + 8, Math.max(U.y0 + 8, U.y1 - dh * f - 8));
    const o = { x: ox, y: oy, f, dw, dh, panel: R(ox, oy, dw * f, dh * f) };
    for (const [k, r] of Object.entries(items)) o[k] = R(ox + r[0] * f, oy + r[1] * f, r[2] * f, r[3] * f);
    return o;
  };
  Lo.ov = {
    sum: fit(640, 740, { next: [90, 630, 460, 88] }),
    over: fit(640, 730, { next: [90, 470, 460, 92], back: [90, 578, 460, 84] }),
    leave: fit(600, 440, { keep: [50, 240, 500, 80], out: [50, 336, 500, 80] }),
    puz: fit(620, 560, { done: [60, 340, 500, 84], sol: [60, 438, 500, 80] }),
  };
  b.next = Lo.ov.sum.next; b.back = Lo.ov.over.back; b.again = Lo.ov.over.next;
  {
    const lt = T.lesson, lw = Math.min(600, w - 60), lc = R(lt.ccx - lw / 2, lt.ccy - 100, lw, 200), bw = 460 * Math.min(1, lw / 520);
    Lo.lessonCard = lc; b.lesson = R(lc.x + (lw - bw) / 2, lc.y + 100, bw, 84);
  }

  // ---- bidding panel / trump picker (centred on the table cross of each mode) --------------------------------------------------
  Lo.BIDs = {};
  for (const m of ['play', 'lesson', 'puzzle', 'auto']) {
    const t = T[m], pw = clamp(440 * t.k + 10, 430, 500), ph = 112 + 2 * Math.max(62, Math.min(tapH, 76)), px = t.ccx - pw / 2, py = clamp(t.ccy - ph / 2, U.y0 + 4, U.y1 - ph - 4);
    const bw = (pw - 28 - 24) / 4, x0 = px + 14, y0 = py + 66, bh = Math.max(62, Math.min(tapH, 76));
    Lo.BIDs[m] = { panel: R(px, py, pw, ph),
      nums: [7, 8, 9, 10, 11, 12, 13].map((n, i) => ({ ...R(x0 + (i % 4) * (bw + 8), y0 + Math.floor(i / 4) * (bh + 8), bw, bh), n })),
      pass: R(x0 + 3 * (bw + 8), y0 + bh + 8, bw, bh),
      suits: [0, 1, 2, 3].map((s) => ({ ...R(x0 + s * (bw + 8), y0, bw, 116), s })) };
  }
  Lo.BID = Lo.BIDs.play;

  // ---- title -------------------------------------------------------------------------------------------------------------
  const titleGeo = (hasSave) => {
    const full = hasSave ? 766 : 674, rowsN = hasSave ? 4 : 3;
    // Arcforge lockup under the last menu row: >= ~125 css px wide (aspect 1200:327); `strip` is the room it takes
    const lkw = Math.max(250, 125 / Math.max(0.2, ins.px || 0.6)), lkh = Math.round(lkw * 327 / 1200), strip = lkh + 20;
    let m, sx, sw, stackTop, art;
    if (!wide) {
      const bottom = h - Math.max(24, ins.b + 10) - strip;
      m = clamp((bottom - 330 - 8) / full, 0.66, 1.2);
      sw = 500; sx = (w - sw) / 2; stackTop = bottom - full * m;
      art = { cx: w / 2, h: stackTop - 6, w };
    } else {
      m = clamp((U.h - 2 * frameB - strip) / full, 0.5, 1);
      const halfW = U.w / 2; sw = Math.min(500, halfW - 40); sx = U.x0 + halfW + (halfW - sw) / 2;
      stackTop = U.y0 + (U.h - full * m - strip) / 2;
      art = { cx: U.x0 + halfW / 2, h, w: halfW };
    }
    const rh = 80 * m, rp = 92 * m, rows = {};
    (hasSave ? ['resume'] : []).concat(['learn', 'play', 'daily']).forEach((n, i) => { rows[n] = R(sx, stackTop + i * rp, sw, rh); });
    const half = (sw - 14) / 2, ay = stackTop + rowsN * rp;
    rows.about = R(sx, ay, half, rh); rows.rules = R(sx + half + 14, ay, half, rh);
    const y = stackTop + (rowsN + 1) * rp + 8 * m, sm = 60 * m, sp = 68 * m;
    rows.level = R(sx, y, sw, 66 * m);
    rows.sound = R(sx, y + 76 * m, half, sm); rows.calm = R(sx + half + 14, y + 76 * m, half, sm);
    rows.big = R(sx, y + 76 * m + sp, half, sm); rows.target = R(sx + half + 14, y + 76 * m + sp, half, sm);
    rows.auto = R(sx, y + 76 * m + 2 * sp + 8 * m, sw, 78 * m);
    const lb = rows.auto.y + rows.auto.h + 12, lock = R(sx + sw / 2 - lkw / 2, lb, lkw, lkh), tm = 44 / Math.max(0.2, ins.px || 0.6), tw = Math.max(lkw + 24, tm), th = Math.max(lkh + 12, tm);
    const lockTap = R(sx + sw / 2 - tw / 2, lb - 4, tw, Math.max(th, lkh + 8));
    return { rows, lock, lockTap, m, art, stackTop, sx, sw, demo: R(sx, stackTop, sw, Math.min(h - stackTop - 20, 420)) };
  };
  Lo.title = [titleGeo(false), titleGeo(true)];

  // ---- lessons list --------------------------------------------------------------------------------------------------------
  {
    const n = 8;
    if (!wide) {
      const y0 = top0 + 150, avail = barY - y0 - 8, pitch = clamp(avail / (n + 1), 62, 108);
      Lo.lessons = { titleY: top0 + 74, subY: top0 + 118, rows: Array.from({ length: n }, (_, i) => R(60, y0 + i * pitch, 600, pitch - 16)), back: R(130, y0 + n * pitch + 4, 460, Math.min(78, pitch - 8)) };
    } else {
      const cw2 = Math.min(400, (U.w - 60) / 2), x0 = ucx - cw2 - 8, y0 = top0 + 100, pitch = clamp((h - y0 - 100) / 5, 56, 100);
      Lo.lessons = { titleY: top0 + 50, subY: top0 + 86, rows: Array.from({ length: n }, (_, i) => R(x0 + (i % 2) * (cw2 + 16), y0 + Math.floor(i / 2) * pitch, cw2, pitch - 14)), back: R(ucx - 230, y0 + 4 * pitch + 6, 460, Math.min(70, pitch - 8)) };
    }
  }

  // ---- About / Rules reader --------------------------------------------------------------------------------------------------
  {
    const base = wide ? top0 : Math.max(top0, mode === 'tall' ? 84 : 44);
    const titleSize = wide ? 46 : mode === 'tall' ? 62 : 54;
    const bh = wide ? Math.min(tapH, 72) : barH, by = wide ? h - 12 - bh - Math.max(0, ins.b - 6) : barY;
    const barW = wide ? Math.min(U.w - 60, 760) : w - 60, bw2 = Math.min(168, (barW - 36) / 4), bx0 = ucx - (bw2 * 4 + 36) / 2;
    const pw = wide ? Math.min(U.w - 2 * (frameB + 14), 960) : w - 80;
    const ptop = base + titleSize + 22, pbot = by - 40;
    Lo.reader = { titleY: base + titleSize, titleSize, panel: R(ucx - pw / 2, ptop, pw, pbot - ptop),
      back: R(bx0, by, bw2, bh), dec: R(bx0 + bw2 + 12, by, bw2, bh), inc: R(bx0 + 2 * (bw2 + 12), by, bw2, bh), next: R(bx0 + 3 * (bw2 + 12), by, bw2, bh), counter: { x: ucx, y: by - 14 } };
  }
  return Lo;
}

// ---- helpers used by the game and the tests (always read the live layout) ---------------------------------------------------------
export function handLayout(n) {
  const { cx, y, cw, ch, area } = L.hand;
  const step = n > 1 ? Math.min(cw * 0.72, (area - cw) / (n - 1)) : 0, total = step * (n - 1) + cw, x0 = cx - total / 2;
  return Array.from({ length: n }, (_, i) => ({ x: x0 + i * step, y, w: cw, h: ch, step }));
}
// Which card a tap at (x, y) means: the front-most card (rightmost) whose visible part contains the point.
export function cardAt(n, sel, x, y) {
  const Ls = handLayout(n);
  for (let i = n - 1; i >= 0; i--) {
    const r = Ls[i], right = i === n - 1 ? r.x + r.w : r.x + r.step, top = r.y - (i === sel ? LIFT : 0) - 6;
    if (x >= r.x && x <= right && y >= top && y <= r.y + r.h + 4) return i;
  }
  return -1;
}
export const titleRows = (hasSave) => L.title[hasSave ? 1 : 0].rows;
export const titleLock = (hasSave) => L.title[hasSave ? 1 : 0].lockTap;
export const LESSON_ROWS = () => L.lessons.rows;
export const LESSONS_BACK = () => L.lessons.back;
applyLayout(720, 1560);   // a sane default until the first frame supplies the real size
