// Analogy puzzles (A : B :: C : ?). The bank (web/data/kb/analogies.txt) is built offline by data-build/analogies.mjs from the relations the
// game already ships. This file holds: the relation vocabulary, relsOf(x, y) (what links two words, recomputed from the shipped data; the
// generator, the game and the tests all use it), the lazy bank reader and the question builder.
//
// Bank format (UTF-8):  "#ANA1 <items>"  then "#P" and the pair table (one pair per line: 3+3 base-36 pack rows), then "#I" and one line per item:
//   <rel 1 char><kid 0/1><pair AB 3 chars><pair CD 3 chars><wrong 1><wrong 2><wrong 3, 3 chars each>      (pair/word ids are base 36)
// The answer is the second word of pair CD. All words are study entries (pack rows), so each one opens the dictionary / thesaurus sheet.
import * as lex from './lexicon.js';
import * as kb from './kb.js';

// ---- relation vocabulary. code -> how it is named to the player. `dir` shows who the pair is written as (x : y).
export const RELS = {
  a: { name: 'Opposites', short: 'opposites', hint: 'The two words in each pair are opposites.', tell: (x, y) => `${x} and ${y} are opposites` },
  s: { name: 'Same meaning', short: 'same meaning', hint: 'The two words in each pair mean almost the same.', tell: (x, y) => `${x} and ${y} mean almost the same` },
  k: { name: 'Kind of', short: 'a kind of', hint: 'The first word is a kind of the second.', tell: (x, y) => `${x} is a kind of ${y}` },
  p: { name: 'Part of', short: 'part of', hint: 'The first word is a part of the second.', tell: (x, y) => `${x} is a part of ${y}` },
  d: { name: 'Stronger', short: 'stronger', hint: 'The second word is a stronger word for the same idea.', tell: (x, y) => `${y} is a stronger word than ${x}` },
  u: { name: 'Add a prefix', short: 'made opposite with a prefix', hint: 'The second word is the first one made opposite with a small word at the front (un-, in-, dis-).', tell: (x, y) => `${y} is ${x} with a prefix that makes it the opposite` },
  n: { name: 'Add -ness', short: 'the noun form', hint: 'The second word is the noun made from the first (a -ness word).', tell: (x, y) => `${y} is the noun made from ${x}` },
  l: { name: 'Add -ly', short: 'the -ly form', hint: 'The second word is the -ly (adverb) form of the first.', tell: (x, y) => `${y} is the -ly form of ${x}` },
  e: { name: 'Does the job', short: 'the person who does it', hint: 'The second word is the person who does what the first word says.', tell: (x, y) => `a ${y} is a person who ${verbS(x)}` },
  m: { name: 'Add -ment', short: 'the noun form', hint: 'The second word is the noun made from the first (a -ment word).', tell: (x, y) => `${y} is the noun made from ${x}` },
  t: { name: 'Add -tion', short: 'the noun form', hint: 'The second word is the noun made from the first (a -tion word).', tell: (x, y) => `${y} is the noun made from ${x}` },
};
const verbS = (x) => (/(s|x|z|ch|sh)$/.test(x) ? `${x}es` : /[^aeiou]y$/.test(x) ? `${x.slice(0, -1)}ies` : `${x}s`);
export const REL_CODES = Object.keys(RELS);
// codes only used to describe a WRONG choice (what it is to the third word)
export const WRONG_NAME = { a: 'the opposite', s: 'a word with the same meaning', k: 'a bigger group it belongs to', K: 'one of its kinds', p: 'something it is part of', P: 'one of its parts', f: 'a word from the same family', c: 'a word that often goes with it', g: 'a similar kind of thing', d: 'a stronger word', D: 'a milder word', x: 'a word with no close link' };

const okWord = (w) => /^[a-z]{3,12}$/.test(w);
const rowOf = (w) => kb.rowOfWord(w);
const memo = (fn) => { const m = new Map(); let ver = -1; return (w) => { if (ver !== kb.version()) { m.clear(); ver = kb.version(); } if (!m.has(w)) m.set(w, fn(w)); return m.get(w); }; };

