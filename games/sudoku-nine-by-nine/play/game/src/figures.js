// Pictures for the Rules, How to Play and About pages. They reuse the game's own tile drawing, and the technique
// pictures are REAL positions: the first time the solver meets that technique while solving the built-in puzzles.
import { LIBRARY } from './library.js';
import { stateFrom, nextStep, applyStep, fromStr, explain, digitsOf, bit, HOUSES, HOUSES_OF, rowOf, colOf, boxOf, TECH_NAME } from './sudoku.js';
import { theme, tile, rr, txt, setFont, mix, rgba, icons, F, UI } from './ui.js';

const exCache = new Map();
export function exampleFor(tech) {
  if (exCache.has(tech)) return exCache.get(tech);
  let found = null;
  for (let level = 1; level <= 5 && !found; level++) {
    for (const p of LIBRARY[level]) {
      const S = stateFrom(fromStr(p));
      for (let n = 0; n < 140 && !found; n++) {
        const st = nextStep(S);
        if (!st) break;
        if (st.tech === tech) { found = { S: { v: S.v.slice(), c: S.c.slice() }, st }; break; }
        applyStep(S, st);
      }
      if (found) break;
    }
  }
  exCache.set(tech, found);
  return found;
}

// A small flat board. marks: { cell: kind }, kinds focus | seen | elim | place | house. cand: candidate masks to print in marked cells.
export function miniBoard(ctx, r, S, marks, { cand = null, pat = 0, elimMask = null } = {}) {
  const T = theme(), B = Math.min(r.w, r.h), x0 = r.x + (r.w - B) / 2, y0 = r.y + (r.h - B) / 2, cs = B / 9;
  rr(ctx, x0 - 6, y0 - 6, B + 12, B + 12, 14); ctx.fillStyle = T.tray; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = T.rim; ctx.stroke();
  const col = { house: mix(T.tile, T.peer, 0.9), seen: mix(T.tile, '#6aa9ff', 0.45), focus: mix(T.tile, '#25c2a0', 0.5), elim: T.errTint, place: mix(T.tile, T.good, 0.55) };
  for (let i = 0; i < 81; i++) {
    const cx = x0 + colOf(i) * cs, cy = y0 + rowOf(i) * cs, k = marks[i];
    rr(ctx, cx + 1, cy + 1, cs - 2, cs - 2, cs * 0.14); ctx.fillStyle = k ? col[k] : T.tile; ctx.fill();
    const v = S.v[i];
    if (v && !(k === 'place')) txt(ctx, v, cx + cs / 2, cy + cs / 2 + 1, { size: cs * 0.6, weight: 600, color: k ? T.given : mix(T.given, T.tile, 0.35), align: 'center' });
    else if (k === 'place' && v) txt(ctx, v, cx + cs / 2, cy + cs / 2 + 1, { size: cs * 0.6, weight: 700, color: T.good, align: 'center' });
    else if (!v && cand && (k === 'focus' || k === 'elim' || k === 'place' || k === 'seen') && S.c[i]) {
      for (const d of digitsOf(S.c[i])) {
        const px = cx + cs * (0.19 + 0.31 * ((d - 1) % 3)), py = cy + cs * (0.21 + 0.31 * Math.floor((d - 1) / 3));
        const gone = elimMask && k === 'elim' && (elimMask[i] & bit(d)), inPat = pat & bit(d);
        txt(ctx, d, px, py, { size: cs * 0.33, weight: 700, color: gone ? T.err : inPat ? mix('#0a7a64', T.given, 0.2) : mix(T.given, T.tile, 0.4), align: 'center' });
        if (gone) { ctx.beginPath(); ctx.moveTo(px - cs * 0.1, py - cs * 0.1); ctx.lineTo(px + cs * 0.1, py + cs * 0.1); ctx.lineWidth = 1.8; ctx.strokeStyle = T.err; ctx.stroke(); }
      }
    }
  }
  ctx.strokeStyle = rgba('#000000', 0.5); ctx.lineWidth = 2.4;
  for (let k = 0; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(x0 + k * cs * 3, y0); ctx.lineTo(x0 + k * cs * 3, y0 + B); ctx.moveTo(x0, y0 + k * cs * 3); ctx.lineTo(x0 + B, y0 + k * cs * 3); ctx.stroke(); }
  return B;
}

const SAMPLE = '534678912672195348198342567859761423426853791713924856961537284287419635345286179';
export function figureAspect() { return 1; }

