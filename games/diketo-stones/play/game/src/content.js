// Every word the player reads. English only: the game has no script of its own, and the traditional names appear in About.
// Numbers in the Rules come from sim.js constants wherever they appear in code.
import { HINT } from './ai.js';
import { AIR_BASE, AIR_SLOPE, CHARGE_SECS, H_MIN, DEV, SPEED, DWELL, SWEEP_DWELL, MODES, WIN_EARLY, WIN_LATE, R } from './sim.js';

const en = {
  you: 'You', p1: 'Player 1', p2: 'Player 2',
  turnStart: 'Turn: {name}', perfect: 'Perfect!', good: 'Good catch', caught: 'Caught',
  fail_short: 'Not all stones taken', fail_late: 'Hand too slow', fail_slow: 'Missed the catch', fail_early: 'Too early',
  stageClear: 'Stage {n} done!', halfDone: 'All out. Now bring them home', tryAgain: 'Try that again',
  turnFault: '{name} drops it. The turn passes.', turnFault1: '{name} drops it. The turn passes.',
  inFull: 'In the full game',
  restoring: 'Checking with the store...', restored: 'Purchase restored. Thank you!', noPurchase: 'No previous purchase found.', storeDown: 'The store is not available right now.',
  howtoTitle: 'How to Play', aboutTitle: 'About', rulesTitle: 'Rules',
  stageShort: 'Stage {n}', lessonLabel: 'Lesson {n}',
  half_out: 'out of the hole', half_in: 'back into the hole',
  c_ai: '{name} is playing', c_ready: 'Hold the pad to set the height, release to toss', c_charge: 'Release to toss',
  c_air: 'Tap the stones to take, in the order you like', c_air_n: 'Tap {n} more of {k}', c_air_sweep: 'Tap the group to sweep them all up', c_air_catch: 'Now tap CATCH as the ring closes',
  c_ok: 'Caught it!', c_fail: 'Not this time', c_clear: 'Stage cleared', c_turnend: 'Turn over', c_won: 'Finished!',
  beatThink: 'THINK', beatReveal: 'REVEAL', beatAct: 'ACT',
  pad_ai: '{name} is playing', pad_hold: 'HOLD TO TOSS', pad_release: 'RELEASE TO TOSS', pad_catch: 'TAP TO CATCH',
  pad_cap: 'Air time {air} s · Hand needs about {route} s',
  w_dec: 'Think −', w_inc: 'Think +', w_resume: 'Resume', w_exit: 'Exit', pause: 'Pause', think: 'Think',
  hintTitle: 'Think', revealTitle: 'The plan',
  m_continue: 'Continue Match', m_continueSub: '{a} · {b}', m_play: 'Play', m_learn: 'Learn the Stages', m_learnSub: 'Six short lessons, one skill at a time',
  m_watch: 'Watch & Learn', m_watchSub: 'Two computer players play while you learn why', m_howto: 'How to Play', m_rules: 'Rules', m_about: 'About', m_settings: 'Settings',
  s_title: 'New Match', s_opp: 'Play against', s_cpu: 'Computer', s_pass: 'Pass and play', s_level: 'Choose the level', s_won: 'won {n}',
  s_length: 'Match length', s_quick: 'Quick: 6 stones, 4 stages', s_full: 'Full: 10 stones, 5 stages', s_start: 'Start the match',
  l_title: 'Learn the Stages', l_intro: 'Each lesson plays a real toss with coaching. Repeat any lesson as often as you like.', l_done: 'Done', l_goal: 'Goal', l_start: 'Start the lesson',
  l_complete: 'Lesson complete', l_next: 'Next lesson', l_again: 'Practice again', l_all: 'All lessons',
  back: 'Back', soundOn: 'Sound: On', soundOff: 'Sound: Off', calmOn: 'Calm effects: On', calmOff: 'Calm effects: Off', calmSub: 'No flashes',
  textSize: 'Text size: {n}%', smaller: 'A−  Smaller', larger: 'A+  Larger', thinkTime: 'Watch & Learn thinking time: {n} s', shorter: 'Shorter', longer: 'Longer',
  restore: 'Restore purchases',
  r_wins: '{name} wins', r_youWin: 'You win the match!', r_stats: 'Turns: {turns}. Tosses: {tosses}. Dropped: {faults}.', r_vs: 'Against {name}, you have won {n}.',
  r_again: 'Rematch', r_new: 'New match', r_menu: 'Main menu',
  paused: 'Paused', resume: 'Resume', soundOnShort: 'Sound: On', soundOffShort: 'Sound: Off', calmOnShort: 'Calm: On', calmOffShort: 'Calm: Off', quit: 'Quit to menu',
  d_title: 'That is the free preview', d_body: 'You have played the free matches of the web demo. The full game on iPhone and Android has every level, every lesson and unlimited matches.',
  more: 'more', up: 'up', cont: 'cont.', page: 'Page {a} of {b}', close: 'Close', done: 'Done', next: 'Next',
  tip_one: 'Lesson 1: hold the pad, release, then tap one stone in the hole, then tap CATCH when the ring closes',
  tip_bring: 'Lesson 2: tap a stone on the ground. The hand drops it in the hole before the stone lands',
  tip_two: 'Lesson 3: two stones per toss. Tap them one after the other, quickly',
  tip_route: 'Lesson 4: the order matters. Press Think to see the faster route',
  tip_height: 'Lesson 5: a low toss is too short for three stones. Hold longer',
  tip_sweep: 'Lesson 6: one tap sweeps the whole group. Then bring it home the same way',
};
const DICT = { en };
export function tx(key, vars, soft) {
  let s = DICT.en[key];
  if (s === undefined) return soft ? null : key;
  if (vars) for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(String(vars[k]));
  return s;
}
export const stageName = (mode, n) => {
  const k = MODES[mode].ks[Math.max(0, Math.min(MODES[mode].ks.length, n) - 1)];
  return k === 'all' ? 'All together' : k === 1 ? 'One at a time' : `${k} at a time`;
};

