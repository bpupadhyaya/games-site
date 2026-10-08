// All the words of the game: About, How to Play, the Rules pages. Numbers are read from music.js (the same constants the engine uses).
// Blocks: { h: heading } { p: paragraph } { li: bullet } { fig: name, hh: height in units } { sp: space }
import { JUDGE, SWEEP_K, BEND_WINDOW, SCORE, WEIGHT, STARS, ENSEMBLE, LEARN, MA, THINK, TIMING, SPEEDS, GEO, PIECES, SCALES, GRADES, FINGERS, KANJI, pieceSeconds } from './music.js';

const ms = (s) => `${Math.round(s * 1000)} ms`;
const pct = (v) => `${Math.round(v * 100)}%`;
const semis = (st) => st.join(' ');

export const ABOUT = [
  { h: 'Koto' },
  { p: 'A music game for the koto, the Japanese long zither. Thirteen silk strings lie along a body of paulownia wood; you pluck them, sweep across them and press them to bend the pitch, and you play six short pieces that grow from single slow notes to flowing runs.' },
  { h: 'The instrument' },
  { p: `The koto has ${KANJI.length} strings of the same length stretched over a long hollow body. Each string rests on its own movable bridge, called a kotoji, and the position of the bridge sets the pitch, so the player tunes the instrument by sliding the bridges. Notes are plucked with picks, tsume, worn on the thumb, index and middle fingers. The left hand presses a string behind its bridge to raise the pitch (oshide).` },
  { h: 'Silence is part of the music' },
  { p: 'Japanese music values the gap between sounds, called ma. In this game a rest of two beats or more is a ma: keep still, and the stillness scores like a note.' },
  { h: 'How it sounds' },
  { p: 'Every sound is synthesised on your device while you play: no recordings and no licensed music. The six pieces are original, apart from one simplified spring melody based on a traditional tune.' },
  { h: 'Made for playing' },
  { li: 'Works with several fingers at once, and with the keyboard on a computer.' },
  { li: 'Watch and Learn shows the finger, the string and the reason for every note, and you set how long it waits for you to think.' },
  { li: 'A calibration screen lines the game up with your speakers or headphones. Text size goes up to 300%.' },
  { li: 'Portrait and landscape on phones and tablets. No ads. Works offline.' },
  { h: 'Free preview' },
  { p: 'The first 90 seconds of real playing (Learn, Play and Free Play) are free. Menus, these pages, Watch and Learn and the results never use the preview. One purchase unlocks the whole game on this device.' },
  { sp: 1 },
  { p: 'Koto is part of Arcforge, a collection of world heritage games.' },
];

export const HOWTO = [
  { h: 'Play in four steps' },
  { li: 'Pick a piece, then start with Learn: you hear a short phrase, then play it back.' },
  { li: 'Red discs slide down the strings (along them, towards you). Tap the string, in front of its bridge, when the disc reaches the ring.' },
  { li: 'A gold ring on a disc means press: hold the same string behind its bridge. Close to the bridge bends a half step, further back a whole step.' },
  { li: 'Pale bands with the character for ma are rests: keep still and let the sound fade.' },
  { h: 'Other gestures' },
  { li: 'Sweep: teal discs on neighbouring strings. Drag one finger across the strings in a single stroke.' },
  { li: 'Two discs side by side are a chord: use two fingers together.' },
  { li: 'You can press with one thumb and pluck with the other, or pluck first and press within a second while the string still rings.' },
  { h: 'Modes' },
  { li: 'Learn: listen, then echo, phrase by phrase. Listen again replays the phrase.' },
  { li: 'Play: the whole piece. Clean playing adds accompaniment layers. Show me points out the next note.' },
  { li: 'Watch and Learn: the teacher plays each phrase. First you get time to think (set in Settings), then the strings are revealed, then the phrase is played with the finger, the string and the reason shown.' },
  { li: 'Free play: retune any bridge by dragging it along its string, or switch between five traditional tunings.' },
  { h: 'Tips' },
  { li: 'Notes seem early or late? Open Settings, then Calibrate, and tap along with the pulse.' },
  { li: 'Keyboard: Q W E R T Y U I O P [ ] \\ pluck strings 1 to 13. Hold Shift for a half-step press and Ctrl for a whole step. Space pauses.' },
];

