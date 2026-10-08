// Bulls and Cows engine: pure and deterministic. Codes are packed 4 bits per digit (position 0 in the lowest nibble).
// bulls = right digit in the right place; cows = right digit in a different place (repeats follow the usual Mastermind counting).
export const GRADES = [
  null,
  { id: 1, name: 'Easy', len: 3, rep: false, tries: 10, ctries: 5, par: 4, tag: 'Three digits', text: 'Three different digits from 0 to 9. A gentle start.' },
  { id: 2, name: 'Classic', len: 4, rep: false, tries: 10, ctries: 5, par: 6, tag: 'The original', text: 'Four different digits. The classic game.' },
  { id: 3, name: 'Hard', len: 5, rep: false, tries: 12, ctries: 6, par: 7, tag: 'Five digits', text: 'Five different digits: thirty thousand possible codes.' },
  { id: 4, name: 'Expert', len: 6, rep: false, tries: 14, ctries: 7, par: 9, tag: 'Six digits', text: 'Six different digits: over a hundred thousand codes.' },
  { id: 5, name: 'Master', len: 5, rep: true, tries: 12, ctries: 6, par: 8, tag: 'Repeats allowed', text: 'Five digits and any digit may repeat. A hundred thousand codes.' },
];

export const pack = (arr) => arr.reduce((p, d, i) => p | (d << (4 * i)), 0);
export const unpack = (p, len) => { const a = []; for (let i = 0; i < len; i++) a.push((p >> (4 * i)) & 15); return a; };
export const fbB = (fb) => fb >> 3;
export const fbC = (fb) => fb & 7;
export const mkFb = (b, c) => b * 8 + c;

const cs = new Uint8Array(10), cg = new Uint8Array(10);
// Feedback code (bulls * 8 + cows) of `guess` against `secret`, both packed.
export function scoreP(secret, guess, len) {
  let bulls = 0; cs.fill(0); cg.fill(0);
  for (let i = 0; i < len; i++) {
    const a = (secret >> (4 * i)) & 15, b = (guess >> (4 * i)) & 15;
    if (a === b) bulls += 1; else { cs[a] += 1; cg[b] += 1; }
  }
  let cows = 0;
  for (let d = 0; d < 10; d++) cows += cs[d] < cg[d] ? cs[d] : cg[d];
  return bulls * 8 + cows;
}
export const scoreA = (secret, guess) => scoreP(pack(secret), pack(guess), secret.length);

const allCache = new Map();
export function allCodes(len, rep) {
  const key = len + (rep ? 'r' : 'd');
  let out = allCache.get(key);
  if (out) return out;
  out = [];
  const go = (pos, p, used) => {
    if (pos === len) { out.push(p); return; }
    for (let d = 0; d < 10; d++) { if (!rep && used & (1 << d)) continue; go(pos + 1, p | (d << (4 * pos)), used | (1 << d)); }
  };
  go(0, 0, 0);
  allCache.set(key, out);
  return out;
}

export function validCode(arr, grade) {
  if (arr.length !== grade.len || arr.some((d) => !(d >= 0 && d <= 9))) return false;
  return grade.rep || new Set(arr).size === arr.length;
}
export function randomCode(rng, grade) {
  if (grade.rep) return Array.from({ length: grade.len }, () => rng.int(10));
  return rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, grade.len);
}
// Daily code: depends only on the day number and the grade, never on the play history.
export function dailyCode(day, grade) {
  let a = (Math.imul(day + 1, 2654435761) ^ Math.imul(grade.id, 40503) ^ 0x9e3779b9) >>> 0;
  const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  if (grade.rep) return Array.from({ length: grade.len }, () => Math.floor(next() * 10));
  const d = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = 9; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d.slice(0, grade.len);
}

