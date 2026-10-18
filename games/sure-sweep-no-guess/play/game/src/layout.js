// Geometry for every scene, as a pure function of the LIVE screen size (kit 1.7 fluid viewport: the short side is always
// 720 units, the long side follows the aspect ratio). `layoutFor(w, h)` returns every position for that size and is cached;
// `useLayout(w, h)` copies it into the live exported rect objects below, so the game (hit tests) and the renderer (drawing)
// read the SAME rectangles. Three shapes:
//   tall     portrait phone (usable height >= 1500): the approved phone look, unchanged.
//   compact  portrait but shorter (tablets, small phones): title row, HUD, a board that shrinks to fit, controls below.
//   wide     landscape: the board on the left, one side panel (HUD, Reveal/Flag, buttons or the result card) on the right.
// The playing field is a fixed 9x9 board, so a square cell size is the only thing the layout has to solve for.
export const COLS = 9;
export const ROWS = 9;
export const FRAME = 13;

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
// Auto Play ("Watch & Learn") think-time steps, in seconds. Index into this, never a raw float.
export const THINK_STEPS = [2, 5, 8, 10];

// The other Arcforge games, for the won/lost screen's "More from Arcforge" cross-promo chips (paid games only).
export const SIBLINGS = [
  { slug: 'tiger-and-goat', title: 'Tiger and Goat' },
  { slug: 'go-stones-and-territory', title: 'Go' },
  { slug: 'carrom-striker-and-queen', title: 'Carrom' },
  { slug: 'word-game', title: 'Word Game' },
];

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
// px = css pixels per virtual unit (text never shrinks below ~11 css px).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 1 };

const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const inRect = (x, y, r) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// ---- live rects (mutated in place by useLayout; initial values = the approved 720x1560 phone layout) -------------------
const mk = () => R(0, 0, 0, 0);
export const V = { w: 720, h: 1560, land: false, mode: 'tall', key: '' };
export const BOARD = { x: 27, y: 353, cell: 74, size: 666 };
export const HUD = mk();
export const MODE_SWITCH = mk();
export const HINT_BTN = mk();
export const COLOR_BTN = mk();
export const NEW_BTN = mk();
export const MENU_BTN = mk();
export const PAUSE_BTN = mk(); // Auto Play only: shares the MODE_SWITCH row with "Exit to menu"
export const AUTO_EXIT_BTN = mk();
export const RESULT_CARD = mk();
export const SHIELD_BTN = mk();
export const AGAIN_BTN = mk();
export const AGAIN_BTN_WIDE = mk();
export const RESULT_MENU_BTN = mk();       // result card: Menu when the one-time Undo is also shown (three across; in the side panel: left half of the bottom row)
export const RESULT_MENU_BTN_WIDE = mk();  // result card: Menu beside the wide New board button (two across); Auto Play's "Exit to menu"
export const CHIPS = [mk(), mk(), mk(), mk()];
export const PLAY_BTN = mk();
export const TITLE_COLOR_BTN = mk();
export const TITLE_RULES_BTN = mk();
export const TITLE_AUTO_BTN = mk();
export const HERO = { x: 360, y: 700, cell: 100, n: 5 };
export const RULES_PANEL = mk(); // the scrolling reader's viewport
export const RULES_BACK_BTN = mk();
export const TEXT_DEC_BTN = mk();
export const TEXT_INC_BTN = mk();
export const SCROLLBAR = mk();
// Scalar placements (text baselines, sizes). Replaced wholesale by useLayout.
export const POS = {};

const RECTS = { HUD, MODE_SWITCH, HINT_BTN, COLOR_BTN, NEW_BTN, MENU_BTN, PAUSE_BTN, AUTO_EXIT_BTN, RESULT_CARD, SHIELD_BTN, AGAIN_BTN, AGAIN_BTN_WIDE, RESULT_MENU_BTN, RESULT_MENU_BTN_WIDE, PLAY_BTN, TITLE_COLOR_BTN, TITLE_RULES_BTN, TITLE_AUTO_BTN, RULES_PANEL, RULES_BACK_BTN, TEXT_DEC_BTN, TEXT_INC_BTN, SCROLLBAR };

