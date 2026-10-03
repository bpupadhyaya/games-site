// About, How to Play, Rules, role tutorials and the Learn lessons. Every number here is the real constant from core.js / ball.js / sim.js / field.js
// (checked against the engine by test/game.test.js). Items use the ui.js column vocabulary; { t: 'fig', key } draws the game's own art (screens.js).
import { PITCH, FIELD, STUMP, BALL_R, MODES, LEVELS, RUN_LEN } from './core.js';
import { WINDOWS, SPEED } from './ball.js';
import { REACH, SLOTS } from './field.js';
import { T_RUN } from './sim.js';

const h = (text) => ({ t: 'h', text });
const p = (text) => ({ t: 'para', text });
const fig = (key, height = 260) => ({ t: 'fig', key, h: height });
const gap = (n = 10) => ({ t: 'gap', h: n });
const rule = () => ({ t: 'rule' });
const ms = (v) => `${Math.round(v * 1000)} ms`;
const km = (v) => Math.round(v * 3.6);

export const ABOUT = [
  { t: 'title', text: 'About Kilikiti', size: 40 },
  p('Kilikiti is Samoa\'s own bat-and-ball game, played in villages across Samoa and by Samoan communities in New Zealand, Australia, the United States and around the Pacific.'),
  rule(),
  h('Where it comes from'),
  p('Cricket reached Samoa in the nineteenth century, and Samoans made the game their own. The bat has three sides and is long, like a short club. The ball is hard rubber. A side is made up of whoever from the village wants to play, of any age, and the rules are flexible and agreed on the day. A match is a social occasion with music, singing and food as much as a contest.'),
  h('This game'),
  p('This is a modern, simplified interpretation made for a phone, not a record of how kilikiti is played in a village. It borrows the three-sided bat, the hard rubber ball, the big fielding side and the lively team style, and it uses short, clearly written rules so a match fits in a few minutes. It leaves out anything ceremonial or sacred.'),
  p('Real kilikiti rules vary from village to village and from tournament to tournament. If you play the real game, trust the people you are playing with.'),
  h('What is in it'),
  p('Choose one role in your team: batter, bowler, inner fielder or deep fielder. The computer plays everyone else and the whole opposition. Five opponent levels, quick and full matches, a Learn path for each role, and Watch & Learn, where the computer plays a whole match and explains its choices.'),
  h('Credit'),
  p('With respect and thanks to the Samoan communities who keep kilikiti alive. All players, teams and places in this game are invented. It is a score-only game: no stakes, no betting of any kind.'),
  gap(6),
];

export const ROLE_INFO = {
  bat: {
    title: 'Batter',
    short: 'Swipe to swing, then call the runs.',
    steps: [
      'Before each ball the radar shows every fielder. Look for a gap.',
      'When the bowler lets go, swipe the way you want the ball to go: up is straight, right is the off side, left is the leg side. A slow drag pushes it along the ground; a fast flick lifts it.',
      'The moment you start the swipe is your timing. Start just as the ball reaches the bat for a clean hit.',
      'When the ball is hit, the RUN button appears. Tap it to run, and tap again to queue another run. Watch the fielders: a throw that beats you is a run out.',
    ],
    fig: 'swipe',
  },
  bowl: {
    title: 'Bowler',
    short: 'Flick to aim and bowl.',
    steps: [
      'Pick a kind of delivery: straight, swerve in or swerve out.',
      'Put a finger low on the screen and flick up. A long flick pitches the ball full, a short flick pitches it short; flick a little sideways to move the line. The ring shows where it will pitch.',
      'A faster flick is quicker but less accurate. Aim for the stumps, or just outside, and mix up the length.',
      'Your fielders (all computer) will try to stop the ball, catch it and run the batters out.',
    ],
    fig: 'flick',
  },
  inner: {
    title: 'Inner fielder',
    short: 'Stand in the middle, chase, catch and throw.',
    steps: [
      'Before each ball, drag your gold fielder to where you think the batter will hit, then tap READY.',
      'When the ball is hit, touch the field to run to that spot: lift your finger and you keep running there. A marker shows where the ball will arrive when it is coming your way.',
      'Press the CATCH button (bottom right) just as the ball reaches you: its ring closes and it lights up. A well-timed press makes a safe catch, and it also stretches your reach for a ball passing wide.',
      'With the ball in your hand, choose the end to throw to. A direct hit on the stumps while a batter is running is a run out.',
    ],
    fig: 'catch',
  },
  deep: {
    title: 'Deep fielder',
    short: 'Guard the rope, run down hits and throw home.',
    steps: [
      'You start near the rope, where the big hits go. Drag your gold fielder to a better place before the ball if you like, then tap READY.',
      'Touch the field to run there. Cut off a ball before it reaches the rope for a four, or catch a high one for a wicket.',
      'Press CATCH just as the ball reaches you to catch it, or to stretch for it.',
      'Throw to the end where a batter is running. You are far from the wickets, so look for the end the throw can reach in time.',
    ],
    fig: 'catch',
  },
};

