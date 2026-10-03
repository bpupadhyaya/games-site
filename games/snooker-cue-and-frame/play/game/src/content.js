// Text for About, How to Play and the Rules reference. Every rule claim below was checked against the engine:
// sim.js (table geometry, spots, friction, spin, cushions, pockets), rules.js (what is on, scoring, fouls and their values, free ball,
// snooker test, re-spotting, miss rule, frame end and the re-spotted black), ai.js (the five opponents), game.js (flow, Think, Watch & Learn,
// saving, concede). Numbers: playing area 3.569 x 1.778 m, baulk line 0.737 m from the baulk cushion, D radius 0.292 m, ball 52.5 mm
// real (played 1.9x), pink spot halfway from the blue spot to the top cushion, black spot 0.324 m from the top cushion.
// A section is { title, art?, p: [paragraphs] }; the reader paginates the lines so nothing overflows at any text size.

export const ABOUT = [
  { title: 'A game of angles and patience', art: 'table', p: [
    'Snooker is played with a white cue ball, fifteen red balls and six colours on a large cloth table with six pockets. Players take turns to pot a red, then a colour, building a run of points called a break.',
    'It is a game of position as much as potting: where the white stops decides how easy the next shot is.',
  ] },
  { title: 'Where it comes from', p: [
    'Snooker is commonly said to have been devised in 1875 by British Army officers in Jabalpur, India, as a variation on billiards and pyramids. The game spread through the British Empire and is played today in the United Kingdom, India, China, Australia and many other countries.',
  ] },
  { title: 'This version', p: [
    'Cue and Frame simulates every ball with real friction, spin and collisions. You aim, choose where the tip strikes the white, and pull the cue back for power. Side spin bends the rebound off a cushion, back spin brings the white back, top spin sends it forward.',
    'The table never moves: the camera is fixed behind the baulk end. To keep balls readable on a phone they are drawn and played about 1.9 times their real size; the table, the spots and the pocket-to-ball proportions keep their real values. There are no people on screen, only the cue and the balls.',
  ] },
  { title: 'Ways to play', p: [
    'Play against one of five computer opponents, share the phone with a friend, learn the game in short hands-on lessons, or sit back with Watch & Learn and see why a strong player chooses each shot. Think is always one tap away.',
  ] },
  { title: 'About the rules', p: [
    'The game follows the usual rules of snooker in a simplified form, written out in full on the Rules pages. Where the game differs from a rule book, the Rules pages say so.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'table', p: [
    'Score more points than your opponent in the frame. Pot a red (1 point), then a colour (2 to 7 points), then a red again, and so on. When the reds are gone, pot the colours in order. A match is one frame or the best of three or five.',
  ] },
  { title: 'Aim', art: 'aim', p: [
    'Drag a finger on the table. The dotted line shows where the white will first touch a ball, and a ghost white marks the moment of contact. The gold line shows where the ball you hit will go.',
    'For fine adjustment drag left and right inside the Fine aim window below the table. It shows a close-up of the contact and turns your aim very gently.',
  ] },
  { title: 'Spin', art: 'spin', p: [
    'The circle shows the white ball. Drag on it to choose where the cue tip strikes: the top for follow, the bottom for draw (back spin), the sides for side spin. The red marker is the tip.',
    'The more off-centre you strike, the more the spin, but a pure centre strike is the most accurate.',
  ] },
  { title: 'Power and shooting', art: 'power', p: [
    'Touch the Power strip and pull the cue back to the left. The further you pull, the harder the shot. Release to shoot. If you bring the cue back to the start before releasing, the shot is cancelled.',
    'Hold the Fast button while the balls roll to speed up. Pause freezes everything.',
  ] },
  { title: 'Guide, assist and Think', p: [
    'Guide has three settings: Off, Line (aim line, ghost white and object-ball line) and Preview (the shot actually simulated for a moment after the contact). Aim assist (on by default; Settings turns it off) snaps your aim to a clear potting line when you are close to one, a little more generously against the two easiest opponents.',
    'Think shows a strong shot for the position: it sets the aim, spin and a power marker on the strip, and explains the reason. You can change anything before you shoot.',
  ] },
  { title: 'Placing the white', art: 'd', p: [
    'At the start of a frame, and after the white has been potted, the white is in hand: drag it anywhere inside the D, then aim as usual.',
  ] },
  { title: 'Fouls', p: [
    'A foul gives the opponent at least 4 points. After a foul the other player plays on from where the balls lie. If you cannot see any ball you should hit, you may get a free ball. The Rules pages list every foul.',
  ] },
  { title: 'Learn', p: [
    'Learn has hands-on lessons (aim, cut, power, back spin, position, safety) and quick questions on fouls, the order of the colours and the free ball. Show me sets a lesson up for you.',
  ] },
  { title: 'Watch & Learn', p: [
    'Two computer players play a short frame. Each thinks first, then shows its plan and explains it, then plays. Pause freezes everything exactly where it is; Think - and Think + change how long they think.',
  ] },
  { title: 'Saving a match', p: [
    'The game saves your match each time the balls come to rest and a new shot is about to start. If you close the app, Continue match on the main menu brings you back to that moment, paused. Watch & Learn and lessons are not saved.',
  ] },
];

