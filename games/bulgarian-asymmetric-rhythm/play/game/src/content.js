// All the reading text: About, How to Play and the paged Rules. Every number here is the number the engine uses (music.js, game.js).
import { JUDGE, TIMING, SCORE, WEIGHT, FLOW, LEARN, ACCENT, DANCERS, LAYER_NAMES, PIECES, comboMult } from './music.js';

const LEARN_BARS = 8, LEARN_PHRASE = 2, AUTO_PHRASE = 4;      // kept equal to the constants exported by game.js (the test checks this)
export const PHRASES = { LEARN_BARS, LEARN_PHRASE, AUTO_PHRASE };
const ms = (s) => `${Math.round(s * 1000)} ms`;
const pct = (v) => `${Math.round(v * 100)}%`;

export const ABOUT = [
  { h: 'Bulgarian Asymmetric Rhythm' },
  { p: 'A rhythm game inspired by the dance music of Bulgaria, where a bar is not four even beats but a mix of quick and slow pulses: five, seven, nine or eleven eighth-notes gathered in groups of two and three. The best known is the rachenitsa in 7/8, counted quick-quick-slow, danced in a line with joined hands and a lot of hopping.' },
  { fig: 'row', hh: 250 },
  { h: 'Where it comes from' },
  { p: 'Across Bulgaria, village dances called horo are danced in a chain or circle. Many of them keep time in asymmetric (odd) metres: paidushko in 5/8, rachenitsa in 7/8, daychovo in 9/8, kopanitsa in 11/8. Musicians and dancers feel these metres as groups, 2+3, 2+2+3, 2+2+2+3 and 2+2+3+2+2, rather than counting every eighth note. This is part of the living heritage of Bulgaria, passed on at festivals, weddings, gatherings and in village squares, and studied by musicians around the world.' },
  { p: 'The game shows only the metres and the idea of the dance, in original patterns made for the game, played on synthesised drum, clap, stamp, drone and reed sounds. It includes no songs, lyrics or recordings, out of respect for the musicians, singers and dance communities who keep the tradition.' },
  { h: 'What you do' },
  { p: 'Each bar is a row of cells on an embroidered sash, and a needle runs along it one pulse at a time. The cells are gathered in groups, with the group sizes marked above. Play the symbol in each cell with the matching pad: DRUM for the accents, CLAP for lighter pulses, STEP for dance steps. Every cell you play is stitched into the cloth; a clean performance fills the sash with stitches, and as you play well the line of dancers grows and the band joins in.' },
  { h: 'Credits' },
  { p: 'Game by Arcforge. All sound is synthesised on your device and all art is drawn in the game. Display font Cinzel by the Cinzel Project Authors (SIL Open Font License 1.1).' },
  { p: 'Works offline. Free to play with short ads; go ad-free once.' },
];

export const HOWTO = [
  { h: 'How to play' },
  { p: 'Pick a piece, then choose Learn, Perform or Watch and Learn.' },
  { fig: 'pads', hh: 220 },
  { li: 'A needle runs along the bar one pulse at a time. Each cell is one pulse. The numbers above the cells are the sizes of the groups: 2, 2, 3 in a 7/8 bar.' },
  { li: 'DRUM (red disc): tap the red pad when the needle reaches a red disc. These are usually the first pulse of a group.' },
  { li: 'CLAP (gold burst): tap the gold pad when the needle reaches a gold burst.' },
  { li: 'STEP (green boot): tap the green pad when the needle reaches a green boot print.' },
  { li: 'Empty cells are rests: keep counting them, one-two, one-two, one-two-three.' },
  { h: 'The groupings' },
  { fig: 'groupings', hh: 360 },
  { p: 'A bar may regroup from one bar to the next, 2+2+3 becoming 3+2+2. The next bar is always visible below the current one, so read ahead and see where its groups fall.' },
  { h: 'Stitches and flow' },
  { p: 'Each cell you play becomes a stitch: a full cross for perfect and great timing, one diagonal for good, a violet dot for the wrong pad, and a gap for a miss. Clean stitching fills the Flow bar. The fuller it is, the more dancers join the horo and the more of the band you hear: drone, rim taps, reed melody, bells.' },
  { h: 'Learn, Perform, Watch' },
  { li: `Learn: a lead drummer plays two bars with counting ticks, then you echo them. Each phrase gets up to three tries across the first ${LEARN_BARS} bars, then you play the whole piece.` },
  { li: 'Perform: play the whole piece straight through for score and stars.' },
  { li: 'Watch and Learn: the band plays the whole piece for you. It thinks out loud before each phrase, shows what is coming, then plays it. Pause at any time.' },
  { h: 'Need a hint?' },
  { p: 'The question-mark button numbers and lights the next four cells for a few seconds. In Learn it plays the lead drummer\'s phrase again.' },
  { h: 'Keyboard' },
  { p: 'Space or J: drum. C or K: clap. S or L: step. P or Escape: pause. H: hint.' },
];

