// Text for About, How to Play and the Rules reference. Numbers come from the engine's own constants (sim.js) and the
// rival table (ai.js), so the pages cannot drift from the real game. A section is { title, art?, p: [paragraphs] }.
import { K, ARENAS, ARENA_IDS, BODIES, BODY_IDS, TIPS, TIP_IDS, BALLAST, BALLAST_IDS, WEIGHT, derive } from './sim.js';
import { PROFILES } from './ai.js';
import { GAUGE } from './timing.js';

const lipWord = (l) => (l <= 300 ? 'easy' : l <= 400 ? 'fairly hard' : 'very hard');
const secs = (b) => Math.round(derive(b).life);

export const ABOUT = [
  { title: 'Spinning tops', art: 'parts', p: [
    'Spinning tops are played with in many parts of the world, and contests where one top is made to knock against another are old and widespread. Turned wooden tops are known by many names: gasing in Malaysia and Indonesia, trompo in Mexico and the Philippines, koma in Japan, and many more.',
    'This game is inspired by those traditions without belonging to any one of them. It does not claim to be the rules of any particular contest.',
  ] },
  { title: 'The craft', p: [
    'A good top is turned on a lathe from hard wood, balanced, painted in bands and fitted with a tip. Where the weight sits, how tall the top is and what the tip is made of all change how long it spins, how steadily it runs and how it behaves when another top hits it.',
  ] },
  { title: 'This version', art: 'dish', p: [
    'Spinning Tops Arena simulates the spin, the lean and wobble of a slowing top, the pull of a shallow dish and the knock of one top on another. You build your top in a workshop, launch it by pulling a cord, and see whose top is still turning at the end.',
    'Five rivals launch with a human hand: they aim well but not perfectly. You can also play against a friend on one device, learn step by step, or watch two rivals duel and see why each launches as it does.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'dish', p: [
    'Two tops are launched into a dish. The last top still spinning in the dish wins the round. Win two rounds out of three; a Quick Duel is one round.',
    'A top loses if it is knocked out over the rim, tips over, or stops spinning.',
  ] },
  { title: 'Build your top', art: 'parts', p: [
    'In the workshop pick a body, a tip and a rim weight, and which way it spins. The three bars show attack, defence and stamina, and the line below tells you how many seconds it spins if nothing touches it.',
    'Every choice costs something. The contest has a weight limit, so a heavy body leaves less room for rim weight.',
  ] },
  { title: 'Pull back and let go', art: 'launch', p: [
    'Press near your top at the bottom of the dish and drag back, like drawing a cord. The top will fly the other way. The ring around your top and the number at the top show the power and the angle. The dotted path shows where your top will go; if it ends in a red cross, that launch would carry you out of the dish.',
    'Let go to set the launch. A very short pull, or a tap, sets nothing.',
  ] },
  { title: 'Whip the cord', art: 'timing', p: [
    'After you let go a needle swings across a gauge. Tap when it is in the gold. A perfect whip spins your top at its full rate; a loose one spins it up to 30 percent slower, which makes it wobble and fall sooner. If you do not tap in time, the whip is loose.',
    'Press Aim again if you want to change the angle or the power before you tap.',
  ] },
  { title: 'Watch the wobble', art: 'spin', p: [
    'The spin bar shows how much of its launch spin a top has left. The steady bar shows how upright it is. A hit tips a top; a fast spin shrugs it off, a slow one does not. When the steady bar runs out the top falls.',
    'Speed x2 plays the round faster. Pause stops everything.',
  ] },
  { title: 'Think, Learn and Watch', art: 'think', p: [
    'Think suggests a launch and says why. It tries launches in the real physics, so the reason is what actually happened in the trial. It does not launch for you.',
    'Learn is five short lessons. Watch & Learn plays a whole match between two rivals: they Think, then Reveal their plans, then Act. Pause stops the whole thing.',
  ] },
  { title: 'Two players', p: [
    'Choose Two Players on the title screen. Each builds a top, then takes a turn to launch. The first launch is hidden behind a Pass the device card, so the second player cannot see it.',
  ] },
];

const rivalParas = PROFILES.map((p) => `${'★'.repeat(p.stars)}${'☆'.repeat(5 - p.stars)} ${p.name}: ${p.tag}.${p.stars < 5 ? ' Brings a top that suits the dish.' : ' Chooses the best of four tops after seeing yours.'}`);
const arenaParas = ARENA_IDS.map((id) => `${ARENAS[id].name}: ${ARENAS[id].blurb} It is ${lipWord(ARENAS[id].lip)} to knock a top over its rim.`);
const bodyParas = BODY_IDS.map((id) => `${BODIES[id].name} (weight ${WEIGHT.body[id]}): ${BODIES[id].blurb}`);
const tipParas = TIP_IDS.map((id) => `${TIPS[id].name}: ${TIPS[id].blurb}`);
const ballastParas = BALLAST_IDS.map((id) => `${BALLAST[id].name} (weight ${WEIGHT.ballast[id]}): ${BALLAST[id].blurb}`);

