// Geometry as a function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
// layoutFor(w, h) returns every rect for that size and is cached by size + insets. The strings always run along the LONG side of the
// stage: top to bottom in portrait (the player's end at the bottom), left to right in landscape (the player's end at the right,
// string 1 at the bottom, as if the phone were turned counter-clockwise). Shapes:
//   tall     portrait: HUD on top, the instrument fills the rest.
//   compact  landscape up to about 1.55:1 (4:3 tablets): a slim HUD strip on top.
//   wide     landscape wider than 1.55:1: a card on each side, the instrument in the middle.
import { NSTR, GEO } from './music.js';

export const TEXT_SCALES = [1, 1.25, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
// Safe areas and the host's floating back button in virtual units; main.js keeps this current (browsers: zeros).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6, tz: 1 };      // px = css pixels per virtual unit
export const minBtn = () => Math.max(60, 46 / Math.max(0.2, host.px));

const cache = new Map();
const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const BODY = { a0: -0.035, a1: 1.06 };                              // the body spans u in [a0, a1]

export function layoutFor(w, h) {
  const key = `${Math.round(w)}x${Math.round(h)}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)},${host.px.toFixed(2)}|${host.tz}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h); if (cache.size > 8) cache.clear(); cache.set(key, L); }
  return L;
}

// The instrument placed in a rectangle. Local frame: lx along the strings (u * len), ly across (string s at (s + 0.5) * sp).
export function makeInst(r, vert) {
  const C = vert ? r.w : r.h, A = vert ? r.h : r.w;
  const m = clamp(C * 0.04, 8, 30), W = C - 2 * m, sp = W / NSTR, len = A / (BODY.a1 - BODY.a0);
  const A0 = (vert ? r.y : r.x) - BODY.a0 * len, X0 = vert ? r.x + m : r.y + r.h - m;
  const inst = {
    vert, r, m, W, sp, len, A0, X0, key: `${vert ? 'v' : 'h'}${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.w)},${Math.round(r.h)}`,
    pt(u, s) { const lx = u * len, ly = (s + 0.5) * sp; return vert ? { x: X0 + ly, y: A0 + lx } : { x: A0 + lx, y: X0 - ly }; },
    uv(x, y) { const lx = vert ? y - A0 : x - A0, ly = vert ? x - X0 : X0 - y; return { u: lx / len, sf: ly / sp - 0.5 }; },
    apply(ctx) { if (vert) ctx.transform(0, 1, 1, 0, X0, A0); else ctx.transform(1, 0, 0, -1, A0, X0); },
    // unit vectors (screen) along the strings towards the player, and across towards higher strings
    along: vert ? { x: 0, y: 1 } : { x: 1, y: 0 }, across: vert ? { x: 1, y: 0 } : { x: 0, y: -1 },
  };
  return inst;
}

function build(w, h) {
  const vert = h >= w * 0.95, side = !vert && w >= h * 1.55, mode = vert ? 'tall' : side ? 'wide' : 'compact';
  const S = R(host.l, host.t, w - host.l - host.r, h - host.t - host.b);
  const mb = minBtn(), gap = 14;
  const backPad = host.back > 0 ? host.back + 8 : 0;
  const L = { w, h, mode, S, mb, backPad, vert };
  const bw = Math.max(64, mb), dz = clamp(host.tz - 1, 0, 2);        // dz: how far text zoom has grown the caption areas (0 at 100%)

  // ---- the stage frame shared by Play and Free play ---------------------------------------------------------------------------------
  const frame = (free) => {
    const P = {};
    if (mode === 'wide') {
      const pw = clamp(w * 0.16, 176, 300), dy = backPad ? backPad + 4 : 0;
      P.left = R(S.x + 14, S.y + 14 + dy, pw, S.h - 28 - dy); P.right = R(S.x + S.w - 14 - pw, S.y + 14, pw, S.h - 28);
      const ix = P.left.x + pw + 12, iw = P.right.x - 12 - ix;
      P.inst = makeInst(R(ix, S.y + 6, iw, S.h - 12), false);
      P.hud = 'side';
      const rx = P.right.x + 12, rw = pw - 24;
      if (!free) {
        P.pause = R(rx, P.right.y + P.right.h - 12 - bw, rw, bw); P.hint = R(rx, P.pause.y - 12 - bw, rw, bw);
        P.cap = R(rx, P.right.y + 12, rw, P.hint.y - 24 - P.right.y);
        P.score = R(P.left.x + 12, P.left.y + 12, pw - 24, 110);
        P.ens = R(P.left.x + 12, P.left.y + 138, pw - 24, 64);
        P.prog = R(P.left.x + 12, P.left.y + 214, pw - 24, 22);
        P.stats = R(P.left.x + 12, P.left.y + 250, pw - 24, P.left.h - 262);
      } else {
        let y = P.right.y + 12;
        P.scale = R(rx, y, rw, bw); y += bw + 12; P.reset = R(rx, y, rw, bw); y += bw + 12;
        P.exit = R(rx, P.right.y + P.right.h - 12 - bw, rw, bw);
        P.info = R(P.left.x + 12, P.left.y + 12, pw - 24, P.left.h - 24);
      }
    } else if (mode === 'compact') {
      const top = S.y + 8, hud = free ? bw + 14 : 76 + 56 + 34 * dz;
      const ix = S.x + 8, iy = top + hud + 4;
      P.inst = makeInst(R(ix, iy, S.w - 16, S.y + S.h - 8 - iy), false);
      P.hud = 'top';
      if (!free) {
        P.pause = R(S.x + S.w - 12 - bw, top + 4, bw, bw); P.hint = R(P.pause.x - 12 - bw, top + 4, bw, bw);
        P.score = R(S.x + 12 + backPad, top, 250, 70); P.ens = R(P.score.x + 262, top + 4, 190, 56);
        P.prog = R(P.ens.x + 202, top + 26, P.hint.x - 12 - (P.ens.x + 202), 20);
        P.cap = R(S.x + 12, top + 76, S.w - 24, 52 + 34 * dz);
      } else {
        P.exit = R(S.x + 12 + backPad, top, Math.max(120, mb * 1.7), bw);
        const rest = S.x + S.w - 12 - (P.exit.x + P.exit.w + 12);
        P.reset = R(S.x + S.w - 12 - Math.max(150, rest * 0.2), top, Math.max(150, rest * 0.2), bw);
        P.scale = R(P.reset.x - 12 - Math.max(240, rest * 0.34), top, Math.max(240, rest * 0.34), bw);
        P.info = R(P.exit.x + P.exit.w + 12, top, P.scale.x - 12 - (P.exit.x + P.exit.w + 12), bw);
      }
    } else {
      const top = S.y + 8, hud = free ? bw + 22 + 56 + 40 * dz : 78 + 50 + 136 + 60 * dz;
      P.hud = 'top';
      P.inst = makeInst(R(S.x + 8, top + hud + 4, S.w - 16, S.y + S.h - 8 - (top + hud + 4) - (free ? bw + 22 : 0)), true);
      if (!free) {
        P.pause = R(S.x + S.w - 12 - bw, top + 4, bw, bw); P.hint = R(P.pause.x - 12 - bw, top + 4, bw, bw);
        P.score = R(S.x + 12 + backPad, top, P.hint.x - 12 - (S.x + 12 + backPad), 74);
        P.ens = R(S.x + 12, top + 80, 214, 44); P.prog = R(P.ens.x + 232, top + 92, S.x + S.w - 12 - (P.ens.x + 232), 20);
        P.cap = R(S.x + 12, top + 130, S.w - 24, 132 + 60 * dz);
      } else {
        P.exit = R(S.x + 12 + backPad, top, Math.max(120, mb * 1.7), bw);
        P.info = R(P.exit.x + P.exit.w + 12, top, S.x + S.w - 12 - (P.exit.x + P.exit.w + 12), bw);
        P.cap = R(S.x + 12, top + bw + 10, S.w - 24, 70 + 40 * dz);
        const by = S.y + S.h - 10 - bw, W = S.w - 24, ws = W * 0.66;
        P.scale = R(S.x + 12, by, ws - 6, bw); P.reset = R(S.x + 12 + ws + 6, by, W - ws - 6, bw);
      }
    }
    return P;
  };
  L.play = frame(false); L.free = frame(true);

  // ---- TITLE ---------------------------------------------------------------------------------------------------------------------
  {
    const T = {};
    const bh0 = Math.max(S.h < 1200 && mode !== 'wide' ? 74 : 84, mb), sh0 = Math.max(vert ? (S.h < 1200 ? 60 : 66) : 64, mb);
    // text zoom grows the menu buttons (and their labels) as far as the screen allows
    const stack0 = bh0 + 28 + (bh0 + 12) * 2 + (sh0 + 12) * 2, k = clamp(Math.min(host.tz, 1.8, (vert ? S.h * 0.62 : S.h - 70) / stack0), 1, 1.8);
    T.k = k; const bh = bh0 * k;
    const hero = (ax, ay, aw, ah) => { const ww = Math.min(aw, ah * 3.3); return R(ax + (aw - ww) / 2, ay + (ah - ww / 3.3) / 2, ww, ww / 3.3); };
    if (!vert) {
      const colW = clamp(w * 0.3, 300, 460), colX = S.x + S.w - 32 - colW, y0 = S.y + Math.max(16, (S.h - (bh * 3 + 12 * 2 + 16 + 12 + 64 * 2 + 12 + 50)) / 2);
      T.size = Math.min(130, (colX - S.x - 60) / 3.4);
      T.titleY = S.y + Math.max(80, S.h * 0.16);
      const hy = T.titleY + T.size * 1.15, hh = S.y + S.h - 70 - hy;
      T.hero = hero(S.x + 24, hy, colX - S.x - 48, hh);
      let y = y0;
      T.play = R(colX, y, colW, bh + 16); y += bh + 16 + 12;
      T.free = R(colX, y, colW, bh); y += bh + 12;
      T.auto = R(colX, y, colW, bh); y += bh + 12;
      const hw = (colW - 12) / 2, sh = sh0 * k;
      T.how = R(colX, y, hw, sh); T.rules = R(colX + hw + 12, y, hw, sh); y += sh + 12;
      T.about = R(colX, y, hw, sh); T.settings = R(colX + hw + 12, y, hw, sh);
      T.credit = { x: S.x + S.w / 2, y: S.y + S.h - 16 };
    } else {
      const bwid = Math.min(S.w - 64, 560), bx = S.x + (S.w - bwid) / 2, sh = sh0 * k;
      const total = bh + 16 + 12 + (bh + 12) * 2 + (sh + 12) * 2, bottom = S.y + S.h - 92;
      let y = bottom - total;
      T.size = Math.min(150, (S.w - 60) / 3.4);
      T.titleY = S.y + Math.max(90, (y - S.y) * 0.1);
      const hy = T.titleY + T.size * 1.12;
      const ax = S.x + 16, aw = S.w - 32, ah = y - 12 - hy;
      if (ah >= aw * 0.9) { const hh = Math.min(ah, aw * 1.7), ww = hh / 1.95; T.hero = R(ax + (aw - ww) / 2, hy + (ah - hh) / 2, ww, hh); T.heroVert = true; }
      else T.hero = hero(ax, hy, aw, ah);
      T.play = R(bx, y, bwid, bh + 16); y += bh + 16 + 12;
      T.free = R(bx, y, bwid, bh); y += bh + 12;
      T.auto = R(bx, y, bwid, bh); y += bh + 12;
      const hw = (bwid - 12) / 2;
      T.how = R(bx, y, hw, sh); T.rules = R(bx + hw + 12, y, hw, sh); y += sh + 12;
      T.about = R(bx, y, hw, sh); T.settings = R(bx + hw + 12, y, hw, sh);
      T.credit = { x: S.x + S.w / 2, y: S.y + S.h - 14 };
    }
    L.title = T;
  }

  // ---- SONGS ---------------------------------------------------------------------------------------------------------------------
  {
    const G = {};
    const hdrH = Math.max(76, mb) + 8;
    G.back = R(S.x + 12 + backPad, S.y + 12, Math.max(120, mb * 1.7), Math.max(60, mb));
    G.titleY = S.y + 12 + Math.max(60, mb) / 2;
    const top = S.y + hdrH + 24, bot = S.y + S.h - 16;
    const cols = mode === 'wide' ? 3 : mode === 'compact' ? 3 : 1;
    const rows = Math.ceil(6 / cols), gx = 14, gy = 14;
    const cw = (S.w - 32 - gx * (cols - 1)) / cols, ch = Math.min(260, (bot - top - gy * (rows - 1)) / rows);
    G.cols = cols; G.cards = [];
    for (let i = 0; i < 6; i++) { const c = i % cols, r = Math.floor(i / cols); G.cards.push(R(S.x + 16 + c * (cw + gx), top + r * (ch + gy), cw, ch)); }
    L.songs = G;
  }

  // ---- PIECE ---------------------------------------------------------------------------------------------------------------------
  {
    const D = {};
    D.back = R(S.x + 12 + backPad, S.y + 12, Math.max(120, mb * 1.7), Math.max(60, mb));
    const bh = Math.max(88, mb);
    if (mode === 'wide') {
      const colW = clamp(w * 0.3, 340, 460), colX = S.x + S.w - 32 - colW;
      D.info = R(S.x + 24, S.y + 100, colX - S.x - 48, S.h - 130);
      let y = S.y + (S.h - (bh * 3 + 24)) / 2;
      D.learn = R(colX, y, colW, bh); y += bh + 12; D.perform = R(colX, y, colW, bh); y += bh + 12; D.watch = R(colX, y, colW, bh);
    } else {
      const bwid = Math.min(S.w - 48, 600), bx = S.x + (S.w - bwid) / 2, total = bh * 3 + 24;
      let y = S.y + S.h - 24 - total;
      D.info = R(S.x + 24, S.y + 100, S.w - 48, y - 12 - (S.y + 100));
      D.learn = R(bx, y, bwid, bh); y += bh + 12; D.perform = R(bx, y, bwid, bh); y += bh + 12; D.watch = R(bx, y, bwid, bh);
    }
    L.piece = D;
  }

  // ---- RESULT --------------------------------------------------------------------------------------------------------------------
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

  // ---- DOCUMENT screens ----------------------------------------------------------------------------------------------------------
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
    Dc.titleY = S.y + 12 + bh / 2;
    Dc.contentW = contentW;
    L.doc = Dc;
  }

  // ---- CALIBRATE -----------------------------------------------------------------------------------------------------------------
  {
    const C = {};
    const bh = Math.max(72, mb);
    C.back = R(S.x + 12 + backPad, S.y + 12, Math.max(120, mb * 1.7), bh);
    const bwid = Math.min(S.w - 48, 520);
    C.use = R(S.x + (S.w - bwid) / 2, S.y + S.h - 24 - bh, bwid, bh);
    C.retry = R(C.use.x, C.use.y - 12 - bh, bwid, bh);
    C.pad = { x: S.x + S.w / 2, y: S.y + S.h * (mode === 'wide' ? 0.5 : 0.44), r: Math.min(S.w, S.h) * (mode === 'wide' ? 0.2 : 0.26) };
    L.calib = C;
  }
  void gap; void GEO;
  return L;
}

export function menuRects(L, n, extraTop = 120) {
  const S = L.S, bh = Math.max(76, L.mb), gap = 12, pw = Math.min(S.w - 40, 560), ph = extraTop + n * bh + (n - 1) * gap + 36;
  const panel = R(S.x + (S.w - pw) / 2, S.y + (S.h - ph) / 2, pw, ph), btns = [];
  for (let i = 0; i < n; i++) btns.push(R(panel.x + 28, panel.y + extraTop + i * (bh + gap), pw - 56, bh));
  return { panel, btns };
}

// Which string does a touch at (x, y) mean, and where along it? Returns { s, u, zone: 'pluck' | 'press' | 'edge', press, off } or null outside the body.
// A string is "pressed" behind its bridge (u < bridge) and "plucked" in front of it; bridgeAt(s) gives the bridge position in u.
export function stringTouch(inst, x, y, bridgeAt) {
  const { u, sf } = inst.uv(x, y);
  if (sf < -0.8 || sf > NSTR - 1 + 0.8 || u < -0.02 || u > 1.04) return null;
  const s = clamp(Math.round(sf), 0, NSTR - 1), b = bridgeAt(s);
  const zone = u >= b ? 'pluck' : 'press', press = u >= b ? 0 : (b - u) <= GEO.halfBand ? 1 : 2;
  return { s, sf, u, b, zone, press };
}
