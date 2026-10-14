// The text of the About, How to Play and Rules pages. Each section: { title, art?, p: [paragraphs] }.
// Every number here is read from the engine (sim.js, play.js) so the rules page cannot drift from the game.
import {
  PITCH, BOWL_Y, BALLS_PER_OVER, OVERS, WICKETS, KNOCK_BALLS, KNOCK_WICKETS, SHOTS, LEVELS, FIELD_SETS, PADDLE_R, FIELD_R, RUN_SPEED, RUN_LEN,
} from './sim.js';
import { PAR } from './play.js';

const BALLS = BALLS_PER_OVER * OVERS;
const yd = (m) => Math.round(m / 0.9144);
const ms = (s) => `${Math.round(s * 1000)} milliseconds`;
const runSecs = (RUN_LEN / RUN_SPEED).toFixed(1);

export const ABOUT = [
  { title: 'Stoolball', art: 'wicket', p: [
    'Stoolball is a bat-and-ball game from Sussex in the south of England, played in villages and towns for centuries and still played today, mostly in clubs across the south of England and by thousands of players, many of them women and mixed teams. The story often told is that it began when milkmaids defended a stool from a thrown ball.',
    'Today a bowler throws the ball underarm at a square wooden board on a post. The batter defends the board with a wooden paddle and, when the ball is hit, runs between two such posts to score. It is the quiet cousin of cricket and rounders: friendly, quick to learn and very social.',
  ] },
  { title: 'About this version', p: [
    'This is a video game version made for phones and tablets. You slide the paddle to meet the ball, choose a block, a drive or a lift and tap on time, then decide whether the run is safe. In the second innings you bowl and set the field.',
    `The people, the village green and the teams are invented for the game. It is a simplified take: ${OVERS} overs of ${BALLS_PER_OVER} balls, ${WICKETS} wickets, nine fielders and one end. Real club rules have more players, longer overs and finer points.`,
  ] },
  { title: 'Pictures and credits', p: [
    'The village green, the pavilion, the trees, the boards, the paddle and the sound are built and synthesised in the game. The players and the spectators are 3D people, with their kits, faces and hair chosen for this game; the players are moved by motion data. Stoolball is part of the Arcforge collection of heritage games.',
  ] },
  { title: 'Licences for the 3D people', p: [
  "Characters: Microsoft Rocketbox Avatar Library (MIT)",
  "The athletes are derived from avatars of the Microsoft Rocketbox Avatar Library (https://github.com/microsoft/Microsoft-Rocketbox): meshes and skeletons are used as published, textures were repainted (logos and lettering removed, clothing recoloured for team kits). The animations in the base clip set that come from Rocketbox are used the same way.",
  "MIT License",
  "Copyright (c) 2020 Microsoft",
  "Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the \"Software\"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:",
  "The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.",
  "THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.",
  "Motion data",
  "Quaternius, \"Universal Animation Library\" and \"Universal Animation Library 2\" (CC0 1.0 Universal, public domain): https://quaternius.com. Animations by @Quaternius; attribution is not required and is given as a courtesy. * Carnegie Mellon University Graphics Lab Motion Capture Database (http://mocap.cs.cmu.edu): \"The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217.\" BVH conversion by Bruce Hahne (cgspeed.com). Used: kick (subject 74), throw (subject 15), golf swing (subject 64), retargeted to a different skeleton.",
  "Crowd textures",
  "The spectator faces, fabric weaves and blob shadows of the crowd layer are procedurally generated at runtime (no third-party artwork, photographs or characters are used or copied).",
  "Software",
  "three.js, Copyright (c) 2010-2024 three.js authors, MIT License (https://threejs.org), including the addons GLTFLoader, SkeletonUtils and RoomEnvironment. * meshoptimizer decoder (MeshoptDecoder), Copyright (c) 2016-2024 Arseny Kapoulkine, MIT License (https://github.com/zeux/meshoptimizer), bundled through three.js."
] },
];