export const RULES = [
  { title: 'The dish and the tops', art: 'dish', p: [
    'Two tops are launched into a round dish. One starts at the bottom of the screen (yours) and one at the top. The dish curves, so it always pulls tops back toward the middle, and its floor has small dents that nudge tops about. The same dents are in every round.',
    'A round is decided as soon as only one top is still spinning in the dish.',
  ] },
  { title: 'Winning a round', art: 'ringout', p: [
    'A top is out when it: (1) is knocked over the rim, (2) tips over because its lean grows too big, or (3) has slowed to a stop. The other top wins.',
    `If both tops are still spinning after ${K.TIME} seconds, the one with more spin energy (spin rate times how hard it is to turn) wins. If both stop in the same instant, the one that was still turning faster wins.`,
    'Best of 3 means the first to win two rounds wins the match. Quick Duel is a single round. Rounds never end in a draw.',
  ] },
  { title: 'The launch', art: 'launch', p: [
    `You pull back from your top up to a longest pull; the power is the length of the pull as a share of that. A top launched at full power moves faster if it is light: speed goes down with the square root of the weight. A pull shorter than a small distance is ignored and nothing is set.`,
    `For the first ${K.GRACE} seconds after the launch the rim cannot put a top out, so a top that is thrown right at the rim bounces instead.`,
    'Both launches happen at the same moment. Against the computer you see nothing of the other launch before it happens.',
  ] },
  { title: 'The cord whip', art: 'timing', p: [
    `The needle swings across the gauge; the gold zone is the middle ${Math.round(GAUGE.perfect * 200)} percent of the gauge. In the gold the whip is perfect and spin is 100 percent. Moving outward from the gold the spin falls evenly to 70 percent at the far ends. Tapping in the brown zone around the gold (${Math.round(GAUGE.good * 200)} percent wide) still gives 90 percent or more of full spin.`,
    `If you do not tap within ${GAUGE.timeout} seconds the whip is loose: 70 percent spin. The launch spin of a full whip depends on the top: a top that is hard to turn is launched with a lower spin rate, but with more angular momentum, which is what keeps it upright and lasting.`,
  ] },
  { title: 'Spin, lean and wobble', art: 'spin', p: [
    'A spinning top stays upright because of its spin. Every top has a steady spin rate below which it can no longer stay upright. Above it, any lean dies away; below it, the lean grows, the top wobbles and its tip wanders in a circle, faster as the spin falls.',
    `A top falls over when its lean passes ${Math.round(K.FALL * 57.3)} degrees, or stops when its spin drops below ${K.DEAD} radians per second.`,
    'A leaning top drags its tip harder and loses spin faster. Air drag slows the spin more at higher spin rates, and wide tops feel more of it.',
  ] },
  { title: 'Hits', art: 'hit', p: [
    'When two tops touch they bounce apart. Heavier tops push lighter ones further. Bouncier bodies bounce more. A very gentle touch barely bounces.',
    'Where the rims rub, friction acts: tops spinning the same way grind each other down and lose spin; tops spinning opposite ways slide past each other and lose much less.',
    'Every hit tips a top over a little, away from the side it was hit from. The tilt from a hit is smaller for a top with more angular momentum (spin rate times how hard it is to turn) and bigger for a tall top.',
  ] },
  { title: 'The rim', art: 'ringout', p: [
    'When a top reaches the rim moving outward it bounces back, unless it is moving outward faster than the dish allows. Then it goes over and is out. Taller tops tip over the rim a little more easily.',
    ...arenaParas,
  ] },
  { title: 'The workshop: body', art: 'parts', p: [
    'Each top is a body, a tip and a rim weight. The bodies:',
    ...bodyParas,
    'Weight sets how hard a top hits and how hard it is pushed. Height of the weight sets how easily it leans. Width sets how big a target it is, and how much air drag it feels.',
  ] },
  { title: 'The workshop: tip and rim weight', art: 'weight', p: [
    'The tips (a Flat Peg takes less tilt from a hit and is harder to push; a Steel Point takes more and is easier to push):', ...tipParas,
    'The rim weights:', ...ballastParas,
    `The contest has a weight limit of ${WEIGHT.limit}: the weight of the body and of the rim weight together may not go over it. A weight that goes over the limit cannot be chosen.`,
  ] },
  { title: 'Attack, defence and stamina', art: 'stats', p: [
    'The workshop bars are read straight off the physics. Attack is weight, bounce and launch speed. Defence is how much angular momentum a top has for the height of its weight, and how well its tip holds the dish. Stamina is how many seconds it spins from a perfect whip to the point where it starts to wobble, if nothing touches it. Each bar is shown against the full range of all the parts you can choose.',
    `For example, a Pear with a Round Tip and no rim weight spins about ${secs({ body: 'pear', tip: 'pebble', ballast: 'std' })} seconds; a Wide Disc with a Steel Point about ${secs({ body: 'disc', tip: 'steel', ballast: 'std' })}.`,
  ] },
  { title: 'Spin direction', art: 'hands', p: [
    'Your top can spin clockwise or anticlockwise. It changes which way the top curves as it runs: a spinning top bends its path to one side. It also decides how it rubs against the other top (see Hits).',
  ] },
  { title: 'Rivals', p: [
    'Every rival plans a launch by trying launches in the same physics you play in, then launches with a hand that is not exact: its aim and power wobble and its cord whip is not always perfect. Stronger rivals try more launches, weigh more of your possible replies and have a steadier hand. Each level was tested against the one below it in simulation and beats it more often than not.',
    ...rivalParas,
  ] },
  { title: 'Think, Learn and Watch & Learn', art: 'think', p: [
    'Think tries a grid of launches against several launches you might meet, then gives the best one with a reason taken from what happened in the trial. It uses your own top and your rival\'s real top.',
    'Learn has five lessons with a goal each. Watch & Learn plays a best-of-three match between two rivals: Think (you choose how long, up to 10 seconds), Reveal (2 seconds, both plans and reasons are shown), Act (the launches and the round).',
  ] },
  { title: 'Two players, saving and the preview', p: [
    'In Two Players each player builds a top and launches in turn; the first launch is hidden. In a one-player match the game saves at the start of every round and about once a second while the tops run. Continue on the title screen picks the match up paused, where it was.',
    'The free preview counts only real play against the computer or a friend. Menus, rules, lessons and Watch & Learn do not use it up.',
  ] },
];
