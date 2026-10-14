// Mheibes: the rule book. Pure and deterministic (all randomness comes from the rng handed in). Nothing here draws.
//
// Ten closed fists (five players, two fists each) and one ring. Fist index h = player * 2 + side (side 0 = the viewer's left hand).
// The seeker may STARE at a player (3 per round), BAT a fist (open it: empty is out, the ring ends the round for the hiders) and finally
// BAS a fist (the answer). The hiders' faces give tells that depend on each player's personality.
export const PLAYERS = 5, HANDS = 10, STARES = 4;
export const handPlayer = (h) => h >> 1;
export const handSide = (h) => h & 1;

export const PERS = ['open', 'steady', 'jittery', 'showman'];
export const PERS_INFO = {
  open: { name: 'Open', blurb: 'wears the ring on the face: tense, or glancing at the fist that holds it' },
  steady: { name: 'Steady', blurb: 'hardly shows anything, so a quiet tell is a real one' },
  jittery: { name: 'Jittery', blurb: 'twitches all the time, so the tells mean very little' },
  showman: { name: 'Showman', blurb: 'puts on a show when the fists are empty and relaxes when the ring is there' },
};
export const KINDS = ['calm', 'smirk', 'tense', 'glance', 'bright'];
export const KIND_LABEL = { calm: 'calm', smirk: 'smirking', tense: 'tense', glance: 'glancing', bright: 'bright-eyed' };

// P(kind | personality, holds the ring). Order = KINDS. Rows sum to 1.
export const TELL_RING = { open: [0.05, 0.05, 0.45, 0.45, 0.00], steady: [0.40, 0.00, 0.30, 0.30, 0.00], jittery: [0.15, 0.10, 0.40, 0.25, 0.10], showman: [0.35, 0.55, 0.00, 0.03, 0.07] };
export const TELL_EMPTY = { open: [0.60, 0.15, 0.07, 0.03, 0.15], steady: [0.75, 0.10, 0.05, 0.02, 0.08], jittery: [0.20, 0.10, 0.38, 0.22, 0.10], showman: [0.10, 0.10, 0.35, 0.40, 0.05] };
// How often a glance goes to the fist that really holds the ring (a holder who glances at all).
export const GLANCE_TRUE = { open: 1, steady: 1, jittery: 0.5, showman: 0.3 };
export const DECOY = [0.10, 0.10, 0.40, 0.35, 0.05];          // a chosen performer on an empty player's face
export const LEVELS = [
  { name: 'Friendly', suppress: 0, learn: false, temp: 0.7, habit: 0, hideSkill: 0 },
  { name: 'Sharp', suppress: 0.15, learn: true, temp: 0.2, habit: 1, hideSkill: 1 },
  { name: 'Master', suppress: 0.3, learn: true, temp: 0.04, habit: 2, hideSkill: 2 },
];

export const NAMES = ['Salim', 'Nawaf', 'Hamed', 'Rashid', 'Faris', 'Jaber', 'Amira', 'Layla', 'Noor', 'Sana', 'Dalia', 'Yusra', 'Karim', 'Tariq', 'Walid', 'Zaid', 'Huda', 'Rana', 'Ali', 'Omar'];
export const LOOKS = 5;                                       // head-wear styles in art.js

export const pickWeighted = (rng, w) => { let t = 0; for (const x of w) t += x; let r = rng.next() * t; for (let i = 0; i < w.length; i++) { r -= w[i]; if (r < 0) return i; } return w.length - 1; };

// A team of five: distinct names and looks, a mix of personalities with at least one reader-friendly player and one trickster.
export function makeTeam(rng) {
  const names = rng.shuffle(NAMES), looks = rng.shuffle([...Array(LOOKS).keys()]);
  const pers = [];
  for (let i = 0; i < PLAYERS; i++) pers.push(PERS[pickWeighted(rng, [0.3, 0.3, 0.15, 0.25])]);
  if (!pers.some((p) => p === 'open' || p === 'steady')) pers[rng.int(PLAYERS)] = 'open';
  if (!pers.some((p) => p === 'jittery' || p === 'showman')) pers[rng.int(PLAYERS)] = 'showman';
  return Array.from({ length: PLAYERS }, (_, i) => ({ name: names[i], look: looks[i], pers: pers[i], skin: rng.int(5), beard: rng.chance(0.5) ? rng.int(2) + 1 : 0 }));
}

