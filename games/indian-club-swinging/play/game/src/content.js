// Text screens: About, How to Play and the paged Rules reference. Numbers come from moves.js so the text cannot drift from the engine.
// Blocks: { h } heading, { p } paragraph, { li } bullet, { fig: name, hh: height } a figure drawn with the game's own art, { sp } gap.
import { MOVES, MOVE_ORDER, ROUTINES, JUDGE, SCORE, FLOW, STAR_AT, TIMING, WEIGHT, THINK_TIMES, GAP_BEATS, COUNT_IN } from './moves.js';

const pct = (v) => `${Math.round(v * 100)}%`;
const tm = (id) => TIMING.find((t) => t.id === id).k;

export const ABOUT = [
  { h: 'Indian club swinging' },
  { p: 'Heavy wooden clubs swung in wide, steady circles are part of the training tradition of South Asian wrestling gyms (akharas). One heavy club is a mugdar, a pair is a jori; in Persian and Pakistani usage they are also called meels. The same patient circles later became a physical-culture practice in many countries.' },
  { p: 'This game is a quiet, finger-sized version of the rhythm of it: you trace a path round the pad while two weighty clubs follow, and you try to stay with the marker, move after move, keeping the flow going.' },
  { h: 'What it is about' },
  { li: 'Timing: the marker keeps an even pulse and each move changes on the beat.' },
  { li: 'Anticipation: the clubs have weight, so you lead them a little rather than chase them.' },
  { li: 'Smoothness: long, round movements score better than jerks.' },
  { h: 'In the app' },
  { li: 'Six routines and a new daily routine, each a chain of moves at its own tempo.' },
  { li: 'Practice: drill one move at any tempo from 40 to 110 beats per minute.' },
  { li: 'Watch and Learn: a computer swinger shows the first four moves of a routine with time to think, and you can pause it.' },
  { li: 'A full Rules page and text size up to 300%. Sound is made on your device. Works offline.' },
  { sp: 1 },
  { p: 'Simplifications: there is no real club to lift, so weight is shown as a short lag in how the clubs follow your finger. Figure eights, mirror and alternating mills are drawn as simple paths.' },
  { sp: 1 },
  { p: 'Made by Arcforge. One game in a growing collection of the world\'s heritage games.' },
];

export const HOWTO = [
  { h: 'The quick version' },
  { li: 'Put a finger on the sand and draw the path with it. The right-hand club follows your finger; the other club follows the move\'s pair rule.' },
  { li: 'A glowing bead runs round a ghost path. Keep your club head on the bead.' },
  { li: 'Stay close and the FLOW meter fills; your multiplier climbs from x1 to x5. Lift your finger and the clubs drop.' },
  { li: 'Each beat is judged SMOOTH, GOOD or OFF, with a knock and a chime.' },
  { li: 'Between moves there are two beats to get ready: the next path and its start point are shown.' },
  { h: 'Tips' },
  { li: 'Look at the bead, not your finger. The clubs lag behind your finger, so aim slightly ahead of the bead.' },
  { li: 'Use big arm movements. A small circle drawn by the wrist is harder than a wide one.' },
  { li: 'Use the Hint button to see the start point and direction again. Practice lets you drill one move.' },
  { li: 'Watch and Learn plays the first four moves of a routine with time to think before each.' },
  { h: 'On a keyboard' },
  { li: 'Drag with the mouse. Space or Escape pauses. H shows the hint.' },
];

