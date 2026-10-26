// Text for About, How to Play and the Rules book. Numbers come from sim.js / courses.js so the Rules always match the engine.
import { PHYS, ZONES, SCORE, STAR_PLACE, DEMO_RUNS } from './sim.js';
import { COURSES } from './courses.js';

export const THINK_CHOICES = [3, 5, 8, 10];
export const REVEAL_SECONDS = 2;
const m1 = (v) => (Math.round(v * 100) / 100).toString();

export const ABOUT = {
  title: 'About',
  blocks: [
    { h: 'Egrang' },
    { p: 'Egrang is a traditional stilt game from Indonesia, also played in Malaysia and nearby islands. Two long bamboo poles, each with a footrest, lift a walker well above the ground. Children and adults walk, race and play obstacle courses on them, and it is a favourite at village festivals and Independence Day celebrations, where whole lanes are strung with bunting and neighbours cheer from the roadside.' },
    { p: 'Walking on stilts is a balance skill: the body falls forward over one stilt and the other has to be planted in time. Beginners take short, careful steps; practised walkers run, hop over ruts and even overtake each other.' },
    { h: 'About this game' },
    { p: 'Egrang turns that skill into a balance and rhythm game. Every step is a choice of when to tap, which sets your speed and stride, and where to tap, which catches the sideways wobble. Eight courses take you from a flat village lane to a festival final with streams, plank bridges, mud and hills, against three rivals.' },
    { p: 'The people in the game are stylised, not portraits of real walkers. The festival, the bunting and the villages are original illustrations; no national flags or emblems are used.' },
    { p: 'This is a game, not a coaching guide. Real stilt walking is best learned from someone experienced, over soft ground, and starting low.' },
    { h: 'Credits' },
    { p: 'Made by Arcforge, a collection of heritage games from around the world. All sound is synthesised on your device. Titles are set in Dela Gothic One (SIL Open Font License 1.1). Drawn with plain canvas graphics; works offline.' },
  ],
};

export const HOWTO = {
  title: 'How to Play',
  blocks: [
    { h: 'The goal' },
    { p: 'Reach the finish line first. You walk on bamboo stilts along a village road with three rivals. You only ever do one thing: tap to plant the free stilt. When you tap and where you tap are both part of the skill.' },
    { fig: 'walker', hh: 230 },
    { h: 'When: the step meter' },
    { p: 'Your body falls forward over the planted stilt. The step meter shows how far over it will be when your next stilt lands. Tap while the bead is in the green and you keep your speed. Tap earlier (blue) for a short, slow step. Tap later (amber) for a long, fast step. Wait too long (red) and you fall forward.' },
    { fig: 'meter', hh: 140 },
    { h: 'Where: the sideways rail' },
    { p: 'Every step also wobbles you sideways. The bright bead on the rail shows where the wobble will be when the stilt lands. Tap on the screen right under that bead and your stilt catches you. Tapping far from it overcorrects. If the bead reaches the red end you fall sideways.' },
    { fig: 'rail', hh: 160 },
    { h: 'The ground' },
    { p: 'A ring on the road shows where your next stilt will land. Green is good ground, red is trouble. Aim steps to land between puddles and potholes, and exactly on stepping stones.' },
    { fig: 'terrain', hh: 230 },
    { h: 'Bumping' },
    { p: 'When a rival is alongside, the Bump button lights up. Bump them to wobble them, but your own balance shifts a little too. Rivals may bump you.' },
    { h: 'Three ways to play' },
    { li: 'Practice: gentler wobbles, quick recoveries, a hint button that shows the ideal next step.' },
    { li: 'Race: the real thing. Your finishing place sets your stars.' },
    { li: 'Watch and Learn: the game races the course for you, thinking out loud before each section. Pause it any time.' },
    { h: 'On a keyboard' },
    { p: 'Space taps. Hold Left or Right with Space to tap under the bead on that side. B bumps, P or Escape pauses, H is the hint in Practice.' },
  ],
};

