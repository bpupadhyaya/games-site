// Vallenato Accordion Trio: the music and every rule constant. Pure data + pure functions (no browser, no clock).
// Everything the Rules page quotes comes from the constants below, so the page can never disagree with the engine.
//
// Time model: a piece is a list of bars on a step grid (16 steps per 4/4 bar, 12 per 12/8 bar). Song time 0 is the start of the
// count-in bar. Every note has an exact song time; the game judges a touch against those times.

export const PARTS = ['gua', 'caja', 'acc'];                 // seat order = recording order of the Studio takes
export const PART = {
  gua: { id: 'gua', name: 'Guacharaca', short: 'Scraper', col: '#7fe3c2', verb: 'Scrape' },
  caja: { id: 'caja', name: 'Caja', short: 'Drum', col: '#ffb02e', verb: 'Drum' },
  acc: { id: 'acc', name: 'Accordion', short: 'Melody', col: '#ff6b57', verb: 'Play' },
};

// Timing windows in seconds either side of the note (before the Timing preference scales them).
export const JUDGE = { perfect: 0.05, great: 0.09, good: 0.14 };
export const TIMING = [{ id: 'relaxed', name: 'Relaxed', k: 1.35 }, { id: 'standard', name: 'Standard', k: 1 }, { id: 'strict', name: 'Strict', k: 0.75 }];
export const SPEEDS = [{ id: 'normal', name: 'Normal', k: 1 }, { id: 'slow', name: 'Slow', k: 0.8 }];
export const BELLOWS = [{ id: 'hold', name: 'Hold to pull' }, { id: 'toggle', name: 'Tap to switch' }, { id: 'auto', name: 'Automatic' }];
export const SCORE = { perfect: 100, great: 70, good: 40, off: 20, miss: 0 };
export const WEIGHT = { perfect: 1, great: 0.8, good: 0.55, off: 0.3, miss: 0 };
export const STRAY_COST = 0.3;                               // accuracy lost for each press that has no note of yours near it
export const COMBO_STEP = 10, COMBO_MAX = 4;                 // multiplier = 1 + floor(combo / 10), at most 4
export const STARS = [0.5, 0.75, 0.9];                       // accuracy needed for 1, 2, 3 stars
export const TOGETHER = { tight: 0.035, loose: 0.09 };        // seconds: within `tight` is locked in, beyond `loose` counts for nothing
export const HANDOFF_BEATS = 1;                              // Live Trio: the first beat of a section is covered by the band
export const STROKE_UNITS = 34;                              // a scrape registers after the finger travels this far (virtual units)
export const TAP_STROKE_CAP = 'good';                        // a plain tap on the guacharaca counts, but never above this grade
export const LOOKAHEAD = 0.12;                               // seconds of audio scheduled ahead of the song clock
export const SEE_AHEAD = 2.4;                                // seconds of the score ribbon visible ahead of the playhead

export const comboMult = (c) => Math.min(COMBO_MAX, 1 + Math.floor(c / COMBO_STEP));
export const starsOf = (acc) => (acc >= STARS[2] ? 3 : acc >= STARS[1] ? 2 : acc >= STARS[0] ? 1 : 0);
export const gradeWord = (acc) => (acc >= 0.97 ? 'Flawless' : acc >= 0.9 ? 'Brilliant' : acc >= 0.75 ? 'Solid' : acc >= 0.5 ? 'Getting there' : 'Keep practising');
export const togetherWord = (v) => (v >= 0.9 ? 'Locked in' : v >= 0.75 ? 'Tight' : v >= 0.55 ? 'Loose' : 'Scattered');

// ---- the accordion: seven melody buttons, each with a push note and a pull note (a diatonic accordion) ---------------------------------
export const BUTTONS = {
  push: ['C4', 'E4', 'G4', 'C5', 'E5', 'G5', 'C6'],
  pull: ['D4', 'G4', 'B4', 'D5', 'F5', 'A5', 'B5'],
};
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export const noteFreq = (name) => { const n = SEMI[name[0]] + (Number(name[1]) + 1) * 12; return 440 * Math.pow(2, (n - 69) / 12); };
export const buttonFreq = (btn, pull) => noteFreq((pull ? BUTTONS.pull : BUTTONS.push)[btn]);

