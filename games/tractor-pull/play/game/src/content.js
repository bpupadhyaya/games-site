// The text of the About, How to Play and Rules pages. Each section: { title, art?, p: [paragraphs] }.
// Every number here is read from the engine (sim.js) so the rules page cannot drift from the game.
import {
  RIGS, GROUNDS, RANKS, TRACK_FT, CLOCK, SESSION_PULLS, ROUND_MUL, SHIFT_TIME, CUT_TIME, SLIP_GOOD, LIFT_WARN, STRIPS, STRIP_FT, PEAK,
} from './sim.js';

const pct = (v) => `${Math.round(v * 100)} percent`;

export const ABOUT = [
  { title: 'Tractor Pull', art: 'rig', p: [
    'Tractor pulling is a summer fair and county show sport of the United States and Canada. A tractor is hitched to a heavy sled with a weight box that slides forward as the sled moves, so the load grows the further it goes. Whoever pulls the sled the farthest down a 300 foot track wins; pulling the whole way is called a full pull.',
    'It is a living tradition: hundreds of small local pulls every summer, from garden tractors at the village fair to big modified machines at televised events.',
  ] },
  { title: 'About this version', p: [
    'This is a video game version made for phones and tablets. You drive a generic farm tractor, set the throttle lever and choose the gear, and watch three gauges: engine speed, wheel slip and nose lift. The tractor, the sled and the grounds follow a simple physical model, and everything is invented for the game.',
    `Simplifications: the track is a straight 300 foot lane, there is one rig on the line at a time, the sled load rises on a smooth curve instead of a mechanical weight box, and there are four gears. The rigs have no brand names and do not copy any real machine.`,
  ] },
  { title: 'Pictures and credits', p: [
    'The track, the rigs and the crowd are lit 3D scenes built and drawn in the game, and all sound is synthesised in the game. Tractor Pull is part of the Arcforge collection of heritage games.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'overview', p: [
    `Pull the sled as far as you can down the ${TRACK_FT} foot track. The longer it goes, the heavier it gets. A session is ${SESSION_PULLS} pulls with a heavier sled each time, and the feet add up.`,
  ] },
  { title: 'The throttle lever', art: 'lever', p: [
    'Press or drag on the lever on the right of the controls. It stays where you leave it. Open it a little to launch: too much and the tyres spin and dig a hole.',
  ] },
  { title: 'The gears', art: 'gears', p: [
    'Shift up when the engine reaches the top of its green band, and shift down when the sled drags it below the band. A shift cuts the drive for a moment, so change gear while the sled is still light.',
  ] },
  { title: 'Slip, nose and grip', art: 'gauges', p: [
    'Keep wheel slip in the green: a little slip is grip, a lot is a hole in the track. When the nose lift gauge climbs towards red, ease the lever so the front end comes down. Dark damp strips of track grip better than pale dusty ones; the map at the top of the track shows what is ahead.',
  ] },
  { title: 'Think and Watch & Learn', p: [
    'Think puts a gold mark on the lever and on the gear that a good driver would use, with the reason. A session where you used Think is practice and is not saved as a best.',
    'Watch & Learn drives a whole session for you. It stops to think, shows its plan, then pulls. You can pause at any time.',
  ] },
];

const rigLines = RIGS.map((r) => `${r.name}: ${r.mass.toFixed(1)} tonnes, ${r.power} kW, ${r.vmax.length} gears, top speed in gears 1 to 4 about ${r.vmax.map((v) => Math.round(v * 3.6)).join(', ')} km/h.${r.need ? ` Unlocked after ${r.need} feet of pulling.` : ' Always available.'}`);
const groundLines = GROUNDS.map((g) => `${g.name} (${g.time}): ${g.blurb}${g.need ? ` Unlocked after ${g.need} feet of pulling.` : ' Always open.'}`);
const rankLines = RANKS.filter((r) => r[0] > 0).map((r) => `${r[0]} feet or more: ${r[1]}.`);

