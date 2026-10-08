// All the words of the game: About, How to Play, the Rules pages. Numbers are read from music.js (the same constants the engine uses).
// Blocks: { h: heading } { p: paragraph } { li: bullet } { fig: name, hh: height in units } { sp: space }
import { JUDGE, SCORE, WEIGHT, STARS, ENSEMBLE, LEARN, ZONE, TIMING, SPEEDS, PIECES, DRUMS, GRADES } from './music.js';

const ms = (s) => `${Math.round(s * 1000)} ms`;
const pct = (v) => `${Math.round(v * 100)}%`;

export const ABOUT = [
  { h: 'Taiko Drum Circle' },
  { p: 'A rhythm game for the big drums of Japanese ensemble drumming. Hit the middle of a drum for a deep don, hit the rim for a bright ka, and play along with a circle of computer drummers who join in as your timing gets tighter.' },
  { h: 'The drums' },
  { p: 'Taiko is the Japanese word for drum. The ensemble style played on several sizes of drum together is called kumi-daiko. In this game you meet four of the drums (the small shime, the mid-sized chu, the rope-laced okedo and the big o-daiko) and a small hand gong, the atarigane. The drums are struck with wooden sticks called bachi.' },
  { h: 'How it sounds' },
  { p: 'Every sound is synthesised on your device while you play: no recordings and no licensed music. The six pieces are original.' },
  { h: 'Made for playing' },
  { li: 'Works with two thumbs or more fingers, and with the keyboard on a computer.' },
  { li: 'A calibration screen lines the game up with your speakers or headphones.' },
  { li: 'Large text and reduced-motion options. No ads. Works offline.' },
  { sp: 1 },
  { p: 'Taiko Drum Circle is part of Arcforge, a collection of world heritage games.' },
];

export const HOWTO = [
  { h: 'Play in four steps' },
  { li: 'Pick a piece on the Play screen. Start with Learn the pattern: the circle plays a short phrase, then you echo it.' },
  { li: 'Notes fall down a lane onto a drum. A red disc is DON: tap the middle of the drum. A blue ring is KA: tap the rim.' },
  { li: 'Tap when the note reaches the drum. Closer to the beat scores more. Use two thumbs, or more fingers, for several drums.' },
  { li: 'Play cleanly and more drummers join the circle. Miss and one drops out. Hear the whole circle to know you are on form.' },
  { h: 'Modes' },
  { li: 'Learn the pattern: listen, then echo, phrase by phrase. The Listen button plays the last phrase again.' },
  { li: 'Perform: the whole piece with the ensemble, for stars and a high score.' },
  { li: 'Free play: all four drums, an optional metronome and an echo partner that answers you.' },
  { li: 'Watch and Learn: the computer plays the whole piece for you. Pause it any time.' },
  { h: 'Tips' },
  { li: 'Wrong zone, right time? You still get partial credit ("Off") and your combo survives.' },
  { li: 'Notes seem early or late? Open Settings, then Calibrate, and tap along with the pulse.' },
  { li: 'Keyboard: A S D F play don on drums 1 to 4, Z X C V play ka. Space pauses.' },
];

