// All the words of the game: About, How to Play, the Rules pages. Numbers are read from music.js (the same constants the engine uses).
// Blocks: { h: heading } { p: paragraph } { li: bullet } { fig: name, hh: height in units } { sp: space }
import { JUDGE, SCORE, WEIGHT, STARS, ENSEMBLE, LEARN, TIMING, SPEEDS, PIECES, GRADES, STRING_COUNT, STRUM_WIDEN, DUEL, QENETS, soundName } from './music.js';

const ms = (s) => `${Math.round(s * 1000)} ms`;
const pct = (v) => `${Math.round(v * 100)}%`;
const modeNotes = (q) => [1, 2, 3, 4, 5].map((k) => soundName(k, QENETS.indexOf(q))).join(' ');

export const ABOUT = [
  { h: 'Krar Lyre' },
  { p: 'A music game for the krar, the bowl lyre of Ethiopia and Eritrea. Close rings on the strings, learn short pieces by call and response, answer the azmari from memory in the Echo Duel, and compose small songs of your own.' },
  { h: 'The instrument' },
  { p: 'A krar is a lyre: a wooden bowl covered with hide, two arms rising from it, a crossbar across the top and five or six strings running from the bowl to the bar. Colourful wraps of cloth or leather on the crossbar tune each string. It is played sitting down with the fingers or a small plectrum, and one hand often presses the bowl or the strings to stop them ringing.' },
  { p: 'The krar accompanies singing and dancing across the Horn of Africa. Travelling singer-musicians called azmari carry songs, news and quick-witted verses from place to place. The music is built on a small number of five-note scales, called qenet in Amharic: Tizita, Bati, Ambassel and Anchihoye, each with its own mood. This game lets you hear and play all six of the common forms.' },
  { h: 'How it sounds' },
  { p: 'Every sound is synthesised on your device while you play: no recordings and no licensed music. The six pieces are original, written for this game in the spirit of the instrument. Because each scale has only five notes, any strings you pluck together sound well, so you can play beautifully from the first minute.' },
  { h: 'Made for playing' },
  { li: 'Works with two thumbs or more fingers, and with the keyboard on a computer.' },
  { li: 'A calibration screen lines the game up with your speakers or headphones.' },
  { li: 'Large text and reduced-motion options. Works offline.' },
  { sp: 1 },
  { p: 'Krar Lyre is part of Arcforge, a collection of world heritage games. The tradition belongs to the peoples of Ethiopia and Eritrea; the pieces here are simplified, original arrangements made to be played on a touch screen.' },
];

export const HOWTO = [
  { h: 'Play in four steps' },
  { li: 'Pick a piece on the Play screen, then choose Learn the phrases: the azmari plays a short phrase and you answer it.' },
  { li: 'Rings close on the strings. Tap a string just as its ring closes on it. The closer to the beat, the more points.' },
  { li: 'A wide pill across several strings is a strum: sweep one finger across the strings in the direction of the arrows.' },
  { li: 'A square ring on the bowl is a damp: lay your palm (tap) on the bowl and every string falls silent.' },
  { h: 'Modes' },
  { li: 'Learn the phrases: listen, then answer, phrase by phrase. The Listen button plays the last phrase again.' },
  { li: 'Perform: the whole piece with the accompaniment, for stars and a high score. Play cleanly and more voices join.' },
  { li: 'Echo Duel: the azmari plays a phrase and the rings stay hidden. Answer from memory; every round the phrase grows. Three lives.' },
  { li: 'Compose: tap cells in a grid to write a two-bar loop, play it with a drum groove, and let the azmari answer with a variation.' },
  { li: 'Watch and Learn: the game plays a whole piece and says why each part is there. Pause it any time.' },
  { h: 'Tips' },
  { li: 'A touch always goes to the nearest string at its height, so you never have to be exact.' },
  { li: 'Notes seem early or late? Open Settings, then Calibrate, and tap along with the pulse.' },
  { li: 'Keyboard: A S D F G H pluck strings 1 to 6, Z damps, W sweeps the strum that is due, Space pauses.' },
];

