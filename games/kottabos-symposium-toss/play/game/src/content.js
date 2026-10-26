// Text pages: How to Play, About and Rules. Every number comes from sim.js so the pages cannot drift from the engine.
import {
  POINTS, NDROP, AIM, SWIPE, SNAP, DISTANCES, LENGTHS, LENGTH_NAMES, LEVELS, LADDER, MAX_EXTRA, DISC_T, MANES_DROP, BASIN, GAP, G, DISC, HAND, spreadOf,
} from './sim.js';

const pct = (x) => `${Math.round(x)} percent`;
const lo = spreadOf(0), hi = spreadOf(1);

export const HOWTO = [
  { title: 'The flick', art: 'swipe', text: [
    'Press anywhere in the room and slide your thumb toward the target, then lift. The slide is your flick: its direction sets the launch angle and its length sets the power. A dotted arc shows where the water will go.',
    `Finish the slide quickly. A quick snap keeps all ${NDROP} drops together in one tight stream; a lazy slide lets them spray apart. The Snap bar shows how clean your finger speed is right now.`,
    'You can slide, look at the arc, change your mind and slide back: nothing is thrown until you lift.',
  ] },
  { title: 'Discs and cups', art: 'disc', text: [
    `On a stand, a bronze disc is balanced on the top of a pole with a bronze dish hung beneath. Strike the edge of the disc with the stream so it rocks, tips off and falls onto the dish with a ring: a clang scores ${POINTS.clang}.`,
    `Hit it too hard and the disc is flung past the dish (knocked off, ${POINTS.off}); too softly and it only rocks (${POINTS.wobble}).`,
    `In a basin, little cups float and drift. Every drop that lands in a cup fills it; a full cup sinks and scores ${POINTS.bowl}.`,
  ] },
  { title: 'Think and learn', art: 'snap', text: [
    'Tap Think for a suggested flick. The computer simulates many flicks with a human hand and shows the one that scored best on average. Use this flick puts that aim into your hand.',
    'Your last stream stays on the screen as a faint ghost until the next flick, so you can see how far to correct.',
    'Watch & Learn lets two computer players play a whole match and explain every choice, with a real Pause so you can take your time.',
  ] },
];

export const ABOUT = [
  { title: 'About Kottabos', art: 'disc', text: [
    'Kottabos is a game of ancient Greece. In vase paintings from the sixth and fifth centuries before the common era, friends reclining on couches after a meal hook a finger through the handle of a shallow cup, snap the wrist, and flick the last drops at a target.',
    'There were two favourite targets: a small disc balanced on top of a tall stand, which had to be knocked off so that it fell on a bronze dish below with a clear ring, and little cups floating in a basin, which had to be sunk by the drops.',
    'This version shows the toss as a quiet game of skill. The cup holds water. It carries no toasts, no dedications and no stakes.',
  ] },
  { title: 'This version', text: [
    'Kottabos Symposium Toss is part of the Arcforge collection of world heritage games. It has no betting and no stakes, works offline and saves your records on your device.',
    'The drops are simulated one by one: they fly as real parabolas, the disc rocks on its support like a damped pendulum, and the cups bob and drift. The Rules pages list the numbers the engine uses.',
    'The look borrows from black-figure vase painting: terracotta, black glaze, a Greek key frieze. Text size can be set up to 300 percent in Settings and on every reading page.',
  ] },
];

