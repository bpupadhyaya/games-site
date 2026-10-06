// Geometry, as a function of the LIVE screen size (kit 1.7 fluid viewport: the short side is always 720 units).
// The board is authored on a canonical 720 x 1560 canvas (pits, trays, frame: the constants below, also used by art.js).
// `layoutFor(w, h)` places everything else for the real size and maps the canonical board onto the screen with one uniform
// scale (`L.board`). Three shapes:
//   tall     portrait phone (h >= 1540): the approved phone look, unchanged (centred vertically when taller).
//   compact  portrait shorter than a phone (tablets, small phones, squarish windows): header, board, message, button bar, stacked.
//   wide     landscape: a card on the left (status + message), the board in the middle, a card on the right (buttons).
// Layouts are cached by size + insets, so a frame never recomputes them.
export const W = 720, H = 1560;                       // canonical board canvas (art.js paints on it)
export const PIT_R = 46, PITCH = 100, X0 = 110;
export const ROW_Y = { top: 625, bottom: 825 };
export const FRAME = { x: 30, y: 392, w: 660, h: 666 };
export const TRAY = { top: { x: 60, y: 425, w: 600, h: 90 }, bottom: { x: 60, y: 935, w: 600, h: 90 } };
export const MID_Y = 725;
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const AP_THINK_STEPS = [2, 5, 8, 10];

export const pitPos = (i) => (i < 6 ? { x: X0 + PITCH * i, y: ROW_Y.bottom } : { x: X0 + PITCH * (11 - i), y: ROW_Y.top });
export const trayPos = (p) => ({ x: 360, y: p === 0 ? TRAY.bottom.y + 45 : TRAY.top.y + 45 });
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };   // px: css pixels per virtual unit (text never below ~11 css px)

const cache = new Map();
export function layoutFor(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }); L.key = key; cache.set(key, L); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  return L;
}

const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const BOARD_W = 680, BOARD_H = 676;                  // the canonical board's footprint (frame + shadow margin)

function build(w, h, ins) {
  const wide = w >= h * 1.18, tall = !wide && h >= 1540, mode = wide ? 'wide' : tall ? 'tall' : 'compact';
  const L = { w, h, wide, tall, mode, ins };
  const U = L.U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b }; U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const backSz = ins.back ? Math.max(ins.back, 56) : 0;
  L.backBox = ins.back ? R(ins.l, ins.t, backSz + 8, backSz + 8) : R(0, 0, 0, 0);
  const oy = L.oy = tall ? (h - 1560) / 2 : 0;
  // decorative woven bands: thick on portrait phones, thin elsewhere; mid bands only frame the phone-shaped board scene
  const tb = tall ? 92 : wide ? 40 : h >= 1100 ? 60 : 40;
  L.bands = { top: R(0, 0, w, tb), bottom: R(0, h - tb, w, tb), mid: tall ? [R(0, 326 + oy, w, 50), R(0, 1130 + oy, w, 56)] : null, tb };

  playLayout(L);
  L.title = (() => { const c = {}; return (hasSave) => (c[hasSave ? 1 : 0] ??= buildTitle(L, !!hasSave)); })();
  L.settings = buildSettings(L);
  L.reader = buildReader(L);
  L.over = buildOver(L);
  const tc = wide ? L.title(false).card : null;
  L.demo = { cx: tc ? tc.x + tc.w / 2 : w / 2, cy: tall ? 990 + oy : h / 2, sc: clamp(Math.min(((tc ? tc.w : U.w) - 24) / 640, (U.h - 24) / 420), 0.5, 1), dim: !tall };
  L.dev = { x: U.x1 - 20, y: Math.max(U.y0 + 28, wide ? tb + 22 : 40) };
  return L;
}

