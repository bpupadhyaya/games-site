// N5: an adaptive vocabulary-size estimate with a confidence range.
// Model: the chance that someone knows a word falls smoothly with how rare the word is. With rank r (1 = commonest) and a learner "reach" theta,
//   p(know | r, theta) = 1 / (1 + exp((ln r - theta) / SLOPE))        (about 50% at the word whose ln(rank) equals theta)
// and a multiple-choice answer is right with chance GUESS + (1 - GUESS) * p. The test keeps a probability for every possible theta (a grid),
// asks the next word at the learner's current best guess (where an answer tells the most), and updates after each answer. It stops after
// MIN_Q questions once the estimate is steady (small spread) or at MAX_Q. The vocabulary size is the sum of p over all the words in the list;
// the range is the 80% interval of theta turned into a size the same way. The method is a simple, standard adaptive-testing idea; the
// numbers are a rough guide counted against this app's own word list, not a score from any official test.
export const MIN_Q = 14, MAX_Q = 24, SLOPE = 0.9, GUESS = 1 / 3, SD_STOP = 0.3;
const LO = Math.log(20), STEP = 0.1;

export function createTest(size) {
  const hi = Math.log(Math.max(100, size)) + 0.5, n = Math.ceil((hi - LO) / STEP) + 1;
  const grid = Array.from({ length: n }, (_, i) => LO + i * STEP), post = grid.map(() => 1 / n);
  return { size, grid, post, n: 0, asked: [], answers: [] };
}
const pKnow = (lnr, theta) => 1 / (1 + Math.exp((lnr - theta) / SLOPE));
export function stats(t) {
  let m = 0; for (let i = 0; i < t.grid.length; i += 1) m += t.grid[i] * t.post[i];
  let v = 0; for (let i = 0; i < t.grid.length; i += 1) v += (t.grid[i] - m) ** 2 * t.post[i];
  const q = (p) => { let c = 0; for (let i = 0; i < t.grid.length; i += 1) { c += t.post[i]; if (c >= p) return t.grid[i]; } return t.grid[t.grid.length - 1]; };
  return { mean: m, sd: Math.sqrt(v), lo: q(0.1), hi: q(0.9) };
}
// The rank (0-based) of the next word to ask: at the current best guess, with a little spread so the words differ.
export function nextRank(t, jitter = 0) {
  const { mean } = stats(t);
  return Math.max(0, Math.min(t.size - 1, Math.round(Math.exp(mean + jitter) - 1)));
}
export function record(t, rank, correct) {
  const lnr = Math.log(rank + 1);
  let tot = 0;
  for (let i = 0; i < t.grid.length; i += 1) {
    const pc = GUESS + (1 - GUESS) * pKnow(lnr, t.grid[i]);
    t.post[i] *= correct ? pc : 1 - pc; tot += t.post[i];
  }
  if (tot > 0) for (let i = 0; i < t.post.length; i += 1) t.post[i] /= tot;
  t.n += 1; t.asked.push(rank); t.answers.push(correct ? 1 : 0);
}
export const done = (t) => t.n >= MAX_Q || (t.n >= MIN_Q && stats(t).sd < SD_STOP);
// Expected number of known words for a reach theta over `size` ranked words (sampled every few ranks: exact enough, fast).
export function sizeAt(theta, size) {
  const step = Math.max(1, Math.floor(size / 4000)); let s = 0;
  for (let r = 0; r < size; r += step) s += pKnow(Math.log(r + 1), theta) * step;
  return Math.round(s);
}
// The result: size with its range, how sure the estimate is, and the chance of knowing a typical word of each band.
export function result(t, bandOf = null) {
  const s = stats(t), total = sizeAt(s.mean, t.size), lo = sizeAt(s.lo, t.size), hi = sizeAt(s.hi, t.size);
  const width = (hi - lo) / Math.max(1, total);
  const sure = width < 0.35 ? 'fairly sure' : width < 0.7 ? 'a rough guess' : 'a wide guess';
  const per = bandOf ? bandOf.map((ranks) => (ranks.length ? ranks.reduce((a, r) => a + pKnow(Math.log(r + 1), s.mean), 0) / ranks.length : 0)) : [];
  return { theta: s.mean, sd: s.sd, total, lo: Math.min(lo, total), hi: Math.max(hi, total), sure, per, n: t.n, right: t.answers.reduce((a, b) => a + b, 0) };
}
