// Judging: measurements of the tree and 0-100 scores with a plain-words reason for each. Pure.
import { geo, wrap, clamp } from './tree.js';
import { STYLES, potById, commissionById } from './species.js';

const band = (v, lo, hi, soft) => (v >= lo && v <= hi ? 1 : Math.max(0, 1 - (v < lo ? lo - v : v - hi) / soft));
const deg = (r) => (r * 180) / Math.PI;
export const WEIGHTS = { style: 0.36, balance: 0.1, taper: 0.12, space: 0.16, health: 0.1, pot: 0.16 };
export const CRITERIA = ['style', 'balance', 'taper', 'space', 'health', 'pot'];
export const CRIT_NAME = { style: 'Style fit', balance: 'Balance', taper: 'Taper', space: 'Negative space', health: 'Health', pot: 'Pot' };

export function measure(T) {
  const G = geo(T), trunk = T.limbs[0], tp = trunk.g.pts, ang = trunk.g.ang;
  const apex = tp[tp.length - 1];
  let hi = tp[0]; for (const p of tp) if (p.y < hi.y) hi = p;
  const b = G.bounds, top = Math.min(b.y0, 0), H = Math.max(40, -top), W = Math.max(30, b.x1 - b.x0);
  const chord = Math.atan2(hi.x, Math.max(1, -hi.y));
  const lean = deg(chord);                                  // signed, positive = to the right
  // bends: sign changes of the trunk heading around its chord, with 7 degree hysteresis
  let bends = 0, sgn = 0; const chordHeading = -Math.PI / 2 + chord;
  for (let i = 0; i < ang.length; i++) { const d = deg(wrap(ang[i] - chordHeading)); if (Math.abs(d) < 7) continue; const s = d > 0 ? 1 : -1; if (sgn && s !== sgn) bends++; sgn = s; }
  let maxDev = 0; for (let i = 0; i < ang.length; i++) maxDev = Math.max(maxDev, Math.abs(deg(wrap(ang[i] - chordHeading))));
  let A = 0, cx = 0, cy = 0; for (const p of G.pads) { const a = p.r * p.r; A += a; cx += p.x * a; cy += p.y * a; }
  const comX = A ? cx / A : 0, comY = A ? cy / A : 0;
  const side = lean >= 0 ? 1 : -1;
  let right = 0, left = 0; for (const p of G.pads) { if (p.x > 0) right += p.r * p.r; else left += p.r * p.r; }
  const shareLean = A ? (side > 0 ? right : left) / A : 0.5;
  // occupancy grid for negative space
  const cell = 9, rows = Math.max(1, Math.ceil((b.y1 - b.y0) / cell)), cols = Math.max(1, Math.ceil((b.x1 - b.x0) / cell));
  let marked = 0, env = 0;
  for (let r = 0; r < rows; r++) {
    const y = b.y0 + (r + 0.5) * cell; let lo = 1e9, hiC = -1e9, n = 0;
    for (let c = 0; c < cols; c++) {
      const x = b.x0 + (c + 0.5) * cell; let on = false;
      for (const p of G.pads) { const dx = x - p.x, dy = y - p.y; if (dx * dx + dy * dy < p.r * p.r * 0.84) { on = true; break; } }
      if (on) { n++; lo = Math.min(lo, c); hiC = Math.max(hiC, c); }
    }
    if (n) { marked += n; env += hiC - lo + 1; }
  }
  const fill = env ? marked / env : 0;
  // widths by thirds of the foliage height
  const fy0 = Math.min(...G.pads.map((p) => p.y), 0), fy1 = Math.max(...G.pads.map((p) => p.y), -1), third = Math.max(1, (fy1 - fy0) / 3 + 0.001);
  const wd = [0, 1, 2].map((k) => { const ps = G.pads.filter((p) => Math.min(2, Math.floor((p.y - fy0) / third)) === 2 - k); if (!ps.length) return 0; return Math.max(...ps.map((p) => p.x + p.r)) - Math.min(...ps.map((p) => p.x - p.r)); });  // wd[0] = lowest third
  const widths = { low: wd[0], mid: wd[1], top: wd[2] };
  const firstPad = G.pads.length ? Math.max(...G.pads.filter((p) => p.limb !== trunk.id).map((p) => -(p.y + p.r))) : 0;
  let lowBranch = 1e9; for (const L of T.limbs) if (L.ord === 1) lowBranch = Math.min(lowBranch, -L.g.pts[0].y);
  if (lowBranch === 1e9) lowBranch = 0;
  // opposite low branch: the lowest ord-1 limb on the side opposite the lean
  let opp = 0; for (const L of T.limbs) if (L.ord === 1) { const e = L.g.pts[L.g.pts.length - 1]; if (-L.g.pts[0].y < H * 0.5 && e.x * side < 0) opp = Math.max(opp, Math.abs(e.x)); }
  let sweep = 0, nb = 0; for (const L of T.limbs) if (L.ord === 1) { const e = L.g.pts[L.g.pts.length - 1], s = L.g.pts[0]; nb++; if ((e.x - s.x) * side > 6) sweep++; }
  const ths = trunk.segs.map((s) => s.th);
  let inv = 0, jump = 0; for (let i = 0; i < ths.length - 1; i++) { if (ths[i + 1] > ths[i] * 1.06) inv++; if (ths[i + 1] < ths[i] * 0.6) jump++; }
  let thick = 0, thin = 0; for (const L of T.limbs) if (L.ord === 1) { const at = trunk.segs[Math.min(L.at, trunk.segs.length - 1)].th; if (L.segs[0].th > at * 0.85) thick++; else thin++; }
  return { H, W, lean, absLean: Math.abs(lean), bends, maxDev, apex, hi, apexOff: hi.x / H, comX, comY, shareLean, side, fill, widths, firstPad, lowBranch, opp, sweep, nb, ths, inv, jump, thick, thin, area: A, pads: G.pads.length, trunkBase: ths[0] ?? 3, rise: -hi.y, depth: apex.y };
}

