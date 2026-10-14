// Text of How to play, Game Rules and About. Every number here is the engine's own (engine.js); the test reads these constants.
import { SEATS, RUNNERS, BATCHES, INNINGS, HINTS, LEVELS, HINT_FREEZE } from './engine.js';

const NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
export const num = (n) => NUM[n] ?? String(n);
const lvNames = LEVELS.map((l) => `${l.name} (${l.limit} seconds a batch)`).join(', ');
export const MAX_POINTS = RUNNERS * BATCHES * INNINGS;

export const HOWTO = [
  { name: 'The idea', illus: 'court', items: [
    { t: `Kho-Kho is a chase game from South Asia. ${num(SEATS)} chasers sit on the central lane, each one facing one side of the court, the next one the other side. A ninth chaser is on his feet and runs. His job is to touch ${num(RUNNERS)} runners before the clock runs out.` },
    { t: 'You play both sides: first you chase, then you steer the runners.' },
  ] },
  { name: '1. Chasing: run and read', items: [
    { t: 'TAP or DRAG on the court and your standing chaser runs to that spot. Touch a runner to put them out. Runners dodge on their own.' },
    { t: 'You cannot cross the central lane, and you can never turn back: once you run up the court you cannot run down it again. Left and right are free on your own half.' },
  ] },
  { name: '2. Kho: hand over the chase', illus: 'kho', items: [
    { t: 'To change direction or side, give KHO. Run to the BACK of a seated chaser (the side he is not facing) and tap him, or press the KHO button. He jumps up and runs on the side he was facing. You sit down in his place.' },
    { t: 'Seats glow when you are close enough. Because neighbours face opposite ways, the next seat along always turns the chase round.' },
  ] },
  { name: '3. Chain the chase', illus: 'lock', items: [
    { t: 'Runners will slip across the lane to your blind side. That is when you hand over: run to the lane, give Kho and the new chaser starts level with them. Cut off, do not follow.' },
    { t: 'Round either pole at the ends of the lane you may cross the court and turn back, but it is a long way. Kho is faster.' },
  ] },
  { name: '4. Running: your turn to be chased', items: [
    { t: `After your chase the sides swap. TAP a runner to pick it, then TAP or DRAG where it should go. The other runners look after themselves, so use NEXT to switch runners when one is in trouble. You can cross the lane freely: that is a runner's best trick.` },
    { t: 'A runner that is touched is out. Stay on the court: stepping off is not allowed here, the edge simply stops you.' },
  ] },
  { name: 'Scoring and help', items: [
    { t: `Each batch has ${num(RUNNERS)} runners and a time limit. Every runner you touch is one point. ${num(BATCHES)} batches make a turn and ${num(INNINGS)} turns each make the match: ${MAX_POINTS} points are possible for each side.` },
    { t: `HINT stops the clock for ${HINT_FREEZE.toFixed(1)} seconds and shows what the computer would do. You have ${num(HINTS)} hints in a match.` },
  ] },
  { name: 'Keyboard', items: [
    { t: 'Arrow keys run your player. Space gives Kho. In the running turn, 1 to 3 pick a runner and Tab picks the next. H is a hint, P pauses Auto Play.' },
  ] },
];

