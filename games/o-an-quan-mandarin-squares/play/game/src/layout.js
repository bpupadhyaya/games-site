// Screen rectangles shared by drawing (view.js) and hit-testing (game.js). Pure data, computed from the LIVE screen size.
//
// Kit 1.7 fluid viewport: the short side is always 720 virtual units, the long side follows the screen (portrait or landscape).
// game.js and view.js call setSize(meta.width, meta.height) every frame; it is cached by size + safe-area key and republishes every
// rect through the same exported names the game has always used (BACK_BTN, DOC_PANEL, OVERLAY ...), so nothing is recomputed per frame.
// Three shapes:
//   tall     portrait phone (height >= 1500): the approved phone look, same positions as ever (it only re-centres on taller screens).
//   compact  portrait tablets / short phones: same stack, squeezed in steps (capture trays go first, then the boxes get shorter).
//   wide     landscape (width >= 1.15 x height): the board is as large as the height allows on the left, a column on the right holds
//            both players, the message and the buttons; the title is art left + menu right; cards are two columns.
import { BW, BH, VIEW } from './art.js';

export const SCREEN = { width: 720, height: 1560 };
export const inRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };   // px: css pixels per virtual unit

export const L = { w: 720, h: 1560, mode: 'tall', wide: false, key: '' };

const rc = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const publish = (dst, src) => { for (const k of Object.keys(dst)) delete dst[k]; Object.assign(dst, src); };
const frame = () => ({ t: host.t, r: host.r, b: host.b, l: host.l, back: host.back > 0 ? host.back : 0 });
const kOf = (scale) => clamp((scale - 1) / 2, 0, 1);

// ---- published rects (objects are mutated in place, so imports stay valid) ----
export const BACK_BTN = {};
export const PAUSE_BTN = {};
export const HDR = {};            // title block of the play header: x0 x1 ty sy top h
export const TOOLBAR_IDS = ['undo', 'think', 'restart'];
export const DOC_BACK = {}, ZOOM_DEC = {}, ZOOM_INC = {}, ZOOM_LABEL = {};
export const DOC_PANEL = {}, DOC_BODY = {}, DOC_PANEL_NAV = {}, DOC_BODY_NAV = {}, DOC_BODY_START = {};
export const NAV_PREV = {}, NAV_NEXT = {}, NAV_LABEL = {}, START_BTN = {};
export const OVERLAY = {};        // x, w and the largest height a card may take (y is where that box starts)
export const CARD = {};           // centre of overlay cards

export function modeOf(w, h) {
  if (w / h >= 1.15) return 'wide';
  return h >= 1500 ? 'tall' : 'compact';
}

let playCache = { key: '', v: null };

