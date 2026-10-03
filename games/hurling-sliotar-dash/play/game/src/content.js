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

const lv = LEVELS.map((l) => `${'★'.repeat(l.stars)}${'☆'.repeat(5 - l.stars)} ${l.name}`);
export const RULES = [
  { title: 'The pitch and the goals', art: 'pitch', p: [
    `The pitch is ${PITCH_TEXT}, a shortened pitch for six a side (the full pitch is far bigger). Each end has a goal: two posts ${m(GOAL_HW * 2)} m apart and ${POST_H} m high, a crossbar ${BAR} m above the ground and a net below it. The ball is in play inside the sidelines and end lines.`,
    `Markings: a small rectangle ${SMALL_D} m deep in front of each goal, and lines ${LINE_13} m and ${LINE_20} m from each end line.`,
  ] },
  { title: 'Teams and roles', p: [
    'Each team has six players: goalkeeper, two backs, midfielder, half forward and full forward. You pick one role (full forward, midfielder, back or goalkeeper) and control that player; all other players are computer-controlled. Your teammates and the rivals each have their own level. You cannot change role during a match.',
  ] },
  { title: 'Time and winning', p: [
    `A match is two halves of ${HALF_SEC / 60} minutes; a Quick match is one half. The clock runs in play and during restarts, and stops during the pause after a score. The match ends the moment time is up; more points wins, equal totals are a draw. Ends are not changed at half time: your team always attacks the far goal. Each half starts with a throw-in at the centre.`,
  ] },
  { title: 'Scoring', art: 'goal', p: [
    'Between the posts and over the crossbar: a point (1). Between the posts and under the crossbar into the net: a goal (3). Scores read goals-points: 1-05 is 8 points, and the total is shown under it.',
    'A ball that hits a post or the crossbar plays on. A ball over the end line outside the posts is a wide (puck-out). If the defence puts it over its own end line outside the posts, the attackers get a long free (see Restarts).',
  ] },
  { title: 'In the hand and the solo run', art: 'solo', p: [
    `A caught or picked-up ball stays in the hand for up to ${HAND_MAX_STEPS} steps or ${HAND_MAX_SEC} seconds, then settles on the hurley. Carried on the hurley (the solo run) it bounces up and drops back every ${SOLO_PERIOD} seconds.`,
    'Catches are automatic when a ball flies within reach at chest or head height. Slow balls and balls meant for that player are caught more often; fast shots are often only knocked down.',
  ] },
  { title: 'Rising the ball', p: [
    `A ball on the ground is picked up with the hurley, not the hand: the bas goes under it and flicks it up. It takes ${GROUND_SEC} seconds and needs the ball low and not too fast. If the ball moves away or a rival is first, it misses.`,
  ] },
  { title: 'Striking', art: 'bar', p: [
    `STRIKE from the hand tosses the ball up and hits it ${TOSS_SEC} seconds later; from the ground it hits a loose ball in reach after ${GROUND_SEC} seconds. Hold the button: the bar fills in ${CHARGE_SEC} seconds. Released below the middle it is a drive (fast, low: a goal try); past the middle it is a loft (high, for a point, farther the later you release). The closer to a zone's centre, the more accurate and faster the strike.`,
    `A strike aimed within ${ASSIST_DEG} degrees of the goal mouth is pulled towards it (aim assist, see Settings). Rivals strike with the same rules.`,
  ] },
  { title: 'Hand-pass', p: [
    `PASS hits the ball with the hand to the teammate nearest the stick direction (within ${ASSIST_DEG} degrees, else straight ahead). It takes ${PASS_SEC} seconds. The receiver catches it automatically, more reliably than any other ball.`,
  ] },
  { title: 'Hook, block, shoulder', art: 'hook', p: [
    `HOOK is one swing (${HOOK_SEC} seconds) that does what the moment needs. Hook: a rival solo runner's ball is exposed while it is up in the air, ${pct(EXPOSE_TO - EXPOSE_FROM)} percent of each bounce; a swing that lands then, with the ball within ${HOOK_REACH} m of where the stick meets it (about a metre in front of you), knocks it loose. A burst protects the runner for a moment. Block: a ball in flight near you is knocked down, more often when slow and for better players; a defender can also block down a rival's strike while it is being wound up. Shoulder: within ${SHOULDER_REACH} m of a rival who has the ball or is near it, a clean shoulder pushes them back and can win the ball.`,
    `Fouls: a hook when the ball is not exposed is called a high stick ${pct(FOUL_HOOK_P)} percent of the time; a shoulder on a rival far from the ball is always a foul. The other team takes a free from that spot.`,
  ] },
  { title: 'Goalkeeper', p: [
    `SAVE blocks about ${KEEPER_REACH} m around the hurley; a dive reaches ${KEEPER_DIVE} m to the side. A keeper reads a striker's wind-up. After a score, a wide or a ball collected in the small rectangle, the keeper takes the puck-out with the STRIKE bar.`,
  ] },
  { title: 'Restarts', p: [
    'Puck-out: after a point, goal or wide the keeper of the team that did not score takes the ball in the hand in front of the goal and strikes it out.',
    `Free: after a foul the other team takes a free from the spot, rivals ${FREE_BACK_M} m back. A ball over the sideline gives the other team a free from the line. A long free is taken from the ${LINE_20} m line after a defender puts the ball over his own end line. Play restarts anyway after ${RESTART_MAX_SEC} seconds.`,
  ] },
  { title: 'Stamina and burst', p: [
    `Sprinting drains stamina and slows you a little when low; it refills when you slow down. BURST (while carrying) is a dodge of ${BURST_SEC} seconds, usable every ${BURST_CD} seconds, and makes a hook against you miss.`,
  ] },
  { title: 'Rival levels', p: [
    ...lv,
    'Rivals use the same rules, physics and strikes as you. Stronger teams react faster, run quicker, choose better passes and shots, strike more accurately and time hooks and saves better. Each level beats the one below in simulation.',
  ] },
  { title: 'Think and Watch & Learn', art: 'think', p: [
    'Think pauses the match and shows what a good player in your role would do, with the real numbers behind it. It never acts for you.',
    'Watch & Learn plays a full match between two computer teams. At each key decision (a pass, a shot, a puck-out) the play freezes for Think (5 seconds by default, 2 to 10 in Settings), then Reveal (2 seconds: the choice and the reason), then Act. Pause stops everything.',
  ] },
  { title: 'What this game simplifies', p: [
    'Six a side on a shortened pitch (the traditional game is fifteen a side on a far larger one); goal 4 m wide. No substitutions, cards or change of ends. Steps in the hand are counted for you, the free taker is the nearest player, and the solo bounce is automatic. Contact is clean and non-violent.',
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
