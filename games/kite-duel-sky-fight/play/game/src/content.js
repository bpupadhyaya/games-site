// Text for About, How to Play and the Rules reference. Every number below comes from the engine's own
// constants (sim.js) or the rival table (ai.js), so the pages cannot drift from the real game.
// A section is { title, art?, p: [paragraphs] }; the reader paginates the lines so nothing overflows.
import { K, SKIES, SKY_IDS } from './sim.js';
import { PROFILES } from './ai.js';

const gripFull = (1 / K.GRIP_DRAIN).toFixed(1);
const gripBack = Math.round(1 / K.GRIP_REGEN);
const gripBackEase = Math.round(1 / K.GRIP_REGEN_EASE);

export const ABOUT = [
  { title: 'Kite fighting', art: 'sky', p: [
    'In many places across South and Central Asia, and in Japan, flyers take strong fighting kites into the sky and try to cut each other loose. A fighting kite is light, fast and steered by quick pulls on the string.',
    'The kite itself rarely does the damage. The string does. Where two strings cross, the one that is pulled harder and slides faster saws through the other.',
  ] },
  { title: 'The kites', art: 'kites', p: [
    'The diamond fighter, called gudi or patang in many languages, has a paper skin, a straight spine and a bowed cross spar. A bridle of thread sets the angle at which it meets the wind.',
    'The hexagonal rokkaku comes from Japan and is a larger, steadier fighter. Some flyers add a tail for balance.',
  ] },
  { title: 'The skill', p: [
    'Good flyers read the wind before they move. They know when to let string out to protect a worn line, when to reel in for a hard cut, and how to swing the kite so that the strings meet at the right moment.',
  ] },
  { title: 'This version', p: [
    'Kite Duel simulates the wind, the pull of the string and the wear where two strings cross. Every round has a new wind, and five rivals fly in five different styles.',
    'You can also watch two rivals duel and see why each of them chooses what it does.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'sky', p: [
    'Cut your rival\'s string before yours parts. The string bars at the top show how much string each flyer has left.',
    'Win two rounds out of three. A Quick Duel is a single round.',
  ] },
  { title: 'Steer the kite', art: 'steer', p: [
    'Touch the sky anywhere. The kite flies to the spot you touched and stays on that heading when you let go. Drag to move the heading.',
    'A kite is a heavy thing in a moving sky: it takes a moment to arrive, so choose your heading a little ahead of where you want to be.',
  ] },
  { title: 'Slack, Steady, Pull', art: 'modes', p: [
    'The three buttons at the bottom choose what your hand does with the string and stay on until you change them.',
    'Slack lets string out. It is gentle on your string but cuts softly. Steady keeps the string just tight as the kite moves. Pull reels in: the string goes very tight and cuts hard, but it also wears faster and uses up Grip.',
  ] },
  { title: 'Read the wind', art: 'wind', p: [
    'The strip under the bars shows the wind now and for the next six seconds. A rise is a gust: it pulls strings tight and makes kites quick. A dip is a lull: strings sag and kites are slow.',
    'Pull during a lull. Ease off before a gust, or a tight string in a strong gust will strain and wear on its own.',
  ] },
  { title: 'Cross and cut', art: 'cross', p: [
    'When the two strings cross, a bright spark shows where they are sawing. Both strings wear. The one that is tighter and moving faster cuts deeper.',
    'Swing across their string, keep it tight in a lull, and let it go slack to protect yourself when theirs is the tighter one.',
  ] },
  { title: 'Think and Watch & Learn', art: 'think', p: [
    'Press Think any time to see a suggested heading and string choice. It does not play for you.',
    'Watch & Learn plays a whole duel between two rivals. Each turn they Think, then Reveal their plan, then Act. Pause stops everything. Use the Think time buttons to slow it down or speed it up.',
  ] },
];

const rivalParas = PROFILES.map((p, i) => `${'★'.repeat(p.stars)} ${p.name}: ${p.tag}.`);
const skyParas = SKY_IDS.map((id) => `${SKIES[id].name}: ${SKIES[id].blurb.toLowerCase()}.`);

