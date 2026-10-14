// All the words of the game: About, How to Play, the Rules pages. Numbers are read from moves.js (the same constants the engine uses).
// Blocks: { h: heading } { p: paragraph } { li: bullet } { fig: name, hh: height in units } { sp: space }
import { TRICKS, LEVELS, JUDGE, TIMING, SCORE, WEIGHT, LIVES, STARS, STYLE_SHARE, COMBO_STEPS, COUNT_IN, PRACTICE_SPEED, THINK, AIR, CLEAR_MARGIN, SWIPE, beatsOf, beatDur } from './moves.js';

const ms = (s) => `${Math.round(s * 1000)} ms`;
const pct = (v) => `${Math.round(v * 100)}%`;
const N = LEVELS.length;

export const ABOUT = [
  { h: 'Double Dutch' },
  { p: 'A rhythm game about double dutch, the street game of jumping between two ropes that are turned in opposite directions. Two friends turn, one jumps; the ropes meet the pavement one after the other, and the jumper hops in time, adds tricks and keeps the streak going as the beat gets faster.' },
  { h: 'Where it comes from' },
  { p: 'Rope jumping with two ropes is commonly traced back to Dutch settlers in New Amsterdam, the settlement that became New York. Over the following centuries it became a street game of the city, played above all by girls on stoops and sidewalks, with its own rhymes, speed contests and tricks passed from one block to the next. From the 1970s it also became an organised sport, with leagues, school programmes and world championships.' },
  { p: 'It is a living tradition of the United States and of the African American communities of its cities in particular, and this game is made with respect for that. It needs only two ropes and three friends, which is a good part of why it spread so far.' },
  { h: 'This version' },
  { p: `You are the jumper. The two ropes turn in front of you and behind you; every beat one of them touches the pavement and you must be in the air. Tap to hop. When a call appears, swipe the matching way during the hop to add a tuck, a spin, a kick or a touch down. ${N} blocks, from the stoop to the final round, get quicker and longer, and the ropes snap to double speed on pepper beats.` },
  { p: 'The beat, the routines and every sound are original and made on your device. The traditional rhymes are not reproduced; the Rules pages say exactly what this version simplifies.' },
  { h: 'Made for playing' },
  { li: 'One thumb: tap anywhere to hop, swipe for a trick. Space and the arrow keys work on a computer.' },
  { li: 'Watch and Learn plays a whole routine for you, and Practice slows the beat and forgives tangles.' },
  { li: 'Large text up to 300 percent, a timing option and a latency setting. Works offline.' },
  { sp: 1 },
  { p: 'Double Dutch is part of Arcforge, a collection of world heritage games.' },
];

export const HOWTO = [
  { h: 'Play in four steps' },
  { li: 'Pick a block on the Play screen. Start at the Stoop.' },
  { li: `Count in with the ropes: ${COUNT_IN} beats while your jumper walks into the middle.` },
  { li: 'Watch the ropes. The moment one reaches the pavement, you should be in the air: tap a little before that, so the top of your hop is on the beat.' },
  { li: `Hop on every pass. A rope that catches your feet is a tangle; ${LIVES} tangles and the round ends.` },
  { h: 'Calls and tricks' },
  { li: 'A chalk card above your head shows the next call with its arrow. Swipe that way during the hop for bonus points.' },
  ...TRICKS.map((t) => ({ li: `${t.name}: ${t.blurb}` })),
  { li: 'A missed call costs no life: it only loses the bonus and counts against your style.' },
  { h: 'Pepper' },
  { li: 'On a pepper beat the ropes pass twice in the same beat. The hop gets shorter and quicker: stay light and keep tapping with them.' },
  { h: 'Modes' },
  { li: 'Play: the real thing, for stars and a best score. Blocks open one after another.' },
  { li: `Practice: the same routine at ${pct(PRACTICE_SPEED)} speed and tangles do not end the round.` },
  { li: 'Watch and Learn: the computer jumps a whole routine. You read the routine first, then see it jumped. Pause any time.' },
  { h: 'Tips' },
  { li: 'Stuck on timing? Tap Guide: a ring closes on your feet at the moment to tap.' },
  { li: 'Listen as well as look: the rope slap is the beat, and the speaker on the curb pulses with it.' },
  { li: 'Taps feel early or late? Open Settings and change Latency, or choose Relaxed timing.' },
  { li: 'Keyboard: Space hops; the arrow keys hop with a trick (up tuck, left spin, right kick, down touch down). P or Escape pauses.' },
];