// ---- play / lesson / puzzle / Auto Play screens: header, board, message, buttons --------------------------------------------
function playLayout(L) {
  const { w, h, U, ins, wide, tall, oy } = L;
  const BTN = L.BTN = {};
  const board = L.board = { s: 1, cx: 360, cy: MID_Y + oy };
  const toScreen = (x, y) => ({ x: board.cx + (x - 360) * board.s, y: board.cy + (y - MID_Y) * board.s });
  L.pitScreen = (i) => { const p = pitPos(i); return toScreen(p.x, p.y); };
  L.pitNear = (x, y) => {                       // nearest pit to a tap (generous: the whole row band counts), or -1
    const s = board.s, cx = (x - board.cx) / s + 360, cy = (y - board.cy) / s + MID_Y;
    let best = -1, bd = 1e9;
    for (let i = 0; i < 12; i++) {
      const p = pitPos(i), dx = Math.abs(cx - p.x), dy = Math.abs(cy - p.y);
      if (dx > 54 || dy > 92) continue;
      const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = i; }
    }
    return best;
  };
  if (tall) {
    const barY = 1340 + oy;
    L.hdr = { mode: 'stack', cx: 360, y: 132 + oy, maxW: 640, k: 1 };
    L.msg = R(40, 1206 + oy, 640, 118); L.msgA = R(40, 1176 + oy, 640, 118);
    Object.assign(BTN, {
      menu: R(40, barY, 190, 82), undo: R(265, barY, 190, 82), hint: R(490, barY, 190, 82), next: R(265, barY, 415, 82), share: R(265, barY, 415, 82),
      apExit: R(40, barY, 148, 82), apPause: R(204, barY, 148, 82), apDec: R(368, barY, 148, 82), apInc: R(532, barY, 148, 82),
    });
    L.apCap = { x: 360, y: barY - 14, size: 22 };
  } else if (!wide) {
    const tiers = [{ k: 1, hh: 190, mh: 118, bh: 82 }, { k: 0.82, hh: 132, mh: 100, bh: 76 }, { k: 0.66, hh: 96, mh: 88, bh: 70 }];
    const top0 = Math.max(L.bands.tb, ins.t) + 6, bot = h - Math.max(L.bands.tb, ins.b + 8) - 8;
    let T = tiers[2], s = 0.5;
    for (const t of tiers) {
      const sp = (bot - top0 - (t.hh + t.mh + t.bh)) / (BOARD_H + 56);
      if (sp >= 0.97 || t === tiers[2]) { T = t; s = clamp(sp, 0.45, 1); break; }
    }
    const bh = BOARD_H * s, free = Math.max(0, bot - top0 - (T.hh + bh + T.mh + T.bh)), gap = free / 3;
    const hdrY = top0, boardTop = hdrY + T.hh + gap, msgY = boardTop + bh + gap, barY = bot - T.bh;
    board.s = s; board.cx = w / 2; board.cy = boardTop + bh / 2;
    L.hdr = { mode: 'stack', cx: w / 2, y: hdrY, maxW: w - 80, k: T.k };
    const mh = Math.min(T.mh, Math.max(64, barY - 8 - msgY));
    L.msg = R(40, Math.min(msgY, barY - 8 - mh), 640, mh); L.msgA = free >= 40 ? R(40, L.msg.y - 28, 640, mh) : L.msg;
    const bw = 190, gp = 25, x0 = (w - 3 * bw - 2 * gp) / 2;
    Object.assign(BTN, {
      menu: R(x0, barY, bw, T.bh), undo: R(x0 + bw + gp, barY, bw, T.bh), hint: R(x0 + 2 * (bw + gp), barY, bw, T.bh), next: R(x0 + bw + gp, barY, 2 * bw + gp, T.bh), share: R(x0 + bw + gp, barY, 2 * bw + gp, T.bh),
      apExit: R(40, barY, 148, T.bh), apPause: R(204, barY, 148, T.bh), apDec: R(368, barY, 148, T.bh), apInc: R(532, barY, 148, T.bh),
    });
    L.apCap = { x: 360, y: barY - 10, size: 22 };
  } else {
    // wide: left card (status + message), board, right card (buttons)
    const g = 14, Lmin = 190, tb = L.bands.tb;
    const sH = (h - 2 * tb - 20) / BOARD_H, sW = (U.w - 2 * Lmin - 2 * g - 8) / BOARD_W;
    const s = clamp(Math.min(sH, sW, 1.08), 0.4, 1.08), bw = BOARD_W * s;
    const sym = Math.min(400, (U.w - bw) / 2 - g - 4);
    board.s = s; board.cx = U.x0 + U.w / 2; board.cy = h / 2;
    const cardTop = Math.max(tb + 8, ins.back ? L.backBox.y + L.backBox.h + 4 : 0, U.y0 + 6), cardBot = Math.min(h - tb - 8, U.y1 - 6), cardH = cardBot - cardTop;
    L.leftCard = R(board.cx - bw / 2 - g - sym, cardTop, sym, cardH);
    L.rightCard = R(board.cx + bw / 2 + g, cardTop, sym, cardH);
    const lc = L.leftCard;
    const msgH = Math.min(Math.max(150, cardH * 0.44), 300);
    L.hdr = { mode: 'card', cx: lc.x + lc.w / 2, y: lc.y + 14, maxW: lc.w - 24, k: lc.w < 260 ? 0.62 : 0.8, bottom: lc.y + lc.h - msgH - 14 };
    L.msg = R(lc.x + 6, lc.y + lc.h - msgH - 6, lc.w - 12, msgH); L.msgA = L.msg;
    const rc = L.rightCard, bwid = clamp(rc.w - 28, 100, 300), bx = rc.x + (rc.w - bwid) / 2, capH = 34, pad = 14;
    let bh = 84, gap = 14; const avail = rc.h - 2 * pad - capH;
    if (4 * bh + 3 * gap > avail) { gap = 10; bh = Math.max(52, Math.min(bh, (avail - 3 * gap) / 4)); }
    const y0 = rc.y + pad + (avail - (4 * bh + 3 * gap)) / 2, slot = (i) => R(bx, y0 + i * (bh + gap) + (i >= 2 ? capH : 0), bwid, bh);
    Object.assign(BTN, { menu: slot(0), undo: slot(1), hint: slot(2), next: slot(1), share: slot(1), apExit: slot(0), apPause: slot(1), apDec: slot(2), apInc: slot(3) });
    L.apCap = { x: bx + bwid / 2, y: slot(1).y + bh + capH - 8, size: 22 };
  }
  return L;
}

