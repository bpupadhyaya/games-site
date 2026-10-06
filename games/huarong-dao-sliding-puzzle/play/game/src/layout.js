// Screen geometry as a function of the LIVE size (kit 1.7 fluid viewport: the short side is always 720 units, the long side
// follows the screen). `applyLayout(w, h)` computes every rectangle for that size (cached by size + insets) and writes it into
// the shared objects below, so drawing (view.js) and hit-testing (game.js) always read the same numbers. Pure data, no canvas.
//
// Play modes (picked by the largest board that fits):
//   tall   portrait: header on top, board, stats, message line, toolbar underneath (at 720 x 1560 this is the approved phone look, unchanged).
//   side   squarish portrait (tablets): header on top, the board on the left, stats + buttons in a column on the right.
//   wide   landscape: a card on the left (back, level, stats, message), the board in the middle, a card on the right (buttons).
// The 4 x 5 board is tall, so in landscape it is height-bound: it is as large as the height allows and the width goes to the cards.
export const THINK_STEPS = [2, 5, 8, 10];

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
// px = css pixels per virtual unit (text never shrinks below ~11 css px, tap targets about 44 css px).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

export const inRect = (x, y, r) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// ---- live geometry (rewritten in place by applyLayout) ----
export const SCREEN = { width: 720, height: 1560 };
export let CELL = 154;
export const LAY = { mode: 'tall', w: 720, h: 1560, s: 1, key: '' };
export const BACK_BTN = { x: 0, y: 0, w: 0, h: 0 };
export const PAUSE_BTN = { x: 0, y: 0, w: 0, h: 0 };
export const BOARD_ORIGIN = { x: 0, y: 0 };
export const BOARD_PX = { x: 0, y: 0, w: 0, h: 0 };
export const FRAME = { x: 0, y: 0, w: 0, h: 0 };
export const GATE_PX = { x: 0, y: 0, w: 0 };
export const STATS = { x: 0, y: 0, w: 0, h: 0 };
export const TOOLBAR_IDS = ['undo', 'hint', 'reset'];
const TOOLS = [{}, {}, {}];
export const toolRect = (i) => TOOLS[i];
export const AUTO_BTNS = { slower: {}, pause: {}, faster: {} };
export const DOC_BACK = {}, ZOOM_DEC = {}, ZOOM_INC = {}, ZOOM_PCT = {}, DOC_PANEL = {}, DOC_BODY = {}, DOC_BODY_NAV = {}, NAV_PREV = {}, NAV_NEXT = {}, NAV_LABEL = { x: 0, y: 0 };
export const LANG_EN = {}, LANG_ZH = {}, MENU_REGION = {}, OVERLAY = {};
export let BANNER_Y = 1286;

const sig = (o) => Object.assign(o, { x: 0, y: 0, w: 0, h: 0 });
for (const o of [BACK_BTN, PAUSE_BTN, ...TOOLS, ...Object.values(AUTO_BTNS), DOC_BACK, ZOOM_DEC, ZOOM_INC, ZOOM_PCT, DOC_PANEL, DOC_BODY, DOC_BODY_NAV, NAV_PREV, NAV_NEXT, LANG_EN, LANG_ZH, MENU_REGION, OVERLAY]) sig(o);

const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const put = (dst, r) => Object.assign(dst, r);
let lastKey = '';

