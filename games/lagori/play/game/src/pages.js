// Text of How to play, Game Rules and About. Every number here is the engine's own (engine.js); the Rules page is cross-checked
// against it by test/game.test.js (it reads these constants, not copies of them).
import { THROWS, RUNNERS, STONES, INNINGS, REBUILD_TIME, DODGE_TIME, DODGE_COOL, DODGE_DIST, LEVELS } from './engine.js';

const W = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];
export const num = (n) => W[n] ?? String(n);

export const HOWTO = [
  { name: 'The idea', items: [
    { t: 'Lagori is the street game of Seven Stones. One team throws a ball to smash a tower of seven stones. Then its runners race to stack the tower again while the other team throws the ball at them.' },
  ] },
  { name: '1. Smash the tower', illus: 'throw', items: [
    { t: `You have ${num(THROWS)} throws. PRESS on the court and DRAG: a ring shows where the ball will land. RELEASE to throw.` },
    { t: 'The ring is only your aim: the ball can land a little off it, more so on a long throw. A hard hit scatters the stones wide, a soft one keeps them close.' },
  ] },
  { name: '2. Rebuild it', illus: 'stones', items: [
    { t: `The tower is down. TAP a stone: your runner fetches it and stacks it on the tower spot. Tap several stones to line them up. You have ${num(RUNNERS)} runners and ${REBUILD_TIME} seconds.` },
  ] },
  { name: '3. Dodge the ball', illus: 'dodge', items: [
    { t: 'A red ring tightens over your runner: the throw is coming. Tap DODGE, or flick sideways on the court, to sidestep it. You can also change direction: the fielder throws where you were heading.' },
    { t: `A dodge needs ${DODGE_COOL} seconds to recharge, so choose your moment.` },
  ] },
  { name: '4. Your turn to field', illus: 'field', items: [
    { t: 'When the computer strikes, you throw. PRESS and DRAG the ring onto the runner, a little ahead of where it is running. RELEASE to throw. A hit puts that runner out.' },
  ] },
  { name: 'Points', items: [
    { t: 'Stack all seven stones: 1 point, plus 1 if no runner was hit. If the tower stands, every runner is out, or time runs out, the fielders get 1 point.' },
    { t: `A match is ${num(INNINGS)} innings: you strike, you field, you strike, you field. The higher score wins.` },
  ] },
  { name: 'Keyboard', items: [
    { t: 'Arrow keys move the aim ring and Space throws. D dodges. 1 to 7 fetch a stone, in order of size. H is a hint. P pauses Auto Play.' },
  ] },
];

