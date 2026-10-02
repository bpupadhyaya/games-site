// Text for About, How to Play, the Learn lessons and the Rules reference. Numbers come from the engine's own constants.
import { NET, ATTACKS, ATTACK_IDS, SERVES, SERVE_IDS, LEVELS, SET_POINTS, SET_CAP, HW, HL } from './consts.js';

const L = (id) => `${id}`;

export const ABOUT = [
  { title: 'Kick volleyball from Southeast Asia', art: 'court', p: [
    'Sepak takraw is played across Southeast Asia, with deep roots in Malaysia, Thailand and Indonesia. Teams of three send a woven ball over a high net using their feet, knees, chest and head. Hands and arms are never allowed.',
    'The name joins two words: sepak, the Malay word for kick, and takraw, the Thai word for a woven ball. The ball was traditionally woven from rattan. Modern balls use synthetic fibre but keep the same woven look and about the same size.',
  ] },
  { title: 'The skills', art: 'spikes', p: [
    'A rally is built like volleyball: receive, set, attack. What makes the sport famous is the attack. Players leap and kick the ball down over the net with scissor kicks, back-to-the-net overhead kicks and rolling flips, then land on their feet ready to defend.',
  ] },
  { title: 'This version', p: [
    'You lead a team of three. You choose where the receive goes, how the set is placed, which attack to use and where to aim it, and how your team blocks. Your teammates move on their own. Five rival teams play in five different styles, and Watch & Learn lets you see why they choose what they do.',
    'The rules follow the international laws of the game as closely as a phone game can. Rules lists the few simplifications.',
  ] },
];

export const HOWTO = [
  { title: 'Win sets to 21', art: 'court', p: [
    `Win two sets out of three. A set goes to the first team to reach ${SET_POINTS.full} points with a lead of two. A Quick Match is one set to ${SET_POINTS.quick}.`,
    'Every rally scores a point for someone: the team that wins the rally gets the point, whoever served.',
  ] },
  { title: 'Serve', art: 'serve', p: [
    'Your tekong (server) kicks the ball that a teammate tosses. Tap the court to aim, pick Lob, Drive or Power, then press SERVE when the ring closes on the button.',
    'A Lob is safe, a Power serve is fast but often misses. Aim for the corners where their receivers are far away.',
  ] },
  { title: 'Receive and choose your attacker', art: 'receive', p: [
    'When the ball comes to you, one of your players receives it automatically. Choose which of the other two players will attack. The remaining player sets the ball.',
    'If you do not choose, your coach chooses for you.',
  ] },
  { title: 'Set', art: 'set', p: [
    'The setter kicks the ball up for your attacker. Choose where it goes (left, middle or right) and how: a High set gives your attacker time but gives their blockers time too, a Quick set is hard to block but harder to hit. Free ball sends the ball straight over to buy time.',
  ] },
  { title: 'Attack', art: 'attack', p: [
    'Tap the court to aim, pick an attack, then press SMASH when the ring closes. A perfect press gives a clean, accurate hit. Early or late presses lose accuracy and power, and a very bad one goes into the net or out.',
    'Roll spike: a flip over the ball. Sunback: back to the net, overhead kick. Scissor: airborne scissor kick, the hardest to time. Header and Foot spike are easier and softer.',
  ] },
  { title: 'Block and defend', art: 'block', p: [
    'When they attack, choose Single block, Double block or Drop back. Blockers jump at the net and meet the ball with the leg. The others dig the ball up. A double block covers more of the net but leaves less behind it.',
  ] },
  { title: 'Think and Watch & Learn', art: 'think', p: [
    'Think shows what a strong coach would do at this moment and why. It never plays for you.',
    'Watch & Learn plays a whole match between two teams. Each choice has three steps: Think, Reveal, Act. Pause stops everything.',
  ] },
];

