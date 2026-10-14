// Pieces, bar notation and the numbers that drive judging and scoring. Pure data + pure functions.
//
// Notation: each bar is one string "<grouping> <cells>", for example '2+2+3 D.D.D..'.
//   grouping  how the pulses are gathered: 2+2+3 means a quick pair, a quick pair and a long three (7 pulses, the 7/8 rachenitsa count).
//   cells     one character per pulse (an eighth note), as many as the grouping adds up to:
//             .  rest        D  DRUM pad (the accent)        c  CLAP pad (a light pulse)        S  STEP pad (a dance step)
// A piece's bars may change grouping (and even length) from one bar to the next: that is the "accent shift".

export const KINDS = {
  D: { id: 'drum', pad: 'drum', name: 'Drum', how: 'Tap the red DRUM pad' },
  c: { id: 'clap', pad: 'clap', name: 'Clap', how: 'Tap the gold CLAP pad' },
  S: { id: 'step', pad: 'step', name: 'Step', how: 'Tap the green STEP pad' },
};
export const KIND_BY_ID = Object.fromEntries(Object.values(KINDS).map((k) => [k.id, k]));
export const PADS = ['drum', 'clap', 'step'];
export const PAD_NAME = { drum: 'DRUM', clap: 'CLAP', step: 'STEP' };

// Bars are written as named patterns: `lay('2+2+3', { a: 'D.D.D..', ... }, 'a a b a | ...')` (the | only helps reading).
const lay = (label, pats, seq) => seq.replace(/\|/g, ' ').split(/\s+/).filter(Boolean).map((k) => `${label} ${pats[k]}`);
const mix = (vocab, seq) => seq.replace(/\|/g, ' ').split(/\s+/).filter(Boolean).map((k) => vocab[k]);

