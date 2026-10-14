// The text of the About, How to Play and Rules pages. Each section: { title, art?, p: [paragraphs] }.
// Numbers are read from the engine (sim.js) so the rules page cannot drift from the game.
import { TRICKS, KINDS, REACH_X, REACH_Y, HALF0, HALF_MIN, SESSION, KID_SPEED } from './sim.js';

export const ABOUT = [
  { title: 'Chungi', art: 'ball', p: [
    'Chungi is a street game from Nepal and neighbouring parts of India. A ball made of many rubber bands, tied together with a tuft of loose ends, is kept in the air with the feet. Children play it in lanes and courtyards, counting kicks and trying new tricks without letting it drop.',
    'The ball is cheap, light and springy, and every kick sends it a little differently, which is much of the fun. Similar footbag games are played in many parts of the world.',
  ] },
  { title: 'About this version', p: [
    'This is a video game version for phones and tablets. The chungi is built from stretchy loops that squash when they are struck and stretch as they fly, and it ricochets off the walls of a narrow alley in a hill town at sunset.',
    'Simplifications: one kid plays alone, the kid slides under the ball by itself so that you decide where each kick goes, and hoops, ricochet points and combos are added so that every kick is a small decision.',
  ] },
  { title: 'Pictures and credits', p: [
    'The alley, the ball and the hoops are drawn in the game and the sound is synthesised in it; the kid is a 3D figure from the shared Arcforge 3D player library (licences on the next page). The kid, the alley and the hoops are invented for the game. Chungi is part of the Arcforge collection of heritage games.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'overview', p: [
    'Keep the chungi in the air. Each kick adds one to your streak. When the ball touches the ground the run is over.',
  ] },
  { title: 'Tap toward where it should go', art: 'tap', p: [
    'The kid slides under the ball by himself. When the ball is low, tap anywhere in the alley. Tap to the left of the ball and it flies left; tap to the right and it flies right; tap right on the ball and it goes straight up. A tap far from the ball sends it further.',
    'You can tap while the ball is in the dashed box beside the kid. Tap too early and the kid misses his chance for a moment.',
  ] },
  { title: 'Three kicks', art: 'kinds', p: [
    'Where the ball is when you tap decides the kick: low is a toe poke (the highest lob), middle is the inside of the foot, high is a knee pop (short and soft). Mixing them raises your style multiplier.',
    'A Perfect kick is a tap with the ball right above the kid\'s foot at the best height for that kick: it flies true and scores more.',
  ] },
  { title: 'Walls and hoops', art: 'hoop', p: [
    'The walls are lively: each ricochet scores points. In Hoop Rally and the Daily alley, drop the ball down through the glowing hoop for a bonus. Each hoop that you thread is followed by a new one, a little smaller.',
    'Watch the breeze: the flag strip shows what it will do next.',
  ] },
  { title: 'Think and Watch & Learn', p: [
    'Think slows time for a moment and draws the arc a good player would use, with the reason. A run where you used Think is practice: it is not saved as a best.',
    `Watch & Learn plays ${SESSION} kicks for you. It stops to think, shows its choice, then acts. You can pause at any time.`,
  ] },
];

const trickLines = TRICKS.map((t) => `${t.name}: ${t.how}. +${t.pts} points.`);
export const RULES = [
  { title: 'Goal', p: [
    'Keep one chungi in the air as long as possible. Your streak is the number of kicks in a row. Street Run counts kicks, Hoop Rally and the Daily alley count hoops threaded.',
    'The run ends when the ball touches the ground. Watch & Learn ends after its set of kicks.',
  ] },
  { title: 'The alley', art: 'overview', p: [
    `The alley is ${HALF0 * 2} units wide at the start. As your streak grows the walls close in, down to ${HALF_MIN * 2} units, gravity rises (up to 45 percent heavier after 90 kicks) and the breeze gets stronger. A ricochet off a wall keeps most of the ball's speed.`,
    'The breeze pushes the ball sideways. The strip at the top shows its strength and a short forecast.',
  ] },
  { title: 'Kicking', art: 'tap', p: [
    `The kid moves under the ball at about ${KID_SPEED} units per second. A kick is possible while the ball is below ${REACH_Y} units, not rising fast, and within ${REACH_X} units of the kid's feet.`,
    'The side of your tap, compared with the ball, sets the sideways push; the ball keeps a little of its old sideways speed, and a ball that is off-centre above the foot goes a little more to that side. Kicks that are not Perfect carry some wobble.',
    'Tapping too early, before the ball is in reach, costs a moment during which no kick is possible.',
  ] },
  { title: 'The three kicks', art: 'kinds', p: Object.values(KINDS).map((k) => `${k.name}: contact at about ${k.c.toFixed(2)} units high, launch speed ${k.vy}, sideways push up to ${k.aim}. Worth ${k.base} points.`).concat([
    'A Perfect kick has the ball within 0.25 units of the foot and within 0.12 units of the best height. It has no wobble, a little more lift and +10 points.',
  ]) },
  { title: 'Scoring', p: [
    'Each kick scores its base points plus 6 for each ricochet in the flight before it, times the style multiplier. The multiplier is 1 and rises by 0.25 for each different kind of kick among your last four, up to 1.5.',
    'A ricochet adds 5 points straight away (10 for the second in a flight, and so on). Each hoop is worth 50 plus 10 for each hoop before it in the chain (up to 100 extra).',
  ] },
  { title: 'Tricks', p: trickLines.concat(['Tricks are added to your points when they are completed.']) },
  { title: 'Modes', p: [
    'Street Run: no hoops, a streak of kicks as the alley narrows. Hoop Rally: one hoop at a time, each smaller than the last. Daily alley: the same breeze and hoops for everyone today, with your best saved for the day.',
    `Watch & Learn: the game plays ${SESSION} kicks of Hoop Rally and shows what it is thinking. It does not count towards bests or unlocks.`,
  ] },
  { title: 'Think', p: [
    'Think slows the game to about a third for 2.5 seconds and shows the arc and tap point of the best kick it can find. A run where you used it is practice and is not saved as a best.',
  ] },
  { title: 'Band colours', p: [
    'Six colourways of the ball are unlocked by milestones; choose one in Band colours. They change only the look.',
  ] },
  { title: 'Simplifications', p: [
    'The real game is played by several children who share one ball and make their own rules. This version is solo and adds the walls, the hoops and the points.',
  ] },
];
