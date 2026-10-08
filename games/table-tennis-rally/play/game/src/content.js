// All the words: About, How to Play, the exhaustive Rules reference, coach lines and banners. Every statement here is a
// description of what the engine in sim.js / shots.js / strokes.js really does.
export const ABOUT = [
  { h: 'Table Tennis Rally', p: 'A fast, real-feeling table tennis game for one finger. The table, ball, paddle, net, shadows and camera are all in real 3D, and the ball obeys real spin: topspin dips and kicks, backspin floats and dies, sidespin curves.' },
  { h: 'Why table tennis', p: 'Table tennis is played by hundreds of millions of people, and it is a national passion in China, where the modern game grew into the sport the world knows. Its reflexes, its spin and its tactics are what this game is built on.' },
  { h: 'What you can do', p: 'Play a quick match against 18 opponents with their own styles, climb six tournament cups from a neighbourhood hall to the big stage, train in the Rally Challenge against a ball machine, or sit back and let the coach play while it explains every decision (Watch & Learn).' },
  { h: 'Made with care', p: 'No ads, no energy timers, no tracking. The first 90 seconds of real play are free; one unlock keeps the whole game, on your device, forever. Everything works offline.' },
];
export const CREDITS = 'Arcforge. 3D drawing by an open-source WebGL library (MIT licence, see Licences below). Fonts: Barlow and Barlow Condensed (SIL Open Font Licence). All sounds are synthesized in the game. Opponent names and places are invented.';

export const HOWTO = [
  { title: 'Slide to position', fig: 'slide', body: 'Put a finger anywhere on the table area and hold it. Your paddle follows your finger left and right. Get under the ball before it arrives: the paddle can only reach about a hand-width each side.' },
  { title: 'Flick to hit', fig: 'flick', body: 'Flick your finger up the screen to hit. A gentle flick is a Touch, a medium flick is a Loop with heavy topspin, a hard flick is a fast Drive. Flick down for a Push (soft, backspin) or a Chop (hard, heavy backspin). If you only slide and never flick, the paddle makes a safe Block.' },
  { title: 'Time it', fig: 'timing', body: 'The ring on the table shows where the ball will be easiest to hit. Flick when the ring closes and glows. Hit the ball near the ideal spot, centred on the paddle, and you get a PERFECT stroke that goes exactly where you aimed. Early or off-centre strokes drift.' },
  { title: 'Aim and curve', fig: 'aim', body: 'Flick straight up to hit down the line from where you stand. Tilt the flick left or right to aim across the table. Draw a curved flick to add sidespin that makes the ball swerve in the air and kick sideways off the table.' },
  { title: 'Read the spin', fig: 'spin', body: 'A tag follows the ball and names its spin. Topspin: block or chop it. Backspin: lift it with a loop or push it back. Sidespin: be ready for the bounce to jump sideways. A stroke that suits the spin lands; one that does not goes into the net or long.' },
  { title: 'Serve and score', fig: 'serve', body: 'To serve, slide to where you want to stand and flick: the ball is tossed and struck for you. Flick up for a fast or spinning serve, flick down for a short backspin serve. Games go to 11 and must be won by 2.' },
];

