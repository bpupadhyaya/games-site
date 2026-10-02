// Exact nonogram line solver. Cell states: 0 unknown, 1 filled, 2 crossed (empty). A puzzle is { w, h, rows, cols }
// where rows[r] / cols[c] are the clue number lists. Used by the puzzle checks, by Think and by Watch & Learn, so every
// hint is a real deduction and no puzzle is ever solved by guessing.

export const UNKNOWN = 0, FILLED = 1, CROSSED = 2;

// Clue numbers of a 0/1 line (empty list when the line has no filled cell).
export function runsOf(bits) {
  const out = [];
  let n = 0;
  for (const b of bits) {
    if (b === 1) n += 1;
    else if (n) { out.push(n); n = 0; }
  }
  if (n) out.push(n);
  return out;
}

// grid: array of strings, any non '.' character is a filled cell.
export function cluesOfGrid(rowsText) {
  const h = rowsText.length, w = rowsText[0].length;
  const bit = (r, c) => (rowsText[r][c] !== '.' && rowsText[r][c] !== ' ' ? 1 : 0);
  const rows = [], cols = [];
  for (let r = 0; r < h; r++) rows.push(runsOf(Array.from({ length: w }, (_, c) => bit(r, c))));
  for (let c = 0; c < w; c++) cols.push(runsOf(Array.from({ length: h }, (_, r) => bit(r, c))));
  return { w, h, rows, cols };
}

// Which values each cell of the line can take in some arrangement of the clue that agrees with the marks.
// Returns null when no arrangement exists (a mark is wrong), else { fill, empty } as arrays of booleans.
export function possibilities(clue, line) {
  const n = line.length, k = clue.length;
  const idx = (i, j) => i * (k + 1) + j;
  const F = new Uint8Array((n + 1) * (k + 1));
  const B = new Uint8Array((n + 1) * (k + 1));
  const fits = (i, j) => {
    const len = clue[j];
    if (i + len > n) return false;
    for (let t = i; t < i + len; t++) if (line[t] === CROSSED) return false;
    return i + len === n || line[i + len] !== FILLED;
  };
  const next = (i, j) => (i + clue[j] >= n ? n : i + clue[j] + 1);
  // backward: can the rest (cells i.., blocks j..) be arranged
  B[idx(n, k)] = 1;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = 0; j <= k; j++) {
      let ok = line[i] !== FILLED && B[idx(i + 1, j)] === 1;
      if (!ok && j < k && fits(i, j) && B[idx(next(i, j), j + 1)] === 1) ok = true;
      if (ok) B[idx(i, j)] = 1;
    }
  }
  // the last cell can only be reached through a state with i === n
  if (!B[idx(0, 0)]) return null;
  const fill = new Array(n).fill(false), empty = new Array(n).fill(false);
  F[idx(0, 0)] = 1;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= k; j++) {
      if (!F[idx(i, j)]) continue;
      if (line[i] !== FILLED && B[idx(i + 1, j)]) { empty[i] = true; F[idx(i + 1, j)] = 1; }
      if (j < k && fits(i, j)) {
        const ni = next(i, j);
        if (B[idx(ni, j + 1)]) {
          for (let t = i; t < i + clue[j]; t++) fill[t] = true;
          if (i + clue[j] < n) empty[i + clue[j]] = true;
          F[idx(ni, j + 1)] = 1;
        }
      }
    }
  }
  return { fill, empty };
}

// One pass over a line: the cells that are now certain. Returns null on contradiction, else a list of { i, v }.
export function deduceLine(clue, line) {
  const p = possibilities(clue, line);
  if (!p) return null;
  const out = [];
  for (let i = 0; i < line.length; i++) {
    if (line[i] !== UNKNOWN) continue;
    if (p.fill[i] && !p.empty[i]) out.push({ i, v: FILLED });
    else if (p.empty[i] && !p.fill[i]) out.push({ i, v: CROSSED });
  }
  return out;
}

export const lineOf = (puz, st, axis, k) => {
  const out = [];
  if (axis === 'row') for (let c = 0; c < puz.w; c++) out.push(st[k * puz.w + c]);
  else for (let r = 0; r < puz.h; r++) out.push(st[r * puz.w + k]);
  return out;
};
export const cellIndex = (puz, axis, k, i) => (axis === 'row' ? k * puz.w + i : i * puz.w + k);

// Repeat line deductions to a fixed point. Mutates st. Returns 'solved' | 'stuck' | 'contradiction'.
export function propagate(puz, st) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const axis of ['row', 'col']) {
      const count = axis === 'row' ? puz.h : puz.w;
      for (let k = 0; k < count; k++) {
        const d = deduceLine(axis === 'row' ? puz.rows[k] : puz.cols[k], lineOf(puz, st, axis, k));
        if (!d) return 'contradiction';
        for (const { i, v } of d) { st[cellIndex(puz, axis, k, i)] = v; changed = true; }
      }
    }
  }
  return st.includes(UNKNOWN) ? 'stuck' : 'solved';
}

// Number of solutions, stopping at `limit`. Exact (line logic plus search).
export function countSolutions(puz, limit = 2, start = null) {
  const st = start ? Uint8Array.from(start) : new Uint8Array(puz.w * puz.h);
  let found = 0;
  const walk = (s) => {
    if (found >= limit) return;
    const res = propagate(puz, s);
    if (res === 'contradiction') return;
    if (res === 'solved') { found += 1; return; }
    const at = s.indexOf(UNKNOWN);
    for (const v of [FILLED, CROSSED]) {
      const t = Uint8Array.from(s);
      t[at] = v;
      walk(t);
    }
  };
  walk(st);
  return found;
}

