// All reading text: About, How to Play and the exhaustive Rules. Every number comes from consts.js so the page cannot drift from the game.
import { GOAL_R, DROP_R, GRAB_R, TUG_R, V_BASE, V_SPRINT, CARRY_MUL, CHARGE_T, PERIOD_SECS, PERIODS, GOLDEN_CAP, LEVELS, LADDER, TEAMS, HL, HW, GOAL_X, STAM_DRAIN, STAM_REGEN } from './consts.js';

const r1 = (v) => (Math.round(v * 10) / 10).toString();
const sprintSecs = Math.round(1 / STAM_DRAIN);
const regenSecs = Math.round(1 / STAM_REGEN);

export const ABOUT = [
  { title: 'Kok-boru', p: [
    'Kok-boru, "grey wolf" in Kyrgyz, is the great team horse game of the steppe. Two teams of riders contest one heavy ball and each tries to carry it to the far goal circle and drop it in. It is also called ulak-tartysh, "pulling the ball". Riders in Kyrgyzstan, Kazakhstan and across Central Asia have played it for generations, and it is recognised as intangible cultural heritage of Kyrgyzstan.',
    'In this game the ball is the heavy stuffed leather ball of the modern federation game. No animal is harmed and nothing is wagered: it is a sport of horsemanship, nerve and teamwork.',
  ] },
  { title: 'What you will find here', art: 'gaits', p: [
    'Play a match as a three or four rider team against computer teams, climb the Steppe Ladder from the village qualifier to the Legends challenge, ask for a Think hint at any moment, or sit back and learn from Watch & Learn, where two computer teams play and every decision is explained.',
    'Horses and riders are real 3D figures. The horses gallop with real strides (walk, trot and gallop), the tail and mane follow through, and each rider leans out of the saddle to scoop the ball, tugs it from a rival, winds up and throws. The pennants, the felt-pattern rails and the teams are original designs made for this game.',
  ] },
  { title: 'Credits and honesty', p: [
    'Heritage: the game of the nomadic horse peoples of Central Asia, with respect to the riders and families who keep it alive. Simplifications are listed on the Rules page.',
    'The horses, tack and pitch are built in the game itself, the riders are based on the open Rocketbox avatar library (licence below), and sound is synthesised. Arcforge: one polished game for each of the world\'s heritages.',
  ] },
];

export const HOWTO = [
  { title: 'The goal', p: [
    `Carry the ball to the far end and drop it into the sand circle (the goal pit). Your team attacks to the right; the rival team attacks to the left. The team with more goals when time is up wins.`,
  ] },
  { title: 'Ride', p: [
    'Drag with your left thumb anywhere on the lower left: the horse follows the direction you push, faster the further you push. Hold SPRINT for a burst, but it uses stamina (the bar at the side).',
    'You always ride the golden-ringed rider with the arrow above his head. When you win the ball you ride the carrier; when a rival has it, the rider nearest the ball is yours. The small SWITCH button hands control to the next nearest team-mate.',
  ] },
  { title: 'Grab the ball', p: [
    `A ring on the ground shows your reach. It turns green when you are close and slow enough for a clean lift, and amber when you are too fast. Press GRAB to lean down and scoop the ball onto the saddle.`,
    'If a rival is carrying the ball and you are alongside him, the same button tugs it away. The ring around him turns green when you are in reach.',
  ] },
  { title: 'Throw or pass', p: [
    `Carrying the ball: hold THROW (the big button) to charge, and let go to throw at the far circle. A dotted arc and a landing ring show where the ball will come down; let go when the ring sits inside the circle and turns green. Closer than ${r1(DROP_R)} metres to the circle, and riding slowly, the ball simply drops in.`,
    'PASS throws to the best team-mate, the one in the direction you are steering, who also takes it from the air.',
  ] },
  { title: 'The team', p: [
    'Tap the CALL chip under the scoreboard to switch your team between a pass play (team-mates run wide and call for the ball) and a solo run (they ride beside you and block rivals). Before the match you can choose Attack, Balanced or Guard.',
    'Think shows what a good rider would do right now. Pause freezes the match and has the Rules, the sound and the text size.',
  ] },
  { title: 'Keyboard', p: [
    'Arrow keys or WASD ride, Shift sprints, Space grabs and charges the throw (let go to throw), E or J passes, Q or Tab switches rider, C changes the call, T asks Think, P pauses. + and - change the text size on the menu pages.',
  ] },
];

