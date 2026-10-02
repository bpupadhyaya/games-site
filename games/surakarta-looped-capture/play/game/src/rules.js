// The Surakarta rules engine. Pure and deterministic. Points are numbered 0..35, index = row * 6 + col,
// row 0 at the top of the board. Side 1 (Light) starts on rows 4-5 and moves first; side 2 (Dark) starts on rows 0-1.
//
// Circuits: the lines numbered 1 and 4 (second from each edge) form the OUTER circuit, joined at the corners by the
// small loops; the lines numbered 2 and 3 form the INNER circuit, joined by the large loops. The edge lines (0 and 5)
// are on no circuit, so the four corner points can neither capture nor be captured.
// A capture travels along one line of a circuit over empty points, MUST pass round at least one loop, and lands on
// the first enemy piece it meets. The moving piece's own starting point counts as empty when it is passed over again.

export const N = 6;
export const NN = 36;
export const QUIET_LIMIT = 60; // plies without a capture before the game is decided on pieces
export const START_COUNT = 12;

export const other = (w) => 3 - w;
export const idx = (c, r) => r * N + c;
export const colOf = (i) => i % N;
export const rowOf = (i) => Math.floor(i / N);

// Which lines (1..4) a point lies on: onRow = its row is a circuit line, onCol = its column is.
export const onRowLine = (i) => rowOf(i) >= 1 && rowOf(i) <= 4;
export const onColLine = (i) => colOf(i) >= 1 && colOf(i) <= 4;
export const onCircuit = (i) => onRowLine(i) || onColLine(i);
// A point on a row line and column line of different circuits belongs to both circuits.
export const circuitOfLine = (k) => (k === 1 || k === 4 ? 'outer' : 'inner');

export function startState() {
  const cells = new Array(NN).fill(0);
  for (let c = 0; c < N; c++) {
    cells[idx(c, 0)] = 2; cells[idx(c, 1)] = 2;
    cells[idx(c, 4)] = 1; cells[idx(c, 5)] = 1;
  }
  return { cells, turn: 1, quiet: 0, ply: 0 };
}

export function parse(str, turn = 1, quiet = 0) {
  const flat = str.replace(/[\s/]/g, '');
  const cells = flat.split('').map((ch) => (ch === 'X' ? 1 : ch === 'O' ? 2 : 0));
  return { cells, turn, quiet, ply: 0 };
}

export const countOf = (cells, who) => { let n = 0; for (let i = 0; i < NN; i++) if (cells[i] === who) n++; return n; };

// ---------------------------------------------------------------------------------------------- loops
// Leaving the board along a circuit line, the piece goes round a three-quarter loop centred on a corner and comes
// back on the matching line. Returns the point where it re-enters and its new heading, plus the loop's geometry.
// Headings: [dx, dy] with y growing downward.
function loopExit(c, r, dx, dy) {
  // (c, r) is the last on-board point; (dx, dy) the heading that takes it off the board.
  if (dx === -1) { // off the left edge along row r
    return r <= 2 ? { c: r, r: 0, dx: 0, dy: 1, cx: 0, cy: 0, k: r } : { c: 5 - r, r: 5, dx: 0, dy: -1, cx: 0, cy: 5, k: 5 - r };
  }
  if (dx === 1) { // off the right edge
    return r <= 2 ? { c: 5 - r, r: 0, dx: 0, dy: 1, cx: 5, cy: 0, k: r } : { c: r, r: 5, dx: 0, dy: -1, cx: 5, cy: 5, k: 5 - r };
  }
  if (dy === -1) { // off the top edge along column c
    return c <= 2 ? { c: 0, r: c, dx: 1, dy: 0, cx: 0, cy: 0, k: c } : { c: 5, r: 5 - c, dx: -1, dy: 0, cx: 5, cy: 0, k: 5 - c };
  }
  // off the bottom edge
  return c <= 2 ? { c: 0, r: 5 - c, dx: 1, dy: 0, cx: 0, cy: 5, k: c } : { c: 5, r: c, dx: -1, dy: 0, cx: 5, cy: 5, k: 5 - c };
}

const HEADINGS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const MAX_WALK = 30;

// Walk every circuit path that starts at point `from` for side `who`. For every enemy piece it can capture, `emit`
// receives (to, loops, steps, headingIndex). When `trace` is given the path is recorded for the emitted capture.
function walkCaptures(cells, from, who, emit) {
  if (!onCircuit(from)) return;
  const c0 = colOf(from), r0 = rowOf(from);
  for (let h = 0; h < 4; h++) {
    const [dx0, dy0] = HEADINGS[h];
    if (dx0 !== 0 ? !onRowLine(from) : !onColLine(from)) continue;
    let c = c0, r = r0, dx = dx0, dy = dy0, loops = 0;
    for (let step = 1; step <= MAX_WALK; step++) {
      let nc = c + dx, nr = r + dy;
      if (nc < 0 || nc > 5 || nr < 0 || nr > 5) {
        const e = loopExit(c, r, dx, dy);
        nc = e.c; nr = e.r; dx = e.dx; dy = e.dy; loops++;
      }
      c = nc; r = nr;
      const p = r * N + c;
      if (p === from) continue;
      const v = cells[p];
      if (v === 0) continue;
      if (v === who) break;
      if (loops >= 1) emit(p, loops, step, h);
      break;
    }
  }
}