export const RULES = [
  {
    title: 'The game', blocks: [
      ['p', 'Table tennis is a duel: you and an opponent hit a light ball back and forth over a net with small paddles. In this game you play singles against the computer, always from the near end of the table.'],
      ['h', 'The equipment'],
      ['list', ['Table: 2.74 m long, 1.525 m wide, 76 cm high, with a white line round the edge and a centre line.', 'Net: 15.25 cm high, stretched across the middle.', 'Ball: a 40 mm hollow ball. In the game it is drawn a little larger so it is easy to follow.', 'Paddle: a wooden blade with a red rubber on one side and black on the other.']],
      ['fig', 'table', 360],
      ['h', 'Slow motion'],
      ['p', 'The real game is very fast. Here the ball flies at about 60 per cent of real speed so you can read its spin on a phone. All the physics (gravity, air drag, spin, bounces) are the real numbers.'],
    ],
  },
  {
    title: 'Scoring', blocks: [
      ['h', 'Points'],
      ['p', 'A point is scored at the end of every rally, whoever served. You never need to be serving to score.'],
      ['h', 'Games'],
      ['list', ['A game is won by the first player to reach 11 points, provided they lead by at least 2.', 'At 10-10 (or the equivalent in a short game) play continues until someone leads by 2.', 'The Short games setting plays to 7 instead of 11, still winning by 2.']],
      ['h', 'Matches'],
      ['list', ['A match is best of 1, 3 or 5 games: you need to win 1, 2 or 3 games.', 'The player who serves first alternates from game to game.']],
    ],
  },
  {
    title: 'Serving', blocks: [
      ['h', 'The serve'],
      ['p', 'The server tosses the ball up from the open palm (the game does this for you when you flick) and strikes it so that it:'],
      ['list', ['first bounces on the server’s own half of the table,', 'then passes over or round the net,', 'then bounces on the receiver’s half.']],
      ['h', 'Who serves'],
      ['list', ['Each player serves two points in a row, then the other player serves two.', 'From 10-10 (the deuce point of a short game, 6-6) each player serves one point in turn, until the game ends.']],
      ['h', 'Let'],
      ['p', 'If a serve touches the net and then lands correctly on the receiver’s half, it is a LET: the point is not counted and the serve is taken again. A net touch during a rally is not a let; the rally goes on if the ball still gets over.'],
      ['h', 'Serve faults'],
      ['list', ['The ball bounces on the receiver’s half before it has bounced on the server’s half.', 'The ball does not clear the net, or does not land on the receiver’s half.', 'The server hits the ball so it never reaches the table.']],
      ['p', 'A fault gives the point to the receiver.'],
    ],
  },
  {
    title: 'The rally', blocks: [
      ['h', 'Returning the ball'],
      ['list', ['After the serve, the ball must be hit alternately by each player.', 'You must let the ball bounce once on your half, then hit it.', 'You may not hit the ball before it has bounced on your half (no volleys).', 'Your return must go over or round the net and land on the opponent’s half.']],
      ['h', 'What counts as on the table'],
      ['p', 'A ball that lands anywhere on the top surface of the table counts, including on the white lines and a clip of the top edge. A ball that touches only the side of the table is out.'],
      ['h', 'The net'],
      ['p', 'A ball that touches the net during a rally is still in play if it goes on to land on the opponent’s half. A ball that is stopped by the net falls back on the hitter’s side and loses the point.'],
      ['fig', 'path', 300],
    ],
  },
  {
    title: 'Winning and losing a point', blocks: [
      ['h', 'You win the point when your opponent'],
      ['list', ['hits the ball into the net or does not clear it,', 'hits the ball past the table without it touching your half (out),', 'lets the ball bounce on their own half after hitting it,', 'lets the ball bounce twice on their side before hitting it,', 'swings and misses, or cannot reach the ball,', 'serves a fault.']],
      ['h', 'You lose the point if you'],
      ['list', ['do any of the above yourself,', 'return the ball so that it lands on your own half,', 'let the ball bounce twice on your side.']],
      ['p', 'After each point the game shows why it ended: NET, OUT, OWN SIDE, TOO GOOD (an unreachable ball) or MISSED.'],
    ],
  },
  {
    title: 'Controls', blocks: [
      ['h', 'Touch'],
      ['list', ['Hold a finger on the table area: the paddle slides under it, left and right.', 'Flick up: Touch (gentle), Loop (medium, topspin), Drive (hard, flat and fast), Smash (hard flick at a high ball).', 'Flick down: Push (gentle, backspin) or Chop (hard, heavy backspin).', 'Slide without flicking: Block, a safe, slower return (switched off in Pro assist).', 'Tilt the flick left or right to aim across the table; a curved flick adds sidespin.']],
      ['fig', 'gesture', 330],
      ['h', 'Keyboard (web)'],
      ['list', ['Left / Right: move the paddle.', 'Up: Loop. Space: Drive. Down: Push. Shift + Down: Chop.', 'A / D: aim left or right. Q / E: sidespin.']],
    ],
  },
  {
    title: 'Timing and quality', blocks: [
      ['p', 'Every stroke has a quality from 0 to 100 per cent. A perfect stroke lands where you aimed. A poor one drifts by a few degrees, so it can go into the net or long.'],
      ['h', 'What makes a good stroke'],
      ['list', ['Contact point: the ideal is a ball about 25 cm above the table, around 45 cm behind the table end. The ring on the table marks it.', 'Centre of the paddle: the nearer the ball is to the middle of the blade, the better. A ball at the very edge of your reach is a weak stroke.', 'Pace: a very fast incoming ball is harder to control.', 'The right stroke for the incoming spin (see Spin).']],
      ['h', 'Flick window'],
      ['p', 'Flick between about 0.07 and 0.24 seconds (of game time) before the ball reaches the hitting zone. Flick too early and the paddle swings at air; too late and the ball is gone. The glowing ring shows the best moment.'],
      ['h', 'Assist levels'],
      ['list', ['Easy: a wide paddle reach, auto-block on, spin matters least.', 'Normal: the standard game.', 'Pro: a narrow reach, no auto-block, spin matters fully.']],
    ],
  },
  {
    title: 'Spin', blocks: [
      ['p', 'Spin is a first-class part of the ball. It bends the flight through the air and changes how the ball comes off the table and off your paddle.'],
      ['fig', 'spin', 250],
      ['list', ['Topspin: the ball dips quickly and, after the bounce, shoots forward and stays low.', 'Backspin: the ball floats, then bounces up and slows down or even skids.', 'Sidespin: the ball curves left or right in the air and kicks sideways off the table.']],
      ['h', 'Reading it'],
      ['p', 'While the ball is coming to you a tag names its spin and shows an arrow. Heavy spin is a lot more than light spin.'],
      ['h', 'The right stroke for the spin'],
      ['list', ['Backspin: Loop or Push. A Drive or Smash into heavy backspin goes into the net.', 'Topspin: Block or Chop. A Push into heavy topspin sails long.', 'No spin: Drive, Loop or Smash.', 'Sidespin: the bounce jumps sideways, so be ready to move late.']],
      ['p', 'If your stroke is a poor match for the spin, the ball leaves the paddle too high or too low. The better your contact, the less this matters.'],
    ],
  },
  {
    title: 'The strokes', blocks: [
      ['list', ['Touch: soft and short, a little topspin. Safe over the net.', 'Push: soft, backspin, low and short. Good against backspin.', 'Chop: hard backspin, deep. A defender’s stroke from far back, good against topspin.', 'Loop: topspin, medium pace, high arc and heavy kick. Beats backspin.', 'Drive: fast and flat, a little topspin. Needs a ball without much spin.', 'Smash: the fastest stroke; it only happens on a high ball (contact more than about 55 cm above the table) with a hard flick.', 'Block: a short, firm return. Good against topspin.', 'Lob: a very high defensive return (the computer players use it).', 'Flick: a quick attacking stroke against a short ball (the computer players use it).']],
      ['p', 'Landing spot: every stroke aims for a spot on the opponent’s half. Soft strokes land near the net, hard strokes land deep. The game works out the exact launch so a well-timed stroke lands there.'],
    ],
  },
  {
    title: 'Opponents', blocks: [
      ['p', 'There are 18 invented opponents, level 1 (a friendly club coach) to level 10 (the grand master). Level sets how fast they move, how soon they react, and how clean their strokes are.'],
      ['list', ['Looper: heavy topspin, loves the corners.', 'Chopper: defends with heavy backspin from far back.', 'Blocker: quick, firm blocks, redirects your pace.', 'Hitter: flat and fast, goes for it, makes more errors.', 'Control: short, spinny balls, waits for your mistake.', 'Lobber: sends very high lobs back from far away.', 'All-rounder: mixes everything.']],
      ['p', 'Every opponent also has a weakness (for example, backspin or very fast balls). The scouting line shown before a match tells you what to try.'],
    ],
  },
  {
    title: 'Tournament', blocks: [
      ['p', 'Six cups, from the Club Cup to the World Tour Finals. Each cup has three rounds: quarter-final, semi-final and final, each against a different opponent. The best-of length grows through the cups.'],
      ['list', ['Win a round to move on. Lose and you are knocked out; the cup starts again from the quarter-final.', 'Winning the final gives you the trophy and opens the next cup.', 'The other matches in the bracket are decided by a seeded draw.']],
    ],
  },
  {
    title: 'Practice and Watch & Learn', blocks: [
      ['h', 'Rally Challenge'],
      ['p', 'A ball machine feeds you balls with growing speed and spin. Each return that lands on the far half scores one. You have three lives: a miss that costs the point costs a life. Your best run is saved.'],
      ['h', 'Learn the basics'],
      ['p', 'A short guided lesson with the ball machine: slide, flick, aim and read spin.'],
      ['h', 'Watch & Learn'],
      ['p', 'The coach plays your side against an opponent. Before each of its strokes it THINKS (the ball freezes while it explains the ball it faces and what it will do), REVEALS the stroke and where it will land, then ACTS. You can set the thinking time to 2, 5, 8 or 10 seconds and pause at any moment.'],
      ['h', 'Coach hint'],
      ['p', 'In a real match you get three coach hints per match. A hint slows the ball and shows what the coach would do.'],
    ],
  },
];

