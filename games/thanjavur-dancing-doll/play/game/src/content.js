// Text for About, How to Play and the Rules book. Numbers come from sim.js so the Rules always match the engine.
import { PHYS, PHASES, TOTAL, SCORE, DEMO_LEVELS, DEMO_RUNS, REVEAL_SECONDS, SETS, LEVEL_COUNT, levelFor, levelStats, periodOf, SETTLE_TH, SETTLE_OM } from './sim.js';
import { CHARS } from './doll.js';

export const THINK_CHOICES = [3, 5, 8, 10];
export { REVEAL_SECONDS };
const r1 = (v) => (Math.round(v * 10) / 10).toString();
const r2 = (v) => (Math.round(v * 100) / 100).toString();
const deg = (rad) => Math.round((rad * 180) / Math.PI);

export const ABOUT = {
  title: 'About',
  blocks: [
    { h: 'The Thanjavur dancing doll' },
    { p: 'In and around the city of Thanjavur (Tanjore) in Tamil Nadu, southern India, craftspeople make a famous folk toy: a painted figure with a big, heavy, round clay base and a head that nods. Give it a tap and it rocks, sways and bobs its head for a long time, then settles upright again, because the weight sits low in the round bottom. The craft is protected as a regional speciality and is a favourite souvenir.' },
    { p: 'This game describes the toy and the craft only, as play. The dolls here are original illustrations of everyday village characters, and the traditional workshops are the real source of the craft.' },
    { h: 'About this game' },
    { p: 'Thanjavur Dancing Doll turns the toy into a balance and rhythm game. You tune each doll by sliding its ballast bead, tap it to start it swaying, and match the sway pattern of a ghost doll, in time, over a 22 second performance. Across six sets the dolls come in rows, swing at different speeds, and a breeze leans on them.' },
    { p: 'Every doll you play starts as bare clay and gains its paint as you earn stars: body colour first, then the face, then the gold trim. Nothing is wagered and nothing breaks: only your own score.' },
    { h: 'Credits' },
    { p: 'Made by Arcforge, a collection of heritage games from around the world. All sound is synthesised on your device. The dolls, the toy-maker\'s room and the shelf are modelled and painted in real-time 3D on your device with three.js (MIT licence, copyright the three.js authors), with a flat 2D fallback when 3D is not available; the textures are generated in the game. Display text is set in Dela Gothic One (SIL Open Font License 1.1). Works offline.' },
  ],
};

export const HOWTO = {
  title: 'How to Play',
  blocks: [
    { h: 'The goal' },
    { p: 'Make your dolls sway exactly like the ghost dolls, for as long as you can, then bring them gently to rest.' },
    { fig: 'ghost', hh: 230 },
    { h: '1. Tune' },
    { p: 'Every doll has a bead on a rail under it. Slide the bead to change how quickly the doll swings. The tag above each doll tells you the swing time to aim for, and a gold inlay on the rail marks the right place in the early sets.' },
    { fig: 'rail', hh: 190 },
    { p: 'Before you start you can tap the dolls and watch them swing, to hear and see how fast they go. Press Start swaying when you are ready.' },
    { h: '2. Push' },
    { p: 'Tap a doll to push it away from the side you tapped. To keep a doll swinging, tap on the side it is leaving, as it goes. A tap near the rim is a strong push; a tap near the middle is a gentle nudge. Rest a finger on a doll for a moment and it steadies.' },
    { fig: 'tap', hh: 230 },
    { h: '3. Match' },
    { p: 'The performance has three parts: Build (follow the ghost as it swings up), Hold (stay inside the ghost, this is what scores) and Settle (ease down with the ghost until the doll is at rest).' },
    { fig: 'timeline', hh: 100 },
    { h: 'Three ways to play' },
    { li: 'Practice: a wider timing window, red arrows that show where to tap, and a hint button.' },
    { li: 'Play: the real thing. Your sync and your settle set your stars and your score.' },
    { li: 'Watch and Learn: the game tunes and plays the level for you and thinks aloud before each part. Pause it any time.' },
    { h: 'On a keyboard' },
    { p: 'Number keys pick a doll. Left and Right push the doll that way. Up and Down move its bead. Space starts. P or Escape pauses, H shows the hint in Practice.' },
  ],
};

