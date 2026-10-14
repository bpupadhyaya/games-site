// Text for About, How to Play and the Rules reference. Every rule claim below was checked against the engine:
//   sim.js    stroke speed 4 to 25 m/s, ice friction 3.0 m/s^2 and a little drag, snow 11 m/s^2, boards keep 74 % of the speed,
//             pillars and blocks 62 %, sledges 80 %, thin ice swallows a ball slower than 8.5 m/s, the post ends the leg
//   courts.js six courts in three venues, each played out and back, par 3 (4 on the Long Reach)
//   game.js   alternate strokes, the 8-stroke cap, the 1-stroke thin-ice penalty, stopping at the first finisher's count,
//             legs won, the leg winner strikes first, scatter above 90 % power, the demo cap
//   ai.js     four rivals, Think
// A section is { title, art?, p: [paragraphs] }; the reader lays the text out so nothing overflows at any text size.

export const ABOUT = [
  { title: 'The old game of Kolf', art: 'court', p: [
    'Kolf is a club-and-ball game from the Low Countries. Players take turns to strike a ball with a heavy-headed club towards a post at the far end of a court, and whoever reaches the post in the fewest strokes wins the leg.',
    'It was played on village greens, in courtyards and, above all, on the frozen canals of the Netherlands in winter. Painters of the Golden Age filled their ice scenes with skaters and kolf players, and it is one of the ancestors of the golf that spread across the world. In Friesland it is still played today.',
  ] },
  { title: 'This version', p: [
    'Kolf puts you behind the ball on a long frozen court, in the warm hazy light of an old painting. You aim, swing, and watch the ball slide: ice carries it a long way, boards and bollards bounce it, snow stops it, thin ice swallows a slow ball, and the wind leans on it.',
    'Play against one of four computer players, share the phone with a friend, or play alone against par. Think suggests a strong stroke and explains why. Watch & Learn lets two computer players play a whole match while they explain every choice, with a real Pause.',
  ] },
  { title: 'Courts', p: [
    'The Frozen Canal: two long open courts with a barge, a snow patch and a first bit of thin ice. Mill Pond: bollards, a sledge that sweeps across and a pond of thin ice in a crosswind. Harbour Basin: frozen boats, bollards that guard the post and the longest court of all. Every court is played out and then back, and The Golden Cup plays all twelve legs.',
  ] },
  { title: 'About the rules', p: [
    'The game follows the heart of the old rules: alternate strokes, the post is the target, fewest strokes wins the leg. Where it differs from the way it was played on the ice, the Rules pages say so. They are written out in full and match how the game really plays.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'court', p: [
    'Reach the painted post at the far end of the court in fewer strokes than your rival. Each court is played out, and then back the other way over the same ice. Win more legs than your rival to win the match.',
  ] },
  { title: 'Aim', art: 'aim', p: [
    'Drag left or right on the court to turn your aim: the whole view turns with it. The dotted line shows where a stroke would go. Use the arrow buttons for tiny steps (hold them to turn faster). The map strip shows the whole court from above.',
    'Line the post up with the dotted line and you are aimed at it. Banks off the boards are part of the game: aim at a board and let the ball come off it.',
  ] },
  { title: 'Swing', p: [
    'Tap Swing: the power bar fills and empties again, back and forth. Tap Strike! when it shows the power you want. A pale marker on the bar shows how much power just reaches the post along your aim line.',
    'A very hard swing, above 90 %, is not perfectly straight: it can stray by up to two degrees. Often a smooth stroke at 70 % to 85 % is the better choice.',
  ] },
  { title: 'The ice', p: [
    'Ice is slippery: the ball runs a long way. Snow slows it fast. Boards, bollards and frozen boats bounce it. A crosswind pushes the ball sideways while it slides: watch the pennant on the post and the wind line at the top. The dotted line does not know about the wind, so lean into it.',
    'Thin ice is dark and cracked. A ball moving fast skims across it. A slow ball falls through: you lose a stroke and play again from where you were. The narrow plank bridges are safe at any speed.',
  ] },
  { title: 'Think and Watch & Learn', p: [
    'Think works out a strong stroke and sets your aim and a green marker on the power bar. Watch & Learn plays a whole short match between two computer players: it thinks, shows its choice with a card that explains it, then swings. Use Pause, Speed and the Think time buttons as you like.',
  ] },
];

