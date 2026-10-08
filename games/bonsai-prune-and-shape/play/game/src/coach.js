// The coach: the one planner behind Hint and Watch and Learn. It reads the tree like a teacher and proposes ONE next action with a reason.
// Pure: it only reads the tree. Actions: { kind: 'unwire'|'wire'|'snip'|'pinch'|'wait', limb, seg, t, delta, x, y, why, short }.
import { geo, descendants, limbLen, wireCount, MAX_WIRES, seasonIdx, SET_T, wrap, UP, snip, pinch, maxBend, wireStart, wireDrag, wireRelease, wireRemove } from './tree.js';
import { measure } from './judge.js';
import { commissionById, SPECIES } from './species.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// slanting: the low branch that reaches out on the side opposite the lean, which the style needs and the coach must not cut
function lowOpposite(T, m) {
  let best = null; for (const L of T.limbs) { if (L.ord !== 1) continue; const e = L.g.pts[L.g.pts.length - 1]; if (e.x * m.side < 0 && -L.g.pts[0].y < m.H * 0.5 && (!best || -L.g.pts[0].y < -best.g.pts[0].y)) best = L; }
  return best;
}
// the lowest trunk segment at or above s thin enough to take a useful bend (a thick trunk barely bends)
const capSeg = (trunk, s) => { const last = Math.max(1, trunk.segs.length - 4); while (s < last && maxBend(trunk.segs[s].th) < 0.5) s++; return Math.min(s, Math.max(1, trunk.segs.length - 3)); };
const atLength = (L, len) => { let acc = 0; for (let i = 0; i < L.segs.length; i++) { if (acc + L.segs[i].l >= len) return { seg: i, t: Math.max(0.2, Math.min(1, (len - acc) / L.segs[i].l)) }; acc += L.segs[i].l; } const i = L.segs.length - 1; return { seg: i, t: 0.8 }; };
const pt = (L, seg, t) => { const a = L.g.pts[seg], b = L.g.pts[seg + 1]; return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; };
const LEAN = { formal: 0, informal: 6, slanting: 34, windswept: 30, cascade: 42 };