export const PIECES = [
  {
    id: 'paidushko-step', name: 'Paidushko Step', sub: 'Five pulses: quick, slow', meter: '5/8', eps: 4.6, level: 1, groove: 0,
    blurb: 'The gentlest odd meter: a pair and a three, 2+3. Drum on each group, then add the clap and a step.',
    bars: lay('2+3', { a: 'D.D..', b: 'DcD..', c: 'D.D.S', d: 'DcD.c', e: 'DcD.S', f: 'D.DcS', g: 'DcDcS' },
      'a a b a | b c b c | d e d e | f c f e | g e g c | d g e f | b e b a | a a a a'),
  },
  {
    id: 'rachenitsa', name: 'Rachenitsa', sub: 'Seven pulses: quick, quick, slow', meter: '7/8', eps: 5.2, level: 2, groove: 1,
    blurb: 'The classic seven: 2+2+3, a lively hopping dance. Drum on the three groups, claps in between, steps on the long one.',
    bars: lay('2+2+3', { a1: 'D.D.D..', a2: 'DcD.D..', a3: 'D.DcD.S', a4: 'DcDcD..', a5: 'D.D.DcS', a6: 'DcD.DcS', a7: 'DcDcD.S', a8: 'D.DcDc.', a9: 'DcDcDcS' },
      'a1 a1 a2 a1 | a2 a3 a2 a3 a4 a5 a2 a6 | a3 a5 a3 a5 a6 a7 a6 a7 | a1 a8 a1 a8 | a7 a9 a7 a9 a6 a7 a6 a7 a9 a9 a7 a9 | a4 a2 a1 a1'),
  },
  {
    id: 'shifting-seven', name: 'Shifting Seven', sub: 'Same seven, three groupings', meter: '7/8', eps: 5.4, level: 3, groove: 2,
    blurb: 'Seven pulses that regroup: 2+2+3, then 3+2+2, then 2+3+2. Watch the gaps in the row and move the drum with them.',
    bars: mix({
      x1: '2+2+3 D.D.D..', x2: '2+2+3 DcD.D.S', x3: '2+2+3 D.DcD.S', x4: '2+2+3 DcDcD..',
      y1: '3+2+2 D..D.D.', y2: '3+2+2 D.cD.DS', y3: '3+2+2 DcSD.D.', y4: '3+2+2 D.cDcD.',
      z1: '2+3+2 D.D..D.', z2: '2+3+2 DcD.cD.', z3: '2+3+2 D.DcSD.', z4: '2+3+2 DcDS.D.',
    }, 'x1 x1 x2 x1 | x2 x3 y1 y1 x2 x3 y1 y2 | y2 y3 z1 z1 y2 y3 z1 z2 | x3 y3 z3 x2 x3 y4 z4 y2 | z2 z3 z4 x4 y4 z4 x4 x1'),
  },
  {
    id: 'daychovo-nine', name: 'Daychovo Nine', sub: 'Nine pulses: 2+2+2+3', meter: '9/8', eps: 5.6, level: 3, groove: 0,
    blurb: 'Three quick pairs and a long three: the nine-pulse dance that always seems to run downhill, then land.',
    bars: lay('2+2+2+3', { a: 'D.D.D.D..', b: 'DcD.D.D..', c: 'D.D.DcD.S', d: 'DcD.D.DcS', e: 'D.DcDcD..', f: 'DcDcD.D.S', g: 'DcD.DcD.S', h: 'DcDcDcD.S', i: 'D.D.DcDcS' },
      'a a b a | b c b c | d e d e | f g f g | h c h d | e i e i | g f h h | b a a a'),
  },
  {
    id: 'kopanitsa-eleven', name: 'Kopanitsa Eleven', sub: 'Eleven pulses: 2+2+3+2+2', meter: '11/8', eps: 5.8, level: 4, groove: 1,
    blurb: 'Five groups, one long: 2+2+3+2+2. Hold the pairs steady and let the three stretch.',
    bars: lay('2+2+3+2+2', { a: 'D.D.D..D.D.', b: 'DcD.D..D.D.', c: 'D.D.DcSD.D.', d: 'DcD.D..DcD.', e: 'D.DcD.SD.Dc', f: 'DcDcD..D.DS', g: 'DcD.DcSDcD.', h: 'D.DcDc.DcDS', i: 'DcDcDcSD.D.' },
      'a a b a | b c b c | d e d e | f g f g | h i h i | g f e c | b a a a'),
  },
  {
    id: 'road-of-many-meters', name: 'Road of Many Meters', sub: 'Five, seven, nine, eleven', meter: '5-11', eps: 5.4, level: 5, groove: 2,
    blurb: 'A whole evening of horo in one piece: the meter changes bar by bar, from five pulses up to eleven and back home.',
    bars: mix({
      p1: '2+3 D.D..', p2: '2+3 DcD.S', p3: '2+3 D.DcS',
      s1: '2+2+3 D.D.D..', s2: '2+2+3 DcD.DcS', s3: '2+2+3 D.DcD.S', s4: '3+2+2 D..DcD.', s5: '3+2+2 D.cD.DS', s6: '2+3+2 D.D..D.', s7: '2+3+2 DcD.cD.',
      n1: '2+2+2+3 D.D.D.D..', n2: '2+2+2+3 DcD.DcD.S', n3: '2+2+2+3 D.DcD.DcS',
      e1: '2+2+3+2+2 D.D.D..D.D.', e2: '2+2+3+2+2 DcD.DcSD.D.', e3: '2+2+3+2+2 D.DcD.SDcDS',
    }, 'p1 p1 p2 p3 | s1 s1 s2 s3 | s4 s5 s6 s7 | n1 n1 n2 n3 | e1 e1 e2 e3 | n2 n3 n2 s2 | s5 s7 s3 s6 | p2 p3 p2 p1 | p1 p1 p1 p1'),
  },
];

// ---- parsing ----------------------------------------------------------------------------------------------------------------------------
const parsedBars = new Map();
// A bar as the view and the engine see it: { g: [2,2,3], n: 7, label: '2+2+3', cells: [{ i, ch, kind, pad, gi, gp, gs }] }
export function parseBar(spec) {
  if (parsedBars.has(spec)) return parsedBars.get(spec);
  const [label, pat] = spec.split(' ');
  const g = label.split('+').map(Number), n = g.reduce((a, b) => a + b, 0);
  const cells = []; let i = 0;
  g.forEach((len, gi) => {
    for (let gp = 0; gp < len; gp++, i++) {
      const ch = pat[i] ?? '.', k = KINDS[ch];
      cells.push({ i, ch, kind: k ? k.id : null, pad: k ? k.pad : null, gi, gp, gs: gp === 0, glen: len });
    }
  });
  const bar = { g, n, label, pat, cells, size: Math.max(...g) };
  parsedBars.set(spec, bar);
  return bar;
}
export const barOf = (piece, b) => parseBar(piece.bars[b]);
export const cueCount = (piece) => piece.bars.reduce((s, b) => s + parseBar(b).cells.filter((c) => c.kind).length, 0);
export const pulseDur = (p, speed = 1) => 1 / (p.eps * speed);
export const barDur = (p, b, speed = 1) => barOf(p, b).n * pulseDur(p, speed);
export const pieceSeconds = (p) => p.bars.reduce((s, _, b) => s + barDur(p, b), 0);