const levelTable = () => LEVELS.map((l, i) => {
  const b = beatsOf(l), calls = b.filter((c) => 'ulrd'.includes(c)).length, pep = b.filter((c) => c === 'p').length;
  return { li: `${i + 1}. ${l.name}: ${l.bpm} beats a minute, ${b.length} beats, ${calls} calls${pep ? `, ${pep} pepper beats` : ''}. ${l.blurb}` };
});

// The Rules pages. Each page: { title, blocks }.
export const RULES = [
  {
    title: 'The street and the ropes',
    blocks: [
      { fig: 'side', hh: 330 },
      { p: 'Two friends, the turners, stand a few steps apart. Each holds one end of both ropes. You, the jumper, stand in the middle between them.' },
      { p: 'The two ropes turn in opposite directions. Rope A (amber) turns on the camera side of you and rope B (blue) on the far side, so you can always tell them apart.' },
      { p: 'The turners are not controlled by the player and cannot be hit. Everything you control is when you hop and which trick you add.' },
    ],
  },
  {
    title: 'The beat of the ropes',
    blocks: [
      { fig: 'cycle', hh: 190 },
      { p: 'A rope touches the pavement once every time it goes round. The ropes are half a turn apart, so on a plain beat exactly one rope reaches the pavement, A on one beat and B on the next. That touch is the PASS, and it is what you must hop over.' },
      { p: `Every height starts with a count-in of ${COUNT_IN} beats (the ropes already turn, the first four passes do not count). Your jumper walks into the middle during the count-in.` },
      { p: 'Each rope also goes over your head once per turn. That is only for the picture: the pass to hop is the one at the pavement.' },
    ],
  },
  {
    title: 'Hopping',
    blocks: [
      { p: 'Tap anywhere on the screen (or press Space) to hop. The hop lasts a short moment; the rope must reach the pavement while you are in the air.' },
      { p: `The air time of a hop is the gap to the neighbouring pass times ${AIR.k}, between ${ms(AIR.min)} and ${ms(AIR.max)}. On plain beats it is the long hop; on pepper beats, where the passes come twice as fast, it is the short one.` },
      { p: `The best moment is when the top of your hop is on the beat, so tap about half an air time early. A hop counts for the nearest pass that nobody has hopped yet, as long as the pass lands inside the hop (a margin of ${ms(CLEAR_MARGIN)} each end for your shoes).` },
      { p: 'You cannot start a new hop while you are still going up or hanging at the top of one; the tap is ignored until you are on the way down. Hopping at nothing does not cost a life, but it breaks your streak.' },
    ],
  },
  {
    title: 'Timing and judging',
    blocks: [
      { fig: 'timing', hh: 190 },
      { p: `In Normal timing: Perfect when the top of your hop is within ${ms(JUDGE.perfect)} of the rope touching the pavement, Good within ${ms(JUDGE.good)}, and Okay for anything still inside the hop.` },
      { p: `Relaxed makes the Perfect and Good windows ${pct(TIMING[0].k)} as wide; Strict makes them ${pct(TIMING[2].k)}. On pepper beats the Okay window is narrower, because the hop is shorter.` },
      { p: 'If no hop covers a pass when it reaches the pavement, the rope catches your feet: a tangle.' },
      { p: 'Latency in Settings shifts every tap time, for phones and headphones that delay the sound.' },
    ],
  },
  {
    title: 'Calls and tricks',
    blocks: [
      { fig: 'tricks', hh: 440 },
      { p: 'Some passes carry a call. About two beats before it, a chalk card with the trick and its arrow appears above your jumper, and the pass is marked on the rope strip with the same arrow tile.' },
      { fig: 'swipes', hh: 320 },
      ...TRICKS.map((t) => ({ li: `${t.name}: ${t.blurb}` })),
      { p: `To add a trick, drag your finger in that direction within ${SWIPE.window} seconds of the tap (at least ${SWIPE.dist} units). On a keyboard the arrow key hops and does the trick in one press.` },
      { p: 'A trick counts if it matches the call of the pass you hopped. A different trick, or none, still clears the pass (the hop decides that) but scores no bonus and counts as a missed call.' },
    ],
  },
  {
    title: 'Pepper',
    blocks: [
      { p: 'A pepper beat holds two passes half a beat apart: the turners snap to double speed for that beat, then settle again. A, B in quick succession, then the plain beat goes on.' },
      { p: 'There are no calls on pepper passes, so you can put all your attention on keeping the hops quick and light.' },
      { p: 'Two quick hops are needed. Because the hop is short while the ropes are quick, a late hop and an early hop cost the same: the margins are smaller than on plain beats.' },
    ],
  },
  {
    title: 'Tangles and lives',
    blocks: [
      { p: 'A tangle is a pass with no hop over it. The jumper stumbles, the rope flashes white and your streak falls back to nothing.' },
      { p: `In Play you have ${LIVES} coils. The ${LIVES}th tangle ends the round: try the block again at once.` },
      { p: 'In Practice tangles are counted but never end the round, and the beat is slower.' },
      { p: 'In Watch and Learn the computer jumper never tangles.' },
    ],
  },
  {
    title: 'Score, streak, stars',
    blocks: [
      { p: `Each hop scores ${SCORE.perfect} for Perfect, ${SCORE.good} for Good and ${SCORE.ok} for Okay. A successful call adds ${SCORE.trick}.` },
      { p: `The streak counts passes cleared in a row (a trick keeps it going). It multiplies the points: x2 from ${COMBO_STEPS[1]}, x3 from ${COMBO_STEPS[2]}, x4 from ${COMBO_STEPS[3]}. A tangle, a missed call or a stray hop sets it back to nothing.` },
      { p: `Accuracy is the average over the passes: Perfect counts ${pct(WEIGHT.perfect)}, Good ${pct(WEIGHT.good)}, Okay ${pct(WEIGHT.ok)}, a tangle nothing. Style is the share of calls you did. The result is accuracy, with ${pct(STYLE_SHARE)} of it given to style on blocks that have calls.` },
      { p: `A finished routine always earns a star; ${pct(STARS[1])} earns two and ${pct(STARS[2])} earns three. The grade S, A, B, C or D comes from the same result: S from 97%, A 90%, B 78%, C 55%.` },
      { p: 'Your best score and best stars for each block are kept on the device.' },
    ],
  },
  {
    title: 'The eight blocks',
    blocks: [
      { fig: 'levels', hh: 380 },
      { p: `Blocks open in order: finish one routine, with any number of stars, to open the next. Every block has a fixed routine, the same each time, built from eight-beat phrases that come back (A B A B ...), so you can learn it.` },
      ...levelTable(),
      { p: `The beat of a block, in seconds a beat at Normal speed: ${LEVELS.map((l) => `${l.name} ${beatDur(l).toFixed(2)}`).join(', ')}.` },
    ],
  },
  {
    title: 'Play, Practice, Watch and Learn',
    blocks: [
      { p: 'Play is the real thing: stars and bests, and the ropes tangle three times at most. Only a finished routine in Play counts for the bests.' },
      { p: `Practice plays the routine at ${pct(PRACTICE_SPEED)} of the speed. Tangles never end the round and nothing is recorded.` },
      { p: `Watch and Learn plays one whole routine for you in three parts: THINK, REVEAL and ACT. During THINK (${THINK.def} seconds by default, ${THINK.min} to ${THINK.max} in Settings) the whole routine is laid out as a sheet of marks so you can read it; during REVEAL (${THINK.reveal} seconds) the marks light up one by one; then the count-in starts and the computer jumper performs it. Skip THINK with the Skip button.` },
      { p: 'Pause stops everything, even the ropes in mid-turn and the jumper in mid-air, and carries on from exactly the same moment. Watch and Learn does not use up the free preview, and it can show any block, even a locked one.' },
      { p: 'In Play and Practice, Guide closes a ring on the jumper\'s feet at the moment to tap, and names the next call. It costs nothing and never changes the score.' },
    ],
  },
  {
    title: 'Controls',
    blocks: [
      { li: 'Touch: tap anywhere on the screen to hop; swipe up, left, right or down for a trick. The big HOP pad is only a guide.' },
      { li: 'Keyboard: Space hops; arrow up, left, right, down hop with the trick.' },
      { li: 'P or Escape pauses. In the pause menu you can resume, restart or leave.' },
      { li: 'Text size: the A- and A+ buttons on every text screen, up to 300 percent.' },
      { li: 'Settings: sound, timing, latency, think time, reduced motion and, in the app, Restore purchase to get a bought game back on a new device.' },
      { li: 'The screen turns freely between portrait and landscape; a round in progress carries on.' },
    ],
  },
  {
    title: 'What is simplified',
    blocks: [
      { p: 'In the street the jumper runs in and out of the ropes at a chosen moment, the turners change speed and direction, and the game goes with rhymes, counting and many more tricks than four. This version keeps the idea (two ropes, a beat, tricks on the hop, a quickening pace) and simplifies the rest:' },
      { li: 'The jumper walks in during the count-in and stays in the ropes to the end; entering and leaving are not played.' },
      { li: 'Four tricks instead of the full repertoire, and the same four for every jumper.' },
      { li: 'A fixed routine for each block and a steady beat, with pepper beats as the only change of speed. No traditional rhymes are used.' },
      { li: 'Everything is judged by timing only; style is the calls you land, never a judge\'s opinion.' },
    ],
  },
];
