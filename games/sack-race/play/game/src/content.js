// The text of the About, How to Play and Rules pages. Each section: { title, art?, p: [paragraphs] }.
// Numbers are read from the engine (sim.js) so the rules page cannot drift from the game.
import {
  LEN, DAILY_LEN, AIR_T, EARLY, LATE_OK, LATE_SPAN, TARGET, FALL_FWD, FALL_BACK, DOWN_T, RISE_T, SHAKE, HEATS, RUT_KICK, KICK,
  MUD_SLOW, PERFECT_MIN,
} from './sim.js';

const deg = (r) => `${Math.round((r * 180) / Math.PI)}`;
const ms = (s) => `${Math.round(s * 1000)}`;

export const ABOUT = [
  { title: 'Sack Race', art: 'sack', p: [
    'Sack racing is one of the oldest contests of the village fair. Each runner stands inside a sack, holds its rim at the waist and hops to the finish line. First across wins, and a good share of the fun is the tumbling.',
    'In Indonesia it is called balap karung and is a favourite of community festivals and holiday celebrations, run along village roads and school grounds. In Britain it has long been a fixture of school sports days, summer fairs and county shows. Versions are played in many other countries too.',
  ] },
  { title: 'About this version', p: [
    'This is a video game version for phones and tablets. A race is a short sprint down a lane on a village green, with the crowd behind the rope, bunting overhead and three rivals in the other lanes.',
    'Simplifications: the real contest has dozens of children on a long, bumpy field and the whole body keeps its balance; here four runners race a short course and balance is a single lean that your taps control.',
  ] },
  { title: 'Pictures and credits', p: [
    'The village green, the crowd and the sacks are built for the game and the sound is synthesised in it. The runners are 3D athletes from the Arcforge person library, posed by the game for every hop, landing and fall; the credits and licences for that library are listed below. Sack Race is part of the Arcforge collection of heritage games.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'overview', p: [
    `Hop ${LEN} metres in your sack and cross the line first. You hop by tapping; where you tap decides how your body leans.`,
  ] },
  { title: 'Tap right to push, tap left to rock back', art: 'taps', p: [
    'Every tap is one hop. Tap on the RIGHT half of the field to push your body forward, on the LEFT half to rock it back. Keyboard: right and left arrow, or D and A.',
    'Tap again just as your feet touch down for the strongest hop. The gold zone on the balance gauge is the fastest lean: a little forward.',
  ] },
  { title: 'Keep your balance', art: 'balance', p: [
    'The gauge at the top shows your lean. Leaning too far forward and you pitch onto your face; too far back and you sit down hard. Rock the other way before you go over.',
    'Tapping the same side again and again tips you over. Mostly you will alternate, and sometimes tap the same side twice to correct a lean.',
  ] },
  { title: 'Ruts and mud', art: 'ruts', p: [
    'A rut throws you the way its arrow points when you land on it. Lean the other way a hop earlier. Mud slows the sack: land square and keep tapping.',
  ] },
  { title: 'Think and Watch & Learn', p: [
    'Think slows time for a moment and lights the side to tap, with the reason. A race where you used Think is practice and is not saved as a best.',
    'Watch & Learn plays a whole race for you. It stops at key moments to think, shows its choice, then acts. You can pause at any time.',
  ] },
];

export const RULES = [
  { title: 'Goal', p: [
    `Be first across the line. Race, Heat and Daily Field are ${LEN} metres (Daily is ${DAILY_LEN}) with three rivals in the other lanes. Clock Run is you alone against your best time, shown as a ghost.`,
    'Your time starts at the whistle. Tapping before the whistle does nothing.',
  ] },
  { title: 'Hopping', art: 'taps', p: [
    `Each tap makes the runner hop; a hop lasts ${AIR_T.toFixed(2)} seconds in the air. A tap in the last ${ms(EARLY)} ms of flight is kept and fires the moment the feet land; an earlier tap is ignored.`,
    `A hop is perfect when the tap comes up to ${ms(EARLY)} ms before landing or within ${ms(LATE_OK)} ms after it. After that the hop weakens steadily and has no strength left ${ms(LATE_OK + LATE_SPAN)} ms after landing. Standing for a moment also steadies the body, at the cost of speed.`,
    `A perfect landing counts when its quality is at least ${Math.round(PERFECT_MIN * 100)} percent.`,
  ] },
  { title: 'Lean', art: 'balance', p: [
    `Your body is balanced like a pole: the further it leans, the faster it falls. A tap on the right adds forward spin, a tap on the left adds backward spin (strength ${KICK.toFixed(1)}). The gauge shows the lean.`,
    `The fastest lean is about ${deg(TARGET)} degrees forward and is worth the most speed per hop. Beyond ${deg(FALL_FWD)} degrees forward or ${deg(-FALL_BACK)} degrees back you fall.`,
  ] },
  { title: 'Falling', p: [
    `A fall costs about ${DOWN_T.toFixed(1)} seconds on the ground and ${RISE_T.toFixed(1)} s to get up; each tap while down gets you up ${ms(SHAKE)} ms sooner (never below a quarter of a second). You start again from standstill, upright.`,
  ] },
  { title: 'Ruts and mud', art: 'ruts', p: [
    `A rut adds spin in the direction of its arrow when you land on it (about ${RUT_KICK.toFixed(1)} of a tap). The course has the same ruts and mud in every lane.`,
    `Mud takes ${Math.round((1 - MUD_SLOW) * 100)} percent off your speed when you land in it and weakens your next hop.`,
  ] },
  { title: 'Heats', p: [
    `Race mode is a ladder of ${HEATS.length} heats: ${HEATS.map((h) => h.name).join(', ')}. Win a heat to move up; a place of second or lower repeats it. Rivals get steadier and faster each heat.`,
    'The Daily Field uses the same course and rivals for everyone on the same day.',
  ] },
  { title: 'Records and sacks', p: [
    'Your best time over the main course is saved from Race and Clock Run races where you did not use Think. Six sack styles are unlocked by milestones and change only the look of your sack.',
  ] },
  { title: 'Think and Watch & Learn', p: [
    'Think slows the game to about a third for 2.5 seconds and lights the side it suggests, with the reason. A race where you used it is practice and is not saved as a best.',
    'Watch & Learn plays a full race at Market Field level and shows what it is thinking. It does not count towards bests or unlocks.',
  ] },
  { title: 'Simplifications', p: [
    'The real contest is a crowd on uneven ground and the balance is the whole body. Here there are four lanes, a short course and one balance dimension, with ruts and mud added so that every hop is a small decision.',
  ] },
];

// The 3D person layer's credits text (web/vendor3d/LICENSES.md, fetched by the presenter) as About paragraphs.
export function creditsSection(md) {
  if (!md) return null;
  const p = [];
  for (const block of md.split(/\n\s*\n/)) {
    const t = block.replace(/^#+\s*/gm, '').replace(/`/g, '').replace(/^\* /gm, '- ').replace(/\s*\n\s*/g, ' ').trim();
    if (!t || /^Credits and licences/.test(t) || /^Games that ship/.test(t)) continue;
    p.push(t);
  }
  return p.length ? { title: 'Credits and licences', p } : null;
}
