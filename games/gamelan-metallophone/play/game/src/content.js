// All the words of the game: About, How to Play, the Rules pages. Numbers are read from music.js (the same constants the engine uses).
// Blocks: { h: heading } { p: paragraph } { li: bullet } { fig: name, hh: height in units } { sp: space }
import { JUDGE, SCORE, WEIGHT, STARS, ENSEMBLE, LEARN, TIMING, SPEEDS, PIECES, GRADES, TUNINGS, CYCLES, INSTRUMENTS, lanesOf } from './music.js';

const ms = (s) => `${Math.round(s * 1000)} ms`;
const pct = (v) => `${Math.round(v * 100)}%`;
const list = (a) => a.join(', ');

export const ABOUT = [
  { h: 'Gamelan' },
  { p: 'A rhythm and music game for the bronze bars and hanging gongs of the gamelan ensembles of Java and Bali in Indonesia. Strike the tuned bars in time, listen to the shimmer of the metal, and keep the cycle with a computer ensemble that grows as you play cleanly.' },
  { h: 'The instruments' },
  { p: 'A gamelan is an ensemble of tuned metal percussion. In this game you play the saron-style bronze bars, struck with a round mallet, and the gongs that mark the cycle: the kenong, the kempul and the big gong. The ensemble also plays a low set of bars (slenthem), a high set (peking) and a small pot (kethuk).' },
  { h: 'Two tunings' },
  { p: 'Slendro has five bars to the octave, almost evenly spaced. Pelog has seven bars with uneven steps, a darker and sweeter colour. The two are tuned differently, so the same number sounds different in each. Real ensembles are each tuned a little differently; the game uses typical values.' },
  { h: 'How it sounds' },
  { p: 'Every sound is synthesised on your device while you play: no recordings and no licensed music. Each bar rings with a slow shimmer, the way a pair of slightly different pitches beat against each other. The six pieces are original, short forms built on a skeleton melody and a repeating cycle of gongs.' },
  { h: 'Made for playing' },
  { li: 'Works with two thumbs or more fingers, and with the keyboard on a computer.' },
  { li: 'A calibration screen lines the game up with your speakers or headphones.' },
  { li: 'Large text and reduced-motion options. No ads. Works offline.' },
  { sp: 1 },
  { p: 'Gamelan is part of Arcforge, a collection of world heritage games.' },
];

export const HOWTO = [
  { h: 'Play in four steps' },
  { li: 'Pick a piece on the Play screen. Start with Learn the pattern: the ensemble plays a short phrase, then you echo it.' },
  { li: 'Notes fall down a lane onto a bar. A golden bar-shaped note with a number is for the bar with that number. A green disc is for a gong.' },
  { li: 'Tap the bar when the note reaches it. Closer to the beat scores more. Use two thumbs, or more fingers, for several bars.' },
  { li: 'Watch the ring: it sweeps once round the cycle. The gong sounds at the top. Play cleanly and more of the ensemble joins; miss and one drops out.' },
  { h: 'Modes' },
  { li: 'Learn the pattern: listen, then echo, phrase by phrase. The Listen button plays the last phrase again.' },
  { li: 'Perform: the whole piece with the ensemble, for stars and a high score.' },
  { li: 'Free play: the whole instrument, gongs above the bars, either tuning, an optional click and an echo partner that answers you.' },
  { li: 'Watch and Learn: the computer plays the whole piece for you and a caption says why each strike happens. Pause it any time.' },
  { h: 'Tips' },
  { li: 'Right moment, wrong bar next door? You still get partial credit ("Nearly") and your combo survives.' },
  { li: 'Notes seem early or late? Open Settings, then Calibrate, and tap along with the pulse.' },
  { li: 'Keyboard: A S D F G H J play bars 1 to 7 of the row, Z X C play the kenong, kempul and gong. Space pauses.' },
];

const lanesText = (p) => lanesOf(p).map((d) => (d < 7 ? String(p.tun.numerals[d]) : ['kenong', 'kempul', 'gong'][d - 7])).join(', ');