const lv = LEVELS.map((l) => l.name).join(', ');
export const RULES = [
  { name: 'The goal', items: [
    { t: `Lagori is played by two teams. The striking team smashes a tower of ${num(STONES)} stones with a ball and then tries to build it again before the fielding team hits its runners with the ball.` },
    { t: `A match is ${num(INNINGS)} innings. You strike in the first and third, the computer in the second and fourth. The team with more points after the last inning wins; equal points are a draw.` },
  ] },
  { name: 'The court and the stones', pieces: 'stones', items: [
    { t: `The tower is ${num(STONES)} flat stones, a big one at the bottom and each next one smaller. It stands in the chalk circle at the far end. The throw line is at the near end; the striker throws from behind it and the runners start from it.` },
    { t: 'The court has walls of chalk. A ball that reaches the edge bounces back.' },
  ] },
  { name: 'Teams', items: [
    { t: `The striking team has a thrower and ${num(RUNNERS)} runners. Only one runner is on the court at a time; the others wait on the line and take over when the runner before them is put out.` },
    { t: 'The fielding team has four fielders spread around the court. One of them always holds the ball.' },
  ] },
  { name: 'Striking', items: [
    { h: 'Throwing' },
    { t: `The striking team has ${num(THROWS)} throws at the standing tower. A throw is aimed at a point on the court; the ball lands within a small circle round that point (about 8 units plus 4 percent of the distance) and then bounces and rolls.` },
    { h: 'Knocking it down' },
    { t: 'The tower falls when the ball touches it while the ball is low enough to touch the stones; a ball that is still high in the air passes over. The ball then slows right down.' },
    { t: 'The harder the ball arrives, the wider the stones fly. A soft throw leaves them close together.' },
    { h: 'Missing' },
    { t: `A throw that does not touch the tower is used up when the ball stops. After ${num(THROWS)} misses the tower stands, the inning ends and the fielding team scores 1 point.` },
  ] },
  { name: 'Rebuilding', items: [
    { t: `As soon as the tower falls the first runner may start. A runner walks to a stone, picks it up, carries it to the tower spot and stacks it. Carrying is a tenth slower than walking. A runner can be given up to four stones in a row.` },
    { t: `The tower is rebuilt when all ${num(STONES)} stones are stacked. The team has ${REBUILD_TIME} seconds from the moment the tower falls.` },
    { t: 'Stones are stacked in the order they arrive; the stack is drawn big stones at the bottom for neatness.' },
  ] },
  { name: 'Fielding and hits', items: [
    { t: 'The fielder holding the ball throws it at the runner on the court. A throw is fast and straight; it runs on a little past its target and then drops. The computer fielders wind up first: a ring on the runner tracks and then locks.' },
    { t: 'After a throw the ball is loose until the nearest fielder brings it back, then the fielders pause before the next throw. The pause is shorter at higher levels.' },
    { t: 'A throw that touches a runner who is not dodging puts that runner out. A stone being carried falls where the runner stood. The next runner comes onto the court after a short moment.' },
  ] },
  { name: 'Dodging', items: [
    { t: `A runner can dodge. For ${DODGE_TIME} seconds the runner sidesteps ${DODGE_DIST} units and cannot be hit. The dodge needs ${DODGE_COOL} seconds before it can be used again.` },
    { t: 'The dodge button sidesteps away from the line of an incoming ball. A flick sideways on the court dodges in that direction.' },
  ] },
  { name: 'Scoring', items: [
    { t: 'Tower rebuilt: the striking team scores 1 point, and 1 more if none of its runners was put out.' },
    { t: 'Tower still standing after the throws, all three runners put out, or time up: the fielding team scores 1 point.' },
    { t: 'The match result is shown after the last inning.' },
  ] },
  { name: 'Computer levels', items: [
    { t: `There are three levels: ${lv}. Higher levels wind up faster, throw more accurately, pause less between throws, rebuild faster and dodge more often.` },
  ] },
  { name: 'Hint, Pause and Auto Play', items: [
    { t: 'HINT shows the move the computer would make: where to throw, which stone to fetch or where to aim at the runner. You have three hints in a match.' },
    { t: 'Auto Play (Watch and Learn) plays one inning each way between two computer teams. Before every decision the game stops for a think time, then shows the choice, then plays it. You can pause, skip and change the think time.' },
  ] },
  { name: 'How this game simplifies the street game', items: [
    { t: 'In the street game the fielders pass the ball between them and runners are not allowed to touch the stones with their hands. Here the nearest fielder always fetches the ball, and runners carry the stones.' },
    { t: 'Local rules vary a great deal between places; this is a clear, fair version of the idea.' },
  ] },
];

export const ABOUT = [
  { name: 'Lagori', items: [
    { t: 'Lagori, also called Seven Stones, Pitthu, Dabba Kali and Satoliya, is a traditional street and school-yard game from India, played in many forms across South Asia.' },
    { t: 'This version keeps its shape: smash the tower, then scramble to rebuild it while the other team throws the ball at you.' },
  ] },
  { name: 'Credits', items: [
    { t: 'Made by Arcforge, from the World Heritage Games series. Display type: Dela Gothic One. Text: Barlow. Both are open fonts under the SIL Open Font License.' },
    { t: 'The court, stones and sound are made in the game; the players are real-looking 3D figures animated from captured human motion. There are no ads. Your best results are kept on this device.' },
  ] },
];

// `credits` is the 3D layer's licence text (web/vendor3d/LICENSES.md), shown whole on About when the 3D view is in use.
export const flowOf = (sc, credits = '') => {
  if (sc === 'rules') return RULES;
  if (sc === 'howto') return HOWTO;
  if (!credits) return ABOUT;
  const from = credits.indexOf('## '), body = from >= 0 ? credits.slice(from) : credits;
  const paras = body.split(/\n\s*\n/).map((x) => x.replace(/^#+\s*/gm, '').replace(/\n/g, ' ').trim()).filter(Boolean);
  return [...ABOUT, { name: 'Licences of the 3D people', items: paras.map((t) => ({ t })) }];
};