export function drawFigure(ctx, r, name, t = 0) {
  const T = theme();
  if (!name) return;
  const S = { v: Array.from(SAMPLE, Number), c: new Array(81).fill(0) };
  if (name === 'houses') {
    const marks = {};
    for (const c of HOUSES[2]) marks[c] = 'house';
    for (const c of HOUSES[9 + 5]) marks[c] = 'seen';
    for (const c of HOUSES[18 + 4]) marks[c] = 'focus';
    const B = miniBoard(ctx, R2(r, 0, 0, r.w, r.h - 52), S, marks);
    legend(ctx, r, [['Row', mix(T.tile, T.peer, 0.9)], ['Column', mix(T.tile, '#6aa9ff', 0.45)], ['Box', mix(T.tile, '#25c2a0', 0.5)]]);
    return;
  }
  if (name === 'conflict') {
    const v = Array.from(SAMPLE, Number); v[1] = 5; const S2 = { v, c: S.c }, marks = { 1: 'elim', 0: 'elim' };
    miniBoard(ctx, R2(r, 0, 0, r.w, r.h - 52), S2, marks);
    legend(ctx, r, [['Same digit twice in a house', T.errTint]]);
    return;
  }
  if (name === 'notes') {
    const B = Math.min(r.w, r.h - 20), x = r.x + (r.w - B) / 2, s = B / 2.2;
    for (let k = 0; k < 2; k++) {
      const tx = x + k * (s * 1.2), ty = r.y + (r.h - s) / 2;
      const f = tile(ctx, tx, ty, s, T.tile, T.side, 0);
      if (k === 0) for (const d of [1, 2, 4, 5, 8]) txt(ctx, d, f.x + f.w * (0.2 + 0.3 * ((d - 1) % 3)), f.y + f.h * (0.2 + 0.3 * Math.floor((d - 1) / 3)), { size: s * 0.24, weight: 500, color: T.note, align: 'center' });
      else txt(ctx, 5, f.x + f.w / 2, f.y + f.h / 2 + 2, { size: s * 0.64, weight: 600, color: T.entry, align: 'center' });
    }
    return;
  }
  if (name === 'pad') {
    const gap = 10, kw = Math.min((r.w - 2 * gap) / 3, (r.h - 2 * gap) / 3, 120), w3 = kw * 3 + 2 * gap, x = r.x + (r.w - w3) / 2, y = r.y + (r.h - w3) / 2;
    for (let i = 0; i < 9; i++) {
      const kx = x + (i % 3) * (kw + gap), ky = y + Math.floor(i / 3) * (kw + gap), f = tile(ctx, kx, ky, kw, T.tile, T.side, 0);
      txt(ctx, i + 1, f.x + f.w / 2, f.y + f.h / 2 + 2, { size: kw * 0.5, weight: 700, color: T.entry, align: 'center' });
    }
    return;
  }
  if (name.startsWith('tech:')) {
    const id = name.slice(5), ex = exampleFor(id);
    if (!ex) return;
    const e = explain(ex.S, ex.st), marks = {}, sh = e.show;
    for (const h of sh.houses) for (const c of HOUSES[h]) marks[c] = 'house';
    for (const c of sh.seen) marks[c] = 'seen';
    for (const c of sh.focus) marks[c] = 'focus';
    const elimMask = new Array(81).fill(0);
    for (const el of sh.elim) { marks[el.cell] = 'elim'; elimMask[el.cell] = el.mask; }
    if (sh.place) marks[sh.place.cell] = 'place';
    const pat = (ex.st.digits ?? (ex.st.digit ? [ex.st.digit] : [])).reduce((m, d) => m | bit(d), 0);
    const S2 = { v: ex.S.v.slice(), c: ex.S.c.slice() };
    if (sh.place) { S2.v[sh.place.cell] = sh.place.digit; }
    const B = miniBoard(ctx, R2(r, 0, 0, r.w, r.h - 76), S2, marks, { cand: true, pat, elimMask });
    setFont(ctx, F(22), 500);
    txt(ctx, `Real position: ${TECH_NAME(ex.st.tech)}`, r.x + r.w / 2, r.y + r.h - 54, { size: F(24), weight: 600, color: T.text, align: 'center', maxW: r.w });
    legend(ctx, R2(r, 0, 28, r.w, r.h), sh.elim.length ? [['Pattern', mix(T.tile, '#25c2a0', 0.5)], ['Remove', T.errTint]] : [['Where to look', mix(T.tile, '#25c2a0', 0.5)], ['Answer', mix(T.tile, T.good, 0.55)]]);
  }
}
const R2 = (r, dx, dy, w, h) => ({ x: r.x + dx, y: r.y + dy, w, h });
function legend(ctx, r, items) {
  const T = theme(), y = r.y + r.h - 24;
  let total = 0; const sz = F(22);
  for (const [l] of items) { setFont(ctx, sz, 500); total += ctx.measureText(l).width + 56; }
  let x = r.x + (r.w - total) / 2;
  for (const [l, c] of items) {
    rr(ctx, x, y - 12, 24, 24, 6); ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = T.line; ctx.stroke();
    setFont(ctx, sz, 500); const w = ctx.measureText(l).width;
    txt(ctx, l, x + 34, y, { size: sz, weight: 500, color: T.dim });
    x += w + 56;
  }
}
