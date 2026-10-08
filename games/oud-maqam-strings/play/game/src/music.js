// Oud Maqam Strings: the music and every rule constant. Pure data and pure functions (no DOM, no clock, no randomness), so the game core,
// the Rules pages and the tests all read the same numbers.
//
// Pitch is measured in cents above the open string (100 cents = one semitone, 50 = a quarter-tone). The neck maps position to pitch
// the way a real string does: the further down the neck, the closer the semitones get.

export const SLOTS = 8;                 // slots in one iqa' cycle (an eighth-note each)
export const PHRASE_SLOTS = 16;         // a phrase is two cycles
export const LEAD = 1.15;                // seconds a target ring is visible before its note
export const LOOKAHEAD = 0.12;          // audio is scheduled this far ahead of the song clock
export const TEXT_SCALES = [1, 1.25, 1.5, 2, 2.5, 3];

// ---- maqamat (the scales): eight degrees, in cents. `q` marks the quarter-tone degrees (a note that is on no piano key). -------------------
export const MAQAMAT = {
  rast: {
    id: 'rast', name: 'Rast', deg: [0, 200, 350, 500, 700, 900, 1050, 1200], q: [2, 6],
    blurb: 'Bright and open. Its third and seventh sit a quarter-tone below the major ones: the sound of Rast.',
    why: { 0: 'The tonic, the open string: home.', 1: 'A whole step above home.', 2: 'The quarter-flat third: lower than a major third, higher than a minor one. The signature of Rast.', 3: 'The fourth: where the lower trichord ends.', 4: 'The fifth: the pillar of the scale.', 5: 'A whole step above the fifth.', 6: 'The quarter-flat seventh, another note between the piano keys.', 7: 'The octave: home again, one register up.' },
  },
  bayati: {
    id: 'bayati', name: 'Bayati', deg: [0, 150, 300, 500, 700, 800, 1000, 1200], q: [1],
    blurb: 'Warm and singing. The second degree is a quarter-tone above the tonic, a half step cut in two.',
    why: { 0: 'The tonic, the open string: home.', 1: 'The quarter-sharp second: only a three-quarter step from home. The heart of Bayati.', 2: 'The minor third.', 3: 'The fourth.', 4: 'The fifth.', 5: 'The minor sixth.', 6: 'The minor seventh.', 7: 'The octave: home again, one register up.' },
  },
  hijaz: {
    id: 'hijaz', name: 'Hijaz', deg: [0, 100, 400, 500, 700, 800, 1000, 1200], q: [],
    blurb: 'Dramatic. A half step above the tonic, then a wide leap of three half steps up to the third.',
    why: { 0: 'The tonic, the open string: home.', 1: 'A half step above home.', 2: 'The major third, reached by a wide leap (an augmented second) from the note below.', 3: 'The fourth.', 4: 'The fifth.', 5: 'The minor sixth.', 6: 'The minor seventh.', 7: 'The octave: home again, one register up.' },
  },
  nahawand: {
    id: 'nahawand', name: 'Nahawand', deg: [0, 200, 300, 500, 700, 800, 1100, 1200], q: [],
    blurb: 'Gentle and minor-flavoured, with a raised seventh that leans into the octave.',
    why: { 0: 'The tonic, the open string: home.', 1: 'A whole step above home.', 2: 'The minor third.', 3: 'The fourth.', 4: 'The fifth.', 5: 'The minor sixth.', 6: 'The raised seventh, a half step below the octave.', 7: 'The octave: home again, one register up.' },
  },
};

// ---- iqa'at (the rhythm cycles): D = dum (the low stroke), T = tak (the high stroke), . = silence. Simplified for play. ----------------------
export const IQA = {
  maqsum: { id: 'maqsum', name: "Maqsum", slots: 'DT.TD.T.', blurb: 'The most common cycle in Arab music: dum, tak, rest, tak, dum, rest, tak.' },
  baladi: { id: 'baladi', name: "Baladi", slots: 'DDT.D.T.', blurb: 'Earthy and steady: two dums, a tak, then dum and tak again.' },
  saidi: { id: 'saidi', name: "Saidi", slots: 'DT.DD.T.', blurb: 'A driving cycle from Upper Egypt, with a dum pair in the middle.' },
  ayyub: { id: 'ayyub', name: "Ayyub", slots: 'D..DT.T.', blurb: 'A rolling cycle with a long pause after the first dum.' },
};

