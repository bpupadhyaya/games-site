// All the words of the game: About, How to Play, the Rules pages. Numbers are read from music.js (the same constants the engine uses).
// Blocks: { h: heading } { p: paragraph } { li: bullet } { fig: name, hh: height in units } { sp: space } { row, kind, label, hint, val } (settings)
import { JUDGE, PITCH_WINDOW, ASSIST, SCORE, WEIGHT, STARS, ENSEMBLE, LEARN, TIMING, MAQAMAT, IQA, PIECES, SLIDE_GRACE, JOURNEY } from './music.js';

const ms = (s) => `${Math.round(s * 1000)} ms`;
const W0 = PITCH_WINDOW[0];

export const ABOUT = [
  { h: 'Oud Maqam Strings' },
  { p: 'A music game for the oud, the short-necked, pear-shaped lute of the Arab world. The oud has no frets: you slide a finger along the bare neck and the note is wherever you stop. That is how its music reaches the notes that fall between the keys of a piano, the quarter-tones of the maqamat.' },
  { h: 'What you do' },
  { p: 'Rings appear on the neck where each note lives. Put your finger on the ring and pluck on the beat of a rhythm cycle (an iqa’). Some notes ask you to slide from one ring to another while the string is still ringing.' },
  { h: 'How it sounds' },
  { p: 'Every sound is synthesised on your device while you play: no recordings and no licensed music. The six pieces are original, written in the maqamat Rast, Bayati, Hijaz and Nahawand over the cycles Maqsum, Baladi, Saidi and Ayyub.' },
  { h: 'Made for playing' },
  { li: 'Works in portrait and landscape, with two hands or one thumb, and with the keyboard on a computer.' },
  { li: 'A gentle pitch window and an optional pitch assist keep it friendly; Strict is there for those who want it.' },
  { li: 'Large text up to 300%, a calm mode with less motion, no ads, works offline.' },
  { sp: 1 },
  { p: 'Oud Maqam Strings is part of Arcforge, a collection of world heritage games.' },
];

export const HOWTO = [
  { h: 'Play in four steps' },
  { li: 'Pick a piece on the Play screen. Start with Learn the phrases: the oud plays a short phrase, then you echo it.' },
  { li: 'Rings sit on the neck where the notes are. A ring closes in as its note gets near. The little diamonds and dots on the neck mark the notes of the scale; the turquoise diamonds are the quarter-tones.' },
  { li: 'Touch the neck at the ring on the beat. Touching plucks. Keep the finger down and slide to bend the note.' },
  { li: 'To repeat a note, keep your finger where it is and tap the wooden body of the oud with your other hand.' },
  { h: 'Modes' },
  { li: 'Learn the phrases: listen, then echo, phrase by phrase, then play the whole piece. The Hint button shows a ghost finger.' },
  { li: 'Perform: the whole piece, for stars and a high score. Play cleanly and the room lights up and more instruments join in.' },
  { li: 'Free play: all the scales with an optional drone and rhythm, and a journey guide for a taqsim, a free improvisation.' },
  { li: 'Watch and Learn: the computer plays a piece with a ghost finger and tells you why each note sits where it does. Pause it any time.' },
  { h: 'Tips' },
  { li: 'Listen: your ear is the best guide. Land on a ring and it sounds right.' },
  { li: 'The feedback after each note says how many cents sharp or flat you were. 100 cents is one piano key.' },
  { li: 'Notes seem early or late? Open Settings and change the latency offset.' },
  { li: 'Keyboard: keys 1 to 8 pluck the scale degrees, Space pauses, H shows a hint.' },
];

const fmtWin = (w) => `${w.p}, ${w.g} and ${w.o} cents`;

