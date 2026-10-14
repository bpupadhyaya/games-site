// The eight courses: authored recipes expanded by a small seeded generator (own LCG, so a course never changes between runs).
// Terrain lookups (tileAt, slopeAt, roughAt) are pure functions of the road position in metres.
const lcg = (seed) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };

// Looks for the people (skin tone, shirt, shorts, hair, accent). Index 0 is the player.
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

// seed, len, streams, bridges, bunds, muds, hills, puddles, holes, rocks, rough
const SPECS = [
  { id: 'village-lane', name: 'Village Lane', blurb: 'A flat dirt lane between houses. Find your rhythm.', len: 70, seed: 11, streams: 0, bridges: 0, bunds: 0, muds: 0, hills: 0, puddles: 3, holes: 0, rocks: 2, rough: 0.8,
    theme: 'morning', rivals: [R('Budi', 0.3, 1), R('Sari', 0.38, 2), R('Agus', 0.45, 4)] },
  { id: 'rice-bund', name: 'Rice Bund', blurb: 'Narrow earth paths between flooded rice fields. Wobbles grow.', len: 80, seed: 23, streams: 0, bridges: 0, bunds: 2, muds: 0, hills: 1, puddles: 4, holes: 0, rocks: 1, rough: 1.0,
    theme: 'paddy', rivals: [R('Dewi', 0.42, 6), R('Wayan', 0.5, 3), R('Rudi', 0.55, 5)] },
  { id: 'market-street', name: 'Market Street', blurb: 'Potholes and puddles outside the stalls. Read the road.', len: 90, seed: 37, streams: 0, bridges: 0, bunds: 0, muds: 0, hills: 1, puddles: 4, holes: 5, rocks: 4, rough: 1.1,
    theme: 'market', rivals: [R('Putri', 0.52, 2), R('Joko', 0.58, 7), R('Lina', 0.62, 6)] },
  { id: 'stream-stones', name: 'Stream Stones', blurb: 'Two crossings on stepping stones. Land exactly on a stone.', len: 85, seed: 41, streams: 2, bridges: 0, bunds: 0, muds: 0, hills: 0, puddles: 2, holes: 0, rocks: 2, rough: 1.0,
    theme: 'stream', rivals: [R('Made', 0.6, 4), R('Citra', 0.66, 1), R('Eko', 0.7, 5)] },
  { id: 'mud-season', name: 'Mud Season', blurb: 'Deep mud holds the stilts. Keep stepping, keep pushing.', len: 100, seed: 53, streams: 0, bridges: 0, bunds: 0, muds: 3, hills: 2, puddles: 4, holes: 1, rocks: 2, rough: 1.2,
    theme: 'rain', rivals: [R('Yanti', 0.68, 6), R('Hadi', 0.72, 3), R('Nia', 0.76, 7)] },
  { id: 'plank-bridge-day', name: 'Plank Bridge Day', blurb: 'Narrow plank bridges where every sway counts.', len: 110, seed: 67, streams: 1, bridges: 2, bunds: 0, muds: 0, hills: 1, puddles: 2, holes: 2, rocks: 2, rough: 1.2,
    theme: 'noon', rivals: [R('Bayu', 0.74, 0), R('Rina', 0.78, 2), R('Surya', 0.82, 5)] },
  { id: 'hill-road', name: 'Hill Road', blurb: 'Long climbs and runs down the hill. Gravity helps and hurts.', len: 120, seed: 79, streams: 0, bridges: 0, bunds: 1, muds: 1, hills: 4, puddles: 3, holes: 3, rocks: 4, rough: 1.3,
    theme: 'hills', rivals: [R('Ketut', 0.8, 7), R('Ayu', 0.84, 1), R('Tomo', 0.88, 4)] },
  { id: 'festival-final', name: 'Festival Final', blurb: 'The big race: streams, bridges, mud, hills and the best rivals.', len: 130, seed: 97, streams: 2, bridges: 1, bunds: 1, muds: 2, hills: 3, puddles: 4, holes: 4, rocks: 3, rough: 1.4,
    theme: 'festival', rivals: [R('Gede', 0.86, 3), R('Intan', 0.9, 6), R('Anton', 0.94, 5)] },
];

