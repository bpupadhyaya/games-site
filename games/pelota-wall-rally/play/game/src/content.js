// Text for About, How to Play, the Learn lessons and the Rules reference. Numbers come from the engine's own constants.
import { HW, L, WALL_H, TOP, TIN, SERVE_LINE, SHORT, MATCH_POINTS, LEVELS, SHOTS, EQUIP, SWING_DELAY } from './consts.js';

const f1 = (v) => v.toFixed(1);

export const ABOUT = [
  { title: 'Wall ball from the Basque Country', art: 'court', p: [
    'Basque pelota (pilota in Basque, pelota vasca in Spanish) is a family of ball sports played against a wall. It comes from the Basque Country, on both sides of the Spanish and French border, and is also played in parts of Latin America, including Mexico, Argentina, Cuba and Uruguay.',
    'Players strike a hard ball against the front wall, called the frontis, and the other side must return it before it bounces twice. Depending on the discipline it is played with the bare hand (pelota mano) or with a wooden paddle (pala or paleta), among other tools.',
  ] },
  { title: 'The court', art: 'wall', p: [
    'A fronton has a front wall, a wall on the left, and a back wall called the rebote. The front wall has a metal strip along the bottom, the chapa, which rings when the ball hits it: a ball that strikes it is a fault.',
    'Real frontons are much longer than the court in this game. Here the court is shortened and the ball is drawn larger so that it can be followed on a phone.',
  ] },
  { title: 'This version', p: [
    'You play against computer rivals in one-on-one or two-on-two, with the bare hand or a wooden paddle. In two-on-two you pick one role, front or back, and you control that player; your partner and the rivals are played by the computer. Five rival levels, a Learn path, Think hints and Watch & Learn are included.',
    'The rules follow the common ideas of the sport as closely as a phone game can. Rules lists what is simplified.',
  ] },
];

export const HOWTO = [
  { title: 'Win to ' + MATCH_POINTS.full, art: 'court', p: [
    `Every rally scores a point for someone. The first side to ${MATCH_POINTS.full} points wins; a Quick match goes to ${MATCH_POINTS.quick}. Whoever wins a rally serves next.`,
    'Hit the ball onto the front wall, above the tin and below the top line. The other side must hit it back before it bounces twice.',
  ] },
  { title: 'Move and swing', art: 'swing', p: [
    'Drag in the lower left of the screen to run. With Auto-run on, your player also runs to the ball and back to a ready spot when you let go.',
    'Press SWING when the ring closes around the button: that is when the ball is at waist height. A good moment gives a clean, accurate shot; a late or early press gives a weak or wild one.',
  ] },
  { title: 'Aim and choose a shot', art: 'wall', p: [
    'Tap the front wall (or the left wall) to place the aim marker. Choose Drive for a fast flat shot, Drop for a soft shot that dies near the wall, or Lob for a high shot that drops deep.',
    'A shot at the left wall first comes off at an angle. Shots that go toward the open right side can leave the court.',
  ] },
  { title: 'Serve', art: 'serve', p: [
    'Press SERVE to bounce the ball, then press SWING as the ring closes. The serve must strike the front wall above the serve line and its first bounce must land beyond the short line. A first fault gives a second serve; two faults lose the point.',
  ] },
  { title: 'Rebotes', art: 'rebote', p: [
    'A ball may come off the left wall and the back wall. You may strike it on the fly or after one bounce, but never after two.',
  ] },
  { title: 'Two against two', art: 'roles', p: [
    'Choose Front or Back. The front player covers the short balls and drops; the back player covers deep balls and rebotes. Your partner takes balls in the other half and steps in if you are late.',
  ] },
  { title: 'Think and Watch & Learn', art: 'think', p: [
    'Think shows what a strong player would do at this moment, and why. It never plays for you.',
    'Watch & Learn plays a whole match between two computer sides. Each shot goes in three steps: Think, Reveal, Act. Pause stops everything.',
  ] },
];

