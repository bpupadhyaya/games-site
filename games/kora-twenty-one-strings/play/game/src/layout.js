// Geometry as a function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
// layoutFor(w, h) returns every rect for that size and is cached by size + insets. Three shapes:
//   tall     portrait phone (h >= 1.5 w): HUD on top, long lanes, drums low.
//   compact  portrait tablet / 4:3 either way / small phones: HUD on top, shorter lanes.
//   wide     landscape (w >= 1.45 h): a status card on the left, the stage in the middle, a button card on the right.
import { STRING_COUNT } from './music.js';

export const TEXT_SCALES = [1, 1.25, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
// Safe areas and the host's floating back button in virtual units; main.js keeps this current (browsers: zeros).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };      // px = css pixels per virtual unit
export const minBtn = () => Math.max(60, 46 / Math.max(0.2, host.px));  // a thumb-sized height in units

const cache = new Map();
const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function layoutFor(w, h) {
  const key = `${Math.round(w)}x${Math.round(h)}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)},${host.px.toFixed(2)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h); if (cache.size > 8) cache.clear(); cache.set(key, L); }
  return L;
}

function build(w, h) {
  const mode = w >= h * 1.2 ? 'wide' : h >= w * 1.5 ? 'tall' : 'compact';
  const S = R(host.l, host.t, w - host.l - host.r, h - host.t - host.b);          // the safe rectangle
  const mb = minBtn(), gap = 16;
  const backPad = host.back > 0 ? host.back + 8 : 0;                               // the host's floating back button owns the top-left corner
  const L = { w, h, mode, S, mb, backPad };

  // ---- the stage: a perspective of strings running away from the bridge, the calabash and the hands below ------------------------
  // stage(ax, ay, aw, ah, o) -> { ax, ay, aw, ah, laneTop, bridgeY, bottom, body, lanesFor(n), strings }.
  //   laneTop = the far end of the strings, bridgeY = the bridge (where a note must be plucked), below it the calabash skin.
  const stage = (ax, ay, aw, ah, opts = {}) => {
    const laneTop = opts.laneTop ?? ay, bodyFrac = opts.bodyFrac ?? (mode === 'tall' ? 0.23 : mode === 'compact' ? 0.25 : 0.28);
    const bottom = ay + ah, bridgeY = bottom - Math.max(172, Math.min(340, (bottom - laneTop) * bodyFrac));
    const cx = ax + aw / 2, far = opts.far ?? 0.52;
    const st = { ax, ay, aw, ah, laneTop, bridgeY, bottom, cx, far, body: R(ax, bridgeY, aw, bottom - bridgeY) };
    // n lanes spread evenly (capped width), centred
    st.lanesFor = (n) => {
      const key = n; if (st._l && st._l[key]) return st._l[key];
      const laneW = Math.min(aw / n, n <= 3 ? 210 : n === 4 ? 190 : 170), total = laneW * n, x0 = cx - total / 2;
      const lanes = []; for (let i = 0; i < n; i++) { const bx = x0 + laneW * (i + 0.5); lanes.push({ i, cx: bx, cxTop: cx + (bx - cx) * far, lw: laneW, y0: laneTop, y1: bridgeY }); }
      (st._l = st._l || {})[key] = lanes; return lanes;
    };
    // the full set of 21 strings (free play and the title instrument): evenly spread over the width
    const sw = Math.min(aw - 20, 1500) / STRING_COUNT, sx0 = cx - sw * STRING_COUNT / 2;
    st.strings = []; for (let i = 0; i < STRING_COUNT; i++) { const bx = sx0 + sw * (i + 0.5); st.strings.push({ i, cx: bx, cxTop: cx + (bx - cx) * far, lw: sw }); }
    return st;
  };
  L.stageFor = stage;

  // ---- PLAY / LEARN / AUTO ---------------------------------------------------------------------------------------------------
  {
    const P = { };
    const bw = Math.max(64, mb);
    if (mode === 'wide') {
      const pw = clamp(w * 0.17, 168, 320);
      const dy = backPad ? backPad + 4 : 0;
      P.left = R(S.x + 16, S.y + 16 + dy, pw, S.h - 32 - dy);
      P.right = R(S.x + S.w - 16 - pw, S.y + 16, pw, S.h - 32);
      const sx = P.left.x + pw + 18, sw = P.right.x - 18 - sx;
      P.stage = stage(sx, S.y, sw, S.h, { laneTop: S.y + 78 });
      P.hudTop = R(sx, S.y + 12, sw, 56);
      P.pause = R(P.right.x + 14, P.right.y + P.right.h - 14 - bw, pw - 28, bw);
      P.hint = R(P.right.x + 14, P.pause.y - 14 - bw, pw - 28, bw);
      P.ens = R(P.right.x + 14, P.right.y + 214, pw - 28, P.hint.y - (P.right.y + 214) - 14);
      P.score = R(P.left.x + 14, P.left.y + 14, pw - 28, 120);
      P.stats = R(P.left.x + 14, P.left.y + 150, pw - 28, P.left.h - 164);
    } else {
      const top = S.y + 10, hudH = 196;
      P.hudTop = R(S.x + 12 + backPad, top, S.w - 24 - backPad * 2 + (backPad ? 0 : 0), hudH);
      P.pause = R(S.x + S.w - 12 - Math.max(64, mb), top + 6, Math.max(64, mb), Math.max(64, mb));
      P.hint = R(P.pause.x - 12 - Math.max(64, mb), top + 6, Math.max(64, mb), Math.max(64, mb));
      P.score = R(S.x + 12 + backPad, top, P.hint.x - 12 - (S.x + 12 + backPad), 78);
      P.ens = R(S.x + 20, top + hudH - 56, S.w - 40 - 84, 44);
      P.stage = stage(S.x, S.y, S.w, S.h, { laneTop: top + hudH + 6 });
    }
    L.play = P;
  }

  // ---- FREE PLAY (same stage, no lanes, a control bar) ----------------------------------------------------------------------
  {
    const F = {};
    const bh = Math.max(64, mb);
    if (mode === 'wide') {
      const pw = clamp(w * 0.17, 168, 320);
      F.right = R(S.x + S.w - 16 - pw, S.y + 16, pw, S.h - 32);
      const dy = backPad ? backPad + 4 : 0;
      F.left = R(S.x + 16, S.y + 16 + dy, pw, S.h - 32 - dy);
      const sx = F.left.x + pw + 18, sw = F.right.x - 18 - sx;
      F.stage = stage(sx, S.y + 12, sw, S.h - 24, { laneTop: S.y + 24, far: 0.62 });
      let y = F.right.y + 16;
      F.metro = R(F.right.x + 14, y, pw - 28, bh); y += bh + 12;
      y += 30; F.tempoDec = R(F.right.x + 14, y, (pw - 28 - 12) / 2, bh); F.tempoInc = R(F.tempoDec.x + F.tempoDec.w + 12, y, F.tempoDec.w, bh); y += bh + 12;
      F.echo = R(F.right.x + 14, y, pw - 28, bh); y += bh + 12;
      F.exit = R(F.right.x + 14, F.right.y + F.right.h - 14 - bh, pw - 28, bh);
      F.info = R(F.left.x + 14, F.left.y + 14, pw - 28, F.left.h - 28);
    } else {
      const top = S.y + 10;
      F.exit = R(S.x + 12 + backPad, top, Math.max(120, mb * 1.7), bh);
      const rowY = S.y + S.h - bh - 14, gap = 10, W = S.w - 24;
      const wm = W * 0.34, wt = W * 0.17, we = W - wm - wt * 2 - gap * 3;
      F.metro = R(S.x + 12, rowY, wm, bh); F.tempoDec = R(F.metro.x + wm + gap, rowY, wt, bh); F.tempoInc = R(F.tempoDec.x + wt + gap, rowY, wt, bh);
      F.echo = R(F.tempoInc.x + wt + gap, rowY, we, bh);
      F.stage = stage(S.x + 4, S.y + bh + 100, S.w - 8, rowY - 30 - (S.y + bh + 100), { laneTop: S.y + bh + 110, far: 0.66, bodyFrac: 0.3 });
      F.info = R(S.x + 12 + backPad + F.exit.w + 12, top, S.w - 24 - backPad - F.exit.w - 12 - 12, bh);
    }
    L.free = F;
  }

  // ---- TITLE ------------------------------------------------------------------------------------------------------------------
  {
    const T = {};
    const bh = Math.max(S.h < 1200 && mode !== 'wide' ? 74 : 84, mb);
    if (mode === 'wide') {
      const colW = clamp(w * 0.3, 300, 460), colX = S.x + S.w - 32 - colW, y0 = S.y + Math.max(24, (S.h - (bh * 4 + 12 * 3 + 12 + 70 + 12 + bh * 2 + 12 + 50)) / 2);
      T.size = Math.min(84, (colX - S.x - 60) / 4.3);
      T.titleY = S.y + Math.max(64, S.h * 0.1);
      const tb = T.titleY + T.size * 1.5 + 36, rr = Math.min((colX - S.x) * 0.28, (S.y + S.h - 110 - tb) / 4.3);
      T.hero = { x: S.x + (colX - S.x) / 2, y: tb + rr * 3.35, r: rr };
      let y = y0;
      T.play = R(colX, y, colW, bh + 16); y += bh + 16 + 12;
      T.free = R(colX, y, colW, bh); y += bh + 12;
      T.auto = R(colX, y, colW, bh); y += bh + 12;
      const hw = (colW - 12) / 2, sh = Math.max(64, mb);
      T.how = R(colX, y, hw, sh); T.rules = R(colX + hw + 12, y, hw, sh); y += sh + 12;
      T.about = R(colX, y, hw, sh); T.settings = R(colX + hw + 12, y, hw, sh);
      T.credit = { x: T.hero.x, y: S.y + S.h - 16 };
      T.col = R(colX, y0, colW, y + sh - y0);
    } else {
      const bw = Math.min(S.w - 64, 560), bx = S.x + (S.w - bw) / 2, sh = Math.max(S.h < 1200 ? 60 : 66, mb);
      const total = bh + 12 + 16 + (bh + 12) * 2 + (sh + 12) * 2;
      const creditH = 92;
      const bottom = S.y + S.h - creditH;
      let y = bottom - total;
      T.size = Math.min(132, (S.w - 60) / 4.3);
      T.titleY = S.y + Math.max(80, (y - S.y) * 0.1);
      const tb = T.titleY + T.size * 1.5 + 50, rr = Math.max(40, Math.min(S.w * 0.24, (y - 14 - tb) / 4.3));
      T.hero = { x: S.x + S.w / 2, y: tb + rr * 3.35, r: rr };
      T.play = R(bx, y, bw, bh + 16); y += bh + 16 + 12;
      T.free = R(bx, y, bw, bh); y += bh + 12;
      T.auto = R(bx, y, bw, bh); y += bh + 12;
      const hw = (bw - 12) / 2;
      T.how = R(bx, y, hw, sh); T.rules = R(bx + hw + 12, y, hw, sh); y += sh + 12;
      T.about = R(bx, y, hw, sh); T.settings = R(bx + hw + 12, y, hw, sh);
      T.credit = { x: S.x + S.w / 2, y: S.y + S.h - 14 };
      T.col = R(bx, bottom - total, bw, total);
    }
    L.title = T;
  }

  // ---- SONGS (a list/grid of the six pieces) -----------------------------------------------------------------------------------------
  {
    const G = {};
    const hdrH = Math.max(76, mb) + 8;
    G.back = R(S.x + 12 + (backPad ? backPad : 0), S.y + 12, Math.max(120, mb * 1.7), Math.max(60, mb));
    G.titleY = S.y + 12 + Math.max(60, mb) / 2;
    const top = S.y + hdrH + 24, bot = S.y + S.h - 16;
    const cols = mode === 'wide' ? 3 : mode === 'compact' && w > h ? 3 : mode === 'compact' ? 2 : 1;
    const rows = Math.ceil(6 / cols), gx = 14, gy = 14;
    const cw = (S.w - 32 - gx * (cols - 1)) / cols, ch = Math.min(260, (bot - top - gy * (rows - 1)) / rows);
    G.cols = cols; G.cards = [];
    for (let i = 0; i < 6; i++) { const c = i % cols, r = Math.floor(i / cols); G.cards.push(R(S.x + 16 + c * (cw + gx), top + r * (ch + gy), cw, ch)); }
    L.songs = G;
  }

  // ---- PIECE (detail + mode choice) ---------------------------------------------------------------------------------------------------
  {
    const D = {};
    D.back = R(S.x + 12 + backPad, S.y + 12, Math.max(120, mb * 1.7), Math.max(60, mb));
    const bh = Math.max(88, mb);
    if (mode === 'wide') {
      const colW = clamp(w * 0.3, 340, 460), colX = S.x + S.w - 32 - colW;
      const top0 = S.y + 26 + Math.max(60, mb);
      D.info = R(S.x + 24, top0, colX - S.x - 48, S.y + S.h - 30 - top0);
      let y = S.y + (S.h - (bh * 3 + 24)) / 2;
      D.learn = R(colX, y, colW, bh); y += bh + 12; D.perform = R(colX, y, colW, bh); y += bh + 12; D.watch = R(colX, y, colW, bh);
    } else {
      const bw = Math.min(S.w - 48, 600), bx = S.x + (S.w - bw) / 2, total = bh * 3 + 24;
      let y = S.y + S.h - 24 - total;
      D.info = R(S.x + 24, S.y + 26 + Math.max(60, mb), S.w - 48, y - 12 - (S.y + 26 + Math.max(60, mb)));
      D.learn = R(bx, y, bw, bh); y += bh + 12; D.perform = R(bx, y, bw, bh); y += bh + 12; D.watch = R(bx, y, bw, bh);
    }
    L.piece = D;
  }

  // ---- RESULT ----------------------------------------------------------------------------------------------------------------------------------
  {
    const Rr = {};
    const bh = Math.max(80, mb);
    const pw = Math.min(S.w - 32, mode === 'wide' ? 980 : 640), ph = Math.min(S.h - 40, mode === 'wide' ? 620 : 1160);
    Rr.panel = R(S.x + (S.w - pw) / 2, S.y + (S.h - ph) / 2, pw, ph);
    const p = Rr.panel;
    if (mode === 'wide') {
      const bwid = (pw - 64 - 24) / 3;
      Rr.again = R(p.x + 32, p.y + p.h - 32 - bh, bwid, bh); Rr.songs = R(Rr.again.x + bwid + 12, Rr.again.y, bwid, bh); Rr.menu = R(Rr.songs.x + bwid + 12, Rr.again.y, bwid, bh);
      Rr.more = { x: p.x + p.w / 2, y: p.y + p.h - 32 - bh - 20 };
    } else {
      const bwid = pw - 64;
      Rr.menu = R(p.x + 32, p.y + p.h - 56 - bh, bwid, bh); Rr.songs = R(p.x + 32, Rr.menu.y - 12 - bh, bwid, bh); Rr.again = R(p.x + 32, Rr.songs.y - 12 - bh, bwid, bh);
      Rr.more = { x: p.x + p.w / 2, y: p.y + p.h - 24 };
    }
    L.result = Rr;
  }

  // ---- DOCUMENT screens (Rules, About, How to Play, Settings): header, scrolling viewport, nav -----------------------------------------------------
  {
    const Dc = {};
    const bh = Math.max(64, mb), margin = mode === 'wide' ? Math.max(24, S.w * 0.06) : 16;
    const contentW = Math.min(S.w - margin * 2, mode === 'wide' ? 1100 : 820);
    const cx = S.x + (S.w - contentW) / 2;
    Dc.back = R(S.x + 12 + backPad, S.y + 12, Math.max(110, mb * 1.6), bh);
    const decW = Math.max(64, mb);
    Dc.textInc = R(S.x + S.w - 12 - decW, S.y + 12, decW, bh);
    Dc.textDec = R(Dc.textInc.x - 10 - decW, S.y + 12, decW, bh);
    Dc.headerH = bh + 24;
    const navH = bh;
    Dc.nav = { back: R(cx, S.y + S.h - 14 - navH, (contentW - 12) / 2, navH), next: R(cx + (contentW - 12) / 2 + 12, S.y + S.h - 14 - navH, (contentW - 12) / 2, navH) };
    Dc.viewport = R(cx, S.y + Dc.headerH + 56, contentW, S.y + S.h - 14 - navH - 12 - (S.y + Dc.headerH + 56));
    Dc.scrollbar = R(Dc.viewport.x + Dc.viewport.w - 14, Dc.viewport.y, 14, Dc.viewport.h);
    Dc.titleY = S.y + 12 + bh / 2;
    Dc.contentW = contentW;
    L.doc = Dc;
  }

  // ---- CALIBRATE -----------------------------------------------------------------------------------------------------------------------------------------
  {
    const C = {};
    const bh = Math.max(72, mb);
    C.back = R(S.x + 12 + backPad, S.y + 12, Math.max(120, mb * 1.7), bh);
    const bw = Math.min(S.w - 48, 520);
    C.use = R(S.x + (S.w - bw) / 2, S.y + S.h - 24 - bh, bw, bh);
    C.retry = R(C.use.x, C.use.y - 12 - bh, bw, bh);
    C.pad = { x: S.x + S.w / 2, y: S.y + S.h * (mode === 'wide' ? 0.5 : 0.44), r: Math.min(S.w, S.h) * (mode === 'wide' ? 0.2 : 0.26) };
    L.calib = C;
  }
  return L;
}

// Rects for a small centred menu of n buttons (pause menu, end-of-demo menu): { panel, btns[] }.
export function menuRects(L, n, extraTop = 120) {
  const S = L.S, bh = Math.max(76, L.mb), gap = 12, pw = Math.min(S.w - 40, 560), ph = extraTop + n * bh + (n - 1) * gap + 36;
  const panel = R(S.x + (S.w - pw) / 2, S.y + (S.h - ph) / 2, pw, ph), btns = [];
  for (let i = 0; i < n; i++) btns.push(R(panel.x + 28, panel.y + extraTop + i * (bh + gap), pw - 56, bh));
  return { panel, btns };
}

// Which lane does a touch at (x, y) pluck? Returns the lane index, or -1 when the touch is outside the string area.
// A touch always goes to the nearest lane (by distance to the lane's line at that height), so a thumb that lands a little wide still plays.
export function laneHit(stage, n, x, y) {
  if (y < stage.laneTop || y > stage.bottom || x < stage.ax || x > stage.ax + stage.aw) return -1;
  const lanes = stage.lanesFor(n), k = Math.max(0, Math.min(1, (y - stage.laneTop) / Math.max(1, stage.bridgeY - stage.laneTop)));
  let best = -1, bd = 1e9;
  for (const ln of lanes) { const lx = ln.cxTop + (ln.cx - ln.cxTop) * k, d = Math.abs(x - lx); if (d < bd) { bd = d; best = ln.i; } }
  return best;
}
// The same for free play: which of the 21 strings is nearest.
export function stringHit(stage, x, y) {
  if (y < stage.laneTop || y > stage.bottom || x < stage.ax || x > stage.ax + stage.aw) return -1;
  const k = Math.max(0, Math.min(1, (y - stage.laneTop) / Math.max(1, stage.bridgeY - stage.laneTop)));
  let best = -1, bd = 1e9;
  for (const s of stage.strings) { const lx = s.cxTop + (s.cx - s.cxTop) * k, d = Math.abs(x - lx); if (d < bd) { bd = d; best = s.i; } }
  return best;
}
// x of a lane / string line at height y.
export const xAt = (ln, stage, y) => { const k = Math.max(0, Math.min(1.2, (y - stage.laneTop) / Math.max(1, stage.bridgeY - stage.laneTop))); return ln.cxTop + (ln.cx - ln.cxTop) * Math.min(1, k); };

// Where every one of the 21 strings stands on the bridge for a piece (the piece's lanes keep their even spacing; the other strings are spread
// between and beyond them in pitch order, so the whole instrument is always one coherent set of strings). piece = null: the plain even spread.
// Returns { x[21] (at the bridge), xt[21] (at the far end), lane[21] (lane index or -1) }.
const mapCache = new WeakMap();
export function stringMap(stage, piece) {
  const key = piece ? piece.id : '*';
  let m = mapCache.get(stage); if (!m) { m = {}; mapCache.set(stage, m); }
  if (m[key]) return m[key];
  const x = new Array(STRING_COUNT), lane = new Array(STRING_COUNT).fill(-1);
  if (!piece) { stage.strings.forEach((s) => { x[s.i] = s.cx; }); }
  else {
    const lanes = stage.lanesFor(piece.lanes.length), a = piece.lanes, lw = lanes[0].lw;
    const xmin = stage.ax + 30, xmax = stage.ax + stage.aw - 30;
    a.forEach((s, k) => { x[s] = lanes[k].cx; lane[s] = k; });
    const s0 = a[0], sN = a[a.length - 1];
    for (let j = 0; j < s0; j++) x[j] = xmin + (lanes[0].cx - lw * 0.55 - xmin) * (s0 <= 1 ? 1 : j / (s0 - 1 + 0.0001));
    for (let j = sN + 1; j < STRING_COUNT; j++) x[j] = lanes[a.length - 1].cx + lw * 0.55 + (xmax - lanes[a.length - 1].cx - lw * 0.55) * ((j - sN - 1) / Math.max(1, STRING_COUNT - sN - 2));
    for (let k = 0; k < a.length - 1; k++) { const g = a[k + 1] - a[k]; for (let j = 1; j < g; j++) x[a[k] + j] = lanes[k].cx + (lanes[k + 1].cx - lanes[k].cx) * (j / g); }
  }
  const xt = x.map((v) => stage.cx + (v - stage.cx) * stage.far);
  return (m[key] = { x, xt, lane });
}
