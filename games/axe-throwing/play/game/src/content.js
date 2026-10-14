// The text of the About, How to Play and Rules pages. Each section: { title, art?, p: [paragraphs] }.
// Every number here is read from the engine (sim.js) so the rules page cannot drift from the game.
import { RINGS, CLUTCH, VENUES, AXES, LEVELS, RIVALS, ROUNDS, PER, TUNE, STUCK_GAP, MIN_HOLD, BS } from './sim.js';

export const ABOUT = [
  { title: 'Axe throwing', art: 'board', p: [
    'Axe throwing is a skill sport from the logging traditions of Canada and the United States. Hatchets are thrown at a timber target painted with rings so that the blade bites in and stays; points are given by the ring that it lands in.',
    'Today it is played as a friendly sport in leagues and clubs in both countries, and it is part of the living heritage of Canada and the United States. It is presented here as a target sport of timing and aim, nothing more.',
  ] },
  { title: 'About this version', p: [
    'This is a video game version made for phones and tablets. You aim a reticle on the board and let go on the swing meter. A swing at the right speed turns the axe the right number of times, so the blade arrives first. The rival, the venues and the axes are invented for the game.',
    'Simplifications: you look straight at one board, the axe always turns in a vertical line, distance is a number of turns instead of feet, and wind and a sliding board are used to make each venue different.',
  ] },
  { title: 'Pictures and credits', p: [
    'The lane, boards and axes are made for the game and the sound is synthesised. In the 3D view the throwers and spectators are 3D people from the Arcforge library (credits below); without 3D they are not drawn. Axe Throwing is part of the Arcforge collection of heritage games.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'board', p: [
    `Stick axes in the painted board. A match is ${ROUNDS} rounds of ${PER} axes each against a rival; the higher total wins. The inner ring is worth 6.`,
  ] },
  { title: 'Aim', art: 'aim', p: [
    'Press on the board. A reticle appears above your finger and the swing meter under the board starts to sweep. Drag to place the reticle. Your hand drifts a little, more the longer you hold.',
  ] },
  { title: 'Swing', art: 'meter', p: [
    'Let go when the marker is inside a green band. Each band is a swing speed at which the axe turns a whole number of times, so the blade arrives first and bites. The turns shown above the bar tell you where you are.',
  ] },
  { title: 'Read the room', art: 'wind', p: [
    'In the open yard the wind pushes the axe sideways; in the night hall the board slides on a rail. The Think button shows where to aim to allow for both.',
  ] },
  { title: 'Think and Watch & Learn', p: [
    'Think rings the best free spot on the board, with the reason. A match where you used Think is practice and is not saved as a best.',
    'Watch & Learn plays a whole match for you. It stops to think, shows its choice, then throws. You can pause at any time.',
  ] },
];

const ringLines = RINGS.map((r) => `${r.name}: ${r.pts} point${r.pts === 1 ? '' : 's'}, within ${r.r} units of the centre.`);
const venueLines = VENUES.map((v) => `${v.name}: ${v.blurb}${v.need ? ` Opened by ${v.need} match win${v.need === 1 ? '' : 's'}.` : ' Always open.'}`);
const axeLines = AXES.map((a) => `${a.name}: ${a.note}${a.need ? ` Opened by ${a.need} axes stuck in total.` : ' Always open.'}`);
const levelLines = LEVELS.map((l) => `${l.name}: window of ${l.win} of a turn either side of the exact turn, swing time ${l.period} s, hand drift ${l.sway} units. ${l.blurb}`);
const rivalLines = RIVALS.map((r) => `${r.name}: ${r.blurb}`);

export const RULES = [
  { title: 'Goal', art: 'board', p: [
    `Score more points than your rival over ${ROUNDS} rounds of ${PER} axes each. If you are level after the third round there is sudden death: one axe each, repeated up to three times, then a draw.`,
  ] },
  { title: 'The board', art: 'rings', p: [
    `The board is ${BS} units across. ${ringLines.join(' ')}`,
    `The two corner spots (clutch spots, ${CLUTCH[0].r} units across) are worth ${CLUTCH[0].pts} points each. An axe that sticks in the wood outside the rings scores nothing.`,
  ] },
  { title: 'Aim and drift', art: 'aim', p: [
    `Pressing on the board starts the throw and the swing. A press shorter than ${MIN_HOLD} seconds is ignored. The reticle sits above your finger so you can see it. Your hand drifts: the drift grows from ${Math.round(TUNE.swayFloor * 100)} percent to full over ${TUNE.swayRamp} seconds of holding, and its size depends on the level and the axe.`,
    'On a keyboard use the arrow keys or WASD to move the reticle, hold Space to start the swing and release Space to throw.',
  ] },
  { title: 'The swing and the turns', art: 'meter', p: [
    `The marker sweeps from slow to fast and back. A slower swing means a longer flight, so the axe turns more before it reaches the board: turns = distance turns divided by swing speed, where swing speed runs from ${TUNE.velMin} to ${TUNE.velMax}.`,
    'The blade bites only when the turns are within the window of a whole number (the double-bit also sticks on half turns). Otherwise the axe bounces: too slow means it turned past the blade, too fast means the handle arrives first.',
  ] },
  { title: 'Where it lands', art: 'wind', p: [
    'The axe lands where the reticle was at the moment you let go, moved by the wind at that moment, and by the slide of the board at the moment it arrives. There is no luck: the same swing and aim always give the same result.',
    `An axe that lands closer than ${STUCK_GAP} units to the head of an axe already in the board deflects and falls. Axes are removed from the board between rounds.`,
  ] },
  { title: 'Venues', art: 'venues', p: venueLines },
  { title: 'Axes', art: 'axes', p: axeLines },
  { title: 'Levels', art: 'levels', p: levelLines },
  { title: 'Rivals', p: [
    ...rivalLines,
    'The rival uses the same rules and physics: its aim and swing have small errors that shrink with its skill, it allows for wind and the sliding board, and it goes for a clutch spot when it is behind late in a match.',
  ] },
  { title: 'Modes', p: [
    `Match: against the rival of the venue. Daily Round: ${ROUNDS * PER} axes with the same venue and axe for everybody today. Free Practice: endless axes with no score, the board is cleared after six.`,
    'Watch & Learn plays a match for you. It thinks for the set time (2, 5, 8 or 10 seconds), shows its choice for 2 seconds, then throws. Pause stops everything exactly where it is and Resume continues.',
  ] },
  { title: 'Think', p: [
    'Think rings the best free spot on the board, allowing for wind and the board slide. Using it makes that match practice: its score is not saved as a best.',
  ] },
  { title: 'Unlocking', p: [
    'New venues open with match wins and new axes open with the total number of axes you have stuck (shown in the Collection).',
  ] },
  { title: 'Simplifications', p: [
    'Real throwing is at a measured distance with an overhand throw; here the distance is a number of turns and the throw is a swing. Real leagues have their own scoring variations; these rings and spots are invented for the game. It is a target sport only.',
  ] },
];
