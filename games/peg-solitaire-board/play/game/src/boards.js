// Board shapes for Peg Solitaire. A board is a set of holes on a lattice plus the jump directions of that lattice.
// Everything here is pure data + a one-time build of the jump table: for every hole, the (from, over, to) triples a peg can use.
// Square-lattice boards jump along the 4 rows/columns; the triangular board adds the 2 diagonals of its lattice (6 directions).
const SQUARE = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const TRI = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]];

const fromRows = (rows) => { const cells = []; rows.forEach((s, y) => { for (let x = 0; x < s.length; x++) if (s[x] === 'o') cells.push([x, y]); }); return cells; };
const band = (n, lens) => lens.map((k) => ' '.repeat((n - k) / 2) + 'o'.repeat(k) + ' '.repeat((n - k) / 2));

const DEFS = [
  { id: 'triangle', name: 'Triangle', short: '15 holes', cells: [].concat(...[0, 1, 2, 3, 4].map((r) => Array.from({ length: r + 1 }, (_, c) => [c, r]))), dirs: TRI, tri: true,
    blurb: 'The small triangular board: three directions of jump, quick to learn.' },
  { id: 'english', name: 'English', short: '33 holes', cells: fromRows(band(7, [3, 3, 7, 7, 7, 3, 3])), dirs: SQUARE,
    blurb: 'The cross of 33 holes most people picture first.' },
  { id: 'french', name: 'French', short: '37 holes', cells: fromRows(band(7, [3, 5, 7, 7, 7, 5, 3])), dirs: SQUARE,
    blurb: 'The European board: the English cross with four extra corner holes.' },
  { id: 'diamond', name: 'Diamond', short: '41 holes', cells: fromRows(band(9, [1, 3, 5, 7, 9, 7, 5, 3, 1])), dirs: SQUARE,
    blurb: 'A diamond of 41 holes that rewards planning from the edges inward.' },
  { id: 'cross', name: 'Grand Cross', short: '45 holes', cells: fromRows(band(9, [3, 3, 3, 9, 9, 9, 3, 3, 3])), dirs: SQUARE,
    blurb: 'A larger cross of 45 holes for long, patient games.' },
];

function build(def) {
  const idx = new Map(); def.cells.forEach(([x, y], i) => idx.set(x + ',' + y, i));
  const jumps = [], byFrom = def.cells.map(() => []);
  def.cells.forEach(([x, y], i) => {
    for (const [dx, dy] of def.dirs) {
      const o = idx.get((x + dx) + ',' + (y + dy)), t = idx.get((x + 2 * dx) + ',' + (y + 2 * dy));
      if (o !== undefined && t !== undefined) { const j = { from: i, over: o, to: t }; jumps.push(j); byFrom[i].push(j); }
    }
  });
  // drawing coordinates in hole-pitch units (triangle rows are offset by half a hole and a row is 0.866 tall)
  const pos = def.cells.map(([x, y]) => (def.tri ? { x: x - y / 2, y: y * 0.8660254 } : { x, y }));
  const xs = pos.map((p) => p.x), ys = pos.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = maxX - minX, spanY = maxY - minY;
  pos.forEach((p) => { p.x -= minX + spanX / 2; p.y -= minY + spanY / 2; });   // centred on (0,0)
  if (def.tri) pos.forEach((p) => { p.y += 0.4; });                            // the rounded triangle round the holes is then centred too (see art.js boardShape)
  // the centre-most hole is the traditional starting hole
  let centre = 0, best = Infinity; pos.forEach((p, i) => { const d = p.x * p.x + p.y * p.y; if (d < best - 1e-9) { best = d; centre = i; } });
  return { ...def, n: def.cells.length, jumps, byFrom, pos, spanX, spanY, centre, idx };
}

export const BOARDS = DEFS.map(build);
export const boardById = (id) => BOARDS.find((b) => b.id === id) ?? BOARDS[1];
