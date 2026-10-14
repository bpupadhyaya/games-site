// The six stages. A stage is a list of road sections; the road is sampled every 10 m into gradient, altitude, headwind
// and a speed cap (descents and hairpins). Everything here is plain data + pure functions: the simulation, the AI and
// the picture all read the same sampled road, so what you see is what the physics used.
//
// Section: { km, g (gradient %), w (headwind m/s), v (speed cap m/s), h (hairpins in the section), land (scenery) }
export const RES = 10;               // metres per sample

export const STAGES = [
  {
    id: 'plateau', name: 'Dekemhare Plateau', place: 'Southern highlands', startAlt: 2050, tone: 'dawn',
    blurb: 'Open farmland and a long headwind. Ride in the group, save your legs, then climb the last kilometre into town.',
    secs: [
      { km: 2.5, g: 0.2, w: 2, land: 'farm' }, { km: 2.5, g: -0.4, w: 5, land: 'farm' }, { km: 2.0, g: 1.4, w: 6, land: 'farm' },
      { km: 2.5, g: 0.6, w: 2, land: 'farm' }, { km: 1.5, g: 2.6, land: 'town' }, { km: 1.2, g: 5.5, h: 3, land: 'town' },
    ],
  },
  {
    id: 'nefasit', name: 'Nefasit Switchbacks', place: 'Escarpment road', startAlt: 1700, tone: 'morning',
    blurb: 'A true climbers stage: hairpin after hairpin up the escarpment, with one breather. Spend your reserve where it pays.',
    secs: [
      { km: 1.5, g: 0.8, land: 'valley' }, { km: 2.0, g: 3.6, h: 2, land: 'valley' }, { km: 3.2, g: 6.0, h: 9, land: 'terrace' },
      { km: 0.9, g: -1.8, v: 15, h: 2, land: 'terrace' }, { km: 3.6, g: 6.4, h: 11, land: 'terrace' }, { km: 1.8, g: 4.2, h: 3, land: 'forest' },
      { km: 1.4, g: 7.4, h: 5, land: 'forest' },
    ],
  },
  {
    id: 'massawa', name: 'Massawa Road Descent', place: 'Escarpment to the coast', startAlt: 2300, tone: 'noon',
    blurb: 'Over the top, then a fast switchback descent and a flat headwind run to the line. Chase groups reform: work together.',
    secs: [
      { km: 2.4, g: 4.2, h: 3, land: 'forest' }, { km: 1.0, g: 0.8, land: 'forest' }, { km: 3.0, g: -5.6, v: 13, h: 10, land: 'terrace' },
      { km: 3.2, g: -5.0, v: 14, h: 9, land: 'valley' }, { km: 2.0, g: -1.2, w: 3, land: 'valley' }, { km: 3.8, g: 0.3, w: 5, land: 'coast' },
      { km: 1.0, g: 0.0, w: 2, land: 'coast' },
    ],
  },
  {
    id: 'keren', name: 'Keren Crosswind', place: 'Western plain', startAlt: 1400, tone: 'noon',
    blurb: 'Flat, exposed and windy. The group is everything here, but the last climbs will punish anyone who burned out.',
    secs: [
      { km: 3.5, g: 0.0, w: 7, land: 'farm' }, { km: 3.0, g: 0.9, w: 7, land: 'farm' }, { km: 2.5, g: -0.6, w: 8, land: 'farm' },
      { km: 3.0, g: 1.8, w: 4, land: 'valley' }, { km: 2.5, g: 4.6, h: 3, land: 'terrace' }, { km: 2.0, g: 3.2, land: 'terrace' },
    ],
  },
  {
    id: 'circuit', name: 'Highland Circuit', place: 'Ridge roads', startAlt: 2100, tone: 'morning',
    blurb: 'Two climbs and a descent between them. Recover on the way down, because the second climb is longer.',
    secs: [
      { km: 2.5, g: 1.2, land: 'farm' }, { km: 3.6, g: 5.8, h: 8, land: 'terrace' }, { km: 2.2, g: -4.6, v: 14, h: 7, land: 'terrace' },
      { km: 2.8, g: 0.6, w: 4, land: 'valley' }, { km: 4.2, g: 6.0, h: 9, land: 'forest' }, { km: 1.4, g: -2.0, v: 15, land: 'forest' },
      { km: 1.8, g: 3.2, h: 2, land: 'town' },
    ],
  },
  {
    id: 'asmara', name: 'Asmara Grand Finale', place: 'Up to the capital', startAlt: 1500, tone: 'dusk',
    blurb: 'The queen stage: rolling roads, a long climb, a hairpin descent and a final ramp to the avenue. Pace it or lose it.',
    secs: [
      { km: 2.5, g: 0.5, w: 3, land: 'valley' }, { km: 3.0, g: 2.6, h: 2, land: 'valley' }, { km: 4.6, g: 6.6, h: 10, land: 'terrace' },
      { km: 2.6, g: -5.2, v: 14, h: 8, land: 'terrace' }, { km: 2.2, g: 1.0, w: 2, land: 'valley' }, { km: 2.8, g: 5.2, h: 5, land: 'forest' },
      { km: 2.2, g: 7.0, h: 6, land: 'town' }, { km: 0.8, g: 3.0, land: 'town' },
    ],
  },
];