export const RULES = [
  { title: 'The court', art: 'court', p: [
    `The floor is ${f1(2 * HW)} m wide and ${L} m long. The front wall and the left wall are ${f1(WALL_H)} m high. The back wall (rebote) is lower and shown as clear panels so that the ball can be followed. The right side is open: a ball that crosses the right line is out.`,
    `The short line is painted across the floor ${f1(L - SHORT)} m from the front wall. The ball is drawn larger than a real pelota so that it can be followed on a phone.`,
  ] },
  { title: 'The front wall', art: 'wall', p: [
    `A ball that strikes the front wall below ${f1(TIN)} m hits the tin (chapa) and is a fault. Above ${f1(TOP)} m is out. A serve must strike above the serve line at ${f1(SERVE_LINE)} m.`,
  ] },
  { title: 'Equipment', p: [
    `Hand ball: you strike with the bare hand. Paddle: you strike with a wooden paddle, which reaches further (${f1(EQUIP.paddle.reach)} m against ${f1(EQUIP.hand.reach)} m) and hits about ten percent harder. Both sides in a match use the same equipment.`,
  ] },
  { title: 'Serving', art: 'serve', p: [
    'The server bounces the ball once on the floor and strikes it on its way down so that it hits the front wall. A good serve strikes the front wall above the serve line without touching the left wall first, and its first bounce lands beyond the short line and inside the right line.',
    'A bad serve is a fault. After a first fault the server serves again; after a second fault the other side gets the point. A serve the receiver cannot return, or that bounces twice, wins the point for the server.',
    'The winner of a rally serves the next one. In two-on-two the serve alternates between the two players of a side each time the side regains the serve.',
  ] },
  { title: 'The rally', art: 'rebote', p: [
    'After the serve the sides strike the ball in turn. Each strike must send the ball onto the front wall before it touches the floor. The ball may touch the left wall before or after the front wall, and the back wall afterwards.',
    'The receiving side may strike the ball on the fly or after one bounce. If the ball bounces twice, the side that struck it last wins the point.',
    'A ball that touches a player who is not striking it is a let: the rally is replayed.',
  ] },
  { title: 'Faults', p: [
    'The side that struck the ball loses the point if the ball: bounces before reaching the front wall; hits the tin; hits the front wall above the top line; leaves the court (right side, over a wall, or over the back wall).',
  ] },
  { title: 'Shots', art: 'swing', p: [
    ...['drive', 'drop', 'lob'].map((k) => `${SHOTS[k].name}: ${SHOTS[k].blurb}`),
    `Press SWING when the ring closes. The swing takes ${SWING_DELAY.toFixed(1)} s from the press to the contact, so the ring closes ${SWING_DELAY.toFixed(1)} s before the ideal moment. The ball is best struck at waist height; the further it is from that height, or the further you must stretch, the weaker and less accurate the shot.`,
    'Your player steps into place for the strike, but only a short distance: get close to the ball first.',
  ] },
  { title: 'Scoring', p: [
    `Rally scoring: every rally gives a point. A match goes to ${MATCH_POINTS.full} points; a Quick match to ${MATCH_POINTS.quick}.`,
  ] },
  { title: 'Two against two', art: 'roles', p: [
    'You choose Front or Back before the match and cannot change it during the match. The front player starts near the front wall and takes short balls and drops; the back player starts near the rebote and takes deep balls. The computer partner takes the balls in the other half and may step in when you are late.',
  ] },
  { title: 'Rival levels', p: [
    ...LEVELS.map((l) => `${'★'.repeat(l.stars)} ${l.name}`),
    'Rivals follow the same rules and the same physics as you. Stronger rivals run faster, react sooner, time their strikes better, aim more accurately and choose better shots. Each level has been tested to beat the level below it over many simulated matches.',
  ] },
  { title: 'Watch & Learn', art: 'think', p: [
    'Two computer sides play a whole match. Before each shot the play is frozen: Think (5 seconds by default, 2 to 10 in Settings), Reveal (2 seconds: the chosen shot is shown with the reason) and Act (the play continues). Pause stops all of it.',
  ] },
  { title: 'Settings', p: [
    'Text size scales every text screen from 100% to 300%. Pace can be Relaxed, Normal or Fast: it changes how quickly everything moves. Auto-run lets your player run to the ball by itself. The aim guide shows where your shot will go. Sound can be switched off.',
  ] },
  { title: 'What this game simplifies', p: [
    'Real courts are longer and wider, and real matches have more rules about service and scoring. Here there are no substitutions, timeouts or referee calls beyond the faults above, and players pass through one another gently. The back wall is shown as clear panels.',
  ] },
];

