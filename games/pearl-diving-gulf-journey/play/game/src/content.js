// The About, How to Play and Rules pages. Every number on the Rules page is read from consts.js, so the page cannot drift from the engine.
import * as K from './consts.js';
import { EVENTS } from './events.js';
const { DIVE, BANKS, WINDS, PROVS, SIZES, SHAPES, LUSTERS, COLOURS } = K;
const pc = (x) => `${Math.round(x * 100)}%`;

export const ABOUT = [
  { title: 'Pearl Diving', p: [
    'A season on a pearling boat in the Arabian Gulf, in the summer of 1924, before oil changed the coast. You are Yusuf, sixteen, signed on to a dive boat from Muharraq in Bahrain.',
    'You sing with the crew, dive on a single breath, haul your partner up the rope, open the shells at dusk and decide what to sell, what to repay and what to keep for a necklace.' ] },
  { title: 'About the story', p: [
    'The pearling season (the long season on the pearl banks) was the heart of life on the Gulf coast for centuries. Crews were ghawwas (divers), saibs (rope-pullers), the nahham who sang to keep the work in time, a cook and the nakhuda, the captain. Most divers worked on an advance and many families carried the debt from one season to the next.',
    'This is a fiction built on those real roles and rhythms. The names, the boat and the events are invented. The numbers are simplified so the game is playable. Nothing in it is meant to be shocking: the hardship is told plainly and gently.' ] },
  { title: 'Made with', p: ['Arcforge: World Heritage Games. The 3D scenes use a shared presentation layer; its credits are listed below.'] },
];

export const HOWTO = [
  { title: 'A season', p: [
    `A season is ${K.TRIPS} trips of ${K.DAYS} days at sea. After each trip the boat returns to Muharraq: you sell pearls, repay the advance and look after your family. After the last trip you get a settlement, a score and a journal.`,
    'Each day has the same steps: Plan, Song, Dive, Haul, Open, Tale.' ] },
  { title: 'Plan', p: [
    'Read the wind, your stamina and the crew\'s spirit. Pick a pearl bank: shallow, middle or deep. The deeper the bank, the better the shells and the harder the dive. Or take a rest day.' ] },
  { title: 'Song', p: [
    'Khalifa calls a pattern of drum marks. Then it is your turn: tap the same pattern on the same beats. A good song raises the crew\'s spirit, which gives you a little more air and a steadier haul. You can skip it.' ] },
  { title: 'Dive', p: [
    'First hold BREATHE. The gauge fills slowly. Let go while the needle is in the green band.',
    'Then you ride the stone to the seabed. Tap a shell bed on the chart to swim to it. At the bed, tap PICK when the closing ring meets the shell. The nearer to the mark, the cleaner and quicker the pick.',
    'Your breath ring shrinks. The line on it shows the air you need to come back up. Tap SIGNAL to tug the rope and be hauled up before it gets there.' ] },
  { title: 'Haul', p: [
    'Now you are the rope-puller. Wait for Salim\'s tug, then tap HAUL as each beat ring closes. Steady pulls bring him up calmly and he gives you a shell or two from his basket.' ] },
  { title: 'Open and tale', p: [
    'At dusk tap each shell to open it. Some hold a pearl; old pale shells more often. Every pearl is graded. Then comes an evening tale with a choice that can change your money, stamina, spirit or standing.' ] },
  { title: 'The harbour', p: [
    'At the end of a trip you sell pearls or hold them for a later market, give your family what they need, repay the advance and choose the next trip\'s provisions. Pearls you place on the necklace are kept, not sold.' ] },
  { title: 'Watch & Learn and Think', p: [
    'Watch & Learn plays a sample day for you and explains each choice. Pause it at any time. Think gives you a coach\'s hint on any decision.' ] },
];