export function setSize(w, h) {
  const F = frame();
  const key = `${w}x${h}|${Math.round(F.t)},${Math.round(F.r)},${Math.round(F.b)},${Math.round(F.l)},${Math.round(F.back)}`;
  if (key === L.key) return;
  L.key = key; L.w = w; L.h = h; L.mode = modeOf(w, h); L.wide = L.mode === 'wide';
  VIEW.w = w; VIEW.h = h; SCREEN.width = w; SCREEN.height = h;
  playCache = { key: '', v: null };
  const tall = L.mode === 'tall', wide = L.wide;
  const hostOff = F.back ? F.back + 14 : 0;
  const xl = Math.max(16, F.l + 16), xr = w - Math.max(16, F.r + 16);
  const cxs = F.l + (w - F.l - F.r) / 2;

  // play header: back (menu) at the left after the host's own back button, pause at the right, title between
  const by = F.t + (tall ? 22 : wide ? 10 : 14), bh = tall ? 78 : wide ? 70 : 72;
  publish(BACK_BTN, rc(xl + hostOff, by, 84, bh));
  publish(PAUSE_BTN, rc(xr - 84, by, 84, bh));
  // landscape: the title sits left of centre (the kit's preview badge is drawn at top centre)
  const hx0 = BACK_BTN.x + 84 + 12;
  publish(HDR, { x0: hx0, x1: wide ? Math.max(hx0 + 200, Math.min(PAUSE_BTN.x - 12, w / 2 - 80)) : PAUSE_BTN.x - 12, left: wide, ty: by + bh * 0.46, sy: by + bh * 0.95, top: by + bh, h: bh });

  // document screens
  const hy = F.t + (wide ? 10 : 20), hh = wide ? 68 : 76;
  publish(DOC_BACK, rc(xl + hostOff, hy, 140, hh));
  publish(ZOOM_INC, rc(xr - 84, hy, 84, hh));
  publish(ZOOM_LABEL, rc(xr - 84 - 140, hy, 140, hh));
  publish(ZOOM_DEC, rc(xr - 84 - 140 - 84, hy, 84, hh));
  const pw = Math.min(wide ? 940 : 672, w - F.l - F.r - 48), px = F.l + (w - F.l - F.r - pw) / 2;
  const py = wide ? hy + hh + 10 : F.t + 112;
  const navH = wide ? 72 : 84, navY = h - F.b - (wide ? 16 : 26) - navH;
  const fullH = tall ? navY - 16 - py : h - F.b - 16 - py;
  publish(DOC_PANEL, rc(px, py, pw, fullH));
  publish(DOC_BODY, rc(px + 24, py + 24, pw - 48, fullH - 48));
  if (tall) {
    publish(DOC_PANEL_NAV, rc(px, py, pw, fullH));
    publish(DOC_BODY_NAV, rc(px + 24, py + 24, pw - 48, fullH - 48 - 84));
    publish(DOC_BODY_START, rc(px + 24, py + 24, pw - 48, fullH - 48 - 94));
  } else {
    const nh = navY - 12 - py;
    publish(DOC_PANEL_NAV, rc(px, py, pw, nh));
    publish(DOC_BODY_NAV, rc(px + 24, py + 24, pw - 48, nh - 48));
    publish(DOC_BODY_START, rc(px + 24, py + 24, pw - 48, nh - 48));
  }
  publish(NAV_PREV, rc(px, navY, 210, navH));
  publish(NAV_NEXT, rc(px + pw - 210, navY, 210, navH));
  publish(NAV_LABEL, { x: px + pw / 2, y: navY + navH / 2 + 9 });
  if (tall) publish(START_BTN, rc(px, navY - 10, pw, 96));
  else if (wide) publish(START_BTN, rc(px + (pw - 560) / 2, navY, 560, navH));
  else publish(START_BTN, rc(px, navY, pw, navH));

  // overlay cards
  const ow = Math.min(wide ? 940 : 620, w - F.l - F.r - 48);
  publish(OVERLAY, rc(F.l + (w - F.l - F.r - ow) / 2, F.t + 20, ow, Math.min(1180, h - F.t - F.b - 40)));
  publish(CARD, { cy: F.t + (h - F.t - F.b) / 2, cx: cxs });
}

// ---- play screen: every size follows the text-zoom step s (1 to 3), so the HUD grows with the text ----
export function playLayout(scale) {
  const key = `${L.key}|${scale}`;
  if (playCache.key === key && playCache.v) return playCache.v;
  const v = L.wide ? playWide(scale) : playStack(scale);
  playCache = { key, v };
  return v;
}

