// The text of the About, How to Play and Rules pages. Each section: { title, art?, p: [paragraphs] }.
// Numbers are read from the engine (sim.js) so the rules page cannot drift from the game.
import {
  FLAG_Z, RISE_T, FLINCH_T, STRIDE_MIN, RUSH, IDEAL_LO, IDEAL_HI, RUN_REACH, DIVE_REACH, DIVE_T, SLIDE_T, DOWN_T, TIERS, TIMEOUT, LANE_W,
} from './sim.js';

const ms = (s) => `${Math.round(s * 1000)}`;
const cm = (m) => `${Math.round(m * 100)}`;

export const ABOUT = [
  { title: 'Beach Flags', art: 'start', p: [
    'Beach flags is a sprint from the sand. Racers lie face down in a line with their backs to the course. At the whistle they spin, jump up, run about twenty metres and dive for a baton planted in the sand. There is always one baton fewer than racers, so the racer left without one is out, round after round, until a single racer holds the last flag.',
    'It is a core event of surf lifesaving carnivals in Australia, where it is run on the beach as a test of reflexes, speed and nerve, for all ages from juniors to masters.',
  ] },
  { title: 'About this version', p: [
    'This is a video game version for phones and tablets. You lie flat, wait for the whistle, spin up with a tap, run by tapping in a steady rhythm, steer by tapping towards the flag you want and dive with the DIVE button at the right moment.',
    'Simplifications: the real event is run in heats and finals with a set number of racers per round and official starters; here it is a knockout of rounds against rivals who think for themselves, with a Sudden Death final and a Daily Beach. Real beach flags also have rules about how a flag may be taken that are summarised on the Rules page.',
  ] },
  { title: 'Pictures and credits', p: [
    'All art and sound are drawn and synthesised in the game. The beach, the crowd and the racers are invented for the game. The event belongs to the living heritage of Australian beach and surf lifesaving culture; this game is not connected to any organisation. Beach Flags is part of the Arcforge collection of heritage games.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'flags', p: [
    'Be one of the racers who gets a flag. There is one flag fewer than racers, so one racer is out every round. Stay in until you hold the last flag of the cup.',
  ] },
  { title: 'Lie flat, then spin', art: 'start', p: [
    'At the start you lie face down with your back to the flags. Wait for the whistle, then tap once anywhere to spin and get up. Moving before the whistle is a caution and costs you half a second.',
  ] },
  { title: 'Run: tap in rhythm', art: 'rhythm', p: [
    'Every tap is a stride. Tap in a steady rhythm; the bar at the top shows the time since your last stride, and the gold window is the best rhythm. Tapping too fast wastes strength, too slowly lets your speed drain away.',
    'Keyboard: left and right arrows or A and D to stride and steer, Space to stride straight.',
  ] },
  { title: 'Steer by tapping', art: 'steer', p: [
    'Tap to the left or right of your runner to drift that way as you stride. Tap straight above your runner to run straight. Rivals fill the flags quickly: when your flag is taken, switch to another one.',
  ] },
  { title: 'Dive', art: 'dive', p: [
    'The DIVE button throws you forward with your arms stretched out. It reaches further than running, and a bit further to the side, but you cannot change your mind once you are in the air. Dive when the flag is close and not too far to the side.',
  ] },
  { title: 'Think and Watch & Learn', p: [
    'Think slows time for a moment and lights up the flag it suggests with the reason. A cup where you used Think is practice and is not saved as a best.',
    'Watch & Learn plays three final rounds for you. It stops at key moments to think, shows its choice, then acts. You can pause at any time.',
  ] },
];

export const RULES = [
  { title: 'Goal', art: 'flags', p: [
    `Each round has one baton fewer than racers, planted ${FLAG_Z} metres from the start line. Take a baton and you are safe; the racer who is left without one is out. Rounds repeat with one racer fewer until one flag and two racers remain: the winner of that last round wins the cup.`,
    `A round ends as soon as every baton has an owner. If the whistle was long ago and some flags are still free (${TIMEOUT} seconds), they go to the nearest racers.`,
  ] },
  { title: 'The start', art: 'start', p: [
    `Racers lie face down, backs to the course, lanes ${LANE_W.toFixed(2)} metres wide. The whistle blows at a random moment. A racer who moves before it has a caution: ${ms(FLINCH_T)} ms lying still before they can react again. After the whistle one tap spins you and takes ${ms(RISE_T)} ms to get up; your reaction time is the gap between the whistle and that tap.`,
  ] },
  { title: 'Running', art: 'rhythm', p: [
    `Each tap is one stride that adds speed; speed drains away continuously, so a steady rhythm holds it. Taps closer than ${ms(STRIDE_MIN)} ms together count as one. A stride after ${ms(RUSH)} ms or more has full strength and a quicker one loses power quickly. The best rhythm is between ${ms(IDEAL_LO)} and ${ms(IDEAL_HI)} ms between strides (the gold window).`,
    'Steering: a stride tapped to the side of your runner moves you sideways in that direction for a moment, at a small cost in strength. Runners who touch shoulder to shoulder push apart and both lose a little speed.',
  ] },
  { title: 'Taking a flag', art: 'dive', p: [
    `Running through a baton takes it if you pass within ${cm(RUN_REACH.side)} cm to the side (and no more than ${cm(RUN_REACH.fwd)} cm short of it). A dive takes it within ${cm(DIVE_REACH.side)} cm to the side and from ${cm(DIVE_REACH.fwd)} cm short of it.`,
    'If two racers reach the same baton in the same instant, the one further along wins it; then the lower lane.',
  ] },
  { title: 'Diving', art: 'dive', p: [
    `A dive lasts ${ms(DIVE_T)} ms in the air, then a ${ms(SLIDE_T)} ms slide, and you cannot steer or change your mind. How far it carries depends on your speed. After a dive that misses, you lie on the sand for ${ms(DOWN_T)} ms and may get up and chase a flag that is still free.`,
  ] },
  { title: 'Cups', p: [
    `Cups come in three tiers: ${TIERS.map((t) => `${t.name} (${t.n} racers)`).join(', ')}. Win a cup to open the next. You earn 100 points for each round you stay in, up to 60 for a quick reaction, 20 for a flag taken with a dive and 300 for winning the cup.`,
    'Sudden Death is one flag and two racers over and over: win a round to meet a faster rival and lose and the streak ends. The Daily Beach is the same Open Carnival field for everyone on the same day.',
  ] },
  { title: 'Think and Watch & Learn', p: [
    'Think slows the game to about a third for 2.5 seconds, lights up the flag it suggests and says why. A cup where you used it is practice and is not saved as a best.',
    'Watch & Learn plays the final three rounds of a cup and shows what it is thinking. It does not count towards bests or outfits.',
  ] },
  { title: 'Simplifications', p: [
    'The real event has officials, heats and several finals, and flags are taken by hand with rules about contact. Here the sand is one lane per racer, contact only pushes racers apart, and the finish is decided by the distance rules above.',
  ] },
];
