// Screen geometry. One place for every rectangle so game.js (hit-testing) and view.js (drawing) never disagree.
//
// FLUID LAYOUT (kit 1.7.x): the view hands the game a LIVE virtual size (the short side is always 720 units, the long side
// follows the screen's aspect), so there is never a letterbox. `layoutFor(w, h)` is a pure function of that size (plus the
// host's safe-area insets) and returns every rectangle; it is cached by size.
//
// The board itself, the pieces, the title art and all their effects are authored in ONE canonical coordinate space (a 660-unit
// board at BOARD_X/BOARD_Y, a square SQ = 76). Each screen only decides WHERE that board sits and HOW BIG it is
// (`L.scene(kind).board`: scale s + screen position); drawing wraps the board in a translate/scale and pointer input is
// converted back with `board.toCanon`, so the board code is identical in every shape.
//
// Shapes: portrait = header, board, captured trays, move list, bar of buttons (the approved phone look; the move list shrinks or
// disappears on short screens); wide (landscape) = the board plus a card of status / trays / moves / buttons beside it (two cards
// flanking the board when there is room).
export const W = 720, H = 1280;            // the default (phone) size; the live size comes from meta.width / meta.height

export const FRAME = 26;           // the carved frame thickness, where coordinate labels live
export const SQ = 76;              // one square, in canonical units
export const INNER = SQ * 8;       // 608
export const BOARD_SIZE = INNER + FRAME * 2; // 660
export const BOARD_X = 30;
export const BOARD_Y = 140;
export const GRID_X = BOARD_X + FRAME;
export const GRID_Y = BOARD_Y + FRAME;
export const BOARD_BOTTOM = BOARD_Y + BOARD_SIZE;
export const TRAY_H = 46;

// square <-> canonical point. `flip` = true shows Black at the bottom (board rotated 180 degrees).
export function squareAt(x, y, flip) {
  if (x < GRID_X || x >= GRID_X + INNER || y < GRID_Y || y >= GRID_Y + INNER) return -1;
  let file = Math.floor((x - GRID_X) / SQ);
  let rankFromTop = Math.floor((y - GRID_Y) / SQ);
  let rank = 7 - rankFromTop;
  if (flip) { file = 7 - file; rank = 7 - rank; }
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return -1;
  return rank * 8 + file;
}
export function pointXY(sq, flip) {
  let file = sq & 7, rank = sq >> 3;
  if (flip) { file = 7 - file; rank = 7 - rank; }
  const rankFromTop = 7 - rank;
  return { x: GRID_X + file * SQ + SQ / 2, y: GRID_Y + rankFromTop * SQ + SQ / 2 };
}
export function squareTopLeft(sq, flip) {
  let file = sq & 7, rank = sq >> 3;
  if (flip) { file = 7 - file; rank = 7 - rank; }
  const rankFromTop = 7 - rank;
  return { x: GRID_X + file * SQ, y: GRID_Y + rankFromTop * SQ };
}

export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const THINK_STEPS = [2, 5, 8, 10];
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
// px = css pixels per virtual unit, so text never drops below ~11 css px (`fs`).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };
export const fs = (n) => Math.max(n, 11 / Math.max(0.2, host.px));

// The result overlay's "More from Arcforge" cross-promo row (env.openGame). This is a FREE game, so every entry must be a PAID
// game, never one of the app's other free games (see the standing regression test in test/game.test.js).
export const SIBLINGS = [
  { slug: 'tiger-and-goat', title: 'Tiger and Goat' },
  { slug: 'go-stones-and-territory', title: 'Go' },
  { slug: 'carrom-striker-and-queen', title: 'Carrom' },
  { slug: 'xiangqi-river-and-palace', title: 'Xiangqi' },
];

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
  const land = w > h;
  const U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b }; U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const backSz = ins.back ? Math.max(ins.back, 56) : 0;
  const L = { w, h, land, ins, U, mode: land ? 'wide' : 'portrait', backBox: ins.back ? R(ins.l, ins.t, backSz + 8, backSz + 8) : R(0, 0, 0, 0) };
  const scenes = {};
  L.scene = (kind) => (scenes[kind] ??= buildScene(L, kind));
  L.title = buildTitle(L);
  L.page = buildPage(L);
  L.result = buildResult(L);
  L.promo = buildPromo(L);
  return L;
}

