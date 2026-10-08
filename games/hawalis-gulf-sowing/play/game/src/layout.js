// Screen rectangles shared by drawing (view.js) and hit-testing (game.js). Pure data.
// FLUID LAYOUT (kit 1.7.1): the short side of the screen is always 720 virtual units, the long side follows the aspect (cap 2.4:1),
// so the game fills every phone and tablet in portrait and in landscape. Every rectangle below is a pure function of the LIVE size
// (meta.width x meta.height, kept current by the kit) + the text-zoom step + the host's safe insets; layoutFor() caches by that key.
//   modes:  'tall'    portrait: header, plate, board, plate, status, toolbar (the approved phone look; shrinks to fit shorter screens)
//           'duo'     portrait, squarish tablet: the two plates share one row above the board
//           'wide'    landscape, plenty of width: left card (opponent + status), board, right card (you + buttons)
//           'side'    landscape, less width: board + status on the left, one column of cards on the right
import { BW, BH } from './art.js';

export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };   // px: css pixels per virtual unit

export const inRect = (x, y, r) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const TOOLBAR_IDS = ['undo', 'think', 'restart'];
const R = (x, y, w, h) => ({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

let cache = { key: '', v: null };
export const layoutNow = (scale = 1) => layoutFor(meta.width, meta.height, scale);

export function layoutFor(w, h, scale = 1) {
  const key = `${w}x${h}|${scale}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}|${host.px}`;
  if (cache.key === key) return cache.v;
  const ins = { t: host.t, r: host.r, b: host.b, l: host.l, back: host.back };
  const land = w > h;
  const L = { w, h, land, ins, scale };
  L.minText = clamp(Math.round(11 / Math.max(0.3, host.px)), 14, 22);   // text never below about 11 css px
  const backSz = ins.back ? Math.max(ins.back, 56) : 0;
  const leftX = ins.l + (backSz ? backSz + 14 : 16);                    // first free x of a top bar (the host's back button sits top-left)
  const rightX = w - ins.r - 16;

  // ---- play header: Back (left), title, Pause (right)
  const kp = Math.max(0.3, host.px || 0.6), barY = ins.t + Math.max(22, Math.ceil(6 / kp + 1.7 * Math.max(16, 11.5 / kp)) + 4);   // below the kit's 'Preview m:ss' badge (top-centre, 6 css px under the inset, about 20 css px tall)
  L.bar = { back: R(leftX, barY, 84, 78), pause: R(rightX - 84, barY, 84, 78), bottom: barY + 78, y0: barY, compact: false };
  L.bar.titleX = (L.bar.back.x + L.bar.back.w + L.bar.pause.x) / 2;
  L.bar.titleW = Math.max(120, L.bar.pause.x - (L.bar.back.x + L.bar.back.w) - 24);

  // ---- document screens (setup, Learn, How to play, Rules, About, Settings, unlock card)
  const cw = Math.min(w - 48 - 2 * Math.max(ins.l, ins.r), 960), cx = Math.round((w - cw) / 2);
  const dBarY = ins.t + (land ? 12 : 20), panelY = dBarY + 76 + 16, edge = h - ins.b - (land ? 16 : 26);
  const navY = edge - 84, startY = edge - 96, nw = cw >= 800 ? 260 : 210;
  const zInc = R(cx + cw + 8 - 84, dBarY, 84, 76);
  const dBack = R(Math.max(cx - 8, leftX), dBarY, 140, 76);
  const pctW = clamp(zInc.x - 84 - (dBack.x + dBack.w + 8) - 84 + 84, 56, 140);   // the A- / % / A+ group gives way when the bar is tight
  const body = (p) => R(p.x + 24, p.y + 24, p.w - 48, p.h - 48);
  const pFull = R(cx, panelY, cw, edge - panelY), pNav = R(cx, panelY, cw, navY - 12 - panelY), pStart = R(cx, panelY, cw, startY - 10 - panelY);
  L.doc = {
    back: dBack, zoomDec: R(zInc.x - 84 - pctW, dBarY, 84, 76), zoomInc: zInc, pct: R(zInc.x - pctW, dBarY, pctW, 76),
    panel: pFull, body: body(pFull), panelNav: pNav, bodyNav: body(pNav), panelStart: pStart, bodyStart: body(pStart),
    prev: R(cx, navY, nw, 84), next: R(cx + cw - nw, navY, nw, 84), navLabelY: navY + 50, start: R(cx, startY, cw, 96), cx, cw, edge,
  };

  // ---- overlay cards (pause, result, lesson, Watch & Learn summary, unlock card)
  const ow = Math.min(w - 100 - 2 * Math.max(ins.l, ins.r), land ? 760 : 620);
  L.overlay = { x: Math.round((w - ow) / 2), w: ow, cy: (h + ins.t - ins.b) / 2, maxH: Math.min(1180, h - ins.t - ins.b - (land ? 24 : 40)) };

  L.play = playFor(L, scale, false);
  L.auto = playFor(L, scale, true);
  cache = { key, v: L };
  return L;
}

// Rectangles of the play / Watch & Learn screen. `auto` swaps the toolbar (Undo / Think / Restart) for slower / Pause / faster.
function playFor(L, scale, auto) {
  const { w, h, ins } = L;
  const k = clamp((scale - 1) / 2, 0, 1);
  const out = { mode: 'tall', chips: [], board: null, status: null, tool: [], slower: null, pause: null, faster: null };
  const ctrlRow = (x, y, cw, ch) => {   // the bottom row of three buttons
    const bw = (cw - 32) / 3;
    if (auto) { const sw = Math.round(cw * 0.238); out.slower = R(x, y, sw, ch); out.pause = R(x + sw + 16, y, cw - 2 * sw - 32, ch); out.faster = R(x + cw - sw, y, sw, ch); }
    else out.tool = [0, 1, 2].map((i) => R(x + i * (bw + 16), y, bw, ch));
  };

  if (!L.land) {
    const barY0 = L.bar.y0, top = L.bar.bottom + 4, x0 = 24 + ins.l, cw = w - 48 - ins.l - ins.r, maxBw = Math.min(696, cw);
    const bhOf = (bw) => bw * BH / BW;
    // three arrangements of a portrait screen:
    //   tall  two player cards (above and below the board), status, buttons (the phone look)
    //   duo   both cards in one row above the board, status, buttons (squarish tablets)
    //   duo2  both cards in one row, and under the board the status on the left with the buttons on the right (squarest screens)
    const solve = (mode, f) => {
      const duo = mode !== 'tall', two = mode === 'duo2';
      const chipH = duo ? Math.max(mode === 'duo2' ? 140 : 150, Math.round(((mode === 'duo2' ? 150 : 170) + 50 * k) * f)) : Math.max(96, Math.round((124 + 50 * k) * f));
      const gap = Math.max(8, Math.round(22 * f));
      const statusH = two ? Math.max(120, Math.round((150 + 80 * k) * f)) : Math.max(100, Math.round((180 + 90 * k) * f));
      const toolH = two ? statusH : Math.max(76, Math.round((100 + 74 * k) * f));
      const bottomH = two ? statusH : statusH + gap + toolH;   // everything under the board that is not a card
      const toolY = h - ins.b - 24 - toolH, bottom = h - ins.b - 24;
      const cardsBelow = mode === 'tall' ? chipH + gap : 0;
      const fixedH = (mode === 'tall' ? 2 * chipH : chipH) + (mode === 'tall' ? 3 : 2) * gap + cardsBelow * 0 + bottomH + (two ? 0 : 0);
      const topUsed = duo ? barY0 : top;
      const boardH = (bottom - topUsed) - fixedH - 6;
      return { mode, duo, two, f, chipH, gap, statusH, toolH, toolY, bottom, bottomH, bw: Math.min(maxBw, Math.floor(boardH / BH * BW)) };
    };
    let s = null;
    for (const target of [560, 500, 440, 380, 330, 290, 250]) {
      for (let f = 1; f >= 0.5 && !s; f -= 0.05) for (const mode of ['tall', 'duo', 'duo2']) { const c = solve(mode, f); if (c.bw >= target) { s = c; break; } }
      if (s) break;
    }
    if (!s) s = solve('duo2', 0.5);
    const bw = Math.max(200, s.bw), bh = bhOf(bw);
    const nCards = s.mode === 'tall' ? 2 : 1;
    const total = s.chipH * nCards + s.gap * (s.mode === 'tall' ? 3 : 2) + bh + s.bottomH;
    const topUsed = s.duo ? barY0 : top;
    const y0 = Math.round(topUsed + (s.bottom - topUsed - total) * 0.5), boardY = y0 + s.chipH + s.gap;
    out.mode = s.mode;
    out.board = { x: Math.round(x0 + (cw - bw) / 2), y: boardY, w: bw };
    const below = boardY + bh + s.gap;
    if (s.mode === 'tall') {
      out.chips = [R(x0, y0, cw, s.chipH), R(x0, below, cw, s.chipH)];
      out.status = R(x0, below + s.chipH + s.gap, cw, s.statusH);
      ctrlRow(x0, s.toolY, cw, s.toolH);
      out.status = R(x0, below + s.chipH + s.gap, cw, Math.max(60, s.toolY - s.gap - (below + s.chipH + s.gap)));
    } else {
      // the two cards share the header row: Back, card, card, Pause (the title is dropped to give the board the room)
      const cx0 = L.bar.back.x + L.bar.back.w + 10, cwid = L.bar.pause.x - 10 - cx0, pw = (cwid - 12) / 2;
      out.chips = [R(cx0, y0, pw, s.chipH), R(cx0 + pw + 12, y0, pw, s.chipH)];
      if (!auto) { L.bar.compact = true; L.bar.back = R(L.bar.back.x, y0 + (s.chipH - 78) / 2, L.bar.back.w, 78); L.bar.pause = R(L.bar.pause.x, y0 + (s.chipH - 78) / 2, L.bar.pause.w, 78); L.bar.bottom = y0 + s.chipH; }
      if (s.two) {
        const sw = Math.round(cw * 0.46), rowH = Math.min(s.statusH, s.bottom - below);
        out.status = R(x0, below, sw, rowH);
        ctrlRow(x0 + sw + 12, below, cw - sw - 12, rowH);
      } else {
        out.status = R(x0, below, cw, Math.max(60, s.toolY - s.gap - below));
        ctrlRow(x0, s.toolY, cw, s.toolH);
      }
    }
    return out;
  }

  // ---- landscape
  const cardTop = L.bar.bottom + 8, boardTop = ins.t + 12, x0 = ins.l + 16, x1 = w - ins.r - 16, y1 = h - ins.b - 16, gap = 16;
  const colHb = y1 - boardTop, bwMaxB = colHb * BW / BH;
  const bwFit = Math.min(bwMaxB, x1 - x0 - 2 * 290 - 2 * gap);   // cards never narrower than 290: the board gives way a little first
  const sideP = Math.min(Math.max((x1 - x0 - bwFit - 2 * gap) / 2, 0), 400);
  if (bwFit >= 440) {
    // three columns: opponent card + status | board (the whole height) | your card + buttons; Back and Pause stay in the top corners
    const Pw = sideP, bw = Math.min(bwFit, x1 - x0 - 2 * Pw - 2 * gap), bh = bw * BH / BW;
    const gw = 2 * Pw + bw + 2 * gap, gx = x0 + (x1 - x0 - gw) / 2, colH = y1 - cardTop;
    const plateH = clamp(Math.round(colH * 0.4), 190, 250), rest = colH - plateH - gap;
    out.mode = 'wide';
    if (!auto) L.bar.compact = true;
    out.board = { x: Math.round(gx + Pw + gap), y: Math.round(boardTop + (colHb - bh) / 2), w: Math.round(bw) };
    const rx = gx + Pw + gap + bw + gap, ry = cardTop + plateH + gap;
    out.chips = [R(gx, cardTop, Pw, plateH), R(rx, cardTop, Pw, plateH)];
    out.status = R(gx, cardTop + plateH + gap, Pw, rest);
    if (auto) {
      const ph = Math.round(rest * 0.5), sh = rest - ph - 12, sw = (Pw - 12) / 2;
      out.pause = R(rx, ry, Pw, ph); out.slower = R(rx, ry + ph + 12, sw, sh); out.faster = R(rx + sw + 12, ry + ph + 12, sw, sh);
    } else {
      const th = Math.min(120, (rest - 24) / 3);
      out.tool = [0, 1, 2].map((i) => R(rx, ry + i * (th + 12), Pw, th));
    }
    return out;
  }
  const top = cardTop, y0 = top, colH = y1 - y0;
  // side: board + status on the left, one column of cards on the right
  const P = clamp(Math.round(w * 0.34), 300, 400), colW = x1 - x0 - P - gap;
  const statusH = clamp(Math.round(colH * 0.2), 100, 150);
  const bw = Math.max(200, Math.min(colW, (colH - gap - statusH) * BW / BH)), bh = bw * BH / BW;
  const stackH = bh + gap + statusH, by = y0 + (colH - stackH) / 2, bx = x0 + (colW - bw) / 2;
  out.mode = 'side';
  out.board = { x: Math.round(bx), y: Math.round(by), w: Math.round(bw) };
  out.status = R(bx, by + bh + gap, bw, statusH);
  const rx = x1 - P, ctrlH = auto ? 204 : 112, plateH = Math.min(260, Math.floor((colH - ctrlH - 3 * gap) / 2));
  out.chips = [R(rx, y0, P, plateH), R(rx, y0 + plateH + gap, P, plateH)];
  const cy = y1 - ctrlH;
  if (auto) {
    const sw = (P - 12) / 2;
    out.pause = R(rx, cy, P, 96); out.slower = R(rx, cy + 108, sw, 96); out.faster = R(rx + sw + 12, cy + 108, sw, 96);
  } else {
    const tw = (P - 24) / 3;
    out.tool = [0, 1, 2].map((i) => R(rx + i * (tw + 12), cy, tw, ctrlH));
  }
  return out;
}

// Back-compat helpers used by tests: the live play layout at a text-zoom scale.
export const playLayout = (scale = 1) => layoutNow(scale).play;
export const autoLayout = (scale = 1) => layoutNow(scale).auto;

// Tap zone of the Arcforge lockup (title / language screens): at least 44 x 44 css px, grown sideways/downwards only.
export const creditHit = (k) => { const m = 44 / Math.max(host.px, 1e-6), w = Math.max(k.w, m), h = Math.max(k.h, m); return { x: Math.round(k.cx - w / 2), y: Math.round(k.y), w: Math.round(w), h: Math.round(h) }; };
