// The eight courses: authored recipes (a plan of straights and bends, zones, gates) expanded by a small seeded generator with its own
// LCG, so a course never changes between runs. Lookups are pure functions of the distance s along the road (metres).
//   kappa > 0 bends to the right; d > 0 is to the right of the centre line.
const lcg = (seed) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
export const STEP = 0.5;                       // sample spacing of the tables below

// Looks for the children (skin, shirt, shorts, hair, accent, hair style). Index 0 is the player.
export const LOOKS = [
  { skin: '#b9774a', shirt: '#f3b21b', shorts: '#2a6f9e', hair: '#1c120c', style: 'short', accent: '#c93a5a' },
  { skin: '#8a5532', shirt: '#2fa79a', shorts: '#f1e4c8', hair: '#15100c', style: 'cap', accent: '#f08a24' },
  { skin: '#d49a6a', shirt: '#d9455f', shorts: '#2c3e7a', hair: '#2a1a10', style: 'long', accent: '#ffd77a' },
  { skin: '#a56a40', shirt: '#6d4bd1', shorts: '#e8c24a', hair: '#1c120c', style: 'scarf', accent: '#7fe0cf' },
  { skin: '#c68856', shirt: '#38a85a', shorts: '#8c2f2f', hair: '#241810', style: 'short', accent: '#fff3da' },
  { skin: '#7a4a2c', shirt: '#e8791c', shorts: '#243a5e', hair: '#0f0b08', style: 'cap', accent: '#2fb6a3' },
  { skin: '#dcaa7c', shirt: '#f06fa0', shorts: '#3f7f4f', hair: '#3a2314', style: 'long', accent: '#fff3da' },
  { skin: '#9a6238', shirt: '#2c7fd1', shorts: '#f4e8cf', hair: '#1a110a', style: 'short', accent: '#ffb43c' },
];

const R = (name, skill, look) => ({ name, skill, look });

