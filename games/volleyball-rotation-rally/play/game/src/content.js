// Text for About, How to Play, the Rules reference, role tutorials, Learn lessons and tips. Numbers come from the engine's own constants.
import { NET, MODES, SHOTS, SHOT_IDS, SERVES, SERVE_IDS, SETS, LEVELS, ATK, HW, HL, ROLES } from './consts.js';

export const ABOUT = [
  { title: 'Volleyball', art: 'court', p: [
    'Volleyball was invented in the United States in 1895 as a gentler indoor game and is now played in nearly every country, indoors on a hall court and outdoors on sand and grass.',
    'Two teams of six stand on either side of a high net and send a ball over it with their hands and arms. Each team may touch the ball three times. The ball must not touch the floor on your side.',
  ] },
  { title: 'This version', p: [
    'You play one position on a six-player team. You move that player and act when the ball comes to you: serve, pass, set, spike or block. The other five players on your team and all six rivals are computer players.',
    'You choose your role before the match: setter, outside hitter, middle blocker, opposite or libero. Five rival teams play at five levels. Watch & Learn lets you see a whole match between two computer teams and why they make each choice.',
    'The rules follow the international indoor rules as closely as a phone game can. Rules lists the few simplifications. The ball and the mannequin players are drawn larger than life so you can follow them and their reach matches the net.',
  ] },
];

export const HOWTO = [
  { title: 'Win sets and the match', art: 'court', p: [
    `Every rally scores a point for someone, whoever served. A set goes to the first team with ${MODES.best3.pts} points and a lead of two. A deciding set goes to ${MODES.best3.last}. Choose Quick (one set to ${MODES.quick.pts}), Best of 3 or Best of 5.`,
  ] },
  { title: 'Move your player', p: [
    'Touch and drag anywhere on the court: your player runs the way you drag. Lift your finger to stop. In Settings, Movement help can step you to the ball for you (Full), only the last steps (Light) or not at all (Off).',
    'Your player has a ring and a name tag. The ball has a bright halo and a shadow on the floor so you can see where it will land.',
  ] },
  { title: 'The timing ring', art: 'ring', p: [
    'When the ball comes to you, a ring closes on a mark on the floor. Lift your finger (or tap) exactly as the ring closes. Perfect timing gives a clean touch. Early or late touches are weaker and can miss the target or the court.',
    'While you are dragging, lifting your finger is your press. A quick flick as you lift chooses where the ball goes: left, right, long or short.',
  ] },
  { title: 'Serve', art: 'serve', p: [
    'When you serve, pick Float (steady) or Jump (fast, riskier), move along the line if you like, then tap to toss. Press when the ring closes to strike. Flick left or right and long or short to aim.',
  ] },
  { title: 'Pass and dig', art: 'receive', p: [
    'Get under the ball and press as the ring closes. A clean pass floats to the setter near the net. A flick up sends a bad ball straight over the net. Hard hits are harder to control: be early and square to the ball.',
  ] },
  { title: 'Set', art: 'set', p: [
    'Flick left for the outside hitter, right for the right side, up for the quick middle ball, down for the back-row pipe, or choose a target with the buttons. As a front-row setter you can dump: choose Dump or flick hard upward and the ball goes over the net on the second touch.',
  ] },
  { title: 'Attack', art: 'attack', p: [
    'Your hitter runs in and jumps by itself when you are close. Press as the ring closes. Choose Power, Roll or Tip with the buttons and flick to aim: left and right choose line or angle, up is deep, down is short.',
  ] },
  { title: 'Block', art: 'block', p: [
    'In the front row, stand at the net across from the hitter and press as the other team swings. Your hands go up over the net. A block can stuff the ball back down, slow it or send it out.',
  ] },
  { title: 'Think and Watch & Learn', art: 'think', p: [
    'Think tells you what a strong player would do now and why. It never plays for you.',
    'Watch & Learn plays a whole match between two computer teams. Each choice has three steps: Think, Reveal, Act. Pause stops everything.',
  ] },
];

