// Text for About, How to Play and the Rules reference. Every rule claim below was checked against the engine:
// sim.js (ball speed, friction, rails, bumpers, sand, slopes, boost, water, bridges, tunnels, windmills, gates, the cup),
// courses.js (eighteen holes, par), game.js (stroke counting, the seven-stroke cap, order of play, honors, penalty,
// scoring, saving, the demo cap) and ai.js (the four rivals, Think). Numbers: the cap is 7 strokes; water costs 1 stroke;
// a ball drops only if it is slower than about 7.4 course units per second at the cup.
// A section is { title, art?, p: [paragraphs] }; the reader lays the text out so nothing overflows at any text size.

export const ABOUT = [
  { title: 'Golf with a short club', art: 'dunes-1', p: [
    'Mini Golf Links Putt is a game of putting. You pull back, let go, and the ball rolls across a small course of felt, timber and stone towards a cup. Fewer strokes win.',
    'It is easy to start and hard to master: rails bounce the ball, slopes bend it, sand holds it, water costs a stroke, and on the last course the windmills do not wait for you.',
  ] },
  { title: 'Where it comes from', p: [
    'Golf is recorded in Scotland from the 1400s, played over the sandy ground beside the sea that Scots call links. Its short cousin, putting for fun on a small course with obstacles, grew out of the same love of the game and has been a seaside pastime ever since.',
    'The three courses here are named after that kind of country: dunes with heather and hedges, a harbour of stone quays and tide pools, and a green with windmills.',
  ] },
  { title: 'This version', p: [
    'Every putt is simulated with real rolling friction, bouncing rails and moving parts. There is no luck in the roll: the same putt from the same spot at the same moment always ends the same way.',
    'You can play against one of four computer golfers, share the phone with a friend, play alone to beat your best, or sit back with Watch & Learn and see why a good player picks each shot. Think is always one tap away.',
  ] },
  { title: 'Courses', p: [
    'Heather Dunes: six gentle holes with hedges, sand and slopes. Harbour Rocks: six holes of stone, bumpers, water and tunnels. Windmill Green: six holes with windmills and sliding gates. The Grand Round plays all eighteen.',
  ] },
  { title: 'About the rules', p: [
    'The game follows the usual idea of stroke play: the lowest total wins. Where it differs from a rule book, the Rules pages say so. They are written out in full and match how the game really plays.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'dunes-1', p: [
    'Get the ball into the cup in as few strokes as you can. Every hole shows its par, the number of strokes a good player needs. Play a hole, then the next, and add up your strokes at the end.',
  ] },
  { title: 'Pull back, let go', art: 'aim', p: [
    'Put a finger anywhere on the course and drag away from where you want the ball to go, like a slingshot. The ball rolls the opposite way. The farther you pull, the harder the putt: the ring around the ball and the percentage show your power.',
    'A dotted line shows where the ball will go. Let go to putt. If you pull back only a tiny way and let go, nothing happens, so you can always cancel.',
  ] },
  { title: 'The aim guide', p: [
    'In Settings and the pause menu the guide can show the full path, only the path up to the first bounce, or nothing. Moving rails and windmills are not shown in the guide, because they move while you aim.',
    'If you like to aim carefully, turn on Aim then Putt in Settings: letting go then keeps the aim, and you press Putt when ready.',
  ] },
  { title: 'Rails and bumpers', art: 'harbour-4', p: [
    'The ball bounces off rails: timber is lively, stone a little less, hedges almost not at all. Round red bumpers kick the ball back out, a little faster than it came in. Bank shots, bouncing off a rail on the way to the cup, are how you reach hard holes.',
  ] },
  { title: 'Sand and slopes', art: 'dunes-5', p: [
    'Sand slows the ball a lot, so putt firmer to cross it. The moving chevrons on a slope show which way it pushes: a hill pushes the ball away from its top, a bowl pulls it towards the middle. Aim a little against the slope to hold your line. Orange boost pads speed the ball up.',
  ] },
  { title: 'Water and bridges', art: 'dunes-6', p: [
    'Blue water swallows the ball. You add one stroke, and the ball goes back to where you putted from. Wooden bridges are safe to roll over.',
  ] },
  { title: 'Tunnels', art: 'harbour-5', p: [
    'A pair of round tunnel mouths joins two parts of a hole. Roll into one and the ball comes out of the other, travelling the way the arrow in that mouth points.',
  ] },
  { title: 'Windmills and gates', art: 'mill-1', p: [
    'Windmill blades and sliding gates keep moving. The ball bounces off them, and a moving blade can give it a push. Wait for the way to open, then putt. There is no pause in the movement: the timing is the skill.',
  ] },
  { title: 'Think', p: [
    'Think sets the aim and power for a strong putt and says why: a straight line, a bank shot, a ride on a slope, a tunnel. You can change anything before you putt. On holes with moving parts, watch them and release when the way is clear.',
  ] },
  { title: 'Watch & Learn', p: [
    'Two computer golfers play three holes. Each one thinks first, then shows its plan and explains it, then putts. Pause freezes everything exactly where it is, and Think − and Think + change how long they think.',
  ] },
  { title: 'Keys', p: [
    'On a keyboard: Left and Right turn the aim (hold Shift for fine steps), Up and Down change the power, Space or Enter putts, H is Think, P pauses, plus and minus change the text size.',
  ] },
  { title: 'Saving a round', p: [
    'The game saves your round at the start of every hole. If you close the app, Continue on the main menu brings you back to the start of that hole, paused. Watch & Learn is not saved. Starting a new round replaces the saved one.',
  ] },
];

