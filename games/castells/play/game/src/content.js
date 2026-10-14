// The text of the About, How to Play and Rules pages. Each section: { title, art?, p: [paragraphs] }.
// Numbers here are read from the engine (sim.js) so the rules page cannot drift from the game.
import { RECIPES, ZONE, ALETA_SECS, ALETA_PERFECT, ALETA_GOOD, AID } from './sim.js';

export const ABOUT = [
  { title: 'Castells', art: 'tower', p: [
    'Castells are human towers, built in Catalonia in the north-east of Spain by teams called colles. Dozens of people stand on each other\'s shoulders tier by tier while a crowd around the base, the pinya, holds everything steady. The tradition dates from the 18th century and is recognised by UNESCO as intangible cultural heritage of humanity.',
    'The tower is crowned by a small child, the enxaneta, who climbs to the top and raises a hand in the aleta. A tower is only complete when it has been taken down again without falling.',
  ] },
  { title: 'About this version', p: [
    'This is a video game made for phones and tablets, a puzzle of strength, weight and nerve. You choose who stands where, tier by tier, then steady the tower while the children climb.',
    'The people, their names, weights and strengths are invented for the game. Real towers are built with training, helmets for the children and the care of the whole colla.',
    'Simplifications: the shoulder-to-shoulder structure is reduced to one rule (each tier carries what is above it, shared equally), and the real tower names and heights are kept but not every tower type is included.',
  ] },
  { title: 'With respect', p: [
    'Thank you to the colles of Catalonia and the families who keep this tradition alive. This game is not made by, or connected to, any colla.',
    'The square and the sound are made in the game; the people are 3D characters (see the credits). Castells is part of the Arcforge collection of heritage games.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'tower', p: [
    'Build a human tower from the bottom up. At every tier you pick the castellers who will stand there. When the tower is complete, the children climb it, the enxaneta crowns it, and you take it down without a fall.',
  ] },
  { title: 'Pick people for a tier', art: 'tray', p: [
    'Tap people in the tray to place them in the tier you are building; tap them again, or tap a slot, to take them out. Each person shows two numbers: ▲ how much weight they can hold and ▼ how much they weigh.',
    'The tier needs every casteller to hold the weight of everyone above, shared equally. The number at the top of the panel shows that weight. When the tier is full and everyone is strong enough, raise it.',
  ] },
  { title: 'Think about the order', art: 'load', p: [
    'The weight above a tier is everyone not yet placed, so heavy people low in the tower carry less. But the heaviest are not always the strongest, and strong people are needed at the base. Check the number as you choose.',
    'If you get stuck, lower the last tier and try again. Think shows a set of people that works for this tier.',
  ] },
  { title: 'Steady the tower', art: 'climb', p: [
    'When the tower is built the children climb. The tower leans on its own and every tier a child passes gives it a nudge. Hold the left or right pad to push it back; the marker on the gauge should stay in the green.',
    'The climb only moves while the tower is calm. If it leans too far, or stays shaky for too long, the tower falls.',
  ] },
  { title: 'The aleta and the descent', art: 'aleta', p: [
    'When the enxaneta reaches the top, tap Aleta! at a calm moment for a perfect aleta. Then keep the tower steady while the children come down.',
  ] },
  { title: 'Think and Watch & Learn', p: [
    'Think slows time for a moment and shows what a good crowd would do. A tower where you used Think cannot earn three stars.',
    'Watch & Learn builds a whole tower for you. It stops to think, shows its choice, then acts. You can pause at any time.',
  ] },
];