// ---- ladders (strength scales, extras.json). Passed in by the caller (the game installs them through quiz.installExtras).
let LAD = [];
export const setLadders = (l) => { LAD = Array.isArray(l) ? l : []; };

// ---- neighbours of a word, by kind of link. Everything is a Set of lexicon words.
const KIND_DEPTH = 6;
export function ancestors(w) {            // all kinds-of above w (up to KIND_DEPTH steps), with depth: Map word -> steps
  const out = new Map(); let cur = [w];
  for (let d = 1; d <= KIND_DEPTH && cur.length; d += 1) {
    const nx = [];
    for (const c of cur) { const r = rowOf(c); if (r < 0 || !kb.has('hyper')) continue; for (const h of kb.words('hyper', r)) if (!out.has(h) && h !== w) { out.set(h, d); nx.push(h); } }
    cur = nx;
  }
  return out;
}
const ancMemo = memo(ancestors);
export const ancestorsOf = (w) => ancMemo(w);
const nb = memo((w) => {
  const r = rowOf(w), N = { ant: new Set(), syn: new Set(), kids: new Set(), part: new Set(), has: new Set(), fam: new Set(), col: new Set(), sib: new Set(), up: new Set(), down: new Set() };
  if (r >= 0) {
    for (const x of kb.antonyms(r, false)) N.ant.add(x.w);
    for (const x of kb.synonyms(r, 2, 3)) N.syn.add(x.w);
    const e = lex.entry(w); if (e) { for (const x of e.syn) N.syn.add(x); for (const x of e.ant) N.ant.add(x); }
    if (kb.has('hypo')) for (const x of kb.words('hypo', r)) N.kids.add(x);
    if (kb.has('holo')) for (const x of kb.words('holo', r)) N.part.add(x);
    if (kb.has('mero')) for (const x of kb.words('mero', r)) N.has.add(x);
    if (kb.has('fam')) for (const x of kb.words('fam', r)) N.fam.add(x);
    if (kb.has('col')) for (const x of kb.words('col', r)) N.col.add(x);
    if (kb.has('hyper')) for (const h of kb.words('hyper', r)) { const hr = rowOf(h); if (hr >= 0 && kb.has('hypo')) for (const s of kb.words('hypo', hr)) if (s !== w) N.sib.add(s); }
    if (kb.thesReady()) {
      const t = kb.thesFor(w);
      if (kb.thesMoreReady()) { const m = kb.thesMoreFor(w); for (const x of [...m.roget, ...m.moby]) N.syn.add(x); }       // looser synonyms count when deciding that a wrong choice is really wrong
      if (t) { for (const x of t.der) N.fam.add(x); for (const s of t.senses) { for (const x of [...s.same, ...s.sim1, ...s.also]) N.syn.add(x); for (const d of s.direct) N.ant.add(d.w); } for (const x of t.neg) N.ant.add(x); }
    }
  }
  // inverse links: another word lists w
  for (const l of LAD) { const i = l.indexOf(w); if (i >= 0) { l.forEach((x, j) => { if (j > i) N.up.add(x); else if (j < i) N.down.add(x); }); } }
  N.syn.delete(w); N.ant.delete(w);
  return N;
});
export const neighbours = nb;