export const RULES = [
  { title: 'The sky and the flyers', art: 'sky', p: [
    'Two flyers stand on the ground, you on the left and the rival on the right. Each holds one string to one kite. The sky is tall and portrait: kites stay inside the sky and are pushed gently back from its edges.',
    'The kite far up the screen looks a little smaller than one flying low, so you can judge height by size.',
  ] },
  { title: 'The kite and its heading', art: 'steer', p: [
    'Your kite is always flying to your heading point, the last place you touched. It speeds up toward the point and slows as it arrives, so it does not snap there.',
    `How hard the kite can turn depends on the wind: the stronger the wind, the more it can accelerate. At light wind it is lazy and a gust makes it lively. Each rival's kite has a slightly different handling (between 85% and 106% of yours).`,
  ] },
  { title: 'Wind', art: 'wind', p: [
    'The wind has a strength that changes all the time. It pushes both kites sideways, and lifts them: above about 0.58 the lift beats the weight of the kite and it climbs; below that it sinks.',
    'The strength is kept between 0.08 and 1.35. It rises in gusts and falls in lulls, which are generated for each round. The strip under the string bars draws the next six seconds of it. The direction stays the same for the whole round and the streaks and clouds drift that way.',
    ...skyParas,
  ] },
  { title: 'String length', art: 'modes', p: [
    `Every string starts ${K.L0} units long. The string can never be longer than ${K.LMAX} or shorter than ${K.LMIN}. A kite cannot fly farther from its flyer than its string allows.`,
    `Slack lets out ${K.EASE_RATE} units every second, so the string hangs in a curve. Steady keeps the string just tight: it gives and takes string as the kite moves (up to ${K.GIVE_OUT} units a second out, ${K.TAKE_IN} in). Pull reels in ${K.PULL_RATE} units every second and drags the kite toward you if it is at the end of its string.`,
    'The mode you pick stays on until you pick another, or until Pull runs out of Grip.',
  ] },
  { title: 'Grip', art: 'grip', p: [
    `Grip is your hand's strength. Pulling spends it: a full Grip lasts about ${gripFull} seconds of pulling. When it is empty, Pull switches off and the mode goes back to Steady; Pull cannot be chosen again until Grip is back to 25%.`,
    `Grip comes back by itself: in about ${gripBack} seconds of Steady, or about ${gripBackEase} seconds of Slack.`,
  ] },
  { title: 'Tension', art: 'tension', p: [
    'Tension shows how hard the kite is pulling on the string. A string with slack has low tension and hangs in a curve. A tight string carries the pull of the wind on the kite, so it is higher in a gust and lower in a lull, and rises when the kite surges outward. Pulling adds more.',
    `Tension is shown in four bands: slack (under 0.35), taut (0.35 to 0.75), hard (0.75 to ${K.STRAIN_AT}) and strain (above ${K.STRAIN_AT}). The string is drawn whiter when it is slack and redder as it strains.`,
    `At strain the string wears by itself: ${K.STRAIN_K} per second for each 1.0 of tension above ${K.STRAIN_AT}. That is how a hard pull into a gust can cost you a string without any rival at all.`,
  ] },
  { title: 'Crossings and wear', art: 'cross', p: [
    `The strings are curves that sag. Where they cross, they saw at each other. For the first ${K.ARM} seconds of a round the strings cannot cut, so kites can rise.`,
    `Each string loses string equal to ${K.CUT_K} per second, times the other string's pressure, times (0.25 + 0.75 times its own tension), times the sliding speed divided by ${K.CUT_SLIDE_REF}.`,
    `Pressure is the other string's tension (never less than 0.15), and 15% more while that flyer is pulling. Sliding speed is ${K.CUT_BASE_SLIDE} plus the speed at which the crossing point moves between the two strings, in units per second. The farther the crossing is from the flyers, the faster the string there moves.`,
    'So a tight string cuts harder and also wears faster. A slack string cuts softly and wears less.',
  ] },
  { title: 'Cutting a string', art: 'cut', p: [
    'Each string starts with 100 units of string. When yours reaches zero, the string parts at the crossing: the kite is free and tumbles away downwind, the loose string drops, and your rival wins the round.',
    'If both reach zero in the same instant, the one with less string left loses.',
  ] },
  { title: 'Time and the decision', p: [
    `A round lasts ${K.ROUND_TIME} seconds. If no string has parted by then, the flyer with more string left wins. If the two are within 1.5 units of each other, the flyer whose kite is higher wins.`,
  ] },
  { title: 'Rounds and the match', p: [
    'A match is the best of three rounds: the first flyer to win two rounds wins the match. A Quick Duel is one round. Each round has a new wind, and a new wind is also given to Watch & Learn.',
    'The result screen shows the rounds, how many strings you cut and how much string you had left at your worst moment.',
  ] },
  { title: 'The rivals', p: [
    ...rivalParas,
    'Rivals look ahead about a second with the same physics you fly in, weigh several headings and string modes, and choose among the best of them. They react after a short delay that varies, move their hand at a limited speed and sometimes slip. Stronger rivals consider more options, look further ahead and slip less. They never get a better kite or more string than you.',
  ] },
  { title: 'Think and Watch & Learn', art: 'think', p: [
    'Think (below the sky) asks a strong coach for a heading and string mode. The suggestion is shown for a few seconds and does not move your kite.',
    'Watch & Learn plays one round between two rivals in turns. Each turn is Think (the sky is frozen while the rivals consider their options; default 5 seconds, 2 to 10), then Reveal (2 seconds, the chosen heading is shown), then Act (the kites fly the plan for 2.4 seconds). Pause stops all of it, including the clocks and the animation, and Resume continues exactly where it stopped.',
  ] },
  { title: 'Settings', p: [
    'Text size scales every text screen from 100% to 300%. Calm effects turns off the flashes. Sound can be switched off at any time. Watch & Learn Think time can be 2, 5, 8 or 10 seconds.',
  ] },
];
