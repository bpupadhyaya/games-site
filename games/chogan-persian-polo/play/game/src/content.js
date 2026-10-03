// All reading text: About, How to Play, the exhaustive Rules (numbers are pulled from consts.js so the page cannot drift from the engine),
// role descriptions, lessons and the quiz.
import { HW, HL, GOAL_HW, V_BASE, V_SPRINT, STAM_DRAIN, STAM_REGEN, WIND_MAX, REACH, HOOK_COOL, HOOK_RANGE, PERIODS, PERIOD_SECS, LEVELS, STRIKE_MIN, STRIKE_MAX, HIT_MAX_Y } from './consts.js';

const m1 = (v) => (Math.round(v * 10) / 10).toString();
const m2 = (v) => (Math.round(v * 100) / 100).toString();
const fr = (E) => (E.fMin < 0 ? `from ${m2(-E.fMin)} m behind to ${m2(E.fMax)} m ahead of` : `from ${m2(E.fMin)} to ${m2(E.fMax)} m ahead of`);
const secs = (n) => `${Math.round(n * 60) / 60} s`;

export const ROLE_INFO = [
  { id: 0, name: 'Attacker', num: '1', blurb: 'Rides ahead, takes the shots at goal.', long: ['The number 1 rides furthest up the field. Your job is to be in the open space ahead of the ball, take passes and shoot at the posts.', 'Tip: stay on the side away from the ball, ride onto the ball with it on your right, and swing toward the open side of the goal.'] },
  { id: 1, name: 'Midfielder', num: '2', blurb: 'Links the play, wins the ball.', long: ['The number 2 shadows the ball in the middle of the field. You win loose balls, hook rivals and feed the attacker.', 'Tip: ride between the ball and your own goal, hook a rival who winds up a stroke, then pass forward.'] },
  { id: 2, name: 'Back', num: '3', blurb: 'Guards your goal, clears the ball.', long: ['The number 3 stays near your own goal. You stop shots, hook the attacker and clear the ball up the wings.', 'Tip: keep between the ball and the posts. When the ball comes loose near your goal, hit it hard up the side boards.'] },
];

export const ABOUT = [
  { title: 'Chogan', p: ['Chogan is a team game on horseback in which riders drive a ball with a long-handled mallet. It is the ancestor of the modern game of polo.', 'This version has three riders a side on a short field. You ride one horse, steer it, sprint, and time your stroke. The other five riders are computer players.'] },
  { title: 'Where it comes from', p: ['Chogan (also written Chovgan or Chaugan) is an ancient game of Iran, played on horseback in Persia and Central Asia for well over two thousand years. Early forms were used to train cavalry.', 'The game was inscribed on the UNESCO list of the intangible cultural heritage of humanity in 2017. From Persia it spread east and west and became the game of polo.', 'The word chogan means a stick with a curved end, and the game is still played in Iran today.'] },
  { title: 'About this version', p: ['This is a simplified, arcade-style version for a phone: a small field, short periods and simple fouls. It is not a simulation of the full modern game. Horses are drawn with simple smooth shapes and the riders are stylised figures.', 'Colours are generic: one red team and one blue team.'] },
];

export const HOWTO = [
  { title: 'The goal', p: [`Two teams of three ride on a ${HW * 2} by ${HL * 2} metre field. Drive the ball between the posts at the far end. You play ${PERIODS} periods; the team with more goals wins.`] },
  { title: 'Steering', p: ['Put your left thumb anywhere on the left of the screen and drag. The horse rides the way you drag: a small drag is a walk or trot, a bigger drag is a canter. Push to the very edge to sprint while the stamina bar lasts.', 'A horse cannot turn sharply at speed. Ease off to turn tighter.'] },
  { title: 'The stroke', p: ['Hold SWING with your right thumb to wind the mallet back, and let go to hit. Holding longer gives more power, a quick tap is a soft touch.', 'Steer with the left thumb while you let go to choose the direction of the hit. With no steering the ball goes ahead of you, or at the goal if you face it.', 'The ball must be beside your horse, a little ahead: the game shows a green ring around the ball when it is in reach. You hit with the right side, back-hand behind you on the right, or across the neck on the left.'] },
  { title: 'Hooking', p: ['Press HOOK to catch the mallet of a rival who is winding up. A good hook knocks the stroke away. A missed hook leaves you open for a moment.'] },
  { title: 'Fouls', p: ['Riding across a rival or crashing into one at speed is a foul. The other team gets a free hit and you must stay clear of the ball until it is taken.'] },
  { title: 'Think and Pause', p: ['THINK pauses the game and shows what a good player in your role would do now, with a marker on the field. PAUSE stops everything.'] },
];

