// Text for the About, How to Play and Rules pages. Short single-idea pages so each fits the reader card
// even at the 300% text-zoom step. Every Rules claim is cross-checked against rules.js (the engine).
// `fig` names an illustration drawn by view.js with the game's own pawn / die / ladder / serpent art.
import { BUMP_BACK, MAX_SIXES, CLASSIC_LADDERS, CLASSIC_SNAKES, FINISH } from './rules.js';

export const ABOUT = [
  { title: 'A dice race', lines: ['Roll, hop, climb and slide. The first pawn to reach square 100 wins.'], fig: 'board' },
  { title: 'Painted cloth', lines: ['Families in India have long played ladder-and-serpent race games on boards painted by hand on cloth.'] },
  { title: 'Travelled far', lines: ['The game reached Britain in the 1800s and is now played in homes all over the world.'] },
  { title: 'Habits and slips', lines: ['In the old boards every ladder is a good habit and every serpent is a slip.'], fig: 'ladder' },
  { title: 'In this version', lines: ['Each ladder carries a name like Kindness or Honesty, and each serpent a name like Anger or Greed.'], fig: 'snake' },
  { title: 'Made to be handled', lines: ['The board, the pawns and the die are drawn by hand in code, with real shading and weight.'], fig: 'pawn' },
  { title: 'Your rules', lines: ['Play the classic one-die game, or choose between two dice each turn. Switch on extra rules if you like.'], fig: 'dice2' },
  { title: 'Fresh boards', lines: ['Play the classic board, a fresh board every game, or the board of the day.'] },
  { title: 'Watch and learn', lines: ['Not sure? Watch the computer play a whole game and see why it chooses what it does.'] },
  { title: 'Price', lines: ['Try it free for a short while. A single purchase unlocks the full game. No ads, ever.'] },
];

export const HOWTO = [
  { title: 'Your goal', lines: [`Be the first pawn to reach square ${FINISH}.`], fig: 'board' },
  { title: 'Roll the die', lines: ['On your turn tap the Roll button, or flick the die across the table with your thumb.'], fig: 'die' },
  { title: 'Watch it tumble', lines: ['The die bounces and settles. The number it shows is how many squares you move.'], fig: 'die' },
  { title: 'Hop along', lines: ['Your pawn hops one square at a time, following the zig-zag numbers.'], fig: 'pawn' },
  { title: 'Climb a ladder', lines: ['End your move at the foot of a ladder and you climb to its top.'], fig: 'ladder' },
  { title: 'Slide down', lines: ['End your move on a serpent head and you slide down to its tail.'], fig: 'snake' },
  { title: 'Two dice', lines: ['With two dice, tap the die you want to use, or tap its glowing landing square.'], fig: 'dice2' },
  { title: 'Hint button', lines: ['Tap Hint any time. It tells you what lies ahead, or which die is better and why. Unlimited.'] },
  { title: 'Pass the phone', lines: ['Choose Friends in the setup to play 2 to 4 people on one phone, passing it along.'] },
  { title: 'Keyboard', lines: ['Space or Enter rolls and confirms. 1 and 2 pick a die. H gives a hint. Escape opens the menu.'] },
  { title: 'Text size', lines: ['Use A- and A+ on the menu or in Settings to make every screen bigger, up to 300%.'] },
  { title: 'Long messages', lines: ['If the message under the board is too long to fit, tap it to read it in full. The game waits until you close it.'] },
];

