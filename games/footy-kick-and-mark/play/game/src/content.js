// Text for About, How to Play, the Learn lessons and the Rules reference. Numbers come from the engine's own constants.
import * as K from './consts.js';

const q = Math.round;
export const ABOUT = [
  { title: 'Footy: Kick and Mark', art: 'pitch', p: [
    'This is a simplified, original take on the Australian football tradition, a kicking and catching ball sport played on a big oval. The sport grew in Melbourne in the 1850s, and its first written rules date from 1859. Today it is played in cities and towns across Australia and in other countries.',
    'The sport is known for the mark, a clean catch of a kicked ball, often taken high above a pack of players, and for its four goal posts: six points between the middle two, one point for a behind.',
  ] },
  { title: 'This version', p: [
    `You choose one player on a team of six and run only that player: forward, midfielder, defender or ruck/back. Every other player is computer-controlled, on both sides. The pitch is a small oval (${K.HW * 2} by ${K.HL * 2} m) and a quarter lasts ${K.QUARTER / 60} minutes, so a match fits a short break.`,
    'The rules are simplified and an original design; they are not the official laws. Rules lists every simplification. The game has no connection to any league, club or federation, and all team names and kits are made up.',
  ] },
  { title: 'Made with', p: ['The players, ball and pitch are drawn in real 3D from a fixed camera. The full licence credits for the 3D library and the movement data follow on the next page.'] },
];

export const HOWTO = [
  { title: 'The aim', art: 'pitch', p: [
    `Score more points than the computer team over four quarters of ${K.QUARTER / 60} minutes (Quick match: two quarters). Kick the ball between the two middle posts for a goal (${K.GOAL_PTS} points), or between a middle post and an outer post for a behind (${K.BEHIND_PTS} point).`,
    'You always attack the far end of the pitch (the end at the top of the screen).',
  ] },
  { title: 'Pick your role', art: 'roles', p: [
    'Forward: lead into open space, mark the ball and kick goals. Midfielder: win the ball at the contest and share it. Defender: stop their forwards, spoil and tackle. Ruck / back: jump for the ball-up at the start of each quarter and after every goal, then cover behind the play.',
    'Each role has its own lesson in Learn. You can change role only between matches.',
  ] },
  { title: 'Move', art: 'sticks', p: [
    'Put your left thumb anywhere in the lower left and drag: that is the stick. Hold RUN (right side) to sprint; it uses stamina. On a keyboard: arrow keys or WASD, Shift to run.',
    'Your player is circled in gold with an arrow above his head.',
  ] },
  { title: 'Kick and handball', art: 'kick', p: [
    'With the ball, the big red button is KICK and the green button is HANDBALL. Push the stick towards the player you want to find: a teal ring and a dotted line show where the ball will go. If a goal is in range and you aim at it, the ring sits on the goal.',
    'A handball is a short, quick pass (up to 11 m) and is the only way to get rid of the ball once you are tackled. A kick goes up to about 46 m.',
  ] },
  { title: 'Mark', art: 'mark', p: [
    'When a kicked ball is in the air the red button becomes MARK. A gold ring on the ground shows where the ball will come down. Run to the ring and press MARK when the ball is about a third of a second away: you jump with your hands up. Too early and you land before the ball.',
    `A clean catch of a kick that travelled at least ${K.MARK_MIN} m is a mark: play stops and you get a free kick. Defenders can press SPOIL instead to punch the ball away.`,
  ] },
  { title: 'Set shots', art: 'meter', p: [
    `After a mark or a free kick nobody can touch you; opponents stand back ${K.MARK_STAND} m. A bar swings left and right: press KICK when the marker is in the middle for the straightest kick. Or press PLAY ON to run with the ball.`,
  ] },
  { title: 'Tackle', art: 'tackle', p: [
    'When an opponent has the ball close to you the red button is TACKLE. Tackles from behind or the side work best. A tackled player must handball within about three quarters of a second or the umpire pays holding the ball: a free kick for you.',
    'Tackles are clean wrap-ups around the waist. There is no bumping.',
  ] },
  { title: 'Think, Learn and Watch', art: 'think', p: [
    'Think pauses the game and the coach gives advice and the reason for it. Learn has short lessons for every skill and role. Watch & Learn lets two computer teams play: it stops before each big decision so you can think first, then reveals the choice and the reason.',
  ] },
];

