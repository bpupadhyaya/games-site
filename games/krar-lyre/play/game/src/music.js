// Krar Lyre: the instrument, the music and the rule constants. Pure data + pure functions (no clock, no randomness).
// The Rules page prints these same constants, so the text cannot drift from the engine.
//
// THE INSTRUMENT. A krar is a bowl lyre of Ethiopia and Eritrea: a wooden bowl covered with hide, two arms, a crossbar and five or six
// strings. This one has SIX strings, numbered 1..6 from the lowest note up, tuned to one of the six pentatonic modes (qenet) listed in
// QENETS. Five notes per octave means any two strings sound well together.
//
// SOUND INDEXES (k). The six strings are k = 1..6. The accompaniment may also use k = 0 (the low root), k = 7..9 (three high notes of
// the same mode) and two percussion sounds, k = 10 (a light hand-drum "tok") and k = 11 (a deep "thump"). k = -1 is the count-in click.
//
// NOTATION (one character per step, `steps` characters per bar, spaces are ignored; a bar is 4 beats):
//   player part:   1-6 = pluck that string   a-f = the same, played softly   x = damp (palm on the bowl)   . = rest
//                  ^ v ~ = % $ = a strum: a sweep across four strings (see STRUMS)
//   accompaniment: 0-9 = sound k   a-j = the same, softly   t = tok   m = thump   . = rest

export const STRING_COUNT = 6;
export const SOUND_COUNT = 12;
export const ROOT_MIDI = 55;                                                       // G3
const NAMES = ['G', 'Ab', 'A', 'Bb', 'B', 'C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb'];
export const QENETS = [
  { id: 'tizita', name: 'Tizita', mood: 'wistful and open', semis: [0, 2, 4, 7, 9] },
  { id: 'tizita-minor', name: 'Tizita minor', mood: 'longing, a little darker', semis: [0, 2, 3, 7, 8] },
  { id: 'bati', name: 'Bati', mood: 'bright and lively', semis: [0, 4, 5, 7, 11] },
  { id: 'bati-minor', name: 'Bati minor', mood: 'driving and dancing', semis: [0, 3, 5, 7, 10] },
  { id: 'ambassel', name: 'Ambassel', mood: 'spare and ringing', semis: [0, 1, 5, 7, 8] },
  { id: 'anchihoye', name: 'Anchihoye', mood: 'tense, then released', semis: [0, 1, 5, 6, 8] },
];
// midi of sound k in a mode (0 = low root, 1..5 = the five notes, 6 = the root an octave up, 7..9 = the 2nd..4th note an octave up)
export function soundMidi(k, qi = 0) {
  const sm = QENETS[qi].semis;
  if (k <= 0) return ROOT_MIDI - 12;
  const j = k - 1, oct = Math.floor(j / 5), d = j % 5;
  return ROOT_MIDI + 12 * oct + sm[d];
}
export const soundFreq = (k, qi = 0) => 440 * Math.pow(2, (soundMidi(k, qi) - 69) / 12);
export const soundName = (k, qi = 0) => NAMES[((soundMidi(k, qi) - ROOT_MIDI) % 12 + 12) % 12];
export const stringName = soundName;

export const STRUMS = { '^': [1, 2, 3, 4], v: [4, 3, 2, 1], '~': [2, 3, 4, 5], '=': [5, 4, 3, 2], '%': [3, 4, 5, 6], $: [6, 5, 4, 3] };
export const STRUM_GAP = 0.075;                                                   // seconds between the strings of a strum

