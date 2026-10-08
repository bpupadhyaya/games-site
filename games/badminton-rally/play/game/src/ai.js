// Shot choice for the computer players, the coach (Think) and Watch & Learn. It looks at every stroke the contact height allows, solves each
// one with the real physics, and scores it by: will it land in (with the player's aiming error), can the opponent get there in time,
// how safe is it if he does. The level sets how well it reads the court and how random it is; the style tilts the choice.
import { HW, HL, STYLES, LEVELS, SHOTS } from './consts.js';
import { OPTIONS, SERVES, planShot, powerTable, DEPTH, AIM_X, shotName, clamp } from './shots.js';

const erf = (x) => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
const Phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
const sig = (x) => 1 / (1 + Math.exp(-x));

const BASE = { smash: 0.1, drive: 0.04, drop: 0.0, clear: -0.02, lift: -0.09, net: 0.0, push: 0.0, block: -0.03, safe: -0.12, serveShort: 0.02, serveLong: -0.02 };

// aiming error (1 sigma, metres) for a stroke over distance D at execution quality q (1 = perfect timing) and level aim scale
export function errSigma(D, q, aim) {
  const k = aim * (1 + 1.7 * (1 - q));
  return { sx: (0.07 + 0.042 * D) * k, sz: (0.05 + 0.038 * D) * k };
}

export function aimsFor(type, side, serveSign) {
  const out = [];
  if (type === 'serveShort' || type === 'serveLong') {
    for (const a of [0.45, 1.25, 2.1]) for (const f of [0.25, 0.75]) out.push({ x: serveSign * a, f });
    return out;
  }
  const xs = type === 'net' || type === 'drop' ? [-2.0, -1.0, 0, 1.0, 2.0] : [-2.15, -1.2, -0.35, 0.35, 1.2, 2.15];
  const fs = type === 'smash' ? [0.15, 0.7] : type === 'clear' || type === 'lift' || type === 'drive' ? [0.55, 0.9] : [0.25, 0.7];
  for (const x of xs) for (const f of fs) out.push({ x, f });
  return out;
}

const depthOf = (type, f) => { const r = DEPTH[type] || DEPTH.safe; const ff = type === 'smash' ? 1 - f * 0.9 : f; return r[0] + (r[1] - r[0]) * clamp(ff, 0, 1); };

// ctx = { side, contact, cls, me: { L (level object), style }, opp: { x, z, vx, vz, L }, caps, serve (bool), serveSign, quality (expected execution quality), rush (0..1) }
export function evaluate(ctx) {
  const { side, contact, cls, me, opp } = ctx;
  const L = me.L, OL = opp.L;
  const types = ctx.serve ? SERVES : OPTIONS[cls];
  const sty = STYLES[me.style] || STYLES.allround;
  const list = [];
  for (const type of types) {
    for (const a of aimsFor(type, side, ctx.serveSign)) {
      const aim = { x: a.x, d: depthOf(type, a.f) };
      const r = planShot(type, contact, aim, side, ctx.caps);
      if (!r) continue;
      const D = Math.hypot(r.landX - contact.x, r.landZ - contact.z);
      const sg = errSigma(D, ctx.quality, L.aim);
      let pIn;
      if (ctx.serve) {
        const sx0 = Math.min(0.2, 0.2), sx1 = HW;      // box in |x| terms, on the diagonal side
        const dx = r.landX * ctx.serveSign;
        const pxx = Phi((sx1 - dx) / sg.sx) - Phi((sx0 - dx) / sg.sx);
        const dz = Math.abs(r.landZ);
        const pzz = Phi((HL - dz) / sg.sz) - Phi((2.0 - dz) / sg.sz);
        pIn = pxx * pzz;
      } else {
        const pxx = Phi((HW - r.landX) / sg.sx) - Phi((-HW - r.landX) / sg.sx);
        const dz = Math.abs(r.landZ);
        const pzz = Phi((HL - dz) / sg.sz) - Phi((-HL - dz) / sg.sz) ;
        pIn = pxx * Math.min(1, pzz * 1.02);
      }
      const pNet = Phi(r.clearance / (0.035 + 0.05 * L.aim * (1 + 1.2 * (1 - ctx.quality))));
      let pOK = pIn * pNet * (r.short ? 0.5 : 1);
      // the opponent's chance to get there
      const ox = opp.x + opp.vx * 0.15, oz = opp.z + opp.vz * 0.15;
      const holdT = type === 'smash' ? 0.1 : type === 'drive' ? 0.06 : 0.02;
      const Tav = r.t - holdT - OL.react;
      const dd = Math.hypot(r.landX - ox, r.landZ - oz);
      const need = Math.max(0, dd - OL.reachR * 1.05) / OL.speed;
      const pressure = clamp((need - Tav) / 0.45, -1.4, 1.6);
      const pWin = sig(3.6 * pressure);
      // a high, short shuttle is a gift to a smasher
      let counter = 0;
      if ((type === 'lift' || type === 'clear' || type === 'serveLong' || type === 'safe') && Math.abs(r.landZ) < 4.7) counter += 0.18;
      if (type === 'push' && Math.abs(r.landZ) > 3.3 && r.apex > 1.8) counter += 0.1;
      if (type === 'drive' && pressure < -0.5) counter += 0.1;
      const cont = clamp(0.42 + (BASE[type] || 0) - counter - 0.05 * ctx.rush, 0.1, 0.8);
      let S = pOK * (pWin + (1 - pWin) * cont);
      S += 0.1 * ((sty.w[type] || 1) - 1) * pOK;
      list.push({ type, aim, r, S, pOK, pIn, pNet, pWin, pressure, need, Tav, dd, ox, oz });
    }
  }
  return list;
}