export const RULES = [
  { title: 'Winning', p: [
    'Stroke play. Every putt counts one stroke. After the last hole each player adds up all their strokes, and the lowest total wins. Equal totals tie. In a round with computer golfers the result screen shows everyone\'s total and how it compares with par.',
  ] },
  { title: 'Holes and par', art: 'dunes-1', p: [
    'A round is the six holes of one course or the eighteen holes of the Grand Round. Each hole has a par: Hole in one means one stroke on a hole with a par above 1. Two under par is an eagle, one under a birdie, equal to par is par, one over a bogey, two over a double bogey.',
    'Pars: Heather Dunes 2, 3, 2, 3, 3, 3. Harbour Rocks 2, 5, 3, 3, 3, 4. Windmill Green 2, 3, 3, 3, 4, 4.',
  ] },
  { title: 'Order of play', p: [
    'On the tee the order is the honors order: the player with the lowest score on the last hole putts first, ties keep their earlier order, and the first hole starts with the first player. After the first putts, the player whose ball is farthest from the cup putts next. Distance is measured along the course around walls and water, not in a straight line, so a ball behind a wall counts as far away.',
    'Balls do not touch each other. Everyone\'s ball can sit on the course at the same time and nothing blocks anything else.',
  ] },
  { title: 'The putt', art: 'aim', p: [
    'Drag away from the direction you want to go and let go. The ball sets off in the opposite direction. Power is the length of the drag: a short pull is a soft tap, a full pull is the hardest putt. Pulling less than a small distance cancels the putt.',
    'The power ring and percentage show the power. At 100% the ball leaves at the highest speed of the game; it would roll about sixty-five course units on flat felt, far more than any hole is long.',
  ] },
  { title: 'Rolling', p: [
    'On felt the ball slows steadily and stops when it is almost still, unless a slope keeps it moving. A ball may take up to thirty seconds to come to rest at most, after which it is stopped where it is.',
    'You may not putt while a ball is moving. The next player\'s turn begins when the ball has come to rest, dropped in the cup or gone into water.',
  ] },
  { title: 'Rails, hedges and islands', art: 'harbour-3', p: [
    'Rails, free-standing walls and islands are solid. The ball bounces off them and loses some speed on each bounce: timber keeps about two thirds of its speed, stone about three quarters, hedges about a third. Slow touches do not bounce, they just stop against the wall.',
    'Free-standing walls and islands cannot be crossed.',
  ] },
  { title: 'Bumpers', art: 'harbour-4', p: [
    'A round red bumper returns the ball at the same speed it hit with, and never slower than a brisk roll, so a slow ball is kicked out. Round stone posts are solid like walls.',
  ] },
  { title: 'Sand', art: 'dunes-3', p: [
    'Sand slows the ball about five times as fast as felt. A soft putt will stop in the sand; use more power.',
  ] },
  { title: 'Slopes and boost pads', art: 'dunes-5', p: [
    'A slope pushes the ball in the direction of its chevrons while the ball is on it; the steeper, the stronger. A hill pushes the ball away from its top and a bowl pulls it towards its middle. The push is gentle enough that a ball rolling hard still crosses a slope, but it will bend its path. A ball resting on a very steep slope rolls away again.',
    'A boost pad speeds the ball up along its arrows while the ball is on it. No ball can travel faster than about one and a third times the full-power speed.',
  ] },
  { title: 'Water and bridges', art: 'dunes-6', p: [
    'If the middle of the ball is over water it falls in. You add one penalty stroke, and the ball is put back where you hit it from, with its original stroke already counted. So a putt that ends in water costs two strokes in all.',
    'A bridge is safe: a ball over a bridge does not fall in, even though it is over water.',
  ] },
  { title: 'Tunnels', art: 'harbour-5', p: [
    'A tunnel has two mouths. A ball whose middle touches one mouth leaves from the other, set just outside it and travelling the way the arrow in that mouth points. It keeps most of its speed, never slower than a gentle roll. It cannot go back in for a moment, so it cannot loop at once.',
  ] },
  { title: 'Windmills and gates', art: 'mill-1', p: [
    'Windmill blades and sliding gates are solid and always moving. A blade that hits the ball adds its own speed to the bounce. Their timing is fixed: the same putt at the same moment always has the same result. The aim guide does not show them.',
  ] },
  { title: 'The cup', art: 'dunes-1', p: [
    'The ball drops if it reaches the cup moving slower than about a fast walking pace (7.4 course units a second). The cup pulls a slow ball towards its middle, so a gentle putt that touches the edge may still fall in.',
    'A ball that arrives a little too fast clips the rim and is turned aside (a lip-out). A ball that is much too fast rolls straight over the hole.',
  ] },
  { title: 'The stroke limit', p: [
    'A hole is capped at seven strokes. If your ball is not in the cup after your seventh stroke (a water penalty counts as a stroke), the ball is picked up and the hole is scored as seven.',
  ] },
  { title: 'The computer golfers', p: [
    'Rookie, Clubhouse, Club Pro and Champion differ in how many putts they try before choosing, how many bounces they dare to rely on (none, one, one, two), how carefully they check that a shot is safe, and how steady their stroke is. The better they are, the straighter and more even their putts. The Full field option plays you against Clubhouse, Club Pro and Champion together.',
    'Think uses the strongest search with a perfect stroke: it shows what an expert would try.',
  ] },
  { title: 'Free preview', p: [
    'The free preview gives ninety seconds of real play. Menus, these pages and Watch & Learn never use that time. In the web demo, only the first three holes of Heather Dunes are available.',
  ] },
];
