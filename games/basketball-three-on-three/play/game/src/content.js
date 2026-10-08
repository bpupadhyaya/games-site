// Text content: About, How to Play, the exhaustive Rules, the Learn lessons and the quiz. Every number comes from consts.js so the
// Rules can never disagree with the engine.
import { ARC_R, ARC_X, SHOT_CLOCK, GAME_LEN, ROLES, LEVELS, FT_Z, HOOP, RIM_R } from './consts.js';

const m1 = (v) => String(Math.round(v * 100) / 100);
const FULL = GAME_LEN.full, QUICK = GAME_LEN.quick;
const mins = (s) => `${Math.round(s / 60)} minutes`;

export const ABOUT = [
  { title: 'Basketball 3x3', p: ['A half-court basketball game for your phone. Three players a side share one hoop: you play one of them, the computer plays the rest.', 'Dribble, pass, set screens, time your shot and fight for rebounds against a computer team at five levels.'] },
  { title: 'The sport', p: ['Three-a-side basketball is played on a half court with a single hoop, in parks, school yards and city squares as well as in organised competitions around the world. Games are short, fast and physical, with one hoop, a short shot clock and a simple scoring rule: one point inside the arc, two beyond it.', 'This game follows the published rules of the sport, simplified where a phone screen needs it. The Rules pages list every simplification.'] },
  { title: 'How it was made', p: ['The players are stylised mannequins, animated with inverse kinematics so the hands meet the ball at the exact moment of every dribble, pass and release. The ball, the rim, the backboard and the net are simulated, and the picture is one fixed camera beside the court that never moves.', 'All sound is synthesised on your device. The game works offline and has no ads.'] },
];

export const HOWTO = [
  { title: 'Your first game', p: [
    'The camera looks at the half court from beside it, high above the near sideline, so you see all of it: the hoop is at the right, the half-court line at the left. Push the stick right to run towards the hoop, left to run away from it, up for the far sideline and down for the near one, as on the screen.','Choose a role: Guard, Wing or Big. You control that one player. The other five are computer players, and your two teammates play their roles for you.', 'Your player has a gold arrow and the tag YOU above his head. The left thumb moves him, the right thumb presses the round buttons. You can change the role between games, not during one.'] },
  { title: 'With the ball', p: ['SHOOT: press and hold, then let go in the green part of the meter. The sweet spot is the top of the jump. Shots from farther away and shots with a defender close have a narrower green zone.', 'PASS G / W / B: throw the ball to that teammate. The role letters are shown above your teammates.', 'CROSS: a quick crossover while you dribble. It can leave the nearest defender behind. Stop for a moment and you end your dribble: then you can only pass or shoot, or it is travelling.', 'Finish a drive at the rim and your player may dunk.', 'After the other team had the ball, take it behind the arc before you can shoot: the SHOOT button says CLEAR until you do.'] },
  { title: 'Without the ball', p: ['CALL: hold it to ask the ball handler for a pass. SCREEN: hold it to stand still and block defenders; the player you free up gets an open shot. CUT: a short burst to run into space.', 'When a shot is in the air, JUMP to go for the rebound. Time the jump when the ball is coming down.'] },
  { title: 'On defence', p: ['Stay between your player and the hoop. STEAL swipes at the ball: it works when the ball is low and away from the dribbler. BLOCK jumps with your hands up: time it as the shooter rises. BURST is a short sprint.', 'Watch the shot clock: if the other team cannot shoot in time, the ball is yours.'] },
  { title: 'Think, Pause, Watch & Learn', p: ['Think shows what a coach would do in your role right now, with the reason, and can mark the spot on the court. Pause freezes everything and offers Rules, text size and Save and quit.', 'Watch & Learn plays a whole game between two computer teams. Each decision is shown in three steps: THINK, REVEAL and ACT. Pause really pauses.', 'Learn has short practices for shooting, driving, screens, defence and rebounds.'] },
  { title: 'Keyboard', p: ['Arrow keys or WASD move. Space or J = the big button, K, L and I = the other buttons. T = Think, P or Escape = Pause. + and - change the text size on menus.'] },
];