// ---- the solver: keeps every code that still fits all clues -----------------------------------------------------------------------
export function newSolver(grade) { return { grade, cands: allCodes(grade.len, grade.rep), rows: [] }; }
export function addClue(solver, guessArr, fb) {
  const g = pack(guessArr), len = solver.grade.len;
  solver.cands = solver.cands.filter((c) => scoreP(c, g, len) === fb);
  solver.rows.push({ g: guessArr.slice(), fb });
}
export function solverFrom(grade, rows) { const s = newSolver(grade); for (const r of rows) addClue(s, r.g, r.fb); return s; }

const part = new Int32Array(64);
function expected(g, secrets, len) {
  part.fill(0);
  for (let i = 0; i < secrets.length; i++) part[scoreP(secrets[i], g, len)] += 1;
  let sq = 0;
  for (let i = 0; i < 64; i++) sq += part[i] * part[i];
  return sq / secrets.length;
}
// The computer's next guess. Opening: an all-different pattern under a random relabelling of the digits (so it is never the same twice).
// Afterwards: from a sample of the still-possible codes (plus a few probe codes while many remain) take the guess whose answer
// splits the remaining codes into the smallest groups.
export function pickGuess(solver, rng) {
  const { grade, cands } = solver, len = grade.len;
  if (!solver.rows.length) {
    const perm = rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const pattern = grade.rep ? [0, 0, 1, 1, 2].slice(0, len) : Array.from({ length: len }, (_, i) => i);
    return rng.shuffle(pattern.map((i) => perm[i]));
  }
  const n = cands.length;
  if (n <= 2) return unpack(cands[rng.int(n)], len);
  const pick = (k) => { const out = []; if (n <= k) return cands.slice(); for (let i = 0; i < k; i++) out.push(cands[rng.int(n)]); return out; };
  const secrets = pick(360), pool = pick(n <= 40 ? n : 40).map((p) => ({ p, cand: true }));
  if (n > 12) for (let i = 0; i < 14; i++) pool.push({ p: pack(randomCode(rng, grade)), cand: false });
  let best = null, bestE = Infinity;
  for (const g of pool) {
    const e = expected(g.p, secrets, len) * (g.cand ? 1 - 1 / n : 1);
    if (e < bestE - 1e-9) { bestE = e; best = g; }
  }
  return unpack(best.p, len);
}

// ---- coach: what the clues prove ------------------------------------------------------------------------------------------------
export function analyze(solver) {
  const { grade, cands, rows } = solver, len = grade.len, n = cands.length;
  const has = new Array(10).fill(0), posMask = new Array(len).fill(0);
  for (let i = 0; i < n; i++) {
    const c = cands[i]; let seen = 0;
    for (let k = 0; k < len; k++) { const d = (c >> (4 * k)) & 15; posMask[k] |= 1 << d; if (!(seen & (1 << d))) { seen |= 1 << d; has[d] += 1; } }
  }
  const inAll = [], inNone = [], pinned = [];
  for (let d = 0; d < 10; d++) { if (n && has[d] === n) inAll.push(d); if (!has[d]) inNone.push(d); }
  for (let k = 0; k < len; k++) { const m = posMask[k]; if (n > 1 && m && !(m & (m - 1))) pinned.push({ pos: k, digit: Math.log2(m) | 0 }); }
  const zeroRows = [];
  rows.forEach((r, i) => { if (r.fb === 0) zeroRows.push(i); });
  const fullRows = [];
  if (!grade.rep) rows.forEach((r, i) => { if (fbB(r.fb) + fbC(r.fb) === len) fullRows.push(i); });
  return { n, inAll, inNone, pinned, zeroRows, fullRows, has, posMask };
}

