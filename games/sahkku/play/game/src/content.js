// Text and diagrams: Rules, How to Play, About. Every rule statement is cross-checked against rules.js (the single source of truth).
// Items: { k: 'h' | 'p' | 'd' | 'dice', t / spec }. Diagram specs are drawn by art.miniBoard with the game's own pieces.
import { cell } from './rules.js';

const c = cell;
const H = (t) => ({ k: 'h', t });
const P = (t) => ({ k: 'p', t });
const D = (spec) => ({ k: 'd', spec });
const DICE = { k: 'dice' };

export const RULES = [
  { title: 'The board', items: [
    P('Sáhkku is played on a square board of 7 by 7 cells. The herders travel on the 24 cells of the outer ring and on a cross of cells through the middle. The cells of the inner corners are decoration: nobody can stand there.'),
    D({ marks: [[c(6, 0), 'ring'], [c(0, 6), 'ring'], [c(3, 3), 'ring']], king: c(3, 3), kingOwner: -1 }),
    P('The two ringed corners are the camps: Red at the bottom left, Blue at the top right. The cell in the middle is the crossroads, where the white reindeer king waits at the start.'),
    P('The four cells in the middle of each side are the gates. A gate is where the outer ring meets the cross.'),
  ] },
  { title: 'The herders and the king', items: [
    P('Each side has 6 herders. All of them start asleep, off the board, beside their camp. The neutral white reindeer king stands on the centre. It belongs to nobody until a herder lands on it.'),
    P('You win by capturing every herder of the other side, asleep or awake. The king is never captured; it only changes sides.'),
  ] },
  { title: 'The dice', items: [
    P('You roll four four-sided dice. Each die shows Dawn (the sun) or 1, 2 or 3, each with the same chance.'),
    DICE,
    P('Every die is a move of its own for one piece. You may use the dice in any order and give them to different pieces or all to one. You must use a die when it has any legal use; a die that cannot be used is lost. When none of the dice can be used, the turn passes.'),
    P('If all four dice show the same face, you roll again after using them.'),
  ] },
  { title: 'Waking a herder', items: [
    P('A die showing Dawn may wake one sleeping herder of yours: he is placed on your camp corner. If you have no sleeping herder, or you would rather run, Dawn is a step of one cell for a piece on the board.'),
    P('You cannot wake a herder onto a camp where two of your own herders already stand. If a single rival herder is standing on your camp cell, waking a herder there captures him.'),
  ] },
  { title: 'Moving', items: [
    P('A herder moves along the track clockwise (the way a clock turns) as many cells as the die shows. Dawn counts as 1. A herder passes over other pieces freely: only the cell he stops on matters.'),
    D({ men: [[c(0, 1), 0]], marks: [[c(0, 4), 'dot']], arrows: [[c(0, 1), c(0, 4)]] }),
    P('The red herder here has a 3 and can stop on the marked cell. Each die moves one piece once; with a 2 and a 1 you can move two herders, or one herder 3 cells with two dice.'),
  ] },
  { title: 'The cross: shortcuts', items: [
    P('A herder standing on a gate, or arriving on one during his move, may turn inwards instead of going on round the ring. He then walks the cross: through the centre and out of the opposite gate, where he rejoins the ring and goes on clockwise.'),
    D({ men: [[c(0, 3), 0]], marks: [[c(3, 3), 'dot'], [c(1, 3), 'dot'], [c(2, 3), 'dot'], [c(0, 4), 'dot']], arrows: [[c(0, 3), c(3, 3)]] }),
    P('On the centre a herder may continue straight on or turn left or right onto another arm of the cross. Within one move he never turns back on his own steps. A herder who stops on the cross may go either way along it on a later move.'),
    P('The cross is a risk as well as a shortcut: it lets rivals come at you from a new direction, and the centre is where the king stands.'),
  ] },
  { title: 'Capturing', items: [
    P('When a herder lands exactly on a cell where a single rival herder stands, the rival is captured and leaves the game for good.'),
    D({ men: [[c(0, 1), 0], [c(0, 4), 1]], marks: [[c(0, 4), 'cap']], arrows: [[c(0, 1), c(0, 4)]] }),
    P('Only a piece that lands there captures; passing over a rival does nothing, and a sleeping herder cannot be captured.'),
  ] },
  { title: 'Safe herders', items: [
    P('Three things protect a herder, and nothing can land on a protected cell:'),
    H('A pair'),
    P('Two herders of the same side on one cell. A rival cannot land on the pair, and you cannot put a third of yours on it.'),
    D({ men: [[c(0, 4), 1], [c(0, 4), 1], [c(0, 1), 0]], marks: [[c(0, 4), 'ring']] }),
    H('Your own camp'),
    P('A herder standing on his own camp corner. (A rival herder standing on your camp is not protected there, and waking a herder captures him.)'),
    H('The king'),
    P('A herder on the same cell as his own king.'),
  ] },
  { title: 'The king', items: [
    P('A herder that lands on the king, when no protected rival herder is standing with it, wins it over: the king now belongs to his side, whether it was neutral or the rival\'s. The herder and the king share the cell.'),
    D({ men: [[c(1, 3), 0]], king: c(3, 3), kingOwner: -1, marks: [[c(3, 3), 'ring']], arrows: [[c(1, 3), c(3, 3)]] }),
    P('Your king moves with your dice like a herder: it uses a die, takes the same number of steps, and it may go round the ring in either direction. When it lands on a single rival herder it captures him.'),
    P('The king cannot be captured, but it changes sides every time a rival herder lands on it. Keep a herder beside it, or the other side will take it back.'),
  ] },
  { title: 'Winning and drawing', items: [
    P('The side that captures all six herders of the other side wins.'),
    P('If 80 rolls each pass without any capture, the side with more herders left (asleep or awake) wins; equal numbers are a draw.'),
  ] },
  { title: 'About these rules', items: [
    P('Sáhkku is a traditional Sámi game and its rules were never written in one fixed form: boards, numbers of pieces, the marking of the dice and local customs vary between places and families, and new rule sheets have been published in recent years.'),
    P('This app is a simplified adaptation made for the phone. The simplifications are: a 7 by 7 board with a cross, 6 herders a side, four dice with the faces Dawn, 1, 2 and 3, and the safe-herder rules above. If you play Sáhkku in the traditional way, you may know it differently, and we would like to hear about it.'),
  ] },
];

