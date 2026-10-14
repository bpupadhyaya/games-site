// All the words of the game: About, How to Play, the Rules pages. Numbers are read from moves.js (the same constants the engine uses).
// Blocks: { h: heading } { p: paragraph } { li: bullet } { fig: name, hh: height in units } { sp: space }
import { POSES, LEVELS, JUDGE, TIMING, SCORE, WEIGHT, TRIES, STARS, COMBO_STEPS, COUNT_IN, PRACTICE_SPEED, THINK, stepsOf, stepDur } from './moves.js';

const ms = (s) => `${Math.round(s * 1000)} ms`;
const pct = (v) => `${Math.round(v * 100)}%`;
const SPLIT_N = LEVELS.length;

export const ABOUT = [
  { h: 'Elastic Jump' },
  { p: 'A rhythm game about the playground game of elastic jump, also called Chinese jump rope, jump elastic or gummitwist. Two friends stretch a long loop of elastic round their ankles; a third jumps in, on and out of it in a pattern, and the band climbs a little higher after every clean round.' },
  { h: 'Where it comes from' },
  { p: 'The game is played by children in playgrounds and streets across China (where it is often called tiao pi jin, jumping the rubber band), in Europe (gummitwist in German) and in many other places, under dozens of names and with its own rhymes and rules from school to school. It needs no equipment but a stretch of elastic and a few friends, which is a good part of why it travelled so far.' },
  { h: 'This version' },
  { p: `You are the jumper. The two strands of the band run in front of you and behind you; every beat you land in one of four places: out, in, on or split. The band starts at the ankles and rises through ${SPLIT_N} heights to the neck while the beat quickens and the patterns get longer.` },
  { p: 'The routines, the beat and every sound are original and made on your device. The traditional chants are not reproduced; the real game has many more figures than the four landings used here, and the Rules pages say exactly what this version does.' },
  { h: 'Made for playing' },
  { li: 'Four big pads, or the arrow keys on a computer. One thumb is enough.' },
  { li: 'Watch and Learn plays a whole routine for you, and Practice slows the beat and forgives trips.' },
  { li: 'Large text up to 300 percent, a timing option and a latency setting. No ads. Works offline.' },
  { sp: 1 },
  { p: 'Elastic Jump is part of Arcforge, a collection of world heritage games.' },
];

export const HOWTO = [
  { h: 'Play in four steps' },
  { li: 'Pick a height on the Play screen. Start at the Ankles.' },
  { li: `Count in with the beat. Then a token slides along the cue track towards the NOW line; it shows where your feet must land.` },
  { li: 'When the token reaches the line, tap the pad with the same picture and colour. The closer to the beat, the more you score.' },
  { li: `Land cleanly through the whole routine to bring the band up to the next height. ${TRIES} trips and the round ends: try again.` },
  { h: 'The four pads' },
  ...POSES.map((p) => ({ li: `${p.label}: ${p.blurb}` })),
  { h: 'Modes' },
  { li: 'Play: the real thing, for stars and a best score. Heights open one after another.' },
  { li: `Practice: the same routine at ${pct(PRACTICE_SPEED)} speed and trips do not end the round.` },
  { li: 'Watch and Learn: the computer jumps the whole routine. You see the routine first, then a count-in. Pause it any time.' },
  { h: 'Tips' },
  { li: 'Stuck on a pattern? Tap Hint: the next four steps light up on the pads.' },
  { li: 'Feel the beat as well as seeing the tokens: the chant keeps going even when you miss.' },
  { li: 'Notes seem early or late? Open Settings and change Latency, or choose Relaxed timing.' },
  { li: 'Keyboard: arrow keys left, down, right, up are OUT, IN, ON, SPLIT (or A, S, D, F). Space pauses.' },
];

const levelTable = () => LEVELS.map((l, i) => ({ li: `${i + 1}. ${l.name}: ${l.bpm} beats a minute, a step every ${l.every === 1 ? 'beat' : `${l.every} beats`}, ${stepsOf(l).length} steps. ${l.blurb}` }));