const recipeLine = RECIPES.map((r) => `${r.name}: ${r.n} castellers on each of ${r.m - 3} trunk tiers, plus the crown`).join('; ');
export const RULES = [
  { title: 'Goal', p: [
    'Raise a tower, crown it with the aleta and take it down without a fall. A tower earns up to three stars.',
  ] },
  { title: 'The towers', art: 'tower', p: [
    'A tower is named N de M: N castellers on every trunk tier and M tiers in all. The last three tiers are the crown, so a tower has M minus 3 trunk tiers.',
    `The campaign towers are: ${recipeLine}.`,
    'The trunk tiers from the bottom are Baixos, Segons, Terços, Quarts, Quints and Sisens. The crown is the dosos (two children), the acotxador (one child) and the enxaneta (one child).',
  ] },
  { title: 'People', art: 'tray', p: [
    'Every person has a weight and a strength, in kilograms. The trunk is built from adults; the four children are fixed for the tower and can only be placed in the crown.',
    'The tray lists everyone not yet placed. Sort it by strength or by weight. People who can never hold the current tier are greyed out.',
  ] },
  { title: 'The load rule', art: 'load', p: [
    'A tier carries everyone above it. That weight is shared equally by the castellers of the tier, so each one carries: the total weight above divided by the number of castellers in the tier.',
    'A person can stand in a tier only if their strength is at least that load. A tier can be raised only when it is full and everyone can hold it.',
    'The weight above includes every adult not yet placed and the four children. Putting a heavier person in a tier lowers the load on that tier, because they are no longer above it.',
    'In the crown, each of the dosos carries half of the acotxador and the enxaneta, and the acotxador carries the enxaneta.',
  ] },
  { title: 'Building', p: [
    'Choose the people for a tier and press the raise button. You can lower the last tier at any time to change your plan; the people go back to the tray.',
    'Every tower can be solved, but there is little strength to spare in the big ones, and the obvious plan of picking the strongest, or the heaviest, does not always work.',
    'Think shows a set of people that works for the tier you are building and keeps the tower solvable. Using it caps the tower at two stars.',
  ] },
  { title: 'The climb', art: 'climb', p: [
    `The tower has one lean, from the left edge of the gauge to the right edge. At a lean of 100 percent it falls. Left alone, the lean grows. The pinya pushes it back when you hold the left or right pad (about ${AID.toFixed(1)} units of lean per second per second).`,
    `The children climb one after another: the pair of dosos, then the acotxador, then the enxaneta. Every time a child passes a tier the tower gets a nudge to one side, and a slow drift pushes it around. The higher the climber, and the less spare strength the tower has, the more it wants to lean.`,
    `While the lean is below ${Math.round(ZONE.go * 100)} percent the child climbs at full speed; up to ${Math.round(ZONE.slow * 100)} percent it slows; above that the climb stops.`,
    `Tension rises slowly above ${Math.round(ZONE.watch * 100)} percent lean and fast above ${Math.round(ZONE.danger * 100)} percent, and drains when the tower is calm. When tension is full, or the lean reaches 100 percent, the tower falls (an intent desmuntat).`,
  ] },
  { title: 'The aleta', art: 'aleta', p: [
    `When the enxaneta is on top you have ${ALETA_SECS.toFixed(1)} seconds to tap Aleta!. If the lean and its speed together are below ${Math.round(ALETA_PERFECT * 100)} percent the aleta is perfect; below ${Math.round(ALETA_GOOD * 100)} percent it is good; otherwise it is shaky. If you do not tap in time the enxaneta makes a late aleta.`,
    'The tower is then loaded (carregat). Taking it down safely makes it unloaded (descarregat).',
  ] },
  { title: 'The descent', p: [
    'The children come down quickly. The tower still leans and gets small nudges, so keep steadying. If it falls now the tower stays carregat and earns one star.',
  ] },
  { title: 'Stars and unlocking', p: [
    'One star: crowned (carregat). Two stars: crowned and taken down (descarregat). Three stars: descarregat with a perfect aleta, without the lean ever passing 72 percent and without Think.',
    'A tower unlocks when the one before it has at least one star. Stars unlock colla shirt colours and squares in the Colla screen.',
  ] },
  { title: 'Modes', p: [
    'Campaign: the eight towers in order. Daily Castell: one tower for everyone each day, with its own puzzle. Free Build: a new puzzle on a tower you have reached, every time you play.',
    'Watch & Learn builds a campaign tower for you using the solver: it thinks, shows who it will place, places them, then steadies the tower itself. Pause stops everything where it is.',
  ] },
  { title: 'Controls', p: [
    'Touch: tap people and slots, hold the pads. Keyboard: Left/Right arrows or A/D to push, Space for the aleta, H for Think, P or Escape to pause, Enter to raise a tier, Backspace to lower.',
  ] },
];