// ---- judging and scoring --------------------------------------------------------------------------------------------------------------
export const JUDGE = { perfect: 0.06, great: 0.1, good: 0.15 };
export const TIMING = [{ id: 'relaxed', name: 'Relaxed', k: 1.4 }, { id: 'standard', name: 'Standard', k: 1 }, { id: 'tight', name: 'Tight', k: 0.75 }];
export const SCORE = { perfect: 300, great: 200, good: 100, off: 40, miss: 0 };
export const WEIGHT = { perfect: 1, great: 0.78, good: 0.5, off: 0.2, miss: 0 };
export const ACCENT = 1.25;            // score multiplier for the drum (group accents)
export const LOOKAHEAD = 0.12;
export const FLOW = { perfect: 0.045, great: 0.03, good: 0.012, off: -0.03, miss: -0.1, stray: -0.02, layers: [0.2, 0.45, 0.7] };
export const LEARN = { pass: 0.62, tries: 3, speed: 0.85 };
export const comboMult = (c) => 1 + Math.min(3, Math.floor(c / 10) * 0.5);
export const accuracyToStars = (a) => (a >= 0.9 ? 3 : a >= 0.75 ? 2 : a >= 0.55 ? 1 : 0);
export const gradeOf = (a) => (a >= 0.95 ? 'S' : a >= 0.85 ? 'A' : a >= 0.72 ? 'B' : a >= 0.55 ? 'C' : 'D');
export const DANCERS = [4, 6, 8, 10];     // dancers in the horo chain at flow layer 0..3
export const LAYER_NAMES = ['Drone', 'Rim taps', 'Reed', 'Full band'];

