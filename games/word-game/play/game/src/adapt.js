// Adaptive vocabulary: ONE place that decides which words the hub uses (single source of truth).
// Inputs: the player's Learning level (prefs.level, 0..4 or null) and Age group (prefs.ageGroup or null), and whether the profile is a child profile.
// Rules:
//   Learning level chosen    -> that level and the one below decide the words (Elementary also takes the first words).
//   only Age group chosen    -> words come from the group (child/beginner: first words + Elementary, teen/later life: Middle + High school).
//   nothing chosen on a child profile -> the Child group (first words + Elementary)
//   nothing chosen, or Adult -> DEFAULT_LEVEL (Graduate: Undergraduate + Graduate words).
// The age group also decides presentation and safety (pace, text size, calm mode, kid-safe words); it never overrides an explicit level.
import { BAND_LABELS, select, ATTR } from './lexicon.js';

export const DEFAULT_LEVEL = 4;                         // Graduate: used when the player has chosen nothing (owner decision 2026-10-09)
export const LEVELS = BAND_LABELS.slice(0, 5);          // Elementary .. Graduate (Professional is not a learning level)
export const AGE_GROUPS = [
  { k: 'child', label: 'Child', blurb: 'kid-safe words only, gentle pace, larger text', window: ['first', 0] },
  { k: 'teen', label: 'Teen', blurb: 'Middle and High school words', window: [1, 2] },
  { k: 'adult', label: 'Adult', blurb: 'the default word level', window: null },
  { k: 'later', label: 'Later life', blurb: 'calm pace, no clock, larger text', window: [1, 2] },
  { k: 'beginner', label: 'Adult beginner', blurb: 'first words and Elementary, relaxed pace', window: ['first', 0] },
];
export const ageLabel = (k) => AGE_GROUPS.find((a) => a.k === k)?.label ?? '';
export const validLevel = (v) => (Number.isInteger(v) && v >= 0 && v <= 4 ? v : null);
export const validAge = (v) => (AGE_GROUPS.some((a) => a.k === v) ? v : null);
export const levelWindow = (l) => (l === 0 ? ['first', 0] : [l - 1, l]);
const MIN_POOL = 40;                                    // fewer matching words than this: widen to the neighbouring easier level

export function plan(prefs, childProfile = false) {
  const level = validLevel(prefs?.level), age = validAge(prefs?.ageGroup) ?? (childProfile && validLevel(prefs?.level) === null ? 'child' : null), ageWin = age ? AGE_GROUPS.find((a) => a.k === age).window : null;
  let contexts, source, name;
  if (level !== null) { contexts = levelWindow(level); source = 'level'; name = LEVELS[level]; }
  else if (ageWin) { contexts = ageWin.slice(); source = 'age'; name = ageWin.includes('first') ? 'First words and Elementary' : ageWin.map((b) => LEVELS[b]).join(' and '); }
  else { contexts = levelWindow(DEFAULT_LEVEL); source = 'default'; name = LEVELS[DEFAULT_LEVEL]; }
  const top = contexts.filter((c) => c !== 'first').pop() ?? 0;
  const driver = source === 'level' ? `Your Learning level: ${name}` : source === 'age' ? `Your Age group (${ageLabel(age)}): ${name}` : `Standard level: ${name} (choose a Learning level or Age group to change it)`;
  const kid = Boolean(childProfile || age === 'child');
  return { level, age, source, contexts, top, name, kid, driver, chip: `Level: ${name}`, tier: tierOf(source, top, age, kid) };
}

