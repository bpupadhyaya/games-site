// Study-card helpers shared by the study list, flashcards and the word explorer. Pure: no randomness, no DOM.
//   familyLine      D9  the word family on every card
//   breaksOf        E7  syllable breaks and the stressed part as text (no audio)
//   tierOf          X2  everyday / general academic / domain-specific
//   exampleRe/marks F9  the target word found inside its example sentence, so it can be drawn highlighted
import * as kb from './kb.js';
import { ATTR } from './lexicon.js';

// ---- D9 word family
export function familyOf(e, max = 8) {
  if (!e || e.rank === undefined || !kb.has('fam')) return [];
  return [...new Set(kb.words('fam', e.rank))].filter((w) => w && w !== e.w).slice(0, max);
}
export const familyLine = (e) => { const f = familyOf(e); return f.length ? `Word family: ${[e.w, ...f].join(', ')}` : ''; };

// ---- E7 syllable breaks. The syllable COUNT and the stressed part come from the pronunciation data (kb cols); the break points are
// found from the spelling (vowel groups, consonants split between them) and only shown when they agree with that count.
const V = 'aeiouy';
function chunks(w) {
  const isV = (c, i) => V.includes(c) && !(c === 'y' && i === 0) && !(c === 'u' && i > 0 && w[i - 1] === 'q');
  const groups = [];            // [start, end) of each vowel group
  for (let i = 0; i < w.length; i += 1) {
    if (isV(w[i], i)) { let j = i; while (j + 1 < w.length && isV(w[j + 1], j + 1)) j += 1; groups.push([i, j + 1]); i = j; }
  }
  // a final silent e (come, make) is not a syllable; -le after a consonant (table) is one
  const last = groups[groups.length - 1];
  if (groups.length > 1 && last && last[1] === w.length && w[w.length - 1] === 'e' && last[1] - last[0] === 1) {
    const before = w[last[0] - 1];
    if (!(before === 'l' && !V.includes(w[last[0] - 2] ?? 'a'))) groups.pop();
  }
  if (groups.length && w.endsWith('ed') && groups.length > 1 && !/[td]ed$/.test(w)) { const g = groups[groups.length - 1]; if (g[0] === w.length - 2) groups.pop(); }
  const cuts = [];
  for (let k = 0; k + 1 < groups.length; k += 1) {
    const a = groups[k][1], b = groups[k + 1][0], n = b - a;       // consonants between two vowel groups
    cuts.push(n <= 1 ? a : n === 2 && /^(ch|sh|th|ph|wh|ck|ng)$/.test(w.slice(a, b)) ? a : a + Math.floor(n / 2));
  }
  const out = []; let from = 0;
  for (const c of cuts) { out.push(w.slice(from, c)); from = c; }
  out.push(w.slice(from));
  return out;
}
// -> { parts: ['vo','cab','u','lar','y'], stress: 2 (1-based, 0 unknown), count } or null when no pronunciation data
export function breaksOf(e) {
  if (!e || e.rank === undefined || !kb.manifest() || !/^[a-z]+$/.test(e.w)) return null;
  const count = kb.syllables(e.rank); if (!count) return null;
  const st = kb.col(e.rank, 1), parts = chunks(e.w);
  return { parts: parts.length === count ? parts : null, stress: st > 0 && st <= count ? st : 0, count };
}
export function breaksLine(e) {
  const b = breaksOf(e); if (!b) return '';
  if (b.parts && b.count > 1) return `Syllables: ${b.parts.map((p, i) => (i + 1 === b.stress ? p.toUpperCase() : p)).join('-')}${b.stress ? '  (capitals = loudest part)' : ''}`;
  if (b.count === 1) return 'Syllables: 1';
  return `Syllables: ${b.count}${b.stress ? `, loudest part is number ${b.stress}` : ''}`;
}

// ---- X2 three tiers of vocabulary (approximate: from how common the word is and its science / academic tags)
export const TIERS3 = [
  { id: 'everyday', label: 'everyday', name: 'Everyday words', blurb: 'common words most people meet in daily talk and reading' },
  { id: 'academic', label: 'general academic', name: 'General academic words', blurb: 'words that turn up across school and university subjects and in careful writing' },
  { id: 'domain', label: 'domain-specific', name: 'Domain-specific words', blurb: 'words that belong to one field, such as science' },
];
export function tierOf(e) {
  if (!e) return TIERS3[0];
  if (e.attrs & ATTR.SCI) return TIERS3[2];
  if (e.attrs & ATTR.ACAD) return TIERS3[1];
  if ((e.attrs & (ATTR.EVD | ATTR.HF)) || e.band <= 1) return TIERS3[0];
  return e.band >= 3 ? TIERS3[1] : TIERS3[0];
}
export const tierLine = (e) => `Word tier: ${tierOf(e).label} (an estimate)`;

// ---- F9 find the target word (with its common endings) inside an example sentence
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function formsOf(w) {
  const f = new Set([w]);
  for (const s of ['s', 'es', 'ed', 'd', 'ing', 'ly', 'er', 'ers', 'est', 'ness']) f.add(w + s);
  if (w.endsWith('e')) { const b = w.slice(0, -1); f.add(`${b}ing`); f.add(`${b}ed`); f.add(`${b}er`); }
  if (w.endsWith('y')) { const b = w.slice(0, -1); f.add(`${b}ies`); f.add(`${b}ied`); f.add(`${b}ily`); f.add(`${b}ier`); f.add(`${b}iest`); }
  const l = w[w.length - 1]; if (w.length >= 3 && !V.includes(l)) { f.add(`${w}${l}ed`); f.add(`${w}${l}ing`); f.add(`${w}${l}er`); }
  return [...f].sort((a, b) => b.length - a.length);
}
export const exampleRe = (w) => new RegExp(`\\b(${formsOf(w).map(esc).join('|')})\\b`, 'i');
// Split text into [{ t, hl }] segments where hl marks the target word.
export function marks(text, w) {
  if (!w || !text) return [{ t: text ?? '', hl: false }];
  const re = exampleRe(w), out = []; let rest = text;
  for (let guard = 0; guard < 6 && rest; guard += 1) {
    const m = re.exec(rest); if (!m) break;
    if (m.index > 0) out.push({ t: rest.slice(0, m.index), hl: false });
    out.push({ t: m[0], hl: true }); rest = rest.slice(m.index + m[0].length);
  }
  if (rest) out.push({ t: rest, hl: false });
  return out;
}

// All the extra lines a study card shows under the meaning (the list view and the flashcard use the same lines).
export function cardExtras(e) {
  return [familyLine(e), breaksLine(e), tierLine(e)].filter(Boolean);
}