// ---- title ------------------------------------------------------------------------------------------------------------------
// hero = the title art (name, tagline and the little board) drawn in canonical units {cx, top, sc}: ~480 wide, canonical y 100..740.
const HERO_W = 480, HERO_H = 640;
function titleRowsAt(hasSave, x, wd, y0, pitch, bh) {
  const R2 = {}; let y = y0;
  const next = (nm) => { R2[nm] = R(x, y, wd, bh); y += pitch; };
  if (hasSave) next('resume');
  ['learn', 'play', 'two', 'daily', 'autoplay'].forEach(next);
  const gap = 14, third = (wd - gap * 2) / 3;
  R2.about = R(x, y, third, bh); R2.settings = R(x + third + gap, y, third, bh); R2.rules = R(x + (third + gap) * 2, y, third, bh);
  return R2;
}
function buildTitle(L, hasSave) {
  const { w, h, U, ins, oy } = L, n = (hasSave ? 6 : 5) + 1, T = { rows: {}, hero: null, card: null, stats: null, lockup: null };
  if (L.tall) {
    const step = hasSave ? 92 : 98;
    T.rows = titleRowsAt(hasSave, 70, 580, 735 + oy, step, 84);
    T.hero = { cx: 360, top: 100 + oy, sc: 1 };
    const y = T.rows.about.y + 122; T.stats = { x: 360, y, y2: y + 40 };
    const lh = Math.round(Math.max(0.35 * 720, 120 / Math.max(host.px, 1e-6)) / 3.67); T.lockup = { cx: 360, top: Math.min(Math.max(y + 62, 1418 + oy), h - L.bands.tb - lh - 4), h: lh };
    T.msgY = 1440 + oy;
    return T;
  }
  if (!L.wide) {
    const top0 = Math.max(L.bands.tb, ins.t) + 8, bot = h - Math.max(L.bands.tb, ins.b + 6) - 6, lockH = Math.round(Math.max(0.35 * 720, 120 / Math.max(host.px, 1e-6)) / 3.67);
    let pitch = 88, statsH = 76;
    const heroFor = (p, sh) => (bot - top0 - lockH - 28 - n * p - sh - 30) / HERO_H;
    if (heroFor(pitch, statsH) < 0.62) pitch = 74;
    if (heroFor(pitch, statsH) < 0.55) pitch = 64;
    if (heroFor(pitch, statsH) < 0.5) statsH = 0;
    const sc = clamp(heroFor(pitch, statsH), 0.42, 1), bh = pitch - 10, rowsH = n * pitch;
    // stack from the bottom: lockup, stats, rows; the hero is centred in what is left above
    const lockTop = bot - lockH, statsTop = lockTop - 22 - statsH, rowsTop = statsTop - 8 - rowsH + (pitch - bh);
    T.rows = titleRowsAt(hasSave, (w - 580) / 2, 580, rowsTop, pitch, bh);
    const zone = rowsTop - 10 - top0, heroH = HERO_H * sc;
    T.hero = { cx: w / 2, top: top0 + Math.max(0, (zone - heroH) / 2), sc };
    if (statsH) T.stats = { x: w / 2, y: statsTop + 28, y2: statsTop + 66 };
    T.lockup = { cx: w / 2, top: lockTop, h: lockH };
    T.msgY = rowsTop - 14;
    return T;
  }
  // wide: art on the left, a card of buttons on the right
  const tb = L.bands.tb, aw = clamp(U.w * 0.46, 420, 640), cardX = U.x1 - aw - 12, cardTop = tb + 8, cardBot = h - tb - 8;
  const lockW = Math.min(aw - 44, Math.max(0.28 * 720, 120 / Math.max(host.px, 1e-6))), lockH = Math.round(lockW / 3.67);
  const pitch = Math.min(88, (cardBot - cardTop - 20 - lockH - 14) / n), bh = pitch - 10, rowsH = n * pitch - (pitch - bh);
  const ry0 = cardTop + (cardBot - cardTop - rowsH - lockH - 14) / 2;
  T.rows = titleRowsAt(hasSave, cardX + 22, aw - 44, ry0, pitch, bh);
  T.card = R(cardX, cardTop, aw, cardBot - cardTop);
  T.lockup = { cx: cardX + aw / 2, top: ry0 + rowsH + 14, h: lockH };
  const leftX0 = U.x0 + 8, leftW = cardX - leftX0 - 8, lcx = leftX0 + leftW / 2;
  const zoneTop = Math.max(tb + 6, ins.back ? L.backBox.y + L.backBox.h : 0), zoneBot = h - tb - 6;
  const statsH = zoneBot - zoneTop > 600 ? 70 : 0;
  const sc = clamp(Math.min((leftW - 20) / HERO_W, (zoneBot - zoneTop - statsH - 20) / HERO_H), 0.4, 1.1), heroH = HERO_H * sc;
  const blockH = heroH + statsH + 18, top = zoneTop + Math.max(0, (zoneBot - zoneTop - blockH) / 2);
  T.hero = { cx: lcx, top, sc };
  if (statsH) T.stats = { x: lcx, y: top + heroH + 24, y2: top + heroH + 62 };
  T.msgY = zoneBot - 10; T.msgX = lcx;
  return T;
}

