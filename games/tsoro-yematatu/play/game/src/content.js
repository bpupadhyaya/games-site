// Text and diagrams: the Rules reference, How to Play, About, and the lessons. Every rule statement here is cross-checked against rules.js
// (the single source of truth for legality). Items: { k: 'h' | 'p' | 'd', t / spec }.
// Diagram spec: { variant, stones: { point: 1 (Sun) | 2 (River) }, marks: [[point, 'ring'|'cross'|'dot'|'target']], arrows: [[from, to]], line: [a, b, c] }.
// Classic points: 0 top, 1 upper left, 2 centre, 3 upper right, 4 bottom left, 5 bottom middle, 6 bottom right.
const D = (spec, w = 330) => ({ k: 'd', spec, w });
const H = (t) => ({ k: 'h', t });
const P = (t) => ({ k: 'p', t });
const C = (extra) => ({ variant: 'classic', ...extra });

export const RULES = [
  { title: 'Where the game comes from', items: [
    P('Tsoro yematatu is a traditional game of Zimbabwe, played by Shona-speaking people. Tsoro is the Shona word for a game of skill, and yematatu means “of three”. It is played on a triangle drawn in the dirt or cut into a stone, with a bar across the middle, and a few pebbles, seeds or bottle tops for each side.'),
    P('The rules are simple enough to learn in a minute, and the game is a fine small battle of patience: three stones each, seven points, and one empty point to fight over.'),
  ] },
  { title: 'The board', items: [
    P('The classic board has seven points joined by five straight lines: the two long sides of the triangle, the line down the middle, the bar across the middle and the base. A point is where lines meet. Stones stand only on points, and only travel along lines.'),
    D(C({ stones: {} })),
    P('Each side has three stones. Sun plays the amber stones with dark stripes and always goes first. River plays the slate-blue stones with cream stripes.'),
  ] },
  { title: 'Phase one: dropping stones', items: [
    P('The game starts with an empty board. Sun and River take turns dropping one of their stones onto any empty point. Once a stone is dropped it stays until the sliding phase begins.'),
    D(C({ stones: { 0: 1, 4: 2, 2: 1 }, marks: [[5, 'dot'], [6, 'dot'], [3, 'dot'], [1, 'dot']] })),
    P('You do not wait for all the stones to be down before you can win: a line made while dropping wins at once.'),
  ] },
  { title: 'Phase two: sliding', items: [
    P('When a side has dropped all its stones it slides one stone on each turn. A stone moves one step along a line to the point next to it, and only onto an empty point. There is no jumping and no capturing.'),
    D(C({ stones: { 0: 1, 1: 1, 5: 1, 2: 2, 3: 2, 6: 2 }, arrows: [[5, 4]], marks: [[4, 'dot']] })),
    P('You must move on your turn: passing is not allowed. A stone with no empty point next to it cannot move, and if none of your stones can, you lose.'),
  ] },
  { title: 'Winning', items: [
    P('You win by making three of your stones stand in a row on three neighbouring points of one line. On the classic board that is any of the five lines: both sides, the middle line, the bar or the base.'),
    D(C({ stones: { 0: 1, 1: 1, 4: 1, 2: 2, 3: 2, 5: 2 }, line: [0, 1, 4] })),
    P('You also win if it is your opponent’s turn and none of their stones can move, because every point next to them is taken. A side that still has stones to drop can always move while there is an empty point.'),
  ] },
  { title: 'Draws', items: [
    P('If the same position, with the same side to move, appears three times, the game is a draw: both sides can keep going round in circles, and the game says so. Careful play on the classic board tends to end in a draw, so a draw is a respectable result.'),
    P('A game that has gone on for 60 moves each is also a draw.'),
  ] },
  { title: 'Other triangles', items: [
    P('The same rules are played on two larger triangles. Grand has ten points on three bars, with a point on the top, and four stones each. Ten Points is a triangle of ten dots in rows of one, two, three and four, with three stones each.'),
    D({ variant: 'grand', stones: { 0: 1, 4: 2, 5: 1 } }, 300),
    D({ variant: 'tens', stones: { 0: 1, 3: 1, 8: 2 } }, 300),
    P('On a longer line, any three neighbouring points count: on the long edge of Grand, the top three points make a line, and so do the three below them. Everything else, dropping first and then sliding, is exactly as on the classic board.'),
  ] },
  { title: 'In this app', items: [
    P('Tap an empty point to drop a stone. When it is time to slide, tap one of your stones and the points it can reach glow, then tap the point, or drag the stone there. Threat marks (you can switch them off in Settings) put a red ring on a point where the other side would complete a line next turn.'),
    P('Hint suggests a good move and says what it does. Take back undoes your last move and the computer’s reply. Auto Play lets you watch the computer play both sides, with time to think and a pause button. Games are saved when you leave.'),
    P('Where this app simplifies: in some places a line only counts once all stones are down, or the blocked side passes. Here a line wins the moment it is made, and a side with no move loses, the form that is most direct to play on a phone.'),
  ] },
];