export const chipRect = (i) => CHIPS[i];
export const cellRect = (index) => ({ x: BOARD.x + (index % COLS) * BOARD.cell, y: BOARD.y + Math.floor(index / COLS) * BOARD.cell });
export const cellCenter = (index) => {
  const r = cellRect(index);
  return { x: r.x + BOARD.cell / 2, y: r.y + BOARD.cell / 2 };
};
// Which board cell is under a point (or -1).
export const cellAt = (x, y) => {
  const c = Math.floor((x - BOARD.x) / BOARD.cell);
  const r = Math.floor((y - BOARD.y) / BOARD.cell);
  return c >= 0 && c < COLS && r >= 0 && r < ROWS ? r * COLS + c : -1;
};

const cache = new Map();
export function layoutFor(w, h) {
  w = Math.round(w);
  h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  let L = cache.get(key);
  if (!L) {
    L = build(w, h, { ...host });
    L.key = key;
    cache.set(key, L);
    if (cache.size > 40) cache.delete(cache.keys().next().value);
  }
  return L;
}

export function useLayout(w, h) {
  const L = layoutFor(w, h);
  if (V.key !== L.key) {
    for (const [name, target] of Object.entries(RECTS)) Object.assign(target, L.rects[name] ?? R(0, 0, 0, 0));
    L.chips.forEach((r, i) => Object.assign(CHIPS[i], r));
    Object.assign(BOARD, L.board);
    Object.assign(HERO, L.hero);
    for (const k of Object.keys(POS)) delete POS[k];
    Object.assign(POS, L.pos);
    Object.assign(V, { w: L.w, h: L.h, land: L.land, mode: L.mode, key: L.key });
  }
  return L;
}

