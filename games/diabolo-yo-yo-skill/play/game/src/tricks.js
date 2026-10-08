// The trick book, the judge that turns physics events into named tricks, stars, rows, Show scoring and the Daily Challenge.
// Pure and deterministic. The judge is plain JSON so planners can run it on cloned worlds.

export const TOYS = ['yoyo', 'diabolo'];
export const TOY_NAME = { yoyo: 'Yo-yo', diabolo: 'Diabolo' };

// row = ladder row; base = points; goal = what the card says; tip = one line of advice
export const TRICKS = [
  { id: 'y-downup', toy: 'yoyo', row: 0, name: 'Down and Up', base: 40, goal: 'Throw the yo-yo down and bring it back to your hand.', tip: 'Flick down, let go, then flick up fast to bring it home.' },
  { id: 'y-sleeper', toy: 'yoyo', row: 0, name: 'Sleeper', base: 90, goal: 'Let it spin at the end of the string for 2.5 seconds, then bring it back.', tip: 'Flick down a short way and lift your finger. Keep still while it sleeps, then flick up.' },
  { id: 'y-walk', toy: 'yoyo', row: 1, name: 'Walk the Dog', base: 120, goal: 'Roll it along the floor for a metre, then bring it back.', tip: 'Flick down and keep your finger low so it lands. Then slide right, slowly and steadily, then flick up.' },
  { id: 'y-break', toy: 'yoyo', row: 1, name: 'Breakaway', base: 110, goal: 'Throw it out wide to the side without touching the floor and bring it back.', tip: 'Flick sideways. It swings out to the end of the string. Flick up when it hangs low.' },
  { id: 'y-long', toy: 'yoyo', row: 2, name: 'Long Sleeper', base: 170, goal: 'Sleep for 6 seconds, then bring it back.', tip: 'Throw hard for lots of spin, keep your hand still, and flick up before the spin bar runs low.' },
  { id: 'y-around', toy: 'yoyo', row: 2, name: 'Around the World', base: 200, goal: 'Whip it round a full circle, then bring it back.', tip: 'Flick forward hard and a little upward. It whips over the top. Flick up when it hangs low.' },
  { id: 'y-double', toy: 'yoyo', row: 3, name: 'Double World', base: 320, goal: 'Two full circles, then bring it back.', tip: 'A harder forward flick, then move your hand with the swing to keep it going.' },
  { id: 'd-spin', toy: 'diabolo', row: 0, name: 'Spin Up', base: 50, goal: 'Spin the diabolo up and hold the spin for 2 seconds.', tip: 'Shake your finger left and right. The spin bar fills as the string slides.' },
  { id: 'd-pend', toy: 'diabolo', row: 0, name: 'Pendulum', base: 80, goal: 'Swing the diabolo from side to side four times.', tip: 'Move your hand left and right in time with the swing, like pushing a swing.' },
  { id: 'd-toss', toy: 'diabolo', row: 1, name: 'Toss and Catch', base: 110, goal: 'Toss it up and catch it on the string.', tip: 'Spin up first. Flick up, then slide under it and let it land.' },
  { id: 'd-side', toy: 'diabolo', row: 1, name: 'Side Toss', base: 150, goal: 'Toss it so it lands well to one side, and catch it.', tip: 'Flick up while moving sideways, then follow it.' },
  { id: 'd-high', toy: 'diabolo', row: 2, name: 'High Toss', base: 220, goal: 'Toss it high and catch it.', tip: 'A faster flick throws it higher. More spin keeps it steady up there.' },
  { id: 'd-long', toy: 'diabolo', row: 2, name: 'Long Spin', base: 140, goal: 'Reach a very fast spin and hold it for 1.5 seconds.', tip: 'Keep shaking with big, quick strokes.' },
  { id: 'd-triple', toy: 'diabolo', row: 3, name: 'Triple Catch', base: 300, goal: 'Three tosses and catches in a row.', tip: 'Do not wait. As soon as it lands, spin and toss again.' },
];
export const TRICK_BY_ID = Object.fromEntries(TRICKS.map((t) => [t.id, t]));
export const tricksOf = (toy) => TRICKS.filter((t) => t.toy === toy);
export const ROWS = [
  { name: 'First steps', need: 0 },
  { name: 'Getting the feel', need: 2 },
  { name: 'Showing off', need: 6 },
  { name: 'Master class', need: 11 },
];
export const SHOW_SECONDS = 150, SHOW_LIVES = 3, DAILY_DROPS = 4;

export const starsFor = (drops) => (drops <= 1 ? 3 : drops <= 4 ? 2 : 1);
export const starsOfToy = (rec, toy) => tricksOf(toy).reduce((n, t) => n + ((rec.stars[t.id] | 0)), 0);
export const rowOpen = (row, rec, toy) => starsOfToy(rec, toy) >= ROWS[row].need;
export const trickOpen = (tr, rec) => rowOpen(tr.row, rec, tr.toy);
export const totalStars = (rec) => TRICKS.reduce((n, t) => n + ((rec.stars[t.id] | 0)), 0);
export const stylePts = (spinFrac) => Math.round(30 * Math.max(0, Math.min(1, spinFrac)));