// ---- the board's place on screen ------------------------------------------------------------------------------------------
function boardMap(bx, by, s) {
  return {
    s, bx, by, size: BOARD_SIZE * s, cx: bx + (BOARD_SIZE * s) / 2, cy: by + (BOARD_SIZE * s) / 2,
    toCanon: (x, y) => ({ x: BOARD_X + (x - bx) / s, y: BOARD_Y + (y - by) / s }),
    toScreen: (x, y) => ({ x: bx + (x - BOARD_X) * s, y: by + (y - BOARD_Y) * s }),
    sq: (sq, flip) => { const p = pointXY(sq, flip); return { x: bx + (p.x - BOARD_X) * s, y: by + (p.y - BOARD_Y) * s }; },
  };
}

// What each board scene shows. `bar` is the button order along a portrait bar; `grid` the order inside a side card.
const CFG = {
  play: { note: 34, noteW: 58, trays: true, moves: true, foot: false, bar: ['menu', 'flip', 'undo', 'hint', 'resign'], grid: ['menu', 'flip', 'undo', 'hint', 'resign'] },
  lesson: { note: 140, noteW: 0, trays: false, moves: false, foot: false, bar: ['menu', 'flip', 'hint', 'next'], grid: ['menu', 'flip', 'hint', 'next'] },
  demo: { note: 34, noteW: 58, trays: false, moves: true, foot: true, bar: ['exit', 'dec', 'pause', 'inc', 'speed'], grid: ['exit', 'speed', 'dec', 'inc', 'pause'] },
};

function buildScene(L, kind) {
  const c = CFG[kind];
  return L.land ? wideScene(L, c) : portraitScene(L, c);
}

function portraitScene(L, c) {
  const { U } = L, headH = 134, gap = 8, barH = 90, footH = c.foot ? 30 : 0, bottom = 12, traysH = c.trays ? 92 : 0;
  const fixedTop = headH + 6 + c.note + traysH, fixedBottom = barH + footH + bottom;
  const sMax = (U.w - 24) / BOARD_SIZE;
  const fitS = (movesH) => (U.h - fixedTop - fixedBottom - (movesH ? movesH + gap : 0) - gap) / BOARD_SIZE;
  let movesH = c.moves ? 96 : 0, s = Math.min(sMax, fitS(movesH));
  if (c.moves && s < Math.min(sMax, 1) * 0.88) { movesH = 0; s = Math.min(sMax, fitS(0)); }
  s = Math.max(0.3, s);
  const bw = BOARD_SIZE * s, barY = U.y1 - bottom - footH - barH;
  let slack = barY - gap - (U.y0 + fixedTop + bw + (movesH ? movesH + gap : 0));
  if (movesH) { const grow = Math.max(0, Math.min(slack, 300 - movesH)); movesH += grow; slack -= grow; }
  const y0 = U.y0 + Math.max(0, slack) * 0.4;
  const by = y0 + headH, bx = U.x0 + (U.w - bw) / 2;
  const S = { mode: 'portrait', board: boardMap(bx, by, s), cards: [] };
  S.head = { x: U.x0, y: y0, w: U.w, h: headH, cx: U.x0 + U.w / 2, titleY: y0 + 40, statusY: y0 + 78, captionY: y0 + 108, titleSize: 30, statusSize: 20, maxW: U.w - 2 * (L.ins.back ? 76 : 24) };
  let y = by + bw + 6;
  S.note = R(U.x0 + 14, y, U.w - 28, c.note); y += c.note;
  S.trays = c.trays ? { x: U.x0 + 30, y, w: U.w - 60, rows: 2 } : null; y += traysH;
  S.moves = movesH ? R(U.x0 + 30, y + (c.trays ? 0 : 0), U.w - 60, movesH) : null;
  const n = c.bar.length, inner = U.w - 40, bwid = (inner - (n - 1) * 12) / n;
  S.bar = {}; c.bar.forEach((k, i) => { S.bar[k] = R(U.x0 + 20 + i * (bwid + 12), barY + 0, bwid, barH); });
  S.foot = c.foot ? { x: U.x0 + U.w / 2, y: barY + barH + 22 } : null;
  S.toast = R(bx, by - 18, bw, 74);
  S.dirKey = c.bar;
  return S;
}

