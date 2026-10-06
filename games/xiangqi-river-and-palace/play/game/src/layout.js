// Geometry, as a function of the LIVE screen size (kit 1.7 fluid viewport: the short side is always 720 units, the long side
// grows with the aspect ratio). `layoutFor(w, h)` returns the layout for that size; it is cached by size + safe insets.
//
// The BOARD is always drawn in its own canonical space (9 files x 10 ranks, points D apart, 712 x 764 incl. frame) under a
// transform { s, ox, oy } (screen = o + s * canonical), so all board code (pieces, glow, drag, animation) is size-independent.
// Everything else (title, plates, messages, buttons, reference pages, settings, result) is placed here, per shape:
//   stack  portrait (phones, tablets): header, top block, board, bottom block, message, buttons - top to bottom.
//          Tall phones keep the approved look; shorter screens shrink the board and the furniture to fit.
//   col    landscape: the board in the middle/right, the furniture in one or two cards beside it. The top-left corner
//          (host back button) is always left clear.
export const W = 720, H = 1560;                           // the original canvas, kept for reference (tests, tall phone proportions)
export const D = 76, GX = 56, GY = 372;                  // spacing, and the top-left point of the grid (canonical board space)
export const PIECE_R = 32;
export const BOARD = { x: 4, y: GY - 40, w: 712, h: 9 * D + 80 };
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const REVEAL_SECONDS = 2;
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };   // px: css pixels per virtual unit (text never below ~11 css px)

