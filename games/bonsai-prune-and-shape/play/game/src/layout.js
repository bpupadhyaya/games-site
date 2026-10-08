// Geometry as a pure function of the LIVE screen size (kit fluid viewport: the short side is 720 units, the long side follows the screen).
// Render and hit-testing read the same rects, so what is drawn is what is tapped.
export const THINK_STEPS = [2, 5, 8, 10];
export const TEXT_SCALES = [1, 1.25, 1.5, 2, 2.5, 3];
export const SPEEDS = [1, 2, 4];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.55 };   // safe areas + host back button; main.js keeps it current
// minimum tap size: 44 CSS px expressed in layout units (the layout is 720 units on the short side, so a 360 px phone needs 88)
export const mt = () => 44 / Math.max(0.2, host.px);
const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const usable = (w, h) => { const u = { x0: host.l, y0: host.t, x1: w - host.r, y1: h - host.b }; u.w = u.x1 - u.x0; u.h = u.y1 - u.y0; return u; };

export function header(w, h) {
  const u = usable(w, h), bh = Math.max(64, mt()), bw = Math.max(68, mt()), y = u.y0 + 10;
  const back = R(u.x0 + 12 + host.back, y, Math.max(150, mt() * 1.7), bh);
  const inc = R(u.x1 - 12 - bw, y, bw, bh), dec = R(inc.x - 8 - bw, y, bw, bh);
  const colW = Math.min(980, u.w - 32), colX = u.x0 + (u.w - colW) / 2;
  const top = y + bh + 14;
  return { u, back, dec, inc, title: R(back.x + back.w + 12, y, dec.x - back.x - back.w - 24, bh), col: R(colX, top, colW, u.y1 - top - 10) };
}

export function titleLayout(w, h, hasSave, sc = 1) {
  const u = usable(w, h), land = w > h, k = Math.min(sc, 1.35);
  let hero, mx, mw, top, avail;
  if (land) {
    const heroW = u.w * 0.5; hero = R(u.x0, u.y0, heroW, u.h);
    mw = Math.min(520, u.x1 - (u.x0 + heroW) - 40); mx = u.x0 + heroW + (u.x1 - u.x0 - heroW - mw) / 2; top = u.y0 + 20; avail = u.h - 20 - 66;
  } else {
    const hh = clamp(u.h * 0.46, 330, 780); hero = R(u.x0, u.y0 + 4, u.w, hh);
    mw = Math.min(580, u.w - 48); mx = u.x0 + (u.w - mw) / 2; top = hero.y + hero.h + 4; avail = u.y1 - top - 70;
  }
  const rows = (hasSave ? 1 : 0) + 2 + 3, gap = 12;
  const bh = clamp(Math.floor((avail - gap * (rows - 1)) / rows), Math.max(52, mt()), Math.max(92 * k, mt()));
  const b = {}; let y = top;
  if (hasSave) { b.continue = R(mx, y, mw, bh); y += bh + gap; }
  b.play = R(mx, y, mw, bh); y += bh + gap;
  b.learn = R(mx, y, mw, bh); y += bh + gap;
  const hw = (mw - gap) / 2;
  b.howto = R(mx, y, hw, bh); b.rules = R(mx + hw + gap, y, hw, bh); y += bh + gap;
  b.lessons = R(mx, y, hw, bh); b.about = R(mx + hw + gap, y, hw, bh); y += bh + gap;
  b.settings = R(mx, y, mw, bh);
  return { mode: land ? 'land' : 'portrait', hero, buttons: b, brand: { x: land ? mx + mw / 2 : u.x0 + u.w / 2, y: u.y1 - 24 }, bh };
}

export function shelfLayout(w, h, sc, n) {
  const H = header(w, h), col = H.col, gap = 16;
  const cols = clamp(Math.floor((col.w + gap) / (230 * Math.min(sc, 2) + gap)), 1, 4), cw = (col.w - gap * (cols - 1)) / cols;
  const ch = cw * 1.0 + 76 * Math.min(sc, 2.2) + 12 * sc;
  const cards = [];
  for (let i = 0; i < n; i++) cards.push(R(col.x + (i % cols) * (cw + gap), col.y + 6 + Math.floor(i / cols) * (ch + gap), cw, ch));
  return { ...H, body: R(col.x - 6, col.y, col.w + 12, col.h), cards, cols, cw, ch, contentH: 12 + Math.ceil(n / cols) * (ch + gap) };
}