// ---- judging and scoring (all read by the Rules page) -------------------------------------------------------------
export const JUDGE = { perfect: 0.055, great: 0.1, good: 0.15 };          // seconds either side of the note, at the "Normal" timing setting
export const STRUM_WIDEN = 1.5;                                          // strums and damps get windows this much wider
export const TIMING = [{ id: 'relaxed', name: 'Relaxed', k: 1.4 }, { id: 'normal', name: 'Normal', k: 1 }, { id: 'tight', name: 'Tight', k: 0.8 }];
export const SPEEDS = [{ id: 'slow', name: 'Slow', approach: 1.9 }, { id: 'normal', name: 'Normal', approach: 1.5 }, { id: 'fast', name: 'Fast', approach: 1.15 }];
export const SCORE = { perfect: 300, great: 200, good: 100, comboStep: 10, comboMax: 4 };       // multiplier = 1 + floor(combo / 10), at most 4
export const WEIGHT = { perfect: 1, great: 0.85, good: 0.6, miss: 0 };                          // accuracy credit per note
export const STARS = [0.55, 0.75, 0.9];                                                         // accuracy for 1, 2, 3 stars
export const ENSEMBLE = { every: 8, start: 1, max: 3 };                                        // +1 accompaniment layer per 8 clean notes in a row; a miss takes one away
export const LEARN = { pass: 0.5, tries: 2 };
export const LOOKAHEAD = 0.12;                                                                  // seconds the accompaniment is handed to the audio clock ahead
export const GRADES = [['S', 0.95], ['A', 0.85], ['B', 0.7], ['C', 0.5], ['D', 0]];
export const DUEL = { lives: 3, rounds: 8, pass: 0.6, window: 0.2, hintCost: 0.7, bpm: 84, steps: 12, starRounds: [3, 6, 8] };

export const accuracyToStars = (a) => (a >= STARS[2] ? 3 : a >= STARS[1] ? 2 : a >= STARS[0] ? 1 : 0);
export const gradeOf = (a) => GRADES.find((g) => a >= g[1])[0];
export const comboMult = (combo) => Math.min(SCORE.comboMax, 1 + Math.floor(combo / SCORE.comboStep));

// ---- accompaniment grooves ----------------------------------------------------------------------------------------
const G12 = {
  base: ['0..0..0..0..', '0.....0.3...', '0..0.3.0..3.'],
  drum: ['m..t..t..t..', 'm..t.tm..t.t', 'm.tt..m.t.t.'],
  mid: ['..c...d...c.', 'c..d..e..d..', '..d.e.d...c.'],
  high: ['g..h..i..h..', '.g.h.i.h.g..', 'h.i.h.g.i.h.'],
};
const G16 = {
  base: ['0...0...0...0...', '0.....0...3...0.', '0...3...0.0.3...'],
  drum: ['m..t..t.m..t..t.', 'm.t.m.t.m.t.m.tt', 'm...t.t.m..mt.t.'],
  mid: ['..c...d...c...e.', 'c...d...e...d...', '..d.e...c.d.e...'],
  high: ['g...h...i...h...', '.g.h.i.h.g.h.i.h', 'h.i.h.g.i.h.g.i.'],
};
// Four layers: 0 bass (always on), 1 hand drum, 2 harmony, 3 high ripples. `v` picks one of three variants so no two pieces share a groove.
function grooveLayers(steps, bars, v) {
  const G = steps === 12 ? G12 : G16, all = 'A'.repeat(bars);
  const from = (n) => '.'.repeat(n) + 'A'.repeat(Math.max(0, bars - n));
  const L = (pat, form) => [{ pat: { A: pat }, form }];
  return [L(G.base[v % 3], all), L(G.drum[v % 3], from(2)), L(G.mid[(v + 1) % 3], from(4)), L(G.high[(v + 2) % 3], from(8))];
}

// ---- the six pieces -----------------------------------------------------------------------------------------------
// qenet: index into QENETS. parts.player: [{ pat: {A, B, ...}, form }], one letter per bar ('.' = silent bar).
// why: four short captions for Watch and Learn, shown in turn across the piece.
const P = (pat, form) => ({ pat, form });