function styleFit(st, m) {
  switch (st.id) {
    case 'formal': {
      const tri = band(m.widths.low / Math.max(1, m.widths.mid), 1.0, 3, 0.7) * 0.5 + band(m.widths.mid / Math.max(1, m.widths.top), 1.0, 3, 0.7) * 0.5;
      const v = band(m.absLean, 0, 5, 12) * 0.3 + band(m.maxDev, 0, 10, 16) * 0.2 + tri * 0.25 + band(m.W / m.H, 0.5, 0.95, 0.35) * 0.25;
      return { v, why: `The trunk leans ${m.absLean.toFixed(0)} degrees (formal upright wants 0 to 6) and its widest crown is ${m.widths.low >= m.widths.mid ? 'at the bottom, as it should be' : 'not at the bottom, so the triangle is lost'}.` };
    }
    case 'informal': {
      const v = band(m.bends, 2, 3, 1.3) * 0.4 + band(Math.abs(m.apexOff), 0, 0.15, 0.25) * 0.35 + band(m.widths.low / Math.max(1, m.widths.top), 0.9, 4, 0.8) * 0.25;
      return { v, why: `The trunk has ${m.bends} bend${m.bends === 1 ? '' : 's'} (informal upright wants 2 or 3) and the apex sits ${Math.round(Math.abs(m.apexOff) * 100)} percent of the height from the base line.` };
    }
    case 'slanting': {
      const v = band(m.absLean, 22, 48, 16) * 0.5 + band(m.opp / m.H, 0.25, 0.6, 0.15) * 0.3 + band(m.bends, 0, 1, 2) * 0.2;
      return { v, why: `The trunk leans ${m.absLean.toFixed(0)} degrees (slanting wants 22 to 48)${m.opp > 0 ? ' and a low branch reaches the other way' : ' but nothing balances it on the other side'}.` };
    }
    case 'windswept': {
      const sw = m.nb ? m.sweep / m.nb : 0;
      const v = band(m.absLean, 15, 50, 16) * 0.3 + band(m.shareLean, 0.7, 1, 0.3) * 0.4 + band(sw, 0.7, 1, 0.4) * 0.3;
      return { v, why: `${Math.round(m.shareLean * 100)} percent of the foliage and ${Math.round(sw * 100)} percent of the branches lean the same way as the trunk (windswept wants about 70 or more).` };
    }
    default: {
      const v = band(m.depth, 90, 400, 100) * 0.6 + band(m.rise, 50, 400, 50) * 0.25 + band(m.shareLean, 0.6, 1, 0.3) * 0.15;
      return { v, why: `The apex hangs ${Math.round(m.depth)} units below the pot rim (a cascade wants well below the base of the pot) after rising ${Math.round(m.rise)} first.` };
    }
  }
}

