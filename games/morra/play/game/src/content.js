// Text screens: About, How to Play and the paged Rules reference. Numbers come from engine.js so the text cannot drift from the engine.
// Blocks: { h } heading, { p } paragraph, { li } bullet, { fig: name, hh: height } a figure drawn with the game's own hands, { sp } gap.
import { RIVALS, WORDS, TARGETS, DEFAULT_TARGET, AUTO_TARGET, THINK_TIMES, MAX_CALL, COUNT_BEATS } from './engine.js';

const tgt = TARGETS.join(', ');

export const ABOUT = [
  { h: 'Morra' },
  { p: 'Morra is one of the oldest hand games in the world. Two players hold out a fist, throw it open with some number of fingers and shout a number at the same moment. Whoever shouts the exact total of all the fingers on the table scores. The Romans played it as micatio, flashing their fingers in the forum and the market, and it has been played in the taverns, harbours and squares of Italy and across the Mediterranean ever since.' },
  { p: 'An old Roman saying praised an honest man as someone you could play micatio with in the dark. The game needs no board and no pieces, only two hands, a quick eye and a feel for how the other person thinks.' },
  { h: 'This version' },
  { li: `Play a duel against five characters of the osteria, each with their own habits, from Nonna Lucia who loves a big five to Il Maestro who reads you and remembers you.` },
  { li: 'Pick your throw and your call, then both hands open together after a count of uno, due, tre.' },
  { li: `Duels run to ${DEFAULT_TARGET} points (or ${tgt} in Settings). Points only: there are no stakes, chips or money.` },
  { li: 'After every round you get a short tell about your own habits, and the result screen shows which throws you favour.' },
  { li: 'Watch and Learn plays a whole duel for you with time to think before each throw, and you can pause it. A Hint button shows how to read the rival.' },
  { li: 'A full Rules page and text size up to 300%. Sound is made on your device. Works offline.' },
  { sp: 1 },
  { p: 'Simplifications: a closed fist counts as zero, so a throw is 0 to 5 and a call is 0 to 10. Regional tables vary on this and on how a tied round is handled; the Rules page says exactly what this game does.' },
  { sp: 1 },
  { p: 'Made by Arcforge. One game in a growing collection of the world\'s heritage games.' },
];

export const HOWTO = [
  { h: 'The quick version' },
  { li: 'Tap how many fingers to throw, 0 to 5. Your fingers count in the total.' },
  { li: 'Tap the total you call. It runs from your own throw up to your throw plus 5.' },
  { li: 'Press Throw. The fist pumps three times (uno, due, tre) and both hands open together.' },
  { li: 'If your call matches the total of all the fingers and the rival\'s does not, you score. If both are right or neither, nobody scores.' },
  { h: 'How to think' },
  { li: 'Your call is your own throw plus the number you guess the rival will throw. Guess the rival\'s habit and you add it to yours.' },
  { li: 'Every rival has a habit. Watch their last throws on the table strip and use the Hint button to see what the table knows about them.' },
  { li: 'The stronger rivals read you too. If you always throw the same number or always guess a repeat, they will use it. Mix it up.' },
  { h: 'Other modes' },
  { li: 'Watch and Learn plays a short duel for you, thinking before each throw. Pause it any time.' },
  { li: 'Settings: sound, think time, Italian number words, duel length, reduced motion, your hand colour and text size.' },
  { h: 'On a keyboard' },
  { li: 'Keys 0 to 5 pick the throw. Q W E R T Y U I O P pick a call of 0 to 9 and the minus key picks 10. Enter or Space throws. H is the hint and Escape pauses.' },
];

const ruleNames = RIVALS.map((r) => `${r.name}: ${r.blurb}`);