// ---- patterns ----------------------------------------------------------------------------------------------------------------------------
// Guacharaca: strokes [step, dir, accent]. dir R = a scrape to the right, L = to the left. `fill` replaces the last beat of every 4th bar.
const G = (s, d, a = 0) => ({ s, d, a });
const alt = (steps, acc = []) => steps.map((s, i) => G(s, i % 2 ? 'L' : 'R', acc.includes(s) ? 1 : 0));
export const GUA = {
  'paseo-b': { body: alt([0, 4, 8, 12], [4, 12]), fill: alt([0, 4, 8, 12, 14], [4, 12]) },
  'paseo-a': { body: alt([0, 2, 4, 6, 8, 10, 12, 14], [4, 12]), fill: alt([0, 2, 4, 6, 8, 10, 12, 13, 14, 15], [4, 12]) },
  'merengue-a': { body: alt([0, 2, 4, 6, 8, 10, 12, 14], [2, 6, 10, 14]), fill: alt([0, 2, 4, 6, 8, 10, 12, 13, 14, 15], [2, 6, 10, 14]) },
  'merengue-b': { body: alt([0, 2, 3, 4, 6, 8, 10, 11, 12, 14], [4, 12]), fill: alt([0, 2, 3, 4, 6, 8, 10, 11, 12, 13, 14, 15], [4, 12]) },
  'son-a': { body: alt([0, 3, 6, 8, 11, 14], [6, 14]), fill: alt([0, 3, 6, 8, 11, 12, 14, 15], [6, 14]) },
  'puya-a': { body: alt([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], [0, 3, 6, 9]), fill: alt([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], [0, 3, 6, 9]) },
};
// Caja: [step, kind (tum = the deep palm stroke, tak = the sharp finger stroke), soft]
const C = (s, k, f = 0) => ({ s, k, f });
export const CAJA = {
  'paseo-b': { body: [C(0, 'tum'), C(8, 'tum'), C(12, 'tak')], fill: [C(0, 'tum'), C(8, 'tum'), C(12, 'tak'), C(14, 'tak', 1)] },
  'paseo-a': { body: [C(0, 'tum'), C(6, 'tak'), C(8, 'tum'), C(10, 'tum', 1), C(12, 'tak')], fill: [C(0, 'tum'), C(6, 'tak'), C(8, 'tum'), C(12, 'tak'), C(14, 'tum'), C(15, 'tak')] },
  'merengue-a': { body: [C(0, 'tum'), C(2, 'tak'), C(4, 'tum'), C(6, 'tak'), C(8, 'tum'), C(10, 'tak'), C(12, 'tum'), C(14, 'tak')], fill: [C(0, 'tum'), C(2, 'tak'), C(4, 'tum'), C(6, 'tak'), C(8, 'tum'), C(10, 'tak'), C(12, 'tum'), C(13, 'tak', 1), C(14, 'tak')] },
  'merengue-b': { body: [C(0, 'tum'), C(3, 'tak'), C(4, 'tum'), C(6, 'tak'), C(8, 'tum'), C(11, 'tak'), C(12, 'tum'), C(14, 'tak')], fill: [C(0, 'tum'), C(3, 'tak'), C(4, 'tum'), C(6, 'tak'), C(8, 'tum'), C(11, 'tak'), C(12, 'tum'), C(14, 'tak'), C(15, 'tak', 1)] },
  'son-a': { body: [C(0, 'tum'), C(5, 'tak'), C(8, 'tum'), C(11, 'tak'), C(14, 'tak', 1)], fill: [C(0, 'tum'), C(5, 'tak'), C(8, 'tum'), C(11, 'tak'), C(13, 'tum', 1), C(14, 'tak'), C(15, 'tak', 1)] },
  'puya-a': { body: [C(0, 'tum'), C(3, 'tak'), C(6, 'tum'), C(8, 'tak', 1), C(9, 'tak'), C(11, 'tum', 1)], fill: [C(0, 'tum'), C(3, 'tak'), C(6, 'tum'), C(8, 'tak', 1), C(9, 'tak'), C(10, 'tum'), C(11, 'tak')] },
};

