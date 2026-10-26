// Rows for every form screen. Pure: takes a snapshot S built by game.js and returns { title, rows, primary }.
import { BAND_LABELS, ATTR_LIST, TOPICS, select, all, entry, isFull, posName, packList, PACK_GROUPS } from './lexicon.js';
import { PRESETS, PRESET_ORDER, QTYPES, SPEEDS, SESSION_SECS, QUESTION_COUNTS, SET_SIZES, LIVES, fmtSecs, speedLabel } from './config.js';
import { STAGES, STAGE_BLURB, summary, FIELDS, isLeech } from './srs.js';
import { DICTS, DICT_MODES, dictLabel } from './dict.js';
import { SCHEMES } from './schemes.js';
import { ACH } from './ach.js';
import { ART_WORDS } from './art.js';
import * as jny from './journey.js';
import * as kb from './kb.js';
import { extras } from './quiz.js';
import { practiceRows, PRACTICE_SCENES } from './practice.js';
import { AGE_GROUPS, LEVELS, tierNote, fits, fitScore } from './adapt.js';
import { cardExtras, tierLine, tierOf, TIERS3, breaksLine } from './study.js';
import { screenRows7, SCENES7 } from './screens7.js';
import * as facets from './facets.js';

// average word level (band) of a list of words, or null when none are known
const avgBand = (words) => { let n = 0, t = 0; for (const w of words) { const b = entry(w)?.band; if (b !== undefined && b >= 0) { n += 1; t += b; } } return n ? t / n : null; };
const bandName = (b) => (b === null ? '' : BAND_LABELS[Math.max(0, Math.min(5, Math.round(b)))]);

const chip = (v, label, on, extra = {}) => ({ v, label, on, ...extra });
const plural = (n, s) => `${n} ${s}${n === 1 ? '' : 's'}`;
export const CEFR = ['A1-A2', 'B1', 'B1-B2', 'B2-C1', 'C1', 'C2'];   // approximate labels on our own scale, not an official mapping
export const SLIP_ADVICE = { synonym: 'Study meanings in pairs, then try Synonym at a slower pace.', antonym: 'Look at opposites together with their words in a study set.', definition: 'Use flashcards to read meanings, then quiz again.', spelling: 'Say the word slowly and look for silent or doubled letters.', listening: 'Slow the voice speed in Settings and replay each word.', odd: 'Group words by meaning before choosing the stranger.', cloze: 'Read the whole sentence, then choose the word that fits its meaning.', homophone: 'Learn pairs like their and there as one lesson.', rhyme: 'Say each word aloud and listen for the ending.', missing: 'Sound the word out and check each letter.', inflect: 'Practise the irregular list a few at a time.', syllables: 'Clap the beats of the word as you say it.', stress: 'Say the word and feel which part is loudest.' };
export const SPEED_OPTS = [0, ...SPEEDS];

export function sumLine(cfg, name = '', plan = null) {
  const lv = plan ? plan.chip : 'All words';
  const pace = cfg.secs === 0 ? 'Classic pace' : `${cfg.secs} s per word`;
  return `${name ? `${name}  ·  ` : ''}${lv}  ·  ${pace}`;
}

function wordRows(S, words, opts = {}) {
  const rows = [];
  for (const w of words) {
    const e = entry(w); if (!e) continue;
    const r = S.records[w];
    const lines = [];
    if (e.gloss2) lines.push(`Also: ${e.gloss2}`);
    if (e.syn.length) lines.push(`Same meaning: ${e.syn.join(', ')}`);
    if (e.ant.length) lines.push(`Opposite: ${e.ant.join(', ')}`);
    if (e.ex) lines.push(`Example: ${e.ex}`);
    if (e.mn) lines.push(`Memory hook: ${e.mn}`);
    lines.push(...cardExtras(e));
    if (S.prefs.notes?.[w]) lines.push(`Your note: ${S.prefs.notes[w]}`);
    rows.push({ k: 'word', w, dict: true, hl: w, pos: posName(e.pos), gloss: e.gloss || '(meaning not available)', lines, lookup: S.lookupOn, compare: S.lookupOn, checked: !!(r && r[FIELDS.chk]), known: opts.known === false ? undefined : !!(r && r[FIELDS.known]), flag: opts.flag ? S.prefs.flags.includes(w) : undefined, explore: opts.flag ? true : undefined });
  }
  return rows;
}

