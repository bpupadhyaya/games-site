// Reference text for the How to Play, About and Rules screens. Every number below is built from rules.js (the single source of
// truth), so the pages cannot drift from the engine. `art` names a picture drawn by view.js (drawRulesArt) with the game's own art.
import { LV, LEVEL_NAMES, LEN_STEPS, RUN_STEPS, TRICKS, COUNT_IN, REL_MUL, COMBO_STEP, COMBO_MAX, PTS, LOOP, MAX_RUN, flightTime, tolOf, styleMul } from './rules.js';

const n = (v) => String(Math.round(v * 100) / 100);
const ms = (s) => `${Math.round(s * 1000)} ms`;
const ids = Object.keys(TRICKS);

export const HOW = [
  { h: 'An event', art: 'event', p: [
    'Charro Lasso Roping is a skill game of rhythm and timing. An event is a short programme in the arena: rope tricks to a beat, with target runs between them. A computer charro performs the same programme and the higher total wins.',
    `You choose Short, Standard or Long: ${LEN_STEPS.map((k) => `${k} tricks and ${RUN_STEPS[k]} runs`).join(', ')}.`,
  ] },
  { h: 'The tricks', art: 'track', p: [
    'Round knots slide along the rhythm track towards the gold line. TAP anywhere on the arena the instant a knot touches the line: the nearer the centre, the better the grade.',
    `Some knots are long bars. Press when the bar's start reaches the line and KEEP YOUR FINGER DOWN, then let go when the end of the bar reaches the line. Two beats are counted in before every trick.`,
    `Every ${COMBO_STEP} clean hits in a row raise your multiplier, up to x${COMBO_MAX}. A miss, or a stray tap, drops it back to x1.`,
  ] },
  { h: 'The target run', art: 'run', p: [
    'A riderless horse in a charro saddle and a woven blanket runs across the arena. Your loop must come down over its neck at the painted post in the middle.',
    'PRESS AND HOLD to swing the loop: the longer you hold, the wider it grows. LET GO to throw it. A loop needs time to fly, so throw it before the target reaches the post: a wide loop is more forgiving but slower, a tight loop is quicker and worth more.',
    'A dashed ring follows the target and shows where it will be when your loop lands. Let go when that ring meets the post.',
  ] },
  { h: 'Hint and Auto Play', p: [
    'Hint shows what a good charro would do right now: it lights the next knot, or marks the moment to throw. Auto Play (Watch & Learn) on the menu plays a whole short event by itself: it thinks, shows its plan, then performs it. You can pause it at any time and change its thinking time.',
  ] },
];

export const ABOUT = [
  { h: 'About Charro Lasso Roping', p: [
    'The charro is the horseman of Mexico, and charrería, the art and sport of the charro, is a living tradition of rural communities across the country. It is recognised by UNESCO as intangible cultural heritage. Roping with the lazo, the rope, is one of its best-loved arts: in the floreo de reata the charro spins a loop in graceful figures, and in the lazo the loop is thrown to catch a running target.',
    'The traditions are usually placed in the centuries after the arrival of the horse in Mexico, and their exact origins are uncertain. They are practised today in the lienzo charro, the ring where charros gather to compete, with their own songs, costumes and words.',
  ] },
  { h: 'This version', p: [
    `This is a simplified game for your phone that keeps the real names and the real idea: spin the loop to the beat, then rope a running target. It is not an official simulation. The target is a calm, trained horse shown running across the arena; the rope settles gently over its neck and nothing is shown that could hurt it. Tricks included: ${ids.map((k) => `${TRICKS[k].name} (${TRICKS[k].en})`).join(', ')}.`,
    `Play against the computer at ${Object.values(LEVEL_NAMES).join(', ')} level, ask for a Hint any time, or watch a whole short event with Auto Play.`,
  ] },
  { h: 'Ads and ad-free', p: [
    'Free to play with short ads. A single one-time purchase makes it ad-free, with nothing else to buy. Restore purchase is on the game page in Arcforge. Menus, Settings, the Rules and Auto Play are always free to use.',
  ] },
  { h: 'Play and wellness', p: [
    'Nothing is staked: you play for the event. Text size can be raised to 300% in Settings and on every reading page, and Reduced motion calms the animation.',
  ] },
  { h: 'Credits', p: [
    'Charrería and the floreo de reata belong to the communities of Mexico who keep them alive. Fredoka and Dela Gothic One typefaces, SIL Open Font License 1.1. All art and sound are drawn and synthesized by the game itself.',
  ] },
];