function playStack(scale) {
  const F = frame(), w = L.w, h = L.h, k = kOf(scale), tall = L.mode === 'tall';
  const x0 = Math.max(24, F.l + 16), cw = w - x0 - Math.max(24, F.r + 16), cxs = x0 + cw / 2;
  const top = HDR.top + (tall ? 16 : 8);
  const bottomPad = 28 + F.b;
  const levels = [
    { tray: scale <= 1.5 ? 96 : 0, chip: 112 + 70 * k, status: 290 + 80 * k, tool: 112 + 74 * k, gap: 18 },
    { tray: 0, chip: 112 + 70 * k, status: 290 + 80 * k, tool: 112 + 74 * k, gap: 18 },
    { tray: 0, chip: 96 + 60 * k, status: 230 + 70 * k, tool: 100 + 60 * k, gap: 14 },
    { tray: 0, chip: 84 + 50 * k, status: 170 + 60 * k, tool: 88 + 50 * k, gap: 10 },
    { tray: 0, chip: 72 + 40 * k, status: 140 + 50 * k, tool: 80 + 40 * k, gap: 8 },
  ];
  const maxBw = Math.min(696, w - F.l - F.r - 24);
  let pick = null, bw = 0;
  for (let i = 0; i < levels.length; i++) {
    const lv = levels[i];
    const chipH = Math.round(lv.chip), statusH = Math.round(lv.status), toolH = Math.round(lv.tool), trayH = lv.tray;
    const toolY = h - bottomPad - toolH, bottom = toolY - 18;
    const gap = trayH && i === 0 ? 14 : lv.gap;
    const fixed = chipH * 2 + trayH * 2 + statusH + gap * 4;
    const b = Math.floor(((bottom - top - fixed - 20) / BH) * BW);
    pick = { chipH, statusH, toolH, trayH, toolY, bottom, gap, fixed };
    bw = b;
    if (tall && i === 0) break;               // the approved phone look is always the first level (the board just clamps)
    if (b >= 520) break;
  }
  bw = Math.max(tall ? 420 : 300, Math.min(maxBw, bw));
  const { chipH, statusH, toolH, trayH, toolY, bottom, gap, fixed } = pick;
  const bh = bw * BH / BW;
  const total = fixed + bh;
  let y = Math.round(top + (bottom - top - total) * 0.45);
  const chip2 = rc(x0, y, cw, chipH); y += chipH + (trayH ? 6 : 0);
  const tray2 = trayH ? rc(x0, y, cw, trayH) : null; y += trayH + gap;
  const boardY = y; y += bh + gap;
  const tray1 = trayH ? rc(x0, y, cw, trayH) : null; y += trayH + (trayH ? 6 : 0);
  const chip1 = rc(x0, y, cw, chipH); y += chipH + gap;
  const tg = 16, tw = (cw - tg * 2) / 3;
  const ag = 16, side = (cw - ag * 2) * 0.25, mid = cw - ag * 2 - side * 2;
  return {
    mode: L.mode, chips: [chip2, chip1], trays: [tray2, tray1],
    board: { x: Math.round(cxs - bw / 2), y: boardY, w: bw },
    status: rc(x0, y, cw, statusH),
    tool: [0, 1, 2].map((i) => rc(x0 + i * (tw + tg), toolY, tw, toolH)),
    auto: { slower: rc(x0, toolY, side, toolH), pause: rc(x0 + side + ag, toolY, mid, toolH), faster: rc(x0 + side + ag + mid + ag, toolY, side, toolH), labelY: toolY - 22 },
  };
}

function playWide(scale) {
  const F = frame(), w = L.w, h = L.h, k = kOf(scale);
  const top = HDR.top + 8, bottom = h - F.b - 14, Hs = bottom - top;
  const availW = w - F.l - F.r - 48, cxs = F.l + (w - F.l - F.r) / 2;
  // the board: as large as the height allows (with capture trays when they fit), leaving at least 320 for the column
  const trayWant = scale <= 1.5 ? 84 : 0, tg = 10;
  const bwFor = (trayH) => Math.floor(((Hs - (trayH ? trayH * 2 + tg * 2 : 0) - 8) / BH) * BW);
  let trayH = trayWant, bw = bwFor(trayH);
  if (trayH && bw < 560) { trayH = 0; bw = bwFor(0); }
  bw = Math.max(300, Math.min(bw, 960, availW - 24 - 320));
  const colW = Math.min(560, availW - 24 - bw);
  const gx = Math.max(F.l + 24, cxs - (bw + 24 + colW) / 2);
  const bh = bw * BH / BW;
  // left column: tray, board, tray
  const leftH = bh + (trayH ? trayH * 2 + tg * 2 : 0);
  let ly = Math.round(top + (Hs - leftH) / 2);
  const tray2 = trayH ? rc(gx, ly, bw, trayH) : null; if (trayH) ly += trayH + tg;
  const board = { x: Math.round(gx), y: ly, w: bw }; ly += bh + (trayH ? tg : 0);
  const tray1 = trayH ? rc(gx, ly, bw, trayH) : null;
  // right column: both players, the message, the buttons; squeezed to fit the height
  const nat = { chip: Math.round(92 + 60 * k), status: Math.round(230 + 100 * k), tool: Math.round(128 + 60 * k) };
  const gap = 12;
  const natural = nat.chip * 2 + nat.status + nat.tool + gap * 3;
  const f = Math.min(1, (Hs - 4) / natural);
  const chipH = Math.round(nat.chip * f), statusH = Math.round(nat.status * f), toolH = Math.round(nat.tool * f);
  const colH = chipH * 2 + statusH + toolH + gap * 3;
  const cx0 = gx + bw + 24;
  let y = Math.round(top + (Hs - colH) / 2);
  const chip2 = rc(cx0, y, colW, chipH); y += chipH + gap;
  const chip1 = rc(cx0, y, colW, chipH); y += chipH + gap;
  const status = rc(cx0, y, colW, statusH); y += statusH + gap;
  const tyy = y, tgap = 12, tw = (colW - tgap * 2) / 3, half = (colW - tgap) / 2;
  // Watch & Learn: Pause full width, then slower | faster (the tool row is not used there)
  const ph = Math.round(toolH * 0.55), sh = toolH - ph - 8;
  return {
    mode: 'wide', chips: [chip2, chip1], trays: [tray2, tray1], board, status,
    tool: [0, 1, 2].map((i) => rc(cx0 + i * (tw + tgap), tyy, tw, toolH)),
    auto: { pause: rc(cx0, tyy, colW, ph), slower: rc(cx0, tyy + ph + 8, half, sh), faster: rc(cx0 + half + tgap, tyy + ph + 8, half, sh), labelY: tyy - 10 },
  };
}

