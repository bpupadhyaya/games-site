// Small illustrations for documents (rules, how to play, lessons, cards). They reuse the real board drawing code.
import { buildBoard, arcCurve, loopsOf } from './board.js';
import { boardGeo, drawRings, drawDots, drawMarks, drawMarkGlyph, linePath, powder, patternSeq, drawPattern } from './boardview.js';
import { star, icon, text, alpha, rr } from './art.js';
import { puzzleById, lessonPuzzle } from './puzzles.js';
import { LESSON_TEXT } from './content.js';
import { dotsOf } from './shapes.js';

const boards = {};
const board = (key, lat, shape) => (boards[key] ??= buildBoard({ lat, dots: dotsOf(shape) }));

function states(B, fill) { return new Int8Array(B.gates.length).fill(fill); }

function fitGeo(B, r, pad = 14) { return boardGeo(B, { x: r.x, y: r.y, w: r.w, h: r.h }, pad); }

// every arc of a board with the given gate states, as separate coloured loops
function drawLoops(ctx, th, B, g, st, w, colors) {
  const loops = loopsOf(B, st);
  loops.forEach((loop, i) => {
    const seq = loop.map((arc) => ({ arc, dir: 0, c: arcCurve(B, B.arcs[arc], st[B.arcs[arc].g0], st[B.arcs[arc].g1]) }));
    linePath(ctx, g, seq, 0, seq.length);
    if (colors) { ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = colors[i % colors.length]; ctx.lineWidth = w; ctx.stroke(); } else powder(ctx, th, w, 0.8);
  });
}

export function drawArt(ctx, S, name, x, y, w, h, b, th) {
  const r = { x, y, w, h };
  ctx.save();
  if (name === 'logo') {
    const B = board('l33', 'sq', ['rect', 3, 3]);
    const g = fitGeo(B, r, 10);
    const st = states(B, 1); // all-cross: a lattice
    drawRings(ctx, th, B, g);
    drawLoops(ctx, th, B, g, st, Math.max(3, g.S * 0.055));
    drawDots(ctx, th, B, g, null);
  } else if (name === 'goal' || name === 'learn' || name === 'sandbox') {
    const B = board('g22', 'sq', ['rect', 2, 2]);
    const g = fitGeo(B, r, 20);
    const st = states(B, 1);
    drawRings(ctx, th, B, g);
    drawPattern(ctx, th, g, patternSeq(B, st), 1, Math.max(4, g.S * 0.06));
    drawDots(ctx, th, B, g, new Float32Array(B.dots.length).fill(1));
  } else if (name === 'drag' || name === 'board') {
    const B = board('d1', 'sq', ['rect', 3, 2]);
    const g = fitGeo(B, r, 20);
    drawRings(ctx, th, B, g);
    drawDots(ctx, th, B, g, null);
    const A = B.arcs[0], c = arcCurve(B, A, 0, 0);
    linePath(ctx, g, [{ c, dir: 0 }], 0, 1); powder(ctx, th, Math.max(4, g.S * 0.06));
    const tip = [g.ox + c[6] * g.S, g.oy + c[7] * g.S];
    ctx.fillStyle = alpha(th.accent, 0.35); ctx.beginPath(); ctx.arc(tip[0], tip[1], 20, 0, 7); ctx.fill();
    ctx.fillStyle = th.accent; ctx.beginPath(); ctx.arc(tip[0], tip[1], 9, 0, 7); ctx.fill();
  } else if (name === 'gap3') {
    const B = board('t21', 'sq', ['rect', 2, 1]);
    const pw = (w - 20) / 3;
    const labels = ['Wrap', 'Cross', 'Dip'];
    for (let s = 0; s < 3; s++) {
      const pr = { x: x + s * (pw + 10), y: y + 6, w: pw, h: h - 60 };
      const g = fitGeo(B, pr, 8);
      const st = states(B, 0); st[B.free[0]] = s;
      drawLoops(ctx, th, B, g, st, Math.max(2.5, g.S * 0.07), s === 0 ? [th.powder, th.hint] : null);
      drawDots(ctx, th, B, g, null);
      text(ctx, labels[s], pr.x + pw / 2, y + h - 22, Math.min(30, pw * 0.2), th.ink, { weight: 800 });
    }
  } else if (name === 'marks') {
    const labels = ['Wrap', 'Cross', 'Dip'], pw = w / 3, R = Math.min(34, pw * 0.22);
    for (let s = 0; s < 3; s++) {
      drawMarkGlyph(ctx, th, x + pw * s + pw / 2, y + h / 2 - 14, R * 1.6, 1, 0, s);
      text(ctx, labels[s], x + pw * s + pw / 2, y + h - 30, Math.min(30, pw * 0.2), th.ink, { weight: 800 });
    }
  } else if (name === 'early') {
    const B = board('t31', 'sq', ['rect', 3, 1]);
    const g = fitGeo(B, r, 16);
    const st = states(B, 1); st[B.free[0]] = 0;
    drawLoops(ctx, th, B, g, st, Math.max(3, g.S * 0.06), [th.bad, th.powder, th.hint]);
    drawDots(ctx, th, B, g, null);
  } else if (name === 'stars') {
    for (let i = 0; i < 3; i++) star(ctx, x + w / 2 + (i - 1) * 110, y + h / 2, 48, th.accent);
  } else if (name === 'hint') {
    icon(ctx, 'hint', x + w / 2, y + h / 2, 150, th.accent);
  } else if (name === 'daily') {
    icon(ctx, 'sun', x + w / 2, y + h / 2, 160, th.accent);
  } else if (name === 'text') {
    text(ctx, 'A-', x + w / 2 - 110, y + h / 2 + 30, 90, th.ink, { weight: 800 });
    text(ctx, 'A+', x + w / 2 + 110, y + h / 2 + 30, 130, th.accent, { weight: 800 });
  } else if (name === 'lock') {
    icon(ctx, 'lock', x + w / 2, y + h / 2, Math.min(h, 130), th.accent);
  } else if (name === 'endstars') {
    const n = (b.data && b.data.stars) || 0;
    for (let i = 0; i < 3; i++) star(ctx, x + w / 2 + (i - 1) * Math.min(130, w / 3.4), y + h / 2, Math.min(h * 0.42, 56), i < n ? th.accent : 'rgba(255,255,255,0.18)');
  } else if (name === 'lesson' || name === 'dailythumb') {
    const puz = name === 'lesson' ? lessonPuzzle((b.data && b.data.i) || 0) : puzzleById(S.dailyId);
    if (puz) {
      const g = fitGeo(puz.B, r, 24);
      drawRings(ctx, th, puz.B, g);
      drawDots(ctx, th, puz.B, g, null);
      drawMarks(ctx, th, puz.B, g, puz.marks);
    }
  }
  ctx.restore();
}
export { LESSON_TEXT, rr };
