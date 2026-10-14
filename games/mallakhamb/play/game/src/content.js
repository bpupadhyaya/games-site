// Text for About, How to Play and the Rules book. Numbers come from routine.js so the Rules always match the engine.
import { MOVES, MOVE_ORDER, GESTURE_NAMES, JUDGE, TIMING, LEARN_WINDOW, LEARN_DRIFT, SWIPE_MIN, BAL, SCORE, HOLD_SCORE, FLOW, COMBO_STEP, COMBO_MAX, STAR_AT, HOLD_GRADES, COUNT_IN, PHRASE, THINK_CHOICES, REVEAL_SECONDS, MAX_H, ROUTINES, DEMO_RUNS, STEER_RANGE } from './routine.js';

const ms = (s, k = 1) => `${Math.round(s * k * 1000)} ms`;

export const ABOUT = {
  title: 'About',
  blocks: [
    { h: 'Mallakhamb' },
    { p: 'Mallakhamb is a gymnastic discipline from India. A performer climbs a smooth, upright wooden pole and links poses and wraps into one flowing routine, using only strength, balance and control. The name joins malla, a gymnast or strong person, with khamb, a pole. It is the state sport of Madhya Pradesh and is practised and taught across India and in many other countries.' },
    { p: 'Besides the fixed pole used in this game, performers also train on a hanging pole and on a rope. A routine is judged on how cleanly the poses are reached, how long they are held and how smoothly one flows into the next.' },
    { h: 'About this game' },
    { p: 'Mallakhamb turns a routine into a rhythm and balance game. Swipe to climb, slide and wrap in time with the beat, then press and hold to take a long pose and steer your balance. The performer is a generic 3D figure, not a real athlete.' },
    { p: 'This is a game, not a coaching guide. Real mallakhamb is learned from a trained teacher over a soft surface, never from an app.' },
    { h: 'Credits' },
    { p: 'Made by Arcforge, a collection of heritage games from around the world. All sound is synthesised on your device. Titles are set in Dela Gothic One (SIL Open Font License 1.1). Drawn with canvas graphics and a real-time 3D scene for the performer, the crowd and the pit; no ads, works offline.' },
  ],
};

export const HOWTO = {
  title: 'How to Play',
  blocks: [
    { h: 'The goal' },
    { p: 'Perform a whole routine on the pole. Each move arrives along the ribbon at the bottom of the screen and reaches the glowing ring on the beat. Do what it says as it lands, and keep the flow going.' },
    { fig: 'gestures', hh: 190 },
    { h: 'Moves on the ribbon' },
    { li: 'An arrow means swipe that way anywhere on the screen: up to climb, down to slide, left or right to wrap round the pole.' },
    { li: 'A circle with a dot means tap, used for the salute at the start and the end.' },
    { li: 'A long bar means press and hold. Keep your finger down for the whole bar, and slide it left or right to steer your balance.' },
    { fig: 'moves', hh: 470 },
    { h: 'Timing' },
    { p: 'Move as the node meets the ring. Closer to the beat scores more: Perfect, Great or Good. Too early or too late is a miss, and a miss costs flow.' },
    { h: 'Holds and balance' },
    { p: 'In a hold the performer sways. The marker on the balance bar drifts left and right. Slide your finger the other way to bring it back to the middle. Stay inside the bright band for as long as you can.' },
    { fig: 'gauge', hh: 150 },
    { h: 'Flow' },
    { p: 'Clean moves fill the flow bar and build a chain that raises your multiplier. In Perform, if the flow runs out the routine ends. In Learn there is no flow loss, so you can practise freely.' },
    { h: 'Three ways to play' },
    { li: 'Learn: slower, with wider timing windows and a hint button that shows the next moves.' },
    { li: 'Perform: the full routine at tempo, scored and ranked with stars.' },
    { li: 'Watch and Learn: the game performs the routine for you, thinking out loud before each phrase. Pause it any time.' },
    { h: 'On a keyboard' },
    { p: 'Arrow keys swipe, Space taps and holds (steer with Left and Right while Space is down), P or Escape pauses, H shows a hint in Learn.' },
  ],
};