// ---- Settings -----------------------------------------------------------------------------------------------------------------
function buildSettings(L) {
  const { w, h, U, ins, oy } = L, keys = ['level', 'sound', 'calm', 'big', 'seeds', 'wood'], S = { rows: {} };
  if (L.tall) {
    S.panel = R(40, 130 + oy, 640, 1130); S.title = { x: 360, y: 230 + oy, size: 70 };
    keys.forEach((k, i) => { S.rows[k] = R(70, 330 + oy + i * 100, 580, 84); });
    S.blurb = { x: 360, y: 980 + oy, w: 600, size: 26 }; S.seeds = { x0: 210, y: 1090 + oy, step: 38, sc: 1.5 };
    S.back = R(130, 1400 + oy, 460, 90); S.size = 30; return S;
  }
  const top0 = Math.max(L.bands.tb, ins.t) + 10, bot = h - Math.max(L.bands.tb, ins.b + 6) - 10, availH = bot - top0;
  if (!L.wide) {
    const k = clamp(availH / 1068, 0.6, 1), rowH = 84 * k, step = 100 * k, tH = 110 * k;
    S.panel = R(40, top0 - 4, 640, availH + 8); S.title = { x: 360, y: top0 + 76 * k, size: Math.round(70 * k) };
    keys.forEach((kk, i) => { S.rows[kk] = R(70, top0 + tH + 6 + i * step, 580, rowH); });
    const yb = top0 + tH + 6 + 6 * step;
    S.blurb = { x: 360, y: yb + 22 * k, w: 600, size: Math.round(26 * Math.max(k, 0.85)) }; S.seeds = { x0: 210, y: yb + 84 * k, step: 38, sc: 1.5 * k };
    S.back = R(130, bot - 90 * k, 460, 90 * k); S.size = Math.round(30 * Math.max(k, 0.8)); return S;
  }
  const pw = Math.min(U.w - 40, 900), px = U.x0 + (U.w - pw) / 2, titleH = 76;
  const rowH = clamp((availH - titleH - 30 - 110 - 4 * 14) / 4, 52, 80), cw = (pw - 60 - 16) / 2;
  S.panel = R(px, top0 - 6, pw, availH + 12); S.title = { x: px + pw / 2, y: top0 + 56, size: 54 };
  keys.forEach((kk, i) => { S.rows[kk] = R(px + 30 + (i % 2) * (cw + 16), top0 + titleH + Math.floor(i / 2) * (rowH + 14), cw, rowH); });
  const yb = top0 + titleH + 3 * (rowH + 14);
  S.blurb = { x: px + pw / 2, y: yb + 20, w: pw - 80, size: 24 }; S.seeds = { x0: px + pw / 2 - 150, y: yb + 70, step: 38, sc: 1.4 };
  S.back = R(px + pw / 2 - 170, bot - Math.max(56, rowH), 340, Math.max(56, rowH)); S.size = 28; return S;
}