export const RULES = [
  { title: 'The table', art: 'table', p: [
    'The playing area, between the cushions, is 3.569 m long and 1.778 m wide, with a pocket at each corner and one in the middle of each long cushion. The short cushion nearest the player is the baulk cushion; the far one is the top cushion.',
    'A baulk line is marked 0.737 m from the baulk cushion. Behind it is the D, a semicircle of radius 0.292 m centred on the baulk line.',
    'Balls are drawn and played 1.9 times their real size (real diameter 52.5 mm). The corner pocket mouth is 1.62 balls wide and the middle pocket mouth 1.9 balls wide, as on a real table. A ball drops when its centre crosses the line between the two jaw tips of a pocket.',
  ] },
  { title: 'The balls and their values', art: 'values', p: [
    'There is one white ball (the cue ball), up to fifteen reds worth 1 point each, and six colours: yellow 2, green 3, brown 4, blue 5, pink 6 and black 7.',
  ] },
  { title: 'Set-up', art: 'setup', p: [
    'Yellow, green and brown sit on the baulk line: seen from the baulk end, green is on the left of the D, brown in the middle and yellow on the right. Blue is on the centre spot. Pink is on the spot halfway between blue and the top cushion. Black is on the spot 0.324 m from the top cushion.',
    'The reds form a triangle with its point touching the pink, pointing towards the baulk end. A full frame has 15 reds (5 rows). The short frame has 6 reds (3 rows) and is otherwise identical.',
    'The white starts in hand: the player who breaks off places it anywhere in the D.',
  ] },
  { title: 'A frame', p: [
    'Players take turns at the table. A turn (a visit) continues for as long as the player legally pots a ball. The frame is won by the player with more points when the last black is potted, or when the other player concedes.',
    'While reds are on the table the player must alternate: a red, then a colour, then a red, then a colour. A colour potted after a red is put back on its spot. After the last red and the colour that follows it, the colours must be potted in order: yellow, green, brown, blue, pink, black. In that last phase they stay down when potted.',
    'Every legal pot adds its value to the break and to the score. Several reds may be potted in one shot, each scoring 1.',
  ] },
  { title: 'What is "on"', p: [
    'The ball on is the ball the white must hit first. With red on, any red. With a colour on (after a red), any colour: the colour the white touches first is the one you play, and only that colour may be potted. With the colours in order, only the next colour in the list.',
    'The Scoreboard shows what is on, the points left on the table, and your current break.',
  ] },
  { title: 'Fouls', art: 'fouls', p: [
    'A foul is penalised by giving the opponent points equal to the value of the highest ball involved, at least 4 and at most 7. Fouls are: the white hits no ball; the white hits a ball that is not on first; a ball that is not on is potted; the white is potted (in-off); after the white touches a ball, no ball reaches a cushion and none is potted.',
    'In the game the value is worked out like this: no ball hit is 4 (or the value of the colour on in the colour order); wrong ball first is the highest of 4, the value of the ball hit and the value of the ball on; potting a wrong ball is the highest of 4 and its value; white in-off is the highest of 4, the value of the ball hit and of the ball on.',
    'After a foul no points are scored for anything legally potted in the same shot, reds that were potted stay off the table, coloured balls that were potted are put back on their spots, and the turn passes. The next player plays from where the white lies; if the white was potted it is in hand, to be placed in the D.',
  ] },
  { title: 'Snooker and the free ball', art: 'snooker', p: [
    'A player is snookered when the white cannot hit both extreme edges of any ball on because balls that are not on are in the way. (Balls that are on never snooker the white.)',
    'If a player is left snookered after a foul, and the white is on the table, the next shot is a free ball: any ball may be played as if it were the ball on. The first ball the white touches is the free ball. If it is potted it scores as the ball on (1 when a red or a colour is on, the value of the colour in the colour order) and, if it is coloured, it is put back; a red potted as a free ball stays off. It then counts as the red or colour that was on, so the break continues. If the white was potted there is no free ball.',
  ] },
  { title: 'Re-spotting', p: [
    'A coloured ball put back goes on its own spot. If that spot is occupied it goes on the highest-valued spot that is free (black, pink, blue, brown, green, yellow). If no spot is free it is placed as near as possible to its own spot, straight up the table towards the top cushion, and if that is blocked, straight down.',
  ] },
  { title: 'The miss rule (simplified)', p: [
    'When a foul is a miss (the white hit nothing, or hit the wrong ball first, while a ball on could be seen directly) the player who comes to the table may play on, or ask for the balls to be put back and make the other player take the shot again. The foul points still count. A shot that has been replayed once cannot be replayed again. The computer opponents ask for the replay when the position they are left in has no easy shot.',
    'The real rule includes a referee\'s judgement of whether the player tried their best and a rule about repeated misses. The game uses only the test above, with the one-replay limit instead of the repeated-miss rule.',
  ] },
  { title: 'Ending a frame', p: [
    'The frame ends when the final black is potted legally: the higher score wins. If the scores are level, the black is put back on its spot and the white is in hand for the player who did not break off. The first player to pot the black wins; a foul on it loses the frame.',
    'A player may also concede the frame from the pause menu. In a match of several frames the break-off alternates each frame, and the match goes to the player who first wins more than half of them.',
  ] },
  { title: 'Spin and the physics', art: 'spin', p: [
    'The white is struck up to 0.62 of a ball radius off-centre. Top spin makes it follow after hitting a ball, back spin makes it come back, side spin bends its rebound off a cushion and is slightly transferred to the ball it hits. On the cloth a ball first slides, then rolls, and slows steadily. Cushions return less speed the harder they are hit.',
    'The balls collide with real friction, so a thin contact "throws" the object ball a little off the line of centres. The guide compensates for none of this: the Preview setting shows the real result.',
  ] },
  { title: 'The opponents', p: [
    'Beginner, Casual, Club, Expert and Master use the same shot planner, each with a different amount of search and a different size of execution error in aim, power and spin. In calibration matches over many frames each level beat the one below it. Higher levels also look for safety shots and snookers when no pot is worth the risk.',
  ] },
  { title: 'Differences from a rule book', p: [
    'The colour you play after a red is the colour the white touches first (there is no separate nomination). A free red stays off the table. There are no push-shot, double-hit or touching-ball checks, no jump shots or massé shots, no time limit, and no repeated-miss rule (only the one-replay limit). The balls are 1.9 times real size. Everything else on these pages is as the game plays.',
  ] },
];
