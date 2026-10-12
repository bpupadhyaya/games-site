// Per-facet memory (hub audit wave 8: I1 N1 X1 X6). A word is not one thing to know: you can recognise it among choices, recall it from
// its meaning, spell it, hear it, and use it in a sentence. Each of those is tracked, scheduled and timed on its own.
//
// The old per-word record in srs.js is NOT replaced and never changes shape: it stays the overall picture of a word (stages, known mark,
// leeches, the review list and every existing screen read it as before). Facets are a second, separate map saved next to it:
//   facets[word] = { rec: [box, due, right, wrong, avgMs, last], spl: [...], ..., m: <bitmask of contexts met right>, g: 1 }
//   m  = which kinds of question (CONTEXTS) the word has been answered right in (X6)
//   g  = 1 when the word already had an overall record before facets existed ("grandfathered": it is not held back by the context rule)
// Migration: a profile saved before this feature has no facets at all. Nothing is rewritten on disk. The first time a facet of a word
// with an old record is answered, its facet record is seeded from the overall record (two boxes lower, same due day) so the old
// progress carries over and the facet is simply re-confirmed. Backups from before (version 1) import with no facets and work the same.
import { INTERVALS, stageOf } from './srs.js';

export const FACETS = [
  { k: 'rec', name: 'Recognise', cell: 'Meaning, receiving', blurb: 'pick the right word or meaning from choices' },
  { k: 'rcl', name: 'Recall', cell: 'Meaning, producing', blurb: 'find the word yourself from its meaning' },
  { k: 'spl', name: 'Spell', cell: 'Form, producing', blurb: 'spell the word from sound or meaning' },
  { k: 'lis', name: 'Listen', cell: 'Form, receiving', blurb: 'know the word when you hear it' },
  { k: 'use', name: 'Use in context', cell: 'Use, receiving', blurb: 'choose the word that fits a sentence or phrase' },
  { k: 'wri', name: 'Use in your own words', cell: 'Use, producing', blurb: 'write your own sentence with the word' },
];
export const FACET_KEYS = FACETS.map((f) => f.k);
export const facetName = (k) => FACETS.find((f) => f.k === k)?.name ?? k;

// Which facet a quiz kind exercises.
const KIND_FACET = {
  listening: 'lis', hearmeaning: 'lis', pron: 'lis', beginsound: 'lis', endsound: 'lis', rhyme: 'lis', homophone: 'lis', stress: 'lis', syllables: 'lis',
  spelling: 'spl', hearspell: 'spl', missing: 'spl', anagram: 'spl', variant: 'spl', breakword: 'spl', build: 'spl', root: 'spl',
  cloze: 'use', collocation: 'use', phrase: 'use', usage: 'use', sense: 'use', confusable: 'use', inflect: 'use', family: 'use',
};
export const facetOfKind = (kind) => KIND_FACET[kind] ?? 'rec';
// Typed practice modes (Learn more > Spell it and friends)
const MODE_FACET = { spell: 'spl', scramble: 'spl', bee: 'spl', typed: 'spl', dictate: 'lis', recall: 'rcl' };
export const facetOfMode = (mode) => MODE_FACET[mode] ?? null;

// X6: the contexts a word has to be met in. A word counts as learned only after right answers in CTX_NEEDED different ones.
export const CONTEXTS = ['meaning', 'sentence', 'form', 'sound', 'group', 'own'];
export const CTX_NEEDED = 3;
const KIND_CTX = {
  cloze: 'sentence', usage: 'sentence', sense: 'sentence', phrase: 'sentence', collocation: 'sentence', confusable: 'sentence',
  spelling: 'form', missing: 'form', anagram: 'form', variant: 'form', breakword: 'form', build: 'form', root: 'form', inflect: 'form', family: 'form',
  listening: 'sound', hearmeaning: 'sound', hearspell: 'sound', homophone: 'sound', rhyme: 'sound', stress: 'sound', syllables: 'sound', pron: 'sound', beginsound: 'sound', endsound: 'sound',
  category: 'group', part: 'group', sorttopic: 'group', sortpos: 'group', general: 'group', palindrome: 'group',
};
export const contextOfKind = (kind) => KIND_CTX[kind] ?? 'meaning';
const ctxBit = (c) => 1 << Math.max(0, CONTEXTS.indexOf(c));
export const ctxCount = (m) => { let n = 0, v = m | 0; while (v) { n += v & 1; v >>>= 1; } return n; };

const F = { box: 0, due: 1, right: 2, wrong: 3, ms: 4, last: 5 };
const blank = () => [0, 0, 0, 0, 0, 0];
export const newFacets = () => Object.create(null);

const entryOf = (facets, word, legacy) => {
  let e = facets[word];
  if (!e) { e = facets[word] = { g: legacy ? 1 : 0, m: 0 }; }
  return e;
};
// Seed a facet record from the overall record of the same word (migration). Two boxes lower, same due day; counts start at zero.
const seed = (legacy) => {
  const r = blank();
  if (legacy) { r[F.box] = legacy[8] ? 3 : Math.max(0, (legacy[0] | 0) - 2); r[F.due] = legacy[1] | 0; r[F.last] = legacy[5] | 0; }
  return r;
};

