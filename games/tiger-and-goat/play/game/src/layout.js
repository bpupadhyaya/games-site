// Geometry, as a function of the LIVE screen size (kit 1.7.0 fluid viewport: the short side is always 720 units).
// `layoutFor(w, h)` returns every position for that size; it is cached, so a frame never recomputes it. Three shapes:
//   tall    portrait phone (h >= 1540): the approved phone look, unchanged (board anchored near the bottom).
//   compact portrait, shorter than a phone (tablets, small phones): header on top, board centred, bar below.
//   wide    landscape: a card on the left (status, goats), the board in the middle, a card on the right (buttons).
// The board is a plane seen in perspective: board coordinates (u, v), u in -2..2 (columns) and v in 0..4 (rows, 0 = far side).
// A true projective map, so straight lines stay straight. The whole board scales uniformly with `board.s`.
export const THINK_STEPS = [2, 5, 8, 10];
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, kind: '', px: 0.6 };   // px: css pixels per virtual unit (text never shrinks below ~11 css px)   // kind: dev override 'flat' | 'tilt' (?dev=1&kind=flat)

// Canonical board (the approved phone board, 138-unit columns). Two projections share it: 'tilt' = the approved slight perspective
// (row pitch 148.5 at the near edge, K = 0.045) and 'flat' = a true square grid (K = 0, row pitch = column pitch). A board layer is painted once per
// (wood, projection) in canonical coordinates (x 0..720, y around YN = 1335) and drawn scaled.
// top / bottom / boxTop are distances above / below the near row (YN): `top` includes headroom for standing pieces, `boxTop` is the frame.
export const CANON = { D: 138, YN: 1335, CX: 360 };
export const KINDS = {
  tilt: { K: 0.045, R0: 148.5, layer: { x: -30, y: 760, w: 780, h: 720 }, bbW: 696, bbH: 666, top: 561, bottom: 105, boxTop: 553, halfW: 348 },
  flat: { K: 0, R0: 138, layer: { x: -30, y: 690, w: 780, h: 790 }, bbW: 692, bbH: 721, top: 622, bottom: 99, boxTop: 617, halfW: 346 },
};

const cache = new Map();
export function layoutFor(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}|${host.kind}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }); L.key = key; cache.set(key, L); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  return L;
}

