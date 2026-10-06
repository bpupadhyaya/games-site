// Geometry as a pure function of the LIVE screen size (kit 1.7 fluid viewport: the short side is always 720 units, the long
// side grows with the aspect ratio). `layoutFor(w, h, auto)` returns every rectangle for that size and is cached.
//
// The board is designed once, in CANONICAL coordinates (a tall board, 720 wide: two columns of twelve points with the bar down
// the middle; your home board bottom left, your checkers start bottom right and travel up the right side, across the top and
// down the left; the two bear-off trays are the strips above and below). A layout places it on the screen with a uniform scale
// `s` and either as-is ('v', tall) or turned a quarter turn ('h', wide: bear-off tray on the right and your home board bottom
// right, like a real board on the table). Nothing else in the game knows the difference: stackPos / barPos / offPos / targetAt
// convert between canonical and screen coordinates.
//
// Shapes ("mode"):
//   stack  header on top, board in the middle, dice + buttons below (portrait phones: the approved look, unchanged on a tall phone)
//   side   landscape / squarish: a panel on the left (title, pips, message, dice, buttons) and the board filling the rest
import { BAR, OFF } from './rules.js';

export const D = 72, R = D / 2;                                      // canonical checker size (sprites are painted at this size)
export const THINK_STEPS = [2, 5, 8, 10];
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
// px = css pixels per virtual unit, so text can be kept at or above ~11 css px.
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };
export const minText = () => 11.5 / Math.max(0.2, host.px);

// ---- canonical board ---------------------------------------------------------------------------------------------
export const FRAME = { x: 8, y: 262, w: 704, h: 1038 };          // outer edge of the wooden frame
export const IN = { x0: 34, x1: 686, y0: 288, y1: 1274 };         // the playing field
export const CH = { x0: 318, x1: 402, cx: 360 };                    // the bar (channel)
export const SLOT = (IN.y1 - IN.y0) / 12;                           // height of one point
export const PLEN = 254;                                            // length of a point
export const MID = (IN.y0 + IN.y1) / 2;
export const TRAYC = { opp: { x: 34, y: 214, w: 652, h: 44 }, me: { x: 34, y: 1306, w: 652, h: 44 } };
export const CB = { x: 8, y: 208, w: 704, h: 1148 };               // frame + both trays: what a layout places
export const LR = { x: 0, y: 196, w: 744, h: 1180 };               // the cached board layer (frame shadow included)

// canonical position of point idx (0..23): which column, its vertical centre, where its checkers start and which way they stack
export function pointGeom(idx) {
  const pt = idx + 1, left = pt <= 12, slot = left ? 12 - pt : pt - 13;
  return { left, slot, y: IN.y0 + (slot + 0.5) * SLOT, edge: left ? IN.x0 : IN.x1, dir: left ? 1 : -1 };
}
// canonical centre of the k-th checker (0 = base) of n on point idx / on the bar / in the tray
export function cStack(idx, k, n) {
  const g = pointGeom(idx), room = PLEN - 6, step = n <= 3 ? D + 1 : (room - D) / (n - 1);
  return { x: g.edge + g.dir * (R + 3 + k * step), y: g.y };
}
export function cBar(side, k, n) {
  const step = n <= 5 ? D + 2 : (MID - IN.y0 - 60 - D) / (n - 1), y0 = 6 + R;
  return { x: CH.cx, y: MID + (side === 0 ? 1 : -1) * (y0 + k * step) };
}
export const cOff = (side, k) => ({ x: 64 + k * 40, y: side === 0 ? TRAYC.me.y + TRAYC.me.h / 2 : TRAYC.opp.y + TRAYC.opp.h / 2 });
export function cLanding(idx, n, side) {
  if (idx === OFF) return cOff(side, n);
  if (idx === BAR) return cBar(side, n, n + 1);
  return cStack(idx, n, n + 1);
}

// ---- the current layout --------------------------------------------------------------------------------------------
// `L` is replaced whenever the size changes (live binding: importers always see the current one).
export let L = null;
export let S = 1;                                                    // board scale
export let W = 720, H = 1560;
const cache = new Map();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const Rc = (x, y, w, h) => ({ x, y, w, h });

