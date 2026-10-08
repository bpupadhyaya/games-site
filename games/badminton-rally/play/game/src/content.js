// Text content: About, How to Play and the exhaustive Rules. Every number comes from consts.js / shots.js so the Rules can never
// disagree with the engine.
import { HL, HW, HWD, SHORT, NET_H, NET_POST, LEVELS, RIVALS, STYLES, LENGTHS, TOURNEY_TARGET, TOURNEY_CAP } from './consts.js';
import { SWIPE, DEPTH } from './shots.js';

const m2 = (v) => String(Math.round(v * 100) / 100);

export const ABOUT = [
  { title: 'Badminton Rally', p: ['Singles badminton for your phone, in real 3D. Your player runs to the shuttle by himself; you choose the stroke and where it goes with one swipe, and the timing of the swipe decides how sharp it is.', 'Mix clears, drops and smashes to pull the computer out of position. Play quick matches against five levels, climb a knockout tournament against eight rivals, try the Rally Challenge, or watch two computer players and learn why they choose each stroke.'] },
  { title: 'The sport', p: ['Badminton is one of the most played racket sports in the world, loved across India, Indonesia, China, Malaysia, Japan, Korea, Thailand and Denmark. Games with a shuttlecock and a racket are very old in Asia. The modern rules grew out of the game of Poona, played by officers in India in the 1860s, and took their English name from Badminton House in Gloucestershire.', 'The shuttlecock, a cork head with sixteen feathers, is the secret of the sport: it leaves a racket at great speed, but the feathers brake it so hard that it slows to a drop within a few metres. That is what this game simulates.'] },
  { title: 'How it was made', p: ['The players are lifelike 3D athletes animated with inverse kinematics so the racket meets the shuttle at the exact moment the simulation says it does. The shuttle is simulated with real air drag, so a clear hangs, a drop dies at the net and a smash whips down. The court, hall and crowd are built from scratch.', 'All sound is synthesised on your device. The game works offline and has no ads.'] },
];

export const HOWTO = [
  { title: 'The idea', art: 'strokes', p: [
    'You do not steer your player. The moment the other player hits, the game shows where and when you will meet the shuttle: a ring on the floor that closes on the contact point and a thin stalk that shows the height. Your player runs there by himself.',
    'Your job is the stroke. Swipe on the court to choose it and aim it.',
  ] },
  { title: 'Swipe to play', p: [
    `The length of the swipe chooses the stroke, towards the opponent. Short: a drop or a net shot. Medium: a clear or a lift. Long: a smash or a flat drive. A tap is a safe return.`,
    'The direction of the swipe is your aim: straight is down the middle, leaning left or right sends the shuttle to that side of the court. The guide at the bottom of the screen always shows the three strokes your contact height allows.',
    'Overhead (the shuttle is high): drop, clear, smash. At chest height: push, lift, drive. Low: net shot or lift. A swipe sideways is a flat drive (or a push from low). Pulling back towards yourself is a soft block or a tight net shot.',
  ] },
  { title: 'Timing', art: 'ring', p: [
    'Swipe as the ring closes on the shuttle. A swipe in the sweet spot is PERFECT: full pace and the sharpest aim. GOOD is a little early or late, EARLY is a lot early (it still works, but the shot is less accurate), LATE is after the contact (the shot is rushed). If you do not swipe in time, your player makes a weak automatic return.',
    'Against a fast smash the game slows down for a moment so you can react.',
  ] },
  { title: 'Serving', p: ['After you win a rally you serve. Swipe short for a short serve that just clears the net, or long for a high serve to the back. The serve goes diagonally across the court into the box shown on the floor. The side you serve from depends on your score: from the right when it is even, from the left when it is odd.'] },
  { title: 'Think, Pause, Watch & Learn', p: [
    'Think pauses the game and the coach tells you which stroke to play and why, and can mark the landing spot on the court. Pause freezes everything and offers Rules, text size and Quit.',
    'Watch & Learn plays a whole match between two computer players. At every stroke of the near player the game stops and shows three steps: THINK (you decide what you would do), REVEAL (the stroke, the landing spot and the reason) and ACT (the stroke is played). Pause really pauses.',
    'In the Rally Challenge the computer feeds you shuttles of rising difficulty: count how many you can return.',
  ] },
  { title: 'Keyboard', p: ['Left and Right arrows (or A and D) aim, J / K / L = short / medium / long swipe, Space = tap (safe return), T = Think, P or Escape = Pause. + and - change the text size on menus.'] },
];