// derivation: the rule codes n l e m t for (base x -> derived y); requires the family link
const AGENT_GLOSS = /^((a|an) )?(person|someone|one|man|woman|worker) (who|that|whose)\b/i;
// a wrong choice that fits the relation as well: for 'u' (opposite made with a prefix) any opposite also fits
export const fits = (rel, x, y) => { const r = relsOf(x, y); return r.has(rel) || (rel === 'u' && r.has('a')); };
export const NEG_PREFIX = ['un', 'in', 'im', 'il', 'ir', 'dis', 'non'];
export const prefixOf = (x, y) => NEG_PREFIX.find((p) => y === p + x) ?? '';
export function derivCode(x, y) {
  const ex = lex.entry(x), ey = lex.entry(y); if (!ex || !ey || x === y) return '';
  if (prefixOf(x, y) && nb(x).ant.has(y) && ex.pos === ey.pos && (ex.pos === 'a' || ex.pos === 'v' || ex.pos === 'r')) return 'u';
  const fam = nb(x).fam.has(y) || nb(y).fam.has(x);
  const stem = x.endsWith('y') ? `${x.slice(0, -1)}i` : x;
  if (ex.pos === 'a' && ey.pos === 'r' && ey.rank <= 20000 && (y === `${x}ly` || y === `${stem}ly` || y === `${x}ally` || (x.endsWith('le') && y === `${x.slice(0, -1)}y`))) return 'l';
  if (ex.pos === 'a' && ey.pos === 'n' && (y === `${x}ness` || y === `${stem}ness`)) return 'n';
  if (!fam) return '';
  if (ex.pos === 'v' && ey.pos === 'n' && y.endsWith('ment') && y === `${x}ment` ) return 'm';
  if (ex.pos === 'v' && ey.pos === 'n' && (y === `${x}ion` || y === `${x.replace(/e$/, '')}ion` || y === `${x.replace(/e$/, '')}ation` || y === `${x}ation` || y === `${x}tion` || y === `${x.replace(/[de]$/, '')}sion`) && /tion$|sion$/.test(y)) return 't';
  if (ex.pos === 'v' && ey.pos === 'n' && (y === `${x}er` || y === `${x}r` || y === `${x}or` || y === `${x.replace(/e$/, '')}or` || y === `${x}${x.slice(-1)}er`) && AGENT_GLOSS.test(ey.gloss || '')) return 'e';
  return '';
}

// ---- relsOf(x, y): the set of relation codes by which y stands to x (recomputed from the shipped data, never from the bank)
//   a opposite, s same meaning/similar, k y is a kind-of above x (any depth), K y is one of x's kinds, p x is a part of y, P y is a part of x,
//   d y is stronger, D y is milder, f same family, c goes with, g sibling kind; n l e m t derivation (y made from x)
export function relsOf(x, y) {
  const out = new Set(); if (x === y) return out;
  const A = nb(x), B = nb(y);
  if (A.ant.has(y) || B.ant.has(x)) out.add('a');
  if (A.syn.has(y) || B.syn.has(x)) out.add('s');
  if (ancMemo(x).has(y)) out.add('k');
  if (ancMemo(y).has(x) || A.kids.has(y)) out.add('K');
  if (A.part.has(y) || B.has.has(x)) out.add('p');
  if (A.has.has(y) || B.part.has(x)) out.add('P');
  if (A.fam.has(y) || B.fam.has(x)) out.add('f');
  if (A.col.has(y) || B.col.has(x)) out.add('c');
  if (A.sib.has(y) || B.sib.has(x)) out.add('g');
  if (A.up.has(y)) out.add('d');
  if (A.down.has(y)) out.add('D');
  const dv = derivCode(x, y); if (dv) out.add(dv);
  return out;
}

