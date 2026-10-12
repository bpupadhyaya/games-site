// The English practice decks (web/data/kb/content.json): early reading, phonics, idioms, register, word webs, workouts, passages, poems.
// Authored at build time (data-build/authored, reviewed, see design/ai-authored-review.md), installed by platform.js after the first frame.
// Pure: no randomness except through the rng passed in.
let D = null, V = 0;
export const install = (json) => { D = json && typeof json === 'object' ? json : null; V += 1; };
export const ready = () => D !== null;
export const version = () => V;
let PLAN = null;                                     // the player's adaptive plan (adapt.plan): authored depth decks are filtered by level and child safety
export const setPlan = (p) => { PLAN = p ?? null; };
export const get0 = (k) => (D && Array.isArray(D[k]) ? D[k] : []);
export const getFit = (k) => (PLAN ? fitItems(get0(k), PLAN, 8) : get0(k));
export const get = (k) => (D && Array.isArray(D[k]) ? D[k] : []);
export const count = (k) => get(k).length;

import { ART_WORDS } from './art.js';
import { fitItems, kidOkEntry } from './adapt.js';
import * as lex from './lexicon.js';
const ART_SET = new Set(ART_WORDS);
// ---- small helpers shared by the question builders and the Learn pages
const opt = (text, correct) => ({ text, correct });
const others = (arr, item, n, rng, key = (x) => x) => rng.shuffle(arr.filter((x) => key(x) !== key(item))).slice(0, n);