export const PIECES = [
  {
    id: 'morning-coffee', name: 'Morning Coffee', qenet: 0, bpm: 72, steps: 12, bars: 16, level: 1, groove: 0,
    blurb: 'Three strings and a slow, rocking pulse: the gentlest way to meet the lyre.',
    why: ['A long pulse on the low string, a short answer on the middle one. The pattern rocks like a cup being poured.', 'The tune climbs to the fifth string and falls back. Pentatonic notes never clash, so even a stray pluck sounds kind.', 'Listen for the drum joining. It sits under the beat and never rushes you.', 'The tune settles back to where it began. Repeating a pattern is how the player lets the listener settle in.'],
    parts: { player: [P({ A: '1..3..1..3..', B: '1..3..5..3..', C: '5..3..1..3..', D: '5..3..5..6..' }, 'AABAABCDAABAABCD')] },
  },
  {
    id: 'highland-wind', name: 'Highland Wind', qenet: 2, bpm: 84, steps: 12, bars: 16, level: 2, groove: 1,
    blurb: 'A bright mode with a new move: touch the bowl to hush the strings, then let them speak again.',
    why: ['Notice the new gesture: a palm laid on the bowl stops every ringing string at once. The silence is part of the phrase.', 'Walk the strings up and down like steps on a hillside. Keep the three-beat lilt even.', 'A high answer, then the bowl is touched again. Stop and start is how the player makes a tune breathe.', 'Full ensemble now. The damps line up with the drum, so feel them as part of the groove.'],
    parts: { player: [P({ A: '1..2..3..2..', B: '3..4..5..4..', C: '5..3..x..1..', D: '1..x..3..5..' }, 'AABAABCBAABAABCD')] },
  },
  {
    id: 'market-day', name: 'Market Day', qenet: 1, bpm: 92, steps: 16, bars: 16, level: 3, groove: 2,
    blurb: 'Busy and cheerful. Meet the strum: one sweep of a finger across four strings.',
    why: ['The strum is one gesture, not four plucks: a single sweep across the strings, starting right on the beat.', 'Short runs of two-step notes: the right hand hops string by string while the beat stays still.', 'A downward strum answers the upward one. Direction matters: follow the arrow on the rings.', 'The market quietens. Keep the damp on time and the ending lands cleanly.'],
    parts: { player: [P({ A: '1.2.3...1.2.3.4.', B: '3.4.5...4.3.2.1.', C: '^...3.3.5...x...', D: '5.4.3.2.v...1...' }, 'AABAABCDAABAABCD')] },
  },
  {
    id: 'rift-valley-dusk', name: 'Rift Valley Dusk', qenet: 4, bpm: 96, steps: 12, bars: 16, level: 3, groove: 0,
    blurb: 'A spare, ringing mode. Soft notes and loud notes trade places.',
    why: ['Ambassel is a spare scale: a half step above the root gives it that ringing, almost empty sound.', 'Soft notes (smaller rings) are played lightly, like a breath. Loud notes sit on the beats.', 'Short pauses before each pluck are where the player waits. Let the string finish before you answer it.', 'A rising sweep closes the second half. Take it in one motion.'],
    parts: { player: [P({ A: '1..3..a..3..', B: '5..4..3..4..', C: '3.4.5.4.3.2.', D: '~..3..x..1..' }, 'AABAABCBAABAABCD')] },
  },
  {
    id: 'azmari-verse', name: 'The Azmari’s Verse', qenet: 5, bpm: 104, steps: 16, bars: 16, level: 4, groove: 1,
    blurb: 'The wandering singer’s way: a phrase, a cheeky answer, a sweep, a silence.',
    why: ['An azmari is a travelling singer and player who answers the room with quick wit. The phrase asks; the next one answers.', 'Anchihoye bends the ear with a tense fourth. The tension is the point: it resolves back to the root.', 'A downward sweep and a quick damp: a flourish that ends the sentence.', 'All four layers now. The verse repeats, but the feel has opened up.'],
    parts: { player: [P({ A: '1.2..3.4..5.4.3.', B: '5.4..3.2..1.2.3.', C: '$...5.4.3...x.1.', D: '1.3.5.6.5.3.1.v.' }, 'AABAABCBAABAABCD')] },
  },
  {
    id: 'shoulder-dance', name: 'Shoulder Dance', qenet: 3, bpm: 116, steps: 12, bars: 20, level: 5, groove: 2,
    blurb: 'Fast and driving, the whole lyre in play: runs, strums, soft notes and damps.',
    why: ['This is dance music: the shoulders move in time with the pulse. Keep the runs even and let the beat carry you.', 'Runs up and down the six strings. Your hands take turns, so the pace stays easy to hold.', 'Strums and damps crowd close together. Play the strum, then pull your hand to the bowl right on time.', 'The last bars strip back to the bass and the tune. A clean ending says more than a loud one.'],
    parts: { player: [P({ A: '1.2.3.4.5.4.', B: '5.4.3.2.1.2.', C: '3..%.3.x.5.6', D: '6.5.4.3.2.x.', E: '1.c.e.d.b.a.' }, 'AABAABCDAABCABCDAAEE')] },
  },
].map((p) => ({ ...p, parts: { ...p.parts, layers: grooveLayers(p.steps, p.bars, p.groove) } }));