// ---- the judge -------------------------------------------------------------------------------
export const newJudge = () => ({ last: 0, spinArmed: true, longArmed: true, penArmed: true, triple: 0 });

// Reads the events a world produced since the last call and the live detectors. Returns
// [{ kind: 'trick', id } | { kind: 'drop', why } | { kind: 'catch' } | { kind: 'throw' } ...]
export function judgeStep(j, w) {
  const out = [];
  for (const e of w.ev) {
    if (e.id <= j.last) continue;
    j.last = e.id;
    if (e.type === 'drop') { j.triple = 0; out.push({ kind: 'drop', why: e.why, x: e.x, y: e.y }); }
    else if (e.type === 'done' && w.toy === 'yoyo') {
      const a = e.att, as = w.assist ? 0.3 : 0;
      out.push({ kind: 'trick', id: 'y-downup' });
      if (a.sleep >= 2.5 - as) out.push({ kind: 'trick', id: 'y-sleeper' });
      if (a.sleep >= 6 - as) out.push({ kind: 'trick', id: 'y-long' });
      if (a.walk >= 0.9) out.push({ kind: 'trick', id: 'y-walk' });
      if (a.reach >= 0.9 && a.loops === 0 && !a.floor) out.push({ kind: 'trick', id: 'y-break' });
      if (a.loops >= 1) out.push({ kind: 'trick', id: 'y-around' });
      if (a.loops >= 2) out.push({ kind: 'trick', id: 'y-double' });
    } else if (e.type === 'done' && w.toy === 'diabolo') {
      const a = e.att;
      if (a.peak >= 0.8) out.push({ kind: 'trick', id: 'd-toss' });
      if (a.peak >= 0.6 && a.dx >= 0.8) out.push({ kind: 'trick', id: 'd-side' });
      if (a.peak >= 2.0) out.push({ kind: 'trick', id: 'd-high' });
      if (a.peak >= 0.6) { j.triple++; if (j.triple >= 3) { j.triple = 0; out.push({ kind: 'trick', id: 'd-triple' }); } }
    } else if (e.type === 'catch') out.push({ kind: 'catch', peak: e.peak, v: e.v });
    else if (e.type === 'toss') out.push({ kind: 'toss', v: e.v });
    else if (e.type === 'throw') out.push({ kind: 'throw' });
    else if (e.type === 'bind') out.push({ kind: 'bind' });
    else if (e.type === 'loop') out.push({ kind: 'loop', n: e.n });
    else if (e.type === 'snap') out.push({ kind: 'snap', v: e.v });
  }
  if (w.toy === 'diabolo' && !w.db.air && w.db.mode === 'string') {
    const d = w.db;
    if (j.spinArmed && d.spinT >= 2) { j.spinArmed = false; out.push({ kind: 'trick', id: 'd-spin' }); }
    if (!j.spinArmed && d.w < 100) j.spinArmed = true;
    if (j.longArmed && d.longT >= 1.5) { j.longArmed = false; out.push({ kind: 'trick', id: 'd-long' }); }
    if (!j.longArmed && d.w < 170) j.longArmed = true;
    if (j.penArmed && d.swingN >= 4) { j.penArmed = false; d.swingN = 0; out.push({ kind: 'trick', id: 'd-pend' }); }
    if (!j.penArmed && d.swingN === 0 && d.swingT > 3) j.penArmed = true;
  }
  return out;
}

// ---- Show scoring ----------------------------------------------------------------------------
export function newShow() { return { time: SHOW_SECONDS, lives: SHOW_LIVES, score: 0, chain: 0, best: 0, last: '', tricks: 0, over: false, log: [] }; }
export function showTrick(s, id, spinFrac) {
  const tr = TRICK_BY_ID[id];
  const mult = Math.min(3, 1 + 0.25 * s.chain);
  const vari = s.last === id ? 0.5 : 1;
  const pts = Math.round(tr.base * mult * vari) + stylePts(spinFrac);
  s.score += pts; s.chain++; s.best = Math.max(s.best, s.chain); s.last = id; s.tricks++;
  return { pts, mult, vari };
}
export function showDrop(s) { s.chain = 0; s.lives--; if (s.lives <= 0) s.over = true; }

// ---- Daily Challenge -------------------------------------------------------------------------
// Seeded by the day number only: the same three tricks for everybody on a given day.
export function dailyFor(day) {
  let s = (day * 2654435761 + 12345) >>> 0;
  const next = () => { s = (Math.imul(s ^ (s >>> 15), 2246822519) + 0x9E3779B9) >>> 0; return s / 4294967296; };
  const toy = TOYS[day % 2];
  const pool = tricksOf(toy).filter((t) => t.row <= 2);
  const ids = [];
  while (ids.length < 3) { const t = pool[Math.floor(next() * pool.length)]; if (!ids.includes(t.id)) ids.push(t.id); }
  return { day, toy, ids, seed: 1 + Math.floor(next() * 9000) };
}
