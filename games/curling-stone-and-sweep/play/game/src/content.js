// Text for About, How to Play and the Rules reference. Every rule claim below was checked against the engine:
// sim.js (sheet geometry, friction, curl, sweeping, collisions, out of play, house), match.js (formats, throwing order,
// last stone, free guard zone, hog line, scoring, extra ends), noise.js (the small wobble of each delivery), ai.js
// (the five rivals), game.js (flow, Think, Watch & Learn, saving). Numbers: sheet 4.75 m wide, house 12-foot ring
// radius 1.83 m, 8-foot 1.22 m, 4-foot 0.61 m, button 0.15 m, stone 0.29 m across, hog line 6.4 m before the tee line.
// A section is { title, art?, p: [paragraphs] }; the reader paginates the lines so nothing overflows at any text size.

export const ABOUT = [
  { title: 'A game of ice and patience', art: 'sheet', p: [
    'Curling is played on a long sheet of pebbled ice. Two sides take turns to slide heavy granite stones towards a target of rings at the far end, and the side with the stone closest to the middle scores.',
    'It looks calm, and it is full of decisions: a stone can stay out in front as a guard, tuck in behind one, or be thrown hard to knock another away.',
  ] },
  { title: 'Where it comes from', p: [
    'Curling is recorded in Scotland from the 1500s. Scottish settlers carried the game overseas, and curling clubs appeared in Canada in the early 1800s, the first of them in Montreal in 1807. Today it is played in many countries, in clubs and on community rinks.',
  ] },
  { title: 'This version', p: [
    'Stone and Sweep simulates every stone with real friction, curl and collisions. You choose where the stone should stop and how hard to throw, and then you take part in the slide: rubbing the ice sweeps it, which carries the stone further and keeps it straighter.',
    'There are no players drawn on screen. You see the stones, the brushes and the ice.',
  ] },
  { title: 'Ways to play', p: [
    'Play against one of five computer rivals, share the phone with a friend, learn the shots in short hands-on lessons, or sit back with Watch & Learn and see why a skilled side chooses what it does. Think is always one tap away.',
  ] },
  { title: 'About the rules', p: [
    'Stone and Sweep follows the usual rules of curling in simplified form, written out in full on the Rules pages: guards, the last stone, the free guard zone, the hog line and counting. Where the game differs from a rule book, the Rules pages say so.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'sheet', p: [
    'Slide your stones so they finish closer to the middle of the rings (the button) than the other side\'s stones. After all the stones are thrown, the side with the closest stone scores one point for each of its stones that is closer than anything the other side has.',
  ] },
  { title: 'Put the broom where the stone should stop', art: 'house', p: [
    'Drag a finger on the ice. The broom marker follows, a little above your finger so you can see it. It shows where you want the stone to come to rest.',
    'A dotted line shows the path the stone will take, and a ghost stone shows where it will stop or first touch something.',
  ] },
  { title: 'Choose a weight and a turn', art: 'curl', p: [
    'Weight: Draw stops on the broom. Tap arrives gently and nudges what it touches. Takeout arrives firmly to knock a stone away. Peel is hard, to sweep stones out.',
    'Turn: a stone spins as it slides, and that makes it curl. In-turn curls to the right, out-turn to the left (swap them in Settings if you throw left-handed). The same spot can be reached with either turn, with a different path: that is how you get around a guard.',
  ] },
  { title: 'Throw, then sweep', art: 'sweep', p: [
    'Press Throw. While the stone slides, rub the ice with your finger, side to side as fast as you can. Two brush heads work in front of the stone and the Sweep meter shows your effort.',
    'Sweeping makes the stone slide further and curl less. Sweep when a stone is going to be short, and ease off when it is on target. If you prefer, Settings has a hold-to-sweep option.',
  ] },
  { title: 'Think and the guide', p: [
    'Think shows a strong shot for the position, sets the broom, weight and turn for you, and tells you why. You can change anything before you throw.',
    'In Settings and the pause menu, the Aim guide can show the path to the first touch, the full result, or nothing.',
  ] },
  { title: 'Ends and the last stone', art: 'hammer', p: [
    'A game is played in ends. Each side throws its stones in turn, and then the end is counted. The side that scores gives up the last stone for the next end.',
    'Having the last stone is an advantage: your final stone can be the one that decides the end.',
  ] },
  { title: 'Learn', p: [
    'Learn has short lessons on the real ice: a draw, a guard, curling around a guard, sweeping, a takeout and taking out and staying. Three quick questions cover counting, the free guard rule and the last stone. Show me sets a lesson up for you.',
  ] },
  { title: 'Watch & Learn', p: [
    'Two computer players play one end. Each one thinks first, then shows its plan and explains it, then throws and sweeps. Pause freezes everything exactly where it is, and Think − and Think + change how long they think.',
  ] },
  { title: 'Saving a match', p: [
    'The game saves your match each time a stone comes to rest and a new throw is about to start. If you close the app, Continue match on the main menu brings you back to the start of that throw, paused. Watch & Learn and lessons are not saved. Starting a new match replaces the saved one.',
  ] },
  { title: 'Keyboard', p: [
    'Arrow keys move the broom. W changes the weight, Q or E switches the turn, H is Think, Space or Enter throws, P pauses. While a stone slides, hold Space or S to sweep.',
  ] },
];