// ---- the builder ---------------------------------------------------------------------------------------------------------
function build(w, h, ins) {
  const U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b };
  U.w = U.x1 - U.x0;
  U.h = U.y1 - U.y0;
  // squarish / short portrait windows (usable height under 1000 units) also use the side-panel layout: stacked controls would leave no room for the board
  const land = w > h || U.h < 820;
  const tall = !land && U.h >= 1500;
  const mode = land ? 'wide' : tall ? 'tall' : 'compact';
  const backBox = ins.back ? R(ins.l, ins.t, Math.max(ins.back, 56) + 8, Math.max(ins.back, 56) + 8) : R(0, 0, 0, 0);
  const L = { w, h, land: w > h, wideMode: land, mode, U, backBox, rects: {}, chips: [], pos: {}, board: { x: 0, y: 0, cell: 60, size: 540 }, hero: { x: 360, y: 700, cell: 100, n: 5 } };
  const rc = L.rects;
  const pos = L.pos;
  pos.hudMode = 'row';

  // ---- result card contents, anchored to the card's bottom (buttons, then the chips row, then the text above) ------------
  const resultParts = (card, o) => {
    const pad = o.pad;
    const out = {};
    let y = card.y + card.h - pad;
    if (o.stack) {
      // side panel: Undo (when offered) full width on top, then Menu | New board on the bottom row
      const bw = card.w - 2 * pad, hw = (bw - 12) / 2;
      out.menu = R(card.x + pad, y - o.btnH, hw, o.btnH);
      out.again = R(card.x + pad + hw + 12, y - o.btnH, hw, o.btnH);
      out.menuWide = out.menu;
      y -= o.btnH + 10;
      out.shield = R(card.x + pad, y - o.btnH, bw, o.btnH);
      y -= o.btnH + o.gap;
      out.wide = out.again;
    } else {
      const gp = 12, inner = card.w - 2 * pad;
      const tw = (inner - 2 * gp) / 3, hw = (inner - gp) / 2;
      // three across (Undo offered): Menu | Undo | New board; two across: Menu | New board (primary on the right)
      out.menu = R(card.x + pad, y - o.btnH, tw, o.btnH);
      out.shield = R(card.x + pad + tw + gp, y - o.btnH, tw, o.btnH);
      out.again = R(card.x + pad + 2 * (tw + gp), y - o.btnH, tw, o.btnH);
      out.menuWide = R(card.x + pad, y - o.btnH, hw, o.btnH);
      out.wide = R(card.x + pad + hw + gp, y - o.btnH, hw, o.btnH);
      y -= o.btnH + o.gap;
    }
    const chips = [];
    if (o.chipCols === 4) {
      const cw = (card.w - 2 * pad - 3 * 10) / 4;
      for (let i = 0; i < 4; i++) chips.push(R(card.x + pad + i * (cw + 10), y - o.chipH, cw, o.chipH));
      y -= o.chipH;
    } else {
      const cw = (card.w - 2 * pad - 10) / 2;
      for (let i = 0; i < 4; i++) {
        const row = Math.floor(i / 2);
        chips.push(R(card.x + pad + (i % 2) * (cw + 10), y - o.chipH * (2 - row) - 8 * (1 - row), cw, o.chipH));
      }
      y -= o.chipH * 2 + 8;
    }
    out.chips = chips;
    out.chipLabelY = o.noLabel ? null : y - 10;
    const headY = card.y + pad + o.headSize * 0.82;
    out.pos = {
      head: { x: card.x + card.w / 2, y: headY, size: o.headSize },
      text: { x: card.x + pad, y: headY + 12, w: card.w - 2 * pad, h: Math.max(40, (out.chipLabelY === null ? y - 8 : out.chipLabelY - 24) - (headY + 12)) },
    };
    return out;
  };
  const applyResult = (card, o) => {
    const p = resultParts(card, o);
    rc.RESULT_CARD = card;
    rc.SHIELD_BTN = p.shield;
    rc.AGAIN_BTN = p.again;
    rc.AGAIN_BTN_WIDE = p.wide;
    rc.RESULT_MENU_BTN = p.menu;
    rc.RESULT_MENU_BTN_WIDE = p.menuWide;
    L.chips = p.chips;
    Object.assign(pos, p.pos);
    pos.chipLabelY = p.chipLabelY;
    pos.chipLabelX = card.x + card.w / 2;
    pos.resultK = o.k ?? 1;
  };

  // ======================================================================================================================
  if (tall) {
    // The approved phone layout, centred vertically if the screen is taller than 1560 units.
    const oy = U.y0 + (U.h - 1560) / 2;
    const x0 = 27;
    const cw = 666;
    L.board = { x: (w - 666) / 2, y: 353 + oy, cell: 74, size: 666 };
    rc.HUD = R(x0, 196 + oy, cw, 124);
    pos.playTitle = { x: w / 2 + 40, y: 162 + oy, size: 54 };
    pos.tip = { x: w / 2, y: 1090 + oy, size: 25 };
    rc.MODE_SWITCH = R(x0, 1118 + oy, cw, 116);
    const bw = (cw - 3 * 14) / 4;
    const btn = (i) => R(x0 + i * (bw + 14), 1262 + oy, bw, 116);
    rc.HINT_BTN = btn(0);
    rc.COLOR_BTN = btn(1);
    rc.NEW_BTN = btn(2);
    rc.MENU_BTN = btn(3);
    rc.AUTO_EXIT_BTN = R(x0, 1118 + oy, cw / 2 - 7, 116);
    rc.PAUSE_BTN = R(x0 + cw / 2 + 7, 1118 + oy, cw / 2 - 7, 116);
    pos.caption = { x: w / 2, y: 1436 + oy, size: 24 };
    pos.demo = { x: w / 2, y: 1476 + oy, size: 21 };
    applyResult(R(x0, 1062 + oy, cw, 470), { pad: 34, btnH: 112, chipH: 66, gap: 16, chipCols: 4, headSize: 66 });
    pos.explainSize = 27;
    pos.confetti = { x: w / 2, spread: 190 };
  } else if (!land) {
    // ---- compact portrait ----
    const top = U.y0 + 8;
    pos.playTitle = { x: w / 2, y: top + 42, size: 44 };
    const hudY = ins.back ? Math.max(top + 62, backBox.y + backBox.h + 6) : top + 62;
    const hudH = 100;
    rc.HUD = R(27, hudY, 666, hudH);
    const ctrlNeed = 330;
    const boardTop = hudY + hudH + 12;
    const bottom = U.y1 - 12;
    const space = bottom - ctrlNeed - boardTop - 2 * FRAME;
    const cell = clamp(Math.floor(space / 9), 30, Math.min(74, Math.floor((w - 2 * FRAME - 24) / 9)));
    const bsize = cell * 9;
    const by = boardTop + FRAME + Math.max(0, Math.min(40, (space - bsize) / 2));
    L.board = { x: (w - bsize) / 2, y: by, cell, size: bsize };
    const zoneTop = by + bsize + FRAME + 12;
    const zoneH = Math.max(ctrlNeed - 20, bottom - zoneTop);
    const slack = Math.max(0, zoneH - (ctrlNeed - 20));
    const g = Math.min(18, slack / 5);
    const modeH = 88;
    const btnH = 88;
    pos.tip = { x: w / 2, y: zoneTop + 26, size: 24 };
    const modeY = zoneTop + 42 + g;
    rc.MODE_SWITCH = R(27, modeY, 666, modeH);
    rc.AUTO_EXIT_BTN = R(27, modeY, 666 / 2 - 7, modeH);
    rc.PAUSE_BTN = R(27 + 666 / 2 + 7, modeY, 666 / 2 - 7, modeH);
    const bw = (666 - 3 * 14) / 4;
    const by2 = modeY + modeH + 14 + g;
    const btn = (i) => R(27 + i * (bw + 14), by2, bw, btnH);
    rc.HINT_BTN = btn(0);
    rc.COLOR_BTN = btn(1);
    rc.NEW_BTN = btn(2);
    rc.MENU_BTN = btn(3);
    pos.caption = by2 + btnH + 34 <= bottom ? { x: w / 2, y: by2 + btnH + 30, size: 22 } : null;
    pos.demo = by2 + btnH + 62 <= bottom ? { x: w / 2, y: by2 + btnH + 58, size: 20 } : null;
    applyResult(R(27, zoneTop, 666, bottom - zoneTop), { pad: 12, btnH: 84, chipH: 52, gap: 10, chipCols: 4, headSize: 46, k: 0.8, noLabel: bottom - zoneTop < 350 });
    pos.explainSize = 24;
    pos.confetti = { x: w / 2, spread: 180 };
  } else {
    // ---- landscape: board left, one panel right ----
    const gap = 16;
    const xmin = U.x0 + (ins.back ? backBox.w + 4 : 12);
    const xmax = U.x1 - 12;
    const availW = xmax - xmin;
    const top = U.y0 + 10;
    const availH = U.y1 - 10 - top;
    const minPanel = 250;
    const cellByH = Math.floor((availH - 2 * FRAME - 6) / 9);
    const cellByW = Math.floor((availW - gap * 2 - minPanel - 2 * FRAME) / 9);
    const cell = clamp(Math.min(cellByH, cellByW, 84), 18, 84);
    const bsize = cell * 9;
    const boardOuter = bsize + 2 * FRAME;
    const panelW = clamp(availW - boardOuter - gap * 2, minPanel, 440);
    const groupW = boardOuter + gap + panelW;
    const gx = xmin + Math.max(0, (availW - groupW) / 2);
    L.board = { x: gx + FRAME, y: top + (availH - boardOuter) / 2 + FRAME, cell, size: bsize };
    const px0 = gx + boardOuter + gap;
    const py0 = top;
    const ph = availH;
    const hudH = 150;
    rc.HUD = R(px0, py0, panelW, hudH);
    pos.hudMode = 'stack';
    pos.playTitle = null;
    const cy0 = py0 + hudH + 12;
    // controls: tip, Reveal/Flag, 2x2 buttons
    const modeH = 84;
    const bh = 80;
    const bg = 10;
    const tipH = 58;
    const need = tipH + modeH + 12 + 2 * bh + bg;
    const extra = Math.max(0, py0 + ph - cy0 - need);
    const sp = Math.min(14, extra / 3);
    pos.tip = { x: px0 + panelW / 2, y: cy0 + 24, size: 22, maxW: panelW - 8, wrap: true, lh: 26 };
    const modeY = cy0 + tipH + sp;
    rc.MODE_SWITCH = R(px0, modeY, panelW, modeH);
    rc.AUTO_EXIT_BTN = R(px0, modeY, panelW / 2 - 5, modeH);
    rc.PAUSE_BTN = R(px0 + panelW / 2 + 5, modeY, panelW / 2 - 5, modeH);
    const bw = (panelW - bg) / 2;
    const row1 = modeY + modeH + 12 + sp;
    rc.HINT_BTN = R(px0, row1, bw, bh);
    rc.COLOR_BTN = R(px0 + bw + bg, row1, bw, bh);
    rc.NEW_BTN = R(px0, row1 + bh + bg, bw, bh);
    rc.MENU_BTN = R(px0 + bw + bg, row1 + bh + bg, bw, bh);
    pos.caption = null;
    pos.demo = { x: px0 + panelW / 2, y: py0 + ph - 6, size: 19 };
    applyResult(R(px0, cy0, panelW, py0 + ph - cy0), { pad: 14, btnH: 82, chipH: 52, gap: 10, chipCols: 2, stack: true, headSize: panelW < 330 ? 46 : 52, k: 0.8 });
    pos.explainSize = 22;
    pos.confetti = { x: L.board.x + bsize / 2, spread: bsize / 3 };
  }

  buildTitle(L, U, ins, backBox, tall, land);
  buildRules(L, U, ins, backBox, land);
  return L;
}

