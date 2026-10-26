// Text of How to play, Game Rules and About. Every number here is the engine's own (engine.js); the test reads these constants.
import { W, RUNNERS, ROUNDS, HINTS, BEATS_PER_LINE, SIGHT, LEVELS, KINDS } from './engine.js';

const NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
export const num = (n) => NUM[n] ?? String(n);
const lvNames = LEVELS.map((l) => `${l.name} (${num(l.lines)} lines)`).join(', ');

export const HOWTO = [
  { name: 'The idea', illus: 'court', items: [
    { t: `Gobak Sodor is a team game of crossing lines. Guards stand on the chalk lines and may only move along them. Your ${num(RUNNERS)} runners must get past every line to the far end of the court and then all the way back home, without being touched.` },
  ] },
  { name: '1. Move one runner a beat', items: [
    { t: 'TAP a runner to pick it. Then TAP any cell, or SWIPE, in the direction you want it to step: it moves one cell up, down, left or right. You can also use the arrow keys.' },
    { t: 'After every step, or after you press WAIT, every guard moves once. That is one beat. The game never rushes you: nothing moves until you act.' },
  ] },
  { name: '2. Cross a line at the right moment', illus: 'cross', items: [
    { t: 'Lanes (the wide bands) are safe. A chalk line is where you can be touched. A guard touches a runner who is on its line and within one cell of it, to the left or right, when the guard has finished its move.' },
    { t: 'Look at where each guard WILL be: a ghost marks its next cell and a red zone shows the cells it touches. Step onto the line when the zone will be somewhere else, then step off into the next lane.' },
  ] },
  { name: '3. Use your team as a decoy', illus: 'decoy', items: [
    { t: 'Shadows and Sprinters step towards the nearest runner standing on or beside their line. Park one runner in a lane close to a guard to draw it across, then cross on the far side with another.' },
    { t: 'The Sodor guard walks up and down the centre column and touches a three by three block of cells round itself. Cross the middle quickly, or stay on the sides.' },
  ] },
  { name: 'Going home', items: [
    { t: `Touch the far lane, then come back down to the home lane. Every runner that gets home is one star. A round lasts at most ${BEATS_PER_LINE} beats for each line. A match is ${num(ROUNDS)} rounds.` },
    { t: `You have ${num(HINTS)} hints in a match. HINT shows the move the computer would play.` },
  ] },
  { name: 'Keyboard', items: [
    { t: 'Arrow keys step the picked runner. 1, 2 and 3 pick a runner, Tab picks the next one. Space or W waits. H is a hint. P pauses Auto Play.' },
  ] },
];