export function decide(ctx, rng) {
  const list = evaluate(ctx);
  if (!list.length) return null;
  list.sort((a, b) => b.S - a.S);
  const L = ctx.me.L;
  const T = 0.025 + 0.085 * L.temp;
  let best = list[0];
  if (rng) {
    const top = list.slice(0, 14), w = top.map((o) => Math.exp((o.S - best.S) / T));
    const tot = w.reduce((a, b) => a + b, 0);
    let u = rng.next() * tot;
    for (let i = 0; i < top.length; i++) { u -= w[i]; if (u <= 0) { best = top[i]; break; } }
  }
  return { ...best, all: list, ...explain(ctx, best, list[0]) };
}

// ---- words ----------------------------------------------------------------------------------------------------------------------------------
const zoneWords = (r, opp) => {
  const d = Math.abs(r.landZ);
  const depth = d < 2.4 ? 'front court' : d < 4.6 ? 'mid-court' : 'back court';
  return depth;
};
export function explain(ctx, c, top) {
  const { type, r, pressure } = c;
  const opp = ctx.opp;
  const oppDeep = Math.abs(opp.z) > 4.4, oppFront = Math.abs(opp.z) < 2.6;
  const depth = zoneWords(r);
  const away = Math.abs(r.landX - opp.x) > 1.4;
  const lines = [];
  const name = shotName(type);
  switch (type) {
    case 'smash': lines.push(ctx.contact.y > 2.2 ? 'The shuttle is high and in front of you, the best chance to attack.' : 'The shuttle is high enough to attack; hit down hard.'); if (away) lines.push('Smash into the space away from him, where he cannot get a racket on it.'); else lines.push('Go straight at his body: it gives him no room to swing.'); break;
    case 'clear': lines.push(oppFront ? 'He is up at the net, so a high clear to the back forces him to run all the way back.' : 'A clear to the back resets the rally and gives you time to get back to the middle.'); break;
    case 'drop': lines.push(oppDeep ? 'He is deep at the back: a soft drop just over the net makes him run the whole court.' : 'A drop takes the pace out of the rally and pulls him forward.'); break;
    case 'drive': lines.push('A fast flat drive stays low and gives him almost no time to set up.'); break;
    case 'push': lines.push('A soft push to the mid-court keeps the shuttle low and away from his racket.'); break;
    case 'lift': lines.push(ctx.contact.y < 0.9 ? 'The shuttle is low, so lift it high and deep: it buys you time to recover.' : 'Lift it high and deep to reset the rally.'); break;
    case 'net': lines.push('A tight net shot makes him lift it, and then you attack.'); break;
    case 'block': lines.push('Soak up the pace with a soft block that drops just over the net.'); break;
    case 'serveShort': lines.push('A short serve to the front of the box stops him from attacking at once.'); break;
    case 'serveLong': lines.push('A high serve to the back pushes him to the baseline.'); break;
    default: lines.push('A safe, controlled return.');
  }
  if (pressure > 0.35) lines.push('He cannot reach it in time from where he stands.');
  else if (c.pOK < 0.8) lines.push('It is a risky line, so aim a little inside.');
  const aimTxt = Math.abs(r.landX) < 0.7 ? 'down the middle' : 'to the ' + (r.landX > 0 ? 'right' : 'left');
  return { summary: `${name} ${aimTxt}, ${depth}`, reason: lines.join(' '), zone: { depth, lateral: r.landX > 0.7 ? 1 : r.landX < -0.7 ? -1 : 0 } };
}

export const levelOf = (id) => LEVELS[clamp(id | 0, 1, 5)];
export const capsFor = (L, power = 1) => powerTable(power, L.smash);