const clean = (s) => s.replace(/\s+/g, '');

// ---- timing ---------------------------------------------------------------------------------------------------------
export const beatDur = (piece, speed = 1) => 60 / (piece.bpm * speed);
export const barDur = (piece, speed = 1) => 4 * beatDur(piece, speed);
export const stepDur = (piece, speed = 1) => barDur(piece, speed) / piece.steps;

// Parse one bar of the player's notation into hits: [{ step, kind: 'p' | 's' | 'd', k, ks, soft }].
export function parsePlayerBar(pat, steps) {
  const s = clean(pat), out = [];
  for (let i = 0; i < s.length && i < steps; i++) {
    const c = s[i];
    if (c === '.') continue;
    if (c === 'x') out.push({ step: i, kind: 'd', k: -1, ks: null, soft: false });
    else if (STRUMS[c]) out.push({ step: i, kind: 's', k: STRUMS[c][0], ks: STRUMS[c], soft: false });
    else if (c >= '1' && c <= '6') out.push({ step: i, kind: 'p', k: +c, ks: null, soft: false });
    else if (c >= 'a' && c <= 'f') out.push({ step: i, kind: 'p', k: c.charCodeAt(0) - 96, ks: null, soft: true });
  }
  return out;
}
export function parseEnsBar(pat, steps) {
  const s = clean(pat), out = [];
  for (let i = 0; i < s.length && i < steps; i++) {
    const c = s[i];
    if (c === '.') continue;
    if (c === 't') out.push({ step: i, k: 10, soft: false });
    else if (c === 'm') out.push({ step: i, k: 11, soft: false });
    else if (c >= '0' && c <= '9') out.push({ step: i, k: +c, soft: false });
    else if (c >= 'a' && c <= 'j') out.push({ step: i, k: c.charCodeAt(0) - 97, soft: true });
  }
  return out;
}
const barPat = (part, b) => { const ch = part.form[b] ?? '.'; return ch === '.' || ch === '-' ? null : part.pat[ch] ?? null; };

// How many judged gestures the player's part has in bars [b0, b1).
export function playerNoteCount(piece, b0 = 0, b1 = piece.bars) {
  let n = 0;
  for (const part of piece.parts.player) for (let b = b0; b < b1; b++) { const p = barPat(part, b); if (p) n += parsePlayerBar(p, piece.steps).length; }
  return n;
}

