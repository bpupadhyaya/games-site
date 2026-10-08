// The abacus engine: rods hold a digit 0..9 (heaven bead = 5, earth beads = 1 each), and a plan engine that turns "add / take away N"
// into the exact bead moves a soroban teacher would make, each with a one-line reason. Pure and deterministic.
export const PLACE = ['ones', 'tens', 'hundreds', 'thousands', 'ten-thousands', 'hundred-thousands', 'millions'];
export const placeName = (r) => PLACE[r] ?? `10^${r}`;
export const maxOf = (rods) => 10 ** rods - 1;
export const digitsOf = (n, rods) => { const a = []; let v = Math.max(0, Math.floor(n)); for (let i = 0; i < rods; i++) { a.push(v % 10); v = Math.floor(v / 10); } return a; };
export const valueOf = (a) => { let v = 0; for (let i = a.length - 1; i >= 0; i--) v = v * 10 + a[i]; return v; };
export const heavenOf = (d) => (d >= 5 ? 1 : 0);
export const earthOf = (d) => d % 5;
const beads = (n) => (n === 1 ? '1 earth bead' : `${n} earth beads`);

function move(out, a, r, to, kind, text) {
  out.steps.push({ rod: r, from: a[r], to, kind, text });
  a[r] = to;
}
function note(out, a, r, kind, text) { out.steps.push({ rod: r, from: a[r], to: a[r], kind, text }); }

function addDigit(a, r, d, out) {
  if (!d) return;
  if (r >= a.length) { out.error = 'overflow'; return; }
  const cur = a[r], p = placeName(r), e = cur % 5;
  if (cur + d <= 9) {
    if (d < 5) {
      if (e + d <= 4) move(out, a, r, cur + d, 'direct', `Push ${beads(d)} up to the beam on the ${p} rod.`);
      else {
        move(out, a, r, cur + 5, 'five', `${4 - e === 0 ? 'No earth beads are left to push' : `Only ${4 - e} earth bead${4 - e === 1 ? ' is' : 's are'} left to push`}, and you need ${d}. Use the five-friend: +${d} = +5 - ${5 - d}. Bring the heaven bead down (+5)...`);
        move(out, a, r, cur + d, 'five', `...then push ${beads(5 - d)} away from the beam (-${5 - d}). Net +${d}.`);
      }
    } else {
      move(out, a, r, cur + 5, 'heaven', `Pull the heaven bead down to the beam on the ${p} rod: +5.`);
      if (d > 5) move(out, a, r, cur + d, 'heaven', `Then push ${beads(d - 5)} up to the beam: +${d - 5}. Together +${d}.`);
    }
  } else {
    note(out, a, r, 'carry', `${cur} + ${d} = ${cur + d} does not fit on one rod. Use the ten-friend: +${d} = +10 - ${10 - d}. Carry 1 to the next rod, then take ${10 - d} off this one.`);
    addDigit(a, r + 1, 1, out);
    subDigit(a, r, 10 - d, out, true);
  }
}

function subDigit(a, r, d, out, quiet = false) {
  if (!d) return;
  if (r >= a.length) { out.error = 'underflow'; return; }
  const cur = a[r], p = placeName(r), e = cur % 5;
  if (cur >= d) {
    if (d < 5) {
      if (e >= d) move(out, a, r, cur - d, 'direct', `Push ${beads(d)} away from the beam on the ${p} rod.`);
      else {
        move(out, a, r, cur - 5, 'five', `Only ${e} earth bead${e === 1 ? ' is' : 's are'} up, so ${d} cannot come off them. Use the five-friend: -${d} = -5 + ${5 - d}. Lift the heaven bead away (-5)...`);
        move(out, a, r, cur - d, 'five', `...then bring ${beads(5 - d)} up to the beam (+${5 - d}). Net -${d}.`);
      }
    } else {
      move(out, a, r, cur - 5, 'heaven', `Lift the heaven bead away from the beam on the ${p} rod: -5.`);
      if (d > 5) move(out, a, r, cur - d, 'heaven', `Then push ${beads(d - 5)} away: -${d - 5}. Together -${d}.`);
    }
  } else {
    if (!quiet) note(out, a, r, 'borrow', `${d} is more than the ${cur} on this rod. Borrow 1 from the next rod (worth 10 here), then add the ten-friend: -${d} = -10 + ${10 - d}.`);
    subDigit(a, r + 1, 1, out, true);
    addDigit(a, r, 10 - d, out);
  }
}

// plan(digits, '+'|'-', n): the bead moves, high place first. Returns { steps, after, kinds, error }.
export function plan(digits, op, n) {
  const a = digits.slice(), out = { steps: [], error: null };
  const nd = digitsOf(n, a.length);
  if (n > maxOf(a.length)) out.error = 'overflow';
  for (let p = a.length - 1; p >= 0 && !out.error; p--) {
    const d = nd[p];
    if (!d) continue;
    note(out, a, p, 'place', `${op === '+' ? 'Add' : 'Take away'} ${d} on the ${placeName(p)} rod${n >= 10 ? ` (${d * 10 ** p} of the ${n})` : ''}.`);
    if (op === '+') addDigit(a, p, d, out); else subDigit(a, p, d, out);
  }
  if (!out.error) { const want = op === '+' ? valueOf(digits) + n : valueOf(digits) - n; if (want < 0 || valueOf(a) !== want) out.error = 'range'; }
  const kinds = new Set(out.steps.map((s) => s.kind));
  return { steps: out.steps, after: a, kinds, error: out.error };
}

// The plan from the CURRENT abacus to a target total (used by hints), or null when no plan is needed.
export function planTo(digits, target) {
  const cur = valueOf(digits);
  if (cur === target) return null;
  return target > cur ? plan(digits, '+', target - cur) : plan(digits, '-', cur - target);
}

// Which technique does this single operation need? 'direct' < 'heaven' < 'five' < 'carry' / 'borrow'
export function techOf(digits, op, n) { const p = plan(digits, op, n); return p.error ? null : p.kinds; }

// ---- multiplication by partial products: x * m, each digit of x (high place first) gives one addition --------------------------
export function mulOps(x, m) {
  const ds = digitsOf(x, 8), ops = [];
  for (let p = 7; p >= 0; p--) {
    const d = ds[p]; if (!d) continue;
    const part = d * m * 10 ** p;
    ops.push({ op: '+', n: part, label: `${d} x ${m} = ${d * m} at the ${placeName(p)} place: add ${part}`, why: `The ${d} sits in the ${placeName(p)} place, so ${d} x ${m} = ${d * m} is added as ${part}.` });
  }
  return ops;
}

// Running targets of an exercise: start, then each op applied.
export function targetsOf(start, ops) {
  const t = []; let v = start;
  for (const o of ops) { v = o.op === '+' ? v + o.n : o.op === '-' ? v - o.n : o.n; t.push(v); }
  return t;
}
export const fmt = (n) => String(n);