export function pointXY(sq, flip = false) {
  let x = sq % 9, y = (sq / 9) | 0;
  if (flip) { x = 8 - x; y = 9 - y; }
  return { x: GX + x * D, y: GY + y * D };
}
// Which board square a canonical board position means (nearest point), or -1
export function squareAt(px, py, flip = false) {
  let cx = Math.round((px - GX) / D), cy = Math.round((py - GY) / D);
  if (cx < 0 || cx > 8 || cy < 0 || cy > 9) return -1;
  if (Math.hypot(px - (GX + cx * D), py - (GY + cy * D)) > D * 0.62) return -1;
  if (flip) { cx = 8 - cx; cy = 9 - cy; }
  return cy * 9 + cx;
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const R_ = (x, y, w, h) => ({ x, y, w, h });
// Tap zone of the title lockup (>= 44 css px each way; sideways and downward only, never into the buttons above).
export function lockHit(L, T) {
  const c = T.credit, m = 44 / Math.max(0.05, host.px), w = Math.max(c.w, m), y = c.top - 2;
  return R_(c.x - w / 2, y, w, Math.max(c.w * 0.2725 + 2, Math.min(m, L.h - y)));
}
const BH = BOARD.h;                                      // 764

let lastKey = '', last = null;
export function layoutFor(w, h) {
  const key = `${Math.round(w)}x${Math.round(h)}|${host.t},${host.r},${host.b},${host.l},${host.back}`;
  if (key !== lastKey) { last = build(w, h); lastKey = key; }
  return last;
}

function build(w, h) {
  const pad = 16;
  const S = { x0: host.l + pad, x1: w - host.r - pad, y0: host.t + 10, y1: h - host.b - 14 };
  S.w = S.x1 - S.x0; S.h = S.y1 - S.y0;
  const wide = w >= h * 1.12;
  const backZone = host.back > 0 ? host.l + host.back + 24 : 0;          // x the back button reaches
  const backH = host.back > 0 ? host.back + 8 : 0;                         // y-extent below S.y0 the back button needs
  const cache = new Map();
  const memo = (k, f) => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k); };
  const L = { w, h, wide, S, backZone, backH, mode: wide ? 'col' : 'stack', key: `${w}x${h}` };
  const cx = (S.x0 + S.x1) / 2;
  // Lanterns hang at the top corners; the left one steps right when the host back button is there.
  L.lanternX = host.back > 0 ? [190, 530] : [110, 610];

  // ---------------------------------------------------------------- board scenes
  // kind: 'play' | 'lesson' | 'puzzle' | 'auto'
  L.board = (kind) => memo('b' + kind, () => (wide ? boardCols(kind) : boardStack(kind)));

  const makeXf = (bx, by, bw, bh) => {
    const s = Math.min(1, bh / BH, bw / BOARD.w);
    return { s, ox: bx + (bw - BOARD.w * s) / 2 - BOARD.x * s, oy: by + (bh - BH * s) / 2 - BOARD.y * s };
  };

  function boardStack(kind) {
    const lesson = kind === 'lesson' || kind === 'puzzle', hasBot = !lesson, auto = kind === 'auto';
    const colW = Math.min(S.w, 640), cl = cx - colW / 2;
    const gap = 10;
    let head = Math.max(88, backH), stp = auto ? 52 : 0;
    let A = lesson ? 176 : 76, M = lesson ? 120 : 100, B = hasBot ? 76 : 0, C = 64;
    const gaps = (stp ? 1 : 0) + 1 + 1 + (hasBot ? 1 : 0) + 1 + 1;   // head|stp, stp|A, A|board, board|B, B|M, M|C
    const fixed = head + stp + A + B + M + C + gap * gaps;
    let free = S.h - fixed - BH, s = 1;
    if (free < 0) { s = clamp((BH + free) / BH, 0.3, 1); free = 0; }
    else {
      const gM = Math.min(free * 0.5, (lesson ? 290 : 190) - M); M += gM; free -= gM;
      const gH = Math.min(free * 0.5, 40); head += gH; free -= gH;
      const gP = Math.min(free * 0.5, 12); A += gP; if (hasBot) B += gP; free -= gP * (hasBot ? 2 : 1);
    }
    const gp = Math.min(gap + free / gaps, 34);
    const total = head + stp + A + B + M + C + gp * gaps + BH * s;
    let y = S.y0 + Math.max(0, (S.h - total) / 2) * 0.5;
    const out = { kind, mode: 'stack', s, flipSafe: true };
    out.head = { x: cx, y: y + head * 0.72 - (head > 100 ? 4 : 0), size: head >= 100 ? 58 : 46, align: 'center', sub: { x: cx, y: y + head * 0.72 + 30 } };
    y += head + gp;
    if (stp) { out.stepper = { dec: R_(cx - 190, y, 90, stp), inc: R_(cx + 100, y, 90, stp), label: { x: cx, y: y + stp * 0.66, size: 24 } }; y += stp + gp; }
    out.top = R_(cl, y, colW, A); y += A + gp;
    const bh = BH * s;
    const xf = makeXf(host.l + 2, y, w - host.l - host.r - 4, bh); Object.assign(out, xf); out.boardRect = R_(xf.ox + BOARD.x * xf.s, xf.oy + BOARD.y * xf.s, BOARD.w * xf.s, bh);
    y += bh + gp;
    if (hasBot) { out.bot = R_(cl, y, colW, B); y += B + gp; } else out.bot = null;
    out.msg = R_(cl, y, colW, M); y += M + gp;
    const bw3 = (colW - 28) / 3;
    out.btn = { menu: R_(cl, y, bw3, C), undo: R_(cl + bw3 + 14, y, bw3, C), hint: R_(cl + 2 * (bw3 + 14), y, bw3, C) };
    out.btnSingle = R_(cl + colW / 2 - 110, y, 220, C);
    out.lanterns = true; out.lanternScale = 0.62;
    out.tipInMsg = true;
    return out;
  }

  function boardCols(kind) {
    const lesson = kind === 'lesson' || kind === 'puzzle', hasBot = !lesson, auto = kind === 'auto';
    const s = Math.min(1, (S.h - 26) / BH), bw = BOARD.w * s, gap = 18;
    const Rm = S.w - bw - gap;
    const three = Rm - gap >= 640;
    let leftX, leftW, rightX = 0, rightW = 0, boardX;
    if (three) {
      rightW = Math.min(380, (Rm - gap) / 2); leftW = rightW; const total = bw + 2 * leftW + 2 * gap;
      leftX = S.x0 + (S.w - total) / 2; boardX = leftX + leftW + gap; rightX = boardX + bw + gap;
    } else {
      leftW = Math.min(540, Rm); const total = bw + gap + leftW;
      leftX = S.x0 + (S.w - total) / 2; boardX = leftX + leftW + gap;
    }
    const out = { kind, mode: 'col', s, three };
    const topPad = 26;   // keeps the kit's preview badge (top centre) off the board
    const xf = makeXf(boardX, S.y0 + topPad, bw, S.h - topPad); Object.assign(out, xf);
    out.boardRect = R_(xf.ox + BOARD.x * s, xf.oy + BOARD.y * s, bw, BH * s);
    const clash = host.back > 0 && leftX < backZone;
    const hdrH = clash ? backH : 60;
    out.head = { x: clash ? Math.max(leftX, backZone) : leftX, y: S.y0 + hdrH * 0.66, size: 40, align: 'left', sub: null, w: leftX + leftW - Math.max(leftX, clash ? backZone : leftX) };
    const g2 = 12;
    let y = S.y0 + hdrH + g2;
    const narrow = leftW < 420;
    const Cvert = narrow ? 3 * 56 + 2 * 10 : 64;
    const Ch = three ? 0 : Cvert + (kind === 'auto' ? 0 : 0);
    const stp = auto && !three ? 52 : 0;
    const plateH = leftW < 560 ? 112 : 88;
    let remain = S.y1 - y - Ch - (Ch ? g2 : 0) - (stp ? stp + g2 : 0);
    const nBlocks = hasBot ? 3 : 2;       // A, (M), B
    remain -= g2 * (nBlocks - 1);
    let A, M, B = 0;
    if (hasBot) { A = plateH; B = plateH; M = Math.max(110, remain - A - B); }
    else { A = remain * 0.6; M = remain - A; }
    if (stp) { out.stepper = stepperAt(leftX, y, leftW, stp); y += stp + g2; }
    out.top = R_(leftX, y, leftW, A); y += A + g2;
    out.msg = R_(leftX, y, leftW, M); y += M + g2;
    out.bot = hasBot ? R_(leftX, y, leftW, B) : null; if (hasBot) y += B + g2;
    if (three) {
      const bw2 = Math.min(rightW, 340), bx = rightX + (rightW - bw2) / 2, bhh = 70, gg = 14;
      const nb = auto ? 1 : 3, th = nb * bhh + (nb - 1) * gg + (auto ? 52 + 30 : 0);
      let by = S.y0 + (S.h - th) / 2;
      if (auto) { out.stepper = stepperAt(bx, by, bw2, 52); by += 52 + 30; }
      if (auto) { out.btn = { menu: R_(bx, by, bw2, bhh), undo: R_(bx, by, bw2, bhh), hint: R_(bx, by, bw2, bhh) }; }
      else out.btn = { menu: R_(bx, by, bw2, bhh), undo: R_(bx, by + bhh + gg, bw2, bhh), hint: R_(bx, by + 2 * (bhh + gg), bw2, bhh) };
      out.btnSingle = out.btn.menu;
    } else if (narrow) {
      out.btn = { menu: R_(leftX, y, leftW, 56), undo: R_(leftX, y + 66, leftW, 56), hint: R_(leftX, y + 132, leftW, 56) };
      out.btnSingle = auto ? R_(leftX, y, leftW, 56) : out.btn.menu;
    } else {
      const bw3 = (leftW - 28) / 3;
      out.btn = { menu: R_(leftX, y, bw3, 64), undo: R_(leftX + bw3 + 14, y, bw3, 64), hint: R_(leftX + 2 * (bw3 + 14), y, bw3, 64) };
      out.btnSingle = R_(leftX, y, leftW, 64);
    }
    out.lanterns = false; out.plateWide = leftW >= 560;
    return out;
  }
  const stepperAt = (x, y, wd, hh) => { const bw = Math.min(90, wd * 0.26); return { dec: R_(x, y, bw, hh), inc: R_(x + wd - bw, y, bw, hh), label: { x: x + wd / 2, y: y + hh * 0.66, size: 24 } }; };

  // ---------------------------------------------------------------- title
  const LK_AR = 0.2725, lkW = (maxW) => Math.min(260, maxW);
  L.title = (hasSave) => memo('t' + hasSave, () => (wide ? titleCols(hasSave) : titleStack(hasSave)));

  function titleStack(hasSave) {
    const names = (hasSave ? ['resume'] : []).concat(['learn', 'red', 'black', 'two', 'daily', 'autoplay']);
    const n = names.length, rows = n + 4, g = 10, colW = Math.min(540, S.w), x = cx - colW / 2;
    const lw = lkW(colW), reserve = lw * LK_AR + 46, heroMin = 330;
    const hb = clamp((S.y1 - reserve - heroMin - (rows - 1) * g - 8) / rows, 50, 70);
    const blockH = rows * hb + (rows - 1) * g + 8, top = S.y1 - reserve - blockH;
    const out = { mode: 'stack', narrow: false, lanternX: L.lanternX };
    const hs = Math.min(1, top / 672);
    out.hero = { x: cx - 360 * hs, y: 0, s: hs };
    let y = top; names.forEach((nm) => { out[nm] = R_(x, y, colW, hb); y += hb + g; });
    y += 8 - g + g;     // small group break before the language row
    const half = (colW - 16) / 2;
    out.langZh = R_(x, y, half, hb); out.langEn = R_(x + half + 16, y, half, hb); y += hb + g;
    out.level = R_(x, y, half, hb); out.sound = R_(x + half + 16, y, half, hb); y += hb + g;
    const third = (colW - 28) / 3;
    out.how = R_(x, y, third, hb); out.about = R_(x + third + 14, y, third, hb); out.rules = R_(x + 2 * (third + 14), y, third, hb); y += hb + g;
    out.look = R_(x, y, colW, hb); y += hb;
    out.credit = { x: cx, y: y + 8 + lw * LK_AR, w: lw, top: y + 8 }; out.stats = { x: cx, y: S.y1 - 10 };
    return out;
  }

  function titleCols(hasSave) {
    const rw = Math.min(640, S.w * 0.52), x = S.x1 - rw, g = 10;
    const rows = (hasSave ? 1 : 0) + 6 + 1;
    const lw = lkW(rw), lh = lw * LK_AR, hb = clamp((S.h - 44 - lh - 14 - (rows - 1) * g) / rows, 44, 68);
    const out = { mode: 'col', narrow: rw < 560, lanternX: L.lanternX };
    const leftW = x - 24 - S.x0, hs = Math.min(1, leftW / 720, (S.y1 - 56) / 672);
    out.hero = { x: S.x0 + (leftW - 720 * hs) / 2, y: 0, s: hs };
    const half = (rw - 14) / 2, third = (rw - 20) / 3;
    let y = S.y0 + (S.h - 44 - lh - 14 - (rows * hb + (rows - 1) * g)) / 2;
    if (hasSave) { out.resume = R_(x, y, rw, hb); y += hb + g; }
    const pair = (a, b) => { out[a] = R_(x, y, half, hb); out[b] = R_(x + half + 14, y, half, hb); y += hb + g; };
    pair('learn', 'daily'); pair('red', 'black'); pair('two', 'autoplay'); pair('langZh', 'langEn'); pair('level', 'sound');
    out.how = R_(x, y, third, hb); out.about = R_(x + third + 10, y, third, hb); out.rules = R_(x + 2 * (third + 10), y, third, hb); y += hb + g;
    out.look = R_(x, y, rw, hb); y += hb;
    out.credit = { x: x + rw / 2, y: y + 8 + lh, w: lw, top: y + 8 }; out.stats = { x: x + rw / 2, y: Math.min(S.y1 - 10, y + 8 + lh + 30) };
    return out;
  }

  // ---------------------------------------------------------------- settings ("look")
  L.look = () => memo('look', () => {
    const out = { groups: [] };
    const keys = ['lang', 'boards', 'sets', 'text', 'calm', 'sound'];
    if (!wide) {
      const colW = Math.min(S.w, 584), x = cx - colW / 2, half = (colW - 16) / 2;
      const headH = Math.max(120, backH + 40), backBtnH = 66, g = 10;
      const piecesH = S.h - headH - backBtnH - 20 >= 6 * 140 + 120 ? 120 : 0;
      const avail = S.h - headH - backBtnH - 20 - piecesH;
      const pitch = clamp(avail / 6, 92, 140), bh = clamp(pitch - 40, 52, 76);
      out.head = { x: cx, y: S.y0 + headH * 0.7, size: 52, align: 'center' };
      out.showPieces = piecesH > 0; out.pieces = { y: S.y0 + headH + 30 };
      const y = S.y0 + headH + piecesH;
      keys.forEach((k, i) => { const top = y + i * pitch; out.groups.push({ key: k, label: { x: cx, y: top + 24, size: 24 }, rects: [R_(x, top + 36, half, bh), R_(x + half + 16, top + 36, half, bh)] }); });
      out.back = R_(cx - 220, Math.min(S.y1 - backBtnH, y + 6 * pitch + g), 440, backBtnH);
    } else {
      const colW = Math.min(S.w, 1000), x = cx - colW / 2, gap = 28, gw = (colW - gap) / 2, half = (gw - 14) / 2;
      out.head = { x: Math.max(S.x0, backZone), y: S.y0 + 44, size: 44, align: 'left' };
      const top0 = S.y0 + 78, backH2 = 62, pitch = Math.min(130, (S.y1 - top0 - backH2 - 14) / 3), bh = clamp(pitch - 44, 50, 70);
      keys.forEach((k, i) => {
        const col = i % 2, row = (i / 2) | 0, gx = x + col * (gw + gap), top = top0 + row * pitch;
        out.groups.push({ key: k, label: { x: gx + gw / 2, y: top + 24, size: 23 }, rects: [R_(gx, top + 34, half, bh), R_(gx + half + 14, top + 34, half, bh)] });
      });
      out.back = R_(cx - 200, S.y1 - backH2, 400, backH2);
    }
    return out;
  });

  // ---------------------------------------------------------------- How to play / About / Rules
  L.ref = () => memo('ref', () => {
    const out = {};
    const colW = Math.min(S.w, wide ? 1040 : 688), x = cx - colW / 2, fb = 62, g = 10, sb = 56, sw = 104;
    if (!wide) {
      const row1 = Math.max(sb, backH);
      out.inc = R_(S.x1 - sw, S.y0, sw, sb); out.dec = R_(S.x1 - 2 * sw - 10, S.y0, sw, sb);
      out.title = { x: cx, y: S.y0 + row1 + 44, size: 46, align: 'center', sub: { x: cx, y: S.y0 + row1 + 74 } };
      const top = S.y0 + row1 + 92;
      out.card = R_(x, top, colW, S.y1 - fb - g - top);
    } else {
      out.inc = R_(S.x1 - sw, S.y0, sw, sb); out.dec = R_(S.x1 - 2 * sw - 10, S.y0, sw, sb);
      out.title = { x: Math.max(S.x0, backZone), y: S.y0 + 38, size: 42, align: 'left', sub: { x: Math.max(S.x0, backZone) + 4, y: S.y0 + 66 } };
      const top = S.y0 + Math.max(sb, backH, 70) + 8;
      out.card = R_(x, top, colW, S.y1 - fb - g - top);
    }
    const half = (colW - 20) / 2;
    out.prev = R_(x, S.y1 - fb, half, fb); out.page = R_(x + half + 20, S.y1 - fb, half, fb);
    out.pad = 22;
    return out;
  });

  // ---------------------------------------------------------------- result panel (over the board)
  L.res = () => memo('res', () => {
    const out = {};
    if (!wide) {
      const pw = Math.min(580, S.w), ph = Math.min(700, S.h), px = cx - pw / 2, py = S.y0 + (S.h - ph) / 2;
      out.panel = R_(px, py, pw, ph);
      const bh = clamp((ph - 345 - 62 - 20) / 3, 52, 84);
      out.tag = { x: cx, y: py + 40 };
      out.piece = { x: cx, y: py + 125 + Math.max(0, ph - 600) * 0.1, scale: ph < 580 ? 1.4 : 1.8 };
      out.title = { x: cx, y: py + 255 + Math.max(0, ph - 600) * 0.15, max: pw - 40 };
      out.why = { x: cx, y: out.title.y + 46, max: pw - 90 };
      const bx = px + 50, bw = pw - 100, by = py + 345;
      out.again = R_(bx, by, bw, bh); out.look = R_(bx, by + bh + 10, bw, bh); out.menu = R_(bx, by + 2 * (bh + 10), bw, bh);
      out.more = { x: cx, y: py + ph - 20 };
    } else {
      const pw = Math.min(900, S.w), ph = Math.min(520, S.h), px = cx - pw / 2, py = S.y0 + (S.h - ph) / 2;
      out.panel = R_(px, py, pw, ph);
      const lw = pw * 0.5, lx = px + lw / 2;
      out.tag = { x: lx, y: py + 40 };
      out.piece = { x: lx, y: py + 130, scale: 1.6 };
      out.title = { x: lx, y: py + 250, max: lw - 30 };
      out.why = { x: lx, y: py + 296, max: lw - 50 };
      const bw = pw * 0.4, bx = px + pw - bw - 36, bh = 70, g = 12, by = py + (ph - 40 - 3 * bh - 2 * g) / 2;
      out.again = R_(bx, by, bw, bh); out.look = R_(bx, by + bh + g, bw, bh); out.menu = R_(bx, by + 2 * (bh + g), bw, bh);
      out.more = { x: cx, y: py + ph - 16 };
    }
    return out;
  });

  // ---------------------------------------------------------------- "free web version" screen
  L.demo = () => memo('demo', () => {
    const colW = Math.min(S.w - 40, 560);
    if (!wide) return { hero: { x: cx, y: S.y0 + 330 }, title: { x: cx, y: S.y0 + 620 }, body: { x: cx, y: S.y0 + 690, w: colW }, back: R_(cx - 220, Math.min(S.y1 - 84, S.y0 + 1000), 440, 84) };
    return { hero: { x: S.x0 + S.w * 0.25, y: S.y0 + S.h * 0.5 }, title: { x: S.x0 + S.w * 0.72, y: S.y0 + 200 }, body: { x: S.x0 + S.w * 0.72, y: S.y0 + 262, w: Math.min(S.w * 0.4, 560) }, back: R_(S.x0 + S.w * 0.72 - 220, S.y1 - 90, 440, 76) };
  });
  return L;
}
