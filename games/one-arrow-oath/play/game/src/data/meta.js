// Everything that persists between runs: archers, Oaths (a difficulty ladder of extra vows), the
// Tuner's Book, best Legends and which coach marks have been shown. Pure data and pure functions.
import { STARTING_QUIVER } from './cards.js';

export const ARCHERS = {
  keeper: {
    name: 'The Keeper',
    blurb: 'A balanced quiver: a few named Arrows, honest Techniques, two Wards.',
    unlock: null,
    quiver: STARTING_QUIVER,
  },
  warden: {
    name: 'The Warden',
    blurb: 'Guard first. Fewer Arrows, and a Technique that hits as hard as the shield you hold.',
    unlock: 'Clear the second day.',
    quiver: ['reed', 'reed', 'reed', 'brace', 'brace', 'brace', 'brace', 'breath', 'ward_stone', 'ward_tide', 'first_promise', 'ashwake', 'bank_the_fire', 'braced_shot'],
  },
  duellist: {
    name: 'The Duellist',
    blurb: 'Read and answer. A Ward for almost every element, and one that answers any.',
    unlock: 'Clear the third day.',
    quiver: ['reed', 'reed', 'reed', 'brace', 'brace', 'breath', 'ward_tide', 'ward_ember', 'ward_stone', 'ward_gale', 'ward_mastery', 'first_promise', 'ashwake', 'grayfeather', 'riverglass', 'old_faithful'],
  },
};
export const ARCHER_IDS = Object.keys(ARCHERS);

// Each Oath adds one vow to all the ones before it. Oath 0 has none.
export const OATHS = [
  { name: 'No extra vow', text: 'The road as it was sworn.' },
  { name: 'Empty Purse', text: 'You begin with no Marks.' },
  { name: 'Thin Quiver', text: 'You begin with one fewer Arrow.' },
  { name: 'Weary Camps', text: 'Camps heal 20% instead of 30%.' },
  { name: 'A Debt at Dawn', text: 'You begin with a Debt already taken.' },
  { name: 'Sharper Foes', text: 'Every enemy attack is 10% stronger.' },
  { name: 'Sturdier Foes', text: 'Every enemy has 10% more health.' },
  { name: 'Fewer Choices', text: 'Rewards offer two cards, not three.' },
  { name: 'Fewer Reeds', text: 'You begin with two fewer Reed Shafts.' },
  { name: 'Iron Oath', text: 'Your maximum Resolve is 40.' },
  { name: 'The Long Road', text: 'Hard Fights have 25% more health.' },
];
export const MAX_OATH = OATHS.length - 1;

export const defaultMeta = () => ({
  v: 1,
  book: {},
  oaths: 1, // Oaths 0 .. oaths-1 are open
  archers: ['keeper'],
  best: {},
  coach: { read: false, answer: false, spent: false },
  reduceMotion: false,
  runs: 0,
  wins: 0,
});

// Merge whatever was saved into the current shape, so old saves keep working as fields are added.
export function loadMeta(saved) {
  const base = defaultMeta();
  if (!saved || typeof saved !== 'object') return base;
  return { ...base, ...saved, coach: { ...base.coach, ...(saved.coach ?? {}) }, book: { ...(saved.book ?? {}) }, best: { ...(saved.best ?? {}) } };
}

// What a finished run adds to the meta: Arrows loosed, best Legend, and what it unlocks.
export function applyRunToMeta(meta, run, legend) {
  const next = { ...meta, book: { ...meta.book }, best: { ...meta.best }, archers: [...meta.archers], runs: meta.runs + 1 };
  for (const s of run.spent) next.book[s.id] = (next.book[s.id] ?? 0) + 1;
  next.best[run.oath] = Math.max(next.best[run.oath] ?? 0, legend);
  const enter = (id) => {
    if (!next.archers.includes(id)) next.archers.push(id);
  };
  if (run.act >= 3) enter('warden'); // the second day is cleared once the third begins
  if (run.result === 'won') {
    enter('duellist');
    next.wins += 1;
    next.oaths = Math.min(OATHS.length, Math.max(next.oaths, run.oath + 2));
  }
  return next;
}