// ---- title ---------------------------------------------------------------------------------------------------------------
function buildTitle(L, U, ins, backBox, tall, land) {
  buildTitleBody(L, U, ins, backBox, tall, land);
  const T = L.pos.title, lw = T.lockup.w, lh = (lw * 327) / 1200, m = 44 / Math.max(0.3, ins.px || 1), pw = Math.max(lw, m), ph = Math.max(lh, m);
  T.lockHit = { x: T.lockup.x - pw / 2, y: T.lockup.y - ph / 2, w: pw, h: ph };
}
function buildTitleBody(L, U, ins, backBox, tall, land) {
  const { w } = L;
  const rc = L.rects;
  const T = (L.pos.title = {});
  if (tall) {
    const oy = U.y0 + (U.h - 1560) / 2;
    T.logo = { x: 360, y: 300 + oy, size: 112 };
    T.tag1 = { x: 360, y: 372 + oy, size: 34 };
    T.tag2 = { x: 360, y: 414 + oy, size: 25 };
    L.hero = { x: 360, y: 700 + oy, cell: 100, n: 5 };
    rc.PLAY_BTN = R(110, 1004 + oy, 500, 132);
    const rw = (500 - 2 * 16) / 3;
    rc.TITLE_COLOR_BTN = R(110, 1166 + oy, rw, 96);
    rc.TITLE_RULES_BTN = R(110 + rw + 16, 1166 + oy, rw, 96);
    rc.TITLE_AUTO_BTN = R(110 + 2 * (rw + 16), 1166 + oy, rw, 96);
    T.best = { x: 360, y: 1378 + oy, size: 28 };
    T.demo = { x: 360, y: 1450 + oy, size: 22, h: 46 };
    T.lockup = { x: w / 2, y: 1262 + oy + 12 + 34, w: 250 };
    T.compass = { x: 610, y: 1430 + oy, r: 170 };
    T.buoy = { x: 96, y: 1440 + oy };
    return;
  }
  const wideOk = land && U.x1 - U.x0 >= 800;
  if (!wideOk) {
    // compact portrait (or a squarish window): scale the fixed parts with the height, give the hero what is left
    const squeeze = U.h < 900;
    const f = clamp(U.h / 1500, squeeze ? 0.5 : 0.62, 1);
    const top = U.y0;
    const lockW = 230 * Math.max(0.85, f);
    const lockH = (lockW * 327) / 1200;
    const lockBottom = top + 6;
    const backClear = ins.back ? backBox.y + backBox.h + 4 : 0;
    const logoSize = Math.round(112 * f);
    const logoY = Math.max(lockBottom + (squeeze ? 6 : 14) + logoSize * 0.8, backClear + logoSize * 0.8);
    T.logo = { x: 360, y: logoY, size: logoSize };
    T.tag1 = { x: 360, y: logoY + 72 * f, size: Math.round(34 * f) };
    T.tag2 = { x: 360, y: logoY + 114 * f, size: Math.round(25 * f) };
    const playH = Math.max(96, Math.round(132 * f));
    const rowH = Math.max(squeeze ? 70 : 84, Math.round(96 * f));
    const bottom = U.y1 - 12;
    const pillsH = (squeeze ? 52 : 56 + 10 + 40) + lockH + 12;
    const rowY = bottom - pillsH - 14 - rowH;
    const playY = rowY - 14 - playH;
    const heroTop = logoY + 114 * f + 20;
    const heroSpace = playY - 16 - heroTop;
    const cell = clamp(Math.floor((heroSpace - 40) / 5), squeeze ? 20 : 36, 100);
    const hh = cell * 5 + 36;
    L.hero = { x: 360, y: heroTop + hh / 2 + Math.max(0, (heroSpace - hh) / 2), cell, n: 5 };
    rc.PLAY_BTN = R(110, playY, 500, playH);
    const rw = (500 - 32) / 3;
    rc.TITLE_COLOR_BTN = R(110, rowY, rw, rowH);
    rc.TITLE_RULES_BTN = R(110 + rw + 16, rowY, rw, rowH);
    rc.TITLE_AUTO_BTN = R(110 + 2 * (rw + 16), rowY, rw, rowH);
    T.lockup = { x: w / 2, y: rowY + rowH + 12 + lockH / 2, w: lockW };
    const pl = lockH + 12;
    T.best = { x: 360, y: rowY + rowH + 14 + 28 + pl, size: 26 };
    T.demo = squeeze ? null : { x: 360, y: rowY + rowH + 14 + 28 + 54 + pl, size: 20, h: 42 };
    T.compass = { x: w - 110, y: U.y1 - 90, r: 150 * f };
    T.buoy = { x: 96, y: U.y1 - 80 };
    return;
  }
  // landscape: art left, buttons right
  const xmin = U.x0 + (ins.back ? backBox.w + 4 : 16);
  const xmax = U.x1 - 16;
  const availW = xmax - xmin;
  const leftW = clamp(availW * 0.5, 380, 620);
  const rightW = clamp(availW - leftW - 24, 340, 520);
  const groupW = leftW + 24 + rightW;
  const gx = xmin + Math.max(0, (availW - groupW) / 2);
  const lcx = gx + leftW / 2;
  const rx = gx + leftW + 24;
  const rcx = rx + rightW / 2;
  const top = U.y0 + 12;
  const logoSize = clamp(Math.floor(leftW / 4.4), 70, 108);
  const logoY = top + logoSize * 0.85 + 6;
  T.logo = { x: lcx, y: logoY, size: logoSize, maxW: leftW - 20 };
  T.tag1 = { x: lcx, y: logoY + 56, size: 30 };
  T.tag2 = { x: lcx, y: logoY + 92, size: 23 };
  const heroTop = logoY + 92 + 22;
  const heroSpace = U.y1 - 12 - heroTop;
  const cell = clamp(Math.min(Math.floor((heroSpace - 40) / 5), Math.floor((leftW - 80) / 5)), 30, 100);
  const hh = cell * 5 + 36;
  L.hero = { x: lcx, y: heroTop + hh / 2 + Math.max(0, (heroSpace - hh) / 2), cell, n: 5 };
  // right column: Play, the row of three, pills, lockup, centred vertically
  const playH = 120;
  const rowH = 96;
  const lockW = Math.min(300, rightW - 20);
  const lockH = (lockW * 327) / 1200;
  const total = playH + 16 + rowH + 22 + 56 + 10 + 40 + 10 + lockH;
  const y0 = U.y0 + Math.max(10, (U.h - total) / 2);
  rc.PLAY_BTN = R(rx + 10, y0, rightW - 20, playH);
  const rw = (rightW - 20 - 32) / 3;
  const rowY = y0 + playH + 16;
  rc.TITLE_COLOR_BTN = R(rx + 10, rowY, rw, rowH);
  rc.TITLE_RULES_BTN = R(rx + 10 + rw + 16, rowY, rw, rowH);
  rc.TITLE_AUTO_BTN = R(rx + 10 + 2 * (rw + 16), rowY, rw, rowH);
  T.lockup = { x: rcx, y: rowY + rowH + 12 + lockH / 2, w: lockW };
  const pl = lockH + 10;
  T.best = { x: rcx, y: rowY + rowH + 22 + 28 + pl, size: 26 };
  T.demo = { x: rcx, y: rowY + rowH + 22 + 28 + 52 + pl, size: 20, h: 40 };
  T.compass = { x: xmax - 20, y: U.y1 - 40, r: 150 };
  T.buoy = { x: xmin + 30, y: U.y1 - 40 };
}

