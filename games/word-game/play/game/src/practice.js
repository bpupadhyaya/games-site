// "Learn more" library: rows for the practice scenes (library, deck pages, read-along, spell tiles, say it, paste your text, memory,
// confidence check). Pure: takes the practice state P and a snapshot S and returns { title, rows, primary } like screens.js.
// Button ids all start with "pr:" (handled by game.js) except the chip rows "pracc" and "prrate".
import * as deck from './deck.js';
import * as kb from './kb.js';
import * as lex from './lexicon.js';
import { DECK_KINDS } from './deck.js';
import { earlyFirst, earlyLast, fitScore, fitPackWords } from './adapt.js';
import { LETTERS, LETTER_NAMES } from './letters.js';
import { EX, exWord, SOUND_SHOW, SOUNDS, SOUND_GROUPS, keyboardRows, GUIDE, GUIDE_NOTE, BEDTIME_MINS } from './alpha.js';
import { ART_WORDS } from './art.js';

const chip = (v, label, on, extra = {}) => ({ v, label, on, ...extra });
export const ACCENT_LABEL = { us: 'American', uk: 'British', au: 'Australian', in: 'Indian' };
export const PAGE = 6;
const hearChips = (S, ids) => ({ k: 'chips', id: 'prxhear', label: 'Hear it', opts: ids.map(([i, l]) => chip(i, l, false, { disabled: !S.canSpeak })) });

