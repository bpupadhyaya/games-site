// Geometry as a function of the LIVE screen size (kit fluid viewport: the short side is always 720 units, the long side follows the screen).
// layoutFor(w, h) is cached per size and returns every rectangle the game screen needs. Three shapes:
//   wide     landscape (width >= 1.3 x height): a status card on the left, the board in the middle, buttons and moves on the right.
//   tall     portrait phone (height >= 1.75 x width): players on top, the board, a coach card and two rows of buttons.
//   compact  everything in between (tablets, windows): players and one line of coach text on top, the board, one button row.
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const R = (x, y, w, h) => ({ x, y, w, h });
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Safe areas and the host's floating back button, in virtual units (main.js keeps this current; browsers: zeros).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };      // px: css px per virtual unit

const cache = new Map();
export function layoutFor(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }); L.key = key; cache.set(key, L); if (cache.size > 30) cache.delete(cache.keys().next().value); }
  return L;
}

function build(w, h, ins) {
  const ratio = w / h, wide = ratio >= 1.6, side = !wide && ratio >= 1.15, tall = !wide && !side && h >= w * 1.75, mode = wide ? 'wide' : side ? 'side' : tall ? 'tall' : 'compact';
  const L = { w, h, wide, side, tall, mode, ins };
  const U = L.U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b };
  U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const backSz = ins.back ? Math.max(ins.back, 56) + 8 : 0;
  L.backBox = ins.back ? R(ins.l, ins.t, backSz, backSz) : R(0, 0, 0, 0);
  const pad = 12, bh = 84, topY = Math.max(ins.t + 6, 14);
  L.pad = pad;

  // ---- play screen ----
  const P = L.play = { mode };
  const pill = 36;                                                      // the kit's "Preview 0:59" pill sits at the top centre
  L.pill = pill;
  if (wide) {
    const sideMin = 200, top = U.y0 + pill, availH = U.y1 - top - pad;
    const S = clamp(Math.min(availH - pad, U.w - 2 * sideMin - 4 * pad), 200, 1200);
    const bx = U.x0 + (U.w - S) / 2, by = top + (availH - S) / 2 + pad / 2;
    P.board = R(bx, by, S, S);
    const lw = bx - U.x0 - 2 * pad, rw = U.x1 - (bx + S) - 2 * pad;
    const lt = Math.max(U.y0 + pad, ins.back ? L.backBox.y + L.backBox.h + 4 : 0);
    P.left = R(U.x0 + pad, lt, lw, U.y1 - pad - lt);
    P.right = R(bx + S + pad * 2, U.y0 + pad, rw, U.h - 2 * pad);
    const ph = Math.min(150, P.left.h * 0.2);
    P.players = [R(P.left.x, P.left.y, P.left.w, ph), R(P.left.x, P.left.y + ph + 10, P.left.w, ph)];
    const cy = P.players[1].y + P.players[1].h + 10;
    P.coach = R(P.left.x, cy, P.left.w, P.left.y + P.left.h - cy);
    P.btnArea = R(P.right.x, P.right.y, P.right.w, P.right.h);
    P.vertical = true;
    P.history = null;                                                   // filled in below once the buttons are placed
  } else if (side) {
    const top = Math.max(U.y0 + pill, ins.back ? L.backBox.y + L.backBox.h + 2 : 0), availH = U.y1 - top - pad, gap = 10;
    const S = clamp(Math.min(availH - pad, U.w - 300 - 3 * pad), 220, 1200);
    const bx = U.x0 + pad, by = top + (availH - S) / 2 + pad / 2;
    P.board = R(bx, by, S, S);
    const px = bx + S + pad, pw = U.x1 - px - pad, lt = Math.max(U.y0 + pad, ins.back ? L.backBox.y + L.backBox.h + 4 : 0), ph = U.y1 - pad - lt;
    const hud = clamp(ph * 0.12, 84, 120), two = pw >= 380;
    if (two) { const w2 = (pw - gap) / 2; P.players = [R(px, lt, w2, hud), R(px + w2 + gap, lt, w2, hud)]; }
    else P.players = [R(px, lt, pw, hud), R(px, lt + hud + gap, pw, hud)];
    const ytop = (two ? lt + hud : lt + 2 * hud + gap) + gap;
    const rowsH = 2 * 76 + gap;
    P.btnArea = R(px, U.y1 - pad - rowsH, pw, rowsH); P.grid = true;
    const free = P.btnArea.y - gap - ytop, coachH = free >= 420 ? Math.min(free * 0.55, 300) : free;
    P.coach = R(px, ytop, pw, coachH);
    P.history = free >= 420 ? R(px, ytop + coachH + gap, pw, free - coachH - gap) : null;
  } else {
    const gap = 10, btnRows = tall ? 2 : 1, slim = ratio > 0.8 && ratio < 1.15;       // near-square windows: slimmer furniture, bigger board
    const hud = tall ? 104 : slim ? 66 : 88, coachMin = tall ? 120 : slim ? 54 : 84;
    const rowsH = btnRows * (slim ? 66 : bh) + (btnRows - 1) * gap, bottomPad = Math.max(14, ins.b + 8);
    const y0 = Math.max(topY + pill, ins.back ? L.backBox.y + L.backBox.h + 2 : 0);
    const avail = U.y1 - y0 - hud - gap - coachMin - gap - rowsH - gap - bottomPad;
    const S = clamp(Math.min(U.w - 2 * pad, avail), 220, 1400);
    const cx = U.x0 + U.w / 2, cw = U.w - 2 * pad;
    let spare = Math.max(0, avail - S);                                // vertical room the board could not use (tall phones)
    let coachH = coachMin, histH = 0;
    if (tall) { const c = Math.min(spare * 0.35, 90); coachH += c; spare -= c; if (spare > 150) { histH = Math.min(spare * 0.7, 260); spare -= histH; } }
    const lead = Math.min(spare * 0.5, 40) , yTop = y0 + lead;
    const pw = (cw - gap) / 2;
    P.players = [R(cx - cw / 2, yTop, pw, hud), R(cx - cw / 2 + pw + gap, yTop, pw, hud)];
    P.board = R(cx - S / 2, yTop + hud + gap, S, S);
    P.coach = R(cx - cw / 2, P.board.y + S + gap, cw, coachH);
    P.btnArea = R(cx - cw / 2, U.y1 - bottomPad - rowsH, cw, rowsH);
    P.rows = btnRows;
    const free = P.btnArea.y - gap - (P.coach.y + P.coach.h);
    if (histH > 0 && free >= 80) P.history = R(cx - cw / 2, P.coach.y + P.coach.h + gap, cw, Math.min(histH + Math.max(0, free - histH) , free)); else { P.history = null; if (free > 0) { P.coach.h += free; } }
  }
  // button slots: k buttons laid inside btnArea
  P.buttons = (k) => {
    const A = P.btnArea, out = [];
    if (P.vertical) {
      const gap = 12, bw = Math.min(A.w, 320), x = A.x + (A.w - bw) / 2;
      // the right panel: buttons stacked from the top, kept <= 92 high
      const bhh = clamp((A.h * 0.5 - gap * (k - 1)) / k, 56, 92);
      for (let i = 0; i < k; i++) out.push(R(x, A.y + 8 + i * (bhh + gap), bw, bhh));
      const yEnd = A.y + 8 + k * (bhh + gap);
      P.history = A.y + A.h - yEnd >= 150 ? R(A.x, yEnd + 6, A.w, A.y + A.h - yEnd - 6) : null;
      return out;
    }
    if (P.grid) { const gap = 10, rows = Math.ceil(k / 2), rh = (A.h - (rows - 1) * gap) / rows; for (let i = 0; i < k; i++) { const c = i % 2, r = Math.floor(i / 2), inRow = Math.min(2, k - r * 2), bw = (A.w - (inRow - 1) * gap) / inRow; out.push(R(A.x + c * (bw + gap), A.y + r * (rh + gap), bw, rh)); } return out; }
    const gap = 10, rows = P.rows > 1 && k > 2 ? 2 : 1, per = Math.ceil(k / rows), rh = (A.h - (rows - 1) * gap) / rows;
    for (let i = 0; i < k; i++) { const r = Math.floor(i / per), c = i % per, inRow = Math.min(per, k - r * per), bw = (A.w - (inRow - 1) * gap) / inRow; out.push(R(A.x + c * (bw + gap), A.y + r * (rh + gap), bw, rh)); }
    return out;
  };

  // ---- menu-like screens: hero art + a card of buttons ----
  const M = L.menu = {};
  L.split = (wide || side) && U.w >= 820;
  if (L.split) {
    const cw = clamp(U.w * 0.4, 400, 620), x = U.x1 - cw - pad - 8;
    M.card = R(x, U.y0 + pad, cw, U.h - 2 * pad);
    M.hero = R(U.x0 + pad, U.y0 + pad, x - U.x0 - 2 * pad, U.h - 2 * pad);
  } else {
    const cw = Math.min(U.w - 2 * pad - 16, 640), ch = clamp(Math.min(U.h * 0.5, 470), 360, 900), cx = U.x0 + (U.w - cw) / 2;
    M.card = R(cx, U.y1 - ch - Math.max(8, ins.b), cw, ch);
    M.hero = R(U.x0 + pad, U.y0 + pad, U.w - 2 * pad, M.card.y - U.y0 - 2 * pad);
  }
  // a full-screen panel (readers, settings, result): centred card with a nav bar under it
  const pw = L.split ? clamp(U.w * 0.5, 540, 900) : Math.min(U.w - 2 * pad - 8, 900), px = L.split ? U.x1 - pad - 8 - pw : U.x0 + (U.w - pw) / 2;
  const py = Math.max(U.y0 + pad, ins.back && !L.split ? L.backBox.y + L.backBox.h + 2 : U.y0 + pad), navH = 76, navY = U.y1 - Math.max(10, ins.b + 4) - navH;
  L.page = { panel: R(px, py, pw, navY - 10 - py), nav: R(px, navY, pw, navH), art: L.split ? R(U.x0 + pad, U.y0 + pad, px - U.x0 - 2 * pad, U.h - 2 * pad) : null };
  L.cell = (n) => { const S = P.board.w, m = n > 15 ? 0.056 : 0.062; return { x0: P.board.x + S * m, y0: P.board.y + S * m, cell: (S * (1 - 2 * m)) / (n - 1) }; };
  return L;
}