// ---- the six original pieces ---------------------------------------------------------------------------------------------------------------
// melody: one string per bar, "step:Pitch:length" tokens. 12 bars = three 4-bar phrases. relay: the seat in the spotlight for each 2-bar section.
export const AIRES = {
  paseo: { name: 'Paseo', line: 'The easy, flowing walking-pace aire. A relaxed 4/4 with a steady lilt.' },
  merengue: { name: 'Merengue', line: 'A bright, quick two-in-a-bar aire where the drum drives boom-tak, boom-tak.' },
  son: { name: 'Son', line: 'The slow, singing aire. Syncopated, with room for the accordion to breathe.' },
  puya: { name: 'Puya', line: 'The fastest, rolling aire in a compound 12/8 swing.' },
};
export const PIECES = [
  {
    id: 'patio-sunrise', name: 'Patio Sunrise', aire: 'paseo', bpm: 96, spb: 4, spbar: 16, bars: 12, level: { gua: 1, caja: 1, acc: 1 }, gua: 'paseo-b', caja: 'paseo-b',
    blurb: 'A calm first piece: long, friendly notes in the middle of the accordion, and a drum that only speaks four times a bar.',
    melody: ['0:E5:4 4:G5:4 8:E5:4 12:D5:4', '0:C5:8 8:D5:4 12:E5:4', '0:G5:4 4:E5:4 8:D5:4 12:C5:4', '0:D5:12',
      '0:E5:4 4:G5:4 8:A5:4 12:G5:4', '0:E5:8 8:G5:4 12:E5:4', '0:D5:4 4:E5:4 8:D5:4 12:C5:4', '0:C5:12',
      '0:E5:4 4:G5:4 8:E5:4 12:D5:4', '0:C5:8 8:D5:4 12:E5:4', '0:G5:4 4:A5:4 8:G5:4 12:E5:4', '0:E5:4 4:D5:4 8:C5:8'],
    relay: ['gua', 'caja', 'acc', 'acc', 'gua', 'acc'],
  },
  {
    id: 'mango-lane', name: 'Mango Lane', aire: 'merengue', bpm: 112, spb: 4, spbar: 16, bars: 12, level: { gua: 2, caja: 2, acc: 2 }, gua: 'merengue-a', caja: 'merengue-a',
    blurb: 'A quick, cheerful merengue: eighth notes on the accordion over a boom-tak drum and a scraper that leans on the off-beat.',
    melody: ['0:G5:2 2:E5:2 4:G5:2 6:A5:2 8:G5:4 12:E5:4', '0:D5:2 2:E5:2 4:G5:2 6:E5:2 8:D5:4 12:C5:4', '0:G5:2 2:E5:2 4:G5:2 6:A5:2 8:B5:4 12:A5:4', '0:G5:4 4:E5:4 8:D5:8',
      '0:C6:2 2:B5:2 4:A5:2 6:G5:2 8:A5:4 12:G5:4', '0:E5:2 2:G5:2 4:E5:2 6:D5:2 8:C5:8', '0:D5:2 2:E5:2 4:G5:2 6:A5:2 8:G5:4 12:E5:4', '0:D5:4 4:E5:4 8:D5:4 12:C5:4',
      '0:G5:2 2:E5:2 4:G5:2 6:A5:2 8:G5:4 12:E5:4', '0:D5:2 2:E5:2 4:G5:2 6:E5:2 8:D5:4 12:C5:4', '0:C6:2 2:B5:2 4:A5:2 6:G5:2 8:E5:4 12:G5:4', '0:C5:2 2:E5:2 4:G5:2 6:C6:2 8:C6:8'],
    relay: ['caja', 'acc', 'gua', 'acc', 'caja', 'acc'],
  },
  {
    id: 'dusk-on-the-savanna', name: 'Dusk on the Savanna', aire: 'son', bpm: 72, spb: 4, spbar: 16, bars: 12, level: { gua: 2, caja: 2, acc: 2 }, gua: 'son-a', caja: 'son-a',
    blurb: 'A slow, singing son. Everything lands a little off the beat, so the three parts have to listen to each other.',
    melody: ['0:G4:6 6:C5:2 8:E5:6 14:D5:2', '0:C5:6 6:D5:2 8:E5:8', '0:G5:6 6:E5:2 8:D5:6 14:C5:2', '0:B4:8 8:C5:8',
      '0:E5:6 6:G5:2 8:A5:6 14:G5:2', '0:E5:6 6:D5:2 8:C5:8', '0:D5:6 6:E5:2 8:G5:6 14:E5:2', '0:D5:8 8:B4:8',
      '0:G4:6 6:C5:2 8:E5:6 14:D5:2', '0:C5:6 6:D5:2 8:E5:8', '0:G5:6 6:A5:2 8:G5:6 14:E5:2', '0:C5:16'],
    relay: ['acc', 'gua', 'caja', 'acc', 'gua', 'acc'],
  },
  {
    id: 'river-crossing', name: 'River Crossing', aire: 'puya', bpm: 92, spb: 3, spbar: 12, bars: 12, level: { gua: 3, caja: 2, acc: 3 }, gua: 'puya-a', caja: 'puya-a',
    blurb: 'A rolling puya in groups of three. The scraper never stops, so its accents are what you steer by.',
    melody: ['0:E5:1 1:G5:1 2:A5:1 3:G5:3 6:E5:3 9:D5:3', '0:C5:3 3:D5:3 6:E5:3 9:G5:3', '0:A5:1 1:G5:1 2:E5:1 3:G5:3 6:A5:3 9:B5:3', '0:G5:6 6:E5:3 9:D5:3',
      '0:C6:3 3:B5:3 6:A5:3 9:G5:3', '0:E5:1 1:G5:1 2:E5:1 3:D5:3 6:C5:6', '0:D5:3 3:E5:3 6:G5:1 7:A5:1 8:G5:1 9:E5:3', '0:D5:6 6:C5:6',
      '0:E5:1 1:G5:1 2:A5:1 3:G5:3 6:E5:3 9:D5:3', '0:C5:3 3:D5:3 6:E5:3 9:G5:3', '0:A5:1 1:G5:1 2:E5:1 3:G5:3 6:C6:3 9:A5:3', '0:G5:3 3:E5:3 6:C5:6'],
    relay: ['gua', 'acc', 'caja', 'gua', 'acc', 'caja'],
  },
  {
    id: 'corral-dance', name: 'Corral Dance', aire: 'merengue', bpm: 124, spb: 4, spbar: 16, bars: 12, level: { gua: 3, caja: 3, acc: 3 }, gua: 'merengue-b', caja: 'merengue-b',
    blurb: 'A fast merengue with sixteenth-note runs, a syncopated drum and a scraper that skips beats. For when the basics are in your hands.',
    melody: ['0:E5:2 2:G5:1 3:A5:1 4:G5:2 6:E5:2 8:D5:2 10:E5:2 12:G5:4', '0:A5:2 2:G5:1 3:E5:1 4:D5:2 6:E5:2 8:G5:4 12:E5:4', '0:C6:2 2:B5:1 3:A5:1 4:G5:2 6:A5:2 8:G5:2 10:E5:2 12:D5:4', '0:E5:2 2:G5:2 4:E5:2 6:D5:2 8:C5:8',
      '0:G5:2 2:A5:2 4:B5:2 6:C6:2 8:B5:2 10:A5:2 12:G5:4', '0:F5:2 2:E5:2 4:F5:2 6:G5:2 8:E5:8', '0:D5:1 1:E5:1 2:G5:2 4:A5:2 6:G5:2 8:E5:2 10:D5:2 12:C5:4', '0:D5:4 4:E5:4 8:G5:4 12:B5:4',
      '0:E5:2 2:G5:1 3:A5:1 4:G5:2 6:E5:2 8:D5:2 10:E5:2 12:G5:4', '0:A5:2 2:G5:1 3:E5:1 4:D5:2 6:E5:2 8:G5:4 12:E5:4', '0:C6:2 2:B5:1 3:A5:1 4:G5:2 6:A5:2 8:B5:2 10:A5:2 12:G5:4', '0:E5:2 2:G5:2 4:C6:2 6:G5:2 8:C6:8'],
    relay: ['acc', 'caja', 'gua', 'acc', 'caja', 'acc'],
  },
  {
    id: 'lantern-night', name: 'Lantern Night', aire: 'paseo', bpm: 104, spb: 4, spbar: 16, bars: 12, level: { gua: 3, caja: 3, acc: 3 }, gua: 'paseo-a', caja: 'paseo-a',
    blurb: 'The finale: a long paseo with wide leaps across all seven buttons, so the bellows has to change direction again and again.',
    melody: ['0:C5:2 2:E5:2 4:G5:2 6:B5:2 8:C6:4 12:A5:2 14:G5:2', '0:F5:4 4:A5:2 6:G5:2 8:E5:4 12:D5:4', '0:G4:2 2:C5:2 4:E5:2 6:G5:2 8:A5:4 12:F5:2 14:D5:2', '0:E5:4 4:D5:4 8:B4:4 12:C5:4',
      '0:E5:2 2:G5:2 4:C6:2 6:B5:2 8:A5:2 10:F5:2 12:G5:4', '0:D5:2 2:F5:2 4:A5:2 6:B5:2 8:C6:8', '0:C6:2 2:A5:2 4:G5:2 6:F5:2 8:E5:2 10:D5:2 12:C5:2 14:B4:2', '0:C5:4 4:E5:4 8:G5:8',
      '0:C5:2 2:E5:2 4:G5:2 6:B5:2 8:C6:4 12:A5:2 14:G5:2', '0:F5:4 4:A5:2 6:G5:2 8:E5:4 12:G5:4', '0:G4:2 2:C5:2 4:E5:2 6:G5:2 8:A5:4 12:F5:2 14:D5:2', '0:C5:2 2:E5:2 4:G5:2 6:C6:2 8:C6:8'],
    relay: ['caja', 'acc', 'acc', 'gua', 'caja', 'acc'],
  },
];

