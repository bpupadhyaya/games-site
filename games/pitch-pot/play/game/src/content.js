// Text pages: How to Play, About and Rules. Every number comes from sim.js so the pages cannot drift from the engine.
import { POINTS, ARROWS_EACH, ARROW, DISTANCES, LENGTHS, LENGTH_NAMES, LEVELS, RIM_Y, MOUTH_R, NECK_R, EAR, MAX_EXTRA_ROUNDS, HAND, G } from './sim.js';

const cm = (n) => `${Math.round(n * 10) / 10} cm`;
const w2 = (r) => cm(r * 2);

export const HOWTO = [
  { title: 'The throw', art: 'throw', text: [
    'Press anywhere below the scores and slide your thumb. Slide down and to the left to pull the arrow back: a longer pull is a harder throw, a steeper pull is a higher arc. Lift your thumb to throw.',
    'The dotted line is the path the arrow will take. The small bar over the vase shows how far the arrow may drift from it, because no hand is perfectly steady. The arrow flies tip first and may bounce.',
    'Take your time. There is no clock on your throw.',
  ] },
  { title: 'Scoring', art: 'scoring', text: [
    `An arrow that comes to rest in the mouth of the vase scores ${POINTS.mouth}. If it touched the rim, the wall, an ear or the floor on the way in, it is a bounce-in and scores ${POINTS.bounce}.`,
    `An arrow that stands in one of the two ears scores ${POINTS.ear}. Put all ${ARROWS_EACH} of your arrows in the pot in one round and you earn ${POINTS.sweep} more.`,
    'Arrows that stay on the floor or lean outside score nothing, and they stay there until the round is over, where they can turn away your next throws.',
  ] },
  { title: 'Think and learn', art: 'vase', text: [
    'Tap Think for a suggested throw. The computer tries it with simulated arrows and tells you how often it finished in the pot. Use this throw puts the suggestion into your hand.',
    'Watch & Learn lets two computer players play a whole match and explain every choice, with a real Pause so you can take your time.',
  ] },
];

export const ABOUT = [
  { title: 'About Pitch-pot', art: 'vase', text: [
    'Pitch-pot, touhu (投壺) in Chinese and tuho (투호) in Korean, is an old throwing game for gatherings of friends: players stand at a line and pitch slender arrows into a narrow-necked bronze vase.',
    'It is known from the courts and scholars of ancient China and was taken up in Korea, where it is still played in heritage parks and at festivals, and in Japan as toko. Scores are given for arrows that stay in the mouth, for arrows that go through the ears of the vase, and for arrows that bounce back in.',
    'This version shows it as a quiet social game in a scholar\'s garden pavilion. It carries no ceremony and no stakes.',
  ] },
  { title: 'This version', text: [
    'Pitch Pot is part of the Arcforge collection of world heritage games. It has no ads, no betting and no stakes, works offline and saves your records on your device.',
    'Arrows are simulated as real rods: they tumble, bounce off the bronze, slide down the neck and lean on each other. The Rules pages list the numbers the engine uses.',
    'Text size can be set up to 300% in Settings and on every reading page.',
  ] },
];

export const RULES = [
  { title: '1. The goal', art: 'court', text: [
    `Two sides take turns pitching arrows into a bronze vase. Each round gives each side ${ARROWS_EACH} arrows, thrown one after another. Arrows score for finishing in the mouth, for bouncing in and for standing in an ear.`,
    'You may play the computer, pass the phone to a friend, or practise alone.',
  ] },
  { title: '2. The vase and the arrows', art: 'vase', text: [
    `The vase is ${cm(RIM_Y)} tall. Its neck is ${w2(NECK_R)} wide inside and its lip flares to ${w2(MOUTH_R)}. Two ear tubes stand against the neck, each a slot about ${cm(EAR.outer - 4.5 - 0.4)} wide and ${cm(EAR.yTop - EAR.yLow)} deep.`,
    `An arrow is ${cm(ARROW.L)} long. It leaves the hand ${cm(HAND.y)} above the floor, flies tip first and is pulled down by gravity (${G} cm per second squared).`,
  ] },
  { title: '3. Throwing', art: 'throw', text: [
    'Press and slide to change the throw; lift to release. The dotted line shows the planned path. Release must follow at least a short slide, so a stray touch does nothing.',
    'Hands are never exactly steady: every throw is scattered a little, more for weaker players. The bar above the mouth shows a typical spread.',
    `Distance is set in Settings or the set-up screen: ${DISTANCES.map((d) => `${d.name} (${d.note})`).join(', ')}.`,
  ] },
  { title: '4. Scoring', art: 'scoring', text: [
    `Mouth: an arrow whose tip or tail rests inside the vase scores ${POINTS.mouth}.`,
    `Bounce-in: if the arrow touched anything (rim, wall, ear, floor or another arrow) before its tip went below the rim, it is a bounce-in and scores ${POINTS.bounce} instead.`,
    `Ear: an arrow whose tip or tail rests inside an ear slot scores ${POINTS.ear}, whatever else it touched.`,
    `Sweep: a side that puts all ${ARROWS_EACH} of its arrows in the pot (mouth or ear) in one round scores ${POINTS.sweep} more.`,
  ] },
  { title: '5. How arrows behave', art: 'bounce', text: [
    'Arrows are rigid rods with friction. They glance off the lip, slide down the inside of the neck, stand against each other and can topple. An arrow counts when it has stopped moving.',
    'Arrows already lying in the pot or on the floor stay in play until the round ends and can block, deflect or prop up later throws.',
  ] },
  { title: '6. Rounds and winning', art: 'rounds', text: [
    `A round is ${ARROWS_EACH} arrows each, thrown alternately. The side that did not start the previous round starts the next. Arrows are collected after every round.`,
    `Court count: a set number of rounds (${LENGTH_NAMES.map((n, i) => `${n} ${LENGTHS.count[i]}`).join(', ')}); the highest total wins. A tie plays extra rounds, up to ${MAX_EXTRA_ROUNDS}, and then is a draw.`,
    `Tally race: the first side to the target (${LENGTH_NAMES.map((n, i) => `${n} ${LENGTHS.race[i]}`).join(', ')}) wins at once, even in the middle of a round.`,
  ] },
  { title: '7. Levels, practice and simplifications', text: [
    `Computer levels: ${LEVELS.map((l) => l.name).join(', ')}. They differ in how steady their throws are and how many options they test before choosing.`,
    `Practice is three rounds of ${ARROWS_EACH} arrows on your own. Your best score is saved.`,
    'The traditional game uses a longer line, a richer set of named scores and scoring sticks; this version keeps the arrows honest and the scoring clear.',
  ] },
];
