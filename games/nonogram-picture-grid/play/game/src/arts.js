// Illustrations for the How to Play, Rules, About and Learn pages. Drawn live from the same board code the game uses.
import { rr, text, icon, star, alpha, clamp01, NUM, DISPLAY } from './art.js';
import { drawNonogram, drawPicture, drawTile } from './boardview.js';
import { boardGeo } from './layout.js';
import { cluesOfGrid, FILLED, CROSSED, UNKNOWN, runsOf, lineDone } from './solver.js';
import { puzzleById } from './chapters.js';
import { tr } from './content.js';

const minis = new Map();
export function miniPuz(rows) {
  const key = rows.join('/');
  let p = minis.get(key);
  if (!p) {
    const c = cluesOfGrid(rows);
    const sol = new Uint8Array(c.w * c.h);
    for (let r = 0; r < c.h; r++) for (let q = 0; q < c.w; q++) if (rows[r][q] !== '.') sol[r * c.w + q] = 1;
    p = { id: `mini:${key}`, name: 'mini', w: c.w, h: c.h, art: rows, bg: '#f1e9d6', rows: c.rows, cols: c.cols, sol };
    minis.set(key, p);
  }
  return p;
}
// pattern: rows of '#' filled, 'x' crossed, '.' unknown
const cellsOf = (puz, pattern) => { const a = new Uint8Array(puz.w * puz.h); if (pattern) pattern.forEach((row, r) => { for (let c = 0; c < puz.w; c++) a[r * puz.w + c] = row[c] === '#' ? FILLED : row[c] === 'x' ? CROSSED : UNKNOWN; }); return a; };
function doneOf(puz, cells) {
  const R = [], C = [];
  for (let r = 0; r < puz.h; r++) R.push(puz.rows[r].length && lineDone(puz, cells, 'row', r) ? 1 : 0);
  for (let c = 0; c < puz.w; c++) C.push(puz.cols[c].length && lineDone(puz, cells, 'col', c) ? 1 : 0);
  return { R, C };
}
export function miniBoard(ctx, th, rows, pattern, x, y, w, h, o = {}) {
  const puz = miniPuz(rows);
  const g = boardGeo(puz, { x, y, w, h }, 1, 'fit', 0, 0);
  const cells = cellsOf(puz, pattern);
  const d = doneOf(puz, cells);
  drawNonogram(ctx, th, puz, cells, g, { t: o.t ?? 0, doneR: d.R, doneC: d.C, noCard: o.noCard, hint: o.hint, focus: o.focus });
  return g;
}

const HEART = ['.#.#.', '#####', '#####', '.###.', '..#..'];
const BIG = ['..#####...', '.#######..', '####.####.', '#########.', '.#######..', '..#####...', '...###....', '...###....', '..#####...', '.#######..'];

// A single line: n squares, a clue, current marks, optional bars (possible placements) and highlighted squares.
export function lineDemo(ctx, th, x, y, w, d) {
  const n = d.n, labelW = d.labelW ?? 130, s = Math.min(54, (w - labelW - 10) / n);
  const x0 = x + w - s * n;
  text(ctx, d.clue.join(' '), x + labelW - 10, y + s * 0.68, Math.min(40, s * 0.8), th.ink, { weight: 800, font: NUM, align: 'right' });
  for (let i = 0; i < n; i++) drawTile(ctx, th, x0 + i * s, y, s, d.cells?.[i] ?? 0);
  for (const i of d.hl ?? []) { ctx.strokeStyle = th.hint; ctx.lineWidth = 4; rr(ctx, x0 + i * s + 2, y + 2, s - 4, s - 4, s * 0.14); ctx.stroke(); }
  let by = y + s + 10;
  for (const [st, len, col] of d.bars ?? []) {
    ctx.fillStyle = col; rr(ctx, x0 + st * s + 3, by, len * s - 6, 14, 7); ctx.fill();
    by += 20;
  }
  return by;
}

