// Text for About, How to Play and the Rules reference. Every rule claim below was checked against the engine:
// sim.js (ring and arena geometry, flight, collisions, what counts as out, capture), match.js (turns, bonus shot, rounds, tie)
// and game.js (flow). Numbers: 13 marbles = 1 king (3 points), 4 glass (2 points), 8 clay (1 point): 19 points per round;
// a capture is worth 2. A section is { title, art?, p: [paragraphs] }; the reader flows the lines so nothing ever overflows.

export const ABOUT = [
  { title: 'A game from every playground', art: 'ring', p: [
    'Children in almost every part of the world have drawn a ring in the dirt and shot marbles at the ones inside it. It is called kancha in South Asia, kelereng in Indonesia and the Philippines, and goes by many other names, from billes to canicas to marbles.',
    'The idea has hardly changed in centuries: knock the marbles out of the ring with a flick of your shooter, and keep your shooter out of trouble.',
  ] },
  { title: 'A game of two halves', p: [
    'Half of it is aim: the straight hit, the thin cut that sends a marble sideways, the hard break that scatters the middle. The other half is where your shooter stops. Leave it safe outside the ring, or sitting in the middle where a rival can knock it out for a capture.',
  ] },
  { title: 'This version', p: [
    'Ring and Shoot simulates every marble with real rolling and real collisions: clay, glass and the golden king. Pull back and let go to flick your shooter, and watch the swirl in each marble roll as it travels.',
    'Play against one of five rivals, share the phone with a friend, or sit back with Watch & Learn and see why a skilled player chooses what they choose. A Hint is there whenever you want help.',
  ] },
  { title: 'About the rules', p: [
    'The game uses the common ring-game rules, written out in full on the Rules pages. It is a game of skill and points only: nothing is ever won or lost except points inside the game.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'ring', p: [
    'Thirteen marbles sit in the middle of a ring. Take turns flicking your shooter at them. Every marble that ends up outside the ring is yours, and each is worth points. When the ring is empty the round is over and the higher total wins.',
  ] },
  { title: 'Pull back and let go', art: 'shot', p: [
    'Press anywhere on the dirt and drag back, like pulling a slingshot. Let go to flick your shooter.',
    'The direction you pull from sets the aim: pull straight down to shoot straight up. How far you pull sets the power. A very short pull cancels.',
    'The dotted line shows the shooter\'s path up to the first marble it will touch, and a short golden line shows where that marble will go.',
  ] },
  { title: 'Placing your shooter', art: 'place', p: [
    'At the start of a round, and whenever your shooter has rolled off the dirt, it is in hand: it glows on the shooting line, the dotted circle around the ring. Tap anywhere on the line to put it there, then pull back to shoot.',
    'Otherwise you shoot from wherever your shooter stopped last time, so think about where you will leave it.',
  ] },
  { title: 'Marbles and points', art: 'values', p: [
    'Clay marbles are worth 1, glass marbles 2 and the golden king in the middle 3. A round has 19 points on the table.',
  ] },
  { title: 'Bonus shot and capture', art: 'capture', p: [
    'Knock two or more marbles out with one shot and you shoot again.',
    'If a rival\'s shooter is sitting inside the ring and your shot knocks it out, you capture it for 2 points, and it goes back to the line.',
  ] },
  { title: 'Hint, Pause and Watch & Learn', p: [
    'Hint shows the shot a strong player would take. Menu pauses the game and opens the rules. Watch & Learn plays a whole round between two rivals, with their thinking time on screen: use Pause and Think + / Think − to slow it down.',
  ] },
];

export const RULES = [
  { title: '1. The set-up', art: 'ring', p: [
    'The playing surface is a round patch of dirt. A ring is scratched into it, and a dotted shooting line runs around the outside of the ring.',
    'Thirteen marbles start inside the ring in a cross: the golden king in the centre and four arms of three marbles. The middle marble of each arm is glass; the rest are clay.',
    'Each player has one shooter, a larger marble in their own colour. At the start of a round both shooters are in hand.',
  ] },
  { title: '2. Points', art: 'values', p: [
    'King: 3 points. Glass marble: 2 points. Clay marble: 1 point. That makes 19 points on the table at the start of every round.',
    'A capture (section 7) is worth 2 points.',
  ] },
  { title: '3. Turns', p: [
    'Players take turns, one shot each. The player who shoots first alternates from round to round.',
    'If your shot knocks two or more marbles out of the ring you shoot again (section 6). Otherwise the turn passes to the other player.',
  ] },
  { title: '4. Taking a shot', art: 'shot', p: [
    'Press anywhere on the dirt, drag away from the direction you want to go, and let go. The pull direction is the opposite of the flick and the pull length sets the power. A pull shorter than a thumb-width is cancelled and the shot is not taken.',
    'The shooter rolls and slows down by itself. Marbles bounce off each other almost perfectly, so a hit passes most of its speed to the marble it strikes, and a glancing hit sends both marbles off at an angle.',
    'With Calm mode on (Settings) the whole path is shown, not only the way to the first marble.',
  ] },
  { title: '5. Where the shooter starts', art: 'place', p: [
    'A shooter that is in hand can be placed anywhere on the shooting line by tapping the line. A spot is refused if another marble is in the way.',
    'A shooter that is not in hand is played where it lies. It stays where it stopped after your last shot, even inside the ring.',
    'A shooter that rolls off the dirt is put back on the shooting line, near where it left, and is in hand again. Your turn ends.',
  ] },
  { title: '6. What counts as out', art: 'out', p: [
    'When everything has stopped, any marble whose centre is beyond the ring line is out and is yours (it scores for the player who just shot, whoever struck it). A marble that rolls off the dirt is out too.',
    'A marble that stops on the line with its centre still inside the ring stays in.',
    'If one shot puts two or more marbles out, you earn a bonus shot, unless your own shooter rolled off the dirt.',
  ] },
  { title: '7. Capture', art: 'capture', p: [
    'If a rival\'s shooter is inside the ring when you start your shot, and when everything stops it is outside the ring or off the dirt, you capture it: 2 points. It goes back to the shooting line, in hand.',
    'So a shooter left inside the ring is close to the marbles but can be captured.',
  ] },
  { title: '8. Rounds and winning', art: 'rounds', p: [
    'A round ends when no marbles are left in the ring. The points each player collected, with any captures, are added to the match score.',
    'A Quick match is one round, a Full match is three. If the match is tied after the last round, one more round is played.',
  ] },
  { title: '9. Watch & Learn, hints and free preview', p: [
    'Watch & Learn plays a full round between two rivals. Each shot has a thinking pause, a reveal that shows the planned path, and then the flick. You can pause at any moment and change the thinking time.',
    'The Hint button shows the best shot it can find from the current position.',
    'The web demo includes the first rounds only. The full game has every rival and unlimited play.',
  ] },
];
