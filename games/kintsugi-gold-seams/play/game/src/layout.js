// Geometry as a pure function of the LIVE screen size (kit fluid viewport: the short side is 720 units, the long side follows the screen).
// Render and hit-testing read the same rects, so what is drawn is what is tapped.
export const THINK_STEPS = [2, 5, 8, 10];
export const TEXT_SCALES = [1, 1.25, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.55 };   // safe areas + host back button; main.js keeps it current
// Minimum touch size: about 46 css px on any screen (host.px = css px per unit), never smaller than the design size.
export const tm = (v) => Math.max(v, 46 / Math.max(0.2, host.px));
const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const usable = (w, h) => { const u = { x0: host.l, y0: host.t, x1: w - host.r, y1: h - host.b }; u.w = u.x1 - u.x0; u.h = u.y1 - u.y0; return u; };

export function header(w, h, sc) {
  const u = usable(w, h), bh = tm(64), y = u.y0 + 10, tw = tm(68);
  const back = R(u.x0 + 12 + host.back, y, 150, bh);
  const inc = R(u.x1 - 12 - tw, y, tw, bh), dec = R(inc.x - 8 - tw, y, tw, bh);
  const colW = Math.min(980, u.w - 32), colX = u.x0 + (u.w - colW) / 2;
  const top = y + bh + 14;
  return { u, back, dec, inc, title: R(back.x + back.w + 12, y, dec.x - back.x - back.w - 24, bh), col: R(colX, top, colW, u.y1 - top - 10) };
}

export function titleLayout(w, h, hasSave, sc = 1) {
  const u = usable(w, h), land = w > h, k = Math.min(sc, 1.35);
  let hero, mx, mw, top, avail;
  if (land) {
    const heroW = u.w * 0.46; hero = R(u.x0, u.y0, heroW, u.h);
    mw = Math.min(520, u.x1 - (u.x0 + heroW) - 40); mx = u.x0 + heroW + (u.x1 - u.x0 - heroW - mw) / 2; top = u.y0 + 24; avail = u.h - 24 - 92;
  } else {
    const hh = clamp(u.h * 0.5, 340, 800); hero = R(u.x0, u.y0 + 6, u.w, hh);
    mw = Math.min(580, u.w - 48); mx = u.x0 + (u.w - mw) / 2; top = hero.y + hero.h + 8; avail = u.y1 - top - 96;
  }
  const rows = (hasSave ? 1 : 0) + 1 + 1 + 2, gap = 14;
  let bh = clamp(Math.floor((avail - gap * (rows - 1)) / rows), tm(56), Math.max(96 * k, tm(56)));
  const b = {}; let y = top;
  if (hasSave) { b.continue = R(mx, y, mw, bh); y += bh + gap; }
  b.play = R(mx, y, mw, bh); y += bh + gap;
  b.learn = R(mx, y, mw, bh); y += bh + gap;
  const hw = (mw - gap) / 2;
  b.howto = R(mx, y, hw, bh); b.rules = R(mx + hw + gap, y, hw, bh); y += bh + gap;
  b.about = R(mx, y, hw, bh); b.settings = R(mx + hw + gap, y, hw, bh);
  const title = land ? { x: hero.x + hero.w / 2, y: hero.y + hero.h * 0.8 } : { x: u.x0 + u.w / 2, y: hero.y + hero.h - 20 };
  return { mode: land ? 'land' : 'portrait', hero, buttons: b, brand: { x: land ? mx + mw / 2 : u.x0 + u.w / 2, y: u.y1 - 34 }, title, bh };
}

export function shelfLayout(w, h, sc, n) {
  const H = header(w, h, sc), col = H.col, gap = 16;
  const cols = clamp(Math.floor((col.w + gap) / (200 * Math.min(sc, 2) + gap)), 1, 5), cw = (col.w - gap * (cols - 1)) / cols;
  const ch = cw * 0.86 + 66 * Math.min(sc, 2.2) + 14 * sc;
  const cards = [];
  for (let i = 0; i < n; i++) cards.push(R(col.x + (i % cols) * (cw + gap), col.y + 6 + Math.floor(i / cols) * (ch + gap), cw, ch));
  return { ...H, body: R(col.x - 6, col.y, col.w + 12, col.h), cards, cols, cw, ch, contentH: 12 + Math.ceil(n / cols) * (ch + gap) };
}