// ---- Difficulty tiers: the non-vocabulary side of the same plan (answer choices, pace, hints, word length, wording). ----
// Nothing chosen (or Adult alone) = the standard tier, so players who never picked a level see no change in how the game feels.
// A Learning level or a younger / older Age group moves the tier; the player's own Words-and-pace choices are shifted, never replaced.
//   gentle   (Elementary, Child, Adult beginner): one fewer choice, slower words, free hints, no lives, short words, plain wording
//   easy     (Middle school, Teen)               : slightly slower, cheap hints, plain wording
//   standard (High school, Undergraduate, Adult, Later life)
//   stretch  (Graduate chosen)                   : one more choice, faster words, dearer hints, words of 4+ letters
export const TIERS = [
  { id: 'gentle', name: 'Gentle', lanes: -1, pace: 1.35, hint: 0, lives: false, maxLen: 9, minLen: 0, plain: true, blurb: 'one fewer word on screen, slower words, free hints, no lives, plain question wording' },
  { id: 'easy', name: 'Easy', lanes: 0, pace: 1.15, hint: 3, lives: true, maxLen: 0, minLen: 0, plain: true, blurb: 'slightly slower words, cheap hints, plain question wording' },
  { id: 'standard', name: 'Standard', lanes: 0, pace: 1, hint: 5, lives: true, maxLen: 0, minLen: 0, plain: false, blurb: 'the normal pace, hints and wording' },
  { id: 'stretch', name: 'Stretch', lanes: 1, pace: 0.85, hint: 10, lives: true, maxLen: 0, minLen: 4, plain: false, blurb: 'one more word on screen, faster words, dearer hints, words of four letters or more' },
];
function tierOf(source, top, age, kid) {
  if (source === 'default') return TIERS[2];
  let i = top === 0 ? 0 : top === 1 ? 1 : top === 4 ? 3 : 2;
  if (source === 'age' && age === 'teen') i = 1;
  if ((age === 'child' || age === 'beginner' || age === 'later' || kid) && i === 3) i = 2;       // a young, new, older or child-profile player is never stretched
  return { ...TIERS[i], pace: TIERS[i].pace * (age === 'later' ? 1.25 : 1) };
}
export const tierNote = (p) => `Difficulty: ${p.tier.name} (${p.tier.blurb}${p.age === 'later' ? '; extra time to answer' : ''}).`;
// Plain wording for the question line (the short caps heading over the words). Jargon becomes everyday English.
const PLAIN = { analogy: 'FIND THE MATCHING PAIR', synonym: 'SAME MEANING AS', antonym: 'OPPOSITE OF', anagram: 'MAKE A WORD FROM', collocation: 'GOES WITH', homophone: 'SOUNDS THE SAME AS', palindrome: 'SAME BACKWARDS', syllables: 'HOW MANY BEATS?', stress: 'WHICH PART IS LOUDEST?', cloze: 'FILL THE GAP', inflect: 'THE RIGHT FORM OF', root: 'WORD WITH A PART MEANING', variant: 'THE UK SPELLING OF', family: 'FROM THE SAME FAMILY AS', odd: 'WHICH ONE DOES NOT FIT?', build: 'JOIN THE PARTS', confusable: 'WHICH WORD MEANS', sense: 'WHICH WORD CAN ALSO MEAN', usage: 'WHICH SENTENCE IS RIGHT?', hearmeaning: 'LISTEN, THEN TAP THE MEANING', hearspell: 'LISTEN, THEN TAP THE SPELLING', sorttopic: 'WHAT GROUP IS IT IN?', sortpos: 'WHAT KIND OF WORD?', general: 'WHICH IS THE BIGGEST IDEA?' };
export const plainLabel = (kind, label, cfg) => (cfg?.plain && PLAIN[kind]) || label;
// Reading level of a passage / early-reading material for this player: big text for young or new readers
export const bigText = (p, passageLevel = 9) => p.tier.id === 'gentle' || p.age === 'child' || p.age === 'beginner' || passageLevel <= 1;
// Which passage / set level to point the player at, and how close an item of that level (a band, may be fractional) is
export const fitScore = (p, band) => Math.abs(band - (p.source === 'default' ? DEFAULT_LEVEL - 0.5 : p.top - (p.top > 0 ? 0.5 : 0)));
export const fits = (p, band) => fitScore(p, band) <= 0.75;
// Journey: the world that matches the player's words (worlds 2..7 are bands 0..5; first words = world 1)
export const journeyWorld = (p) => (p.source === 'default' ? null : p.contexts.includes('first') && p.level === null ? 1 : p.top + 2);
// Early-reading decks are authored for bands 0-1: lead with them for young / new readers, tuck them away for adults
export const earlyFirst = (p) => p.tier.id === 'gentle' || p.age === 'child' || p.age === 'beginner';
export const earlyLast = (p) => p.source !== 'default' && !earlyFirst(p) && (p.top >= 3 || p.age === 'adult');
// A placement result sets the Learning level only when none was chosen (highest level answered mostly right; none = Elementary)
export const levelFromPlacement = (per) => { let top = -1; per.forEach(([r, n], b) => { if (n && r / n >= 0.6) top = b; }); return Math.max(0, Math.min(4, top)); };
// The text-size step a chosen Elementary level starts at (an Age group sets its own, see presentation)
export const levelTextIdx = (level) => (level === 0 ? 1 : 0);

// the config the game really uses: the plan decides levels and safety; kinds, topics and the player's own length/pace choices stay theirs,
// shifted by the difficulty tier unless the player turned "Match difficulty to my level and age" off.
export function effCfg(cfg, p) {
  const o = { ...cfg, contexts: p.contexts, kid: Boolean(cfg.kid || p.kid), pace: 1, hintCost: 5, plain: false, tier: 'standard' };
  if (cfg.auto === false) return o;
  const t = p.tier;
  o.tier = t.id; o.pace = t.pace; o.hintCost = t.hint; o.plain = t.plain;
  if (t.lanes) o.lanes = Math.max(2, Math.min(6, (cfg.lanes ?? 3) + t.lanes));
  if (!t.lives) o.lives = 0;
  if (t.maxLen) o.maxLen = Math.max(o.minLen, Math.min(cfg.maxLen, t.maxLen));
  if (t.minLen) o.minLen = Math.min(o.maxLen, Math.max(cfg.minLen, t.minLen));
  if (o.secs > 0) o.secs = Math.round(o.secs * t.pace * 10) / 10;
  return o;
}
export const kidOk = (e) => Boolean(e.attrs & ATTR.KID) || Boolean(e.custom);

