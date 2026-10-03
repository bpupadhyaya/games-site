// Text for About, How to Play, the Learn drills and the Rules reference. Numbers come from the engine's own constants.
import { HW, HL, GOAL_HW, BAR, POST_H, SMALL_D, LINE_13, LINE_20, HALF_SEC, SOLO_PERIOD, CHARGE_SEC, LEVELS, ROLES, HAND_MAX_SEC, HAND_MAX_STEPS, EXPOSE_FROM, EXPOSE_TO, BURST_SEC, BURST_CD, HOOK_REACH, SHOULDER_REACH, FOUL_HOOK_P, RESTART_MAX_SEC, FREE_BACK_M, TOSS_SEC, GROUND_SEC, PASS_SEC, HOOK_SEC, ASSIST_DEG, KEEPER_REACH, KEEPER_DIVE } from './consts.js';
const pct = (x) => Math.round(x * 100);

const m = (v) => String(v);
export const PITCH_TEXT = `${HL * 2} m by ${HW * 2} m`;

export const ABOUT = [
  { title: 'The fast field game of Ireland', art: 'pitch', p: [
    'Hurling is an ancient Gaelic game from Ireland, with roots going back many centuries. Players use a wooden stick, the hurley, to strike, carry and pass a small ball called the sliotar. It is often described as one of the fastest field games in the world.',
    'The ball can be struck in the air or on the ground, caught and carried a few steps in the hand, balanced and bounced on the hurley while running (the solo run), or passed with the hand. A ball over the crossbar between the posts scores one point; a ball under the crossbar into the net scores three.',
  ] },
  { title: 'This version', p: [
    'You play a six-a-side game on a shorter pitch. You choose one role (full forward, midfielder, back or goalkeeper) and control that player; the other eleven players are computer-controlled. Five levels of opponent test you, Learn teaches the skills in short drills, and Watch & Learn lets you watch two computer teams while the game explains their choices.',
    'The rules follow the traditional game where a phone game can. The Rules pages list every simplification honestly.',
  ] },
];

export const HOWTO = [
  { title: 'Pick a role', art: 'pitch', p: [
    'Choose Full forward (score), Midfielder (everywhere), Back (stop the forwards) or Goalkeeper (guard the goal). You control that one player for the whole match; the other eleven play themselves. You cannot change role during a match.',
  ] },
  { title: 'Move and sprint', p: [
    'Put a thumb anywhere in the lower left and drag: the stick floats under your thumb. Push all the way to sprint; sprinting uses stamina, which refills when you slow down. Your player is marked with a white ring and arrow.',
  ] },
  { title: 'Rise, solo and pass', art: 'solo', p: [
    'RISE picks a loose ball up on your hurley and flicks it into your hand. After a few steps the ball settles on the hurley and bounces as you run (solo). While carrying, RISE becomes BURST: a short dodge.',
    'PASS hand-passes to the teammate in the direction of the stick; with no teammate there it goes ahead.',
  ] },
  { title: 'Strike: goal or point', art: 'bar', p: [
    `Hold STRIKE: a bar fills in about ${CHARGE_SEC} seconds. Release in the GOAL zone (a quick, low drive at the goal, worth 3 under the bar) or in the POINT zone (a long, high strike over the bar, worth 1). A release in the middle of a zone is the most accurate. Aim with the stick. If the ball is on the ground close to you, STRIKE hits it first time.`,
  ] },
  { title: 'Hook, block and shoulder', art: 'hook', p: [
    'HOOK swings the hurley. It hooks the ball off a rival solo runner while it is bouncing up (the window is about half of each bounce), blocks a ball flying at you, or becomes a clean shoulder challenge when you are right next to a rival who has the ball. A blind swing at a rival can be a foul.',
  ] },
  { title: 'Goalkeeper', p: [
    'The keeper moves along the goal line. SAVE blocks with the hurley; if the ball is far to one side the keeper dives. CLEAR (STRIKE) puts the ball out of danger; after a score or a wide the keeper takes the puck-out.',
  ] },
  { title: 'Think and Watch & Learn', art: 'think', p: [
    'Think pauses the match and tells you what a good player would do right now, and why. It never plays for you.',
    'Watch & Learn plays a whole match between two computer teams. Each key decision has three steps: Think, Reveal, Act. Pause stops everything.',
  ] },
];