// ---- Rules pages -----------------------------------------------------------------------------------------------------------------------------
const moveRows = MOVE_ORDER.map((id) => ({ li: `${MOVES[id].name}: ${MOVES[id].how}` }));
export const RULES = [
  { title: 'The idea', blocks: [
    { p: 'Indian Club Swinging is a game of flow. A marker moves round a path at a steady tempo and you steer a club along it with one finger, then carry on into the next move. The better you stay with the marker, the higher your multiplier and your score.' },
    { fig: 'clubs', hh: 300 },
    { p: 'There are no levels to clear and nothing can end the routine early: it simply plays through its moves, and you are scored on how closely you followed them.' },
  ] },
  { title: 'The pad and the clubs', blocks: [
    { p: 'The round sand pit is the pad. Its centre is the centre of every path. The chalk ring is the edge of the path; a finger may go a little past it.' },
    { li: 'Press and drag anywhere on the screen. Where your finger is, relative to the centre of the pad, is where the lead club wants to be.' },
    { li: 'The lead club (the brass-ringed one) follows your finger with a short lag. The lag is the club weight, set in Settings: Light, Medium or Heavy.' },
    { li: `The second club (teal-ringed) is placed by the move's pair rule from the lead club: together, mirror or alternate.` },
    { li: 'If you lift your finger the clubs drop: the lead club hangs at the bottom of the pad and counts as zero quality until you press again.' },
    { fig: 'pairs', hh: 250 },
  ] },
  { title: 'The marker and a move', blocks: [
    { p: 'A move is a shape, a direction and a speed. The bead starts at a fixed point and runs round the shape.' },
    { li: 'Shapes: circle, wide oval, tall oval, sideways eight and upright eight.' },
    { li: 'Direction: clockwise or anticlockwise, shown by arrows on the ghost path.' },
    { li: 'Speed: most moves take two beats for one turn; the quick moves take one beat for one turn.' },
    { li: 'Every move lasts four turns, then the next move begins after a short gap.' },
    { fig: 'shapes', hh: 220 },
  ] },
  { title: 'Routines and tempo', blocks: [
    { p: `A routine is a list of moves at one tempo. Before the first move the game counts ${COUNT_IN} beats in with clicks; before each later move there are ${GAP_BEATS} beats to get ready. During a gap the bead waits at the start point of the next move and nothing is scored.` },
    ...ROUTINES.map((r) => ({ li: `${r.name}: ${r.bpm} beats per minute, ${r.moves.length} moves. ${r.blurb}` })),
    { li: 'Daily Routine: seven moves chosen from the date, so everyone gets the same set on the same day.' },
    { p: 'The tempo is fixed for a routine. Practice lets you choose the tempo yourself.' },
  ] },
  { title: 'Quality and flow', blocks: [
    { p: 'While a move is being swung, every moment is given a quality from 0 to 1. It depends on how far the lead club head is from the bead, measured in pad radii.' },
    { li: `Within about ${(JUDGE.smooth * 0.75).toFixed(2)} of a radius the quality is full (1). It falls smoothly to 0 at about ${(0.95).toFixed(2)} of a radius. These distances are scaled by the Timing setting: Relaxed ${tm('relaxed')}, Standard ${tm('standard')}, Strict ${tm('strict')}.` },
    { li: `FLOW is a meter from 0 to 100%. It rises while the quality is at least ${pct(FLOW.qOk)} and falls when it is not, and falls faster while your finger is up.` },
    { li: 'The multiplier is 1 plus the number of fifths of the meter that are filled, from x1 to x5.' },
    { fig: 'flow', hh: 150 },
    { p: 'Between moves the meter drains slowly. It does not reset, so a clean change from one move to the next keeps your multiplier.' },
  ] },
  { title: 'Beats and points', blocks: [
    { p: 'On every beat of a move the game checks the lead club head against the bead and judges the beat.' },
    { li: `SMOOTH: within ${JUDGE.smooth.toFixed(2)} of a radius (times the Timing setting). ${SCORE.smooth} points times the multiplier, a chime and sparks.` },
    { li: `GOOD: within ${JUDGE.good.toFixed(2)} of a radius. ${SCORE.good} points times the multiplier.` },
    { li: 'OFF: farther than that, or your finger is up. No points and your run of good beats ends.' },
    { li: `Between beats, ${SCORE.perSec} points per second times the quality times the multiplier are added.` },
    { p: 'The longest run of SMOOTH or GOOD beats is reported on the result screen.' },
  ] },
  { title: 'Stars and bests', blocks: [
    { p: 'Accuracy is the average quality over the whole time the moves were being swung (gaps do not count).' },
    { li: `1 star at ${pct(STAR_AT[0])}, 2 stars at ${pct(STAR_AT[1])}, 3 stars at ${pct(STAR_AT[2])}.` },
    { li: 'Grades: Warming up, Learning, Steady, Adept, Master.' },
    { li: 'Your best score, accuracy, stars and longest run are kept for every routine on this device.' },
    { li: 'Practice and Watch and Learn do not set bests.' },
  ] },
  { title: 'The twelve moves', blocks: [
    ...moveRows,
    { fig: 'moves', hh: 420 },
  ] },
  { title: 'Practice', blocks: [
    { p: 'Practice repeats one move for as long as you like at the tempo you choose (40 to 110 beats per minute, in steps of 5). The count-in and flow work as in a routine, and you see your accuracy so far. There is no end screen: use Pause and then Quit when you are done.' },
    { li: 'Very quick moves at a high tempo are intentionally hard; lower the tempo first.' },
  ] },
  { title: 'Watch and Learn', blocks: [
    { p: `A computer swinger plays the first four moves of the chosen routine. Before each move it THINKS (${THINK_TIMES.join(', ')} seconds, set in Settings, default ${THINK_TIMES[1]}) while the whole game waits, then REVEALS the start point and direction for 2 seconds, then swings it with the beat.` },
    { li: 'Pause freezes everything, including the thinking time and every moving thing on screen, and resumes exactly where it stopped.' },
    { li: 'Pressing Hint during the reveal goes back to the think phase.' },
    { li: 'Watch and Learn is always free to use.' },
  ] },
  { title: 'Hint, pause and settings', blocks: [
    { li: 'Hint: shows the start point of the move and its direction for four seconds. It is counted on the result screen but never costs points.' },
    { li: 'Pause: the clock, the beat, the clubs and the particles all stop. Resume continues exactly where you left off. The game also pauses by itself when the app goes to the background.' },
    { li: 'Settings: sound, club weight, timing, club trail, reduced motion, think time, and text size with A- and A+ on every text page.' },
    { li: `Club weight: ${WEIGHT.map((w) => `${w.name} (${Math.round(w.tau * 1000)} ms lag)`).join(', ')}.` },
  ] },
  { title: 'Ads and ad-free', blocks: [
    { p: 'Free to play with short ads. Menus, these rules, About, Watch and Learn and results are always free to use. A single one-time purchase makes it ad-free on that device, and Restore brings it back on a new one.' },
    { p: 'In the free web demo the first routine and Practice can be started a few times; the full game is on iPhone and Android.' },
  ] },
];

// main.js hands over the 3D library credits (vendor3d/LICENSES.md) so About shows them in the same zoomable reader.
export function setLicenses(text) {
  if (!text || ABOUT.some((b) => b.h === 'Licences')) return;
  const paras = String(text).split(/\n{2,}/).map((p) => p.replace(/^#+\s*/gm, '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 12);
  ABOUT.push({ h: 'Licences' }, ...paras.map((p) => ({ p })));
}
