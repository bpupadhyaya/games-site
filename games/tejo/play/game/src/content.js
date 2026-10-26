// Text pages: How to Play, About and Rules. Every number comes from sim.js so the pages cannot drift from the engine.
import { RING, DISC_R, BOX, MECHA, POINTS, DISCS_EACH, TARGETS, TREMOR_START, LEVELS } from './sim.js';

const cm = (n) => `${n} cm`;
const diam = (r) => cm(r * 2);

export const HOWTO = [
  { title: 'Your throw', art: 'aim', text: [
    'Press anywhere on the screen and slide your thumb. A target mark moves over the clay box. Slide up for a longer, harder throw, sideways to aim left or right.',
    'Lift your thumb to throw. The disc flies in a high arc and lands where the mark was, give or take a little scatter. The dashed circle around the mark shows how much.',
    `Do not hold on for too long: after about ${TREMOR_START} seconds your hand starts to shake and the mark wobbles.`,
  ] },
  { title: 'Scoring', art: 'scoring', text: [
    `Drop a disc into the brass ring for ${POINTS.ring}. Land on a paper mecha and it bursts into confetti for ${POINTS.pop}. A disc that does both is a moñona: ${POINTS.ring + POINTS.pop}.`,
    `When all ${DISCS_EACH * 2} discs of a round are thrown, the disc nearest the ring earns ${POINTS.mano} more point.`,
    `First side to ${TARGETS[0]}, ${TARGETS[1]} or ${TARGETS[2]} points wins.`,
  ] },
  { title: 'Think and learn', art: 'mano', text: [
    'Tap Think for a suggested mark. The computer tests the throw with simulated discs and tells you what it found.',
    'Watch & Learn lets two computer players show a whole match with their reasoning, and a real Pause so you can take your time.',
  ] },
];

export const ABOUT = [
  { title: 'About Tejo', art: 'court', text: [
    'Tejo, also called turmequé, is the national sport of Colombia. Players pitch a heavy metal disc along a lane at a box of clay and try to drop it into a metal ring set in the clay.',
    'It is closely tied to the town of Turmequé in the Boyacá highlands and is said to descend from an older game of the Muisca people. Clubs and courts all over Colombia keep it alive today, with leagues and a national federation.',
    'The traditional game puts small paper packets on the ring that crack when a disc strikes them. In this version they are harmless paper mechas that burst into confetti with a pop.',
  ] },
  { title: 'This version', text: [
    'Tejo is part of the Arcforge collection of world heritage games. It has no betting and no stakes, works offline and saves your records on your device.',
    'The rules are a clear, simplified version of the real game: Rules lists every number the engine uses.',
    'Text size can be set up to 300% in Settings and on every reading page.',
  ] },
];

export const RULES = [
  { title: '1. The goal', art: 'court', text: [
    `Two sides take turns throwing steel discs at a clay box. Points come from dropping a disc in the ring, bursting paper mechas and owning the disc nearest the ring. The first side to reach the target score wins. The target is ${TARGETS.join(', ')} points (Quick, Standard, Classic).`,
    'Play against a computer opponent, pass the phone to a friend, or practise alone.',
  ] },
  { title: '2. The court and the box', art: 'court', text: [
    `The box is ${cm(BOX)} square of clay. Distances on this page are in centimetres on the clay. The brass ring sits near the middle: its hole has a radius of ${cm(RING.hole)}, so it is ${diam(RING.hole)} across, and its brass band reaches out to ${cm(RING.outer)}.`,
    `A disc is ${diam(DISC_R)} across. Two paper mechas sit on the inside edge of the ring, one on the far side and one on the near side. They are replaced at the start of every round.`,
  ] },
  { title: '3. Throwing', art: 'aim', text: [
    'Press anywhere and slide to move the target mark. Lift to throw. A throw never goes exactly where you aimed: it lands within a small scatter, shown by the dashed circle.',
    `The scatter grows when the mark is higher on the box (a long throw) and shrinks when it is lower. If you hold for more than ${TREMOR_START} seconds your hand begins to shake, so decide and let go.`,
    'A mark above the box or beside it is a miss. The disc leaves play and scores nothing.',
  ] },
  { title: '4. Scoring', art: 'scoring', text: [
    `Ring: a disc whose centre lands within ${cm(RING.tol)} of the ring centre drops in. It scores ${POINTS.ring} and is lifted out.`,
    `Pop: each paper mecha the disc touches bursts and scores ${POINTS.pop}. A mecha is touched when the disc centre passes within ${cm(MECHA.hit)} of it, while landing or sliding. A disc can pop both mechas.`,
    `Moñona: a ring and a pop with the same disc scores ${POINTS.ring + POINTS.pop} in total.`,
    `Closest: after the last disc of the round, the disc nearest the ring centre scores ${POINTS.mano} for its side. A dead tie scores nothing.`,
  ] },
  { title: '5. The rim', art: 'rim', text: [
    `A disc whose centre lands between ${cm(RING.tol)} and ${cm(RING.kick)} of the ring centre hits the hard brass rim and is kicked straight outward, away from the ring. It can burst a mecha on the way.`,
    'A disc that lands beyond the rim stays where it lands and slides a short way in the direction it was thrown. Long, fast throws slide further than short ones.',
  ] },
  { title: '6. Shoves', text: [
    `A disc that finishes within ${diam(DISC_R)} of another disc shoves it away. A shoved disc moves a few centimetres, and one that is pushed off the clay leaves play.`,
    'A disc that drops in the ring does not shove anything.',
  ] },
  { title: '7. Closest disc', art: 'mano', text: [
    'The closest disc is measured when all six discs of the round have been thrown, from the ring centre to the disc centre.',
    'Knocking away the rival\'s nearest disc, or moving yours close, is often worth more than a risky shot at the ring.',
  ] },
  { title: '8. Rounds and winning', art: 'rounds', text: [
    `A round is ${DISCS_EACH} discs each, thrown by turns. The side that did not start the previous round starts the next one. The two mechas return at the start of every round and the box is cleared.`,
    `The match ends the moment a side reaches the target. A pop or a ring that takes a side over the target wins at once.`,
  ] },
  { title: '9. Levels, practice and simplifications', text: [
    `Computer levels: ${LEVELS.map((l) => l.name).join(', ')}. They differ in how steady their throws are and how carefully they choose a mark. Practice is twelve discs on your own: score what you can from three rounds of four discs.`,
    'The real game is played on a longer lane, with more mechas and usually in teams; this version keeps the lane short, the scoring simple and the physics honest.',
  ] },
];
