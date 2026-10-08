// Question builders. Every question has the same shape so the drifting-word play layer never changes:
//   { kind, label, prompt, options: [{ text, correct }, x3], word, answer, meaning, speak? }
// All randomness comes from the rng passed in; all word data from lexicon.js (WordNet relations + the validation lexicon).
import { entry, distractors, isWord, extraDistractors, all as allEntries } from './lexicon.js';
import { ART_WORDS } from './art.js';
import * as kb from './kb.js';
import { LETTERS, LETTER_NAMES, similar } from './letters.js';
const ART = new Set(ART_WORDS);

export const KIND_LABEL = {
  synonym: 'TAP THE SYNONYM OF', antonym: 'TAP THE ANTONYM OF', definition: 'WHICH WORD MEANS', odd: 'ODD ONE OUT',
  spelling: 'TAP THE RIGHT SPELLING', listening: 'LISTEN, THEN TAP',
  category: 'WHICH IS A KIND OF', part: 'WHICH IS PART OF', homophone: 'SOUNDS LIKE', rhyme: 'RHYMES WITH', anagram: 'UNSCRAMBLE THE LETTERS', family: 'SAME WORD FAMILY AS', collocation: 'GOES WITH', phrase: 'FINISH THE PHRASE', confusable: 'WHICH WORD MEANS', root: 'WORD WITH A ROOT MEANING', variant: 'THE BRITISH SPELLING OF',
  sense: 'WHICH WORD CAN ALSO MEAN', cloze: 'FILL THE GAP', missing: 'FIND THE MISSING LETTER', stress: 'WHICH PART IS STRESSED?', syllables: 'HOW MANY SYLLABLES?', palindrome: 'READS THE SAME BACKWARDS', build: 'PUT THE PARTS TOGETHER', inflect: 'THE RIGHT FORM OF', 'letter-vowel': 'VOWEL OR CONSONANT?',
  ladder: 'WHICH IS THE STRONGEST?',
  picture: 'WHAT IS THIS?', 'letter-hear': 'LISTEN, THEN TAP THE LETTER', 'letter-case': 'FIND THE SMALL LETTER', 'letter-next': 'WHICH LETTER IS MISSING?',
};
export const KIND_SHORT = { synonym: 'SYNONYM', antonym: 'ANTONYM', definition: 'MEANING', odd: 'ODD ONE', spelling: 'SPELLING', listening: 'LISTENING', picture: 'PICTURE', ladder: 'STRENGTH', sense: 'MEANING', cloze: 'CLOZE', missing: 'LETTER', stress: 'STRESS', syllables: 'SYLLABLES', palindrome: 'PALINDROME', build: 'BUILD', inflect: 'FORM', 'letter-vowel': 'LETTER', category: 'KIND OF', part: 'PART OF', homophone: 'SOUNDS', rhyme: 'RHYME', anagram: 'ANAGRAM', family: 'FAMILY', collocation: 'GOES WITH', phrase: 'PHRASE', confusable: 'CONFUSED', root: 'ROOT', variant: 'UK SPELLING', 'letter-hear': 'LETTER', 'letter-case': 'LETTER', 'letter-next': 'LETTER' };

const VOWELS = 'aeiou';
// Plausible misspellings of w that are NOT real words (checked against the validation lexicon when it is loaded).
export function misspellings(w, n, rng) {
  const out = [], cand = new Set();
  const add = (s) => { if (s && s !== w && s.length >= 3 && !isWord(s)) cand.add(s); };
  for (let i = 0; i < w.length - 1; i++) if (w[i] !== w[i + 1]) add(w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2));       // swapped neighbours
  for (let i = 1; i < w.length; i++) { if (w[i] === w[i - 1]) add(w.slice(0, i) + w.slice(i + 1)); else if (!VOWELS.includes(w[i])) add(w.slice(0, i) + w[i] + w.slice(i)); }   // single/double letter
  for (let i = 1; i < w.length - 1; i++) if (VOWELS.includes(w[i])) for (const v of VOWELS) if (v !== w[i]) add(w.slice(0, i) + v + w.slice(i + 1));   // wrong vowel
  if (w.endsWith('e')) add(w.slice(0, -1));
  if (w.includes('ie')) add(w.replace('ie', 'ei')); else if (w.includes('ei')) add(w.replace('ei', 'ie'));
  if (w.includes('ph')) add(w.replace('ph', 'f'));
  const arr = [...cand]; rng.shuffle(arr).forEach((s) => { if (out.length < n && !out.some((o) => o === s)) out.push(s); });
  return out;
}
// Real words one edit away from w (for the listening question: ship / sheep style confusions, here ship / shop).
export function nearWords(w, n, rng) {
  const cand = new Set(), L = 'abcdefghijklmnopqrstuvwxyz';
  for (let i = 0; i < w.length; i++) {
    cand.add(w.slice(0, i) + w.slice(i + 1));
    for (const c of L) { cand.add(w.slice(0, i) + c + w.slice(i + 1)); cand.add(w.slice(0, i) + c + w.slice(i)); }
    if (i < w.length - 1) cand.add(w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2));
  }
  const ok = [...cand].filter((s) => s !== w && s.length >= 3 && isWord(s));
  return rng.shuffle(ok).slice(0, n);
}