export function rulesPages() {
  const k = TIMING.map((t) => t.k);
  const win = (g) => `${ms(JUDGE[g], k[0])} / ${ms(JUDGE[g], k[1])} / ${ms(JUDGE[g], k[2])}`;
  const moveRows = MOVE_ORDER.map((id) => {
    const m = MOVES[id];
    const extra = m.g === 'hold' ? `, held for ${m.beats} beats` : m.dH > 0 ? ', climbs one step' : m.dH < 0 ? ', slides one step down' : m.spin ? ', a full turn about the pole' : '';
    return { li: `${m.name}: ${GESTURE_NAMES[m.g]}${extra}.` };
  });
  return [
    {
      title: 'The routine',
      blocks: [
        { h: 'How a routine runs' },
        { p: `A routine is a fixed list of moves at a fixed tempo. Four beats of count-in play first (${COUNT_IN} clicks), then the moves arrive one after another. Each has its own beat; some come two beats apart, some on the half beat, and holds last several beats.` },
        { p: `There are ${ROUTINES.length} routines, from ${ROUTINES[0].count} moves at ${ROUTINES[0].bpm} beats per minute to ${ROUTINES[ROUTINES.length - 1].count} moves at ${ROUTINES[ROUTINES.length - 1].bpm}. A routine is always the same, so you can learn it and improve.` },
        { p: `The performer starts on the ground beside the pole, climbs up to ${MAX_H} steps, and must come back down to the ground for the closing salute. A routine only slides down when there is height to lose and only climbs while there is pole above.` },
        { h: 'Ways to play' },
        { li: `Learn: the tempo is 75% of normal, every timing window is wider (by ${LEARN_WINDOW}), the balance drift is ${Math.round(LEARN_DRIFT * 100)}% as strong, you cannot lose flow, and a hint button shows the next moves.` },
        { li: 'Perform: full tempo, scored, with stars and best scores saved on your device.' },
        { li: 'Watch and Learn: the game performs the routine itself, using the same scoring.' },
      ],
    },
    {
      title: 'The moves',
      blocks: [
        { h: 'The move book' },
        { fig: 'moves', hh: 470 },
        { p: 'Every move is one gesture. The gesture is anywhere on the screen; it does not have to touch the performer.' },
        ...moveRows,
        { p: `A swipe counts once your finger has travelled ${SWIPE_MIN} units, in the direction of the larger movement. The moment the swipe is recognised is the moment it is timed.` },
      ],
    },
    {
      title: 'Timing',
      blocks: [
        { h: 'Beat windows' },
        { p: `A move is timed by how far from its beat you finish the gesture. At the Standard setting: Perfect within ${ms(JUDGE.perfect)}, Great within ${ms(JUDGE.great)}, Good within ${ms(JUDGE.good)} either side. Beyond that the move is a miss.` },
        { p: `The Timing setting scales every window: Relaxed ${TIMING[0].k}x, Standard ${TIMING[1].k}x, Tight ${TIMING[2].k}x. Perfect / Great / Good at Relaxed, Standard, Tight: ${win('perfect')} · ${win('great')} · ${win('good')}.` },
        { p: `Learn multiplies the windows by ${LEARN_WINDOW} on top of that.` },
        { h: 'The wrong gesture' },
        { p: 'A gesture that does not match the move on the ring is a miss for that move. A stray swipe with no move near is ignored and costs nothing.' },
        { h: 'Points' },
        { p: `A swipe or tap scores ${SCORE.perfect} for Perfect, ${SCORE.great} for Great and ${SCORE.good} for Good, multiplied by your current multiplier.` },
      ],
    },
    {
      title: 'Holds and balance',
      blocks: [
        { h: 'Starting a hold' },
        { p: 'Press down within the timing window of the hold, as the long bar reaches the ring, and keep your finger down until the bar ends. Letting go early ends the hold at once.' },
        { h: 'The balance bar' },
        { fig: 'gauge', hh: 150 },
        { p: `While you hold, a drift pushes the balance marker left and right. The drift is a slow wave that is different for every hold and gets stronger in harder routines. Your finger steers: sliding it right of where you pressed pulls the marker left, and sliding it left pulls it right. A full ${STEER_RANGE}-unit slide cancels the drift completely.` },
        { p: `The bright band in the middle (inside ±${BAL.safe} of the centre) is in line. Past ±${BAL.fall} the performer is slipping; a total of ${BAL.fallTime} seconds out there ends the hold as a slip.` },
        { h: 'Grading a hold' },
        { p: `The share of the hold you spent in line sets the grade: ${HOLD_GRADES.map((h) => `${h.g} at ${Math.round(h.at * 100)}% or more`).join(', ')}; below that it is a miss. A hold scores ${HOLD_SCORE} for Perfect (the Great and Good scores are scaled by the same weights as other moves), times your multiplier.` },
      ],
    },
    {
      title: 'Flow and score',
      blocks: [
        { h: 'The flow bar' },
        { p: `Flow starts at ${Math.round(FLOW.start * 100)}%. Perfect adds ${(FLOW.perfect * 100).toFixed(1)}, Great ${(FLOW.great * 100).toFixed(0)}, Good ${(FLOW.good * 100).toFixed(0)} points of flow; a miss or a slip takes ${Math.round(-FLOW.miss * 100)} away. Flow never goes above 100%.` },
        { p: 'In Perform, a flow bar that reaches empty ends the routine early: the performer steps back from the pole and you see the result so far. In Learn and Watch and Learn flow never ends the routine.' },
        { h: 'Chain and multiplier' },
        { p: `Every clean move (Perfect, Great or Good) adds one to your chain; a miss resets it. Every ${COMBO_STEP} moves in a row raises the multiplier by one, up to ${COMBO_MAX}x.` },
        { h: 'Stars and rank' },
        { p: `Accuracy counts every move: Perfect 100%, Great 80%, Good 55%, miss 0%. ${Math.round(STAR_AT[0] * 100)}% earns one star, ${Math.round(STAR_AT[1] * 100)}% two, ${Math.round(STAR_AT[2] * 100)}% three. The rank names (Beginner to Master) follow the same percentage. Your best score and stars for each routine are saved on this device.` },
      ],
    },
    {
      title: 'Watch and Learn',
      blocks: [
        { h: 'The game performs, you study' },
        { p: `Watch and Learn performs the whole routine with the same timing and scoring as the real game, in phrases of ${PHRASE} moves. Before each phrase the clock stops and the game goes through three steps.` },
        { li: `Think: the performer looks at the next phrase. You choose how long this lasts in Settings (${THINK_CHOICES.join(', ')} seconds; 5 is the default and 10 is the longest).` },
        { li: `Reveal: for ${REVEAL_SECONDS} seconds the moves of the phrase are lit up with the gesture to use for each.` },
        { li: 'Act: the clock runs again and the phrase is performed on the beat.' },
        { p: 'Pause stops everything, including the Think and Reveal timers and any movement in progress, and resumes exactly where it stopped. In Learn mode the hint button does a Reveal for you: it stops the clock for a moment and lights the next moves.' },
        { h: 'Settings' },
        { p: 'Sound, Timing, Think time, move names, text size (to 300%) and reduced motion are in Settings, reachable from the main menu.' },
      ],
    },
    {
      title: 'Free preview and demo',
      blocks: [
        { h: 'Trying it first' },
        { p: 'The full game has a free preview of real play; menus, Rules, Watch and Learn and results are always free. When the preview ends you can unlock the whole game once, or restore an earlier purchase.' },
        { p: `The public web demo is limited to ${DEMO_RUNS} performances and the first routine, so it is a taste of the game; the apps for iPhone and Android hold everything.` },
      ],
    },
  ];
}