const TR = (id) => TRICKS[id];
export const RULES = [
  { h: 'The event', art: 'event', p: [
    `An event is a list of parts: rope tricks and target runs. A Short event has ${LEN_STEPS[0]} tricks and ${RUN_STEPS[LEN_STEPS[0]]} runs, a Standard one ${LEN_STEPS[1]} and ${RUN_STEPS[LEN_STEPS[1]]}, a Long one ${LEN_STEPS[2]} and ${RUN_STEPS[LEN_STEPS[2]]}. Runs are spread through the tricks and the last part is always a run.`,
    'Tricks are chosen from the six below, gentle ones first and harder ones later; the Golden flower is always in the programme. After each part both charros are scored and the totals are added up. The higher total at the end wins; level totals are a draw.',
  ] },
  { h: 'The beat', art: 'track', p: [
    `Tempo is set by the level: ${Object.keys(LV).map((k) => `${LEVEL_NAMES[k]} ${LV[k].bpm} beats a minute`).join(', ')}. Every trick counts ${COUNT_IN} beats in and then plays its notes on the beat grid. A quiet tick sounds on every beat.`,
    `A tap is judged against the note nearest to it. Within ${ms(LV.charro.perfect)} (${ms(LV.apprentice.perfect)} Apprentice, ${ms(LV.maestro.perfect)} Maestro) is Perfect, worth ${PTS.perfect}; within ${ms(LV.charro.good)} (${ms(LV.apprentice.good)} and ${ms(LV.maestro.good)}) is Good, worth ${PTS.good}. A note nobody taps is missed once its window has passed.`,
    `A held note is two events: the press is judged as above, and the release is judged against the end of the bar with a window ${n(REL_MUL)} times as wide. The press and the release each count for half of the note. A release inside the window scores like a tap; letting go early or late still keeps ${PTS.releaseMiss / 2} points but breaks the multiplier.`,
  ] },
  { h: 'Multiplier and stars', art: 'zones', p: [
    `Every ${COMBO_STEP} notes in a row with a hit (Perfect or Good) raise the multiplier by one, up to x${COMBO_MAX}. A missed note, a poor release or a stray tap close to a note sets it back to x1. The multiplier applies to the points of each note as it is scored. It starts again at x1 in every trick.`,
    'After a trick your accuracy is the points you took divided by the points of all-Perfect play of the same notes without a multiplier. 90% or more earns 3 stars, 70% 2 stars, 40% 1 star.',
  ] },
  { h: 'The tricks', art: 'tricks', p: [
    ...ids.map((k) => `${TR(k).name} (${TR(k).en}): ${TR(k).notes.length} notes${TR(k).notes.some((q) => q.h) ? ', with a held note' : ''}. ${TR(k).desc}`),
    'The pictures of the loop (spinning flat, standing up, drawing a flower) show what the trick looks like; only the timing of your taps counts for score.',
  ] },
  { h: 'The target run', art: 'run', p: [
    `The target is a riderless horse in a charro saddle. It enters at one end of the arena and runs to the other, ${n(4.6 / LV.maestro.speed)} to ${n(5.4 / LV.apprentice.speed)} seconds depending on the level, slowing and quickening a little as it goes. It may run left to right or right to left.`,
    `Press and hold to swing the loop. The loop is a tight ${n(LOOP.minSize)} after ${n(LOOP.minHold)} seconds and grows to full size (1.0) after ${n(LOOP.fullHold)} seconds. Letting go throws it at the painted post in the middle of the rail.`,
    `The loop flies for ${n(flightTime(LOOP.minSize))} seconds when tight and ${n(flightTime(1))} seconds when full, and comes down at the post. If the target is under it then, it is a catch. You may throw twice per run (the second catch scores 80%); after a throw the rope needs ${n(0.7)} seconds to be coiled again. A catch ends the run.`,
  ] },
  { h: 'Catching and points', art: 'zones', p: [
    `How close the target is to the post when the loop lands decides the catch. The catch width grows with the loop: ${n(tolOf(LOOP.minSize, 'charro'))} of the rail for a tight loop up to ${n(tolOf(1, 'charro'))} for a full one at Charro level (Apprentice 30% wider, Maestro 20% narrower).`,
    `Dead centre (within 35% of the catch width) is a Clean catch worth 100, within 70% is a Good catch worth 70, and within the full width is a Brush worth 40. Outside it the loop misses. The points are then multiplied by the loop's style factor: x${n(styleMul(LOOP.minSize))} for a tight loop falling to x${n(styleMul(1))} for a full one. The best possible catch is ${MAX_RUN} points.`,
    'A loop that lands when the target has already left the rail, or before it has come on, misses.',
  ] },
  { h: 'The other charro', p: [
    `The computer charro does not play on the screen: its score for every part is worked out when the event starts from its level (skill ${LV.apprentice.skill * 100}% Apprentice, ${LV.charro.skill * 100}% Charro, ${LV.maestro.skill * 100}% Maestro) with a little luck either way. For a trick it scores about three quarters of the best possible trick score times its skill; for a run it catches with a chance equal to its skill. You see its score appear after each part.`,
  ] },
  { h: 'Hint, Auto Play and free play', p: [
    'Hint lights the next knot (and says whether it is held) or, in a run, marks the moment to let go. Auto Play plays a whole short event with a computer charro of its own: it thinks (2, 5, 8 or 10 seconds), shows its plan for 2 seconds, then performs it. It is allowed to miss. Pause freezes everything.',
    'Free to play with short ads; go ad-free once.',
  ] },
];