// The Rules pages. Each page: { title, blocks }.
export const RULES = [
  {
    title: 'The ensemble',
    blocks: [
      { p: 'A gamelan is an ensemble of tuned bronze percussion from Java and Bali. This game uses a small ensemble. The ones you meet on screen:' },
      { fig: 'ensemble', hh: 170 },
      { li: 'Bars (saron): the row you play most of the time. Tuned bronze bars lying on a carved wooden frame, struck with a mallet. Each bar has a number.' },
      ...INSTRUMENTS.map((d) => ({ li: `${d.name}: ${d.blurb}` })),
      { p: 'A piece asks you to play either the bars or the gongs. What you play has a lane above it; the rest is played by the ensemble, and you see those instruments light up.' },
    ],
  },
  {
    title: 'The bars and two tunings',
    blocks: [
      { p: `Slendro has ${TUNINGS.slendro.n} bars, numbered ${list(TUNINGS.slendro.numerals)}. The steps between neighbours, in cents (a hundred cents is a piano semitone):` },
      { fig: 'slendro', hh: 210 },
      { p: `Pelog has ${TUNINGS.pelog.n} bars, numbered ${list(TUNINGS.pelog.numerals)}, with uneven steps:` },
      { fig: 'pelog', hh: 210 },
      { p: 'The bars rise in pitch from left to right and grow a little shorter as they rise. A bar rings for a few seconds with a slow shimmer; on screen, striking the next bar dims the glow of the one before, as a player damps a bar with the other hand.' },
      { p: 'Real ensembles are each tuned in their own way. The numbers above are typical values, used so that the two tunings sound clearly different.' },
    ],
  },
  {
    title: 'The gongs',
    blocks: [
      { fig: 'gongs', hh: 230 },
      { p: 'Three gongs can be yours. They keep the structure of the music rather than the melody.' },
      { li: `Kenong: strikes at beats ${list(CYCLES.long.kenong)} of the 16-beat cycle, and ${list(CYCLES.short.kenong)} of the 8-beat cycle.` },
      { li: `Kempul: beats ${list(CYCLES.long.kempul)} of the 16-beat cycle; beat ${list(CYCLES.short.kempul)} of the 8-beat cycle.` },
      { li: `Gong: only on the last beat of the cycle, beat ${CYCLES.long.gong[0]} (16-beat) or ${CYCLES.short.gong[0]} (8-beat).` },
      { p: 'Each gong sounds the pitch of the melody note on that beat, so it fits the tune. The kethuk (a dry tick on beats ' + list(CYCLES.long.kethuk) + ' of the long cycle) is always played by the ensemble.' },
    ],
  },
  {
    title: 'The cycle',
    blocks: [
      { p: 'The music is built on a repeating cycle. The ring on screen is that cycle: twelve o\'clock is the end of the cycle, where the gong sounds, and a bright hand sweeps once round while the ensemble plays.' },
      { fig: 'cycle16', hh: 230 },
      { p: `Two cycles are used: a short one of ${CYCLES.short.beats} beats (two bars) and a long one of ${CYCLES.long.beats} beats (four bars). A bar is always four beats.` },
      { p: 'The marks on the ring show when each instrument sounds, and they flash as the ensemble plays them. Listening for the gong tells you where you are; the kenong tells you which quarter you are in.' },
      { p: 'The melody underneath is called the balungan, the skeleton of the tune: one note per beat. Every other part (the low bars, the high bars, the early notes) is made from it, which is why everything agrees in pitch.' },
    ],
  },
  {
    title: 'Notes and timing',
    blocks: [
      { fig: 'notes', hh: 150 },
      { p: 'Notes fall down the lane towards the bar and reach the middle of the bar exactly on the beat. A bar-shaped note is for a bar and shows its number (the numbers can be switched off in Settings). A green disc is for a gong. A smaller, paler note is soft: the same strike, quieter. A faint note is a ghost, the ensemble showing you what it plays.' },
      { p: 'The note speed is a setting: ' + SPEEDS.map((s) => `${s.name} (${s.approach} s from the top to the bar)`).join(', ') + '.' },
      { p: 'When you touch the instrument, the game looks for the nearest unplayed note on that bar, within the allowed timing range. The ranges, either side of the beat (Normal setting):' },
      { li: `Perfect: within ${ms(JUDGE.perfect)}.` },
      { li: `Great: within ${ms(JUDGE.great)}.` },
      { li: `Good: within ${ms(JUDGE.good)}.` },
      { li: 'Nearly: the right moment but the bar next door. It counts for something and keeps your combo.' },
      { li: 'Miss: a note nobody played in time (more than the Good window late). It breaks your combo.' },
      { p: 'The timing setting scales all three windows: ' + TIMING.map((t) => `${t.name} x${t.k}`).join(', ') + '.' },
      { p: 'A touch that matches no note makes a sound but is not judged: you may play extra strikes. A note is only ever judged once.' },
    ],
  },
  {
    title: 'Scoring',
    blocks: [
      { p: `Points per strike: Perfect ${SCORE.perfect}, Great ${SCORE.great}, Good ${SCORE.good}, Nearly ${SCORE.off}, Miss 0. Each is multiplied by your combo bonus: x1, plus one for every ${SCORE.comboStep} strikes in a row, up to x${SCORE.comboMax}.` },
      { p: 'Combo counts every strike that is not a Miss. A Miss sets it back to zero.' },
      { p: `Accuracy is how much of the full marks you earned: every note is worth up to 100%, and a Perfect earns ${pct(WEIGHT.perfect)} of it, Great ${pct(WEIGHT.great)}, Good ${pct(WEIGHT.good)}, Nearly ${pct(WEIGHT.off)}, Miss 0%. The accuracy of a piece is the average over all its notes.` },
      { p: `Stars: ${pct(STARS[0])} accuracy earns one star, ${pct(STARS[1])} two, ${pct(STARS[2])} three. The grade letter is ${GRADES.map((g) => `${g[0]} from ${pct(g[1])}`).join(', ')}.` },
      { p: 'Your best score and best stars for each piece are saved on your device.' },
    ],
  },
  {
    title: 'Learn the pattern',
    blocks: [
      { p: 'Learn works in call and response. The first eight bars of the piece are cut into four phrases of two bars.' },
      { li: 'Count-in: one bar of clicks.' },
      { li: 'Listen (the call): the ensemble plays the phrase on your instrument. The bars light up, the mallets move, a caption explains each strike and the notes fall as pale ghosts.' },
      { li: 'Echo (the response): the same phrase comes again as real notes and you play it back.' },
      { p: `If you finish a phrase below ${pct(LEARN.pass)} accuracy, the same call and response repeats, up to ${LEARN.tries} tries per phrase, then the lesson moves on.` },
      { p: 'After the four phrases comes the final take: the first eight bars played straight through with the ensemble.' },
      { p: 'The Listen button (in the corner) restarts the call for the phrase you are on. The metronome click can be switched off in Settings.' },
    ],
  },
  {
    title: 'Perform and the ensemble',
    blocks: [
      { p: 'Perform plays the whole piece from a one-bar count-in to the last bar, with the computer ensemble.' },
      { fig: 'layers', hh: 190 },
      { p: `The ensemble always plays the cycle (the gongs and the kethuk, or the melody if you play the gongs). It has three more layers: the slenthem (low bars), the peking (high bars) and a shimmering upper layer. You start with ${ENSEMBLE.start} extra layer. Every ${ENSEMBLE.every} strikes in a row (any strike that is not a Miss) brings in the next layer, up to ${ENSEMBLE.max}. A Miss takes one layer away.` },
      { p: 'The instruments that are not playing yet are shown dimmed on the ring panel; they light up when their layer comes in.' },
      { p: 'Your own part is never played for you: a note you miss leaves a gap in the music.' },
      { p: 'The layers never get in the way of judging. They are only an echo of how well you are playing.' },
    ],
  },
  {
    title: 'Free play',
    blocks: [
      { p: 'Free play gives you the whole instrument and no notes: the kenong, kempul and gong above, and the bars below. Strike as you like, with up to ten fingers.' },
      { li: 'Tuning: the button at the right of the control row switches between Slendro (5 bars) and Pelog (7 bars). Listen to the difference.' },
      { li: 'Click: a metronome click on every beat at the tempo shown. Change the tempo with the minus and plus buttons.' },
      { li: 'Echo: after you stop for a moment, the ensemble answers by playing your phrase back, a little softer and an octave higher on the bars. Play another phrase and it answers again.' },
      { p: 'Free play uses your preview time like a real piece does.' },
    ],
  },
  {
    title: 'Watch and Learn',
    blocks: [
      { p: 'Watch and Learn is a demonstration performance. The computer plays your instrument as well as its own, perfectly on the beat, so you can see and hear how the piece goes.' },
      { li: 'A caption says why each strike happens: whether the melody steps up, steps down, repeats or leaps; which beat of the cycle the kenong or kempul is marking; that the gong closes the cycle.' },
      { li: 'Pause stops everything at once, the sounds included, and Resume carries on exactly where it stopped.' },
      { li: 'Speed can be set to 100% or 75%.' },
      { li: 'Next piece moves on to the next piece in the list.' },
      { p: 'Watch and Learn does not use any of the free preview time, does not change your scores, and keeps playing to the end of the piece.' },
    ],
  },
  {
    title: 'The six pieces',
    blocks: [
      { p: 'The pieces go from the simplest job in the ensemble to the full cycle. All six are original.' },
      ...PIECES.map((p) => ({ li: `${p.name}: ${p.tun.name}, ${p.bpm} bpm, ${p.cyc.beats}-beat cycle, ${p.bars} bars. You play: ${lanesText(p)}. ${p.blurb}` })),
    ],
  },
  {
    title: 'Calibration and settings',
    blocks: [
      { p: 'Speakers, headphones and phones all delay the sound a little, and wireless headphones delay it a lot. Calibration measures that delay so the game can allow for it.' },
      { li: 'Calibrate plays steady beats with a pulsing gong. Tap anywhere on every beat.' },
      { li: 'The game takes the middle value of how early or late you were and stores it as your latency. From then on, every touch is shifted by that amount before it is judged.' },
      { li: 'You can also nudge the latency by 5 ms steps in Settings.' },
      { p: 'Other settings: sound on or off, note speed, timing window, numbers on the notes, the metronome click in Learn, vibration on supported phones, reduced motion, and text size up to 300%.' },
    ],
  },
  {
    title: 'Controls',
    blocks: [
      { li: 'Touch: every finger that lands on a bar or gong is one strike. Hold nothing; tap.' },
      { li: 'Keyboard: A S D F G H J play bars 1 to 7 of the row; Z X C play the kenong, kempul and gong. Space pauses a piece. Escape pauses in a piece and goes back everywhere else.' },
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
    ],
  },
  {
    title: 'Glossary',
    blocks: [
      { li: 'Gamelan: an ensemble of tuned bronze percussion, from the Indonesian islands of Java and Bali.' },
      { li: 'Slendro, pelog: the two tuning systems. Slendro has five notes to the octave, pelog seven.' },
      { li: 'Saron: a set of bronze bars on a wooden frame, struck with a mallet. Slenthem: the low one. Peking: the high one.' },
      { li: 'Balungan: the skeleton melody, one note per beat, that the other parts decorate.' },
      { li: 'Colotomic structure: the gongs and the kethuk marking the cycle into parts.' },
      { li: 'Gong, kenong, kempul, kethuk: the cycle instruments, from the biggest and deepest to the smallest and driest.' },
      { li: 'Shimmer: the slow beating that comes from two nearly equal pitches sounding together.' },
      { li: 'Bar and beat: four beats make a bar; the bar lines are brighter than the beat lines in the lane.' },
    ],
  },
];

// A short line about each piece for its card.
export const PIECE_NOTES = Object.fromEntries(PIECES.map((p) => [p.id, p.blurb]));
