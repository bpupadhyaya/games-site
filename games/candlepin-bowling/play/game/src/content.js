// Text for About, How to Play and the Rules reference. Every rule below was checked against the engine:
// sim.js (lane, pins, wood, gutters), match.js (balls, frames, scoring), game.js (flow, puzzles). Numbers are in metres.
// A section is { title, art?, p: [paragraphs] }; the reader flows every section into one scrolling page.

export const ABOUT = [
  { title: 'Candlepin bowling', art: 'pins', p: [
    'Candlepin is a bowling game from New England and the Canadian Maritimes. The pins are tall and slim, like candles, and the ball is small enough to hold in one hand, with no finger holes.',
    'It is played in friendly local alleys and in leagues, mostly in Massachusetts, Maine, New Hampshire, New Brunswick and Nova Scotia, and it has its own quiet pride: the ball is so light that a strike is a rare and happy event.',
  ] },
  { title: 'The wood is part of the game', p: [
    'In candlepin the pins you knock down stay on the lane until the frame is over. Players call them wood. A good bowler uses wood: a lying pin can deflect the ball into a pin that is still standing, and a careless one can be blocked by it.',
  ] },
  { title: 'Three balls, not two', p: [
    'Every frame has three balls. You never rush a single shot; you build a frame, and you bowl the leave you left yourself.',
  ] },
  { title: 'This version', p: [
    'Candlepin Bowling simulates the ball and all ten pins for real: the ball, standing pins, lying pins, kickback boards, gutters and the pit. You can bowl a ten-frame game against one of six rivals, share a phone with a friend, solve sixteen Wood Puzzles, or sit back and watch two rivals in Watch & Learn.',
  ] },
  { title: 'Credits', p: [
    'Candlepin bowling is a living tradition of the people of New England and the Maritime provinces. This game is a respectful tribute to their local alleys.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'lane', p: [
    'Knock down as many of the ten pins as you can. You get up to three balls in each frame, ten frames in a game. Every pin is one point, with bonuses for a strike or a spare.',
  ] },
  { title: 'Slide, aim, roll', art: 'aim', p: [
    'Slide the ball: press and drag along the strip at the bottom of the lane to choose where on the foul line you start.',
    'Aim: touch the lane, or the little pin deck map, and move your finger left or right. Where your finger is sets the point at the head pin that the ball will pass through. A dotted line shows the path.',
    'Press ROLL when you are ready. Hold your finger down while the ball rolls to speed it up.',
  ] },
  { title: 'Pace', art: 'pace', p: [
    'Soft is a slow ball: it takes longer to arrive and has more time to bend, so its path bows more. Firm is the all-round roll. Fast hits harder and sends pins and wood sliding further.',
  ] },
  { title: 'Curve', art: 'curve', p: [
    'Use the arrows on the curve control to put a curve on the ball, one or two steps either way. A curved ball starts at an angle and bends toward your aim, so it arrives at the pins at a different angle. Use it to get around wood, or to come in on the pocket from the side.',
  ] },
  { title: 'Use the wood', art: 'wood', p: [
    'Fallen pins stay on the deck until the frame ends. Look at the deck map: dark pieces are wood. Send the ball so it hits a lying pin and carries on, or hits a standing pin and pushes it into another.',
  ] },
  { title: 'Hint', p: [
    'Hint asks a strong bowler for the best roll it can find. The suggested line is drawn in gold and your aim jumps to it.',
  ] },
  { title: 'Watch & Learn', p: [
    'Two rivals play a full game. Each one thinks, shows the roll it picked and the best alternatives, and rolls. Pause stops everything; Think + and Think - set how long they take to think.',
  ] },
  { title: 'Wood Puzzles', p: [
    'Sixteen layouts with some pins standing and some lying. Clear all the standing pins. Three stars if you do it within the target number of balls, two stars with one more, one star with the third and last ball.',
  ] },
];

export const RULES = [
  { title: 'The lane and the pins', art: 'lane', p: [
    'The lane is 18.3 m (60 ft) from the foul line to the head pin and 1.05 m wide, with a gutter on each side. Ten pins stand in a triangle, 30 cm apart, pointing at the bowler: one head pin, then rows of two, three and four. The pins are numbered 1 to 10 from the head pin, left to right.',
    'Behind the pins is the pit; low kickback boards stand either side of the pin deck. Pins and balls that go into a gutter or into the pit are out of play.',
  ] },
  { title: 'The ball', p: [
    'The ball is a 11.4 cm (4.5 in) solid sphere and weighs about the same as a pin, so it loses speed and changes direction every time it hits one. That is why a strike in candlepin is rare.',
    'You choose three things: where to start along the foul line, the point at the head pin you aim at, and the pace (Soft, Firm or Fast). A curve of one or two steps either way bends the path; the heading is worked out so the ball still passes through your aim point.',
  ] },
  { title: 'Balls and frames', p: [
    'A game is ten frames. In each frame you roll up to three balls. The frame ends after the third ball, or as soon as all ten pins are down. Then the pins are set up again.',
    'The pins that fall stay on the lane until the frame ends (wood). In the Easy option they are swept away after every ball, so only the pins still standing remain.',
  ] },
  { title: 'Scoring', art: 'score', p: [
    'Every pin knocked down scores one point. A pin counts as down when it has tipped over, even if it is knocked into the gutter or the pit.',
    'A strike (all ten pins with the first ball) scores 10 plus the pins knocked by your next two balls. A spare (all ten pins with two balls) scores 10 plus your next ball. Ten pins in three balls scores 10 with no bonus. An open frame scores the pins you knocked.',
    'The most you can score is 300: twelve strikes in a row.',
  ] },
  { title: 'The tenth frame', p: [
    'The tenth frame always has three balls. After a strike or a spare the pins are set up again and the frame continues, and the pins knocked down by every ball count as points.',
  ] },
  { title: 'Gutter balls and dead wood', p: [
    'A ball that rolls into a gutter can no longer hit anything on the lane. If it touched a pin before it went in, that pin still counts.',
    'A pin that rolls into a gutter or the pit counts as down and is removed. Wood that lies on the deck can be hit again: it can slide, spin, and tip over pins that are still standing.',
  ] },
  { title: 'Two players', p: [
    'On one phone, bowlers take whole frames in turn. Highest score after ten frames wins; equal scores are a tie.',
  ] },
  { title: 'Simplifications', p: [
    'Pins fall straight to lying on the deck when they are struck; there is no tipping animation in the simulation. There is no foul line penalty and no ball return. Curve is a smooth sideways drift. Your roll has a small random wobble, as a real roll would, so even a perfect line does not always repeat.',
    'The physics is simulated in real units on a real-size lane and deck. The camera moves in close to the pins as the ball arrives, and the pin deck map shows the standing pins and the wood from above.',
  ] },
];