export const HOWTO = [
  { title: 'The idea', art: 'wicket', p: [
    `Score more runs than the other side. You bat for ${OVERS} overs of ${BALLS_PER_OVER} balls or until ${WICKETS} wickets fall, then you bowl and they bat. The board on its post is the wicket: if the ball hits the board or the post, you are out.`,
  ] },
  { title: 'Slide the paddle', art: 'ring', p: [
    'The bowler lets go from the middle of the pitch. Drag a finger left or right anywhere on the pitch and the paddle follows. Put it where the ball is going to arrive.',
    'Park the paddle in the ball\'s line and do nothing: the ball stops dead. That is safe, but it scores nothing.',
  ] },
  { title: 'Block, Drive or Lift', art: 'shots', p: [
    'Tap one of the three buttons as the ring closes on the paddle. Block is a safe stop. Drive sends the ball along the ground. Lift sends it high and far, but the fielders can catch it.',
    'You get one swing per ball. The nearer your tap is to the moment the ring closes, the harder and cleaner the hit. A mistimed shot can be edged, missed, or give a catch.',
  ] },
  { title: 'Aim with the paddle', art: 'aim', p: [
    'Where on the paddle the ball meets it decides the direction. Put the ball on the left of the paddle and it goes left; on the right and it goes right. The small field map in the corner shows the fielders: aim for a gap.',
  ] },
  { title: 'Run or hold', art: 'run', p: [
    `When the ball is in the field, tap RUN to send both batters. Tap again while they are running to turn them back. A run takes about ${runSecs} seconds. The gauge shows the margin: green is safe, red means the fielders can reach a board first.`,
    'If a fielder\'s throw hits a board before a runner is home, that runner is out. Four runs if the ball rolls over the rope and six if it clears it in the air.',
  ] },
  { title: 'Then you bowl', art: 'bowl', p: [
    'In the second innings you bowl. Drag the marker on the board picture to where you want the ball to arrive, choose the pace, bounce or full, and a bow to the left or right, then press BOWL. Choose Close, Balanced or Spread to set the field.',
    'Aim at the board but not so straight that it is easy to hit. Low and quick to the edge of the board is hardest to play.',
  ] },
  { title: 'Think and Watch & Learn', art: 'field', p: [
    'Think shows where the paddle should go and which shot to play, or a bowling suggestion. A game played with Think counts as practice and does not save a best.',
    'Watch & Learn plays a whole match for you. It stops to think, shows its choice, then plays it. Pause stops everything; the buttons beside it change the thinking time.',
  ] },
];