// The library: groups of activities. act = what the button does (see game.js prTap).
export const LIBRARY = [
  { early: true, group: 'Early reading', blurb: 'For young readers: big text, lit words, sounds.', items: [
    { t: 'Read-along stories', sub: 'ten short stories, the word being read lights up', act: 'read:stories' },
    { t: 'Rhyme stories', sub: 'short rhymes to read and hear', act: 'read:rhymes' },
    { t: 'Sight-word sentences', sub: 'finish simple sentences', act: 'quiz:frame' },
    { t: 'Sound it out', sub: 'blend c - a - t into cat', act: 'quiz:blend' },
    { t: 'First sounds', sub: 'which word starts like dog?', act: 'quiz:beginsound' },
    { t: 'Last sounds', sub: 'which word ends like cat?', act: 'quiz:endsound' },
    { t: 'Most common words', sub: 'the first 100, 300 and 1000 words to know', act: 'sets' },
  ] },
  { early: true, group: 'Letters and sounds', blurb: 'For pre-readers: see, hear, trace and play with every letter.', items: [
    { t: 'Alphabet', sub: 'pick a letter, then tap the speaker buttons to hear its name or sound', act: 'alpha' },
    { t: 'Alphabet chant', sub: 'an original chant, the word being said lights up', act: 'chant' },
    { t: 'Trace the letters', sub: 'capital, small or joined, with numbered strokes', act: 'trace' },
    { t: 'Find the letter', sub: 'tap the letter that matches', act: 'quiz:letter-find' },
    { t: 'Odd letter out', sub: 'which letter is different?', act: 'quiz:letter-odd' },
    { t: 'Letter hunt', sub: 'find every b hiding in the grid', act: 'hunt' },
    { t: 'Look-alike letters', sub: 'b, d, p and q; m and n; u and n', act: 'quiz:letter-look' },
    { t: 'Letter, sound and picture', sub: 'a is for apple', act: 'quiz:letter-pic' },
    { t: 'What comes next', sub: 'the letter before or after', act: 'quiz:letter-order' },
    { t: 'Put letters in order', sub: 'sort letters into alphabet order', act: 'tiles:alpha' },
    { t: 'Sound chart', sub: 'every common English sound with spoken examples', act: 'sounds' },
    { t: 'Find the key', sub: 'find a letter or type a word on an on-screen keyboard', act: 'keys' },
  ] },
  { early: true, group: 'With a grown-up', blurb: 'Sharing the game with a young child.', items: [
    { t: 'Play together', sub: 'a grown-up and a child take turns on one screen', act: 'together' },
    { t: 'Tips for grown-ups', sub: 'how to share the game and talk about the words', act: 'guide' },
    { t: 'Bedtime mode', sub: 'calm look, quiet sounds and a gentle stop', act: 'bedtime' },
  ] },
  { group: 'Sounds and spelling', blurb: 'Phonics sets, spelling rules, and building words from tiles.', items: [
    { t: 'Spelling sounds', sub: 'patterns like ee, ai, ough', act: 'pages:patterns', quiz: 'phonics' },
    { t: 'Homophones in sentences', sub: 'their, there, they\'re and more', act: 'quiz:homosent' },
    { t: 'Spelling rules', sub: 'i before e, doubling, silent e', act: 'pages:rules', quiz: 'rulep' },
    { t: 'Silent letters and tricky patterns', sub: 'silent letters, double letters, ie or ei, ph, gh and more', act: 'tricky' },
    { t: 'Spell it', sub: 'hear the word, build it from letter tiles', act: 'tiles:spell' },
    { t: 'Type the spelling', sub: 'hear the word and type it with the keyboard', act: 'tiles:typed' },
    { t: 'Spell my study words', sub: 'tiles or keyboard, from your own study set', act: 'study:spell' },
    { t: 'Dictation', sub: 'listen and build the word, with no clue', act: 'tiles:dictate' },
    { t: 'Unscramble', sub: 'put scrambled letters in order', act: 'tiles:scramble' },
    { t: 'Spelling bee', sub: 'five words against the computer', act: 'tiles:bee' },
    { t: 'Break the word', sub: 'prefix, root and ending', act: 'quiz:breakword' },
    { t: 'Word parts', sub: 'prefixes, endings and roots with examples', act: 'pages:roots' },
  ] },
  { group: 'Word webs', blurb: 'See how words belong together.', items: [
    { t: 'Word webs', sub: 'topics and the words that belong to them', act: 'pages:webs', quiz: 'related' },
    { t: 'Analogy puzzles', sub: 'hot is to cold as big is to small', act: 'analogy' },
  ] },
  { group: 'Idioms and usage', blurb: 'How English is really used.', items: [
    { t: 'Idioms', sub: 'break the ice, piece of cake', act: 'pages:idioms', quiz: 'idiom' },
    { t: 'Phrasal verbs', sub: 'give up, look after', act: 'pages:phrasal', quiz: 'phrasalq' },
    { t: 'Proverbs', sub: 'well-known sayings', act: 'pages:proverbs', quiz: 'proverb' },
    { t: 'Formal and casual', sub: 'purchase or buy?', act: 'pages:register', quiz: 'register' },
    { t: 'US and UK words', sub: 'elevator or lift?', act: 'pages:usuk', quiz: 'usuk' },
    { t: 'Simile, metaphor, plain', sub: 'what kind of language is it', act: 'pages:figures', quiz: 'figure' },
    { t: 'Better word choice', sub: 'swap a dull word for a stronger one', act: 'pages:upgrade', quiz: 'upgrade' },
    { t: 'Positive or negative', sub: 'the feeling a word carries', act: 'pages:tone', quiz: 'tone' },
  ] },
  { group: 'Writing workouts', blurb: 'Small exercises for clearer writing.', items: [
    { t: 'Thesaurus workout', sub: 'find words with the same meaning', act: 'pages:thesaurus', quiz: 'thesaurus' },
    { t: 'Say it another way', sub: 'same meaning, different words', act: 'pages:paraphrase', quiz: 'paraphrase' },
    { t: 'Sentence builder', sub: 'put the words in order', act: 'tiles:sentence' },
    { t: 'Rank by strength', sub: 'find five words on a scale, then order mild to strong', act: 'tiles:find' },
    { t: 'Find the word', sub: 'read a meaning, think of the word, type it', act: 'tiles:recall' },
  ] },
  { group: 'English for daily life', blurb: 'For people learning English to live, study and work. Everyday English only; not an official test.', items: [
    { t: 'Greetings and phrases', sub: 'what to say, with a spoken model', act: 'pages:greet', quiz: 'greet' },
    { t: 'Signs, labels and forms', sub: 'signs, food and clothes labels, forms, timetables', act: 'pages:signs', quiz: 'signs' },
    { t: 'Numbers, days, time and money', sub: 'numbers, colours, days, months, time, change', act: 'pages:daily', quiz: 'daily' },
    { t: 'Settling in', sub: 'renting, banks, doctors and daily life in a new country', act: 'pages:settle', quiz: 'settle' },
    { t: 'Polite forms and customs', sub: 'everyday manners, in general', act: 'pages:manners', quiz: 'manners' },
    { t: 'Sounds that are hard', sub: 'th, r and l, v and w, vowels: hear it, tap it', act: 'pages:pron', quiz: 'pron' },
    { t: 'Picture dictionary by place', sub: 'home, market, clinic, farm, school, office, travel', act: 'pages:places', quiz: 'placepic' },
    { t: 'Construction words', sub: 'tools, safety, the site', act: 'pages:trade-construction', quiz: 'trade' },
    { t: 'Hospitality words', sub: 'hotel and restaurant', act: 'pages:trade-hospitality', quiz: 'trade' },
    { t: 'Driving words', sub: 'the car, the road, signs', act: 'pages:trade-driving', quiz: 'trade' },
    { t: 'Work emails', sub: 'greetings, requests, endings', act: 'pages:work-email', quiz: 'workeng' },
    { t: 'Meetings', sub: 'agenda, opinions, updates', act: 'pages:work-meetings', quiz: 'workeng' },
    { t: 'Job interviews', sub: 'common questions and answers', act: 'pages:work-interviews', quiz: 'workeng' },
  ] },
  { group: 'Subjects and topics', blurb: 'Word packs built from the word list: topics such as medicine, law and cooking, and school subjects. They stay inside your level.', items: [
    { t: 'Topic and subject packs', sub: 'science, medicine, law, business, finance, technology, trades, farming, cooking, travel, arts, sport; biology to music', act: 'packs' },
    { t: 'Build a word web', sub: 'pick the words that belong to a topic and watch the web grow', act: 'webbuild' },
    { t: 'Compound words', sub: 'join two words into one, or split a compound', act: 'quiz:compound' },
  ] },
  { group: 'Language in depth', blurb: 'How English works: style, devices, word-making, wordplay and varieties. Items fit your level and age.', items: [
    { t: 'Register and style', sub: 'formal, academic, legal, poetic, plain, casual', act: 'pages:style', quiz: 'style' },
    { t: 'Politeness and hidden meaning', sub: 'hedging, polite requests, what people really mean', act: 'pages:pragma', quiz: 'pragma' },
    { t: 'Rhetorical devices', sub: 'anaphora, tricolon, chiasmus, litotes and more', act: 'pages:rhetlib', quiz: 'rhetdef' },
    { t: 'Spot the device', sub: 'which device is in this sentence?', act: 'pages:rhetoric', quiz: 'rhetoric' },
    { t: 'Poetry sound devices', sub: 'rhyme, alliteration, assonance, beats', act: 'pages:sounddev', quiz: 'sounddev' },
    { t: 'How words are formed', sub: 'blends, clippings, acronyms, back-formation', act: 'pages:formation', quiz: 'formation' },
    { t: 'How technical terms are coined', sub: 'Greek and Latin parts, acronyms, new uses of old words', act: 'pages:coining', quiz: 'coining' },
    { t: 'Wordplay', sub: 'puns, spoonerisms, malapropisms, palindromes', act: 'pages:wordplay', quiz: 'wordplay' },
    { t: 'World Englishes', sub: 'words and spellings in Australia, Canada, Britain, India and more', act: 'pages:regional', quiz: 'regional' },
    { t: 'Slang and new words', sub: 'with the era each became popular', act: 'pages:slang', quiz: 'slang' },
    { t: 'Rare words', sub: 'a track of the rarest words, with meanings', act: 'pack:rare' },
  ] },
  { group: 'Reading and poems', blurb: 'Read aloud with a voice, or bring your own text.', items: [
    { t: 'Poems', sub: 'old poems that anyone may read', act: 'read:poems' },
    { t: 'Fables', sub: 'short old stories with a point', act: 'read:fables' },
    { t: 'Read your own text', sub: 'paste or open a text, see the hard words', act: 'paste' },
  ] },
  { group: 'Speaking', blurb: 'Hear it, then say it.', items: [
    { t: 'Say it', sub: 'say a word and see if it was heard', act: 'say' },
  ] },
  { group: 'Memory', blurb: 'See how well words are staying.', items: [
    { t: 'Confidence check', sub: 'how sure are you? then find out', act: 'conf' },
    { t: 'Memory view', sub: 'what you will remember, and when to review', act: 'mem' },
  ] },
];
export const DECK_TITLES = { fables: 'Fables', style: 'Register and style', pragma: 'Politeness and hidden meaning', rhetlib: 'Rhetorical devices', rhetoric: 'Spot the device', sounddev: 'Poetry sound devices', formation: 'How words are formed', coining: 'How technical terms are coined', wordplay: 'Wordplay', regional: 'World Englishes', slang: 'Slang and new words', stories: 'Read-along stories', rhymes: 'Rhyme stories', poems: 'Poems', patterns: 'Spelling sounds', rules: 'Spelling rules', roots: 'Word parts', webs: 'Word webs', idioms: 'Idioms', phrasal: 'Phrasal verbs', proverbs: 'Proverbs', register: 'Formal and casual', usuk: 'US and UK words', figures: 'Simile, metaphor, plain', upgrade: 'Better word choice', tone: 'Positive or negative', thesaurus: 'Thesaurus workout', paraphrase: 'Say it another way', greet: 'Greetings and phrases', signs: 'Signs, labels and forms', daily: 'Numbers, days, time and money', settle: 'Settling in', manners: 'Polite forms and customs', pron: 'Sounds that are hard', places: 'Picture dictionary by place', 'trade-construction': 'Construction words', 'trade-hospitality': 'Hospitality words', 'trade-driving': 'Driving words', 'work-email': 'Work emails', 'work-meetings': 'Meetings', 'work-interviews': 'Job interviews' };