// Vertical stack inside a card: items are { k, h } (fixed) or { k, flex: true, min }. Returns { k: rect }.
function stack(card, items, pad = 12, gap = 8) {
  const n = items.length, innerH = card.h - 2 * pad - gap * (n - 1);
  let fixed = 0, flexN = 0;
  for (const it of items) { if (it.flex) { flexN++; fixed += it.min; } else fixed += it.h; }
  const extra = Math.max(0, innerH - fixed), out = {};
  let y = card.y + pad;
  for (const it of items) {
    const hh = it.flex ? it.min + extra / flexN : it.h;
    out[it.k] = R(card.x + pad, y, card.w - 2 * pad, hh); y += hh + gap;
  }
  return out;
}

function wideScene(L, c) {
  const { U, ins } = L, g = 14, minSide = 300;
  const topY = U.y0 + 10, cardH = U.h - 20;
  let s = Math.min((U.h - 20) / BOARD_SIZE, (U.w - 2 * g - minSide) / BOARD_SIZE);
  const place = (s0) => {
    const bw = BOARD_SIZE * s0, leftover = U.w - bw - 2 * g, two = leftover >= 640;
    const side = two ? Math.min(460, (leftover - g) / 2) : Math.min(520, leftover);
    const total = two ? side * 2 + bw + 2 * g : side + bw + g, x0 = U.x0 + (U.w - total) / 2;
    return { bw, two, side, x0, bx: two ? x0 + side + g : x0 };
  };
  let P = place(s);
  if (ins.back && P.bx < L.backBox.x + L.backBox.w + 4) {            // the board's corner would sit under the host back button
    s = Math.min(s, (U.y1 - 10 - (L.backBox.y + L.backBox.h + 4)) / BOARD_SIZE); P = place(s);
  }
  s = Math.max(0.3, s);
  const bw = BOARD_SIZE * s, by = ins.back && P.bx < L.backBox.x + L.backBox.w + 4 ? U.y1 - 10 - bw : U.y0 + (U.h - bw) / 2;
  const S = { mode: 'wide', board: boardMap(P.bx, by, s), cards: [] };
  const backBelow = ins.back ? Math.max(topY, L.backBox.y + L.backBox.h + 4) : topY;
  const rightCard = R(P.bx + bw + g, topY, P.side, cardH);
  S.toast = R(P.bx, by + 6, bw, 74);
  const headItem = { k: 'head', h: 118 };
  const putHead = (r) => {
    S.head = { x: r.x, y: r.y, w: r.w, h: r.h, cx: r.x + r.w / 2, titleY: r.y + 30, statusY: r.y + 66, captionY: r.y + 98, titleSize: 28, statusSize: 20, maxW: r.w - 8 };
  };
  const nb = c.grid.length;
  if (P.two) {
    const left = R(P.x0, backBelow, P.side, topY + cardH - backBelow);
    S.cards = [left, rightCard];
    const items = [headItem, c.noteW ? { k: 'note', h: c.noteW } : { k: 'note', flex: true, min: 160 }];
    if (c.trays) items.push({ k: 'trays', h: 96 });
    if (c.moves) items.push({ k: 'moves', flex: true, min: 100 });
    const st = stack(left, items);
    putHead(st.head); S.note = st.note; S.trays = st.trays ? { x: st.trays.x, y: st.trays.y, w: st.trays.w, rows: 2 } : null; S.moves = st.moves || null;
    // buttons: one column in the right card, centred vertically
    const bh = Math.min(84, (cardH - 24 - (nb - 1) * 14 - (c.foot ? 40 : 0)) / nb), bwid = Math.min(rightCard.w - 28, 340);
    const colH = nb * bh + (nb - 1) * 14 + (c.foot ? 40 : 0), y0 = rightCard.y + (cardH - colH) / 2;
    S.bar = {}; c.grid.forEach((k, i) => { S.bar[k] = R(rightCard.x + (rightCard.w - bwid) / 2, y0 + i * (bh + 14), bwid, bh); });
    S.foot = c.foot ? { x: rightCard.x + rightCard.w / 2, y: y0 + nb * (bh + 14) + 10 } : null;
  } else {
    S.cards = [rightCard];
    const rows = Math.ceil(nb / 2), bh = 60, btnH = rows * bh + (rows - 1) * 10;
    const items = [headItem, c.noteW ? { k: 'note', h: c.noteW } : { k: 'note', flex: true, min: 120 }];
    if (c.trays) items.push({ k: 'trays', h: 96 });
    if (c.moves) items.push({ k: 'moves', flex: true, min: 70 });
    items.push({ k: 'bar', h: btnH });
    if (c.foot) items.push({ k: 'foot', h: 26 });
    const st = stack(rightCard, items, 12, 8);
    putHead(st.head); S.note = st.note; S.trays = st.trays ? { x: st.trays.x, y: st.trays.y, w: st.trays.w, rows: 2 } : null; S.moves = st.moves || null;
    S.bar = {}; const gw = (st.bar.w - 10) / 2;
    c.grid.forEach((k, i) => {
      const last = i === nb - 1 && nb % 2 === 1, col = i % 2, row = Math.floor(i / 2);
      S.bar[k] = R(st.bar.x + (last ? 0 : col * (gw + 10)), st.bar.y + row * (bh + 10), last ? st.bar.w : gw, bh);
    });
    S.foot = st.foot ? { x: st.foot.x + st.foot.w / 2, y: st.foot.y + 18 } : null;
  }
  S.dirKey = c.grid;
  return S;
}