export const RULES = [
  { title: 'The pitch and the goals', art: 'pitch', p: [
    `The pitch is ${PITCH_TEXT}, shortened for six a side. Each end has a goal: two posts ${m(GOAL_HW * 2)} m apart and ${POST_H} m high, a crossbar ${BAR} m above the ground and a net below it. A small rectangle ${SMALL_D} m deep is marked in front of each goal, with lines ${LINE_13} m and ${LINE_20} m from each end line.`,
  ] },
  { title: 'Teams and roles', p: [
    'Six players a side: goalkeeper, two backs, midfielder, half forward, full forward. You pick one role and control that player for the whole match; everyone else is computer-controlled, teammates and rivals each at their own level.',
  ] },
  { title: 'Time and winning', p: [
    `A match is two halves of ${HALF_SEC / 60} minutes; a Quick match is one half. The clock stops during the pause after a score. More points wins; equal totals are a draw. Your team always attacks the far goal, and each half starts with a throw-in at the centre.`,
  ] },
  { title: 'Scoring', art: 'goal', p: [
    'Between the posts and over the crossbar: a point (1). Between the posts and under the crossbar: a goal (3). Scores read goals-points, so 1-05 is 8 points.',
    'A ball that hits a post or the crossbar plays on. Over the end line outside the posts is a wide (puck-out); if the defence does it, the attackers get a long free.',
  ] },
  { title: 'In the hand and the solo run', art: 'solo', p: [
    `A caught or picked-up ball stays in the hand for up to ${HAND_MAX_STEPS} steps or ${HAND_MAX_SEC} seconds, then settles on the hurley. Carried on the hurley (the solo run) it bounces every ${SOLO_PERIOD} seconds.`,
    'Catches are automatic within reach at chest or head height; slow balls and balls meant for that player are caught more often, fast shots are often only knocked down.',
  ] },
  { title: 'Rising the ball', p: [
    `A ball on the ground is flicked up with the hurley. It takes ${GROUND_SEC} seconds and needs the ball low and not too fast; if it moves away or a rival is first, it misses.`,
  ] },
  { title: 'Striking', art: 'bar', p: [
    `STRIKE from the hand tosses the ball up and hits it ${TOSS_SEC} seconds later; from the ground it hits a loose ball in reach after ${GROUND_SEC} seconds. The bar fills in ${CHARGE_SEC} seconds. Released below the middle it is a drive (fast, low: a goal try); past the middle it is a loft (high, for a point, farther the later you release). Nearer a zone's centre is more accurate and faster.`,
    `A strike aimed within ${ASSIST_DEG} degrees of the goal mouth is pulled towards it (aim assist, see Settings). Rivals follow the same rules.`,
  ] },
  { title: 'Hand-pass', p: [
    `PASS goes to the teammate nearest the stick direction (within ${ASSIST_DEG} degrees, else straight ahead). It takes ${PASS_SEC} seconds and is caught more reliably than any other ball.`,
  ] },
  { title: 'Hook, block, shoulder', art: 'hook', p: [
    `HOOK is one swing (${HOOK_SEC} seconds). Hook: a rival solo runner's ball is exposed while it is up in the air, ${pct(EXPOSE_TO - EXPOSE_FROM)} percent of each bounce; a swing then, with the ball within ${HOOK_REACH} m of where the stick meets it (about a metre in front of you), knocks it loose. A burst protects the runner for a moment. Block: a ball in flight near you is knocked down, more often when slow; a defender can also block down a strike being wound up. Shoulder: within ${SHOULDER_REACH} m of a rival who has the ball or is near it, a clean shoulder pushes them back and can win the ball.`,
    `Fouls: a hook when the ball is not exposed is a high stick ${pct(FOUL_HOOK_P)} percent of the time; a shoulder on a rival far from the ball is always a foul. The other team takes a free.`,
  ] },
  { title: 'Goalkeeper', p: [
    `SAVE blocks about ${KEEPER_REACH} m around the hurley; a dive reaches ${KEEPER_DIVE} m to the side. A keeper reads a striker's wind-up and takes the puck-out with the STRIKE bar.`,
  ] },
  { title: 'Restarts', p: [
    'Puck-out: after a point, goal or wide the other team\'s keeper strikes the ball out from in front of the goal.',
    `Free: after a foul the other team takes a free from the spot, rivals ${FREE_BACK_M} m back; a ball over the sideline is a free from the line; a long free is taken from the ${LINE_20} m line. Play restarts anyway after ${RESTART_MAX_SEC} seconds.`,
  ] },
  { title: 'Stamina and burst', p: [
    `Sprinting drains stamina; it refills when you slow down. BURST (while carrying) is a dodge of ${BURST_SEC} seconds, usable every ${BURST_CD} seconds, and makes a hook against you miss.`,
  ] },
  { title: 'Rival levels', p: [
    `${LEVELS.map((l) => l.name).join(', ')}: five levels, weakest to strongest. Rivals use the same rules; stronger teams react faster, run quicker and strike, hook and save better.`,
  ] },
  { title: 'Think and Watch & Learn', art: 'think', p: [
    'Think pauses the match and shows what a good player in your role would do, and why. It never acts for you.',
    'Watch & Learn plays two computer teams. At each key decision the play freezes for Think (5 seconds by default, 2 to 10 in Settings), then Reveal (2 seconds: the choice and the reason), then Act. Pause stops everything.',
  ] },
  { title: 'What this game simplifies', p: [
    'Six a side on a shortened pitch (the traditional game is fifteen a side); goal 4 m wide. No substitutions, cards or change of ends. Steps in the hand are counted for you, the free taker is the nearest player, and the solo bounce is automatic.',
  ] },
];