export const HOWTO = [
  { title: 'Play in five steps', items: [
    P('1. Tap the dice tray to roll four dice. Dawn, 1, 2 or 3 on each.'),
    P('2. Tap one of your herders. Glowing cells show where each die would take him; a red ring means that move captures a rival.'),
    P('3. Tap a glowing cell. The die is used and the herder walks there. Do it again for every die.'),
    P('4. A Dawn die can wake a sleeping herder: tap your camp corner (or the sleeping herders on your plate) when the camp cell glows.'),
    P('5. Land on a rival herder to capture him. Land on the white reindeer to make it yours. Capture all six rival herders to win.'),
  ] },
  { title: 'Good to know', items: [
    P('Two of your herders on one cell are a safe pair, and so is a herder on his own camp or beside his king.'),
    P('At a gate you may turn into the middle: a shortcut, or a way to chase.'),
    P('Hint shows a good move and Take back undoes your last move in a turn. Auto Play lets you watch the computer play both sides, with a Pause button.'),
    P('Turn the phone any way you like: the board uses the whole screen.'),
  ] },
];

export const ABOUT = [
  { title: 'The game', items: [
    P('Sáhkku is a dice and board game of the Sámi, the Indigenous people of Sápmi, whose homelands cross the north of Norway, Sweden, Finland and the Kola Peninsula of Russia. Sáhkku is the North Sámi spelling of its name.'),
    P('Roll four-sided dice, wake sleeping herders, run them round the board and capture rivals by landing on them. A neutral king joins whichever side takes it, and goes to the other side when they do the same. It has been known for centuries and is played in tournaments today.'),
  ] },
  { title: 'Credit and care', items: [
    P('The game belongs to Sámi culture and tradition. This app is an independent, simplified adaptation made with respect, for anyone to enjoy and learn from. It is not made or endorsed by any Sámi organisation, and its rules, art and names are ours.'),
    P('If you are a Sámi player, teacher or organisation and see something to correct or improve, please tell us through the app store page.'),
  ] },
  { title: 'This app', items: [
    P('Four computer levels, two players on one phone, hints, Take back, Auto Play (Watch and Learn), text size up to 300 percent and reduced motion. Works offline, no ads.'),
  ] },
  { title: 'Made by', items: [
    P('Part of Arcforge, a collection of heritage games from around the world.'),
  ] },
];