const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function build(w, h, ins) {
  const land = w >= h, tall = !land && h >= 1540, mode = land ? 'wide' : tall ? 'tall' : 'compact';
  const L = { w, h, land, tall, mode, ins };
  const backSz = ins.back ? Math.max(ins.back, 56) : 0;
  L.backBox = ins.back ? R(ins.l, ins.t, backSz + 8, backSz + 8) : R(0, 0, 0, 0);
  const U = L.U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b };   // the area clear of notch / home indicator
  U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  // a landscape screen too square for a side-by-side title / result (e.g. a 1:1 split window) is laid out like a portrait one
  L.narrow = land && U.x1 - clamp(w * 0.5, 440, 720) - 16 - U.x0 - 8 < 330;
  const oy = L.oy = land && !L.narrow ? 0 : (h - 1560) / 2;                 // vertical centring of the phone-shaped screens

  // ---- bottom button bar (portrait) ------------------------------------------------------------------------------------
  const bottomLift = Math.max(0, ins.b - 16);
  const barY = L.barY = h - 98 - bottomLift;
  const barH = 72;

  // ---- the board -------------------------------------------------------------------------------------------------------
  // A flat square grid is preferred (the 5x5 board is square); the approved slight tilt is kept where it is clearly larger (phone portrait).
  const g = 12, Lmin = 184, Rmin = 128;
  const sizeFor = (kind, freeW, freeH) => { const k = KINDS[kind], s = Math.min(1, freeW / k.bbW, freeH / k.bbH); return { kind, s, size: s * Math.sqrt(k.bbW * k.bbH) }; };
  const pick = (freeW, freeH) => { if (ins.kind === 'flat' || ins.kind === 'tilt') return sizeFor(ins.kind, freeW, freeH); const f = sizeFor('flat', freeW, freeH), t = sizeFor('tilt', freeW, freeH); return f.size >= 0.92 * t.size ? f : t; };
  let choice, cx, top, Lw = 0, Rw = 0;                 // top = screen y of the canonical bbox top
  if (tall) { choice = sizeFor('tilt', w, 9999); cx = w / 2; top = barY - 127 - KINDS.tilt.top; }
  else if (!land) {
    // +30 on top: the head icon rises above its row
    L.top = Math.max(14, ins.t + 6) + 30; L.dy = ins.back ? Math.max(0, L.backBox.y + L.backBox.h + 6 - (L.top + 66)) : 0; L.HB = L.top + 278 + L.dy;
    const freeH = barY - 6 - L.HB; choice = pick(w - 16, freeH);
    cx = w / 2; top = L.HB + (freeH - KINDS[choice.kind].bbH * choice.s) / 2;
  } else {
    choice = pick(U.w - Lmin - Rmin - 2 * g, U.h - 24);
    const bw = KINDS[choice.kind].bbW * choice.s, sym = (U.w - bw) / 2 - g;
    if (sym >= Lmin && sym >= Rmin) { Lw = Rw = sym; }
    else { const extra = Math.max(0, U.w - bw - 2 * g - Lmin - Rmin); Lw = Lmin + extra / 2; Rw = Rmin + extra / 2; }
    cx = U.x0 + Lw + g + bw / 2;
    top = U.y0 + (U.h - KINDS[choice.kind].bbH * choice.s) / 2;
  }
  const bs = choice.s, kind = choice.kind, kd = KINDS[kind], yNear = top + kd.top * bs;
  const D = CANON.D * bs, R0 = kd.R0 * bs, UNIT = D / 126;
  const project = (u, v) => { const z = 1 + kd.K * (4 - v); return { x: cx + (u * D) / z, y: yNear - (R0 * (4 - v)) / z, s: 1 / z }; };
  const pts = Array.from({ length: 25 }, (_, i) => project((i % 5) - 2, Math.floor(i / 5)));
  L.board = {
    kind, s: bs, cx, yNear, D, R0, UNIT, project, pieceR: 45 * UNIT, aspect: (kd.halfW * 2) / (kd.boxTop + kd.bottom),
    box: { x0: cx - kd.halfW * bs, x1: cx + kd.halfW * bs, y0: yNear - kd.boxTop * bs, y1: yNear + kd.bottom * bs },
    head: { x0: cx - kd.halfW * bs, x1: cx + kd.halfW * bs, y0: yNear - kd.top * bs, y1: yNear + kd.bottom * bs },
  };
  L.pointAt = (i) => pts[i];
  L.pointNear = (x, y) => {
    let best = -1, bd = Infinity;
    for (let i = 0; i < 25; i++) { const p = pts[i], d = Math.min(Math.hypot(p.x - x, p.y - y), Math.hypot(p.x - x, p.y - 26 * bs * p.s - y)); if (d < bd) { bd = d; best = i; } }
    return bd < Math.max(46, 62 * bs) ? best : -1;
  };

  // ---- buttons while playing / lessons / puzzles / results -------------------------------------------------------------
  const BTN = L.BTN = {};
  if (!land) {
    Object.assign(BTN, {
      menu: R(60, barY, 190, barH), undo: R(265, barY, 190, barH), hint: R(470, barY, 190, barH),
      auto: { exit: R(30, barY, 154, barH), pause: R(198, barY, 154, barH), dec: R(366, barY, 154, barH), inc: R(534, barY, 154, barH) },
      next: R(265, barY, 395, barH), share: R(265, barY, 395, barH),
      again: R(140, 900 + oy, 440, 96), back: R(140, 1016 + oy, 440, 84),
    });
  } else {
    const cardTop = ins.back ? Math.max(U.y0 + 10, L.backBox.y + L.backBox.h + 4) : U.y0 + 10, cardH = U.y1 - 10 - cardTop;
    L.rightCard = R(U.x1 - Rw, cardTop, Rw - 8, cardH);
    L.leftCard = R(U.x0 + 8, cardTop, Lw - 8, cardH);
    // the right card is a computed vertical stack: 4 button slots, then (only if it truly fits) the brand badge, with guaranteed gaps
    const bw = clamp(Rw - 24, 100, 300), bx = U.x1 - Rw + (Rw - 8 - bw) / 2, badgeH = 112, pad = 14;
    let bh = Rw >= 200 ? 92 : 84, gap = 14, showBadge = true, avail = cardH - 2 * pad - badgeH - 12;
    if (4 * bh + 3 * gap > avail) { gap = 10; bh = Math.max(56, Math.min(bh, (avail - 3 * gap) / 4)); }
    if (4 * bh + 3 * gap > avail) { showBadge = false; avail = cardH - 2 * pad; bh = Math.max(56, Math.min(bh, (avail - 3 * gap) / 4)); }
    const ys = cardTop + pad + (avail - (4 * bh + 3 * gap)) / 2;
    L.badgeFits = showBadge;
    const slot = (i) => R(bx, ys + i * (bh + gap), bw, bh);
    Object.assign(BTN, {
      menu: slot(0), undo: slot(1), hint: slot(2), auto: { exit: slot(0), pause: slot(1), dec: slot(2), inc: slot(3) },
      next: slot(1), share: slot(1),
    });
    // the result screen splits like the title: art on the left, buttons on the right
    const aw = clamp(w * 0.5, 520, 720), ax = U.x1 - aw - 16, bw2 = Math.min(440, aw - 40), bx2 = ax + (aw - bw2) / 2;
    if (L.narrow) { BTN.again = R(w / 2 - 220, 900 + oy, 440, 96); BTN.back = R(w / 2 - 220, 1016 + oy, 440, 84); }
    else { BTN.again = R(bx2, h / 2 - 110, bw2, 96); BTN.back = R(bx2, h / 2 + 6, bw2, 84); }
  }

  // ---- the header furniture around the board ---------------------------------------------------------------------------
  const handN = 20;
  const hud = L.hud = { handScale: 0.95, capScale: 0.5 };
  if (tall) {
    Object.assign(hud, {
      title: { x: 410, y: 166, size: 40 }, icon: { x: 110, y: 404 }, turn: { x: 180, y: 384, size: 36, align: 'left', maxW: 500 },
      mode: { x: 180, y: 422, size: 23, align: 'left', maxW: 500 }, handLabel: { x: 64, y: 456, size: 26, align: 'left' }, capLabel: { x: 64, y: 654, size: 26, align: 'left' },
      hand: (k) => ({ x: 94 + (k % 10) * 59, y: 524 + Math.floor(k / 10) * 62, s: 1 }), cap: (k) => ({ x: 92 + k * 30, y: 704, s: 1 }),
      msg: { fixed: false, topY: ins.back ? Math.max(168, L.backBox.y + L.backBox.h + 8) : 168, x: 40, w: 640, maxW: 590, aboveY: 748 },
      lesson: { label: { x: 410, y: 130, size: 26, align: 'center' }, title: { x: 360, y: 250, size: 46, maxW: 640 }, body: { x: 50, y: 305, w: 620, h: 360, size: 29, bigSize: 34, lh: 40, align: 'center' } },
      puzzle: { label: { x: 410, y: 130, size: 26, align: 'center' }, icon: { x: 110, y: 300 }, title: { x: 180, y: 270, size: 40, maxW: 500 }, body: { x: 64, y: 337, w: 600, h: 112, size: 27, bigSize: 32, lh: 36, align: 'left' }, streak: { x: 64, y: 470, size: 26, align: 'left' }, cap: { x: 64, y: 520, size: 24, align: 'left' } },
    });
  } else if (!land) {
    const top = L.top, dy = L.dy, ix = Math.max(60, L.backBox.x + L.backBox.w + 36), rowA = top + 28;
    Object.assign(hud, {
      title: null, icon: { x: ix, y: rowA + 14 }, turn: { x: ix + 50, y: rowA + 6, size: 32, align: 'left', maxW: w - ix - 80 }, mode: { x: ix + 50, y: rowA + 38, size: 24, align: 'left', maxW: w - ix - 80 },
      handLabel: { x: 24, y: top + 176 + dy, size: 24, align: 'left' }, capLabel: { x: w - 24, y: top + 176 + dy, size: 24, align: 'right', maxW: w / 2 - 30 },
      hand: (k) => ({ x: 44 + k * ((w - 88) / 19), y: top + 212 + dy, s: 1 }), cap: (k) => ({ x: 40 + k * 30, y: top + 252 + dy, s: 1 }),
      handScale: 0.62, msg: { fixed: true, rect: R(24, top + 86 + dy, w - 48, 66), maxW: w - 80, size: 24, lh: 29 },
      lesson: { label: { x: w / 2, y: top + 26, size: 24, align: 'center' }, title: { x: w / 2, y: top + 72, size: 42, maxW: w - 60 }, body: { x: 24, y: top + 96 + dy, w: w - 48, h: L.HB - top - 108 - dy, size: 27, bigSize: 30, lh: 34, align: 'center' } },
      puzzle: { label: { x: w / 2, y: top + 26, size: 24, align: 'center' }, icon: { x: ix, y: top + 96 }, title: { x: ix + 54, y: top + 82, size: 36, maxW: w - ix - 90 }, body: { x: 24, y: top + 124 + dy, w: w - 48, h: 84, size: 26, bigSize: 28, lh: 32, align: 'left' }, streak: { x: 24, y: top + 256 + dy, size: 24, align: 'left' }, cap: { x: w - 24, y: top + 256 + dy, size: 22, align: 'right', maxW: w / 2 - 30 } },
    });
  } else {
    const c = L.leftCard, cw = c.w, inner = cw - 24, cxL = c.x + cw / 2, top = c.y + 12;
    const sp0 = cw < 260 ? 34 : cw < 360 ? 40 : 46, ccols = Math.max(4, Math.min(20, Math.floor(inner / 22))), crows = Math.ceil(handN / ccols), csp = Math.min(30, inner / ccols);
    // stack the status block, goat hand, captured row and message; squeeze (k < 1) on short cards until the message keeps >= 100 units
    let K = null;
    for (const k of [1, 0.85, 0.72, 0.6]) {
      const sp = Math.max(24, sp0 * k), cols = Math.max(3, Math.min(10, Math.floor(inner / sp))), hrows = Math.ceil(handN / cols);
      const hs = (sp / 46) * 0.72, hr = 49.3 * bs * 0.5 * hs, csr = 49.3 * bs * 0.25;
      const iconY = top + 80 * k, turnY = iconY + 62 * k, modeY = turnY + 62 * k, hl = modeY + 40 * k, hy = hl + 12 + hr * 1.6, cl = hy + (hrows - 1) * sp + 30 * k, cy0 = cl + 14 + csr * 1.6, msgTop = cy0 + (crows - 1) * (csp * 0.8) + 24 * k;
      K = { sp, cols, hs, iconY, turnY, modeY, hl, hy, cl, cy0, msgTop };
      if (c.y + c.h - 10 - msgTop >= 100) break;
    }
    const { sp, cols, hs, iconY, turnY, modeY, hl, hy, cl, cy0, msgTop } = K;
    Object.assign(hud, {
      title: null, icon: { x: cxL, y: iconY }, turn: { x: cxL, y: turnY, size: 28, align: 'center', maxW: inner, wrap: true }, mode: { x: cxL, y: modeY, size: 22, align: 'center', maxW: inner },
      handLabel: { x: cxL, y: hl, size: 23, align: 'center', maxW: inner }, capLabel: { x: cxL, y: cl, size: 23, align: 'center', maxW: inner }, handScale: hs,
      hand: (k) => ({ x: cxL - ((Math.min(cols, handN) - 1) * sp) / 2 + (k % cols) * sp, y: hy + Math.floor(k / cols) * sp, s: 1 }),
      cap: (k) => ({ x: cxL - ((Math.min(ccols, handN) - 1) * csp) / 2 + (k % ccols) * csp, y: cy0 + Math.floor(k / ccols) * csp * 0.8, s: 1 }),
      msg: { fixed: true, rect: R(c.x + 8, msgTop, cw - 16, Math.max(80, c.y + c.h - 10 - msgTop)), maxW: cw - 40, size: cw < 260 ? 23 : 25, lh: cw < 260 ? 28 : 31, min: 21 },
      lesson: { label: { x: cxL, y: top + 28, size: 24, align: 'center' }, title: { x: cxL, y: top + 72, size: 34, maxW: inner }, body: { x: c.x + 10, y: top + 92, w: cw - 20, h: c.y + c.h - top - 104, size: 25, bigSize: 28, lh: 31, align: 'center' } },
      puzzle: { label: { x: cxL, y: top + 28, size: 24, align: 'center' }, icon: { x: cxL, y: top + 96 }, title: { x: cxL, y: top + 168, size: 30, maxW: inner, center: true }, body: { x: c.x + 10, y: top + 190, w: cw - 20, h: Math.max(140, c.y + c.h - top - 300), size: 24, bigSize: 27, lh: 30, align: 'center' }, streak: { x: cxL, y: c.y + c.h - 78, size: 24, align: 'center', maxW: inner }, cap: { x: cxL, y: c.y + c.h - 42, size: 22, align: 'center', maxW: inner } },
    });
  }

  const titleCache = {};
  L.title = (hasSave) => (titleCache[hasSave ? 1 : 0] ??= buildTitle(L, !!hasSave));
  L.look = buildLook(L);
  L.over = buildOver(L);
  L.rules = buildRules(L);
  return L;
}