// plan: ['S', len] straight, ['B', len, kappa] bend (kappa is 1/radius, + right).
// zones: ['cobble'|'mud'|'plank'|'slope', s0, s1, grade?]. narrow: [s0, s1, halfWidth].
const SPECS = [
  { id: 'village-lane', name: 'Village Lane', blurb: 'A wide dirt lane between houses. Find your rhythm and roll through the gates.',
    theme: 'village', seed: 11, hw: 4.2, gateW: 4.2, gap: 26, start: 22, pattern: 'wave', amp: 1.1, puddles: 3,
    plan: [['S', 30], ['B', 40, 0.025], ['S', 24], ['B', 44, -0.028], ['S', 30], ['B', 36, 0.03], ['S', 26]],
    zones: [], narrow: [], rivals: [R('Annie', 0.36, 1), R('Tom', 0.44, 2), R('Ellen', 0.5, 4)] },
  { id: 'market-slalom', name: 'Market Slalom', blurb: 'Weave between market stalls and over cobbles. Gates come close together.',
    theme: 'market', seed: 23, hw: 3.8, gateW: 3.6, gap: 19, start: 20, pattern: 'slalom', amp: 1.15, puddles: 3,
    plan: [['S', 36], ['B', 30, -0.04], ['S', 30], ['B', 34, 0.045], ['S', 36], ['B', 30, -0.04], ['S', 28], ['B', 26, 0.05], ['S', 20]],
    zones: [['cobble', 70, 110], ['cobble', 190, 220]], narrow: [], rivals: [R('Mary', 0.5, 6), R('Jack', 0.56, 3), R('Fred', 0.6, 5)] },
  { id: 'canal-bank', name: 'Canal Bank', blurb: 'A narrow towpath beside the canal, with a plank bridge. Stay on the road.',
    theme: 'canal', seed: 37, hw: 3.0, gateW: 3.0, gap: 24, start: 22, pattern: 'wave', amp: 0.8, puddles: 2,
    plan: [['S', 40], ['B', 40, 0.035], ['S', 20], ['B', 36, -0.04], ['S', 70], ['B', 40, 0.04], ['S', 30]],
    zones: [['plank', 146, 190]], narrow: [[140, 196, 1.55]], rivals: [R('Lizzie', 0.58, 2), R('Will', 0.64, 7), R('Nell', 0.68, 1)] },
  { id: 'rice-terraces', name: 'Terraced Fields', blurb: 'Switchbacks down the terraces. Brake for the hairpins, then roll again.',
    theme: 'terrace', seed: 41, hw: 3.4, gateW: 3.2, gap: 20, start: 20, pattern: 'seeded', amp: 0.9, puddles: 3,
    plan: [['S', 24], ['B', 28, 0.07], ['S', 18], ['B', 30, -0.075], ['S', 18], ['B', 28, 0.07], ['S', 20], ['B', 32, -0.07], ['S', 22], ['B', 26, 0.06], ['S', 26]],
    zones: [['slope', 40, 120, -0.05], ['slope', 150, 230, -0.04]], narrow: [], rivals: [R('Harry', 0.64, 5), R('Sam', 0.7, 3), R('Lily', 0.74, 6)] },
  { id: 'harbour-wharf', name: 'Harbour Wharf', blurb: 'Crates, puddles and a plank pier. Keep your speed through the wet.',
    theme: 'harbour', seed: 53, hw: 3.4, gateW: 3.2, gap: 20, start: 22, pattern: 'slalom', amp: 1.0, puddles: 7,
    plan: [['S', 50], ['B', 36, 0.045], ['S', 28], ['B', 40, -0.05], ['S', 54], ['B', 34, 0.05], ['S', 36]],
    zones: [['plank', 120, 160], ['cobble', 200, 245]], narrow: [[116, 164, 1.7]], rivals: [R('Joe', 0.7, 0), R('Kate', 0.75, 2), R('Walt', 0.8, 5)] },
  { id: 'stone-bridge', name: 'Stone Bridge Road', blurb: 'Mud after rain, a long narrow bridge and a climb. Heavy going.',
    theme: 'rain', seed: 67, hw: 3.2, gateW: 3.0, gap: 21, start: 22, pattern: 'wave', amp: 1.0, puddles: 5,
    plan: [['S', 40], ['B', 38, 0.04], ['S', 24], ['B', 38, -0.05], ['S', 60], ['B', 30, 0.055], ['S', 30], ['B', 34, -0.045], ['S', 26]],
    zones: [['mud', 56, 96], ['plank', 150, 200], ['slope', 210, 262, 0.05], ['mud', 280, 306]], narrow: [[146, 204, 1.6]],
    rivals: [R('Ada', 0.76, 4), R('Ben', 0.8, 1), R('Rose', 0.84, 7)] },
  { id: 'hill-road', name: 'Hill Road', blurb: 'A long climb, a fast descent and tight bends. Use the hill, do not fight it.',
    theme: 'hills', seed: 79, hw: 3.2, gateW: 2.9, gap: 19, start: 22, pattern: 'seeded', amp: 1.0, puddles: 4,
    plan: [['S', 30], ['B', 34, 0.05], ['S', 24], ['B', 40, -0.055], ['S', 30], ['B', 32, 0.065], ['S', 22], ['B', 36, -0.06], ['S', 28], ['B', 30, 0.07], ['S', 30], ['B', 34, -0.05], ['S', 24]],
    zones: [['slope', 20, 110, 0.06], ['slope', 150, 260, -0.07], ['cobble', 270, 300]], narrow: [], rivals: [R('Alf', 0.82, 3), R('Edie', 0.86, 6), R('Ned', 0.9, 5)] },
  { id: 'festival-final', name: 'Fair Day Final', blurb: 'The big race: bends, cobbles, mud, a plank bridge and the narrowest gates.',
    theme: 'festival', seed: 97, hw: 3.0, gateW: 2.7, gap: 18, start: 22, pattern: 'slalom', amp: 1.05, puddles: 6,
    plan: [['S', 34], ['B', 34, 0.05], ['S', 24], ['B', 36, -0.06], ['S', 40], ['B', 30, 0.07], ['S', 22], ['B', 38, -0.055], ['S', 44], ['B', 32, 0.065], ['S', 26], ['B', 34, -0.05], ['S', 30]],
    zones: [['cobble', 60, 92], ['plank', 150, 188], ['mud', 220, 252], ['slope', 270, 330, -0.05], ['cobble', 340, 372]], narrow: [[146, 192, 1.6]],
    rivals: [R('Bess', 0.88, 7), R('Dan', 0.92, 2), R('Pearl', 0.96, 4)] },
];