export function solveFully(puz) {
  const st = new Uint8Array(puz.w * puz.h);
  return { status: propagate(puz, st), cells: st };
}

// Is the board a finished, correct picture? Every row and column run matches its clue (crosses and blanks both count as empty).
export function isSolved(puz, st) {
  for (let r = 0; r < puz.h; r++) if (!sameRuns(runsOf(lineOf(puz, st, 'row', r).map((v) => (v === FILLED ? 1 : 0))), puz.rows[r])) return false;
  for (let c = 0; c < puz.w; c++) if (!sameRuns(runsOf(lineOf(puz, st, 'col', c).map((v) => (v === FILLED ? 1 : 0))), puz.cols[c])) return false;
  return true;
}
const sameRuns = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// A line whose filled cells already spell its clue exactly (used to dim finished clues).
export function lineDone(puz, st, axis, k) {
  const line = lineOf(puz, st, axis, k);
  return sameRuns(runsOf(line.map((v) => (v === FILLED ? 1 : 0))), axis === 'row' ? puz.rows[k] : puz.cols[k]);
}

// ----------------------------------------------------------------------------------------------- explained steps
const minLen = (clue) => clue.reduce((a, b) => a + b, 0) + Math.max(0, clue.length - 1);

// Why a deduction in this line holds, as a technique id plus numbers the text needs. `d` = the new cells.
export function explainLine(clue, line, d) {
  const n = line.length;
  const fills = d.filter((x) => x.v === FILLED), crosses = d.filter((x) => x.v === CROSSED);
  if (!clue.length) return { tech: 'zero', n };
  const need = minLen(clue), slack = n - need;
  if (slack === 0) return { tech: 'full', n, need, clue };
  const filledBits = line.map((v) => (v === FILLED ? 1 : 0));
  if (sameRuns(runsOf(filledBits), clue) && !fills.length) return { tech: 'complete', clue };
  // overlap: forced without looking at any mark
  const blank = new Array(n).fill(UNKNOWN);
  const base = deduceLine(clue, blank) ?? [];
  const baseFill = new Set(base.filter((x) => x.v === FILLED).map((x) => x.i));
  if (fills.length && fills.every((x) => baseFill.has(x.i))) {
    let best = 0, from = 0;
    let lead = 0;
    clue.forEach((len, j) => { if (len - slack > best) { best = len - slack; from = j; } lead += 0; });
    let start = 0;
    for (let j = 0; j < from; j++) start += clue[j] + 1;
    return { tech: 'overlap', n, need, slack, block: clue[from], nth: from + 1, count: clue.length, cells: best, rightStart: start + slack };
  }
  // edge: a filled cell touches an end of the line (or sits right after a crossed end)
  const first = line.findIndex((v) => v !== CROSSED), last = n - 1 - [...line].reverse().findIndex((v) => v !== CROSSED);
  const edgeFill = fills.some((x) => (line[first] === FILLED && x.i >= first && x.i < first + clue[0]) || (line[last] === FILLED && x.i <= last && x.i > last - clue[clue.length - 1]));
  const edgeCross = crosses.some((x) => (line[first] === FILLED && x.i === first + clue[0]) || (line[last] === FILLED && x.i === last - clue[clue.length - 1]));
  if (edgeFill || edgeCross) {
    const atStart = line[first] === FILLED;
    return { tech: 'edge', block: atStart ? clue[0] : clue[clue.length - 1], side: atStart ? 'start' : 'end', fills: edgeFill, crosses: edgeCross, shifted: atStart ? first > 0 : last < n - 1 };
  }
  // gaps: a run of open cells is too short for the smallest block
  const smallest = Math.min(...clue);
  if (crosses.length) {
    for (const x of crosses) {
      let a = x.i, b = x.i;
      while (a > 0 && line[a - 1] !== CROSSED) a--;
      while (b < n - 1 && line[b + 1] !== CROSSED) b++;
      const run = b - a + 1;
      if (run < smallest && !line.slice(a, b + 1).includes(FILLED)) return { tech: 'gap', run, smallest };
    }
  }
  // finished blocks: every block is placed, so the rest is empty
  return { tech: 'general', n, clue };
}

// The best next deduction on the board, or null (nothing certain), or { bad: [{axis,k}] } when a mark contradicts a clue.
// "Best" = the line giving the most new cells; ties go to rows, then to the lowest index, so it is deterministic.
export function nextStep(puz, st) {
  let best = null;
  for (const axis of ['row', 'col']) {
    const count = axis === 'row' ? puz.h : puz.w;
    for (let k = 0; k < count; k++) {
      const clue = axis === 'row' ? puz.rows[k] : puz.cols[k];
      const line = lineOf(puz, st, axis, k);
      const d = deduceLine(clue, line);
      if (!d) return { bad: { axis, k } };
      if (!d.length) continue;
      const score = d.length + (d.length === line.filter((v) => v === UNKNOWN).length ? 0.5 : 0);
      if (!best || score > best.score) best = { axis, k, d, score, clue, line };
    }
  }
  if (!best) return null;
  return { axis: best.axis, k: best.k, cells: best.d.map((x) => ({ at: cellIndex(puz, best.axis, best.k, x.i), i: x.i, v: x.v })), why: explainLine(best.clue, best.line, best.d), clue: best.clue, line: best.line };
}

// Applies a step to the board.
export function applyStep(st, step) { for (const c of step.cells) st[c.at] = c.v; }
