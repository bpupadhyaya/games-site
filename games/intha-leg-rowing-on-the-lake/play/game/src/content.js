// Text for About, How to Play and the Rules book. Numbers come from sim.js / courses.js so the Rules always match the engine.
import { PHYS, SCORE, DEMO_RUNS } from './sim.js';
import { COURSES } from './courses.js';

export const THINK_CHOICES = [3, 5, 8, 10];
export const REVEAL_SECONDS = 2;
const m1 = (v) => (Math.round(v * 100) / 100).toString();

export const ABOUT = {
  title: 'About',
  blocks: [
    { h: 'Intha Leg Rowing' },
    { p: 'The Intha people live on and around Inle Lake in Shan State, Myanmar, in stilt villages, and grow vegetables and tomatoes on floating gardens anchored to the lake bed with bamboo poles. Their fishermen are famous for leg rowing: standing on one leg at the stern of a narrow boat, the other leg wrapped round a long oar. The oar is worked with the leg, so both hands stay free to hold a tall conical net and to see over the floating weed and reeds.' },
    { p: 'The technique is as much balance as strength: the rower sweeps the oar in a sculling stroke, steers with the side of the sweep, and goes still to lift the net when a shoal is alongside.' },
    { h: 'About this game' },
    { p: 'Intha Leg Rowing turns that skill into a calm balance and flow game seen from above. Your thumb is the leg: hold and drag it left and right along the oar pad to scull. Sweep faster for speed, sweep on the side you want to go to steer, keep your poise over swells and stakes, and go still beside a shoal to lift the net. Eight courses take you from a wide dawn channel to the lake regatta, racing three other boats.' },
    { p: 'The people and boats are stylised drawings, not portraits of real rowers. The lake, the gardens and the villages are original illustrations, and no national flags or emblems are used. The game shows fishing and travel only.' },
    { p: 'This is a game, not a coaching guide. Real leg rowing is learned from experienced rowers over years; do not try to stand in a small boat without them.' },
    { h: 'Credits' },
    { p: 'Made by Arcforge, a collection of heritage games from around the world. All sound is synthesised on your device. Titles are set in Cormorant Garamond (SIL Open Font License 1.1). Drawn with plain canvas graphics; works offline.' },
  ],
};

export const HOWTO = {
  title: 'How to Play',
  blocks: [
    { h: 'The goal' },
    { p: 'Row to the landing at the end of the channel ahead of three rivals, and net fish and thread buoy gates on the way. You do one thing with your thumb: hold the oar pad and sweep left and right.' },
    { fig: 'boat', hh: 250 },
    { h: 'Scull: speed' },
    { p: 'Hold anywhere on the lower part of the screen and drag left and right. The oar blade on the pad follows your thumb. The faster and wider you sweep, the faster the boat goes. A steady stroke sits in the green part of the stroke meter. Frantic sweeping (red) costs poise.' },
    { fig: 'pad', hh: 170 },
    { fig: 'meter', hh: 110 },
    { h: 'Steer: where you sweep' },
    { p: 'Sweep on the side you want to go to. The small teal marker on the pad shows the centre of your recent sweeps: that is where the boat is steering. Sweep evenly around the middle to go straight.' },
    { h: 'Poise' },
    { p: 'The bar in the HUD is your balance. Stakes, banks, other boats, swells and frantic strokes cost poise; smooth strokes and a still oar restore it. Run out and you splash into the lake, lose a few seconds and climb back aboard.' },
    { h: 'The lake' },
    { fig: 'legend', hh: 250 },
    { h: 'Net a shoal' },
    { p: 'A shoal is a swirl of fish. Steer so it is on your right, beside the net, then lift your thumb or hold still and let the boat coast. When the net ring fills, you catch the shoal. Rowing fast scares shoals away.' },
    { h: 'Three ways to play' },
    { li: 'Practice: gentler knocks, a quicker recovery, weaker rivals and a hint button that shows a good line.' },
    { li: 'Race: the real thing. Your stars come from finishing, winning and meeting the fish quota.' },
    { li: 'Watch and Learn: the game rows the course for you, thinking out loud before each section. Pause it any time.' },
    { h: 'On a keyboard' },
    { p: 'Hold Left or Right arrow to sweep the oar to that side: alternate them to scull. Space holds the oar still, P or Escape pauses and H is the hint in Practice.' },
  ],
};

