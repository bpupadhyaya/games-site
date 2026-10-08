// Pictures for the Rules, How to Play and About pages. They use the game's own grid drawing (board.js) on a small demo puzzle.
import { makePuzzle, ACROSS, DOWN } from './grid.js';
import { boardGeo } from './layout.js';
import { drawGrid } from './board.js';
import { theme, rr, txt, para, mix, rgba, icons, F } from './ui.js';

const DEMO = makePuzzle('PAUSE##NOWMAINEART##TEETH', 5);
const cellsOf = (id) => new Set(DEMO.slots[id].cells);
const slotNum = (num, dir) => DEMO.slots.find((s) => s.num === num && s.dir === dir);
const ALL = DEMO.sol.slice();

function board(ctx, r, o) {
  const B = Math.min(r.w, r.h - 84, 440), x = r.x + (r.w - B) / 2, y = r.y + 6;
  drawGrid(ctx, boardGeo(x, y, B, 5), DEMO, o);
  return { x, y, B, bottom: y + B };
}
function strip(ctx, r, y, text, accent) {
  const T = theme(), w = Math.min(r.w, 560), x = r.x + (r.w - w) / 2, h = Math.max(46, F(24) * 2.5);
  rr(ctx, x, y, w, h, 14); ctx.fillStyle = T.panel; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = accent ? T.accent : T.line; ctx.stroke();
  para(ctx, text, x + 14, y + 8, w - 28, { size: F(22), weight: 600, color: T.text, lh: 1.2, maxLines: 2 });
  return y + h;
}

export function drawFigure(ctx, r, kind, t = 0) {
  const T = theme();
  const pulse = 0.5 + 0.5 * Math.sin(t * 3);
  if (kind === 'grid' || kind === 'numbers') {
    const b = board(ctx, r, { v: kind === 'grid' ? ALL : null, numbers: true });
    if (kind === 'numbers') strip(ctx, r, b.bottom + 12, '1 Across starts in the top-left square. 1 Down starts there too.', false);
    else strip(ctx, r, b.bottom + 12, 'White squares hold letters. Black blocks end the words.', false);
    return;
  }
  if (kind === 'cross') {
    const s = slotNum(1, ACROSS), v = DEMO.sol.map((ch, i) => (s.cells.indexOf(i) > 1 && s.cells.indexOf(i) < 4 ? ch : ''));
    const b = board(ctx, r, { v, sel: s.cells[2], cells: new Set(s.cells), numbers: true });
    strip(ctx, r, b.bottom + 12, `${s.num} Across (${s.len}): ${s.clue}`, true);
    return;
  }
  if (kind === 'crossings') {
    const a = slotNum(1, ACROSS), d = slotNum(2, DOWN);
    const both = new Set([...a.cells, ...d.cells]);
    const b = board(ctx, r, { v: ALL, cells: both, sel: d.cells[0], numbers: true });
    strip(ctx, r, b.bottom + 12, 'The gold square is shared by PAUSE across and UNITE down.', false);
    return;
  }
  if (kind === 'pencil') {
    const pen = DEMO.sol.map(() => 0); pen[2] = 1; pen[7] = 1;
    const v = DEMO.sol.map((ch, i) => (i < 5 || i === 7 ? ch : ''));
    const b = board(ctx, r, { v, pencil: pen, numbers: true, sel: 12 });
    strip(ctx, r, b.bottom + 12, 'Grey letters are pencil guesses. Ink letters are final.', false);
    return;
  }
  if (kind === 'check') {
    const v = DEMO.sol.map((ch, i) => (i < 5 ? (i === 3 ? 'D' : ch) : '')), mark = DEMO.sol.map((c, i) => (i === 3 ? 1 : 0));
    const b = board(ctx, r, { v, mark, numbers: true });
    strip(ctx, r, b.bottom + 12, 'Check marks a wrong letter in red until you change it.', false);
    return;
  }
  if (kind === 'reveal') {
    const rev = DEMO.sol.map((c, i) => (i >= 10 && i < 15 ? 1 : 0)), v = DEMO.sol.map((ch, i) => (i >= 10 && i < 15 ? ch : ''));
    const b = board(ctx, r, { v, rev, numbers: true });
    strip(ctx, r, b.bottom + 12, 'A red corner marks a revealed square. It is locked.', false);
    return;
  }
  if (kind === 'hint') {
    const s = slotNum(9, ACROSS), known = new Set();
    for (const [num] of [[2], [6], [7]]) slotNum(num, DOWN).cells.forEach((c) => known.add(c));
    const v = DEMO.sol.map((ch, i) => (known.has(i) ? ch : ''));
    const b = board(ctx, r, { v, focus: new Set(s.cells), numbers: true });
    const y = strip(ctx, r, b.bottom + 12, `${s.num} Across, ${s.len} letters: ${DEMO.sol.slice(20, 23).join(' ')} _ _ so far. Starts with ${s.word[0]}.`, true);
    icons.bulb(ctx, r.x + r.w / 2, y + 28, 36, T.accent);
    return;
  }
  if (kind === 'stars') {
    const cx = r.x + r.w / 2, cy = r.y + Math.min(r.h, 300) / 2, sz = Math.min(r.w / 4, 110);
    for (let k = 0; k < 3; k++) icons.star(ctx, cx + (k - 1) * (sz + 12), cy, sz * (1 + 0.04 * Math.sin(t * 2 + k)), k < 3 ? '#ffc93c' : 'rgba(128,128,128,0.35)');
    txt(ctx, 'No help, a fair pace', cx, cy + sz * 0.8, { size: F(26), weight: 600, color: T.dim, align: 'center', maxW: r.w });
    return;
  }
  if (kind === 'sizes') {
    const sizes = [5, 7, 9, 11, 13], unit = Math.min(r.w / 5.4, 120), y0 = r.y + Math.min(r.h, 360) / 2 - unit * 0.7;
    sizes.forEach((n, k) => {
      const s = unit * (0.45 + 0.1 * k), x = r.x + (r.w - sizes.length * (unit * 1.02)) / 2 + k * unit * 1.02 + (unit - s) / 2, y = y0 + unit * 1.1 - s;
      rr(ctx, x, y, s, s, s * 0.08); ctx.fillStyle = T.paper; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = T.rim; ctx.stroke();
      const step = s / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if ((i * 7 + j * 3 + n) % 5 === 0 && (i + j) % 2 === 1) { ctx.fillStyle = T.block; ctx.fillRect(x + j * step, y + i * step, step, step); }
      txt(ctx, `${n}`, x + s / 2, y + s + 22, { size: F(26), weight: 800, color: T.text, align: 'center' });
    });
    return;
  }
  if (kind === 'daily') {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], sz = ['Mini', 'Quick', 'Classic', 'Classic', 'Grand', 'Grand', 'Giant'];
    const cw = Math.min(r.w / 7.4, 100), x0 = r.x + (r.w - cw * 7.4) / 2 + cw * 0.2, y0 = r.y + Math.min(r.h, 320) / 2 - cw * 0.8;
    days.forEach((d, k) => {
      const x = x0 + k * cw * 1.05;
      rr(ctx, x, y0, cw, cw * 1.6, 12); ctx.fillStyle = T.panel; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = T.line; ctx.stroke();
      txt(ctx, d, x + cw / 2, y0 + cw * 0.4, { size: F(22), weight: 800, color: T.accent, align: 'center', maxW: cw - 6 });
      txt(ctx, sz[k], x + cw / 2, y0 + cw * 1.1, { size: F(20), weight: 600, color: T.text, align: 'center', maxW: cw - 6, min: 11 });
    });
    return;
  }
}