const pct = (v) => `${q(v * 100)}%`;
export const RULES = [
  { title: 'The pitch', art: 'pitch', p: [
    `The pitch is an oval ${K.HW * 2} m wide and ${K.HL * 2} m long (a much smaller ground than the real sport; the players are drawn 1.25 times life size so they read on a phone). A goal line runs across each end ${K.ZG} m from the centre. Four posts stand on it: two goal posts ${K.GHW * 2} m apart in the middle, and a behind post ${+(K.BHW - K.GHW).toFixed(2)} m outside each of them.`,
    'You attack the far end. The computer team attacks the near end. Ends are never swapped.',
  ] },
  { title: 'Teams and roles', p: [
    'Each team has six players on the pitch: one ruck/back, two midfielders, two forwards and one defender. You run exactly one of them (chosen before the match); the other eleven are computer players. There are no substitutions.',
    'Every role has its own speed, leap, marking and tackling strengths. Ruck/back players leap highest but are slower; midfielders are fastest; defenders tackle best.',
  ] },
  { title: 'Time', p: [
    `A full match has four quarters of ${K.QUARTER / 60} minutes; a Quick match has two. The clock runs only while the ball is in play: it stops for ball-ups, set shots and after scores. When the siren sounds, play continues until the next stoppage; a free kick already awarded may still be taken. The last play ends at most 25 seconds after the siren.`,
    'The side with more points wins. A draw is possible and is a draw.',
  ] },
  { title: 'Starting play: the bounce and the ball-up', p: [
    'Each quarter starts, and play restarts after every goal, with a bounce at the centre: the ball is bounced high between the two ruck players. Rucks jump and tap it towards a teammate; no one can mark a bounce or a ball-up.',
    'A ball-up (the ball thrown up) restarts play at the place where the ball went out of bounds (see below). The two nearest players, one from each side, contest it.',
  ] },
  { title: 'Moving and stamina', p: [
    `Players jog at about ${K.JOG} m per second and sprint at about ${K.SPRINT} m per second. Sprinting drains stamina; it refills when you jog or stand. A player carrying the ball is about 6% slower. There is no limit to how far you may carry the ball and nothing to bounce.`,
  ] },
  { title: 'Kicking', art: 'kick', p: [
    'A kick is a drop punt: the ball is released from the hands and kicked as it falls. It takes about a third of a second from the press to the ball leaving the foot. The computer works out the power so the ball reaches the player you aim at; a kick can travel up to about 46 m.',
    'Accuracy gets worse with distance, with an opponent within about 3 m (pressure) and when you are running fast. Set shots with the timing bar can be much more accurate; a perfect press gives a kick almost four times straighter than the worst press.',
  ] },
  { title: 'Handball', p: [
    'A handball is a short punch pass, up to 11 m. It is quick and accurate, and it is the only disposal allowed once you are tackled. A handball can be caught but is never a mark.',
  ] },
  { title: 'Marking', art: 'mark', p: [
    `A mark is a clean catch of a kick that has travelled at least ${K.MARK_MIN} m, has not touched the ground and has not been touched by another player. A mark stops play and gives the marker a free kick. A catch of a handball, a tap or a short kick is not a mark: play goes on.`,
    `Players can reach about ${K.REACH} m standing with their hands overhead (the ball must be within easy reach of both hands, in front of the chest) and higher in a jump (a leap of ${K.ATTR[1].leap} to ${K.ATTR[0].leap} m depending on role). When more than one player can reach the ball, the contest is decided by how close each is to the ball, by timing (hands up at the top of the jump), by skill, and a little luck. A defender who presses SPOIL beats a mark unless the marker wins clearly. A winner holds the ball cleanly most of the time; otherwise it is dropped.`,
  ] },
  { title: 'Free kicks and play on', p: [
    `After a mark or a free kick the player stands at that spot. Opponents move back ${K.MARK_STAND} m and cannot tackle. He may kick, or play on (handball button): then the opponents are free to close in again. Players have 14 seconds to act before the kick is taken automatically.`,
    'Free kicks are given for: a mark, holding the ball, and a ball kicked out of bounds on the full.',
  ] },
  { title: 'Tackling', art: 'tackle', p: [
    `A player can tackle an opponent who has the ball when he is within about 3.4 m. A tackle takes about a quarter of a second to land and needs a short wait (about 1 second) before the same player can try again. Tackles are clean wrap-ups; there is no bumping, no high contact and no hits to the head.`,
    `Whether a tackle holds depends on the tackler's skill, the angle (from behind or the side is best, from the front is hardest) and how fast the ball carrier is running. A tackled carrier has ${K.HOLD_UNDER_TACKLE} seconds to handball. If he does not, it is holding the ball and the tackler's team gets a free kick. A failed tackle leaves the tackler off balance for half a second.`,
  ] },
  { title: 'Loose ball', p: [
    'A ball on the ground is picked up by the nearest player who reaches it (a quick stoop). A ball bounces oddly because it is oval: each bounce goes a little sideways and a little low. A ball rolling faster than about 4.5 m per second cannot be picked up; balls up to about knee height are scooped up with a stoop. A player who has just kicked cannot pick the ball up for half a second.',
  ] },
  { title: 'Scoring', art: 'posts', p: [
    `Goal, ${K.GOAL_PTS} points: the ball crosses the goal line between the two goal posts, was last kicked by the attacking team and has not been touched by anyone since that kick (it may bounce first). Behind, ${K.BEHIND_PTS} point: it crosses between a goal post and a behind post, or between the goal posts after being touched (a spoil, a fumble or a tap), or after being last touched by a defender.`,
    'After a goal, play restarts with a bounce at the centre. After a behind, the defending team takes a kick-in from the goal square as a free kick.',
  ] },
  { title: 'Out of bounds', p: [
    'If the ball goes out of the oval after being kicked and without touching the ground or any player (out on the full), the other team gets a free kick at that spot. If it goes out any other way, play restarts with a ball-up just inside the boundary.',
  ] },
  { title: 'The computer players', p: [
    'There are five levels: Rookie, Club, Regional, State and Champion. Each level beats the one below it in simulated matches. Higher levels react faster, kick straighter, mark and tackle better, run a little faster and choose better passes. Your own teammates play at the same level as the opponents you chose.',
  ] },
  { title: 'Think, Learn and Watch & Learn', art: 'think', p: [
    'Think pauses the game and gives advice for your role with the real reason, worked out from the positions of the players and the same numbers the computer players use. Learn has lessons for every skill and role. Watch & Learn plays a match between two computer teams; before each important kick or handball it pauses so you can think (default 5 seconds, up to 10), then reveals the options and the chosen one, then plays on. Pause freezes everything.',
  ] },
  { title: 'Simplifications', p: [
    `This is an original simplified version, not the official laws: six players a side on a ${K.HW * 2} by ${K.HL * 2} m oval; ${K.QUARTER / 60}-minute quarters; a mark needs ${K.MARK_MIN} m (the real sport uses 15 m); no ends swapped between quarters; no substitutions, no umpire signals, no interchange, no throw-ins (a ball-up instead), no deliberate-out or high-contact rules; free kicks are the mark, holding the ball and out on the full only; the ball and goal posts are an original design. The Continue button resumes at a centre ball-up with the same score and clock.`,
  ] },
];