export function rulesPages() {
  const first = COURSES[0], last = COURSES[COURSES.length - 1];
  const rows = COURSES.map((c) => ({ li: `${c.name}: ${c.length} m, ${c.shoals.length} shoals, catch ${c.quota} fish for the star. ${c.blurb}` }));
  return [
    {
      title: 'The race',
      blocks: [
        { h: 'The setup' },
        { p: `There are ${COURSES.length} courses, from ${first.length} m to ${last.length} m. You race three rivals down a winding lake channel. You start abreast behind the line after a three-second count-in. The first boat to cross the finish line wins; when you cross it the race ends and your place is read from the standings at that moment.` },
        { h: 'The courses' },
        ...rows,
        { p: 'Each course is fixed, so you can learn it. Rivals keep the same names and skill on each course. Boats never block each other for long: boats alongside push each other apart.' },
      ],
    },
    {
      title: 'Rowing: speed and steering',
      blocks: [
        { h: 'The oar pad' },
        { fig: 'pad', hh: 170 },
        { p: `While your thumb is down, the oar is in the water and follows your thumb along the pad from -1 (left) to +1 (right). The oar can move at most ${PHYS.A_MAX} pad units per second, which is as fast as a very quick drag. Lift your thumb and the oar leaves the water and drifts back to the middle.` },
        { h: 'Speed' },
        { p: `Every unit of oar movement in the water adds speed, up to a stroke speed of ${PHYS.TS_CAP} units per second; sweeping faster than that adds nothing. Speed gains fade as you approach the top speed of ${PHYS.VMAX} m/s, and the water drags the boat all the time, so a steady stroke settles at about three metres a second. Weed patches slow the boat much more and halve the push of each stroke.` },
        { fig: 'meter', hh: 110 },
        { h: 'Steering' },
        { p: `Sweeping with the oar on one side of the pad turns the boat that way: the turn is proportional to how far from the middle the oar is and how fast it moves. The boat keeps its heading and only slowly straightens (${m1(PHYS.H_RESTORE)} per second), up to ${m1(PHYS.HMAX)} radians off the channel. The teal marker shows the centre of your recent sweeps.` },
        { h: 'Banks' },
        { p: `The banks are floating gardens. If the boat touches one it is held back and loses speed, and the first touch in each ${m1(0.9)} seconds costs ${m1(PHYS.BANK_COST)} poise.` },
      ],
    },
    {
      title: 'Poise',
      blocks: [
        { h: 'Your balance' },
        { p: 'Poise runs from full to empty. It never matters until it is gone: at empty you splash into the lake.' },
        { h: 'What costs poise' },
        { li: `Fishing stakes and gate buoys: ${m1(PHYS.HIT_COST)} each hit, and the boat loses most of its speed.` },
        { li: `Touching a bank: ${m1(PHYS.BANK_COST)}.` },
        { li: `Bumping another boat: ${m1(PHYS.BUMP_COST)} for the boat behind.` },
        { li: `Frantic strokes: sweeping faster than ${m1(PHYS.FRENZY)} units per second costs ${m1(PHYS.FRENZY_COST)} poise for each unit above that, every second.` },
        { li: `Swells: sweeping faster than ${m1(PHYS.SWELL_FREE)} units per second in a swell band costs up to ${m1(PHYS.SWELL_COST * 1.6)} poise per second. Row gently through a swell, or go still.` },
        { h: 'What restores it' },
        { li: `A steady stroke between 0.6 and 3.8 units per second restores ${m1(PHYS.REGEN_STROKE)} per second (half of that in a swell).` },
        { li: `Lifting your thumb restores ${m1(PHYS.REGEN_STILL)} per second.` },
        { p: 'In Practice every knock costs 55% as much.' },
      ],
    },
    {
      title: 'The lake',
      blocks: [
        { h: 'What is on the water' },
        { fig: 'legend', hh: 250 },
        { li: 'Fishing stake: a bamboo pole in the water. Hit it and you lose speed and poise.' },
        { li: `Buoy gate: two buoys ${m1(PHYS.GATE_GAP)} m apart. Pass between them, clear of both, for a gate bonus. A missed gate scores nothing.` },
        { li: 'Water hyacinth: a floating weed mat. The boat drags in it and each stroke is half as strong; you cannot net in it.' },
        { li: 'Swell band: rolling waves across the whole channel. See Poise.' },
        { li: 'Fence gap: bamboo fish fences that pinch the channel to a narrow gap. The banks are just as hard as anywhere else.' },
        { li: 'Fish shoal: see Fish and the net.' },
        { p: 'Banks are gardens on bamboo stakes and are never hazards on their own; they only stop the boat.' },
      ],
    },
    {
      title: 'Fish and the net',
      blocks: [
        { h: 'Netting' },
        { p: `The net is held out on the right of the boat, ${m1(PHYS.NET_Y)} m to the side and ${m1(PHYS.NET_X)} m ahead. A shoal within ${m1(PHYS.NET_R)} m of the net ring can be caught if three things are true: the boat has slowed to ${m1(PHYS.NET_V)} m/s or less, the oar is still (your thumb is up, or sweeping slower than ${m1(PHYS.NET_STILL)} units per second), and you are not in weed.` },
        { p: `While all three hold, the net ring fills over ${m1(PHYS.NET_T)} seconds and the shoal is caught. If any of them stops, the ring drains. A shoal holds two to five fish.` },
        { h: 'Scaring them' },
        { p: 'A shoal swims in slow circles. If a boat faster than 2.7 m/s comes within five metres, it swims sideways away from the boat. Slow down early, and put the shoal on your right.' },
        { h: 'The fish quota' },
        { p: 'Each course has a fish quota, shown in the HUD. Meeting it earns a star. You can ignore the fish and just race, at the cost of that star and the fish points.' },
      ],
    },
    {
      title: 'Falls and recovery',
      blocks: [
        { h: 'Splashing' },
        { p: `When poise runs out you fall in. The oar is out of the water for ${m1(PHYS.DOWN_T)} seconds (${m1(PHYS.DOWN_T_PRACTICE)} in Practice) while the boat coasts to a stop, then you climb aboard with poise at 55%. The fall costs you time and keeps you from a clean-run bonus.` },
        { h: 'Rivals' },
        { p: 'Rivals are rowers like you: they can bump you, they steer round stakes, and the weaker ones fall in more often. Their speed and steadiness are set by their skill, from a beginner to an expert on the regatta course. In Practice they are weaker and fall in more.' },
      ],
    },
    {
      title: 'Score and stars',
      blocks: [
        { h: 'Points' },
        { p: `Finishing scores ${SCORE.finish}. Your place adds ${SCORE.place.join(', ')} points for 1st to 4th. Each fish scores ${SCORE.fish}, each gate ${SCORE.gate}, a run with no splash ${SCORE.clean}, and every second faster than the course's par time ${SCORE.perSecond}.` },
        { h: 'Stars' },
        { li: 'One star for finishing.' },
        { li: 'One star for winning the race.' },
        { li: 'One star for meeting the fish quota.' },
        { p: 'Practice does not award stars. Your best place, time, fish and score for each course are kept on your device.' },
      ],
    },
    {
      title: 'Watch and Learn',
      blocks: [
        { h: 'The game rows, you study' },
        { p: 'Watch and Learn rows a course with the same physics and rivals as Race. The performer is the same planner the rivals use, at its best, and it nets shoals. Before each section of the course the clock stops and the game goes through three steps.' },
        { li: `Think: the performer looks at what is ahead. You choose how long this lasts in Settings (${THINK_CHOICES.join(', ')} seconds; 5 is the default and 10 is the longest).` },
        { li: `Reveal: for ${REVEAL_SECONDS} seconds the planned line ahead is drawn as a gold dashed path, with a gold ring on the spot it is aiming for.` },
        { li: 'Act: the clock runs again and the section is rowed.' },
        { p: 'Pause stops everything, including the Think and Reveal timers and any stroke in progress, and resumes exactly where it stopped. In Practice the hint button does a Reveal for you.' },
        { h: 'Settings' },
        { p: 'Sound, think time, reduced motion and text size (to 300%) are in Settings, reachable from the main menu.' },
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