export function applyLayout(w, h) {
  w = Math.round(w) || 720; h = Math.round(h) || 1560;
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}|${Math.round(host.px * 100)}`;
  if (key === lastKey) return LAY;
  lastKey = key;
  const L = compute(w, h);
  Object.keys(LAY).forEach((k) => delete LAY[k]);
  Object.assign(LAY, L, { key });
  SCREEN.width = w; SCREEN.height = h;
  CELL = L.cell; BANNER_Y = L.banner.y;
  put(BACK_BTN, L.back); put(PAUSE_BTN, L.pause);
  put(BOARD_ORIGIN, { x: L.board.x, y: L.board.y }); put(BOARD_PX, L.board); put(FRAME, L.frame); put(GATE_PX, L.gate); put(STATS, L.stats.rect);
  L.tools.forEach((r, i) => put(TOOLS[i], r));
  put(AUTO_BTNS.slower, L.auto.slower); put(AUTO_BTNS.pause, L.auto.pause); put(AUTO_BTNS.faster, L.auto.faster);
  put(DOC_BACK, L.doc.back); put(ZOOM_DEC, L.doc.zdec); put(ZOOM_INC, L.doc.zinc); put(ZOOM_PCT, L.doc.zpct);
  put(DOC_PANEL, L.doc.panel); put(DOC_BODY, L.doc.body); put(DOC_BODY_NAV, L.doc.bodyNav);
  put(NAV_PREV, L.doc.prev); put(NAV_NEXT, L.doc.next); put(NAV_LABEL, L.doc.label);
  put(LANG_EN, L.title.en); put(LANG_ZH, L.title.zh); put(MENU_REGION, L.title.menu);
  put(OVERLAY, L.ov.rect);
  return LAY;
}

// ------------------------------------------------------------------------------------------------------------------
function compute(w, h) {
  const U = { x0: host.l, x1: w - host.r, y0: host.t, y1: h - host.b };
  U.w = U.x1 - U.x0; U.h = U.y1 - U.y0; U.cx = (U.x0 + U.x1) / 2;
  const backShift = host.back ? host.back + 14 / Math.max(0.3, host.px) : 0;            // the host's floating back button owns the top-left corner
  const tap = clamp(44 / Math.max(0.3, host.px), 62, 96);      // about 44 css px, in units
  const land = w > h;
  const L = { w, h, U, tap, land };

  // ---- candidate play layouts: pick the one with the biggest board ----
  const FW = 676;                                              // frame width at cell 154 (scales with s)
  const mins = { T: 140, g1: 14, stats: 104, g2: 12, zone: 64, g3: 10, tools: 104, B: 20 };
  const fulls = { T: 232, g1: 28, stats: 118, g2: 26, zone: 68, g3: 16, tools: 118, B: 96 };
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  const sTallW = (U.w - 32) / FW;
  const sTallH = (U.h - sum(mins) - mins.T * 0 + 0) / 858;
  const sTall = clamp(Math.min(sTallW, sTallH, 1), 0.3, 1);
  const GUT = 14, PMIN = 190;
  const sWide = clamp(Math.min((U.w - 2 * PMIN - 4 * GUT) / FW, (U.h - 40) / 858, 1), 0.3, 1);
  const sSide = clamp(Math.min((U.w - PMIN - 3 * GUT) / FW, (U.h - 108 - 70) / 858, 1), 0.3, 1);
  let mode = 'tall', s = sTall;
  if (land) { mode = 'wide'; s = sWide; if (sTall > sWide * 1.05) { mode = 'tall'; s = sTall; } }
  else if (sSide > sTall * 1.05) { mode = 'side'; s = sSide; }
  L.mode = mode; L.s = s;
  const c = 154 * s; L.cell = c;
  const fw = FW * s, fh = 858 * s, pad = 30 * s;

  const hudTitle = (x, y, align, maxW) => ({ x, y, align, maxW });
  if (mode === 'tall') {
    // vertical budget: interpolate between the compact and the approved heights, spare room goes to the top and bottom margins
    const Amin = sum(mins) + fh, Afull = sum(fulls) + fh;
    const f = clamp((U.h - Amin) / (Afull - Amin), 0, 1);
    const e = {};
    for (const k of Object.keys(mins)) e[k] = mins[k] + f * (fulls[k] - mins[k]);
    const extra = Math.max(0, U.h - (sum(e) + fh));
    e.T += extra * 0.4; e.B += extra * 0.6;
    let y = U.y0;
    const frameY = y + e.T; y = frameY + fh + e.g1;
    const statsY = y; y += e.stats + e.g2;
    const zoneY = y; y += e.zone + e.g3;
    const toolsY = y;
    L.frame = R(U.cx - fw / 2, frameY, fw, fh);
    const cw = Math.min(676, U.w - 32);
    L.stats = { rect: R(U.cx - cw / 2, statsY, cw, e.stats), dir: 'row' };
    const tw3 = (cw - 40) / 3;
    L.tools = [0, 1, 2].map((i) => R(U.cx - cw / 2 + i * (tw3 + 20), toolsY, tw3, e.tools));
    L.toolStyle = 'tile';
    const aw = Math.min(672, U.w - 48), ax = U.cx - aw / 2, gap = 16, sl = aw * 160 / 672;
    L.auto = { slower: R(ax, toolsY, sl, e.tools), pause: R(ax + sl + gap, toolsY, aw - 2 * sl - 2 * gap, e.tools), faster: R(ax + aw - sl, toolsY, sl, e.tools) };
    L.autoStyle = 'tile';
    L.banner = { x: U.cx, y: zoneY + 24, w: Math.min(676, U.w - 32), lines: 1, align: 'center', hintY: zoneY + 64 };
    L.bar = R(U.cx - 240, zoneY + 54, 480, 8);
    const hy = U.y0 + 22;
    L.back = R(Math.max(16 + U.x0, U.x0 + backShift + 8), hy, 84, 78);
    L.pause = R(U.x1 - 16 - 84, hy, 84, 78);
    L.hud = hudTitle(U.cx, U.y0 + 62, 'center', U.w - 2 * 120 - 2 * backShift); L.hud.subY = U.y0 + 98;
    L.card = null;
  } else if (mode === 'side') {
    const top = U.y0 + 12, hudH = 100;
    const colW = clamp(U.w - fw - 3 * GUT, PMIN, 300);
    const groupW = fw + GUT + colW, gx = U.cx - groupW / 2;
    const availTop = top + hudH, availH = U.y1 - availTop - 64;
    const fy = availTop + Math.max(0, (availH - fh) / 2);
    L.frame = R(gx, fy, fw, fh);
    const colX = gx + fw + GUT;
    const statsH = 3 * 68 + 20;
    L.stats = { rect: R(colX, fy, colW, statsH), dir: 'col' };
    const th = Math.max(tap, 72);
    let ty = fy + statsH + 14;
    L.tools = [0, 1, 2].map((i) => R(colX, ty + i * (th + 10), colW, th));
    L.toolStyle = 'row';
    L.auto = { slower: R(colX, ty, colW, th), pause: R(colX, ty + th + 10, colW, th + 14), faster: R(colX, ty + 2 * th + 34, colW, th) };
    L.autoStyle = 'row';
    L.banner = { x: gx + groupW / 2, y: fy + fh + 40, w: Math.min(groupW, U.w - 32), lines: 1, align: 'center', hintY: fy + fh + 76 };
    L.bar = R(gx + 20, fy + fh + 88, groupW - 40, 8);
    L.back = R(Math.max(16 + U.x0, U.x0 + backShift + 8), top + 10, 84, 78);
    L.pause = R(U.x1 - 16 - 84, top + 10, 84, 78);
    L.hud = hudTitle(U.cx, top + 50, 'center', U.w - 2 * 120 - 2 * backShift); L.hud.subY = top + 86;
    L.card = null;
  } else {
    // wide: left card | board | right card, the board as tall as the height allows, centred
    const fy = U.y0 + 26 + (U.h - 40 - fh) / 2;
    const pw = clamp((U.w - fw - 4 * GUT) / 2, PMIN, 400);
    const groupW = fw + 2 * pw + 2 * GUT, gx = U.cx - groupW / 2;
    L.frame = R(gx + pw + GUT, fy, fw, fh);
    const lx = gx, rx = gx + pw + GUT + fw + GUT;
    const top = Math.max(U.y0 + 12, fy), bottom = Math.min(U.y1 - 12, fy + fh);
    // left card: back + level title, stats, message
    L.back = R(Math.max(lx, U.x0 + backShift), top, 84, 78);
    L.hud = hudTitle(lx, top + 78 + 36, 'left', pw); L.hud.subY = top + 78 + 70;
    const statsY = top + 78 + 96;
    const statsH = 3 * 62 + 16;
    L.stats = { rect: R(lx, statsY, pw, statsH), dir: 'col' };
    L.banner = { x: lx, y: statsY + statsH + 14, w: pw, lines: 4, align: 'left', hintY: 0 };
    L.bar = R(lx, bottom - 12, pw, 8);
    // right card: pause on top, then the buttons
    L.pause = R(rx + pw - 84, top, 84, 78);
    const th = clamp((bottom - top - 98 - 60) / 3.4, Math.max(tap, 78), 108);
    const tt = top + 98;
    L.tools = [0, 1, 2].map((i) => R(rx, tt + i * (th + 12), pw, th));
    L.toolStyle = 'row';
    L.auto = { slower: R(rx, tt, pw, th), pause: R(rx, tt + th + 12, pw, th + 18), faster: R(rx, tt + 2 * th + 42, pw, th) };
    L.autoStyle = 'row';
    L.card = { left: R(lx - 8, top - 10, pw + 16, bottom - top + 20), right: R(rx - 8, top - 10, pw + 16, bottom - top + 20) };
    L.hud.cardW = pw; L.hud.rightX = rx; L.hud.pw = pw;
  }
  // the board sits inside the frame
  L.board = R(L.frame.x + pad, L.frame.y + pad, 616 * s, 770 * s);
  L.gate = { x: L.board.x + c, y: L.board.y + c * 5, w: c * 2 };

  // ---- document screens (levels, How to Play, Rules, About, Settings) ----
  {
    const pwid = Math.min(U.w - 48, 960), px0 = U.cx - pwid / 2;
    const barY = U.y0 + 20, barH = 76;
    const bx0 = Math.max(px0 - 8, U.x0 + 16), bx1 = Math.min(px0 + pwid + 8, U.x1 - 16);
    const backX = Math.max(bx0, U.x0 + backShift + 8);
    const barFree = (bx1 - 84 - 140 - 84) - (backX + 140) - 24;
    const inBar = h < 900 && w >= 900 && barFree >= 330;      // landscape: Prev/Next move up into the header to save height
    const navH = 84, navY = U.y1 - 26 - navH;
    const panelY = U.y0 + 112;
    const panelH = (inBar ? U.y1 - 26 : navY - 16) - panelY;
    const zinc = R(bx1 - 84, barY, 84, barH), zpct = R(bx1 - 84 - 140, barY, 140, barH), zdec = R(bx1 - 84 - 140 - 84, barY, 84, barH);
    const dc = {
      back: R(backX, barY, 140, barH), zdec, zinc, zpct, inBar,
      panel: R(px0, panelY, pwid, panelH),
      body: R(px0 + 24, panelY + 24, pwid - 48, panelH - 48),
      panelFull: R(px0, panelY, pwid, U.y1 - 26 - panelY), bodyFull: R(px0 + 24, panelY + 24, pwid - 48, U.y1 - 26 - panelY - 48),
      bodyNav: R(px0 + 24, panelY + 24, pwid - 48, inBar ? panelH - 48 : Math.max(120, panelH - 132)),
      prev: R(px0, navY, 210, navH), next: R(px0 + pwid - 210, navY, 210, navH), label: { x: U.cx, y: navY + 50 },
    };
    if (inBar) {
      const mid = (backX + 140 + zdec.x) / 2;
      const bw = Math.min(150, (barFree - 110) / 2);
      dc.prev = R(mid - bw - 55, barY, bw, barH); dc.next = R(mid + 55, barY, bw, barH); dc.label = { x: mid, y: barY + 46 };
    }
    L.doc = dc;
  }

  // ---- title screen ----
  {
    const chipW = [270, 240], chipH = Math.max(64, Math.min(88, tap));
    const T = { en: R(0, 0, chipW[0], chipH), zh: R(0, 0, chipW[1], chipH), lock: { cx: U.cx, y: U.y1 - 28, w: 250 } };
    const tcx = U.cx;
    if (!land) {
      const A = U.h;
      const ts = clamp(0.5 + 0.5 * (A - 700) / 860, 0.5, 1);
      const compact = A < 1500, tiny = A < 1000;
      const topY = U.y0 + 130, chipY = U.y0 + 24;
      T.en = R(Math.max(150, U.x0 + backShift + 8) + (U.cx - 360), chipY, chipW[0], chipH);
      T.zh = R(T.en.x + chipW[0] + 12, chipY, chipW[1], chipH);
      if (T.zh.x + chipW[1] > U.x1 - 8) { const d = T.zh.x + chipW[1] - (U.x1 - 8); T.en.x -= d; T.zh.x -= d; }
      if (T.en.x < U.x0 + backShift + 8) { const d = U.x0 + backShift + 8 - T.en.x; T.en.x += d; T.zh.x += d; }
      const by = topY + 300 * ts;
      const menuNeed = (tiny ? 352 : compact ? 400 : 470) + 90, bottomRes = compact ? 16 : 14;
      let k = clamp((U.y1 - by - menuNeed - bottomRes - 24) / 770, 0.18, 0.5);
      if (U.y1 - by - menuNeed - bottomRes - 24 < 0.22 * 770) k = 0;
      const boardH = k ? 770 * k + 15 : 0;
      const menuY = k ? by + boardH + 0 : by + 10;
      T.title = { cx: tcx, top: topY, ts, lanternY: U.y0 + 100 };
      T.board = { k, x: tcx - 616 * k / 2 - 0, y: by };
      T.menu = R(U.cx - Math.min(672, U.w - 48) / 2, menuY, Math.min(672, U.w - 48), Math.max(300, U.y1 - bottomRes - menuY));
      if (!compact && Math.abs(U.h - 1560) < 1) { T.menu = R(24, 830, 672, 700); T.board.y = 430; T.menu.x = U.cx - 336; }
      T.lock = { cx: U.cx, y: U.y1 - 20, w: 250 };
      T.compact = compact ? (tiny ? 2 : 1) : 0;
    } else {
      const chipY = U.y0 + 16;
      T.zh = R(U.x1 - 16 - chipW[1], chipY, chipW[1], chipH);
      T.en = R(T.zh.x - 12 - chipW[0], chipY, chipW[0], chipH);
      const three = w >= 1240;
      const Lw = three ? clamp(w * 0.34, 440, 560) : clamp(w * 0.46, 400, 560);
      const lx0 = U.x0 + 16;
      const ts = clamp(Lw / 600, 0.55, 0.9) * (h < 760 ? 0.92 : 1);
      const topY = U.y0 + (three ? 120 : 84);
      T.title = { cx: lx0 + Lw / 2, top: topY, ts, lanternY: U.y0 + 100, lanternL: lx0 + 26, lanternR: lx0 + Lw - 26 };
      const menuY = Math.max(U.y0 + 100, chipY + chipH + 10);   // always below the language chips (they grow with the tap size)
      const menuW = clamp(w - Lw - 16 - 32 - (three ? 420 : 0), 380, 520);
      if (three) {
        const k = clamp(Math.min((h - 150) / 770, 0.68), 0.3, 0.7);
        const bw = 616 * k, bx = lx0 + Lw + 24;
        T.board = { k, x: bx + 12 * k, y: U.y0 + (h - 770 * k) / 2 + 20 };
        T.menu = R(U.x1 - 16 - menuW, menuY, menuW, U.y1 - 12 - menuY);
        T.lock = { cx: lx0 + Lw / 2, y: U.y1 - 30, w: 250 };
      } else {
        const by = topY + 300 * ts + 10;
        const k = clamp((U.y1 - by - 40) / 770, 0.2, 0.5);
        T.board = { k: U.y1 - by - 40 < 0.2 * 770 ? 0 : k, x: lx0 + Lw / 2 - 616 * k / 2, y: by };
        T.menu = R(U.x1 - 16 - menuW, menuY, menuW, U.y1 - 12 - menuY);
        T.lock = { cx: U.x1 - 16 - menuW / 2, y: U.y1 - 24, w: 250 };
      }
      T.compact = 1;
    }
    L.title = T;
  }

  // ---- overlays (pause, win, auto summary, demo card) ----
  {
    const wide = land && h < 900;
    const ow = wide ? Math.min(880, U.w - 48) : Math.min(620, U.w - 32);
    const maxH = U.h - 36;
    L.ov = { rect: R(U.cx - ow / 2, U.y0 + 18, ow, maxH), w: ow, maxH, cy: U.y0 + U.h / 2, row: wide };
  }
  return L;
}
