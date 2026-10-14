// Text of How to play, Game Rules and About. Every number is the engine's own (engine.js); test/game.test.js reads these constants.
import { TEAM_SIZE, FORT_R, TAG_R, ROUND_TIME, AUTO_ROUND_TIME, ROUNDS_MAX, WIN_POINTS, SPEEDS, CHASE_BOOST, LEVELS } from './engine.js';

const W = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];
export const num = (n) => W[n] ?? String(n);

export const HOWTO = [
  { name: 'The idea', items: [
    { t: `Bentengan is the Indonesian game of two forts. Each team of ${num(TEAM_SIZE)} guards a pole. Touch the rival pole, or catch the whole rival team, to win the round.` },
  ] },
  { name: '1. Pick a player, tap a place', illus: 'move', items: [
    { t: 'TAP one of your players to pick him. Then TAP the field to send him there. TAP a rival to chase him, TAP the rival pole to run for it, TAP your jail to free your prisoners, TAP your fort to bring him home.' },
    { t: 'The Switch button picks your next free player.' },
  ] },
  { name: '2. The number is everything', illus: 'fresh', items: [
    { t: 'A player who steps out of his fort gets the next number. A HIGHER number means he left LATER and is fresher. When two rivals meet in the open, the higher number tags the lower one.' },
    { t: 'Inside your fort ring you are safe and your number resets. Step out again and you are the freshest player on the field.' },
  ] },
  { name: '3. Jail and rescue', illus: 'jail', items: [
    { t: 'A tagged player goes to the jail beside the rival fort. A free teammate who touches his own jail frees everyone in it, and they run back to the fort.' },
  ] },
  { name: 'Hint and Auto Play', items: [
    { t: 'HINT shows the move the computer would make and why. Tap the glowing spot to play it. Auto Play lets two computer teams play a round: it stops, thinks, shows the choice, then plays it.' },
  ] },
  { name: 'Winning', items: [
    { t: `Each round won is a point. First to ${num(WIN_POINTS)} points wins the match, after at most ${num(ROUNDS_MAX)} rounds.` },
  ] },
  { name: 'Keyboard', items: [
    { t: '1 to 4 pick a player. Space or Tab picks the next one. H is a hint. P pauses Auto Play.' },
  ] },
];

const lv = LEVELS.map((l) => l.name).join(', ');
export const RULES = [
  { name: 'The goal', items: [
    { t: `Two teams of ${num(TEAM_SIZE)} play on one field. Each team has a fort with a pole in it, and a jail on the rival half. A round is won by touching the rival pole with a player who is outside his fort, or by putting all ${num(TEAM_SIZE)} rival players in jail.` },
    { t: `A match is first to ${num(WIN_POINTS)} round points, over at most ${num(ROUNDS_MAX)} rounds. Each round is ${ROUND_TIME} seconds.` },
  ] },
  { name: 'Forts and the safe zone', items: [
    { t: `Each fort is a ring of radius ${FORT_R} units round the pole. A player inside his own ring is safe: he cannot be tagged, and he is not counted as being in the open.` },
    { t: 'A player who walks out of the ring is in the open. When he walks back in, he is safe again.' },
  ] },
  { name: 'Freshness numbers', items: [
    { t: 'Every time a player steps out of his ring he is given the next number in a single count shared by both teams. The numbers drawn above players in the open are those counts, shown in order of the players currently out (1 is the one who left first).' },
    { t: 'Going back into the fort and out again gives a new, higher number. A number only matters against rivals who are also in the open.' },
  ] },
  { name: 'Tagging', items: [
    { t: `When a player of each team are in the open and closer than ${TAG_R} units, the one with the higher number tags the other. The tagged player goes straight to the jail beside the tagger's fort. A player can tag several rivals in a row.` },
    { t: 'Nobody can be tagged inside his own fort ring, in jail or while running back to the fort after a rescue.' },
  ] },
  { name: 'Jail and rescue', items: [
    { t: 'Prisoners wait in their jail. A free teammate who is in the open and touches the jail frees all prisoners at once. They run back to their fort at once, and have number zero as if they never left.' },
  ] },
  { name: 'Touching the pole', items: [
    { t: 'A player who is in the open and touches the rival pole wins the round on the spot. Players running past count too, so keep a guard close.' },
  ] },
  { name: 'Speed', items: [
    { t: `Players are not equal: the sprinter runs ${SPEEDS[0]} units a second, the two steady runners ${SPEEDS[1]}, the guard ${SPEEDS[3]}. A player chasing a rival runs ${Math.round((CHASE_BOOST - 1) * 100)} percent faster than usual.` },
  ] },
  { name: 'Time up', items: [
    { t: 'When the clock runs out the team holding more prisoners wins the round. Equal prisoners make a drawn round with no point.' },
  ] },
  { name: 'Computer levels', items: [
    { t: `There are three levels: ${lv}. Higher levels think faster, see a fresher rival from farther away, make fewer mistakes and are bolder.` },
  ] },
  { name: 'Hint, Pause and Auto Play', items: [
    { t: 'HINT shows the move the computer would make and why. You have three hints in a match; tap the glowing spot to play it.' },
    { t: `Auto Play plays one ${AUTO_ROUND_TIME} second round between two computer teams. Before every decision the game stops for a think time, shows the choice, then plays it. You can pause and change the think time.` },
  ] },
  { name: 'How this game simplifies the street game', items: [
    { t: 'In the street game players hold hands in jail as a chain, a whole team may leave the fort at once and arguments about who left first are settled by the players. Here the order is counted for you, and the jail frees everyone with one touch.' },
    { t: 'Local rules vary a great deal between places; this is a clear, fair version of the idea.' },
  ] },
];

export const ABOUT = [
  { name: 'Bentengan', items: [
    { t: 'Bentengan, also called Benteng, is a traditional children\'s game from Indonesia, played in school yards and village lanes. Two teams defend a pole each and try to touch the rival\'s pole while tagging and imprisoning rivals.' },
    { t: 'This version keeps its shape: leave the fort at the right moment, because the player who left later wins the meeting.' },
  ] },
  { name: 'Credits', items: [
    { t: 'Made by Arcforge, from the World Heritage Games series. Display type: Fredoka. Text: Barlow. Both are open fonts under the SIL Open Font License.' },
    { t: 'All art and sound are drawn and made in the game. There are no ads. Your best results are kept on this device.' },
  ] },
];

// The 3D people layer's credits (vendor3d/LICENSES.md, handed over by the presenter) close the About page.
const licSection = (lic) => {
  const paras = String(lic).split(/\n\s*\n/).map((q) => q.replace(/\s*\n\s*/g, ' ').trim()).filter((q) => q && !/must show this text/.test(q));
  return { name: 'Open-source credits', items: paras.map((q) => (q.startsWith('#') ? { h: q.replace(/^#+\s*/, '') } : { t: q })) };
};
export const flowOf = (sc, lic = '') => (sc === 'rules' ? RULES : sc === 'about' ? (lic ? [...ABOUT, licSection(lic)] : ABOUT) : HOWTO);