export function canAsk(e, kind, ctx) {
  if (e.letter) return kind === 'letter-case' || kind === 'letter-next' || kind === 'letter-vowel' || (kind === 'letter-hear' && !!ctx.canSpeak);
  switch (kind) {
    case 'picture': return ART.has(e.w) && !!e.gloss;
    case 'synonym': return synAnswers(e).length > 0;
    case 'antonym': return antAnswers(e).length > 0;
    case 'definition': return !!e.gloss && !e.gloss.toLowerCase().includes(e.w) && e.gloss.length <= 84;
    case 'odd': return synAnswers(e).length > 0;
    case 'spelling': return e.w.length >= 4 && !!e.gloss && !e.gloss.toLowerCase().includes(e.w) && e.gloss.length <= 84;
    case 'listening': return !!ctx.canSpeak && e.w.length >= 3;
    default: return canAskKb(e, kind);
  }
}
export function chooseKind(e, kinds, rng, ctx) {
  const ok = kinds.filter((k) => canAsk(e, k, ctx));
  return ok.length ? rng.pick(ok) : null;
}
const fallbackDistractors = (e, n, rng, avoid) => {
  const x = extraDistractors(e); if (x) return rng.shuffle(x.slice()).slice(0, n);
  return distractors(e, n, rng, avoid);
};