export const RULES = [
  { title: '1. Aim of the game', p: [
    `Two teams of three or four riders play on a field ${HL * 2} metres long and ${HW * 2} metres wide with a ball and two sand circles, one at each end. A goal is scored when the ball comes to rest in, rolls into or lands in the circle of the attacked end. Your team (the Grey Wolves) always attacks to the right.`,
  ] },
  { title: '2. The field', art: 'field', p: [
    `The goal pits are ${r1(GOAL_R * 2)} metres across, centred ${GOAL_X} metres from the middle, on the long axis. The dotted ring around each pit is the drop-in zone (${r1(DROP_R)} metres). Low boards run along both sides and the ends; the ball bounces off them and stays in play, so there are no throw-ins.`,
    'A rider cannot ride through another: riders push gently apart, which is how a team-mate can block for you.',
  ] },
  { title: '3. The match', p: [
    `A match has ${PERIODS} periods. Short is ${PERIOD_SECS[0]} seconds each, Standard ${PERIOD_SECS[1]} and Long ${PERIOD_SECS[2]}. The clock stops for goals and the break.`,
    'After a goal the rival that conceded it starts with the ball at the centre; the other side waits a moment, so each kick-off gives the starting side the first move. The first period starts with the home side.',
    `In the Steppe Ladder a tie goes to a golden goal: first to score wins, and if nobody scores within ${GOLDEN_CAP} seconds the side that carried the ball longest wins. In a friendly a tie is a draw.`,
  ] },
  { title: '4. Riding', p: [
    `Your horse moves at up to ${r1(V_BASE)} metres per second and up to ${r1(V_SPRINT)} while sprinting. A rider with the ball is ${Math.round((1 - CARRY_MUL) * 100)}% slower. Horses keep their momentum, so turn early.`,
    `Sprinting drains stamina: from full it lasts about ${sprintSecs} seconds, and it comes back in about ${regenSecs} seconds of easy riding. With no stamina the horse stays at its normal pace.`,
  ] },
  { title: '5. Grabbing the ball', art: 'grab', p: [
    `A ball on the ground can be lifted by a rider within ${r1(GRAB_R)} metres. Pressing GRAB starts a short lean; if the ball is still within reach at the end of it, the rider has it.`,
    'Riding faster than about 6 metres per second risks a slip, and at a full sprint the ball is usually knocked on instead. Ease off as you arrive, then grab. A pass in the air is caught by its target if he is close enough; a rival may very occasionally snatch it.',
  ] },
  { title: '6. Tugging the ball away', art: 'tug', p: [
    `A rider within ${r1(TUG_R)} metres of the carrier can tug. After a short reach the tug succeeds or fails: it helps to be fresher than the carrier and to ride the same way, and it is harder when the carrier is sprinting, when his team-mates are close and for a moment after he picks the ball up. A failed tug costs a moment of speed; a successful one stuns the old carrier briefly.`,
    'There are no fouls and no whips: riders reach, pull and ride on. The game is about timing and position, never harm.',
  ] },
  { title: '7. Throwing and scoring', art: 'throw', p: [
    `Hold THROW to charge (about ${r1(CHARGE_T)} seconds from nothing to full) and let go to throw. The ball flies in an arc; its speed is partly carried over from the horse, and the direction is set so the sideways drift cancels. The landing ring shows the result for the current charge; only the length is yours to judge.`,
    `Within ${r1(DROP_R)} metres of the circle, and riding slower than about 6 metres per second, the throw becomes a drop-in: the ball always lands in the pit.`,
    'A rider who throws cannot grab again for a moment, so the ball is a contest for everyone.',
  ] },
  { title: '8. Passing', p: [
    'PASS sends a low throw to a team-mate, preferring the one in the direction of your stick, further forward and with no rival in the lane or beside him. The receiver catches it automatically when he reaches it; riders cannot pass backwards through a rival without risking an interception.',
    'The CALL chip changes how the computer team-mates behave: a pass play spreads them wide and forward; a solo run keeps the striker beside you as a blocker.',
  ] },
  { title: '9. Switching rider', p: [
    'You ride one rider at a time, marked by the golden ring and arrow. Your own side has the ball: you ride the carrier. Otherwise the control moves to the team-mate nearest the ball (never more than every second), or you can tap SWITCH to hand it to the next nearest.',
  ] },
  { title: '10. Roles', p: [
    'Each side has a Striker (rides in front of the carrier), a Wing (works wide) and a Guard (stays back and closes the circle). With four riders there is a second Wing. When the other team has the ball the two nearest ride it down and tug; the others guard the circle.',
    'Tactics before the match: Attack sends a third chaser and pushes the Guard up, Guard keeps everyone near your own circle, Balanced is in between.',
  ] },
  { title: '11. The computer teams', art: 'pennants', p: [
    `There are ${LEVELS.length} levels: ${LEVELS.map((l) => l.name).join(', ')}. Higher levels ride faster, react sooner, throw more accurately, pass more and tug harder. Each level beats the one below it in the calibration of 60 computer matches.`,
    `The Steppe Ladder goes through ${LADDER.length} rungs: ${LADDER.map((l) => `${l.name} (${TEAMS[l.team].name}, ${LEVELS[l.level].name})`).join('; ')}. Win a rung to climb; a loss lets you try the same rung again.`,
  ] },
  { title: '12. Think and Watch & Learn', p: [
    'Think pauses the match and shows what a good rider in your place would do: the best next action, a marker where to ride, and for throws the charge that lands in the circle.',
    'Watch & Learn plays a whole match between two computer teams. At each key decision (a grab, a tug, a pass or a throw) the match stops: THINK (you set the time) shows why, REVEAL highlights the choice, then ACT carries it out. Pause stops everything, including the countdown, until you resume.',
  ] },
  { title: '13. Not in this version', p: [
    'No fouls or penalties, no horse injuries and no whips; no change of ends; no substitutions; a heavy leather ball only. Real matches run in much longer periods with more riders on a larger field. These simplifications keep a match short enough for a phone.',
  ] },
];

export const TIPS = [
  'Slow down as you arrive: the ring turns green and the lift is clean.',
  'A rival on your shoulder? Pass to the open team-mate before he tugs.',
  'Throw when the landing ring is inside the circle: it turns green.',
  'Sprint to open a gap, then ease off before the throw.',
];