// Words for the plan. Too few matches (for example a child at Graduate level, where kid-safe words are rare) widens to the easier neighbours.
export function pick(cfg, p, min = MIN_POOL) {
  let ctx = effCfg(cfg, p).contexts.slice(), c = { ...effCfg(cfg, p), contexts: ctx }, pool = select(c), widened = false;
  for (let i = 0; i < 5 && pool.length < min; i += 1) {
    const nums = ctx.filter((x) => x !== 'first'), lo = nums.length ? Math.min(...nums) : 0, hi = nums.length ? Math.max(...nums) : 0;
    if (lo > 0) ctx = [lo - 1, ...ctx]; else if (!ctx.includes('first')) ctx = ['first', ...ctx]; else if (hi < 5) ctx = [...ctx, hi + 1]; else break;
    c = { ...c, contexts: ctx }; pool = select(c); widened = true;
  }
  return { pool, widened, contexts: ctx };
}
// 32-bit key for "which level window", mixed into the daily seed so the daily set is stable per day + level
export const windowKey = (p) => { let h = 17; for (const c of p.contexts) h = (Math.imul(h, 31) + (c === 'first' ? 9 : c + 1)) >>> 0; return h + (p.kid ? 7 : 0); };

// What an Age group changes about presentation (never the words). Returns cfg/pref patches applied once, when the group is chosen.
export function presentation(age) {
  switch (age) {
    case 'child': return { cfg: { preset: 'relaxed', secs: 20, lives: 0, hints: true }, prefs: { senior: false, calm: false }, textIdx: 1 };
    case 'beginner': return { cfg: { preset: 'relaxed', secs: 30, lives: 0, hints: true }, prefs: { senior: false, calm: false }, textIdx: 1 };
    case 'later': return { cfg: {}, prefs: { senior: true, calm: true }, textIdx: 2 };
    case 'teen': case 'adult': return { cfg: {}, prefs: {}, textIdx: 0 };
    default: return null;
  }
}

// ---- items that carry their own level ("lv" 0-4) and child-safety ("k") flags: authored decks, packs --------------------------------------
// The window of item levels that suit a plan: a level or age group keeps items at or just below its top level; nothing chosen uses the default level.
export function itemWindow(p) { const hi = p.source === 'default' ? DEFAULT_LEVEL : Math.max(0, p.top), lo = p.kid ? 0 : hi - 2; return [Math.max(0, lo), p.kid ? Math.min(hi, 1) : hi]; }
// Keep the items that fit; widen downwards (easier) when too few remain; a child plan only ever sees k = 1 items.
export function fitItems(items, p, min = 8) {
  const pool = p.kid ? items.filter((x) => x.k === 1) : items;
  let [lo, hi] = itemWindow(p), out = pool.filter((x) => (x.lv ?? 2) >= lo && (x.lv ?? 2) <= hi);
  for (let i = 0; i < 5 && out.length < min && lo > 0; i += 1) { lo -= 1; out = pool.filter((x) => (x.lv ?? 2) >= lo && (x.lv ?? 2) <= hi); }
  if (out.length < min && !p.kid) out = pool.filter((x) => (x.lv ?? 2) <= hi + 1);
  return out;
}
// The words of a pack for a plan: kid-safe words only for a child plan, inside the level window (bands, 'first' = first words), widened until there are enough.
export function fitPackWords(words, p, getEntry, min = 25) {
  const es = words.map(getEntry).filter(Boolean).filter((e) => !p.kid || e.attrs & ATTR.KID || e.custom);
  let ctx = p.contexts.slice(), inCtx = (e) => ctx.some((c) => (c === 'first' ? (e.attrs & ATTR.FIRST) !== 0 : e.band === c)), out = es.filter(inCtx);
  for (let i = 0; i < 5 && out.length < min; i += 1) {
    const nums = ctx.filter((x) => x !== 'first'), lo = nums.length ? Math.min(...nums) : 0, hi = nums.length ? Math.max(...nums) : 0;
    if (lo > 0) ctx = [lo - 1, ...ctx]; else if (!ctx.includes('first')) ctx = ['first', ...ctx]; else if (hi < 5) ctx = [...ctx, hi + 1]; else break;
    out = es.filter(inCtx);
  }
  return out.length ? out : es;
}

export const kidOkEntry = (e) => Boolean(e.attrs & ATTR.KID) || Boolean(e.custom);