// Build the question for entry e. `avoid` = words that must not appear as options (the word itself, its relatives, recent answers).
export function build(kind, e, rng, avoid) {
  const opt = (text, correct) => ({ text, correct });
  const base = { kind, label: KIND_LABEL[kind], word: e.w, meaning: e.gloss || '', letter: Boolean(e.letter) };
  if (e.letter) {
    const i = LETTERS.indexOf(e.w), meaning = `${e.up} ${e.w}  is called "${LETTER_NAMES[e.w]}"`;
    const ds = similar(e.w, 2, rng);
    if (kind === 'letter-case') return { ...base, meaning, prompt: e.up, answer: e.w, options: rng.shuffle([opt(e.w, true), opt(ds[0], false), opt(ds[1], false)]) };
    if (kind === 'letter-hear') return { ...base, meaning, prompt: 'tap to hear it again', speak: LETTER_NAMES[e.w], answer: e.up, options: rng.shuffle([opt(e.up, true), opt(ds[0].toUpperCase(), false), opt(ds[1].toUpperCase(), false)]) };
    if (kind === 'letter-next') {
      const s = Math.max(0, Math.min(i - 1, 22)), seq = LETTERS.slice(s, s + 4).map((c) => (c === e.w ? '_' : c));
      const others = rng.shuffle(LETTERS.filter((c) => c !== e.w && !LETTERS.slice(s, s + 4).includes(c))).slice(0, 2);
      return { ...base, meaning, prompt: seq.join('  '), answer: e.w, options: rng.shuffle([opt(e.w, true), opt(others[0], false), opt(others[1], false)]) };
    }
    if (kind === 'letter-vowel') {
      const v = 'aeiou'.includes(e.w), want = v ? 'vowel' : 'consonant';
      const pool = LETTERS.filter((c) => ('aeiou'.includes(c)) !== v);
      const ds = rng.shuffle(pool).slice(0, 2);
      return { ...base, meaning, prompt: `tap the ${want}`, answer: e.w, note: `${e.w} is a ${want}`, options: rng.shuffle([opt(e.w, true), opt(ds[0], false), opt(ds[1], false)]) };
    }
    return null;
  }
  if (kind === 'picture') {
    const others = rng.shuffle(ART_WORDS.filter((w) => w !== e.w && entry(w))).slice(0, 2);
    if (others.length < 2) return null;
    return { ...base, prompt: '', art: e.w, answer: e.w, options: rng.shuffle([opt(e.w, true), opt(others[0], false), opt(others[1], false)]) };
  }
  if (kind === 'synonym' || kind === 'antonym') {
    const A = kind === 'synonym' ? synAnswers(e) : antAnswers(e), pick = rng.pick(A), answer = pick.w;
    const av = new Set([...avoid, ...kbRelated(e), answer]);
    const near = nearMiss(e, kind, av);
    const picked = [];
    if (near.length && e.band >= 1 && rng.chance(0.6)) picked.push(rng.pick(near));
    const ds = fallbackDistractors(e, 2, rng, new Set([...av, ...picked]));
    const options = picked.concat(ds).slice(0, 2);
    if (options.length < 2) return null;
    const note = pick.note ?? '';
    return { ...base, prompt: e.w, answer, note, options: rng.shuffle([opt(answer, true), opt(options[0], false), opt(options[1], false)]) };
  }
  if (kind === 'definition') {
    const sib = kb.has('hypo') ? siblings(e) : [];
    const first = sib.length && rng.chance(0.5) ? [rng.pick(sib)] : [];
    const ds = first.concat(distractors(e, 2, rng, new Set([...avoid, ...first]))).slice(0, 2);
    if (ds.length < 2) return null;
    return { ...base, prompt: e.gloss, answer: e.w, options: rng.shuffle([opt(e.w, true), opt(ds[0], false), opt(ds[1], false)]) };
  }
  if (kind === 'odd') {
    const mate = rng.pick(synAnswers(e)).w; const ds = distractors(e, 1, rng, new Set([...avoid, ...kbRelated(e), mate]));
    if (ds.length < 1) return null;
    return { ...base, prompt: 'two of these match', answer: ds[0], options: rng.shuffle([opt(e.w, false), opt(mate, false), opt(ds[0], true)]) };
  }
  if (kind === 'spelling') {
    const bad = misspellings(e.w, 2, rng);
    if (bad.length < 2) return null;
    return { ...base, prompt: e.gloss, answer: e.w, options: rng.shuffle([opt(e.w, true), opt(bad[0], false), opt(bad[1], false)]) };
  }
  if (kind === 'listening') {
    const mp = kb.has('minpair') && e.rank !== undefined ? rng.shuffle(kb.words('minpair', e.rank).filter(okw)) : [];
    let others = mp.slice(0, 2);
    if (others.length < 2) others = others.concat(nearWords(e.w, 2 - others.length, rng));
    if (others.length < 2) others = others.concat(misspellings(e.w, 2 - others.length, rng));
    if (others.length < 2) return null;
    return { ...base, prompt: 'tap to hear it again', speak: e.w, answer: e.w, options: rng.shuffle([opt(e.w, true), opt(others[0], false), opt(others[1], false)]) };
  }
  return buildKb(kind, e, rng, avoid, base, opt);
}
export { entry };