export const RULES = [
  { title: 'The court and the net', art: 'court', p: [
    `The court is 13.4 m long and 6.1 m wide. The net is ${NET.m.toFixed(2)} m high in the middle for men and ${NET.f.toFixed(2)} m for women, 0.7 m wide, with white tape along the top and sides. In Settings you choose the men's or women's event; both teams always play the same one.`,
    'Each team of three has a tekong (the player at the back, who serves) and a left and a right inside player. Servers stand with one foot in a service circle 0.3 m in radius, 2.45 m from the back line.',
  ] },
  { title: 'The ball', p: [
    'The ball is round and woven, about 0.42 m around. Players may touch it with any part of the body except the hands and arms: feet, shins, knees, thighs, chest, shoulders and head. A touch with the arm or hand is a fault.',
  ] },
  { title: 'Winning a set and the match', p: [
    `A set goes to the first team to ${SET_POINTS.full} points with a two point lead. At 20-20 play continues until one team leads by two, or reaches ${SET_CAP.full} points, whichever comes first. A match is the best of three sets. In this game all three sets are played to ${SET_POINTS.full}.`,
    `Quick Match is a single set to ${SET_POINTS.quick}, with a two point lead or ${SET_CAP.quick} points at most.`,
    'The set is also the unit of the Continue button: the game saves after every point.',
  ] },
  { title: 'Serving', art: 'serve', p: [
    'Before each serve one inside player of the serving team tosses the ball to the tekong. The tekong must keep the non-kicking foot in the circle, and must kick the ball the toss gave them.',
    'A serve is good if it passes over the net, whether it touches the net or not, and lands inside the court. It is a fault if it fails to cross, lands outside, or touches a teammate before crossing.',
    'The team that serves first serves three times in a row, then the other team serves three times, and so on, whoever wins the points. At 20-20 service changes after every point. The team that received first in a set serves first in the next set. In this game your team always stays on the near side, so the change of ends is not shown.',
  ] },
  { title: 'Touches', art: 'receive', p: [
    'A team may touch the ball up to three times before it must go over the net: usually receive, set, attack. A fourth touch is a fault. In this game one player never touches the ball twice in a row.',
    'A touch by a blocker does not count as one of the three. In this game the blocker\'s touch also starts a new count for the team that gets the ball next.',
  ] },
  { title: 'Receive and set', p: [
    'The player who can reach the ball first receives it. They use the part of the body that fits the height of the ball: the foot for low balls, the knee or thigh a little higher, the inside of the raised foot for the classic set, the chest, or the head for high balls.',
    'Better players receive harder balls more cleanly. A ball that is only just reached, or hit very hard, is received less accurately and may be a hand touch or go astray.',
  ] },
  { title: 'Attacks', art: 'spikes', p: [
    ...ATTACK_IDS.map((id) => `${ATTACKS[id].name}: ${ATTACKS[id].blurb}`),
    'You press SMASH as the ring closes. The size of the window depends on the attack: the Header and Foot spike have the widest windows, the Scissor spike the narrowest. The harder the hit, the more power but the less accuracy; if the ball cannot clear the net at full speed it is slowed to clear it.',
  ] },
  { title: 'Blocking', art: 'block', p: [
    'Blockers jump at the net and meet the ball with the leg. A Single block puts the inside player nearest the attacker at the net; a Double block uses both inside players; Drop back keeps everyone in the court to dig. A good blocker reads the set early; Quick sets give less time to read.',
    'A block either kills the ball straight back down into the attackers\' court, or only touches it, and the ball keeps going. A blocker may not reach into the other court before touching the ball, but may follow through with the leg after it.',
  ] },
  { title: 'Faults', p: [
    'The other team gets the point when a team: lets the ball fall in its own court; sends the ball out of the court or outside the net posts; plays a fourth touch; touches the ball with the hand or arm; touches the net, a post, or the other court with the body or clothes before the ball (a follow-through after the ball is allowed); serves badly (foot lifted early, serve does not cross, serve out); lets the ball touch the roof or a wall.',
  ] },
  { title: 'Your coach and Think', p: [
    'Think asks a strong coach for the best choice right now and shows the reason, based on where the other team\'s players are standing and how well their blockers can read the set. It does not change anything unless you choose Use it.',
    'If you do not choose at a decision, a coach of your own level chooses for you.',
  ] },
  { title: 'Rival teams', p: [
    ...LEVELS.map((l) => `${'★'.repeat(l.stars)} ${l.name}`),
    'Rivals use the same rules, the same physics and the same shot choices as you. Stronger teams move faster, jump higher, receive more cleanly, press at better moments and choose their targets with more care. Each rival level has been tested to beat the level below it over many simulated matches.',
  ] },
  { title: 'Watch & Learn', art: 'think', p: [
    'Two teams play a whole real match. Each decision goes in three steps: Think (the play is frozen while the team considers its options; 5 seconds by default, 2 to 10 in Settings), Reveal (2 seconds: the choice is shown with the reason) and Act (the play continues). Pause stops all of it, including the clocks and the animation.',
  ] },
  { title: 'Settings', p: [
    'Text size scales every text screen from 100% to 300%. The decision pace can be Slow motion (the game slows down while you choose), Wait for me (the game stops at each choice) or Fast. The venue can be an indoor hall or a beach court. Sound can be switched off.',
  ] },
  { title: 'What this game simplifies', p: [
    'Substitutions, time-outs, yellow and red cards and the change of ends are not simulated. The referee calls are shown as short messages. Your teammates take positions automatically.',
  ] },
];