// Title rows: the phone's single column (kept exactly), or a two-column grid for every other shape.
function buildTitle(L, hasSave) {
  const { w, h, U, oy, ins } = L, T = { hero: null, rows: {}, badges: null, dim: null, card: null };
  if (L.tall) {
    const names = (hasSave ? ['resume'] : []).concat(['learn', 'goats', 'tigers', 'two', 'daily']), n = names.length;
    let base = 770 + oy; const need = n * 78 + 4 + 70 * 2 + 62 + 30 + 72, avail = h - Math.max(24, ins.b + 8) - base;
    const shift = Math.min(Math.max(0, need - avail), 48), f = Math.min(1, (avail + shift) / need);
    const rowH = 68 * f, rowP = 78 * f, smH = 62 * f, smP = 70 * f;
    base -= shift;
    names.forEach((nm, i) => { T.rows[nm] = R(90, base + i * rowP, 540, rowH); });
    const y = base + n * rowP + 4 * f;
    T.rows.level = R(90, y, 262, smH); T.rows.sound = R(368, y, 262, smH);
    T.rows.marks = R(90, y + smP, 262, smH); T.rows.calm = R(368, y + smP, 262, smH);
    T.rows.look = R(90, y + 2 * smP, 262, smH); T.rows.rules = R(368, y + 2 * smP, 262, smH);
    T.rows.auto = R(90, T.rows.look.y + smH + 30 * f, 540, 72 * f);
    T.hero = { sc: 1, hx: 0, hy: oy, dx: 50 };
    const by = T.rows.auto.y + T.rows.auto.h + 24;
    if (by + 40 <= h - Math.max(10, ins.b)) T.badges = { rows: [{ label: 'Goats', side: 'G', x: 96, y: by }, { label: 'Tigers', side: 'T', x: 396, y: by }], games: { x: w / 2, y: by + 40 } };
    T.dim = R(0, Math.min(760 + oy, base - 10), w, h); T.dim.h = h - T.dim.y; T.msgY = T.dim.y - 12; T.drawBoard = true;
    return T;
  }
  const names = [['resume'], ['learn'], ['goats', 'tigers'], ['two', 'daily'], ['level', 'sound'], ['marks', 'calm'], ['look', 'rules'], ['auto']].filter((r) => hasSave || r[0] !== 'resume');
  const n = names.length;
  const place = (x0, aw, y0, pitch, bh) => names.forEach((row, i) => {
    const y = y0 + i * pitch;
    if (row.length === 1) T.rows[row[0]] = R(x0, y, aw, bh);
    else { const cw = (aw - 14) / 2; T.rows[row[0]] = R(x0, y, cw, bh); T.rows[row[1]] = R(x0 + cw + 14, y, cw, bh); }
  });
  if (!L.land || L.narrow) {                                               // compact portrait: art on top, two-column grid below
    const pitch = L.land ? Math.min(78, (h * 0.62) / n) : 78, bh = pitch - 10, rowsH = n * pitch, y0 = h - Math.max(24, ins.b + 8) - rowsH + (pitch - bh);
    place(U.x0 + 40, U.w - 80, y0, pitch, bh);
    const zone = y0 - 16, topPad = Math.max(10, ins.t + 6);
    let sc = clamp((zone - topPad - 100) / 520, 0, 1); const room = sc >= 0.5;
    if (!room) sc = clamp((zone - topPad) / 520, 0.4, 1);
    const hy = topPad + (zone - topPad - (room ? 100 : 0) - 520 * sc) / 2 - 105 * sc;
    T.hero = { sc, hx: (w - 720 * sc) / 2, hy, dx: 0 };
    if (room) { const by = hy + 640 * sc + 30; T.badges = { rows: [{ label: 'Goats', side: 'G', x: w / 2 - 290, y: by }, { label: 'Tigers', side: 'T', x: w / 2 + 20, y: by }], games: { x: w / 2, y: by + 40 } }; }
    T.dim = R(0, y0 - 14, w, h - y0 + 14); T.msgY = y0 - 28; T.drawBoard = false;
    return T;
  }
  // wide: art on the left, a card of buttons on the right
  const aw = clamp(w * 0.5, 440, 720), ax = U.x1 - aw - 16, pitch = Math.min(86, (U.h - 36) / n), bh = pitch - 12, y0 = U.y0 + (U.h - n * pitch) / 2 + (pitch - bh) / 2;
  place(ax + 20, aw - 40, y0, pitch, bh);
  T.card = R(ax, y0 - 22, aw, n * pitch + 12);
  const leftW = ax - U.x0 - 8, lcx = U.x0 + leftW / 2;
  const sc = clamp(Math.min((leftW - 48) / 600, (U.h - 120) / 520), 0.28, 1.15);
  T.hero = { sc, hx: lcx - 348 * sc, hy: U.y0 + U.h / 2 - 365 * sc - 20, dx: 0 };
  const by = T.hero.hy + 680 * sc;
  if (by + 120 < U.y1) T.badges = { rows: [{ label: 'Goats', side: 'G', x: lcx - 150, y: by }, { label: 'Tigers', side: 'T', x: lcx - 150, y: by + 40 }], games: { x: lcx, y: by + 90 }, stack: true };
  T.msgY = U.y1 - 20; T.msgX = lcx; T.drawBoard = false;
  return T;
}

