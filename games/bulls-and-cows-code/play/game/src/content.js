// Text for About, How to Play and Rules. Every rule here is checked against engine.js / game.js (see design/GDD.md "Rules reference").
// Blocks: { h } heading, { p } paragraph, { li: [...] } bullets. `fig` names a drawing made with the game's own pegs and clue pips.
import { GRADES } from './engine.js';

export const GRADE_INFO = GRADES;

export const ABOUT = {
  title: 'About',
  pages: [
    {
      title: 'Bulls and Cows',
      fig: { k: 'rows', secret: [4, 1, 7, 2], guesses: [[0, 1, 2, 3], [1, 4, 0, 2]], hide: false },
      body: [
        { p: 'A secret code of digits is hidden. You guess, and every guess earns two clues: bulls (a right digit in the right place) and cows (a right digit in the wrong place). Use the clues to narrow the possibilities until you crack it.' },
        { p: 'Bulls and Cows is a pencil-and-paper game that has been played in many countries for generations, and it is the ancestor of Mastermind. This version is made for calm, sharp thinking: lit enamel pegs, a coach that teaches real deduction, no ads and no pressure.' },
        { li: ['Break the Code: find the computer\'s secret in as few guesses as you can.', 'Set the Code: choose your own secret and score the computer\'s guesses. Can you outlast it?', 'A Daily Code, the same for everyone, with a streak.', 'Five grades, from three digits to five digits with repeats.', 'Hints that explain the logic, and Watch and Learn.'] },
      ],
    },
    {
      title: 'Credits and the free preview',
      body: [
        { p: 'You can play for a free preview first. Unlocking the full game is a single one-time purchase; there are no ads and no subscriptions. Restore Purchase is in Settings.' },
        { p: 'Titles are set in Cinzel and interface text in Fredoka, both used under the SIL Open Font License 1.1. All sounds are synthesized on your device.' },
        { p: 'Bulls and Cows is part of Arcforge, a collection of world heritage games.' },
      ],
    },
  ],
};

export const HOWTO = {
  title: 'How to Play',
  pages: [
    {
      title: 'Break the Code',
      fig: { k: 'rows', secret: [4, 1, 7, 2], guesses: [[0, 1, 2, 3]], hide: true },
      body: [
        { p: 'Choose Break the Code and a grade. The secret is hidden behind the brass lids at the top of the board.' },
        { li: ['Tap a digit peg to place it in the glowing row. Tap a slot first to change one.', 'Delete takes a peg out. Guess locks the row in.', 'Gold orbs are bulls: right digit, right place. Teal rings are cows: right digit, wrong place.', 'Crack the code before you run out of tries.'] },
      ],
    },
    {
      title: 'Reading the clues',
      fig: { k: 'rows', secret: [4, 1, 7, 2], guesses: [[0, 1, 2, 3], [1, 4, 0, 2], [4, 1, 7, 2]], hide: false },
      body: [
        { p: 'Clues tell you how many, never which. With the secret 4 1 7 2: the guess 0 1 2 3 has one bull (the 1 is in the right place) and one cow (the 2 is in the code, just not there).' },
        { p: 'The order of the pips never matters. Gold always comes first, then teal.' },
      ],
    },
    {
      title: 'Set the Code',
      body: [
        { p: 'Now the computer breaks your code. Pick your secret with the digit pegs and tap Lock in the code. The computer thinks, then makes a guess.' },
        { li: ['Count the bulls and the cows for its guess and set them with the plus and minus buttons, then tap Score.', 'If you miscount, the game tells you which count to recheck. Show me reveals the right answer and highlights it.', 'The computer has a limited number of guesses. If it cannot crack your code in time, you win.'] },
      ],
    },
    {
      title: 'Hints, the coach and marks',
      body: [
        { p: 'Tap the bulb for a hint. It works in three steps: where to look, why it is true, and (when nothing is certain yet) a strong next guess you can place with one tap.' },
        { li: ['Marks: switch on Marks and tap a digit to cycle in, out and maybe. Your own notes, shown on the pegs.', 'Warnings: a guess that contradicts an earlier clue is flagged before you lock it in (Settings, Coach).', 'Full coach also shows how many codes still fit your clues.'] },
      ],
    },
    {
      title: 'Daily Code and Watch and Learn',
      body: [
        { p: 'The Daily Code is the same for everyone and changes every day. Solve it to build a streak.' },
        { p: 'Watch and Learn lets the computer solve a hidden code while it explains each deduction. Pause stops everything, and the think time can be 2, 5, 8 or 10 seconds.' },
      ],
    },
  ],
};