const set = (k) => SETS[k].name;
export const RULES = [
  { title: 'Court and net', art: 'court', p: [
    `The court is ${HL * 2} m long and ${HW * 2} m wide, split by the net into two halves of ${HL} m by ${HW * 2} m. A line ${ATK} m from the net marks the front zone. The net is ${NET.m.toFixed(2)} m high for men and ${NET.f.toFixed(2)} m for women, about 1 m deep, with a white tape on top and a thin rod (antenna) fixed above the net on each side line.`,
    'You choose the men\'s or women\'s event in the match setup. Both teams always play the same one.',
  ] },
  { title: 'The ball', p: [
    'A regulation volleyball is about 0.21 m across. In this game the ball is drawn and played about two and a half times as large (about 0.56 m across) so you can follow it on a phone, and the players are drawn about 25% taller than life so their reach still matches the net. Players may touch it with any part of the body. In this game every touch is made with the forearms (a pass or dig), the fingers (a set) or the open hand (a serve, spike, tip or block).',
  ] },
  { title: 'Teams and positions', art: 'rotation', p: [
    'Six players are on court at a time: three in the front row next to the net (positions 4, 3 and 2 from left to right) and three in the back row (positions 5, 6 and 1). The back-right player (position 1) serves.',
    'Each team has a setter, two outside hitters, two middle blockers, an opposite and a libero. Seven players, six on court: the libero stands in for a middle blocker in the back row.',
    'You control one of: setter, outside hitter, middle blocker, opposite or libero. If you control a middle blocker you are never replaced by the libero. You cannot change role during a match.',
  ] },
  { title: 'Rotation', art: 'rotation', p: [
    'When the team that was receiving wins the rally it wins the serve and rotates one position clockwise: everyone steps to the next position and the player who moves to position 1 serves. The team that keeps winning rallies keeps its server and does not rotate.',
    'The order never changes during a set, so every player serves and plays in the front and the back row in turn. At the start of each set both teams return to their starting rotation. The rotation overlay shows who stands where; tap it during play.',
    'At the moment of the serve the players must stand in the order of the rotation: each front-row player nearer the net than the back-row player behind, and each row in left-to-right order. In this game the computer places everyone legally, so an overlap fault is never called.',
  ] },
  { title: 'Winning a set and the match', p: [
    `Rally scoring: every rally gives one point to the team that wins it. A set is won by the first team to reach ${MODES.best3.pts} points with a lead of at least two (there is no upper limit: 24-24 goes on until one team leads by two). A deciding set is played to ${MODES.best3.last}, again with a lead of two.`,
    `${MODES.quick.name}: one set to ${MODES.quick.pts}. ${MODES.best3.name}: first to win two sets; sets one and two go to ${MODES.best3.pts} and a third goes to ${MODES.best3.last}. ${MODES.best5.name}: first to win three sets; sets one to four go to ${MODES.best5.pts} and a fifth goes to ${MODES.best5.last}.`,
    'The team that served first in a set receives first in the next. The two teams change ends between sets in real matches; in this game your team always stays on the near side.',
  ] },
  { title: 'Serving', art: 'serve', p: [
    'The server stands behind the end line and strikes the ball with one hand after tossing it up. A serve is good if it crosses the net between the antennae and lands in the court. The ball may touch the tape and still count if it carries over.',
    `${SERVES.float.name}: ${SERVES.float.blurb} ${SERVES.jump.name}: ${SERVES.jump.blurb}`,
    'It is a serving error if the ball hits the net and does not cross, goes outside the antennae, or lands out. A serve that is not touched and lands in is an ace.',
    'Libero note: under international rules the libero never serves, so the middle blocker serves from position 1 and the libero sits out that rotation (this is the default here). Several national rules let the libero serve in one position; Settings has a Libero serves switch that lets the libero serve in place of the middle blocker it replaces.',
  ] },
  { title: 'Three touches', art: 'receive', p: [
    'A team may touch the ball up to three times before it must go over the net: usually a pass, a set and a spike. A player may not touch the ball twice in a row, except after a block.',
    'A block touch does not count as one of the three team touches. After a block the team may play the ball three more times and the blocker may play the next ball.',
    'In this game the computer never plays a fourth touch; the three touches are shown by the rally itself.',
  ] },
  { title: 'Passing and digging', art: 'receive', p: [
    'The first touch (pass or dig) is made with joined forearms. A clean pass floats to the setter near the net. The quality of the pass depends on the player\'s skill, how hard the ball arrives, how far the player had to stretch and, for you, how well you press as the ring closes.',
    'A bad pass can go wild: off the court, over the net or out of reach of the setter. A ball just out of reach is saved with a low dive. If the ball cannot be reached it lands and the other team scores.',
  ] },
  { title: 'Setting', art: 'set', p: [
    'The second touch is usually a set with the fingers above the forehead. The setter chooses a target: ' + ['outside', 'middle', 'right', 'pipe', 'dump'].map(set).join(', ') + '.',
    `${SETS.outside.blurb} ${SETS.middle.blurb} ${SETS.right.blurb} ${SETS.pipe.blurb} ${SETS.dump.blurb}`,
    'A poor pass leaves fewer options: a quick middle set needs a good pass. If no hitter can reach the set in time the setter sends the ball over the net instead.',
    'Libero note: a libero in the front zone (nearer than 3 m to the net) sets with the forearms; behind the line the libero may set with the fingers.',
  ] },
  { title: 'Attacking', art: 'attack', p: [
    ...SHOT_IDS.map((id) => `${SHOTS[id].name}: ${SHOTS[id].blurb}`),
    'The hitter runs in, jumps and strikes the ball above net height. The timing of your press, the quality of the set and how far the hitter has to stretch decide the quality of the hit. Hard hits can go into the net or out. A hitter who takes off right at the net and swings late touches the net, which is a fault.',
    'Back-row players may attack only from behind the 3 m line (a pipe). The libero never attacks above the net.',
  ] },
  { title: 'Blocking', art: 'block', p: [
    'Only front-row players block. Blockers stand at the net and jump with both arms up over the net as the hitter swings. One, two or three players can block together. The block touches the ball if it passes within the reach of the hands.',
    'A block can stuff the ball straight down into the hitters\' court (a point), slow it and drop it so it can be played (a soft block), or push it out (a point for the other side). A block reaching above the net is allowed during the attack.',
    'Computer blockers read the set: better teams guess the hitter\'s side more often and jump closer to the right moment. If you are in the front row, press as the other team swings to jump yourself.',
  ] },
  { title: 'Faults and points', p: [
    'The other team gets the point when a team: lets the ball land on its own floor; sends the ball out (it lands outside the lines, or crosses the net outside the antennae); drives the ball into the net on a serve, an attack or a third touch; touches the net with a hit taken too close to it, or with a blocker jump that is badly timed right at the net; catches the ball on an overhand touch (a lift); touches the ball twice with a poorly timed set (a double contact); commits a serving error.',
    'A ball that lands on a line is in. A ball that touches the net early in the rally may still be played by the team that hit it, if it has touches left and a player can reach it.',
    'Lifts and double contacts are called only on poor overhand touches; a hitter who takes off right at the net and swings late, or lands under it, is called for a net touch (the same rule stands in for the centre-line fault). This game does not simulate: substitutions other than the libero, time-outs, cards, a player touching the ball twice in a row on purpose, a foot fault on the serve, or overlap and rotation faults. The computer keeps the order of play and places everyone in legal positions.',
  ] },
  { title: 'The libero', art: 'rotation', p: [
    'The libero wears a different colour. The libero plays only in the back row: replaces the middle blocker who is in the back row, except in position 1 where the middle blocker serves (unless Libero serves is on), and returns to the bench when that middle blocker rotates to the front. If you play libero you watch from the bench in those rotations.',
    'The libero never blocks and never attacks the ball above the net. The libero is usually the best passer on the team.',
  ] },
  { title: 'Roles', art: 'rotation', p: [
    ...ROLES.map((r) => `${r.name}: ${r.line}`),
    'Each role has its own tutorial in the match setup, and a lesson in Learn to play.',
  ] },
  { title: 'Controls and timing', art: 'ring', p: [
    'Drag to move. When the ring appears, lift your finger as it closes. Perfect, Good, OK and Poor are shown after each press. A press well before or after the ring still plays the ball, with less control. If you do not press at all the touch is made with poor timing.',
    'You must be near the ball: stretching costs quality and a ball out of reach is lost. Hold still during the touch: your player stops for it.',
    'Keyboard: arrow keys or WASD to move, Space to press, T for Think, P to pause.',
  ] },
  { title: 'Rival teams', p: [
    ...LEVELS.map((l) => `${'★'.repeat(l.stars)} ${l.name}`),
    'Rivals use the same rules and physics as you. Stronger teams move faster, jump higher, pass and hit more cleanly, read your sets and attacks better and choose their targets with more care. Each level has been tested to beat the level below it over many simulated matches. Your own team is a steady college-level squad.',
  ] },
  { title: 'Think and Watch & Learn', art: 'think', p: [
    'Think shows what a strong player would choose now (serve target, set target, attack zone) and why, using where the other team\'s players are standing at that moment. It never changes anything unless you press Use it.',
    'Watch & Learn plays a whole real match between two computer teams. At each decision there are three steps: Think (the play is frozen for 5 seconds by default; 2 to 10 in Settings), Reveal (2 seconds: the choice and its reason are shown) and Act (play continues). Pause stops all of it, including the clocks and the animation.',
  ] },
  { title: 'Settings', p: [
    'Text size scales every text screen from 100% to 300%, including the score bar and buttons in play. Movement help (default Full) can be Full, Light or Off. Sound can be switched off. Watch & Learn thinking time can be 2, 5, 8 or 10 seconds.',
  ] },
  { title: 'What this game simplifies', p: [
    'The ball and the players are drawn larger than life. Teams do not change ends. The computer places players in legal positions. There are no substitutions other than the libero, no time-outs and no cards. Overlap and rotation faults, foot faults on the serve and a separate centre-line fault are not called (a hitter who lands under the net is called for a net touch).',
  ] },
];