// Record one answer for one facet of a word. `legacy` is the overall record (or undefined). Returns the facet record.
export function applyFacet(facets, word, facet, correct, ms, day, legacy, ctx = null) {
  if (!FACET_KEYS.includes(facet)) return null;
  const e = entryOf(facets, word, legacy);
  const r = (e[facet] ??= seed(legacy));
  const n = r[F.right] + r[F.wrong];
  if (correct) {
    r[F.right] += 1; r[F.box] = Math.min(7, r[F.box] + 1);
    if (ms > 0) r[F.ms] = Math.round((r[F.ms] * n + ms) / (n + 1));
    r[F.due] = day + INTERVALS[r[F.box]];
    if (ctx) e.m = (e.m | 0) | ctxBit(ctx);
  } else {
    r[F.wrong] += 1; r[F.box] = r[F.box] >= 3 ? r[F.box] - 2 : 0; r[F.due] = day + 1;
  }
  r[F.last] = day;
  return r;
}
// A facet answer that must not move the box (a guessed right answer): keep the box where it was and bring it back tomorrow.
export function holdFacet(facets, word, facet, day) {
  const r = facets[word]?.[facet]; if (!r) return;
  r[F.box] = Math.max(0, r[F.box] - 1); r[F.due] = day + 1;
}

// Facets of a word that are due today (only facets that have been practised or seeded by an answer).
export function dueFacets(facets, word, day) {
  const e = facets[word]; if (!e) return [];
  return FACET_KEYS.filter((k) => e[k] && e[k][F.due] <= day && e[k][F.right] + e[k][F.wrong] > 0);
}
// Words with at least one facet due today that the overall list does not already treat as due, oldest first.
export function dueWords(facets, records, day, cap = 20) {
  const out = [];
  for (const w in facets) {
    const r = records[w]; if (r && r[8]) continue;        // marked known: not reviewed
    const fs = dueFacets(facets, w, day); if (!fs.length) continue;
    out.push([w, Math.min(...fs.map((k) => facets[w][k][F.due]))]);
  }
  out.sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1));
  return out.slice(0, cap).map((x) => x[0]);
}

// X6: the stage of a word with the many-contexts rule applied. A word that already had a record before facets existed (g) and a word
// marked known by the player are never held back; a new word reaches Mastered only after right answers in CTX_NEEDED kinds of question.
export function contexts(facets, word) { return ctxCount(facets[word]?.m); }
export function learnedAcross(facets, records, word) {
  const r = records[word], e = facets[word];
  if (!r) return false;
  if (r[8] || !e || e.g) return true;
  return ctxCount(e.m) >= CTX_NEEDED;
}
export function stageCtx(facets, records, word) {
  const r = records[word], s = stageOf(r);
  if ((s === 'mastered' || s === 'maintained') && !learnedAcross(facets, records, word)) return 'familiar';
  return s;
}

// N1: accuracy and answer time per facet over every word.
export function summary(facets, day) {
  const out = {}; for (const k of FACET_KEYS) out[k] = { words: 0, right: 0, wrong: 0, msSum: 0, msN: 0, due: 0 };
  for (const w in facets) {
    for (const k of FACET_KEYS) {
      const r = facets[w][k]; if (!r) continue;
      const o = out[k];
      if (r[F.right] + r[F.wrong] > 0) o.words += 1;
      o.right += r[F.right]; o.wrong += r[F.wrong];
      if (r[F.ms] > 0) { o.msSum += r[F.ms]; o.msN += 1; }
      if (r[F.due] <= day && r[F.right] + r[F.wrong] > 0) o.due += 1;
    }
  }
  for (const k of FACET_KEYS) { const o = out[k]; o.acc = o.right + o.wrong ? o.right / (o.right + o.wrong) : 0; o.avgMs = o.msN ? Math.round(o.msSum / o.msN) : 0; }
  return out;
}
export function learnedCount(facets, records) {
  let met = 0, across = 0;
  for (const w in records) { const r = records[w]; if (!(r[6] > 0)) continue; met += 1; if (learnedAcross(facets, records, w)) across += 1; }
  return { met, across };
}
export const wordLines = (facets, word) => FACETS.map((f) => {
  const r = facets[word]?.[f.k]; if (!r) return null;
  const n = r[F.right] + r[F.wrong]; if (!n) return null;
  return `${f.name}: ${r[F.right]} of ${n} right${r[F.ms] ? `, about ${(r[F.ms] / 1000).toFixed(1)} s` : ''}, box ${r[F.box]}`;
}).filter(Boolean);

// Safe copy for loading and importing: only known facets, numeric arrays of six, word keys that look like words.
export function clean(raw) {
  const out = newFacets();
  if (!raw || typeof raw !== 'object') return out;
  let n = 0;
  for (const w of Object.keys(raw)) {
    if (!/^[a-z]{1,20}$/.test(w) || n > 60000) continue;
    const e = raw[w]; if (!e || typeof e !== 'object') continue;
    const o = { g: e.g ? 1 : 0, m: Number.isInteger(e.m) && e.m >= 0 && e.m < 64 ? e.m : 0 };
    for (const k of FACET_KEYS) {
      const r = e[k];
      if (Array.isArray(r) && r.length >= 6) o[k] = r.slice(0, 6).map((x, i) => (Number.isFinite(x) ? (i === 0 ? Math.max(0, Math.min(7, Math.round(x))) : Math.max(0, Math.round(x))) : 0));
    }
    out[w] = o; n += 1;
  }
  return out;
}
export function csv(facets) {
  const q = (s) => String(s);
  const rows = ['word,facet,box,due_day,right,wrong,avg_answer_ms,last_day,contexts_met'];
  for (const w of Object.keys(facets).sort()) for (const k of FACET_KEYS) {
    const r = facets[w][k]; if (!r) continue;
    rows.push([w, k, r[0], r[1], r[2], r[3], r[4], r[5], ctxCount(facets[w].m)].map(q).join(','));
  }
  return rows.join('\n') + '\n';
}
export const FIELDS_F = F;