export const RULES = [
  { title: 'The court and the game', art: 'court', p: [
    `Two teams of three share one hoop on a half court: 15 m wide and 11 m long. The rim is ${m1(HOOP.y)} m high. Your team is blue, the computer team is red. You control one player; the other five are computer players.`,
    'The ball, the ring and the backboard are drawn and simulated at real size next to the players, so the proportions between player, ball and ring are real.',
    `A full game ends when a team reaches ${FULL.points} points or when ${mins(FULL.seconds)} of game time have passed, whichever comes first. A quick game ends at ${QUICK.points} points or after ${mins(QUICK.seconds)}. When time runs out the higher score wins. A tie goes to overtime: the first team to score 2 more points wins.`,
    'The game clock runs while the ball is live and stops while the ball is dead (after a basket, a turnover, a foul or during free throws).',
  ] },
  { title: 'Scoring', p: [
    `A basket from inside the two-point line scores 1 point. A basket from beyond it scores 2 points. The line is an arc of radius ${m1(ARC_R)} m around the hoop, joined by straight lines ${m1(ARC_X)} m from the centre line at each side. The shooter's position when the ball is released decides the value.`,
    'A free throw scores 1 point.',
    'A layup or any shot counts when the ball passes down through the ring. Rim and backboard bounces are simulated, so a shot can roll in or out.',
  ] },
  { title: 'Roles', p: [
    `Guard: ${ROLES[0].blurb} Wing: ${ROLES[1].blurb} Big: ${ROLES[2].blurb}`,
    'The three roles differ in speed, shooting, ball handling, rebounding, blocking and strength. The opposing team has the same three roles.',
    'You choose one role before each game and play it for the whole game. The Learn page has a short practice for each role.',
  ] },
  { title: 'Starting and restarting', p: [
    'Check ball: at the start of the game, after overtime begins and after a dead ball that is not a basket (a shot-clock violation, the ball going out of bounds, a foul without free throws), play restarts at the top of the arc. A defender passes the ball to the attacking guard, who stands beyond the arc. The clock starts when the guard catches it.',
    'After a made basket the other team starts with the ball at the top of the arc, with no check. This is a simplification of taking the ball from under the hoop.',
    'Clearing: when a team wins the ball in play (a rebound, a steal or a block) it must take the ball behind the arc before it can shoot. The SHOOT button shows CLEAR until it has.',
  ] },
  { title: 'The shot clock', p: [
    `A team has ${SHOT_CLOCK} seconds from the moment it gets the ball to release a shot. The clock stops when a shot is released and starts again at ${SHOT_CLOCK} whenever a team gets the ball, including an offensive rebound.`,
    'If the clock reaches zero without a shot, the ball goes to the other team with a check ball. A shot released before zero counts as a shot, even if it misses everything.',
  ] },
  { title: 'Moving and dribbling', p: [
    'Dribbling is automatic: the player with the ball dribbles while you move him, and holds it in both hands until you start moving. If he stops for about a second the dribble is ended (the ball is picked up, a DRIBBLE ENDED note appears). From then on he may turn on his spot (a pivot of under one metre) and may only pass or shoot. If you walk on with the ball it is TRAVELLING; if you run off again as if to dribble it is a DOUBLE DRIBBLE. Either is a turnover and the other team gets the check ball. The computer players never break this rule.',
    'A dunk: a player who finishes a drive right at the rim may put the ball through from above (the big most often). It counts like any shot inside the arc, one point.',
    'The whole half court is playable, corners and sidelines included; players stay inside the lines. A pass or loose ball that goes out of bounds gives the ball to the other team with a check ball.',
    'The CROSS button is a quick change of direction. The nearest defender within about 1.7 m may be beaten and stumbles for a moment; better ball handlers and weaker defenders make it work more often.',
  ] },
  { title: 'Passing', p: [
    'A pass leaves the hand after a short wind-up and flies in a natural arc to where the receiver will be. A pass can be intercepted or deflected by a defender who is close to its path, and can be missed by a receiver who is not at the catch point.',
    'The pass buttons are labelled with the roles of your two teammates (G for guard, W for wing, B for big). Computer players pass when a teammate has a better shot than they do.',
  ] },
  { title: 'Shooting and the meter', art: 'meter', p: [
    'Press and hold SHOOT to start the shot, release to let the ball go. The ball is released at your release time; the best moment is the top of the jump, shown as the white line in the green zone.',
    'The green zone is wider for shots near the hoop and narrower for long shots and for shots with a defender close. Releasing early or late makes the ball miss by more. Holding too long releases the shot automatically.',
    'The ball is aimed at the middle of the ring; the miss is random and grows with distance, with a close defender and with poor timing. Better shooters (the wing) miss less than weaker ones (the big), except near the hoop where the big is best.',
    'Within about 2.4 m of the hoop the shot is a layup: a higher jump with a wider green zone.',
    'A shot cannot be taken while the ball has not been cleared behind the arc.',
  ] },
  { title: 'Defence', p: [
    'Steal: a swipe at the ball. It can only take the ball if the ball is within reach, in front of you and low or away from the dribbler\'s body. A swipe that misses may be a reaching foul.',
    'Block: a jump with the hands up. If your hands meet a shot just after release, it is blocked. A jump close to the shooter that does not touch the ball can be called as a shooting foul.',
    'Computer defenders stay between their man and the hoop, help when the ball comes close, jump to contest shots and box out for rebounds. Higher levels react faster.',
  ] },
  { title: 'Screens', art: 'screen', p: [
    'A screen is a teammate standing still. Hold SCREEN with the player you control: after a short moment he is set and cannot be pushed. Defenders cannot walk through him, so the ball handler can break free. A defender who runs into a set screen is slowed for a moment.',
    'The computer big sets screens for his guard and rolls to the rim afterwards.',
  ] },
  { title: 'Rebounds', p: [
    'After a missed shot the ball is live. The player whose reach (height plus jump) covers the ball first takes it. Jumping at the right time, a bigger reach and being closer all help; a box-out position between the opponent and the hoop helps too.',
    'A rebound taken by the shooting team keeps the possession and starts a new shot clock. A rebound by the other team is a change of possession and the ball must be cleared.',
  ] },
  { title: 'Fouls and free throws', p: [
    'Fouls are simplified. A foul is called when a defender jumps right at a shooter and lands close without a clean block, or when a steal attempt misses at close range. Contact while the ball is dribbled is not otherwise called.',
    `A foul on a shot gives free throws: 1 if the shot was from inside the arc, 2 if it was from beyond it. If the shot went in, the basket counts and the shooter has 1 free throw. Free throws are shot from the line, ${m1(FT_Z + 1.575)} m from the baseline, with the same release meter. After the last free throw: if it went in the other team starts at the top of the arc; if it missed the ball is live for a rebound.`,
    'Fouls without a shot are counted for each team. From the seventh team foul they give 2 free throws; before that the other team gets a check ball. Nobody fouls out, and the extra possession for the tenth foul is not used.',
  ] },
  { title: 'The computer players', p: [
    `The opponent has five levels: ${LEVELS.slice(1).map((l) => `${l.id} ${l.name}`).join(', ')}. Each level reacts faster, shoots better, times its shots better and chooses its options more carefully than the one below. The levels were set by playing computer teams against each other many times, so each level beats the one below it.`,
    'Your two teammates always play at a fixed middle level, whichever opponent you choose.',
    'Watch & Learn plays two computer teams against each other and stops at each decision to explain it.',
  ] },
  { title: 'What is not in this game', p: [
    'Substitutions, time-outs, the three-second rule, charging fouls and the tenth-foul possession are not part of this game. Players cannot leave the court. The camera never moves.',
  ] },
];