export const RULES = [
  {
    title: 'The oud',
    blocks: [
      { p: 'The oud is a fretless lute with a pear-shaped body, a short neck bent back at the top (the pegbox) and a soundhole carved as a rosette. It has six courses of strings, five of them in pairs. On screen the neck runs away from you (top to bottom in portrait, left to right in landscape) and the body is at the near end.' },
      { fig: 'oud', hh: 330 },
      { p: 'The top of the neck, where the strings pass over the nut, is the open string: the tonic, or home note, of the piece. The further your finger is from the nut, the higher the note.' },
      { p: 'Like a real string, the notes get closer together as you go down the neck. A semitone near the nut is a wider stretch than one near the body.' },
    ],
  },
  {
    title: 'Landing a pitch',
    blocks: [
      { fig: 'neck', hh: 300 },
      { p: 'Pitch is where your finger is. The scale of the piece is marked on the neck: a pearl dot for each ordinary degree, a gold dot for the tonic and octave, and a turquoise diamond for a quarter-tone degree.' },
      { p: `Each note has a target ring. The pitch of your finger is compared with the centre of the ring in cents (a hundredth of a piano key). With the ${W0.name} pitch window: Perfect within ${W0.p} cents, Great within ${W0.g}, Good within ${W0.o}. A note further out is Off, but it still scores a little and keeps your combo.` },
      { p: `Pitch assist gently pulls your finger toward the nearest scale degree, so a finger a little to one side still sounds right (Light assist pulls within ${ASSIST[1].r} cents, Strong within ${ASSIST[2].r}). What you hear is what is judged.` },
    ],
  },
  {
    title: 'Plucking',
    blocks: [
      { p: 'The plectrum, called the risha, is the right hand. In this game there are two ways to pluck:' },
      { li: 'Touch the neck. The touch plucks at the spot where your finger lands. Keep the finger down and slide: the pitch bends with you.' },
      { li: 'With a finger resting on the neck, tap the wooden body of the oud with another finger. That plucks the note under your resting finger again, which is how repeated notes are played. With no finger on the neck it plucks the open string.' },
      { li: 'On a keyboard, keys 1 to 8 pluck the eight degrees of the scale.' },
      { p: 'Lifting your finger damps the string after a moment, so a short touch is a short note.' },
    ],
  },
  {
    title: 'Rhythm cycles',
    blocks: [
      { fig: 'cycle', hh: 250 },
      { p: 'Arab music keeps time with an iqa’ (plural iqa’at), a rhythm cycle of strokes: dum is the low stroke, tak the high one. In this game each cycle has eight slots, an eighth note each, and a phrase is two cycles.' },
      ...Object.values(IQA).map((q) => ({ li: `${q.name}: ${q.slots.split('').join(' ')} — ${q.blurb}` })),
      { p: 'A soft drum plays the cycle under you (you can turn it off in Settings). The row at the top of the screen shows the cycle and which slot you are in. Notes mostly fall on dum and tak, but some sit on the quiet slots.' },
    ],
  },
  {
    title: 'The maqamat',
    blocks: [
      { fig: 'scales', hh: 320 },
      { p: 'A maqam is a melodic mode: a scale with its own character and its own customs for how a melody moves through it. This game has eight degrees per scale, counted from the tonic.' },
      ...Object.values(MAQAMAT).map((m) => ({ li: `${m.name}: ${m.blurb}` })),
      { p: 'A quarter-tone degree sits halfway between two piano keys. Rast has two (degrees 3 and 7) and Bayati has one (degree 2). They are marked with a ¼ on the neck and in the captions.' },
    ],
  },
  {
    title: 'Timing and score',
    blocks: [
      { fig: 'bands', hh: 220 },
      { p: `A note is judged when you pluck. Timing: Perfect within ${ms(JUDGE.perfect)} of the beat, Great within ${ms(JUDGE.great)}, Good within ${ms(JUDGE.good)} (Normal timing; Easy is ${TIMING[0].k}x wider and Strict ${TIMING[2].k}x). The pitch is judged at the same moment. The grade of the note is the lower of the timing grade and the pitch grade.` },
      { p: `Scores: Perfect ${SCORE.perfect}, Great ${SCORE.great}, Good ${SCORE.good}, Off ${SCORE.off}, Miss ${SCORE.miss}, times a combo multiplier that grows by 0.25 every 10 notes to 2x. Accuracy is the average of ${Object.entries(WEIGHT).map(([k, v]) => `${k} ${v}`).join(', ')}.` },
      { p: `Stars: one at ${Math.round(STARS[0] * 100)}% accuracy, two at ${Math.round(STARS[1] * 100)}%, three at ${Math.round(STARS[2] * 100)}%.` },
      { p: `Slide notes have two parts: the pluck, and the landing. After the pluck, slide to the second ring and arrive when it closes (within ${ms(SLIDE_GRACE)}). The landing is graded for pitch and counts as a second result.` },
      { p: 'After each note a small label says what happened, such as "a little sharp (+14)" or "early".' },
    ],
  },
  {
    title: 'Learn the phrases',
    blocks: [
      { p: 'Every piece has four phrases of two cycles. In Learn mode, for each phrase the oud first plays it while a ghost finger shows where it goes (Listen), then the rings come for you (Your turn).' },
      { li: `If your accuracy on a phrase is under ${Math.round(LEARN.pass * 100)}%, it comes round once more (up to ${LEARN.tries} tries), then the lesson moves on.` },
      { li: 'The Hint button plays the phrase again with the ghost finger.' },
      { li: 'When all four phrases are done, you play the whole piece once. That take decides the stars.' },
    ],
  },
  {
    title: 'Perform',
    blocks: [
      { p: 'Perform plays the whole piece: the four phrases in the order the piece uses them (eight phrases in all), after a four-beat count-in.' },
      { p: `While you play cleanly the room comes alive. Every ${ENSEMBLE.every} notes in a row the ensemble grows: first a low drone, then soft ghost strokes on the drum, then a small flute-like shimmer that doubles your notes an octave up (${ENSEMBLE.max} levels). A miss takes one level away. The lamps in the room show the level.` },
      { p: 'You can pause at any time. The result screen gives stars, your score, your best combo, how many notes were Perfect, Great, Good, Off and Missed, and whether you tended to play sharp or flat.' },
    ],
  },
  {
    title: 'Watch and Learn',
    blocks: [
      { p: 'The computer plays the piece for you, with a ghost finger showing exactly where it goes and a caption saying why, for example that a note is the quarter-flat third of Rast.' },
      { li: 'Before each new phrase it Thinks (a few seconds, you set how many in Settings, up to 10), shows the route on the neck, then Reveals the first target for two seconds, then Plays.' },
      { li: 'Pause freezes everything exactly where it is. Resume carries on from the same place.' },
      { li: 'Watch and Learn is free to use at any time.' },
    ],
  },
  {
    title: 'Free play and taqsim',
    blocks: [
      { p: 'Free play gives you the oud with a scale of your choice: no rings, no score. Turn on the drone (a steady tonic and fifth) and the rhythm of a cycle if you like, and change the tempo.' },
      { p: 'A taqsim is a free improvisation that explores a maqam. Turn on the journey guide and it suggests the traditional path:' },
      ...JOURNEY.map((j, i) => ({ li: `${i + 1}. ${j.goal}` })),
      { p: 'Land close to the target degree and the guide moves on. When you settle back home, the oud answers with a short closing phrase.' },
    ],
  },
  {
    title: 'Settings and text',
    blocks: [
      { li: 'Pitch window: Gentle, Standard or Strict. Pitch assist: Off, Light or Strong. Timing: Easy, Normal or Strict.' },
      { li: 'Degree marks and note labels on the neck can be switched off for an extra challenge.' },
      { li: 'Latency offset: if the sound reaches your ear late (for example on Bluetooth headphones), raise it until notes feel on the beat.' },
      { li: 'Calm mode removes the sparks and the shaking strings. Haptics add a short buzz on a pluck.' },
      { li: 'Text size: the A- and A+ buttons on every text screen scale the text up to 300%.' },
    ],
  },
];

