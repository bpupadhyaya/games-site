// Huarong Dao engine: a 4 x 5 board of sliding blocks and an exact solver. Pure and deterministic.
//
// Blocks: C (2 x 2, the Commander), V (1 wide, 2 tall), H (2 wide, 1 tall), S (1 x 1, a soldier).
// A MOVE is one block lifted and set down on any cell it can reach by sliding through empty cells
// (corners allowed); the move counter goes up by one per move, however far the block travels.
// The puzzle is solved when the Commander stands on the two bottom-centre cells (the gate).

export const COLS = 4;
export const ROWS = 5;
export const GATE = { x: 1, y: 3 };

export const DIMS = { C: [2, 2], V: [1, 2], H: [2, 1], S: [1, 1] };
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

// ---- layouts ------------------------------------------------------------------------------------
// A layout is five 4-letter rows. Each block uses its own letter; '.' is an empty cell. The block type
// is read from the shape the letter covers.
export function parseLayout(rows) {
  const cells = new Map();
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') { if (!cells.has(ch)) cells.set(ch, []); cells.get(ch).push([x, y]); } }));
  const pieces = [];
  for (const [ch, list] of cells) {
    const x = Math.min(...list.map((c) => c[0])), y = Math.min(...list.map((c) => c[1]));
    const w = Math.max(...list.map((c) => c[0])) - x + 1, h = Math.max(...list.map((c) => c[1])) - y + 1;
    if (w * h !== list.length) throw new Error(`block ${ch} is not a rectangle`);
    const t = w === 2 && h === 2 ? 'C' : w === 1 && h === 2 ? 'V' : w === 2 && h === 1 ? 'H' : w === 1 && h === 1 ? 'S' : null;
    if (!t) throw new Error(`block ${ch} has an unknown shape`);
    pieces.push({ ch, t, x, y });
  }
  // stable order: top to bottom, left to right
  pieces.sort((a, b) => a.y - b.y || a.x - b.x);
  return pieces.map((p, id) => ({ id, t: p.t, x: p.x, y: p.y }));
}

export const cellsOf = (t, x, y) => {
  const [w, h] = DIMS[t];
  const out = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) out.push((y + j) * COLS + x + i);
  return out;
};

export function occupancy(pieces, skipId = -1) {
  const occ = new Array(COLS * ROWS).fill(-1);
  for (const p of pieces) if (p.id !== skipId) for (const c of cellsOf(p.t, p.x, p.y)) occ[c] = p.id;
  return occ;
}

const fits = (occ, t, x, y) => {
  const [w, h] = DIMS[t];
  if (x < 0 || y < 0 || x + w > COLS || y + h > ROWS) return false;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (occ[(y + j) * COLS + x + i] !== -1) return false;
  return true;
};

// Every cell the block can be set down on (other than where it is), each with the sliding path to it.
export function reachable(pieces, id) {
  const p = pieces.find((q) => q.id === id);
  const occ = occupancy(pieces, id);
  const seen = new Map([[p.y * COLS + p.x, null]]);
  const queue = [[p.x, p.y]];
  const out = [];
  for (let qi = 0; qi < queue.length; qi++) {
    const [x, y] = queue[qi];
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy, k = ny * COLS + nx;
      if (seen.has(k) || !fits(occ, p.t, nx, ny)) continue;
      seen.set(k, y * COLS + x);
      queue.push([nx, ny]);
      const path = [];
      for (let c = k; c !== null; c = seen.get(c)) path.push([c % COLS, Math.floor(c / COLS)]);
      path.reverse();
      out.push({ x: nx, y: ny, path });
    }
  }
  return out;
}

export function allMoves(pieces) {
  const out = [];
  for (const p of pieces) for (const r of reachable(pieces, p.id)) out.push({ id: p.id, x: r.x, y: r.y, path: r.path });
  return out;
}

export const isSolved = (pieces) => pieces.some((p) => p.t === 'C' && p.x === GATE.x && p.y === GATE.y);

export function applyMove(pieces, id, x, y) {
  return pieces.map((p) => (p.id === id ? { ...p, x, y } : p));
}

// ---- canonical keys: identical block types are interchangeable --------------------------------------
export function keyOf(pieces) {
  const g = new Array(COLS * ROWS).fill('.');
  for (const p of pieces) for (const c of cellsOf(p.t, p.x, p.y)) g[c] = p.t;
  return g.join('');
}

export function fromKey(key) {
  const seen = new Array(COLS * ROWS).fill(false);
  const pieces = [];
  for (let i = 0; i < key.length; i++) {
    const t = key[i];
    if (t === '.' || seen[i]) continue;
    const x = i % COLS, y = Math.floor(i / COLS);
    for (const c of cellsOf(t, x, y)) seen[c] = true;
    pieces.push({ id: pieces.length, t, x, y });
  }
  return pieces;
}

function neighbours(key) {
  const pieces = fromKey(key);
  const out = [];
  for (const p of pieces) {
    for (const r of reachable(pieces, p.id)) {
      const g = key.split('');
      for (const c of cellsOf(p.t, p.x, p.y)) g[c] = '.';
      for (const c of cellsOf(p.t, r.x, r.y)) g[c] = p.t;
      out.push(g.join(''));
    }
  }
  return out;
}

const GOAL_CELLS = cellsOf('C', GATE.x, GATE.y);
const isGoalKey = (key) => GOAL_CELLS.every((c) => key[c] === 'C');

// Solve a layout completely: explores every position the blocks can reach and works out, for each, how
// many moves remain to the nearest solved position. Returns { dist(key), min, states } or null when the
// layout cannot be solved. `maxStates` stops runaway searches.
export function solve(pieces, maxStates = 400000) {
  const start = keyOf(pieces);
  const index = new Map([[start, 0]]);
  const keys = [start];
  const adj = [];
  const goals = [];
  for (let i = 0; i < keys.length; i++) {
    if (isGoalKey(keys[i])) goals.push(i);
    const list = [];
    for (const k of neighbours(keys[i])) {
      let j = index.get(k);
      if (j === undefined) {
        if (keys.length >= maxStates) return null;
        j = keys.length; index.set(k, j); keys.push(k);
      }
      list.push(j);
    }
    adj.push(list);
  }
  if (!goals.length) return null;
  const d = new Int32Array(keys.length).fill(-1);
  const q = [];
  for (const g of goals) { d[g] = 0; q.push(g); }
  for (let qi = 0; qi < q.length; qi++) for (const j of adj[q[qi]]) if (d[j] < 0) { d[j] = d[q[qi]] + 1; q.push(j); }
  return { states: keys.length, min: d[0], all: () => keys.map((k, i) => [k, d[i]]), dist: (key) => { const j = index.get(key); return j === undefined ? -1 : d[j]; } };
}

// The best next move from the current position, or null when solved / unsolvable from here.
export function bestMove(pieces, sol) {
  const here = sol.dist(keyOf(pieces));
  if (here <= 0) return null;
  let best = null;
  for (const m of allMoves(pieces)) {
    const d = sol.dist(keyOf(applyMove(pieces, m.id, m.x, m.y)));
    if (d >= 0 && d < here && (!best || d < best.d || (d === best.d && m.path.length < best.path.length))) best = { ...m, d };
  }
  return best ? { id: best.id, x: best.x, y: best.y, path: best.path, left: here, after: best.d } : null;
}
