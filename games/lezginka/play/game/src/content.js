// All the words of the game: About, How to Play, the Rules pages. Numbers are read from music.js (the same constants the engine uses).
// Blocks: { h: heading } { p: paragraph } { li: bullet } { fig: name, hh: height in units } { sp: space }
import { JUDGE, SCORE, WEIGHT, STARS, FLOOR, LEARN, TIMING, SPEEDS, PIECES, PADS, GRADES, bpmAt, stepCount } from './music.js';

const ms = (s) => `${Math.round(s * 1000)} ms`;
const pct = (v) => `${Math.round(v * 100)}%`;

export const ABOUT = [
  { h: 'Lezginka' },
  { p: 'A rhythm game about the fast, proud folk dance of the Caucasus. Stamp, lift your arms and spin in time with the drum and the accordion, and keep the tempo climbing as more dancers join the floor.' },
  { h: 'The tradition' },
  { p: 'Lezginka is a lively folk dance known in many communities of the Caucasus, the mountain region between the Black Sea and the Caspian Sea. Its name is linked to the Lezgin people, and the dance is also performed by neighbouring peoples and in communities far from home. It is danced at weddings, festivals and family gatherings, usually to a hand drum, an accordion or a reed pipe, and it is known for quick footwork, the dancer rising on the toes and arms spread like the wings of a bird, while the woman glides smoothly beside him.' },
  { h: 'This game' },
  { p: 'The five dances and their tunes are original, made for this game, and every sound is synthesised on your device while you play: no recordings and no licensed music. The costumes are stylised and the dancers are not portraits of real people. The dance is shown as music, rhythm and skill, never as a contest or a fight.' },
  { h: 'Made for playing' },
  { li: 'Works with two thumbs or more fingers, and with the keyboard on a computer.' },
  { li: 'A calibration screen lines the game up with your speakers or headphones.' },
  { li: 'Large text (up to 300%) and a reduced-motion option. Works offline.' },
  { sp: 1 },
  { p: 'Lezginka is part of Arcforge, a collection of world heritage games.' },
];

export const HOWTO = [
  { h: 'Play in four steps' },
  { li: 'Pick a dance on the Play screen. Start with Learn the steps: the teacher dances a short phrase, then you echo it.' },
  { li: 'Four pads surround the dancer: left boot, right boot, arms and spin. Rings close in on the pads.' },
  { li: 'Tap a pad when its ring lands on the rim of the pad. The closer to the beat, the more you score. Use two thumbs, or more fingers.' },
  { li: 'Dance cleanly and more dancers join the floor and more of the band plays. Miss, and one group sits out.' },
  { h: 'Modes' },
  { li: 'Learn the steps: listen to a phrase, then echo it, phrase by phrase. The Listen button plays the last phrase again.' },
  { li: 'Dance: the whole piece with the full band, for stars and a high score.' },
  { li: 'Watch and Learn: the dancers perform the whole piece for you. Pause it any time, and tap the Steps button to see the figure name and its four steps.' },
  { h: 'Tips' },
  { li: 'Tapped the wrong pad at about the right time? The step counts a little ("Off") and your combo survives.' },
  { li: 'The tempo climbs through every dance. Rings stay the same length, so there are more of them on screen late in the dance.' },
  { li: 'Steps feel early or late? Open Settings, then Calibrate, and tap along with the pulse.' },
  { li: 'Keyboard: A or Left arrow = left boot, D or Right arrow = right boot, W or Up arrow = arms, S or Down arrow = spin. Space pauses.' },
];

const bpmRange = (p) => `${p.bpm} to ${Math.round(bpmAt(p, p.bars - 1))} beats per minute`;