const win = (k) => `perfect within ${ms(JUDGE.perfect * k)}, great within ${ms(JUDGE.great * k)}, good within ${ms(JUDGE.good * k)}`;
const pieceLine = (p) => `${p.name}: ${p.meter === '5-11' ? 'bars of 5, 7, 9 and 11 pulses' : `${p.meter}`}, ${p.eps.toFixed(1)} pulses a second, ${p.bars.length} bars.`;

export const RULES = [
  { title: 'The goal', blocks: [
    { p: 'Play a piece of Bulgarian-style dance rhythm on three pads: a drum for the accents, a clap for lighter pulses and a stamped step. Every cell of the sash that carries a symbol is a cue; you play it when the needle reaches it.' },
    { p: 'Your timing builds Flow. More Flow brings more dancers into the line and more of the band into the music. At the end you get a score, an accuracy, a letter grade and up to three stars, and the sash you stitched.' },
  ] },
  { title: 'The sash and the needle', blocks: [
    { p: 'One bar is one row on the sash. The row has one cell per pulse (one eighth note): five, seven, nine or eleven cells. Cells are gathered in groups of two or three with a wider gap between groups, and the size of each group is written above it. Under the cells the pulses are counted inside their group: 1 2 | 1 2 | 1 2 3.' },
    { fig: 'row', hh: 250 },
    { p: 'A needle with a thread runs along the current row, exactly one cell per pulse, and a cue is due at the moment the needle is centred on its cell. The row above is the bar you just played, with its stitches; the row below is the next bar. When a bar ends the rows slide up and the needle starts the next one.' },
    { p: 'The first pulse of every group is marked with a small red lozenge. That is the accent of the group, and most drum cues sit on it.' },
  ] },
  { title: 'The three pads', blocks: [
    { fig: 'pads', hh: 220 },
    { li: `DRUM (red): tap the red pad. The drum scores extra: its points are multiplied by ${ACCENT}.` },
    { li: 'CLAP (gold): tap the gold pad.' },
    { li: 'STEP (green): tap the green pad. It makes the whole line of dancers stamp.' },
    { p: 'You can tap anywhere in the column of a pad; the three pads share the bottom of the screen and your touch picks the nearest column. Keyboard: Space or J (drum), C or K (clap), S or L (step).' },
    { p: 'Only one finger is used, so the pads sit side by side and a single finger can hop between them. No pattern asks for two pads on the same pulse.' },
  ] },
  { title: 'Timing and grades', blocks: [
    { p: `A tap is matched to the nearest unplayed cue of the same pad within the good range. At Standard timing: ${win(1)}. Relaxed multiplies the ranges by ${TIMING[0].k}, Tight by ${TIMING[2].k} (Settings).` },
    { fig: 'stitches', hh: 140 },
    { li: 'PERFECT and GREAT: a full cross-stitch in the colour of the pad.' },
    { li: 'GOOD: a single diagonal stitch.' },
    { li: 'OFF: a violet dot. This happens when you tap the wrong pad at a moment that had a cue: the cue is used up. The wrong-pad range is the great range.' },
    { li: 'MISS: a gap in the cloth. The cue was not played in time.' },
    { p: `A tap with no cue near it is a stray: it makes the sound of its pad, gives no grade and takes ${pct(-FLOW.stray)} off the Flow bar.` },
  ] },
  { title: 'Score and combo', blocks: [
    { p: `Points per cue: perfect ${SCORE.perfect}, great ${SCORE.great}, good ${SCORE.good}, off ${SCORE.off}, miss ${SCORE.miss}. Each is multiplied by the combo multiplier and, for drum cues, by ${ACCENT}.` },
    { p: `Combo counts cues in a row that were not missed (an OFF keeps the combo). Every 10 in a row adds 0.5 to the multiplier, up to x${comboMult(60).toFixed(1)} at 60. A miss resets the combo to zero.` },
    { p: `Accuracy is the average weight of every cue you were due to play: perfect ${WEIGHT.perfect}, great ${WEIGHT.great}, good ${WEIGHT.good}, off ${WEIGHT.off}, miss ${WEIGHT.miss}. Stars come from accuracy: 3 stars from 90%, 2 from 75%, 1 from 55%. The letter grade is S from 95%, A from 85%, B from 72%, C from 55%, otherwise D.` },
  ] },
  { title: 'Flow, band and dancers', blocks: [
    { p: `Flow runs from 0 to 100%. Perfect adds ${pct(FLOW.perfect)}, great ${pct(FLOW.great)}, good ${pct(FLOW.good)}; off takes ${pct(-FLOW.off)}, a miss ${pct(-FLOW.miss)} and a stray ${pct(-FLOW.stray)}.` },
    { fig: 'flow', hh: 220 },
    { p: `The band has four layers: ${LAYER_NAMES.join(', ')}. The drone and a soft tick on each group start are always there; rim taps and a shaker fill the rests from ${pct(FLOW.layers[0])} Flow, the reed melody from ${pct(FLOW.layers[1])} and the bells from ${pct(FLOW.layers[2])}. A layer drops out again if Flow falls 4% below its mark.` },
    { p: `The line of dancers grows with the layers: ${DANCERS.join(', ')} dancers. They hop on every group start and stamp when you play the step pad.` },
  ] },
  { title: 'Shifting groups', blocks: [
    { p: 'Some pieces keep the same number of pulses but regroup them. The same seven pulses can be 2+2+3, 3+2+2 or 2+3+2; the drum falls on a different place each time.' },
    { fig: 'shift', hh: 330 },
    { p: 'When a bar has a different grouping from the one before, a banner says NOW and the new grouping. The next row always shows the new grouping a bar ahead, so you can see the gaps move before the needle gets there.' },
    { p: 'In Road of Many Meters the number of pulses changes too, from 5 up to 11 and back.' },
  ] },
  { title: 'Learn', blocks: [
    { p: `Learn teaches the first ${LEARN_BARS} bars of the piece in phrases of ${LEARN_PHRASE} bars at ${pct(LEARN.speed)} of the piece's speed.` },
    { li: 'A count-in bar: clicks on every pulse, louder on the first of each group.' },
    { li: 'WATCH: the lead drummer plays the phrase, with a tick on every pulse. Those cues are shown dashed and are not scored.' },
    { li: 'ECHO: you play the same phrase with the same ticks.' },
    { p: `If your accuracy on the echo is below ${pct(LEARN.pass)} you repeat the phrase, up to ${LEARN.tries} tries, then the lesson moves on. After the last phrase you play the whole piece at full speed; that final take is what gets the stars.` },
    { p: 'The question-mark button replays the lead drummer\'s phrase. The pause menu has Listen again too.' },
  ] },
  { title: 'Perform', blocks: [
    { p: 'Perform plays the whole piece once, at full speed, after a count-in bar. The sash scrolls bar by bar; the band is built by your Flow. When the last bar ends, the result screen shows the stitched sash, one row per bar.' },
    { p: 'The question-mark button numbers and lights the next four cues for a few seconds and glows the pad you need. It never changes the score.' },
  ] },
  { title: 'Watch and Learn', blocks: [
    { p: `Watch and Learn plays the whole piece for you in phrases of ${AUTO_PHRASE} bars. Before each phrase it THINKS: the phrase appears on a card with a plain description and a countdown (Settings: 2 to 10 seconds, default 5; tap the card to skip ahead). Then it REVEALS the cues one by one, numbered, for 2 seconds. Then it plays the phrase with the whole band.` },
    { p: 'The music waits during the think and reveal steps. Pause stops everything, including a phrase in flight, and resumes exactly where it stopped. Free to play with short ads; go ad-free once.' },
  ] },
  { title: 'The pieces', blocks: [
    ...PIECES.map((p) => ({ li: pieceLine(p) })),
    { p: 'Speeds are in pulses (eighth notes) a second. Village dancing is often faster; the game is slower so that every pulse can be played.' },
  ] },
  { title: 'Free to play and settings', blocks: [
    { p: 'Free to play with short ads; go ad-free once.' },
    { p: 'The web demo plays the first piece a few times.' },
    { p: 'Settings: Sound, Timing (Relaxed, Standard, Tight), Think time for Watch and Learn, Latency (shifts the beat by -100 to +400 ms for your device; Latency check listens to ten of your taps and sets it for you), Count numbers (the 1 2 | 1 2 3 under the cells), Calm effects (fewer particles, no screen shake) and Vibration.' },
  ] },
  { title: 'What is simplified', blocks: [
    { p: 'The patterns are original, made for the game; they are not transcriptions of any recording or any village dance. Real dancing varies from village to village and region to region: the same metre may be counted 2+2+3 or 3+2+2, steps differ, and real music is much faster and more ornamented.' },
    { p: 'Dance steps are reduced to one pad. Costumes are generic folk dress, not any one region\'s. There are no songs or lyrics, no recordings, and no ceremonial elements.' },
  ] },
];
