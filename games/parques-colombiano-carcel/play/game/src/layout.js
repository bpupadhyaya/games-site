// Geometry as a function of the LIVE screen size (kit 1.7 fluid viewport: the SHORT side is always 720 units, the long side grows).
// `useLayout(w, h, kind)` computes (cached by size + insets + kind) and publishes every position into the exported live objects
// below (BOARD, TRAY, DICE_SPOTS, PANEL, BODY, REGION, G), so game.js (hit-testing), ui.js (buttons) and view.js (drawing) never
// disagree. `kind` is 'play' (board + dice tray + bar) or 'title' (board backdrop + menu plate).
//   tall     portrait phone (h >= 1500): the approved phone look (board 680, tray, bar at the bottom).
//   compact  portrait shorter than a phone (iPad, small phones, 7in / 10in tablets): same stack, scaled to the space.
//   wide     landscape (w/h >= 1.0): a column on the LEFT (title, message, dice tray, buttons), the board on the RIGHT.
//            The host's floating back button sits top-left (only when host.back > 0), so the left column starts clear of it.
// Grid offsets (x right, y down) are measured in squares from the centre square.
import { A, R, T, END } from './rules.js';

export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };   // safe areas + back button in virtual units (main.js keeps it current)

export let W = 720, H = 1560, CS = 34, UNIT = 1;
export const BOARD = { cx: 360, cy: 640, S: 680 };
export const TRAY = { x: 46, y: 1040, w: 628, h: 300 };
export const DICE_SPOTS = [{ x: 235, y: 1170 }, { x: 485, y: 1170 }];
export const PANEL = { x: 36, y: 100, w: 648, h: 1360 };
export const BODY = { x: 76, y: 268, w: 568, h: 880 };
export const REGION = { title: { x: 60, y: 1020, w: 600, h: 440 }, panel: { x: 64, y: 250, w: 592, h: 1070 }, over: { x: 90, y: 560, w: 540, h: 520 }, menu: { x: 100, y: 500, w: 520, h: 480 } };
export const G = {};   // everything else: mode flags, header, bars, reader controls, title furniture

export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const Rc = (x, y, w, h) => ({ x, y, w, h });

// rotate an offset a quarter-turns anticlockwise (as seen on screen): bottom arm -> right arm -> top -> left
export function rot(x, y, a) { for (let k = 0; k < a; k++) { const t = x; x = y; y = -t; } return [x, y]; }
export const gridXY = (x, y) => ({ x: BOARD.cx + x * CS, y: BOARD.cy + y * CS });

// offset (in squares) of outer square t
export function trackOffset(t) {
  const a = Math.floor(t / A), j = t % A;
  let u, v;
  if (j < R) { u = -1; v = j + 1; } else if (j === R) { u = 0; v = R; } else { u = 1; v = 2 * R + 1 - j; }
  return rot(u, v + 1, a);
}
export const homeOffset = (arm, row) => rot(0, row + 1, arm);
// the cárcel sits in the corner next to the arm's salida (bottom-right for the bottom arm, turning anticlockwise)
export const jailOffset = (arm) => { const d = R / 2 + 1.75; return rot(d, d, arm); };
export const jailSlot = (arm, k) => { const [x, y] = jailOffset(arm), s = 1.2, o = [[-s, -s], [s, -s], [-s, s], [s, s]][k % 4]; return [x + o[0], y + o[1]]; };
export const coronaSlot = (arm, k) => { const [x, y] = rot(-0.34 + (k % 2) * 0.68, 0.7 + Math.floor(k / 2) * 0.0, arm); return [x, y]; };

// where a piece (player pl, piece i) stands at position p (screen point of its foot)
export function posXY(g, pl, i, p) {
  const arm = g.players[pl].arm;
  let o;
  if (p < 0) o = jailSlot(arm, i);
  else if (p < T) o = trackOffset((A * arm + R + 1 + p) % T);
  else if (p < END) o = homeOffset(arm, R - 1 - (p - T));
  else o = coronaSlot(arm, i);
  return gridXY(o[0], o[1]);
}

// the squares a hopping piece crosses, in screen points
export function hopPath(g, pl, i, from, to) {
  if (from < 0) return [posXY(g, pl, i, from), posXY(g, pl, i, 0)];
  const pts = [posXY(g, pl, i, from)];
  for (let p = from + 1; p <= to; p++) pts.push(posXY(g, pl, i, p));
  return pts;
}