const cache = new Map();

export function buildCourse(stageIndex) {
  const hit = cache.get(stageIndex);
  if (hit) return hit;
  const st = STAGES[stageIndex];
  const raw = [];                                  // per sample, before smoothing
  const secOf = [];
  st.secs.forEach((sec, k) => {
    const n = Math.round((sec.km * 1000) / RES);
    for (let i = 0; i < n; i++) { raw.push({ g: sec.g / 100, w: sec.w ?? 0, v: sec.v ?? 20.5, k, land: sec.land }); }
    secOf.push(n);
  });
  const N = raw.length, L = N * RES;
  const grade = new Float32Array(N + 1), wind = new Float32Array(N + 1), vmax = new Float32Array(N + 1), alt = new Float32Array(N + 1);
  const win = 12;                                  // 120 m each side: gradients blend instead of stepping
  for (let i = 0; i <= N; i++) {
    let g = 0, w = 0, v = 99, c = 0;
    for (let j = Math.max(0, i - win); j <= Math.min(N - 1, i + win); j++) { g += raw[j].g; w += raw[j].w; v = Math.min(v, raw[j].v); c++; }
    grade[i] = g / c; wind[i] = w / c; vmax[i] = v;
  }
  alt[0] = st.startAlt;
  for (let i = 1; i <= N; i++) alt[i] = alt[i - 1] + grade[i - 1] * RES;
  // hairpin positions: spread each section's hairpins evenly through it
  const hairpins = [];
  let at = 0;
  st.secs.forEach((sec, k) => {
    const len = sec.km * 1000;
    for (let j = 0; j < (sec.h ?? 0); j++) hairpins.push(Math.round(at + (len * (j + 0.5)) / sec.h));
    at += len;
  });
  const sectionAt = new Uint8Array(N + 1);
  { let p = 0; secOf.forEach((n, k) => { for (let i = 0; i < n; i++) sectionAt[p++] = k; }); sectionAt[N] = secOf.length - 1; }
  const idx = (s) => Math.max(0, Math.min(N - 1, Math.floor(s / RES)));
  const lerp = (arr, s) => { const f = Math.max(0, Math.min(N - 1e-6, s / RES)), i = Math.floor(f); return arr[i] + (arr[i + 1] - arr[i]) * (f - i); };
  const course = {
    index: stageIndex, id: st.id, name: st.name, place: st.place, blurb: st.blurb, tone: st.tone, L, N, hairpins, secs: st.secs,
    gradeAt: (s) => lerp(grade, s), altAt: (s) => lerp(alt, s), windAt: (s) => lerp(wind, s), vmaxAt: (s) => vmax[idx(s)],
    landAt: (s) => st.secs[sectionAt[idx(s)]].land,
    minAlt: Math.min(...alt), maxAlt: Math.max(...alt),
  };
  cache.set(stageIndex, course);
  return course;
}

// Air gets thin with height; riders in the highlands lose less to the wind (and the stage reads true to Asmara's 2,300 m).
export const airDensity = (altM) => 1.225 * Math.exp(-altM / 8400);