// ---- lessons ---------------------------------------------------------------------------------------
export const LESSON_TEXT = {
  one: { title: 'Toss and take one', short: 'Toss, take one stone out of the hole, catch', body: ['Your hand rests below the chalk circle. Hold the pad to set how high the stone goes, then let go to toss it.', 'While it is in the air, tap one stone in the hole. The hand takes it out and sets it down on the yard, then comes back to catch. Tap CATCH when the ring closes on the landing spot.'], goal: 'Catch three tosses in a row.', done: 'That is the whole game in one move: toss, take, catch. Next, the stones come home.' },
  bring: { title: 'Bring one home', short: 'Take a stone from the yard and drop it in the hole', body: ['Now the stones lie on the yard and the hole is empty. Tap a stone: the hand picks it up, drops it in the hole and returns to catch.', 'The farther the stone, the longer the trip, so a higher toss gives more time.'], goal: 'Catch three tosses.', done: 'Out and back: every stage has these two halves.' },
  two: { title: 'Two at a time', short: 'Take two stones in one toss', body: ['Take two stones in one toss. Tap them quickly, one after the other: the hand starts moving as soon as you tap.', 'The pad shows how long the hand needs. If the air time is shorter, hold the pad longer next time.'], goal: 'Catch two tosses.', done: 'Two at a time is a race against the clock. Next, planning the route.' },
  route: { title: 'Reading the route', short: 'The order of the stones changes the time', body: ['Three stones on the yard. The hand leaves from the bottom, visits each stone and ends at the hole. Which stones, and in which order, changes how long the trip takes.', 'Press Think to see the faster route, with numbers, then try it.'], goal: 'Catch two tosses.', done: 'You can now read a route before you commit.' },
  height: { title: 'How high to toss', short: 'More height means more time, but a tighter catch', body: ['A higher stone stays up longer, so the hand has more time. It also falls faster, so the catch window gets narrower.', 'Three stones keep the hand busy for about a second, so the very lowest toss leaves almost no time to spare. Press Think to see a height with room to spare.'], goal: 'Catch two tosses.', done: 'Lowest safe height is the whole skill of the game.' },
  sweep: { title: 'The big sweep', short: 'Take the whole group in one toss', body: ['In the last stage the whole pile moves at once. One tap on the hole sweeps every stone out; one tap on the group sweeps them all back.', 'The hand dwells a little longer when it sweeps, so give it time.'], goal: 'Catch two tosses.', done: 'That is every stage. Now play a match.' },
};
export const lessonText = (id) => LESSON_TEXT[id];