export const RULES = [
  { title: '1. The goal', art: 'score', text: [
    `Each round shows one scene: one to three stands with a disc, or a basin of floating cups. Flick drops of water at it from your cup. A round gives each side a few flicks (3 on stands, 4 on a basin; 5 in the ladder), thrown one after another.`,
    'You may play the ladder alone, play the computer, pass the phone to a friend, or watch two computers play.',
  ] },
  { title: '2. The flick', art: 'swipe', text: [
    `Press and slide, then lift. Launch angle follows the direction of the slide, from ${AIM.aMin} to ${AIM.aMax} degrees. Power follows its length: a slide of ${SWIPE.lo} units or less is the weakest (${AIM.vMin} cm per second), ${SWIPE.hi} units or more the strongest (${AIM.vMax} cm per second). A touch that travels less than ${SWIPE.min} units is not a flick and cancels.`,
    `Your cup leaves the hand ${HAND.y} cm above the floor. Gravity is ${G} cm per second squared, and there is no wind.`,
    'Keyboard: Left and Right change power, Up and Down change angle, Space flicks, T asks for a hint, P pauses.',
  ] },
  { title: '3. The snap', art: 'snap', text: [
    `Each flick is ${NDROP} drops, leaving the cup ${Math.round(GAP * 1000)} milliseconds apart. How fast your finger is moving when you lift decides how well they hold together: at ${SNAP.slow} units per second or less they spray (about ${lo.sa.toFixed(1)} degrees and ${pct(lo.sv)} speed spread), at ${SNAP.fast} or more they stay in one stream (about ${hi.sa.toFixed(1)} degrees and ${pct(hi.sv)}).`,
    'Between those speeds the spread changes smoothly. Everyone also has a little tremor in the hand, which is why the same flick never lands exactly twice.',
  ] },
  { title: '4. Discs and dishes', art: 'disc', text: [
    `A disc rests on a pole at its support height. A dish hangs ${MANES_DROP} cm below it. A drop that strikes the disc adds a turning impulse about the support: the farther from the middle and the faster the drop, the more. The disc rocks like a damped pendulum (about ${(DISC.wn / (2 * Math.PI)).toFixed(1)} rocks per second).`,
    `When it tilts past ${Math.round((DISC.phiC * 180) / Math.PI)} degrees it slides off. If it lands on the dish it is a clang (${POINTS.clang}). If it has been flung wider than the dish it hits the floor: knocked off (${POINTS.off}). If it only rocked, it scores ${POINTS.wobble}.`,
    `Discs are ${DISC_T} cm thick. Smaller, heavier discs and smaller dishes are used on later rounds. After every flick the servant sets the disc back, so each flick faces the same stand.`,
  ] },
  { title: '5. Cups in the basin', art: 'basin', text: [
    `Cups float on the water of the basin (${BASIN.halfW * 2} cm across) and drift slowly from side to side, each on its own beat. A drop that falls into the mouth of a cup fills it; when its capacity is reached the cup sinks (${POINTS.bowl} points).`,
    `Sinking two or more cups with one flick adds ${POINTS.multi} for each extra cup. In the ladder, sinking every cup earns ${POINTS.clear} more and ${POINTS.spare} for each flick you did not need.`,
    'Cups stay partly full between flicks, within a round, so a side can finish what the other started. Sunk cups stay sunk until the round ends.',
  ] },
  { title: '6. Rounds and winning', art: 'score', text: [
    `A round is a few flicks each, thrown alternately. The side that did not start the previous round starts the next.`,
    `Match length: ${LENGTH_NAMES.map((n, i) => `${n} ${LENGTHS[i]} rounds`).join(', ')}. Rounds alternate between a stand and a basin and get harder. The highest total wins. A tie plays a sudden-death flick on a fresh stand, up to ${MAX_EXTRA} times, and then is a draw.`,
    `Distance: ${DISTANCES.map((d) => `${d.name} (${d.note})`).join(', ')}.`,
  ] },
  { title: '7. The Symposium Ladder', art: 'disc', text: [
    `${LADDER.length} levels, five flicks each, alternating stands and basins. Each level has three star scores. Score the first to unlock the next level; your best stars and scores are saved.`,
    `Levels: ${LADDER.map((l) => l.name).join(', ')}.`,
  ] },
  { title: '8. Opponents and simplifications', text: [
    `Computer levels: ${LEVELS.map((l) => l.name).join(', ')}. They differ in how clean their snap is, how steady their hand is, and how many options they simulate before choosing.`,
    'The traditional game had many local variants, calls and stakes. This version keeps the physical heart of the toss: a flick, a stream, a balanced disc and floating cups.',
  ] },
];