// ---- the pieces. A phrase is 16 slots (two cycles). Tokens: `.` rest, `n` a scale degree 0-7, `a>b` a slide from degree a to degree b
// (the next slot must be a rest: the slide takes two slots). Every piece plays its four phrases in the order of FORM. ----------------------
export const FORM = [0, 1, 0, 1, 2, 3, 2, 3];
export const PIECES = [
  { id: 'dawn-in-rast', title: 'Dawn in Rast', maqam: 'rast', iqa: 'maqsum', bpm: 84, tonic: 196, level: 1, blurb: 'First steps: the tonic, the second, and the quarter-flat third.',
    phrases: ['0 . . 1 2 . 1 .  0 . . 1 2 . 1 0', '2 . . 3 4 . 3 .  2 . . 3 2 . 1 0', '4 . . 4 3 . 2 .  4 . . 5 4 . 3 2', '4 . . 3 2 . 1 .  0 . . 2 1 . 0 .'] },
  { id: 'evening-in-bayati', title: 'Evening in Bayati', maqam: 'bayati', iqa: 'baladi', bpm: 80, tonic: 220, level: 1, blurb: 'The quarter-sharp second, with the first gentle slides.',
    phrases: ['0 0 1 . 0 . 1 .  0 0 1 . 2 . 1 0', '2 2 3 . 2 . 1 .  2 3 4 . 3 . 2 1', '4 . 3>2 . 4 . 3 .  2>1 . 0 . 2 . 1 0', '4 4 5 . 4 . 3 .  2>1 . 1 . 0 . . .'] },
  { id: 'hijaz-caravan', title: 'Hijaz Caravan', maqam: 'hijaz', iqa: 'saidi', bpm: 96, tonic: 220, level: 2, blurb: 'A quicker cycle and the wide leap that gives Hijaz its drama.',
    phrases: ['0 1 . 0 1 . 0 .  0 1 . 2 1 . 0 .', '2 3 . 2 3 . 4 .  3 2 . 1 2 . 1 0', '4 5 . 4 5 . 6 .  5 4 . 3 4 . 2 .', '7 6 . 5 4 . 3 .  2 1 . 2 1 . 0 .'] },
  { id: 'rast-lanterns', title: 'Rast Lanterns', maqam: 'rast', iqa: 'ayyub', bpm: 100, tonic: 196, level: 2, blurb: 'Leaps, slides, and the quarter-flat seventh.',
    phrases: ['0 . . 2 4 . 2 .  0 . . 2 4 . 6 .', '4>2 . . 4 5 . 4 .  2>0 . . 2 3 . 2 .', '6 . . 7 6 . 4 .  6 . . 7 6 . 4 2', '7>4 . . 6 5 . 4 .  2 . . 1 0 . 0 .'] },
  { id: 'bayati-courtyard', title: 'Bayati Courtyard', maqam: 'bayati', iqa: 'maqsum', bpm: 92, tonic: 220, level: 3, blurb: 'A longer climb to the octave, with slides down.',
    phrases: ['0 1 . 1 2 . 1 .  0 1 . 2 1 . 0 .', '2 3 . 3 4 . 3 .  4>2 . . 3 4 . 3 2', '4 5 . 5 6 . 5 .  7>4 . . 5 6 . 5 4', '4 3 . 3 2 . 1 .  2 1 . 1 . 0 . .'] },
  { id: 'nahawand-night', title: 'Nahawand Night', maqam: 'nahawand', iqa: 'saidi', bpm: 108, tonic: 261.63, level: 3, blurb: 'The fastest cycle, with repeated notes for the plectrum hand.',
    phrases: ['0 0 . 2 2 . 3 .  4 3 . 2 1 . 0 .', '4 4 . 5 5 . 4 .  3 2 . 3 4 . 2 .', '5 6 . 7 6 . 5 .  4>2 . . 3 4 . 5 .', '7 6 . 5 4 . 3 .  2 1 . 2 1 . 0 .'] },
];

export const slotDur = (piece, speed = 1) => 30 / piece.bpm / speed;          // seconds per slot (an eighth note)
export const cycleDur = (piece, speed = 1) => slotDur(piece, speed) * SLOTS;
export const phraseDur = (piece, speed = 1) => slotDur(piece, speed) * PHRASE_SLOTS;

// Parse "a . b>c" into 16 slots: null or { deg, to? }.
export function parsePhrase(str) {
  const toks = str.trim().split(/\s+/);
  return toks.map((t) => {
    if (t === '.') return null;
    const m = /^(\d)(?:>(\d))?$/.exec(t);
    return m ? (m[2] !== undefined ? { deg: +m[1], to: +m[2] } : { deg: +m[1] }) : null;
  });
}
export const centsOf = (piece, deg) => MAQAMAT[piece.maqam].deg[deg];
export const pieceSpan = (piece) => {                                          // how many cents of neck to show: the highest note used plus a margin
  let mx = 0;
  for (const ph of piece.phrases) for (const s of parsePhrase(ph)) if (s) mx = Math.max(mx, centsOf(piece, s.deg), s.to !== undefined ? centsOf(piece, s.to) : 0);
  return Math.max(800, Math.ceil((mx + 150) / 50) * 50);
};
export const spanOfMaqam = () => 1250;