// Deck kinds: each draws one item from its deck. `noRec` means it is not tied to a study word (no memory record is written).
export const DECK_KINDS = {
  blend: { label: 'SOUND IT OUT', short: 'SOUND OUT', name: 'Sound it out', blurb: 'Blend the sounds c-a-t into a word', deck: 'blend', speak: true },
  frame: { label: 'FINISH THE SENTENCE', short: 'FRAME', name: 'Sight-word sentences', blurb: 'Pick the word that fits a simple sentence', deck: 'frames' },
  phonics: { label: 'WHICH HAS THIS SOUND?', short: 'PHONICS', name: 'Spelling sounds', blurb: 'Which word has the sound pattern', deck: 'patterns' },
  homosent: { label: 'WHICH WORD FITS?', short: 'SOUNDS', name: 'Homophones in sentences', blurb: 'Pick the right spelling for the sentence', deck: 'homophones' },
  rulep: { label: 'SPELLING RULE', short: 'RULE', name: 'Spelling rules', blurb: 'Practise the rules with real words', deck: 'rules' },
  idiom: { label: 'WHAT DOES IT MEAN?', short: 'IDIOM', name: 'Idioms', blurb: 'What a common saying really means', deck: 'idioms' },
  phrasalq: { label: 'WHAT DOES IT MEAN?', short: 'PHRASAL', name: 'Phrasal verbs', blurb: 'Verbs with a little word: give up, look after', deck: 'phrasal' },
  proverb: { label: 'FINISH THE SAYING', short: 'PROVERB', name: 'Proverbs', blurb: 'Complete a well-known saying', deck: 'proverbs' },
  register: { label: 'WHICH IS MORE FORMAL?', short: 'FORMAL', name: 'Formal and casual', blurb: 'Pick the more formal word', deck: 'register' },
  usuk: { label: 'THE BRITISH WORD', short: 'US / UK', name: 'US and UK words', blurb: 'Match American and British words', deck: 'usuk' },
  figure: { label: 'WHAT KIND OF LANGUAGE?', short: 'FIGURE', name: 'Simile, metaphor or plain', blurb: 'Is it a simile, a metaphor or literal', deck: 'figures' },
  upgrade: { label: 'PICK A BETTER WORD', short: 'UPGRADE', name: 'Better word choice', blurb: 'Swap a dull word for a stronger one', deck: 'upgrade' },
  tone: { label: 'HOW DOES IT FEEL?', short: 'TONE', name: 'Positive or negative', blurb: 'Is the word positive, negative or neutral', deck: 'tone' },
  thesaurus: { label: 'TAP THE SAME MEANING', short: 'THESAURUS', name: 'Thesaurus workout', blurb: 'Find the word with the same meaning', deck: 'thesaurus' },
  related: { label: 'WHICH BELONGS?', short: 'BELONGS', name: 'Word webs', blurb: 'Which word belongs with the others', deck: 'webs' },
  paraphrase: { label: 'SAME MEANING', short: 'REWORD', name: 'Say it another way', blurb: 'Pick the sentence that says the same thing', deck: 'paraphrase' },
  // English for daily life (hub audit wave 4). mc = generic multiple choice from {q, a, x[], n?, s?}; audio = needs the phone voice; pic = shows a picture.
  greet: { label: 'WHAT DO YOU SAY?', short: 'GREETINGS', name: 'Greetings and phrases', blurb: 'What to say when you meet, thank, ask or say goodbye', deck: 'greet', mc: true },
  signs: { label: 'WHAT DOES IT SAY?', short: 'SIGNS', name: 'Signs, labels and forms', blurb: 'Read everyday signs, labels, forms and timetables', deck: 'signs', mc: true },
  settle: { label: 'WHAT DOES IT MEAN?', short: 'SETTLING IN', name: 'Settling in', blurb: 'Words for renting, banks, doctors and everyday life in a new country', deck: 'settle', mc: true },
  daily: { label: 'NUMBERS, DAYS AND TIME', short: 'EVERYDAY', name: 'Numbers, days, time and money', blurb: 'Numbers, colours, days, months, time and money', deck: 'daily', mc: true },
  trade: { label: 'AT WORK', short: 'TRADES', name: 'Trade starter packs', blurb: 'Words for construction, hospitality and driving', deck: 'trade', mc: true },
  workeng: { label: 'AT WORK', short: 'WORK', name: 'Workplace English', blurb: 'Emails, meetings and interviews', deck: 'workeng', mc: true },
  manners: { label: 'WHAT IS POLITE?', short: 'CUSTOMS', name: 'Polite forms and customs', blurb: 'Everyday manners and customs, in general', deck: 'manners', mc: true },
  pron: { label: 'LISTEN, THEN TAP THE WORD', short: 'SOUNDS', name: 'Sounds that are hard', blurb: 'Hear a word and tap it: th, r and l, v and w, vowels and more', deck: 'pron', audio: true },
  placepic: { label: 'WHAT IS THIS?', short: 'PLACES', name: 'Picture dictionary by place', blurb: 'Pictures from home, the market, the clinic, the farm, school, the office and travel', deck: 'places', pic: true },
};
// Linguistic-depth decks (hub audit wave 6). mc = {q, a, x[], n, lv, k}; fit = filtered by level and child safety through adapt.fitItems.
const DEPTH = {
  style: { label: 'WHICH STYLE?', short: 'STYLE', name: 'Register and style', blurb: 'Formal, academic, legal, poetic, plain or casual', deck: 'style', mc: true, fit: true },
  pragma: { label: 'WHAT IS MEANT?', short: 'MEANING', name: 'Politeness and hidden meaning', blurb: 'Polite requests, hedging and what people really mean', deck: 'pragma', mc: true, fit: true },
  rhetoric: { label: 'WHICH DEVICE?', short: 'DEVICE', name: 'Spot the rhetorical device', blurb: 'Anaphora, tricolon, chiasmus, litotes and more', deck: 'rhetoric', mc: true, fit: true },
  rhetdef: { label: 'NAME THE DEVICE', short: 'DEVICE', name: 'Name the device', blurb: 'Match a rhetorical device to what it does', deck: 'rhetlib', fit: true },
  sounddev: { label: 'WHICH SOUND DEVICE?', short: 'SOUND', name: 'Poetry sound devices', blurb: 'Rhyme, alliteration, assonance, rhythm', deck: 'sounddev', mc: true, fit: true },
  formation: { label: 'HOW WAS THE WORD MADE?', short: 'FORMED', name: 'How words are formed', blurb: 'Blends, clippings, acronyms, back-formation, compounds', deck: 'formation', mc: true, fit: true },
  coining: { label: 'HOW WAS THE TERM MADE?', short: 'COINED', name: 'How technical terms are coined', blurb: 'Greek and Latin parts, acronyms, old words with new uses', deck: 'coining', mc: true, fit: true },
  wordplay: { label: 'WORDPLAY', short: 'PLAY', name: 'Wordplay', blurb: 'Puns, spoonerisms, malapropisms, palindromes', deck: 'wordplay', mc: true, fit: true },
  regional: { label: 'WHICH ENGLISH?', short: 'REGIONS', name: 'World Englishes', blurb: 'Spellings and words in Australia, Canada, Britain, India and more', deck: 'regional', mc: true, fit: true },
  slang: { label: 'WHAT DOES IT MEAN?', short: 'SLANG', name: 'Slang and new words', blurb: 'Slang with the era it became popular', deck: 'slang', mc: true, fit: true },
  compound: { label: 'JOIN THE WORDS', short: 'COMPOUND', name: 'Compound words', blurb: 'Join two words into one, or split a compound', deck: 'compound', fit: true, src: 'compound' },
};
Object.assign(DECK_KINDS, DEPTH);
export const isDeckKind = (k) => Object.prototype.hasOwnProperty.call(DECK_KINDS, k);
export const deckKindOk = (k) => ready() && isDeckKind(k) && (DECK_KINDS[k].src === 'compound' ? lex.compoundList().length > 0 : DECK_KINDS[k].fit ? getFit(DECK_KINDS[k].deck).length >= 4 : count(DECK_KINDS[k].deck) > 0);
export const needsVoice = (k) => Boolean(DECK_KINDS[k]?.audio);

