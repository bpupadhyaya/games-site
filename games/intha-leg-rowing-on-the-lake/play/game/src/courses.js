// The eight lake courses: authored recipes expanded by a small seeded generator (own LCG, so a course never changes between runs).
// Coordinates: s = metres along the lake channel (the way you row), n = metres across it, positive to the right of the way you row.
// Everything here is a pure function of the course; the sim and the painter both read it.
const lcg = (seed) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };

// Looks for boats and rowers: hull timber, trim, shirt, sarong, head cloth. Index 0 is the player.
export const LOOKS = [
  { hull: '#b8722f', trim: '#f2d28a', shirt: '#e8ecef', sarong: '#2a5f86', wrap: '#c8353f', skin: '#a8683c' },
  { hull: '#8a5a2e', trim: '#9fd6c2', shirt: '#f0c24a', sarong: '#6d2f58', wrap: '#2f8f7a', skin: '#8a5532' },
  { hull: '#a8642a', trim: '#f4a9a0', shirt: '#4f9ac7', sarong: '#34553a', wrap: '#f0a42c', skin: '#c08050' },
  { hull: '#79502a', trim: '#cfd8ff', shirt: '#d9604a', sarong: '#3a3f75', wrap: '#e9e2c6', skin: '#9a6238' },
  { hull: '#c58441', trim: '#ffe7a0', shirt: '#6cbf8a', sarong: '#7a3a2a', wrap: '#4b64c8', skin: '#b87a4a' },
  { hull: '#6f4a26', trim: '#f2d28a', shirt: '#b996e0', sarong: '#254a5a', wrap: '#ffd45a', skin: '#8a5a34' },
];

const R = (name, skill, look) => ({ name, skill, look });

// len m, seed, width (half channel m), bend (metres of meander), then feature counts
const SPECS = [
  { id: 'dawn-channel', name: 'Dawn Channel', blurb: 'A wide, quiet channel at first light. Find your stroke and net your first fish.', len: 240, seed: 11, hw: 5.6, bend: 1.2, stakes: 2, hyac: 0, swells: 0, gates: 2, fences: 0, shoals: 3, quotaFrac: 0.6,
    theme: 'dawn', rivals: [R('Aung', 0.26, 1), R('Thida', 0.31, 2), R('Nyan', 0.36, 3)] },
  { id: 'garden-alley', name: 'Garden Alley', blurb: 'Between tomato beds on bamboo stakes. Stakes in the water, gates to thread.', len: 280, seed: 23, hw: 4.6, bend: 1.8, stakes: 5, hyac: 1, swells: 0, gates: 3, fences: 0, shoals: 4, quotaFrac: 0.6,
    theme: 'garden', rivals: [R('Mya', 0.29, 4), R('Zaw', 0.34, 5), R('Hla', 0.39, 1)] },
  { id: 'hyacinth-drift', name: 'Hyacinth Drift', blurb: 'Floating weed mats slow the boat. Pick your line round them.', len: 300, seed: 37, hw: 5.0, bend: 2.0, stakes: 3, hyac: 5, swells: 0, gates: 2, fences: 0, shoals: 4, quotaFrac: 0.6,
    theme: 'morning', rivals: [R('Su', 0.26, 2), R('Kyaw', 0.31, 3), R('Phyu', 0.36, 4)] },
  { id: 'fence-reach', name: 'Fence Reach', blurb: 'Bamboo fish fences pinch the channel to a narrow gap. Straight sweeps only.', len: 320, seed: 41, hw: 4.2, bend: 2.2, stakes: 4, hyac: 2, swells: 0, gates: 3, fences: 3, shoals: 4, quotaFrac: 0.6,
    theme: 'fence', rivals: [R('Min', 0.37, 5), R('Khin', 0.42, 1), R('Tun', 0.47, 2)] },
  { id: 'misty-morning', name: 'Misty Morning', blurb: 'Thick mist hides the far channel. Row by what you can see.', len: 340, seed: 53, hw: 4.6, bend: 2.6, stakes: 5, hyac: 3, swells: 1, gates: 3, fences: 1, shoals: 5, quotaFrac: 0.6,
    theme: 'mist', rivals: [R('Ei', 0.32, 3), R('Htet', 0.37, 4), R('Moe', 0.42, 5)] },
  { id: 'swell-water', name: 'Swell Water', blurb: 'Open water where swells roll across the channel. Row gently to ride them.', len: 360, seed: 67, hw: 5.4, bend: 2.0, stakes: 3, hyac: 2, swells: 4, gates: 3, fences: 0, shoals: 5, quotaFrac: 0.6,
    theme: 'noon', rivals: [R('Lwin', 0.38, 0), R('Nu', 0.43, 2), R('Soe', 0.48, 1)] },
  { id: 'fishermens-reach', name: 'Fishermens Reach', blurb: 'Rich water: many shoals and a high catch to make. Slow down and net them.', len: 380, seed: 79, hw: 4.8, bend: 2.4, stakes: 5, hyac: 3, swells: 1, gates: 3, fences: 1, shoals: 8, quotaFrac: 0.6,
    theme: 'gold', rivals: [R('Pyae', 0.54, 5), R('Thant', 0.59, 3), R('Wai', 0.64, 4)] },
  { id: 'lake-regatta', name: 'Lake Regatta', blurb: 'The big race: bends, fences, hyacinth, swells and the best rowers on the lake.', len: 440, seed: 97, hw: 4.6, bend: 2.8, stakes: 6, hyac: 4, swells: 3, gates: 4, fences: 2, shoals: 6, quotaFrac: 0.6,
    theme: 'regatta', rivals: [R('Hein', 0.58, 2), R('Cho', 0.63, 4), R('Yin', 0.68, 1)] },
];

