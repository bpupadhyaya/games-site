// The text of the About, How to Play and Rules pages. Each section: { title, art?, p: [paragraphs] }.
// Every number here is read from the engine (sim.js) so the rules page cannot drift from the game.
import {
  ROTORS, SCENES, SESSION_FLIGHTS, HEIGHT_PTS, LANTERN_PTS, PERFECT_PTS, LAND_PTS, PERFECT_BONUS, OVERHEAT, HOLD_HOT, LANTERN_R, RANKS, STEER_COST, LEAN_V,
} from './sim.js';

const pct = (v) => `${Math.round(v * 100)}`;
const band = (r) => `${pct(r.sweet[0])} to ${pct(r.sweet[1])} percent`;

export const ABOUT = [
  { title: 'Bamboo Copter', art: 'copter', p: [
    'The bamboo copter, zhuqingting in Chinese and "bamboo dragonfly" in many languages, is a very old flying toy: a small propeller of bamboo, wood or paper fixed to a thin stick. You roll the stick between your palms, let go, and the rotor climbs into the air and floats down again.',
    'Popular tradition in China places the toy more than two thousand years ago, and it is often named among the ancestors of the helicopter rotor. Children still make and fly it today in China, Japan, South-East Asia and far beyond.',
  ] },
  { title: 'About this version', p: [
    'This is a video game version made for phones and tablets. You choose a rotor, rub its shaft with your finger, let go at the right moment and then gently lean it through the air. The rotor follows a simple physical model: spin gives lift, the spin fades, a falling rotor spins itself up again, and wind and warm air carry it.',
    'The landscapes, the lanterns, the targets and the weather are invented for the game. It is a toy, not a flight simulator. Simplifications: the toy moves in one plane (left and right, up and down), the wind blows along that line, and leaning is a gentle push rather than real steering.',
  ] },
  { title: 'Pictures and credits', p: [
    'All art and sound are drawn and synthesised in the game. Bamboo Copter is part of the Arcforge collection of heritage games.',
    '3D layer: the hands are derived from an avatar of the Microsoft Rocketbox Avatar Library (MIT licence, Copyright (c) 2020 Microsoft). Rendering uses three.js (MIT). Full licence texts ship with the game in vendor3d/LICENSES.md.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'overview', p: [
    `Fly the little rotor as high as you can and bring it down on a ring. A session is ${SESSION_FLIGHTS} flights. Points come from height, lanterns, the ring you land in and a perfect release.`,
  ] },
  { title: 'Choose a rotor', art: 'tray', p: [
    'Tap one of the three rotors in the tray. A heavy rotor climbs high and falls fast, a light one hangs in the air but the wind carries it away. The two bars show lift and how slowly it comes down.',
  ] },
  { title: 'Set the lean', art: 'lean', p: [
    'Slide Lean to the left or right to give the rotor a sideways push when you let go. In the middle it goes straight up. Look at the wind arrow: a lean against the wind keeps it near, a lean with it sends it far.',
  ] },
  { title: 'Rub and let go', art: 'rub', p: [
    'Press the shaft area and rub your finger left and right, quickly and smoothly. The Spin meter on the right fills. Lift your finger to let the rotor go.',
  ] },
  { title: 'Watch the meter', art: 'meter', p: [
    'Let go inside the gold band for a perfect release with extra spin. Stay in the red zone too long and the grip heats up and slips by itself, and the rotor wobbles.',
  ] },
  { title: 'Lean in the air', art: 'steer', p: [
    'While it flies, hold your finger to the left or right of the rotor and it leans that way. Leaning spends spin, so use it for the ring and the lanterns, not all the time.',
  ] },
  { title: 'Land on the ring', art: 'target', p: [
    'The flight ends when the rotor touches the ground. The closer to the middle of a ring, the more points. Use Think when you want a suggestion.',
  ] },
];