const title = (s) => s;
// Build one question from the deck, or null. Same shape as quiz.js questions.
export function buildDeck(kind, rng) {
  const spec = DECK_KINDS[kind]; if (!spec) return null;
  if (spec.src === 'compound') return buildCompound(rng);
  const items = spec.fit ? getFit(spec.deck) : get(spec.deck); if (!items.length) return null;
  const base = { kind, label: spec.label, noRec: true, word: '', meaning: '', letter: false };
  const it = rng.pick(items);
  if (spec.mc) {
    const ds = rng.shuffle(it.x.filter((w) => w !== it.a)).slice(0, 2); if (ds.length < 2) return null;
    return { ...base, prompt: it.q, answer: it.a, note: it.n ?? '', ...(it.s ? { speak: it.s } : {}), options: rng.shuffle([opt(it.a, true), ...ds.map((d) => opt(d, false))]) };
  }
  if (kind === 'rhetdef') {
    const ds = others(items, it, 2, rng, (x) => x.t); if (ds.length < 2) return null;
    return { ...base, prompt: it.d, answer: it.t, note: `Example: ${it.ex}`, options: rng.shuffle([opt(it.t, true), ...ds.map((d) => opt(d.t, false))]) };
  }
  switch (kind) {
    case 'pron': {
      const target = rng.pick(it.w), ds = it.w.filter((w) => w !== target); if (ds.length < 2) return null;
      return { ...base, prompt: 'tap the speaker to hear it', speak: target, answer: target, note: `${it.g}: ${it.w.join(', ')}. ${it.tip}`, options: rng.shuffle([opt(target, true), ...ds.map((d) => opt(d, false))]) };
    }
    case 'placepic': {
      const pics = it.words.filter((w) => ART_SET.has(w)); if (pics.length < 3) return null;
      const w = rng.pick(pics), ds = rng.shuffle(it.words.filter((x) => x !== w)).slice(0, 2);
      return { ...base, label: `AT THE ${it.place.toUpperCase()}: WHAT IS THIS?`, prompt: `At the ${it.place.toLowerCase()}`, art: w, answer: w, note: `At the ${it.place.toLowerCase()}: ${w}`, options: rng.shuffle([opt(w, true), ...ds.map((d) => opt(d, false))]) };
    }
    case 'blend': {
      const ds = others(items, it, 2, rng); if (ds.length < 2) return null;
      return { ...base, prompt: it.split('').join(' - '), answer: it, speak: it, options: rng.shuffle([opt(it, true), ...ds.map((d) => opt(d, false))]) };
    }
    case 'frame': {
      const ds = others(items, it, 8, rng, (x) => x.answer).map((x) => x.answer).filter((a) => a !== it.answer); const uniq = [...new Set(ds)].slice(0, 2); if (uniq.length < 2) return null;
      return { ...base, prompt: it.frame, answer: it.answer, options: rng.shuffle([opt(it.answer, true), ...uniq.map((d) => opt(d, false))]) };
    }
    case 'phonics': {
      const right = rng.pick(it.words), wrong = rng.shuffle(it.not.slice()).slice(0, 2);
      return { ...base, prompt: it.name, answer: right, note: `${it.name}: ${it.words.slice(0, 4).join(', ')}`, options: rng.shuffle([opt(right, true), ...wrong.map((d) => opt(d, false))]) };
    }
    case 'homosent': {
      const third = others(items, it, 1, rng)[0]?.options.find((o) => !it.options.includes(o)); if (!third) return null;
      const wrong = it.options.find((o) => o !== it.answer);
      return { ...base, prompt: it.sentence, answer: it.answer, speak: it.sentence.replace('___', it.answer), options: rng.shuffle([opt(it.answer, true), opt(wrong, false), opt(third, false)]) };
    }
    case 'rulep': {
      const p = rng.pick(it.practice);
      const ans = p.answer, wr = Array.isArray(p.wrong) ? rng.shuffle(p.wrong.slice()).slice(0, 2) : []; if (wr.length < 2) return null;
      return { ...base, prompt: p.prompt, answer: ans, note: it.title, options: rng.shuffle([opt(ans, true), ...wr.map((d) => opt(d, false))]) };
    }
    case 'idiom': case 'phrasalq': {
      const ds = others(items, it, 2, rng, (x) => x.phrase); if (ds.length < 2) return null;
      return { ...base, prompt: it.phrase, answer: it.meaning, note: it.ex, options: rng.shuffle([opt(it.meaning, true), ...ds.map((d) => opt(d.meaning, false))]) };
    }
    case 'proverb': {
      const ds = others(items, it, 2, rng, (x) => x.text); if (ds.length < 2) return null;
      return { ...base, prompt: `${it.start} ...`, answer: it.end, note: `${it.text} = ${it.meaning}`, options: rng.shuffle([opt(it.end, true), ...ds.map((d) => opt(d.end, false))]) };
    }
    case 'register': {
      const o2 = others(items, it, 1, rng, (x) => x.formal)[0]; if (!o2) return null;
      return { ...base, prompt: `the same idea: ${it.meaning}`, answer: it.formal, note: `${it.formal} is formal, ${it.informal} is casual`, options: rng.shuffle([opt(it.formal, true), opt(it.informal, false), opt(o2.informal, false)]) };
    }
    case 'usuk': {
      const ds = others(items, it, 2, rng, (x) => x.us); if (ds.length < 2) return null;
      const rev = rng.chance(0.4);
      return rev ? { ...base, prompt: `British: ${it.uk}`, answer: it.us, note: `American: ${it.us}, British: ${it.uk}`, options: rng.shuffle([opt(it.us, true), ...ds.map((d) => opt(d.us, false))]) }
        : { ...base, prompt: `American: ${it.us}`, answer: it.uk, note: `American: ${it.us}, British: ${it.uk}`, options: rng.shuffle([opt(it.uk, true), ...ds.map((d) => opt(d.uk, false))]) };
    }
    case 'figure': {
      const names = { simile: 'simile', metaphor: 'metaphor', literal: 'plain meaning' };
      return { ...base, prompt: it.sentence, answer: names[it.type], note: 'A simile says like or as; a metaphor says it is; plain meaning is just true', options: rng.shuffle(Object.values(names).map((n) => opt(n, n === names[it.type]))) };
    }
    case 'upgrade': {
      const b = rng.pick(it.better), w = rng.shuffle(it.worse.slice()).slice(0, 2); if (w.length < 2) return null;
      return { ...base, prompt: `${it.sentence} (better than "${it.dull}")`, answer: b, options: rng.shuffle([opt(b, true), ...w.map((d) => opt(d, false))]) };
    }
    case 'tone': {
      return { ...base, prompt: it.w, answer: it.tone, speak: it.w, options: rng.shuffle(['positive', 'negative', 'neutral'].map((t) => opt(t, t === it.tone))) };
    }
    case 'thesaurus': {
      const right = rng.pick(it.syn), wr = rng.shuffle(it.decoys.slice()).slice(0, 2); if (wr.length < 2) return null;
      return { ...base, prompt: it.w, answer: right, options: rng.shuffle([opt(right, true), ...wr.map((d) => opt(d, false))]) };
    }
    case 'related': {
      const shown = rng.shuffle(it.words.slice()), three = shown.slice(0, 3), right = shown[3];
      const pool = items.filter((x) => x.topic !== it.topic).flatMap((x) => x.words).filter((w) => !it.words.includes(w));
      const wr = rng.shuffle([...new Set(pool)]).slice(0, 2); if (wr.length < 2 || !right) return null;
      return { ...base, prompt: three.join(', '), answer: right, note: `topic: ${it.topic}`, options: rng.shuffle([opt(right, true), ...wr.map((d) => opt(d, false))]) };
    }
    case 'paraphrase': {
      const m = rng.pick(it.models), ds = others(items, it, 2, rng, (x) => x.sentence); if (ds.length < 2) return null;
      return { ...base, prompt: it.sentence, answer: m, options: rng.shuffle([opt(m, true), ...ds.map((d) => opt(rng.pick(d.models), false))]) };
    }
    default: return null;
  }
}
// D6 compound words (build-time list [compound, first, second], see data-build/topics.mjs), kept to words the player's level and child safety allow.
function buildCompound(rng) {
  const all = lex.compoundList().filter((c) => { const e = lex.entry(c[0]); return e && (!PLAN || (PLAN.kid ? kidOkEntry(e) : true)) && (!PLAN || e.band <= Math.max(1, PLAN.top + 1)); });
  const list = all.length >= 6 ? all : lex.compoundList().filter((c) => { const e = lex.entry(c[0]); return e && (!PLAN?.kid || kidOkEntry(e)); });
  if (list.length < 4) return null;
  const base = { kind: 'compound', label: 'JOIN THE WORDS', noRec: true, word: '', meaning: '', letter: false };
  const it = rng.pick(list), ds = others(list, it, 2, rng, (x) => x[0]), gl = lex.entry(it[0])?.gloss ?? '';
  if (rng.chance(0.5)) return { ...base, prompt: `${it[1]} + ${it[2]}`, answer: it[0], note: `${it[1]} + ${it[2]} = ${it[0]}`, options: rng.shuffle([opt(it[0], true), ...ds.map((d) => opt(d[0], false))]) };
  return { ...base, label: 'SPLIT THE COMPOUND', prompt: it[0], answer: `${it[1]} + ${it[2]}`, note: gl ? `${it[0]}: ${gl}` : '', options: rng.shuffle([opt(`${it[1]} + ${it[2]}`, true), ...ds.map((d) => opt(`${d[1]} + ${d[2]}`, false))]) };
}
void title;