// The Rules pages. Each page: { title, blocks }.
export const RULES = [
  {
    title: 'The circle of drums',
    blocks: [
      { p: 'Four drums stand in a row, curved like a circle seen from the front. From left to right:' },
      { fig: 'drums', hh: 250 },
      ...DRUMS.slice(0, 4).map((d) => ({ li: `${d.name}: ${d.blurb}` })),
      { p: `A fifth voice, the ${DRUMS[4].name}, hangs by the score. ${DRUMS[4].blurb}` },
      { p: 'A piece asks you to play one to four of the drums. The drums you play have a lane above them; the others are played by the ensemble, and you see their sticks move.' },
    ],
  },
  {
    title: 'Don and ka',
    blocks: [
      { fig: 'zones', hh: 230 },
      { p: `Each drum head has two zones. The middle of the head, out to ${pct(ZONE.don)} of its radius, is DON: a deep hit. The ring around it, out to ${pct(ZONE.rim)} of the radius (a little past the head, so a thumb that lands near the edge still counts), is KA: a bright rim hit.` },
      { p: 'A touch always goes to the nearest drum, so you never have to be exact.' },
      { fig: 'notes', hh: 150 },
      { li: 'Red disc: DON. Tap the middle.' },
      { li: 'Blue ring: KA. Tap the rim.' },
      { li: 'A smaller, paler note is soft: the same hit, quieter.' },
      { li: 'The shapes differ as well as the colours, so the notes can be told apart without colour.' },
    ],
  },
  {
    title: 'Notes and timing',
    blocks: [
      { p: 'Notes fall down the lane towards the drum and reach the middle of the head exactly on the beat. The note speed is a setting: ' + SPEEDS.map((s) => `${s.name} (${s.approach} s from the top to the drum)`).join(', ') + '.' },
      { p: 'When you touch a drum, the game looks for the nearest unplayed note on that drum, within the allowed timing range. The ranges, either side of the beat (Normal setting):' },
      { li: `Perfect: within ${ms(JUDGE.perfect)}.` },
      { li: `Great: within ${ms(JUDGE.great)}.` },
      { li: `Good: within ${ms(JUDGE.good)}.` },
      { li: `Off: the right moment but the wrong zone (a don note struck on the rim, or the other way round). It counts for something and keeps your combo.` },
      { li: 'Miss: a note nobody played in time (more than the Good window late). It breaks your combo.' },
      { p: 'The timing setting scales all three windows: ' + TIMING.map((t) => `${t.name} x${t.k}`).join(', ') + '.' },
      { p: 'A touch that matches no note makes a sound but is not judged: you may play extra hits. A note is only ever judged once.' },
    ],
  },
  {
    title: 'Scoring',
    blocks: [
      { p: `Points per hit: Perfect ${SCORE.perfect}, Great ${SCORE.great}, Good ${SCORE.good}, Off ${SCORE.off}, Miss 0. Each is multiplied by your combo bonus: x1, plus one for every ${SCORE.comboStep} hits in a row, up to x${SCORE.comboMax}.` },
      { p: `Combo counts every hit that is not a Miss. A Miss sets it back to zero.` },
      { p: `Accuracy is how much of the full marks you earned: every note is worth up to 100%, and a Perfect earns ${pct(WEIGHT.perfect)} of it, Great ${pct(WEIGHT.great)}, Good ${pct(WEIGHT.good)}, Off ${pct(WEIGHT.off)}, Miss 0%. The accuracy of a piece is the average over all its notes.` },
      { p: `Stars: ${pct(STARS[0])} accuracy earns one star, ${pct(STARS[1])} two, ${pct(STARS[2])} three. The grade letter is ${GRADES.map((g) => `${g[0]} from ${pct(g[1])}`).join(', ')}.` },
      { p: 'Your best score and best stars for each piece are saved on your device.' },
    ],
  },
  {
    title: 'Learn the pattern',
    blocks: [
      { p: 'Learn works in call and response. The first eight bars of the piece are cut into four phrases of two bars.' },
      { li: 'Count-in: one bar of clicks.' },
      { li: 'Listen (the call): the circle plays the phrase on your drums. The drum lights up, the stick strikes, and the notes fall as pale ghosts.' },
      { li: 'Echo (the response): the same phrase comes again as real notes and you play it back.' },
      { p: `If you finish a phrase below ${pct(LEARN.pass)} accuracy, the same call and response repeats, up to ${LEARN.tries} tries per phrase, then the lesson moves on.` },
      { p: 'After the four phrases comes the final take: the first eight bars played straight through with the whole ensemble.' },
      { p: 'The Listen button (in the corner) restarts the call for the phrase you are on. The metronome click can be switched off in Settings.' },
    ],
  },
  {
    title: 'Perform and the ensemble',
    blocks: [
      { p: 'Perform plays the whole piece from a one-bar count-in to the last bar, with the ensemble of computer drummers.' },
      { fig: 'layers', hh: 190 },
      { p: `The ensemble has a base groove that always plays, and three more layers. You start with ${ENSEMBLE.start} extra layer. Every ${ENSEMBLE.every} hits in a row (any hit that is not a Miss) brings in the next layer, up to ${ENSEMBLE.max}. A Miss takes one layer away.` },
      { p: 'The drummers in the circle that are not playing yet are shown dimmed; they light up when their layer comes in.' },
      { p: 'Your own part is never played for you: a note you miss leaves a gap in the music.' },
      { p: 'The ensemble never gets in the way of judging. The layers are only an echo of how well you are playing.' },
    ],
  },
  {
    title: 'Free play',
    blocks: [
      { p: 'Free play gives you all four drums and no notes. Hit as you like, with up to ten fingers.' },
      { li: 'Metronome: a click on every beat at the tempo shown. Change the tempo with the minus and plus buttons.' },
      { li: 'Echo: after you stop for a moment, the circle answers by playing your phrase back, a little softer, on the same drums. Play another phrase and it answers again.' },
      { p: 'Free play uses your preview time like a real piece does.' },
    ],
  },
  {
    title: 'Watch and Learn',
    blocks: [
      { p: 'Watch and Learn is a demonstration performance. The computer plays your drums as well as its own, perfectly on the beat, so you can see and hear how the piece goes.' },
      { li: 'Pause stops everything at once, the sounds included, and Resume carries on exactly where it stopped.' },
      { li: 'Speed can be set to 100% or 75%.' },
      { li: 'Next piece moves on to the next piece in the list.' },
      { p: 'Watch and Learn does not use any of the free preview time, does not change your scores, and keeps playing to the end of the piece.' },
    ],
  },
  {
    title: 'Calibration and settings',
    blocks: [
      { p: 'Speakers, headphones and phones all delay the sound a little, and wireless headphones delay it a lot. Calibration measures that delay so the game can allow for it.' },
      { li: 'Calibrate plays eight steady beats with a pulsing circle. Tap anywhere on every beat.' },
      { li: 'The game takes the middle value of how early or late you were and stores it as your latency. From then on, every touch is shifted by that amount before it is judged.' },
      { li: 'You can also nudge the latency by 5 ms steps in Settings.' },
      { p: 'Other settings: sound on or off, note speed, timing window, note labels (don / ka written on the notes), the metronome click in Learn, vibration on supported phones, reduced motion, and text size up to 300%.' },
    ],
  },
  {
    title: 'Controls',
    blocks: [
      { li: 'Touch: every finger that lands on a drum is one hit. Hold nothing; tap.' },
      { li: 'Keyboard: A S D F play don on drums 1 to 4; Z X C V play ka. Space pauses a piece. Escape pauses in a piece and goes back everywhere else.' },
      { li: 'In menus, tap. On the Rules and About pages, drag or use the wheel to scroll; the A- and A+ buttons change the text size.' },
      { p: 'Rotate the device any time: the layout adapts and your place in a piece is kept.' },
    ],
  },
  {
    title: 'How a piece ends',
    blocks: [
      { p: 'There is no game over. A piece ends when its last bar has finished, and the result screen shows your score, accuracy, stars and best combo.' },
      { p: 'You can leave a piece at any time from the pause menu. Leaving early does not save a score.' },
      { p: 'In Learn, the result shows how you did on each phrase and on the final take.' },
      { p: 'The pieces, in order: ' + PIECES.map((p) => `${p.name} (${p.bpm} bpm)`).join(', ') + '.' },
    ],
  },
  {
    title: 'Glossary',
    blocks: [
      { li: 'Taiko: Japanese for drum; also the style of ensemble drumming.' },
      { li: 'Kumi-daiko: ensemble drumming on a set of different drums.' },
      { li: 'Bachi: the drumsticks.' },
      { li: 'Don: a hit in the middle of the head, deep and round. Ka: a hit on the rim, bright and dry. These are the vocal syllables drummers use to speak a rhythm.' },
      { li: 'Doko: two quick don hits, one with each hand.' },
      { li: 'Shime-daiko, chu-daiko, okedo-daiko, o-daiko: the small, mid-sized, rope-laced and big drums.' },
      { li: 'Atarigane: a small hand gong.' },
      { li: 'Bar and beat: four beats make a bar; the bar lines are brighter than the beat lines in the lane.' },
    ],
  },
];

// A short line about each piece for its card.
export const PIECE_NOTES = Object.fromEntries(PIECES.map((p) => [p.id, p.blurb]));