export const RULES = [
  { name: 'The goal', items: [
    { t: `Two teams of nine take turns. In a turn one team CHASES: ${num(SEATS)} of its players sit on the central lane and the ninth runs. The other team's RUNNERS come on ${num(RUNNERS)} at a time and try not to be touched until the time is up.` },
    { t: `You chase for ${num(BATCHES)} batches, then run for ${num(BATCHES)} batches, and the match has ${num(INNINGS)} such innings. The side that touches more runners wins. If both sides are level, the side that needed less total time on its touches wins.` },
  ] },
  { name: 'The court', illus: 'court', items: [
    { t: `The court is a rectangle. A narrow central lane runs down its length. ${num(SEATS).replace(/^./, (c) => c.toUpperCase())} seats sit along the lane, the chasers on them facing sideways, alternate seats facing opposite halves.` },
    { t: 'At each end of the lane, beyond the last seat, is a pole and a free zone. Only in the free zones may the running chaser cross from one half to the other.' },
  ] },
  { name: 'The running chaser', items: [
    { t: 'The standing chaser runs wherever you point, at one speed, but with a few rules. He cannot enter the central lane. He cannot cross to the other half except in a free zone. And he cannot turn back: after he commits to running up or down the court, any move that would take him back the other way is ignored until he hands over the chase or goes round a pole.' },
    { t: 'He touches a runner by getting within reach of one on the same half. A runner standing on the lane itself can be touched from either side.' },
  ] },
  { name: 'Kho', illus: 'kho', items: [
    { t: 'Kho is the hand-over. The running chaser must be at the back of a seated chaser: next to the lane, level with his seat, on the side he is not facing. The seated chaser stands up and becomes the runner; the old runner takes his seat, facing the same way.' },
    { t: 'The new runner is free again: the no-turning-back rule starts afresh, and he starts on the half the seat faced. That is how a chase changes sides.' },
    { t: 'Kho cannot be given from the free zones, because there is no seat there.' },
  ] },
  { name: 'Runners', items: [
    { t: `${num(RUNNERS)} runners are on the court in each batch. They run anywhere on the court, they may cross the lane between the seats and they can turn at once. The computer steers the runners while you chase.` },
    { t: 'A runner is out when touched. The batch ends when all three are out or the clock runs out; runners still free at the end count as safe.' },
  ] },
  { name: 'Your turn to run', items: [
    { t: 'When the computer chases, you steer ONE runner at a time: the picked runner, marked by a ring. TAP another runner or press NEXT to pick it. The others dodge on their own. The computer chases with the same rules as you do.' },
  ] },
  { name: 'Points and levels', items: [
    { t: `Every runner touched is one point, so a batch is worth up to ${num(RUNNERS)}. The match has ${num(BATCHES * INNINGS)} batches of chasing for each side: ${MAX_POINTS} points at most.` },
    { t: `There are three levels: ${lvNames}. On a higher level the runners are faster and read your chase better, and the computer's chaser is faster and cuts corners better.` },
  ] },
  { name: 'Hint, Pause and Auto Play', items: [
    { t: `HINT freezes the court for ${HINT_FREEZE.toFixed(1)} seconds and shows what the computer would do: where to run, or which seat to give Kho to. You have ${num(HINTS)} in a match.` },
    { t: 'Auto Play (Watch and Learn) lets the computer chase one batch on the Village court. Before every decision the game stops for a think time, shows the choice, then runs it for a few seconds. You can pause, skip and change the think time.' },
  ] },
  { name: 'How this game simplifies the sport', items: [
    { t: 'In the real sport a team has nine players on the field, a match has two innings of two turns, and a turn lasts several minutes. Here a batch is three runners and about half a minute, so a whole match fits in a few minutes.' },
    { t: 'The real game has further rules about when a chaser may touch and how a seated chaser must sit; this version keeps the tag rules only, and the hand-over is one simple tap.' },
  ] },
];

export const ABOUT = [
  { name: 'Kho-Kho', items: [
    { t: 'Kho-Kho is a traditional tag sport of South Asia, played in schools, villages and leagues in India, Nepal, Bangladesh and Sri Lanka. It is played on bare ground with nothing but two wooden poles.' },
    { t: 'Its heart is a relay: the chasers do not simply follow the runners, they pass the chase to each other with a tap and the word Kho, so the chase turns round in a heartbeat.' },
    { t: 'This version seen from above keeps that idea and turns it into a game of reading, cutting off and timing.' },
  ] },
  { name: 'Credits', items: [
    { t: 'Made by Arcforge, from the World Heritage Games series. Display type: Dela Gothic One. Text: Barlow. Both are open fonts under the SIL Open Font License.' },
    { t: 'All art and sound are drawn and made in the game. There are no ads. Your best results are kept on this device.' },
  ] },
];

export const flowOf = (sc) => (sc === 'rules' ? RULES : sc === 'about' ? ABOUT : HOWTO);