export function layoutFor(w, h, auto = false) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}|${auto ? 1 : 0}`;
  let l = cache.get(key);
  if (!l) { l = build(w, h, { ...host }, !!auto); l.key = key; cache.set(key, l); if (cache.size > 32) cache.delete(cache.keys().next().value); }
  return l;
}
// Called by the game every frame with the live size; cheap when nothing changed.
export function setSize(w, h, auto = false) {
  const l = layoutFor(w, h, auto);
  if (l !== L) { L = l; S = l.s; W = l.w; H = l.h; }
  return L;
}

// canonical <-> screen for one placement
function mapper(orient, s, ox, oy) {
  if (orient === 'v') {
    return {
      pt: (x, y) => ({ x: ox + (x - CB.x) * s, y: oy + (y - CB.y) * s }),
      inv: (sx, sy) => ({ x: (sx - ox) / s + CB.x, y: (sy - oy) / s + CB.y }),
      m: [s, 0, 0, s, ox - CB.x * s, oy - CB.y * s],                // canvas matrix (a b c d e f) that draws canonical art
    };
  }
  const X1 = CB.x + CB.w;
  return {
    pt: (x, y) => ({ x: ox + (y - CB.y) * s, y: oy + (X1 - x) * s }),
    inv: (sx, sy) => ({ x: X1 - (sy - oy) / s, y: (sx - ox) / s + CB.y }),
    m: [0, -s, s, 0, ox - CB.y * s, oy + X1 * s],
  };
}
const mapRect = (map, r) => { const a = map.pt(r.x, r.y), b = map.pt(r.x + r.w, r.y + r.h); return Rc(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y)); };

// ---- screen-space helpers used by view.js and game.js ---------------------------------------------------------------
export const toScreen = (x, y) => L.map.pt(x, y);
export const toCanon = (x, y) => L.map.inv(x, y);
export const stackPos = (idx, k, n) => { const p = cStack(idx, k, n); return L.map.pt(p.x, p.y); };
export const barPos = (side, k, n) => { const p = cBar(side, k, n); return L.map.pt(p.x, p.y); };
export const offPos = (side, k) => { const p = cOff(side, k); return L.map.pt(p.x, p.y); };
export const landing = (idx, n, side) => { const p = cLanding(idx, n, side); return L.map.pt(p.x, p.y); };
export const barCenter = () => L.map.pt(CH.cx, MID);
export const trayRect = (side) => mapRect(L.map, side === 0 ? TRAYC.me : TRAYC.opp);
// the four corners of point idx's triangle, in screen space
export function pointPoly(idx) {
  const g = pointGeom(idx), y0 = g.y - SLOT / 2 + 3, y1 = g.y + SLOT / 2 - 3, tx = g.edge + g.dir * PLEN, m = L.map;
  return [m.pt(g.edge, y0), m.pt(tx, g.y - 1.5), m.pt(tx, g.y + 1.5), m.pt(g.edge, y1)];
}
// where the small engraved number of point idx goes (screen space)
export function pointNumPos(idx) { const g = pointGeom(idx); return L.map.pt(g.edge + g.dir * (PLEN + 15), g.y); }
// which target a screen tap means: a point 0..23, BAR, OFF, or -1
export function targetAt(sx, sy) {
  const c = L.map.inv(sx, sy), x = c.x, y = c.y;
  if (inRect({ x: TRAYC.me.x, y: TRAYC.me.y - 6, w: TRAYC.me.w, h: TRAYC.me.h + 14 }, x, y)) return OFF;
  if (y < IN.y0 - 8 || y > IN.y1 + 8) return -1;
  if (x > CH.x0 - 4 && x < CH.x1 + 4) return BAR;
  const slot = Math.floor((y - IN.y0) / SLOT); if (slot < 0 || slot > 11) return -1;
  if (x < CH.cx) return 12 - slot - 1;
  return 13 + slot - 1;
}
// a good place to tap for a target (tests and dev tools): screen position
export function targetPos(t) {
  if (t === BAR) return L.map.pt(CH.cx, MID + 50);
  if (t === OFF) return L.map.pt(360, TRAYC.me.y + 22);
  const g = pointGeom(t); return L.map.pt(g.edge + g.dir * 110, g.y);
}

// ---- building a layout --------------------------------------------------------------------------------------------------
function build(w, h, ins, auto) {
  const land = w >= h;
  const l = { w, h, ins, land, auto };
  const U = l.U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b }; U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const backSz = ins.back ? Math.max(ins.back, 56) : 0;
  l.backBox = backSz ? Rc(ins.l, ins.t, backSz + 16, backSz + 16) : Rc(0, 0, 0, 0);

  // candidates, in order of preference; a later one wins only if its board is clearly larger
  const cands = [];
  const stack = () => {
    const comp = clamp((1540 - h) / 540, 0, 1);
    const tSize = Math.round(72 - 16 * comp), base = Math.round(U.y0 + 96 - 30 * comp), bTop = base + Math.round(32 - 6 * comp), bh = 84;
    const bw = Math.min(672, U.w - 40), bx = U.x0 + (U.w - bw) / 2;
    const padB = Math.max(22, ins.b + 12), btnY = h - padB - 64, tw = Math.min(600, U.w - 60), tH = 96;
    const trayTop = btnY - 10 - 10 - tH;                         // the dice tray's own top edge (its rim is 10 above)
    const zoneTop = bTop + bh - 4, zoneBot = trayTop - 10 + 8, zh = zoneBot - zoneTop;
    for (const o of ['v', 'h']) {
      const bw0 = o === 'v' ? CB.w : CB.h, bh0 = o === 'v' ? CB.h : CB.w;
      cands.push({ kind: 'stack', o, s: Math.min(zh / bh0, (U.w - 8) / bw0, 1.02), tSize, base, banner: Rc(bx, bTop, bw, bh), zoneTop, zh, btnY, trayTop, tw, tH });
    }
  };
  const side = () => {
    const gap = 12, panelMin = 330, panelMax = 520;
    for (const o of ['h', 'v']) {
      const bw0 = o === 'v' ? CB.w : CB.h, bh0 = o === 'v' ? CB.h : CB.w;
      cands.push({ kind: 'side', o, s: Math.min((U.h - 16) / bh0, (U.w - panelMin - 3 * gap) / bw0, 1.02), gap, panelMax, panelMin });
    }
  };
  if (land) { side(); stack(); cands.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'side' ? -1 : 1)); } else stack();
  let pick = cands.find((c) => c.s > 0.3) || cands[0];
  for (const c of cands) if (c.s > pick.s * 1.03) pick = c;

  l.mode = pick.kind; l.orient = pick.o; l.s = pick.s;
  if (pick.kind === 'stack') layoutStack(l, pick); else layoutSide(l, pick);
  l.map = mapper(l.orient, l.s, l.board.x, l.board.y);
  l.coffee = !ins.back && !land && h >= 1400 && w >= 700;
  l.title = titleLayout(l);
  l.doc = docLayout(l);
  l.set = settingsLayout(l);
  l.over = overLayout(l);
  return l;
}

function diceBlock(tray, narrow) {
  const cy = tray.y + (narrow ? 48 : tray.h / 2);
  if (!narrow) {
    return { ...tray, cy, rest: [tray.x + tray.w * 0.317, tray.x + tray.w * 0.467], from: [tray.x + tray.w * 0.833, tray.x + tray.w * 0.873],
      rollTxt: { x: tray.x + tray.w * 0.683, y: cy - 4, y2: cy + 22, align: 'left' }, mult: { x: tray.x + tray.w * 0.6, y: cy + 8 }, think: { x: tray.x + tray.w - 20, y: cy + 8, align: 'right' },
      cube: { x: tray.x + 36, y: cy, s: 58 } };
  }
  return { ...tray, cy, rest: [tray.x + tray.w * 0.44, tray.x + tray.w * 0.44 + 78], from: [tray.x + tray.w - 40, tray.x + tray.w - 16],
    rollTxt: { x: tray.x + tray.w / 2, y: tray.y + tray.h - 34, y2: tray.y + tray.h - 12, align: 'center' }, mult: { x: tray.x + tray.w * 0.44 + 126, y: cy + 8 }, think: { x: tray.x + tray.w / 2, y: tray.y + tray.h - 18, align: 'center' },
    cube: { x: tray.x + 40, y: cy, s: 58 } };
}
const cubeHit = (c) => Rc(c.x - 40, c.y - 40, 80, 90);

function layoutStack(l, p) {
  const { U } = l, bw0 = p.o === 'v' ? CB.w : CB.h, bh0 = p.o === 'v' ? CB.h : CB.w;
  const bw = bw0 * p.s, bh = bh0 * p.s;
  l.board = { x: U.x0 + (U.w - bw) / 2, y: p.zoneTop + Math.max(0, (p.zh - bh) / 2), w: bw, h: bh };
  l.head = { title: { x: U.x0 + U.w / 2, y: p.base, size: p.tSize }, pips: { x: U.x1 - 20, y: p.base, stacked: true }, banner: p.banner, caption: { x: U.x0 + U.w / 2, y: p.banner.y - 6 } };
  const tray = Rc(U.x0 + (U.w - p.tw) / 2, p.trayTop, p.tw, p.tH);
  l.dice = diceBlock(tray, false); l.dice.hit = Rc(tray.x, tray.y - 6, tray.w, tray.h + 12); l.cube = { ...l.dice.cube, hit: cubeHit(l.dice.cube) };
  const rowW = Math.min(652, U.w - 68), rx = U.x0 + (U.w - rowW) / 2, bh2 = 64;
  if (l.auto) {
    const b4 = (rowW - 3 * 14) / 4;
    l.btn = { menu: Rc(rx, p.btnY, b4, bh2), pause: Rc(rx + b4 + 14, p.btnY, b4, bh2), thinkDec: Rc(rx + 2 * (b4 + 14), p.btnY, b4, bh2), thinkInc: Rc(rx + 3 * (b4 + 14), p.btnY, b4, bh2) };
  } else {
    const b3 = (rowW - 52) / 3;
    l.btn = { menu: Rc(rx, p.btnY, b3, bh2), undo: Rc(rx + b3 + 26, p.btnY, b3, bh2), hint: Rc(rx + 2 * (b3 + 26), p.btnY, b3, bh2) };
    l.done = Rc(l.btn.undo.x, p.btnY, l.btn.hint.x + l.btn.hint.w - l.btn.undo.x, bh2);
  }
  l.narrowDice = false;
}

function layoutSide(l, p) {
  const { U } = l, bw0 = p.o === 'v' ? CB.w : CB.h, bh0 = p.o === 'v' ? CB.h : CB.w, gap = p.gap;
  const bw = bw0 * p.s, bh = bh0 * p.s;
  const left = U.w - bw - 3 * gap;                                        // room for the panel (plus any slack)
  const panelW = clamp(left, p.panelMin, p.panelMax), slack = Math.max(0, left - panelW);
  const px = U.x0 + gap + slack * 0.25, pw = panelW;
  l.board = { x: px + pw + gap + slack * 0.5, y: U.y0 + (U.h - bh) / 2, w: bw, h: bh };
  l.panel = Rc(px, U.y0 + 6, pw, U.h - 12);
  // top to bottom: title, pips, caption, banner | dice | buttons
  let y = U.y0 + 8;
  const cx0 = px + pw / 2, bb = l.backBox, half = 96;
  let tx = cx0;
  if (bb.w && tx - half < bb.x + bb.w + 4) tx = Math.min(px + pw - half, bb.x + bb.w + 4 + half);
  // the pips line starts below the host back button when that button reaches into this panel
  const pipsDrop = bb.w && px < bb.x + bb.w ? Math.max(0, bb.y + bb.h + 24 - (y + 84)) : 0;
  l.head = { title: { x: tx, y: y + 54, size: 62 }, pips: { x: px, y: y + 84 + pipsDrop, w: pw, stacked: false }, banner: null, caption: null };
  y += 62 + 44 + pipsDrop;
  l.head.caption = { x: cx0, y: y + 14 }; y += 26;
  const padB = Math.max(10, ins2(l) + 6), bh2 = 58, bBot = U.y1 - padB, rowY = bBot - bh2;
  let tray, limit;
  if (l.auto) {
    const b2 = (pw - 10) / 2, rowY2 = rowY - bh2 - 10;
    l.btn = { menu: Rc(px, rowY, b2, bh2), pause: Rc(px + b2 + 10, rowY, b2, bh2), thinkDec: Rc(px, rowY2, b2, bh2), thinkInc: Rc(px + b2 + 10, rowY2, b2, bh2) };
    limit = rowY2;
  } else {
    const b3 = (pw - 16) / 3;
    l.btn = { menu: Rc(px, rowY, b3, bh2), undo: Rc(px + b3 + 8, rowY, b3, bh2), hint: Rc(px + 2 * (b3 + 8), rowY, b3, bh2) };
    l.done = Rc(l.btn.undo.x, rowY, l.btn.hint.x + l.btn.hint.w - l.btn.undo.x, bh2);
    limit = rowY;
  }
  const trayH = 118;
  tray = Rc(px + 10, limit - 12 - 10 - trayH, pw - 20, trayH);
  l.dice = diceBlock(tray, true); l.dice.hit = Rc(tray.x, tray.y - 6, tray.w, tray.h + 12); l.cube = { ...l.dice.cube, hit: cubeHit(l.dice.cube) };
  const bTop = y + 2, bBottom = tray.y - 24;
  l.head.banner = Rc(px, bTop, pw, clamp(bBottom - bTop, 70, 240));
  l.narrowDice = true;
}
const ins2 = (l) => l.ins.b;

// ---- title screen -----------------------------------------------------------------------------------------------------------
// A function of "has a saved game" (the list of buttons changes) producing every rect, plus the hero / text areas.
function titleLayout(l) {
  const { U } = l, wide = l.w >= l.h * 0.95 && U.w >= 640;
  const sec1 = ['level', 'cube', 'gammon', 'settings'], sec2 = ['howto', 'about', 'rules'];
  return (hasSave) => {
    const names = (hasSave ? ['resume'] : []).concat(['play', 'learn', 'two', 'daily', 'auto']);
    const out = { rects: {}, wide };
    if (wide) {
      const lw = clamp(U.w * 0.4, 330, 520), rx = U.x0 + 16 + lw + 24, rw = U.x1 - 16 - rx;
      const lkW = Math.min(rw - 20, Math.max(0.28 * 720, 120 / Math.max(host.px, 1e-6))), LKH = Math.round(lkW * 327 / 1200) + 36;
      const cols = rw >= 520 ? 2 : 1, colW = cols === 2 ? (rw - 12) / 2 : rw, pr = Math.ceil(names.length / cols), secH = cols === 2 ? 56 : 48, textH = 84, secRows = cols === 2 ? 1 : 2;
      const ph = clamp((U.h - 24 - (secRows + 1) * secH - 24 - textH - LKH - secRows * 10 - (pr - 1) * 12) / pr, 42, 88);
      const total = pr * (ph + 12) + 4 + (secRows + 1) * secH + (secRows) * 10 + 14 + LKH + textH;
      let y = U.y0 + Math.max(8, (U.h - total) / 2);
      names.forEach((n, i) => {
        const odd = cols === 2 && names.length % 2 === 1 && i === names.length - 1, r = Math.floor(i / cols), c = i % cols;
        out.rects[n] = odd ? Rc(rx, y + r * (ph + 12), rw, ph) : Rc(rx + c * (colW + 12), y + r * (ph + 12), colW, ph);
      });
      y += pr * (ph + 12) + 4;
      const w4 = cols === 2 ? (rw - 3 * 10) / 4 : (rw - 10) / 2, w3 = (rw - 2 * 10) / 3;
      sec1.forEach((n, i) => { out.rects[n] = cols === 2 ? Rc(rx + i * (w4 + 10), y, w4, secH) : Rc(rx + (i % 2) * (w4 + 10), y + Math.floor(i / 2) * (secH + 10), w4, secH); });
      sec2.forEach((n, i) => { out.rects[n] = Rc(rx + i * (w3 + 10), y + secRows * (secH + 10), w3, secH); });
      y += (secRows + 1) * secH + secRows * 10 + 8;
      out.lock = { cx: rx + rw / 2, y: y + 14, w: lkW }; y += LKH + 6;
      out.text = Rc(rx, y, rw, textH);
      const cx = U.x0 + 16 + lw / 2, top = U.y0 + Math.max(70, (U.h - 470) / 2);
      out.titleX = cx; out.titleSize = lw < 420 ? 118 : 140; out.titleY = top + out.titleSize * 0.78; out.tagY = out.titleY + 54;
      out.diceY = out.tagY + 84; out.diceX = cx - 60; out.lw = lw; out.cols = cols;
    } else {
      const avail = U.h, tall = avail >= 1490 + (hasSave ? 92 : 0), cols = tall ? 1 : 2, gx = 12;
      const pw = Math.min(U.w - 32, tall ? 500 : 640), px = U.x0 + (U.w - pw) / 2, pr = Math.ceil(names.length / cols);
      const phB = tall ? 80 : 72, pstep = phB + 12, secH = tall ? 62 : 56, textH = tall ? 150 : 110;
      const lkW = Math.min(pw - 20, Math.max(0.35 * 720, 120 / Math.max(host.px, 1e-6))), LKH = Math.round(lkW * 327 / 1200) + 36;
      const rest = pr * pstep + 6 + 2 * (secH + 10) + secH + 12 + LKH + textH;
      const headH = tall ? 470 : clamp(avail - rest - 12, 330, 470);
      const total = headH + rest, y0 = U.y0 + (tall ? 0 : Math.max(0, (avail - total) / 2));
      const hs = clamp(headH / 470, 0.55, 1);
      out.titleX = U.x0 + U.w / 2;
      if (tall) { out.titleSize = 150; out.titleY = y0 + 194; out.tagY = y0 + 262; out.diceY = y0 + 340; }
      else {
        const ts = Math.round(150 * Math.max(hs, 0.7));
        out.titleSize = ts; out.titleY = y0 + 28 + ts * 0.78; out.tagY = out.titleY + 52; out.diceY = out.tagY + 62;
      }
      out.diceX = out.titleX - 60;
      let y = y0 + headH;
      const colW = cols === 1 ? pw : (pw - gx) / 2;
      names.forEach((n, i) => {
        const odd = cols === 2 && names.length % 2 === 1 && i === names.length - 1, r = Math.floor(i / cols), c = i % cols;
        out.rects[n] = odd ? Rc(px, y + r * pstep, pw, phB) : Rc(px + c * (colW + gx), y + r * pstep, colW, phB);
      });
      y += pr * pstep + 6;
      const w2 = (pw - 12) / 2, w3 = (pw - 24) / 3;
      sec1.forEach((n, i) => { out.rects[n] = Rc(px + (i % 2) * (w2 + 12), y + Math.floor(i / 2) * (secH + 10), w2, secH); });
      y += 2 * (secH + 10);
      sec2.forEach((n, i) => { out.rects[n] = Rc(px + i * (w3 + 12), y, w3, secH); });
      y += secH + 8;
      out.lock = { cx: px + pw / 2, y: y + 14, w: lkW }; y += LKH + 6;
      out.text = Rc(px, y, pw, textH); out.cols = cols;
    }
    return out;
  };
}

// ---- reference pages (How to play / About / Rules) -----------------------------------------------------------------------
function docLayout(l) {
  const { U } = l, pw = Math.min(U.w - 24, 1000), px = U.x0 + (U.w - pw) / 2, py = U.y0 + 8, ph = U.h - 16;
  const panel = Rc(px, py, pw, ph), hdrH = 84;
  const inc = Rc(px + pw - 22 - 100, py + 14, 100, 56), dec = Rc(inc.x - 12 - 100, py + 14, 100, 56);
  const leftClear = Math.max(px + 24, l.backBox.w ? l.backBox.x + l.backBox.w + 6 : 0);
  const title = { x: (leftClear + dec.x - 10) / 2, y: py + 58, maxW: dec.x - 10 - leftClear };
  const footY = py + ph - 16 - 76, bw = Math.min(330, (pw - 60) / 2);
  const back = Rc(px + pw / 2 - 10 - bw, footY, bw, 76), next = Rc(px + pw / 2 + 10, footY, bw, 76), single = Rc(px + pw / 2 - 220, footY, 440, 76);
  const countY = footY - 12, top = py + hdrH + 12;
  return { panel, title, dec, inc, back, next, single, countY, body: Rc(px + 40, top, pw - 80, countY - 24 - top), hdrH };
}

// ---- settings --------------------------------------------------------------------------------------------------------------------
function settingsLayout(l) {
  const { U } = l, wide = U.w >= 900 && U.h < 800, pw = Math.min(U.w - 24, wide ? 1000 : 648), px = U.x0 + (U.w - pw) / 2;
  const names = ['sound', 'calm', 'big', 'set', 'auto', 'moves'], rows = {};
  const py = U.y0 + 8, ph = U.h - 16, panel = Rc(px, py, pw, ph);
  const back = Rc(px + pw / 2 - 220, py + ph - 16 - 76, 440, 76);
  let sample;
  const leftClear = Math.max(px + 24, l.backBox.w ? l.backBox.x + l.backBox.w + 6 : 0);
  if (wide) {
    const cw = (pw - 80 - 16) / 2, top = Math.max(py + 100, l.backBox.w ? l.backBox.y + l.backBox.h + 6 : 0), rh = clamp((back.y - 14 - top - 2 * 14) / 3, 56, 92);
    names.forEach((n, i) => { rows[n] = Rc(px + 40 + (i % 2) * (cw + 16), top + Math.floor(i / 2) * (rh + 14), cw, rh); });
    sample = { y: py + 66, xs: [px + pw - 150, px + pw - 70], k: 0.8 };
    return { panel, rows, title: { x: (leftClear + px + pw - 200) / 2, y: py + 66 }, back, sample, wide };
  }
  const top = Math.max(py + 110, l.backBox.w ? l.backBox.y + l.backBox.h + 6 : 0), rw = Math.min(540, pw - 40), rh = clamp((back.y - 12 - top - 120 - 5 * 14) / 6, 56, 92);
  names.forEach((n, i) => { rows[n] = Rc(px + (pw - rw) / 2, top + i * (rh + 14), rw, rh); });
  sample = { y: Math.min(back.y - 50, top + 6 * (rh + 14) + 50), xs: [px + pw / 2 - 60, px + pw / 2 + 60], k: 1.2 };
  return { panel, rows, title: { x: px + pw / 2, y: py + 80 }, back, sample, wide };
}

// ---- overlays: result, cube question, demo limit -----------------------------------------------------------------------------
function overLayout(l) {
  const { U } = l, cx = U.x0 + U.w / 2, lift = U.h > 1200 ? 90 : 0;
  const pw = Math.min(620, U.w - 24), ph = Math.min(560, U.h - 16), py = Math.max(U.y0 + 8, U.y0 + (U.h - ph) / 2 - lift);
  const panel = Rc(cx - pw / 2, py, pw, ph);
  const bw = Math.min(500, pw - 60), hw = (bw - 20) / 2, by = py + ph - 36 - 72 - 12 - 84 - 28;
  const again = Rc(cx - bw / 2, by, bw, 84), menu = Rc(cx - bw / 2, by + 96, hw, 72), share = Rc(cx - bw / 2 + hw + 20, by + 96, hw, 72);
  const cpw = Math.min(600, U.w - 24), cph = 350, cpy = Math.max(U.y0 + 8, U.y0 + (U.h - cph) / 2 - lift);
  const cpanel = Rc(cx - cpw / 2, cpy, cpw, cph), tw = Math.min(250, (cpw - 100) / 2);
  const take = Rc(cx - tw - 10, cpy + cph - 24 - 84, tw, 84), drop = Rc(cx + 10, cpy + cph - 24 - 84, tw, 84);
  const dpw = Math.min(600, U.w - 24), dph = 460, dpy = Math.max(U.y0 + 8, U.y0 + (U.h - dph) / 2 - lift);
  const dpanel = Rc(cx - dpw / 2, dpy, dpw, dph), dback = Rc(cx - Math.min(220, dpw / 2 - 20), dpy + dph - 24 - 76, Math.min(440, dpw - 40), 76);
  return { panel, again, menu, share, cx, titleY: py + 86, bodyY: py + 140, bodyW: pw - 60, moreY: py + ph - 14,
    cpanel, take, drop, cTitleY: cpy + 66, cBodyY: cpy + 116, cBodyW: cpw - 80, dpanel, dback, dTitleY: dpy + 90, dBodyY: dpy + 160, dBodyW: dpw - 100 };
}

// ---- accessors the tests and older call sites read ------------------------------------------------------------------------------
export const titleRows = (hasSave) => L.title(hasSave).rects;

// Tap zone of the Arcforge lockup (title screen): at least 44 x 44 css px, grown sideways/downwards only.
export const creditHit = (k) => { const m = 44 / Math.max(host.px, 1e-6), lh = k.w * 327 / 1200, w = Math.max(k.w, m), h = Math.max(lh, m); return { x: Math.round(k.cx - w / 2), y: Math.round(k.y), w: Math.round(w), h: Math.round(h) }; };
