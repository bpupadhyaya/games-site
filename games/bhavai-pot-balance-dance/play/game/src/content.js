// Text for About, How to Play and the Rules book. Numbers come from sim.js / courses.js so the Rules always match the engine.
import { PHYS, SCORE, STAR_STEPS, DEMO_RUNS, REVEAL_SECONDS, om2Of, kappaOf, fallLimit, actStats } from './sim.js';
import { ACTS, POT_MAX, PHRASE, COUNT_IN, SLOTS } from './courses.js';

export const THINK_CHOICES = [3, 5, 8, 10];
export { REVEAL_SECONDS };
const m1 = (v) => (Math.round(v * 100) / 100).toString();

export const ABOUT = {
  title: 'About',
  blocks: [
    { h: 'Bhavai pot dance' },
    { p: 'Bhavai is a folk dance of Rajasthan, in north-western India, also found in neighbouring Gujarat and Madhya Pradesh. A dancer, traditionally a woman of the community, circles and sways while balancing a tall stack of clay pots on her head, and moves to the drum through steps, turns and graceful hand movements, sometimes on the edge of a plate or the rim of a glass. Music, costume and the steady rhythm of the feet are as much a part of it as the balance.' },
    { p: 'This game describes the dance as play and craft only. Ritual and festival meanings belong to the communities who keep the dance, and are not shown here. The dancer, the band, the audience and the courtyard are original 3D characters and scenery, not portraits of real performers.' },
    { h: 'About this game' },
    { p: 'Bhavai Pot Balance Dance turns the dance into a balance and rhythm game. You slide a finger sideways to steer the dancer; her feet must land on the footprints that scroll in time with the drum, while the tower of pots on her head sways. Every few phrases a helper hands up another pot, and the drums, the wind and the spins all get stronger across eight acts.' },
    { p: 'Pots here are simply shown breaking when they fall. No one is hurt and nothing is wagered: only your own score.' },
    { h: 'Credits' },
    { p: 'Made by Arcforge, a collection of heritage games from around the world. All sound is synthesised on your device. The dancer and the drummer are 3D people shown with the shared Arcforge 3D layer; the courtyard, pots and effects are drawn with plain canvas graphics. Text is set in Fredoka (SIL Open Font License 1.1). Works offline.' },
  ],
};

export const HOWTO = {
  title: 'How to Play',
  blocks: [
    { h: 'The goal' },
    { p: 'Dance a whole act without losing your pots. Keep the tower of pots from tipping, and land the dancer on the footprints in time with the drum.' },
    { fig: 'tower', hh: 250 },
    { h: 'Steering' },
    { p: 'Put one finger anywhere on the screen and slide it sideways. The dancer follows your finger left and right (the step chart at the bottom lines up with the stage). Lift the finger and she stays where she is.' },
    { p: 'The tower is heavy and slow. When you move the head quickly the pots swing the other way, and wind and the music nudge them. Move under the lean to catch it: if it leans right, go right.' },
    { h: 'The step chart' },
    { fig: 'chart', hh: 330 },
    { p: 'Footprints scroll down the chart, one lane for each place on the stage. When a footprint reaches the gold line on the beat, the white dot (your dancer) should be on it. Close is Good, right on it is Perfect, and Perfects in a row build the multiplier.' },
    { fig: 'cues', hh: 150 },
    { li: 'Footprint: be on it when it reaches the line.' },
    { li: 'Spin: the dancer turns and the tower gets a push in the direction of the arrow. Lean the other way a moment before it, then settle.' },
    { li: 'Pot: a helper hands up one more pot. It only lands if the tower is nearly still at that beat.' },
    { li: 'Rest: nothing to do; a good moment to calm the tower.' },
    { h: 'If a pot falls' },
    { p: 'When the tower leans too far (the tilt gauge at the bottom of the chart shows how close you are), the top pot slips off and breaks. You catch the rest and dance on. If every pot falls, the act ends early.' },
    { h: 'Three ways to play' },
    { li: 'Practice: softer wind, a wider safe tilt, a golden marker on the floor that shows where to steer, and a hint button.' },
    { li: 'Dance: the real thing. Your score, pots and accuracy set your stars.' },
    { li: 'Watch and Learn: the game dances the act for you and thinks aloud before each phrase. Pause it any time.' },
    { h: 'On a keyboard' },
    { p: 'Left and Right (or A and D) steer, P or Escape pauses, H shows the hint in Practice.' },
  ],
};

