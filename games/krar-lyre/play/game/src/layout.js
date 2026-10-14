// Geometry as a function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
// layoutFor(w, h) returns every rect for that size and is cached by size + insets. Three shapes:
//   tall     portrait phone (h >= 1.5 w): HUD on top, the lyre filling the rest.
//   compact  portrait tablet / 4:3 either way / small phones: HUD on top, a smaller lyre.
//   wide     landscape (w >= 1.2 h): a status card on the left, the lyre in the middle, a button card on the right.
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

// The lyre: fitted into the rectangle (ax, ay, aw, ah). Returns the geometry art.drawLyre / the hit tests use.
export function lyreFor(ax, ay, aw, ah) {
  const asp = clamp((ah / aw) * 0.78, 1.2, 1.5);
  const W = Math.max(120, Math.min(aw * 0.97, ah / asp)), H = W * asp;
  const cx = ax + aw / 2, top = ay + Math.max(0, (ah - H) / 2);
  const halfTop = W * 0.45, rx = W * 0.37, ry = rx * 0.68, botY = top + H, bowlCy = botY - ry * 1.22;
  const barY = top + H * 0.055, bridgeY = bowlCy - ry * 0.12, tailY = bowlCy + ry * 0.5;
  const xs = [], xt = [];
  const sb = rx * 0.34, st = (halfTop * 2 * 0.8) / (STRING_COUNT - 1);
  for (let i = 0; i < STRING_COUNT; i++) { xs.push(cx + (i - 2.5) * sb); xt.push(cx + (i - 2.5) * st); }
  const pluckY = barY + (bridgeY - barY) * 0.6;
  return { cx, barY, bridgeY, tailY, botY, halfTop, rx, ry, bowlCy, xs, xt, pluckY, ax, ay, aw, ah, W, H, top, cueR: clamp(W * 0.062, 22, 40) };
}

