// All the words of the game: About, How to Play, the Rules pages. Numbers are read from music.js (the same constants the engine uses).
// Blocks: { h: heading } { p: paragraph } { li: bullet } { fig: name, hh: height in units } { sp: space }
import { JUDGE, SCORE, WEIGHT, STARS, ENSEMBLE, LEARN, TIMING, SPEEDS, PIECES, GRADES, STRING_COUNT, stringFull } from './music.js';

const ms = (s) => `${Math.round(s * 1000)} ms`;
const pct = (v) => `${Math.round(v * 100)}%`;

export const ABOUT = [
  { h: 'Kora' },
  { p: 'A music game for the kora, the 21-string harp-lute of the Mandinka peoples of West Africa, played in Mali, Senegal, The Gambia and Guinea. Pluck the strings in time as they glide down to the bridge, learn short pieces by call and response, and play along with a quiet accompaniment that grows fuller as you play cleanly.' },
  { h: 'The instrument' },
  { p: 'A kora is built from half a large calabash gourd covered with stretched cow hide, a long hardwood neck, a tall wooden bridge and 21 strings in two rows. Players hold two wooden posts and pluck with the thumbs and index fingers of both hands. The scale is shared between the hands: the left row has 11 strings, the right row 10.' },
  { p: 'The kora is played by many musicians, among them the hereditary musician families of West Africa known as jali or griots, who are also keepers of family and community history. A player usually keeps a repeating bass pattern going (kumbengo) and plays a flowing melody over it (birimintingo). This game lets you feel how the two fit together.' },
  { h: 'How it sounds' },
  { p: 'Every sound is synthesised on your device while you play: no recordings and no licensed music. The six pieces are original, written for this game in the spirit of the instrument. The tuning is a seven-note scale, and every piece uses only its five-note core, so any strings you pluck sound well together.' },
  { h: 'Made for playing' },
  { li: 'Works with two thumbs or more fingers, and with the keyboard on a computer.' },
  { li: 'A calibration screen lines the game up with your speakers or headphones.' },
  { li: 'Large text and reduced-motion options. Works offline.' },
  { sp: 1 },
  { p: 'Kora is part of Arcforge, a collection of world heritage games.' },
];

export const HOWTO = [
  { h: 'Play in four steps' },
  { li: 'Pick a piece on the Play screen. Start with Learn the pattern: the accompanist plays a short phrase, then you echo it.' },
  { li: 'Each lane is one string. Glowing beads slide down the string toward the bridge. Amber beads belong to the left hand, teal beads to the right.' },
  { li: 'Tap the string when the bead reaches the bridge. Closer to the beat scores more. Use two thumbs, or more fingers, for several strings.' },
  { li: 'Play cleanly and more voices join the accompaniment. Miss and one drops out. Hearing the full sound means you are playing well.' },
  { h: 'Modes' },
  { li: 'Learn the pattern: listen, then echo, phrase by phrase. The Listen button plays the last phrase again.' },
  { li: 'Perform: the whole piece with the accompaniment, for stars and a high score.' },
  { li: 'Free play: all 21 strings. Slide a finger across them to strum. An optional click and an echo partner that answers your phrase.' },
  { li: 'Watch and Learn: the game plays the whole piece, with the four playing fingers shown and a short explanation of what each hand is doing and why. Pause it any time.' },
  { h: 'Tips' },
  { li: 'Tap anywhere on a string, not just at the bridge. A touch always goes to the nearest string.' },
  { li: 'Notes seem early or late? Open Settings, then Calibrate, and tap along with the pulse.' },
  { li: 'Keyboard: A S D F G H pluck the lanes from left to right. Space pauses.' },
];