export function rulesPages() {
  const first = ACTS[0], last = ACTS[ACTS.length - 1];
  const rows = ACTS.map((a, i) => { const s = actStats(a); return { li: `${i + 1}. ${a.name}: ${a.bpm} beats a minute, ${s.beats} beats, ${s.steps} footprints, ${a.pots0} pots to start with, ${s.pots} at most${s.turns ? `, ${s.turns} spins` : ''}${a.wind ? ', wind' : ''}.` }; });
  const lim3 = fallLimit(3), lim11 = fallLimit(POT_MAX);
  return [
    {
      title: 'The act',
      blocks: [
        { h: 'The setup' },
        { p: `There are ${ACTS.length} acts. Each has a fixed tempo, a fixed set of footprints, spins and pot hand-ups, and its own courtyard. Acts run from ${first.bpm} to ${last.bpm} beats a minute. Every act is the same each time you play it, so you can learn it and improve.` },
        { p: `You hear ${COUNT_IN} beats of drum, then the dance begins. The beats are grouped in phrases of ${PHRASE}. The act ends two beats after its last beat; if you still have at least one pot you have danced it.` },
        { h: 'The acts' },
        ...rows,
      ],
    },
    {
      title: 'Steering',
      blocks: [
        { h: 'Head and finger' },
        { p: `The dancer's head follows your finger's sideways position through a spring, so it glides rather than jumps. It can move at most ${PHYS.MAX_ACC} metres per second per second and stays between ${m1(-PHYS.X_MAX)} and ${m1(PHYS.X_MAX)} metres from the middle of the stage. The five footprint lanes are at ${SLOTS.map((s) => m1(s)).join(', ')} metres.` },
        { p: 'The step chart is the same width as the stage: its left edge is the left of the stage. In landscape the chart is a column on the right and your finger steers by its horizontal position.' },
        { h: 'The tower' },
        { fig: 'tower', hh: 250 },
        { p: `The tower of pots is a slow, lightly damped sway. It is pulled upright with strength ${m1(om2Of(3))} with three pots and ${m1(om2Of(POT_MAX))} with eleven, and slows its own swing a little (damping ${m1(PHYS.DAMP)}). Accelerating the head pushes the tower the opposite way by ${m1(kappaOf(3))} (three pots) to ${m1(kappaOf(POT_MAX))} (eleven) of the head's acceleration, so a quick step leaves the tower swinging.` },
        { p: 'Catch a swing by moving the head in the direction the tower is leaning; the sooner the better. Smooth, flowing movement keeps the tower quiet.' },
        { h: 'Disturbances' },
        { p: 'Each act has a wobble that keeps nudging the tower near its own rhythm, and from the dunes onwards a wind that comes and goes (shown by streaks across the stage). Both grow a little with every pot. In Practice they are 40% weaker.' },
      ],
    },
    {
      title: 'Footprints and score',
      blocks: [
        { h: 'Judging' },
        { p: `On every footprint beat the game measures how far the dancer's head is from the centre of the footprint. Within ${m1(PHYS.PERFECT)} metres is Perfect, within ${m1(PHYS.GOOD)} is Good, and anything further is a miss that breaks your chain.` },
        { fig: 'chart', hh: 330 },
        { h: 'Points' },
        { li: `Perfect ${SCORE.perfect}, Good ${SCORE.good}, each times the multiplier.` },
        { li: `The multiplier is 1 plus the chain divided by ${SCORE.comboStep}, up to x${SCORE.multMax}; it is reached at a chain of ${SCORE.comboMax}.` },
        { li: `Steady bonus: on every non-pot beat where the tilt is under ${m1(PHYS.STEADY_THETA)} and the swing rate under ${m1(PHYS.STEADY_OMEGA)}, you earn ${SCORE.steady} points for every pot on your head.` },
        { li: `Pot added: ${SCORE.pot} times the multiplier. Spin held: ${SCORE.turn} times the multiplier.` },
        { li: `Finishing the act: ${SCORE.finishPerPot} for every pot still on your head.` },
        { h: 'Stars' },
        { p: `One star for finishing the act. Two stars if you also end within one pot of the act's target and land at least ${Math.round(STAR_STEPS[0] * 100)}% of the footprints. Three stars for the full target of pots and at least ${Math.round(STAR_STEPS[1] * 100)}% of the footprints. Practice awards no stars. Your best score, stars and pots for each act are kept on your device.` },
      ],
    },
    {
      title: 'Spins and pots',
      blocks: [
        { h: 'Spins' },
        { fig: 'cues', hh: 150 },
        { p: `On a spin beat the dancer turns and the tower is pushed by ${m1(PHYS.TURN_KICK)} radians per second (a little more with every pot) in the direction of the arrow. The arrow is on the chart ahead of time. If the tower is back within ${m1(PHYS.TURN_OK)} radians one and a bit beats later, you earn the spin bonus.` },
        { h: 'Handing up a pot' },
        { p: `A helper's pot arcs in from the side before a pot beat. On the beat the pot lands only if the tower is within ${m1(PHYS.POT_THETA)} radians of upright and swinging slower than ${m1(PHYS.POT_OMEGA)} radians a second, and you are carrying fewer than ${POT_MAX}. Otherwise the pot goes back to the helper and your tower stays smaller; the target for stars does not change, so a missed pot costs you a star chance, not the act.` },
        { p: 'A rest beat is always placed just before a pot beat so the tower can settle.' },
      ],
    },
    {
      title: 'Falls',
      blocks: [
        { h: 'The safe tilt' },
        { p: `The safe tilt is ${m1(lim3)} radians with three pots, narrowing by ${m1(PHYS.FALL_PER)} for every pot, to ${m1(lim11)} with ${POT_MAX} (never below ${m1(PHYS.FALL_MIN)}). In Practice it is ${Math.round((PHYS.PRACTICE_FALL - 1) * 100)}% wider. The tilt gauge on the chart shows how much of it you are using.` },
        { h: 'When it goes' },
        { p: `Past the safe tilt, the top pot slips off and breaks. Your chain ends, you lose one pot, and the dancer catches the rest and steadies them to ${Math.round(PHYS.KEEP * 100)}% of the lean, with ${m1(PHYS.GRACE)} seconds of grace before another can fall. With no pots left the act ends and counts as not finished.` },
      ],
    },
    {
      title: 'Watch and Learn',
      blocks: [
        { h: 'The game dances, you study' },
        { p: 'Watch and Learn runs the act with the same physics and footprints. The performer plans a smooth path through the footprints and steers to keep the tower quiet. Before each phrase the music stops and the game goes through three steps.' },
        { li: `Think: the performer looks at what is ahead. You choose how long this lasts in Settings (${THINK_CHOICES.join(', ')} seconds; 5 is the default and 10 is the longest).` },
        { li: `Reveal: for ${REVEAL_SECONDS} seconds the chart opens wider and numbers the next footprints, and a golden marker on the floor shows where the tower's weight is.` },
        { li: 'Act: the clock runs again and the phrase is danced.' },
        { p: 'Pause stops everything, including the Think and Reveal timers and any pot in the air, and resumes exactly where it stopped. In Practice the hint button does a Reveal for you: the clock stops for a moment while the next footprints and the marker are shown.' },
        { h: 'Settings' },
        { p: 'Sound, think time, the balance guide, text size (to 300%) and reduced motion are in Settings, reachable from the main menu.' },
      ],
    },
    {
      title: 'Free to play and demo',
      blocks: [
        { h: 'In the app' },
        { p: 'Menus, Rules, Watch and Learn and results are always free. Free to play with short ads; go ad-free once.' },
        { p: `The public web demo is limited to ${DEMO_RUNS} dances of the first act, so it is a taste of the game; the apps for iPhone and Android hold everything.` },
      ],
    },
  ];
}
