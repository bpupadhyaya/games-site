// Text for the About, How to Play and Rules pages. Every number below is read from rules.js, so a page can never disagree with the engine.
// A page is a list of blocks: { h } heading, { p } paragraph, { li: [..] } bullet list, { art } an illustration drawn by view.js.
import {
  SCORE, LOCKOUT_SECS, HINTS_PER_ROUND, PACES, SKILLS, GOALS, STAGE_POINTS, NICKNAMES, KEGS, PER_CARD, PER_ROW, SET_SIZE, MAX_CARDS, MAX_DUO_CARDS, CPU_NAMES,
} from './rules.js';
import { THINK_STEPS, AUTO_REVEAL_SECS } from './layout.js';

export const SAMPLE_CARD = [0, 0, 0, 36, 45, 56, 61, 73, 0, 0, 15, 28, 0, 0, 57, 65, 77, 0, 5, 16, 0, 37, 0, 0, 0, 78, 87];
export const SAMPLE_MARKS = SAMPLE_CARD.map((v) => [5, 16, 28, 45, 57, 61, 77].includes(v));
const h = (t) => ({ h: t }), p = (t) => ({ p: t }), li = (...a) => ({ li: a }), art = (a) => ({ art: a });
const nick = Object.entries(NICKNAMES).map(([n, w]) => `${n} ${w}`).join(', ');
const mult = (1 + SCORE.comboMax * 0.25);

export const ABOUT = [
  h('Russian Loto: Barrels'), art('keg-row'),
  p('A family number game from Russia and the former Soviet lands. Wooden kegs numbered 1 to 90 tumble out of a linen bag one at a time, and everyone races to cover those numbers on their cards.'),
  h('A kitchen-table classic'),
  p('Loto sets with little wooden kegs and cardboard cards have been played for generations at family tables, in courtyards and at summer houses. Half the fun is the caller\'s patter: families give kegs their own nicknames, for example ' + nick + '. Nicknames differ from family to family, so treat these as a taste of the tradition.'),
  h('Made for this game'),
  p('The kegs, bag, cards, chips and every sound were made for this game. Nothing is borrowed from any real set.'),
  h('Just for fun'),
  p('Scores are only for bragging rights. There are no stakes, no chips to buy and no ads.'),
  h('Ways to play'),
  li('Play against computer players who mark their own cards.', 'Face to face: two players share one device, each with their own cards.', 'Daily Challenge: the same cards and kegs for everyone, once a day.', 'Watch & Learn: a whole round plays itself and explains each step.'),
  h('Your pace'),
  p(`Pick Calm, Classic, Rapid or Blitz, and play from 1 to ${MAX_CARDS} cards at once. More cards means more to scan.`),
];

export const HOWTO = [
  h('Your cards'), art('card'),
  p(`Each card has 3 rows and 9 columns with ${PER_CARD} numbers on it, ${PER_ROW} in every row. The empty squares are just shaded.`),
  h('Watch the bag'),
  p('A keg tumbles out of the bag and lands on the tray. Its number is now called.'),
  h('Find it, tap it'), art('column'),
  p('Numbers sit in columns by tens: 1 to 9 in the first column, 10 to 19 in the second, and so on up to 80 to 90 in the last. Look only in that column, tap the number and a chip covers it.'),
  h('Mind the window'),
  p(`A keg stays open only while it is among the last few called: ${PACES.map((x) => `${x.window} on ${x.name}`).join(', ')}. After that you can no longer cover it.`),
  h('Stay sharp'),
  p(`Each chip scores ${SCORE.mark} points plus up to ${SCORE.speedMax} for being quick. A run of correct chips raises a bonus. Tapping a number that has not been called costs ${-SCORE.wrong}. The most points at the end wins the round.`),
  h('Claim it'), art('ladder'),
  p(`When you have a full row, press ROW. With two rows on one card, press TWO ROWS. With a full card, press LOTO. Press too early and it is a false claim (${SCORE.falseClaim}).`),
  h('Need help?'),
  p(`Hint (${HINTS_PER_ROUND} per round) lights up a number you can cover right now. Watch & Learn on the menu plays a whole round and explains each step.`),
];

const paceRows = PACES.map((x) => `${x.name}: a keg every ${x.secs} seconds, window ${x.window} kegs`);
const skillRows = SKILLS.map((x) => `${x.name}: reacts in ${x.react[0]} to ${x.react[1]} seconds, misses ${Math.round(x.miss * 100)} in 100 numbers, claims after ${x.claim[0]} to ${x.claim[1]} seconds, hesitates on ${Math.round(x.slip * 100)} in 100 chips and mis-taps on ${(x.wrong * 100).toFixed(1).replace('.0', '')} in 100 kegs, holds about ${Math.round(x.cards * 100)} percent of your number of cards (at most 3)`);

