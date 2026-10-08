// Text for About, How to Play, the Learn lessons and the Rules reference. Numbers come from the engine's own constants.
import { HW, HL, SL, NET_C, NET_P, ALLEY, FORMATS, LEVELS, SURFACES, SHOTS, SWING_DELAY, TOSS_H } from './consts.js';

const f1 = (v) => v.toFixed(1);
const SC = 0.73;                         // the game's court is the real court at 73% of its size
const real = (m) => (m / SC).toFixed(2);

export const ABOUT = [
  { title: 'Lawn tennis, born in England', art: 'court', p: [
    'Modern lawn tennis took shape in England in the 1870s. It grew out of much older racket-and-ball games played indoors and in monastery cloisters, and it moved onto the lawns of Victorian gardens, where a net, a few lines and a light rubber ball were all it needed. Major Walter Clopton Wingfield published a set of rules in 1874, and clubs and written laws followed within a few years.',
    'The sport spread across the British Empire and the world within a generation. Today it is played on grass, clay and hard courts in almost every country, by players of every age.',
  ] },
  { title: 'The scoring still sounds old', art: 'score', p: [
    'Points are called love, 15, 30 and 40, then a game is won at the next point unless both sides reach 40, when one side must win two points in a row. Games make a set. These calls come from much older versions of the game, and nobody agrees where the word love came from.',
  ] },
  { title: 'This version', art: 'swipe', p: [
    'You play singles against a computer rival in real 3D. You press and drag on the court to choose where the ball should land, then release as a ring closes to strike it. Five rival levels, three surfaces, Learn lessons, Think hints and Watch & Learn are included.',
    'The court is the real court at 73% of its size and the ball is drawn larger, so that everything can be followed on a phone. Rules lists what is simplified.',
  ] },
];

export const HOWTO = [
  { title: 'Win games, win the set', art: 'score', p: [
    `A Quick match goes to ${FORMATS.quick.games} games with no-ad scoring. A Short set goes to ${FORMATS.short.games}, with a tiebreak at 3-3. A Full set goes to ${FORMATS.full.games} games (two clear), with a tiebreak at 6-6.`,
    'Inside a game you count 0, 15, 30, 40. The next point wins the game; at 40-40 (deuce) a side needs two points in a row. No-ad: the next point wins.',
  ] },
  { title: 'Swipe to hit', art: 'swipe', p: [
    'Your player runs to the ball by himself. Press and drag anywhere on the court: a marker shows where your shot will land on the rival\'s side. Release as the ring around the ball closes.',
    'Drag far up for a Drive (fast, deep). Drag a medium way for a Slice (slow, safe). Drag a short way for a Drop shot. Drag down for a Lob. Drag left or right to aim to either side. A plain tap hits a sensible safe ball for you.',
  ] },
  { title: 'Timing', art: 'ring', p: [
    'The ring closes a moment before the ideal strike. Release on time for a clean, accurate shot; early or late gives a weak or wild one. A ball struck near waist height is best.',
  ] },
  { title: 'Serve', art: 'serve', p: [
    'Press anywhere to toss the ball. While it rises, drag to place the serve in the diagonal box; release as the ring closes at the top of the toss. You get two serves. If you miss the toss entirely, just toss again.',
  ] },
  { title: 'Net or Back', art: 'court', p: [
    'The Net / Back button chooses where your player waits between shots. At the net you can volley (strike the ball before it bounces) and finish points quickly, but a lob goes over your head. Behind the baseline you have more time but the rival can drop the ball short.',
  ] },
  { title: 'Surfaces', art: 'surfaces', p: [
    ...['lawn', 'clay', 'hard'].map((k) => `${SURFACES[k].name}: ${SURFACES[k].blurb}`),
  ] },
  { title: 'Think and Watch & Learn', art: 'think', p: [
    'Think shows what a strong player would do at this moment, and why, and how to drag to do it. It never plays for you.',
    'Watch & Learn plays a whole match between two computer sides. Each shot goes in three steps: Think, Reveal, Act. Pause stops everything.',
  ] },
];