export const RULES = [
  { title: '1. What you are playing', p: [
    'A match is a series of legs. In each leg every player hits their own ball from the start post towards the target post at the other end of the court. The first leg of a court is played out; the next leg of the same court is played back from the far post to the near post, over the same ice and with the same obstacles.',
    'Courts: The Frozen Canal (Canal Run, Lock Gate), Mill Pond (Bollard Field, Windmill Reach) and Harbour Basin (Boat Yard, The Long Reach). A venue gives a four-leg match. The Golden Cup plays all twelve legs.',
  ] },
  { title: '2. Strokes', p: [
    'A stroke gives the ball a heading and a speed. Speed runs from 4 m/s at 0 % power to 25 m/s at 100 % power. A ball that is struck only sets off; it then slides until it stops, and the next stroke is played from where it lies.',
    'Power is set with the swing bar: it fills and empties continuously, and you tap Strike! to hit. Above 90 % power the heading can stray by up to two degrees, more the harder you swing. At 90 % or below the stroke goes exactly where it is aimed.',
  ] },
  { title: '3. Alternate strokes', art: 'court', p: [
    'Players take alternate strokes, each with their own ball. The two balls do not touch each other. At the start of the match the first player to strike is the first player in the list; after a leg, the winner of that leg strikes first in the next one (after a halved leg the order stays).',
    'When one player reaches the post in n strokes, the other players may keep playing until they have hit n strokes. If they reach the post with their n-th stroke the leg is halved; if they have not reached it by then they are out of the leg and lose it.',
  ] },
  { title: '4. Reaching the post', p: [
    'A ball that touches the post ends that player\'s leg, however slowly or fast it is moving. The post is 1 m wide and the ball is a little smaller than a fist; a ball that only brushes the post counts. Real kolf asks the ball to strike the post as well.',
    'No player may take more than eight strokes in a leg. A player who has played eight strokes without reaching the post picks up; that leg is scored as eight.',
  ] },
  { title: '5. Winning a leg and the match', p: [
    'The player who reached the post in the fewest strokes wins the leg and scores one point. If two or more players reach it in the same number of strokes, or nobody reaches it, the leg is halved and nobody scores.',
    'The match is won by the player with most legs. If the legs are level, the player with the fewest strokes in total wins; if these are also level, the match is drawn.',
    'Playing alone, your aim is a total number of strokes, compared with par: 3 strokes for most legs, 4 on The Long Reach. A stroke under par is a birdie, two under an eagle, and one stroke is always called in one.',
  ] },
  { title: '6. The ice', p: [
    'The court is smooth ice. A ball loses about 3 m/s of speed every second, and a little more the faster it goes. A ball struck at full power slides about 100 m on open ice if it hits nothing.',
    'Snow patches are rough: a ball on snow loses speed about four times faster, and the wind does not push it. A ball that stops on snow is simply played from there.',
    'Wind: some courts have a steady crosswind. It pushes the ball sideways on the ice, and it gusts a little stronger and weaker every 8 to 11 seconds. It is shown at the top of the screen as Light, Fresh or Strong and by the pennant on the post. The guide line does not include the wind or moving sledges.',
  ] },
  { title: '7. Boards and obstacles', p: [
    'Boards run round the court. A ball that hits a board bounces and keeps about three quarters of its speed. Bollards, frozen boats and barges also bounce the ball, keeping about six tenths of its speed. A sledge that crosses the court bounces the ball hard, keeping about eight tenths.',
    'Sledges move to a fixed rhythm that repeats. The computer players time their strokes to it. A ball is never stopped dead by an obstacle: it always bounces away.',
  ] },
  { title: '8. Thin ice', p: [
    'Thin ice is dark and cracked. A ball that is moving faster than 8.5 m/s skims across it. A ball that is moving slower than that when it is on thin ice falls through. You add one stroke and play again from the place you struck from.',
    'A plank bridge lies over some thin ice. A ball on the bridge never falls through, whatever its speed.',
  ] },
  { title: '9. Think, Watch & Learn and the guide', p: [
    'Think searches many strokes on the real physics and picks one that either reaches the post or leaves the best next position. It sets your aim and shows the power on the bar with a green marker, and explains the choice. It is a suggestion: you still have to swing.',
    'The guide can show the whole predicted path, only the path up to the first bounce, or nothing. It ignores wind and sledges, so a stroke can go differently from the dotted line.',
    'Watch & Learn plays three legs between two computer players. It thinks (you choose how long, 2 to 10 seconds), shows the stroke it chose with a card, then swings. Pause stops everything exactly where it is, and Resume carries on.',
  ] },
  { title: '10. The four rivals', p: [
    'Skater Jan is still finding his feet: he tries few strokes and swings with a shaky hand. Baker Marit is steady and sensible. Skipper Pieter reads the banks well and checks that a stroke still works if his swing is a little off. Mistress Saskia searches the most strokes and has the steadiest swing.',
    'All four play by the same rules as you: they cannot see anything you cannot, and they do not see the wind or the sledges in advance more than you can read them.',
  ] },
  { title: '11. Simplifications', p: [
    'Real kolf is played with a leather ball, a club with a lead-faced head and a stake or a wall at each end, often over ice that is much longer than this. The ball here is a single rolling circle with no spin, and the post is a target you simply have to touch. Players do not obstruct each other\'s balls.',
    'Distances are in metres of play. The six courts are invented for the game, in the manner of the canals, mill ponds and harbours where the game was played.',
  ] },
  { title: '12. The free preview', p: [
    'The first 90 seconds of real play are free. Watch & Learn, the menus and the rules never use up the preview, and pausing stops its clock. In the web demo the first three legs of The Frozen Canal are free and the full game is on iPhone and Android.',
  ] },
];