// ---- About / Rules reference pages: a framed panel, a scrolling body, text-size stepper, Back / Next ----------------------------
function buildReader(L) {
  const { w, h, U, ins, wide } = L, tb = L.bands.tb;
  const top = Math.max(ins.t, wide ? tb : 92) + 8 + (L.tall ? 12 : 0), navH = L.tall ? 84 : 72;
  const navY = h - Math.max(ins.b + 12, wide ? tb + 10 : L.tall ? 78 : tb + 6) - navH;
  const pw = wide ? Math.min(U.w - 40, 1000) : w - 72, px = U.x0 + (U.w - pw) / 2;
  const hdrH = wide ? 70 : 90, panel = R(px, top, pw, navY - 14 - top);
  // bottom row: Back | A- | A+ | Next
  const gp = 12, bw = Math.min(190, (U.w - 40 - 2 * 92 - 3 * gp) / 2), sw = 92, tot = 2 * bw + 2 * sw + 3 * gp, nx = U.x0 + (U.w - tot) / 2;
  const viewport = R(panel.x + 30, panel.y + hdrH, panel.w - 60 - 16, panel.h - hdrH - 40);
  return {
    panel, viewport, titleY: panel.y + (wide ? 54 : 70), titleSize: wide ? 46 : 60, hdrH,
    back: R(nx, navY, bw, navH), textDec: R(nx + bw + gp, navY, sw, navH), textInc: R(nx + bw + gp + sw + gp, navY, sw, navH), next: R(nx + bw + 2 * gp + 2 * sw, navY, bw, navH),
    scrollbar: R(panel.x + panel.w - 28, viewport.y, 16, viewport.h), counterY: panel.y + panel.h - 14, cx: panel.x + panel.w / 2,
    twoCol: wide && viewport.w >= 700,
  };
}

// ---- result screens (You win / Auto Play complete): a text group (canonical units {cx, top, sc}; canonical y 440 = top) + buttons -----
function buildOver(L) {
  const { w, h, U, ins, oy } = L;
  if (L.tall) return { group: { cx: 360, top: 440 + oy, sc: 1 }, again: R(130, 1000 + oy, 460, 96), back: R(130, 1120 + oy, 460, 96) };
  if (!L.wide) {
    const topMin = Math.max(ins.t, 24) + 10, botMax = h - Math.max(ins.b, 24) - 10, sc = clamp((botMax - topMin - 250) / 500, 0.5, 1);
    const tot = 500 * sc + 250, y0 = topMin + Math.max(0, (botMax - topMin - tot) / 2), by = y0 + 500 * sc + 40;
    return { group: { cx: w / 2, top: y0, sc }, again: R(130, by, 460, 90), back: R(130, by + 106, 460, 84) };
  }
  const lcx = U.x0 + U.w * 0.27, rcx = U.x0 + U.w * 0.73, sc = clamp(Math.min((U.h - 70) / 500, (U.w * 0.5 - 30) / 700), 0.5, 1), bw = Math.min(440, U.w * 0.36);
  return { group: { cx: lcx, top: h / 2 - 250 * sc, sc }, again: R(rcx - bw / 2, h / 2 - 100, bw, 90), back: R(rcx - bw / 2, h / 2 + 16, bw, 84) };
}

// ---- back-compat exports for tests: the approved phone-portrait layout (720 x 1560) ------------------------------------------------
const PHONE = layoutFor(720, 1560);
export const BTN = PHONE.BTN;
export const titleRows = (hasSave) => PHONE.title(hasSave).rows;
export const pitNear = (x, y) => PHONE.pitNear(x, y);

// Tap zone of the Arcforge lockup (title screen): at least 44 x 44 css px, grown sideways/downwards only.
export const creditHit = (T) => { const lw = T.h * 3.67, m = 44 / Math.max(host.px, 1e-6), w = Math.max(lw, m), h = Math.max(T.h, m); return { x: Math.round(T.cx - w / 2), y: Math.round(T.top), w: Math.round(w), h: Math.round(h) }; };