// What each part does in each aire, one line per part (shown by Watch and Learn and on the piece screen).
export const WHY = {
  gua: {
    paseo: 'The scraper keeps the pulse: a scrape right on the beat, a scrape left in between, with a heavier accent on beats two and four.',
    merengue: 'The scraper drives the merengue: quick alternate strokes, leaning on the off-beat accents.',
    son: 'In a son the scraper is lilting: strokes fall in a three-three-two shape instead of an even tick.',
    puya: 'In a puya the scraper never rests: a stroke on every step, with an accent on each group of three.',
  },
  caja: {
    paseo: 'The caja anchors the bar: a deep tum on the downbeat, a sharp tak to answer it.',
    merengue: 'The caja plays boom-tak, boom-tak: a tum on each beat and a tak between.',
    son: 'The caja leaves gaps: a tak that lands just late, so the groove sways.',
    puya: 'The caja rolls in threes: tum on the beat, taks tumbling in between.',
  },
  acc: {
    paseo: 'The accordion sings the tune. Each button gives one note when you pull the bellows and another when you push.',
    merengue: 'The accordion runs the melody in quick eighth notes. Watch the bellows: it changes often.',
    son: 'The accordion holds long notes and lets the other two speak between them.',
    puya: 'The accordion plays little runs in threes; the push and pull switch quickly.',
  },
};