export function drawArt(ctx, S, name, x, y, w, h, b, th) {
  const cx = x + w / 2, cy = y + h / 2, t = S.t;
  const cap = (str, yy, col = 'rgba(246,236,214,0.82)', size = 22) => text(ctx, str, cx, yy, size, col, { weight: 600 });
  ctx.save();
  ctx.fillStyle = 'rgba(10,8,8,0.5)'; rr(ctx, x, y, w, h, 18); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1.5; rr(ctx, x, y, w, h, 18); ctx.stroke();
  ctx.beginPath(); rr(ctx, x, y, w, h, 18); ctx.clip();
  const ja = S.lang === 'ja';
  const T = (en, jp) => (ja ? jp : en);
  if (name === 'logo') {
    const p = puzzleById('cottage');
    drawPicture(ctx, th, p, cx - Math.min(h - 70, 200) / 2, y + 30, Math.min(h - 70, 200), { k: 1, gap: 0 });
    cap(tr('title'), y + h - 22, th.accent, 28);
  } else if (name === 'sample') {
    const g = miniBoard(ctx, th, HEART, ['.#.#.', '#####', '..x..', '.....', '.....'], x + 24, y + 12, w - 48, h - 68);
    cap(T('numbers give the runs of filled squares', '数字は塗るマスの連続の長さ'), y + h - 18);
  } else if (name === 'clues') {
    let yy = y + 36;
    for (const [clue, cells, label] of [[[3, 1], [0, 1, 1, 1, 0, 1, 0].map((v) => (v ? 1 : 0)), '3 1'], [[0], [2, 2, 2, 2, 2, 2, 2], '0'], [[7], [1, 1, 1, 1, 1, 1, 1], '7']]) {
      lineDemo(ctx, th, x + 24, yy, w - 48, { n: 7, clue, cells, labelW: 130 });
      yy += 96;
    }
    cap(T('3 1: a run of three, a gap, a run of one', '3 1: 3マスの連続、すき間、1マス'), y + h - 18, th.accent, 21);
  } else if (name === 'example') {
    lineDemo(ctx, th, x + 24, y + 30, w - 48, { n: 10, clue: [3, 2], bars: [[0, 3, '#e8a04a'], [4, 2, '#e8a04a']] });
    text(ctx, T('left-most', '左端'), x + 24 + 60, y + 118, 20, 'rgba(246,236,214,0.7)', { weight: 600 });
    lineDemo(ctx, th, x + 24, y + 150, w - 48, { n: 10, clue: [3, 2], bars: [[4, 3, '#5fb88a'], [8, 2, '#5fb88a']] });
    text(ctx, T('right-most', '右端'), x + 24 + 60, y + 238, 20, 'rgba(246,236,214,0.7)', { weight: 600 });
    cap(T('3 + 1 + 2 = 6 squares needed, 4 spare', '3 + 1 + 2 = 6マス必要、余りは4マス'), y + h - 18, th.accent, 21);
  } else if (name === 'drag') {
    const g = miniBoard(ctx, th, HEART, ['.....', '###..', '.....', '.....', '.....'], x + 24, y + 12, w - 48, h - 62);
    const ax = g.view.x + g.s * 0.5, ay = g.view.y + g.s * 1.5, bx = g.view.x + g.s * (1.5 + 1.2 * (0.5 + 0.5 * Math.sin(t * 2)));
    ctx.fillStyle = 'rgba(255,255,255,0.32)'; ctx.beginPath(); ctx.arc(bx, ay, 24 + 3 * Math.sin(t * 5), 0, Math.PI * 2); ctx.fill();
    cap(T('drag along a line to fill a run', '線に沿ってドラッグすると連続して塗れます'), y + h - 18);
  } else if (name === 'cross') {
    miniBoard(ctx, th, HEART, ['#.x.#', 'x###x', '.....', '.....', '.....'].map((r) => r.replace(/\./g, '.')), x + 24, y + 12, w - 48, h - 62);
    cap(T('a cross marks a square you know is empty', 'バツは空とわかったマスの印'), y + h - 18);
  } else if (name === 'bigboard') {
    const g = miniBoard(ctx, th, BIG, null, x + 24, y + 10, w * 0.55, h - 50);
    ctx.strokeStyle = th.hint; ctx.lineWidth = 4; rr(ctx, g.view.x + g.s * 2, g.view.y + g.s * 2, g.s * 3, g.s * 3, 6); ctx.stroke();
    const big = g.s * 3;
    const bx = x + w * 0.62, by = y + 40;
    const s2 = Math.min(60, (w * 0.34) / 3);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) drawTile(ctx, th, bx + c * s2, by + r * s2, s2, (r + c) % 3 === 0 ? FILLED : 0);
    ctx.strokeStyle = th.hint; ctx.lineWidth = 3; rr(ctx, bx - 4, by - 4, s2 * 3 + 8, s2 * 3 + 8, 8); ctx.stroke();
    icon(ctx, 'zoom', bx + s2 * 1.5, by + s2 * 3 + 52, 44, th.accent); icon(ctx, 'move', bx + s2 * 1.5 + 70, by + s2 * 3 + 52, 44, th.accent);
    cap(T('Zoom for big squares, Move to slide', '拡大で大きなマス、移動で盤面をずらす'), y + h - 14, 'rgba(246,236,214,0.82)', 20);
  } else if (name === 'undo') {
    icon(ctx, 'undo', cx - 130, cy - 14, 84, th.accent); icon(ctx, 'redo', cx + 130, cy - 14, 84, th.accent);
    text(ctx, tr('undo'), cx - 130, cy + 70, 24, 'rgba(246,236,214,0.82)'); text(ctx, tr('redo'), cx + 130, cy + 70, 24, 'rgba(246,236,214,0.82)');
  } else if (name === 'done') {
    miniBoard(ctx, th, HEART, ['.#.#.', '#####', '#####', '.###.', '..#..'], x + 24, y + 12, w - 48, h - 62);
    cap(T('finished lines fade and turn green', '完成した線は薄く緑色になります'), y + h - 18);
  } else if (name === 'check') {
    icon(ctx, 'shield', cx - 70, cy - 10, 100, th.accent);
    drawTile(ctx, th, cx + 10, cy - 50, 90, 0);
    ctx.fillStyle = alpha(th.bad, 0.65 + 0.3 * Math.sin(t * 5)); rr(ctx, cx + 12, cy - 48, 86, 86, 12); ctx.fill();
    cap(T('a wrong mark is refused with a red flash', '間違った印は赤く光って入りません'), y + h - 18);
  } else if (name === 'think') {
    const g = miniBoard(ctx, th, HEART, ['.....', '.....', '.....', '.....', '.....'], x + 24, y + 12, w - 48, h - 112, { hint: { axis: 'row', k: 2, cells: [0, 1, 2, 3, 4].map((i) => ({ at: 10 + i, v: FILLED })) }, t });
    ctx.fillStyle = 'rgba(10,8,8,0.8)'; rr(ctx, x + 30, y + h - 88, w - 60, 66, 20); ctx.fill();
    ctx.strokeStyle = th.stroke; ctx.lineWidth = 1.5; rr(ctx, x + 30, y + h - 88, w - 60, 66, 20); ctx.stroke();
    cap(T('Row 3: the clue 5 fills all 5 squares.', '3行目: 「5」は5マスすべてを塗ります。'), y + h - 46, th.accent, 22);
  } else if (name === 'overlap') {
    lineDemo(ctx, th, x + 24, y + 28, w - 48, { n: 10, clue: [8], bars: [[0, 8, '#e8a04a'], [2, 8, '#d98238']], cells: [0, 0, 1, 1, 1, 1, 1, 1, 0, 0].map((v) => (v ? 1 : 0)), hl: [2, 3, 4, 5, 6, 7] });
    cap(T('left-most and right-most: the middle always overlaps', '左端と右端に置いても、真ん中は必ず重なる'), y + h - 18, th.accent, 20);
  } else if (name === 'edge') {
    lineDemo(ctx, th, x + 24, y + 28, w - 48, { n: 10, clue: [4, 2], cells: [1, 1, 1, 1, 2, 0, 0, 0, 0, 0], hl: [1, 2, 3, 4] });
    lineDemo(ctx, th, x + 24, y + 150, w - 48, { n: 10, clue: [4, 2], cells: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0], hl: [] });
    cap(T('a filled square at the edge starts the first run', '端の塗られたマスは最初の連続のはじまり'), y + h - 18, th.accent, 20);
  } else if (name === 'gap') {
    lineDemo(ctx, th, x + 24, y + 28, w - 48, { n: 10, clue: [3, 3], cells: [2, 0, 0, 2, 0, 0, 0, 0, 0, 0], hl: [1, 2] });
    cap(T('2 open squares are smaller than 3: cross them out', '空き2マスは3より小さいのでバツをつける'), y + h - 18, th.accent, 20);
  } else if (name === 'reveal') {
    const p = puzzleById('lantern');
    const side = Math.min(h - 70, 220);
    drawPicture(ctx, th, p, cx - side / 2 - 110, y + 24, side, { k: 0, gap: 3, frame: false });
    drawPicture(ctx, th, p, cx - side / 2 + 110, y + 24, side, { k: 1, gap: 0, frame: false });
    icon(ctx, 'play', cx, y + 24 + side / 2, 50, th.accent);
    cap(T('ink turns to colour', '墨が色に変わります'), y + h - 16);
  } else if (name === 'stars') {
    for (let i = 0; i < 3; i++) star(ctx, cx + (i - 1) * 120, cy - 20, 46, th.accent, '#fff3');
    cap(T('solved · no Think · no wrong marks', '完成 ・ ヒントなし ・ 間違いなし'), cy + 70, undefined, 22);
  } else if (name === 'chapters') {
    ['5', '7', '10', '12', '15', '20'].forEach((n, i) => {
      const bx = x + 20 + (i % 3) * ((w - 40) / 3), by = y + 28 + Math.floor(i / 3) * ((h - 60) / 2);
      ctx.fillStyle = th.btn[0]; rr(ctx, bx, by, (w - 40) / 3 - 12, (h - 60) / 2 - 12, 14); ctx.fill();
      text(ctx, `${n}×${n}`, bx + ((w - 40) / 3 - 12) / 2, by + ((h - 60) / 4) + 4, 30, th.ink, { weight: 800 });
    });
  } else if (name === 'daily' || name === 'dailythumb') {
    const p = S.dailyPuz ?? puzzleById('sunflower');
    const side = Math.min(h - 50, 260);
    drawPicture(ctx, th, p, cx - side / 2, y + 24, side, { k: S.dailyDone ? 1 : 0, gap: S.dailyDone ? 0 : 2 });
    if (!S.dailyDone) icon(ctx, 'sun', cx, y + 24 + side / 2, 70, th.accent);
  } else if (name === 'save') {
    miniBoard(ctx, th, HEART, ['.#.#.', '#####', '#.x..', '.....', '.....'], x + 24, y + 10, w * 0.6, h - 64);
    icon(ctx, 'play', x + w * 0.82, cy - 10, 70, th.accent);
    cap(tr('continueBtn'), y + h - 12);
  } else if (name === 'auto') {
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(cx - 150, cy, 46, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = th.accent; ctx.beginPath(); ctx.arc(cx - 150, cy, 46, -Math.PI / 2, -Math.PI / 2 + ((t * 0.4) % 1) * Math.PI * 2); ctx.stroke();
    drawTile(ctx, th, cx - 30, cy - 40, 80, FILLED);
    icon(ctx, 'pause', cx + 150, cy, 52, th.accent);
    cap('THINK  ·  REVEAL  ·  ACT', y + h - 18, th.accent, 22);
  } else if (name === 'text') {
    text(ctx, 'A-', cx - 120, cy + 16, 56, th.ink, { weight: 700 }); text(ctx, 'A+', cx + 120, cy + 22, 84, th.ink, { weight: 800 });
    text(ctx, '100 - 300%', cx, y + h - 20, 22, th.accent, { weight: 600 });
  } else if (name === 'keys') {
    ['←', '→', '↑', '↓'].forEach((k, i) => { ctx.fillStyle = th.btn[0]; rr(ctx, x + 40 + i * 70, y + 40, 58, 58, 10); ctx.fill(); text(ctx, k, x + 69 + i * 70, y + 80, 30, th.ink, { weight: 700 }); });
    ['F', 'C', 'M', 'U', 'Y', 'T'].forEach((k, i) => { ctx.fillStyle = th.btn[0]; rr(ctx, x + 40 + i * 70, y + 120, 58, 58, 10); ctx.fill(); text(ctx, k, x + 69 + i * 70, y + 160, 28, th.ink, { weight: 700 }); });
  } else if (name === 'lock') {
    icon(ctx, 'lock', cx, cy, 90, th.accent);
  } else if (name === 'endstars') {
    const e = b.data ?? {};
    const k = clamp01((S.ovT - 0.15) / 0.5);
    for (let i = 0; i < 3; i++) star(ctx, cx + (i - 1) * (h * 0.9), cy + 4, h * 0.34 * (i < (e.stars ?? 0) ? 0.6 + 0.4 * k : 0.8), i < (e.stars ?? 0) ? th.accent : 'rgba(255,255,255,0.14)', i < (e.stars ?? 0) ? '#fff6' : 'rgba(255,255,255,0.2)');
  }
  ctx.restore();
}
