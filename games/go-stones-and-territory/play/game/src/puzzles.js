// Puzzle content and the solver that PROVES every puzzle. A puzzle is a small position, a target stone, and the side
// to play. Answers are the first moves that provably work against every defence (found by `solve`, and re-proved by
// the test). The daily puzzle is picked from the library by env.config.day and shown in one of the 8 board symmetries.
import { newGame, play, clone, hashBoard, BLACK, WHITE, opp, coord } from './rules.js';

// ---- solver ---------------------------------------------------------------------------------------------------
function cands(g, box) {
  const out = [], [x0, y0, x1, y1] = box;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * g.n + x; if (g.b[i] === 0) out.push(i); }
  return out;
}
const captured = (g, target, color) => g.b[target] !== color;
// g.turn = attacker to move. True if the target (a stone of colour `def`) is captured within K attacker moves.
function attackerWins(g, target, def, K, box, memo) {
  const key = hashBoard(g.b) + g.turn + ':' + K + ':' + g.ko;
  if (memo.has(key)) return memo.get(key);
  let win = false;
  for (const m of cands(g, box)) {
    const h = clone(g); if (!play(h, m).ok) continue;
    if (captured(h, target, def)) { win = true; break; }
    if (K <= 1) continue;
    let all = true;
    for (const d of [...cands(h, box), -1]) {
      const q = clone(h); if (!play(q, d).ok) continue;
      if (captured(q, target, def)) continue;           // (a defender cannot capture its own stone, kept for safety)
      if (!attackerWins(q, target, def, K - 1, box, memo)) { all = false; break; }
    }
    if (all) { win = true; break; }
  }
  memo.set(key, win); return win;
}
// First moves for the side to move that prove the goal. kind 'kill': mover attacks the target (opposite colour);
// kind 'live': mover owns the target and must make it survive K enemy moves.
export function solve(pz, K = pz.K) {
  const g = fromRows(pz), memo = new Map(), out = [];
  const target = pz.target, tc = g.b[target];
  g.turn = pz.turn;
  for (const m of cands(g, pz.box)) {
    const h = clone(g); if (!play(h, m).ok) continue;
    if (pz.kind === 'kill') {
      if (captured(h, target, tc) || attackerWinsAfter(h)) out.push(m);
    } else if (!captured(h, target, tc) && !attackerWins(h, target, tc, K, pz.box, memo)) out.push(m);
  }
  return out;
  function attackerWinsAfter(h) {
    if (K <= 1) return false;
    for (const d of [...cands(h, pz.box), -1]) {
      const q = clone(h); if (!play(q, d).ok) continue;
      if (!attackerWins(q, target, tc, K - 1, pz.box, memo)) return false;
    }
    return true;
  }
}
export function fromRows(pz) {
  const g = newGame(pz.n, pz.komi ?? 5.5);
  pz.rows.forEach((row, y) => [...row].forEach((ch, x) => { g.b[y * pz.n + x] = ch === 'X' ? BLACK : ch === 'O' ? WHITE : 0; }));
  g.turn = pz.turn; g.hist = [hashBoard(g.b)];
  return g;
}

// ---- symmetries -----------------------------------------------------------------------------------------------
export function transformIndex(n, i, t) {
  let x = i % n, y = (i / n) | 0;
  if (t & 1) x = n - 1 - x;
  if (t & 2) y = n - 1 - y;
  if (t & 4) [x, y] = [y, x];
  return y * n + x;
}
export function transformed(pz, t) {
  const n = pz.n, rows = Array.from({ length: n }, () => Array(n).fill('.'));
  pz.rows.forEach((row, y) => [...row].forEach((ch, x) => { const j = transformIndex(n, y * n + x, t); rows[(j / n) | 0][j % n] = ch; }));
  const box = [0, 0, n - 1, n - 1].map(() => 0);
  let x0 = n, y0 = n, x1 = 0, y1 = 0;
  for (const [bx, by] of [[pz.box[0], pz.box[1]], [pz.box[2], pz.box[3]]]) { const j = transformIndex(n, by * n + bx, t); x0 = Math.min(x0, j % n); x1 = Math.max(x1, j % n); y0 = Math.min(y0, (j / n) | 0); y1 = Math.max(y1, (j / n) | 0); }
  return { ...pz, rows: rows.map((r) => r.join('')), box: [x0, y0, x1, y1], target: transformIndex(n, pz.target, t), answers: pz.answers.map((a) => transformIndex(n, a, t)) };
}

