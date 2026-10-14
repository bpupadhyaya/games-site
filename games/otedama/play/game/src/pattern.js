// Otedama: the rules as data. Toss patterns are juggling "throw sequences": at every beat j the hand that is due (left on even beats,
// right on odd beats) tosses the bag it holds so that it comes down v beats later (v = 0 means that hand has nothing to toss).
// A bag tossed with v lands in the hand that is due at beat j+v: an odd v crosses over, an even v returns to the same hand.
// Pure and deterministic: nothing in here reads a clock or a random source.

export const COUNT_IN = 4;                    // beats of count-in before the first toss
export const DWELL = 0.3;                     // a caught bag rests in the hand for this share of a beat before it is tossed again
export const SONG = ['ichi', 'ni', 'san', 'shi', 'go', 'roku', 'shichi', 'hachi', 'kyu', 'ju'];   // counting words, one per clean catch
export const SONG_EN = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
export const CLAP_AT = 1.2;                   // a clap falls this many beats after the toss it belongs to (between two catches)

// ---- timing, scoring -----------------------------------------------------------------------------------------------------------------
export const JUDGE = { perfect: 0.055, great: 0.1, good: 0.15 };           // seconds either side of the catch moment, at "Standard"
export const TIMING = [{ name: 'Relaxed', k: 1.4 }, { name: 'Standard', k: 1 }, { name: 'Tight', k: 0.75 }];
export const LEARN_WINDOW = 1.35;             // Learn widens every window by this factor
export const LEARN_SPEED = 0.75;              // and plays at this share of the tempo
export const SCORE = { perfect: 300, great: 200, good: 100, miss: 0 };
export const WEIGHT = { perfect: 1, great: 0.8, good: 0.55, miss: 0 };
export const FLOW = { start: 0.6, perfect: 0.04, great: 0.028, good: 0.012, miss: -0.15, stray: -0.03 };
export const COMBO_STEP = 8;                  // every 8 clean catches in a row adds one to the multiplier
export const COMBO_MAX = 4;
export const STAR_AT = [0.5, 0.75, 0.9];
export const DEMO_RUNS = 3;
export const THINK_CHOICES = [2, 3, 5, 8, 10];   // Watch and Learn "think" seconds; 5 is the default, 10 the cap
export const REVEAL_SECONDS = 2;
export const PHRASE = 4;                      // catches per Watch and Learn phrase
export const ZONES = { left: 0.4, right: 0.6 };   // share of the stage width: left of 40% = left hand, right of 60% = right hand, between = clap

// ---- the patterns --------------------------------------------------------------------------------------------------------------------
// bags = how many bags are in play; toss = the throw sequence (repeats); claps = positions in that sequence (0-based) whose toss is
// followed by a clap; beats = how many beats of tossing are played; bpm = tempo at Perform; fabric = the cloth it earns.
export const PATTERNS = [
  { id: 'hitotsu', name: 'Hitotsu', en: 'One bag', blurb: 'One bag, from hand to hand and back.', bags: 1, toss: [3, 0, 0], claps: [], beats: 21, bpm: 112 },
  { id: 'pachi', name: 'Pachi', en: 'Toss and clap', blurb: 'Toss it high, clap once, catch it.', bags: 1, toss: [4, 0, 0, 0], claps: [0], beats: 24, bpm: 104 },
  { id: 'futatsu', name: 'Futatsu', en: 'Two bags', blurb: 'Two bags: one high, one quick.', bags: 2, toss: [3, 1], claps: [], beats: 24, bpm: 100 },
  { id: 'mittsu', name: 'Mittsu', en: 'Cascade of three', blurb: 'The classic figure of eight.', bags: 3, toss: [3], claps: [], beats: 30, bpm: 96 },
  { id: 'yottsu', name: 'Yottsu', en: 'Fountain of four', blurb: 'Four bags, each hand keeps its own.', bags: 4, toss: [4], claps: [], beats: 32, bpm: 84 },
  { id: 'mittsu-pachi', name: 'Mittsu Pachi', en: 'Three with claps', blurb: 'Three bags with a clap in the air.', bags: 3, toss: [4, 4, 1], claps: [0], beats: 36, bpm: 88 },
  { id: 'itsutsu', name: 'Itsutsu', en: 'Cascade of five', blurb: 'Five bags: a high, steady wheel.', bags: 5, toss: [5], claps: [], beats: 40, bpm: 76 },
  { id: 'matsuri', name: 'Matsuri', en: 'Festival pattern', blurb: 'Four bags, mixed heights and claps.', bags: 4, toss: [5, 3, 4], claps: [0], beats: 36, bpm: 84 },
];