export const HOWTO = [
  { t: 'title', text: 'How to Play', size: 42 },
  h('One role, one team'),
  p('At the start of a match you pick one role in your own team. The computer plays every other player in your team and the whole opposition. The highlighted gold player is you. You can change role only between matches.'),
  h('Batter'),
  p(ROLE_INFO.bat.steps.join(' ')),
  fig('swipe', 280),
  h('Bowler'),
  p(ROLE_INFO.bowl.steps.join(' ')),
  fig('flick', 280),
  h('Fielders'),
  p(ROLE_INFO.inner.steps.join(' ')),
  fig('catch', 280),
  h('When your role is not playing'),
  p('A match has two innings. If you are the batter, your side fields in the other innings, and the other way round. The computer plays that innings for you; use Speed and Skip ahead to move on, or just watch.'),
  h('Think'),
  p('Tap ? for a hint with a reason: where the gap is for a batter, where to land it for a bowler, where to run or throw for a fielder. You get three hints per innings, and unlimited ones in practice.'),
  h('Learn and Watch & Learn'),
  p('Learn gives each role a short practice with a goal. Watch & Learn lets the computer play a whole match and shows its thinking: THINK, then REVEAL, then ACT. You can Pause, change the thinking time and the speed.'),
  h('Text size'),
  p('Use A− and A+ on any screen, or the Pause menu in play, to change the text size from 100% to 300%.'),
];

const winText = (w) => `perfect within ${ms(w.perfect)}, good within ${ms(w.good)}, still a hit within ${ms(w.poor)} (these windows shrink for hard swings and follow the timing setting)`;