export function buildRules() {
  const lv = LEVELS.map((l) => `${l.id}. ${l.name}`).join(', ');
  return [
    { title: 'The field', art: 'field', p: [`The field is ${HW * 2} m wide and ${HL * 2} m long with low boards all round. Each end has a goal mouth ${m1(GOAL_HW * 2)} m wide between two tall posts.`, 'The ball bounces off the side boards and off the end boards beside the goal. A ball that passes between the posts is a goal.', 'There is no change of ends in this version: your team always defends the near goal and attacks the far one.'] },
    { title: 'Teams and roles', art: 'roles', p: ['Each team has three riders: the 1 (attacker), the 2 (midfielder) and the 3 (back). Before a match you pick one role and ride that horse for the whole match. Every other rider, on your team and the other team, is controlled by the computer.', 'You cannot change role during a match. The ridden horse has a ring and a name tag.'] },
    { title: 'Riding', art: 'riding', p: [`A horse walks, trots, canters and gallops depending on your speed. Normal top speed is ${m1(V_BASE)} m/s; a sprint is ${Math.round(V_SPRINT * 100 - 100)}% faster.`, `Sprinting uses stamina: it drains at ${Math.round(STAM_DRAIN * 100)}% per second and refills at ${Math.round(STAM_REGEN * 100)}% per second when you are not sprinting. You can only start a sprint again once the bar is above 20%.`, 'A horse slows for a sharp turn. Hitting the boards slows it a little.'] },
    { title: 'The ball', p: ['The ball rolls on the grass and slows down. When it is hit hard it flies a little and bounces. A horse is a solid body: the ball cannot pass through it, and a horse can nudge the ball.', 'A ball higher than a little over half a metre above the ground cannot be struck.'] },
    { title: 'The stroke: wind-up and power', art: 'stroke', p: [`Hold SWING to wind up. Power rises for ${WIND_MAX.toFixed(2)} seconds and then stays at full. Let go to strike. A quick tap is a soft touch (30% power), a full wind-up is 100%.`, `After you let go the game picks the best moment for the mallet head to meet the ball within the next ${STRIKE_MIN} to ${STRIKE_MAX} sixtieths of a second. If the ball is not in reach at that moment the stroke misses and the mallet swishes through the air.`] },
    { title: 'The stroke: reach', art: 'reach', p: [`Forehand (right side): the ball must be ${m2(REACH.R.latMin)} to ${m2(REACH.R.latMax)} m to the right of the horse's centre line and ${fr(REACH.R)} the rider.`, `Back-hand (right side, when you aim backwards): ${m2(REACH.B.latMin)} to ${m2(REACH.B.latMax)} m to the right and ${fr(REACH.B)} the rider.`, `Near side (across the neck, on the left): ${m2(REACH.L.latMin)} to ${m2(REACH.L.latMax)} m to the left and ${fr(REACH.L)} the rider.`, `The ball must be under ${m1(HIT_MAX_Y)} m high. The best contact is in the middle of the reach: a good contact is accurate and strong, an edge contact spreads the direction.`] },
    { title: 'Direction and accuracy', p: ['The direction of a hit is where you steer at the moment you let go. If you are not steering it goes ahead of you, or at the goal if you are facing it.', 'The hit is less accurate and weaker when you hit backwards, when the ball is at the edge of your reach, when you are turning hard or riding fast.'] },
    { title: 'Hooking', p: [`Press HOOK to swing your mallet at a rival's. If a rival within ${m1(HOOK_RANGE)} m is winding up or about to strike while your hook is active, his stroke is knocked away and he cannot swing for a moment.`, `A hook that finds nothing leaves you unable to hook or swing again for ${m1(HOOK_COOL / 60)} s.`] },
    { title: 'Goals and throw-in', p: ['After a goal, and at the start of every period, the riders ride back to their starting spots. A short count-down ends with the umpire throwing the ball up in the middle; it lands and rolls to one side.', 'The score is shown at the top of the screen.'] },
    { title: 'Fouls and free hits', p: ['Crossing: riding across the path of a rival so that the horses collide at speed. Dangerous ride-in: riding hard into a rival. The rider who cut across is penalised; the rider who last hit the ball and rides along its line is not.', 'The other team gets a free hit where the ball lies. For a few seconds only the team with the free hit may strike the ball.'] },
    { title: 'Periods and winning', p: [`A match is ${PERIODS} periods. You choose the length of a period: ${PERIOD_SECS.join(', ')} seconds. The clock runs only while the ball is in play. At the end of period ${PERIODS} the team with more goals wins; equal goals is a draw.`] },
    { title: 'Computer levels', p: [`Five levels: ${lv}. Higher levels ride faster, react quicker, aim more accurately and hook more often. Your own team-mates always play at level 3.`] },
    { title: 'Not in this version', p: ['No change of ends, no substitutes, no handicaps, no horse changes between periods, no umpire cards and no penalty goals. Horses do not tire except through the sprint bar.'] },
  ];
}
export const RULES = buildRules();

