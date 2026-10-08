// Lessons, flash and sprint generators. Everything comes from env.rng and is filtered with the plan engine, so an exercise
// in "Five-friends" really needs a five-friend move. An exercise: { rods, start, ops: [{op, n, label}], targets: [...], read? }
import { digitsOf, valueOf, maxOf, plan, targetsOf, mulOps, placeName } from './soroban.js';

const addOp = (n) => ({ op: '+', n, label: `Add ${n}` });
const subOp = (n) => ({ op: '-', n, label: `Take away ${n}` });
const showOp = (n) => ({ op: '=', n, label: `Show ${n}` });
const ex = (rods, start, ops, extra = {}) => ({ rods, start, ops, targets: targetsOf(start, ops), ...extra });
const tries = (f, ok, n = 60) => { let last = null; for (let i = 0; i < n; i++) { last = f(); if (ok(last)) return last; } return last; };
const kindsOf = (start, rods, op, n) => { const p = plan(digitsOf(start, rods), op, n); return p.error ? null : p.kinds; };
const has = (k, name) => !!k && k.has(name);
const only = (k, allowed) => !!k && [...k].every((x) => allowed.includes(x));

function distractors(rng, v) {
  const set = new Set([v]), out = [];
  const cand = [v + 1, v - 1, v + 5, v - 5, v + 10, v - 10, Number(String(v).split('').reverse().join('')), v + 4, v - 4, v * 10 + 1];
  for (const c of rng.shuffle(cand)) if (c >= 0 && c < 10000 && !set.has(c) && out.length < 3) { set.add(c); out.push(c); }
  let k = 2; while (out.length < 3) { const c = v + k * 7; if (!set.has(c)) { set.add(c); out.push(c); } k += 1; }
  return out;
}