export function playLayout(w, h, auto = false) {
  const u = usable(w, h), land = w > h;
  const pp = Math.max(66, mt()), pause = R(u.x1 - 12 - pp, u.y0 + 8, pp, pp);
  if (!land) {
    const headH = Math.max(84, pp + 16), footH = clamp(Math.round(u.h * 0.3), 270, 340);
    const bw = u.w - 20, bh = u.h - headH - footH - 12;
    const board = R(u.x0 + 10, u.y0 + headH, bw, bh);
    const F = R(u.x0 + 12, board.y + bh + 10, u.w - 24, footH - 12);
    const bh1 = clamp((F.h - 16) * 0.36, Math.max(58, mt()), Math.max(92, mt())), bh2 = clamp((F.h - 16) * 0.28, Math.max(50, mt()), Math.max(76, mt())), y2 = F.y + F.h - bh2, y1 = y2 - 10 - bh1;
    const sw = (F.w - 36) / 4, btn = { snip: R(F.x, y1, sw, bh1), pinch: R(F.x + (sw + 12), y1, sw, bh1), wire: R(F.x + 2 * (sw + 12), y1, sw, bh1), hint: R(F.x + 3 * (sw + 12), y1, sw, bh1) };
    const hw = (F.w - 12) / 2; btn.speed = R(F.x, y2, hw, bh2); btn.present = R(F.x + hw + 12, y2, hw, bh2);
    const stH = Math.max(40, y1 - 8 - F.y), dial = R(F.x, F.y, Math.min(stH, 120), Math.min(stH, 120));
    const status = R(F.x + dial.w + 14, F.y, F.w - dial.w - 14, stH);
    const rail = { exit: R(F.x, y1, sw, bh1), pause: R(F.x + (sw + 12), y1, sw, bh1), dec: R(F.x + 2 * (sw + 12), y1, sw, bh1), inc: R(F.x + 3 * (sw + 12), y1, sw, bh1) };
    return { mode: 'portrait', board, pause, btn, rail, dial, status, head: R(u.x0 + 12 + host.back, u.y0 + 8, pause.x - (u.x0 + 12 + host.back) - 10, pp), F, auto };
  }
  const PW = clamp(Math.round(u.w * 0.31), 270, 440), board = R(u.x0 + 10, u.y0 + 10, u.w - PW - 44, u.h - 20);
  const P = R(board.x + board.w + 22, u.y0 + 10, PW, u.h - 20);
  const pausePos = R(P.x + P.w - pp, P.y, pp, pp);
  const bh = clamp(Math.floor(P.h / 10), Math.max(54, mt()), Math.max(80, mt())), by = P.y + P.h - bh * 3 - 24, bw = (PW - 12) / 2;
  const btn = { snip: R(P.x, by, bw, bh), pinch: R(P.x + bw + 12, by, bw, bh), wire: R(P.x, by + bh + 12, bw, bh), hint: R(P.x + bw + 12, by + bh + 12, bw, bh), speed: R(P.x, by + 2 * (bh + 12), bw, bh), present: R(P.x + bw + 12, by + 2 * (bh + 12), bw, bh) };
  const dial = R(P.x, P.y + pp + 20, Math.min(110, PW * 0.34), Math.min(110, PW * 0.34));
  const status = R(P.x + dial.w + 12, P.y + pp + 20, PW - dial.w - 12, by - 12 - (P.y + pp + 20));
  const rail = { exit: R(P.x, by, bw, bh), pause: R(P.x + bw + 12, by, bw, bh), dec: R(P.x, by + bh + 12, bw, bh), inc: R(P.x + bw + 12, by + bh + 12, bw, bh) };
  return { mode: 'land', board, pause: pausePos, btn, rail, dial, status, head: R(P.x, P.y, PW - pp - 10, pp), F: P, auto };
}

export function docLayout(w, h, sc) {
  const H = header(w, h), col = H.col, split = w > h * 1.25 && col.w > 820, fh = Math.max(72, mt());
  const foot = R(col.x, col.y + col.h - fh, col.w, fh), body = R(col.x, col.y, col.w, col.h - fh - 12);
  const prev = R(foot.x, foot.y, 170, fh), next = R(foot.x + foot.w - 170, foot.y, 170, fh), count = R(prev.x + prev.w, foot.y, foot.w - 340, fh);
  const figW = split ? Math.min(body.w * 0.4, body.h) : 0;
  void sc;
  return { ...H, split, prev, next, count, body, text: split ? R(body.x + figW + 24, body.y, body.w - figW - 24, body.h) : body, fig: split ? R(body.x, body.y, figW, Math.min(body.h, figW)) : null };
}

export function settingsLayout(w, h, sc, n) {
  const H = header(w, h), col = H.col, k = Math.min(sc, 2.4), cth = Math.max(64, mt()), rowH = 52 * k + 20 + cth, rows = [];
  for (let i = 0; i < n; i++) { const r = R(col.x, col.y + 6 + i * (rowH + 12), col.w, rowH); rows.push({ rect: r, ctrl: R(r.x + 16, r.y + r.h - 16 - cth, r.w - 32, cth) }); }
  return { ...H, body: R(col.x - 6, col.y, col.w + 12, col.h), rows, contentH: 12 + n * (rowH + 12) };
}