const THEMES = {
  morning: { sky: ['#6ec3e8', '#bfe6f2', '#fff0cc'], haze: '#fff0cc', road: '#c99a62', roadHi: '#e1b87c', grass: '#58a845', mount: ['#5b8aa8', '#7da2bd'], label: 'Morning' },
  paddy: { sky: ['#7fd0e6', '#cdeef0', '#fff6d2'], haze: '#fff6d2', road: '#b98b55', roadHi: '#d8ad72', grass: '#6cc24a', mount: ['#4f8a86', '#74aea6'], label: 'Rice terraces' },
  market: { sky: ['#f8b45a', '#fdd9a0', '#fff1d4'], haze: '#ffe9c4', road: '#b68a60', roadHi: '#d6ac7c', grass: '#6aa84a', mount: ['#9a6f7a', '#b98d93'], label: 'Late morning' },
  stream: { sky: ['#5fbfe6', '#b2e3f1', '#e9f8f4'], haze: '#e9f8f4', road: '#bf9564', roadHi: '#dcb682', grass: '#4fae58', mount: ['#3f8a90', '#6bb0b2'], label: 'Riverside' },
  rain: { sky: ['#7f93a6', '#a9b9c4', '#d4dcdd'], haze: '#d4dcdd', road: '#8e6a44', roadHi: '#a9825a', grass: '#4b8f4a', mount: ['#58707e', '#7b909b'], label: 'After rain' },
  noon: { sky: ['#4aa8e0', '#9fd8f2', '#f4fbff'], haze: '#f4fbff', road: '#cfa06a', roadHi: '#ecc88e', grass: '#5cb04a', mount: ['#4a86a3', '#78aac0'], label: 'Midday' },
  hills: { sky: ['#6aa6dc', '#b6d6ee', '#fbe8d0'], haze: '#fbe8d0', road: '#b98b5a', roadHi: '#d7ac78', grass: '#6fb04a', mount: ['#5a7aa0', '#8aa6c4'], label: 'Hill country' },
  festival: { sky: ['#f08a5a', '#f9c27e', '#fff0c8'], haze: '#ffe6b6', road: '#c9985c', roadHi: '#e7bb80', grass: '#5fae48', mount: ['#8a5f8c', '#b185a8'], label: 'Festival afternoon' },
};