export const LESSONS = [
  { id: 'meet', title: 'Meet the beads', tag: 'Heaven 5, earth 1', rods: 3,
    blurb: 'Each rod has one heaven bead worth 5 above the beam and four earth beads worth 1 below it. A bead counts only when it touches the beam. Slide beads to the beam to show the number.',
    gen: (rng) => { const one = rng.int(4) + 1, mid = rng.int(4) + 6, any = rng.int(9) + 1; return [showOp(one), showOp(5), showOp(mid), showOp(9), showOp(any)].map((o) => ex(3, 0, [o])); } },
  { id: 'read', title: 'Reading numbers', tag: 'What does it show?', rods: 4, kind: 'read',
    blurb: 'Look at which beads touch the beam. Read each rod as a digit, left to right, then pick the number it shows.',
    gen: (rng) => [rng.int(8) + 2, rng.int(70) + 12, rng.int(80) + 20, rng.int(800) + 101, rng.int(8000) + 1001].map((v) => ({ rods: 4, start: v, ops: [], targets: [], read: { value: v, options: rng.shuffle([v, ...distractors(rng, v)]) } })) },
  { id: 'big', title: 'Numbers up to 999', tag: 'Place value', rods: 4,
    blurb: 'The rod on the right is the ones, then tens, hundreds. A rod with no beads at the beam is a zero. Show each number; clear the rods first if you need to.',
    gen: (rng) => [rng.int(80) + 11, (rng.int(9) + 1) * 10, (rng.int(9) + 1) * 100 + rng.int(9) + 1, rng.int(800) + 101, rng.int(890) + 105].map((v) => ex(4, 0, [showOp(v)])) },
  { id: 'add1', title: 'Adding small numbers', tag: 'Just push beads up', rods: 3,
    blurb: 'To add, push earth beads up to the beam. Work on the rod that matches the place, tens before ones when a number has both.',
    gen: (rng) => Array.from({ length: 5 }, () => tries(() => { const s = rng.int(3) + (rng.chance(0.5) ? 10 : 0), n = rng.int(4) + 1; return { s, n }; }, ({ s, n }) => only(kindsOf(s, 3, '+', n), ['direct', 'place'])))
      .map(({ s, n }) => ex(3, s, [addOp(n)])) },
  { id: 'add5', title: 'The heaven bead', tag: 'Adding 5 to 9', rods: 3,
    blurb: 'To add 5, pull the heaven bead down. To add 6 to 9, pull it down and push earth beads up as well.',
    gen: (rng) => Array.from({ length: 5 }, () => tries(() => ({ s: rng.int(4), n: rng.int(5) + 5 }), ({ s, n }) => { const k = kindsOf(s, 3, '+', n); return has(k, 'heaven') && only(k, ['heaven', 'direct', 'place']); }))
      .map(({ s, n }) => ex(3, s, [addOp(n)])) },
  { id: 'five', title: 'Five-friends', tag: 'Add 5, take back', rods: 3,
    blurb: 'Out of earth beads? Use the five-friend: adding 4 is adding 5 and taking away 1. Bring the heaven bead down, then push earth beads away.',
    gen: (rng) => Array.from({ length: 5 }, () => tries(() => ({ s: rng.int(4) + 1, n: rng.int(4) + 1 }), ({ s, n }) => has(kindsOf(s, 3, '+', n), 'five') && !has(kindsOf(s, 3, '+', n), 'carry')))
      .map(({ s, n }) => ex(3, s, [addOp(n)])) },
  { id: 'ten', title: 'Ten-friends', tag: 'Carrying to the next rod', rods: 3,
    blurb: 'When a rod would pass 9, carry. Adding 8 is adding 10 and taking away 2: add one bead on the next rod to the left, then take 2 off this rod.',
    gen: (rng) => Array.from({ length: 5 }, () => tries(() => ({ s: rng.int(8) + 2, n: rng.int(8) + 2 }), ({ s, n }) => s + n >= 10 && s + n <= 18))
      .map(({ s, n }) => ex(3, s, [addOp(n)])) },
  { id: 'addlong', title: 'Adding long numbers', tag: 'Left to right', rods: 4,
    blurb: 'Start at the highest place and add digit by digit. A carry from a lower rod simply adds one to the rod on its left.',
    gen: (rng) => Array.from({ length: 5 }, () => tries(() => ({ s: rng.int(70) + 12, n: rng.int(60) + 14 }), ({ s, n }) => !!kindsOf(s, 4, '+', n)))
      .map(({ s, n }) => ex(4, s, [addOp(n)])) },
  { id: 'sub1', title: 'Taking away', tag: 'Push beads back', rods: 3,
    blurb: 'To take away, push earth beads away from the beam, or lift the heaven bead for 5.',
    gen: (rng) => Array.from({ length: 5 }, () => tries(() => ({ s: rng.int(9) + 1, n: rng.int(4) + 1 }), ({ s, n }) => s >= n && only(kindsOf(s, 3, '-', n), ['direct', 'place'])))
      .map(({ s, n }) => ex(3, s, [subOp(n)])) },
  { id: 'sub5', title: 'Taking away with the heaven bead', tag: 'Five-friends backwards', rods: 3,
    blurb: 'Take away 5 by lifting the heaven bead. If there are not enough earth beads, lift the heaven bead and bring earth beads back: -4 is -5 and +1.',
    gen: (rng) => Array.from({ length: 5 }, () => tries(() => ({ s: rng.int(9) + 1, n: rng.int(8) + 1 }), ({ s, n }) => { const k = kindsOf(s, 3, '-', n); return s >= n && !!k && (k.has('heaven') || k.has('five')) && !k.has('borrow'); }))
      .map(({ s, n }) => ex(3, s, [subOp(n)])) },
  { id: 'borrow', title: 'Borrowing', tag: 'Ten-friends backwards', rods: 3,
    blurb: 'When the rod does not have enough, borrow 1 from the rod on the left: -8 is -10 and +2. Take one bead off the next rod and add 2 here.',
    gen: (rng) => Array.from({ length: 5 }, () => tries(() => ({ s: rng.int(9) + 11, n: rng.int(8) + 2 }), ({ s, n }) => s > n && has(kindsOf(s, 3, '-', n), 'borrow')))
      .map(({ s, n }) => ex(3, s, [subOp(n)])) },
  { id: 'sublong', title: 'Subtracting long numbers', tag: 'Left to right again', rods: 4,
    blurb: 'Take away from the highest place first. Borrow from the left whenever a rod runs short.',
    gen: (rng) => Array.from({ length: 5 }, () => tries(() => ({ s: rng.int(700) + 120, n: rng.int(90) + 14 }), ({ s, n }) => s > n && has(kindsOf(s, 4, '-', n), 'borrow')))
      .map(({ s, n }) => ex(4, s, [subOp(n)])) },
  { id: 'mul', title: 'Multiplying', tag: 'Partial products', rods: 5,
    blurb: 'Multiply one digit at a time, high place first, adding each partial product. For 23 x 4: the 2 in the tens gives 2 x 4 = 8, so add 80; then 3 x 4 = 12, so add 12.',
    gen: (rng) => Array.from({ length: 5 }, () => tries(() => ({ x: rng.int(40) + 12, m: rng.int(8) + 2 }), ({ x }) => x % 10 !== 0))
      .map(({ x, m }) => ex(5, 0, mulOps(x, m), { prompt: `${x} x ${m}`, answer: x * m })) },
];
export const LESSON_BY_ID = Object.fromEntries(LESSONS.map((l) => [l.id, l]));