const rangeTxt = (a, b) => (r1(a) === r1(b) ? `${r1(a)}` : `${r1(a)} to ${r1(b)}`);
export function rulesPages() {
  const rows = SETS.map((s, i) => {
    const a = levelFor(i * 4), b = levelFor(i * 4 + 3), sa = levelStats(a), sb = levelStats(b);
    return { li: `${i + 1}. ${s.name}: ${sa.dolls === sb.dolls ? sa.dolls : sa.dolls + ' to ' + sb.dolls} doll${sb.dolls > 1 ? 's' : ''}, swing times ${r1(Math.min(sa.minT, sb.minT))} to ${r1(Math.max(sa.maxT, sb.maxT))} s, timing window ${rangeTxt(Math.min(sa.tol, sb.tol), Math.max(sa.tol, sb.tol))} degrees${sb.breeze > 0 ? ', with a breeze' : ''}.` };
  });
  return [
    {
      title: 'The performance',
      blocks: [
        { h: 'Levels' },
        { p: `There are ${LEVEL_COUNT} levels in ${SETS.length} sets of four, plus a Daily Set that changes every day. Each level is the same every time you play it, so you can learn it and improve.` },
        ...rows,
        { h: 'The three parts' },
        { fig: 'timeline', hh: 100 },
        { li: `Build, ${PHASES.RAMP} seconds: the ghosts swing up from rest to their full lean. Nothing is scored yet.` },
        { li: `Hold, ${PHASES.HOLD} seconds: the ghosts swing at full lean. Every moment your doll is inside the timing window counts as in time. This is your sync.` },
        { li: `Settle, ${PHASES.SETTLE} seconds, and a rest of ${r1(PHASES.REST)}: the ghosts ease down to stillness. At the very end each doll is checked for how still and upright it is.` },
        { p: `A performance takes ${r1(TOTAL)} seconds in all. Before it starts the clock is stopped and you can tune and test the dolls for as long as you like.` },
      ],
    },
    {
      title: 'Dolls and tuning',
      blocks: [
        { h: 'How a doll swings' },
        { fig: 'sway', hh: 230 },
        { p: `A doll's lean is a pendulum: it is pulled back to upright with a strength set by its ballast bead, and slowed a little by friction (damping ${r2(PHYS.DAMP)} per second). With the bead at the slow end a doll takes ${r2(periodOf(0))} seconds for a full swing; at the quick end it takes ${r2(periodOf(1))} seconds.` },
        { p: `A doll that leans further than ${deg(PHYS.LIMIT)} degrees bumps the shelf and bounces back.` },
        { h: 'The bead and the tag' },
        { fig: 'rail', hh: 190 },
        { p: 'The tag above each doll shows the swing time the ghost uses and the peak lean in degrees. The number above the bead shows what the doll will do now. When they match, the doll swings in step with its ghost with the least effort.' },
        { p: 'In sets 1 to 3 a gold inlay shows the right place on the rail, and it turns green when the bead is in it. Later sets give you the number only. You can move a bead during the performance, but a moving bead changes the swing speed at once.' },
      ],
    },
    {
      title: 'Pushing',
      blocks: [
        { h: 'Taps' },
        { fig: 'tap', hh: 230 },
        { p: `A tap pushes the doll away from the side you tapped. A full-strength tap, at the rim, adds ${r2(PHYS.TAP)} radians per second to the swing; a tap at the very middle adds ${Math.round(PHYS.TAP_MIN * 100)}% of that, and everything between scales smoothly.` },
        { p: `A doll can be tapped again after ${r2(PHYS.COOLDOWN)} seconds and you have one finger, so any two taps are at least ${r2(PHYS.FINGER)} seconds apart.` },
        { h: 'Steadying' },
        { p: `Keep a finger resting on a doll for more than ${r2(PHYS.HOLD_AFTER)} seconds and you steady it: the damping rises to ${r2(PHYS.DAMP + PHYS.HOLD_DAMP)} per second until you lift off. In Build and Hold a tap pushes the moment your finger lands. In Settle the push waits for the lift, so a finger that stays down only steadies.` },
        { h: 'The breeze' },
        { p: 'From set 5 a slow breeze leans on the dolls, a different amount on each one, easing off during the settle part. It does not change the ghost: you have to push against it to stay in time.' },
      ],
    },
    {
      title: 'Score and stars',
      blocks: [
        { h: 'Sync and settle' },
        { p: `Sync is the share of the ${PHASES.HOLD} second hold in which a doll is within the timing window of its ghost (in Practice the window is 40% wider), averaged over the dolls. Settle is how still and upright each doll is at the end: full marks inside ${r2(SETTLE_TH)} radians of lean and ${r2(SETTLE_OM)} radians per second of swing, fading to nothing at twice that.` },
        { p: `Quality is ${Math.round(SCORE.sync * 100)}% sync plus ${Math.round(SCORE.settle * 100)}% settle. Score is quality times ${SCORE.max}.` },
        { h: 'Stars' },
        { p: `One star at ${Math.round(SCORE.stars[0] * 100)}% quality, two at ${Math.round(SCORE.stars[1] * 100)}%, three at ${Math.round(SCORE.stars[2] * 100)}%. Practice awards no stars. Your best score and stars for each level are kept on your device.` },
        { h: 'Painting the dolls' },
        { p: `Each level has its own dolls (${CHARS.map((c) => c.name).join(', ')}). They begin as bare clay. One star paints the body, two stars the face, three stars the gold trim.` },
      ],
    },
    {
      title: 'Watch and Learn',
      blocks: [
        { h: 'The game plays, you study' },
        { p: 'Watch and Learn runs the level with the same physics. The performer moves the beads to the right places, then plays the swing with taps of whatever strength it needs, one finger at a time. Before each part the clock stops and the game goes through three steps.' },
        { li: `Think: the performer looks at what is ahead. You choose how long this lasts in Settings (${THINK_CHOICES.join(', ')} seconds; 5 is the default and 10 is the longest).` },
        { li: `Reveal: for ${REVEAL_SECONDS} seconds the rails and the ghost are lit and arrows show where the next taps go.` },
        { li: 'Act: the clock runs again and the part is played.' },
        { p: 'Pause stops everything, including the Think and Reveal timers, and resumes exactly where it stopped. In Practice the hint button does a Reveal for you: the clock stops while the rails and the arrows are shown.' },
        { h: 'Settings' },
        { p: 'Sound, think time, reduced motion and the text size (to 300%) are in Settings, reachable from the main menu.' },
      ],
    },
    {
      title: 'Free to play and demo',
      blocks: [
        { h: 'In the app' },
        { p: 'Menus, Rules, Watch and Learn and results are always free. Free to play with short ads; go ad-free once.' },
        { p: `The public web demo is limited to ${DEMO_RUNS} performances on the first ${DEMO_LEVELS} levels, so it is a taste of the game; the apps for iPhone and Android hold everything.` },
      ],
    },
  ];
}