export const TIPS = {
  setter: ['Watch where their blockers stand and set the side where they are not.', 'A good pass lets you set the quick middle ball; a loose pass needs a high outside set.', 'Dump on the second touch when their blockers lean away.'],
  outside: ['You pass serves and attack from the left. Pass first, then run to your hitting spot.', 'Roll shots keep the ball in when the set is poor; save Power for good sets.', 'Aim for the open corner behind the block.'],
  middle: ['You block the middle and hit quick sets. Be at the net early.', 'Press to jump as the other hitter swings, not when the set is made.', 'Slide with your drag to stay in front of their hitter.'],
  opposite: ['You attack from the right and often block their best hitter.', 'Cross-court and line shots depend on where their blockers are.', 'You serve in your turn: choose Float to stay safe.'],
  libero: ['You are the passer. Get low and square to the serve.', 'Press as the ring closes; a clean pass makes every attack better.', 'Stay in the back row: use the dig on hard hits and roll to the ball.'],
};

export const ROLE_TUT = {
  setter: { title: 'Role: Setter', drill: 'set', pages: [
    { title: 'What you do', art: 'set', p: ['The setter touches the second ball and decides who attacks. Everything good begins with your choice.', 'You also serve when you reach position 1, and block when you are in the front row.'] },
    { title: 'Controls', art: 'ring', p: ['Move under the ball near the net. Press as the ring closes. A flick decides the target: left outside, right right side, up quick middle, down back-row pipe. Choose Dump (or flick hard up) for a front-row second-ball attack.'] },
    { title: 'Tips', p: TIPS.setter },
  ] },
  outside: { title: 'Role: Outside hitter', drill: 'spike', pages: [
    { title: 'What you do', art: 'attack', p: ['The outside hitter is the all-round player: you pass serves, attack from the left side and block.'] },
    { title: 'Controls', art: 'ring', p: ['Move to the ball when it is served to you and press as the ring closes. When your setter sets you, step to the spot, then press as the ring closes. Choose Power, Roll or Tip and flick to aim.'] },
    { title: 'Tips', p: TIPS.outside },
  ] },
  middle: { title: 'Role: Middle blocker', drill: 'block', pages: [
    { title: 'What you do', art: 'block', p: ['The middle blocker is the centre of the net: you block, you hit fast sets and you serve. You are never replaced by the libero.'] },
    { title: 'Controls', art: 'ring', p: ['Stand at the net across from their hitter and press as they swing to jump. Slide along the net by dragging. For quick sets get under the ball early.'] },
    { title: 'Tips', p: TIPS.middle },
  ] },
  opposite: { title: 'Role: Opposite', drill: 'spike', pages: [
    { title: 'What you do', art: 'attack', p: ['The opposite plays across from the setter. You attack from the right side, block and often take the big swings.'] },
    { title: 'Controls', art: 'ring', p: ['Run to the right-side spot when the setter is about to set. Press as the ring closes. Flick to choose line, angle, deep or short.'] },
    { title: 'Tips', p: TIPS.opposite },
  ] },
  libero: { title: 'Role: Libero', drill: 'receive', pages: [
    { title: 'What you do', art: 'receive', p: ['The libero is the back-row specialist. You pass the serve and dig hard hits. You wear a different colour and never block or attack above the net.'] },
    { title: 'Controls', art: 'ring', p: ['Move under the ball and press as the ring closes. Hold still for the touch. A flick sends a bad ball over the net.'] },
    { title: 'Tips', p: TIPS.libero },
  ] },
};