// ---- Flash mental: a short list of signed numbers shown one by one ---------------------------------------------------------
export const FLASH_LEVELS = [
  { name: 'Level 1', tag: '1 digit, 3 numbers', digits: 1, count: 3, ms: 1200, sub: false },
  { name: 'Level 2', tag: '2 digits, 3 numbers', digits: 2, count: 3, ms: 1100, sub: false },
  { name: 'Level 3', tag: '2 digits, 4 numbers, take-aways', digits: 2, count: 4, ms: 1000, sub: true },
  { name: 'Level 4', tag: '3 digits, 5 numbers', digits: 3, count: 5, ms: 900, sub: true },
  { name: 'Level 5', tag: '3 digits, 7 numbers, fast', digits: 3, count: 7, ms: 750, sub: true },
];
export function flashSequence(rng, lv) {
  const L = FLASH_LEVELS[lv], lo = L.digits === 1 ? 1 : 10 ** (L.digits - 1), hi = 10 ** L.digits - 1, seq = []; let total = 0;
  for (let i = 0; i < L.count; i++) {
    const n = lo + rng.int(hi - lo + 1);
    const canSub = L.sub && total - n >= 0 && i > 0;
    const sub = canSub && rng.chance(0.4);
    if (!sub && total + n > 9999) { if (total - n >= 0) { seq.push(-n); total -= n; continue; } }
    seq.push(sub ? -n : n); total += sub ? -n : n;
  }
  return { seq, total, ms: L.ms };
}

// ---- Timed challenge: a chain of tasks on a running total -----------------------------------------------------------------------
export const SPRINT_LEVELS = [
  { name: 'Level 1', tag: 'One digit, add and take away', cap: 99 },
  { name: 'Level 2', tag: 'Two-digit sums', cap: 999 },
  { name: 'Level 3', tag: 'Two digits, adding and taking away', cap: 999 },
  { name: 'Level 4', tag: 'Three digits', cap: 9999 },
  { name: 'Level 5', tag: 'Multiply by one digit', cap: 99999 },
];
export function nextSprintTask(rng, lv, total) {
  const L = SPRINT_LEVELS[lv];
  if (lv === 4) { const x = rng.int(88) + 12, m = rng.int(8) + 2; return { op: '=', n: x * m, label: `${x} x ${m}`, reset: true, target: x * m }; }
  const lo = [1, 10, 10, 100][lv], hi = [9, 99, 99, 999][lv];
  for (let i = 0; i < 40; i++) {
    const n = lo + rng.int(hi - lo + 1);
    const wantSub = lv === 1 ? false : rng.chance(0.45);
    if (wantSub && total >= n) return { op: '-', n, label: `Take away ${n}`, target: total - n };
    if (!wantSub && total + n <= L.cap) return { op: '+', n, label: `Add ${n}`, target: total + n };
  }
  const n = Math.min(total, hi); return n > 0 ? { op: '-', n, label: `Take away ${n}`, target: total - n } : { op: '+', n: lo, label: `Add ${lo}`, target: total + lo };
}

// The tour for Watch and Learn: one exercise from each of eight lessons.
export const TOUR = ['add1', 'add5', 'five', 'ten', 'addlong', 'sub5', 'borrow', 'mul'];
export function tourExercises(rng) { return TOUR.map((id) => ({ lesson: id, ...LESSON_BY_ID[id].gen(rng)[0] })); }
export { valueOf, maxOf, placeName };