// ---- building a piece into a timeline -------------------------------------------------------------------------------------------------
const parseBar = (str) => str.split(' ').map((tok) => { const [s, p, l] = tok.split(':'); return { s: Number(s), pitch: p, len: Number(l) }; });
// Which (button, direction) plays each pitch. We prefer to keep the bellows going the way it was: fewer changes, as a player would.
function resolveButton(pitch, prevPull) {
  const c = [];
  BUTTONS.push.forEach((p, i) => { if (p === pitch) c.push({ btn: i, pull: false }); });
  BUTTONS.pull.forEach((p, i) => { if (p === pitch) c.push({ btn: i, pull: true }); });
  if (!c.length) throw new Error('pitch not on the accordion: ' + pitch);
  if (c.length === 1) return c[0];
  const same = c.find((x) => x.pull === prevPull);
  return same ?? c[0];
}

const jitter = (i) => ((i * 37) % 11 - 5) * 0.0016;           // +-8 ms of deterministic "band feel"

// buildTimeline(piece, speed) -> { stepDur, beat, bar, T0, end, notes: {gua,caja,acc}, bass: [...], clicks: [...], bars: [...], sections: [...] }
export function buildTimeline(piece, speed = 1) {
  const stepDur = 60 / (piece.bpm * speed) / piece.spb, beat = stepDur * piece.spb, bar = stepDur * piece.spbar;
  const T0 = bar + 0.25;                                          // one count-in bar
  const at = (b, s) => T0 + (b * piece.spbar + s) * stepDur;
  const notes = { gua: [], caja: [], acc: [] };
  let prevPull = false, id = 0;
  for (let b = 0; b < piece.bars; b++) {
    const fill = b % 4 === 3;
    for (const g of (fill ? GUA[piece.gua].fill : GUA[piece.gua].body)) notes.gua.push({ i: id++, part: 'gua', b, s: g.s, t: at(b, g.s), dur: stepDur * 1.5, dir: g.d, acc: !!g.a });
    for (const c of (fill ? CAJA[piece.caja].fill : CAJA[piece.caja].body)) notes.caja.push({ i: id++, part: 'caja', b, s: c.s, t: at(b, c.s), dur: stepDur, kind: c.k, soft: !!c.f });
    for (const m of parseBar(piece.melody[b])) {
      const r = resolveButton(m.pitch, prevPull); prevPull = r.pull;
      const other = r.pull ? BUTTONS.push[r.btn] : BUTTONS.pull[r.btn];
      notes.acc.push({ i: id++, part: 'acc', b, s: m.s, t: at(b, m.s), dur: Math.max(stepDur * 0.9, m.len * stepDur * 0.92), btn: r.btn, pull: r.pull, pitch: m.pitch, freq: noteFreq(m.pitch), wrong: noteFreq(other) });
    }
  }
  for (const p of PARTS) notes[p].sort((a, c) => a.t - c.t || a.i - c.i);
  // the accordion's left hand: a bass note on the first and third beat of each bar (played by the app, never judged)
  const bass = [];
  for (let b = 0; b < piece.bars; b++) for (let k = 0; k < 4; k += 2) bass.push({ t: at(b, k * piece.spb), freq: k === 0 ? noteFreq('C3') : noteFreq('G2'), vel: k === 0 ? 0.8 : 0.6 });
  const clicks = [];
  for (let k = 0; k < 4; k++) clicks.push({ t: T0 - bar + k * beat, accent: k === 0, cnt: true });
  for (let b = 0; b < piece.bars; b++) for (let k = 0; k < 4; k++) clicks.push({ t: at(b, k * piece.spb), accent: k === 0, cnt: false });
  const bars = []; for (let b = 0; b < piece.bars; b++) bars.push({ b, t0: at(b, 0), t1: at(b + 1, 0) });
  const sections = piece.relay.map((seat, k) => ({ k, seat, b0: k * 2, b1: k * 2 + 2, t0: at(k * 2, 0), t1: at(k * 2 + 2, 0), judgeFrom: at(k * 2, 0) + HANDOFF_BEATS * beat - 0.001 }));
  return { piece, speed, stepDur, beat, bar, T0, end: at(piece.bars, 0) + 0.6, notes, bass, clicks, bars, sections };
}
export const bandTime = (n) => n.t + jitter(n.i);
export const sectionAt = (tl, t) => tl.sections.find((s) => t >= s.t0 - 0.001 && t < s.t1) ?? (t < tl.T0 ? tl.sections[0] : tl.sections[tl.sections.length - 1]);