export const RULES = [
  { title: 'The board', lines: ['The board is a grid of 100 squares, ten across and ten up, numbered 1 to 100.'], fig: 'board' },
  { title: 'Zig-zag numbers', lines: ['Square 1 is at the bottom left. The first row runs left to right, the next row right to left, and so on.'], fig: 'numbers' },
  { title: 'The last square', lines: [`The golden square ${FINISH} is at the top left. Reach it to win.`], fig: 'board' },
  { title: 'Players', lines: ['2 to 4 players. Each has one pawn in their own colour: Ruby, Teal, Amber and Plum.'], fig: 'pawns' },
  { title: 'Friends on one phone', lines: ['Choose Friends in the setup and every pawn is played by a person. Pass the phone along when the turn changes.'], fig: 'pawns' },
  { title: 'The start', lines: ['Pawns wait off the board, on the painted border at the bottom, until their first move.'], fig: 'pawn' },
  { title: 'Turns', lines: ['Players take turns in order, one move each. The first seat goes first.'] },
  { title: 'One die (classic)', lines: ['Roll one die, 1 to 6. Move your pawn forward that many squares. This is the default.'], fig: 'die' },
  { title: 'How you roll', lines: ['Tap Roll or flick the die. The number is decided at the throw, so a flick cannot change it.'], fig: 'die' },
  { title: 'Ladders', lines: ['If your move ends on the foot of a ladder, your pawn climbs to the top of it.'], fig: 'ladder' },
  { title: 'Ladder names', lines: ['Each ladder has a name, a good habit such as Kindness. It is shown when you climb.'], fig: 'ladder' },
  { title: 'Serpents', lines: ['If your move ends on a serpent head, your pawn slides down to its tail.'], fig: 'snake' },
  { title: 'Serpent names', lines: ['Each serpent has a name, a slip such as Anger. It is shown when you slide.'], fig: 'snake' },
  { title: 'Only once', lines: ['A move can use at most one ladder or one serpent. Where you land after it, you stay.'] },
  { title: 'The classic board', lines: [`The classic board has ${CLASSIC_LADDERS.length} ladders and ${CLASSIC_SNAKES.length} serpents, always in the same places.`], fig: 'board' },
  { title: 'Two dice', lines: ['In the pick-of-two rule you roll two dice, then use one of them. The other is thrown away.'], fig: 'dice2' },
  { title: 'Choosing', lines: ['Both landing squares glow. Tap the die you want, or its landing square. Think about ladders and serpents.'], fig: 'dice2' },
  { title: 'Six rolls again', lines: [`Optional. If the die you use shows a 6, you roll again. After ${MAX_SIXES - 1} sixes in a row, the next six does not roll again.`], fig: 'die6' },
  { title: 'Exact finish', lines: [`Optional, on by default. You must land exactly on ${FINISH}. A roll that is too high leaves you where you are.`] },
  { title: 'Without exact finish', lines: [`If it is off, any roll that reaches or passes ${FINISH} wins.`] },
  { title: 'A ladder to the end', lines: [`A ladder that ends on ${FINISH} wins the game at once, just like landing there.`], fig: 'ladder' },
  { title: 'Bump back', lines: [`Optional, off by default. If you end your move on a square holding another pawn, that pawn goes back ${BUMP_BACK} squares.`], fig: 'pawns' },
  { title: 'Bump details', lines: ['A bumped pawn never takes a ladder or serpent. Bumping applies where you finally stop, and never on the last square.'] },
  { title: 'Sharing a square', lines: ['Without bump back, pawns may share a square. They stand side by side.'], fig: 'pawns' },
  { title: 'Winning', lines: ['The first pawn to reach the last square wins and the game ends at once. Others are ranked by how far they got.'] },
  { title: 'No draws', lines: ['A game cannot end in a draw. It ends when one pawn arrives, or when you leave from the menu.'] },
  { title: 'Fresh boards', lines: ['A fresh board has 8 or 9 ladders and 8 or 9 serpents placed at random. It is checked to be a fair length.'] },
  { title: 'Board of the day', lines: ['The daily board is made from the date, so everyone gets the same board that day.'] },
  { title: 'Computer players', lines: ['With one die there is no choice to make. With two dice, Easy sometimes picks at random, Steady is usually sensible and Sharp always takes the better die.'] },
  { title: 'How computers choose', lines: ['With two dice, the computer picks the landing square that leaves the shortest expected race to the end.'] },
  { title: 'Hints', lines: ['Hint is free and unlimited. With one die it shows what lies ahead. With two dice it names the better one.'] },
  { title: 'Watch and Learn', lines: ['The computer plays a whole game. It thinks, shows its options, then moves. You can pause at any time.'] },
];