export function advise(T) {
  const com = commissionById(T.comId), st = com.style, sp = SPECIES[T.species], G = geo(T), m = measure(T), trunk = T.limbs[0];
  const season = seasonIdx(T);
  // 1. a set wire comes off before it bites
  for (const L of T.limbs) if (L.wire && !L.wire.end && !L.wire.drag && L.wire.age >= SET_T) {
    const p = pt(L, Math.min(L.wire.s, L.segs.length - 1), 0.5);
    return { kind: 'unwire', limb: L.id, ...p, short: 'Take the wire off', why: 'The bend has set, so the wire has done its job. Take it off now: left on, it bites into the bark and scars the tree.' };
  }
  const trunkWired = trunk.wire && !trunk.wire.end;
  const free = wireCount(T) < MAX_WIRES;
  const trunkLen = limbLen(trunk);
  // 2. the line of the trunk
  if (!trunkWired && free && trunkLen > 70) {
    const want = LEAN[st], side = m.side * (T.limbs[0].g.ang[0] > UP ? 1 : -1) || 1;
    const ang0 = trunk.g.ang[1] ?? UP;
    if (st === 'formal') {
      if (m.absLean > 5 || m.maxDev > 10) { const n = trunk.segs.length, s0 = capSeg(trunk, 1), dev = wrap(UP - trunk.g.ang[Math.min(n - 1, s0 + 2)]); if (Math.abs(dev) > 0.06) return { kind: 'wire', limb: trunk.id, seg: s0, delta: dev, ...pt(trunk, Math.min(n - 1, s0 + 1), 0.5), short: 'Wire the trunk upright', why: 'A formal upright trunk is straight and vertical. Wire the trunk where it is still thin and bend it back to upright.' }; }
    } else if (st === 'informal') {
      if (m.bends < 2 && trunkLen > (m.bends === 0 ? 90 : 150)) {
        const n = trunk.segs.length, s = capSeg(trunk, Math.max(1, Math.floor(n * (m.bends === 0 ? 0.3 : 0.62)))), chord = -Math.PI / 2 + (m.lean * Math.PI) / 180, dd = wrap(trunk.g.ang[Math.min(s, n - 1)] - chord);
        const dir = m.bends === 0 ? (Math.abs(dd) > 0.1 ? -Math.sign(dd) : m.side || 1) : -Math.sign(dd || 1);
        return { kind: 'wire', limb: trunk.id, seg: s, delta: 0.72 * dir, ...pt(trunk, Math.min(n - 1, s + 1), 0.5), short: m.bends === 0 ? 'Add a bend to the trunk' : 'Bend the trunk back the other way', why: 'An informal upright trunk moves in gentle S curves. Wire a bend into the trunk, then another the other way above it, with the apex coming back over the base.' }; }
      if (m.bends >= 2 && Math.abs(m.apexOff) > 0.18) { const n = trunk.segs.length, s = capSeg(trunk, Math.max(1, Math.floor(n * 0.72))); return { kind: 'wire', limb: trunk.id, seg: s, delta: -Math.sign(m.hi.x) * 0.55, ...pt(trunk, Math.min(n - 1, s + 1), 0.5), short: 'Bring the apex back over the base', why: 'The top of an informal upright comes back over the base of the trunk. Wire the upper trunk and bend the apex back toward the middle.' }; }
    } else if (st === 'cascade') {
      const n = trunk.segs.length, head = trunk.g.ang[n - 1], dn = wrap(Math.PI / 2 - head);
      if (m.depth < 110 && trunkLen > 110 && Math.abs(dn) > 0.5) { const s = Math.max(1, n - 4); return { kind: 'wire', limb: trunk.id, seg: s, delta: clamp(dn * 0.9, -1.5, 1.5), ...pt(trunk, Math.min(n - 1, s + 1), 0.5), short: 'Bend the trunk over the rim', why: 'A cascade first rises, then spills over the rim. Wire the upper trunk and bend the tip down and outward; repeat as it grows until the tip hangs below the pot.' }; }
    } else {
      const low = st === 'slanting' ? 22 : 15;
      if (m.absLean < low + 4) { const need = ((want - m.absLean) * Math.PI) / 180; const s0 = capSeg(trunk, 1); return { kind: 'wire', limb: trunk.id, seg: s0, delta: need * side, ...pt(trunk, Math.min(trunk.segs.length - 1, s0 + 1), 0.5), short: 'Lean the trunk', why: `${st === 'slanting' ? 'A slanting' : 'A windswept'} trunk leans. Wire the lower trunk over to ${side > 0 ? 'the right' : 'the left'}.` }; }
    }
    void ang0;
  }
  // 3. too tall and thin for its trunk: cut the top back (upright styles only)
  if ((st === 'formal' || st === 'informal') && m.H / m.trunkBase > 40 && trunkLen > 160) {
    const at = atLength(trunk, trunkLen * 0.68), p = pt(trunk, at.seg, at.t);
    return { kind: 'snip', limb: trunk.id, seg: at.seg, t: at.t, ...p, short: 'Cut the trunk back', why: 'The tree is tall and thin for the thickness of its trunk. Cutting the trunk back makes it look sturdy and sends new shoots from the cut.' };
  }
  // 5. crowded foliage: remove the whole branch whose clouds overlap their neighbours the most (never more than a fifth of the foliage at once)
  const cut5 = () => {
    if ((m.fill <= 0.8 && G.pads.length <= 34) || G.pads.length < 12) return null;
    const tot = G.pads.reduce((q, p) => q + p.r * p.r, 0), kids = descendants(T, 0);
    void kids;
    let bestL = null, bs = 0;
    for (const L of T.limbs) {
      if (L.ord < 1) continue;
      if (st === 'slanting' && lowOpposite(T, m)?.id === L.id) continue;
      if (G.pads.length < 60 && L.ord === 1 && -L.g.pts[0].y < m.H * 0.3) continue;
      const sub = descendants(T, L.id), ps = G.pads.filter((p) => sub.has(p.limb)); if (!ps.length) continue;
      const area = ps.reduce((q, p) => q + p.r * p.r, 0); if (area / tot > 0.2) continue;
      let ov = 0; for (const p of ps) for (const q of G.pads) if (!sub.has(q.limb) && Math.hypot(p.x - q.x, p.y - q.y) < (p.r + q.r) * 0.62) ov++;
      const sc = ov / Math.sqrt(area); if (sc > bs) { bs = sc; bestL = L; }
    }
    if (!bestL) return null;
    const p = pt(bestL, 0, 0.1);
    return { kind: 'snip', limb: bestL.id, seg: 0, t: 0.1, ...p, short: 'Thin a crowded branch', why: 'The foliage is crowded, so there is no air between the clouds. Remove a whole branch that overlaps its neighbours. Negative space is part of the design.' };
  };
  const thin = cut5(); if (thin) return thin;
  // 4. branches that run too long, longest first
  const trunkH = Math.max(60, m.H);
  const prot = st === 'slanting' ? lowOpposite(T, m) : null;
  const maxBr = (L) => {
    if (prot && L.id === prot.id) return 150;
    const root = L.ord === 1 ? L : null, f = root ? clamp(-root.g.pts[0].y / trunkH, 0, 1) : 0.5;
    const base = st === 'formal' ? 86 - 52 * f : st === 'cascade' ? 85 : 80;
    return base * (L.ord === 1 ? 1 : 0.55);
  };
  let worst = null; for (const L of T.limbs) { if (L.ord === 0) continue; const len = limbLen(L); if (len > maxBr(L) && (!worst || len > worst.len)) worst = { L, len }; }
  if (worst) {
    const L = worst.L, at = atLength(L, worst.len * 0.55), p = pt(L, at.seg, at.t);
    return { kind: 'snip', limb: L.id, seg: at.seg, t: at.t, ...p, short: 'Cut the long branch back', why: 'This branch has grown past its place in the shape. Cut it back to a shorter length so the tree keeps its outline and the cut makes it branch.' };
  }
  // 6. pinch soft tips in the growing seasons to make the pads dense and short
  if (season <= 1 && G.pads.length < 26) {
    let best = null; for (const L of T.limbs) if (L.ord >= 1 && L.tip && L.pin === 0 && limbLen(L) > 28 && !(prot && L.id === prot.id)) { const e = L.g.pts[L.g.pts.length - 1], d = Math.hypot(e.x, e.y); if (!best || d > best.d) best = { L, d, e }; }
    if (best) return { kind: 'pinch', limb: best.L.id, x: best.e.x, y: best.e.y, short: 'Pinch the soft tip', why: 'Pinching a soft growing tip stops the branch lengthening. Next spring it makes new buds behind the pinch, so the foliage pad grows denser and stays small.' };
  }
  return { kind: 'wait', short: 'Let it grow', why: season === 3 ? 'Winter: nothing grows. Look at the bare structure and the dormant buds now, and plan your spring.' : 'Nothing needs doing right now. Let the tree grow and watch where the tips are heading.' };
}

// Does one advised action at once (used by Hint's "do it" for the quick kinds, and by the demo trees).
export function applyAdvice(T, a) {
  if (!a || a.kind === 'wait') return null;
  const L = T.limbs.find((q) => q.id === a.limb); if (!L) return null;
  if (a.kind === 'snip') return snip(T, a.limb, a.seg, a.t);
  if (a.kind === 'pinch') return { ok: pinch(T, a.limb) };
  if (a.kind === 'unwire') return { ok: wireRemove(T, L) };
  if (a.kind === 'wire') { if (!wireStart(T, L, a.seg)) return null; wireDrag(L, a.delta); wireRelease(L); return { ok: true }; }
  return null;
}