// ---- the bank (lazy). parse() once per installed text.
let BANK = null;
const b36 = (s) => parseInt(s, 36);
export const bankReady = () => Boolean(kb.manifest() && kb.hasText('analogies'));
export function bank() {
  const text = kb.getText('analogies'); if (!text) return null;
  if (BANK && BANK.src === text) return BANK;
  const B = { src: text, items: [], byWord: new Map() };
  if (text.startsWith('#ANA1')) {
    const p0 = text.indexOf('\n#P\n'), i0 = text.indexOf('\n#I\n');
    if (p0 > 0 && i0 > p0) {
      const pairs = text.slice(p0 + 4, i0).split('\n').filter(Boolean), A = lex.all();
      const pr = pairs.map((l) => [b36(l.slice(0, 3)), b36(l.slice(3, 6))]);
      for (const ln of text.slice(i0 + 4).split('\n')) {
        if (ln.length < 17) continue;
        const ab = pr[b36(ln.slice(2, 5))], cd = pr[b36(ln.slice(5, 8))]; if (!ab || !cd) continue;
        const it = { rel: ln[0], kid: ln[1] === '1', ids: [ab[0], ab[1], cd[0], cd[1], b36(ln.slice(8, 11)), b36(ln.slice(11, 14)), b36(ln.slice(14, 17))] };
        const es = it.ids.map((i) => A[i]); if (es.some((e) => !e)) continue;
        it.w = es.map((e) => e.w); it.band = Math.max(...es.map((e) => e.band));
        B.items.push(it);
        for (let k = 0; k < 4; k += 1) { if (es[k].band === it.band) { let l = B.byWord.get(it.w[k]); if (!l) B.byWord.set(it.w[k], (l = [])); l.push(it); } }
      }
    }
  }
  BANK = B; return B;
}
// items a word can open: it is one of the four words of the pair, and no word is above the word's own level (so the puzzle stays in the level window)
export function itemsFor(w, kidOnly = false) { const B = bank(); const l = B?.byWord.get(w); return l ? (kidOnly ? l.filter((x) => x.kid) : l) : []; }
export const canAskAnalogy = (e) => Boolean(e && e.rank !== undefined && !e.letter && itemsFor(e.w, lex.kidMode()).length);

// Build a question for entry e. avoid = recent answers etc. (not used for words of the pair, which are fixed by the item)
export function buildAnalogy(e, rng, base, opt) {
  const L = itemsFor(e.w, lex.kidMode()); if (!L.length) return null;
  const it = rng.pick(L), [a, b, c, d, w1, w2, w3] = it.w, R = RELS[it.rel];
  const q = {
    ...base, kind: 'analogy', label: 'COMPLETE THE ANALOGY', prompt: `${a} : ${b}  ::  ${c} : ?`, word: d, noRec: true,
    answer: d, rel: it.rel, hintLabel: `HINT: ${R.short.toUpperCase()}`, meaning: R.hint,
    note: `${R.tell(a, b)}, so ${R.tell(c, d)}.`.replace(/^./, (m) => m.toUpperCase()),
    options: rng.shuffle([opt(d, true), opt(w1, false), opt(w2, false), opt(w3, false)]), item: it.w, pairs: [[a, b], [c, d]],
  };
  return q;
}
// A wrong choice, explained: what it is to the third word ("big : small", not "big : huge").
export function wrongWhy(c, x) {
  const r = relsOf(c, x); const order = ['s', 'a', 'K', 'k', 'P', 'p', 'f', 'g', 'c', 'D', 'd'];
  const code = order.find((k) => r.has(k)); return code ? WRONG_NAME[code] : WRONG_NAME.x;
}

// ---- the checks the generator and the tests run on every item: it.w = [a, b, c, d, wrong1, wrong2, wrong3], it.rel
// Returns a list of problems (empty = a clean puzzle): seven different study words, both pairs show the relation (recomputed from the shipped data),
// and exactly one choice fits (no wrong choice fits the relation, none is a near-synonym of the answer).
export function validateItem(it) {
  const bad = [], [a, b, c, d, ...ws] = it.w;
  if (new Set(it.w).size !== 7) bad.push('a word repeats');
  if (it.w.some((w) => !lex.entry(w) || lex.entry(w).rank === undefined || !lex.isWord(w))) bad.push('word missing from the lexicon');
  if (!relsOf(a, b).has(it.rel)) bad.push('stem pair lacks the relation');
  if (!relsOf(c, d).has(it.rel)) bad.push('answer pair lacks the relation');
  for (const w of ws) { if (fits(it.rel, c, w)) bad.push(`${w} also fits`); if (relsOf(d, w).has('s')) bad.push(`${w} is close to the answer`); }
  return bad;
}