export function pauseLayout(w, h) {
  const u = usable(w, h), rh = Math.max(78, mt()), cw = Math.min(520, u.w - 40), ch = 4 * rh + 5 * 14 + 70, card = R(u.x0 + (u.w - cw) / 2, u.y0 + Math.max(10, (u.h - ch) / 2), cw, ch);
  const mk = (i) => R(card.x + 20, card.y + 70 + 14 + i * (rh + 14), cw - 40, rh);
  return { card, resume: mk(0), restart: mk(1), settings: mk(2), menu: mk(3) };
}

// Brief card shown before a tree starts.
export function briefLayout(w, h, sc = 1) {
  const u = usable(w, h), cw = Math.min(720, u.w - 32), x = u.x0 + (u.w - cw) / 2, ch = clamp(u.h - 40, 360, 760), y = u.y0 + (u.h - ch) / 2;
  const card = R(x, y, cw, ch), bh = Math.max(76, mt());
  void sc;
  return { card, begin: R(x + 24, y + ch - bh - 22, cw - 48 - 188, bh), back: R(x + cw - 24 - 176, y + ch - bh - 22, 176, bh), body: R(x + 28, y + 28, cw - 56, ch - bh - 70) };
}

// Pot choice: the tree on show above, a grid of pots below (portrait) or beside (landscape).
export function potLayout(w, h) {
  const H = header(w, h), u = H.u, land = w > h;
  const n = 6;
  if (!land) {
    const gh = clamp(Math.round(u.h * 0.27), 210, 340), bw = u.w - 24, boardTop = H.col.y;
    const goH0 = Math.max(68, mt()), boardH = u.y1 - gh - 22 - goH0 - boardTop;
    const board = R(u.x0 + 12, boardTop, bw, boardH), gy = board.y + boardH + 10, cols = 3, rows = 2, gap = 10;
    const cw = (bw - gap * (cols - 1)) / cols, ch = (gh - gap) / rows, cards = [];
    for (let i = 0; i < n; i++) cards.push(R(board.x + (i % cols) * (cw + gap), gy + Math.floor(i / cols) * (ch + gap), cw, ch));
    return { ...H, land, board, cards, go: R(board.x, u.y1 - 10 - goH0, bw, goH0) };
  }
  const PW = clamp(Math.round(u.w * 0.38), 300, 520), board = R(u.x0 + 12, H.col.y, u.w - PW - 36, u.y1 - H.col.y - 10);
  const px = board.x + board.w + 12, gap = 10, cw = (PW - gap) / 2, goH = Math.max(70, mt()), ch = (u.y1 - H.col.y - goH - 28 - gap * 2) / 3, cards = [];
  for (let i = 0; i < n; i++) cards.push(R(px + (i % 2) * (cw + gap), H.col.y + Math.floor(i / 2) * (ch + gap), cw, ch));
  return { ...H, land, board, cards, go: R(px, u.y1 - goH - 10, PW, goH) };
}

// Judging view: hero (the tree on its stand) + a scrolling column of scores.
export function overLayout(w, h) {
  const u = usable(w, h), land = w > h, bh = Math.max(72, mt());
  const btnY = u.y1 - bh - 14;
  const bw = Math.min(land ? 280 : (u.w - 32 - 24) / 3, 280), tot = bw * 3 + 24, bx = u.x0 + (u.w - tot) / 2;
  const btns = { next: R(bx, btnY, bw, bh), menu: R(bx + bw + 12, btnY, bw, bh), share: R(bx + 2 * (bw + 12), btnY, bw, bh) };
  if (land) {
    const hero = R(u.x0 + 12, u.y0 + 12, u.w * 0.44, u.h - 24), col = R(hero.x + hero.w + 24, u.y0 + 12, u.x1 - (hero.x + hero.w + 24) - 12, u.h - 24 - bh - 24);
    const lb = { next: R(col.x, btnY, (col.w - 24) / 3, bh), menu: R(col.x + (col.w - 24) / 3 + 12, btnY, (col.w - 24) / 3, bh), share: R(col.x + 2 * ((col.w - 24) / 3 + 12), btnY, (col.w - 24) / 3, bh) };
    return { u, land, hero, col, btns: lb };
  }
  const hh = clamp(u.h * 0.36, 260, 640), hero = R(u.x0 + 12, u.y0 + 12, u.w - 24, hh), col = R(u.x0 + 16, hero.y + hh + 6, u.w - 32, btnY - (hero.y + hh + 6) - 10);
  return { u, land, hero, col, btns };
}