export const RULES = [
  { title: 'The game', art: 'wicket', p: [
    `Two sides take turns to bat and bowl. The batting side tries to score runs; the bowling side tries to get the batters out. In a match each side has one innings of ${OVERS} overs of ${BALLS_PER_OVER} balls (${BALLS} balls) or ${WICKETS} wickets, whichever comes first. The side with more runs wins. Level runs is a tie.`,
    `In Quick Knock and Daily Knock you bat alone for ${KNOCK_BALLS} balls or ${KNOCK_WICKETS} wickets and try to beat the par for the level: ${LEVELS.map((l, i) => `${l.name} ${PAR[i]}`).join(', ')}.`,
  ] },
  { title: 'The ground', art: 'field', p: [
    `The pitch has a post with a square board at each end, ${PITCH} metres (${yd(PITCH)} yards) apart. The bowler delivers from ${BOWL_Y} metres (${yd(BOWL_Y)} yards) in front of the striker's board. The ground is a circle of grass of about ${FIELD_R} metres radius with a rope round it.`,
    'The picture shows the striker\'s end from above and slightly behind the bowler. Heights are drawn upwards on the screen. The small field map in the corner shows the whole circle with the nine fielders.',
  ] },
  { title: 'The delivery', p: [
    'The bowler throws underarm. The ball is in the air for about one second and may bounce once before it reaches the paddle. It may bow a little to one side in flight and come back to its line at the paddle.',
    'A faster ball gives you less time and a tighter timing margin. A very low or very high ball, or one far out wide, is harder to hit well.',
    `All balls are fair in this version: there are no wides or no-balls. Every delivery is bowled at the striker's board and counts as one of the ${BALLS_PER_OVER} balls of the over.`,
  ] },
  { title: 'Batting: the paddle', art: 'ring', p: [
    `The paddle is a round bat. It covers about ${Math.round(PADDLE_R * 200)} centimetres across. Drag sideways to slide it; it moves smoothly rather than jumping. A parked paddle in the ball's line stops the ball dead: no runs, no risk of a catch, and the ball counts.`,
    'You may swing once per ball. If the swing is too early, too late or too wide of the ball it misses, and a ball that then reaches the board bowls you out.',
  ] },
  { title: 'Batting: shots and timing', art: 'shots', p: [
    `Block: timing margin ${ms(SHOTS.block.W)} before the ball arrives; a short dead push, never lifted, never caught. Drive: margin ${ms(SHOTS.drive.W)}; fast along the ground, edge-prone when mistimed. Lift: margin ${ms(SHOTS.lift.W)}; a big, high hit that can clear the rope for six, or be caught.`,
    'The ring on the paddle closes at the exact moment the ball arrives. Tap as it closes for a full-power hit. Quality falls off as you move from the ideal moment, and also if the ball is very high, very low or wide. Low quality hits are slower; the worst edges fly off at an angle and often high.',
    'Faster bowling shortens the margin by up to a quarter; slower bowling lengthens it by up to a quarter.',
  ] },
  { title: 'Batting: direction', art: 'aim', p: [
    'The part of the paddle that meets the ball sends it that way: left of centre goes left, right goes right, up to the shot\'s spread (Block 22 degrees, Drive 52, Lift 62). An early swing pulls the ball a little to the left and a late one a little to the right.',
    'So the paddle position is your aim and the timing is your power. Look at the fielders on the field map and choose a gap.',
  ] },
  { title: 'Ways to be out', p: [
    'Bowled: the ball hits the board or the post, whether it comes straight from the bowler or off your paddle.',
    'Caught: a fielder takes the ball in the air before it touches the ground. Fast, flat hits are hard to catch; slower, higher ones are easier. Each hit gives one chance to catch it: if the first fielder to get to it drops it, the ball is then a ground ball.',
    'Run out: a fielder\'s throw (or the ball itself) hits a board while a batter running to that end is not yet home.',
    `Not in this version: leg before wicket or body before wicket, obstruction and hit wicket. When a wicket falls the next batter comes in; the innings ends at ${WICKETS} wickets (${KNOCK_WICKETS} in a knock).`,
  ] },
  { title: 'Running', art: 'run', p: [
    `When the ball is struck the batters may run. Tap RUN and both batters set off for the other end, ${(RUN_LEN).toFixed(0)} metres away; it takes about ${runSecs} seconds. A run is scored when both are home at the opposite ends. Tap RUN again to start the next run, or while running to turn back.`,
    `The gauge is the margin between the run and the ball's journey to a board (time for the nearest fielder to pick up the ball plus the throw): green is safe, amber is close, red means the ball can beat you. It is an estimate: throws miss.`,
    'If the ball is lofted wait for it to land unless it is certainly going over the rope. A ball caught cancels any run in progress, but runs already completed stay.',
  ] },
  { title: 'The fielders', art: 'field', p: [
    `Nine fielders: the bowler and eight others. The computer fields; you do not control them when you bat. They run to where the ball will be, pick it up and throw at the board a runner is heading for. The level changes how fast they are, how often they catch and how well they throw.`,
    `Field settings: ${FIELD_SETS.map((f) => `${f.name} (${f.note})`).join(' ')}`,
  ] },
  { title: 'Scoring', p: [
    'Runs are the runs completed. A ball that rolls over the rope scores four; a ball that crosses the rope in the air without bouncing scores six; these replace runs in progress. A ball thrown over the rope after a miss adds four to the runs already run.',
    'A caught ball scores the runs completed before it. A run out scores the runs completed before it too.',
  ] },
  { title: 'Bowling', art: 'bowl', p: [
    'When you bowl, the picture of the board shows where the ball will arrive: sideways to the left and right of the board, and how high. Drag the marker to set it, pick Slow, Medium or Quick, Full or Bounce and a bow to the left, straight or to the right.',
    'Faster and wider aims are less accurate: the ball arrives somewhere near your aim, not exactly on it. A bounce needs a low aim. The computer batter reads the ball and puts the paddle where it will arrive; it does better with easy balls and at higher levels.',
    'Set the field before each ball with Close, Balanced or Spread.',
  ] },
  { title: 'Levels', p: LEVELS.map((l) => `${l.name}: ${l.blurb}`).concat([
    'The level changes the computer batters\' timing and placement of the paddle, the bowling accuracy and the fielders\' speed, catching and throwing. Your batting never changes.',
  ]) },
  { title: 'Think, Watch & Learn, Pause', p: [
    'Think shows the best paddle position, shot and the direction line on the field map for the next ball, or the suggested aim when bowling. A match that used Think is practice and does not save a best.',
    'Watch & Learn plays a whole match: it thinks for the time you chose (2, 5, 8 or 10 seconds), shows what it has chosen, then plays it. Pause freezes everything exactly where it is.',
  ] },
  { title: 'Text size and sound', p: [
    'The A- and A+ buttons on every reading page and in Settings change the size of the text from 100 to 300 percent. The score and the buttons in play follow the text size up to 150 percent.',
    'Sound can be switched off in Settings or from the menu.',
  ] },
  { title: 'What is simplified', p: [
    `Real stoolball is played by teams of eleven, with longer overs, bowling from alternate ends, extras, body before wicket and the finer points of the official rules. This version uses ${BALLS_PER_OVER}-ball overs, one end, nine fielders and no extras so that a match is quick on a phone. Distances and board sizes are close to the real thing.`,
  ] },
];