// A reusable "select words" panel (My words, study sets, a reading passage, pasted text): chips show the selected state, so it works without colour.
// S.pick = selected words. Add them to My words or a named list in one tap, or play exactly those words.
export const PURPOSES = {
  test: { name: 'Test prep', emoji: '', blurb: 'Mixed puzzles like a vocabulary test: meaning, synonym, opposite, sentence completion, analogy puzzles. Optional timer, a mock test, a mastery meter.' },
  general: { name: 'General practice', blurb: 'Calm mixed rounds with spaced review. No timer.' },
  interest: { name: 'Just for interest', blurb: 'A collection to browse: cards and trails. No quizzes unless you ask.' },
  fun: { name: 'Just for fun', blurb: 'Pure play: a wide, lively mix of puzzles, streaks and bonus rounds.' },
  custom: { name: 'Custom', blurb: 'Your own mix. Change any setting when you play.' },
};
export const purposeOf = (L) => PURPOSES[L?.purpose] ? L.purpose : 'general';
// How far along a list is: new (never met), learning, known. Counted from the memory records, whatever the list's purpose.
export function listMastery(S, words) {
  let nw = 0, kn = 0, lg = 0, due = 0;
  for (const w of words) { const r = S.records[w]; if (!r || !(r[6] > 0)) nw += 1; else if (r[8] || r[0] >= 3) kn += 1; else lg += 1; if (r && r[6] > 0 && !r[8] && r[1] <= S.day && r[2] + r[3] > 0) due += 1; }
  return { nw, kn, lg, due };
}
const masteryLine = (m) => `${m.nw} new  ·  ${m.lg} learning  ·  ${m.kn} known${m.due ? `  ·  ${m.due} due today` : ''}`;
export const PLAY_KIND_CHOICES = [['mixed', 'Mixed'], ['test', 'Test mix'], ['fun', 'Arcade mix'], ['definition', 'Meaning quiz'], ['spelling', 'Spell it'], ['rel', 'Synonyms and opposites'], ['analogy', 'Analogy puzzles'], ['usage', 'In a sentence']];
function pickRows(S, words, o = {}) {
  const sel = new Set(S.pick ?? []), n = sel.size, shown = words.slice(0, 150);
  const named = (S.lists ?? []).filter((l) => l.id !== 'looked');
  const rows = [{ k: 'sub', t: `Select words (${n} selected)` }, { k: 'p', t: o.hint ?? 'Tap words to select them. Nothing is saved until you add them.', small: true }];
  if (shown.length) rows.push({ k: 'chips', id: 'psel', label: '', opts: shown.map((w) => chip(w, w, sel.has(w))) });
  if (words.length > shown.length) rows.push({ k: 'p', t: `Showing the first ${shown.length} of ${words.length} words.`, small: true });
  rows.push({ k: 'btn2', a: { id: 'pselunk', label: 'Select all unfamiliar' }, b: { id: 'pall', label: 'Select all' } });
  rows.push({ k: 'btn2', a: { id: 'pclr', label: 'Clear', disabled: !n }, b: { id: 'newlist', label: 'New list' } });
  rows.push({ k: 'chips', id: 'padd', label: n ? `Add ${n} selected to` : 'Add selected to', opts: [chip('looked', 'My words', false, { disabled: !n }), ...named.map((l) => chip(l.id, l.name, false, { disabled: !n }))] });
  if (o.listId) rows.push({ k: 'chips', id: 'pmove', label: n ? `Move ${n} selected to` : 'Move selected to', opts: (S.lists ?? []).filter((l) => l.id !== o.listId).map((l) => chip(l.id, l.name, false, { disabled: !n })) }, { k: 'btn', id: 'pdrop', label: 'Remove selected from this list', disabled: !n });
  rows.push({ k: 'btn', id: 'pplay', label: n ? `Play selected (${n})` : 'Play selected', style: 'primary', disabled: !n });
  return rows;
}
export function screenRows(name, S) {
  const cfg = S.cfg, P = S.prefs;
  switch (name) {
    case 'setup': {
      const n = S.poolN;
      const rows = [
        { k: 'p', t: 'Choose what to learn and how fast the words move. Everything here can be changed any time, and you can just press Play.', small: true },
        { k: 'btn', id: 'findword', label: 'Dictionary and thesaurus (offline)' },
        { k: 'chips', id: 'preset', label: 'Pace preset', opts: [...PRESET_ORDER.map((k) => chip(k, PRESETS[k].label, cfg.preset === k)), ...(cfg.preset === 'custom' ? [chip('custom', 'Custom', true)] : [])], hint: PRESETS[cfg.preset]?.blurb ?? 'Your own settings' },
        { k: 'chips', id: 'lvl', label: 'Learning level', opts: [...LEVELS.map((l, i) => chip(i, l, S.plan.level === i)), chip('auto', 'Standard', S.plan.level === null)], hint: `${S.plan.driver}. ${isFull() ? 'Levels are estimated from how common each word is. Your Age group is in Settings.' : 'Loading the full word list...'}${S.widened ? ' Few words matched, so neighbouring easier levels were added.' : ''}` },
        { k: 'p', t: `${tierNote(S.plan)}${cfg.auto ? '' : ' (switched off in Options below)'}`, small: true },
        { k: 'chips', id: 'attr', label: 'Kinds of words (pick any)', opts: ATTR_LIST.map((a) => chip(a.k, a.label, cfg.attrs.includes(a.k))) },
        { k: 'chips', id: 'topic', label: 'Topic packs', opts: TOPICS.map((t) => chip(t.k, t.label, cfg.topics.includes(t.k))) },
        ...(packList().length ? PACK_GROUPS.filter((g) => g.k !== 'track').map((g) => ({ k: 'chips', id: 'pktopic', label: `${g.label} (stay inside your level)`, opts: packList(g.k).map((p) => chip(p.id, p.name, cfg.topics.includes(`pk:${p.id}`))) })) : []),
        { k: 'chips', id: 'poschip', label: 'Parts of speech (pick any)', opts: [['n', 'Nouns'], ['v', 'Verbs'], ['a', 'Adjectives'], ['r', 'Adverbs']].map(([v, l]) => chip(v, l, (cfg.pos ?? []).includes(v))) },
        { k: 'chips', id: 'combine', label: 'When you pick several', opts: [chip('any', 'Any of them', cfg.combine === 'any'), chip('narrow', 'Must match all', cfg.combine === 'narrow')], hint: cfg.combine === 'any' ? 'Words that fit at least one choice.' : 'Words from your levels that also fit every kind you ticked.' },
        { k: 'step', id: 'minLen', label: 'Shortest word (letters)', value: String(cfg.minLen), decOff: cfg.minLen <= 3, incOff: cfg.minLen >= cfg.maxLen },
        { k: 'step', id: 'maxLen', label: 'Longest word (letters)', value: String(cfg.maxLen), decOff: cfg.maxLen <= cfg.minLen, incOff: cfg.maxLen >= 15 },
        { k: 'kv', l: 'Words that match', r: plural(n, 'word') },
        { k: 'rule' },
        { k: 'step', id: 'setSize', label: 'Study set size (words)', value: String(cfg.setSize), decOff: cfg.setSize <= SET_SIZES[0], incOff: cfg.setSize >= SET_SIZES[SET_SIZES.length - 1] },
        { k: 'btn2', a: { id: 'study', label: 'Study these words' }, b: { id: 'newset', label: S.study.length ? 'New study set' : 'Make a set', disabled: !n } },
        { k: 'chips', id: 'source', label: 'Play from', opts: [chip('whole', 'All matching words', cfg.source === 'whole'), chip('study', `My study set (${S.study.length})`, cfg.source === 'study', { disabled: !S.study.length }), chip('due', `Due for review (${S.dueN})`, cfg.source === 'due', { disabled: !S.dueN }), chip('weak', `Weak words (${S.weakN})`, cfg.source === 'weak', { disabled: !S.weakN })] },
        { k: 'chips', id: 'qt', label: 'Question types (pick any)', opts: QTYPES.filter((q) => !q.deck).map((q) => chip(q.k, q.label, cfg.qtypes.includes(q.k), { disabled: (['listening', 'hearmeaning', 'hearspell', 'pron'].includes(q.k) && !S.canSpeak) || S.kindOff.includes(q.k) })), hint: QTYPES.filter((q) => cfg.qtypes.includes(q.k) && !q.deck).map((q) => q.blurb).join('. ') + (S.canSpeak ? '' : '. Listening and Hear types need the phone voice, which is not available here.') },
        { k: 'chips', id: 'qt', label: 'Reading, spelling and usage decks (pick any)', opts: QTYPES.filter((q) => q.deck).map((q) => chip(q.k, q.label, cfg.qtypes.includes(q.k), { disabled: S.kindOff.includes(q.k) })), hint: QTYPES.filter((q) => cfg.qtypes.includes(q.k) && q.deck).map((q) => q.blurb).join('. ') },
        { k: 'rule' },
        { k: 'step', id: 'secs', label: 'Word speed (seconds for a word to cross)', value: cfg.secs === 0 ? 'Classic' : `${cfg.secs} s`, decOff: cfg.secs === 0, incOff: cfg.secs === SPEEDS[SPEEDS.length - 1] },
        { k: 'p', t: speedLabel(cfg.secs), small: true },
        { k: 'chips', id: 'endBy', label: 'Session ends', opts: [chip('time', 'After time', cfg.endBy === 'time'), chip('questions', 'After questions', cfg.endBy === 'questions')] },
        cfg.endBy === 'time'
          ? { k: 'step', id: 'sess', label: 'Session length', value: fmtSecs(SESSION_SECS[cfg.secsIdx]), decOff: cfg.secsIdx <= 0, incOff: cfg.secsIdx >= SESSION_SECS.length - 1 }
          : { k: 'step', id: 'sess', label: 'Session length', value: `${QUESTION_COUNTS[cfg.qIdx]} questions`, decOff: cfg.qIdx <= 0, incOff: cfg.qIdx >= QUESTION_COUNTS.length - 1 },
        { k: 'chips', id: 'lanes', label: 'Words on screen', opts: [2, 3, 4, 5, 6].map((l) => chip(l, String(l), cfg.lanes === l)) },
        { k: 'chips', id: 'lives', label: 'Lives', opts: LIVES.map((l) => chip(l, l ? `${l} lives` : 'No lives', cfg.lives === l)) },
        { k: 'chips', id: 'opts', label: 'Options', opts: [chip('hints', cfg.hints ? 'Hints on' : 'Hints off', cfg.hints), chip('skipKnown', 'Skip words I know', cfg.skipKnown), chip('adaptive', 'Adaptive speed', cfg.adaptive), chip('auto', 'Match difficulty to my level and age', cfg.auto)], hint: `${cfg.auto ? 'Words on screen, word speed, hints, lives and word length are shifted by your level and Age group (shown above); your own settings here are the starting point.' : 'Difficulty follows only the settings on this screen.'}${cfg.adaptive ? ' Words slow a little after mistakes and speed up on a streak (fixed-pace sessions).' : ''}` },
        { k: 'gap', h: 10 },
        { k: 'btn', id: 'play', label: 'Play', style: 'primary', disabled: !n },
      ];
      return { title: 'Words and pace', rows, primary: { id: 'play', label: 'Play', disabled: !n } };
    }
    case 'studylist': {
      const rows = [{ k: 'h', t: `Study set: ${S.study.length} words` }, { k: 'btn', id: 'findword', label: 'Dictionary and thesaurus' }];
      if (!S.study.length) rows.push({ k: 'p', t: 'No study set yet. Pick your Learning level, then make a set.' }, { k: 'btn', id: 'newset', label: 'Make a study set', style: 'primary' });
      else {
        rows.push({ k: 'p', t: 'Read the words first, or use flashcards. When you are ready, play and you will be quizzed on exactly these words.', small: true },
          { k: 'btn2', a: { id: 'cards', label: 'Flashcards', style: 'primary' }, b: { id: 'newset', label: 'New set' } },
          { k: 'btn2', a: { id: 'quizset', label: 'Quiz me on these words' }, b: { id: 'pmode', label: S.pickMode ? 'Done selecting' : 'Select words to keep' } });
        if (S.pickMode) rows.push({ k: 'rule' }, ...pickRows(S, S.study, { hint: 'Select words from this set, add them to My words, or play just those.' }));
        else rows.push({ k: 'rule' }, ...wordRows(S, S.study, { flag: true }));
      }
      return { title: 'Study', rows, primary: S.study.length ? { id: 'quizset', label: 'Quiz me' } : null };
    }
    case 'more':
      return { title: 'More', rows: [
        ...(S.msg ? [{ k: 'p', t: S.msg }] : []),
        { k: 'btn', id: 'findword', label: 'Dictionary and thesaurus', sub: 'meaning, sound, examples, synonyms and opposites' },
        { k: 'btn', id: 'fluency', label: 'Speed round', sub: 'quick answers on words you already know' },
        { k: 'btn', id: 'go:analogy', label: 'Analogy puzzles', sub: 'hot is to cold as big is to small' },
        { k: 'btn', id: 'go:daily', label: 'Daily 10 words', sub: S.prefs.dailyDone === S.day ? 'done today, well done' : 'a short set for today' }, { k: 'btn', id: 'go:sets', label: 'Everyday word sets', sub: 'numbers, food, body, travel, work and more' },
        { k: 'btn', id: 'go:lists', label: 'My word lists', sub: 'import your own or a teacher\'s list' }, { k: 'btn', id: 'go:mock', label: 'Mock test', sub: 'sections, timing and a score report' },
        { k: 'btn', id: 'go:read', label: 'Reading', sub: 'short passages, tap any word' }, { k: 'btn', id: 'go:write', label: 'Write it', sub: 'use a word in your own sentence' }, { k: 'btn', id: 'go:stickers', label: 'Sticker book' },
        { k: 'btn', id: 'go:alpha', label: 'Alphabet', sub: 'hear and see every letter, trace, chant' }, { k: 'btn', id: 'go:together', label: 'Play together', sub: 'a grown-up and a child, one screen' },
        { k: 'btn', id: 'go:library', label: 'Learn more', sub: 'stories, phonics, English for daily life, idioms, spell it, say it, memory' }, { k: 'btn', id: 'go:achievements', label: 'Badges' }, { k: 'btn', id: 'go:trace', label: 'Trace the letters' }, { k: 'btn', id: 'go:place', label: 'Placement check', sub: 'about 3 minutes, finds your starting level' },
        { k: 'rule' },
        { k: 'btn', id: 'go:about', label: 'About' }, { k: 'btn', id: 'go:howto', label: 'How to play' }, { k: 'btn', id: 'go:rules', label: 'Rules' }, { k: 'btn', id: 'go:why', label: 'Why this works' }, { k: 'btn', id: 'go:whatsnew', label: 'What\'s new' },
        { k: 'btn', id: 'go:settings', label: 'Settings and accessibility' }, { k: 'btn', id: 'go:profiles', label: 'Players and profiles' },
        { k: 'btn', id: 'go:data', label: 'Your data: export and import' }, { k: 'btn', id: 'go:privacy', label: 'Privacy' },
        { k: 'rule' }, { k: 'h', t: 'Your words and memory' },
        { k: 'btn', id: 'go:knowledge', label: 'Word knowledge and balance', sub: 'the sides of each word, learned across contexts, a balanced week' },
        { k: 'btn', id: 'go:vtest', label: 'Vocabulary size test', sub: 'an adaptive estimate with a likely range' },
        { k: 'btn', id: 'go:era', label: 'Memories: words from your youth', sub: 'everyday words by decade, with questions to talk about' },
        { k: 'btn', id: 'go:journal', label: 'Life-story journal', sub: 'short memories you write, kept on this phone' },
        { k: 'rule' }, { k: 'h', t: 'Families, teachers and carers' },
        { k: 'btn', id: 'go:reports', label: 'Reports and printables', sub: 'PDF report, certificate, weekly sheet, worksheet, lesson plan, learning log' },
        { k: 'btn', id: 'go:parent', label: 'Parent view', sub: 'how each player is doing, with a PIN' },
        { k: 'btn', id: 'go:caregiver', label: 'Set up for someone else', sub: 'a short guide: comfort, voice, reminder, backup' },
        { k: 'btn', id: 'go:turns', label: 'Take turns', sub: 'grandparent and grandchild, or any two players, on one phone' },
        { k: 'btn', id: 'go:voicecmd', label: 'Voice commands and voice-first play', sub: 'speak instead of tapping' },
      ], primary: null };
    case 'sets': {
      const rows = [{ k: 'h', t: 'Everyday word sets' }, { k: 'p', t: 'Ready-made sets of everyday words for daily life, work and school. Study a set, or be quizzed on it with your chosen question types. The sets are fixed; once you choose a Learning level or Age group, the ones closest to it come first.', small: true }];
      const setList = S.plan.source === 'default' ? S.sets : [...S.sets].sort((a, b) => { const fa = avgBand(a.words), fb = avgBand(b.words); return (fa === null ? 9 : fitScore(S.plan, fa)) - (fb === null ? 9 : fitScore(S.plan, fb)); });   // closest to the player's level first; the sets themselves are never changed
      for (const st of setList) { const lv = avgBand(st.words), fit = lv !== null && S.plan.source !== 'default' && fits(S.plan, lv); const known = st.words.filter((w) => S.records[w] && (S.records[w][8] || S.records[w][0] >= 3)).length; rows.push({ k: 'kv', l: `${st.name}${fit ? ' (fits your level)' : ''}`, r: `${known} of ${st.words.length} known` }, ...(lv !== null && S.plan.source !== 'default' ? [{ k: 'p', t: `Mostly ${bandName(lv)} words.`, small: true }] : []), { k: 'btn2', a: { id: `setstudy:${st.id}`, label: 'Study' }, b: { id: `setplay:${st.id}`, label: 'Quiz me' } }); }
      if (!S.sets.length) rows.push({ k: 'p', t: S.full ? 'The word sets are still loading.' : 'Word sets need the full word list.' });
      return { title: 'Word sets', rows, primary: null };
    }
    case 'mywords': {
      const ws = S.mine.filter((w) => entry(w)), n = ws.length;
      const rows = [{ k: 'h', t: `My words (${n})` }];
      if (!n) { rows.push({ k: 'p', t: 'Nothing saved yet. Open any word in the dictionary and tap Add to my words, keep the words you missed after a round, or paste a text to find new words.' }, { k: 'btn', id: 'go:textwords', label: 'Paste a text' }); return { title: 'My words', rows, primary: null }; }
      rows.push({ k: 'p', t: 'Words you saved from the dictionary, thesaurus, reading and your rounds, grouped by level. Play them, study them, open the dictionary or thesaurus for any word, or remove it.', small: true },
        { k: 'btn2', a: { id: 'pcopen:looked', label: 'Play my words', style: 'primary' }, b: { id: 'liststudy:looked', label: 'Study these words' } },
        { k: 'btn2', a: { id: 'pmode', label: S.pickMode ? 'Done selecting' : 'Select words' }, b: { id: 'go:textwords', label: 'Paste a text' } });
      if (S.mineDue > 0) rows.push({ k: 'btn', id: 'minedue', label: `Review due (${S.mineDue})`, sub: 'words that are ready to come back' });
      rows.push({ k: 'btn', id: 'findword', label: 'Dictionary and thesaurus' }, { k: 'rule' });
      if (S.pickMode) { rows.push(...pickRows(S, ws, { hint: 'Select words to play them, move them to a named list, or build a new list.' })); return { title: 'My words', rows, primary: null }; }
      const groups = BAND_LABELS.map((label, b) => ({ label, words: ws.filter((w) => entry(w).band === b) })).concat([{ label: 'Other words', words: ws.filter((w) => { const b = entry(w).band; return b === undefined || b < 0 || b > 5; }) }]);
      for (const g of groups) {
        if (!g.words.length) continue;
        rows.push({ k: 'sub', t: `${g.label} (${g.words.length})` });
        for (const r of wordRows(S, g.words, { known: false })) rows.push({ ...r, remove: true });
      }
      return { title: 'My words', rows, primary: { id: 'liststudy:looked', label: 'Study' } };
    }
    case 'analogy': {
      const A = S.an ?? { len: 5, secs: 0 };
      const rows = [{ k: 'h', t: 'Analogy puzzles' },
        { k: 'p', t: 'An analogy compares two pairs of words: hot is to cold as big is to small. Find the word that completes the second pair so that it is linked in the same way as the first: opposites, same meaning, a kind of, part of, a stronger word, or a word made from another.' },
        { k: 'p', t: 'Calm by default: no timer and no lives. The Hint button crosses out one wrong choice and names the link. After each answer one line tells you why, and you can tap it to open the word in the dictionary and thesaurus.', small: true }];
      if (!S.anReady) rows.push({ k: 'p', t: 'The puzzles are still loading. Give it a moment.', small: true });
      else rows.push({ k: 'kv', l: 'Words that open puzzles at your level', r: String(S.anN ?? 0) });
      rows.push({ k: 'chips', id: 'anlen', label: 'How long', opts: [chip(5, '5 puzzles', A.len === 5), chip(10, '10 puzzles', A.len === 10)] },
        { k: 'chips', id: 'antime', label: 'Timer', opts: [chip(0, 'No timer', !A.secs), chip(20, '20 s a puzzle', A.secs === 20), chip(12, '12 s a puzzle', A.secs === 12)] },
        { k: 'btn', id: 'anstart', label: 'Start', style: 'primary', disabled: !S.anReady || !(S.anN > 0) },
        { k: 'btn', id: 'anwatch', label: 'Watch and learn', sub: 'the game plays a few puzzles and explains each link', disabled: !S.anReady || !(S.anN > 0) });
      return { title: 'Analogy puzzles', rows, primary: S.anReady && S.anN > 0 ? { id: 'anstart', label: 'Start' } : null };
    }
    case 'playchoose': {
      const PS = S.playSet ?? { words: [], kind: 'mixed', len: 10, label: '' }, n = PS.words.length;
      return { title: 'Play these words', rows: [
        { k: 'h', t: `${n} word${n === 1 ? '' : 's'}${PS.label ? `: ${PS.label}` : ''}` },
        { k: 'p', t: PS.words.slice(0, 14).join(', ') + (n > 14 ? ', ...' : ''), small: true },
        { k: 'chips', id: 'pckind', label: 'Kind of puzzle', opts: PLAY_KIND_CHOICES.map(([v, l]) => chip(v, l, PS.kind === v)), hint: 'Mixed asks each word in a different way. A kind that does not fit a word is skipped for it.' },
        { k: 'chips', id: 'pclen', label: 'How long', opts: [chip(5, '5 questions', PS.len === 5), chip(10, '10 questions', PS.len === 10), chip('all', 'All the words', PS.len === 'all')] },
        { k: 'chips', id: 'pctime', label: 'Timer', opts: [chip(0, 'No timer', !PS.secs), chip(20, '20 s a word', PS.secs === 20), chip(12, '12 s a word', PS.secs === 12)] },
        { k: 'p', t: 'Calm by default: no timer and no lives. Words drift slowly, and words you meet here come back in your daily review.', small: true },
        { k: 'btn', id: 'pcstart', label: 'Start', style: 'primary', disabled: !n },
      ], primary: n ? { id: 'pcstart', label: 'Start' } : null };
    }
    case 'textwords': {
      const Pz = S.textFind ?? { chars: 0, found: [], tokens: 0 };
      const rows = [{ k: 'h', t: 'Find new words in a text' }, { k: 'p', t: 'Paste an article, a book page or an email. The app finds words you may not know yet. Everything stays on this device: the text is never sent anywhere.', small: true },
        { k: 'btn', id: 'textin', label: Pz.chars ? 'Paste a different text' : 'Paste text', style: Pz.chars ? undefined : 'primary', disabled: !S.canAsk }];
      if (!S.canAsk) rows.push({ k: 'p', t: 'Pasting needs the phone app.', small: true });
      if (Pz.chars) rows.push({ k: 'p', t: `${Pz.tokens} words read, ${Pz.found.length} you may not have met yet.`, small: true }, ...(Pz.found.length ? pickRows(S, Pz.found, { hint: 'Words from your text that are new to you or above your level. Pick the ones you want.' }) : [{ k: 'p', t: 'Nothing new here: you already know these words. Try another text.' }]));
      return { title: 'Find new words', rows, primary: null };
    }
    case 'lists': {
      const rows = [{ k: 'h', t: 'My lists' }, { k: 'p', t: 'Make a list for a purpose: test practice, steady practice, just for interest or just for fun. Add words from the dictionary, from reading or from a pasted text, then play the list. Every list tracks how well you know its words, whatever its purpose. Lists stay on this phone.', small: true },
        { k: 'btn', id: 'newlist', label: 'Create a list', style: 'primary' }, { k: 'btn2', a: { id: 'listimport', label: 'Import a file', disabled: !S.canImport }, b: { id: 'go:textwords', label: 'Find words in a text' } }];
      if (!S.canImport) rows.push({ k: 'p', t: 'Importing files is not available on this device yet.', small: true });
      const all = (S.lists ?? []).slice().sort((a, b) => (a.id === 'looked' ? -1 : b.id === 'looked' ? 1 : 0));
      for (const L of all) {
        const m = listMastery(S, L.words);
        rows.push({ k: 'rule' }, { k: 'kv', l: L.name, r: `${L.words.length} word${L.words.length === 1 ? '' : 's'}` }, { k: 'p', t: `${PURPOSES[purposeOf(L)].name}  ·  ${masteryLine(m)}`, small: true },
          { k: 'bar', label: 'Known', frac: L.words.length ? m.kn / L.words.length : 0, text: `${m.kn} of ${L.words.length}` },
          { k: 'btn2', a: { id: `pcopen:${L.id}`, label: purposeOf(L) === 'interest' ? 'Play when you like' : 'Play', style: purposeOf(L) === 'interest' ? undefined : 'primary', disabled: !L.words.length }, b: { id: `listopen:${L.id}`, label: 'Open' } });
      }
      if (S.msg) rows.push({ k: 'p', t: S.msg });
      return { title: 'My lists', rows, primary: null };
    }
    case 'newlist': {
      const rows = [{ k: 'h', t: 'What is this list for?' }, { k: 'p', t: S.pendingAdd?.length ? `Your ${S.pendingAdd.length} selected word${S.pendingAdd.length === 1 ? '' : 's'} will go into the new list. Everything can be changed later.` : 'Pick the one that fits. It only sets friendly defaults, and every setting can be changed later.', small: true }];
      for (const k of ['test', 'general', 'interest', 'fun']) rows.push({ k: 'btn', id: `nlpurpose:${k}`, label: PURPOSES[k].name, sub: PURPOSES[k].blurb.length > 70 ? `${PURPOSES[k].blurb.slice(0, 67)}...` : PURPOSES[k].blurb });
      rows.push({ k: 'btn', id: 'nlpurpose:custom', label: 'Custom', sub: 'your own mix' });
      return { title: 'New list', rows, primary: null };
    }
    case 'listview': {
      const L = (S.lists ?? []).find((x) => x.id === S.listSel);
      if (!L) return { title: 'List', rows: [{ k: 'p', t: 'This list is gone.' }], primary: null };
      const pu = purposeOf(L), m = listMastery(S, L.words), n = L.words.length, ws = L.words.filter((w) => entry(w));
      const rows = [{ k: 'h', t: `${L.name} (${n})` }, { k: 'p', t: `${PURPOSES[pu].name}: ${PURPOSES[pu].blurb}`, small: true }, { k: 'bar', label: `Mastery: ${m.kn} of ${n} known`, frac: n ? m.kn / n : 0, text: masteryLine(m) }];
      if (pu === 'interest') rows.push({ k: 'btn2', a: { id: `liststudy:${L.id}`, label: 'Browse as cards', style: 'primary', disabled: !n }, b: { id: `pcopen:${L.id}`, label: 'Play when you like', disabled: !n } });
      else rows.push({ k: 'btn2', a: { id: `pcopen:${L.id}`, label: pu === 'fun' ? 'Play (arcade)' : 'Play this list', style: 'primary', disabled: !n }, b: { id: `liststudy:${L.id}`, label: 'Study cards', disabled: !n } });
      if (pu === 'test') rows.push({ k: 'btn', id: `listmock:${L.id}`, label: 'Mock test', sub: 'timed, mixed questions on this list', disabled: !n });
      if (m.due) rows.push({ k: 'btn', id: `listdue:${L.id}`, label: `Due today (${m.due})`, sub: 'words ready to come back' });
      rows.push({ k: 'rule' }, { k: 'sub', t: 'Add words' }, { k: 'btn2', a: { id: `laddsearch:${L.id}`, label: 'Search a word' }, b: { id: `laddtext:${L.id}`, label: 'Paste a text' } }, { k: 'btn', id: `laddread:${L.id}`, label: 'Pick from reading' });
      rows.push({ k: 'rule' }, { k: 'sub', t: 'Manage' }, { k: 'btn2', a: { id: `lrename:${L.id}`, label: 'Rename', disabled: L.id === 'looked' }, b: { id: `listdel:${L.id}`, label: 'Delete', disabled: L.id === 'looked' } });
      const others = (S.lists ?? []).filter((x) => x.id !== L.id);
      if (others.length && L.id !== 'looked') rows.push({ k: 'chips', id: 'lmerge', label: 'Merge this list into', opts: others.map((x) => chip(x.id, x.name, false)) });
      rows.push({ k: 'btn2', a: { id: 'pmode', label: S.pickMode ? 'Done selecting' : 'Select words to move' }, b: { id: `listshare:${L.id}`, label: 'Share as file' } });
      rows.push({ k: 'rule' });
      if (S.pickMode) rows.push(...pickRows(S, ws.map((e) => e.w), { listId: L.id, hint: 'Select words to move to another list, add elsewhere or play.' }));
      else for (const r of wordRows(S, L.words, { known: false })) rows.push({ ...r, remove: true });
      return { title: L.name, rows, primary: null };
    }
    case 'mock': {
      const M = S.prefs.mock, ALL = ['synonym', 'antonym', 'definition', 'spelling', 'cloze', 'odd', 'sense', 'category', 'analogy', 'homophone', 'confusable', 'inflect'];
      const rows = [{ k: 'h', t: 'Mock test' }, { k: 'p', t: 'Build a timed practice test from sections, then get a score report by section. This is practice, not an official test.', small: true },
        { k: 'chips', id: 'mkind', label: 'Sections (pick any)', opts: ALL.map((k) => chip(k, QTYPES.find((q) => q.k === k)?.label ?? k, M.kinds.includes(k), { disabled: S.kindOff.includes(k) })) },
        { k: 'chips', id: 'mband', label: 'Words from this level', opts: BAND_LABELS.map((l, i) => chip(i, l, S.mockBand === i)), hint: M.bandPinned ? '' : `Follows your Learning level (${S.plan.name}) until you pick one here.` },
        { k: 'step', id: 'mn', label: 'Questions', value: String(M.n), decOff: M.n <= 10, incOff: M.n >= 50 },
        { k: 'step', id: 'msec', label: 'Seconds per question', value: `${M.secs} s`, decOff: M.secs <= 8, incOff: M.secs >= 60 },
        { k: 'p', t: `Total time about ${Math.round((M.n * M.secs) / 60)} minutes. No hints, no lives.`, small: true },
        { k: 'btn', id: 'mockstart', label: 'Start the test', style: 'primary' }];
      return { title: 'Mock test', rows, primary: { id: 'mockstart', label: 'Start' } };
    }
    case 'mockresult': {
      const R = S.runResult?.mock; if (!R) return { title: 'Mock test', rows: [{ k: 'p', t: 'No result yet.' }], primary: null };
      const rows = [{ k: 'h', t: `Score: ${R.right} of ${R.n}` }, { k: 'kv', l: 'Accuracy', r: `${Math.round(R.acc * 100)}%` }, { k: 'kv', l: 'Average answer time', r: `${(R.avgMs / 1000).toFixed(1)} s (target ${R.secs} s)` },
        { k: 'kv', l: `Readiness for ${BAND_LABELS[R.band]} words`, r: R.ready }, { k: 'p', t: R.advice, small: true }, { k: 'rule' }, { k: 'h', t: 'By section' }];
      for (const [k, [r, n]] of Object.entries(R.per)) rows.push({ k: 'bar', label: `${QTYPES.find((q) => q.k === k)?.label ?? k}: ${r} of ${n}`, frac: n ? r / n : 0 });
      rows.push({ k: 'btn2', a: { id: 'mockstart', label: 'Take it again', style: 'primary' }, b: { id: 'go:mock', label: 'Change the test' } });
      return { title: 'Test report', rows, primary: null };
    }
    case 'write': {
      const W_ = S.write;
      const rows = [{ k: 'h', t: W_?.mode === 'story' ? 'Story starter' : 'Write it' }, { k: 'chips', id: 'wmode', label: 'Practice', opts: [chip('use', 'Use one word', W_?.mode !== 'story'), chip('story', 'Story starter (3 words)', W_?.mode === 'story')] }];
      if (!W_ || !W_.words.length) rows.push({ k: 'p', t: 'No words yet. Make a study set or play first.' });
      else {
        rows.push({ k: 'p', t: W_.mode === 'story' ? 'Write two or three sentences, or a tiny story, using all three words. Say it aloud or write it on paper.' : 'Write or say one sentence of your own that uses this word.', small: true });
        for (const w of W_.words) { const e = entry(w); if (e) rows.push({ k: 'sub', t: w }, { k: 'p', t: e.gloss }, ...(e.ex && W_.mode !== 'story' ? [{ k: 'p', t: `A model sentence: ${e.ex}`, small: true }] : [])); }
        if (W_.mode !== 'story') rows.push({ k: 'p', t: 'Checklist: is the word spelled right? Does the sentence make sense? Does it show what the word means?', small: true });
        rows.push({ k: 'btn2', a: { id: 'wdone', label: W_.done ? 'Done today' : 'I did it', style: W_.done ? 'primary' : undefined }, b: { id: 'wnext', label: 'Another' } });
      }
      return { title: 'Write it', rows, primary: null };
    }
    case 'explore': {
      const w = S.explore, e = w && entry(w);
      const findBtn = [{ k: 'btn2', a: { id: 'findword', label: 'Look up any word', style: 'primary' }, b: { id: 'thesword', label: 'Thesaurus' } }];
      if (!e) {
        const miss = w ? [{ k: 'h', t: w }, { k: 'p', t: S.exploreNote || 'This dictionary has no built-in meaning for that word.' }, ...(S.lookupOn ? [{ k: 'p', t: 'You can open it in an online dictionary instead.', small: true }, { k: 'chips', id: 'look', label: '', opts: [chip(w, 'Open in a dictionary', false)] }] : [])] : [{ k: 'p', t: 'Type any word to see its meaning, or pick a word from a study list to explore it.' }];
        return { title: 'Word explorer', rows: [...findBtn, ...miss], primary: null };
      }
      const row = e.rank, fl = facets.wordLines(S.facets ?? {}, e.w), rows = [...findBtn, ...(S.exploreNote ? [{ k: 'p', t: S.exploreNote, small: true }] : []), { k: 'h', t: e.w }, { k: 'btn2', a: { id: `dict:${e.w}`, label: 'Meaning sheet' }, b: { id: `thes:${e.w}`, label: 'Thesaurus for this word' } }, { k: 'p', t: `${posName(e.pos)}${e.rank !== undefined ? `  ·  ${BAND_LABELS[e.band]} (about ${CEFR[e.band]})` : ''}`, small: true }, { k: 'p', t: e.gloss || '(meaning not available)' }];
      const line = (label, list) => { if (list && list.length) rows.push({ k: 'p', t: `${label}: ${list.join(', ')}`, small: true }); };
      if (e.rank !== undefined && kb.ready()) {
        const plain = e.plain || kb.plainGloss(row); if (plain) rows.push({ k: 'p', t: `In simpler words: ${plain}`, small: true });
        if (e.ex) rows.push({ k: 'p', t: `Example: ${e.ex}`, small: true });
        if (e.mn) rows.push({ k: 'p', t: `Memory hook: ${e.mn}`, small: true });
        const sy = kb.syllables(row), st = kb.col(row, 1); if (sy) rows.push({ k: 'kv', l: 'Syllables', r: `${sy}${st ? `, stress on part ${st}` : ''}` });
        const bl = breaksLine(e); if (bl) rows.push({ k: 'p', t: `${bl} (the breaks are a guess from the spelling)`, small: true });
        rows.push({ k: 'p', t: `${tierLine(e)}: ${tierOf(e).blurb}.`, small: true });
        const pt = kb.parts(row); if (pt) rows.push({ k: 'p', t: `Word parts: ${[pt.prefix && `${pt.prefix[0]}- (${pt.prefix[1]})`, pt.root && `${pt.root[0]} (${pt.root[1]})`, pt.suffix && `-${pt.suffix[0]} (${pt.suffix[1]})`].filter(Boolean).join(' + ')} (a guess from the spelling)`, small: true });
        line('Same meaning', kb.synonyms(row, 0, 1).map((x) => x.w)); line('Opposite', kb.antonyms(row, true).map((x) => `${x.w} (${kb.ANT_TYPES[x.type]})`));
        line('A kind of', kb.words('hyper', row)); line('Kinds of it', kb.words('hypo', row)); line('Has parts', kb.words('mero', row)); line('Part of', kb.words('holo', row));
        line('Word family', kb.words('fam', row)); line('Sounds like', kb.words('homo', row)); line('Rhymes with', kb.words('rhyme', row).slice(0, 6)); line('Goes with', kb.list('col', row).map((x) => (x.attr === 1 ? `${e.w} ${x.w}` : `${x.w} ${e.w}`)));
        line('Phrases', kb.phrases(row).map((p) => p.text)); const sp = kb.spellFlags(row), names = kb.manifest()?.spelling ?? []; line('Spelling notes', names.filter((_, i) => sp & (1 << i)));
        { const tapW = [...new Set([...kb.synonyms(row, 0, 1).map((x) => x.w), ...kb.antonyms(row, true).map((x) => x.w)])].filter((x) => x !== e.w && entry(x)?.rank !== undefined).slice(0, 8); if (tapW.length) rows.push({ k: 'chips', id: 'dict', label: 'Open a linked word in the dictionary', opts: tapW.map((x) => chip(x, x, false)) }); }
        const conf = kb.confusables().find((p) => p[0] === e.w || p[1] === e.w); if (conf) rows.push({ k: 'p', t: `Easily confused: ${conf[0]} (${conf[2]}) and ${conf[1]} (${conf[3]})`, small: true });
        const vr = kb.variants().find((v) => v[0] === e.w); if (vr) rows.push({ k: 'p', t: `British spelling: ${vr[1]}`, small: true });
        // C4 word association map: broader words and synonyms above, the word in the centre, narrower words, family and parts below. Tap any linked word to move the map there.
        const ex = (list, n) => [...new Set(list)].filter((x) => entry(x)?.rank !== undefined && x !== e.w).slice(0, n);
        const tiers = [{ label: 'A kind of', id: 'xw', words: ex(kb.words('hyper', row), 4) }, { label: 'Same meaning', id: 'xw', words: ex(kb.synonyms(row, 0, 1).map((x) => x.w), 6) }, { label: 'Kinds of it', id: 'xw', words: ex(kb.words('hypo', row), 8) }, { label: 'Word family', id: 'xw', words: ex(kb.words('fam', row), 6) }, { label: 'Has parts', id: 'xw', words: ex(kb.words('mero', row), 5) }, { label: 'Goes with', id: 'xw', words: ex(kb.list('col', row).map((x) => x.w), 5) }];
        const above = tiers.slice(0, 2).filter((t) => t.words.length), below = tiers.slice(2).filter((t) => t.words.length);
        if (above.length || below.length) rows.push({ k: 'rule' }, { k: 'sub', t: 'Word map' }, { k: 'p', t: 'Tap a word on the map to move the map to it.', small: true }, { k: 'wmap', centre: e.w, centreAt: above.length, tiers: [...above, ...below] });
        // D1 word tree: the parts of the word and the relatives that share its root
        if (pt) {
          const rel = ex(kb.words('fam', row), 4), tl = [e.w];
          const parts = [pt.prefix && [`${pt.prefix[0]}-`, pt.prefix[1], 'prefix'], pt.root && [pt.root[0], pt.root[1], 'root'], pt.suffix && [`-${pt.suffix[0]}`, pt.suffix[1], 'ending']].filter(Boolean);
          parts.forEach((p, i) => { const last = i === parts.length - 1; tl.push(`${last ? '`-' : '+-'} ${p[0]}  (${p[2]}: ${p[1]})`); if (p[2] === 'root') rel.forEach((r, j) => tl.push(`${last ? '   ' : '|  '}   ${j === rel.length - 1 ? '`-' : '+-'} ${r}`)); });
          rows.push({ k: 'rule' }, { k: 'sub', t: 'Word tree' }, ...tl.map((t) => ({ k: 'pre', t })), { k: 'p', t: 'The parts are a guess from the spelling.', small: true });
        }
        const next = [...new Set([...kb.words('fam', row), ...kb.words('hyper', row), ...kb.synonyms(row, 0, 1).map((x) => x.w), ...kb.words('hypo', row).slice(0, 4)])].filter((x) => entry(x) && entry(x).rank !== undefined).slice(0, 10);
        if (next.length) rows.push({ k: 'chips', id: 'xw', label: 'Explore a related word', opts: next.map((x) => chip(x, x, false)) });
      } else rows.push({ k: 'p', t: 'More about this word appears when the relations pack has loaded.', small: true });
      if (fl.length) rows.push({ k: 'rule' }, { k: 'sub', t: 'How well you know it' }, ...fl.map((t) => ({ k: 'p', t, small: true })));
      if (S.lookupOn) rows.push({ k: 'rule' }, { k: 'chips', id: 'look', label: 'Not enough? Check an online dictionary', opts: [chip(e.w, 'Open in a dictionary', false)] });
      return { title: 'Word explorer', rows, primary: null };
    }
    case 'compare': {
      const C = S.cmp, e = C && entry(C.w);
      if (!e) return { title: 'Compare', rows: [{ k: 'p', t: 'Pick a word from a study list and tap Compare.' }], primary: null };
      const nm = (k) => DICTS.find((d) => d.k === k)?.label ?? k, note = P.notes?.[C.w];
      const rows = [{ k: 'h', t: e.w }, { k: 'p', t: e.gloss || '(meaning not available)' }];
      if (e.ex) rows.push({ k: 'p', t: `Example: ${e.ex}`, small: true });
      rows.push({ k: 'rule' }, { k: 'h', t: 'Open it in two dictionaries' },
        { k: 'p', t: 'Each button opens that dictionary in your phone\'s browser, one after the other. Only the word is sent. Warning: those websites are not part of this app and are not checked by us; they can show adult or offensive words, pictures or advertising.', small: true },
        { k: 'chips', id: 'cmpa', label: 'First dictionary', opts: DICTS.map((d) => chip(d.k, d.label, C.a === d.k)) },
        { k: 'chips', id: 'cmpb', label: 'Second dictionary', opts: DICTS.map((d) => chip(d.k, d.label, C.b === d.k)) },
        { k: 'btn2', a: { id: 'cmpopen:a', label: C.opened.a ? `${nm(C.a)} (opened)` : `Open ${nm(C.a)}`, style: 'primary' }, b: { id: 'cmpopen:b', label: C.opened.b ? `${nm(C.b)} (opened)` : `Open ${nm(C.b)}`, disabled: C.a === C.b } },
        { k: 'rule' }, { k: 'h', t: 'Which meaning do you prefer?' },
        { k: 'p', t: note ? `Your note: ${note}` : 'No note yet. Your notes stay on this phone and go into your Words (CSV) export.', small: true },
        { k: 'chips', id: 'cmppref', label: 'Quick note', opts: [chip('app', 'This app\'s meaning', false), chip('a', nm(C.a), false), chip('b', nm(C.b), false), chip('clear', 'Clear the note', false, { disabled: !note })] },
        { k: 'btn', id: 'cmpnote', label: 'Write my own note', disabled: !S.canAsk });
      return { title: 'Compare', rows, primary: null };
    }
    case 'read': {
      const rows = [{ k: 'h', t: 'Reading' }, { k: 'p', t: 'Short passages at six levels. Tap any word to see its meaning and add it to your study set, then check your understanding. The passages are original to this app.', small: true }];
      const allPass = (extras()?.passages ?? []).filter((x) => !S.plan.kid || x.k === 1 || (x.k === undefined && x.level <= 1)), passList = S.plan.source === 'default' ? allPass : [...allPass].sort((a, b) => fitScore(S.plan, a.level) - fitScore(S.plan, b.level));   // closest to the player's level first
      rows.push({ k: 'btn', id: 'go:textwords', label: 'Paste a text', sub: 'an article, a book page, an email: find words to learn' });
      for (const p of passList) { const done = S.readDone[p.id]; rows.push({ k: 'btn', id: `readpick:${p.id}`, label: p.title, sub: `${BAND_LABELS[p.level]}${S.plan.contexts.includes(p.level) ? '  ·  matches your level' : S.plan.source !== 'default' && p === passList[0] ? '  ·  start here' : ''}${done ? '  ·  done' : ''}` }); }
      if (!extras()?.passages?.length) rows.push({ k: 'p', t: 'The reading passages are still loading.' });
      return { title: 'Reading', rows, primary: null };
    }
    case 'reading': {
      const R = S.reading, P_ = (extras()?.passages ?? []).find((x) => x.id === R?.id);
      if (!P_) return { title: 'Reading', rows: [{ k: 'p', t: 'No passage selected.' }], primary: null };
      const rows = [{ k: 'h', t: P_.title }, { k: 'p', t: R.collect ? 'Collect words: tap words in the text to pick them (they are highlighted). Nothing is saved until you add them.' : 'Tap a word to see what it means.', small: true }, { k: 'rtext', t: P_.text, selIdx: R.collect ? -1 : R.selIdx, picked: R.collect ? (S.pick ?? []) : [] },
        { k: 'btn', id: 'rcollect', label: R.collect ? 'Back to looking up words' : 'Collect words', sub: R.collect ? '' : 'pick words, add them to My words, play them' }];
      if (R.collect) rows.push(...pickRows(S, S.pickWords ?? [], { hint: 'Your picks. Tap a word here to unpick it, or use Select all unfamiliar.' }));
      if (R.sel && !R.collect) { const e = entry(R.sel); rows.push({ k: 'sub', t: R.sel }, { k: 'p', t: e?.gloss || 'No meaning is stored for this word. It is a very common small word, or not in the study list.' }, ...(e && e.rank !== undefined ? [{ k: 'btn2', a: { id: 'radd', label: S.mine.includes(R.sel) ? 'In my words' : 'Add to my words', disabled: S.mine.includes(R.sel) }, b: { id: `explore:${R.sel}`, label: 'Explore' } }] : [])); }
      rows.push({ k: 'rule' }, { k: 'h', t: 'Quick check' });
      P_.qs.forEach((q, qi) => {
        const opts = q.slice(1).map((t, oi) => ({ t, oi })), order = (R.order[qi] ?? opts.map((o) => o.oi));
        rows.push({ k: 'chips', id: `rq${qi}`, label: q[0], opts: order.map((oi) => chip(oi, q[1 + oi], R.ans[qi] === oi)) });
        if (R.ans[qi] !== undefined) rows.push({ k: 'p', t: R.ans[qi] === 0 ? 'Right.' : `Not quite. The answer is: ${q[1]}`, small: true });
      });
      rows.push({ k: 'btn', id: 'pr:readpass', label: 'Read it to me', sub: 'the voice reads, the word being read lights up' });
      rows.push({ k: 'btn', id: 'rfin', label: R.wpm ? `Reading speed: about ${R.wpm} words a minute` : 'I finished reading: measure my speed' });
      return { title: 'Reading', rows, primary: null };
    }
    case 'stickers': {
      const cells = ART_WORDS.map((w) => ({ w, got: Boolean(S.records[w] && (S.records[w][2] >= 2 || S.records[w][8])) })), n = cells.filter((c) => c.got).length;
      return { title: 'Sticker book', rows: [{ k: 'h', t: `Stickers: ${n} of ${cells.length}` }, { k: 'p', t: 'Answer a picture word right twice, or mark it known, to collect its sticker. Stickers are never taken away.', small: true }, { k: 'stickers', cells }], primary: null };
    }
    case 'why':
      return { title: 'Why this works', rows: [
        { k: 'h', t: 'The ideas behind the game' },
        { k: 'p', t: 'Retrieval practice: trying to recall a word before seeing the answer strengthens memory more than re-reading it. Every question here makes you recall first.' },
        { k: 'p', t: 'Spaced review: a word you got right is met again after a longer gap, a word you missed comes back sooner. The boxes in this app (1, 2, 4, 8, 16, 32 and 64 days) follow the Leitner idea.' },
        { k: 'p', t: 'Many meetings, many ways: a word is learned through repeated meetings in different contexts: meaning, spelling, sound, parts and phrases. The question types are there for that reason.' },
        { k: 'p', t: 'Word parts and families: knowing prefixes, roots and related words helps you work out new words.' },
        { k: 'p', t: 'Balanced practice: reading, using, studying and fast practice all matter, so the game mixes study sets, quick play and writing.' },
        { k: 'p', t: 'Three tiers of vocabulary: everyday words, general academic words (useful across school subjects) and domain-specific words (one field). Each needs a different kind of attention, so cards and Progress name the tier. The tier is an estimate.' },
        { k: 'p', t: 'Letters, sounds and shared reading: young children learn letters best when they see, hear, trace and say them, and when a grown-up talks about the picture with them. The alphabet tools combine all four, and Play together is built for sharing.' },
        { k: 'p', t: 'Topic and subject packs, and the language-in-depth decks: words are most useful when they come with their field and their craft. Packs gather the words of medicine, law, cooking, biology, mathematics and more, always inside your level; the depth decks teach style, rhetoric, sound devices, word-making, wordplay, world Englishes and slang as small multiple-choice questions, each with a one-line reason. The items were written with the help of an AI tool and checked by a second pass, not yet by a human expert; the fables and poems are public-domain texts checked word for word against their books.' },
        { k: 'p', t: 'Learning English for daily life: people settling in a new country need the words of real places first (greetings, signs, forms, shops, the clinic, work). The English for daily life decks are built around those situations and the sounds that are hard for many learners, with hearing before saying.' },
        { k: 'p', t: 'Many sides of a word: you can recognise a word among choices, find it from its meaning, spell it, hear it, and use it in a sentence, and each is a different skill. The game follows each side of each word separately and schedules each one for review on its own. A new word is called mastered only after you have answered right in at least three different kinds of question, because a word met in many contexts is remembered and used more freely.' },
        { k: 'p', t: 'A balanced week: good learning mixes four strands: meaning-focused input (reading and listening), meaning-focused output (writing and speaking), language-focused study (questions and flashcards) and fluency (speed practice). Word knowledge shows your week and suggests what to do next. The sides-of-a-word grouping and the four strands follow a standard idea in vocabulary research and have not yet had an expert review.' },
        { k: 'p', t: 'Fluency: knowing a word is not the same as finding it quickly. The speed round gives quick practice on words you already know, so using them becomes easy and automatic.' },
        { k: 'p', t: 'Recall before recognition, and honest confidence: finding a word from its meaning is harder than picking it from a list, and noticing whether you were sure or guessing helps decide when a word should come back.' },
        { k: 'h', t: 'Further reading' },
        { k: 'pre', t: 'Ebbinghaus, H. (1885). Memory: A Contribution to Experimental Psychology (the forgetting curve).' },
        { k: 'pre', t: 'Leitner, S. (1972). So lernt man lernen (the box system for spaced review).' },
        { k: 'pre', t: 'Nation, I. S. P. (2001). Learning Vocabulary in Another Language. Cambridge University Press.' },
        { k: 'pre', t: 'Karpicke, J. D. and Roediger, H. L. (2008). The critical importance of retrieval for learning. Science, 319.' },
        { k: 'p', t: 'This page is a plain summary for players and has not yet had an expert review. The levels in the app are estimates from how common words are, not a school curriculum.', small: true },
      ], primary: null };
    case 'whatsnew':
      return { title: 'What\'s new', rows: [
        { k: 'h', t: 'Latest' }, { k: 'p', t: 'New: Reports and printables (a progress report and certificate as PDF files, a weekly sheet, a worksheet, a lesson plan and a homeschool learning log), a parent PIN and Parent view, a guide for setting up the game for someone else, Take turns for two players of any age, Memories (everyday words of each decade with questions to talk about, and a life-story journal you write with the game\'s own keyboard), an adaptive vocabulary-size test with a likely range, Word knowledge (each side of a word is scheduled on its own, a new word counts as learned after three kinds of question, and a balanced week), voice commands and voice-first play, and a screen-reader layer.' },
        { k: 'h', t: 'Before that' }, { k: 'p', t: 'Topic and subject packs (science, medicine, law, business, finance, technology, trades, farming, cooking, travel, the arts, sport, and biology to computing) that stay inside your level, a part-of-speech filter in Words and pace, a word web you build by picking the words that belong, a word map and word tree in the Word explorer, compound words (join or split), a language-in-depth set (style, politeness and hidden meaning, rhetorical devices, poetry sound devices, how words are formed, how technical terms are coined, wordplay, world Englishes, slang with eras), more reading passages at every level, and fables and poems from public-domain books.' },
        { k: 'h', t: 'Earlier' }, { k: 'p', t: 'Study cards with the word family, syllables, tier and a highlighted example; a Compare view for two dictionaries and your own notes; a warning before any dictionary website opens; silent letters and tricky patterns; right-sentence, hear-then-meaning, hear-then-spelling, sorting and general-to-specific questions; type the spelling, find the word and rank by strength; a speed round on known words; an optional guessed button after answers; words you mix up; a one-handed layout.' }, { k: 'p', t: 'Learn more: read-along stories and rhymes with a voice and lit words, phonics, spell it, dictation and a spelling bee, idioms, usage and writing decks, poems, your own text, saying words, a confidence check and a memory view. Two to six words on screen. Example sentences for thousands of common words and memory hooks for many of them.' }, { k: 'p', t: 'Earlier: Reading passages with tap-for-meaning, a word explorer, strength ladders and a commonly misspelled words set. More ways to practise: sentence gaps, missing letters, syllables and stress, palindromes, word builders, irregular forms, another meaning of a word and sound-alike listening.' },
        { k: 'p', t: 'New: an alphabet reader with name and sound, an original alphabet chant, letter games (find, odd one out, hunt, look-alikes, letter-sound-picture, alphabet order), tracing in capital, small and joined letters with numbered strokes, a sound chart, an on-screen keyboard game, play together for a grown-up and a child, tips for grown-ups, Bedtime mode, English for daily life (greetings, signs and forms, numbers and time, settling in, customs, hard sounds, a picture dictionary by place, trade and work packs), and over a hundred new pictures.' },
        { k: 'h', t: 'Before' }, { k: 'p', t: 'Daily 10 words, everyday word sets, your own word lists, mock tests with a score report, Write it, a sticker book, adaptive speed and a play-time reminder.' },
        { k: 'p', t: 'Word-relationship questions (kind of, part of, sounds like, rhymes, unscramble, word family, goes with, phrases, easily confused, word parts, UK spellings).' },
        { k: 'p', t: 'The Journey from letters to graduate words, players and child profiles, accessibility options, badges and a weekly summary.' },
        { k: 'p', t: 'The configuration layer: levels, kinds of words, topics, study sets, pace presets, spaced review, progress and export.' },
      ], primary: null };
    case 'age':
      return { title: 'Welcome', rows: [
        { k: 'h', t: 'Who is playing?' },
        { k: 'p', t: 'Pick an Age group. It sets the pace, text size and kind of words. It is not sent anywhere, and you can change it any time in Settings.' },
        { k: 'btn', id: 'age:child', label: 'A child (under 13)', sub: 'kid-safe words, gentle pace, grown-up settings' },
        { k: 'btn', id: 'age:teen', label: 'A teenager', sub: 'Middle and High school words' },
        { k: 'btn', id: 'age:adult', label: 'An adult', sub: 'Graduate-level words unless you pick a level' },
        { k: 'btn', id: 'age:later', label: 'Later life', sub: 'calm pace, no clock, larger text' },
        { k: 'btn', id: 'age:beginner', label: 'An adult beginner', sub: 'first words and Elementary, relaxed pace' },
        { k: 'p', t: 'You can add more players, such as family members, later in More > Players and profiles.', small: true },
      ], primary: null };
    case 'firstlevel':
      return { title: 'Learning level', rows: [
        { k: 'h', t: 'What level of words?' },
        { k: 'p', t: 'Words come from the level you pick and the one below it. You can change this any time in Settings.' },
        ...LEVELS.map((l, i) => ({ k: 'btn', id: `flvl:${i}`, label: l, sub: ['first words and everyday words', 'ages about 11 to 13', 'ages about 14 to 18', 'college reading', 'advanced study words'][i] })),
        { k: 'btn', id: 'flvl:auto', label: 'Not sure: use the standard level', sub: S.plan.age && S.plan.age !== 'adult' ? 'follows your Age group' : 'Graduate words' },
      ], primary: null };
    case 'gate': {
      if (S.gate?.pin && !(S.gate.chain > 0)) return screenRows7('pingate', S);
      const g = S.gate ?? { a: 0, b: 0, opts: [] };
      return { title: 'Grown-ups only', rows: [
        { k: 'h', t: 'Ask a grown-up' },
        { k: 'p', t: g.chain > 0 ? `To clear the PIN, answer ${g.chain} more ${g.chain === 1 ? 'sum' : 'sums'}. What is ${g.a} + ${g.b}?` : `Settings, data and players are for grown-ups. What is ${g.a} + ${g.b}?` },
        { k: 'chips', id: 'gate', label: g.wrong ? 'Not quite. Try again.' : 'Pick the answer', opts: g.opts.map((o) => chip(o, String(o), false)) },
      ], primary: null };
    }
    case 'profiles': {
      const rows = [{ k: 'h', t: 'Players' }, { k: 'p', t: 'Each player has their own words, progress, journey and settings on this phone. Child players only see vetted words and never get dictionary look-ups.', small: true }];
      for (const p of S.profiles) {
        const me = p.id === S.profile;
        rows.push({ k: 'kv', l: p.name, r: `${p.type === 'child' ? 'Child' : 'Adult'}${me ? ' (playing)' : ''}` });
        rows.push({ k: 'btn2', a: { id: `pswitch:${p.id}`, label: me ? 'Playing now' : 'Switch to this player', disabled: me }, b: { id: `pdel:${p.id}`, label: S.confirmProfile === p.id ? 'Tap again to delete' : 'Delete', style: S.confirmProfile === p.id ? 'primary' : undefined } });
        if (S.canAsk) rows.push({ k: 'btn', id: `prename:${p.id}`, label: 'Rename' });
      }
      rows.push({ k: 'rule' }, { k: 'h', t: 'Add a player' }, { k: 'btn2', a: { id: 'padd:adult', label: 'Add an adult' }, b: { id: 'padd:child', label: 'Add a child' } }, { k: 'btn', id: 'padd:senior', label: 'Add a later-life calm player', sub: 'no clock, bigger text, gentle feedback' });
      return { title: 'Players', rows, primary: null };
    }
    case 'achievements': {
      const have = S.ach, rows = [{ k: 'h', t: `Badges: ${Object.keys(have).length} of ${ACH.length}` }, { k: 'p', t: 'Badges are for steady habits and exploring. Nothing is ever taken away.', small: true }];
      for (const a of ACH) rows.push({ k: 'bar', label: `${have[a.id] ? '✓ ' : ''}${a.name}`, frac: have[a.id] ? 1 : 0, text: a.desc });
      return { title: 'Badges', rows, primary: null };
    }
    case 'stageinfo': {
      const sel = S.sel; if (!sel) return { title: 'Journey', rows: [], primary: null };
      const W_ = jny.WORLDS[sel.world], J = S.journey, isCheck = sel.kind === 'check';
      const unlocked = isCheck ? jny.checkReady(J, sel.world) : jny.isStageUnlocked(J, sel.world, sel.stage);
      const stars = isCheck ? 0 : J.stars[jny.stageId(sel.world, sel.stage)] ?? 0;
      const rows = [{ k: 'h', t: isCheck ? `${W_.name} checkpoint` : `${W_.name}: ${jny.stageTitle(sel.world, sel.stage)}` }];
      if (isCheck) rows.push({ k: 'p', t: `${jny.CHECK_QUESTIONS} questions from the whole world, 3 lives, no hints. Score ${Math.round(jny.PASS_CHECK * 100)}% to open the next world.${J.checks[sel.world] ? ` Your best: ${J.checks[sel.world]}%.` : ''}` });
      else rows.push({ k: 'p', t: `${jny.STAGE_QUESTIONS} questions about ${W_.k === 'letters' ? 'these letters' : `${S.stageWords.length} words`}. Get at least half right for a star, 75% for two, 90% for three.${stars ? ` Your stars: ${stars} of 3.` : ''}` });
      if (!unlocked) rows.push({ k: 'p', t: isCheck ? 'Earn a star on every stage of this world first.' : 'Earn a star on the stage before this one first.' });
      if (W_.k === 'letters' && !isCheck) rows.push({ k: 'btn', id: 'go:trace', label: 'Trace these letters first' });
      if (!isCheck && W_.k !== 'letters') {
        rows.push({ k: 'rule' }, { k: 'h', t: 'Words in this stage' });
        for (const e of S.stageWords) {
          const r = S.records[e.w];
          rows.push({ k: 'word', w: e.w, pos: posName(e.pos), gloss: e.gloss, lines: [e.syn.length ? `Same meaning: ${e.syn.join(', ')}` : ''].filter(Boolean), lookup: S.lookupOn, checked: !!(r && r[7]) });
        }
      }
      return { title: 'Journey', rows, primary: { id: 'play', label: isCheck ? 'Start the test' : 'Play', disabled: !unlocked } };
    }
    case 'placeresult': {
      const est = S.est;
      if (!est) return { title: 'Placement', rows: [{ k: 'p', t: 'No result yet.' }], primary: null };
      const names = ['Elementary', 'Middle school', 'High school', 'Undergraduate', 'Graduate', 'Professional'];
      const rows = [{ k: 'h', t: 'Your starting level' },
        { k: 'p', t: `Start your Journey in ${jny.WORLDS[est.world].name}. The worlds before it are open for you.` }, { k: 'kv', l: 'Rough level label', r: `about ${CEFR[Math.max(0, est.world - 2)]}` },
        { k: 'kv', l: 'Words you may know', r: `about ${est.total.toLocaleString?.() ?? est.total}` }, { k: 'kv', l: 'Likely range', r: `${est.lo} to ${est.hi}` },
        { k: 'p', t: 'This is a rough guess from 18 questions, counted against the words in this app\'s list. Treat it as a starting point, not a test score.', small: true }, { k: 'rule' }, { k: 'h', t: 'By level' }];
      est.per.forEach(([r, n], b) => rows.push({ k: 'bar', label: `${names[b]}: ${r} of ${n} right`, frac: n ? r / n : 0 }));
      if (est.setLevel) rows.push({ k: 'p', t: `Your Learning level is now ${LEVELS[S.plan.level] ?? S.plan.name}, set from this result. You can change it any time in Settings.` });
      rows.push({ k: 'btn', id: 'jgo:map', label: 'Open the Journey map', style: 'primary' }, { k: 'btn', id: 'study', label: 'Study words at my level' });
      return { title: 'Placement', rows, primary: null };
    }
    case 'about':
      return { title: 'About', rows: [
        { k: 'h', t: 'Word Game' }, { k: 'p', t: `Version ${S.version}. Tap the matching word before it drifts away.` },
        { k: 'p', t: 'Learn English words by playing. Choose an Age group and a Learning level (Elementary to Graduate) and the words follow it, and so do the number of words on screen, the pace, the hints and the way questions are worded; then narrow them by kinds of words (how common they are, science, academic and everyday words, topic packs and more), choose how fast the words move from very slow practice to quick test pace, and play.' },
        { k: 'p', t: 'Study a set of words first if you like, then be quizzed on just those words. Words you miss come back for review on a schedule that helps them stick. Everything stays on your phone.' },
        { k: 'p', t: 'It is also an offline dictionary and thesaurus. Type any English word on the first screen ("Dictionary and thesaurus") to see its meaning, how to say it, examples and word family, or switch to Thesaurus for synonyms (closest first), opposites, broader and narrower words and partner words, with no connection needed.' },
        { k: 'p', t: 'Questions use real word relationships: synonyms, opposites, meanings, odd one out, analogy puzzles, spelling and listening. Meanings and relations come from WordNet; the word list is open and described on the credits page.' },
        { k: 'btn', id: 'go:howto', label: 'How to play' }, { k: 'btn', id: 'go:privacy', label: 'Privacy' }, { k: 'btn', id: 'go:credits', label: 'Word list credits' },
      ], primary: null };
    case 'howto':
      return { title: 'How to play', rows: [
        { k: 'h', t: 'Quick start' }, { k: 'p', t: 'Press Play. A question appears at the top and words (usually three) drift across the screen. Tap the right one before it leaves.' },
        { k: 'h', t: 'Scoring' }, { k: 'p', t: 'Each right answer scores 10 points. Right answers in a row build a combo that multiplies your points up to x4. A wrong tap, a miss or a hint breaks the combo.' },
        { k: 'h', t: 'Set up your words' }, { k: 'p', t: 'Pick an Age group and a Learning level in Settings (or in Words and pace). The level and the one below it decide the words; the Age group sets pace, text size and kid-safe words. Both also set the difficulty: younger or newer learners get fewer words on screen, slower words, free hints and plainer wording; Graduate gets more words, faster words and dearer hints. Settings can turn this off. With nothing chosen the standard level is Graduate. Words and pace also lets you choose kinds of words, topics, word length and question types.' },
        { k: 'h', t: 'Dictionary and thesaurus' }, { k: 'p', t: 'Thesaurus: in the panel, tap the Thesaurus tab (or the Synonyms button on a study list row, or Thesaurus on a flashcard or in the Word explorer). It lists words with the same meaning from closest to looser (the bars show how close), opposites grouped by kind, broader and narrower words, family, partner words and phrases, and a short note on which word fits (formal or casual, easier or more advanced) when the app has that information. Every word is a button that opens its own entry in the same panel, and the arrow goes back. You can add the word to your words or practise it with its closest synonyms. A word the thesaurus does not know says so. Child players only see vetted words.' }, { k: 'p', t: 'On the first screen, tap "Dictionary and thesaurus" and type a word. Suggestions appear as you type, and your last eight searches are kept on this phone for each player. The word opens in a panel with its meaning, how it sounds, examples, synonyms, opposites and family; tap one of them to look it up in the same panel (the arrow goes back). Tap the speaker to hear a word: nothing is ever spoken unless you tap a speaker. Done, Esc, a tap outside the panel or the back gesture closes it and returns you to the page you were on. Study lists, flashcards, the answer review after a session and reading passages open the same panel. It works offline and covers every word it has a meaning for, whatever your level.' },
        { k: 'h', t: 'Analogy puzzles' }, { k: 'p', t: 'More > Analogy puzzles: hot is to cold as big is to ... ? Four words drift by; tap the one that completes the second pair in the same way as the first (opposites, same meaning, a kind of, part of, a stronger word, a word made from another). Calm by default: no timer, no lives; Hint crosses out one wrong choice and names the link; a line after each answer explains it and opens the word in the dictionary and thesaurus.' },
        { k: 'h', t: 'Study first' }, { k: 'p', t: 'Study makes a set of 5 to 100 words with meanings, examples and flashcards. Then play, and the quiz uses only that set.' },
        { k: 'h', t: 'Speed round and more practice' }, { k: 'p', t: 'More > Speed round gives quick questions on words you already know. Learn more has the alphabet and letter games, English for daily life, tricky spellings, typing practice, finding a word from its meaning and ranking words by strength. Settings has a one-handed layout and an optional Guessed button.' },
        { k: 'h', t: 'Speed' }, { k: 'p', t: 'Word speed is the time a word takes to cross the screen: very slow for practice, about 20 seconds for steady test practice, a few seconds for a sprint. Classic starts gently and speeds up as you score.' },
        { k: 'h', t: 'Review' }, { k: 'p', t: 'Missed words return sooner; words you get right return after longer gaps. Review shows what is due today. Each side of a word (recognise, recall, spell, listen, use) is scheduled on its own.' },
        { k: 'h', t: 'Share and print' }, { k: 'p', t: 'More > Reports and printables makes a progress report, a certificate, a weekly sheet, a worksheet, a lesson plan or a learning log as a file you can print or share. More > Parent view shows every player and holds the parent PIN.' },
        { k: 'h', t: 'Hands-free and screen readers' }, { k: 'p', t: 'More > Voice commands lets you speak instead of tap, and Voice-first play reads a question aloud when you tap its speaker, then listens for the answer. A screen reader (VoiceOver, TalkBack) can read and use every main screen.' },
        { k: 'h', t: 'Keys' }, { k: 'p', t: 'On a keyboard, press 1 to 6 for the word from the top down, P to pause and H for a hint.' },
        { k: 'btn', id: 'go:rules', label: 'Full rules' },
      ], primary: null };
    case 'privacy':
      return { title: 'Privacy', rows: [
        { k: 'h', t: 'Your data stays with you' },
        { k: 'p', t: 'Word Game has no accounts. Your progress, settings and scores are stored only on this device. Ads, when shown, come from Google AdMob.' },
        { k: 'p', t: 'Nothing leaves the app unless you choose to export or share it: a backup, a spreadsheet, a PDF report, a worksheet, a lesson plan, a learning log or your journal. Reports and printables are made on this device from your own practice. They are files you control.' },
        { k: 'p', t: 'Your journal, your parent PIN (kept scrambled) and your per-word memory stay on this device. Voice commands use the speech recogniser built into your phone; the game does not keep or send what you say.' },
        { k: 'p', t: 'There is one optional exception. If you turn on Look up, tapping it shows a meaning from the Wiktionary website in a window inside the app, and can open a dictionary website of your choice in your browser; either way only the word you tapped is sent. It is never used during play, and it is off if you choose Never.' },
        { k: 'p', t: 'You can delete everything at any time from Your data.' },
        { k: 'btn', id: 'go:data', label: 'Your data' }, { k: 'btn', id: 'go:settings', label: 'Look-up settings' },
      ], primary: null };
    case 'credits': {
      const rows = [{ k: 'h', t: 'Word list credits' }];
      if (!S.credits) rows.push({ k: 'p', t: S.loadingData ? 'Loading...' : 'The credits text is not available in this view.' });
      else {
        // the notices are hard-wrapped in their sources; join each block into one paragraph (same words, same order)
        const blocks = S.credits.split(/\n\s*\n/).map((b) => b.split('\n').map((l) => l.trim()).filter(Boolean));
        for (const blk of blocks) {
          if (!blk.length || blk[0] === 'Word list credits') { if (blk.length > 1 && blk[0] === 'Word list credits') rows.push({ k: 'p', t: blk.slice(1).join(' ') }); continue; }
          if (blk.length >= 2 && /^=+$/.test(blk[1])) { rows.push({ k: 'sub', t: blk[0] }); if (blk.length > 2) rows.push({ k: 'pre', t: blk.slice(2).join(' ') }); }
          else rows.push({ k: 'pre', t: blk.join(' ') });
        }
      }
      return { title: 'Word list credits', rows, primary: null };
    }
    case 'notice': {
      const lbl = dictLabel(P.dict);
      return { title: 'Look it up', rows: [
        { k: 'h', t: `Look up "${S.pending}"` },
        { k: 'p', t: `This shows the word's meaning from the free Wiktionary dictionary in a window inside this app, and only the word is sent. A button there can open ${lbl} in your phone's browser, which leaves this app. The meaning shown elsewhere in this app comes first and works without any connection.` },
        { k: 'p', t: 'Warning: that website is not part of this app and is not checked by us. It can show adult or offensive words, pictures or advertising. The words in this app are chosen to be suitable for learners; a dictionary website may not be.', small: true },
        { k: 'btn', id: 'notice:open', label: 'Open it', style: 'primary' },
        { k: 'btn', id: 'notice:always', label: 'Open it, and do not ask again' },
        { k: 'btn', id: 'notice:cancel', label: 'Cancel' },
      ], primary: null };
    }
    case 'settings': {
      const dict = P.dict, R = P.remind;
      return { title: 'Settings', rows: [
        { k: 'h', t: 'Words and learner' },
        { k: 'p', t: `${S.plan.driver}.`, small: true },
        { k: 'chips', id: 'agegrp', label: 'Age group', opts: AGE_GROUPS.map((a) => chip(a.k, a.label, P.ageGroup === a.k)), hint: `${AGE_GROUPS.find((a) => a.k === P.ageGroup)?.blurb ?? 'Not chosen: treated as Adult'}. The Age group sets pace, text size, tone and kid-safe words. It never overrides a Learning level.` },
        { k: 'chips', id: 'lvl', label: 'Learning level', opts: [...LEVELS.map((l, i) => chip(i, l, S.plan.level === i)), chip('auto', 'Standard', S.plan.level === null)], hint: `Words come from this level and the one below it. ${S.plan.level === null ? 'Standard uses Graduate unless your Age group suggests something easier.' : 'Choose Standard to go back to the automatic choice.'}${S.plan.kid ? ' Kid-safe words only.' : ''}${S.widened ? ' Few words matched, so neighbouring easier levels were added.' : ''}` },
        { k: 'p', t: tierNote(S.plan), small: true },
        { k: 'chips', id: 'autodiff', label: 'Match difficulty to my level and age', opts: [chip('on', 'On', S.cfg.auto), chip('off', 'Off', !S.cfg.auto)], hint: 'On: your Learning level and Age group also set how many words appear, how fast they move, how much hints cost, word length and how questions are worded. Off: only your own settings in Words and pace count.' },
        { k: 'rule' },
        { k: 'h', t: 'Look and sound' },
        { k: 'chips', id: 'scheme', label: 'Colours', opts: SCHEMES.map((s, i) => chip(i, s.name, P.scheme === i)) },
        { k: 'chips', id: 'sound', label: 'Sound', opts: [chip('on', 'Sound on', P.sound), chip('off', 'Sound off', !P.sound)] },
        { k: 'chips', id: 'prtypo', label: 'Spelling tiles', opts: [chip('off', 'Exact spelling', !P.typoOk), chip('on', 'Accept a near miss (with a gentle correction)', Boolean(P.typoOk))] },
        { k: 'chips', id: 'pracc', label: 'Voice accent', opts: (S.accents ?? ['us']).map((a) => chip(a, { us: 'American', uk: 'British', au: 'Australian', in: 'Indian' }[a] ?? a, (P.accent ?? 'us') === a)) },
        { k: 'chips', id: 'voice', label: 'Voice speed (listening)', opts: [chip(0, 'Slow', P.voice === 0), chip(1, 'Normal', P.voice === 1), chip(2, 'Fast', P.voice === 2)] },
        { k: 'chips', id: 'motion', label: 'Effects', opts: [chip('full', 'Full effects', !P.calm), chip('calm', 'Calm (fewer effects)', P.calm)] },
        { k: 'rule' },
        { k: 'h', t: 'Accessibility' },
        { k: 'chips', id: 'acc', label: 'Reading and seeing', opts: [chip('font', 'Dyslexia-friendly text', P.font === 'dys'), chip('cb', 'Colour-blind safe colours', P.cb), chip('reduce', 'Reduce motion', P.reduce)], hint: 'Text size: use A− and A+ at the top of any reading screen, up to 300%.' },
        { k: 'chips', id: 'acc', label: 'Hands and ears', opts: [chip('lefty', 'Left-handed layout', P.lefty), chip('oneHand', 'One-handed layout', P.oneHand), chip('captions', 'Captions for sounds', P.captions), chip('deaf', 'No audio-only questions', P.deaf)] },
        { k: 'btn', id: 'go:voicecmd', label: 'Voice commands and voice-first play', sub: S.x?.voiceFirst?.on ? 'voice-first play is on' : 'speak instead of tapping' },
        { k: 'btn', id: 'go:parent', label: 'Parent view and PIN' },
        { k: 'p', t: 'One-handed layout (portrait phones) keeps the words you tap in the lower part of the screen, within a thumb\'s reach, and gives the question more room above. Left-handed mirrors the buttons along the bottom.', small: true },
        { k: 'chips', id: 'acc', label: 'Memory help', opts: [chip('rateEach', P.rateEach ? 'Ask how sure I was: on' : 'Ask how sure I was after each answer', P.rateEach)], hint: 'After an answer a small button appears for a moment. Tap it if a right answer was a guess (the word does not move up its box) or if you were sure about a wrong one (it comes back tomorrow). Ignoring it changes nothing.' },
        { k: 'chips', id: 'acc', label: 'Later-life calm mode', opts: [chip('senior', P.senior ? 'On: no clock, no lives, large text' : 'Off', P.senior)], hint: 'Gentle pace, no timers, no lives, softer sound and wording. Wellness wording only: this is for enjoyment, not treatment.' },
        { k: 'rule' },
        { k: 'h', t: 'Learning and exploring' },
        { k: 'chips', id: 'acc', label: 'Keep learning light', opts: [chip('autoCollect', P.autoCollect ? 'Collect missed words automatically: on' : 'Collect missed words automatically', Boolean(P.autoCollect)), chip('alsoChip', P.alsoChip ? 'Suggest a related word after answers: on' : 'Suggest a related word after answers', Boolean(P.alsoChip))], hint: 'Off by default: nothing is saved unless you tap Keep. When on, words you miss go quietly into My words and the daily review, with no message. The related-word hint shows only in calm, unhurried rounds.' },
        { k: 'rule' },
        { k: 'h', t: 'Daily goal and reminder' },
        { k: 'step', id: 'goal', label: 'Answers per day', value: String(P.goal), decOff: P.goal <= 10, incOff: P.goal >= 100 },
        { k: 'chips', id: 'brk', label: 'Break reminder after', opts: [0, 15, 30, 45, 60].map((m) => chip(m, m ? `${m} min` : 'Off', P.breakMin === m)), hint: 'A gentle note on the title and review screens once you have played this long today.' },
        { k: 'chips', id: 'lim', label: 'Daily play-time limit (grown-ups)', opts: [0, 15, 30, 45, 60].map((m) => chip(m, m ? `${m} min` : 'None', P.limitMin === m)), hint: S.child ? 'Play stops for the day at this time.' : 'A child player stops for the day at this time; adults only get a reminder.' },
        { k: 'btn', id: 'go:bedtime', label: 'Bedtime mode', sub: P.bed?.on ? `on, stops after ${P.bed.mins ? P.bed.mins + ' min' : 'no limit'}` : 'calm look, quiet sounds, a gentle stop' },
        { k: 'chips', id: 'rem', label: 'Daily reminder', opts: [chip('on', R.on ? 'Reminder on' : 'Reminder off', R.on), ...[8, 12, 18, 20].map((h) => chip(`h${h}`, `${h}:00`, R.hour === h))], hint: S.msg || 'The reminder is set on this phone only. The first time you turn it on, the phone asks for permission to show notifications. Nothing is sent anywhere.' },
        { k: 'rule' },
        { k: 'h', t: 'Dictionary look-up' },
        { k: 'p', t: 'Show a Look up button on word lists and review. It opens the dictionary you choose in your browser and sends only the word. Never shown during play or in a child profile. The meaning in this app always comes first. The first time, you see a warning that the website is outside this app and may show adult or offensive content.', small: true },
        { k: 'chips', id: 'dmode', label: 'Look-up button', opts: DICT_MODES.map((m) => chip(m.v, m.label, dict.mode === m.v)) },
        { k: 'chips', id: 'dict', label: 'Dictionary', opts: [...DICTS.map((d) => chip(d.k, d.label, dict.choice === d.k)), chip('custom', 'My own address', dict.choice === 'custom')], hint: dict.choice === 'custom' ? (dict.custom ? `Address: ${dict.custom}` : 'Use "Enter address" and put {word} where the word goes.') : '' },
        ...(dict.choice === 'custom' ? [{ k: 'btn', id: 'dcustom', label: 'Enter address', disabled: !S.canAsk }] : []),
      ], primary: null };
    }
    case 'data': {
      return { title: 'Your data', rows: [
        { k: 'h', t: 'Export' },
        { k: 'p', t: 'Everything is stored on this device only. Export makes a file or text you can keep or move to another phone. Nothing is sent anywhere by the app.', small: true },
        { k: 'btn', id: 'exp:json', label: 'Export full backup', sub: 'JSON: settings, progress, ways of knowing, sessions, study set, journal' },
        { k: 'btn', id: 'go:reports', label: 'Reports and printables', sub: 'PDF report, certificate, sheets, lesson plan, learning log' },
        { k: 'btn2', a: { id: 'exp:words', label: 'Words (CSV)' }, b: { id: 'exp:sessions', label: 'Sessions (CSV)' } },
        { k: 'h', t: 'Import' },
        { k: 'p', t: 'Restore a backup made by this app. It replaces your progress with the backup.', small: true },
        { k: 'btn', id: 'imp', label: 'Import a backup' },
        { k: 'btn', id: 'exp:flags', label: `Export flagged words (${S.prefs.flags.length})`, sub: 'words you flagged as wrong or odd, as a text file', disabled: !S.prefs.flags.length },
        ...(S.msg ? [{ k: 'p', t: S.msg }] : []),
        { k: 'rule' },
        { k: 'h', t: 'Delete everything' },
        { k: 'p', t: 'Removes your progress, sessions, study set and settings from this device.', small: true },
        { k: 'btn', id: S.confirmDel ? 'del:yes' : 'del:ask', label: S.confirmDel ? 'Tap again to delete everything' : 'Delete everything', style: S.confirmDel ? 'primary' : undefined },
        ...(S.confirmDel ? [{ k: 'btn', id: 'del:no', label: 'Keep my data' }] : []),
      ], primary: null };
    }
    case 'progress': {
      const sm = summary(S.records, (w) => facets.stageCtx(S.facets, S.records, w)), st = sm.stages;
      const goal = Math.min(1, S.todayN / Math.max(1, P.goal));
      const rows = [
        { k: 'h', t: 'Your progress' },
        { k: 'bar', label: `Today: ${S.todayN} of ${P.goal} answers`, frac: goal, text: S.streakN ? `${plural(S.streakN, 'day')} in a row` : 'Answer at least 5 in a session to start a streak' },
        { k: 'kv', l: 'Words met', r: String(sm.met) }, { k: 'kv', l: 'Words explored', r: String((P.explored ?? []).length) }, { k: 'kv', l: 'Words you reliably know', r: String(st.familiar + st.mastered + st.maintained) },
        { k: 'kv', l: 'Answers right', r: sm.right + sm.wrong ? `${Math.round(sm.accuracy * 100)}% of ${sm.right + sm.wrong}` : 'none yet' },
        { k: 'kv', l: 'Average answer time', r: sm.avgMs ? `${(sm.avgMs / 1000).toFixed(1)} s` : 'none yet' },
        { k: 'kv', l: 'Due for review today', r: String(S.dueN) },
        { k: 'rule' }, { k: 'h', t: 'This week' },
        { k: 'kv', l: 'Days played', r: `${S.week.days} of 7` }, { k: 'kv', l: 'Answers', r: S.week.n ? `${S.week.right} right of ${S.week.n}` : 'none yet' }, { k: 'kv', l: 'New words learned', r: String(S.week.nw) },
        { k: 'p', t: S.week.n === 0 ? 'A short session today starts your week.' : S.week.days >= 5 ? 'A great week. Keep the habit going.' : S.week.n && S.week.right / S.week.n < 0.6 ? 'Try Relaxed pace or a smaller study set to build confidence.' : 'Steady progress. A little each day works best.', small: true },
        { k: 'kv', l: 'Journey stars', r: String(jny.totalStars(S.journey)) },
        { k: 'kv', l: 'Estimated words you know', r: P.vsize ? `about ${P.vsize.total} (${P.vsize.lo} to ${P.vsize.hi})` : S.est ? `about ${S.est.total} (${S.est.lo} to ${S.est.hi})` : 'take the placement check' },
        { k: 'btn2', a: { id: 'go:vtest', label: 'Vocabulary size test' }, b: { id: 'go:knowledge', label: 'Word knowledge' } },
        { k: 'btn2', a: { id: 'go:achievements', label: 'Badges' }, b: { id: 'go:place', label: 'Placement check' } },
        { k: 'heat', label: 'Answers per day, last 12 weeks', cells: S.heat, foot: 'Darker squares are busier days. Newest day is bottom right.' },
        ...(S.slips.length ? [{ k: 'h', t: 'Where you slip' }, ...S.slips.map((x) => ({ k: 'bar', label: `${x.label}: ${Math.round(x.acc * 100)}% right of ${x.n}`, frac: x.acc, text: x.advice }))] : []),
        { k: 'rule' }, { k: 'h', t: 'Mastery stages' },
        ...STAGES.filter((s) => s !== 'new').map((s) => ({ k: 'bar', label: `${s[0].toUpperCase()}${s.slice(1)}: ${st[s]}`, frac: sm.met ? st[s] / sm.met : 0, text: STAGE_BLURB[s] })),
        { k: 'rule' }, { k: 'h', t: 'By level' },
        ...BAND_LABELS.map((l, i) => ({ k: 'bar', label: `${l} (about ${CEFR[i]}): ${S.bandKnown[i]} of ${S.bandSize[i]} known`, frac: S.bandSize[i] ? S.bandKnown[i] / S.bandSize[i] : 0 })),
        { k: 'rule' }, { k: 'h', t: 'By kind of vocabulary' }, { k: 'p', t: 'Three tiers, estimated from how common a word is and its science and academic tags: everyday words, general academic words and domain-specific words.', small: true },
        ...TIERS3.map((t) => ({ k: 'bar', label: `${t.name}: ${S.tierKnown[t.id] ?? 0} of ${S.tierSize[t.id] ?? 0} known`, frac: S.tierSize[t.id] ? (S.tierKnown[t.id] ?? 0) / S.tierSize[t.id] : 0, text: t.blurb })),
        { k: 'rule' }, { k: 'h', t: 'By topic' },
        ...TOPICS.map((t) => ({ k: 'bar', label: `${t.label}: ${S.topicKnown[t.k] ?? 0} of ${S.topicSize[t.k] ?? 0} known`, frac: S.topicSize[t.k] ? (S.topicKnown[t.k] ?? 0) / S.topicSize[t.k] : 0 })),
      ];
      rows.push({ k: 'rule' }, { k: 'h', t: 'Recent sessions' });
      if (!S.sessions.length) rows.push({ k: 'p', t: 'No sessions yet.' });
      for (const s of S.sessions.slice(-8).reverse()) rows.push({ k: 'kv', l: `Day ${s.day}  ·  ${s.preset}`, r: `${s.right}/${s.n} right, score ${s.score}` });
      if (S.mixups.length) {
        rows.push({ k: 'rule' }, { k: 'h', t: 'Words you mix up' }, { k: 'p', t: 'Pairs where you tapped one word when the other was right. The most frequent come first.', small: true });
        for (const m of S.mixups) rows.push({ k: 'kv', l: `${m.a}  and  ${m.b}`, r: `${m.n} time${m.n === 1 ? '' : 's'}` });
        rows.push({ k: 'btn', id: 'practisemix', label: 'Practise these words together' });
      }
      if (S.weak.length) {
        rows.push({ k: 'rule' }, { k: 'h', t: 'Words to practise' }, { k: 'btn', id: 'practiseweak', label: 'Practise these words', style: 'primary' }, ...wordRows(S, S.weak.slice(0, 15), { known: false }));
      }
      if (S.leeches.length) rows.push({ k: 'p', t: `Stubborn words (missed many times): ${S.leeches.slice(0, 12).join(', ')}. Try studying them as flashcards.`, small: true });
      return { title: 'Progress', rows, primary: null };
    }
    default: return screenRows7(name, S) ?? (PRACTICE_SCENES.includes(name) ? practiceRows(name, S.pr, S) : { title: '', rows: [], primary: null });
  }
}
export const FORM_SCENES = new Set([...PRACTICE_SCENES, ...SCENES7, 'sayit' ,'explore', 'read', 'reading', 'sets', 'lists', 'mywords', 'playchoose', 'analogy', 'textwords', 'newlist', 'listview', 'mock', 'mockresult', 'write', 'stickers', 'compare', 'why', 'whatsnew', 'setup', 'studylist', 'more', 'about', 'howto', 'privacy', 'credits', 'notice', 'settings', 'data', 'progress', 'age', 'firstlevel', 'gate', 'profiles', 'achievements', 'stageinfo', 'placeresult']);
export { all, isLeech };