// ---- neck geometry in pitch: position (0 at the nut, 1 at the far end) <-> cents, with the real string law -------------------------------
export const posOfCents = (c, span) => (1 - Math.pow(2, -c / 1200)) / (1 - Math.pow(2, -span / 1200));
export const centsOfPos = (f, span) => -1200 * Math.log2(1 - Math.max(0, Math.min(1, f)) * (1 - Math.pow(2, -span / 1200)));
export const hzOf = (tonic, c) => tonic * Math.pow(2, c / 1200);

// ---- judging ----------------------------------------------------------------------------------------------------------------------------
export const JUDGE = { perfect: 0.07, great: 0.12, good: 0.19 };               // seconds either side of the note (Normal timing)
export const TIMING = [{ name: 'Easy', k: 1.35 }, { name: 'Normal', k: 1 }, { name: 'Strict', k: 0.75 }];
export const PITCH_WINDOW = [                                                    // cents either side of the target
  { name: 'Gentle', p: 30, g: 52, o: 85 },
  { name: 'Standard', p: 22, g: 40, o: 65 },
  { name: 'Strict', p: 14, g: 26, o: 45 },
];
export const ASSIST = [{ name: 'Off', r: 0, k: 0 }, { name: 'Light', r: 22, k: 0.45 }, { name: 'Strong', r: 40, k: 0.75 }];
export const SCORE = { perfect: 100, great: 75, good: 45, off: 20, miss: 0 };
export const WEIGHT = { perfect: 1, great: 0.85, good: 0.6, off: 0.3, miss: 0 };
export const GRADES = ['perfect', 'great', 'good', 'off'];
export const STARS = [0.55, 0.75, 0.9];
export const ENSEMBLE = { start: 0, max: 3, every: 8 };
export const LEARN = { pass: 0.55, tries: 2 };
export const SLIDE_GRACE = 0.16;
export const comboMult = (c) => 1 + Math.min(4, Math.floor(c / 10)) * 0.25;
export const accuracyToStars = (acc) => (acc >= STARS[2] ? 3 : acc >= STARS[1] ? 2 : acc >= STARS[0] ? 1 : 0);
export const gradeOf = (acc) => (acc >= 0.95 ? 'Masterful' : acc >= 0.85 ? 'Excellent' : acc >= 0.7 ? 'Fine' : acc >= 0.5 ? 'Getting there' : 'Keep listening');

// Pull a finger pitch gently toward the nearest scale degree (assist). Returns the pitch to sound and to judge.
export function assisted(c, maqam, assistIdx) {
  const a = ASSIST[assistIdx] ?? ASSIST[0];
  if (!a.r) return c;
  let best = null;
  for (const d of MAQAMAT[maqam].deg) if (best === null || Math.abs(d - c) < Math.abs(best - c)) best = d;
  const e = c - best;
  return Math.abs(e) <= a.r ? best + e * (1 - a.k) : c;
}
export const nearestDegree = (c, maqam) => {
  const ds = MAQAMAT[maqam].deg; let bi = 0;
  ds.forEach((d, i) => { if (Math.abs(d - c) < Math.abs(ds[bi] - c)) bi = i; });
  return { idx: bi, cents: ds[bi], err: c - ds[bi] };
};
export const degLabel = (maqam, idx) => `${idx + 1}${MAQAMAT[maqam].q.includes(idx) ? '½♭' : ''}`.replace('½♭', ' ¼');
export const tendency = (c) => (Math.abs(c) < 6 ? 'right on it' : c > 0 ? (c > 25 ? 'quite sharp' : 'a little sharp') : (c < -25 ? 'quite flat' : 'a little flat'));