export function rulesPages() {
  const L = COURSES[COURSES.length - 1], first = COURSES[0];
  const rows = COURSES.map((c) => ({ li: `${c.name}: ${c.length} m. ${c.blurb}` }));
  return [
    {
      title: 'The race',
      blocks: [
        { h: 'The setup' },
        { p: `There are ${COURSES.length} courses, from ${first.length} m to ${L.length} m. You race three rivals on a four-lane village road. Lanes are only depth: you never block each other, and a stilt can land anywhere across the width of the road.` },
        { p: 'A three-second countdown, then everyone starts walking. The first to cross the finish line wins. When you cross it the race ends and your place is read from the standings at that moment.' },
        { h: 'The courses' },
        ...rows,
        { p: 'The terrain of each course is fixed, so you can learn it and improve. Rivals keep the same names and skill on each course.' },
      ],
    },
    {
      title: 'Stepping: when',
      blocks: [
        { h: 'The pendulum' },
        { p: `While one stilt is planted, your body falls forward over it like an upside-down pendulum. The step meter shows the lean your body will have at the moment the next stilt touches down; that is the lean you are choosing when you tap. The swing of the stilt takes ${m1(PHYS.SWING_T)} seconds (a little longer in mud), and the meter already takes that into account.` },
        { fig: 'meter', hh: 140 },
        { h: 'Zones of the meter' },
        { li: `Blue, below ${m1(ZONES.slow)}: a short step. You lose speed. Too many in a row and you stall and fall backwards.` },
        { li: `Green, ${m1(ZONES.slow)} to ${m1(ZONES.steady)}: a steady step. This keeps your speed on level ground.` },
        { li: `Amber, ${m1(ZONES.steady)} to ${m1(ZONES.push)}: a long step. You gain speed, and you are close to the edge.` },
        { li: `Red, beyond ${m1(ZONES.push)}: you fall forward before the stilt can land (the limit is ${m1(PHYS.U_FALL)}).` },
        { h: 'Stride and speed' },
        { p: `The free stilt lands ${m1(PHYS.R)} m ahead of your body, so your stride is that plus the lean you chose. A bigger lean at landing makes a longer stride and a faster body. Drag slows you a little every second, and mud slows you more, so level ground needs about the middle of the green.` },
        { p: 'Slopes change what the green means: uphill needs a later tap to keep the same speed, downhill a calmer one.' },
        { p: `A fresh tap needs at least ${m1(PHYS.MIN_GAP)} seconds after the last landing.` },
      ],
    },
    {
      title: 'Stepping: where',
      blocks: [
        { h: 'The sideways wobble' },
        { fig: 'rail', hh: 160 },
        { p: `Besides leaning forward you also wobble from side to side, from -1 to +1. The wobble grows on its own, faster on narrow plank bridges and earth bunds, and every landing adds a small random kick that is larger on rough ground. At ${m1(PHYS.W_FALL)} (${m1(PHYS.W_FALL_PLANK)} on planks and bunds) you fall sideways.` },
        { h: 'Catching it' },
        { p: `Where you tap along the width of the screen is where the new stilt is planted sideways. Tap under the bright bead and the wobble is cancelled (the correction is ${m1(PHYS.CATCH)} times the position you tap at). Tap near the middle for a small catch, near an end for a big one. A tap on the wrong side makes it worse.` },
        { p: 'You can tap early to catch a wobble that is getting out of hand; that costs speed, so it is a trade-off.' },
        { h: 'Bumps' },
        { p: `A rival within ${m1(PHYS.BUMP_RANGE)} m of you can be bumped. The bump adds a sideways kick to them, slows them slightly and pushes you back a little. The button then needs ${PHYS.BUMP_COOL} seconds to recover. Rivals bump too, more often when they are better.` },
      ],
    },
    {
      title: 'The ground',
      blocks: [
        { h: 'What each ground does' },
        { fig: 'terrain', hh: 230 },
        { li: 'Road and bund: normal ground. The narrow bund is earth between flooded fields: the wobble grows faster and the fall limit is tighter.' },
        { li: 'Puddle: the stilt slips. A big sideways kick, so be ready to catch it.' },
        { li: 'Pothole: the stilt sinks in. A sideways kick and you lose some speed.' },
        { li: 'Rock: a small kick and a little speed lost.' },
        { li: 'Mud: the stilt sticks. The swing takes longer and drag is much higher while you are on it, so build speed before it and keep pushing.' },
        { li: 'Stepping stones: in a stream the only ground is the stones. Land on a stone, or the stilt goes into the water and you splash down.' },
        { li: 'Planks: a bridge with a narrow wobble limit and rough boards.' },
        { li: 'Slopes: the road tilts up or down gently. Uphill the meter needs a later tap; downhill you gain speed more easily.' },
      ],
    },
    {
      title: 'Falls and recovery',
      blocks: [
        { h: 'Falling' },
        { p: 'You fall if the lean runs past the red end of the meter (forward), if you stall before the stilt can plant (backward), if the wobble passes its limit (sideways) or if a stilt lands in water (splash). A fall ends your chain.' },
        { h: 'Getting up' },
        { p: `In a race you are down for ${m1(PHYS.DOWN_T)} seconds (${m1(PHYS.DOWN_T_PRACTICE)} in Practice), then you stand up exactly where you fell and walk on with a gentle push. Rivals fall and get up the same way.` },
        { h: 'Practice help' },
        { p: 'In Practice the wobble grows 30% slower, kicks are smaller, the fall limits are wider and rivals are weaker, so you can learn the rhythm.' },
      ],
    },
    {
      title: 'Score and stars',
      blocks: [
        { h: 'Steps' },
        { p: `A step is Perfect when it lands on good ground, with a tap inside the usable range of the meter and the wobble back under 0.2 after the catch. It scores ${SCORE.perfect} plus ${SCORE.chainStep} for each Perfect in your chain (up to ${SCORE.chainMax}). Any other safe step scores ${SCORE.good} and keeps your chain; a trip, a slip or a fall ends it.` },
        { h: 'The finish' },
        { p: `Your place adds ${SCORE.place.join(', ')} points for 1st to 4th, finishing adds ${SCORE.finish}, and every second faster than the course's par time adds ${SCORE.perSecond}.` },
        { h: 'Stars' },
        { p: `1st place earns ${STAR_PLACE[0]} stars, 2nd ${STAR_PLACE[1]}, and 3rd or 4th ${STAR_PLACE[2]}. Practice does not award stars, and your best place, time and score for each course are kept on your device.` },
      ],
    },
    {
      title: 'Watch and Learn',
      blocks: [
        { h: 'The game walks, you study' },
        { p: 'Watch and Learn runs a race with the same physics and rivals as Race. The performer is the same AI that rivals use, at its best. Before each section of the course the clock stops and the game goes through three steps.' },
        { li: `Think: the performer looks at what is ahead. You choose how long this lasts in Settings (${THINK_CHOICES.join(', ')} seconds; 5 is the default and 10 is the longest).` },
        { li: `Reveal: for ${REVEAL_SECONDS} seconds the road ahead is marked: green for ground where a stilt may land, red for trouble, and a gold ring for the spot the performer chose.` },
        { li: 'Act: the clock runs again and the section is walked.' },
        { p: 'Pause stops everything, including the Think and Reveal timers and any step in progress, and resumes exactly where it stopped. In Practice the hint button does a Reveal for you: it stops the clock for a moment and shows the next landing spot and the moment to tap.' },
        { h: 'Settings' },
        { p: 'Sound, think time, the landing ring, text size (to 300%) and reduced motion are in Settings, reachable from the main menu.' },
      ],
    },
    {
      title: 'Free to play and demo',
      blocks: [
        { h: 'In the app' },
        { p: 'Menus, Rules, Watch and Learn and results are always free. Free to play with short ads; go ad-free once.' },
        { p: `The public web demo is limited to ${DEMO_RUNS} runs on the first course, so it is a taste of the game; the apps for iPhone and Android hold everything.` },
      ],
    },
  ];
}
