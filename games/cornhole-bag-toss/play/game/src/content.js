// The words: About, How to Play, Rules and the Learn lessons. Every number here is one the engine (engine.js), the physics (phys.js), the
// opponents (ai.js) and the game flow (game.js) really use; the figures are read from those files so the text cannot drift from the game.
// Language: the game is played in English. Cornhole has no native-script terms.
import { PROFILES, ASSIST } from './ai.js';
import { STYLES, BOARD_W, BOARD_L, HOLE_R, H_FRONT, H_BACK, BOARD_Z0 } from './phys.js';
import { LENGTHS, BAGS_EACH, BOARD_PT, HOLE_PT } from './engine.js';

const cm = (m) => Math.round(m * 100);
const inch = (m) => Math.round(m / 0.0254);
const prof = (i) => PROFILES[i];

export const ABOUT = [
  { title: 'Cornhole', p: [
    'The backyard bag toss for your phone: pitch soft fabric bags at a slanted board across the lawn, drop them in the hole, and knock your rival\'s bags out of the way.',
    'Cornhole is a lawn game from the United States, played in backyards, parks and car parks before a game or a picnic. Where exactly it began is debated, and in some places it goes by other names. This game follows the usual rules of the backyard and tournament game in a form that is easy to learn on a phone.',
  ], art: 'layout' },
  { title: 'The real sizes', p: [
    `The board is ${inch(BOARD_W)} by ${inch(BOARD_L)} inches (${cm(BOARD_W)} by ${cm(BOARD_L)} cm). It slopes up from about ${inch(H_FRONT)} inches (${cm(H_FRONT)} cm) at the front edge to ${inch(H_BACK)} inches (${cm(H_BACK)} cm) at the back edge, and has a ${inch(HOLE_R * 2)} inch hole. The two boards stand 27 feet (8.23 m) apart, front edge to front edge.`,
    'A bag is a soft fabric square about 6 inches (15 cm) across, filled so it flops and does not bounce. The scene, the bag size and the board slope in this game are those real sizes.',
  ] },
  { title: 'Friendly and fair', p: [
    'All opponents are invented characters. There are no real players, teams, leagues or brands in this game.',
    'It is a game of skill for fun: no betting, no stakes, no coins. Scores and records stay on your device.',
  ] },
  { title: 'Made to be comfortable', p: [
    'Every text screen can be enlarged up to 300%. Aim steadiness has three settings. The Think button tests a throw with real simulated bags and tells you what happened, Learn teaches throws, scoring and cancellation in five short lessons, and Watch & Learn lets you watch two players with their reasons on screen.',
    'The game is free to try for 90 seconds of real play. Menus, the rules, Learn and Watch & Learn are always free; one purchase unlocks everything for good.',
  ] },
];

export const HOWTO = [
  { title: 'The goal', p: [
    `Two sides, red and blue, take turns tossing ${BAGS_EACH} bags each at the far board. A bag that stays on the board is worth ${BOARD_PT} point, a bag in the hole is worth ${HOLE_PT}.`,
    'After all eight bags the two totals are set against each other and only the difference counts, for the side that is ahead. The first side to reach the target (11 or 21 points) wins.',
  ], art: 'layout' },
  { title: 'Throw: pull back and let go', p: [
    'Put a finger on the lawn and pull it back toward you. The further you pull, the further the bag will go; pulling to one side aims the bag the other way, like a catapult. A gold ring on the board shows where the bag will land and a dashed line shows its flight.',
    'Let go to throw. A short pull cancels the throw. The Throw button throws at the ring as it is now, and the small arrows beside it nudge the ring a finger-width left or right.',
  ], art: 'pull' },
  { title: 'Slide, Arc or Flip', p: [
    'Slide is low and fast: it lands at the front of the board and slides up toward the hole. Arc is the all-rounder: it lands flat and slides a little. Flip is a high lob with a full somersault: it drops almost straight down and stays where it lands.',
    'The ring marks where the bag lands, not where it stops. A faint ghost bag shows where a perfect throw would come to rest.',
  ], art: 'styles' },
  { title: 'Spin', p: [
    'Spin makes a sliding bag curve. Light or strong spin left or right bends its slide that way, which lets a slide go round another bag. No spin slides straight.',
    'Your hand is never perfect: the bag lands near the ring, not always on it. Aim steadiness in Setup and Settings changes how near.',
  ] },
  { title: 'Think and Watch & Learn', p: [
    'Think tests several throws with the real physics against the bags that are on the board and suggests the best. Its reason is measured: how many of twelve test throws went in the hole, stayed on the board or missed.',
    'Watch & Learn lets two computer players play a whole game. You see them think, the plan they choose, and then the throw. Pause stops everything; the thinking time can be changed.',
  ] },
  { title: 'Scoring in a round', p: [
    `A round is ${BAGS_EACH} bags each, thrown one after the other. Count each side's bags: ${BOARD_PT} point for a bag on the board, ${HOLE_PT} for a bag in the hole. A bag that is off the board counts nothing.`,
    'Cancellation: take the smaller total away from the bigger. Only the side that is ahead scores, and it scores the difference. Red 5 and blue 2 means red scores 3 and blue scores nothing. Equal totals mean nobody scores.',
  ], art: 'cancel' },
];