export function judge(T, potId) {
  const com = commissionById(T.comId), st = STYLES[com.style], m = measure(T), pot = potById(potId ?? T.potId ?? st.pot);
  const s = styleFit(st, m);
  const off = m.comX / Math.max(30, m.W) * m.side * (st.id === 'formal' || st.id === 'informal' ? 0 : 1) + (st.id === 'formal' || st.id === 'informal' ? Math.abs(m.comX) / m.W : 0);
  const balRange = st.id === 'formal' || st.id === 'informal' ? [0, 0.1] : st.id === 'cascade' ? [0, 0.5] : [0.08, 0.4];
  const bal = band(off, balRange[0], balRange[1], 0.3) * 0.85 + band(-m.comY / m.H, 0.25, 0.65, 0.3) * 0.15;
  const ratio = m.ths[0] / Math.max(0.5, m.ths[m.ths.length - 1]);
  const tap = band(ratio, 1.8, 9, 1.8) * 0.25 + band(m.H / m.trunkBase, 6, 30, 14) * 0.3 + Math.max(0, 1 - m.inv * 0.2 - m.jump * 0.25) * 0.25 + (m.thick + m.thin ? m.thin / (m.thick + m.thin) : 1) * 0.2;
  const space = band(m.fill, 0.5, 0.84, 0.12) * 0.4 + band(m.lowBranch / m.H, 0.12, 0.4, 0.15) * 0.15 + band(m.pads, 8, 34, 20) * 0.45;
  const health = T.health / 100;
  const match = pot.id === st.pot ? 1 : { rect: ['drum', 'oval'], oval: ['round', 'rect', 'drum'], round: ['oval', 'drum'], drum: ['rect', 'round'], tall: [], slab: ['rect'] }[st.pot].includes(pot.id) ? 0.65 : 0.25;
  const widthRatio = pot.w / Math.max(40, m.H);
  const potS = match * 0.55 + band(widthRatio, 0.3, 0.95, 0.3) * 0.45;
  const raw = { style: s.v, balance: bal, taper: tap, space, health, pot: potS };
  const score = {}; let total = 0;
  for (const k of CRITERIA) { score[k] = Math.round(clamp(raw[k], 0, 1) * 100); total += raw[k] * WEIGHTS[k]; }
  total = Math.round(clamp((total - 0.3) / 0.64, 0, 1) * 100);   // a tree left alone earns about 60; fine work reaches the 90s
  const word = (v) => (v >= 85 ? 'Excellent.' : v >= 65 ? 'Good.' : v >= 45 ? 'Needs work.' : 'Weak.');
  const why = {
    style: `${word(score.style)} ${s.why}`,
    balance: `${word(score.balance)} The foliage's centre of weight is ${Math.abs(m.comX / Math.max(30, m.W) * 100).toFixed(0)} percent of the width off the trunk line; ${st.id === 'formal' || st.id === 'informal' ? 'upright styles want it nearly centred' : st.id === 'cascade' ? 'a cascade can hang to one side' : 'this style wants the weight on the side of the lean'}.`,
    taper: `${word(score.taper)} The trunk is ${m.ths[0].toFixed(1)} wide at the base and ${m.ths[m.ths.length - 1].toFixed(1)} at the top, and the tree is ${(m.H / m.trunkBase).toFixed(0)} trunk widths tall (about 6 to 30 reads as sturdy for a young tree)${m.jump ? '; a hard chop left an abrupt step' : m.inv ? '; a thickening above a thinner part spoils the line' : ''}.`,
    space: `${word(score.space)} ${Math.round(m.fill * 100)} percent of the crown outline is filled with foliage; about half to five sixths reads as clouds with air between them, and ${m.pads} foliage clouds ${m.pads > 34 ? 'is too many: thin it to a few clear pads' : m.pads < 8 ? 'is too few' : 'is a good number'}.`,
    health: `${word(score.health)} ${T.shocks ? `You removed too much at once ${T.shocks} time${T.shocks === 1 ? '' : 's'} (keep a cut under a third of the foliage). ` : ''}${T.bites ? `${T.bites} wire${T.bites === 1 ? '' : 's'} bit into the bark; take wire off once it has set. ` : ''}${!T.shocks && !T.bites ? 'No shocks and no wire scars.' : ''}`,
    pot: `${word(score.pot)} The ${pot.name.toLowerCase()} pot ${match >= 1 ? 'suits' : match >= 0.65 ? 'nearly suits' : 'does not suit'} this style, and its width is ${Math.round(widthRatio * 100)} percent of the tree height (good is about a third to nearly the full height of a small tree).`,
  };
  const stars = total >= 85 ? 3 : total >= 66 ? 2 : 1;
  return { total, stars, score, why, m, pot: pot.id };
}