export const ROLEGUIDE = [
  { title: 'Front: the short game', art: 'roles', p: [
    'The front player stands near the front wall. Take balls that drop short, play drops and quick volleys, and keep out of the way of your partner\'s swing.',
    'Aim low and soft: a Drop shot played from the front half of the court can die near the wall. Watch for balls that come off the left wall.',
  ] },
  { title: 'Back: the long game', art: 'roles', p: [
    'The back player stands near the back wall. Take deep balls and rebotes: let a ball come off the back wall, then strike it before the second bounce.',
    'Your best shots are long drives along the left wall and high lobs that push the rivals back. Call the ball early: if you press SWING, your partner stays out.',
  ] },
  { title: 'Your partner', p: [
    'The computer partner takes the balls in the other half of the court and steps in when you are late or out of reach. You never control your partner, and your role does not change during a match.',
  ] },
];

export const LESSONS = [
  { id: 'serve', title: '1. The serve', goal: 'Land 4 of 6 serves legally', n: 6, need: 4, drill: { kind: 'serve' }, intro: [
    'Press SERVE to bounce the ball, then press SWING as the ring closes. Tap the front wall to aim.',
    'A good serve strikes above the serve line and lands beyond the short line.',
  ] },
  { id: 'return', title: '2. Return and timing', goal: 'Return 5 of 8 balls legally', n: 8, need: 5, drill: { kind: 'feed' }, intro: [
    'A ball machine sends balls to you. Run to the ball, wait for the ring, press SWING and send it to the front wall above the tin.',
  ] },
  { id: 'rebote', title: '3. Rebotes', goal: 'Return 4 of 6 balls that come off the back wall', n: 6, need: 4, drill: { kind: 'rebote' }, intro: [
    'These balls bounce off the back wall. Let them come off the wall, then strike them before the second bounce.',
  ] },
  { id: 'angles', title: '4. Angles', goal: 'Hit the left wall first, then the front wall, 4 of 6 times', n: 6, need: 4, drill: { kind: 'angle' }, intro: [
    'Tap the left wall to aim. The ball comes off the left wall and reaches the front wall at an angle.',
  ] },
  { id: 'dropLob', title: '5. Drop and lob', goal: 'Use a Drop and a Lob successfully', n: 6, need: 4, drill: { kind: 'feed', mix: true }, intro: [
    'Choose Drop for a soft shot low on the wall, Lob for a high shot to the top of the wall. Both must be legal returns.',
  ] },
  { id: 'rules', title: '6. Rules quiz', goal: 'Answer 4 of 5 questions', quiz: true, need: 4, intro: ['Five short questions about the rules.'] },
];

export const QUIZ = [
  { q: 'What happens if the ball hits the tin?', a: ['The rally goes on', 'It is a fault', 'It is a let'], ok: 1 },
  { q: 'How many times may the ball bounce before you return it?', a: ['Once', 'Twice', 'As many as it likes'], ok: 0 },
  { q: 'What must a serve do?', a: ['Hit the left wall first', 'Strike above the serve line and land beyond the short line', 'Bounce twice'], ok: 1 },
  { q: 'Who wins the point if the ball bounces twice before the receiver strikes it?', a: ['The side that struck it last', 'The receiver', 'Nobody: a let'], ok: 0 },
  { q: 'After two service faults in a row, who gets the point?', a: ['The server', 'The receiver', 'It is replayed'], ok: 1 },
];