export const PUZZLE_TEXT = {
  kill: 'Black to play. Capture the marked white stones. Find the one move that they cannot escape.',
  live: 'White to play. Save the marked white stones: find the move that keeps them alive.',
  killW: 'White to play. Capture the marked black stones.',
  liveB: 'Black to play. Save the marked black stones.',
};
export const puzzleText = (pz) => (pz.kind === 'kill' ? (pz.turn === BLACK ? PUZZLE_TEXT.kill : PUZZLE_TEXT.killW) : (pz.turn === BLACK ? PUZZLE_TEXT.liveB : PUZZLE_TEXT.live));

export function todaysPuzzle(day, list = LIBRARY) {
  // a fixed shuffle so neighbouring days differ, a symmetry that changes with the day
  const i = ((day * 7919) >>> 0) % list.length, t = (Math.floor(day / list.length) + day) % 8;
  return { id: i, ...transformed(list[i], t) };
}

export { coord };
export const LIBRARY = [
  {n:9,rows:["...X.....","..OOX....",".XOX.....","..X......",".........",".........",".........",".........","........."],turn:1,kind:"kill",target:20,box:[1,0,4,3],K:2,answers:[10]},
  {n:9,rows:["..X......","XOO......","XOX......",".X.......","..X......",".........",".........",".........","........."],turn:1,kind:"kill",target:10,box:[0,0,3,3],K:2,answers:[12]},
  {n:9,rows:["OOOOX....","X.OOX....","...X.....",".........",".........",".........",".........",".........","........."],turn:1,kind:"kill",target:0,box:[0,0,4,2],K:2,answers:[20]},
  {n:9,rows:[".........","OX.......","OOX......","X........",".........",".........",".........",".........","........."],turn:1,kind:"kill",target:9,box:[0,0,2,3],K:2,answers:[28]},
  {n:9,rows:["XXX......","XOX......",".OOX.....",".OOX.....","..X......",".........",".........",".........","........."],turn:1,kind:"kill",target:19,box:[0,0,3,4],K:3,answers:[37]},
  {n:9,rows:[".........",".XX......","XOOX.....",".OOX.....",".X....X..",".........",".........",".........","........."],turn:1,kind:"kill",target:20,box:[0,1,3,4],K:2,answers:[38]},
  {n:9,rows:[".........",".X.......",".OOX.....","XOOX..X..","XOX......",".X..X....",".........",".........","........."],turn:1,kind:"kill",target:19,box:[0,1,3,5],K:2,answers:[11]},
  {n:9,rows:[".........","OO.......","OOX......","OOX......","XX.......",".........",".........",".........","........."],turn:1,kind:"kill",target:19,box:[0,0,2,4],K:3,answers:[11]},
  {n:9,rows:["OOXX.....","O........","OX.......",".........",".........",".........",".........",".........","........."],turn:1,kind:"kill",target:9,box:[0,0,2,3],K:2,answers:[27]},
  {n:9,rows:["...X.....",".XX......","XOO......",".OX......",".X.......",".........",".........",".........","........."],turn:1,kind:"kill",target:20,box:[0,1,3,4],K:2,answers:[21]},
  {n:9,rows:[".........","..X......",".OOX.....",".XOX.....","X.X......",".........",".........",".........","........."],turn:1,kind:"kill",target:20,box:[0,1,3,4],K:3,answers:[10]},
  {n:9,rows:[".........","XOOX.....","XOX......",".X.......",".........","..X......",".........",".........","........."],turn:1,kind:"kill",target:11,box:[0,0,3,3],K:2,answers:[1,2]},
  {n:9,rows:["OX..X....","OXX......","OOX......","O........",".........","X........",".........",".........","........."],turn:1,kind:"kill",target:9,box:[0,0,2,4],K:2,answers:[28]},
  {n:9,rows:[".........","XXX......","OOOX.....","O.X......",".........",".........",".........",".........","........."],turn:1,kind:"kill",target:18,box:[0,1,3,4],K:2,answers:[36]},
  {n:9,rows:[".XOO..X..","..OOOX...","..XXX....",".........",".X.......",".........",".........",".........","........."],turn:1,kind:"kill",target:2,box:[1,0,5,2],K:2,answers:[10]},
  {n:9,rows:[".........",".X.......","OOX..X...","O........","OX.......","X........",".........",".........","........."],turn:1,kind:"kill",target:18,box:[0,1,2,5],K:2,answers:[9]},
  {n:9,rows:[".........","OOX......","OX.......","X........",".........",".........",".........",".........","........."],turn:1,kind:"kill",target:10,box:[0,0,2,3],K:2,answers:[1]},
  {n:9,rows:[".........","XX.......","OOX......","O........","O........","X........","..X......",".........","........."],turn:1,kind:"kill",target:18,box:[0,1,2,5],K:2,answers:[37]},
  {n:9,rows:[".OOX.....","XOX......","XOX......","XO.......",".XX......",".........",".........",".........","........."],turn:1,kind:"kill",target:1,box:[0,0,3,4],K:2,answers:[29]},
  {n:9,rows:["OOX......",".OX.X....",".........",".........",".........",".........",".........",".........","........."],turn:1,kind:"kill",target:10,box:[0,0,2,2],K:2,answers:[19]},
  {n:9,rows:[".XX......","OOOX.....","XX.......",".........","X........","X........",".........",".........","........."],turn:2,kind:"live",target:10,box:[0,0,3,2],K:3,answers:[20]},
  {n:9,rows:[".OOO.....",".XXOX....","...X.....","......X..",".........",".........",".........",".........","........."],turn:2,kind:"live",target:2,box:[0,0,4,2],K:3,answers:[4]},
  {n:9,rows:["OOX......","O........","O........","OX.......","X........",".........","..X......",".........","........."],turn:2,kind:"live",target:9,box:[0,0,2,4],K:3,answers:[11]},
  {n:9,rows:[".O.......","XOX......","XOX......",".X.......",".........",".........",".........",".........","........."],turn:2,kind:"live",target:10,box:[0,0,2,3],K:3,answers:[2]},
  {n:9,rows:[".........","O........","OOX......","OX.......","OX.......","X........",".........",".........","........."],turn:2,kind:"live",target:18,box:[0,0,2,5],K:3,answers:[1,11]},
  {n:9,rows:[".OX......","OOX......","X........","..X......",".........",".........",".........",".........","........."],turn:2,kind:"live",target:9,box:[0,0,2,2],K:3,answers:[19]},
  {n:9,rows:[".XX......","OOOX.....","X.X......",".........","....X....",".........",".........",".........","........."],turn:2,kind:"live",target:11,box:[0,0,3,2],K:3,answers:[19]},
  {n:9,rows:[".X.......","OOXX.....","OOOOX....","X.XX.....","....X....",".X.......","X........",".........","........."],turn:2,kind:"live",target:19,box:[0,0,4,3],K:3,answers:[28]},
  {n:9,rows:["..OX.....","XXO......","OOOX.....","XXX......",".........",".........",".........",".........","........."],turn:2,kind:"live",target:20,box:[0,0,3,3],K:3,answers:[12]},
  {n:9,rows:["O.OOX....","OOOX.....","X.XX.....","....X....",".........",".........",".........",".........","........."],turn:2,kind:"live",target:11,box:[0,0,4,2],K:3,answers:[19]},
  {n:9,rows:["OOOO.....","XXOX.....","..OX.....","XXX......",".........",".........",".........",".........","........."],turn:2,kind:"live",target:0,box:[0,0,4,3],K:3,answers:[4]},
  {n:9,rows:["OOOOX....","O..X.....","X........",".........",".........",".........","...X.....",".........","........."],turn:2,kind:"live",target:0,box:[0,0,4,2],K:3,answers:[19]},
];