// ---- rules reader --------------------------------------------------------------------------------------------------------
function buildRules(L, U, ins, backBox, land) {
  const { w } = L;
  const rc = L.rects;
  const rp = (L.pos.rules = {});
  if (!land) {
    const barH = 84;
    const barY = U.y1 - 12 - barH;
    const g = 12;
    const bw = (w - 2 * 24 - 2 * g) / 3;
    rc.RULES_BACK_BTN = R(24, barY, bw * 1.2, barH);
    rc.TEXT_DEC_BTN = R(24 + bw * 1.2 + g, barY, bw * 0.9 - g / 2, barH);
    rc.TEXT_INC_BTN = R(24 + bw * 2.1 + g * 1.5, barY, w - 24 - (24 + bw * 2.1 + g * 1.5), barH);
    rp.label = { x: w / 2, y: U.y0 + 44, size: 22 };
    const panelTop = Math.max(U.y0 + 62, ins.back ? backBox.y + backBox.h + 6 : 0);
    rc.RULES_PANEL = R(24, panelTop, w - 48, barY - 14 - panelTop);
  } else {
    const xmin = U.x0 + (ins.back ? backBox.w + 4 : 16);
    const colW = 230;
    const bx = U.x1 - 16 - colW;
    const top = U.y0 + 12;
    rc.RULES_PANEL = R(xmin, top, bx - 16 - xmin, U.h - 24);
    rp.label = { x: bx + colW / 2, y: top + 36, size: 22 };
    const bh = 84;
    rc.RULES_BACK_BTN = R(bx, top + 80, colW, bh);
    rc.TEXT_DEC_BTN = R(bx, top + 80 + bh + 16, colW / 2 - 6, bh);
    rc.TEXT_INC_BTN = R(bx + colW / 2 + 6, top + 80 + bh + 16, colW / 2 - 6, bh);
  }
  const p = rc.RULES_PANEL;
  rc.SCROLLBAR = R(p.x + p.w - 14, p.y + 12, 10, p.h - 24);
}