// ---- the band ---------------------------------------------------------------------------------------------------------------------------
// A small deterministic generator (no Math.random: the same piece always plays the same tune).
const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const lcg = (seed) => { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
// D, E-flat, F-sharp, G, A, B-flat, C, D (the "Gypsy"-flavoured scale heard in the region), one octave of reed
const SCALE = [293.66, 311.13, 369.99, 392.0, 440.0, 466.16, 523.25, 587.33];
const melodyCache = new Map();
// Reed melody for every bar: notes on group starts (+ a quick grace note before some), ending on the tonic.
export function melody(piece) {
  if (melodyCache.has(piece.id)) return melodyCache.get(piece.id);
  const rnd = lcg(hashStr(piece.id)), out = []; let deg = 0;
  piece.bars.forEach((spec, b) => {
    const bar = parseBar(spec), notes = [];
    bar.g.forEach((len, gi) => {
      const first = bar.cells.find((c) => c.gi === gi).i;
      const last = b === piece.bars.length - 1 && gi === bar.g.length - 1;
      const r = rnd(), step = r < 0.18 ? -2 : r < 0.38 ? -1 : r < 0.5 ? 0 : r < 0.78 ? 1 : r < 0.92 ? 2 : 3;
      deg = last ? 0 : Math.max(0, Math.min(SCALE.length - 1, deg + step));
      if (b === 0 && gi === 0) deg = 0;
      notes.push({ i: first, f: SCALE[deg], len, grace: !last && rnd() < 0.3 && deg < SCALE.length - 1 ? SCALE[deg + 1] : 0 });
    });
    out.push(notes);
  });
  melodyCache.set(piece.id, out);
  return out;
}

// Build the timeline for a list of segments starting at song time `t0`.
//   count   one bar (the piece's first grouping) of count-in clicks, accents on the group starts
//   watch   bars b0..b1 performed by the lead drummer (a demonstration; not judged)
//   echo    bars b0..b1 for the player, with the guide ticks
//   play    bars b0..b1 for the player, layers follow the flow meter
//   auto    bars b0..b1 performed by the band with the full sound (Watch and Learn)
// Returns { cues, events, bars, end }. All times in seconds on the song clock.
export function buildRun(piece, segments, t0, opts = {}) {
  const speed = opts.speed ?? 1, pd = pulseDur(piece, speed), mel = melody(piece);
  const cues = [], events = [], bars = []; let t = t0;
  for (const seg of segments) {
    if (seg.kind === 'count') {
      const bar = barOf(piece, 0), bt = t;
      bar.cells.forEach((c) => events.push({ t: bt + c.i * pd, who: 'click', voice: c.gs ? 'accent' : 'beat', vel: c.gs ? 0.85 : 0.5, layer: 0, cnt: c.i + 1 }));
      bars.push({ t0: bt, t1: bt + bar.n * pd, bar: -1, n: bar.n, g: bar.g, label: bar.label, spec: piece.bars[0], count: true, role: 'count', pd, cues: [] });
      t += bar.n * pd;
      continue;
    }
    for (let b = seg.b0; b < seg.b1; b++) {
      const bar = barOf(piece, b), bt = t, role = seg.kind;
      const entry = { t0: bt, t1: bt + bar.n * pd, bar: b, n: bar.n, g: bar.g, label: bar.label, spec: piece.bars[b], seg: seg.kind, role, pd, cues: [] };
      bars.push(entry);
      const guide = seg.kind === 'watch' || seg.kind === 'echo';
      // the band: drone every bar; guide ticks in Learn; rim taps and shaker (layer 1), reed (layer 2), bells and low drum (layer 3)
      events.push({ t: bt, who: 'ens', voice: 'drone', vel: 0.5, layer: 0, dur: bar.n * pd + 0.08 });
      bar.cells.forEach((c) => {
        const ct = bt + c.i * pd;
        if (guide) events.push({ t: ct, who: 'ens', voice: 'tick', vel: c.gs ? 0.5 : 0.2, layer: 0 });
        else if (c.gs) events.push({ t: ct, who: 'ens', voice: 'tick', vel: 0.32, layer: 0 });
        if (!c.kind && !guide) events.push({ t: ct, who: 'ens', voice: c.gs ? 'tek' : 'shaker', vel: c.gs ? 0.4 : 0.28, layer: 1 });
        if (c.gs && c.i === 0) events.push({ t: ct, who: 'ens', voice: 'bell', vel: 0.35, layer: 3 });
      });
      for (const nt of mel[b] ?? []) {
        if (nt.grace) events.push({ t: bt + nt.i * pd - pd * 0.28, who: 'ens', voice: 'reed', vel: 0.28, layer: 2, pitch: nt.grace, dur: pd * 0.2 });
        events.push({ t: bt + nt.i * pd, who: 'ens', voice: 'reed', vel: 0.42, layer: 2, pitch: nt.f, dur: nt.len * pd * 0.92 });
      }
      for (const c of bar.cells) {
        if (!c.kind) continue;
        const ct = bt + c.i * pd, demo = seg.kind === 'watch' || seg.kind === 'auto';
        const q = { id: `${seg.kind}${b}.${c.i}@${Math.round(ct * 1000)}`, t: ct, kind: c.kind, pad: c.pad, bar: b, i: c.i, gs: c.gs, bd: bar.n * pd, demo, seg: seg.kind, j: null };
        cues.push(q); entry.cues.push(q);
      }
      t += bar.n * pd;
    }
  }
  events.sort((a, b) => a.t - b.t);
  cues.sort((a, b) => a.t - b.t);
  return { cues, events, bars, end: t };
}

// A plain-words description of a phrase (bars b0..b1), used by Watch and Learn's Think card.
export function describePhrase(piece, b0, b1) {
  const counts = { drum: 0, clap: 0, step: 0 }, labels = [];
  for (let b = b0; b < b1; b++) {
    const bar = barOf(piece, b);
    if (!labels.includes(bar.label)) labels.push(bar.label);
    for (const c of bar.cells) if (c.kind) counts[c.kind] += 1;
  }
  const names = { drum: 'drum', clap: 'clap', step: 'step' };
  const parts = Object.keys(counts).filter((k) => counts[k]).map((k) => `${counts[k]} ${names[k]}${counts[k] === 1 ? '' : 's'}`);
  const n = counts.drum + counts.clap + counts.step;
  return { parts, labels, n, counts, b0, b1 };
}