const kindLine = (k) => `The ${KINDS[k].name} ${KINDS[k].about}.`;
export const RULES = [
  { name: 'The goal', items: [
    { t: `You lead a team of ${num(RUNNERS)} runners against a team of guards. A runner scores by crossing every line to the far end of the court and then crossing every line again to get back to the home lane without being touched.` },
    { t: `A match is ${num(ROUNDS)} rounds. Each round is worth up to ${num(RUNNERS)} stars, one for every runner that gets home. A round is won when at least one runner gets home.` },
  ] },
  { name: 'The court', illus: 'court', items: [
    { t: `The court is ${num(W)} cells wide. Rows alternate between lanes (the wide bands) and lines (the chalk lines). The bottom lane is home and the top lane is the far end. Home and the far end are always safe.` },
    { t: 'A dashed chalk line runs up the middle of the court. That is the sodor line: the Sodor guard walks along it.' },
  ] },
  { name: 'Beats and moving', items: [
    { t: 'The game is played in beats. In one beat you move one runner one cell up, down, left or right, or you wait. Then every guard moves, then touches are checked.' },
    { t: 'A runner cannot move onto a cell another runner is standing on, and cannot leave the court. Runners may turn back at any time.' },
    { t: `A round has a limit of ${BEATS_PER_LINE} beats for each line: ${LEVELS.map((l) => `${l.lines * BEATS_PER_LINE} on ${l.name}`).join(', ')}. Waiting uses a beat. When the beats run out, the round ends and runners still on the court do not count.` },
  ] },
  { name: 'Touches', items: [
    { h: 'Line guards' },
    { t: 'A line guard touches a runner who stands on its own line and is within one cell of the guard, left or right, after the guard has moved. A guard that moves two cells touches everyone in reach of any cell it passed through.' },
    { t: 'Runners in the lanes beside a line are never touched by that line\'s guard.' },
    { h: 'The Sodor guard' },
    { t: 'The Sodor guard stays on the middle column and moves up or down one cell a beat. It touches any runner in the three by three block round it, after it has moved, anywhere between the first line and the last line. The home lane and the far lane are safe from it.' },
    { h: 'What a touch means' },
    { t: 'A runner who is touched is out for the rest of the round and sits at the side. The other runners play on. The round also ends when all the runners are home or out.' },
  ] },
  { name: 'The guards', items: [
    { t: kindLine('walker') },
    { t: kindLine('shadow') },
    { t: `${kindLine('sprinter')} Its ring pulses on the beat it dashes. Both notice runners only within ${num(SIGHT)} columns of themselves.` },
    { t: 'The Sodor guard is a Walker (up and down, turning at the first and last line) on the first level and chases the nearest runner within two columns of the middle on the higher levels.' },
    { t: 'Guards are never random. Everything they do follows from these rules and where your runners are, so a careful player can always work out what they will do.' },
  ] },
  { name: 'Stars and winning', items: [
    { t: 'Each runner that gets home is one star. Zero stars, or a round that ends with every runner out, is a lost round; you still play all rounds.' },
    { t: `After ${num(ROUNDS)} rounds the stars are added up. Seven or more is a flawless match, five or more is a win.` },
  ] },
  { name: 'Levels', items: [
    { t: `There are three levels: ${lvNames}. Higher levels have more lines, more Shadows and Sprinters, and the Champions level adds a second guard on the middle line from the second round.` },
    { t: 'Every round sets the guards out afresh, so no two rounds are the same.' },
  ] },
  { name: 'Hint, Pause and Auto Play', items: [
    { t: `HINT shows the move the computer would play for you. You have ${num(HINTS)} hints in a match.` },
    { t: 'Auto Play (Watch and Learn) lets the computer lead the runners through one round on the Village court. Before each move the game stops for a think time, shows the choice, then plays it. You can pause, skip and change the think time.' },
  ] },
  { name: 'How this game simplifies the street game', items: [
    { t: 'In the street game both teams are made of children, the guards are usually children from the other team who may also move on the lines in either direction at will, and a touch is a real tag. Here the guards follow fixed rules that you can learn, and a touch is checked by cell.' },
    { t: 'Local rules differ across Indonesia and Malaysia; some places let the whole team go home together and some count one successful runner as a win. This game counts both.' },
  ] },
];

export const ABOUT = [
  { name: 'Gobak Sodor', items: [
    { t: 'Gobak Sodor is a traditional street and school-yard game played across Indonesia, where it is known by this name and also as Hadang in parts of Java, and as Galah Asin in Malaysia.' },
    { t: 'One team guards the lines of a rectangle chalked on the ground and tries to touch the other team as it runs through every line and back. It is played for the pleasure of the dodge, with no equipment at all.' },
    { t: 'This version keeps its shape and turns it into a puzzle of timing and teamwork: read the guards, use your team as decoys and cross at the right moment.' },
  ] },
  { name: 'Credits', items: [
    { t: 'Made by Arcforge, from the World Heritage Games series. Display type: Fredoka. Text: Barlow. Both are open fonts under the SIL Open Font License.' },
    { t: 'The court markings and the sounds are drawn and made in the game. Your best results are kept on this device.' },
  ] },
];

// `credits` is the 3D layer's licence text (shown only when the 3D players are on): one item per paragraph.
export const flowOf = (sc, credits = '') => {
  if (sc === 'rules') return RULES;
  if (sc !== 'about') return HOWTO;
  const paras = String(credits || '').split(/\n\s*\n/).map((x) => x.replace(/^#+\s*/gm, '').replace(/\s*\n\s*/g, ' ').trim()).filter((x) => x && !/^Credits and licences for the Arcforge/.test(x) && !/^Games that ship the 3D layer/.test(x));
  return paras.length ? [...ABOUT, { name: '3D players', items: paras.map((t) => ({ t })) }] : ABOUT;
};