const THEMES = {
  dawn: { water: ['#f3c9b0', '#8fc7c4', '#2f8aa0'], deep: '#1f6f8a', glint: '#fff1d6', bed: '#5c8a3c', bed2: '#79a648', soil: '#4d3a22', mist: '#ffe9d2', sun: '#ffd9a0', label: 'Dawn' },
  garden: { water: ['#e6d9c0', '#86c4bd', '#2b8398'], deep: '#1d6a80', glint: '#f4ffe9', bed: '#5a9a3a', bed2: '#86b94e', soil: '#4a3822', mist: '#eaf5e2', sun: '#fff0b8', label: 'Early morning' },
  morning: { water: ['#d7ecea', '#79bdc0', '#2a8096'], deep: '#1b6678', glint: '#ffffff', bed: '#4f9440', bed2: '#7cb852', soil: '#45341f', mist: '#f0f8f4', sun: '#fff6c8', label: 'Morning' },
  fence: { water: ['#d9e7d6', '#7fb9ad', '#2b7a88'], deep: '#1d5f6e', glint: '#f6ffef', bed: '#5c9540', bed2: '#8dbb55', soil: '#4a3b24', mist: '#eaf3e3', sun: '#fff2c0', label: 'Mid-morning' },
  mist: { water: ['#dfe6ea', '#a3bfc6', '#5a8794'], deep: '#3b6672', glint: '#ffffff', bed: '#5c8a52', bed2: '#7fa66a', soil: '#40382a', mist: '#f2f5f6', sun: '#f4f1e4', label: 'Mist' },
  noon: { water: ['#bfe8f0', '#5fb6cb', '#1f7fa6'], deep: '#16638a', glint: '#ffffff', bed: '#55a53c', bed2: '#8fcd55', soil: '#4b3a22', mist: '#f4fcff', sun: '#ffffff', label: 'Midday' },
  gold: { water: ['#f5d7a0', '#8ec2a8', '#2d8590'], deep: '#1f6b78', glint: '#fff0c0', bed: '#6a9a3a', bed2: '#9bc24a', soil: '#4e3a1e', mist: '#ffeccc', sun: '#ffd27a', label: 'Golden hour' },
  regatta: { water: ['#f6c7c0', '#86bccd', '#2a7aa8'], deep: '#1c5f8c', glint: '#fff4ea', bed: '#5a9a42', bed2: '#8cc055', soil: '#4a3822', mist: '#ffe8e2', sun: '#ffd0b0', label: 'Regatta morning' },
};

export const BOAT_Y = 0;     // (documentation) boats are placed by lane offset only