// ---- title screen -----------------------------------------------------------------------------------------------------------
// The hero (title text + key art) is authored in a canonical 600 x 520 box; `hero` is where it goes (k = scale).
export const HERO = { x: 60, y: 20, w: 600, h: 520 };
const LOCK_AR = 260 / 700;
// Tap zone of the title lockup: >= 44 css px each way, extended sideways and downward only (never into the buttons above).
export function lockHit(L, T) {
  const c = T.credit; if (!c) return null; const m = 44 / Math.max(0.05, host.px), w = Math.max(c.w, m), y = c.y - 2;
  return R(c.x - w / 2, y, w, Math.max(c.w * LOCK_AR + 2, Math.min(m, L.h - y)));
}
function buildTitle(L) {
  const { U, ins, land } = L, T = { rows: {}, hero: null, sound: null, credit: null, foot: null, card: null };
  const topPad = Math.max(10, ins.t + 6), LKW = Math.min(284, U.w - 80), LKH = LKW * LOCK_AR, foot = 34 + LKH + 10;
  const heroAt = (cx, y, k) => ({ k, x: cx - (HERO.w * k) / 2, y, w: HERO.w * k, h: HERO.h * k });
  if (!land) {
    const tallRowsH = 630, tallHero = U.h - foot - tallRowsH - 30 - 10;
    if (tallHero >= 400) {                                                             // the approved phone look (one column)
      const k = Math.min(1.1, tallHero / HERO.h), heroH = HERO.h * k, extra = Math.max(0, tallHero - heroH);
      const y0 = U.y0 + Math.max(10, ins.t * 0 + 10) + extra * 0.4, bw = Math.min(560, U.w - 80), cx = U.x0 + U.w / 2;
      T.hero = heroAt(cx, y0, k);
      let y = y0 + heroH + 30;
      const row = () => { const r = R(cx - bw / 2, y, bw, 76); y += 90; return r; };
      T.rows.playWhite = row(); T.rows.playBlack = row(); T.rows.twoPlayer = row(); T.rows.watch = row(); T.rows.learn = row();
      const third = (bw - 28) / 3;
      T.rows.howto = R(cx - bw / 2, y, third, 76); T.rows.about = R(cx - bw / 2 + third + 14, y, third, 76); T.rows.rules = R(cx - bw / 2 + 2 * (third + 14), y, third, 76);
      y += 90; const half = (bw - 14) / 2;
      T.rows.level = R(cx - bw / 2, y, half, 76); T.rows.theme = R(cx - bw / 2 + half + 14, y, half, 76);
      T.sound = R(U.x1 - 154, Math.max(U.y0 + 10, topPad), 140, 60);
      T.credit = { x: cx, y: y + 76 + 10, w: LKW }; T.foot = { x: cx, y: U.y1 - 10 };
      return T;
    }
    // compact portrait: hero on top, a two-column grid below
    const pitch = 74, bh = 64, n = 6, gridH = n * pitch, y0g = U.y1 - foot - gridH + 10;
    const zone = y0g - 14 - topPad, k = clamp(Math.min(zone / HERO.h, (U.w - 20) / HERO.w), 0.4, 1.3);
    T.hero = heroAt(U.x0 + U.w / 2, topPad + Math.max(0, (zone - HERO.h * k) / 2), k);
    gridRows(T, U.x0 + 30, U.w - 60, y0g, pitch, bh);
    T.credit = { x: U.x0 + U.w / 2, y: y0g + 5 * pitch + bh + 8, w: LKW }; T.foot = { x: U.x0 + U.w / 2, y: U.y1 - 10 };
    return T;
  }
  // wide: key art on the left, a card of buttons on the right
  const cw = clamp(U.w * 0.46, 440, 620), cx0 = U.x1 - cw - 12, pitch = Math.min(88, (U.h - 40 - LKH - 12) / 6), bh = pitch - 12, gridH = 6 * pitch;
  const y0g = U.y0 + (U.h - LKH - 12 - gridH) / 2 + 6;
  T.card = R(cx0, y0g - 20, cw, gridH + 24);
  gridRows(T, cx0 + 22, cw - 44, y0g, pitch, bh);
  const leftW = cx0 - U.x0 - 12, lcx = U.x0 + leftW / 2, zoneH = U.h - foot - 40, k = clamp(Math.min((leftW - 20) / HERO.w, zoneH / HERO.h), 0.3, 1.35);
  T.hero = heroAt(lcx, U.y0 + 10 + (zoneH - HERO.h * k) / 2, k);
  T.credit = { x: cx0 + cw / 2, y: T.card.y + T.card.h + 6, w: Math.min(LKW, cw - 40) }; T.foot = { x: lcx, y: U.y1 - 10 };
  return T;
}
function gridRows(T, x, w, y0, pitch, bh) {
  const half = (w - 14) / 2, pair = (i, a, b) => { T.rows[a] = R(x, y0 + i * pitch, half, bh); T.rows[b] = R(x + half + 14, y0 + i * pitch, half, bh); };
  pair(0, 'playWhite', 'playBlack'); pair(1, 'twoPlayer', 'watch'); pair(2, 'learn', 'howto'); pair(3, 'about', 'rules'); pair(4, 'level', 'theme');
  T.rows.sound = R(x, y0 + 5 * pitch, w, bh); T.sound = T.rows.sound; T.grid = true;
}