export const LESSONS = [
  { id: 'shoot', title: '1. The shot meter', goal: 'time 4 of 6 shots in the green', n: 6, need: 4, drill: { kind: 'shoot', total: 6 }, role: 1, intro: ['Hold SHOOT, then let go when the marker is in the green zone. The white line is the top of your jump, the best moment.', 'You are alone on the court and the ball is yours. Six shots from six spots. A shot counts when the release was in the green zone, whether it goes in or not.'] },
  { id: 'drive', title: '2. Drive and crossover (Guard)', goal: 'get to the rim for a layup 3 of 5 times', n: 5, need: 3, drill: { kind: 'drive', total: 5 }, role: 0, intro: ['As the guard you start with the ball at the top. One defender stands in front of you.', 'Push the stick towards the hoop. Press CROSS when the defender is close: it can leave him behind. Close to the hoop your shot becomes a layup. Five tries.'] },
  { id: 'screen', title: '3. Set a screen (Big)', goal: 'block the defender with a screen 3 of 5 times', n: 5, need: 3, drill: { kind: 'screen', total: 5 }, role: 2, intro: ['As the big you have no ball. Walk next to the defender who is guarding your guard, then hold SCREEN and stand still.', 'When the defender runs into you, the screen works and your guard gets free. Five possessions.'] },
  { id: 'defend', title: '4. Defence: steal, block, stay in front', goal: 'stop the attacker from scoring 3 of 5 times', n: 5, need: 3, drill: { kind: 'defend', total: 5 }, role: 0, intro: ['The guard dribbles at you. Stay between him and the hoop. Press STEAL when the ball is low and away from his body, BLOCK when he rises to shoot.', 'A possession is a success when he does not score. Five possessions.'] },
  { id: 'rebound', title: '5. Rebounds (Big)', goal: 'grab 3 of 5 rebounds', n: 5, need: 3, drill: { kind: 'rebound', total: 5 }, role: 2, intro: ['Shots come off the rim. Move under the ball and press JUMP as it comes down. The jump takes a moment, so press early.', 'Five shots. Grab at least three.'] },
  { id: 'quiz', title: '6. Rules quiz', goal: '4 of 5 answers right', quiz: true, need: 4, intro: ['Five questions about the rules you have just practised.'] },
];
export const QUIZ = [
  { q: 'How many points is a basket from beyond the arc worth?', a: ['1', '2', '3'], ok: 1 },
  { q: `How long is the shot clock?`, a: [`${SHOT_CLOCK} seconds`, '24 seconds', '10 seconds'], ok: 0 },
  { q: 'After your team rebounds a missed shot of the other team, what must you do before shooting?', a: ['Pass to the big', 'Take the ball behind the arc', 'Wait for the clock'], ok: 1 },
  { q: 'When is the best moment to release a shot?', a: ['As soon as you press', 'At the top of the jump', 'As you land'], ok: 1 },
  { q: 'What does a set screen do?', a: ['Blocks defenders so a teammate gets free', 'Takes the ball', 'Stops the clock'], ok: 0 },
];