export const RULES = [
  h('1. The equipment'), art('keg-row'),
  p(`${KEGS} wooden kegs numbered 1 to ${KEGS} go in a bag. Players have cardboard cards. A card has 3 rows and 9 columns. Each row holds ${PER_ROW} numbers and 4 shaded blank squares, so a card holds ${PER_CARD} numbers.`),
  h('2. How the numbers sit on a card'), art('card'),
  p('Column 1 holds numbers 1 to 9, column 2 holds 10 to 19, column 3 holds 20 to 29, and so on. Column 9 holds 80 to 90. Inside a column, numbers rise from top to bottom. Every column of every card has at least one number and at most three.'),
  h('3. Sets of six cards'),
  p(`Cards come in sets of ${SET_SIZE}. In one set every number from 1 to ${KEGS} appears exactly once, so your own cards never repeat a number. You choose ${1} to ${MAX_CARDS} cards (face to face: 1 to ${MAX_DUO_CARDS} each). With all ${MAX_CARDS} cards, every keg that is called is on one of your cards.`),
  h('4. The draw'),
  p('Kegs are drawn in a random order, one at a time, with no repeats. The keg tumbles for a moment, lands on the tray and is then called. The time between kegs depends on the pace:'),
  li(...paceRows),
  h('5. Marking numbers'), art('chip'),
  p('Tap a number on your card to cover it with a chip. What happens:'),
  li('Called and still open: the chip lands. You score points.', `Not called yet: no chip, ${SCORE.wrong} points, and your run of good chips ends.`, 'Called, but its window has closed: it can no longer be covered and is crossed out. That run ends too.', 'Already covered, or a shaded blank: nothing happens.'),
  p('A keg is open while it is among the last N kegs called, where N is the window of the pace.'),
  h('6. What you play for'),
  p('Before a round you choose a goal:'),
  li(...GOALS.map((g) => `${g.name}: ${g.blurb}`)),
  li(`ROW: all ${PER_ROW} numbers of one row on any of your cards are covered (${STAGE_POINTS.row} points).`, `TWO ROWS: two complete rows on the same card (${STAGE_POINTS.two} points).`, `LOTO: all ${PER_CARD} numbers of one card (${STAGE_POINTS.loto} points). In the Row ladder and Marathon goals, LOTO ends the round.`),
  p('You must press the claim button; nothing is claimed for you. Each stage can be won only once per round, by whoever claims it first. When you press the button you also take any lower stage you have reached that nobody has claimed yet.'),
  h('7. False claims'),
  p(`Pressing the claim button when you have nothing to claim is a false claim: ${SCORE.falseClaim} points and the button is locked for ${LOCKOUT_SECS} seconds. If a stage you have reached was already claimed by someone else, there is no penalty.`),
  h('8. Scoring'),
  p(`Score-only: points are for bragging rights, never stakes. Each chip is worth ${SCORE.mark} points plus up to ${SCORE.speedMax} for speed (full at the moment the keg is called, shrinking to nothing as the next keg is due). Every ${SCORE.comboStep} good chips in a row add 25 percent, up to ${Math.round((mult - 1) * 100)} percent more. Stage points are added when you claim. A mis-tap costs ${-SCORE.wrong} and ends the run. The player who ends the round gets a finishing bonus of 2 points for every keg still in the bag (a quarter of that in the Quick game).`),
  h('9. Who wins the round'),
  p('When the round ends, the player with the most points wins, so accuracy, speed and long runs matter as much as being first to shout. Computer players score chips, runs and stage claims exactly like you. Face to face, the player who claims the last stage first wins.'),
  h('10. The computer players'),
  p(`Up to three computer players (${CPU_NAMES.join(', ')}) play with up to 3 cards each. They cover their own numbers after a short reaction time, now and then overlook one or mis-tap, and claim as soon as they notice. Skills:`),
  li(...skillRows),
  h('11. The end of a round'),
  p(`The round ends when the final stage of the goal is claimed. If all ${KEGS} kegs are drawn and nobody claims, the round is a draw. If none of the stages left is possible on any of your cards but a computer player can still finish, the draw runs three times faster until someone wins.`),
  h('12. Hints'),
  p(`${HINTS_PER_ROUND} hints per round. A hint finds a number you can still cover right now, rings it on the card and names its column.`),
  h('13. Face to face'),
  p('Two players share one device. Each sits on one side, with their own cards and their own claim button; the top player\'s half is turned around. There are no computer players. Taps only count on your own half.'),
  h('14. Daily Challenge'),
  p('One round a day with the same cards and the same kegs for everybody that day, played as a Quick game against two computer players. Your best score for the day and your streak of days are kept.'),
  h('15. Watch & Learn'),
  p(`A round plays itself with two cards. For each keg: THINK (${THINK_STEPS.join(', ')} seconds, your choice) shows the number and which column it belongs to; REVEAL (${AUTO_REVEAL_SECS} seconds) shows where it is on the cards; ACT covers it. Kegs that are not on the cards go by quickly. Pause freezes the whole lesson.`),
  h('16. Keyboard (web version)'),
  li('Space: claim', 'H: hint', 'P or Esc: pause'),
  h('17. Keg nicknames'),
  p('Many families call out nicknames with the numbers. A few that are often heard: ' + nick + '. They vary from home to home.'),
];