// buildRun: lays segments end to end on the song clock starting at T0.
//   segments: [{ kind: 'count' | 'listen' | 'echo' | 'play' | 'auto', b0, b1 }]  or  { kind, pats: [barString, ...] } (custom bars, used by Echo Duel)
//   opts: { click: bool, speed: 1 | 0.75 }
// Events: { t, k, kind, ks, soft, who, layer, seg, id }
//   who = 'note' (the player must do it), 'teach' (the teacher plays the player's part), 'ens' (accompaniment), 'click' (metronome)
//   kind = 'p' pluck | 's' strum (ks = the strings, k = the first) | 'd' damp. When the teacher plays a strum, the later strings follow as
//   'teach' events of kind 'p' marked `part: true`.
export function buildRun(piece, segments, T0 = 0, opts = {}) {
  const speed = opts.speed ?? 1, bd = barDur(piece, speed), sd = stepDur(piece, speed), events = [], bars = [];
  let t = T0, id = 0;
  segments.forEach((seg, si) => {
    const nBars = seg.kind === 'count' ? 1 : seg.pats ? seg.pats.length : seg.b1 - seg.b0;
    const t0 = t;
    for (let i = 0; i < nBars; i++) {
      const bar = seg.kind === 'count' ? -1 : (seg.b0 ?? 0) + i, tb = t0 + i * bd;
      bars.push({ t0: tb, t1: tb + bd, bar, kind: seg.kind, seg: si });
      if (seg.kind === 'count' || opts.click) {
        for (let b = 0; b < 4; b++) events.push({ t: tb + b * bd / 4, k: -1, kind: 'c', ks: null, soft: false, who: 'click', accent: b === 0, layer: -1, seg: si, cnt: seg.kind === 'count', id: id++ });
      }
    }
    if (seg.kind !== 'count') {
      const who = seg.kind === 'echo' || seg.kind === 'play' ? 'note' : 'teach';
      const place = (h, bi, w, layer) => {
        const tt = t0 + bi * bd + h.step * sd;
        events.push({ t: tt, k: h.k, kind: h.kind ?? 'p', ks: h.ks ?? null, soft: !!h.soft, who: w, layer, seg: si, id: id++ });
        if (h.kind === 's' && w === 'teach') h.ks.slice(1).forEach((k, j) => events.push({ t: tt + (j + 1) * STRUM_GAP, k, kind: 'p', ks: null, soft: true, who: 'teach', part: true, layer, seg: si, id: id++ }));
      };
      for (let i = 0; i < nBars; i++) {
        if (seg.pats) { const p = seg.pats[i]; if (p) for (const h of parsePlayerBar(p, piece.steps)) place(h, i, who, 4); continue; }
        for (const part of piece.parts.player) { const p = barPat(part, seg.b0 + i); if (p) for (const h of parsePlayerBar(p, piece.steps)) place(h, i, who, 4); }
        // Accompaniment: the base layer in every playing segment, the upper layers only where the game wants the whole ensemble.
        const upto = seg.kind === 'play' || seg.kind === 'auto' ? 3 : 0;
        piece.parts.layers.forEach((layer, li) => {
          if (li > upto) return;
          for (const part of layer) { const p = barPat(part, seg.b0 + i); if (p) for (const h of parseEnsBar(p, piece.steps)) events.push({ t: t0 + i * bd + h.step * sd, k: h.k, kind: 'p', ks: null, soft: h.soft, who: 'ens', layer: li, seg: si, id: id++ }); }
        });
      }
    }
    t = t0 + nBars * bd;
  });
  events.sort((a, b) => a.t - b.t || a.id - b.id);
  const notes = events.filter((e) => e.who === 'note');
  return { events, notes, bars, T0, end: t, speed, beatDur: bd / 4, barDur: bd, stepDur: sd };
}

export const PIECE_BY_ID = Object.fromEntries(PIECES.map((p) => [p.id, p]));

// ---- Echo Duel: calls built from a seeded stream -------------------------------------------------------------------
// Round n has min(2 + n, 10) notes over one bar (up to 5 notes) or two bars; the strings come from the mode's six, widening with the round.
// `rnd` is any object with int(n) and chance(p) (the kit's seeded rng). Returns an array of bar strings (12 steps each).
export function makeCall(rnd, round) {
  const n = Math.min(2 + round, 10), bars = n <= 5 ? 1 : 2, steps = DUEL.steps;
  const pool = Math.min(6, 3 + Math.floor((round + 1) / 2));
  const easy = round <= 3 ? [0, 3, 6, 9, 2, 4, 8, 10] : [0, 1, 2, 3, 4, 6, 7, 8, 9, 10];
  const out = [];
  let left = n;
  for (let b = 0; b < bars; b++) {
    const cnt = b === bars - 1 ? left : Math.ceil(n / bars);
    left -= cnt;
    const cand = easy.slice(), chosen = [];
    while (chosen.length < cnt && cand.length) chosen.push(cand.splice(rnd.int(cand.length), 1)[0]);
    chosen.sort((a, c) => a - c);
    let prev = 0, same = 0;
    const row = new Array(steps).fill('.');
    for (const s of chosen) {
      let k = 1 + rnd.int(pool);
      if (k === prev) { same += 1; if (same >= 2) k = 1 + (k % pool); } else same = 0;
      prev = k; row[s] = String(k);
    }
    out.push(row.join(''));
  }
  return out;
}
export const DUEL_PIECE = { id: 'echo-duel', name: 'Echo Duel', qenet: 0, bpm: DUEL.bpm, steps: DUEL.steps, bars: 2, level: 1, parts: { player: [], layers: [[], [], [], []] } };
