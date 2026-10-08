// Hints and explanations built from the real engine state: the Think button and the Watch & Learn panel. Pure functions.
import { SKILL, AIM_RANGE, TEJO_R, TIMING, LEVELS } from './consts.js';
import { RULE_TEXT } from './courses.js';

const ms = (x) => `${Math.round(Math.abs(x) * 1000)} ms`;

export function stepText(C, st, mkNum) {
  const stop = C.stops[st.stop];
  const where = (() => {
    if (st.k === 'exit') return 'out over the start line';
    if (!stop) return '';
    if (stop.type === 'k') return 'the Sky square';
    const nums = stop.cells.map((id) => C.cells[id].num);
    return nums.length > 1 ? `squares ${nums[0]} and ${nums[1]}` : `square ${nums[0]}`;
  })();
  if (st.k === 'one') return `${where}: ONE foot (LEFT or RIGHT)`;
  if (st.k === 'both') return `${where}: TWO FEET`;
  if (st.k === 'open') return `${where}: the tejo is in the ${st.side === 'L' ? 'right' : 'left'} half, so land on the ${st.side === 'L' ? 'LEFT' : 'RIGHT'} half with that ONE foot`;
  if (st.k === 'sky') return `${where}: TWO FEET, then turn`;
  if (st.k === 'pick') return `${where}: stop and PICK UP the tejo${mkNum ? ` from square ${mkNum}` : ''}`;
  return `${where}: TWO FEET`;
}

export function hintFor(S) {
  const s = S.s, C = S.C, T = s.turn;
  if (!T) return { title: 'Think', lines: ['Get ready.'] };
  const cell = C.cells[T.cell];
  if (s.phase === 'aimX' || s.phase === 'aimLock' || s.phase === 'aimZ' || s.phase === 'intro' || s.phase === 'flight' || s.phase === 'landed') {
    const kind = cell.kind === 'half' ? `the ${cell.side === 'L' ? 'left' : 'right'} half of the double ${C.cells.filter((c) => c.stop === cell.stop).map((c) => c.num).join(' | ')}` : 'a single square';
    const tolCm = Math.round((cell.w / 2 - TEJO_R) * 100);
    return {
      title: `Toss to square ${T.n}`,
      lines: [
        `Square ${T.n} is ${kind}. The tejo has to land completely inside it, not on a line.`,
        `First TAP locks the sideways sweep: lock it when the dot is in the green zone. Second TAP throws: the same for the distance. The green zone is the middle of the square: the tejo's centre may be about ${tolCm} cm off in each direction.`,
        `From here the sweeps move at ${Math.round(T.aim.sx * 100) / 100} and ${Math.round(T.aim.sz * 100) / 100} sweeps per second. Breathe, watch the dot come round, and tap as it enters the green.`,
      ],
    };
  }
  const pend = T.route.slice(T.si, T.si + 4);
  const mk = C.cells[T.cell] ? C.cells[T.cell].num : 0;
  const lines = pend.length ? pend.map((st, i) => `${i === 0 ? 'Next' : 'Then'}: ${stepText(C, st, mk)}.`) : ['Nothing left: you are done.'];
  lines.push(`Course rule: ${RULE_TEXT[C.rule]}`);
  lines.push('Tap on the beat: the ring closes on the square exactly on the beat.');
  return { title: 'The next squares', lines };
}

export function routeSummary(S) {
  const s = S.s, C = S.C, T = s.turn;
  const cell = C.cells[T.cell];
  const out = T.route.filter((r) => r.dir === 'out').map((r) => stepText(C, r, cell.num).replace(/: .*/, '')).join(', ');
  const lines = [`${s.players[s.cur].name} has the tejo in square ${T.n}${cell.kind === 'half' ? ` (the ${cell.side === 'L' ? 'left' : 'right'} half of a double)` : ''}.`];
  lines.push(`The run: ${T.route.length} landings at ${T.bpm} beats per minute. Out: ${out}. Then back the same way, with a PICK UP before square ${T.n}${cell.kind === 'half' ? ' (the other half is hopped on one foot on the way out)' : ''}.`);
  lines.push(`Course rule: ${RULE_TEXT[C.rule]}`);
  return lines.join(' ');
}

// REVEAL for the hop run: what the computer's taps are going to be (they were decided before the first beat)
export function planSummary(S) {
  const s = S.s, C = S.C, T = s.turn, tm = TIMING[s.cfg.timing];
  const risky = [], bad = [];
  for (const pk of T.plan) {
    const st = T.route[pk.i];
    if (!st) continue;
    const d = pk.t - st.t, ok = tm.ok;
    if (Math.abs(d) > ok) bad.push({ st, d });
    else if (Math.abs(d) > ok * 0.7) risky.push({ st, d });
  }
  const missing = T.route.filter((r) => !T.plan.some((p) => p.i === r.i));
  const wrongKey = T.plan.filter((p) => { const st = T.route[p.i]; return st && ((st.k === 'one' && p.act === 'B') || (st.k === 'both' && p.act !== 'B') || (st.k === 'pick' && p.act !== 'P')); });
  const parts = [];
  if (!bad.length && !missing.length && !wrongKey.length) parts.push('This run should go cleanly.');
  else {
    const first = [...bad.map((b) => ({ i: b.st.i, why: `${stepText(C, b.st)} comes ${ms(b.d)} ${b.d < 0 ? 'early' : 'late'}: it steps on a line` })),
      ...missing.map((r) => ({ i: r.i, why: `${stepText(C, r)}: the beat is missed` })), ...wrongKey.map((p) => ({ i: p.i, why: `${stepText(C, T.route[p.i])}: the wrong button is pressed` }))].sort((a, b) => a.i - b.i)[0];
    parts.push(`This run will go wrong at landing ${first.i + 1}: ${first.why}.`);
  }
  if (risky.length) parts.push(`Close calls: ${risky.slice(0, 3).map((r) => `landing ${r.st.i + 1} (${ms(r.d)} ${r.d < 0 ? 'early' : 'late'})`).join(', ')}.`);
  return parts.join(' ');
}

export function tossReasoning(S) {
  const s = S.s, T = s.turn, pl = s.players[s.cur], sk = SKILL[Math.max(0, Math.min(3, pl.level - 1))];
  const lv = LEVELS[Math.max(0, Math.min(3, pl.level - 1))];
  const cell = S.C.cells[T.cell];
  const tol = Math.round((cell.w / 2 - TEJO_R) * 100);
  const sd = Math.round(sk.toss * 100 * 10) / 10;
  return `${pl.name}${pl.name === lv.name ? '' : ` (${lv.name})`} tosses to square ${T.n}. The tejo must land within about ${tol} cm of the middle of the square. This player's aim wanders about ${sd} cm either way, so a toss is ${sd * 1.6 < tol ? 'very likely' : sd * 1.1 < tol ? 'likely' : 'a real risk'} to land inside. The sweep speeds are ${Math.round(T.aim.sx * 100) / 100} and ${Math.round(T.aim.sz * 100) / 100} per second (range ${Math.round(AIM_RANGE.x * 200)} cm).`;
}