export const RULES = [
  { title: 'The board and the court', p: [
    `The board is ${inch(BOARD_W)} by ${inch(BOARD_L)} inches (${cm(BOARD_W)} by ${cm(BOARD_L)} cm). The front edge is ${cm(H_FRONT)} cm off the ground and the back edge ${cm(H_BACK)} cm, so the top slopes up away from you at about ten degrees.`,
    `The hole is ${inch(HOLE_R * 2)} inches (${cm(HOLE_R * 2)} cm) across, centred on the board's long line and 9 inches (23 cm) from the back edge. The near board is at your end; this view always looks at the far board, which is ${(BOARD_Z0).toFixed(2)} m (27 feet) from the throwing line.`,
  ], art: 'board' },
  { title: 'The bags', p: [
    'Each side has four bags, red with a diamond mark or blue with a ring mark. A bag is about 15 cm square and soft: it does not bounce. A bag that lands flat stays near where it lands; a bag that lands on an edge or corner can flop forward and slide on a little.',
    'A bag that lands on or against another bag shoves it along with part of the speed it arrived with, so a fast Slide can drive a blocker up the board, into the hole or off the back. Bags that touch push each other and can spin and turn. A bag lying half over the hole is pulled toward it a little as it slows.',
  ] },
  { title: 'Taking turns', p: [
    `A round (an inning) is eight bags: ${BAGS_EACH} each, thrown one at a time, the two sides alternating. The side that throws first in a round throws bags 1, 3, 5 and 7.`,
    'In a real singles game both players stand at the same end and walk to the other board after each round; in this game they always throw at the same board, which comes to the same thing.',
  ] },
  { title: 'What scores', p: [
    `A bag that comes to rest on top of the board scores ${BOARD_PT} point (any part of the bag may hang over the edge, as long as its middle is still over the board).`,
    `A bag that goes through the hole, thrown in or pushed in by a later bag, scores ${HOLE_PT} points.`,
    'A bag that goes through the hole is out of the way for the rest of the round but keeps its three points.',
  ], art: 'score' },
  { title: 'Bags that do not count', p: [
    'A bag that touches the ground before it reaches the board is dead: it does not score even if it then slides up against the board.',
    'A bag that slides or is pushed off the board (its middle goes past the edge) falls to the ground and does not score. A bag that is knocked off was worth points only while it was on the board, so knocking an opponent bag off takes their points away.',
    'A bag that flies over the board and lands behind it is dead too.',
  ], art: 'dead' },
  { title: 'Cancellation scoring', p: [
    'When all eight bags are thrown, add up each side\'s bags (1 or 3 points each). Take the smaller total from the bigger. Only the side that is ahead scores, and it scores that difference.',
    'Example: red has one bag in the hole and one on the board (4 points), blue has two on the board (2 points). Red scores 4 minus 2, which is 2 points. Blue scores nothing. If both totals are equal nobody scores.',
  ], art: 'cancel' },
  { title: 'Who throws first', p: [
    'In the first round the first side is chosen at random. After that, the side that scored in the previous round throws first. If nobody scored, the same side throws first again.',
  ] },
  { title: 'Winning', p: [
    `${LENGTHS[0].name}: first to ${LENGTHS[0].pts} points. ${LENGTHS[1].name}: first to ${LENGTHS[1].pts} points. The game is decided at the end of a round, never in the middle of one.`,
    `${LENGTHS[2].name} (a common house rule): you must land on exactly ${LENGTHS[2].pts}. If a round would take you past ${LENGTHS[2].pts}, your score drops back to 15 instead.`,
  ] },
  { title: 'Slide, Arc and Flip', p: [
    `${STYLES[0].name}: a low, fast throw that rises only ${cm(STYLES[0].apex)} cm above your hand. It lands at the front of the board and slides about forty centimetres up the slope. ${STYLES[1].name}: rises ${cm(STYLES[1].apex)} cm, lands flat and slides about fifteen centimetres. ${STYLES[2].name}: rises ${cm(STYLES[2].apex)} cm and turns over once on the way; it lands almost straight down and slides only a few centimetres.`,
    'The three styles have different aim errors: the Slide is the hardest to judge for distance, the Flip the easiest.',
  ], art: 'styles' },
  { title: 'Spin and sliding', p: [
    'A bag lies on a board that slopes toward you, so a sliding bag is slowed by friction and by gravity and stops quickly. Spin turns a sliding bag\'s path: light spin and strong spin, to the left or the right.',
    'A fast bag that crosses the hole can skip over it; a slow bag whose middle is over the hole falls in.',
  ] },
  { title: 'Your hand', p: [
    `The landing point has a small random error. Aim steadiness: ${ASSIST.map((a) => `${a.name} (${cm(a.lat)} cm across, ${cm(a.dep)} cm in depth)`).join('; ')}. The numbers are one standard deviation at the board for an Arc throw; the Slide has bigger errors in depth and the Flip smaller.`,
    'A pull that is smooth and straight is a little more accurate than one that wobbles; the Throw button uses the standard error.',
  ] },
  { title: 'The computer players', p: PROFILES.map((p) => `${p.name}: ${p.tag}. Its landing error is ${cm(p.lat)} cm across and ${cm(p.dep)} cm in depth.`).concat([
    'Each computer player tests many throws against the bags that are on the board, with the same physics you play with, and picks one; the stronger players pick nearer the best. Blocking the hole, pushing a bag out of the way and going for the hole all come from that search.',
  ]) },
  { title: 'What is simplified', p: [
    'There is no foul line or throwing box: the throw always starts from the same place in front of you. Bags that land on top of each other push each other along the board instead of stacking. A game is played to the target and then ends; there is no win-by-two rule.',
  ] },
];