export const RULES = [
  {
    title: 'The instrument',
    blocks: [
      { fig: 'instrument', hh: 250 },
      { p: `Thirteen strings of silk run the long way of the body. They are numbered 1 to 13 from the lowest to the highest and are traditionally named with the numerals ${KANJI.join(' ')}; strings 11, 12 and 13 are called to, i and kin. The numerals are written at your end of the instrument.` },
      { p: 'In portrait the strings run from the top of the screen to the bottom, and you sit at the bottom end, string 1 on the left. In landscape the strings run from left to right, you sit at the right end, and string 1 is at the bottom, as if you had turned the phone a quarter turn counter-clockwise.' },
      { p: 'The ivory pieces on the strings are the bridges (kotoji). Everything in front of a bridge, towards you, is the sounding part of the string; the part behind it only serves for pressing.' },
    ],
  },
  {
    title: 'Bridges and tuning',
    blocks: [
      { fig: 'bridges', hh: 330 },
      { p: `A string sounds from its bridge to your end, so the nearer a bridge stands to you, the shorter the sounding part and the higher the note. The bridges form the slanting line you see, and a different tuning gives the line a different shape.` },
      { p: 'The tunings are pentatonic (five notes repeated up the thirteen strings). The steps below are in half steps above the lowest string of each group of five:' },
      ...SCALES.map((s) => ({ li: `${s.name}: ${semis(s.steps)}. ${s.blurb}` })),
      { p: 'Every piece has its own tuning (see The pieces). In Free play you can slide any bridge: it moves in half steps, from 6 half steps below its tuning to 12 above, and the new pitch sounds as you move it.' },
    ],
  },
  {
    title: 'Plucking',
    blocks: [
      { fig: 'zones', hh: 300 },
      { p: 'Touch a string on the part in front of its bridge (the teal part) to pluck it. The string nearest to your finger sounds. The whole touch counts at the moment your finger lands, using the time the screen reported the touch.' },
      { p: 'You can play several strings at once with several fingers. A touch that does not match any note makes the sound but is not judged, so extra notes are allowed.' },
      { p: 'Fingers: the Watch and Learn teacher uses the thumb, then the index finger, then the middle finger, in turn. That pattern is a simple teaching aid; you can use any finger.' },
      { p: 'Keyboard: Q W E R T Y U I O P [ ] and backslash pluck strings 1 to 13.' },
    ],
  },
  {
    title: 'Sweeps',
    blocks: [
      { fig: 'sweep', hh: 200 },
      { p: 'A sweep, kakizume, is one stroke across neighbouring strings. In the game it is a chain of teal discs, one on each string, joined by a band.' },
      { p: `Put a finger down in front of the bridges and drag it across the strings. Each time the finger crosses a string line, that string is plucked. Dragging back over the same string you just plucked does not pluck it again; moving on to a neighbouring string does.` },
      { p: `Sweep discs are judged like other notes, but with timing windows ${SWEEP_K} times wider, so a smooth stroke at the right speed scores well. You can also tap the strings one by one.` },
    ],
  },
  {
    title: 'Pressing (oshide)',
    blocks: [
      { p: 'Pressing a string behind its bridge raises its pitch. The part of the string behind the bridge is the press zone (the amber part in the figure on Plucking).' },
      { li: `Close to the bridge (within ${pct(GEO.halfBand)} of the string length): a half step up. The disc shows a gold ring with a half sign.` },
      { li: 'Further back: a whole step up. The gold ring shows a 1.' },
      { p: 'Hold your finger on the string: while it is held the string is pressed. If the string rings while you press it, its pitch bends up; if you press first, it sounds already raised.' },
      { p: `A disc with a gold ring asks for both a pluck and a press. The pluck is judged as usual. The press counts if the right level is held at the pluck or within ${BEND_WINDOW} seconds after it. A correct press scores a BEND bonus of ${SCORE.bend} points (times your combo bonus) and counts as one more note in your accuracy. If the right level is not held in time, FLAT appears and that part earns nothing. Pressing too hard or too softly does not count; slide to the right level while the string rings.` },
      { p: 'Keyboard: hold Shift while you pluck for a half-step press and Ctrl for a whole step.' },
    ],
  },
  {
    title: 'Ma, the silence',
    blocks: [
      { fig: 'ma', hh: 220 },
      { p: `A rest of ${MA.minBeats} beats or more is a ma. It appears as a pale band across the strings with the character for ma, sliding towards the ring like a note. Shorter rests are just gaps.` },
      { p: `While the band is on the ring, keep still. If you do not touch any string or press zone from ${MA.lead} seconds after the ma starts until ${MA.tail} seconds before it ends, the ma is kept: you score ${SCORE.ma} points (times your combo bonus), it counts as a perfect note in your accuracy and the character for ma glows. A touch in that window breaks it: it counts as a note with zero accuracy and no points. The first and last moments are left free so that you can play the notes on either side.` },
      { p: 'Rests are only judged in Play, in the Echo part of Learn and in the final take. They are shown, and explained, in Watch and Learn and in the Listen part of Learn.' },
    ],
  },
  {
    title: 'Notes and timing',
    blocks: [
      { fig: 'notes', hh: 150 },
      { p: 'Notes slide along their string towards the ring and arrive on the beat. The note speed is a setting: ' + SPEEDS.map((s) => `${s.name} (${s.approach} s from the far end to the ring)`).join(', ') + '.' },
      { p: 'When you pluck a string, the game looks for the nearest unplayed note on that string within the allowed range. The ranges either side of the beat (Normal timing):' },
      { li: `Perfect: within ${ms(JUDGE.perfect)}.` },
      { li: `Great: within ${ms(JUDGE.great)}.` },
      { li: `Good: within ${ms(JUDGE.good)}.` },
      { li: 'Near: no note waits on that string, but a note on the string next to it is due. The note is taken as Near: it earns a little, keeps the combo, and is judged only once.' },
      { li: 'Miss: a note nobody played in time (later than the Good range). It breaks the combo.' },
      { p: 'The timing setting scales the three ranges: ' + TIMING.map((t) => `${t.name} x${t.k}`).join(', ') + `. Sweep discs use ranges ${SWEEP_K} times as wide.` },
      { p: 'Notes early or late on your device? Settings, Calibrate: tap along with a pulse and the game measures the delay of your speakers or headphones. You can also set it by hand.' },
    ],
  },
  {
    title: 'Scoring',
    blocks: [
      { p: `Points per note: Perfect ${SCORE.perfect}, Great ${SCORE.great}, Good ${SCORE.good}, Near ${SCORE.off}, Miss 0. Each is multiplied by your combo bonus: x1, plus one for every ${SCORE.comboStep} notes in a row, up to x${SCORE.comboMax}. A Miss sets the combo back to zero. Bends add ${SCORE.bend} and kept silences ${SCORE.ma}, also multiplied.` },
      { p: `Accuracy is how much of the full marks you earned. Each note is worth up to 100%: Perfect earns ${pct(WEIGHT.perfect)} of it, Great ${pct(WEIGHT.great)}, Good ${pct(WEIGHT.good)}, Near ${pct(WEIGHT.off)}, Miss 0%. A note with a press counts twice (the pluck and the press), and each ma counts once. The accuracy of a piece is the average over all of these.` },
      { p: `Stars: ${pct(STARS[0])} accuracy earns one star, ${pct(STARS[1])} two, ${pct(STARS[2])} three. The grade letter is ${GRADES.map((g) => `${g[0]} from ${pct(g[1])}`).join(', ')}.` },
      { p: 'Your best score and best stars for each piece are saved on your device. Scores are not kept for Watch and Learn.' },
    ],
  },
  {
    title: 'Learn',
    blocks: [
      { p: 'Learn works in call and response. The eight bars of a piece are cut into four phrases of two bars.' },
      { li: 'Count in: one bar of clicks (the metronome can be switched off in Settings; the count stays).' },
      { li: 'Listen: the teacher plays the phrase. Pale blue discs slide down, a fingertip shows the finger and the string, and the caption says why.' },
      { li: 'Echo: the same phrase comes again as real discs and you play it back.' },
      { p: `If you finish a phrase below ${pct(LEARN.pass)} accuracy, the same call and response repeats, up to ${LEARN.tries} tries per phrase, then the lesson moves on.` },
      { p: 'After the four phrases comes the final take: the whole piece straight through. The accompaniment starts silent and joins as you play cleanly, as in Play.' },
      { p: 'The Listen again button restarts the call for the phrase you are on.' },
    ],
  },
  {
    title: 'Play and the accompaniment',
    blocks: [
      { fig: 'layers', hh: 190 },
      { p: 'Play is the whole piece, with a count-in of one bar. The accompaniment is generated from the piece. It starts silent.' },
      { p: `Every ${ENSEMBLE.every} notes in a row that are not Misses add one layer, up to ${ENSEMBLE.max}: first a low string plays on every bar, then a soft octave sounds above each melody note that has a string an octave above it. A Miss takes one layer away.` },
      { p: 'The Show me button points out the next note for a few seconds: the fingertip appears on its string and the caption says which finger and why. It costs nothing.' },
    ],
  },
  {
    title: 'Watch and Learn',
    blocks: [
      { p: 'The teacher plays the whole piece, one phrase at a time, with the accompaniment. Nothing is scored.' },
      { li: `Think: the phrase is announced and its strings light up. The wait is set in Settings, from ${THINK.min} to ${THINK.max} seconds (it starts at ${THINK.def}). Skip wait moves on at once.` },
      { li: `Reveal (${THINK.reveal} seconds): the fingertip shows where the first note goes and why.` },
      { li: 'Act: the teacher plays the phrase. The caption names the finger and string and gives the reason for each note, such as a step, a leap, a press or a silence.' },
      { p: 'Pause stops everything where it is, including the Think timer, and resumes in the same place. In the pause menu you can switch to a slower tempo, jump to the next piece or leave.' },
    ],
  },
  {
    title: 'Free play',
    blocks: [
      { p: 'Free play is the instrument with no notes and no score.' },
      { li: 'Pluck, sweep and press as in the pieces.' },
      { li: 'Drag a bridge along its string to retune it. The note name appears and the string sounds; each step is one half step.' },
      { li: 'Tap the tuning button to move to the next of the five tunings. Reset bridges returns the current tuning to its standard shape.' },
      { p: 'Names above the bridges give the pitch of each string with the lowest string of the Hirajoshi tuning as a D.' },
    ],
  },
  {
    title: 'The pieces',
    blocks: [
      { p: 'Six original arrangements, from simple to flowing. Each is eight bars of four beats. Times are at the normal tempo.' },
      ...PIECES.map((p) => ({ li: `${p.name}: ${SCALES.find((s) => s.id === p.scale).name} tuning, ${p.bpm} beats per minute, about ${pieceSeconds(p)} seconds. ${p.blurb}` })),
      { p: `Pieces use strings up to number 11 and a Watch and Learn run takes longer than the piece itself because of the Think and Reveal pauses.` },
    ],
  },
  {
    title: 'Controls and settings',
    blocks: [
      { li: 'Touch: tap, drag, hold. Use as many fingers as you like.' },
      { li: 'Keyboard: Q W E R T Y U I O P [ ] \\ for strings 1 to 13, Shift or Ctrl for pressing, Space or Escape to pause, Escape to leave a screen.' },
      { li: 'Pause is in the corner; the app also pauses when it goes to the background.' },
      { li: 'Settings: sound, note speed, timing, string numbers, metronome in Learn, vibration, reduced motion, the Think wait, the sound delay and Calibrate.' },
      { li: 'Text size: A- and A+ at the top of every text screen, from 100% to 300%.' },
      { li: `Fingers named by the teacher: ${FINGERS.join(', ')}.` },
    ],
  },
];
