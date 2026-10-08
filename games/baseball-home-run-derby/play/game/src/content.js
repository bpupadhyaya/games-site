// About, How to Play and Rules. Every number quoted is the real constant from core.js / ball.js / engine.js.
// Items use the ui.js column vocabulary; { t: 'fig', key } draws the game's own art (view.js figures).
import { WINDOWS, LEAD } from './ball.js';
import { PITCHES, PITCH_KEYS, LEVELS, MOONSHOT_M, PARKS, PARK_KEYS, SECTORS } from './core.js';
import { READY_T, WINDUP_T } from './engine.js';

const h = (text) => ({ t: 'h', text });
const p = (text) => ({ t: 'para', text });
const fig = (key, height = 280) => ({ t: 'fig', key, h: height });
const gap = (n = 10) => ({ t: 'gap', h: n });
const rule = () => ({ t: 'rule' });
const ms = (s) => Math.round(s * 1000);

export const ABOUT = [
  { t: 'title', text: 'About Moonshot Baseball', size: 38 },
  p('Moonshot Baseball is an original baseball batting game: step up under the lights, read the pitch, aim, time your swing and try to hit the ball out of the park. Everything is real 3D: the ballpark, the pitcher, the batter, the flight of the ball.'),
  rule(),
  h('A game played on every continent'),
  p('Baseball grew out of bat-and-ball games played in the United States in the 1800s. It became the national game of the United States, Cuba, the Dominican Republic, Venezuela and Japan, and is loved across Korea, Taiwan, Mexico, Puerto Rico, Panama and many more places. Great hitters from Havana, Santo Domingo, Osaka and a hundred small towns practise the same thing: seeing the ball early and meeting it exactly.'),
  h('The home run contest'),
  p('A batting contest is baseball stripped to its best moment: one batter, a pitcher who throws strikes, and the fence. Hit it over and it counts. Anything else is an out. That is the whole game, and it is a hard one to master.'),
  h('What is in the game'),
  p(`A bracket of eight batters, quarter-final to final; a quick round on any of three ballparks; a daily round with the same pitches for everyone; and Auto Play, where the computer bats a whole round and thinks out loud about every pitch. Five pitch types, three difficulty levels, slow motion on the big hits and a camera that rides the ball.`),
  h('Original, and for everyone'),
  p('Every player, team and ballpark in this game is invented. It is not connected to any league, team, player or tournament. It is a score-only game: no chips, no stakes, no betting of any kind.'),
  h('3D people and credits'),
  p('The players are 3D people from the Microsoft Rocketbox Avatar Library (MIT) with motion made in the game itself. The 3D engine is three.js (MIT). Full credits are listed on the credits page of this About screen when the 3D layer is present.'),
  gap(6),
];

export const HOWTO = [
  { t: 'title', text: 'How to Play', size: 40 },
  h('1. Watch the pitcher'),
  p(`The batter steps in, then the pitcher winds up. When the ball leaves his hand a label names the pitch. You have between ${PITCHES.fastball.T.toFixed(2)} and ${PITCHES.change.T.toFixed(2)} seconds before it reaches you, depending on the pitch.`),
  h('2. Hold and aim'),
  p('Put a finger down anywhere and drag. The drag is your aim: drag right to hit to the right side of the field, left for the left side, and up to lift the ball higher. A curved line over the field shows where you are aiming. You can start aiming during the wind-up.'),
  fig('aim', 300),
  h('3. Lift to swing'),
  p('Your swing starts the moment you LIFT your finger. A quick flick works too: the direction of the flick is the aim. A plain tap swings with a safe, middle aim. The moment you lift, compared with the moment the ball arrives, is your timing.'),
  fig('timing', 170),
  h('4. Timing decides everything'),
  p('PERFECT timing sends the ball out at full speed and exactly where you aimed. Too early pulls the ball toward the near foul line; too late pushes it the other way. Miss the window completely and it is a swing and a miss.'),
  h('5. Aim at the spotlight'),
  p(`Before every pitch one of the ${SECTORS} sections of the outfield stands lights up. A home run that lands in it counts DOUBLE. The fence is shorter near the foul lines and deepest in the middle.`),
  fig('field', 340),
  h('6. Outs'),
  p('Every pitch that is not a home run is an out: a miss, a foul, a pitch you let go by, a fly ball or a line drive that is caught or stays in the park. When the outs run out your round is over. A giant blast of 125 metres or more gives one out back.'),
  h('7. The bracket'),
  p('In The Bracket you bat a round, then your opponent bats the same kind of round. The higher score moves on. Ties go to a three-swing swing-off, then to the longest total distance.'),
  h('8. Think and Auto Play'),
  p('The Think button names the coming pitch and tells you how to hit it. You have three per round. Auto Play lets you watch the computer bat while it explains each decision; you can pause, speed it up or change its thinking time.'),
];