// Settings rows (shown on the Settings screen). `val` returns the text of the current value.
export function settingsBlocks(st) {
  const p = st.prefs, onoff = (v) => (v ? 'On' : 'Off');
  return [
    { h: 'Sound' },
    { row: 'sound', kind: 'toggle', label: 'Sound', val: () => p.sound },
    { row: 'backing', kind: 'toggle', label: 'Rhythm backing', hint: 'A soft drum plays the cycle', val: () => p.backing },
    { row: 'haptics', kind: 'toggle', label: 'Haptics', hint: 'A short buzz on a pluck', val: () => p.haptics },
    { h: 'Playing' },
    { row: 'window', kind: 'cycle', label: 'Pitch window', hint: fmtWin(PITCH_WINDOW[p.windowIdx]), val: () => PITCH_WINDOW[p.windowIdx].name },
    { row: 'assist', kind: 'cycle', label: 'Pitch assist', hint: 'Pulls toward the scale degrees', val: () => ASSIST[p.assistIdx].name },
    { row: 'timing', kind: 'cycle', label: 'Timing', val: () => TIMING[p.timingIdx].name },
    { row: 'cal', kind: 'stepper', label: 'Latency offset', hint: 'milliseconds', val: () => `${p.cal} ms` },
    { row: 'calibrate', kind: 'button', btn: 'Calibrate', label: 'Calibrate latency', hint: 'Tap along to a click', val: () => 0 },
    { row: 'think', kind: 'stepper', label: 'Think time', hint: 'Watch and Learn, up to 10 s', val: () => `${p.thinkSec} s` },
    { h: 'Looks' },
    { row: 'marks', kind: 'toggle', label: 'Degree marks on the neck', val: () => p.marks },
    { row: 'labels', kind: 'toggle', label: 'Pitch labels', hint: 'Degree and cents after each note', val: () => p.labels },
    { row: 'calm', kind: 'toggle', label: 'Calm mode', hint: 'Less motion', val: () => p.calm },
    { h: 'More' },
    { row: 'rules', kind: 'button', btn: 'Rules', label: 'Rules', val: () => 0 },
  ];
}
void PIECES;