// The Rules pages. Each page: { title, blocks }.
export const RULES = [
  {
    title: 'The kora',
    blocks: [
      { fig: 'instrument', hh: 420 },
      { p: `A kora has ${STRING_COUNT} strings in two rows. The strings run from the leather rings on the neck down to a wooden bridge standing on the cow-hide face of the calabash. The posts at the sides are for the hands to hold.` },
      { p: 'In this game you see the strings from the player’s side: the bridge is at the bottom of the screen and the strings run away from you. A bead that reaches the bridge is the moment to pluck.' },
    ],
  },
  {
    title: 'Two hands, 21 strings',
    blocks: [
      { fig: 'strings', hh: 300 },
      { p: `The strings are numbered from 1 (the lowest note) to ${STRING_COUNT} (the highest). The scale is shared between the hands: the odd-numbered strings (the left row, ${Math.ceil(STRING_COUNT / 2)} of them) are plucked by the left hand, the even-numbered strings (the right row, ${Math.floor(STRING_COUNT / 2)}) by the right hand. So a tune climbing the scale zigzags between your hands.` },
      { li: 'Amber: left row. Teal: right row.' },
      { li: `The tuning is a seven-note scale (G A B C# D E F#) over three octaves, from ${stringFull(0)} to ${stringFull(STRING_COUNT - 1)}. Every piece uses only five of those notes (G A B D E), so any strings you pluck together sound well.` },
    ],
  },
  {
    title: 'Thumbs and index fingers',
    blocks: [
      { fig: 'fingers', hh: 330 },
      { p: 'A kora player plucks with four fingers: the thumb and index finger of each hand. The other fingers hold the posts. As a rule the thumbs pluck the lower strings of each row and the index fingers the higher ones.' },
      { p: 'In the game the same four fingers are drawn below the bridge. In Watch and Learn they move to the next string and pluck, so you can see the finger pattern. In your own play they follow your touches.' },
      { p: 'The screen is touched with fingers or thumbs of your own choice; the drawn fingers are a guide, not a rule.' },
    ],
  },
  {
    title: 'Notes and lanes',
    blocks: [
      { fig: 'notes', hh: 190 },
      { p: 'A piece asks you to play three to six strings. Each of those strings is a lane. Beads slide down the lane toward the bridge: pluck the string just as the bead reaches it.' },
      { li: 'Amber bead: a string of the left row. Teal bead: a string of the right row.' },
      { li: 'A small, pale bead is a soft note: it is played more quietly.' },
      { li: 'A ring without a fill is the accompanist playing your part during a Listen or in Watch and Learn.' },
      { li: 'A touch always goes to the nearest lane, so you never have to be exact.' },
      { p: 'The strings between your lanes are the rest of the instrument. The accompaniment plays them, and you see them shimmer.' },
    ],
  },
  {
    title: 'Timing and scoring',
    blocks: [
      { p: `Each pluck is judged by how far it is from the beat, at the Normal timing setting: Perfect within ${ms(JUDGE.perfect)}, Great within ${ms(JUDGE.great)}, Good within ${ms(JUDGE.good)}. A note nobody plucked inside the Good window is a Miss.` },
      { p: `Timing can be set to Relaxed (windows x${TIMING[0].k}), Normal or Tight (x${TIMING[2].k}) in Settings.` },
      { li: `Points per pluck: Perfect ${SCORE.perfect}, Great ${SCORE.great}, Good ${SCORE.good}.` },
      { li: `Combo: every ${SCORE.comboStep} plucks in a row raises the multiplier by 1, up to x${SCORE.comboMax}. A miss resets the combo.` },
      { li: `Accuracy counts Perfect as ${pct(WEIGHT.perfect)}, Great as ${pct(WEIGHT.great)}, Good as ${pct(WEIGHT.good)} and a Miss as 0%.` },
      { li: `Stars: ${pct(STARS[0])} accuracy for one star, ${pct(STARS[1])} for two, ${pct(STARS[2])} for three.` },
      { li: `Grades: ${GRADES.map((g) => `${g[0]} from ${pct(g[1])}`).join(', ')}.` },
      { li: `Note speed (how long a bead takes to slide down) can be Slow (${SPEEDS[0].approach} s), Normal (${SPEEDS[1].approach} s) or Fast (${SPEEDS[2].approach} s).` },
    ],
  },
  {
    title: 'The accompaniment',
    blocks: [
      { fig: 'layers', hh: 230 },
      { p: 'Under your part an accompanist plays on the strings you do not play. In a real kora performance the bass pattern (kumbengo) keeps going while the melody (birimintingo) moves above it; here the accompanist takes whichever job you leave.' },
      { li: 'The base layer is always there.' },
      { li: `In Perform, the accompaniment starts with ${ENSEMBLE.start} extra layer. Every ${ENSEMBLE.every} clean plucks in a row (anything but a Miss) another layer joins, up to ${ENSEMBLE.max}.` },
      { li: 'A Miss takes one layer away again. So you can hear how well you are playing.' },
    ],
  },
  {
    title: 'Learn the pattern',
    blocks: [
      { p: 'Learn works phrase by phrase on the first 8 bars of the piece, in four pairs of two bars.' },
      { li: 'LISTEN: the accompanist plays the phrase. Ring-shaped beads slide down, and in Watch and Learn style the fingers move too.' },
      { li: 'YOUR TURN: the same phrase, now with beads for you. Echo it back.' },
      { li: `If your accuracy on the phrase is under ${pct(LEARN.pass)}, the pair repeats once (${LEARN.tries} tries at most), then the lesson moves on.` },
      { li: 'The Listen button plays the last phrase again whenever you want.' },
      { li: 'After the four phrases comes a final take of the 8 bars with the accompaniment. That take decides your stars.' },
    ],
  },
  {
    title: 'Free play and Watch and Learn',
    blocks: [
      { p: 'FREE PLAY shows all 21 strings.' },
      { li: 'Tap a string to pluck it. Slide a finger across the strings to strum: each string you cross sounds, more softly.' },
      { li: 'Click: a metronome with a tempo from 50 to 180 beats per minute.' },
      { li: 'Echo: stop for a second and a partner plays your last phrase back to you.' },
      { p: 'WATCH AND LEARN plays a whole piece for you with the full accompaniment.' },
      { li: 'The four fingers are drawn and move to each string; the hand of each note is colour coded.' },
      { li: 'A short caption in the corner explains what the hands are doing and why.' },
      { li: 'Pause stops everything, including the sound, and carries on exactly where it stopped. Speed can be 100% or 75%.' },
    ],
  },
  {
    title: 'The six pieces',
    blocks: [
      { p: 'Six original pieces, from one low string and a tune to the full two-job performance:' },
      ...PIECES.map((p) => ({ li: `${p.name} (${p.bpm} bpm, ${p.bars} bars, ${p.lanes.length} strings): ${p.blurb}` })),
    ],
  },
  {
    title: 'Settings, calibration and controls',
    blocks: [
      { li: 'Sound, note speed, timing windows, note names on the beads, the click in Learn, vibration and reduced motion are in Settings.' },
      { li: 'Latency: some phones and Bluetooth headphones play sound a little late. Calibrate by tapping along with a pulse; the game then judges your plucks against that delay. You can also adjust the number by hand.' },
      { li: 'Text size: A- and A+ at the top of every text screen, up to 300%.' },
      { li: 'Keyboard: A S D F G H pluck the lanes from left to right; in Free play A S D F G H J K L pluck nine strings. Space or Escape pauses.' },
      { li: 'Pause and the menus are free: only real playing counts toward the free preview.' },
    ],
  },
];