export const RULES = [
  { title: 'The sheet', art: 'sheet', p: [
    'The ice is 4.75 m wide. At the far end are the rings. A stone is thrown from the near end and released at the near hog line.',
    'The far hog line is 6.4 m before the tee line. The tee line runs across the middle of the rings. The back line is 1.83 m beyond the tee line, level with the back edge of the rings.',
  ] },
  { title: 'The house', art: 'house', p: [
    'The house is made of rings around the button: the 4-foot (red), the 8-foot (white) and the 12-foot (blue). The 12-foot ring is 1.83 m in radius, the 8-foot 1.22 m, the 4-foot 0.61 m, and the button 0.15 m.',
    'A stone is in the house if any part of it touches the 12-foot ring.',
  ] },
  { title: 'The stones', art: 'stones', p: [
    'Each side has its own colour: red or yellow. Every stone is 0.29 m across and the same weight. The handle turns as the stone turns, so you can see its spin.',
  ] },
  { title: 'Formats and ends', art: 'hammer', p: [
    'Short: each side throws 4 stones per end. Standard: 8 stones each. Doubles: 5 stones each, and each end starts with two stones already in place.',
    'You choose 2, 4 or 6 ends. After the last end, the side with more points wins. If the scores are level, extra ends are played until one side leads.',
  ] },
  { title: 'Doubles placed stones', art: 'guard', p: [
    'In Doubles, the side that does not have the last stone starts each end with a stone on the centre line in front of the house (3.7 m short of the tee line). The side that has the last stone starts with a stone on the centre line just behind the button (0.45 m past the tee line).',
    'These two stones count for scoring like any others and are not counted among the thrown stones.',
  ] },
  { title: 'Throwing order and the last stone', art: 'hammer', p: [
    'The side without the last stone throws first and the sides alternate. The side with the last stone throws the final stone of the end.',
    'In the first end, who has the last stone is chosen at random. After an end, the side that scored gives up the last stone for the next end. If nobody scores (a blank end), the last stone stays with the side that had it.',
    'In a rematch the first end\'s last stone goes to the other side.',
  ] },
  { title: 'Weight and the broom', art: 'takeout', p: [
    'The broom is where you want the stone to be. The weight sets how fast the stone is moving when it gets there: Draw 0 (it stops there), Tap 0.9 m/s, Takeout 1.8 m/s, Peel 2.8 m/s.',
    'The game works out the release speed and direction for you for perfect ice. A shot that would need more than the fastest possible throw (5.2 m/s) is not available and its button is greyed.',
  ] },
  { title: 'Spin and curl', art: 'curl', p: [
    'Every stone is thrown with spin. A spinning stone curls: in-turn curls to the right of its direction of travel and out-turn to the left. A left-handed player sees them swapped.',
    'Curl bends the path sideways by roughly one metre over a draw, much less on a hard throw. The guide line already includes it.',
  ] },
  { title: 'A little unevenness', p: [
    'No delivery is perfect. Your throw wobbles by a small amount in speed and direction (under 1% in speed), and every stone meets slightly different ice: its friction differs by about 1% and its curl by up to 7%.',
    'That is what sweeping is for. The computer players wobble more or less depending on their level.',
  ] },
  { title: 'Sweeping', art: 'sweep', p: [
    'Sweeping warms the ice in front of a moving stone. A fully swept stone has 12% less friction (a draw can go about 3.5 m further) and 70% less curl. Less sweeping gives in-between amounts.',
    'You can sweep any of your own stones while they move, including a stone that was set moving by a hit. You cannot sweep the other side\'s stones.',
  ] },
  { title: 'Hitting stones', art: 'takeout', p: [
    'When two stones touch they bounce apart. A moving stone hitting a still one passes most of its speed to it and often stops close by (hit and stay). A glancing hit sends both stones away at angles. Stones can pick up spin from a hit.',
  ] },
  { title: 'Freeze and tap', art: 'freeze', p: [
    'A freeze is a draw that stops touching another stone so that it is hard to remove. A tap is a light hit that moves a stone only a little. Both are ordinary shots; the game has no special rule for them.',
  ] },
  { title: 'Out of play', art: 'out', p: [
    'A stone that touches a side line is out of play at once. A stone that goes completely past the back line is out of play at once. Out stones stay out for the rest of the end.',
  ] },
  { title: 'The hog line', art: 'hog', p: [
    'When everything has stopped, any stone that is not completely past the far hog line is removed. This applies to a thrown stone that is too light and to any stone that was knocked back short of the line.',
  ] },
  { title: 'The free guard zone', art: 'guard', p: [
    'The free guard zone is the area between the far hog line and the tee line, outside the house.',
    'While the first stones of an end are being thrown (the first 2 in Short, the first 4 in Standard and Doubles), a stone may not knock the other side\'s stones out of play from this zone. If it does, the thrown stone is removed and every stone is put back where it was.',
    'Moving a guard within the ice, into the house, or hitting it back onto the ice is allowed.',
  ] },
  { title: 'Counting an end', art: 'count', p: [
    'When all the stones have been thrown, the side with the stone closest to the button scores. It scores one point for every one of its stones that is in the house and closer than the closest stone of the other side.',
    'Only stones in the house count. If no stone is in the house, nobody scores: a blank end.',
    'Stones are measured from the button to the centre of the stone. A point scored by the side without the last stone is called a steal.',
  ] },
  { title: 'The computer players', p: [
    'Each rival looks at many possible shots (draws, guards, freezes, taps, takeouts and peels, with both turns), tries them on a hidden copy of the ice, and picks the best. Stronger rivals have a steadier delivery, sweep better, look at more ideas, and understand more of the strategy: guards, the last stone, and protecting their closest stone. The strongest also looks at the best reply.',
    'Each rival beats the one below it more often than not; this was checked by playing thousands of ends between them.',
    'Think uses the strongest rival\'s thinking for you.',
  ] },
  { title: 'Preview and unlocking', p: [
    'The first 90 seconds of real play are free. Menus, these pages, Learn, settings and Watch & Learn never use up the free time, and a paused match does not either.',
  ] },
];
