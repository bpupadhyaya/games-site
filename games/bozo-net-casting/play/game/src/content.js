// The text of the About, How to Play and Rules pages. Each section: { title, art?, p: [paragraphs] }.
// Every number here is read from the engine (sim.js) so the rules page cannot drift from the game.
import {
  NETS, DEPTHS, SPECIES, WATERS, SEASONS, SESSION_CASTS, FLIGHT, WIDE_OPEN, WIDE_BONUS, HOLD_MIN, RANKS,
} from './sim.js';

export const ABOUT = [
  { title: 'Bozo Net Casting', art: 'river', p: [
    'Cast-net fishing is one of the long-standing crafts of the great river of West Africa. The Bozo are a fishing people of the Niger and Bani rivers in Mali, and fishing families of the river in Niger work the same waters. From a dugout canoe a fisher swings a weighted circular net around the body and lets it fly, so that it opens fully over a shoal and sinks around it before it is drawn in.',
    'The skill is in the swing and the release: the net has to open wide at the right moment, land where the fish will be, and sink fast enough to close under them before they dart away.',
  ] },
  { title: 'About this version', p: [
    'This is a video game made for phones and tablets about the craft of the cast. You stand in the canoe, read a shoal, choose a net and the depth of its weights, hold to swing the net and let go when it is wide open. The river, the seasons and the fish are shown in a simplified way.',
    'Simplifications: a real cast takes years to learn and uses the whole body, here it is one press and one release; the shoals follow smooth paths and the fish dart away at set speeds; the rivers and the scenes are invented for the game. Every fish you take is counted in your logbook and let go again.',
  ] },
  { title: 'Pictures and credits', p: [
    'The river, nets, fish and sound are drawn and synthesised in the game. The person is shown as a generic fisher seen from behind. Bozo Net Casting is part of the Arcforge collection of heritage games and takes its subject with respect for the river peoples who keep the craft.',
  ] },
  { title: 'Credits', p: [
    'The fisher is a 3D person derived from avatars of the Microsoft Rocketbox Avatar Library (MIT License, Copyright (c) 2020 Microsoft, https://github.com/microsoft/Microsoft-Rocketbox); the textures were repainted and the clothing recoloured.',
    'Base animations: Quaternius, Universal Animation Library (CC0, https://quaternius.com), and the Carnegie Mellon University Graphics Lab Motion Capture Database (http://mocap.cs.cmu.edu), created with funding from NSF EIA-0196217, BVH conversion by Bruce Hahne (cgspeed.com), retargeted to a different skeleton.',
    '3D rendering uses three.js (Copyright (c) 2010-2024 three.js authors, MIT License, https://threejs.org) and the meshoptimizer decoder (Copyright (c) 2016-2024 Arseny Kapoulkine, MIT License).',
  ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'river', p: [
    'Cast the net over a shoal and count the fish. A session is six casts. Every fish is worth points, and the bigger and deeper ones are worth more.',
  ] },
  { title: 'Read the water', art: 'shoal', p: [
    'Dark shapes under the water are shoals. Rings on the surface show where fish are rising. A shoal drifts on a smooth loop, so aim a little ahead of it. The arrow in the river strip shows the current, which leans the net downstream as it sinks.',
  ] },
  { title: 'Choose a net and a depth', art: 'tray', p: [
    'Tap one of the three nets in the tray, then Shallow, Middle or Deep for its weights. A wide net with light weights covers a lot of water but sinks slowly. A heavy net closes fast under deep fish but covers less.',
  ] },
  { title: 'Swing and let go', art: 'swing', p: [
    'Press the water where you want the net to land and keep your finger down. The net swings around the fisher and opens and closes with each turn; the circle on the water shows how wide it would open. Let go when the circle is at its widest, in the gold band of the gauge.',
  ] },
  { title: 'Think and Watch & Learn', p: [
    'Think shows where to cast, with which net and depth, and why. A session where you used Think is practice and is not saved as a best.',
    'Watch & Learn plays a whole session for you. It stops to think, shows its choice, then casts. You can pause at any time.',
  ] },
];

const netLines = NETS.map((n) => `${n.name}: circle ${n.R.toFixed(1)} m, sinks ${n.sink.toFixed(1)} m/s, one swing takes ${n.T.toFixed(1)} s. ${n.how}${n.need ? ` Unlocked by a cast of ${n.need} points.` : ' Always available.'}`);
const depthLines = DEPTHS.map((d) => `${d.name} (${d.note}): the net sinks at ${Math.round(d.sink * 100)} percent of its normal speed and opens to ${Math.round(d.R * 100)} percent of its circle.`);
const fishLines = SPECIES.map((s) => `${s.name}: ${s.pts} ${s.pts === 1 ? 'point' : 'points'}, swims ${s.depth[0].toFixed(1)} to ${s.depth[1].toFixed(1)} m deep, darts at ${s.flee.toFixed(1)} m/s. ${s.how}`);
const waterLines = WATERS.map((w) => `${w.name}: current ${w.cur.toFixed(2)} m/s, ${Math.round(w.vis * 100)} percent clarity. ${w.blurb}${w.need ? ` Unlocked by a cast of ${w.need} points.` : ' Always open.'}`);
const seasonLines = SEASONS.map((s) => `${s.name}: shoals swim at ${Math.round(s.depth * 100)} percent of the usual depth, the current is ${Math.round(s.cur * 100)} percent of the river's, clarity ${Math.round(s.vis * 100)} percent. ${s.blurb}`);

export const RULES = [
  { title: 'Goal', p: [
    `Take as many points of fish as you can in ${SESSION_CASTS} casts. A cast scores the points of every fish inside the net when it closes. A cast with the net wide open scores ${Math.round((WIDE_BONUS - 1) * 100)} percent more.`,
    'Every fish is counted in your logbook and let go again.',
  ] },
  { title: 'A session', art: 'river', p: [
    `Each session has ${SESSION_CASTS} casts on the water and in the season you chose. Between casts the tray is dealt again from the nets you own and the river is new. Your best session total for that water is kept.`,
    'Free Cast has no score and no limit. Daily Water gives everyone the same river and nets each day, with one best per day.',
  ] },
  { title: 'The swing', art: 'swing', p: [
    `Press the water to start swinging. The net opens and closes once for every turn of its swing: closed at the start, widest half a turn later, closed again at the full turn. Each net has its own turn time (see Nets).`,
    `From the third turn on the arm tires: the widest opening falls by 6 percent for every extra turn, to a floor of 80 percent. A press shorter than ${HOLD_MIN.toFixed(2)} s is not a cast.`,
    `An opening of ${Math.round(WIDE_OPEN * 100)} percent or more is wide open. The circle you will get is 38 percent of the net's circle when it is closed and 100 percent when it is fully open.`,
  ] },
  { title: 'The throw', art: 'flight', p: [
    `Let go and the net flies for ${FLIGHT.toFixed(2)} s and lands where the circle was drawn. You can drag your finger while swinging to move the landing point. The shoals keep moving while the net flies, so lead them a little.`,
    'The current carries the net downstream while it sinks, by half the current speed.',
  ] },
  { title: 'Fish dart away', art: 'dart', p: [
    'When the net lands, every fish inside 1.45 times the circle plus 0.4 m is alarmed. After its reaction time it darts straight away from the centre at its own speed until the net has closed under it.',
    'The net closes under a fish after 0.2 s plus the fish\'s depth divided by the net\'s sinking speed. A fish is caught if it is inside 96 percent of the circle at that moment. Slow sinking gives deep fish time to flee; fast sinking gives them none.',
  ] },
  { title: 'Nets', art: 'nets', p: netLines },
  { title: 'Depth', art: 'tray', p: depthLines },
  { title: 'Fish', art: 'fish', p: fishLines },
  { title: 'Waters', p: waterLines },
  { title: 'Seasons', p: seasonLines },
  { title: 'Think and Watch & Learn', p: [
    'Think tries every net in your tray, every depth and a grid of landing spots, assuming the net is released wide open at the top of its swing, and shows the best. It marks the spot on the water, the net and the depth, and says why. A session in which you used Think is practice and its scores are not saved as bests.',
    'Watch & Learn thinks for the time you set (2 to 10 seconds), shows its choice for 2 seconds, then swings and casts it. Pause stops everything exactly where it is.',
  ] },
  { title: 'Ranks', p: RANKS.slice().reverse().map(([min, name]) => `${name}: ${min} points in a session.`) },
  { title: 'Free preview', p: [
    'The first 90 seconds of real play are free. Menus, Watch & Learn, the Logbook and a paused game never use them up. The full game is a single one-time unlock.',
  ] },
];
