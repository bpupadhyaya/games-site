// The stroke catalogue: what each stroke is, which ones a contact height allows, how a swipe maps to a stroke and an aim,
// and how a stroke is turned into a launch velocity by the solver. Human and computer players use exactly the same code.
import { solveShot } from './phys.js';
import { HW, HL, SHORT, SHOTS } from './consts.js';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;

// Contact height classes: 'over' = overhead (above the head), 'mid' = chest to head height, 'low' = below the waist.
export const heightClass = (y) => (y >= 1.95 ? 'over' : y >= 1.1 ? 'mid' : 'low');

// Which strokes are possible from each class (the computer and the stroke guide use the same list).
export const OPTIONS = {
  over: ['smash', 'clear', 'drop', 'drive', 'block'],
  mid: ['drive', 'push', 'lift', 'block', 'clear'],
  low: ['lift', 'net', 'push', 'block'],
};
export const SERVES = ['serveShort', 'serveLong'];

// Depth ranges d = distance from the net where the shuttle should land (m), per stroke. f in [0,1] picks within the range.
export const DEPTH = {
  serveShort: [SHORT + 0.2, SHORT + 0.9],
  serveLong: [5.55, 6.35],
  clear: [4.9, 6.4],
  lift: [4.9, 6.4],
  drop: [0.7, 2.7],
  smash: [2.9, 5.0],
  drive: [3.6, 6.2],
  push: [2.6, 4.4],
  net: [0.3, 1.3],
  block: [0.9, 2.9],
  safe: [4.8, 5.6],
};
export const AIM_X = 2.28;       // widest aim (m from the centre line): 0.3 m inside the sideline

// Per-stroke solver specs. capKey selects the speed cap from the player's power table.
const SPEC = {
  serveShort: { thMin: 4, thMax: 70, thStep: 3, vMin: 4, vMax: 30, order: 'asc', clear: 0.09, apexMax: 4 },
  serveLong: { thMin: 40, thMax: 75, thStep: 3, vMin: 8, vMax: 62, order: 'asc', apexMax: 8.8 },
  clear: { thMin: 34, thMax: 62, thStep: 3, vMin: 14, vMax: 66, order: 'asc', apexMax: 8.8, clear: 0.5 },
  lift: { thMin: 44, thMax: 74, thStep: 3, vMin: 10, vMax: 58, order: 'asc', apexMax: 8.8, clear: 0.5 },
  drop: { thMin: -14, thMax: 55, thStep: 3, vMin: 7, vMax: 38, order: 'asc', clear: 0.1, apexMax: 8 },
  drive: { thMin: -10, thMax: 32, thStep: 2, vMin: 14, vMax: 58, order: 'asc', clear: 0.1, apexMax: 6 },
  push: { thMin: 2, thMax: 45, thStep: 3, vMin: 9, vMax: 34, order: 'asc', clear: 0.1, apexMax: 6 },
  net: { thMin: 22, thMax: 82, thStep: 3, vMin: 3, vMax: 22, order: 'asc', clear: 0.045, apexMax: 6 },
  block: { thMin: 8, thMax: 55, thStep: 3, vMin: 7, vMax: 32, order: 'asc', clear: 0.1, apexMax: 6 },
  safe: { thMin: 40, thMax: 70, thStep: 3, vMin: 10, vMax: 60, order: 'asc', apexMax: 8.6, clear: 0.5 },
};

// Top speeds a player can give (m/s). power 1 = the human at best; computer levels scale it.
export function powerTable(power = 1, smash = 62) {
  return { smash, clear: 54 + 12 * power, lift: 46 + 12 * power, drive: 44 + 14 * power, serveLong: 56, serveShort: 30, drop: 38, push: 34, net: 22, block: 32, safe: 56 };
}

// Turn a stroke name and an aim into a launch. side: +1 hits from the +z end towards -z. aim = { x, d } where d is distance from the net.
export function planShot(type, contact, aim, side, caps) {
  const tx = clamp(aim.x, -HW - 1.6, HW + 1.6), tz = -side * clamp(aim.d, 0.25, HL + 2.6);
  const sp = SPEC[type] || SPEC.safe;
  const cap = caps[type] ?? sp.vMax;
  if (type === 'smash') {
    const v = caps.smash;
    // contact height lets the smash get steeper; a low contact can only drive it flat
    const steep = contact.y > 2.2 ? -72 : -58;
    return solveShot(contact, { x: tx, z: tz }, { fixedV: v, thMin: steep, thMax: 14, clear: 0.07 });
  }
  return solveShot(contact, { x: tx, z: tz }, { ...sp, vMax: Math.min(sp.vMax, cap) });
}

// ---- swipes ---------------------------------------------------------------------------------------------------------------------------------
// A swipe arrives as { F, Lx }: F = how far it goes towards the opponent (virtual units; negative = back towards you), Lx = sideways in court
// coordinates (positive = towards +x). Lengths are in virtual units (the short side of the screen is 720).
export const SWIPE = { tap: 34, short: 175, mid: 340 };
export function classifySwipe(sw, cls) {
  const F = sw.F, A = Math.abs(sw.Lx), len = Math.hypot(sw.F, sw.Lx);
  if (len < SWIPE.tap) return { kind: 'safe', f: 0.5 };
  const side = A > 1.5 * Math.max(10, F) && A > 90;           // mostly sideways
  const back = F < -50;                                       // pulled back towards yourself
  let kind, f;
  const L = Math.max(F, 0);
  const lenCls = L < SWIPE.short ? 0 : L < SWIPE.mid ? 1 : 2;
  f = lenCls === 0 ? clamp((L - SWIPE.tap) / (SWIPE.short - SWIPE.tap), 0, 1) : lenCls === 1 ? clamp((L - SWIPE.short) / (SWIPE.mid - SWIPE.short), 0, 1) : clamp((L - SWIPE.mid) / 300, 0, 1);
  if (cls === 'over') kind = side ? 'drive' : back ? 'drop' : ['drop', 'clear', 'smash'][lenCls];
  else if (cls === 'mid') kind = side ? 'drive' : back ? 'block' : ['push', 'lift', 'drive'][lenCls];
  else kind = side ? 'push' : back ? 'net' : ['net', 'lift', 'lift'][lenCls];
  if (kind === 'lift' && cls === 'mid' && false) kind = 'clear';
  return { kind, f };
}
// The aim from the swipe direction: angle off the forward axis, -45..45 degrees maps to the full court width.
export function swipeAim(sw, kind) {
  const F = Math.max(sw.F, 0.0001);
  let ang = (Math.atan2(sw.Lx, Math.max(F, Math.abs(sw.Lx) * 0.25)) * 180) / Math.PI;     // degrees off straight ahead
  ang = clamp(ang, -75, 75);
  return clamp(ang / 45, -1, 1);
}
export function aimFrom(type, f, a, side) {
  const dr = DEPTH[type] || DEPTH.safe;
  // smash and drop: a longer swipe within the class means a deeper landing for drops/net, a flatter/deeper one for others
  const ff = type === 'smash' ? 1 - f * 0.9 : f;
  return { x: a * AIM_X, d: lerp(dr[0], dr[1], clamp(ff, 0, 1)) };
}

export const shotName = (t) => (SHOTS[t] || SHOTS.safe).name;
export const shotVerb = (t) => (SHOTS[t] || SHOTS.safe).verb;