export const LESSONS = [
  { id: 'serve', title: '1. The serve', goal: 'Land 4 of 6 serves in the court', n: 6, need: 4, drill: { kind: 'serve', server: 0 }, intro: [
    'Tap the far court to place the target, choose a serve, and press SERVE when the ring closes on the button.',
    'A Lob almost always lands in. A Drive is quicker. A Power serve is the fastest and misses most.',
  ] },
  { id: 'receive', title: '2. Receive', goal: 'Receive 4 of 6 serves cleanly', n: 6, need: 4, drill: { kind: 'receive', server: 1 }, intro: [
    'The rival serves. One of your players receives the ball. Choose which of the other two players attacks.',
    'A clean receive puts the ball exactly where your setter wants it.',
  ] },
  { id: 'set', title: '3. Set', goal: 'Set up 4 of 6 attacks well', n: 6, need: 4, drill: { kind: 'receive', server: 1, set: true }, intro: [
    'Pick Left, Middle or Right and High, Quick or Free ball. Look where the rival blockers stand and set where they are not.',
  ] },
  { id: 'spike', title: '4. Spike', goal: 'Press SMASH well on 4 of 6 attacks', n: 6, need: 4, drill: { kind: 'spike', server: 1 }, intro: [
    'Choose an attack, tap the court to aim, then press SMASH exactly when the ring closes.',
    'Header and Foot spike are the easiest to time. Scissor is the hardest.',
  ] },
  { id: 'block', title: '5. Block', goal: 'Get a block touch on 3 of 6 rival attacks', n: 6, need: 3, drill: { kind: 'block', server: 1 }, intro: [
    'Choose Single, Double or Drop back before they attack. The set tells you where they will hit from.',
  ] },
  { id: 'rules', title: '6. Rules quiz', goal: 'Answer 4 of 5 questions', quiz: true, need: 4, intro: ['Five short questions about the rules.'] },
];

export const QUIZ = [
  { q: 'How many times may a team touch the ball before it must cross the net?', a: ['Two', 'Three', 'Four'], ok: 1 },
  { q: 'Which body parts may NOT touch the ball?', a: ['Head and chest', 'Knees and thighs', 'Hands and arms'], ok: 2 },
  { q: 'At 20-20 in a set, when does the set end?', a: ['At 21', 'A lead of two or 25 points', 'After one more point'], ok: 1 },
  { q: 'How does the serving team change?', a: ['Three serves each, then alternate', 'After every rally', 'Only when the server faults'], ok: 0 },
  { q: 'A spiker lands and their foot touches the net before the ball. What is it?', a: ['A fault', 'Allowed', 'A let'], ok: 0 },
];
void L; void SERVES; void SERVE_IDS; void HW; void HL;