// The bench is a window onto the world (vessel space, vessel centred at 500,500). The window follows the board rectangle, so tall phones show
// more bench above and below and wide screens show more to the sides; k (screen units per world unit) keeps the vessel big.
export const refOf = (N) => 640 + 14 * N;
const CENTER = 500;
const withWorld = (board, REF = 720) => { board.k = Math.min(board.w, board.h) / REF; board.vw = board.w / board.k; board.vh = board.h / board.k; board.vx0 = CENTER - board.vw / 2; board.vy0 = CENTER - board.vh / 2; return board; };
export const toWorld = (l, sx, sy) => ({ x: (sx - l.board.x) / l.board.k + l.board.vx0, y: (sy - l.board.y) / l.board.k + l.board.vy0 });
export const toScreen = (l, wx, wy) => ({ x: l.board.x + (wx - l.board.vx0) * l.board.k, y: l.board.y + (wy - l.board.vy0) * l.board.k });
export const visibleRect = (l, m = 0) => ({ x0: l.board.vx0 + m, y0: l.board.vy0 + m, x1: l.board.vx0 + l.board.vw - m, y1: l.board.vy0 + l.board.vh - m });

// While gilding the bench zooms in on the vessel so the cracks are as large as the screen allows (eased over 0.9 s).
export function zoomLayout(l, D, t) {
  const e = t >= 0.9 ? 1 : t <= 0 ? 0 : (1 - Math.cos((t / 0.9) * Math.PI)) / 2;
  if (e <= 0) return l;
  const b = l.board, k1 = Math.min(b.w, b.h) / (D * 1.14), k = b.k + (k1 - b.k) * e;
  return { ...l, board: { ...b, k, vw: b.w / k, vh: b.h / k, vx0: 500 - b.w / k / 2, vy0: 500 - b.h / k / 2 } };
}
export function playLayout(w, h, phase = 'assemble', N = 8) {
  const u = usable(w, h), land = w > h;
  const ps = tm(66), pause = R(u.x1 - 12 - ps, u.y0 + 8, ps, ps);
  if (!land) {
    const headH = Math.max(82, ps + 16), footMin = 214 + Math.max(0, tm(56) - 56);
    const bw = u.w - 20, bh = clamp(Math.min(u.h - headH - footMin - 14, bw * 1.55), 260, 2000);
    const board = withWorld({ x: u.x0 + (u.w - bw) / 2, y: u.y0 + headH, w: bw, h: bh }, refOf(N));
    const F = R(u.x0 + 12, board.y + bh + 12, u.w - 24, Math.max(40, u.y1 - (board.y + bh + 12) - 10));
    const btnH = clamp(F.h < 200 ? F.h : 88, tm(56), Math.max(92, tm(56))), by = F.y + F.h - btnH, bh2 = btnH;
    const n = phase === 'assemble' ? 4 : 1, bw2 = (F.w - 12 * (n - 1)) / n;
    const btn = {}; let bx = F.x;
    if (phase === 'assemble') { btn.rotl = R(bx, by, bw2, bh2); bx += bw2 + 12; btn.rotr = R(bx, by, bw2, bh2); bx += bw2 + 12; }
    btn.hint = R(bx, by, bw2, bh2); bx += bw2 + 12; if (phase === 'assemble') btn.guide = R(bx, by, bw2, bh2);
    const mid = R(F.x, F.y, F.w, F.h - bh2 - 12);
    const rs = Math.min(mid.h, mid.w * 0.42), ref = mid.h >= 110 ? R(mid.x, mid.y, rs, rs) : null;
    const status = ref ? R(ref.x + ref.w + 18, mid.y, mid.w - ref.w - 18, mid.h) : R(mid.x, mid.y, mid.w, Math.max(30, mid.h));
    const w4 = (F.w - 36) / 4, rail = { exit: R(F.x, by, w4, bh2), pause: R(F.x + w4 + 12, by, w4, bh2), dec: R(F.x + 2 * (w4 + 12), by, w4, bh2), inc: R(F.x + 3 * (w4 + 12), by, w4, bh2) };
    return { mode: 'portrait', board, pause, btn, rail, ref, status, head: R(u.x0 + 12 + host.back, u.y0 + 8, pause.x - (u.x0 + 12 + host.back) - 124, ps), F };
  }
  const PW = clamp(Math.round(u.w * 0.27), 250, 430), bh0 = u.h - 20, bw0 = u.w - PW - 44;
  const board = withWorld({ x: u.x0 + 10, y: u.y0 + 10, w: bw0, h: bh0 }, refOf(N));
  const P = R(board.x + bw0 + 22, u.y0 + 10, PW, u.h - 20);
  const pausePos = R(P.x + P.w - ps, P.y, ps, ps);
  const bh = clamp(Math.floor(P.h / 9), tm(56), Math.max(84, tm(56))), by = P.y + P.h - bh * 2 - 12;
  const btn = {}, bw = (PW - 12) / 2;
  if (phase === 'assemble') { btn.rotl = R(P.x, by, bw, bh); btn.rotr = R(P.x + bw + 12, by, bw, bh); btn.hint = R(P.x, by + bh + 12, bw, bh); btn.guide = R(P.x + bw + 12, by + bh + 12, bw, bh); }
  else { btn.hint = R(P.x, by, PW, bh * 2 + 12); }
  const mTop = P.y + 46 + ps, mH = by - 12 - mTop;
  const rs = Math.min(PW, mH * 0.55);
  const ref = mH > 150 ? R(P.x + (PW - rs) / 2, mTop, rs, rs) : null;
  const status = ref ? R(P.x, ref.y + ref.h + 10, PW, by - 12 - (ref.y + ref.h + 10)) : R(P.x, mTop, PW, mH);
  const rail = { exit: R(P.x, by, bw, bh), pause: R(P.x + bw + 12, by, bw, bh), dec: R(P.x, by + bh + 12, bw, bh), inc: R(P.x + bw + 12, by + bh + 12, bw, bh) };
  return { mode: 'land', board, pause: pausePos, btn, rail, ref, status, head: R(P.x, P.y, PW - ps - 10, ps), F: P };
}

