// All the words of the game: About, How to Play, the Rules pages. Numbers are read from engine.js (the same constants the engine uses).
// Blocks: { h: heading } { p: paragraph } { li: bullet } { fig: name, hh: height in units } { sp: space }
import { TUNE, neededLean, roundPoints } from './engine.js';

const pct = (v) => `${Math.round(v * 100)}%`;
const bars = TUNE.bars;
const first = pct(bars[0]), last = pct(bars[bars.length - 1]);
const leanFor = (i) => pct(neededLean(bars[i], 0));

export const ABOUT = [
  { h: 'Limbo' },
  { p: 'Lean back, shuffle forward and slide under a bar that drops lower every round, without touching it and without falling. One thumb is all it takes: drag down to lean, drag sideways to keep your balance.' },
  { h: 'Where it comes from' },
  { p: 'Limbo is a dance and a game from Trinidad and Tobago, where it grew up at beach parties and on stage, and from there it travelled across the Caribbean and the world. A dancer leans backwards, knees bent and hips forward, and passes under a horizontal bar that is lowered after each turn. Anyone can try it, and nobody ever manages the last notch easily.' },
  { p: 'This game is an original, simplified take on that tradition. The beach, the dancers and the music are all drawn and synthesised for this game; no real performers or recordings are used.' },
  { h: 'How it sounds and looks' },
  { p: 'Every sound, including the steel-pan-style tune, is synthesised on your device while you play. The beach, the crowd and the dancers are drawn in real time. Four different dancers take turns in party mode.' },
  { h: 'Made for playing' },
  { li: 'One thumb on a phone, or the arrow keys on a computer.' },
  { li: 'Think slows time for a moment and shows how deep a lean the bar needs.' },
  { li: 'Watch and Learn plays a whole game for you and explains each choice. Pause it at any time.' },
  { li: 'Party mode: two to four friends pass one phone around, one by one.' },
  { li: 'Large text and reduced-motion options. Works offline.' },
  { sp: 1 },
  { p: 'Limbo is part of Arcforge, a collection of world heritage games.' },
];

export const HOWTO = [
  { h: 'Play in four steps' },
  { li: 'Press and hold anywhere to start. The dancer shuffles toward the bar to the beat.' },
  { li: 'Drag your thumb DOWN from where it landed to lean back. The lean gauge fills; the deeper the lean, the lower you can go.' },
  { li: 'Drag SIDEWAYS to steer the balance bubble back to the middle. Lean too long and it drifts faster.' },
  { li: 'Get all the way under, head last, without touching the bar or toppling. Then the bar goes lower.' },
  { h: 'Modes' },
  { li: `Solo: a bar from ${first} of your height down to ${last}. You have ${TUNE.tries} misses for the whole game.` },
  { li: 'Party: two to four players take turns on the same bar. Touch the bar and you are out. The last one standing wins.' },
  { li: 'Practice: pick any bar height and try as often as you like.' },
  { li: 'Watch and Learn: the computer plays a game and explains each choice before it acts.' },
  { h: 'Tips' },
  { li: 'Lean late: start leaning just before the knees reach the bar, and stand up once your head is past.' },
  { li: 'A deep lean wobbles more. Do not lean deeper than the bar needs.' },
  { li: 'Stuck? Tap Think. Time slows down and the gauge shows how deep a lean is enough.' },
  { li: 'Keyboard: Space starts, Down leans, Left and Right steer, H is Think, Escape pauses.' },
];