export const LESSONS = [
  { id: 'ride', title: '1. Ride', goal: 'Reach 5 markers in order within 45 s', n: 5, need: 5, intro: ['Drag with your left thumb to steer. Ride through each glowing marker in order.', 'Slow down for sharp turns: a horse cannot turn tightly at full speed.'] },
  { id: 'sprint', title: '2. Sprint', goal: 'Cross the field in 7 s', n: 1, need: 1, intro: ['Push the stick right to its edge to sprint. The stamina bar drains while you sprint.', 'Ride from your goal line to the far goal line in 7 seconds.'] },
  { id: 'swing', title: '3. Swing', goal: 'Score 3 goals from 5 balls', n: 5, need: 3, intro: ['A ball is placed ahead of you. Ride past it with the ball on your right, and hold then release SWING when the ring turns green.', 'Aim at the goal by steering toward it as you let go.'] },
  { id: 'power', title: '4. Power and aim', goal: 'Hit the target circle 3 times from 5', n: 5, need: 3, intro: ['Hit the ball into the glowing circle. Hold SWING longer for more distance and steer to aim.'] },
  { id: 'hook', title: '5. Hook', goal: 'Hook a rival\'s stroke 3 times', n: 5, need: 3, intro: ['A rival rides beside you and winds up for a stroke. Press HOOK while he is winding up to knock his mallet away.'] },
  { id: 'quiz', title: '6. Rules quiz', goal: 'Answer 4 of 5 correctly', quiz: true, need: 4, intro: ['Five short questions about the rules of this game.'] },
];

export const QUIZ = [
  { q: 'Which way does the ball go when you let go of SWING while steering?', a: ['Where you steer', 'Always straight ahead', 'Toward the nearest rival'], ok: 0 },
  { q: 'When does the green ring show around the ball?', a: ['When the ball is in reach of a stroke', 'When the ball is out of play', 'When a rival is close'], ok: 0 },
  { q: 'What happens if you cut across a rival and the horses collide at speed?', a: ['A foul and a free hit to the other team', 'Nothing', 'A goal is cancelled'], ok: 0 },
  { q: 'What does HOOK do?', a: ['Knocks away a rival who is winding up a stroke', 'Picks up the ball', 'Makes the horse jump'], ok: 0 },
  { q: 'How do you sprint?', a: ['Push the stick to its edge', 'Tap SWING twice', 'Hold HOOK'], ok: 0 },
];