// Learn path. `setup` puts bags on the board first: side 1 is blue (the opponent), side 0 is red (you). `goal` is checked after every throw.
export const LESSONS = [
  { title: 'Land on the board', tries: 4, goal: 'board', goalShort: '1 pt', goalSub: 'a bag on the board', setup: [],
    text: 'Pull back and let go to throw. The gold ring shows where the bag lands. Get one bag to stay on the board: it scores 1 point.' },
  { title: 'Into the hole', tries: 6, goal: 'hole', goalShort: '3 pts', goalSub: 'a bag in the hole', setup: [],
    text: 'Put the ring on the hole and throw an Arc or a Flip. A bag in the hole scores 3 points. A flat arc may slide a little after it lands, so aim a little short.' },
  { title: 'The slide throw', tries: 5, goal: 'slide', style: 0, goalShort: 'Slide', goalSub: 'stop past the middle', setup: [],
    text: 'This lesson uses the Slide. Aim the ring at the front of the board: the bag lands there and slides up toward the hole. Get a bag to stop more than half way up the board, or in the hole.' },
  { title: 'Push the blocker', tries: 6, goal: 'push', goalShort: 'Knock off', goalSub: 'one blue bag', setup: [{ side: 1, u: 0, v: 0.72 }, { side: 1, u: 0.12, v: 0.55 }],
    text: 'Two blue bags sit in front of the hole. A bag that lands on or hits another one shoves it along, and a bag that is pushed off the board scores nothing. Knock one blue bag off the board: a Slide that lands just behind or against a blue bag drives it furthest.' },
  { title: 'Count a round', tries: 3, goal: 'quiz', goalShort: '3 right', goalSub: 'cancellation scoring', setup: [], quiz: true,
    text: 'Three rounds are shown. Work out who scores and how many points: take the smaller total away from the bigger.' },
];
// The questions of the last lesson: bags are [side, 'board' | 'hole'].
export const QUIZ = [
  { bags: [[0, 'hole'], [0, 'board'], [1, 'board'], [1, 'board']] },
  { bags: [[0, 'board'], [1, 'hole'], [1, 'board'], [0, 'board'], [0, 'board']] },
  { bags: [[0, 'hole'], [1, 'hole'], [0, 'board'], [1, 'board']] },
];
