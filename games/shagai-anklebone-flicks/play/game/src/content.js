// Reference text for the How to Play, About and Rules screens. The pages are paginated automatically for the current text
// size (text.js paginate), so a section can be any length. EVERY rule claim and number below is cross-checked against
// rules.js (the single source of truth) and the ride flow in game.js; the numbers are built from rules.js so they cannot
// drift. `art` names a picture drawn by view.js (drawRulesArt) with the game's own bones, tokens and trail.
import { FACE_NAMES, FACE_VALUE, FACE_WEIGHT, SAME_BONUS, FULL_HERD_BONUS, FINISH, TOSSES, BUMP_BACK, WIND_FWD, BURROW_BACK, TILES } from './rules.js';

const at = (kind) => Object.entries(TILES).filter(([, k]) => k === kind).map(([i]) => i).join(', ');
const val = FACE_VALUE, wt = FACE_WEIGHT;

export const HOW = [
  { h: 'The race', art: 'trail', p: [
    `Your bone-horse and your rivals race along the felt trail from the start to the finish line at station ${FINISH}. The first to reach it wins.`,
    'On your turn you make one ride: toss four ankle bones, decide, and gallop.',
  ] },
  { h: 'Toss the bones', art: 'faces', p: [
    'TAP or SWIPE UP on the felt mat to toss the four bones. Each bone lands showing Horse, Camel, Sheep or Goat.',
    `Each side is worth strides: Horse ${val[0]}, Camel ${val[1]}, Sheep ${val[2]}, Goat ${val[3]}. Horse and Camel are the rarer sides.`,
  ] },
  { h: 'Hold and toss again', art: 'hold', p: [
    `TAP a bone to HOLD it. Then press Toss again to toss only the bones you did not hold. You may toss again up to ${TOSSES - 1} times in a ride.`,
    'When you are happy with the bones, press Gallop. Or press Hint to see what the computer would do and why.',
  ] },
  { h: 'Matching sides', art: 'pair', p: [
    `Bones that show the same side earn a bonus: a pair +${SAME_BONUS[2]}, three alike +${SAME_BONUS[3]}, four alike +${SAME_BONUS[4]}. One of each side (a full herd) earns +${FULL_HERD_BONUS}.`,
    'The strides and the station you would reach are shown before you gallop.',
  ] },
  { h: 'Special stations', art: 'tiles', p: [
    `Tailwind pushes you ${WIND_FWD} on. A marmot burrow drops you back ${BURROW_BACK}. A stream leaves you one fewer toss next ride. A camp gives you one extra toss next ride.`,
    `End your gallop on a rival and you flick them back ${BUMP_BACK} stations.`,
  ] },
  { h: 'Auto Play', p: [
    'Auto Play (Watch & Learn) on the menu plays a whole race by itself: the computer thinks, shows its choice, then acts, and explains why. You can pause it at any time and change its thinking time.',
  ] },
];

export const ABOUT = [
  { h: 'About Shagai', p: [
    'Shagai are the ankle bones of sheep. For generations Mongolian families have played with them: tossing them like dice, flicking them at targets and racing little herds of them across the table.',
    'Every bone has four different sides, traditionally named after the animals of the herd: horse (morin), camel (temee), sheep (khoni) and goat (yamaa).',
  ] },
  { h: 'This version', p: [
    'This game is an original design inspired by that tradition. It is not the rules of one particular traditional game: it takes the four sides, the horse-race spirit and the feel of the felt mat, and builds a quick race around one question: keep what you tossed, or toss again for more?',
    'The trail winds across a summer steppe past felt tents, tailwinds, marmot burrows and streams. Race one to three computer riders, ask for a Hint whenever you like, or watch a whole race with Auto Play.',
  ] },
  { h: 'Play and wellness', p: [
    'There is no betting and nothing is staked: you play for the finish line. Text size can be raised to 300% in Settings and on every reading page, and Reduced motion calms the animation.',
  ] },
];