export const autoLayout = (scale) => playLayout(scale).auto;

// Where the k-th captured stone lies in a capture tray (screen units): a loose heap, stable as stones are added.
// The first part at the left is for captured mandarins.
export function trayStone(r, k) {
  const fr = (v) => v - Math.floor(v);
  const lead = Math.min(150, r.w * 0.22);
  const x0 = r.x + lead, w = r.w - lead - 26;
  const row = k % 2;
  return [x0 + fr(k * 0.6180339 + 0.13) * w, r.y + r.h * (row ? 0.64 : 0.36) + (fr(k * 0.7548776) - 0.5) * 14];
}
export const trayQuan = (r, k) => [r.x + 44 + k * 52, r.y + r.h / 2];

// The two direction buttons shown in place of the status text while a square is selected (stacked when the box is narrow).
export function dirLayout(status, scale) {
  const k = kOf(scale);
  if (status.w < 480) {
    const bh = Math.round(clamp((status.h - 70 - 24) / 2, 50, 96 + 20 * k)), gap = 8;
    const textH = Math.max(50, status.h - bh * 2 - gap - 14);
    const y2 = status.y + status.h - bh - 8, y1 = y2 - bh - gap;
    return { textH, left: rc(status.x + 8, y1, status.w - 16, bh), right: rc(status.x + 8, y2, status.w - 16, bh), stacked: true };
  }
  const bh = Math.round(104 + 40 * k), gap = 12;
  const textH = Math.max(70, status.h - bh - gap - 14);
  const y = status.y + status.h - bh - 8;
  return { textH, left: rc(status.x + 8, y, status.w / 2 - 14, bh), right: rc(status.x + status.w / 2 + 6, y, status.w / 2 - 14, bh) };
}

// ---- title / language screens ----
// menuH: the natural height of the menu (or language card) blocks; the title block, the attract board and the lockup credit share
// what is left. Returns { title, board|null, credit|null, menu } in screen units.
export const titleMenuW = () => {
  const F = frame();
  if (L.wide) return clamp(Math.round((L.w - F.l - F.r) * 0.36), 380, 540);
  return Math.min(672, L.w - F.l - F.r - 48);
};

// The host back button box (virtual units) plus a small margin: nothing on a title / language screen may sit under it.
export const backClear = () => {
  const F = frame(), u = 1 / Math.max(host.px, 1e-6);
  return F.back ? { r: F.l + 8 * u + F.back + 12, b: F.t + 8 * u + F.back + 8 } : { r: 0, b: 0 };
};
// The tap zone of the Arcforge lockup: at least 44 x 44 css px, grown sideways and downwards only so it never reaches a button above.
export const creditHit = (c) => {
  if (!c) return null;
  const min = 44 / Math.max(host.px, 1e-6), lh = c.w * (327 / 1200);
  const w = Math.max(c.w, min), h = Math.max(lh, min);
  return rc(c.cx - w / 2, c.y, w, h);
};