export const RULES = [
  { title: 'Goal and scoring', art: 'overview', p: [
    `Pull the sled as far as you can down the ${TRACK_FT} foot track before it stops or the ${CLOCK} second pull clock runs out. Your score for a pull is the feet you reached. Reaching ${TRACK_FT} feet is a full pull.`,
    `A session is ${SESSION_PULLS} pulls. The sled gets heavier each round (load factors ${ROUND_MUL.map((m) => `${Math.round(m * 100)}`).join(', ')} percent), and the three distances add up to your session total. The best possible total is ${SESSION_PULLS * TRACK_FT} feet.`,
  ] },
  { title: 'How a pull ends', p: [
    `A pull ends when the rig reaches ${TRACK_FT} feet, when the sled has stopped for more than a second, when the engine speed falls so low that the engine stalls, or when the ${CLOCK} second clock runs out.`,
    'The clock starts when you first open the throttle. A pull that is still crawling forward at the end of the clock counts for the feet it reached.',
  ] },
  { title: 'The engine and the gears', art: 'engine', p: [
    `The engine is strongest in the middle of its speed range (about ${pct(PEAK)} of its top speed) and weak when it is lugged near idle. The green band on the engine gauge is the range where it makes most of its power. Engine speed follows the wheels: at a given road speed a lower gear spins the engine faster.`,
    `There are four gears. Shifting takes ${SHIFT_TIME.toFixed(2)} seconds and the drive is cut during it, so the sled drags you back. The heavier the sled, the more you lose: shift while the load is still light, and choose a gear that will keep the engine in its band for the next stretch.`,
    'If the engine speed drops to a crawl while the sled is still heavy, the engine stalls and the pull ends.',
  ] },
  { title: 'Throttle, grip and wheel slip', art: 'gauges', p: [
    `Drive force depends on the lever and the engine. The tyres can only hold so much: when drive force is above what the ground can carry, the wheels spin. The slip gauge shows how much. Slip between ${Math.round(SLIP_GOOD[0] * 100)} and ${Math.round(SLIP_GOOD[1] * 100)} percent is the green band: the most pull the tyres can give.`,
    'Above the green band the wheels give less and less pull, and above 30 percent they dig a hole that costs grip until you move out of it. Rolling the lever on gently at the start is the whole secret of a good launch.',
  ] },
  { title: 'The track and grip strips', art: 'strips', p: [
    `The track is split into ${STRIPS} strips of ${STRIP_FT} feet. Dark, damp strips grip better and pale, dusty strips grip less. The map at the top of the track shows every strip, and the rig marker moves along it. A strip you are about to meet is a good moment to ease off the lever.`,
    'Each ground has its own base grip and its own spread of strips; the daily pull uses the same strips for everyone that day.',
  ] },
  { title: 'The nose', art: 'nose', p: [
    `When drive force is high, the front of the tractor starts to rise. A little lift puts more weight on the driven tyres, which helps them grip. Above ${pct(LIFT_WARN)} the gauge turns amber, and when it reaches 100 percent the safety cut stops the engine for ${CUT_TIME.toFixed(1)} seconds: the sled drags you back and the pull is probably over.`,
    'Easing the lever lets the nose come down. The strongest rigs lift the nose sooner.',
  ] },
  { title: 'The sled load', art: 'load', p: [
    'The load bar shows how heavy the sled is compared with the weight of your tractor. It starts light and rises on a steep curve because the weight box slides towards the front pan; the last third of the track is by far the hardest. The first few feet are easier because a sled breaks away from rest.',
    'Speed carried into the heavy part helps: the faster you arrive, the longer the rig keeps moving once the sled bites.',
  ] },
  { title: 'Rigs and grounds', art: 'rigs', p: [...rigLines, ...groundLines] },
  { title: 'Modes', p: [
    'Pull Session: three pulls on your chosen rig and ground. Daily Pull: three pulls on the ground and strips of the day, the same for everyone. Free Pull: practise one pull at a time with no score. Watch & Learn: the game drives a whole session while you watch; it is always free to use.',
    'Think: shows a gold mark on the lever and the gear a good driver would use right now and why. A session in which Think was used is practice and is not saved as a best.',
  ] },
  { title: 'Ranks and unlocks', p: [
    ...rankLines,
    'Every foot you pull in real sessions adds to a lifetime total. Rigs and grounds unlock at set totals, as listed under Rigs and grounds. Your best single pull is kept, and your best session on each ground.',
  ] },
  { title: 'Controls', p: [
    'Touch: press or drag the lever; tap Shift up and Shift down. Keyboard: Up and Down move the lever, Space holds full throttle, A or Z shifts down, D or X shifts up, H is Think, P or Escape pauses, plus and minus change the text size on menu pages.',
    'Text size can be changed to 300 percent in Settings and on every reference page. The game works in portrait and landscape and keeps your pull when you rotate.',
  ] },
];