let rootsCache = null, rootsVer = -1;
function rootDeck() {
  const m = kb.manifest(); if (!m) return [];
  if (rootsCache && rootsVer === kb.version()) return rootsCache;
  const all = lex.all(), ex = { p: {}, s: {}, r: {} };
  for (const e of all) {
    if (e.rank === undefined || e.band > 2) continue;
    const pf = kb.col(e.rank, 3), sf = kb.col(e.rank, 4), rt = kb.col(e.rank, 5);
    if (pf && (ex.p[pf] ??= []).length < 4) ex.p[pf].push(e.w);
    if (sf && (ex.s[sf] ??= []).length < 4) ex.s[sf].push(e.w);
    if (rt && (ex.r[rt] ??= []).length < 4) ex.r[rt].push(e.w);
  }
  const out = [];
  (m.prefixes ?? []).forEach((x, i) => out.push({ kind: 'Prefix', form: `${x[0]}-`, meaning: x[1], words: ex.p[i + 1] ?? [] }));
  (m.suffixes ?? []).forEach((x, i) => out.push({ kind: 'Ending', form: `-${x[0]}`, meaning: x[1], words: ex.s[i + 1] ?? [] }));
  (m.roots ?? []).forEach((x, i) => out.push({ kind: 'Root', form: x[0], meaning: x[1], words: ex.r[i + 1] ?? [] }));
  rootsCache = out.filter((x) => x.words.length >= 1); rootsVer = kb.version();
  return rootsCache;
}
const TONE_ORDER = (rows) => ['positive', 'negative', 'neutral'].flatMap((t) => rows.filter((r) => r.tone === t));
export function deckItems(id) {
  switch (id) {
    case 'stories': case 'rhymes': return deck.get(id);
    case 'roots': return rootDeck();
    case 'tone': return TONE_ORDER(deck.get('tone'));
    case 'trade-construction': case 'trade-hospitality': case 'trade-driving': return deck.get('trade').filter((x) => x.pk === id.slice(6));
    case 'work-email': case 'work-meetings': case 'work-interviews': return deck.get('workeng').filter((x) => x.pk === id.slice(5));
    case 'poems': case 'fables': case 'style': case 'pragma': case 'rhetlib': case 'rhetoric': case 'sounddev': case 'formation': case 'coining': case 'wordplay': case 'regional': case 'slang': return deck.getFit(id);
    default: return deck.get(id);
  }
}
const itemRows = (id, it) => {
  const sub = (t) => ({ k: 'sub', t });
  switch (id) {
    case 'patterns': return [sub(it.name), { k: 'p', t: `Words: ${it.words.slice(0, 8).join(', ')}`, small: true }];
    case 'rules': return [sub(it.title), { k: 'p', t: it.text, small: true }, { k: 'p', t: `Examples: ${it.examples.join(', ')}`, small: true }];
    case 'roots': return [sub(`${it.kind}: ${it.form}`), { k: 'p', t: `means ${it.meaning}${it.words.length ? '. Words that use it, as a tree:' : ''}`, small: true }, ...it.words.map((w, i) => ({ k: 'pre', t: `${i === it.words.length - 1 ? '`-' : '+-'} ${w}` }))];
    case 'webs': return [sub(it.topic), { k: 'p', t: it.words.join(', '), small: true }];
    case 'idioms': case 'phrasal': return [sub(it.phrase), { k: 'p', t: `${it.meaning}. Example: ${it.ex}`, small: true }];
    case 'proverbs': return [sub(it.text), { k: 'p', t: `means: ${it.meaning}`, small: true }];
    case 'register': return [{ k: 'kv', l: `${it.formal} (formal)`, r: `${it.informal} (casual)` }];
    case 'usuk': return [{ k: 'kv', l: `${it.us} (American)`, r: `${it.uk} (British)` }];
    case 'figures': return [{ k: 'p', t: it.sentence }, { k: 'p', t: `This is a ${it.type === 'literal' ? 'plain (literal) sentence' : it.type}.`, small: true }];
    case 'upgrade': return [{ k: 'p', t: it.sentence }, { k: 'p', t: `Instead of "${it.dull}": ${it.better.join(', ')}`, small: true }];
    case 'tone': return [{ k: 'kv', l: it.w, r: it.tone }];
    case 'thesaurus': return [sub(it.w), { k: 'p', t: `Same meaning: ${it.syn.join(', ')}`, small: true }];
    case 'paraphrase': return [{ k: 'p', t: it.sentence }, ...it.models.map((m) => ({ k: 'p', t: `Or: ${m}`, small: true }))];
    case 'greet': case 'signs': case 'daily': case 'settle': case 'trade-construction': case 'trade-hospitality': case 'trade-driving': case 'work-email': case 'work-meetings': case 'work-interviews':
      return [{ k: 'p', t: it.q }, { k: 'p', t: `Answer: ${it.a}`, small: true }, ...(it.n ? [{ k: 'p', t: it.n, small: true }] : [])];
    case 'manners': return [sub(it.t), { k: 'p', t: it.note, small: true }, { k: 'p', t: `${it.q} ${it.a}`, small: true }];
    case 'pron': return [sub(`${it.w.join(' / ')}  (${it.g})`), { k: 'p', t: it.tip, small: true }];
    case 'places': return [sub(it.place), { k: 'stickers', cells: it.words.filter((w) => ART_WORDS.includes(w)).map((w) => ({ w, got: true })) }, { k: 'p', t: `Also: ${it.words.filter((w) => !ART_WORDS.includes(w)).join(', ') || 'all of these have pictures'}`, small: true }];
    case 'rhetlib': return [sub(it.t), { k: 'p', t: it.d, small: true }, { k: 'p', t: `Example: ${it.ex}`, small: true }];
    case 'style': case 'pragma': case 'rhetoric': case 'sounddev': case 'wordplay': case 'regional': case 'coining': case 'formation':
      return [{ k: 'p', t: it.q }, { k: 'p', t: `Answer: ${it.a}`, small: true }, { k: 'p', t: it.n, small: true }];
    case 'slang': return [sub(`${it.w}  (${it.e})`), { k: 'p', t: it.q }, { k: 'p', t: `Answer: ${it.a}`, small: true }, { k: 'p', t: it.n, small: true }];
    default: return [];
  }
};
const QUIZ_FOR = { style: 'style', pragma: 'pragma', rhetlib: 'rhetdef', rhetoric: 'rhetoric', sounddev: 'sounddev', formation: 'formation', coining: 'coining', wordplay: 'wordplay', regional: 'regional', slang: 'slang', patterns: 'phonics', rules: 'rulep', webs: 'related', idioms: 'idiom', phrasal: 'phrasalq', proverbs: 'proverb', register: 'register', usuk: 'usuk', figures: 'figure', upgrade: 'upgrade', tone: 'tone', thesaurus: 'thesaurus', paraphrase: 'paraphrase', greet: 'greet', signs: 'signs', daily: 'daily', settle: 'settle', manners: 'manners', pron: 'pron', places: 'placepic', 'trade-construction': 'trade', 'trade-hospitality': 'trade', 'trade-driving': 'trade', 'work-email': 'workeng', 'work-meetings': 'workeng', 'work-interviews': 'workeng' };
export const pagesPer = (id) => (id === 'tone' ? 18 : id === 'register' || id === 'usuk' ? 12 : id === 'pron' ? 10 : id === 'places' ? 2 : PAGE);

const accentChips = (S, P) => ({ k: 'chips', id: 'pracc', label: 'Voice accent', opts: (S.accents ?? ['us']).map((a) => chip(a, ACCENT_LABEL[a] ?? a, P.accent === a)), hint: S.canSpeak ? '' : 'The phone voice is not available here, so Read to me is off.' });
const rateChips = (P) => ({ k: 'chips', id: 'prrate', label: 'Reading speed', opts: [chip(0, 'Slow', P.rate === 0), chip(1, 'Normal', P.rate === 1), chip(2, 'Fast', P.rate === 2)] });

export function practiceRows(scene, P, S) {
  switch (scene) {
    case 'library': {
      const rows = [{ k: 'h', t: 'Learn more' }, { k: 'p', t: 'Extra practice for reading, spelling, usage and speaking. Everything here works on the phone with no internet.', small: true }];
      if (!deck.ready()) rows.push({ k: 'p', t: 'Some of these are still loading. Give it a moment.', small: true });
      // Early reading is written for first words and Elementary: it leads the list for young or new readers and moves to the end for advanced adults
      const plan = S.plan, groups = earlyLast(plan) ? [...LIBRARY.filter((g) => !g.early), ...LIBRARY.filter((g) => g.early)] : LIBRARY;
      if (earlyFirst(plan)) rows.push({ k: 'p', t: 'Early reading is first in the list for you: big text, lit words and sounds.', small: true });
      for (const g of groups) {
        rows.push({ k: 'rule' }, { k: 'sub', t: g.group }, { k: 'p', t: g.blurb, small: true });
        for (const it of g.items) rows.push({ k: 'btn', id: `pr:${it.act}`, label: it.t, sub: it.sub });
      }
      return { title: 'Learn more', rows, primary: null };
    }
    case 'deckpage': {
      const id = P.deck, items = deckItems(id), per = pagesPer(id), pages = Math.max(1, Math.ceil(items.length / per)), pg = Math.max(0, Math.min(pages - 1, P.page));
      const rows = [{ k: 'h', t: DECK_TITLES[id] ?? 'Learn' }, { k: 'p', t: `Page ${pg + 1} of ${pages}  ·  ${items.length} in all`, small: true }];
      const q = QUIZ_FOR[id]; if (q) rows.push({ k: 'btn', id: `pr:quiz:${q}`, label: 'Quiz me on these', style: 'primary' });
      const hearable = id === 'greet' || id === 'pron', chipsOf = [];
      items.slice(pg * per, (pg + 1) * per).forEach((it, k) => {
        const n = pg * per + k + 1, r = itemRows(id, it);
        if (hearable && r[0]) { r[0] = { ...r[0], t: `${n}. ${r[0].t}` }; chipsOf.push([n - 1, String(n)]); }
        rows.push({ k: 'rule' }, ...r);
      });
      if (hearable && chipsOf.length) rows.splice(3, 0, hearChips(S, chipsOf), { k: 'p', t: S.canSpeak ? 'Nothing plays by itself: tap a number under Hear it to hear that item.' : 'Hearing needs the phone voice, which is not available here.', small: true });
      rows.push({ k: 'rule' }, { k: 'btn2', a: { id: 'pr:pg:prev', label: 'Previous page', disabled: pg <= 0 }, b: { id: 'pr:pg:next', label: 'Next page', disabled: pg >= pages - 1 } });
      return { title: DECK_TITLES[id] ?? 'Learn', rows, primary: null };
    }
    case 'packs': {
      const rows = [{ k: 'h', t: 'Topic and subject packs' }, { k: 'p', t: 'Words for a topic or a school subject, taken from the word list by what each word is filed under. Packs show the words at your level (and only child-safe words for a child); if your level has few of them, the next easier level is added. Study a pack, or be quizzed on it with your chosen question types.', small: true }];
      if (!lex.packList().length) rows.push({ k: 'p', t: S.full ? 'The packs are still loading.' : 'Packs need the full word list.' });
      for (const g of lex.PACK_GROUPS) {
        const list = lex.packList(g.k); if (!list.length) continue;
        rows.push({ k: 'rule' }, { k: 'sub', t: g.label });
        for (const p of list) {
          const ws = fitPackWords(p.words, S.plan, lex.entry), known = ws.filter((e) => S.records?.[e.w] && (S.records[e.w][8] || S.records[e.w][0] >= 3)).length;
          rows.push({ k: 'kv', l: p.name, r: `${known} of ${ws.length} known` }, { k: 'btn2', a: { id: `pr:packstudy:${p.id}`, label: 'Study', disabled: !ws.length }, b: { id: `pr:packplay:${p.id}`, label: 'Quiz me', disabled: ws.length < 4 } });
        }
      }
      return { title: 'Packs', rows, primary: null };
    }
    case 'webbuild': {
      const W = P.web;
      if (!W) {
        const rows = [{ k: 'h', t: 'Build a word web' }, { k: 'p', t: 'Pick a topic. Eight words that belong to it are hidden among eight that do not. Tap the ones that belong and the web grows around the topic.', small: true }];
        const list = lex.packList().filter((p) => p.group !== 'track');
        if (!list.length) rows.push({ k: 'p', t: 'The packs are still loading.' });
        for (const g of lex.PACK_GROUPS.filter((x) => x.k !== 'track')) { const l = list.filter((p) => p.group === g.k); if (l.length) rows.push({ k: 'chips', id: 'prweb', label: g.label, opts: l.map((p) => chip(`start-${p.id}`, p.name, false)) }); }
        return { title: 'Word web', rows, primary: null };
      }
      const built = W.cells.filter((c) => c.got).map((c) => c.w), left = W.cells.filter((c) => c.right && !c.got).length;
      const rows = [{ k: 'h', t: `Web: ${W.name}` }, { k: 'p', t: W.done ? `Done: ${built.length} words found, ${W.wrong} wrong tap${W.wrong === 1 ? '' : 's'}.` : `Tap the words that belong to ${W.name}. ${left} still to find.`, small: true }];
      rows.push({ k: 'wmap', centre: W.name, centreAt: 0, tiers: [{ label: 'In your web', id: 'prwebw', words: built.length ? built : ['(none yet)'], off: ['(none yet)'] }] });
      if (!W.done) rows.push({ k: 'grid', id: 'prweb', label: 'Which belong?', cols: 2, h: 70, sz: 28, rows: W.cells.reduce((acc, c, i) => { if (i % 2 === 0) acc.push([]); if (!c.got) acc[acc.length - 1].push({ v: `pick-${i}`, label: c.w, on: false, bad: c.bad, off: c.bad }); else acc[acc.length - 1].push({ v: `pick-${i}`, label: c.w, on: true, off: true }); return acc; }, []) });
      else rows.push({ k: 'p', t: `The words that belong: ${W.cells.filter((c) => c.right).map((c) => c.w).join(', ')}.`, small: true });
      rows.push({ k: 'btn', id: 'pr:webnew', label: W.done ? 'Another topic' : 'Choose another topic', style: W.done ? 'primary' : undefined });
      return { title: 'Word web', rows, primary: null };
    }
    case 'readlist': {
      const id = P.deck, items = id === 'poems' || id === 'fables' ? deck.getFit(id) : deck.get(id);
      const rows = [{ k: 'h', t: DECK_TITLES[id] ?? 'Read' }, { k: 'p', t: id === 'poems' ? 'Old poems that anyone may read. Tap one, then Read to me. The ones shown fit your level and age. The Stevenson, Blake and Golden Treasury texts were checked against the public-domain books they come from.' : id === 'fables' ? 'Short old fables in their public-domain translation (Aesop, translated 1867). The words are old-fashioned, so they are a good stretch. Tap one, then Read to me.' : 'Tap one to read it. The word being read lights up.', small: true }];
      if (!items.length) rows.push({ k: 'p', t: 'Still loading.' });
      for (const it of items) rows.push({ k: 'btn', id: `pr:open:${id}:${it.id}`, label: it.title, sub: it.author ? `${it.author}, ${it.year ?? ''}`.replace(/, $/, '') : '' });
      return { title: DECK_TITLES[id] ?? 'Read', rows, primary: null };
    }
    case 'storyread': {
      const T = P.text; if (!T) return { title: 'Read', rows: [{ k: 'p', t: 'Pick something to read first.' }], primary: null };
      const rows = [{ k: 'h', t: T.title }];
      if (T.author) rows.push({ k: 'p', t: T.author, small: true });
      rows.push({ k: 'hl', words: T.words, hl: P.hl, size: T.big ? 46 : 36 });
      rows.push({ k: 'btn2', a: { id: P.speaking ? 'pr:stop' : 'pr:speak', label: P.speaking ? 'Stop' : 'Read to me', style: 'primary', disabled: !S.canSpeak }, b: { id: 'pr:rewind', label: 'Start again' } });
      rows.push(accentChips(S, P), rateChips(P));
      if (T.hard?.length) { rows.push({ k: 'rule' }, { k: 'sub', t: 'Words worth a look' }, { k: 'p', t: T.hard.join(', '), small: true }, { k: 'btn', id: 'pr:addhard', label: 'Add these to my study set' }); }
      if (S.msg) rows.push({ k: 'p', t: S.msg, small: true });
      return { title: 'Read-along', rows, primary: null };
    }
    case 'tiles': {
      const T = P.tiles; if (!T) return { title: 'Build', rows: [{ k: 'p', t: 'Nothing to build yet.' }], primary: null };
      const TITLES = { alpha: 'Alphabet order', sentence: 'Sentence builder', scramble: 'Unscramble', dictate: 'Dictation', typed: 'Type the spelling', recall: 'Find the word', find: 'Rank by strength: find the five', rank: 'Rank by strength: put them in order' };
      const rows = [{ k: 'h', t: T.mode === 'bee' ? `Spelling bee: you ${T.you}, computer ${T.cpu}` : TITLES[T.mode] ?? 'Spell it' }];
      rows.push({ k: 'p', t: T.clue, small: true });
      if (T.typed !== undefined) {
        const shown = T.mode === 'recall' && !T.typed ? [...T.target].map((c, i) => (i < T.hints ? c : '_')).join(' ') : T.typed || '...';
        rows.push({ k: 'hl', words: [shown], hl: -1, size: 40 });
      } else rows.push({ k: 'hl', words: T.built.length ? T.built.map((i) => T.tiles[i]) : ['...'], hl: -1, size: 40 });
      if (T.result) {
        rows.push({ k: 'p', t: T.result.msg });
        rows.push({ k: 'btn', id: 'pr:next', label: T.mode === 'bee' && T.round >= 5 ? 'See the result' : T.mode === 'find' ? 'Now put them in order' : 'Next', style: 'primary' });
      } else if (T.typed !== undefined) {
        rows.push({ k: 'btn', id: 'pr:typein', label: 'Type it', sub: S.canAsk ? 'a keyboard opens; on a computer just start typing' : 'on a computer just start typing', style: 'primary', disabled: !S.canAsk });
        rows.push({ k: 'btn2', a: { id: 'pr:undo', label: 'Delete a letter', disabled: !T.typed }, b: { id: 'pr:check', label: 'Check', style: 'primary', disabled: !T.typed } });
        if (T.mode === 'typed') rows.push({ k: 'btn', id: 'pr:hear', label: 'Hear the word', disabled: !S.canSpeak });
        else rows.push({ k: 'btn2', a: { id: 'pr:hint', label: 'Show a letter', disabled: T.hints >= T.target.length - 1 }, b: { id: 'pr:giveup', label: 'Show the answer' } }, { k: 'p', t: 'This is word-finding practice for enjoyment, not a treatment. A word found with a hint comes back for another try.', small: true });
      } else {
        rows.push({ k: 'chips', id: 'prtile', label: T.mode === 'sentence' || T.mode === 'rank' ? 'Tap the words in order' : T.mode === 'find' ? 'Tap five words' : 'Tap the letters in order', opts: T.tiles.map((t, i) => chip(i, t, false, { disabled: T.built.includes(i) })) });
        rows.push({ k: 'btn2', a: { id: 'pr:undo', label: 'Undo', disabled: !T.built.length }, b: { id: 'pr:check', label: 'Check', style: 'primary', disabled: T.mode === 'find' ? T.built.length !== 5 : !T.built.length } });
        if (T.mode !== 'sentence' && T.mode !== 'rank' && T.mode !== 'find' && T.mode !== 'alpha') rows.push({ k: 'btn', id: 'pr:hear', label: 'Hear the word', disabled: !S.canSpeak });
      }
      if (['spell', 'dictate', 'scramble', 'bee', 'typed', 'recall'].includes(T.mode) && !T.result) {
        const n = S.study.length;
        rows.push({ k: 'chips', id: 'prsrc', label: 'Words from', opts: [chip('level', 'My level', P.src !== 'study'), chip('study', `My study set (${n})`, P.src === 'study', { disabled: n < 3 })], hint: n < 3 ? 'Make a study set (Study on the title screen) to practise your own words here.' : '' });
      }
      return { title: 'Build', rows, primary: null };
    }
    case 'sayit': {
      const T = P.say; if (!T) return { title: 'Say it', rows: [{ k: 'p', t: 'Nothing yet.' }], primary: null };
      const rows = [{ k: 'h', t: 'Say it' }, { k: 'h', t: T.word }, { k: 'p', t: T.gloss, small: true }];
      if (!S.canRecognize) rows.push({ k: 'p', t: 'This phone cannot listen to you from inside the game yet, so say the word out loud and mark yourself.', small: true });
      rows.push({ k: 'btn', id: 'pr:hear', label: 'Hear it', disabled: !S.canSpeak });
      if (S.canRecognize) rows.push({ k: 'btn', id: 'pr:sayrec', label: P.listening ? 'Listening...' : 'Say it now', style: 'primary', disabled: P.listening });
      else rows.push({ k: 'btn2', a: { id: 'pr:selfok', label: 'I said it', style: 'primary' }, b: { id: 'pr:next', label: 'Another word' } });
      if (T.msg) rows.push({ k: 'p', t: T.msg });
      if (S.canRecognize) rows.push({ k: 'btn', id: 'pr:next', label: 'Another word' });
      rows.push(accentChips(S, P));
      return { title: 'Say it', rows, primary: null };
    }
    case 'paste': {
      const T = P.paste;
      const rows = [{ k: 'h', t: 'Read your own text' }, { k: 'p', t: 'Bring a text you want to read. It stays on this phone and nothing is sent anywhere. The game shows the words that may be new to you.', small: true }];
      rows.push({ k: 'btn2', a: { id: 'pr:clip', label: 'Paste' }, b: { id: 'pr:file', label: 'Open a file', disabled: !S.canImport } });
      if (S.msg) rows.push({ k: 'p', t: S.msg, small: true });
      if (T) {
        rows.push({ k: 'rule' }, { k: 'kv', l: 'Words', r: String(T.total) }, { k: 'kv', l: 'Different words', r: String(T.distinct) }, { k: 'kv', l: 'Easy words', r: `${Math.round(T.easy * 100)}%` }, { k: 'kv', l: 'Not in our word list', r: String(T.unknown) });
        if (T.hard.length) rows.push({ k: 'sub', t: 'Words worth a look' }, { k: 'p', t: T.hard.slice(0, 20).join(', '), small: true }, { k: 'btn', id: 'pr:addhard', label: 'Add these to my study set' });
        rows.push({ k: 'btn', id: 'pr:readpaste', label: 'Read it with lit words', style: 'primary' });
      }
      return { title: 'Your text', rows, primary: null };
    }
    case 'mem': {
      const rows = [{ k: 'h', t: 'Memory view' }, { k: 'p', t: 'How likely you are to remember each word today, from how long ago you met it and how well it went. A guess, not a promise.', small: true }];
      const list = S.memList ?? [];
      if (!list.length) rows.push({ k: 'p', t: 'Play a few rounds first. Words you have met show up here.' });
      else {
        rows.push({ k: 'sub', t: 'Most likely to slip away' });
        for (const m of list.slice(0, 8)) rows.push({ k: 'bar', label: `${m.w}: ${Math.round(m.p * 100)}% today`, frac: m.p, text: m.note });
        rows.push({ k: 'btn', id: 'pr:practise', label: 'Practise these now', style: 'primary' });
        const w = P.memWord ?? list[0].w, m = list.find((x) => x.w === w) ?? list[0];
        rows.push({ k: 'rule' }, { k: 'sub', t: `Fading curve: ${m.w}` }, { k: 'chips', id: 'prmem', label: 'Pick a word', opts: list.slice(0, 8).map((x) => chip(x.w, x.w, x.w === m.w)) });
        for (const d of [0, 1, 3, 7, 14, 30]) rows.push({ k: 'bar', label: d === 0 ? 'Today' : `In ${d} days`, frac: Math.max(0, Math.min(1, m.curve(d))) });
        rows.push({ k: 'p', t: `${m.note}. A right answer today pushes the curve out; a review right before it dips works best.`, small: true });
      }
      if (S.conf?.n) rows.push({ k: 'rule' }, { k: 'sub', t: 'Your confidence' }, { k: 'p', t: `${S.conf.n} checks: sure and right ${S.conf.sureRight}, sure but wrong ${S.conf.sureWrong}, unsure but right ${S.conf.unsureRight}.`, small: true });
      return { title: 'Memory', rows, primary: null };
    }
    case 'conf': {
      const T = P.conf; if (!T) return { title: 'Confidence', rows: [{ k: 'p', t: 'No words yet. Play a few rounds or make a study set first.' }], primary: null };
      const e = lex.entry(T.w);
      const rows = [{ k: 'h', t: 'Confidence check' }, { k: 'h', t: T.w }];
      if (T.step === 0) {
        rows.push({ k: 'p', t: 'Do you know what this word means? Be honest about how sure you are. Then see the answer.', small: true });
        rows.push({ k: 'btn', id: 'pr:rate:3', label: 'Sure I know it' }, { k: 'btn', id: 'pr:rate:2', label: 'I think so' }, { k: 'btn', id: 'pr:rate:1', label: 'Not sure' });
      } else {
        rows.push({ k: 'p', t: e?.gloss || '' });
        if (e?.plain) rows.push({ k: 'p', t: `In simpler words: ${e.plain}`, small: true });
        if (e?.ex) rows.push({ k: 'p', t: `Example: ${e.ex}`, small: true });
        if (e?.mn) rows.push({ k: 'p', t: `Memory hook: ${e.mn}`, small: true });
        if (T.step === 1) rows.push({ k: 'p', t: 'Did you have it right?' }, { k: 'btn2', a: { id: 'pr:knew:1', label: 'Yes', style: 'primary' }, b: { id: 'pr:knew:0', label: 'No' } });
        else { rows.push({ k: 'p', t: T.msg }, { k: 'btn', id: 'pr:next', label: 'Next word', style: 'primary' }); }
      }
      return { title: 'Confidence', rows, primary: null };
    }
    case 'tricky': {
      const names = kb.manifest()?.spelling ?? [], i = Math.max(0, Math.min(names.length - 1, P.tricky ?? 0));
      const rows = [{ k: 'h', t: 'Silent letters and tricky patterns' }, { k: 'p', t: 'Pick a pattern to see what makes these words tricky to spell, then tap a word to explore it. Words nearest your level come first.', small: true }];
      if (!names.length) { rows.push({ k: 'p', t: 'The spelling patterns are still loading.' }); return { title: 'Tricky spellings', rows, primary: null }; }
      rows.push({ k: 'chips', id: 'prtricky', label: 'Pattern', opts: names.map((n, j) => chip(j, n, j === i)) });
      rows.push({ k: 'rule' }, { k: 'sub', t: names[i] }, { k: 'p', t: TRICKY_TIPS[names[i]] ?? 'A pattern that is easy to get wrong.' });
      const words = trickyWords(i, S.plan);
      if (words.length) {
        rows.push({ k: 'chips', id: 'xw', label: 'Tap a word to explore it', opts: words.map((w) => chip(w, w, false)) });
        rows.push({ k: 'btn', id: 'pr:trickyquiz', label: 'Quiz me on these words', style: 'primary' });
      } else rows.push({ k: 'p', t: 'No words found for this pattern at your level yet.' });
      return { title: 'Tricky spellings', rows, primary: null };
    }

    case 'alpha': {
      const A = P.alpha ?? { i: 0, mode: 'name' }, c = LETTERS[A.i];
      const rows = [{ k: 'h', t: 'Alphabet' }, { k: 'p', t: 'Tap a letter to see it big, then tap Hear the name or Hear the sound. Capital and small letters are shown together.', small: true }];
      rows.push({ k: 'chips', id: 'prxal', label: 'Letters', opts: LETTERS.map((x, i) => chip(i, `${x.toUpperCase()}${x}`, i === A.i)) });
      rows.push({ k: 'chips', id: 'prxalm', label: 'Say the', opts: [chip('name', 'Letter name', A.mode === 'name'), chip('sound', 'Letter sound', A.mode === 'sound')], hint: S.canSpeak ? 'Voices differ, so the picture word is the surest clue to a sound.' : 'The phone voice is not available, so the name and sound are shown in writing.' });
      rows.push({ k: 'big', t: `${c.toUpperCase()} ${c}`, sub: A.mode === 'name' ? `its name is "${LETTER_NAMES[c]}"` : SOUND_SHOW[c], art: EX[c], cap: `${c.toUpperCase()} is for ${exWord(c)}` });
      rows.push({ k: 'btn2', a: { id: 'pr:alsay:name', label: 'Hear the name', disabled: !S.canSpeak }, b: { id: 'pr:alsay:sound', label: 'Hear the sound', disabled: !S.canSpeak } });
      rows.push({ k: 'btn', id: 'pr:alsay:pic', label: `Hear: ${c.toUpperCase()} is for ${exWord(c)}`, disabled: !S.canSpeak });
      rows.push({ k: 'btn2', a: { id: 'pr:alstep:prev', label: 'Letter before', disabled: A.i <= 0 }, b: { id: 'pr:alstep:next', label: 'Letter after', disabled: A.i >= 25 } });
      rows.push({ k: 'rule' }, { k: 'btn', id: `pr:tracex:${A.i}`, label: `Trace ${c.toUpperCase()} ${c}` }, { k: 'btn', id: 'pr:chant', label: 'Alphabet chant' }, { k: 'btn', id: 'pr:sounds', label: 'Sound chart' });
      return { title: 'Alphabet', rows, primary: null };
    }
    case 'sounds': {
      const Z = P.snd ?? { i: 0, g: 'cons' }, list = SOUNDS.filter((s) => s.k === Z.g), s = list[Math.min(Z.i, list.length - 1)];
      const rows = [{ k: 'h', t: 'Sound chart' }, { k: 'p', t: 'The common sounds of English and the letters that spell them. Tap a sound to pick it, then tap Hear it with examples.', small: true }];
      rows.push({ k: 'chips', id: 'prxsg', label: 'Kind of sound', opts: SOUND_GROUPS.map((g) => chip(g.k, g.label, g.k === Z.g)) });
      rows.push({ k: 'chips', id: 'prxsn', label: 'Sounds', opts: list.map((x, i) => chip(i, x.g, x === s)) });
      rows.push({ k: 'rule' }, { k: 'sub', t: s.g }, { k: 'p', t: `Say: ${s.say}` }, { k: 'p', t: `Words: ${s.ex.join(', ')}` }, { k: 'p', t: s.tip, small: true });
      rows.push({ k: 'btn', id: 'pr:sndsay', label: 'Hear it with examples', style: 'primary', disabled: !S.canSpeak });
      if (!S.canSpeak) rows.push({ k: 'p', t: 'The phone voice is not available here, so the sounds are shown in writing. Voices vary a little between phones and accents.', small: true });
      return { title: 'Sound chart', rows, primary: null };
    }
    case 'keys': {
      const K = P.keys ?? { mode: 'letter', shift: false, target: 'k', word: '', typed: '', score: 0, tries: 0, msg: '' };
      const rows = [{ k: 'h', t: 'Find the key' }, { k: 'p', t: K.mode === 'letter' ? 'Find the letter on the keyboard and tap it.' : 'Tap the letters to type the word.', small: true }];
      rows.push({ k: 'chips', id: 'prxkm', label: 'Practise', opts: [chip('letter', 'One letter', K.mode === 'letter'), chip('word', 'A short word', K.mode === 'word')] });
      rows.push({ k: 'chips', id: 'prxkc', label: 'Letters look like', opts: [chip('small', 'small a b c', !K.shift), chip('big', 'CAPITAL A B C', K.shift)] });
      if (K.mode === 'letter') rows.push({ k: 'big', t: K.shift ? K.target.toUpperCase() : K.target, sub: 'find this letter' });
      else rows.push({ k: 'big', t: K.word, sub: `typed: ${K.typed || '...'}` });
      rows.push({ k: 'grid', id: 'prxkey', rows: keyboardRows(K.shift) });
      rows.push({ k: 'kv', l: 'Found', r: String(K.score) });
      if (K.msg) rows.push({ k: 'p', t: K.msg });
      return { title: 'Find the key', rows, primary: null };
    }
    case 'hunt': {
      const H = P.hunt; if (!H) return { title: 'Letter hunt', rows: [{ k: 'p', t: 'Nothing yet.' }], primary: null };
      const found = H.found.filter(Boolean).length, done = found >= H.hits;
      const rows = [{ k: 'h', t: 'Letter hunt' }, { k: 'p', t: `Tap every ${H.target} in the grid. Some letters look a little like it.`, small: true }, { k: 'big', t: `${H.target.toUpperCase()} ${H.target}`, sub: `${found} of ${H.hits} found` }];
      const grid = []; for (let r = 0; r < H.cells.length / H.cols; r += 1) grid.push(H.cells.slice(r * H.cols, (r + 1) * H.cols).map((ch, c) => { const i = r * H.cols + c; return { v: i, label: ch, on: H.found[i], off: done }; }));
      rows.push({ k: 'grid', id: 'prxhunt', rows: grid, h: 84, sz: 40 });
      if (H.wrong) rows.push({ k: 'p', t: `Not quite: ${H.wrong} tap${H.wrong === 1 ? '' : 's'} on other letters.`, small: true });
      if (done) rows.push({ k: 'p', t: 'You found them all! Well done.' }, { k: 'btn', id: 'pr:huntnext', label: 'Another hunt', style: 'primary' });
      return { title: 'Letter hunt', rows, primary: null };
    }
    case 'guide': {
      const rows = [{ k: 'h', t: 'Tips for grown-ups' }];
      for (const g of GUIDE) rows.push({ k: 'sub', t: g.h }, { k: 'p', t: g.p, small: true });
      rows.push({ k: 'p', t: GUIDE_NOTE, small: true }, { k: 'rule' }, { k: 'btn', id: 'pr:together', label: 'Play together', style: 'primary' });
      return { title: 'Grown-ups', rows, primary: null };
    }
    case 'bedtime': {
      const B = S.prefs.bed ?? { on: false, mins: 10, secs: 0 };
      const rows = [{ k: 'h', t: 'Bedtime mode' }, { k: 'p', t: 'A calm way to end the day: the look is softer and dimmer, sounds are quiet, there is no clock and no lives, and play stops by itself after the time you choose.', small: true }];
      rows.push({ k: 'chips', id: 'prxbed', label: 'Bedtime mode', opts: [chip('off', 'Off', !B.on), chip('on', 'On', B.on)] });
      rows.push({ k: 'chips', id: 'prxbedm', label: 'Stop after', opts: BEDTIME_MINS.map((m) => chip(m, m ? `${m} min` : 'No stop', B.mins === m)), hint: B.on && B.mins ? `Played tonight: ${Math.floor((B.secs ?? 0) / 60)} of ${B.mins} minutes.` : 'Turn it on, then play as usual.' });
      rows.push({ k: 'p', t: 'Bedtime mode is switched on and off by hand. The overall daily play-time limit and the break reminder are in Settings.', small: true });
      rows.push({ k: 'btn', id: 'pr:readbed', label: 'Read a calm story', sub: 'a short read-along, read to me' });
      return { title: 'Bedtime', rows, primary: null };
    }
    case 'together': {
      const C = P.co;
      const rows = [{ k: 'h', t: 'Play together' }, { k: 'p', t: 'One screen, two players: a grown-up and a child take turns. Talk about each picture. There are no links, no ads and nothing to buy here.', small: true }];
      if (!C) {
        rows.push({ k: 'chips', id: 'prxcom', label: 'What to play', opts: [chip('pic', 'Pictures', (P.coMode ?? 'pic') === 'pic'), chip('abc', 'Letters', P.coMode === 'abc'), chip('both', 'Both', P.coMode === 'both')] });
        rows.push({ k: 'btn', id: 'pr:costart', label: 'Start', style: 'primary' }, { k: 'btn', id: 'pr:guide', label: 'Tips for grown-ups' });
        return { title: 'Together', rows, primary: null };
      }
      if (C.done) {
        rows.push({ k: 'h', t: 'Well played!' }, { k: 'kv', l: C.names[0], r: `${C.scores[0]} right` }, { k: 'kv', l: C.names[1], r: `${C.scores[1]} right` }, { k: 'p', t: 'Everyone wins when you talk about the words together.' });
        rows.push({ k: 'btn', id: 'pr:costart', label: 'Play again', style: 'primary' }, { k: 'btn', id: 'pr:coend', label: 'Finish' });
        return { title: 'Together', rows, primary: null };
      }
      const q = C.q;
      rows.push({ k: 'kv', l: `Turn: ${C.names[C.turn]}`, r: `${C.n + 1} of ${C.total}` }, { k: 'p', t: `Pass the phone to ${C.names[C.turn]}.`, small: true });
      rows.push({ k: 'big', t: q.art ? '' : (q.prompt || '?'), sub: q.art ? '' : q.label, art: q.art || '', cap: q.art ? q.label : '' });
      if (C.pick < 0) q.options.forEach((o, i) => rows.push({ k: 'btn', id: `pr:coans:${i}`, label: o.text }));
      else {
        rows.push({ k: 'p', t: C.right ? 'Yes! That is right.' : `Not this time. It is "${q.answer}".` }, { k: 'p', t: `Now say it together: ${q.answer}.` });
        rows.push({ k: 'btn2', a: { id: 'pr:cohear', label: 'Hear it', disabled: !S.canSpeak }, b: { id: 'pr:conext', label: 'Next', style: 'primary' } });
      }
      return { title: 'Together', rows, primary: null };
    }
    default: return { title: '', rows: [], primary: null };
  }
}
const TRICKY_TIPS = {
  'silent first letter': 'Some words begin with a letter you do not say: the k in knee, the w in write, the g in gnat. Say the word, then look at how it starts.',
  'silent b': 'A b that follows an m, or comes before a t, is often not said: lamb, climb, doubt, debt.',
  'double letters': 'Some words double a letter in the middle or end: letter, happy, address, sudden. Sound alone does not tell you, so notice the pair.',
  'ie or ei': 'Mostly "i before e, except after c": believe, receive. There are exceptions such as weird and science, so these words are worth learning one by one.',
  'ph says f': 'The letters ph make the f sound in words from Greek: phone, photo, graph.',
  gh: 'The letters gh can be silent (night, though), say f (laugh, cough) or say g at the start (ghost). Learn each word with its sound.',
  'tion, sion or cian': 'The ending sounds like "shun" but is spelled tion (action), sion (decision) or cian (musician). A person who does something often ends in cian.',
  'soft c': 'A c before e, i or y says s: city, face, cycle. Before a, o or u it says k.',
  'able or ible': 'The ending -able is more common (readable); -ible is found in words like possible and visible. Check each word.',
  'silent e': 'A final e is usually not said, but it can change the vowel before it: hop and hope, cut and cute.',
  ck: 'The letters ck say k straight after a short vowel: back, pick, duck.',
  ous: 'The ending -ous says "us" and means full of or having: famous, dangerous, nervous.',
};
let trickyKey = '', trickyCache = [];
function trickyWords(i, plan) {
  const key = `${i}|${kb.version()}|${lex.version()}|${plan.source}|${plan.top}|${plan.kid ? 1 : 0}`;
  if (key === trickyKey) return trickyCache;
  const out = [];
  for (const e of lex.all()) {
    if (e.rank === undefined || !/^[a-z]{4,12}$/.test(e.w) || !lex.kidOk(e) || e.band < 0) continue;
    if (kb.spellFlags(e.rank) & (1 << i)) out.push(e);
  }
  out.sort((a, b) => fitScore(plan, a.band) - fitScore(plan, b.band) || a.rank - b.rank);
  trickyKey = key; trickyCache = out.slice(0, 14).map((e) => e.w);
  return trickyCache;
}
export const trickyPool = (i, plan) => trickyWords(i, plan).map((w) => lex.entry(w)).filter(Boolean);
export const PRACTICE_SCENES = ['packs', 'webbuild', 'library', 'deckpage', 'readlist', 'storyread', 'tiles', 'sayit', 'paste', 'mem', 'conf', 'tricky', 'alpha', 'sounds', 'keys', 'hunt', 'guide', 'bedtime', 'together'];
export { DECK_KINDS };