const pitchRows = PITCH_KEYS.map((k) => ({ t: 'stat', label: PITCHES[k].name, value: `${PITCHES[k].T.toFixed(2)} s`, wide: false }));

export const RULES = [
  { t: 'title', text: 'Rules', size: 42, sub: 'Every number below is what the game uses.' },
  h('The round'),
  p('One batter faces one pitcher. Each pitch cycle is: READY, WIND-UP, PITCH, SWING, BALL IN FLIGHT, RESULT. There are no runners, fielders or umpire calls: only the fence and the outs.'),
  p(`READY lasts ${READY_T.toFixed(2)} seconds (longer while a hint is open), the wind-up ${WINDUP_T.toFixed(1)} seconds, then the ball is released.`),
  h('Outs and rounds'),
  ...LEVELS.map((L) => ({ t: 'stat', label: L.name, value: `${L.outs} outs`, wide: false })),
  p('Every pitch that is not a home run costs one out: a swing and a miss, a foul ball, a pitch you do not swing at, a ground ball, a fly ball or line drive that does not clear the fence, or a ball that hits the wall. A home run costs nothing. A round also ends after 60 pitches.'),
  p(`A home run of ${MOONSHOT_M} metres or more is a Moonshot: it gives back one out (if you have used any).`),
  h('Home runs and points'),
  p('A home run is a fair ball that crosses the outfield fence in the air above the 3 metre wall, between the foul poles. It scores 1 point. If it crosses inside the lit spotlight section it scores 2. A ball that bounces before the fence, hits the wall, or crosses outside the foul poles is not a home run.'),
  p('Fence distance depends on the ballpark: shortest at the foul poles, deepest straight away.'),
  ...PARK_KEYS.map((k) => ({ t: 'stat', label: PARKS[k].name, value: `${PARKS[k].line} m / ${PARKS[k].mid} m`, wide: false })),
  p('The first number is the distance to the foul poles, the second to straight-away centre field.'),
  h('The pitches'),
  p('The time from release to the ball reaching you, by pitch type:'),
  ...pitchRows,
  p('Fastball: straight. Sinker: quick, dives and runs in. Curveball: slow, drops late. Slider: snaps sideways late. Change-up: looks like a fastball but arrives late. Early bracket rounds use fewer pitch types; the final uses all five.'),
  h('Timing'),
  p(`The bat meets the ball ${ms(LEAD)} milliseconds after you lift your finger. How far that moment is from the ball arriving is the timing error. The windows (before the level and pitch adjust them) are:`),
  { t: 'stat', label: 'Perfect', value: `${ms(WINDOWS.perfect)} ms`, wide: false },
  { t: 'stat', label: 'Good', value: `${ms(WINDOWS.good)} ms`, wide: false },
  { t: 'stat', label: 'OK', value: `${ms(WINDOWS.ok)} ms`, wide: false },
  { t: 'stat', label: 'Weak', value: `${ms(WINDOWS.weak)} ms`, wide: false },
  p('Beyond the weak window you swing and miss. The windows are scaled by the level (Rookie 1.45, Pro 1.15, All-Star 1.0) and by the pitch (fastballs a little tighter, change-ups a little wider). The Assist setting scales them again.'),
  p('Timing sets how hard the ball is hit (exit speed) and how true your aim is. Early timing pulls the ball toward the near foul line, late timing pushes it the other way; inside pitches pull a little more.'),
  h('Aim and lift'),
  p('Your drag sets the spray (horizontal, up to 42 degrees either side of straight away) and the lift (vertical). Low pitches want a steeper lift and high pitches a flatter one; if your lift does not match the pitch the contact is less square and the ball comes off slower. The ball then flies with real drag and backspin.'),
  h('Opponents and the bracket'),
  p('The bracket has eight batters. Each round you bat and then your opponent bats a round of the same kind on the same park. Higher points win; a tie goes to a three-swing swing-off (no outs, most points wins), then to total home run distance. Opponents differ in power and steadiness and get stronger toward the final.'),
  h('Free preview'),
  p('The game starts with a 90 second free preview of real batting. Menus, Rules, About, Settings and Auto Play do not use up the preview.'),
  gap(6),
];

export const CREDITS_FALLBACK = ['# 3D people and credits', 'Microsoft Rocketbox Avatar Library (MIT). the 3D engine (MIT). CMU motion capture (free for use). Quaternius animations (CC0).'];