function build(w, h) {
  const mode = w >= h * 1.2 ? 'wide' : h >= w * 1.5 ? 'tall' : 'compact';
  const S = R(host.l, host.t, w - host.l - host.r, h - host.t - host.b);
  const mb = minBtn();
  const backPad = host.back > 0 ? host.back + 8 : 0;
  const L = { w, h, mode, S, mb, backPad };

  // ---- PLAY / LEARN / AUTO / DUEL ----------------------------------------------------------------------------------------------
  {
    const P = {};
    const bw = Math.max(64, mb);
    if (mode === 'wide') {
      const pw = clamp(w * 0.17, 168, 320), dy = backPad ? backPad + 4 : 0;
      P.left = R(S.x + 16, S.y + 16 + dy, pw, S.h - 32 - dy);
      P.right = R(S.x + S.w - 16 - pw, S.y + 16, pw, S.h - 32);
      const sx = P.left.x + pw + 18, sw = P.right.x - 18 - sx;
      P.stage = lyreFor(sx, S.y + 66, sw, S.h - 74);
      P.stageCap = P.stage;
      P.pause = R(P.right.x + 14, P.right.y + P.right.h - 14 - bw, pw - 28, bw);
      P.hint = R(P.right.x + 14, P.pause.y - 14 - bw, pw - 28, bw);
      P.ens = R(P.right.x + 14, P.right.y + 214, pw - 28, P.hint.y - (P.right.y + 214) - 14);
      P.score = R(P.left.x + 14, P.left.y + 14, pw - 28, 120);
      P.stats = R(P.left.x + 14, P.left.y + 150, pw - 28, P.left.h - 164);
    } else {
      const top = S.y + 10, hudH = 168;
      P.hudTop = R(S.x + 12 + backPad, top, S.w - 24 - backPad * 2, hudH);
      P.pause = R(S.x + S.w - 12 - bw, top + 6, bw, bw);
      P.hint = R(P.pause.x - 12 - bw, top + 6, bw, bw);
      P.score = R(S.x + 12 + backPad, top, P.hint.x - 12 - (S.x + 12 + backPad), 78);
      P.ens = R(S.x + 20, top + hudH - 56, S.w - 40 - 84, 44);
      const y0 = top + hudH + 40, capH = clamp(S.h * 0.17, 150, 240);
      P.stage = lyreFor(S.x, y0, S.w, S.y + S.h - y0 - 6);
      P.cap = R(S.x + 12, y0 - 24, S.w - 24, capH);
      P.stageCap = lyreFor(S.x, y0 - 24 + capH + 4, S.w, S.y + S.h - (y0 - 24 + capH + 4) - 6);
    }
    L.play = P;
  }

  // ---- COMPOSE (free play) ---------------------------------------------------------------------------------------------------------
  {
    const F = {};
    const bh = Math.max(60, mb);
    const top = S.y + 10;
    if (mode === 'wide') {
      const lw = clamp(S.w * 0.4, 360, 720);
      F.exit = R(S.x + 12 + backPad, top, Math.max(120, mb * 1.7), bh);
      F.stage = lyreFor(S.x + 8, S.y + bh + 20, lw, S.h - bh - 30);
      const gx = S.x + lw + 28, gw = S.x + S.w - 16 - gx;
      F.info = R(gx, top, gw, bh);
      F.badge = { x: gx + gw - 12, y: top + (bh - Math.ceil(1.7 * Math.max(16, 11.5 / Math.max(0.2, host.px)))) / 2, align: 'right' };
      const rows = 6, ctrlH = bh * 2 + 12 + 14, gy = top + bh + 14, gh = Math.max(rows * 40, S.y + S.h - ctrlH - 14 - gy - 4);
      F.grid = R(gx + 56, gy, gw - 56, gh);
      F.rowLabelX = gx;
      let cy = S.y + S.h - 12 - ctrlH + 14; const n = 4, gap = 10, cw = (gw - gap * (n - 1)) / n;
      F.ctrl = []; for (let r = 0; r < 2; r++) for (let i = 0; i < n; i++) F.ctrl.push(R(gx + i * (cw + gap), cy + r * (bh + 12), cw, bh));
    } else {
      F.exit = R(S.x + 12 + backPad, top, Math.max(120, mb * 1.7), bh);
      F.info = R(F.exit.x + F.exit.w + 12, top, S.x + S.w - 12 - (F.exit.x + F.exit.w + 12), bh);
      const ctrlH = bh * 2 + 12, ctrlTop = S.y + S.h - 14 - ctrlH;
      const rows = 6, gridH = clamp(S.h * 0.3, rows * 46, rows * 70), gridTop = ctrlTop - 14 - gridH;
      const pillH = Math.ceil(1.7 * Math.max(16, 11.5 / Math.max(0.2, host.px))) + 8;
      F.badge = { x: S.x + S.w - 14, y: top + bh + 6, align: 'right' };
      const lyreTop = top + bh + 10 + pillH;
      F.stage = lyreFor(S.x, lyreTop, S.w, gridTop - 12 - lyreTop);
      F.grid = R(S.x + 70, gridTop, S.w - 70 - 16, gridH);
      F.rowLabelX = S.x + 12;
      const n = 4, gap = 10, cw = (S.w - 24 - gap * (n - 1)) / n;
      F.ctrl = []; for (let r = 0; r < 2; r++) for (let i = 0; i < n; i++) F.ctrl.push(R(S.x + 12 + i * (cw + gap), ctrlTop + r * (bh + 12), cw, bh));
    }
    L.free = F;
  }

  // ---- TITLE ------------------------------------------------------------------------------------------------------------------
  {
    const T = {};
    const bh = Math.max(S.h < 1200 && mode !== 'wide' ? 70 : 80, mb);
    if (mode === 'wide') {
      const colW = clamp(w * 0.3, 300, 460), colX = S.x + S.w - 32 - colW, sh = Math.max(64, mb);
      const total = (bh + 14) + (bh + 12) * 3 + (sh + 12) * 2 - 12;
      const y0 = S.y + Math.max(24, (S.h - total) / 2);
      T.size = Math.min(84, (colX - S.x - 60) / 4.6);
      T.titleY = S.y + Math.max(64, S.h * 0.1);
      const lt = T.titleY + T.size * 1.6 + 30;
      T.hero = lyreFor(S.x + 10, lt, colX - S.x - 30, S.y + S.h - 80 - lt);
      let y = y0;
      T.play = R(colX, y, colW, bh + 14); y += bh + 14 + 12;
      T.duel = R(colX, y, colW, bh); y += bh + 12;
      T.free = R(colX, y, colW, bh); y += bh + 12;
      T.auto = R(colX, y, colW, bh); y += bh + 12;
      const hw = (colW - 12) / 2;
      T.how = R(colX, y, hw, sh); T.rules = R(colX + hw + 12, y, hw, sh); y += sh + 12;
      T.about = R(colX, y, hw, sh); T.settings = R(colX + hw + 12, y, hw, sh);
      T.credit = { x: T.hero.cx, y: S.y + S.h - 16 };
      T.col = R(colX, y0, colW, y + sh - y0);
    } else {
      const bw = Math.min(S.w - 64, 560), bx = S.x + (S.w - bw) / 2, sh = Math.max(S.h < 1200 ? 58 : 64, mb);
      const total = (bh + 14) + (bh + 12) * 3 + (sh + 12) * 2 - 12;
      const bottom = S.y + S.h - 92;
      let y = bottom - total;
      T.size = Math.min(120, (S.w - 60) / 4.6);
      T.titleY = S.y + Math.max(70, (y - S.y) * 0.1);
      const lt = T.titleY + T.size * 1.45 + 24;
      T.hero = lyreFor(S.x, lt, S.w, y - 10 - lt);
      T.play = R(bx, y, bw, bh + 14); y += bh + 14 + 12;
      T.duel = R(bx, y, bw, bh); y += bh + 12;
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

  // ---- SONGS (the six pieces) ---------------------------------------------------------------------------------------------------------
  {
    const G = {};
    const hdrH = Math.max(76, mb) + 8;
    G.back = R(S.x + 12 + backPad, S.y + 12, Math.max(120, mb * 1.7), Math.max(60, mb));
    G.titleY = S.y + 12 + Math.max(60, mb) / 2;
    const top = S.y + hdrH + 24, bot = S.y + S.h - 16;
    const cols = mode === 'wide' ? 3 : mode === 'compact' && w > h ? 3 : mode === 'compact' ? 2 : 1;
    const rows = Math.ceil(6 / cols), gx = 14, gy = 14;
    const cw = (S.w - 32 - gx * (cols - 1)) / cols, ch = Math.min(250, (bot - top - gy * (rows - 1)) / rows);
    G.cols = cols; G.cards = [];
    for (let i = 0; i < 6; i++) { const c = i % cols, r = Math.floor(i / cols); G.cards.push(R(S.x + 16 + c * (cw + gx), top + r * (ch + gy), cw, ch)); }
    L.songs = G;
  }

  // ---- PIECE (detail + mode choice) ---------------------------------------------------------------------------------------------------
  {
    const D = {};
    D.back = R(S.x + 12 + backPad, S.y + 12, Math.max(120, mb * 1.7), Math.max(60, mb));
    const bh = Math.max(80, mb);
    if (mode === 'wide') {
      const colW = clamp(w * 0.3, 340, 460), colX = S.x + S.w - 32 - colW;
      const top0 = S.y + 26 + Math.max(60, mb);
      D.info = R(S.x + 24, top0, colX - S.x - 48, S.y + S.h - 30 - top0);
      let y = S.y + (S.h - (bh * 4 + 36)) / 2;
      D.learn = R(colX, y, colW, bh); y += bh + 12; D.perform = R(colX, y, colW, bh); y += bh + 12; D.duel = R(colX, y, colW, bh); y += bh + 12; D.watch = R(colX, y, colW, bh);
    } else {
      const bw = Math.min(S.w - 48, 600), bx = S.x + (S.w - bw) / 2, total = bh * 4 + 36;
      let y = S.y + S.h - 24 - total;
      D.info = R(S.x + 24, S.y + 26 + Math.max(60, mb), S.w - 48, y - 12 - (S.y + 26 + Math.max(60, mb)));
      D.learn = R(bx, y, bw, bh); y += bh + 12; D.perform = R(bx, y, bw, bh); y += bh + 12; D.duel = R(bx, y, bw, bh); y += bh + 12; D.watch = R(bx, y, bw, bh);
    }
    L.piece = D;
  }

  // ---- RESULT ----------------------------------------------------------------------------------------------------------------------------------
  {
    const Rr = {};
    const bh = Math.max(76, mb);
    const pw = Math.min(S.w - 32, mode === 'wide' ? 980 : 640), ph = Math.min(S.h - 40, mode === 'wide' ? 620 : 1100);
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

// Rects for a small centred menu of n buttons (pause menu): { panel, btns[] }.
export function menuRects(L, n, extraTop = 120) {
  const S = L.S, bh = Math.max(76, L.mb), gap = 12, pw = Math.min(S.w - 40, 560), ph = extraTop + n * bh + (n - 1) * gap + 36;
  const panel = R(S.x + (S.w - pw) / 2, S.y + (S.h - ph) / 2, pw, ph), btns = [];
  for (let i = 0; i < n; i++) btns.push(R(panel.x + 28, panel.y + extraTop + i * (bh + gap), pw - 56, bh));
  return { panel, btns };
}

// Hit tests on the lyre. A touch goes to the nearest string at its height, so a thumb that lands a little wide still plays.
export const lyreXAt = (G, i, y) => { const k = clamp((G.bridgeY - y) / Math.max(1, G.bridgeY - G.barY), 0, 1); return G.xs[i] + (G.xt[i] - G.xs[i]) * k; };
// Which string (1..6) does (x, y) pluck? 0 when the touch is outside the string area.
export function stringHit(G, x, y) {
  if (y < G.barY - 30 || y > G.bridgeY + 6) return 0;
  const yy = clamp(y, G.barY, G.bridgeY);
  if (x < lyreXAt(G, 0, yy) - G.cueR * 1.7 || x > lyreXAt(G, STRING_COUNT - 1, yy) + G.cueR * 1.7) return 0;
  let best = 0, bd = 1e9;
  for (let i = 0; i < STRING_COUNT; i++) { const d = Math.abs(x - lyreXAt(G, i, yy)); if (d < bd) { bd = d; best = i + 1; } }
  return best;
}
// The damp zone: the hide of the bowl, below the bridge.
export function bowlHit(G, x, y) {
  if (y < G.bridgeY + 8 || y > G.botY) return false;
  const dx = (x - G.cx) / (G.rx * 1.05), dy = (y - G.bowlCy) / (G.ry * 1.05);
  return dx * dx + dy * dy <= 1.15;
}