export const RULES = [
  { h: 'Goal and players', art: 'trail', p: [
    `Race your bone-horse from station 0 (the start) to station ${FINISH} (the finish). The first rider to reach or pass station ${FINISH} wins immediately.`,
    'Two to four riders take part: you and one to three computer riders. Riders take turns in order, you first. Each turn is one ride.',
    'The riders are numbered 1 to 4 and also have their own colours: blue, red, gold and green. Rider 1 is you.',
  ] },
  { h: 'The four sides', art: 'faces', p: [
    `Every bone shows one of four sides when it lands: ${FACE_NAMES.join(', ')}.`,
    `Chance of each side on one bone: Horse ${wt[0]}%, Camel ${wt[1]}%, Sheep ${wt[2]}%, Goat ${wt[3]}%. Every bone is tossed independently.`,
    `Strides for each side: Horse ${val[0]}, Camel ${val[1]}, Sheep ${val[2]}, Goat ${val[3]}. A bone's strides are added to the others in the ride.`,
  ] },
  { h: 'Matching sides (combinations)', art: 'pair', p: [
    `After the strides are added, matching sides earn a bonus, counted separately for each side: two bones alike +${SAME_BONUS[2]}, three alike +${SAME_BONUS[3]}, four alike +${SAME_BONUS[4]}.`,
    `Two pairs earn both pair bonuses (+${SAME_BONUS[2] * 2}).`,
    `One bone of each of the four sides, called a full herd, earns +${FULL_HERD_BONUS}.`,
    'The total of the strides and the bonuses is the length of your gallop. The read-out above the mat always shows the total for the bones as they lie.',
  ] },
  { h: 'A ride, step by step', art: 'hold', p: [
    '1. Toss: TAP or SWIPE UP on the mat. All four bones are tossed.',
    `2. Decide: tap bones to hold them, then press Toss again, which tosses only the bones you did not hold. You have ${TOSSES} tosses in a ride: the first and up to ${TOSSES - 1} more. Toss again is not available when every bone is held or you are out of tosses.`,
    '3. Gallop: press Gallop to ride the total strides. When you have no tosses left the game gallops for you (this can be turned off in Settings).',
    'A held bone keeps its side. You may release a held bone again before you toss.',
  ] },
  { h: 'Galloping', art: 'bump', p: [
    'Your bone-horse moves forward as many stations as your total strides. Other riders\' positions never block you: riders may share a station.',
    `If you reach or pass station ${FINISH} you win; stations beyond the finish are not needed and there is no exact roll.`,
  ] },
  { h: 'Special stations', art: 'tiles', p: [
    'Only the station where your gallop ends counts; stations you pass over do nothing. An effect happens once and never chains into another station.',
    `Tailwind (stations ${at('wind')}): you are carried ${WIND_FWD} stations forward.`,
    `Marmot burrow (stations ${at('burrow')}): you slip ${BURROW_BACK} stations back, never below the start.`,
    `Stream (stations ${at('stream')}): you stay put, but your next ride has one fewer toss (${TOSSES - 1} instead of ${TOSSES}).`,
    `Camp (stations ${at('camp')}): you stay put, and your next ride has one extra toss (${TOSSES + 1} instead of ${TOSSES}).`,
    'A stream or camp lasts for one ride only. If a tailwind carries you to the finish, you win.',
  ] },
  { h: 'Flicking a rival back', art: 'bump', p: [
    `After any special-station effect, look at the station where you finally stand. Every rival standing exactly there is flicked back ${BUMP_BACK} stations (never below the start).`,
    'A rival who is flicked back does not trigger any station effect and does not lose a ride.',
    'Landing on the start station (0) is not possible, since a gallop always moves forward.',
  ] },
  { h: 'Winning and ranking', art: 'trail', p: [
    'The race ends the moment a rider reaches the finish. That rider is first.',
    'The other riders are ranked by how far along the trail they stand; if two stand on the same station the lower rider number ranks higher.',
    'Races played and races won are kept on this device. Nothing is staked or won other than the race.',
  ] },
  { h: 'The computer riders', p: [
    'Easy riders often hurry or hold bones at random. Steady riders always pick the choice with the best expected strides. Sharp riders also read the trail: they steer toward tailwinds, camps and bumps and away from burrows and streams. Mixed gives each computer rider a different level.',
    'The Hint button and Auto Play use the same planner as the Sharp rider.',
  ] },
  { h: 'Hint and Auto Play', p: [
    'Hint shows the choice the planner prefers right now, sets the holds for you and explains it in words. You may ignore it.',
    'Auto Play (Watch & Learn) plays a whole race between computer riders. Each choice has three steps: Think (2 to 10 seconds, set in Settings), Reveal (2 seconds: the held bones are shown and the choice is explained) and Act. Pause freezes everything exactly where it is. Auto Play is silent and is never counted in your stats.',
  ] },
  { h: 'Text size and controls', p: [
    'Touch: swipe up or tap the mat to toss, tap a bone to hold it, press the large buttons to toss again or gallop.',
    'Keyboard: Space or Enter tosses or confirms, keys 1 to 4 hold a bone, T tosses again, G gallops, H gives a hint, Escape opens the menu.',
    'Text size goes up to 300% in Settings and with the A- and A+ buttons on every reading page.',
  ] },
];