export function rules() {
  const bk = (b) => `${b.name}: ${b.depth} m, richness ${b.rich.toFixed(2)}, ${b.beds} shell beds of 1 to ${b.nMax} shells.`;
  return [
    { title: 'The season', p: [
      `The season has ${K.TRIPS} trips of ${K.DAYS} days at sea (${K.TRIPS * K.DAYS} days). You start owing an advance of ${K.START_DEBT} rupees with ${K.START_CASH} rupees in your pocket, stamina ${K.MAX_STAM}, and the crew\'s spirit in the middle.`,
      'This is a simplified account of the historical pearling season. The real trade had many more roles, prices and customs; the game keeps the shape of them.' ] },
    { title: 'A day at sea', art: 'day', p: [
      'Each day runs: Plan, Song, Dive, Haul, Open, Tale. A rest day skips everything except the Tale. After the Tale the night restores stamina by the amount of your provisions, and spirit drifts back towards its middle.' ] },
    { title: 'Wind', p: [
      ...WINDS.map((w) => `${w.name}: air ${pc(w.cap)}, effort ${pc(w.tire)}, hauling ${pc(w.haul)}.`),
      'A day\'s wind is fixed when the trip starts. In a shamal the deep bank is closed. A storm sign in the evening can make tomorrow a shamal.' ] },
    { title: 'Pearl banks', art: 'banks', p: [
      ...BANKS.map(bk),
      'Richness multiplies the chance that a shell holds a pearl. The deep bank also gives larger pearls. You cannot dive at the middle or deep bank with stamina below 25.' ] },
    { title: 'Song', p: [
      'There are two rounds. In each, the nahham calls a pattern of 3 (then 5) marks on an 8-beat bar; you tap it back on the same beats. A tap within 0.09 s of a mark is Perfect (1 point), within 0.2 s Good (0.6). An extra tap costs 0.08. Your score is the average of the two rounds.',
      'Spirit rises by 4 plus 14 times your score (nothing if you skip).' ] },
    { title: 'Breath-up', art: 'breath', p: [
      `Hold BREATHE: the gauge fills in ${DIVE.inhale} s. Release in the green band (${Math.round(DIVE.zone[0] * 100)}% to ${Math.round(DIVE.zone[1] * 100)}%) for the best air (+20%). Releasing early gives less (down to -20%); letting it pass 93% makes you dizzy (-10% and a little extra effort).`,
      `Your breath in seconds is ${DIVE.baseCap} times (0.65 + 0.35 x stamina) times (0.94 + 0.1 x spirit) times the wind, times the breath-up.` ] },
    { title: 'On the seabed', art: 'ring', p: [
      `You ride the stone down at ${DIVE.descend} m/s. Swimming along the bed is ${DIVE.swim} m/s. Breath runs down one second per second. Tap a bed on the chart to swim to it; when you arrive the pick ring starts (${DIVE.ring} s per cycle).`,
      `Tap PICK as the ring meets the shell. Within ${DIVE.perfect} of the mark: Perfect (${DIVE.pickTime.perfect} s). Within ${DIVE.good}: Good (${DIVE.pickTime.good} s). Otherwise Rough (${DIVE.pickTime.rough} s) and a ${pc(DIVE.roughLoss)} chance the shell breaks. A bed holds 1 to 3 shells.` ] },
    { title: 'Coming up', p: [
      `The rope-puller hauls at ${DIVE.ascend} m/s (changed by spirit and wind). The ascent time is shown as a line on your breath ring.`,
      `Signal with at least ${DIVE.clean} s to spare for a clean surface. Signalling later is a tight surface (+${DIVE.stamTight} effort). If you do nothing, the puller hauls you up when only ${DIVE.auto} s remain (+${DIVE.stamAuto} effort, spirit -3). The game never lets you run out of air.`,
      `Effort (stamina lost) for a dive is ${DIVE.stamBase} + ${DIVE.stamDepth} x depth, times the wind, plus the penalties above.` ] },
    { title: 'Hauling', p: [
      `When you haul Salim, each tap on the beat adds a pull. A pull within 0.1 s of the beat is Perfect (1), within 0.2 s OK (0.75), otherwise Weak (0.4). The beat is every 0.6 s. He needs about as many pulls as the ascent takes in beats.`,
      `He surfaces smooth (at least 1 s of air left), tight, or late. A smooth haul gives you 1 shell from his basket, or 2 if 70% of your pulls were Perfect. A late haul tires Salim and costs spirit. Hauling costs ${DIVE.haulStam} stamina.` ] },
    { title: 'Opening shells', art: 'pearls', p: [
      `Each shell holds a pearl with probability ${pc(K.PEARL_CHANCE)} times the bank\'s richness. An old, pale shell has ${K.OLD_MUL} times the chance and tends to larger pearls. About ${pc(K.OLD_CHANCE)} of shells are old.`,
      `Size: ${SIZES.map((s) => s.name).join(', ')}. Shape: ${SHAPES.map((s) => s.name).join(', ')}. Luster: ${LUSTERS.map((s) => s.name).join(', ')}. Colour: ${COLOURS.map((s) => s.name).join(', ')}.` ] },
    { title: 'Pearl value', p: [
      `Value in rupees = base for the size (${SIZES.map((s) => `${s.name} ${s.base}`).join(', ')}), a little more for the larger millimetre sizes, times shape (${SHAPES.map((s) => `${s.name} ${s.mul}`).join(', ')}), luster (${LUSTERS.map((s) => `${s.name} ${s.mul}`).join(', ')}) and colour (${COLOURS.map((s) => `${s.name} ${s.mul}`).join(', ')}).` ] },
    { title: 'The harbour market', p: [
      `The merchant pays the pearl\'s value times a price index for the trip (about 0.9 to 1.2, different each season) plus ${pc(K.STANDING_BONUS)} for each point of your standing (up to 6). The boat keeps ${pc(K.BOAT_SHARE)} of every sale for the boat and the crew pot; the rest is yours.`,
      'You may hold pearls for a later market, except at the last market of the season, where everything not on your necklace is sold.' ] },
    { title: 'Money and family', p: [
      `After a sale you divide your money between repaying the advance, your family (${K.FAMILY_NEED} rupees a trip, less anything you already sent home) and, if you like, a gift of ${K.GIFT} rupees to the community (+1 standing). What is left stays in your pocket.`,
      'If you give your family less than they need they feel the strain (+1; +2 if you gave less than half). The advance has no interest; what you do not repay carries over to the next season.' ] },
    { title: 'Provisions', p: [
      ...PROVS.map((p) => `${p.name}: ${p.cost} rupees, restores ${p.rest} stamina each night${p.spirit ? `, spirit +${p.spirit}` : ''}.`),
      'If you cannot afford the pot the cook puts it on the ledger and your debt grows by the shortfall. Learning a trick from the cook can make a pot cheaper.' ] },
    { title: 'Tales', p: [
      `There are ${EVENTS.length} evening tales, each told once a season, with two or three choices. A tale can change cash, stamina, spirit, standing and the debt. One in five evenings is a quiet note instead.` ] },
    { title: 'The necklace', art: 'necklace', p: [
      `Place up to ${K.HIDE} pearls on the necklace; they are no longer sold. Harmony is 50% how well the sizes grow towards the middle, 30% how many share the same colour and 20% luster. A necklace is worth the sum of its pearls times (1 + 0.5 x harmony).`,
      'Arrange sorts the pearls with the largest in the middle.' ] },
    { title: 'Score and stars', p: [
      `Score out of 100: up to 40 for the advance repaid, 20 for the family (5 off per strain), up to 10 for standing, up to 15 for the necklace and up to 15 for the money left (full marks at 250 rupees).`,
      `Stars: 1 star from 0, 2 from ${K.STAR_AT[1]}, 3 from ${K.STAR_AT[2]}, 4 from ${K.STAR_AT[3]}, 5 from ${K.STAR_AT[4]}.` ] },
    { title: 'Ending without a win', p: [
      'There is no losing screen. If the season does not cover the advance, the epilogue says so plainly and the remaining debt would carry to the next season, as it did for many divers. You can always begin a new season.' ] },
  ];
}
export const RULES = rules();