// The 'Board and pieces' screen: three board woods, two piece sets, back.
function buildLook(L) {
  const { w, h, U, oy } = L;
  if (L.tall) return {
    hero: { sc: 1, hx: 0, hy: oy, dx: 50 }, drawBoard: true, dim: R(0, 760 + oy, w, h - 760 - oy),
    labels: [{ t: 'Board', x: 90, y: 786 + oy, align: 'left' }, { t: 'Pieces', x: 90, y: 946 + oy, align: 'left' }],
    woods: [0, 1, 2].map((i) => R(90 + i * 184, 800 + oy, 172, 76)), sets: [0, 1].map((i) => R(90 + i * 278, 960 + oy, 262, 76)),
    back: R(140, 1120 + oy, 440, 84), msg: { x: 360, y: 1236 + oy, w: 620 }, wins: { x: 360, y: 1420 + oy },
  };
  const stack = (x0, aw, y0) => {
    const cw3 = (aw - 24) / 3, cw2 = (aw - 16) / 2;
    return {
      labels: [{ t: 'Board', x: x0, y: y0, align: 'left' }, { t: 'Pieces', x: x0, y: y0 + 130, align: 'left' }],
      woods: [0, 1, 2].map((i) => R(x0 + i * (cw3 + 12), y0 + 16, cw3, 76)), sets: [0, 1].map((i) => R(x0 + i * (cw2 + 16), y0 + 146, cw2, 76)),
      back: R(x0 + (aw - Math.min(aw, 440)) / 2, y0 + 258, Math.min(aw, 440), 84), msg: { x: x0 + aw / 2, y: y0 + 380, w: aw - 20 }, wins: { x: x0 + aw / 2, y: y0 + 470 },
    };
  };
  if (!L.land || L.narrow) {
    const total = 480, y0 = h - Math.max(24, L.ins.b + 8) - total, zone = y0 - 24, topPad = Math.max(10, L.ins.t + 6);
    const sc = clamp((zone - topPad) / 520, 0.4, 1);
    return { hero: { sc, hx: (w - 720 * sc) / 2, hy: topPad + (zone - topPad - 520 * sc) / 2 - 105 * sc, dx: 0 }, drawBoard: false, dim: null, ...stack(U.x0 + 40, U.w - 80, y0 + 14) };
  }
  const aw = clamp(w * 0.5, 520, 720), ax = U.x1 - aw - 16, leftW = ax - U.x0 - 8, lcx = U.x0 + leftW / 2;
  const sc = clamp(Math.min((leftW - 48) / 600, (U.h - 120) / 520), 0.4, 1.15), y0 = U.y0 + (U.h - 500) / 2 + 20;
  return { hero: { sc, hx: lcx - 348 * sc, hy: U.y0 + U.h / 2 - 365 * sc - 20, dx: 0 }, drawBoard: false, dim: null, card: R(ax, y0 - 40, aw, 530), ...stack(ax + 20, aw - 40, y0) };
}

