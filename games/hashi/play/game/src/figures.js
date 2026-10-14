// Pictures for the Rules, How to Play and About pages. They reuse the game's own island and bridge art, and the technique
// pictures are REAL positions: the first time the solver meets that technique while solving the built-in puzzles.
import { LIBRARY } from './library.js';
import { build, newState, nextStep, applyStep, explain, edgeBetween, humanSolve, solve, TECH_NAME } from './hashi.js';
import { boardGeo } from './layout.js';
import { drawArchipelago } from './art.js';
import { theme, rr, txt, setFont, mix, rgba, F } from './ui.js';

const exCache = new Map();
export function exampleFor(tech) {
  if (exCache.has(tech)) return exCache.get(tech);
  let found = null;
  for (let level = 1; level <= 5 && !found; level++) {
    for (const str of LIBRARY[level]) {
      const P = build(str), st = newState(P);
      for (let n = 0; n < 200 && !found; n++) {
        const step = nextStep(P, st);
        if (!step) break;
        if (step.tech === tech) { found = { P, st: { br: st.br.slice(), cap: st.cap.slice() }, step }; break; }
        applyStep(P, st, step);
      }
      if (found) break;
    }
  }
  exCache.set(tech, found);
  return found;
}

// Small hand-made pictures.
const TOY = '5x5:3...3/...../3.3.3/...../....1';
const link = (P, st, x1, y1, x2, y2, n) => { const e = edgeBetween(P, P.at[y1 * P.w + x1], P.at[y2 * P.w + x2]); if (e >= 0) st.br[e] = n; return e; };
function toySolved() {
  const P = build(TOY), st = newState(P);
  link(P, st, 0, 0, 4, 0, 2); link(P, st, 0, 0, 0, 2, 1); link(P, st, 4, 0, 4, 2, 1); link(P, st, 0, 2, 2, 2, 2); link(P, st, 2, 2, 4, 2, 1); link(P, st, 4, 2, 4, 4, 1);
  return { P, st };
}
const SAMPLE = LIBRARY[1][0];

const R2 = (r, dx, dy, w, h) => ({ x: r.x + dx, y: r.y + dy, w, h });
function board(ctx, r, P, st, o = {}) {
  const B = Math.min(r.w, r.h), g = boardGeo(r.x + (r.w - B) / 2, r.y + (r.h - B) / 2, B, P.w, P.h);
  drawArchipelago(ctx, g, P, st, { t: o.t ?? 0, calm: true, check: 'off', ...o });
  return g;
}
function legend(ctx, r, items) {
  const T = theme(), y = r.y + r.h - 24, sz = F(22);
  let total = 0;
  for (const [l] of items) { setFont(ctx, sz, 500); total += ctx.measureText(l).width + 56; }
  let x = r.x + (r.w - total) / 2;
  for (const [l, c] of items) {
    rr(ctx, x, y - 12, 24, 24, 6); ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = T.line; ctx.stroke();
    setFont(ctx, sz, 500); const w = ctx.measureText(l).width;
    txt(ctx, l, x + 34, y, { size: sz, weight: 500, color: T.dim });
    x += w + 56;
  }
}

export function drawFigure(ctx, r, name, t = 0) {
  const T = theme();
  if (!name) return;
  if (name === 'goal') {
    const P = build(SAMPLE), sol = solve(P);
    board(ctx, R2(r, 0, 0, r.w, r.h - 52), P, { br: sol, cap: P.ea.map(() => 2) }, { t });
    legend(ctx, r, [['Green: exactly its number', T.done]]);
    return;
  }
  if (name === 'cross') {
    const P = build('5x5:..1../...../1...1/...../..1..'), st = newState(P);
    const h = link(P, st, 0, 2, 4, 2, 1);
    const v = edgeBetween(P, P.at[0 * 5 + 2], P.at[4 * 5 + 2]);
    board(ctx, R2(r, 0, 0, r.w, r.h - 52), P, st, { t, lanes: new Map([[v, 'forbid']]), targets: new Set([v]) });
    legend(ctx, r, [['A lane that crosses a bridge is closed', T.err]]);
    return;
  }
  if (name === 'connect') {
    const P = build('7x3:2.2.1.1/......./.......'), st = newState(P);
    link(P, st, 0, 0, 2, 0, 2);
    const W = Math.min(r.w, 520), s = W / 7, x = r.x + (r.w - W) / 2, y = r.y + (r.h - 52 - s * 2.4) / 2;
    const geo = { x, y, size: W, s, cx: (ix) => x + (ix + 0.5) * s, cy: () => y + s * 1.2, rect: { x, y, w: W, h: s * 2.4 } };
    drawArchipelago(ctx, geo, P, st, { t, calm: true, check: 'off' });
    legend(ctx, r, [['Two full islands are cut off', T.err]]);
    return;
  }
  if (name === 'controls') {
    const gap = 12, pw = Math.min((r.w - 2 * gap) / 3, 260), P = build('3x1:2.2'), x0 = r.x + (r.w - (3 * pw + 2 * gap)) / 2, sh = pw * 0.5, y0 = r.y + Math.max(0, (r.h - sh - 70) / 2);
    ['Tap an island', 'Tap its neighbour', 'Tap again'].forEach((cap, k) => {
      const st = newState(P); st.br[0] = k;
      const x = x0 + k * (pw + gap), s = pw / 3;
      const geo = { x, y: y0, size: pw, s, cx: (ix) => x + (ix + 0.5) * s, cy: () => y0 + sh / 2, rect: { x, y: y0, w: pw, h: sh } };
      drawArchipelago(ctx, geo, P, st, { t, calm: true, check: 'off', sel: k === 0 ? 0 : -1, targets: k === 0 ? new Set([0]) : null });
      txt(ctx, ['None', 'Single', 'Double'][k], x + pw / 2, y0 + sh + 26, { size: F(24), weight: 700, color: T.text, align: 'center', maxW: pw, min: 12 });
      txt(ctx, cap, x + pw / 2, y0 + sh + 56, { size: F(20), weight: 400, color: T.dim, align: 'center', maxW: pw, min: 11 });
    });
    return;
  }
  if (name.startsWith('tech:')) {
    const id = name.slice(5), ex = exampleFor(id);
    if (!ex) return;
    const e = explain(ex.P, ex.st, ex.step), lanes = new Map(), ghost = new Map();
    for (const l of e.show.lanes) { if (l.kind === 'place') { ghost.set(l.e, (ex.step.place.find((p) => p.e === l.e)?.to) ?? 1); } else lanes.set(l.e, l.kind); }
    const st = { br: ex.st.br.slice(), cap: ex.st.cap.slice() };
    for (const [le] of ghost) st.br[le] = ex.st.br[le];
    const g = ghost.size ? new Map([...ghost].map(([le, n]) => [le, n])) : null;
    board(ctx, R2(r, 0, 0, r.w, r.h - 76), ex.P, st, { t, focus: new Set(e.show.focus), lanes, ghost: g });
    txt(ctx, `Real position: ${TECH_NAME(ex.step.tech)}`, r.x + r.w / 2, r.y + r.h - 54, { size: F(24), weight: 600, color: T.text, align: 'center', maxW: r.w });
    legend(ctx, R2(r, 0, 28, r.w, r.h), lanes.size && !ghost.size ? [['Look here', '#3fe0b8'], ['Closed', T.err]] : [['Look here', '#3fe0b8'], ['Bridge to build', mix('#3fe0b8', T.plank, 0.4)]]);
  }
}
export function figureAspect() { return 1; }