export const RULES = [
  { t: 'title', text: 'Rules', size: 44 },
  p('Kilikiti has no single official rulebook: these are the simplified rules of this game, exactly as the game engine plays them.'),
  rule(),
  h('The ground'),
  p(`Two sets of three tall stumps (${STUMP.h * 100} cm high, about ${Math.round(STUMP.w * 100)} cm across, no bails) stand ${PITCH} metres apart on a flat pitch. The boundary rope is an oval ${FIELD.ax * 2} metres wide and ${FIELD.az * 2} metres long around the pitch.`),
  fig('ground', 300),
  h('The two sides'),
  p('The batting side has two batters at the wickets at a time: the striker, who faces the ball, and the other batter at the far end. The fielding side has nine players: the bowler, one keeper behind each wicket, three inner fielders and three deep fielders.'),
  p('You control exactly one player on your own side (your role). Everyone else on both sides is computer-controlled. Each side bats once.'),
  h('How long a match is'),
  p(`${MODES.quick.name}: ${MODES.quick.balls} balls and ${MODES.quick.wkts} wickets for each side. ${MODES.match.name}: ${MODES.match.balls} balls and ${MODES.match.wkts} wickets. An innings ends when the balls are used up, when that many batters are out, or when the second side passes the first side's score.`),
  p('If your role is the batter, your side bats first. If your role is the bowler or a fielder, the opposition bats first and your side chases.'),
  h('The delivery'),
  p(`The bowler runs in and lets go from about ${PITCH - 1} metres away. Deliveries travel between ${km(SPEED.min)} and ${km(SPEED.max)} km/h and bounce once before the batter. Straight goes where it is aimed, swerve in drifts toward the batter's legs in the air, swerve out drifts away. When you bowl, a faster flick is faster but less accurate.`),
  h('Wide balls'),
  p('A ball that goes so wide the batter cannot reach it is a wide: one run is added and the ball is bowled again.'),
  h('Batting'),
  p(`Swipe while the ball is flying. The direction of the swipe is the direction of the shot (0 straight, positive to the off side). The speed of the swipe is the power: a slow drag pushes the ball along the ground, a fast flick lifts it. The moment the swipe starts is the timing. Timing: ${winText(WINDOWS)}.`),
  p('A quick tap is a defensive prod. If you do not swipe, the ball goes past: it can hit the stumps (bowled).'),
  fig('timing', 150),
  p('Mistimed hard shots can edge the ball high toward the keeper or the fielders behind. A well-timed swipe in a good direction hits the ball cleanly.'),
  h('Running'),
  p(`After the ball is hit, the batters can run between the wickets. One run is ${RUN_LEN.toFixed(1)} metres and takes about ${T_RUN.toFixed(1)} seconds. Both batters run together and swap ends; the run counts when both have arrived. While running you can queue the next run. You cannot turn back mid-run.`),
  h('Four and six'),
  p('If the ball crosses the rope after bouncing it is a four. If it crosses the rope without bouncing it is a six. The runs are scored at once and the ball is dead.'),
  h('Fielding'),
  p(`A fielder stops a rolling ball by getting within ${REACH.pickR} metres of it, and can catch a ball in the air within ${REACH.catchR} metres of the hands and between ${REACH.catchLo} and ${REACH.catchHi} metres high. A fast ball can be fumbled, a high ball dropped; a dropped ball rolls on and can be picked up again.`),
  p('For your own fielder, you run by touching the field (the fielder keeps running to the last spot you touched) and you catch by pressing the CATCH button just before the ball arrives: a well-timed press is much more likely to hold the catch, and it stretches your reach to a lunge of up to ' + REACH.diveR + ' metres. A touch on the field never catches, and CATCH never runs.'),
  p('The computer fielders race for the ball too. When your fielder is on course for it, the nearest computer fielder gives you a moment to take it.'),
  h('Throwing'),
  p('A fielder who holds the ball gathers it for a moment, then throws to a wicket. The closer the throw and the better the thrower, the more likely it hits the stumps. If a throw is not a hit, the keeper or bowler at that end takes it and the ball is dead. Your own fielder throws to the end you choose, or to the better end after three seconds.'),
  h('Ways to be out'),
  p('Bowled: the ball hits the stumps. Caught: a fielder catches the ball in the air before it bounces, including the keepers. Run out: a throw hits the stumps while a batter running to that end has not arrived. There is no leg before wicket.'),
  p('When a batter is out the next batter comes in. The ball is dead after a wicket, a boundary or a ball returned to a keeper. Batters who are mid-run when the ball is dead finish the run.'),
  h('Scoring and the result'),
  p('Runs are the runs completed, or four or six for a boundary. Wides add one run. The side with more runs wins. If the runs are level it is a tie.'),
  h('Computer levels'),
  p(`There are five levels. A level sets how well that side bats, bowls, fields, catches and throws. The computer's own team mates are always at level ${3}, which is competent but not the strongest. ` + LEVELS.map((l) => `${l.name} (${l.who}): ${l.blurb}`).join(' ')),
  h('Preview, practice and Watch & Learn'),
  p('Practice and Watch & Learn are not counted as play. In practice there is no result: you play six balls toward a goal with unlimited hints. In Watch & Learn the computer plays both sides and explains its choices.'),
  gap(6),
];

// Learn path: one practice per role (the goal is checked by the shell from sim events)
export const LESSONS = {
  bat: { title: 'Batting practice', goal: 'Score 8 runs from 6 balls', need: 8, balls: 6, text: 'Face six easy balls. Swipe to hit and call the runs. Any hint is free.' },
  bowl: { title: 'Bowling practice', goal: 'Land 4 of 6 balls on a good length', need: 4, balls: 6, text: 'Bowl six balls. Aim to pitch on a good length (about the middle of the pitch) without going wide.' },
  inner: { title: 'Inner fielding practice', goal: 'Stop or catch 4 of 6 balls', need: 4, balls: 6, text: 'The computer batter hits toward you. Run to the ball, press CATCH as it arrives, and throw.' },
  deep: { title: 'Deep fielding practice', goal: 'Stop or catch 3 of 6 balls', need: 3, balls: 6, text: 'The computer batter hits toward you near the rope. Run it down, press CATCH as it arrives, and throw.' },
};