// ---- About / Controls / Rules reader ------------------------------------------------------------------------------------------
function buildPage(L) {
  const { U, ins } = L, barH = 84, navY = U.y1 - 12 - barH;
  const pw = Math.min(U.w - 40, 900), px = U.x0 + (U.w - pw) / 2;
  let py = U.y0 + 10;
  if (ins.back && px < L.backBox.x + L.backBox.w + 4) py = Math.max(py, L.backBox.y + L.backBox.h + 4);
  const panelMax = R(px, py, pw, navY - 40 - py);
  const nw = Math.min(U.w - 40, 780), nx = U.x0 + (U.w - nw) / 2, gap = 12, unit = (nw - 3 * gap) / 4.5;
  const nav = {
    back: R(nx, navY, unit * 1.25, barH), dec: R(nx + unit * 1.25 + gap, navY, unit, barH),
    inc: R(nx + unit * 2.25 + 2 * gap, navY, unit, barH), next: R(nx + unit * 3.25 + 3 * gap, navY, unit * 1.25, barH),
  };
  return { panelMax, nav, counterY: navY - 14, cx: U.x0 + U.w / 2 };
}

// ---- result overlay + promotion picker (cards centred on the screen) --------------------------------------------------------------
function buildResult(L) {
  const { U } = L, cw = Math.min(U.w - 30, 640), ch = 560, x = U.x0 + (U.w - cw) / 2, y = U.y0 + Math.max(8, (U.h - ch) / 2);
  const bw = (cw - 60 - 20) / 2, chipW = (cw - 60 - 14) / 2;
  return {
    card: R(x, y, cw, ch), cx: x + cw / 2, headY: y + 74, subY: y + 156, moreY: y + 214,
    chips: SIBLINGS.map((_, i) => R(x + 30 + (i % 2) * (chipW + 14), y + 238 + Math.floor(i / 2) * 74, chipW, 62)),
    again: R(x + 30, y + ch - 112, bw, 84), menu: R(x + 30 + bw + 20, y + ch - 112, bw, 84),
  };
}
function buildPromo(L) {
  const { U } = L, cw = Math.min(U.w - 30, 600), x = U.x0 + (U.w - cw) / 2, y = U.y0 + (U.h - 340) / 2, cell = (cw - 40 - 3 * 12) / 4;
  return { card: R(x, y, cw, 340), pieces: [0, 1, 2, 3].map((i) => R(x + 20 + i * (cell + 12), y + 94, cell, cell)), cell };
}

// ---- back-compat exports for tests: the phone-portrait layout (720 x 1280) ----------------------------------------------------
export const PHONE = layoutFor(W, H);