export const RULES = {
  title: 'Rules',
  pages: [
    {
      title: 'The aim',
      body: [
        { p: 'One side hides a secret code. The other side guesses it, using only the bulls and cows clues, within a limited number of tries. Cracking the code wins the round.' },
        { p: 'In Break the Code you guess and the computer hides the code. In Set the Code you hide the code and the computer guesses.' },
      ],
    },
    {
      title: 'The code',
      fig: { k: 'pegs' },
      body: [
        { p: 'A code is a row of digits from 0 to 9. Zero is allowed, including in the first place. Each digit has its own colour and always carries its numeral.' },
        { h: 'Length and repeats by grade' },
        { li: GRADES.slice(1).map((g) => `${g.name}: ${g.len} digits, ${g.rep ? 'a digit may repeat' : 'all different'}, ${g.tries} tries.`) },
        { p: 'In the grades where all digits are different, the keypad will not let you place the same digit twice in one guess.' },
      ],
    },
    {
      title: 'A guess',
      body: [
        { p: 'A guess is a full row of digits with the same length as the code. You fill the row, then lock it in with Guess. Once locked a row cannot be changed.' },
        { p: 'You may lock in any guess, even one that earlier clues already rule out. The coach can warn you, but it never stops you.' },
      ],
    },
    {
      title: 'Bulls',
      fig: { k: 'rows', secret: [4, 1, 7, 2], guesses: [[4, 0, 0, 3], [4, 1, 5, 6]], hide: false },
      body: [
        { p: 'A bull is a digit that is in the code and in the same place in your guess. It is shown as a gold orb.' },
        { p: 'Secret 4 1 7 2. The guess 4 0 0 3 has one bull (the 4 in first place). The guess 4 1 5 6 has two bulls (4 and 1).' },
      ],
    },
    {
      title: 'Cows',
      fig: { k: 'rows', secret: [4, 1, 7, 2], guesses: [[1, 4, 0, 0], [2, 7, 1, 4]], hide: false },
      body: [
        { p: 'A cow is a digit that is in the code but in a different place in your guess. It is shown as a teal ring.' },
        { p: 'Secret 4 1 7 2. The guess 1 4 0 0 has two cows (1 and 4 are in the code but not there). The guess 2 7 1 4 has four cows: every digit is right, none is in its place.' },
        { p: 'Bulls and cows are counted together but never for the same digit: a digit that is a bull is not also a cow.' },
      ],
    },
    {
      title: 'Repeated digits',
      fig: { k: 'rows', secret: [3, 3, 5, 1, 0], guesses: [[3, 0, 3, 3, 3], [5, 5, 3, 3, 3]], hide: false, rep: true },
      body: [
        { p: 'In Master the same digit can appear more than once in a code or a guess. Each digit of the code can be matched only once.' },
        { p: 'First every bull is counted. Then, for each digit, the cows are the smaller of how many remain unmatched in the code and in the guess.' },
        { p: 'Secret 3 3 5 1 0 and guess 3 0 3 3 3: one bull (the first 3), and two cows (a 3 and the 0 match elsewhere). The extra 3s in the guess earn nothing, because the code has only two 3s.' },
        { p: 'Guess 5 5 3 3 3 against the same secret: no bulls, and three cows (one 5 and both 3s).' },
      ],
    },
    {
      title: 'Tries, winning and losing',
      body: [
        { p: 'You win when a guess scores all bulls (every digit right and in place). Your result is the number of guesses you used.' },
        { p: 'You lose the round if you use all your tries without a full set of bulls. The brass lids then open to show the code.' },
        { li: GRADES.slice(1).map((g) => `${g.name} gives ${g.tries} tries.`) },
        { p: 'There is no time limit. The clock only records how long the round took.' },
      ],
    },
    {
      title: 'Stars',
      body: [
        { p: 'Each grade has a par: the number of guesses a good player needs.' },
        { li: GRADES.slice(1).map((g) => `${g.name}: par ${g.par}.`) },
        { li: ['Three stars: solved in par guesses or fewer, using at most two hints.', 'Two stars: solved within two guesses of par, or in par with more hints.', 'One star: solved with more guesses than that.', 'No stars if you run out of tries.'] },
      ],
    },
    {
      title: 'Set the Code: scoring',
      body: [
        { p: 'You choose a secret (or tap Random) and lock it in. The computer then guesses. For each guess you set how many bulls and how many cows it scored, then tap Score.' },
        { p: 'The game checks your count against your code. A wrong count is not accepted and is added to your mistakes. It tells you whether the bulls or the cows need another look. Show me fills in the correct counts and marks the matching pegs; the round is then marked as helped.' },
        { p: 'In Settings you can switch on Score for me, so the computer marks its own guesses.' },
      ],
    },
    {
      title: 'Set the Code: the computer',
      body: [
        { p: 'The computer keeps every code that still fits all clues and picks guesses that split those codes into the smallest groups. Its first guess uses different digits, relabelled at random, so it is never the same twice.' },
        { p: 'It has a limited number of guesses, fewer than you get when breaking:' },
        { li: GRADES.slice(1).map((g) => `${g.name}: ${g.ctries} guesses.`) },
        { p: 'If it cracks your code within its guesses, it wins. If it runs out, you win. Three stars if you outlast it; two stars if it cracked your code on its very last guess; one star if it cracked it sooner.' },
      ],
    },
    {
      title: 'The Daily Code',
      body: [
        { p: 'A new code every day, the same for every player, with a grade that depends on the day of the week. You can replay it, but only a win on the day counts. A win extends your streak; a missed day starts it again.' },
        { p: 'The Daily Code always uses Break the Code.' },
      ],
    },
    {
      title: 'Hints and the coach',
      body: [
        { p: 'The hint button looks at every clue so far and finds what is certain: digits that cannot be in the code, digits that must be, a place that can hold only one digit, or the one remaining code.' },
        { li: ['Step 1 shows where to look. Step 2 explains why.', 'If nothing is certain yet, the hint suggests a guess that still fits every clue and splits the remaining codes well. Use guess places it in your row.', 'Each hint is counted. Hints only change your stars.', 'Each fact is given once per round, so asking again moves on to the next thing.'] },
        { p: 'Coach in Settings: Off, Warn (flags a guess that contradicts an earlier clue) or Full (also shows how many codes still fit, and crosses off digits that are certainly out).' },
      ],
    },
    {
      title: 'Marks',
      body: [
        { p: 'Marks are your own notes on the digit pegs. Switch on Marks, then tap a digit to cycle: in, out, maybe, none. They are never checked and never affect the result.' },
      ],
    },
    {
      title: 'Watch and Learn',
      body: [
        { p: 'The computer solves a hidden code from scratch. Each turn has three parts: Think (it studies the clues), Reveal (it shows its guess and the reason) and Act (it plays the guess).' },
        { p: 'Pause freezes everything at once and Resume continues exactly where it stopped. Think time is 2, 5, 8 or 10 seconds. Watch and Learn does not use up the free preview and does not change your stats.' },
      ],
    },
    {
      title: 'Pause, saving and the free preview',
      body: [
        { p: 'Pause stops the clock. Your round is saved as you play, so Continue on the menu resumes it, even after closing the game.' },
        { p: 'The free preview counts real play only. Menus, Rules, Watch and Learn, Pause and results do not use it. After it ends, one purchase unlocks the full game.' },
        { p: 'The free web demo allows three rounds.' },
      ],
    },
  ],
};

export const DOCS = { about: ABOUT, howto: HOWTO, rules: RULES };