// ---- About / How to play / Rules -----------------------------------------------------------------------
const q = MODES.quick, f = MODES.full;
const pct = (v) => Math.round(v * 100);
const HEAD = Math.round(CHARGE_SECS * 10) / 10;
const PAGES = {
  about: [
    { title: 'Diketo', art: 'yard', p: ['Diketo is a traditional stone-tossing game played in South Africa, Lesotho and Botswana. A player throws one stone into the air, moves other stones with the same hand, and catches the falling stone before it lands. It is usually played by two players, with small stones or marbles.', 'It is also known as Magave, Upuca or Puca, and the thrown stone has local names such as mokinto. Names and rules differ from place to place and from family to family.'] },
    { title: 'A game of many names', p: ['Tossing and catching small stones is played in many parts of the world under many names, such as jacks, knucklebones and five stones. Diketo is often described as similar to jacks. This game does not claim one place of origin for the family.', 'The version here follows the commonly described one: a pile of stones in a shallow hole, taken out and put back in stages, a few more stones each stage. The Rules page lists exactly what this game does and what it simplifies.'] },
    { title: 'About this version', p: ['The play area is a swept dirt yard with a chalk circle. The glass ring is your hand: the game shows its path and its timing instead of drawing a person.', 'Play against five computer levels or a friend on the same phone, learn the skills in six short lessons, or watch two computer players think, reveal and act. All text is in English.'] },
  ],
  howto: [
    { title: 'The goal', art: 'yard', p: ['Move the whole pile of stones out of the hole, then back into it, stage by stage. In stage 1 you move one stone per toss, in stage 2 two stones, and so on. The first player to finish the last stage wins.'] },
    { title: 'Toss', art: 'gauge', p: [`Press and hold the pad at the bottom: the gauge fills from ${pct(H_MIN)} to 100 percent in ${HEAD} seconds. Let go to toss the stone. A higher toss stays in the air longer, but it also falls faster.`] },
    { title: 'Take', art: 'take', p: ['While the stone is in the air, tap the stones you want to take, or drag a finger through them. The glass ring (your hand) goes to each one in the order you tapped. Be quick: the hand starts as soon as you tap.', 'Out of the hole, the taken stones are set down on the yard. Back in, the hand drops them into the hole.'] },
    { title: 'Catch', art: 'ring', p: ['A ring closes on the landing spot. Tap CATCH when it closes. The hand has to be back there by then.'] },
    { title: 'If you drop it', p: ['If a stone was not taken in time, the hand was too slow or the catch was missed, the turn passes to the other player. Nothing is lost: your stones go back as they were and you start again from that toss.'] },
    { title: 'Help', p: ['Think shows the plan the game would choose, with the reason. Watch & Learn plays two computer players, pausing to think and to reveal each plan. Learn plays one short lesson per skill.'] },
  ],
  rules: [
    { title: 'The yard and the stones', art: 'yard', p: [`The play area is a swept yard with a chalk circle and a hole in the middle. Your hand rests below the circle.`, `Quick match: ${q.n} stones. Full match: ${f.n} stones (the traditional number). The stones start in the hole. Each player has their own stones; the display shows the player whose turn it is.`, 'One more stone, the larger one, is the stone you throw. It is not one of the pile.'] },
    { title: 'Stages and halves', p: [`Each stage has two halves. In the OUT half the stones leave the hole; in the IN half they go back. Every toss moves the stage's number of stones (the last toss of a half moves whatever is left, so ${f.n} stones at 3 per toss go 3, 3, 3, 1).`, `Quick match stages: 1, 2, 3 stones per toss, then ALL (${q.n} at once). Full match stages: 1, 2, 3, 5, then ALL (${f.n} at once).`, 'A stage is finished when all the stones are back in the hole. The first player to finish the last stage wins the match.'] },
    { title: 'Charging a toss', art: 'gauge', p: [`Press and hold the pad: ${pct(H_MIN)} to 100 percent power over ${HEAD} s. Air time is ${AIR_BASE} s plus ${AIR_SLOPE} s times the power (${(AIR_BASE + AIR_SLOPE * H_MIN).toFixed(1)} s at the lowest, ${(AIR_BASE + AIR_SLOPE).toFixed(1)} s at full power).`, `The thrown stone comes down up to ${DEV} units from your resting hand (less for a lower toss). The ring marks where; the hand has to be there to catch.`] },
    { title: 'Taking stones', art: 'take', p: [`Once the stone is in the air, tap stones. A tap on the ground is ignored before the toss, and taps beyond the number needed for this toss are ignored.`, `The hand waits at rest until your first tap, then goes to each tapped stone in your order at ${SPEED} units a second, plus 0.03 s for every movement and ${DWELL} s to close on a stone. If you tap faster than the hand moves, the taps wait their turn.`, `The Think hint assumes a steady pace of ${HINT.react} s to the first tap and ${HINT.gap} s between taps, and asks for 0.18 s to spare.`] },
    { title: 'Out of the hole', p: ['In the OUT half you tap stones in the hole. When the last one is taken the hand sets them all down beside the hole (0.05 s), then goes back to catch.', `The stones come to rest in one loose group somewhere in the ring between the hole and the chalk circle. The place is chosen by the game's own random numbers. Stones never rest on the hole or on each other.`] },
    { title: 'Back into the hole', p: ['In the IN half you tap stones on the yard. After the last one the hand goes to the hole and drops them in (0.07 s), then goes back to catch.', 'The stones that fall in return to their own place in the hole.'] },
    { title: 'The big sweep', p: [`In the last stage one tap moves the whole pile. Out: tap the hole. In: tap any stone of the group. The hand goes to the middle of the stones and dwells ${SWEEP_DWELL} s to sweep them all.`] },
    { title: 'The catch', art: 'ring', p: [`The ring on the ground closes on the landing spot at the exact moment the stone lands. Tap CATCH from ${WIN_EARLY} s before to ${WIN_LATE} s after (these windows are multiplied by 1 / (0.65 + 0.7 x power): a higher toss falls faster, so its window is narrower). A tap that is too early is ignored.`, 'A tap within 0.07 s of the landing moment is Perfect and within 0.14 s is Good (both also divided by the same power factor as the window). This changes the message and sound only.', 'The hand must also be back at the landing spot by then (with 0.02 s of grace).'] },
    { title: 'Faults', art: 'fault', p: ['Not all stones taken in time: the toss fails (the stones stay as they were).', 'Hand too slow: all stones were taken, but the hand reached the landing spot after the stone landed.', 'Missed the catch: no tap at the right moment.', 'After a fault the turn passes to the other player. Your stones, stage and half stay exactly as they were, and you try the same toss again on your next turn.'] },
    { title: 'Turns and winning', p: ['Players take turns; against the computer, who starts alternates from match to match. A turn lasts as long as every toss is caught. The first player to finish the last stage (all stones back in the hole after the sweep) wins immediately.', 'Pass and play: both players use the same phone and take turns.'] },
    { title: 'The computer', p: ['Five levels: Sprout, Pebble, Stream, Mountain and Master. They differ in how quickly and how accurately they tap, how well they judge the toss height and how often they pick a slow route. In simulated matches each level beats the one below it more often than not.'] },
    { title: 'Think, Learn and Watch & Learn', p: ['Think shows the stones in the order the engine would take them and a toss height, with the route time, the air time and the chance, worked out from the same numbers the game uses.', 'Learn: six lessons, one skill each. Watch & Learn: two computers play; each toss is THINK, REVEAL (the plan is shown with its reason), then ACT. You can pause it and change the thinking time.'] },
    { title: 'Saving and the preview', p: ['A match in progress is saved at the start of each toss and when you pause. Continue on the title screen resumes it paused.', 'Menus, Rules, Learn, Watch & Learn and the computer\'s own turns do not use up the free preview; only your own live tosses do (waiting to aim does not).'] },
    { title: 'What this game simplifies', p: [`The traditional game has ten rounds, one more stone each round, with ten stones. Here a Full match has five stages (1, 2, 3, 5, then all) and a Quick match four stages with ${q.n} stones, so a match fits a phone session.`, 'Traditional faults such as touching other stones are not modelled; the game faults you only on time and on the catch. Where the stones come to rest in the OUT half is chosen by the game.', 'The stone you throw is not in the pile and is caught by the same hand that takes stones, as in the traditional game.'] },
    { title: 'Keyboard', p: ['Space: hold and release the pad, and catch. H: Think. P or Esc: pause. + and −: text size on menus. Click or tap stones to take them.'] },
  ],
};
void R;
export const pagesFor = (key) => PAGES[key];