export const RULES = [
  { title: 'Goal', art: 'overview', p: [
    `Score as many points as you can. A flight scores its peak height (${HEIGHT_PTS} points per metre), ${LANTERN_PTS} points per lantern, the ring you land in (${LAND_PTS[1]}, ${LAND_PTS[2]} or ${LAND_PTS[3]}) and ${PERFECT_PTS} points for a perfect release.`,
    `A session is ${SESSION_FLIGHTS} flights. Your best single flight unlocks rotors and landscapes.`,
  ] },
  { title: 'Rotors', art: 'rotors', p: [
    'Each rotor has its own lift (how hard it climbs), spin decay, fall speed, wind grip (how strongly the wind carries it), steering strength and sweet band.',
    ...ROTORS.map((r) => `${r.name}: ${r.how} Sweet band ${band(r)}.${r.need ? ` Unlocked by ${r.need} points in one flight.` : ''}`),
  ] },
  { title: 'Rubbing and the spin meter', art: 'rub', p: [
    'Press on the shaft area and move your finger from side to side. Spin charge builds while you scrub at a good speed; faster scrubbing builds it faster up to a point, and scrubbing too fast slips and builds nothing. When you rest, the charge cools slowly.',
    'With a keyboard, hold Space to rub and let go to release.',
  ] },
  { title: 'The perfect band and the grip', art: 'meter', p: [
    `Each rotor has a gold sweet band on the meter. Letting go inside it gives a perfect release: the rotor starts with ${pct(PERFECT_BONUS - 1)} percent more spin and earns ${PERFECT_PTS} points.`,
    `Above ${pct(OVERHEAT)} percent the grip runs hot. After ${HOLD_HOT} s there the rotor slips from your hands by itself, starts with less spin and wobbles sideways.`,
  ] },
  { title: 'Lean at release', art: 'lean', p: [
    `The Lean slider sets a sideways launch speed of up to ${LEAN_V} m/s to the left or right. Nothing else changes with the lean.`,
  ] },
  { title: 'Climb and fall', art: 'fly', p: [
    'Lift grows with the square of the spin. As the spin fades the rotor stops climbing and starts to fall. A falling rotor is turned by the air and gains some spin back, so it settles slowly like a maple seed.',
    'The height is measured from where you let go.',
  ] },
  { title: 'Leaning in the air', art: 'steer', p: [
    `Hold the pointer left or right of the rotor to lean it that way. It gives a sideways push as long as you hold. Leaning costs spin (up to ${pct(STEER_COST)} percent of the spin each second), and a lean also takes a little lift.`,
    'With a keyboard use the left and right arrow keys.',
  ] },
  { title: 'Wind', art: 'wind', p: [
    'The wind strip shows its direction and strength. Wind grows stronger with height, and gusty landscapes add a slow swell and fade on top. A light rotor follows the wind closely, a heavy one hardly at all. Falling leaves and petals show it in the air.',
  ] },
  { title: 'Warm columns', art: 'thermal', p: [
    'Shimmering columns of warm air lift anything inside them. They are widest and strongest near the ground and fade away toward their top. A good flight rides a column to go higher or to stay up longer.',
  ] },
  { title: 'Lanterns', p: [
    `Fly within ${LANTERN_R} metres of a lantern to collect it for ${LANTERN_PTS} points. There are five in every flight, some above the launch place and some downwind.`,
  ] },
  { title: 'Landing and rings', art: 'target', p: [
    `Three rings lie on the ground. The rotor lands when it touches the ground: the outer ring scores ${LAND_PTS[1]}, the inner ring ${LAND_PTS[2]} and the bullseye ${LAND_PTS[3]} points. Only the best ring you touch counts.`,
    'On the roofs landscape the rings are on the rooftops.',
  ] },
  { title: 'Landscapes', art: 'scenes', p: SCENES.map((s) => `${s.name} (${s.time}): ${s.blurb}${s.need ? ` Unlocked by ${s.need} points in one flight.` : ''}`) },
  { title: 'Modes', p: [
    'Meadow Session: five flights on your chosen landscape; the best total for each landscape is kept.',
    'Daily Sky: the same weather and rings for everyone today, one best score per day, every rotor available.',
    'Free Flight: as many flights as you like, no score is kept for a best.',
    'Watch & Learn: the game plays a whole session for you: it thinks, shows its choice, rubs, lets go and leans. You can pause it and change its thinking time.',
  ] },
  { title: 'Think hint', p: [
    'Tap Think before you rub. The game simulates many choices of rotor, lean and charge and shows the best one: a gold marker on the lean slider and the meter, a gold ring around the rotor and a dotted path. Using Think marks the session as practice and it is not saved as a best.',
  ] },
  { title: 'Ranks', p: RANKS.map(([n, name]) => `${name}: ${n}+ points in a session`) },
  { title: 'Free to play', p: [
    'Menus, Watch & Learn and the Collection are always free. Free to play with short ads; go ad-free once.',
  ] },
];
