// Screen rectangles shared by drawing (view.js) and hit-testing (game.js). Pure functions of the LIVE virtual size (kit 1.7.1 fluid
// viewport: the SHORT side is always 720 units, the long side follows the screen) and of the host's safe areas. Nothing here draws.
//
// Three shapes:
//   tall     portrait phone (height >= 1500): the approved phone look, unchanged.
//   compact  portrait shorter than a phone (iPad, 7 / 10 inch tablets, small phones): the same stack with tighter bands.
//   wide     landscape, and squarish windows (height < 900): the board on the left with both yards, a column on the right
//            (buttons, title, status, counts, sticks mat, toolbar). Documents and menus become a centred column / art + menu.
// Every rect returned is inside the safe area. When `host.back` is non-zero (the host draws a floating back button in the top-left
// corner) the game's own controls never sit under it.
export const inRect = (x, y, r) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Host safe areas and floating back button in virtual units (main.js keeps this current; browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

let LW = 720, LH = 1560;
export function setLive(w, h) { LW = Math.max(240, Math.round(w)); LH = Math.max(240, Math.round(h)); }
export const live = () => ({ w: LW, h: LH });

const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const hostKey = () => `${LW}x${LH}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
const memo = new Map();
function cached(key, make) {
  let v = memo.get(key);
  if (!v) { v = make(); memo.set(key, v); if (memo.size > 60) memo.delete(memo.keys().next().value); }
  return v;
}

export function frame() {
  const w = LW, h = LH;
  const mode = w >= h || h < 900 ? 'wide' : h >= 1500 ? 'tall' : 'compact';
  const U = { x0: host.l, y0: host.t, x1: w - host.r, y1: h - host.b };
  U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const bs = host.back ? Math.max(host.back, 56) + 8 : 0;
  const backBox = host.back ? R(host.l, host.t, bs, bs) : R(0, 0, 0, 0);
  return { w, h, mode, U, backBox };
}

// ------------------------------------------------------------------------------------------------ documents
const BTN_H = 84;
export function docLayout() {
  return cached(`doc|${hostKey()}`, () => {
    const F = frame(), { w, h, U, mode, backBox } = F;
    const cw = Math.min(U.w - 48, mode === 'wide' ? 900 : 672), colX = Math.round(U.x0 + (U.w - cw) / 2);
    const hdrY = Math.max(20, U.y0 + 8);
    const bx = host.back ? Math.max(colX, backBox.x + backBox.w + 8) : colX;
    const inc = R(colX + cw - 84, hdrY, 84, BTN_H), pct = R(inc.x - 8 - 132, hdrY, 132, BTN_H), dec = R(pct.x - 8 - 84, hdrY, 84, BTN_H);
    const back = R(bx, hdrY, 140, BTN_H);
    const bottom = U.y1 - (host.b ? 12 : 24);
    const panelY = hdrY + BTN_H + 12;
    const navY = bottom - BTN_H, startY = bottom - 96;
    const navW = Math.min(210, Math.round((cw - 120) / 2));
    const withNav = R(colX, panelY, cw, navY - 12 - panelY);
    const withStart = R(colX, panelY, cw, startY - 12 - panelY);
    const full = R(colX, panelY, cw, bottom - panelY);
    return {
      mode, w, h, U, col: { x: colX, w: cw },
      back, dec, pct, inc,
      panelNav: withNav, panelStart: withStart, panelFull: full,
      prev: R(colX, navY, navW, BTN_H), next: R(colX + cw - navW, navY, navW, BTN_H), navLabel: { x: colX + cw / 2, y: navY + BTN_H / 2 + 9 },
      start: R(colX, startY, cw, 96),
    };
  });
}
export const bodyOf = (panel) => R(panel.x + 24, panel.y + 24, panel.w - 48, panel.h - 48);

// ------------------------------------------------------------------------------------------------ title screen
export function titleLayout() {
  return cached(`title|${hostKey()}`, () => {
    const F = frame(), { w, U, mode } = F;
    const lw = Math.round(Math.max((mode === 'wide' ? 0.28 : 0.35) * 720, 120 / Math.max(host.px, 1e-6))), lh = Math.round(lw * 327 / 1200);
    const T = { mode, dense: mode !== 'tall', lockup: null, mat: null };
    if (mode === 'wide') {
      const mw = clamp(Math.round(U.w * 0.4), 440, 640);
      const menu = R(U.x1 - 16 - mw, U.y0 + 8, mw, U.h - 16 - lh - 18);
      const ax0 = U.x0 + 16, ax1 = menu.x - 16, aw = ax1 - ax0, cx = (ax0 + ax1) / 2;
      const size = clamp(Math.round(aw * 0.3), 84, 150);
      const avail = U.h - 24;
      const head = size * 0.85 + 50 + 38 + 40;            // title + sub + tagline + gaps
      const matH = clamp(avail - head - 28, 0, 320);
      const showMat = matH >= 130;
      const total = head + (showMat ? matH + 14 : 0);
      let y = U.y0 + 12 + Math.max(0, (avail - total) / 2);
      Object.assign(T, { cx, size, titleY: Math.round(y + size * 0.82) });
      y += size * 0.82 + 40; T.subY = Math.round(y); y += 36; T.tagY = Math.round(y); y += 20;
      if (showMat) { const mwid = Math.min(aw - 20, 560); T.mat = R(Math.round(cx - mwid / 2), Math.round(y), Math.round(mwid), Math.round(matH)); y += matH + 14; }
      T.lockup = R(Math.round(menu.x + mw / 2 - lw / 2), Math.round(menu.y + menu.h + 14), lw, lh);   // bottom-centre under the menu column
      T.menu = menu; T.subSize = 38; T.tagSize = 24; T.maxW = aw - 20;
      return T;
    }
    const dy = Math.max(0, host.t - 24);
    T.cx = w / 2; T.maxW = 640;
    T.lockup = R(Math.round(w / 2 - lw / 2), U.y1 - 12 - lh, lw, lh);
    if (mode === 'tall') {
      Object.assign(T, { size: 150, titleY: 222 + dy, subY: 280 + dy, tagY: 322 + dy, subSize: 40, tagSize: 24, mat: R(60, 350 + dy, 600, 292) });
      T.menu = R(24, 674 + dy, 672, T.lockup.y - 8 - (674 + dy));
      return T;
    }
    // the menu needs about 520 units at its tight sizes; whatever is left above it holds the felt mat, scaled to fit (a shorter, narrower
    // mat on 4:3 tablets, with a tighter title block) so there is never an empty band above the menu
    const need = 520, room = (top) => clamp(T.lockup.y - 8 - need - top - 14, 0, 300);
    let matTop = 262 + dy;
    Object.assign(T, { size: 118, titleY: 150 + dy, subY: 202 + dy, tagY: 238 + dy, subSize: 34, tagSize: 22 });
    if (room(matTop) < 130) { matTop = 224 + dy; Object.assign(T, { size: 100, titleY: 124 + dy, subY: 170 + dy, tagY: 202 + dy, subSize: 32, tagSize: 22 }); }
    const matH = room(matTop);
    let y = matTop;
    if (matH >= 84) { const mw = Math.min(600, Math.round(matH * 3.4)); T.mat = R(Math.round(w / 2 - mw / 2), matTop, mw, Math.round(matH)); y = matTop + matH + 14; }
    T.menu = R(24, y, 672, T.lockup.y - 8 - y);
    return T;
  });
}

// ------------------------------------------------------------------------------------------------ overlay card
export function overlayLayout() {
  return cached(`ov|${hostKey()}`, () => {
    const F = frame(), { U, mode } = F;
    const cw = Math.min(mode === 'wide' ? 760 : 620, U.w - 32);
    const maxH = Math.min(1180, U.h - 24);
    return { wide: mode === 'wide', x: Math.round(U.x0 + (U.w - cw) / 2), w: cw, maxH, cy: Math.round(U.y0 + U.h / 2) };
  });
}

// ------------------------------------------------------------------------------------------------ play screen
export const TOOLBAR_IDS = ['throw', 'think', 'undo'];
const BOARD_RATIO = 0.6057;                 // board height / width (frame included)

export function playLayout(scale) {
  return cached(`play|${hostKey()}|${scale}`, () => buildPlay(scale));
}

function buildPlay(scale) {
  const F = frame(), { w, h, U, mode, backBox } = F;
  const k = clamp((scale - 1) / 2, 0, 1);
  const P = { mode, w, h };
  if (mode !== 'wide') {
    const cf = clamp((h - 1000) / 540, 0, 1), kk = k * (0.4 + 0.6 * cf);
    const gap = Math.round(lerp(8, 10, cf));
    const xL = Math.round((w - 672) / 2);
    const hdrY = Math.max(22, U.y0 + 6);
    const bx = host.back ? backBox.x + backBox.w + 8 : U.x0 + 16;
    P.back = R(bx, hdrY, 84, BTN_H); P.pause = R(U.x1 - 16 - 84, hdrY, 84, BTN_H);
    const l0 = P.back.x + P.back.w, r0 = P.pause.x;
    P.hud = { cx: (l0 + r0) / 2, titleY: hdrY + 36, subY: hdrY + 74, maxW: r0 - l0 - 16 };
    const toolH0 = Math.round(lerp(84, 112, cf) + 40 * kk);
    const toolY = U.y1 - 28 - toolH0;
    const top = hdrY + 96, bottom = toolY - 14;
    const matMin = scale >= 2 ? lerp(120, 200, cf) : lerp(130, 340, cf);
    const matHard = cf > 0.9 ? 200 : 120;
    const maxBW = Math.min(644, w - 76);
    let yardH = Math.round(lerp(88, 124, cf) + 50 * kk), chipH = Math.round(lerp(60, 68, cf) + 30 * kk), statusH = Math.round(lerp(84, 138, cf) + 110 * kk);
    for (let pass = 0; pass < 3; pass++) {
      const fixed = yardH * 2 + chipH + statusH + gap * 5;
      const bw = clamp(Math.floor((bottom - top - fixed - matMin) / BOARD_RATIO), 280, maxBW), bh = Math.round(bw * BOARD_RATIO);
      let y = top;
      P.yardTop = R(xL, y, 672, yardH); y += yardH + gap;
      P.board = R(Math.round((w - bw) / 2), y, bw, bh); y += bh + gap;
      P.yardBottom = R(xL, y, 672, yardH); y += yardH + gap;
      P.chips = R(xL, y, 672, chipH); y += chipH + gap;
      const matH = bottom - y - statusH - gap;
      if (matH >= matHard || pass === 2) {
        P.mat = R(xL, y, 672, Math.max(matHard, matH)); y += P.mat.h + gap;
        P.status = R(xL, y, 672, statusH);
        break;
      }
      yardH = Math.max(80, yardH - 14); chipH = Math.max(52, chipH - 8); statusH = Math.max(70, statusH - 24);
    }
    const tw = Math.floor((672 - 32) / 3);
    P.tool = [0, 1, 2].map((i) => R(xL + i * (tw + 16), toolY, tw, toolH0));
    P.auto = { slower: R(xL, toolY, 160, toolH0), pause: R(xL + 176, toolY, 320, toolH0), faster: R(xL + 512, toolY, 160, toolH0), labelY: toolY - 22 };
    return finish(P, U);
  }
  // ---- wide: board + yards on the left, one column on the right
  const m = 16, gap = 10;
  const Rw = clamp(Math.round(U.w * 0.34), 300, 500);
  const px = U.x1 - m - Rw;
  const lx0 = U.x0 + m + (host.back ? backBox.w : 0), lx1 = px - m, Lw = lx1 - lx0;
  const top = U.y0 + 10, bot = U.y1 - 10, availH = bot - top;
  // right column
  P.back = R(px, top, 84, BTN_H); P.pause = R(px + Rw - 84, top, 84, BTN_H);
  P.hud = { cx: px + Rw / 2, titleY: top + 36, subY: top + 70, maxW: Rw - 2 * 92 };
  const hdrB = top + BTN_H;
  let statusH = Math.round(100 + 110 * k), chipH = Math.round(62 + 30 * k), toolH = Math.round(84 + 40 * k);
  const matMin = 130;
  for (let pass = 0; pass < 3; pass++) {
    const matH = bot - toolH - gap - (hdrB + gap + statusH + gap + chipH + gap);
    if (matH >= matMin || pass === 2) {
      let y = hdrB + gap;
      P.status = R(px, y, Rw, statusH); y += statusH + gap;
      P.chips = R(px, y, Rw, chipH); y += chipH + gap;
      P.mat = R(px, y, Rw, Math.max(60, matH));
      break;
    }
    statusH = Math.max(76, statusH - 22); chipH = Math.max(52, chipH - 8); toolH = Math.max(80, toolH - 12);
  }
  const toolY = bot - toolH, tw = Math.floor((Rw - 2 * gap) / 3);
  P.tool = [0, 1, 2].map((i) => R(px + i * (tw + gap), toolY, tw, toolH));
  const sw = Rw < 420 ? Math.round((Rw - 2 * gap) / 3) : Math.round(Rw * 0.26);
  P.auto = { slower: R(px, toolY, sw, toolH), pause: R(px + sw + gap, toolY, Rw - 2 * sw - 2 * gap, toolH), faster: R(px + Rw - sw, toolY, sw, toolH), labelY: toolY - 22 };
  // left column
  let yardH = Math.round(112 + 30 * k);
  let bw = Math.min(Lw - 8, 900, Math.floor((availH - 2 * yardH - 2 * gap) / BOARD_RATIO));
  if (bw < 300) { yardH = 96; bw = Math.max(240, Math.min(Lw - 8, 900, Math.floor((availH - 2 * yardH - 2 * gap) / BOARD_RATIO))); }
  const bh = Math.round(bw * BOARD_RATIO), yw = Math.min(Lw, bw + 28), cx = lx0 + Lw / 2;
  const total = 2 * yardH + bh + 2 * gap;
  let y = Math.round(top + Math.max(0, (availH - total) / 2));
  P.yardTop = R(Math.round(cx - yw / 2), y, yw, yardH); y += yardH + gap;
  P.board = R(Math.round(cx - bw / 2), y, bw, bh); y += bh + gap;
  P.yardBottom = R(Math.round(cx - yw / 2), y, yw, yardH);
  return finish(P, U);
}

function finish(P, U) {
  P.U = U;
  P.rects = { back: P.back, pause: P.pause, yardTop: P.yardTop, board: P.board, yardBottom: P.yardBottom, chips: P.chips, mat: P.mat, status: P.status, tool0: P.tool[0], tool1: P.tool[1], tool2: P.tool[2] };
  return P;
}
export const autoLayout = (scale) => playLayout(scale).auto;

// Tap zone of the Arcforge lockup (title screen): at least 44 x 44 css px, grown sideways/downwards only.
export const creditHit = (r) => { const m = 44 / Math.max(host.px, 1e-6), w = Math.max(r.w, m), h = Math.max(r.h, m); return { x: Math.round(r.x + r.w / 2 - w / 2), y: Math.round(r.y), w: Math.round(w), h: Math.round(h) }; };