// Result screen: heading block in canonical (phone) coordinates, translated to where it belongs.
function buildOver(L) {
  const { w, h, U } = L;
  if (!L.land || L.narrow) return { sc: 1, tx: 0, ty: L.oy, cx: w / 2, drawBoard: true };
  const aw = clamp(w * 0.5, 520, 720), ax = U.x1 - aw - 16, leftW = ax - U.x0 - 8, lcx = U.x0 + leftW / 2;
  const sc = clamp(Math.min((leftW - 24) / 640, (U.h - 100) / 560), 0.5, 1);
  return { sc, tx: lcx - 360 * sc, ty: h / 2 - 610 * sc, cx: lcx, drawBoard: false, card: R(ax, h / 2 - 150, aw, 330) };
}

// Rules reference: one framed panel (header with the text-size stepper, a scrolling body, page counter) and Back / Next.
function buildRules(L) {
  const { h, U, ins } = L, barY = L.land ? h - 98 - Math.max(0, ins.b - 16) : L.barY, barH = 72;
  const pw = Math.min(U.w - 60, 960), px = U.x0 + (U.w - pw) / 2, py = Math.max(24, ins.t + 8);
  const panel = R(px, py, pw, barY - 16 - py);
  const nw = Math.min(262, (pw - 16) / 2), navX = U.x0 + (U.w - (2 * nw + 16)) / 2;
  const viewport = R(panel.x + 20, panel.y + 92, panel.w - 40 - 14, panel.h - 92 - 52);
  return {
    panel, viewport, nav: { back: R(navX, barY, nw, barH), next: R(navX + nw + 16, barY, nw, barH) },
    header: { textDec: R(panel.x + panel.w - 24 - 110 - 12 - 110, panel.y + 12, 110, 66), textInc: R(panel.x + panel.w - 24 - 110, panel.y + 12, 110, 66) },
    scrollbar: R(panel.x + panel.w - 30, viewport.y, 22, viewport.h), counterY: panel.y + panel.h - 24, textW: Math.min(viewport.w - 40, 820), cx: panel.x + panel.w / 2,
  };
}

// ---- test/back-compat exports: the approved phone-portrait layout (720 x 1560) ------------------------------------------
const PHONE = layoutFor(720, 1560);
export const pointAt = PHONE.pointAt;
export const titleRows = (hasSave) => PHONE.title(hasSave).rows;
export const BTN = PHONE.BTN, LOOK = PHONE.look, RULES_NAV = PHONE.rules.nav, RULES_HEADER = PHONE.rules.header;