export const SCOUT = {
  backspin: 'struggles with heavy backspin', topspin: 'struggles against heavy topspin', wide: 'stretches badly on wide balls',
  short: 'is slow to short balls', speed: 'cannot cope with very fast balls',
};

export const POINT_TEXT = {
  p: { winner: 'TOO GOOD!', out: 'OUT!', net: 'NET!', 'own side': 'OWN SIDE!', 'serve fault': 'SERVE FAULT', missed: 'MISSED', return: 'RETURN!' },
  o: { winner: 'TOO GOOD', out: 'OUT', net: 'NET', 'own side': 'OWN SIDE', 'serve fault': 'SERVE FAULT', missed: 'MISSED', return: 'MISS' },
};
export const pointLine = (winner, why, rally) => {
  if (why === 'let') return 'LET';
  if (winner === 'p') {
    if (why === 'winner') return rally <= 2 ? 'ACE' : 'WINNER';
    if (why === 'return') return 'RETURN';
    return 'POINT';
  }
  if (why === 'winner') return 'TOO GOOD';
  return 'LOST POINT';
};
export const whyText = (winner, why) => {
  const mine = winner === 'p';
  switch (why) {
    case 'out': return mine ? 'Opponent’s ball went long or wide' : 'Your ball went long or wide';
    case 'net': return mine ? 'Opponent hit the net' : 'Your ball hit the net';
    case 'own side': return mine ? 'Opponent’s ball bounced on their side' : 'Your ball bounced on your own side';
    case 'serve fault': return mine ? 'Opponent’s serve was a fault' : 'Your serve was a fault';
    case 'missed': return mine ? 'Opponent missed the ball' : 'You missed the ball';
    case 'let': return 'The serve touched the net: serve again';
    case 'return': return 'Returned onto the table';
    default: return mine ? 'Opponent could not return it' : 'You could not return it';
  }
};

export const COACH_TIPS = [
  'Slide first, flick second: be under the ball before you swing.',
  'Backspin dips and dies: lift it with a Loop or Push it back.',
  'Topspin kicks forward: Block it or Chop it.',
  'Aim away from your opponent’s paddle to win the point.',
  'A short serve with backspin makes the first return hard.',
  'Flick when the ring closes, not before.',
];