export const RULES = [
  { title: 'The court', art: 'court', p: [
    `Singles are played on a court ${f1(2 * HW)} m wide and ${f1(2 * HL)} m long, divided by the net. (The real court is 8.23 m by 23.77 m: this one is 73% of that size.) The two long side lines are the singles sidelines; the strips of ${f1(ALLEY)} m beyond them are the doubles alleys, drawn for realism but out of play in singles.`,
    `Lines touched are in: a ball that touches a line counts as in. The service lines run ${f1(SL)} m from the net on each side; the centre service line splits the area between them into two service boxes.`,
  ] },
  { title: 'The net', art: 'net', p: [
    `The net is ${NET_C.toFixed(2)} m high in the middle and ${NET_P.toFixed(2)} m at the posts, as in the real game. A ball that hits the net and falls back is a fault for the player who hit it. A ball that clips the top tape and goes over is still in play (except on a serve, see Lets).`,
  ] },
  { title: 'Serving', art: 'serve', p: [
    'The server stands behind the baseline and serves from the right side of the centre mark at the start of a game (the deuce court), then alternates sides after every point (the advantage court). The serve is struck from above the head after a toss and must land in the diagonally opposite service box.',
    `A serve that lands outside the box, or hits the net, is a fault. After one fault the server serves again; two faults in a row (a double fault) lose the point. The toss is struck at the top, about ${f1(TOSS_H)} m up.`,
    'The server changes every game. In a tiebreak the server changes after the first point and then every two points.',
  ] },
  { title: 'Lets', p: [
    'A serve that clips the net tape and lands in the correct box is a let and is served again without counting as a fault. In a rally, a ball that clips the net and goes over is simply in play.',
  ] },
  { title: 'The rally', art: 'court', p: [
    'After the serve is returned, the players strike the ball in turn. A ball must go over the net and land inside the lines. Each side may let the ball bounce once, or strike it before it bounces (a volley). If the ball bounces twice on your side before you return it, you lose the point.',
    'You may hit the ball from outside the court, but not by touching the net. A ball that lands out, or into the net, loses the point for the player who struck it.',
  ] },
  { title: 'Scoring a game', art: 'score', p: [
    'Points: none is called Love, then 15, 30 and 40. A game is won by the first side to win four points and lead by two. At 40-40 the score is Deuce; the side that wins the next point has the Advantage; if it wins the next point it wins the game, if not the score is Deuce again.',
    'No-ad scoring (used in Quick matches): at 40-40 the next point wins the game.',
  ] },
  { title: 'Sets and tiebreaks', p: [
    ...Object.values(FORMATS).map((f) => `${f.name}: ${f.blurb}`),
    'A tiebreak is a single game played to 7 points (two clear): the first server serves one point, then the servers change every two points.',
  ] },
  { title: 'Shots', art: 'swipe', p: [
    ...['drive', 'slice', 'drop', 'lob', 'serve1', 'serve2'].map((k) => `${SHOTS[k].name}: ${SHOTS[k].blurb}`),
    `Release when the ring closes. The swing takes ${SWING_DELAY.toFixed(1)} s from the release to the contact, so the ring closes ${SWING_DELAY.toFixed(1)} s before the ideal moment. The ball is best struck at about waist height; the further it is from that height, or the further your player must stretch, the weaker and less accurate the shot.`,
  ] },
  { title: 'Surfaces', art: 'surfaces', p: [
    ...['lawn', 'clay', 'hard'].map((k) => `${SURFACES[k].name}: ${SURFACES[k].blurb}`),
    'The surface changes how high the ball bounces and how much pace it keeps. Your swing and the rival\'s are the same on all three.',
  ] },
  { title: 'Rival levels', p: [
    ...LEVELS.map((l) => `${'★'.repeat(l.stars)} ${l.name}`),
    'Rivals follow the same rules and the same physics as you. Stronger rivals run faster, react sooner, time their strikes better, aim more accurately, choose better shots and come to the net more often. Each level has been tested to beat the level below it over many simulated matches.',
  ] },
  { title: 'Watch & Learn', art: 'think', p: [
    'Two computer sides play a match. Before each shot the play is frozen: Think (5 seconds by default, 2 to 10 in Settings), Reveal (2 seconds: the chosen shot is shown with the reason) and Act (the play continues). Pause stops all of it.',
  ] },
  { title: 'Settings', p: [
    'Text size scales every text screen from 100% to 300%. Pace can be Relaxed, Normal or Fast. Auto-run lets your player run to the ball by itself. Auto aim chooses a safe target when you only tap. The aim guide shows the path of your shot. Sound can be switched off.',
  ] },
  { title: 'What this game simplifies', p: [
    `The court is 73% of full size and the ball is larger. There are no doubles, no line judges or challenges, no foot faults, no changes of end, and players do not touch the ball with their body. Singles only: the alleys are out. For reference, the real court has service lines ${real(SL)} m from the net.`,
  ] },
];

export const LESSONS = [
  { id: 'serve', title: '1. The serve', goal: 'Land 3 of 5 serves in the box', n: 5, need: 3, drill: { kind: 'serve' }, intro: [
    'Press to toss the ball. While it rises, drag to place the serve. Release as the ring closes at the top of the toss.',
    'A good serve lands in the diagonal service box.',
  ] },
  { id: 'return', title: '2. Return and timing', goal: 'Return 5 of 8 balls into the court', n: 8, need: 5, drill: { kind: 'feed' }, intro: [
    'A ball machine sends balls to you. Your player runs to the ball. Press, drag to aim and release as the ring closes.',
  ] },
  { id: 'depth', title: '3. Depth', goal: 'Land 4 of 6 balls deep, beyond the middle of the court', n: 6, need: 4, drill: { kind: 'depth' }, intro: [
    'Deep balls keep the rival back. Drag a long way up for a Drive and watch the marker: it should land near the far baseline.',
  ] },
  { id: 'dropLob', title: '4. Drop and lob', goal: 'Land a Drop and a Lob, 4 good balls of 6', n: 6, need: 4, drill: { kind: 'feed', mix: true }, intro: [
    'Drag a short way up for a Drop shot, down for a Lob. Land one of each, and keep the others in the court.',
  ] },
  { id: 'volley', title: '5. At the net', goal: 'Volley 4 of 6 balls into the court', n: 6, need: 4, drill: { kind: 'volley' }, intro: [
    'Your player waits at the net. Strike the ball before it bounces, with a short, firm shot.',
  ] },
  { id: 'rules', title: '6. Rules quiz', goal: 'Answer 4 of 5 questions', quiz: true, need: 4, intro: ['Five short questions about the rules.'] },
];

export const QUIZ = [
  { q: 'How many times may the ball bounce on your side before you return it?', a: ['Once', 'Twice', 'As many as it likes'], ok: 0 },
  { q: 'A serve hits the net and lands in the right box. What is it?', a: ['A fault', 'A point for the server', 'A let: serve again'], ok: 2 },
  { q: 'A ball lands on the line. Is it in or out?', a: ['In', 'Out', 'Replay'], ok: 0 },
  { q: 'At 40-40 in a normal game (not no-ad), what is the score called?', a: ['Love all', 'Deuce', 'Tiebreak'], ok: 1 },
  { q: 'After two serve faults in a row, who gets the point?', a: ['The server', 'The receiver', 'It is replayed'], ok: 1 },
];