export function titleLayout(menuH, o = {}) {
  const F = frame(), w = L.w, h = L.h, cxs = F.l + (w - F.l - F.r) / 2, BK = backClear();
  const lockH = (lw) => lw * (327 / 1200);
  const minLw = 120 / Math.max(host.px, 1e-6);          // never below ~120 css px wide
  const GC = 14;
  if (L.wide) {
    const menuW = titleMenuW(), gap = 40, avail = w - F.l - F.r - 48;
    const leftW = Math.min(avail - menuW - gap, 720);
    const group = leftW + gap + menuW, gx = Math.max(F.l + 24, cxs - group / 2);
    const lcx = gx + leftW / 2, top = F.t + 22;
    const s1 = 92, y1 = top + 78, y2 = y1 + 46, y3 = y2 + 32;
    const tagBottom = y3 + 44;
    const bottom = h - F.b - 18;
    const lw = Math.min(menuW, Math.max(0.28 * 720, minLw)), lh = lockH(lw);
    const room = bottom - tagBottom - 14;
    const bw = Math.min(leftW, 700, Math.floor(room / (BH / BW)));
    const board = !o.noBoard && bw >= 300 ? { x: Math.round(lcx - bw / 2), y: Math.round(tagBottom + 14 + Math.max(0, room - bw * BH / BW) / 2), w: bw } : null;
    const colTop = F.t + 18, colH = h - F.t - F.b - 36;
    const mh = o.noLockup ? Math.min(menuH, colH) : Math.min(menuH, colH - lh - GC);
    const my = colTop + (colH - mh - (o.noLockup ? 0 : GC + lh)) / 2, mx = gx + leftW + gap;
    const credit = o.noLockup ? null : { cx: mx + menuW / 2, y: my + mh + GC, w: lw };
    const wt = Math.min(leftW, Math.max(200, 2 * (lcx - BK.r)));
    return { title: { cx: lcx, y1, s1, y2, s2: 32, y3, w3: leftW, wt, s3: 26 }, board, credit, menu: rc(mx, my, menuW, mh) };
  }
  const tall = L.mode === 'tall';
  const dy = tall ? Math.max(0, (h - 1560) / 2) : 0;
  const s1 = tall ? 118 : 96, y1 = tall ? 200 + dy : F.t + 16 + 88, y2 = y1 + (tall ? 62 : 50), y3 = y2 + (tall ? 38 : 34);
  const tagBottom = y3 + 44;
  const lw = Math.min(w - F.l - F.r - 48, Math.max((tall ? 0.36 : 0.34) * Math.min(w, 720), minLw)), lh = lockH(lw);
  const bottom = h - F.b - 24, mw = titleMenuW();
  // the title is centred between the back button and the right edge when the back button sits beside it
  const hit = BK.r > 0 && y1 - 100 < BK.b, rightX = w - F.r - 24, tcx = hit ? Math.max(cxs, (BK.r + rightX) / 2) : cxs;
  const wt = hit ? Math.min(660, 2 * (rightX - tcx)) : Math.min(660, w - 60);
  const need = o.noLockup ? 0 : lh + GC;
  const rem = bottom - tagBottom - 12 - menuH - 12 - need;
  let board = null, my = tagBottom + 14;
  const bw = Math.min(tall ? 640 : 560, w - F.l - F.r - 60, Math.floor(rem / (BH / BW)));
  if (!o.noBoard && bw >= 280) {
    const extra = Math.max(0, rem - bw * BH / BW), g = Math.min(50, extra / 3);
    board = { x: Math.round(cxs - bw / 2), y: Math.round(tagBottom + 12 + g), w: bw };
    my = board.y + bw * BH / BW + 8 + g;
  } else if (rem > 0) my += Math.min(60, rem / 2);
  const mh = Math.max(120, Math.min(menuH, bottom - my - need));
  const credit = o.noLockup ? null : { cx: cxs, y: Math.min(my + mh + GC, bottom - lh), w: lw };
  return { title: { cx: cxs, tcx, y1, s1, y2, s2: tall ? 38 : 34, y3, w3: Math.min(660, w - 60), wt, s3: 26 }, board, credit, menu: rc(cxs - mw / 2, my, mw, mh) };
}