export const HOWTO = [
  { title: 'The goal', items: [
    P('Get three of your stones in a row along one of the lines. Sun goes first.'),
    D(C({ stones: { 1: 1, 2: 1, 3: 1, 4: 2, 0: 2 }, line: [1, 2, 3] }), 280),
  ] },
  { title: 'Drop, then slide', items: [
    P('Take turns dropping your three stones on empty points: just tap a point. When all your stones are down, tap a stone, then tap a glowing point next to it to slide it along a line.'),
  ] },
  { title: 'Block and trap', items: [
    P('Watch the other side’s two-in-a-row and put a stone on the third point to block it. If you can leave your opponent with no stone that can move, you win.'),
  ] },
  { title: 'Learn more', items: [
    P('Tap Learn on the main menu for five short hands-on lessons. Use Hint if you are stuck and Take back if you slip. Switch the game to Grand or Ten Points in Settings for a bigger triangle.'),
  ] },
];

export const ABOUT = [
  { title: 'Tsoro Yematatu', items: [
    P('Tsoro yematatu is a traditional game of Zimbabwe, played by Shona-speaking people on a triangle with a bar across it, with a stone or a bottle top for each of three men. It is handed from one player to the next, and is one of the first strategy games a child learns there.'),
    P('The game has no luck and almost no rules, which is why it is a good one: you drop your stones, you slide them, and you try to be the first to make three in a row without leaving yourself blocked.'),
  ] },
  { title: 'What you get', items: [
    P('Three triangles (Classic, Grand and Ten Points), five computer levels from Beginner to Master, two players on one phone, five hands-on lessons, Hint, threat marks, take back, and Auto Play (Watch & Learn).'),
    P('Three boards (granite, soapstone and copper) and two kinds of stone, earned by winning. Large text, reduced motion and sound options. No ads, and it works offline.'),
  ] },
  { title: 'Credits', items: [
    P('Board, stones, sounds and the computer player were made for Arcforge. Titles are set in Cormorant Garamond (SIL Open Font License 1.1).'),
    P('Arcforge: World Heritage Games.'),
  ] },
];

// Lessons: Sun always moves. `placed` = stones already dropped by [Sun, River]. `goal`: { type: 'to', to } (a drop or a slide ends on `to`)
// | { type: 'move', from, to } (that exact slide). `target` rings a point.
export const LESSONS = [
  { title: 'Drop three in a row', variant: 'classic', stones: { 0: 1, 2: 1, 1: 2, 6: 2 }, placed: [2, 2], goal: { type: 'to', to: 5 }, target: 5,
    text: 'Your two stones on the middle line need only the bottom point to make three in a row. Tap the ringed point to drop your last stone there.',
    done: 'Three in a row down the middle: that wins. Lines can be dropped as well as slid.', hint: 'Tap the ringed point at the bottom, the third point of the middle line.' },
  { title: 'Slide into a line', variant: 'classic', stones: { 0: 1, 1: 1, 5: 1, 2: 2, 3: 2, 6: 2 }, placed: [3, 3], goal: { type: 'move', from: 5, to: 4 }, target: 4,
    text: 'All the stones are down. Slide the bottom stone one step left along the base to complete the left side.',
    done: 'A slide closed the line. Look for the empty point and ask which of your stones can reach it.', hint: 'Tap your stone at the bottom middle, then the ringed corner next to it.' },
  { title: 'Block their line', variant: 'classic', stones: { 6: 1, 1: 2, 2: 2 }, placed: [1, 2], goal: { type: 'to', to: 3 }, target: 3,
    text: 'River has two stones on the bar and threatens to drop the third at the right end. Drop yours on that point to block it.',
    done: 'Blocked, and your two stones on the right side now threaten the top. Block first, attack next.', hint: 'Tap the ringed point at the right end of the bar.' },
  { title: 'Trap them', variant: 'classic', stones: { 1: 1, 2: 1, 4: 1, 3: 2, 5: 2, 6: 2 }, placed: [3, 3], goal: { type: 'move', from: 1, to: 0 },
    text: 'There is one empty point, at the top. If you slide into it from the upper left, the point you leave is surrounded by your own stones and River cannot move at all.',
    done: 'Trapped: a side with no move loses. Sometimes you do not need a line.', hint: 'Slide the upper left stone up to the top point.' },
  { title: 'A bigger triangle', variant: 'tens', stones: { 0: 1, 3: 1, 8: 2, 9: 2 }, placed: [2, 2], goal: { type: 'to', to: 1 }, target: 1,
    text: 'On the bigger triangle any three neighbouring points on a line count. Drop between your two stones, on the left side, to fill the gap.',
    done: 'Top, row 2 and row 3 on the left edge: three in a row. The same rules work on any triangle.', hint: 'Tap the ringed point on row 2, the left one.' },
];