export function docLayout(w, h, sc) {
  const H = header(w, h, sc), col = H.col, split = w > h * 1.25 && col.w > 820, fh = tm(72);
  const foot = R(col.x, col.y + col.h - fh, col.w, fh), body = R(col.x, col.y, col.w, col.h - fh - 12);
  const prev = R(foot.x, foot.y, 170, fh), next = R(foot.x + foot.w - 170, foot.y, 170, fh), count = R(prev.x + prev.w, foot.y, foot.w - 340, fh);
  const figW = split ? Math.min(body.w * 0.4, body.h) : 0;
  return { ...H, split, prev, next, count, body, text: split ? R(body.x + figW + 24, body.y, body.w - figW - 24, body.h) : body, fig: split ? R(body.x, body.y, figW, Math.min(body.h, figW)) : null };
}

export function settingsLayout(w, h, sc, n) {
  const H = header(w, h, sc), col = H.col, k = Math.min(sc, 2.4), rowH = 52 * k + 84 + (tm(64) - 64), rows = [];
  for (let i = 0; i < n; i++) { const r = R(col.x, col.y + 6 + i * (rowH + 12), col.w, rowH); rows.push({ rect: r, ctrl: R(r.x + 16, r.y + r.h - 16 - tm(64), r.w - 32, tm(64)) }); }
  return { ...H, body: R(col.x - 6, col.y, col.w + 12, col.h), rows, contentH: 12 + n * (rowH + 12) };
}

export function overLayout(w, h, sc) {
  const u = usable(w, h), land = w > h, bh = tm(72);
  const col = R(u.x0 + 16, u.y0 + 16, u.w - 32, u.h - 32 - bh - 14);
  const bw = Math.min(land ? 300 : (u.w - 32 - 24) / 3, 300), tot = bw * 3 + 24, bx = u.x0 + (u.w - tot) / 2, by = u.y1 - bh - 16;
  return { u, col, btns: { next: R(bx, by, bw, bh), menu: R(bx + bw + 12, by, bw, bh), share: R(bx + 2 * (bw + 12), by, bw, bh) }, land };
}

export function pauseLayout(w, h) {
  const hb = tm(78), u = usable(w, h), cw = Math.min(520, u.w - 40), ch = 4 * (hb + 14) + 70 + 14, card = R(u.x0 + (u.w - cw) / 2, u.y0 + Math.max(10, (u.h - ch) / 2), cw, ch);
  const mk = (i) => R(card.x + 20, card.y + 70 + 14 + i * (hb + 14), cw - 40, hb);
  return { card, resume: mk(0), restart: mk(1), settings: mk(2), menu: mk(3) };
}