// Describe the next stretch of a part in words (the Hint / Think button).
export function describeNext(tl, part, t, count = 3) {
  const list = tl.notes[part].filter((n) => n.t >= t - 0.05 && !n.j && n.mine).slice(0, count);
  if (!list.length) return 'Nothing more to play. Hold the groove to the end.';
  const w = list.map((n) => (part === 'acc' ? `button ${n.btn + 1} ${n.pull ? 'PULL' : 'PUSH'}` : part === 'caja' ? (n.kind === 'tum' ? 'TUM (left pad)' : 'TAK (right pad)') : (n.dir === 'R' ? 'scrape RIGHT' : 'scrape LEFT')));
  return 'Next: ' + w.join(', then ') + '.';
}

// ---- who is doing what (shared by the game and the picture) --------------------------------------------------------------------------------
// pl: { mode: 'take' | 'live' | 'auto' | 'replay', seat, tl, recorded: { gua, caja, acc } booleans }
export function focusPart(pl, t) { return pl.mode === 'take' ? pl.seat : sectionAt(pl.tl, t).seat; }
// 'you' (the player performs it), 'rec' (a take the player recorded plays back), 'band' (the app plays it)
export function roleOf(pl, part, t) {
  if (pl.mode === 'take') return part === pl.seat ? 'you' : pl.recorded[part] ? 'rec' : 'band';
  if (pl.mode === 'live') return sectionAt(pl.tl, t).seat === part ? 'you' : 'band';
  if (pl.mode === 'replay') return pl.recorded[part] ? 'rec' : 'band';
  return 'band';
}