function build(spec, index) {
  const rnd = lcg(spec.seed), L = spec.len, occ = [], segs = [], slopes = [], spots = [], stones = [];
  const free = (a, b, pad = 3) => a >= 16 && b <= L - 10 && !occ.some((o) => a < o[1] + pad && b > o[0] - pad);
  const place = (len, pad) => {
    for (let t = 0; t < 200; t++) {
      const a = 16 + rnd() * (L - 26 - len);
      if (free(a, a + len, pad)) { occ.push([a, a + len]); return a; }
    }
    return -1;
  };
  const features = [];
  const addSeg = (kind, len, name, extra = {}) => {
    const a = place(len, 4);
    if (a < 0) return;
    const s = { x0: a, x1: a + len, kind, ...extra };
    segs.push(s); features.push({ x0: a, x1: a + len, kind, name });
    return s;
  };
  for (let i = 0; i < spec.streams; i++) {
    const s = addSeg('stream', 6.4, 'Stepping stones');
    if (!s) continue;
    let x = s.x0 + 0.55, k = 0;
    while (x < s.x1 - 0.2) { stones.push(Math.round(x * 100) / 100); x += (k % 2 ? 1.08 : 0.92) + (rnd() - 0.5) * 0.08; k++; }
  }
  for (let i = 0; i < spec.bridges; i++) addSeg('plank', 7.5, 'Plank bridge');
  for (let i = 0; i < spec.bunds; i++) addSeg('bund', 9, 'Narrow bund');
  for (let i = 0; i < spec.muds; i++) addSeg('mud', 5, 'Mud');
  for (let i = 0; i < spec.hills; i++) {
    const len = 10 + Math.floor(rnd() * 5), a = place(len, 2);
    if (a < 0) continue;
    const up = rnd() < 0.5, s = up ? 0.025 + rnd() * 0.025 : -(0.03 + rnd() * 0.04);
    slopes.push({ x0: a, x1: a + len, s });
    features.push({ x0: a, x1: a + len, kind: s > 0 ? 'up' : 'down', name: s > 0 ? 'Uphill' : 'Downhill' });
  }
  const spotKinds = [['puddle', spec.puddles], ['hole', spec.holes], ['rock', spec.rocks]];
  const taken = [];
  for (const [kind, n] of spotKinds) {
    for (let i = 0; i < n; i++) {
      for (let t = 0; t < 80; t++) {
        const x = 15 + rnd() * (L - 26);
        const inSeg = segs.some((s) => (s.kind === 'stream' || s.kind === 'plank') && x > s.x0 - 1.2 && x < s.x1 + 1.2);
        if (inSeg || taken.some((q) => Math.abs(q - x) < 3.6)) continue;
        taken.push(x); spots.push({ x: Math.round(x * 10) / 10, kind, r: kind === 'rock' ? 0.28 : 0.4 });
        features.push({ x0: x - 0.6, x1: x + 0.6, kind, name: kind === 'puddle' ? 'Puddle' : kind === 'hole' ? 'Pothole' : 'Rock' });
        break;
      }
    }
  }
  features.sort((a, b) => a.x0 - b.x0);
  return {
    index, id: spec.id, name: spec.name, blurb: spec.blurb, length: L, par: Math.round(L / 2.0), rough: spec.rough, rivals: spec.rivals,
    segs, slopes, spots, stones, features, theme: THEMES[spec.theme], themeId: spec.theme, seed: spec.seed,
  };
}

export const COURSES = SPECS.map(build);

const STONE_R = 0.3;
export function tileAt(C, x) {
  for (const s of C.spots) if (Math.abs(x - s.x) <= s.r) return s.kind;
  for (const g of C.segs) {
    if (x < g.x0 || x > g.x1) continue;
    if (g.kind === 'stream') {
      for (const st of C.stones) if (Math.abs(x - st) <= STONE_R) return 'stone';
      return 'water';
    }
    return g.kind;
  }
  return 'road';
}
export function slopeAt(C, x) {
  let s = 0;
  for (const g of C.slopes) {
    if (x < g.x0 || x > g.x1) continue;
    const t = (x - g.x0) / (g.x1 - g.x0), env = Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
    s += g.s * Math.min(1, env * 2.2);
  }
  return s;
}
// How much extra sideways kick landing here gives (1 = normal road).
export function roughAt(C, x) {
  const k = tileAt(C, x);
  const base = C.rough * (k === 'plank' ? 1.6 : k === 'bund' ? 1.35 : k === 'mud' ? 1.5 : k === 'stone' ? 0.8 : 1);
  return base;
}
// Cosmetic ground height in metres (the integral of the slope bias), for the road profile.
const hcache = new Map();
export function groundH(C, x) {
  let tab = hcache.get(C.id);
  if (!tab) {
    tab = []; let h = 0;
    for (let i = 0; i <= Math.ceil(C.length / 0.5) + 40; i++) { tab.push(h); h += slopeAt(C, i * 0.5) * 0.5 * 2.5; }
    hcache.set(C.id, tab);
  }
  const f = Math.max(0, x) / 0.5, i = Math.min(tab.length - 2, Math.floor(f)), k = f - i;
  return tab[i] + (tab[i + 1] - tab[i]) * k;
}
