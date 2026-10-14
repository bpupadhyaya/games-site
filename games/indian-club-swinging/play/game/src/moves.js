// Indian Club Swinging: the move vocabulary, routines and every number that decides how a swing is judged.
// Pure data and maths (no clock, no randomness except the seeded daily routine builder). All path coordinates are in PAD UNITS:
// the pad is a circle of radius 1, x to the right, y DOWN (screen), the centre is (0, 0).
export const TAU = Math.PI * 2;

// A shape maps an angle a (radians, a = 0 is the start of the move) to a point. a grows clockwise on screen for circles.
export const SHAPES = {
  circle: (a) => ({ x: Math.sin(a), y: -Math.cos(a) }),
  wide: (a) => ({ x: Math.sin(a), y: -0.52 * Math.cos(a) }),
  tall: (a) => ({ x: 0.52 * Math.sin(a), y: -Math.cos(a) }),
  eight: (a) => ({ x: Math.cos(a), y: 0.56 * Math.sin(2 * a) }),
  rise: (a) => ({ x: 0.56 * Math.sin(2 * a), y: -Math.cos(a) }),
};

// pair: how the second (left) club relates to the lead (right) club.
//   together  same point at the same moment      mirror  same point flipped left-right      alternate  half a turn behind
export const PAIRS = {
  together: { name: 'Together', text: 'both clubs trace the same path side by side' },
  mirror: { name: 'Mirror', text: 'the left club is the mirror image of the right one' },
  alternate: { name: 'Alternate', text: 'the left club is half a turn behind the right one' },
};

// dir: +1 clockwise, -1 anticlockwise. speed: turns of the path per beat. turns: how many turns one repeat of the move lasts.
export const MOVES = {
  front: { id: 'front', name: 'Front circle', shape: 'circle', dir: 1, speed: 0.5, pair: 'together', how: 'Trace the circle clockwise, starting at the top, one turn every two beats.' },
  back: { id: 'back', name: 'Back circle', shape: 'circle', dir: -1, speed: 0.5, pair: 'together', how: 'The same circle the other way round: anticlockwise from the top.' },
  mirror: { id: 'mirror', name: 'Outward mirror', shape: 'circle', dir: 1, speed: 0.5, pair: 'mirror', how: 'A clockwise circle for the lead club; the second club mirrors it so the pair swings outward together.' },
  alternate: { id: 'alternate', name: 'Alternating mill', shape: 'circle', dir: 1, speed: 0.5, pair: 'alternate', how: 'A clockwise circle; the second club is always half a turn behind, like a mill wheel.' },
  wide: { id: 'wide', name: 'Wide arc', shape: 'wide', dir: 1, speed: 0.5, pair: 'together', how: 'A flat, wide oval across the pad: long side to side, short up and down.' },
  tall: { id: 'tall', name: 'Tall arc', shape: 'tall', dir: 1, speed: 0.5, pair: 'together', how: 'A tall, narrow oval: reach high and low, stay close to the middle sideways.' },
  eight: { id: 'eight', name: 'Figure eight', shape: 'eight', dir: 1, speed: 0.5, pair: 'together', how: 'Start at the right edge and draw a sideways eight, crossing the middle twice every turn.' },
  rise: { id: 'rise', name: 'Rising eight', shape: 'rise', dir: 1, speed: 0.5, pair: 'together', how: 'Start at the top and draw an upright eight, crossing the middle twice every turn.' },
  quick: { id: 'quick', name: 'Quick circle', shape: 'circle', dir: 1, speed: 1, pair: 'together', how: 'The front circle at double speed: one full turn on every beat.' },
  quickEight: { id: 'quickEight', name: 'Quick eight', shape: 'eight', dir: -1, speed: 1, pair: 'together', how: 'A sideways eight at double speed, drawn the other way round.' },
  wideBack: { id: 'wideBack', name: 'Wide arc, reversed', shape: 'wide', dir: -1, speed: 0.5, pair: 'together', how: 'The wide oval anticlockwise: start at the top and move left first.' },
  mirrorEight: { id: 'mirrorEight', name: 'Mirror eight', shape: 'eight', dir: 1, speed: 0.5, pair: 'mirror', how: 'The sideways eight with the second club mirroring the first.' },
};
export const MOVE_ORDER = ['front', 'back', 'mirror', 'alternate', 'wide', 'tall', 'eight', 'rise', 'quick', 'quickEight', 'wideBack', 'mirrorEight'];

// The point of move `m` at (fractional) turns `turns` since its start, for the lead club.
export function leadPoint(m, turns) {
  const a = m.dir * TAU * turns, p = SHAPES[m.shape](a);
  return p;
}
// The second club's point for a lead-club point p (pad units). The pair rule is geometric, so it follows the player's own club head.
export function pairOf(m, p) {
  if (m.pair === 'mirror') return { x: -p.x, y: p.y };
  if (m.pair === 'alternate') {
    if (m.shape === 'eight') return { x: -p.x, y: p.y };
    if (m.shape === 'rise') return { x: p.x, y: -p.y };
    return { x: -p.x, y: -p.y };
  }
  return { x: p.x, y: p.y };
}
// A sampled outline of the move's path (one full turn) for drawing, n + 1 points.
export function pathPoints(m, n = 72) {
  const out = [];
  for (let i = 0; i <= n; i++) out.push(SHAPES[m.shape](m.dir * TAU * (i / n)));
  return out;
}