// ---- layout computation ------------------------------------------------------------------------------------------------
const cache = new Map();
let lastKey = '';
export function useLayout(w, h, kind = 'play') {
  w = Math.round(w) || 720; h = Math.round(h) || 1560;
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}|${kind}`;
  if (key === lastKey) return G;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }, kind); L.key = key; cache.set(key, L); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  lastKey = key; W = w; H = h; CS = L.board.S / (R * 2 + 4); UNIT = CS / 34;
  Object.assign(BOARD, L.board); Object.assign(TRAY, L.tray); DICE_SPOTS[0] = L.dice[0]; DICE_SPOTS[1] = L.dice[1];
  Object.assign(PANEL, L.panel); Object.assign(BODY, L.body);
  for (const k of Object.keys(REGION)) Object.assign(REGION[k], L.region[k]);
  for (const k of Object.keys(G)) delete G[k];
  Object.assign(G, L);
  return G;
}

function build(w, h, ins, kind) {
  const wide = w / h >= 1.0, tall = !wide && h >= 1500;
  const L = { w, h, wide, tall, kind, ins, mode: wide ? 'wide' : tall ? 'tall' : 'compact' };
  const U = L.U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b }; U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const bs = ins.back ? Math.max(ins.back, 56) : 0;
  const back = L.backBox = bs ? Rc(ins.l, ins.t, bs + 8, bs + 8) : Rc(0, 0, 0, 0);
  const backR = bs ? back.x + back.w : 0, backB = bs ? back.y + back.h : 0;
  L.btns = {};
  const BH = 82;                                              // tap height of the bar buttons
  let titleRegion = null;

  // ---- play / title: the board and its neighbours ------------------------------------------------------------------------
  if (!wide) {
    const titleSize = tall ? 62 : 46, titleBase = ins.t + (tall ? 88 : 54);
    const plY = Math.max(titleBase + (tall ? 26 : 16), backB + 4), plH = tall ? 136 : 100, plX = tall ? 36 : 24;
    L.head = { title: { x: w / 2, y: titleBase, size: titleSize, maxW: w - 2 * Math.max(60, backR + 12) }, plaque: Rc(plX, plY, w - 2 * plX, plH), msgSize: 30 };
    const hudTop = plY + plH, margin = Math.max(tall ? 60 : 30, ins.b + 14), barY = h - margin - BH;
    const ox = (w - 720) / 2;
    L.btns.play = { menu: Rc(38 + ox, barY, 200, BH), hint: Rc(260 + ox, barY, 200, BH), sound: Rc(482 + ox, barY, 200, BH) };
    L.btns.auto = { menu: Rc(24 + ox, barY, 156, BH), pause: Rc(196 + ox, barY, 156, BH), dec: Rc(368 + ox, barY, 156, BH), inc: Rc(540 + ox, barY, 156, BH) };
    L.barY = barY;
    const trayH = tall ? 300 : 210, avail = barY - hudTop;
    const S = clamp(Math.min(680, w - 56, avail - trayH - 24 - 28 - 28), 240, 680), free = avail - (S + 28 + trayH + 24);
    const gap = clamp(free / 3, 10, 56), y0 = hudTop + Math.max(0, (avail - (S + 28 + gap + trayH + 24)) / 2);
    L.board = { cx: w / 2, cy: y0 + 14 + S / 2, S };
    L.tray = Rc(w / 2 - Math.min(314, (w - 92) / 2), y0 + S + 28 + gap + 12, Math.min(628, w - 92), trayH);
    if (kind === 'title') {
      const short = !tall && h < 1100, tsz = tall ? 150 : short ? 92 : 118, maxT = 2 * (w / 2 - (bs ? backR + 10 : 18)), size = Math.min(tsz, maxT / (7 * 0.56));
      const tb = ins.t + 8 + size * 0.8 + (tall ? 20 : 4);
      const sub = tb + (tall ? 64 : short ? 40 : 50), subSize = tall ? 52 : short ? 38 : 44, bandY = sub + (tall ? 24 : short ? 16 : 20), topEnd = bandY + (short ? 14 : 24);
      const lkH = Math.round(Math.max(0.35 * 720, 120 / Math.max(host.px, 1e-6)) * 327 / 1200), margin2 = Math.max(tall ? 84 : 78, ins.b + 40) - 40 + lkH + 24;
      let plateH = tall ? 470 : 420, plY2 = h - margin2 - plateH;
      const wantS = Math.min(w - 56, 480), haveS = plY2 + 36 - topEnd - 28;
      if (haveS < wantS) { plateH = Math.max(360, plateH - (wantS - haveS)); plY2 = h - margin2 - plateH; }   // short portrait (tablets): a shorter menu plate so the board is not buried under it
      const S2 = clamp(Math.min(680, w - 56, plY2 + 36 - topEnd - 28), 200, 680);
      L.board = { cx: w / 2, cy: topEnd + 14 + S2 / 2, S: S2 };
      L.tray = Rc(46, h, 10, 10);
      L.tt = { title: { x: w / 2, y: tb, size }, sub: { x: w / 2, y: sub, size: subSize }, band: { x: w / 2, y: bandY }, plate: Rc(36, plY2, w - 72, plateH), fadeY: plY2 - 44, stats: { x: w / 2, y: plY2 + plateH + 28 }, lockup: { cx: w / 2, cy: plY2 + plateH + 28 + 18 + lkH / 2, h: lkH } };
      titleRegion = Rc(60, plY2 + 16, w - 120, plateH - 32);
    }
  } else {
    const gap = 26, pad = 10;
    const S = clamp(Math.min(U.h - 28 - 2 * pad, U.w - 28 - gap - 420 - 30), 300, 680);   // 420: the menu plate keeps room for 'Auto Play · Watch & Learn' on one line
    const pw = clamp(U.w - 30 - S - 28 - gap, 340, 560), free = Math.max(0, U.w - pw - gap - S - 28);
    const x0 = U.x0 + free / 2, cx = x0 + pw + gap + 14 + S / 2, cy = U.y0 + U.h / 2;
    const col = L.col = Rc(x0, U.y0 + pad, pw, U.h - 2 * pad);
    L.board = { cx, cy, S };
    const y0 = col.y, tbX = Math.max(x0, backR + 8);
    L.head = { title: { x: (tbX + x0 + pw) / 2, y: y0 + 40, size: 40, maxW: x0 + pw - tbX }, plaque: null, msgSize: 28 };
    const plY = x0 < backR ? Math.max(y0 + 56, backB + 4) : y0 + 56, plH = 96;
    L.head.plaque = Rc(x0, plY, pw, plH);
    const bh = 72, bg = 12, bottom = col.y + col.h, by0 = bottom - (2 * bh + bg), cw = (pw - bg) / 2;
    L.btns.play = { menu: Rc(x0, by0, cw, bh), sound: Rc(x0 + cw + bg, by0, cw, bh), hint: Rc(x0, by0 + bh + bg, pw, bh) };
    L.btns.auto = { menu: Rc(x0, by0, cw, bh), pause: Rc(x0 + cw + bg, by0, cw, bh), dec: Rc(x0, by0 + bh + bg, cw, bh), inc: Rc(x0 + cw + bg, by0 + bh + bg, cw, bh) };
    const top = plY + plH + 24, spare = by0 - 12 - 12 - top, trayH = clamp(spare, 170, 300);
    L.tray = Rc(x0 + 12, top + Math.max(0, (spare - trayH) / 2) + 12, pw - 24, trayH);
    L.barY = by0;
    if (kind === 'title') {
      const cx2 = x0 + pw / 2, maxT = 2 * (cx2 - Math.max(x0, backR + 10)), size = Math.min(96, Math.max(44, maxT / (7 * 0.68)));
      const tb = y0 + 20 + size * 0.78, sub = tb + 38, bandY = sub + 14, plY2 = bandY + 12, lockH = Math.round(Math.max(0.28 * 720, 120 / Math.max(host.px, 1e-6)) * 327 / 1200);
      const plH2 = bottom - lockH - 56 - plY2;
      L.tray = Rc(x0, h, 10, 10);
      L.tt = { title: { x: cx2, y: tb, size }, sub: { x: cx2, y: sub, size: (bs && sub - 30 < backB) ? Math.max(20, Math.min(36, Math.floor(2 * (cx2 - backR - 10) / (15 * 0.56)))) : 36 }, band: { x: cx2, y: bandY }, plate: Rc(x0, plY2, pw, plH2), fadeY: 0, stats: { x: cx2, y: plY2 + plH2 + 22 }, lockup: { cx: cx2, cy: plY2 + plH2 + 22 + 18 + lockH / 2, h: lockH } };
      titleRegion = Rc(x0 + 14, plY2 + 14, pw - 28, plH2 - 28);
    }
  }

  // dice, roll prompt, arrow: positions inside the tray
  const t = L.tray;
  L.dice = [{ x: t.x + t.w * 0.3, y: t.y + (t.h - 34) / 2 }, { x: t.x + t.w * 0.7, y: t.y + (t.h - 34) / 2 }];
  const pw2 = Math.min(500, t.w - 24);
  L.prompt = { x: t.x + t.w / 2 - pw2 / 2, y: t.y + t.h - 78, w: pw2, h: 60, cx: t.x + t.w / 2, text: t.y + t.h - 40 };
  L.resultW = Math.min(340, t.w - 24);
  L.arrow = { x: t.x + t.w / 2, y: t.y + (t.h < 260 ? 24 : 58) };

  // ---- panels (setup, settings, how / about / rules, demo-limit) and the readers ---------------------------------------------
  const pw3 = wide ? Math.min(880, U.w - 32) : Math.min(648, w - 48);
  const pTop = wide ? U.y0 + 10 : ins.t + (tall ? 70 : 20);
  const pH = wide ? U.h - 20 : h - pTop - Math.max(tall ? 60 : 24, ins.b + 14);
  const P = Rc((w - pw3) / 2, pTop, pw3, pH);
  const titleDy = wide ? 62 : tall ? 96 : 78, regDy = wide ? 84 : tall ? 150 : 108;
  L.panel = P; L.panelTitle = { x: w / 2, y: P.y + titleDy, size: wide ? 50 : tall ? 66 : 56 };
  const rw = wide ? Math.min(P.w - 72, 600) : P.w - 56, rx = P.x + (P.w - rw) / 2;
  L.footRow = wide;
  // cards over the play screen: pause menu and result
  const mcw = Math.min(560, w - 32), mch = Math.min(640, h - 24), mcx = (w - mcw) / 2, mcy = (h - mch) / 2;
  const ocw = Math.min(600, w - 32), och = Math.min(840, h - 92), ocx = (w - ocw) / 2, ocy = (h - och) / 2 - 22, otop = clamp(och - 610, 36, 230);
  L.cards = { menu: { x: mcx, y: mcy, w: mcw, h: mch, title: 'Paused' }, over: { x: ocx, y: ocy, w: ocw, h: och } };
  L.menuTitleY = mcy + 78;
  L.region = {
    title: titleRegion || Rc(rx, P.y, rw, 100),
    panel: Rc(rx, P.y + regDy, rw, P.h - regDy - 24),
    menu: Rc(mcx + 20, mcy + 100, mcw - 40, mch - 100 - 20),
    over: Rc(ocx + 30, ocy + otop, ocw - 60, och - otop - 24),
  };

  // reader (how / about / rules)
  const rd = L.reader = {};
  if (!wide) {
    const bk = Rc(P.x + 28, 0, (P.w - 56 - 32) / 2, tall ? 78 : 66), nx = Rc(P.x + P.w - 28 - bk.w, 0, bk.w, bk.h);
    bk.y = nx.y = P.y + P.h - 36 - bk.h;
    const zy = bk.y - 10 - 52, zH = 52, zW = 110;
    rd.dec = Rc(P.x + 28, zy, zW, zH); rd.inc = Rc(P.x + P.w - 28 - zW, zy, zW, zH); rd.back = bk; rd.next = nx;
    rd.zoomLbl = { x: w / 2, y: zy + 35, size: 28 }; rd.pageLbl = { x: w / 2, y: zy - 26, size: 22 };
    rd.title = { x: w / 2, y: P.y + titleDy, size: L.panelTitle.size };
    const by = P.y + (tall ? 168 : 124);
    L.body = Rc(P.x + 40, by, P.w - 80, Math.max(160, zy - 88 - by));
  } else {
    const bh = 64, by = P.y + P.h - 20 - bh, aw = 78, bw = 150;
    rd.back = Rc(P.x + 36, by, bw, bh); rd.next = Rc(P.x + P.w - 36 - bw, by, bw, bh);
    rd.dec = Rc(rd.back.x + bw + 12, by + 6, aw, bh - 12); rd.inc = Rc(rd.next.x - 12 - aw, by + 6, aw, bh - 12);
    const mid = (rd.dec.x + rd.dec.w + rd.inc.x) / 2;
    rd.zoomLbl = { x: mid, y: by + 28, size: 24 }; rd.pageLbl = { x: mid, y: by + 54, size: 21 };
    rd.title = { x: w / 2, y: P.y + titleDy, size: L.panelTitle.size };
    const bY = P.y + 96;
    L.body = Rc(P.x + 40, bY, P.w - 80, Math.max(160, by - 14 - bY));
  }
  return L;
}

// Tap zone of the Arcforge lockup (title screen): at least 44 x 44 css px, grown sideways/downwards only.
export const creditHit = (k) => { const m = 44 / Math.max(host.px, 1e-6), lw = k.h * 1200 / 327, w = Math.max(lw, m), h = Math.max(k.h, m); return { x: Math.round(k.cx - w / 2), y: Math.round(k.cy - k.h / 2), w: Math.round(w), h: Math.round(h) }; };
