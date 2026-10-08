// Per-word memory: a Leitner box (spaced repetition), how often a word was met, and how fast it was answered.
// A record is a compact array so thousands of words stay small on the device:
//   [box, due, right, wrong, avgMs, lastDay, seen, checked, known]
// box 0..7, due/lastDay = day number (days since 1970, from env.config.day), avgMs = mean answer time in ms.
export const INTERVALS = [0, 1, 2, 4, 8, 16, 32, 64];       // days until the next review per box
export const STAGES = ['new', 'seen', 'learning', 'familiar', 'mastered', 'maintained'];
export const STAGE_BLURB = {
  new: 'Not met yet', seen: 'Met, not yet answered right', learning: 'Getting there', familiar: 'Mostly right', mastered: 'Reliably right', maintained: 'Mastered, re-checked at long intervals',
};
const F = { box: 0, due: 1, right: 2, wrong: 3, ms: 4, last: 5, seen: 6, chk: 7, known: 8 };

export const blank = () => [0, 0, 0, 0, 0, 0, 0, 0, 0];
export function stageOf(r) {
  if (!r || (!r[F.seen] && !r[F.right])) return 'new';
  if (r[F.known]) return 'mastered';
  const b = r[F.box];
  if (b >= 7) return 'maintained';
  if (b >= 5) return 'mastered';
  if (b >= 3) return 'familiar';
  if (b >= 1) return 'learning';
  return 'seen';
}
// Record one answer. `ms` is the time the player took (0 when unknown). Returns the record.
export function applyAnswer(records, word, correct, ms, day) {
  const r = (records[word] ??= blank());
  const n = r[F.right] + r[F.wrong];
  if (correct) {
    r[F.right] += 1; r[F.box] = Math.min(7, r[F.box] + 1);
    if (ms > 0) r[F.ms] = Math.round((r[F.ms] * n + ms) / (n + 1));
    r[F.due] = day + INTERVALS[r[F.box]];
  } else {
    r[F.wrong] += 1; r[F.box] = r[F.box] >= 3 ? r[F.box] - 2 : 0;
    r[F.due] = day + 1;
  }
  r[F.seen] += 1; r[F.last] = day;
  return r;
}
export function noteSeen(records, word, day) {
  const r = (records[word] ??= blank());
  r[F.seen] += 1; r[F.last] = day; return r;
}
export function noteChecked(records, word, day) {
  const r = (records[word] ??= blank());
  r[F.chk] += 1; r[F.last] = day; if (!r[F.seen]) r[F.seen] = 1; return r;
}
export function setKnown(records, word, on, day) {
  const r = (records[word] ??= blank());
  r[F.known] = on ? 1 : 0; if (on) { r[F.seen] = Math.max(1, r[F.seen]); r[F.last] = day; } return r;
}
export const isKnown = (records, w) => !!records[w]?.[F.known];
// Words that are due for review today (met at least once), oldest first, capped.
export function dueList(records, day, cap = 20) {
  const out = [];
  for (const w in records) { const r = records[w]; if (r[F.seen] > 0 && !r[F.known] && r[F.due] <= day && r[F.wrong] + r[F.right] > 0) out.push(w); }
  out.sort((a, b) => records[a][F.due] - records[b][F.due] || (a < b ? -1 : 1));
  return out.slice(0, cap);
}
export const dueCount = (records, day) => dueList(records, day, 1e9).length;
// Words answered wrong more often than right, worst first.
export function weakList(records, cap = 30) {
  const out = [];
  for (const w in records) { const r = records[w]; if (r[F.wrong] >= 2 && r[F.wrong] > r[F.right] * 0.5) out.push(w); }
  out.sort((a, b) => records[b][F.wrong] - records[a][F.wrong] || (a < b ? -1 : 1));
  return out.slice(0, cap);
}
// Leech: missed repeatedly and still low.
export const isLeech = (r) => !!r && r[F.wrong] >= 4 && r[F.box] <= 1;
export function summary(records) {
  const n = { new: 0, seen: 0, learning: 0, familiar: 0, mastered: 0, maintained: 0 };
  let right = 0, wrong = 0, ms = 0, msN = 0, checked = 0;
  for (const w in records) {
    const r = records[w]; const s = stageOf(r); n[s]++;
    right += r[F.right]; wrong += r[F.wrong]; checked += r[F.chk] > 0 ? 1 : 0;
    if (r[F.ms] > 0) { ms += r[F.ms]; msN++; }
  }
  const met = Object.keys(records).length - n.new;
  return { stages: n, met, right, wrong, accuracy: right + wrong ? right / (right + wrong) : 0, avgMs: msN ? Math.round(ms / msN) : 0, checked };
}
export const FIELDS = F;