function build(spec, index) {
  const rnd = lcg(spec.seed), L = spec.len;
  const ph = [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28];
  const lam1 = 46 + rnd() * 14, lam2 = 21 + rnd() * 8;
  const course = {
    index, id: spec.id, name: spec.name, blurb: spec.blurb, length: L, par: Math.round(L / 2.7), rivals: spec.rivals, quotaFrac: 0.6,
    theme: THEMES[spec.theme], themeId: spec.theme, seed: spec.seed, hwBase: spec.hw, bend: spec.bend, ph, lam1, lam2,
    stakes: [], hyac: [], swells: [], gates: [], fences: [], shoals: [], features: [],
  };
  const occ = [];                       // used stretches along s [a, b]
  const place = (len, pad, lo = 22, hi = L - 24) => {
    for (let t = 0; t < 300; t++) {
      const a = lo + rnd() * (hi - lo - len);
      if (!occ.some((o) => a < o[1] + pad && a + len > o[0] - pad)) { occ.push([a, a + len]); return a; }
    }
    return -1;
  };
  const feat = (s0, s1, kind, name) => course.features.push({ s0, s1, kind, name });
  for (let i = 0; i < spec.shoals; i++) {
    const a = place(2, 8, 18, L - 30);
    if (a < 0) continue;
    const hw = halfWidthAt(course, a), lo = -hw + 0.95 + 1.9 + 0.3, hi = hw - 1.4;
    const off = lo + rnd() * (hi - lo);
    course.shoals.push({ id: i, s: a, n: centreAt(course, a) + off, size: 2 + Math.floor(rnd() * 4) });
    feat(a - 1.5, a + 1.5, 'shoal', 'Fish shoal');
  }
  // narrow fences first (they set the width), then swells, gates, hyacinth, stakes, shoals.
  for (let i = 0; i < spec.fences; i++) {
    const len = 16 + Math.floor(rnd() * 6), a = place(len, 10);
    if (a < 0) continue;
    course.fences.push({ s0: a, s1: a + len, hw: 2.7 });
    feat(a, a + len, 'fence', 'Narrow fence gap');
  }
  for (let i = 0; i < spec.swells; i++) {
    const len = 9 + rnd() * 4, a = place(len, 8);
    if (a < 0) continue;
    course.swells.push({ s0: a, s1: a + len });
    feat(a, a + len, 'swell', 'Swell band');
  }
  const centreAt0 = (s) => centreAt(course, s), hwAt0 = (s) => halfWidthAt(course, s);
  for (let i = 0; i < spec.gates; i++) {
    const a = place(2, 14);
    if (a < 0) continue;
    const off = (rnd() - 0.5) * Math.min(2.4, hwAt0(a) - 2.3) * 1.6;
    course.gates.push({ s: a, n: centreAt0(a) + off, gap: 3.4 });
    feat(a - 2, a + 2, 'gate', 'Buoy gate');
  }
  for (let i = 0; i < spec.hyac; i++) {
    const a = place(6, 6);
    if (a < 0) continue;
    const r = 1.2 + rnd() * 0.9, side = rnd() < 0.5 ? -1 : 1, off = side * Math.min(hwAt0(a) - r * 0.4, 0.6 + rnd() * 2.2);
    course.hyac.push({ s: a, n: centreAt0(a) + off, r });
    feat(a - r, a + r, 'hyac', 'Water hyacinth');
  }
  for (let i = 0; i < spec.stakes; i++) {
    const a = place(2, 7);
    if (a < 0) continue;
    const off = (rnd() - 0.5) * (hwAt0(a) - 1.4) * 1.5;
    course.stakes.push({ s: a, n: centreAt0(a) + off, r: 0.28 });
    feat(a - 0.5, a + 0.5, 'stake', 'Fishing stake');
  }
  course.shoals.sort((p, q) => p.s - q.s); course.shoals.forEach((sh, i) => { sh.id = i; });
  course.fishTotal = course.shoals.reduce((a, sh) => a + sh.size, 0);
  course.quota = Math.max(2, Math.round(course.fishTotal * spec.quotaFrac));
  for (const k of ['stakes', 'hyac', 'gates', 'swells', 'fences']) course[k].sort((p, q) => (p.s ?? p.s0) - (q.s ?? q.s0));
  course.features.sort((a, b) => a.s0 - b.s0);
  return course;
}

// ---- pure lookups ----------------------------------------------------------------------------------------------------------------
// The lake channel: a meandering centre line (zero at the start line so everyone lines up straight), a half-width, narrowed by fences.
export function centreAt(C, s) {
  const ramp = Math.min(1, Math.max(0, (s - 6) / 24));
  return ramp * C.bend * (0.7 * Math.sin(s / C.lam1 + C.ph[0]) + 0.5 * Math.sin(s / C.lam2 + C.ph[1]));
}
export function halfWidthAt(C, s) {
  let hw = C.hwBase + 0.5 * Math.sin(s / 29 + C.ph[2]);
  for (const f of C.fences) {
    const e = Math.min(1, Math.max(0, Math.min(s - (f.s0 - 6), f.s1 + 6 - s) / 6));
    hw = hw + (Math.min(hw, f.hw) - hw) * e;
  }
  return hw;
}
export const swellAt = (C, s) => C.swells.some((w) => s >= w.s0 && s <= w.s1);

// Think / Reveal sections: cut points before each cluster of features, at least 45 m apart, plus the start.
export function sectionsOf(C) {
  const cuts = [0];
  for (const f of C.features) {
    const at = Math.max(0, f.s0 - 14);
    if (at - cuts[cuts.length - 1] >= 45 && C.length - at > 30) cuts.push(at);
  }
  return cuts;
}
export function featureAhead(C, s, span = 18) {
  for (const f of C.features) if (f.s1 >= s && f.s0 <= s + span) return f;
  return null;
}

export const COURSES = SPECS.map(build);