export const LESSONS = [
  { id: 'serve', title: '1. Serve', goal: 'Land 4 of 6 serves in the court', n: 6, need: 4, role: 'setter', drill: { kind: 'serve', server: 0 }, intro: ['Tap to toss, then press as the ring closes. Flick to aim.', 'A Float serve almost always lands in. A Jump serve is faster and misses more.'] },
  { id: 'receive', title: '2. Pass', goal: 'Pass 4 of 6 serves well', n: 6, need: 4, role: 'libero', drill: { kind: 'receive', server: 1 }, intro: ['The rival serves. Get under the ball and press as the ring closes.', 'A clean pass is one that reaches the setter near the net.'] },
  { id: 'set', title: '3. Set', goal: 'Set 4 of 6 balls well', n: 6, need: 4, role: 'setter', drill: { kind: 'set', server: 1 }, intro: ['Your team passes; you set. Move under the ball and press as the ring closes. Flick to choose the hitter.'] },
  { id: 'spike', title: '4. Spike', goal: 'Time 3 of 6 spikes well', n: 6, need: 3, role: 'outside', drill: { kind: 'spike', server: 1 }, intro: ['Your team passes and sets to you. Get to your spot and press as the ring closes. Choose a shot with the buttons and flick to aim.'] },
  { id: 'block', title: '5. Block', goal: 'Touch 2 of 6 attacks with a block', n: 6, need: 2, role: 'middle', drill: { kind: 'block', server: 1 }, intro: ['Stand at the net across from the hitter and press as they swing.'] },
  { id: 'rules', title: '6. Rules quiz', goal: 'Answer 4 of 5 questions', quiz: true, need: 4, intro: ['Five short questions about rotation and the rules.'] },
];

export const QUIZ = [
  { q: 'How many times may a team touch the ball before it must cross the net?', a: ['Two', 'Three', 'Four'], ok: 1 },
  { q: 'When does the rotation happen?', a: ['After every point', 'When the receiving team wins the rally and gains the serve', 'Every five points'], ok: 1 },
  { q: 'A set to 25 is tied at 24-24. When does it end?', a: ['At 25', 'When one team leads by two', 'After one more point'], ok: 1 },
  { q: 'Which player stays in the back row and wears a different colour?', a: ['Setter', 'Libero', 'Opposite'], ok: 1 },
  { q: 'A blocker touches the ball. How many touches does that team now have?', a: ['Two', 'Three more', 'None'], ok: 1 },
];
void SERVE_IDS;