// ---- knowledge-base helpers: sense-aware answers, near-miss distractors and the relation question types -----------------------------
const ANT_NOTE = ['a matter of degree', 'one or the other', 'two sides of one thing', 'made by adding a negative prefix'];
const okw = (w) => /^[a-z]{3,15}$/.test(w) && isWord(w);
export function synAnswers(e) {
  if (e.attrs & 64 || !kb.ready() || e.rank === undefined) return e.syn.map((w) => ({ w }));
  const l = kb.synonyms(e.rank, 0, 1).filter((x) => okw(x.w)), s0 = l.filter((x) => x.sense === 0), use = s0.length ? s0 : l;
  return use.map((x) => ({ w: x.w, note: x.sense ? 'in another sense of the word' : '' }));
}
export function antAnswers(e) {
  if (e.attrs & 64 || !kb.ready() || e.rank === undefined) return e.ant.map((w) => ({ w }));
  return kb.antonyms(e.rank, true).filter((x) => okw(x.w)).map((x) => ({ w: x.w, note: ANT_NOTE[x.type] ? `opposites: ${ANT_NOTE[x.type]}` : '' }));
}
const kbRelated = (e) => (kb.ready() && e.rank !== undefined ? [...kb.related(e.rank)] : []);
// words close in meaning but NOT valid answers: antonyms for a synonym question, synonyms for an antonym question
function nearMiss(e, kind, av) {
  if (!kb.ready() || e.rank === undefined) return [];
  const l = kind === 'synonym' ? kb.antonyms(e.rank, true).map((x) => x.w) : kb.synonyms(e.rank, 0, 0).map((x) => x.w);
  return l.filter((w) => okw(w) && !av.has(w));
}
// co-hyponyms: other kinds of the same thing (a retriever is not a poodle)
function siblings(e) {
  if (e.rank === undefined) return [];
  const out = [];
  for (const h of kb.words('hyper', e.rank).slice(0, 2)) { const r = kb.rowOfWord(h); if (r >= 0) for (const w of kb.words('hypo', r)) if (w !== e.w && okw(w) && !e.syn.includes(w)) out.push(w); }
  return out.slice(0, 8);
}
const REL_FOR = { category: 'hyper', part: 'holo', homophone: 'homo', rhyme: 'rhyme', anagram: 'ana', family: 'fam', collocation: 'col', phrase: 'phrase' };
export const KB_KINDS = Object.keys(REL_FOR).concat(['confusable', 'root', 'variant', 'stress', 'syllables', 'build', 'inflect']);
let EXTRAS = null; export const installExtras = (o) => { EXTRAS = o; inflMap = null; };
let inflMap = null; const infl = () => { if (!inflMap) { inflMap = new Map(); for (const [kind, base, f1, f2] of EXTRAS?.inflect ?? []) { if (!inflMap.has(base)) inflMap.set(base, []); inflMap.get(base).push({ kind, f1, f2 }); } } return inflMap; };
export const extras = () => EXTRAS;
const isPal = (w) => w.length >= 3 && new Set(w).size >= 2 && /[aeiouy]/.test(w) && w === [...w].reverse().join('');
const ORD = ['1st', '2nd', '3rd', '4th', '5th'];
export const kindAvailable = (kind) => (['sense', 'cloze', 'missing', 'palindrome'].includes(kind) ? true : kind === 'stress' || kind === 'syllables' ? Boolean(kb.manifest()) : kind === 'build' ? Boolean(kb.manifest()) : kind === 'inflect' ? Boolean(EXTRAS) : kind === 'ladder' ? Boolean(EXTRAS?.ladders?.length) : REL_FOR[kind] ? kb.has(REL_FOR[kind]) && (kind !== 'phrase' || true) : kind === 'confusable' ? kb.confusables().length > 0 : kind === 'root' ? Boolean(kb.manifest()) : kind === 'variant' ? kb.variants().length > 0 : true);
let variantMap = null, variantVer = -1;
const vmap = () => { if (variantMap && variantVer === kb.version()) return variantMap; variantMap = new Map(kb.variants().map(([us, gb]) => [us, gb])); variantVer = kb.version(); return variantMap; };
const confFor = (w) => kb.confusables().find((p) => p[0] === w || p[1] === w);
const anaOk = (e) => e.rank !== undefined && e.w.length >= 4 && e.w.length <= 9 && kb.has('ana') && kb.count('ana', e.rank) === 0 && new Set(e.w).size >= 3;
function canAskKb(e, kind) {
  if (e.letter) return false;
  if (kind === 'sense') return !!e.gloss2 && e.gloss2.length <= 84 && !e.gloss2.toLowerCase().includes(e.w);
  if (kind === 'cloze') return !!e.ex && new RegExp(`\\b${e.w}\\b`, 'i').test(e.ex);
  if (kind === 'missing') return e.w.length >= 4 && e.w.length <= 9;
  if (kind === 'palindrome') return isPal(e.w) && e.rank < 15000;
  if (kind === 'inflect') return Boolean(EXTRAS) && infl().has(e.w);
  if (kind === 'ladder') return Boolean(EXTRAS?.ladders?.some((l) => l.includes(e.w)));
  if (!kb.manifest() || e.rank === undefined) return false;
  const row = e.rank;
  switch (kind) {
    case 'category': return kb.has('hyper') && kb.words('hyper', row).some((h) => okw(h));
    case 'part': return kb.has('holo') && kb.count('holo', row) > 0;
    case 'homophone': return kb.has('homo') && kb.count('homo', row) > 0;
    case 'rhyme': return kb.has('rhyme') && kb.count('rhyme', row) > 1;
    case 'anagram': return anaOk(e);
    case 'family': return kb.has('fam') && kb.count('fam', row) > 0;
    case 'collocation': return kb.has('col') && kb.count('col', row) > 0;
    case 'phrase': return kb.has('phrase') && kb.phrases(row).some((p) => p.text.split(' ').includes(e.w));
    case 'confusable': return Boolean(confFor(e.w));
    case 'root': return Boolean(kb.parts(row)?.root);
    case 'variant': return vmap().has(e.w);
    case 'stress': return kb.syllables(row) >= 3 && kb.col(row, 1) > 0 && kb.col(row, 1) <= kb.syllables(row);
    case 'syllables': return kb.syllables(row) >= 1;
    case 'build': { const p = kb.parts(row); return Boolean(p?.prefix) && e.w.startsWith(p.prefix[0]) && isWord(e.w.slice(p.prefix[0].length)) && e.w.length - p.prefix[0].length >= 3; }
    default: return false;
  }
}
// Harder wrong answers: things from neighbouring categories (other children of the same parent), of a similar level.
function cousins(h, down, e, rng, avoidSet) {
  const hr = kb.rowOfWord(h); if (hr < 0 || !kb.has('hypo')) return [];
  const sibs = [];
  for (const g of kb.words('hyper', hr).filter(okw)) { const gr = kb.rowOfWord(g); if (gr >= 0) for (const s of kb.words('hypo', gr)) if (s !== h) sibs.push(s); }
  const out = [];
  for (const s of rng.shuffle(sibs).slice(0, 8)) {
    const sr = kb.rowOfWord(s); if (sr < 0) continue;
    const pool = down === 'hypo' ? kb.words('hypo', sr) : kb.words('mero', sr);
    for (const w of rng.shuffle(pool.filter(okw))) { const we = entry(w); if (w !== e.w && !avoidSet.has(w) && !out.includes(w) && (!we || Math.abs(we.band - e.band) <= 1)) { out.push(w); break; } }
  }
  return out;
}
// same domain (WordNet file), same part of speech, similar level, but not related: a believable wrong answer
function sameDomain(e, rng, n, avoidSet) {
  const A = allEntries(), out = [];
  for (let i = 0; i < 600 && out.length < n; i += 1) { const d = A[rng.int(A.length)]; if (d.lex === e.lex && d.pos === e.pos && Math.abs(d.band - e.band) <= 1 && d.w !== e.w && !avoidSet.has(d.w) && !out.includes(d.w) && !e.syn.includes(d.w) && d.w.length >= 3) out.push(d.w); }
  return out;
}
const mix = (hard, rng, fallback) => { const h = hard.slice(0, 2); return h.length >= 2 ? h : h.concat(fallback(2 - h.length)); };
function buildKb(kind, e, rng, avoid, base, opt) {
  if (!canAskKb(e, kind)) return null;
  const row = e.rank, pick3 = (right, ds, extra = {}) => (ds.length >= 2 ? { ...base, ...extra, answer: right, options: rng.shuffle([opt(right, true), opt(ds[0], false), opt(ds[1], false)]) } : null);
  const others = (n, av) => distractors(e, n, rng, new Set([...avoid, ...kbRelated(e), ...av]));
  switch (kind) {
    case 'category': { const h = rng.pick(kb.words('hyper', row).filter(okw)); const hr = kb.rowOfWord(h); const kin = new Set(hr >= 0 ? kb.words('hypo', hr) : []); const av = new Set([h, e.w, ...kin]); return pick3(e.w, mix(cousins(h, 'hypo', e, rng, av), rng, (n) => sameDomain(e, rng, n, av).concat(others(n, [h, ...kin])).slice(0, n)), { prompt: h, meaning: e.gloss || '' }); }
    case 'part': { const h = kb.words('holo', row).find(okw) ?? kb.words('holo', row)[0]; const mine = new Set(kb.words('mero', kb.rowOfWord(h))); mine.add(h); mine.add(e.w); return pick3(e.w, mix(cousins(h, 'mero', e, rng, mine), rng, (n) => sameDomain(e, rng, n, mine).concat(others(n, [h])).slice(0, n)), { prompt: h }); }
    case 'homophone': { const h = rng.pick(kb.words('homo', row)); const ds = nearWords(e.w, 3, rng).filter((x) => x !== h); return pick3(h, ds.length >= 2 ? ds : ds.concat(others(2, [h])), { prompt: e.w, note: `${e.w} and ${h} sound the same` }); }
    case 'rhyme': { const rs = kb.words('rhyme', row), r = rng.pick(rs); const near = kb.has('nrhyme') ? kb.words('nrhyme', row).filter((x) => !rs.includes(x) && okw(x)) : []; const ds = mix(rng.shuffle(near), rng, (n) => others(n + 1, rs).filter((x) => x !== r).slice(0, n)); return pick3(r, ds, { prompt: e.w }); }
    case 'anagram': {
      let sc = e.w; for (let i = 0; i < 6 && sc === e.w; i += 1) sc = rng.shuffle([...e.w]).join('');
      if (sc === e.w) return null;
      const same = distractors(e, 8, rng, new Set(avoid)).filter((x) => x.length === e.w.length && [...x].sort().join('') !== [...e.w].sort().join(''));
      const ds = same.length >= 2 ? same : same.concat(others(2, []));
      return pick3(e.w, ds, { prompt: sc.split('').join(' ').toUpperCase(), note: e.gloss });
    }
    case 'family': { const f = rng.pick(kb.words('fam', row)); return pick3(f, others(2, kb.words('fam', row)), { prompt: e.w }); }
    case 'collocation': { const c = rng.pick(kb.list('col', row)); const ce = entry(c.w); const ds = ce ? distractors(ce, 2, rng, new Set([e.w, c.w])) : others(2, [c.w]); return pick3(c.w, ds, { prompt: e.w, note: c.attr === 1 ? `${e.w} ${c.w}` : `${c.w} ${e.w}` }); }
    case 'phrase': { const p = rng.pick(kb.phrases(row).filter((x) => x.text.split(' ').includes(e.w))); const blank = p.text.split(' ').map((t) => (t === e.w ? '___' : t)).join(' '); return pick3(e.w, others(2, []), { prompt: blank, note: `${p.text}: ${p.gloss}` }); }
    case 'confusable': { const p = confFor(e.w); const mine = p[0] === e.w ? 0 : 1, partner = p[1 - mine], hint = p[2 + mine], other = rng.pick(kb.confusables().filter((x) => x !== p)); const third = rng.pick([other[0], other[1]]); return pick3(e.w, [partner, third], { prompt: hint, note: `${p[0]}: ${p[2]}. ${p[1]}: ${p[3]}.` }); }
    case 'root': { const r = kb.parts(row).root; const mean = r[1]; const ds = []; for (let i = 0; i < 40 && ds.length < 2; i += 1) { const x = distractors(e, 1, rng, new Set([...avoid, ...ds]))[0]; const xe = x && entry(x); if (xe && xe.rank !== undefined && kb.parts(xe.rank)?.root?.[0] !== r[0]) ds.push(x); } return pick3(e.w, ds, { prompt: mean, note: `"${r[0]}" means "${mean}"` }); }
    case 'variant': { const gb = vmap().get(e.w); const bad = misspellings(gb, 2, rng); return pick3(gb, bad, { prompt: e.w, note: `${e.w} (US) is ${gb} (UK)` }); }
    case 'sense': return pick3(e.w, others(2, []), { prompt: e.gloss2, note: `${e.w}: ${e.gloss}` });
    case 'cloze': { const blank = e.ex.replace(new RegExp(`\\b${e.w}\\b`, 'i'), '___'); return pick3(e.w, others(2, []), { prompt: blank, note: e.gloss }); }
    case 'missing': {
      const i = 1 + rng.int(e.w.length - 2), L = e.w[i], shown = [...e.w].map((c, k) => (k === i ? '_' : c)).join(' ');
      const wrong = rng.shuffle([...'abcdefghijklmnopqrstuvwxyz'].filter((c) => c !== L && !isWord(e.w.slice(0, i) + c + e.w.slice(i + 1)))).slice(0, 2);
      return pick3(L, wrong, { prompt: shown, note: `${e.w}: ${e.gloss}` });
    }
    case 'palindrome': { const ds = distractors(e, 8, rng, new Set(avoid)).filter((x) => !isPal(x) && x.length >= 3); const same = ds.filter((x) => x.length === e.w.length); return pick3(e.w, (same.length >= 2 ? same : ds).slice(0, 2), { prompt: 'which word is the same backwards?', note: `${e.w} backwards is ${e.w}` }); }
    case 'stress': {
      const sy = kb.syllables(row), st = kb.col(row, 1), pool = ORD.slice(0, sy).filter((x, i) => i + 1 !== st), ds = rng.shuffle(pool).slice(0, 2);
      return pick3(ORD[st - 1], ds, { prompt: e.w, note: `${e.w}: the ${ORD[st - 1]} part is stressed` });
    }
    case 'syllables': {
      const n = kb.syllables(row), cand = [n - 2, n - 1, n + 1, n + 2].filter((x) => x >= 1 && x <= 8), ds = rng.shuffle(cand).slice(0, 2);
      return pick3(String(n), ds.map(String), { prompt: e.w, note: `${e.w} has ${n} syllable${n === 1 ? '' : 's'}` });
    }
    case 'build': {
      const p = kb.parts(row), pf = p.prefix[0], stem = e.w.slice(pf.length), alts = rng.shuffle(['un', 'in', 'dis', 'mis', 'non', 're', 'de', 'im', 'ir', 'over', 'out', 'sub'].filter((x) => x !== pf && !isWord(x + stem) && !isWord(pf + x + stem))).slice(0, 2);
      return pick3(e.w, alts.map((x) => x + stem), { prompt: `${pf}-  +  ${stem}`, note: `${pf}- means "${p.prefix[1]}": ${e.w}` });
    }
    case 'ladder': {
      const lad = rng.pick(EXTRAS.ladders.filter((l) => l.includes(e.w))), i0 = lad.indexOf(e.w), others = lad.map((w, i) => [w, i]).filter(([, i]) => i !== i0);
      const pair = rng.shuffle(others).slice(0, 2); if (pair.length < 2) return null;
      const trio = [[e.w, i0], ...pair], strong = rng.chance(0.5), pickv = trio.reduce((a, b) => ((strong ? b[1] > a[1] : b[1] < a[1]) ? b : a));
      return { ...base, label: strong ? 'WHICH IS THE STRONGEST?' : 'WHICH IS THE MILDEST?', prompt: 'same idea, different strength', answer: pickv[0], note: lad.join('  <  '), options: rng.shuffle(trio.map(([w]) => opt(w, w === pickv[0]))) };
    }
    case 'inflect': {
      const it = rng.pick(infl().get(e.w)), b = e.w;
      if (it.kind === 'verb') {
        const wantPart = it.f1 !== it.f2 && rng.chance(0.5), right = wantPart ? it.f2 : it.f1, other = wantPart ? it.f1 : it.f2, reg = /e$/.test(b) ? `${b}d` : `${b}ed`;
        const ds = [...new Set([reg, other, `${right}ed`, `${b}t`].filter((x) => x !== right && (x === other || !isWord(x))))].slice(0, 2); if (ds.length < 2) return null;
        return pick3(right, ds, { prompt: wantPart ? `I have ___  (${b})` : `Yesterday I ___  (${b})`, note: `${b}, ${it.f1}, ${it.f2}` });
      }
      if (it.kind === 'noun') { const reg = /(s|x|ch|sh)$/.test(b) ? `${b}es` : `${b}s`, alt = reg.endsWith('es') ? `${b}s` : `${b}es`; const ds = [reg, alt].filter((x) => x !== it.f1 && !isWord(x)); if (ds.length < 2) return null; return pick3(it.f1, ds, { prompt: `two ___  (${b})`, note: `${b} - ${it.f1}` }); }
      const ds = [`${b}er`, `${b}ier`, `more ${b}`.replace(' ', '')].filter((x) => x !== it.f1 && !isWord(x)).slice(0, 2); if (ds.length < 2) return null;
      return pick3(it.f1, ds, { prompt: `more ${b}  =  ___`, note: `${b}, ${it.f1}, ${it.f2}` });
    }
    default: return null;
  }
}