// ---- building the events of a stretch of play --------------------------------------------------------------------------------------------
// segments: { kind: 'count' } | { kind: 'listen' | 'echo' | 'play' | 'auto', ph: [phrase indexes] }.
// Events: { t, who: 'click' | 'back' | 'demo' | 'note', ... }  `note` is for the player, `demo` is the computer playing the oud.
export function buildRun(piece, segs, startT, opt = {}) {
  const sd = slotDur(piece, opt.speed ?? 1), beat = sd * 2, iq = IQA[piece.iqa].slots;
  const ev = [], bars = [];
  let t = startT;
  const T0 = startT;
  for (const seg of segs) {
    if (seg.kind === 'count') {
      for (let i = 0; i < 4; i++) ev.push({ t: t + i * beat, who: 'click', k: i === 0 ? 'accent' : 'beat', cnt: true });
      t += 4 * beat;
      continue;
    }
    for (const pi of seg.ph) {
      const slots = parsePhrase(piece.phrases[pi]);
      bars.push({ t0: t, t1: t + PHRASE_SLOTS * sd, phrase: pi, kind: seg.kind });
      for (let i = 0; i < PHRASE_SLOTS; i++) {
        const st = t + i * sd, ch = iq[i % SLOTS];
        if (opt.backing !== false) {
          if (ch === 'D') ev.push({ t: st, who: 'back', k: 'dum', slot: i % SLOTS });
          else if (ch === 'T') ev.push({ t: st, who: 'back', k: 'tak', slot: i % SLOTS });
          else if (i % 2 === 1) ev.push({ t: st, who: 'back', k: 'sak', slot: i % SLOTS, ghost: true });
        }
        if (opt.click && i % 2 === 0) ev.push({ t: st, who: 'click', k: i % SLOTS === 0 ? 'accent' : 'beat' });
        const s = slots[i];
        if (!s) continue;
        const e = { t: st, c: centsOf(piece, s.deg), deg: s.deg, phrase: pi, slot: i, who: seg.kind === 'echo' || seg.kind === 'play' ? 'note' : 'demo' };
        if (s.to !== undefined) { e.to = centsOf(piece, s.to); e.toDeg = s.to; e.dur = 2 * sd; }
        ev.push(e);
      }
      t += PHRASE_SLOTS * sd;
    }
  }
  ev.sort((a, b) => a.t - b.t || (a.who === 'note' ? 1 : 0) - (b.who === 'note' ? 1 : 0));
  return { events: ev, bars, T0, end: t };
}

// A short caption saying what the finger is doing and why (Watch and Learn, Listen, hints).
export function captionFor(piece, e, prev) {
  const M = MAQAMAT[piece.maqam], lab = (d) => degLabel(piece.maqam, d), q = M.q.includes(e.deg);
  if (e.to !== undefined) {
    const up = e.to > e.c;
    return `Pluck degree ${lab(e.deg)} and slide ${up ? 'up' : 'down'} to ${lab(e.toDeg)} in one stroke. ${M.why[e.toDeg]}`;
  }
  if (prev && prev.deg === e.deg) return `The same degree again (${lab(e.deg)}): keep the finger still and pluck with the plectrum hand.`;
  if (q) return `Land on degree ${lab(e.deg)}. ${M.why[e.deg]}`;
  if (prev && prev.deg !== undefined && Math.abs(prev.deg - e.deg) >= 3) return `A leap of ${Math.abs(prev.deg - e.deg)} degrees to ${lab(e.deg)}: lift, move, land. ${M.why[e.deg]}`;
  return `Degree ${lab(e.deg)}. ${M.why[e.deg]}`;
}

// The finger path of the computer player (and the hint ghost): where the fretting finger is at song time t, given the notes sorted by time.
export function fingerAt(notes, t) {
  if (!notes.length) return null;
  let lo = 0, hi = notes.length - 1, k = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (notes[m].t <= t) { k = m; lo = m + 1; } else hi = m - 1; }
  const endC = (n) => (n.to !== undefined ? n.to : n.c);
  const ease = (x) => x * x * (3 - 2 * x);
  if (k < 0) { const n = notes[0]; return { c: n.c, down: false, note: n, next: n }; }
  const p = notes[k], nx = notes[k + 1] ?? null;
  if (p.to !== undefined && t < p.t + p.dur) return { c: p.c + (p.to - p.c) * ease((t - p.t) / p.dur), down: true, note: p, next: nx };
  const base = endC(p), pEnd = p.t + (p.to !== undefined ? p.dur : 0.0);
  if (!nx) return { c: base, down: t - p.t < 0.6, note: p, next: null };
  const gap = nx.t - pEnd, mv = Math.min(0.2, gap * 0.6), s = nx.t - mv;
  if (t >= s) return { c: base + (nx.c - base) * ease((t - s) / mv), down: false, note: p, next: nx };
  return { c: base, down: t - p.t < 0.25, note: p, next: nx };
}

// ---- free play / taqsim: the journey a taqsim usually takes through a maqam ------------------------------------------------------------------
export const JOURNEY = [
  { goal: 'Start at home: pluck the open string or the first degree.', degs: [0] },
  { goal: 'Rise to the third degree.', degs: [2] },
  { goal: 'Reach the fifth degree, the pillar of the scale.', degs: [4] },
  { goal: 'Climb to the seventh degree or the octave.', degs: [6, 7] },
  { goal: 'Settle back to home.', degs: [0] },
];
