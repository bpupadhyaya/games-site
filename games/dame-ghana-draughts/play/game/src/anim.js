// Move animation as plain data + pure functions of (data, time): the piece hops along its landing squares leg by leg,
// each jumped piece lifts off as the hopper passes over it, and a crowned man gets a stamp at the end. No clock here: game.js advances `t`.
export function makeAnim(pre, move, side, calm = false) {
  const n = Math.round(Math.sqrt(pre.length)), legs = [];
  let at = move.from, t = 0;
  const kk = calm ? 0.6 : 1;
  move.path.forEach((to, k) => {
    const d = Math.max(Math.abs(Math.floor(to / n) - Math.floor(at / n)), 1), cap = move.caps[k] ?? -1;
    const dur = (cap >= 0 ? 0.38 + 0.025 * d : 0.24 + 0.03 * d) * kk;
    legs.push({ from: at, to, cap, t0: t, t1: t + dur }); t += dur; at = to;
  });
  const piece = pre[move.from], crowned = Math.abs(piece) === 1 && Math.floor(move.to / n) === (side === 1 ? 0 : n - 1);
  return { pre: pre.slice(), move: { from: move.from, to: move.to, path: move.path.slice(), caps: move.caps.slice() }, side, king: Math.abs(piece) === 2, crowned, legs, t: 0, moveEnd: t, dur: t + (crowned ? 0.35 * kk : 0.05), leg: 0 };
}
const ease = (f) => f * f * (3 - 2 * f);
export function animLegAt(a, t = a.t) { for (let i = 0; i < a.legs.length; i++) if (t < a.legs[i].t1) return i; return a.legs.length - 1; }
export function animPos(a, geo) {
  const t = a.t, k = animLegAt(a, t), L = a.legs[k], f = Math.max(0, Math.min(1, (t - L.t0) / (L.t1 - L.t0)));
  const p0 = geo.center(L.from), p1 = geo.center(L.to), e = ease(f);
  const stamp = a.crowned && t > a.moveEnd ? Math.max(0, 1 - (t - a.moveEnd) / 0.35) : 0;
  return { x: p0.x + (p1.x - p0.x) * e, y: p0.y + (p1.y - p0.y) * e, lift: Math.sin(Math.PI * f) * (L.cap >= 0 ? 1.0 : 0.4), king: a.king || (a.crowned && t >= a.moveEnd), stamp };
}
export function animRemoved(a) {
  const s = new Set();
  for (const L of a.legs) if (L.cap >= 0 && a.t >= (L.t0 + L.t1) / 2) s.add(L.cap);
  return s;
}
export function animEffects(a, geo) {
  const out = [], n = geo.n;
  a.legs.forEach((L, i) => {
    if (L.cap < 0) return;
    const mid = (L.t0 + L.t1) / 2, dt = a.t - mid;
    if (dt >= 0 && dt < 0.5) {
      const f = dt / 0.5, c = geo.center(L.cap), pp = a.pre[L.cap], dir = Math.sign(L.to - L.from) || 1;
      out.push({ type: 'chip', x: c.x + dir * f * 26, y: c.y - f * 40 + f * f * 60, s: 1 - 0.25 * f, a: 1 - f, side: Math.sign(pp), lift: 0.6 * (1 - f) });
      for (let j = 0; j < 6; j++) { const ang = j * 1.047 + i, d = f * geo.cell * 0.6; out.push({ type: 'spark', x: c.x + Math.cos(ang) * d, y: c.y + Math.sin(ang) * d, r: 3.5 * (1 - f), a: 0.9 * (1 - f) }); }
    }
    const land = a.t - L.t1;
    if (land >= 0 && land < 0.35) { const c = geo.center(L.to); out.push({ type: 'ring', x: c.x, y: c.y, k: land / 0.35, a: 1 - land / 0.35 }); }
  });
  return out;
}
