// Text for About, How to Play and the Rules reference. Every rule claim was checked against the engine: sim.js (board,
// physics, arches, scoring), match.js (rounds, pushes, strays, turns, the final count), game.js (flow, flick mapping).
// Numbers: the board is 440 units long and 184 wide; a disc is 24 across; an arch is 40 wide (16 units to spare in all).
// A section is { title, art?, p: [paragraphs] }.

export const ABOUT = [
  { title: 'A table game from the Netherlands', art: 'board', p: [
    'Sjoelen (say "shoo-len") is a Dutch table game. Wooden discs are slid down a long board so they pass through four small arches at the far end, each marked with a number. It is played at home, in cafés, at clubs and in national championships.',
    'The table is called a sjoelbak. A famous perfect count on it is 148, and every Dutch player knows the number.',
  ] },
  { title: 'A game of speed and angle', p: [
    'The arches are only a little wider than a disc. A gentle disc dies short of them; a hard one rebounds off the back board; a sideways shot can be banked off a rail. Discs that stop in the way can be knocked through by the next one.',
    'The numbers are not in order: the two arches in the middle are worth 3 and 4, and the arch on the right is worth only 1. A disc in each of the four arches makes a set worth a bonus, so the best players build sets.',
  ] },
  { title: 'This version', p: [
    'This version has a warm polished board seen from above, with honest sliding physics: friction, rails, posts and disc against disc. The same physics runs for you, the computer rivals and the guide line, so what you see is what happens.',
    'Play one of four computer rivals, share the phone with a friend, chase the perfect 148 alone, or sit back with Watch & Learn and see why a skilled player picks each slide.',
  ] },
  { title: '3D credits', p: [
    'The hand that slides the discs is derived from an avatar of the Microsoft Rocketbox Avatar Library (MIT licence, Copyright (c) 2020 Microsoft; https://github.com/microsoft/Microsoft-Rocketbox). The mesh and skeleton are used as published, the textures were repainted. The full licence text is in vendor3d/LICENSES.md.',
  ] },
  { title: 'About the rules', p: [
    'Sjoelen is played with small local variations. The version here is written out in full on the Rules page, including the parts that are this game\'s own way of playing (the length of a match and how strays are returned).',
  ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'board', p: [
    'Slide discs up the board so they pass through the four arches at the far end. The arches are worth 2, 3, 4 and 1 points, from left to right. One disc in every arch is a set and is worth 20.',
  ] },
  { title: 'Place and flick', art: 'flick', p: [
    'Your next disc waits at your end of the board. Touch the board near your end and drag sideways to put the disc where you want it. Then flick up the board: the faster the flick, the farther the disc slides, and the angle of the flick is the direction.',
    'You can also flick from anywhere on the board. A slow slide is cancelled and the disc stays where it is.',
  ] },
  { title: 'The guide', p: [
    'While your finger moves fast enough to throw, a dotted line shows where the disc will go, including bounces off the rails and knocks against lying discs, and where it will stop. Let go when the line goes through an arch.',
    'The Hint button runs a skilled rival\'s thinking and shows a gold ghost disc, the path and where to place the disc.',
  ] },
  { title: 'Bank shots', art: 'bank', p: [
    'The arches at the sides are hard to reach in a straight line from the middle. Flick at an angle and let the rail bounce the disc in. The rail loses a little speed, so flick a little harder.',
  ] },
  { title: 'Strays', art: 'strays', p: [
    'After your 10 discs, any disc that did not pass through an arch is picked up and slid again, up to three pushes in all. Lying discs are obstacles, and a disc that knocks one through counts for you.',
  ] },
  { title: 'Scoring', art: 'sets', p: [
    'Every complete set (one disc in each arch) scores 20. Every other disc scores the value of its arch. Thirty discs can score at most 148: seven sets and two spare discs in the 4-arch.',
    'On a keyboard: Left and Right move the disc, A and D turn the aim, W and S set the strength, Space slides, H gives a hint, P pauses.',
  ] },
];

export const RULES = [
  { title: 'Goal', art: 'board', p: [
    'Score more points than your rival (or, alone, as many as you can) by sliding discs through the four arches. A match is a Quick match of one round, or a Full match of three rounds.',
  ] },
  { title: 'The board', art: 'arches', p: [
    'The board has two side rails, a back board, and four arches at the far end separated by three posts. Counted from the left the arches are worth 2, 3, 4 and 1 points.',
    'Discs are round, 24 units across (the board is 440 units long); an arch is 40 units wide, so a disc has room to spare but not much.',
  ] },
  { title: 'A round', p: [
    'A round is ten discs, slid one at a time from your end of the board. You choose where each disc starts along your end and slide it with a flick. Discs that stop on the board stay there while the round goes on, so they can be hit by the next disc.',
    'In a two-sided match the sides take rounds in turn: a round for the first side, then a round for the second, then the second round for the first side, and so on.',
  ] },
  { title: 'Passing an arch', p: [
    'A disc counts as passed when its middle crosses the arch line inside an arch. A passed disc stays in that arch for the rest of the match. A disc that only touches the line without its middle crossing it has not passed. A disc knocked across the line by another disc counts for the side that is sliding.',
  ] },
  { title: 'Strays', art: 'strays', p: [
    'When the ten discs of a round have been slid, every disc still on the board is picked up and slid again as a new push. After the third push (the first ten, then up to two more), any disc still on the board is out and does not score.',
  ] },
  { title: 'Counting', art: 'sets', p: [
    'Count the discs in each arch. Each set (one disc in every arch) scores 20 points. The discs left over score their arch\'s value: 2, 3, 4 or 1. Example: 8, 7, 9 and 6 discs in the arches make 6 sets (120), with 2 spare discs in the 2-arch (4), 1 in the 3-arch (3) and 3 in the 4-arch (12): 139 in all.',
    'With 30 discs the most that can be scored is 148: seven sets (140) and two spare discs in the 4-arch (8).',
  ] },
  { title: 'Winning', p: [
    'After the last round the sides compare counts. The higher count wins; equal counts are a draw. In a Solo Run your count is compared with your best.',
  ] },
  { title: 'Physics', art: 'bank', p: [
    'Discs slow down by friction and stop. They rebound off the rails (losing a little speed), bounce off the posts and the back board, and knock against each other like billiard balls. Nothing is random: the same slide on the same board always does the same thing.',
    'The flick sets the speed and direction. The direction is softened, so a small wobble of your finger makes a small change to the path.',
  ] },
  { title: 'Rivals, Hint and Watch & Learn', p: [
    'The computer rivals work out their slides with the same physics, then slide with a little human unsteadiness: Anneke is gentle, Joost is quick, Marit banks off the rails and Meester Wim hardly misses.',
    'Hint shows what a skilled player would do. Watch & Learn lets two rivals play a match with a thinking time you can change, a reveal of the chosen slide, and a Pause that freezes everything.',
  ] },
  { title: 'Simplified in this version', p: [
    'Real tables count the discs at the end of the whole turn and some clubs agree small house rules. Here the counts are kept per arch through the match and strays are returned after each round of ten. The arches are slightly wider than a real sjoelbak\'s so a phone flick can reach them.',
  ] },
];
