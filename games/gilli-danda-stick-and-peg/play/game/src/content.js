// About, How to Play and Rules. Every number quoted is the real constant from core.js / engine.js.
// Items use the ui.js column vocabulary; { t: 'fig', key } draws the game's own art (view.js figures).
import { DANDA, GILLI_LEN, SW, HS, AIM_MAX, LEVELS, FIELDS, FIELD_KEYS, VMAX } from './core.js';
import { TAP_ZONES, FLIP_MIN_H, FLIP_MAX_H, READY_T, RESULT_T } from './engine.js';

const h = (text) => ({ t: 'h', text });
const p = (text) => ({ t: 'para', text });
const fig = (key, height = 280) => ({ t: 'fig', key, h: height });
const gap = (n = 10) => ({ t: 'gap', h: n });
const rule = () => ({ t: 'rule' });
const cm = (m) => `${Math.round(m * 100)} cm`;

export const CREDITS_FALLBACK = [
  '# 3D people and credits',
  'The players are 3D people from the Microsoft Rocketbox Avatar Library (MIT licence); their movement is made in the game itself. The 3D engine is three.js (MIT). The full credits text is shown here when the 3D layer is loaded.',
];

export const ABOUT = [
  { t: 'title', text: 'About Gilli-Danda', size: 38 },
  p('Gilli-Danda is a street game played in villages and lanes across India, Pakistan, Nepal, Bangladesh and wherever families from there have settled. All you need is a short stick, the danda, and a small tapered peg, the gilli. You tap one end of the peg so that it flips out of a hole in the ground, and then strike it in the air as far as you can while the other children try to catch it.'),
  rule(),
  h('A game with many names'),
  p('It is called gilli-danda in Hindi, guli-danda in Bengali and Urdu, vitti-dandu in Marathi, chinni-dandu in Kannada and kitti-pul in Tamil, and simple versions are played far beyond South Asia. Many people call it a cousin of cricket and baseball. Children have always made the rules up as they went along; this version keeps the heart of it: the flip, the strike, the catch and the measuring.'),
  h('What is in the game'),
  p('Real 3D lanes and fields with real-looking players. A Team Match against a rival village, a Distance Challenge for one striker, a Daily Challenge with the same field for everyone, and Auto Play where the computer plays and explains each decision. Three levels of fielders (Gully, Mohalla, Maidan) and three grounds (Mango Lane, Harvest Field, Lamp Night).'),
  h('Original, and for everyone'),
  p('Every team, village and player in this game is invented. It is a score-only game: no chips, no stakes, no betting of any kind. One purchase after a free preview, no ads.'),
  h('3D people and credits'),
  p('The players are 3D people from the Microsoft Rocketbox Avatar Library (MIT) with motion made in the game itself. The 3D engine is three.js (MIT). Full credits are listed below when the 3D layer is present.'),
  gap(6),
];

export const HOWTO = [
  { t: 'title', text: 'How to Play', size: 40 },
  h('1. Aim'),
  p(`Drag left or right anywhere on the field to turn the striker toward a gap between the fielders. A dotted line on the ground shows the direction. You can change your aim at any time before the swing, up to ${AIM_MAX} degrees either side of straight ahead.`),
  fig('field', 320),
  h('2. Tap: flip the gilli'),
  p('The pad along the bottom has a swinging danda. Press the pad when the danda crosses the gold centre. A perfect press flips the gilli high and true; a poor one flips it low and wobbling; miss the gold completely and the tap is wasted.'),
  fig('tap', 170),
  h('3. Swing: strike it in the air'),
  p('The gilli rises, hangs and falls. A ring in the air marks the hitting height, and a shrinking ring on the pad closes on the perfect moment. Press the pad again just as the ring closes: the danda reaches the gilli a tenth of a second later. Hit it too early or too late and it loses power; miss it completely and the chance is gone.'),
  fig('swing', 220),
  h('4. Power, loft and direction'),
  p('The closer your timing, the harder the strike. Catch the gilli a little low and it flies high; catch it high and it goes flat and fast. Early or late presses also drift the ball a few degrees off your aim.'),
  h('5. The fielders'),
  p('Fielders run for where they think the gilli will land. If one reaches it in the air it is a catch and you are out, though a fielder sometimes drops it. After every chance the nearest fielders shift toward where you last hit, so keep finding new gaps.'),
  h('6. Counting'),
  p(`The strike is measured from the hole to where it lands, in danda lengths (one danda is ${cm(DANDA)}). More dandas, more points.`),
  h('7. Think and Auto Play'),
  p('The Think button explains where the fielders are and points to the best gap before a chance (you have three per innings). Auto Play lets you watch the computer play a whole challenge while it explains each decision; you can pause, speed it up or change its thinking time.'),
  h('Controls'),
  p('Touch: drag to aim, press the big pad to tap and swing. Keyboard: Left and Right arrows aim, Space or Enter presses the pad, P pauses, T asks for a hint.'),
  h('Left-handed'),
  p('In Settings, Striker hand switches your striker to a left-handed stance and swing. Pad side moves the big pad to the other side in landscape.'),
];

