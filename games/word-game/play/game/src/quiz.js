// Question builders. Every question has the same shape so the drifting-word play layer never changes:
//   { kind, label, prompt, options: [{ text, correct }, x3], word, answer, meaning, speak? }
// All randomness comes from the rng passed in; all word data from lexicon.js (WordNet relations + the validation lexicon).
import { entry, distractors, isWord, extraDistractors, all as allEntries, kidOk, TOPICS, topicOf, posName } from './lexicon.js';
import { ART_WORDS } from './art.js';
import * as kb from './kb.js';
import { LETTERS, LETTER_NAMES, similar } from './letters.js';
import * as deck from './deck.js';
import { EX, exWord } from './alpha.js';
import { canAskAnalogy, buildAnalogy, bankReady, setLadders } from './analogy.js';
const ART = new Set(ART_WORDS);

export const KIND_LABEL = {
  synonym: 'TAP THE SYNONYM OF', antonym: 'TAP THE ANTONYM OF', definition: 'WHICH WORD MEANS', odd: 'ODD ONE OUT',
  spelling: 'TAP THE RIGHT SPELLING', listening: 'LISTEN, THEN TAP',
  category: 'WHICH IS A KIND OF', part: 'WHICH IS PART OF', homophone: 'SOUNDS LIKE', rhyme: 'RHYMES WITH', anagram: 'UNSCRAMBLE THE LETTERS', family: 'SAME WORD FAMILY AS', collocation: 'GOES WITH', phrase: 'FINISH THE PHRASE', confusable: 'WHICH WORD MEANS', root: 'WORD WITH A ROOT MEANING', variant: 'THE BRITISH SPELLING OF',
  sense: 'WHICH WORD CAN ALSO MEAN', cloze: 'FILL THE GAP', missing: 'FIND THE MISSING LETTER', stress: 'WHICH PART IS STRESSED?', syllables: 'HOW MANY SYLLABLES?', palindrome: 'READS THE SAME BACKWARDS', build: 'PUT THE PARTS TOGETHER', inflect: 'THE RIGHT FORM OF', 'letter-vowel': 'VOWEL OR CONSONANT?',
  usage: 'WHICH SENTENCE USES IT RIGHT?', hearmeaning: 'LISTEN, THEN TAP THE MEANING', hearspell: 'LISTEN, THEN TAP THE SPELLING', sorttopic: 'WHICH GROUP DOES IT BELONG TO?', sortpos: 'WHAT KIND OF WORD IS IT?', general: 'WHICH IS THE MOST GENERAL?',
  ladder: 'WHICH IS THE STRONGEST?', analogy: 'COMPLETE THE ANALOGY', beginsound: 'SAME FIRST SOUND AS', endsound: 'SAME LAST SOUND AS', breakword: 'HOW IS IT BUILT?',
  ...Object.fromEntries(Object.entries(deck.DECK_KINDS).map(([k, v]) => [k, v.label])),
  picture: 'WHAT IS THIS?', 'letter-hear': 'LISTEN, THEN TAP THE LETTER', 'letter-case': 'FIND THE SMALL LETTER', 'letter-next': 'WHICH LETTER IS MISSING?',
  'letter-find': 'FIND THE SAME LETTER', 'letter-odd': 'WHICH LETTER IS DIFFERENT?', 'letter-order': 'WHAT COMES NEXT?', 'letter-look': 'WHICH LETTER DOES IT START WITH?', 'letter-pic': 'WHICH LETTER DOES IT START WITH?',
};
// quiz kinds about word relationships: their answer reveal and result rows offer the Thesaurus
export const REL_QUIZ_KINDS = new Set(['synonym', 'antonym', 'ladder', 'category', 'part', 'family', 'general', 'odd', 'analogy']);
export const KIND_SHORT = { analogy: 'ANALOGY', usage: 'USAGE', hearmeaning: 'HEAR + MEANING', hearspell: 'HEAR + SPELL', sorttopic: 'SORT', sortpos: 'SORT', general: 'LADDER', breakword: 'PARTS', beginsound: 'FIRST SOUND', endsound: 'LAST SOUND', ...Object.fromEntries(Object.entries(deck.DECK_KINDS).map(([k, v]) => [k, v.short])), synonym: 'SYNONYM', antonym: 'ANTONYM', definition: 'MEANING', odd: 'ODD ONE', spelling: 'SPELLING', listening: 'LISTENING', picture: 'PICTURE', ladder: 'STRENGTH', sense: 'MEANING', cloze: 'CLOZE', missing: 'LETTER', stress: 'STRESS', syllables: 'SYLLABLES', palindrome: 'PALINDROME', build: 'BUILD', inflect: 'FORM', 'letter-vowel': 'LETTER', category: 'KIND OF', part: 'PART OF', homophone: 'SOUNDS', rhyme: 'RHYME', anagram: 'ANAGRAM', family: 'FAMILY', collocation: 'GOES WITH', phrase: 'PHRASE', confusable: 'CONFUSED', root: 'ROOT', variant: 'UK SPELLING', 'letter-hear': 'LETTER', 'letter-case': 'LETTER', 'letter-next': 'LETTER', 'letter-find': 'LETTER', 'letter-odd': 'LETTER', 'letter-order': 'LETTER', 'letter-look': 'LETTER', 'letter-pic': 'LETTER' };

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
  if (e.letter) return kind === 'letter-case' || kind === 'letter-next' || kind === 'letter-vowel' || kind === 'letter-find' || kind === 'letter-odd' || kind === 'letter-order' || ((kind === 'letter-look' || kind === 'letter-pic') && e.w !== 'x') || (kind === 'letter-hear' && !!ctx.canSpeak);
  if (deck.isDeckKind(kind)) return deck.deckKindOk(kind) && (!deck.needsVoice(kind) || Boolean(ctx.canSpeak));
  switch (kind) {
    case 'picture': return ART.has(e.w) && !!e.gloss;
    case 'synonym': return synAnswers(e).length > 0;
    case 'antonym': return antAnswers(e).length > 0;
    case 'definition': return !!e.gloss && !e.gloss.toLowerCase().includes(e.w) && e.gloss.length <= 84;
    case 'odd': return synAnswers(e).length > 0;
    case 'spelling': return e.w.length >= 4 && !!e.gloss && !e.gloss.toLowerCase().includes(e.w) && e.gloss.length <= 84;
    case 'listening': return !!ctx.canSpeak && e.w.length >= 3;
    case 'hearmeaning': return !!ctx.canSpeak && shortGloss(e);
    case 'hearspell': return !!ctx.canSpeak && e.w.length >= 4 && /^[a-z]+$/.test(e.w);
    case 'usage': return usageOk(e);
    case 'sorttopic': return Boolean(sortTopic(e));
    case 'analogy': return canAskAnalogy(e);
    case 'sortpos': return posName(e.pos) !== '' && !!e.gloss && e.gloss.length <= 60 && !e.gloss.toLowerCase().includes(e.w);
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
  if (deck.isDeckKind(kind)) return deck.buildDeck(kind, rng);
  const opt = (text, correct) => ({ text, correct });
  const base = { kind, label: KIND_LABEL[kind], word: e.w, meaning: e.gloss || '', letter: Boolean(e.letter) };
  if (e.letter) {
    const i = LETTERS.indexOf(e.w), meaning = `${e.up} ${e.w}  is called "${LETTER_NAMES[e.w]}"`;
    const ds = similar(e.w, 2, rng);
    if (kind === 'letter-case') return { ...base, meaning, prompt: e.up, answer: e.w, options: rng.shuffle([opt(e.w, true), opt(ds[0], false), opt(ds[1], false)]) };
    if (kind === 'letter-hear') return { ...base, meaning, prompt: 'tap the speaker to hear it', speak: LETTER_NAMES[e.w], answer: e.up, options: rng.shuffle([opt(e.up, true), opt(ds[0].toUpperCase(), false), opt(ds[1].toUpperCase(), false)]) };
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
    if (kind === 'letter-find') {
      const up = rng.chance(0.5), f = (c) => (up ? c.toUpperCase() : c);
      return { ...base, meaning, prompt: f(e.w), answer: f(e.w), options: rng.shuffle([opt(f(e.w), true), opt(f(ds[0]), false), opt(f(ds[1]), false)]) };
    }
    if (kind === 'letter-odd') {
      const odd = ds[0], third = rng.pick(LETTERS.filter((c) => c !== e.w && c !== odd)), at = rng.int(5), seq = [0, 1, 2, 3, 4].map((k) => (k === at ? odd : e.w));
      return { ...base, meaning, prompt: seq.join('  '), answer: odd, note: `${odd} is different from ${e.w}`, options: rng.shuffle([opt(odd, true), opt(e.w, false), opt(third, false)]) };
    }
    if (kind === 'letter-order') {
      const after = i === 0 ? true : i === 25 ? false : rng.chance(0.5), ans = LETTERS[after ? i + 1 : i - 1];
      const far = rng.shuffle(LETTERS.filter((c) => c !== ans && c !== e.w && Math.abs(LETTERS.indexOf(c) - i) > 1)).slice(0, 2);
      return { ...base, label: after ? 'WHAT COMES AFTER?' : 'WHAT COMES BEFORE?', meaning, prompt: e.up, answer: ans, note: `${after ? 'After' : 'Before'} ${e.up} comes ${ans.toUpperCase()}`, options: rng.shuffle([opt(ans, true), opt(far[0], false), opt(far[1], false)]) };
    }
    if (kind === 'letter-look' || kind === 'letter-pic') {
      const pool = kind === 'letter-look' ? ds : rng.shuffle(LETTERS.filter((c) => c !== e.w && c !== 'x')).slice(0, 2);
      return { ...base, meaning: `${e.up} is for ${exWord(e.w)}`, prompt: exWord(e.w), art: EX[e.w], speak: exWord(e.w), answer: e.w, note: `${exWord(e.w)} starts with ${e.up} ${e.w}`, options: rng.shuffle([opt(e.w, true), opt(pool[0], false), opt(pool[1], false)]) };
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
    return { ...base, prompt: 'tap the speaker to hear it', speak: e.w, answer: e.w, options: rng.shuffle([opt(e.w, true), opt(others[0], false), opt(others[1], false)]) };
  }
  if (kind === 'hearmeaning') {                 // L24 / E3: hear the word, choose the meaning
    const ds = rng.shuffle(distractors(e, 8, rng, new Set([...avoid, ...kbRelated(e)])).map((w) => entry(w)).filter((d) => d && shortGloss(d) && !d.gloss.toLowerCase().includes(e.w) && d.gloss !== e.gloss)).slice(0, 2);
    if (ds.length < 2) return null;
    return { ...base, prompt: 'tap the speaker to hear it', speak: e.w, answer: tidy(e.gloss), note: `${e.w}: ${e.gloss}`, options: rng.shuffle([opt(tidy(e.gloss), true), opt(tidy(ds[0].gloss), false), opt(tidy(ds[1].gloss), false)]) };
  }
  if (kind === 'hearspell') {                   // L21: hear the word, choose the spelling
    const bad = misspellings(e.w, 2, rng); if (bad.length < 2) return null;
    return { ...base, prompt: 'tap the speaker to hear it', speak: e.w, answer: e.w, note: `${e.w}: ${e.gloss}`, options: rng.shuffle([opt(e.w, true), opt(bad[0], false), opt(bad[1], false)]) };
  }
  if (kind === 'usage') {                       // F5: which sentence uses the word correctly
    const hosts = usageHosts(e, rng, new Set([...avoid, ...kbRelated(e)])); if (hosts.length < 2) return null;
    const wrong = hosts.slice(0, 2).map((h) => h.ex.replace(new RegExp(`\\b${h.w}\\b`, 'i'), e.w));
    if (wrong.some((x) => x === e.ex) || wrong[0] === wrong[1]) return null;
    return { ...base, prompt: e.w, answer: e.ex, note: `${e.w}: ${e.gloss}`, options: rng.shuffle([opt(e.ex, true), opt(wrong[0], false), opt(wrong[1], false)]) };
  }
  if (kind === 'sorttopic') {                   // L25 / C12: sort into the group it belongs to
    const t = sortTopic(e); if (!t) return null;
    const bad = TOPIC_BINS.filter((x) => x !== t && !(TOPIC_CLASH[t] ?? []).includes(x)); const ds = rng.shuffle(bad).slice(0, 2);
    const lab = (k) => TOPICS.find((x) => x.k === k).label;
    return { ...base, prompt: e.w, answer: lab(t), note: `${e.w} (${e.gloss}) belongs with: ${lab(t)}`, options: rng.shuffle([opt(lab(t), true), opt(lab(ds[0]), false), opt(lab(ds[1]), false)]) };
  }
  if (kind === 'sortpos') {                     // L25: sort by part of speech
    const mine = posName(e.pos), bins = ['noun', 'verb', 'adjective', 'adverb'].filter((x) => x !== mine), ds = rng.shuffle(bins.slice(0, 3)).slice(0, 2);
    return { ...base, prompt: `${e.w}: ${e.gloss}`, answer: mine, note: `${e.w} is a ${mine} (in this meaning)`, options: rng.shuffle([opt(mine, true), opt(ds[0], false), opt(ds[1], false)]) };
  }
  if (kind === 'analogy') return buildAnalogy(e, rng, base, opt);
  return buildKb(kind, e, rng, avoid, base, opt);
}
export { entry };

// ---- sorting, usage and hearing helpers (L24, L21, F5, L25, C12) ------------------------------------------------------------------
const shortGloss = (e) => !!e.gloss && e.gloss.length <= 48 && !e.gloss.toLowerCase().includes(e.w);
const hasWordIn = (w, s) => new RegExp(`\\b${w}\\b`, 'i').test(s);
const isSentence = (t) => /^[A-Z][^]*[.!?]$/.test(t) && t.split(/\s+/).length >= 4;
const exOk = (e) => !!e.ex && e.ex.length <= 56 && isSentence(e.ex) && hasWordIn(e.w, e.ex);
const tidy = (g) => g.replace(/[\s,;:]+$/, '');
const usageOk = (e) => exOk(e) && e.rank !== undefined && Boolean(e.gloss) && e.w.length >= 3;
// other words' example sentences, with that word swapped for e.w: grammatical but not meaningful (a different meaning area, same part of speech)
function usageHosts(e, rng, avoidSet) {
  const A = allEntries(), out = [];
  for (let i = 0; i < 900 && out.length < 2; i += 1) {
    const d = A[rng.int(A.length)];
    if (d.w === e.w || d.pos !== e.pos || d.lex === e.lex || Math.abs(d.band - e.band) > 1 || !kidOk(d) || !exOk(d) || avoidSet.has(d.w) || d.syn.includes(e.w) || d.ant.includes(e.w) || e.syn.includes(d.w)) continue;
    if (out.some((x) => x.ex === d.ex || x.w === d.w) || hasWordIn(e.w, d.ex)) continue;
    out.push(d);
  }
  return out;
}
// topic bins: only topics whose names a player can tell apart; pairs that overlap are never offered together
const TOPIC_BINS = ['animals', 'plants', 'body', 'food', 'feelings', 'people', 'places', 'time', 'things', 'nature', 'mind', 'action'];
const TOPIC_CLASH = { things: ['nature', 'places'], nature: ['things', 'places', 'plants', 'animals'], places: ['things', 'nature'], body: ['people', 'feelings'], people: ['body', 'feelings'], feelings: ['mind', 'body', 'people'], mind: ['feelings', 'action'], action: ['mind'], animals: ['nature'], plants: ['nature', 'food'], food: ['plants'] };
const sortTopic = (e) => { const t = topicOf(e.lex); return TOPIC_BINS.includes(t) && !!e.gloss && e.rank !== undefined && e.band <= 4 ? t : ''; };

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
let EXTRAS = null; export const installExtras = (o) => { EXTRAS = o; inflMap = null; setLadders(o?.ladders); };
let inflMap = null; const infl = () => { if (!inflMap) { inflMap = new Map(); for (const [kind, base, f1, f2] of EXTRAS?.inflect ?? []) { if (!inflMap.has(base)) inflMap.set(base, []); inflMap.get(base).push({ kind, f1, f2 }); } } return inflMap; };
export const extras = () => EXTRAS;
// frequency sets (the most common 100 / 300 / 1000 study words) join the everyday word sets
export function addCommonSets(entries) {
  if (!EXTRAS) return;
  const ws = entries.filter((e) => /^[a-z]{2,}$/.test(e.w)).map((e) => e.w), have = new Set((EXTRAS.sets ?? []).map((s) => s.id));
  const add = [[100, 'Most common words: first 100'], [300, 'Most common words: first 300'], [1000, 'Most common words: first 1000']].filter(([n]) => !have.has(`common${n}`)).map(([n, name]) => ({ id: `common${n}`, name, words: ws.slice(0, n) }));
  EXTRAS.sets = [...add, ...(EXTRAS.sets ?? [])];
}
// more reading passages (the authored English deck) join the built-in ones; ids stay unique
export function addPassages(list) { if (!EXTRAS) return; const have = new Set((EXTRAS.passages ?? []).map((p) => p.id)); EXTRAS.passages = [...(EXTRAS.passages ?? []), ...list.filter((p) => !have.has(p.id))]; }
const isPal = (w) => w.length >= 3 && new Set(w).size >= 2 && /[aeiouy]/.test(w) && w === [...w].reverse().join('');
const ORD = ['1st', '2nd', '3rd', '4th', '5th'];
export const kindAvailable = (kind) => (deck.isDeckKind(kind) ? deck.deckKindOk(kind) : kind === 'analogy' ? bankReady() : ['sense', 'cloze', 'missing', 'palindrome'].includes(kind) ? true : kind === 'stress' || kind === 'syllables' ? Boolean(kb.manifest()) : kind === 'build' ? Boolean(kb.manifest()) : kind === 'inflect' ? Boolean(EXTRAS) : kind === 'ladder' ? Boolean(EXTRAS?.ladders?.length) : kind === 'general' ? kb.has('hyper') : REL_FOR[kind] ? kb.has(REL_FOR[kind]) && (kind !== 'phrase' || true) : kind === 'confusable' ? kb.confusables().length > 0 : kind === 'beginsound' || kind === 'endsound' ? true : kind === 'root' || kind === 'breakword' ? Boolean(kb.manifest()) : kind === 'variant' ? kb.variants().length > 0 : true);
let variantMap = null, variantVer = -1;
const vmap = () => { if (variantMap && variantVer === kb.version()) return variantMap; variantMap = new Map(kb.variants().map(([us, gb]) => [us, gb])); variantVer = kb.version(); return variantMap; };
const confFor = (w) => kb.confusables().find((p) => p[0] === w || p[1] === w);
const anaOk = (e) => e.rank !== undefined && e.w.length >= 4 && e.w.length <= 9 && kb.has('ana') && kb.count('ana', e.rank) === 0 && new Set(e.w).size >= 3;
// Prefix/ending split of a word for "Break the word": [left, right, meaning] or null.
function splitOf(e) {
  if (e.rank === undefined || e.w.length < 5) return null;
  const p = kb.parts(e.rank); if (!p) return null;
  if (p.prefix && e.w.startsWith(p.prefix[0]) && e.w.length - p.prefix[0].length >= 3) return [p.prefix[0], e.w.slice(p.prefix[0].length), `${p.prefix[0]}- means ${p.prefix[1]}`];
  if (p.suffix && e.w.endsWith(p.suffix[0]) && e.w.length - p.suffix[0].length >= 3) return [e.w.slice(0, -p.suffix[0].length), p.suffix[0], `-${p.suffix[0]} means ${p.suffix[1]}`];
  return null;
}
// Beginning and ending sounds for young readers: only letters that sound the same in every word (no c, g, s, x, q; no digraph starts).
const BEGIN_OK = 'bdfhjlmnprtvwz', END_OK = 'bdgkmnpt';
const beginKey = (w) => (BEGIN_OK.includes(w[0]) && !/^(wh|wr|ph|th|sh|ch|kn|gh|ps)/.test(w) ? w[0] : '');
const endKey = (w) => (END_OK.includes(w[w.length - 1]) && !/(mb|gn|ng|ck|ph|gh|th)$/.test(w) ? w[w.length - 1] : '');
function canAskKb(e, kind) {
  if (kind === 'beginsound') return !e.letter && e.band <= 1 && e.w.length >= 3 && e.w.length <= 7 && Boolean(beginKey(e.w));
  if (kind === 'endsound') return !e.letter && e.band <= 1 && e.w.length >= 3 && e.w.length <= 7 && Boolean(endKey(e.w));
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
    case 'general': return Boolean(chainOf(e));
    case 'part': return kb.has('holo') && kb.count('holo', row) > 0;
    case 'homophone': return kb.has('homo') && kb.count('homo', row) > 0;
    case 'rhyme': return kb.has('rhyme') && kb.count('rhyme', row) > 1;
    case 'anagram': return anaOk(e);
    case 'family': return kb.has('fam') && kb.count('fam', row) > 0;
    case 'collocation': return kb.has('col') && kb.count('col', row) > 0;
    case 'phrase': return kb.has('phrase') && kb.phrases(row).some((p) => p.text.split(' ').includes(e.w));
    case 'confusable': return Boolean(confFor(e.w));
    case 'root': return Boolean(kb.parts(row)?.root);
    case 'breakword': return Boolean(splitOf(e));
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
  for (let i = 0; i < 600 && out.length < n; i += 1) { const d = A[rng.int(A.length)]; if (kidOk(d) && d.lex === e.lex && d.pos === e.pos && Math.abs(d.band - e.band) <= 1 && d.w !== e.w && !avoidSet.has(d.w) && !out.includes(d.w) && !e.syn.includes(d.w) && d.w.length >= 3) out.push(d.w); }
  return out;
}
// word, its kind-of, and that word's kind-of: three words on one ladder of generality
function chainOf(e) {
  if (!kb.manifest() || e.rank === undefined || !kb.has('hyper')) return null;
  for (const h of kb.words('hyper', e.rank).filter(okw)) {
    const hr = kb.rowOfWord(h); if (hr < 0) continue;
    const g = kb.words('hyper', hr).find((x) => okw(x) && x !== e.w && x !== h);
    if (g && entry(g) && kidOk(entry(g)) && kidOk(entry(h) ?? e)) return [e.w, h, g];
  }
  return null;
}
const mix = (hard, rng, fallback) => { const h = hard.slice(0, 2); return h.length >= 2 ? h : h.concat(fallback(2 - h.length)); };
function buildKb(kind, e, rng, avoid, base, opt) {
  if (!canAskKb(e, kind)) return null;
  if (kind === 'beginsound' || kind === 'endsound') {
    const key = kind === 'beginsound' ? beginKey : endKey, k = key(e.w), same = allEntries().filter((x) => kidOk(x) && x.band <= 1 && x.w !== e.w && x.w.length >= 3 && x.w.length <= 7 && key(x.w) === k);
    const diff = allEntries().filter((x) => kidOk(x) && x.band <= 1 && x.w.length >= 3 && x.w.length <= 7 && key(x.w) && key(x.w) !== k);
    if (same.length < 1 || diff.length < 2) return null;
    const right = rng.pick(same), wr = []; for (let i = 0; i < 30 && wr.length < 2; i += 1) { const d = rng.pick(diff); if (!wr.includes(d.w) && key(d.w) !== key(right.w)) wr.push(d.w); }
    if (wr.length < 2) return null;
    return { ...base, prompt: e.w, answer: right.w, speak: e.w, note: `${e.w} and ${right.w} ${kind === 'beginsound' ? 'start' : 'end'} with the sound of ${k}`, options: rng.shuffle([opt(right.w, true), opt(wr[0], false), opt(wr[1], false)]) };
  }
  const row = e.rank, pick3 = (right, ds, extra = {}) => (ds.length >= 2 ? { ...base, ...extra, answer: right, options: rng.shuffle([opt(right, true), opt(ds[0], false), opt(ds[1], false)]) } : null);
  const others = (n, av) => distractors(e, n, rng, new Set([...avoid, ...kbRelated(e), ...av]));
  switch (kind) {
    case 'general': {                           // C5: a ladder from specific to general (poodle, dog, animal)
      const ch = chainOf(e); if (!ch) return null; const specific = rng.chance(0.5), pickW = specific ? ch[0] : ch[ch.length - 1];
      return { ...base, label: specific ? 'WHICH IS THE MOST SPECIFIC?' : 'WHICH IS THE MOST GENERAL?', prompt: 'same family of ideas', answer: pickW, note: ch.join('  <  '), options: rng.shuffle(ch.map((w) => opt(w, w === pickW))) };
    }
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
    case 'breakword': {
      const [a, b, note] = splitOf(e), cut = a.length, w = e.w, wr = [];
      for (const c of [cut - 1, cut + 1, cut - 2, cut + 2]) if (c >= 2 && w.length - c >= 2 && c !== cut && wr.length < 2) wr.push(`${w.slice(0, c)} + ${w.slice(c)}`);
      if (wr.length < 2) return null;
      return { ...base, prompt: w, answer: `${a} + ${b}`, note, options: rng.shuffle([opt(`${a} + ${b}`, true), opt(wr[0], false), opt(wr[1], false)]) };
    }
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

// More wrong options for a synonym/antonym question (the "words on screen" setting): never a related word of the prompt.
export function extraWrong(e, q, n, rng) {
  const av = new Set([...kbRelated(e), ...q.options.map((o) => o.text), q.prompt]);
  for (const s of synAnswers(e)) av.add(s.w);
  for (const s of antAnswers(e)) av.add(s.w);
  return fallbackDistractors(e, n, rng, av);
}