// ---- fabrics (the cloth patterns of the bags; the first three are always owned, the rest are earned with a star) -------------------
export const FABRICS = [
  { id: 'asanoha', name: 'Asanoha', note: 'Hemp-leaf star, a classic pattern for children\'s cloth.', base: '#c2402e', ink: '#fbe3c4' },
  { id: 'seigaiha', name: 'Seigaiha', note: 'Overlapping waves.', base: '#27508f', ink: '#d9e8ff' },
  { id: 'kasuri', name: 'Kasuri', note: 'Splash-woven ikat, in indigo.', base: '#1f2f5e', ink: '#a9bde8' },
  { id: 'shippo', name: 'Shippo', note: 'Linked circles of the seven treasures pattern.', base: '#3d8a6a', ink: '#e6f7d9' },
  { id: 'ichimatsu', name: 'Ichimatsu', note: 'A checkerboard of squares.', base: '#7a3d8f', ink: '#f2d9ff' },
  { id: 'uroko', name: 'Uroko', note: 'Fish-scale triangles.', base: '#e0a02e', ink: '#6b3d10' },
  { id: 'shima', name: 'Shima', note: 'Fine stripes in rose and cream.', base: '#d8587a', ink: '#fff0e0' },
  { id: 'sakura', name: 'Sakura', note: 'Scattered blossoms on a pale ground.', base: '#f3c9d4', ink: '#c04a6e' },
];
export const FREE_FABRICS = 3;

// ---- building one pattern ---------------------------------------------------------------------------------------------------------
// Returns { P, throws, bags, events }. Beat positions (b) are floats counted from the first toss (beat 0).
//   throw: { j0, j1, v, bag, hand, ev }  hand = the hand that tosses it (0 left, 1 right); ev = the catch event it ends in
//   event: { i, kind: 'catch'|'clap', hand: 0|1|2, b, bag, thr, j, tj, err, auto }  sorted by b; j = the grade once judged
export function buildPattern(pi) {
  const P = PATTERNS[pi], N = P.beats, len = P.toss.length;
  const landing = new Map();
  const throws = [], bags = [];
  for (let j = 0; j < N; j++) {
    const v = P.toss[j % len];
    if (!v) continue;
    const q = landing.get(j);
    let bag;
    if (q && q.length) bag = q.shift();
    else { bag = bags.length; bags.push([]); }
    const th = { j0: j, j1: j + v, v, bag, hand: j % 2 };
    throws.push(th); bags[bag].push(th);
    if (!landing.has(th.j1)) landing.set(th.j1, []);
    landing.get(th.j1).push(bag);
  }
  const events = [];
  const mk = (kind, hand, b, th) => {
    const e = { kind, hand, b, bag: th.bag, j: null, tj: 0, err: 0, auto: null };
    Object.defineProperty(e, 'thr', { value: th, enumerable: false });      // not enumerable: keeps the state JSON-serialisable
    return e;
  };
  for (const th of throws) {
    const ev = mk('catch', th.j1 % 2, th.j1 - DWELL, th);
    Object.defineProperty(th, 'ev', { value: ev, enumerable: false, writable: true });
    events.push(ev);
    if (th.v >= 3 && P.claps.includes(th.j0 % len)) events.push(mk('clap', 2, th.j0 + CLAP_AT, th));
  }
  events.sort((a, c) => a.b - c.b || a.hand - c.hand);
  events.forEach((e, i) => { e.i = i; });
  return { P, throws, bags, events };
}

export const beatSeconds = (bpm, speed) => 60 / (bpm * speed);
export const gradeFromErr = (err, k) => {
  const e = Math.abs(err);
  return e <= JUDGE.perfect * k ? 'perfect' : e <= JUDGE.great * k ? 'great' : e <= JUDGE.good * k ? 'good' : null;
};
export const comboMult = (chain) => Math.min(COMBO_MAX, 1 + Math.floor(chain / COMBO_STEP));
export const starsOf = (acc) => (acc >= STAR_AT[2] ? 3 : acc >= STAR_AT[1] ? 2 : acc >= STAR_AT[0] ? 1 : 0);
export const gradeName = (acc) => (acc >= 0.95 ? 'Master' : acc >= 0.85 ? 'Expert' : acc >= 0.7 ? 'Juggler' : acc >= 0.5 ? 'Apprentice' : 'Beginner');
export const zoneOf = (xRel) => (xRel < ZONES.left ? 0 : xRel > ZONES.right ? 1 : 2);   // xRel = x within the stage, 0..1
export const HAND_NAMES = ['Left', 'Right', 'Clap'];