const lv = (i) => `${LEVELS[i].name}`;
export const RULES = [
  { title: 'The court', art: 'court', p: [
    `A badminton court is ${m2(2 * HL)} m long. For singles it is ${m2(2 * HW)} m wide (the inner side lines); the outer lines, ${m2(2 * HWD)} m apart, are for doubles. This game is singles only. The net stands across the middle at ${m2(NET_POST)} m at the posts and ${m2(1.524)} m in the centre.`,
    `Each half has a short service line ${m2(SHORT)} m from the net, a centre line that splits the area behind it into a left and a right service court, and in singles the back boundary line is also the long service line. A shuttle that lands on a line is IN.`,
    'The near end (your end) is at the bottom of the screen in portrait and at the left in landscape. In real matches the players change ends after each game; this game keeps you at the near end, with the computer at the far end, so the picture never turns around.',
  ] },
  { title: 'Winning a rally', p: [
    'A rally is won when the shuttle lands inside the opponent\'s half of the singles court, or when the opponent faults. You win the rally if: the shuttle lands in your opponent\'s court and he cannot return it; your opponent hits it into the net, or out of the court, or lets it fall on his own side; or he cannot reach it.',
    'Out: the shuttle lands outside the singles court (past a side line or the back line). If the computer, or your own player, sees that a shuttle will land clearly out, he lets it go; the rally ends when it lands.',
    'Net: the shuttle touches the net and drops on the side it was hit from. If it only skims the top of the net and tumbles over, the rally continues.',
    'The shuttle may only be hit once by the same player in a row and must be hit before it lands. There is no bounce in badminton.',
  ] },
  { title: 'Scoring', p: [
    'Rally point scoring: every rally gives a point to the winner, whoever served.',
    `A game is won by the first player to reach ${LENGTHS.to21.target} points with a lead of at least 2. If the score reaches 20-20, play continues until one player leads by 2, up to a maximum of 30: at 29-29 the next point wins (30-29).`,
    `Shorter games are played to ${LENGTHS.to11.target} points (win by 2, maximum ${LENGTHS.to11.cap}). In the tournament, matches are one game to ${TOURNEY_TARGET} (win by 2, maximum ${TOURNEY_CAP}). A best-of-three match is won by the first player to win two games.`,
    'In the real game there is a 60 second interval when the leader reaches 11 and 120 seconds between games. This game has no intervals; the next serve comes straight away.',
  ] },
  { title: 'Serving', p: [
    'The winner of a rally serves the next one. The first server of a match is drawn at random.',
    'The server stands in the service court on his right side when his own score is even, and on his left side when it is odd. He serves diagonally, to the opposite service court, and the receiver stands in it.',
    `The serve is hit underarm, with the whole shuttle below 1.15 m, and has to land in the diagonal service court: past the short service line (${m2(SHORT)} m from the net), inside the centre line and the singles side line, and not beyond the back line. A serve that lands short, wide or long is a fault and the receiver wins the rally. A serve that hits the net is also a fault (the tape rule below applies).`,
    'In this game a swipe shorter than 230 units is a short serve and a longer one is a high serve to the back; a tap is a short serve. The direction of the swipe moves the target inside the box. The computer chooses its serve with the same logic as its other strokes.',
  ] },
  { title: 'Strokes', p: [
    'Smash: a hard, steep stroke hit from above the head, the main attacking stroke. Needs a high contact. It lands about mid-court and is fastest.',
    'Clear: a high, deep stroke to the back boundary. It pushes the opponent back and gives you time to recover.',
    'Drop: a soft stroke from the back that falls just over the net. Pulls the opponent forward.',
    'Drive: a fast, flat stroke across the court at around chest height; push: a soft, flat stroke into mid-court.',
    'Lift: an underarm stroke from low down that sends the shuttle high and deep (a defensive reset).',
    'Net shot: a tight, delicate stroke from the front of the court that barely clears the net.',
    'Block: a soft return of a smash that drops just over the net.',
  ] },
  { title: 'The swipe', p: [
    `Your swipe is measured towards the opponent in screen units (the short side of the screen is always 720). Under ${SWIPE.tap} it is a tap. Short: ${SWIPE.tap} to ${SWIPE.short}. Medium: ${SWIPE.short} to ${SWIPE.mid}. Long: over ${SWIPE.mid}. The direction is the aim: 45 degrees to the side sends the shuttle to the widest aim, 0.3 m inside the side line.`,
    'Overhead contact (above 1.95 m): short = drop, medium = clear, long = smash, sideways = flat drive, pulled back = drop. Chest height (1.1 to 1.95 m): short = push, medium = lift, long = drive, sideways = drive, back = block. Low contact (under 1.1 m): short = net shot, medium or long = lift, sideways = push, back = tight net shot.',
    'Within a length class, a longer swipe sends the shuttle deeper (for a smash, a longer swipe makes it flatter and faster).',
  ] },
  { title: 'Timing and accuracy', art: 'ring', p: [
    'The ring on the floor shows the time to contact. Swipe when it is closing: a swipe in the sweet spot is PERFECT, a little early or late is GOOD, much too early is EARLY, after the contact is LATE.',
    'Timing sets the pace you can give the stroke and how much the shot can wander in speed, height and direction. Hitting while rushed, or at full stretch, makes it wander further. A smash that lands long or wide is out; a clear that is hit too low goes into the net.',
    'If you do not swipe in time, the player makes a weak automatic return. If you are too far from the shuttle, he cannot reach it and the opponent wins the rally.',
  ] },
  { title: 'The shuttlecock', p: [
    'The shuttle is simulated with air drag proportional to the square of its speed. It leaves the racket very fast and slows down sharply; its terminal speed is below 7 m/s, so every shot ends in a steep drop. The numbers in the game are scaled down from the fastest real smashes so that a phone player can react to them.',
    'A smash is the fastest stroke and a flat drive stays under 2 m high. When a shuttle is hit hard towards you, the game slows down while it travels, so you can still swipe in time.',
  ] },
  { title: 'The computer players', p: [
    `Five levels: ${[1, 2, 3, 4, 5].map(lv).join(', ')}. A higher level runs faster, reacts sooner, aims more accurately, hits harder and chooses its strokes with more care. Every computer player chooses by simulating each stroke it could play and judging whether it lands in and whether you can get there in time.`,
    `Tournament rivals have a style: ${Object.values(STYLES).map((x) => `${x.name} (${x.blurb})`).join(' ')}`,
  ] },
  { title: 'Modes', p: [
    'Quick Match: choose the level and the length: one game to 11, one game to 21, or best of three games to 21.',
    `Tournament: eight rivals, three knockout rounds (quarter-final, semi-final, final), each one game to ${TOURNEY_TARGET}. Your progress is saved after every match. The rivals are: ${RIVALS.map((r) => `${r.name} (${r.country})`).join(', ')}.`,
    'Rally Challenge: the computer returns every shuttle with growing difficulty. The score is the number of shuttles you return in a row; the run ends the first time you lose a rally.',
    'Watch & Learn: two computer players play a match. Think and Reveal explain the near player\'s stroke before it is played.',
  ] },
  { title: 'What is simplified', p: [
    'Singles only. No doubles, no service foot faults or service height measuring (the serve is simply hit low), no lets, no intervals, no change of ends, no injuries or tiredness.',
    'Your player moves by himself to the contact point; the computer players move at a top speed that depends on their level (about 4 to 6.5 m/s). A shuttle that is predicted to land clearly out is let go. A player cannot hit a shuttle that is above 2.75 m or below 0.12 m at his racket.',
    'Pace is scaled down from the real fastest shots so that rallies are playable on a touchscreen; the physics of the drag is real.',
  ] },
];

export const CREDIT_NOTE = 'Credits and licences';