// One stare. `opts`: { suppress: chance the holder hides the tell, performer: bool (this player is the chosen decoy), force: lesson override }
export function rollTell(rng, pers, holds, ringSide, opts = {}) {
  if (opts.force) return { kind: opts.force, side: ringSide };
  const tab = opts.performer && !holds ? DECOY : holds ? TELL_RING[pers] : TELL_EMPTY[pers];
  let kind = KINDS[pickWeighted(rng, tab)];
  if (holds && opts.suppress && kind !== 'calm' && rng.chance(opts.suppress)) kind = 'calm';
  let side = 0;
  if (kind === 'glance') side = holds ? (rng.chance(GLANCE_TRUE[pers]) ? ringSide : 1 - ringSide) : rng.int(2);
  return { kind, side };
}

export const seekScore = (opened) => 2 + Math.min(3, Math.floor(opened / 2));

export function newRound(ring, performer = -1) {
  return { ring, performer, open: Array(HANDS).fill(false), stares: [], staresLeft: STARES, opened: 0, status: 'seek', answer: -1, hitHand: -1, scoreSeeker: 0, scoreHider: 0 };
}
export const closedHands = (r) => { const o = []; for (let h = 0; h < HANDS; h++) if (!r.open[h]) o.push(h); return o; };

// The seeker's actions. Each returns { ok, ... } and mutates the round.
export function doStare(r, rng, team, p, level, force) {
  if (r.status !== 'seek' || r.staresLeft <= 0) return { ok: false };
  const holds = handPlayer(r.ring) === p;
  const tell = rollTell(rng, team[p].pers, holds, handSide(r.ring), { suppress: LEVELS[level].suppress, performer: r.performer === p, force: holds ? force : null });
  const rec = { p, kind: tell.kind, side: tell.side };
  r.stares.push(rec); r.staresLeft -= 1;
  return { ok: true, tell: rec };
}
// A safe open also makes its player react (a free look): the partner fist may hold the ring.
export function doBat(r, h, rng, team, level, force) {
  if (r.status !== 'seek' || r.open[h]) return { ok: false };
  if (h === r.ring) { r.status = 'hit'; r.hitHand = h; r.scoreHider = 1; r.scoreSeeker = 0; return { ok: true, ring: true }; }
  r.open[h] = true; r.opened += 1;
  let tell = null;
  if (rng && team) {
    const p = handPlayer(h), holds = handPlayer(r.ring) === p;
    const t = rollTell(rng, team[p].pers, holds, handSide(r.ring), { suppress: LEVELS[level].suppress, performer: r.performer === p, force: holds ? force : null });
    tell = { p, kind: t.kind, side: t.side, free: true }; r.stares.push(tell);
  }
  return { ok: true, ring: false, tell };
}
export function doBas(r, h) {
  if (r.status !== 'seek' || r.open[h]) return { ok: false };
  r.answer = h;
  if (h === r.ring) { r.status = 'right'; r.scoreSeeker = seekScore(r.opened); return { ok: true, right: true }; }
  r.status = 'wrong'; r.scoreHider = 1;
  return { ok: true, right: false };
}
export const roundOver = (r) => r.status !== 'seek';

export const handName = (team, h) => `${team[handPlayer(h)].name}’s ${handSide(h) ? 'right' : 'left'} fist`;
export const kindWords = (t, team) => {
  const n = team[t.p].name;
  if (t.kind === 'glance') return `${n} glanced at the ${t.side ? 'right' : 'left'} fist`;
  return `${n} looked ${KIND_LABEL[t.kind]}`;
};