export const RULES = [
  {
    title: 'The idea',
    blocks: [
      { h: 'Two hands, one total' },
      { p: 'Each round both players throw out some fingers and shout a number at the same time. Everyone is guessing the same thing: how many fingers are out on the table in total.' },
      { fig: 'hands', hh: 150 },
      { p: 'A throw is 0 to 5 fingers. A closed fist is zero. The total of both throws is therefore 0 to 10.' },
      { fig: 'sum', hh: 190 },
    ],
  },
  {
    title: 'Throw and call',
    blocks: [
      { h: 'Your throw' },
      { p: 'Choose 0, 1, 2, 3, 4 or 5 fingers. The fingers come out in the order index, middle, ring, little finger and thumb.' },
      { h: 'Your call' },
      { p: `Your call is a number from 0 to ${MAX_CALL}. Because your own fingers are part of the total, the lowest sensible call is your own throw and the highest is your throw plus 5. This game only lets you choose calls in that range, so a throw of 3 allows calls 3 to 8.` },
      { fig: 'range', hh: 150 },
      { h: 'The count' },
      { p: `Both hands pump as a fist ${COUNT_BEATS} times to the count uno, due, tre, and open together on the last beat. The choices are fixed before the count starts, so neither side can change after seeing the other.` },
      { fig: 'words', hh: 140 },
    ],
  },
  {
    title: 'Scoring a round',
    blocks: [
      { h: 'Who scores' },
      { li: 'Only your call is right: you score 1 point.' },
      { li: 'Only the rival\'s call is right: the rival scores 1 point.' },
      { li: 'Both calls are right: nobody scores. A shared guess is a draw.' },
      { li: 'Neither call is right: nobody scores, and the next round begins at once.' },
      { fig: 'cases', hh: 210 },
      { p: 'Most rounds score nothing for anybody. That is normal: the exact total is a hard guess, and the game is in noticing which guesses the rival is making.' },
    ],
  },
  {
    title: 'Winning a duel',
    blocks: [
      { h: 'First to the target' },
      { p: `A duel is won by the first side to reach the target. The target is ${DEFAULT_TARGET} points by default and you can set it to ${tgt} in Settings. Watch and Learn plays a shorter duel to ${AUTO_TARGET}.` },
      { p: 'A won duel is counted for that rival on the rival screen. Your bests are saved on your device.' },
      { h: 'No stakes' },
      { p: 'Morra has been played for drinks and money in many places. This game is points only. There are no chips, no bets and nothing is won or lost except the duel.' },
    ],
  },
  {
    title: 'The five rivals',
    blocks: [
      { h: 'Characters and habits' },
      ...ruleNames.map((s) => ({ li: s })),
      { sp: 1 },
      { p: 'Nonna Lucia and Marco never learn from you. Don Sergio tracks only your favourite number. Giulia reads your last throw and what you throw after each throw. Il Maestro also reads your cycles and your two-throw patterns, keeps a long memory and also remembers your throws from earlier duels.' },
      { fig: 'rivals', hh: 260 },
    ],
  },
  {
    title: 'Reading and being read',
    blocks: [
      { h: 'What a rival can read' },
      { li: 'Your throws: how often you throw each number, and what you tend to throw after a given number.' },
      { li: 'Your cycles: throwing 1, 2, 3, 1, 2, 3 is easy to follow.' },
      { li: 'Your guesses: if you always guess that the rival will throw the same number again, they will throw something else.' },
      { h: 'What you can read' },
      { li: 'Keep an eye on the strip of recent throws on the table.' },
      { li: 'Use Hint for a plain sentence about what the table knows, and a suggested throw and call.' },
      { li: 'After a duel, the result screen shows how often you threw each number and what your habits were.' },
      { p: 'The rivals use only the information that you and they have both seen: past throws and calls. They never look at your choice before the count.' },
    ],
  },
  {
    title: 'Watch and Learn and Settings',
    blocks: [
      { h: 'Watch and Learn' },
      { p: `The computer plays your side of a short duel. Before each throw it thinks for ${THINK_TIMES[1]} seconds (set in Settings, ${THINK_TIMES[0]} to ${THINK_TIMES[THINK_TIMES.length - 1]}), then shows its throw and call for 2 seconds with the reason, then throws. Pause and Resume freeze the whole show exactly where it stopped. Watch and Learn is always free to use.` },
      { h: 'Settings' },
      { li: 'Sound on or off.' },
      { li: 'Think time for Watch and Learn.' },
      { li: 'Italian number words with the digits.' },
      { li: `Duel length: ${tgt} points.` },
      { li: 'Reduced motion: fewer sparks and a calmer count.' },
      { li: 'Your hand colour.' },
      { li: 'Text size up to 300% (the A- and A+ buttons on every text screen).' },
    ],
  },
  {
    title: 'Heritage and simplifications',
    blocks: [
      { h: 'Where it comes from' },
      { p: 'Morra is the Italian name of a finger game that the Romans called micatio. It is played, with local variations, in Italy, Spain, Croatia, Greece, North Africa and other Mediterranean countries. In Italy it is still shouted in the taverns; "morra cinese" is also the Italian name for the children\'s game of rock, paper, scissors.' },
      { h: 'What this game simplifies' },
      { li: 'A closed fist counts as zero, so totals are 0 to 10. Some tables forbid a fist or count it differently.' },
      { li: 'The fingers always come out in the same order, so a throw of 3 is always index, middle and ring.' },
      { li: 'Rounds in which both calls are right are not scored, and the duel continues. Some tables replay them.' },
      { li: 'The game is points only and played against the computer. Passing the phone between two people is not included.' },
    ],
  },
];