const THEMES = {
  village: { sky: ['#5fb8e6', '#bfe4f2', '#fff0cc'], road: '#c99a62', roadHi: '#dcb47c', ground: '#6bb347', ground2: '#5fa43f', far: ['#6c93ad', '#86a9bf'], kerb: ['#f4ead6', '#d95a3a'], label: 'Morning' },
  market: { sky: ['#4aa6d8', '#a9d8ee', '#ffe9b8'], road: '#b9a78c', roadHi: '#d2c2a6', ground: '#c7b290', ground2: '#bba684', far: ['#8a9fb3', '#a6b6c4'], kerb: ['#fff3dc', '#c0392b'], label: 'Midday' },
  canal: { sky: ['#78c0e8', '#c8e6f2', '#fff4d6'], road: '#bfa070', roadHi: '#d4b888', ground: '#79b95a', ground2: '#6eab50', far: ['#6f9ab0', '#8cb0c2'], kerb: ['#e8dcc0', '#7a5a38'], water: '#4fb0c8', waterSide: 'left', label: 'Waterside' },
  terrace: { sky: ['#7cc4ea', '#d1ecf4', '#fff6dc'], road: '#b88a58', roadHi: '#d0a572', ground: '#8cc152', ground2: '#7ab446', far: ['#5f8aa0', '#7ea4b8'], kerb: ['#f4ead6', '#e08a2c'], label: 'Terraces' },
  harbour: { sky: ['#5ea8d8', '#b4dcee', '#ffeccc'], road: '#a89c88', roadHi: '#c2b8a4', ground: '#8f8a7a', ground2: '#847f70', far: ['#5a86a8', '#7aa2c0'], kerb: ['#f4f0e4', '#2d6ea6'], water: '#3f9ec4', waterSide: 'left', label: 'Harbour' },
  rain: { sky: ['#6f8aa0', '#a9bcc8', '#d9dfdc'], road: '#8d6c48', roadHi: '#a38460', ground: '#5d9a4a', ground2: '#538f42', far: ['#6a7f8f', '#8497a4'], kerb: ['#d8d2c4', '#7a5238'], water: '#5c97a8', label: 'After rain' },
  hills: { sky: ['#5a9ee0', '#afd6f0', '#ffecc4'], road: '#b4916a', roadHi: '#cba983', ground: '#7aab52', ground2: '#6c9d48', far: ['#5c7c9c', '#7b9ab6'], kerb: ['#f0e8d4', '#6b8c3a'], label: 'Hills' },
  festival: { sky: ['#3d5fb8', '#e07a9a', '#ffd89a'], road: '#c49a68', roadHi: '#dcb680', ground: '#5f9e48', ground2: '#549240', far: ['#5a5a98', '#7a74b0'], kerb: ['#fff4d8', '#d83a5a'], label: 'Festival dusk' },
};