// The Rules pages. Each page: { title, blocks }.
export const RULES = [
  {
    title: 'The krar',
    blocks: [
      { fig: 'instrument', hh: 470 },
      { p: `This krar has ${STRING_COUNT} strings, numbered 1 to ${STRING_COUNT} from the lowest note to the highest. They run from a tailpiece on the hide, over a small wooden bridge, up to the crossbar, where a coloured wrap tunes each one.` },
      { p: 'The bowl is also an instrument of silence. A palm laid on the hide stops the strings: in this game that is the damp.' },
    ],
  },
  {
    title: 'Six strings, six qenet',
    blocks: [
      { fig: 'modes', hh: 360 },
      { p: 'Each piece is tuned to one qenet, a five-note scale. The sixth string is the first note again, an octave higher. Notes are written relative to a fixed root, G.' },
      ...QENETS.map((q) => ({ li: `${q.name} (${q.mood}): ${modeNotes(q)}` })),
      { p: 'The accompaniment may also use a low root and three high notes of the same scale, and two hand-drum sounds. You never have to play those.' },
    ],
  },
  {
    title: 'Three gestures',
    blocks: [
      { fig: 'cues', hh: 250 },
      { li: 'PLUCK: a round ring closes on a string. Tap that string as the ring closes on it. A pale, thin ring is a soft pluck: it is played a little more quietly.' },
      { li: `STRUM: a pill closes across four strings with arrows. Touch the first string on the beat and sweep across the rest in the arrow direction. You need at least three of the four strings; sweeping the wrong way, or missing a string, lowers the grade.` },
      { li: `DAMP: a square ring closes on the bowl. Tap the bowl on the beat: every ringing string stops. A damp has the same timing windows as a strum, ${STRUM_WIDEN} times wider than a pluck.` },
      { p: 'A touch on any string at any time still sounds, so you can play along freely; only the gestures the piece asks for are scored.' },
    ],
  },
  {
    title: 'Timing and scoring',
    blocks: [
      { p: `Each gesture is judged by how far it is from the beat, at the Normal timing setting: Perfect within ${ms(JUDGE.perfect)}, Great within ${ms(JUDGE.great)}, Good within ${ms(JUDGE.good)}. A gesture nobody made inside the Good window is a Miss. Strums and damps use windows ${STRUM_WIDEN} times as wide.` },
      { p: `Timing can be set to Relaxed (windows x${TIMING[0].k}), Normal or Tight (x${TIMING[2].k}) in Settings.` },
      { li: `Points per gesture: Perfect ${SCORE.perfect}, Great ${SCORE.great}, Good ${SCORE.good}.` },
      { li: `Combo: every ${SCORE.comboStep} gestures in a row raises the multiplier by 1, up to x${SCORE.comboMax}. A miss resets the combo.` },
      { li: `Accuracy counts Perfect as ${pct(WEIGHT.perfect)}, Great as ${pct(WEIGHT.great)}, Good as ${pct(WEIGHT.good)} and a Miss as 0%.` },
      { li: `Stars: ${pct(STARS[0])} accuracy for one star, ${pct(STARS[1])} for two, ${pct(STARS[2])} for three.` },
      { li: `Grades: ${GRADES.map((g) => `${g[0]} from ${pct(g[1])}`).join(', ')}.` },
      { li: `Ring speed (how long a ring takes to close) can be Slow (${SPEEDS[0].approach} s), Normal (${SPEEDS[1].approach} s) or Fast (${SPEEDS[2].approach} s).` },
    ],
  },
  {
    title: 'The accompaniment',
    blocks: [
      { fig: 'layers', hh: 230 },
      { p: 'Under your part a small ensemble plays: a low root, a hand drum, a harmony and a few high ripples. The layers are authored for each piece, so every piece has its own groove.' },
      { li: 'The base layer is always there.' },
      { li: `In Perform, the accompaniment starts with ${ENSEMBLE.start} extra layer. Every ${ENSEMBLE.every} clean gestures in a row (anything but a Miss) another layer joins, up to ${ENSEMBLE.max}.` },
      { li: 'A Miss takes one layer away again. So you can hear how well you are playing.' },
    ],
  },
  {
    title: 'Learn the phrases',
    blocks: [
      { p: 'Learn works phrase by phrase on the first 8 bars of the piece, in four pairs of two bars.' },
      { li: 'LISTEN: the azmari plays the phrase. The strings light up as it sounds.' },
      { li: 'YOUR TURN: the same phrase, now with rings for you. Answer it.' },
      { li: `If your accuracy on the phrase is under ${pct(LEARN.pass)}, the pair repeats once (${LEARN.tries} tries at most), then the lesson moves on.` },
      { li: 'The Listen button plays the last phrase again whenever you want.' },
      { li: 'After the four phrases comes a final take of the 8 bars with the accompaniment. That take decides your stars.' },
    ],
  },
  {
    title: 'Echo Duel',
    blocks: [
      { fig: 'duel', hh: 230 },
      { p: `The azmari plays a short phrase. Then it is your turn, and the rings stay hidden: answer from memory, with the same strings and the same rhythm. Pick any piece to choose the scale you duel in.` },
      { li: `Round 1 is a phrase of 3 notes; every round adds one note, up to 10 notes over two bars. There are ${DUEL.rounds} rounds.` },
      { li: `Each note counts if you play the right string within ${ms(DUEL.window)} of its place in the phrase. A round is answered when the accuracy reaches ${pct(DUEL.pass)}.` },
      { li: `A round that is not answered costs one of your ${DUEL.lives} lives and plays again, with the same phrase.` },
      { li: `The Listen button replays the phrase. Each replay lowers that round's score to ${pct(DUEL.hintCost)} of what it would be.` },
      { li: `Stars: ${DUEL.starRounds[0]} rounds answered for one, ${DUEL.starRounds[1]} for two, all ${DUEL.starRounds[2]} for three.` },
      { p: 'Phrases come from the same seeded stream the whole game uses, so a new duel plays different phrases. The strings widen with the rounds: early phrases use three strings, later ones all six.' },
    ],
  },
  {
    title: 'Compose',
    blocks: [
      { fig: 'compose', hh: 260 },
      { p: 'The lyre at the top is playable: tap strings, sweep across them, tap the bowl to damp. Below it is a grid of 12 steps by 6 strings; the top row is the highest string.' },
      { li: 'Tap a cell to place or remove a note. Two bars are available: Bar 1 and Bar 2.' },
      { li: 'Play loops both bars at the chosen tempo (50 to 150 beats per minute), with an optional drum groove and low root.' },
      { li: 'Mode steps through the six qenet.' },
      { li: 'The azmari answers: the notes of the bar you are on come back changed (a step up or down on the strings, with a flourish) in the other bar.' },
      { li: 'Your song is kept on the device.' },
    ],
  },
  {
    title: 'Watch and Learn',
    blocks: [
      { p: 'WATCH AND LEARN plays a whole piece for you with the full accompaniment.' },
      { li: 'The strings glow where the player plucks; rings show each gesture, so you can see the pattern as it comes.' },
      { li: 'A short caption in the corner explains what the music is doing and why.' },
      { li: 'Pause stops everything, including the sound, and carries on exactly where it stopped. Speed can be 100% or 75%.' },
      { li: 'The Think button in a lesson or duel replays the last phrase.' },
    ],
  },
  {
    title: 'The six pieces',
    blocks: [
      { p: 'Six original pieces, from three strings and a rocking pulse to the full dance:' },
      ...PIECES.map((p) => ({ li: `${p.name} (${QENETS[p.qenet].name}, ${p.bpm} bpm, ${p.bars} bars): ${p.blurb}` })),
    ],
  },
  {
    title: 'Settings and controls',
    blocks: [
      { li: 'Sound, ring speed, timing windows, note names on the strings, the click in Learn, vibration and reduced motion are in Settings.' },
      { li: 'Latency: some phones and Bluetooth headphones play sound a little late. Calibrate by tapping along with a pulse; the game then judges your gestures against that delay. You can also adjust the number by hand.' },
      { li: 'Text size: A- and A+ at the top of every text screen, up to 300%.' },
      { li: 'Keyboard: A S D F G H pluck strings 1 to 6; Z or the down arrow damps; W sweeps the strum that is due; Space or Escape pauses.' },
      { li: 'Free to play with short ads; go ad-free once.' },
      { li: 'Simplifications: the six scales are given as equal-tempered five-note scales; the real instrument is tuned by ear and varies with the player and the song.' },
    ],
  },
];