export const LESSONS = [
  { id: 'rise', title: '1. Move and rise', goal: 'Pick up 4 of 5 loose balls', n: 5, need: 4, drill: { kind: 'rise' }, role: 3, intro: [
    'A ball is rolled to you. Drag the stick to run to it, then press RISE when it is close and slow. The hurley flicks it into your hand.',
    'Keep the ring on you: move to where the ball is going, not where it is.',
  ] },
  { id: 'point', title: '2. Strike over the bar', goal: 'Score 3 points from 5 strikes', n: 5, need: 3, drill: { kind: 'point' }, role: 5, intro: [
    'You have the ball near the goal. Aim at the goal with the stick, hold STRIKE and release in the POINT zone (the right one) as the bar fills. The ball must go between the posts and over the bar.',
  ] },
  { id: 'goal', title: '3. Drive under the bar', goal: 'Score 2 goals from 5 drives', n: 5, need: 2, drill: { kind: 'goal' }, role: 5, intro: [
    'Closer to goal, release in the GOAL zone (the left one): a quick low drive. A goalkeeper is on the line and will try to save, so aim away from them.',
  ] },
  { id: 'pass', title: '4. Hand-pass', goal: 'Complete 3 of 5 passes', n: 5, need: 3, drill: { kind: 'pass' }, role: 3, intro: [
    'A teammate runs across in front of you. Point the stick at them and press PASS. A pass into their path is easier to catch than one at their feet.',
  ] },
  { id: 'solo', title: '5. Solo run and burst', goal: 'Run past the chaser to the line twice in 3 tries', n: 3, need: 2, drill: { kind: 'solo' }, role: 3, intro: [
    'Run with the ball from your half to the far line. A rival chases you and swings for a hook each time the ball bounces up. Press BURST as they close in, and run away from them.',
  ] },
  { id: 'hook', title: '6. Hook', goal: 'Win the ball 3 times from 5 carriers', n: 5, need: 3, drill: { kind: 'hook' }, role: 1, intro: [
    'A rival runs with the ball bouncing on the hurley. Get close, and press HOOK just before the ball bounces up (it is exposed for about half of each bounce). A swing when the ball sits on the hurley may be a foul.',
  ] },
  { id: 'keeper', title: '7. Goalkeeper saves', goal: 'Save 2 of 5 shots', n: 5, need: 2, drill: { kind: 'keeper' }, role: 0, intro: [
    'You are the goalkeeper. Move along the line with the stick. Press SAVE as a shot comes: the hurley covers about one metre each side, and a ball far to one side makes the keeper dive.',
  ] },
  { id: 'rules', title: '8. Rules quiz', goal: 'Answer 4 of 5 questions', quiz: true, need: 4, intro: ['Five short questions about the rules.'] },
];

export const QUIZ = [
  { q: 'A ball goes between the posts and under the crossbar into the net. How many points?', a: ['One', 'Three', 'Five'], ok: 1 },
  { q: 'A ball goes between the posts and over the crossbar. How many points?', a: ['One', 'Three', 'Two'], ok: 0 },
  { q: 'How is the ball picked up from the ground?', a: ['With the hand', 'With the hurley (a rising pick-up)', 'By kicking it up'], ok: 1 },
  { q: 'When is a rival solo runner most open to a hook?', a: ['While the ball sits on the hurley', 'While the ball is bouncing up in the air', 'Never'], ok: 1 },
  { q: 'Who takes a puck-out after a point?', a: ['The keeper of the team that conceded', 'The full forward', 'The referee'], ok: 0 },
];
void HL;