const levelRows = LEVELS.map((L) => ({ t: 'stat', label: L.name, value: `${L.fielders} fielders`, wide: false }));

export const RULES = [
  { t: 'title', text: 'Rules', size: 42, sub: 'Every number below is what the game uses.' },
  h('The field and the equipment'),
  p(`The ground has a small hole in the earth. The gilli is a ${cm(GILLI_LEN)} peg, tapered at both ends, that rests across the hole. The danda is a stick ${cm(DANDA)} long. The striker stands just behind the hole facing down the field. The fielders spread out in front.`),
  h('A chance, step by step'),
  p(`1. READY (${READY_T.toFixed(1)} s): the fielders take their places and you may aim.`),
  p('2. TAP: the danda swings over the end of the gilli like a pendulum. Press the pad to strike the end.'),
  p('3. FLIP: the gilli rises and falls. Press the pad to swing.'),
  p(`4. SWING: ${SW.toFixed(2)} seconds after your press the danda reaches the gilli's height.`),
  p('5. FLIGHT: the gilli flies; the fielders run; a catch or a landing ends it.'),
  p(`6. RESULT (${RESULT_T.toFixed(1)} s): the distance is measured, then the next chance begins, or the innings ends.`),
  h('The tap'),
  p(`The danda's position runs from -1 (far left) to +1 (far right) and passes the centre every half period (Gully ${LEVELS[0].tapP.toFixed(2)} s, Mohalla ${LEVELS[1].tapP.toFixed(2)} s, Maidan ${LEVELS[2].tapP.toFixed(2)} s for a full swing there and back). Your press is graded by how far from the centre the danda is:`),
  { t: 'stat', label: 'Perfect', value: `within ${Math.round(TAP_ZONES.perfect * 100)} percent of the centre`, wide: true },
  { t: 'stat', label: 'Good', value: `within ${Math.round(TAP_ZONES.good * 100)} percent`, wide: true },
  { t: 'stat', label: 'OK', value: `within ${Math.round(TAP_ZONES.ok * 100)} percent`, wide: true },
  p('Beyond that the tap misses and the chance is used up. These zones are widened by the Relaxed timing setting and by the easier levels, and narrowed by Sharp and Maidan. A better tap flips the gilli higher (from about ' + FLIP_MIN_H.toFixed(1) + ' m to ' + FLIP_MAX_H.toFixed(1) + ' m) and truer; a poor tap makes it drift sideways and wobble.'),
  h('The swing'),
  p(`The striking height is about ${cm(HS)} above the ground (a little lower if the flip is weak). You press ${SW.toFixed(2)} seconds before the gilli reaches it: the shrinking ring on the pad closes at exactly that moment. The strike quality runs from 0 to 1 and falls off as the gilli is higher or lower than the striking height when the danda arrives. A quality of 0.92 or more is a Perfect strike; below 0.30 it is only a glancing tip; below 0.08 it is a miss.`),
  p(`Power: the gilli leaves at up to ${VMAX} metres per second on a perfect strike and slower as quality falls. Loft: about 31 degrees on a clean strike; catch the gilli lower and it flies higher, catch it higher and it flies flatter (9 to 62 degrees). Direction: your aim plus or minus up to 8 degrees for pressing early (left) or late (right).`),
  h('Fielders and catches'),
  p('Each fielder watches the strike, reacts after a short delay, estimates where the gilli will land (better fielders estimate better) and runs there. If a fielder gets within reach of the gilli while it is between 10 centimetres and 2.4 metres off the ground, he or she has a chance to catch it. A hard-hit gilli is harder to hold. A caught gilli is out. A dropped gilli falls from the fielder\'s hands and counts where it lands.'),
  ...levelRows,
  p('Gully fielders are slow and often misjudge the landing; Maidan fielders are fast, react quickly, and after each chance the two nearest slide toward where you hit.'),
  h('Scoring'),
  p(`The distance from the hole to where the gilli first touches the ground is divided by ${cm(DANDA)} and rounded down: that is your score for the chance, in danda lengths (dandas). A caught gilli scores nothing.`),
  h('Innings'),
  p('In a Team Match each side bats three strikers, one after the other. A striker has up to three chances and is out the moment a fielder catches the gilli. After both sides have batted, the higher total wins; level totals are settled by one deciding chance for each side\'s best striker.'),
  p('In a Distance Challenge you play six chances; a catch costs only that chance. In the Daily Challenge the field and the flips are the same for everyone today.'),
  h('Grounds'),
  ...FIELD_KEYS.map((k) => ({ t: 'stat', label: FIELDS[k].name, value: FIELDS[k].light === 'night' ? 'night' : FIELDS[k].light === 'day' ? 'noon' : 'golden hour', wide: false })),
  p('The grounds look different but play the same.'),
  h('Auto Play and Think'),
  p('Auto Play runs a Distance Challenge with the computer: THINK (2 to 10 seconds, your choice), REVEAL (2 seconds, the chosen line is shown), then ACT. Pause stops everything exactly where it is. The Think hint scans eleven directions with a clean strike and names the best open one.'),
  gap(6),
];
