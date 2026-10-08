// What the player configures (the conscious "setup" layer) and the presets that fill it in. Pure data + small helpers.
export const SPEEDS = [2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 90];   // seconds a word needs to cross the screen
export const SESSION_SECS = [60, 90, 120, 180, 300, 600, 900];
export const QUESTION_COUNTS = [10, 20, 30, 50, 100];
export const SET_SIZES = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100];
export const LIVES = [0, 3, 5];
export const QTYPES = [
  { k: 'synonym', label: 'Synonym', blurb: 'Tap the word that means the same' },
  { k: 'antonym', label: 'Antonym', blurb: 'Tap the opposite' },
  { k: 'definition', label: 'Meaning', blurb: 'Match a meaning to its word' },
  { k: 'odd', label: 'Odd one out', blurb: 'Two words match, tap the stranger' },
  { k: 'spelling', label: 'Spelling', blurb: 'Pick the right spelling' },
  { k: 'listening', label: 'Listening', blurb: 'Hear a word, tap it' },
  { k: 'category', label: 'Kind of', blurb: 'Which is a kind of this category' },
  { k: 'part', label: 'Part of', blurb: 'Which is a part of this thing' },
  { k: 'homophone', label: 'Sounds like', blurb: 'Same sound, different spelling' },
  { k: 'rhyme', label: 'Rhymes', blurb: 'Tap the word that rhymes' },
  { k: 'anagram', label: 'Unscramble', blurb: 'Make a word from scrambled letters' },
  { k: 'family', label: 'Word family', blurb: 'Words built from the same base' },
  { k: 'collocation', label: 'Goes with', blurb: 'Words that belong together' },
  { k: 'phrase', label: 'Finish the phrase', blurb: 'Fill the gap in a common phrase' },
  { k: 'confusable', label: 'Easily confused', blurb: 'Pairs like affect and effect' },
  { k: 'root', label: 'Word parts', blurb: 'Roots and their meanings' },
  { k: 'variant', label: 'UK spelling', blurb: 'US word, British spelling' },
];
export const PRESETS = {
  classic: { label: 'Classic', blurb: 'The original drift: words speed up as you score', secs: 0, endBy: 'time', secsIdx: 1, qIdx: 1, lives: 0 },
  relaxed: { label: 'Relaxed', blurb: 'Slow words, no clock, 20 questions', secs: 40, endBy: 'questions', secsIdx: 1, qIdx: 1, lives: 0 },
  practice: { label: 'Practice', blurb: 'Comfortable pace, 3 minutes', secs: 15, endBy: 'time', secsIdx: 3, qIdx: 1, lives: 0 },
  exam: { label: 'Exam pace', blurb: '20 seconds a question, 20 questions, no hints', secs: 20, endBy: 'questions', secsIdx: 1, qIdx: 1, lives: 0, hints: false },
  sprint: { label: 'Sprint', blurb: 'Fast words, one minute', secs: 4, endBy: 'time', secsIdx: 0, qIdx: 1, lives: 3 },
};
export const PRESET_ORDER = ['classic', 'relaxed', 'practice', 'exam', 'sprint'];

export const DEFAULT_CFG = {
  preset: 'classic',
  contexts: [2],            // 0..5 bands, or 'first'
  attrs: [], topics: [], combine: 'any',
  minLen: 3, maxLen: 15,
  setSize: 20, source: 'whole',          // 'whole' | 'study' | 'due' | 'weak'
  qtypes: ['synonym', 'antonym'],
  secs: 0, endBy: 'time', secsIdx: 1, qIdx: 1, lives: 0, hints: true,
  skipKnown: false,
};

const clampIdx = (v, arr, d) => (Number.isInteger(v) && v >= 0 && v < arr.length ? v : d);
export function normalizeCfg(c) {
  const d = DEFAULT_CFG, o = { ...d, ...(c ?? {}) };
  o.contexts = (Array.isArray(o.contexts) ? o.contexts : d.contexts).filter((x) => x === 'first' || (Number.isInteger(x) && x >= 0 && x <= 5));
  o.attrs = (Array.isArray(o.attrs) ? o.attrs : []).filter((x) => typeof x === 'string');
  o.topics = (Array.isArray(o.topics) ? o.topics : []).filter((x) => typeof x === 'string');
  o.qtypes = (Array.isArray(o.qtypes) ? o.qtypes : d.qtypes).filter((k) => QTYPES.some((q) => q.k === k));
  if (!o.qtypes.length) o.qtypes = ['synonym'];
  o.combine = o.combine === 'narrow' ? 'narrow' : 'any';
  o.source = ['whole', 'study', 'due', 'weak'].includes(o.source) ? o.source : 'whole';
  o.endBy = o.endBy === 'questions' ? 'questions' : 'time';
  o.secsIdx = clampIdx(o.secsIdx, SESSION_SECS, 1);
  o.qIdx = clampIdx(o.qIdx, QUESTION_COUNTS, 1);
  o.secs = o.secs === 0 ? 0 : SPEEDS.includes(o.secs) ? o.secs : 15;
  o.lives = LIVES.includes(o.lives) ? o.lives : 0;
  o.setSize = SET_SIZES.includes(o.setSize) ? o.setSize : 20;
  o.minLen = Math.max(3, Math.min(15, Number(o.minLen) || 3));
  o.maxLen = Math.max(o.minLen, Math.min(15, Number(o.maxLen) || 15));
  o.hints = o.hints !== false;
  o.skipKnown = Boolean(o.skipKnown);
  if (!PRESETS[o.preset] && o.preset !== 'custom') o.preset = 'custom';
  return o;
}
export function applyPreset(cfg, key) {
  const p = PRESETS[key]; if (!p) return cfg;
  return { ...cfg, preset: key, secs: p.secs, endBy: p.endBy, secsIdx: p.secsIdx, qIdx: p.qIdx, lives: p.lives, hints: p.hints !== false };
}
export const fmtSecs = (n) => (n >= 60 ? `${Math.floor(n / 60)} min${n % 60 ? ` ${n % 60} s` : ''}` : `${n} s`);
export const speedLabel = (secs) => (secs === 0 ? 'Classic: speeds up as you score' : `${secs} s to cross${secs >= 30 ? ' (very slow practice)' : secs >= 15 ? ' (study pace)' : secs >= 8 ? ' (steady)' : secs >= 4 ? ' (fast)' : ' (very fast)'}`);
export const sessionLabel = (cfg) => (cfg.endBy === 'questions' ? `${QUESTION_COUNTS[cfg.qIdx]} questions` : fmtSecs(SESSION_SECS[cfg.secsIdx]));
export const sessionSeconds = (cfg) => SESSION_SECS[cfg.secsIdx];
export const questionCount = (cfg) => QUESTION_COUNTS[cfg.qIdx];
// A short key that names a pace + session shape; best scores are kept per key so different set-ups are never compared.
export const paceKey = (cfg) => `${cfg.secs}|${cfg.endBy}|${cfg.endBy === 'questions' ? cfg.qIdx : cfg.secsIdx}|${cfg.lives}`;
