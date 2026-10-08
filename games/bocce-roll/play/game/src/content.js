// Text for About, How to Play and the Rules reference. Every rule below was checked against the engine:
// sim.js (court, throws, bounces), match.js (turn order, pallino, scoring), game.js (flow). Numbers are in metres.
// A section is { title, art?, p: [paragraphs] }; the reader flows every section into one scrolling page.

export const ABOUT = [
  { title: 'Bocce', art: 'balls', p: [
    'Bocce is the Italian game of rolling heavy balls towards a small target ball, the pallino. Two sides take turns to finish closest to it, and the closer side scores.',
    'Games of rolling or throwing balls at a mark are very old, and bocce as it is played today is Italian at heart: in village squares, beside the sea, and in the clubs called bocciofile where friends meet at dusk.',
  ] },
  { title: 'A game for everyone', p: [
    'Anyone can enjoy it. A good roll is a gentle thing, and the cleverest players win by reading the court, using the rails, and knowing when to knock a rival away.',
  ] },
  { title: 'The court is part of the game', p: [
    'A bocce court has wooden rails along both sides and a wall at the far end, and they are in play. A ball can bank off a rail, a hard hit can rebound off the back wall, and each kind of court surface rolls differently.',
  ] },
  { title: 'This version', p: [
    'Bocce Roll simulates every throw, bounce and collision on a lit court with reflective balls. You play against one of six rivals, from a gentle beginner to a master, with a partner against a pair, against a friend on the same phone, or through a small cup tournament, or you can sit back and watch two rivals in Watch & Learn.',
  ] },
  { title: 'Pallino', p: [
    'The word pallino means little ball. Aim for it, and do not be afraid to move it.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'balls', p: [
    'Each side has four balls: red (Rosso) and green (Verde), or blue and orange if you switch the colours in Settings. Roll them so they finish closer to the little yellow pallino than the other side\'s balls. When all eight balls are thrown, the side with the closest ball scores.',
  ] },
  { title: 'Throw like a slingshot', art: 'pull', p: [
    'Press on the lower part of the court, where you want to stand along the foul line, and drag back, like pulling a slingshot. Let go to throw.',
    'How far you pull sets the power. Which way you pull sets the direction: pull down and to the left to throw up and to the right. A very short pull cancels the throw.',
    'A dotted line shows your direction. The ball waits on the foul line where you pressed.',
  ] },
  { title: 'Choose your throw', art: 'types', p: [
    'Roll bowls the ball along the floor. It is the classic way to place a ball.',
    'Lob throws the ball through the air so it drops and stops soon after it lands. Use it to jump over rivals or to land softly beside the pallino.',
    'Hit is a fast, low throw for knocking rival balls or the pallino away.',
  ] },
  { title: 'Curve', art: 'curve', p: [
    'Use the arrows on the curve control to put spin on the ball. A curved ball bends as it slows down, so you can go around a rival or swing in beside the pallino. Strong curve bends twice as much.',
  ] },
  { title: 'Who plays next', art: 'order', p: [
    'The side whose ball is NOT closest plays, and keeps playing until it takes the lead or runs out of balls. The yellow marker shows who is closest.',
  ] },
  { title: 'Scoring', art: 'score', p: [
    'After the last ball, the side with the closest ball scores one point for each of its balls that is closer to the pallino than the other side\'s closest ball. First to 12 points wins; the quick game is to 7.',
  ] },
  { title: 'Hint, Calm mode and Watch & Learn', p: [
    'Hint suggests a good throw and sets it up for you. Calm mode shows the whole path of your throw before you let go. Hold a finger on the screen while the balls roll to fast-forward. In Settings you can switch the ball colours to blue and orange.',
    'Watch & Learn plays a whole match between two rivals. They think first, then show the throw they chose, then play it. You can pause at any moment and change how long they think.',
  ] },
];