// All legal moves for the side to move: { from, to, cap }. Steps first, then captures. No routes (fast, for search).
export function genMoves(cells, who, caps = false) {
  const out = [];
  for (let i = 0; i < NN; i++) {
    if (cells[i] !== who) continue;
    walkCaptures(cells, i, who, (to) => { if (!out.some((m) => m.from === i && m.to === to)) out.push({ from: i, to, cap: true }); });
    if (caps) continue;
    const c = colOf(i), r = rowOf(i);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nc = c + dx, nr = r + dy;
        if (nc < 0 || nc > 5 || nr < 0 || nr > 5) continue;
        const to = nr * N + nc;
        if (cells[to] === 0) out.push({ from: i, to, cap: false });
      }
    }
  }
  return out;
}

export const legalMoves = (st) => genMoves(st.cells, st.turn);
export const captureMoves = (st) => genMoves(st.cells, st.turn, true);

// Squares of `who`'s pieces that the opponent could capture right now, and enemy pieces `who` could capture.
export function attackedBy(cells, attacker) {
  const set = new Set();
  for (let i = 0; i < NN; i++) if (cells[i] === attacker) walkCaptures(cells, i, attacker, (to) => set.add(to));
  return set;
}

// The full route of a capture, as a list of nodes for drawing and animation: the shortest path from `from` to `to`.
// Node: { c, r } an on-board point, or { arc: { cx, cy, k, sc, sr, ec, er } } a loop between two points (start / end
// points are the on-board points at either end of it). Returns null when there is no capture route.
export function captureRoute(cells, from, to, who) {
  if (!onCircuit(from)) return null;
  let best = null;
  const c0 = colOf(from), r0 = rowOf(from);
  for (let h = 0; h < 4; h++) {
    const [dx0, dy0] = HEADINGS[h];
    if (dx0 !== 0 ? !onRowLine(from) : !onColLine(from)) continue;
    let c = c0, r = r0, dx = dx0, dy = dy0, loops = 0;
    const nodes = [{ c, r }];
    for (let step = 1; step <= MAX_WALK; step++) {
      let nc = c + dx, nr = r + dy;
      if (nc < 0 || nc > 5 || nr < 0 || nr > 5) {
        const e = loopExit(c, r, dx, dy);
        nodes.push({ arc: { cx: e.cx, cy: e.cy, k: e.k, sc: c, sr: r, ec: e.c, er: e.r, hx: dx, hy: dy } });
        nc = e.c; nr = e.r; dx = e.dx; dy = e.dy; loops++;
      }
      c = nc; r = nr;
      nodes.push({ c, r });
      const p = r * N + c;
      if (p === from) continue;
      const v = cells[p];
      if (v === 0) continue;
      if (v === who) break;
      if (v !== who && loops >= 1 && p === to) { if (!best || nodes.length < best.length) best = nodes.slice(); }
      break;
    }
  }
  return best;
}

// Same moves as genMoves but each capture carries its route.
export function legalMovesWithRoutes(st) {
  const ms = genMoves(st.cells, st.turn);
  for (const m of ms) if (m.cap) m.route = captureRoute(st.cells, m.from, m.to, st.turn);
  return ms;
}

export function applyMove(st, mv) {
  const cells = st.cells.slice();
  const cap = cells[mv.to] !== 0;
  cells[mv.to] = cells[mv.from]; cells[mv.from] = 0;
  return { cells, turn: other(st.turn), quiet: cap ? 0 : st.quiet + 1, ply: st.ply + 1 };
}

export function keyOf(st) { return `${st.cells.join('')}${st.turn}`; }

// The outcome of a position: null while play continues, else { winner (0 = draw), why }.
export function result(st) {
  const a = countOf(st.cells, 1), b = countOf(st.cells, 2);
  if (a === 0) return { winner: 2, why: 'captured' };
  if (b === 0) return { winner: 1, why: 'captured' };
  if (st.quiet >= QUIET_LIMIT) return { winner: a > b ? 1 : b > a ? 2 : 0, why: 'limit' };
  if (!genMoves(st.cells, st.turn).length) return { winner: other(st.turn), why: 'blocked' };
  return null;
}

export const SIDE_NAMES = { 1: 'Light', 2: 'Dark' };
export const sideName = (w) => SIDE_NAMES[w] ?? '';

// Geometry of a route in grid units (x right, y down): list of polyline points, sampled. Arcs are three-quarter circles.
export function routePoints(route, perArc = 28) {
  const pts = [];
  for (const n of route) {
    if (n.arc) {
      const a = n.arc;
      // start = the last on-board point (sc, sr); the loop leaves it along heading (hx, hy), centre (cx, cy), radius k.
      const a0 = Math.atan2(a.sr - a.cy, a.sc - a.cx);
      const tx = -Math.sin(a0), ty = Math.cos(a0);
      const sgn = tx * a.hx + ty * a.hy >= 0 ? 1 : -1;
      for (let i = 1; i < perArc; i++) {
        const ang = a0 + sgn * 1.5 * Math.PI * (i / perArc);
        pts.push({ x: a.cx + a.k * Math.cos(ang), y: a.cy + a.k * Math.sin(ang) });
      }
    } else pts.push({ x: n.c, y: n.r });
  }
  return pts;
}