// The Rules pages. Each page: { title, blocks }.
export const RULES = [
  {
    title: 'The band and the strands',
    blocks: [
      { p: 'Two friends stand a few steps apart with a long loop of elastic round their ankles. Seen from the side, the loop makes two long strands: the NEAR strand (in front of the jumper) and the FAR strand (behind). The jumper stands beside the loop and lands between, on and outside the strands.' },
      { fig: 'plan', hh: 260 },
      { p: 'The pictures on the pads and tokens are a plan view, as if you looked down from above: the two lines are the strands, the dark footprints show where the feet land.' },
      { p: 'The holders never move and cannot be hit. Everything you control is where the jumper lands, and when.' },
    ],
  },
  {
    title: 'The four landings',
    blocks: [
      { fig: 'poses', hh: 230 },
      ...POSES.map((p) => ({ li: `${p.label}: ${p.blurb}` })),
      { p: 'Each landing has its own colour: OUT blue, IN green, ON orange, SPLIT purple. Pads, tokens and the jumper all use the same pictures.' },
      { p: 'The jumper may start from any landing: a step is judged only by the landing you tap, not by the one before it.' },
    ],
  },
  {
    title: 'The heights',
    blocks: [
      { fig: 'heights', hh: 330 },
      { p: `The band rises through ${LEVELS.length} heights. Each height has its own routine, a fixed list of steps that is the same every time, so you can learn it.` },
      ...levelTable(),
      { p: 'A higher band changes how the jump looks (bigger jumps, a longer ponytail) and, in this game, how long and quick the routine is. It does not change the timing windows.' },
    ],
  },
  {
    title: 'The beat and the cue track',
    blocks: [
      { fig: 'track', hh: 210 },
      { p: `Every height starts with a count-in of ${COUNT_IN} beats (3, 2, 1, JUMP). The first step is on the fifth beat.` },
      { p: 'Steps are on the beat. At the first two heights a step comes every second beat; from the Knees on there is a step on every beat.' },
      { p: 'A token for each coming step slides along the cue track towards the NOW line. When the token is on the line, it is exactly the beat. The tokens show what to land and the numbers on the line count the beats.' },
      { p: 'The routines are made of four-step phrases that repeat in patterns such as A A B A. Learning a phrase once is enough to play it every time it returns.' },
    ],
  },
  {
    title: 'Timing and judging',
    blocks: [
      { fig: 'timing', hh: 190 },
      { p: `Each step has a window around its beat. In Normal timing, Perfect within ${ms(JUDGE.perfect)}, Good within ${ms(JUDGE.good)}, Okay within ${ms(JUDGE.ok)}, either side of the beat.` },
      { p: `Relaxed makes every window ${pct(TIMING[0].k)} of that; Strict makes them ${pct(TIMING[2].k)}.` },
      { p: 'A tap is given to the nearest step that has not been judged yet and is inside its timing window; a tap that lands outside every window is ignored by the judge (the jumper still jumps).' },
      { p: 'If the landing is wrong, the step is a trip, whatever the timing. If nothing is tapped before the window closes, the step is also a trip.' },
      { p: 'Latency in Settings shifts every tap time, for phones and headphones that delay sound.' },
    ],
  },
  {
    title: 'Trips',
    blocks: [
      { p: 'A trip is a step that is missed or landed in the wrong place. The jumper stumbles, the band wobbles and the combo falls back to nothing.' },
      { p: `In Play you may trip ${TRIES - 1} times and carry on. Trip number ${TRIES} ends the round: the band comes down and you can try the height again at once.` },
      { p: 'In Practice trips are counted but never end the round, and the beat is slower.' },
      { p: 'In Watch and Learn the computer does not trip.' },
    ],
  },
  {
    title: 'Score, combo, stars',
    blocks: [
      { p: `Each step scores ${SCORE.perfect} for Perfect, ${SCORE.good} for Good and ${SCORE.ok} for Okay. A trip scores nothing.` },
      { p: `The combo counts clean steps in a row. It multiplies the points: x2 from ${COMBO_STEPS[1]}, x3 from ${COMBO_STEPS[2]}, x4 from ${COMBO_STEPS[3]}.` },
      { p: `Accuracy is the average of the steps: Perfect counts ${pct(WEIGHT.perfect)}, Good ${pct(WEIGHT.good)}, Okay ${pct(WEIGHT.ok)}, a trip nothing. Finishing the routine always earns a star; ${pct(STARS[1])} accuracy earns two and ${pct(STARS[2])} earns three. (Below ${pct(STARS[0])} the round still counts as finished, with one star.)` },
      { p: 'The grade letter S, A, B, C or D comes from the same accuracy: S from 97%, A 90%, B 78%, C 55%.' },
      { p: 'Your best score and best stars for each height are kept on the device.' },
    ],
  },
  {
    title: 'Play and unlocking',
    blocks: [
      { p: 'Heights open in order: finish one routine (with any number of stars) to open the next. The first height is open from the start.' },
      { p: 'You can replay any open height. Only a finished routine in Play counts for your bests; Practice and Watch and Learn never change them.' },
      { p: 'Watch and Learn can show any height, even a locked one, so you can see what is coming.' },
    ],
  },
  {
    title: 'Practice',
    blocks: [
      { p: `Practice plays the routine at ${pct(PRACTICE_SPEED)} of the speed, so the steps come ${pct(1 / PRACTICE_SPEED - 1)} further apart. Trips never end the round and no stars or bests are recorded.` },
      { p: 'Use it to learn a new landing or a quick change, then go back to Play at full speed.' },
    ],
  },
  {
    title: 'Watch and Learn and Hint',
    blocks: [
      { p: `Watch and Learn plays one whole routine for you. It has three parts: THINK, REVEAL and ACT. During THINK (${THINK.def} seconds by default, ${THINK.min} to ${THINK.max} in Settings) the whole routine is laid out as a strip of tokens so you can read it. During REVEAL (${THINK.reveal} seconds) the tokens light up one by one with their names. Then the count-in starts and the jumper performs it.` },
      { p: 'Pause stops everything, even the sounds and the jumper in mid-air, and carries on from exactly the same moment. Skip THINK with the Skip button.' },
      { p: 'The computer jumper lands a little before or after the beat, like a person, and it never trips. Watch and Learn does not use up the free preview.' },
      { p: 'In Play and Practice, Hint lights the pads for the next four steps and writes their names on the tokens. It costs nothing and never changes the score.' },
    ],
  },
  {
    title: 'Controls',
    blocks: [
      { li: 'Touch: tap a pad. The pads are as big as the screen allows, along the bottom in portrait and in a 2 by 2 block on the right in landscape.' },
      { li: 'Keyboard: arrow left = OUT, arrow down = IN, arrow right = ON, arrow up = SPLIT. A, S, D, F do the same.' },
      { li: 'Space or Escape pauses. In the pause menu you can resume, restart or leave.' },
      { li: 'Text size: the A- and A+ buttons on every text screen, up to 300 percent.' },
      { li: 'The screen turns freely between portrait and landscape; a round in progress carries on.' },
    ],
  },
  {
    title: 'What is simplified',
    blocks: [
      { p: 'In the playground the holders move the band up the body at their own pace, the jumper chooses from a large list of figures that differs from place to place, and the game is also played with rhymes and forfeits. This version keeps the idea (a band that climbs and a set of landings you must do in order, in time) and simplifies the rest:' },
      { li: 'Four landings instead of the full list of figures.' },
      { li: `${LEVELS.length} fixed heights with fixed routines, not a choice of the holders.` },
      { li: 'The beat and the rhythm of the steps are set by the game; there are no traditional chants.' },
      { li: 'The step durations in seconds at each height: ' + LEVELS.map((l) => `${l.name} ${stepDur(l).toFixed(2)} s`).join(', ') + '.' },
    ],
  },
];