export const RULES = [
  { title: '1. The court', art: 'court', p: [
    'Real bocce courts are about 26 m long and 4 m wide. This court is scaled to 18 m by 3.4 m so every ball stays easy to see. It has wooden rails along both sides, a wall at the far end and a wall behind the thrower.',
    'The foul line is 3 m from the near end. Every ball and the pallino are thrown from the foul line; the line you throw from is the spot where you pressed, so you can stand anywhere along it. The centre line is 9 m from the near end.',
  ] },
  { title: '2. The balls', art: 'balls', p: [
    'Each side has four balls (Rosso is red, Verde is green) and there is one pallino, the small yellow target ball. Balls are heavy, the pallino is light, so a ball that hits the pallino sends it away fast.',
  ] },
  { title: '3. Starting a frame', p: [
    'A match is played in frames. A coin toss decides which side throws the pallino in the first frame. The pallino is thrown first, from behind the foul line, with a roll or a lob.',
    'A pallino throw is good if the pallino passes the centre line, stays inside the court, and does not touch the back wall before anything else touches it. If it is not good, the other side throws it. If that throw is not good either, the pallino is placed on the centre line, 3.5 m beyond it.',
    'The side that threw the pallino also throws the first ball.',
  ] },
  { title: '4. Who plays next', art: 'order', p: [
    'After each ball, the side whose closest ball is farther from the pallino (the side that is "out") plays next, and keeps playing until it takes the lead or has no balls left.',
    'If the closest balls of both sides are equally far, the side that threw last throws again. If no ball is left in play, the side that threw last throws again.',
    'When one side has thrown all four balls, the other side throws the rest of its balls.',
  ] },
  { title: '5. The three throws', art: 'types', p: [
    'Roll: the ball is bowled along the floor. The pull sets its speed; with no pull to full pull it runs from about one metre to nearly the back wall on the Oyster Shell court.',
    'Lob: the ball is thrown high and lands between about 3 m and 15 m beyond the foul line, depending on the pull. When it lands it digs in and runs only a little way.',
    'Hit: a fast, low throw that skips along the court. It is meant for hitting. A hit ball keeps going after it lands.',
    'The curve control puts spin on the ball: 0, 1 or 2 steps to the left or right. A curved ball bends more and more as it slows.',
  ] },
  { title: '6. The rails and the walls', art: 'rails', p: [
    'The side rails and both end walls are in play. A ball that hits a rail rebounds and keeps rolling, losing some speed.',
    'A ball that touches the back wall without first touching another ball or the pallino is dead: it is taken off the court. A ball that has touched another ball may rebound off the back wall and stays alive.',
    'A ball that leaves the court over a rail or the back wall is dead. A ball that stops anywhere on the court, even between the foul line and the near wall, stays in play.',
  ] },
  { title: '7. Hitting', p: [
    'Any ball may hit other balls and the pallino. Balls that are moved stay in play where they come to rest. When balls collide they bounce apart; a lobbed ball that lands on another ball bounces off it.',
    'If the pallino is knocked out of the court, the frame is void: nobody scores and the same side throws the pallino again.',
  ] },
  { title: '8. Scoring a frame', art: 'score', p: [
    'When all eight balls have been thrown and have stopped, the closest ball to the pallino is found, measured from centre to centre. Only the side with that ball scores. It scores one point for each of its balls that is closer to the pallino than the other side\'s closest ball.',
    'If the two closest balls are equally far, nobody scores and the same side throws the pallino for the next frame. Otherwise the side that scored throws the pallino next.',
  ] },
  { title: '9. Winning the match', p: [
    'The first side to reach 12 points wins. In the quick game it is 7 points. This game does not require winning by two.',
  ] },
  { title: '10. Team play', p: [
    'In a team game each side has two players who share the four balls. A side\'s first and third balls are thrown by its first player, the second and fourth by its second player. All other rules are the same. In the game you play with an AI partner against two rivals.',
  ] },
  { title: '11. The tournament', p: [
    'The cup is three rounds to 7 points: a quarter-final, a semi-final and a final against the rivals, each stronger than the last. Lose one match and you are out. The other matches in the bracket are decided for you.',
  ] },
  { title: '12. The courts', art: 'surfaces', p: [
    'Oyster Shell: the classic, medium-fast surface. Red Clay: fast and slick, balls run a long way. Garden Lawn: slow and grippy, and it leans gently to one side. Beach Sand: heavy going, balls stop quickly and lobs drop dead. The Daily Court mixes a new surface every day.',
  ] },
  { title: '13. What this game simplifies', p: [
    'The court and the balls are scaled for the screen, there is no foot-fault, no "dead zone" at the far end and no win-by-two rule. Every rule above is exactly what the game applies.',
  ] },
];