// The Rules pages. Each page: { title, blocks }.
export const RULES = [
  {
    title: 'The dance floor',
    blocks: [
      { p: 'One dancer stands on a woven rug. Around the dancer are four step pads. You do not steer the dancer: you play the steps, and the dancer performs each one the moment you tap it.' },
      { fig: 'pads', hh: 250 },
      ...PADS.map((p) => ({ li: `${p.name}: ${p.blurb}` })),
      { p: 'A touch always goes to the nearest pad, so you never have to be exact, and you can use as many fingers as you like.' },
      { p: 'Some dances use only the left, right and arms pads. The spin pad joins in the later dances.' },
    ],
  },
  {
    title: 'Rings and timing',
    blocks: [
      { fig: 'ring', hh: 230 },
      { p: 'A ring closes in on a pad. When the ring meets the rim of the pad, that is the beat: tap the pad then. Several rings can be on their way at once, one for each coming step.' },
      { p: `How close you are to the beat decides the grade. At the Normal timing setting, Perfect is within ${ms(JUDGE.perfect)} either side, Great within ${ms(JUDGE.great)} and Good within ${ms(JUDGE.good)}. The Timing setting widens (Relaxed, x${TIMING[0].k}) or narrows (Tight, x${TIMING[2].k}) these windows.` },
      { p: 'A step that nobody tapped within the Good window is a Miss.' },
      { p: 'Wrong pad: if you tap a pad that has no step coming but another pad has one inside the Good window, that step counts as Off. Off earns a small score and keeps the combo going.' },
      { p: `The Note speed setting changes how long a ring takes to close: ${SPEEDS.map((s) => `${s.name} ${s.approach.toFixed(2)} s`).join(', ')}.` },
    ],
  },
  {
    title: 'Score, combo and stars',
    blocks: [
      { p: `Each step scores by its grade: Perfect ${SCORE.perfect}, Great ${SCORE.great}, Good ${SCORE.good}, Off ${SCORE.off}, Miss 0.` },
      { p: `Every grade except Miss adds one to your combo. The combo multiplier is 1 plus one for every ${SCORE.comboStep} steps in a row, up to x${SCORE.comboMax}. A Miss resets the combo.` },
      { p: `Accuracy is the average credit per step: Perfect ${WEIGHT.perfect}, Great ${WEIGHT.great}, Good ${WEIGHT.good}, Off ${WEIGHT.off}, Miss ${WEIGHT.miss}. Stars: one at ${pct(STARS[0])}, two at ${pct(STARS[1])}, three at ${pct(STARS[2])}.` },
      { p: `Letter grades: ${GRADES.map((g) => `${g[0]} from ${pct(g[1])}`).join(', ')}.` },
      { p: 'Your best score, stars and combo for each dance are saved on this device.' },
    ],
  },
  {
    title: 'The floor fills',
    blocks: [
      { fig: 'floor', hh: 230 },
      { p: `The base groove (drum and bass) always plays. You start with the tune and one group of dancers. For every ${FLOOR.every} steps in a row without a Miss another group joins the floor and another layer of the band comes in: hand claps, then the high tune and a heavy drum, up to layer ${FLOOR.max}.` },
      { p: 'A Miss sends one group back to the sidelines and takes one layer away (never the base groove).' },
      { p: 'The dancers and the band are there for the feeling of the dance: they do not change how a step is judged.' },
    ],
  },
  {
    title: 'The tempo climbs',
    blocks: [
      { p: 'A lezginka speeds up as it goes, and so does every dance in this game. Each bar is a little shorter than the one before it, by the same amount, so the tempo rises smoothly from the first bar to the last.' },
      ...PIECES.map((p) => ({ li: `${p.name}: ${bpmRange(p)} over ${p.bars} bars.` })),
      { p: 'Learn the steps uses the same climbing tempo, and the Slow option in Watch and Learn (in the pause menu) plays a dance at three quarters of its speed.' },
    ],
  },
  {
    title: 'Learn the steps',
    blocks: [
      { p: 'Learn the steps teaches a dance in short phrases of two bars.' },
      { li: 'Listen: one bar of count-in clicks, then the teacher dances the phrase with the base groove only.' },
      { li: `Echo: you play the same phrase. If your accuracy is at least ${pct(LEARN.pass)} you move on; otherwise you get one more try (at most ${LEARN.tries} tries per phrase).` },
      { li: 'The Listen button plays the last phrase again at any time.' },
      { li: 'After the fourth phrase comes the final take: the first eight bars of the dance, with the whole band, for stars.' },
      { p: 'The metronome click in Learn can be turned off in Settings.' },
    ],
  },
  {
    title: 'Watch and Learn',
    blocks: [
      { p: 'Watch and Learn plays the whole dance by itself with the full band.' },
      { li: 'Pause stops everything at once (music, rings and dancers) and continues exactly where it stopped.' },
      { li: 'The Steps button shows the name of the figure that is being danced and its four steps for the bar, so you can think ahead.' },
      { li: 'In the pause menu you can switch the speed to three quarters, jump to the next dance, or leave.' },
    ],
  },
  {
    title: 'The five dances',
    blocks: [
      { p: 'Each dance is built from named figures of one bar each.' },
      ...PIECES.flatMap((p) => [
        { h: `${p.name}  (${p.bars} bars, ${stepCount(p)} steps)` },
        { p: `${p.blurb} Figures: ${Object.values(p.figures).map((f) => f.name).join(', ')}.` },
      ]),
    ],
  },
  {
    title: 'Controls and settings',
    blocks: [
      { li: 'Touch: tap the pads. Pause and Steps (or Listen) are the two buttons at the top right.' },
      { li: 'Keyboard: A / Left arrow, D / Right arrow, W / Up arrow, S / Down arrow for the four pads. Space or Escape pauses.' },
      { li: 'Settings: sound, note speed, timing, vibration, metronome in Learn, reduced motion and the latency of your device. Calibrate measures the latency by having you tap along to a pulse.' },
      { li: 'Text size: the A- and A+ buttons at the top of every text screen go from 100% to 300%.' },
      { li: 'Menus, these Rules, Watch and Learn, calibration and results are always free. Free to play with short ads; go ad-free once.' },
    ],
  },
  {
    title: 'What is simplified',
    blocks: [
      { p: 'This is a game of rhythm and skill inspired by the dance, not a lesson in it.' },
      { li: 'Real lezginka has many regional styles and many more steps than four; the four pads stand for the stamp, the arm lift and the turn that most styles share.' },
      { li: 'The music is original and in a steady four-beat bar (some pieces in a rolling triplet feel), written for this game and played by synthesised voices, not a transcription of a traditional tune.' },
      { li: 'You dance the part of one dancer; the dance is normally performed by a man and a woman, with the woman gliding and the man on his toes. Here the dancers who join the floor stand for that company.' },
      { li: 'Costumes and faces are stylised. Nothing in the game is a weapon or a contest.' },
    ],
  },
];