const list = (a) => (a.length === 1 ? String(a[0]) : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
const ord = (k) => `guess ${k + 1}`;
// Facts the clues prove, most useful first. `told` holds keys already given to this player.
export function coachFacts(solver, told, rng) {
  const A = analyze(solver), { rows, grade } = solver, out = [];
  if (A.n === 1) {
    const code = unpack(solver.cands[0], grade.len);
    out.push({ key: 'solved', code, rows: [], digits: code, pos: -1, look: 'Look at all your clues together. Only one code fits every one of them.', why: `Check each earlier guess against ${code.join(' ')}: every bulls and cows count matches. No other code does, so this is the secret.` });
  }
  for (const i of A.zeroRows) {
    const digs = [...new Set(rows[i].g)];
    out.push({ key: 'zero:' + i, rows: [i], digits: digs, pos: -1, look: `Look at ${ord(i)}. It scored nothing at all.`, why: `No bulls and no cows means none of its digits (${list(digs)}) is in the code. Cross ${digs.length === 1 ? 'it' : 'them'} off for good.` });
  }
  for (const i of A.fullRows) {
    if (A.n > 1) out.push({ key: 'full:' + i, rows: [i], digits: [...new Set(rows[i].g)], pos: -1, look: `Look at ${ord(i)}. Its bulls and cows add up to ${grade.len}.`, why: `All ${grade.len} digits of ${ord(i)} are in the code, only their order is wrong. The other digits can be crossed off, and only the order is left to find.` });
  }
  for (const p of A.pinned) {
    out.push({ key: `pin:${p.pos}:${p.digit}`, rows: [], digits: [p.digit], pos: p.pos, look: `Look at position ${p.pos + 1}. Only one digit can sit there.`, why: `Every code that fits your clues has ${p.digit} in position ${p.pos + 1}. Try each other digit there against the clues and a bull or cow count breaks.` });
  }
  const inD = A.inAll.filter((d) => !out.some((f) => f.key.startsWith('full')));
  if (inD.length && A.n > 1) out.push({ key: 'in:' + inD.join(''), rows: [], digits: inD, pos: -1, look: `${inD.length === 1 ? 'One digit is' : 'Some digits are'} certain to be in the code.`, why: `Every code that fits your clues contains ${list(inD)}. Without ${inD.length === 1 ? 'it' : 'them'} the bulls and cows you have seen could not add up.` });
  const zeroDigits = new Set(A.zeroRows.flatMap((i) => rows[i].g));
  const outD = A.inNone.filter((d) => !zeroDigits.has(d) && !(A.n === 1) && rows.some((r) => r.g.includes(d)));
  if (outD.length) out.push({ key: 'out:' + outD.join(''), rows: [], digits: outD, pos: -1, look: `${outD.length === 1 ? 'A digit you tried' : 'Some digits you tried'} can be ruled out.`, why: `If ${list(outD)} were in the code, one of your clues would have to read differently. Cross ${outD.length === 1 ? 'it' : 'them'} off.` });
  const fact = out.find((f) => !told.includes(f.key));
  if (fact) return fact;
  if (A.n === 0) return { key: 'none', rows: [], digits: [], pos: -1, look: 'No code fits all your clues.', why: 'Some count was probably entered or read wrongly. Compare each clue with its guess again.' };
  const sg = solver.rows.length || A.n < 2 ? pickGuess(solver, rng) : pickGuess(solver, rng);
  return { key: 'suggest:' + rows.length, suggest: sg, rows: [], digits: [...new Set(sg)], pos: -1, look: `No digit is certain yet. ${A.n} codes still fit your clues.`, why: `Try ${sg.join(' ')}. It could be the code, and whatever the answer is, it cuts the remaining ${A.n} codes into small groups. Tap Use guess to place it.` };
}

// The first earlier clue a guess contradicts (so it cannot be the code), or -1.
export function contradicts(rows, guess) {
  for (let i = 0; i < rows.length; i++) if (scoreA(rows[i].g, guess) !== rows[i].fb) return i;
  return -1;
}

// Per guess position: 'bull', 'cow' or 'none' (cows are handed out left to right, each secret digit matched once).
export function classify(secret, guess) {
  const out = guess.map(() => 'none'), left = new Array(10).fill(0);
  guess.forEach((d, i) => { if (secret[i] === d) out[i] = 'bull'; else left[secret[i]] += 1; });
  guess.forEach((d, i) => { if (out[i] === 'none' && left[d] > 0) { out[i] = 'cow'; left[d] -= 1; } });
  return out;
}