// ---- routines ------------------------------------------------------------------------------------------------------------------------------
// moves: [moveId, turns]. One repeat of a move is `turns / speed` beats, then a two-beat gap before the next one (the first has four).
export const GAP_BEATS = 2, COUNT_IN = 4;
export const ROUTINES = [
  { id: 'slow-flow', name: 'Slow Flow', bpm: 54, level: 1, blurb: 'Plain circles and ovals at an easy, breathing pace.',
    moves: [['front', 4], ['back', 4], ['front', 4], ['wide', 4], ['tall', 4], ['back', 4], ['wide', 4]] },
  { id: 'morning-round', name: 'Morning Round', bpm: 64, level: 2, blurb: 'Circles, ovals and your first paired moves.',
    moves: [['front', 4], ['back', 4], ['mirror', 4], ['wide', 4], ['alternate', 4], ['tall', 4], ['mirror', 4], ['back', 4]] },
  { id: 'pairs', name: 'Pairs', bpm: 72, level: 3, blurb: 'Mirror and alternating mills, one after another.',
    moves: [['mirror', 4], ['alternate', 4], ['wideBack', 4], ['mirror', 4], ['alternate', 4], ['tall', 4], ['mirrorEight', 4], ['alternate', 4]] },
  { id: 'eights', name: 'Eights', bpm: 66, level: 3, blurb: 'Figure eights, upright and sideways, with circles between.',
    moves: [['front', 4], ['eight', 4], ['rise', 4], ['back', 4], ['eight', 4], ['mirrorEight', 4], ['rise', 4], ['wide', 4]] },
  { id: 'quickening', name: 'Quickening', bpm: 60, level: 4, blurb: 'Double-speed turns: one turn on every beat.',
    moves: [['front', 4], ['quick', 4], ['back', 4], ['quick', 4], ['eight', 4], ['quickEight', 4], ['quick', 4], ['front', 4]] },
  { id: 'full-set', name: 'Full Set', bpm: 84, level: 5, blurb: 'Every move in one long, brisk routine.',
    moves: [['front', 4], ['back', 4], ['mirror', 4], ['alternate', 4], ['wide', 4], ['tall', 4], ['wideBack', 4], ['eight', 4], ['rise', 4], ['mirrorEight', 4], ['alternate', 4], ['mirror', 4], ['front', 4]] },
];

// The daily routine: built from the whole-day number with a tiny seeded generator, so it is the same for everyone that day.
function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function dailyRoutine(day) {
  const rnd = mulberry((day | 0) * 2654435761 + 17), bpm = 56 + Math.floor(rnd() * 5) * 4;
  const pool = MOVE_ORDER.filter((id) => bpm * MOVES[id].speed <= 66 + 1e-9);
  const moves = [];
  let last = '';
  for (let i = 0; i < 7; i++) {
    let id = pool[Math.floor(rnd() * pool.length)], tries = 0;
    while (id === last && tries++ < 6) id = pool[Math.floor(rnd() * pool.length)];
    moves.push([id, 4]); last = id;
  }
  return { id: 'daily', name: 'Daily Routine', bpm, level: 3, blurb: 'A new set of moves every day, the same for everyone.', moves };
}

// Compile a routine into a timeline in beats. Each segment: { move, turns, beats, gap0, start, end }.
export function compile(routine) {
  let b = 0;
  const segs = routine.moves.map(([id, turns], i) => {
    const m = MOVES[id], beats = turns / m.speed, gap = i === 0 ? COUNT_IN : GAP_BEATS;
    const seg = { i, move: m, turns, beats, gap0: b, start: b + gap, end: b + gap + beats };
    b = seg.end; return seg;
  });
  return { segs, total: b, bpm: routine.bpm, routine };
}

// ---- judging -----------------------------------------------------------------------------------------------------------------------------------
export const TIMING = [
  { id: 'relaxed', name: 'Relaxed', k: 1.35 },
  { id: 'standard', name: 'Standard', k: 1 },
  { id: 'strict', name: 'Strict', k: 0.78 },
];
export const WEIGHT = [
  { id: 'light', name: 'Light', tau: 0.035 },
  { id: 'medium', name: 'Medium', tau: 0.07 },
  { id: 'heavy', name: 'Heavy', tau: 0.115 },
];
export const THINK_TIMES = [3, 5, 8, 10];
export const JUDGE = { smooth: 0.3, good: 0.62 };           // distance from the marker, in pad units (times the timing factor)
export const SCORE = { perSec: 60, smooth: 100, good: 50 };
export const FLOW = { gain: 0.24, loss: 0.38, drop: 0.7, qOk: 0.55 };
export const STAR_AT = [0.55, 0.75, 0.9];
export const REACH = 1.25;                                    // the finger can reach this far from the centre (pad units)

// Quality of a swing tick from the distance between the club head and the marker.
export function quality(d, k = 1) {
  const a = JUDGE.smooth * k * 0.75, b = 0.95 * k;
  if (d <= a) return 1;
  if (d >= b) return 0;
  const x = (d - a) / (b - a);
  return 1 - x * x * (3 - 2 * x);
}
export const multOf = (flow) => 1 + Math.min(4, Math.floor(flow * 4.999));
export const starsOf = (acc) => (acc >= STAR_AT[2] ? 3 : acc >= STAR_AT[1] ? 2 : acc >= STAR_AT[0] ? 1 : 0);
export const gradeOf = (acc) => (acc >= 0.94 ? 'Master' : acc >= 0.85 ? 'Adept' : acc >= 0.7 ? 'Steady' : acc >= 0.5 ? 'Learning' : 'Warming up');
