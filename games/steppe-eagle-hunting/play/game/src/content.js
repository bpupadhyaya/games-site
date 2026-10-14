// Text pages: How to Play, About and Rules. Every number comes from sim.js so the pages cannot drift from the engine.
import { K, LEVELS, RIDERS } from './sim.js';

const P = K.POINTS, R = K.RECALL;
const C = K.CLASSES;

export const HOWTO = [
  { title: 'Find the moment', art: 'track', text: [
    'A fox forages on the winter steppe near its den. Press and drag on the snow to keep the round sight on the fox. The lock fills while you track it and fades when you lose it.',
    'Wait for a good moment: the fox in open snow, well away from its den, at a fair distance. Then tap Release. A steady lock and a patient release both score.',
  ] },
  { title: 'Fly and stoop', art: 'stoop', text: [
    'The eagle climbs and flies at the fox on its own, but wind pushes it off line. Press and drag to point it where you want it to go.',
    `When the fox is about 30 m ahead, tap Stoop. The eagle folds its wings and dives. Too early and it lands short; too late and it flies over. The fox always slips away unharmed: only the flying is scored.`,
  ] },
  { title: 'Call it back', art: 'recall', text: [
    `The eagle sweeps away and returns to your glove. Three rings close in as it comes: tap Call just as each one reaches the centre for a clean return, worth up to ${P.recall} points.`,
    'Five hunts make an outing. Tap Think for a tested suggestion, or use Watch & Learn to see a master rider explain every choice, with a real Pause.',
  ] },
];

export const ABOUT = [
  { title: 'About this game', art: 'eagle', text: [
    'Berkutchi are the eagle hunters of the Kazakh people. In the winter steppe and the Altai foothills they ride out with a golden eagle, the berkut, on the arm and hunt foxes and hares together with it.',
    'The bird is raised, trained and cared for by one hunter, often for around ten years, and is traditionally returned to the wild afterwards. The tradition passes from parent to child and is a living part of the heritage of Kazakhstan.',
    'Here the hunt is a game of patience and timing. The fox always escapes unharmed in a burst of snow; the skill you show is tracking, release, flight and the clean return to the glove.',
  ] },
  { title: 'This version', text: [
    'Steppe Eagle Hunting is part of the Arcforge collection of world heritage games. It has no ads, no betting and no stakes, works offline and saves your records on your device.',
    'The rules page lists every number the engine uses. Text size can be set up to 300% in Settings and on every reading page.',
    `Four eagle plumages (golden, dark brown, pale and white-tail) unlock as your career points grow: 250, 700 and 1400 points.`,
  ] },
];

export const RULES = [
  { title: '1. The goal', art: 'eagle', text: [
    `An outing is ${K.HUNTS} hunts. Each hunt can score up to ${P.track + P.release + P.flight + P.strike + P.recall} points: ${P.track} for tracking, ${P.release} for the release, ${P.flight} for the flight, ${P.strike} for the stoop and ${P.recall} for the return. The outing total is the sum of all hunts.`,
    'Ride out alone, ride against a computer rider or pass the phone between two riders. In the two-side modes both riders hunt the same fox in the same wind, one after the other, and the higher total wins.',
  ] },
  { title: '2. The steppe, the fox and its den', art: 'den', text: [
    `The field is about ${2 * K.FIELD_X} m wide and ${K.Z_MAX} m deep, with you at the near edge. The fox forages around its den, standing still to listen, trotting between spots and now and then pouncing sideways.`,
    `When the eagle comes within ${K.ALERT_R} m the fox bolts for its den at a speed set by the conditions, and jinks left or right every couple of seconds. It always warns with a short crouch just before a jink.`,
    `If the fox reaches its den before the stoop is finished the hunt ends there: no stoop points, and the eagle returns.`,
  ] },
  { title: '3. Track', art: 'track', text: [
    `Press and drag to place the sight on the ground. The lock rises by ${Math.round(K.LOCK_UP * 100)}% a second while the sight is on the fox (within ${K.LOCK_R0} m plus a little more the farther away it is) and falls by ${Math.round(K.LOCK_DOWN * 100)}% a second when it is not.`,
    `Lock at the moment of release earns up to ${P.track} points and also makes the eagle's own eye sharper: it reacts to the fox sooner and leads its dive better.`,
    `You have ${K.LIMIT} seconds of daylight. If you have not released by then the fox slips away and the hunt scores nothing.`,
  ] },
  { title: '4. Release', art: 'den', text: [
    `The release is worth up to ${P.release} points: about half for how far the fox is from its den (a full score at 70 m or more, the open-snow ring on the Guides) and the rest for the range from you (a full score between 100 and 200 m).`,
    `The eagle leaves heading for the sight and climbs to ${K.ALT} m at ${K.CLIMB} m/s, then cruises at ${K.CRUISE} m/s.`,
  ] },
  { title: '5. Flight and wind', art: 'wind', text: [
    `Wind blows steadily with gusts and pushes the eagle sideways with ${Math.round(K.WIND_PUSH * 100)}% of its strength. The wind arrow on the scoreboard shows where it blows to, and its strength in metres per second. Conditions: ${LEVELS.map((l) => l.name).join(', ')}; the wind also grows with each hunt of an outing.`,
    `Left alone the eagle chases where it last saw the fox; with a low lock it reacts up to two seconds late. Press and drag to steer it: it turns at up to ${K.TURN} radians a second toward your finger.`,
    `Flight points (up to ${P.flight}) measure how straight the eagle's path was, from release to the start of the dive.`,
  ] },
  { title: '6. The stoop', art: 'stoop', text: [
    `Tap Stoop to start the dive. It lasts the height divided by ${K.DIVE_RATE} m/s, between ${K.DIVE_MIN} and ${K.DIVE_MAX} seconds, and the eagle accelerates from ${K.STOOP_V0} to ${K.STOOP_V1} m/s. It aims where the fox will be; a jink during the dive spoils the aim.`,
    `A strike is measured only while the eagle is below ${K.STRIKE_ALT} m, as the distance to the fox at its closest. ${C.map((c) => `${c.name} within ${c.max} m scores ${c.pts}`).join('; ')}.`,
    'Nothing is caught. The fox vanishes into a puff of snow every time.',
  ] },
  { title: '7. The return', art: 'recall', text: [
    `After the pass the eagle circles back. Three rings close in at ${R.pulses.map((p) => p.toFixed(1)).join(', ')} seconds. A tap within ${R.perfect} s of the centre is perfect (${R.pts[0]} points), within ${R.good} s good (${R.pts[1]}), within ${R.ok} s late or early (${R.pts[2]}).`,
    `Three perfect taps add ${R.bonus} more, so a clean return is worth ${P.recall}.`,
  ] },
  { title: '8. The computer riders', art: 'score', text: [
    `${RIDERS.map((r) => `${r.name}: ${r.note.toLowerCase()}`).join('. ')}. They differ in how steady their sight is, how well they time the release and how closely they judge the stoop.`,
    'Think and the riders both test a stoop with a simulated copy of the hunt; the fox\'s next jink in that copy is different from the real one, so a test is a good guide and never a promise.',
  ] },
  { title: '9. Simplifications', text: [
    'Real eagle hunts are done on horseback in deep snow, over long days, and are about the bond between bird and hunter. This version keeps the pair, the wind and the fox, and compresses the hunt to a few minutes.',
    'Distances are in metres on a flat field. Wind, the fox and the eagle follow simple rules written on these pages; nothing is random once the hunt has begun except the fox\'s own choices, which are seeded and the same for every rider in a two-side match.',
  ] },
];