export const RULES = [
  {
    title: 'The bar',
    blocks: [
      { p: 'The dancer starts on the left and walks toward the bar. To clear a round, every part of the body must pass under the bar, one after the other: knees, hips, chest, and last of all the head.' },
      { fig: 'ladder', hh: 160 },
      { p: `The bar is set as a percentage of the dancer's standing height. There are ${bars.length} heights, from ${first} down to ${last}. After a cleared round it drops to the next one. Beyond the last height the bar stays where it is and the dancer walks a little faster each round.` },
      { li: 'Touching the bar with any part of the body (head, back, hips or knees) ends the attempt. The bar is knocked off.' },
      { li: 'Arms do not count; they are held out for balance.' },
      { li: `A graze of about ${pct(TUNE.grace)} of the dancer's height is forgiven.` },
      { li: 'Toppling over, forward or backward, also ends the attempt.' },
    ],
  },
  {
    title: 'Leaning',
    blocks: [
      { p: 'Your thumb sets how far the dancer leans. Drag down from the point where you first touched; a drag of about two centimetres is a full lean. Lift your thumb or drag back up to stand.' },
      { fig: 'leans', hh: 330 },
      { li: `The body cannot change instantly: it bends at most ${TUNE.leanUp.toFixed(1)} full leans per second and straightens at ${TUNE.leanDown.toFixed(1)}.` },
      { li: `Leaning slows the walk by up to ${pct(TUNE.slowByLean)} at full lean.` },
      { li: `Roughly: a bar at ${pct(bars[2])} needs a lean of ${leanFor(2)}; at ${pct(bars[6])} about ${leanFor(6)}; at ${last} about ${leanFor(bars.length - 1)}.` },
    ],
  },
  {
    title: 'Balance',
    blocks: [
      { p: 'Under the dancer a bubble shows the balance. In the middle is safe. The bubble drifts, and the deeper you lean the faster and the rougher it drifts. Drag your thumb sideways to push it back.' },
      { fig: 'balance', hh: 130 },
      { li: 'The bubble to the right means tipping forward: the dancer stands up and may hit the bar with the head. To the left means tipping backward.' },
      { li: `At the very ends (${pct(TUNE.fallAt)}) the dancer topples and the attempt is over.` },
      { li: 'Upright, the bubble settles by itself. Leaning is what makes it drift, so lean late and only as deep as you need.' },
      { li: 'The drift is a different pattern on every attempt, and the later rounds are rougher.' },
    ],
  },
  {
    title: 'Solo scoring',
    blocks: [
      { p: `In Solo you play from the first bar and have ${TUNE.tries} misses for the whole game. A miss repeats the same height; the game ends when the last miss is used.` },
      { li: `Each cleared round scores a base of ${roundPoints(0, { clearance: 1, balance: 0 }).base} points plus ${20} for each earlier round.` },
      { li: `Narrow-clearance bonus: up to 60 points for passing within a hair of the bar (it fades to nothing at a gap of 8% of the dancer's height).` },
      { li: 'Steady-balance bonus: up to 40 points for keeping the bubble close to the middle.' },
      { li: 'Your best score and highest cleared bar are saved on the device.' },
    ],
  },
  {
    title: 'Party',
    blocks: [
      { p: 'Two to four players share the phone and take turns on the same bar. Each player has their own dancer.' },
      { li: 'Everyone still in plays the current bar once, in order. A player who touches the bar or topples is out.' },
      { li: 'When a round leaves exactly one player in, that player wins.' },
      { li: 'If everyone left misses in the same round, they all share the win.' },
      { li: 'Party games are score-only: there are no stakes, only bragging rights.' },
    ],
  },
  {
    title: 'Practice and Watch and Learn',
    blocks: [
      { p: 'Practice: choose any bar height with the stepper and try as many times as you like. Nothing is saved except that the game remembers your last choice.' },
      { p: `Watch and Learn: the computer plays ${TUNE.autoRounds} rounds. Before each one it THINKS (you can change how long in Settings, 1 to 10 seconds), then REVEALS the lean it will use on the gauge, then ACTS. Tap Skip to move on. You can Pause at any time; everything stops exactly where it is.` },
      { p: `Think (your own button): for ${TUNE.thinkSeconds} seconds time runs at ${pct(TUNE.thinkScale)} speed and the lean gauge marks the zone that is deep enough. It recharges in ${TUNE.thinkCooldown} seconds (no wait in Practice).` },
    ],
  },
  {
    title: 'Controls, privacy and simplifications',
    blocks: [
      { li: 'Touch: press and hold to begin, then drag down to lean and sideways to steer. Lifting the thumb stands the dancer up.' },
      { li: 'Keyboard: Space or Enter begins, Down or S leans, Left and Right steer, H is Think, Escape pauses.' },
      { li: 'Text size: the A- and A+ buttons on every text page go up to 300%.' },
      { h: 'What is simplified' },
      { p: 'Real limbo is danced in three dimensions with the bar held at both ends. Here the dancer is seen from the side, the walk is automatic, and the only things you control are the lean and the balance. Real limbo has no scoring; the points are only there to give you something to beat.' },
      { p: 'Limbo does not collect any personal data.' },
    ],
  },
];