export const LESSONS = [
  { id: 'basics', title: '1. Run and handball', goal: 'Handball to your teammate 3 times', drill: 'basics', n: 3, need: 3, intro: ['You have the ball. A teammate stands ahead of you. Push the stick towards him and press the green HANDBALL button. The teal ring shows who will get it.', 'Try three times.'] },
  { id: 'marking', title: '2. Take a mark', goal: 'Mark 3 of 5 kicks', drill: 'marking', n: 5, need: 3, intro: ['A teammate kicks the ball to you. Run to the gold ring on the ground and press MARK when the ball is about a third of a second above it.', 'You need to catch 3 of 5.'] },
  { id: 'kicking', title: '3. Kick for goal', goal: 'Kick 2 goals from 4 tries', drill: 'kicking', n: 4, need: 2, intro: ['You have a free kick in front of goal. A bar swings left and right: press KICK when the marker is in the middle. Aim at the goal with the stick (the teal ring sits on it).', 'Kick 2 goals from 4 tries.'] },
  { id: 'tackling', title: '4. Tackle', goal: 'Tackle 3 of 5 runners', drill: 'tackling', n: 5, need: 3, intro: ['An opponent runs with the ball. Chase him and press TACKLE when you are close: from behind is best. A tackle that holds counts.', 'Hold 3 of 5.'] },
  { id: 'role-fwd', title: '5. Role: Forward', goal: 'Mark 2 of 4 leads', drill: 'fwd', n: 4, need: 2, intro: ['Forwards score. A teammate has the ball in the middle. Run into the open space (the gold ring on the ground) and he will kick to you. Mark it, then kick for goal.', 'Mark 2 of 4.'] },
  { id: 'role-mid', title: '6. Role: Midfielder', goal: 'Win 2 of 3 ball-ups and handball on', drill: 'mid', n: 3, need: 2, intro: ['Midfielders win the ball when the ruck taps it. After the ball-up run to the ball, pick it up (just run over it) and handball to a teammate.', 'Do it 2 times out of 3.'] },
  { id: 'role-def', title: '7. Role: Defender', goal: 'Spoil or mark 3 of 5', drill: 'def', n: 5, need: 3, intro: ['Defenders stop forwards. An opponent leads and a kick is coming. Run to the ring, then press MARK (or SPOIL to punch it away) at the right moment.', 'Stop 3 of 5.'] },
  { id: 'role-ruck', title: '8. Role: Ruck / back', goal: 'Tap 3 of 5 ball-ups', drill: 'ruck', n: 5, need: 3, intro: ['At the ball-up the ball goes up between the two rucks. Stand under it and press TAP as it comes down. Push the stick towards a teammate to steer the tap.', 'Tap 3 of 5.'] },
  { id: 'quiz', title: '9. Rules quiz', goal: 'Answer 5 of 6 correctly', quiz: true, need: 5, intro: ['Six quick questions on how the game works.'] },
];
export const QUIZ = [
  { q: `How many points is a goal?`, a: ['1', '3', `${K.GOAL_PTS}`], ok: 2 },
  { q: 'What is a behind worth, and when?', a: ['1 point: between a goal post and a behind post', '6 points: between the outer posts', '0 points: it is a miss'], ok: 0 },
  { q: 'What makes a catch a mark?', a: ['Any catch', `A clean catch of a kick that travelled ${K.MARK_MIN} m or more`, 'A catch of a handball'], ok: 1 },
  { q: 'You are tackled with the ball. What must you do?', a: ['Kick it', 'Handball it quickly', 'Hold it tight'], ok: 1 },
  { q: 'What happens after a mark?', a: [`Opponents stand back ${K.MARK_STAND} m and you may kick or play on`, 'Play continues at once', 'A ball-up'], ok: 0 },
  { q: 'When does the ruck press TAP?', a: ['As the ball goes up', 'As it comes back down within reach', 'It does not matter'], ok: 1 },
];
export const ROLE_INFO = {
  fwd: { name: 'Forward', blurb: 'Lead, mark, kick goals', text: 'Run into open space near goal so teammates can kick to you. Mark the ball, then kick for goal. Best at marking and finishing; weaker at tackling.', lesson: 4 },
  mid: { name: 'Midfielder', blurb: 'Win the ball and share it', text: 'The fastest player. Run to loose balls after ball-ups, pick them up, and handball or kick to the open player. Support the carrier.', lesson: 5 },
  def: { name: 'Defender', blurb: 'Stop their forwards', text: 'Stay between the ball and their forwards. Spoil kicks, mark the ball in front of them, tackle carriers. Best tackler.', lesson: 6 },
  ruck: { name: 'Ruck / back', blurb: 'Jump at the ball-up, cover behind', text: 'The highest leap. Tap the ball-up to your midfielders, then drop back to cover behind the play. Slower than the others.', lesson: 7 },
};
void pct;