function build(spec, index) {
  const rnd = lcg(spec.seed);
  const L = spec.plan.reduce((a, p) => a + p[1], 0);
  const n = Math.ceil(L / STEP) + 120;
  const kap = new Float32Array(n), hw = new Float32Array(n).fill(spec.hw);
  // bends: smooth the curvature in and out (cosine ramp over a quarter of the bend)
  let s0 = 0;
  const bends = [];
  for (const [kind, len, k] of spec.plan) {
    if (kind === 'B') {
      bends.push({ s0, s1: s0 + len, k });
      for (let i = 0; i < n; i++) {
        const s = i * STEP;
        if (s < s0 || s > s0 + len) continue;
        const t = (s - s0) / len, ramp = Math.min(1, Math.min(t, 1 - t) / 0.25), e = ramp * ramp * (3 - 2 * ramp);
        kap[i] += k * e;
      }
    }
    s0 += len;
  }
  for (const [a, b, w] of spec.narrow) {
    for (let i = 0; i < n; i++) { const s = i * STEP; if (s >= a && s <= b) hw[i] = Math.min(hw[i], w); }
  }
  // gates
  const gates = [];
  let gi = 0;
  for (let s = spec.start; s < L - 14; s += spec.gap + rnd() * 3 - 1.5) {
    const k = gi / Math.max(1, Math.floor((L - spec.start) / spec.gap));
    const w = spec.gateW * (1 - 0.14 * k);
    const hwHere = hw[Math.min(n - 1, Math.round(s / STEP))];
    let d = 0;
    if (spec.pattern === 'slalom') d = (gi % 2 ? 1 : -1) * spec.amp * (0.75 + 0.4 * rnd());
    else if (spec.pattern === 'wave') d = Math.sin(gi * 0.95 + spec.seed) * spec.amp;
    else if (spec.pattern === 'seeded') d = (rnd() * 2 - 1) * spec.amp;
    const lim = Math.max(0, hwHere - w / 2 - 0.15);
    d = Math.max(-lim, Math.min(lim, d));
    gates.push({ s: Math.round(s * 10) / 10, d: Math.round(d * 100) / 100, w: Math.round(w * 100) / 100 });
    gi++;
  }
  // puddles: placed on the road away from gate lines
  const puddles = [];
  for (let i = 0; i < spec.puddles; i++) {
    for (let tries = 0; tries < 20; tries++) {
      const s = 30 + rnd() * (L - 55), hwHere = hw[Math.round(s / STEP)];
      if (gates.some((g) => Math.abs(g.s - s) < 4)) continue;
      if (spec.zones.some((z) => (z[0] === 'plank' || z[0] === 'mud') && s > z[1] - 3 && s < z[2] + 3)) continue;
      if (puddles.some((p) => Math.abs(p.s - s) < 9)) continue;
      puddles.push({ s: Math.round(s * 10) / 10, d: Math.round((rnd() * 2 - 1) * (hwHere - 1.1) * 10) / 10, rs: 1.1, rd: 1.25 });
      break;
    }
  }
  puddles.sort((a, b) => a.s - b.s);
  const zones = spec.zones.map(([kind, a, b, g]) => ({ kind, s0: a, s1: b, grade: g ?? 0 }));
  // sections for Watch and Learn: a new one at every zone start and about every 60 m
  const secSet = new Set([0]);
  for (const z of zones) secSet.add(Math.max(0, z.s0 - 12));
  for (const b of bends) if (b.k !== 0 && Math.abs(b.k) >= 0.05) secSet.add(Math.max(0, b.s0 - 6));
  for (let s = 60; s < L - 20; s += 60) if (![...secSet].some((x) => Math.abs(x - s) < 25)) secSet.add(s);
  const sections = [...secSet].sort((a, b) => a - b);
  return {
    index, id: spec.id, name: spec.name, blurb: spec.blurb, length: L, par: Math.round(L / 4.9), theme: THEMES[spec.theme], themeId: spec.theme,
    seed: spec.seed, kap, hw, gates, puddles, zones, bends, sections, rivals: spec.rivals, hwBase: spec.hw,
  };
}

export const COURSES = SPECS.map(build);

const at = (arr, s) => arr[Math.max(0, Math.min(arr.length - 1, Math.round(s / STEP)))];
export const kappaAt = (C, s) => at(C.kap, s);
export const halfWidthAt = (C, s) => at(C.hw, s);
export function zoneAt(C, s) {
  for (const z of C.zones) if (s >= z.s0 && s <= z.s1) return z;
  return null;
}
export function gradeAt(C, s) {
  let g = 0;
  for (const z of C.zones) {
    if (z.kind !== 'slope' || s < z.s0 || s > z.s1) continue;
    const t = (s - z.s0) / (z.s1 - z.s0), env = Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
    g += z.grade * Math.min(1, env * 2.5);
  }
  return g;
}
// Cosmetic road height (the integral of the grade), so slopes show as rises and falls in the road.
const hcache = new Map();
export function heightAt(C, s) {
  let tab = hcache.get(C.id);
  if (!tab) {
    tab = []; let h = 0;
    for (let i = 0; i <= Math.ceil(C.length / STEP) + 120; i++) { tab.push(h); h += gradeAt(C, i * STEP) * STEP * 1.6; }
    hcache.set(C.id, tab);
  }
  const f = Math.max(0, s) / STEP, i = Math.min(tab.length - 2, Math.floor(f)), k = f - i;
  return tab[i] + (tab[i + 1] - tab[i]) * k;
}
