// Text for About, How to Play, Rules, the role guides, the Learn lessons and the quiz. Numbers come from the engine's own constants.
import { HL, HW, GOAL_HW, GOAL_H, BOX_HW, BOX_D, SPOT, CIRCLE_R, LEVELS } from './consts.js';

const L = (n) => `${n}`;
const PW = HW * 2, PL = HL * 2;

export const ABOUT = [
  { title: 'Football for everyone', art: 'pitch', p: [
    'Football is played in almost every country in the world, in stadiums, schools, parks and streets. Small-sided games such as seven-a-side are a popular way to play: a smaller pitch, fewer players, and the ball always close.',
    'This game is a seven-a-side match you play from the inside. You pick one role, your computer teammates play the others, and the match is played in real time on a compact pitch (38 m by 25 m, smaller than a usual seven-a-side pitch so that all of it fits on a phone screen) that never moves.',
  ] },
  { title: 'This version', art: 'roles', p: [
    'You control one player for the whole match: striker, winger, central midfielder, defender or goalkeeper. Each role has its own job and its own controls. The other six players on your team and all seven opponents are computer players.',
    'Five computer teams play at five levels. Learn to play teaches the controls and the rules with short practice drills, Think suggests a good move and tells you why, and Watch & Learn lets you follow a whole match between two computer teams.',
  ] },
  { title: 'Rules in this game', p: [
    'The rules follow the usual laws of football as closely as a phone game can. The Rules pages list every simplification honestly: there is no offside, no cards and no extra time, and the halves are short.',
  ] },
];

export const HOWTO = [
  { title: 'Pick a role', art: 'roles', p: [
    'Before the match you choose one role. You keep it for the whole match. Strikers score, wingers beat their marker and cross, central midfielders link the team, defenders protect the goal, and the goalkeeper stops shots.',
    'The yellow ring and arrow show the player you control. Role tags above your teammates tell you who is who.',
  ] },
  { title: 'Move', art: 'controls', p: [
    'Put your left thumb anywhere in the bottom-left corner and drag: that is the stick. Push it to the edge, or hold SPRINT, to run faster. Sprinting uses stamina, which refills when you jog.',
    'On a keyboard use the arrow keys or W A S D to move and Shift to sprint.',
  ] },
  { title: 'With the ball', art: 'controls', p: [
    `SHOOT: hold to charge the ring, release to shoot. Drag the finger left or right while holding to curl the ball. The stick sets the direction.`,
    'PASS: a short pass along the ground to the teammate the stick points at. Hold a little longer for a firmer pass. LOB sends the ball over the defenders and THROUGH plays it into space ahead of a running teammate.',
    'A ring shows who will receive the pass. Keyboard: J K L I (or Z X C V) for the four buttons.',
  ] },
  { title: 'Without the ball', art: 'controls', p: [
    'TACKLE steals the ball from a close opponent in front of you. SLIDE reaches farther but is riskier: it is a foul if you hit the player before the ball. HEAD jumps for a high ball. CALL asks the player with the ball to pass to you.',
    'Stand goal-side of your opponent, wait for him to take a touch, then tackle. Tackling from behind is dangerous.',
  ] },
  { title: 'Goalkeeper', art: 'keeper', p: [
    'Swipe on the pitch in the direction you want to dive, or hold the stick that way and press DIVE. Press JUMP for a high save. Dive when the ball is about a third of a second from you: too early and the shot beats you the other way.',
    'When you catch the ball, aim with the stick and press KICK for a long ball or THROW for a short one to a teammate.',
  ] },
  { title: 'Restarts', art: 'setpieces', p: [
    'After a goal, a foul, or when the ball goes out, play restarts with a kick-off, throw-in, corner, goal kick, free kick or penalty. If your player is the taker, aim with the stick and press a button. Otherwise the computer takes it.',
  ] },
  { title: 'Think and Watch & Learn', art: 'think', p: [
    'Think pauses the match and shows what a good player would do now and why, for your role. It never plays for you.',
    'Watch & Learn plays a whole match between two computer teams. At the key moments the match stops: first Think, then Reveal, then the move is played. Pause stops everything.',
  ] },
];

export const RULES = [
  { title: 'The pitch and the goals', art: 'pitch', p: [
    `The pitch is ${PL} m long and ${PW} m wide, drawn with the goals at the top and bottom. It never moves, zooms or turns. Each goal is ${GOAL_HW * 2} m wide and ${GOAL_H} m high with a net behind it.`,
    `Each penalty area is ${BOX_HW * 2} m wide and ${BOX_D} m deep. The penalty spot is ${SPOT} m from the goal line. The centre circle has a radius of ${CIRCLE_R} m.`,
  ] },
  { title: 'The teams', art: 'roles', p: [
    'Each team has seven players: a goalkeeper, two defenders (left and right), a central midfielder, two wingers (left and right) and a striker. You control one player for the whole match. Everyone else is a computer player.',
    'Your team plays from the bottom of the screen towards the top. The opponents defend the top goal. Teams do not change ends at half time.',
  ] },
  { title: 'The match', p: [
    'A match has two halves of 2, 3 or 5 minutes. You choose before the match. The clock runs only while the ball is in play and stops during goals, restarts and fouls.',
    'When the clock reaches zero the half ends at the next stoppage, or after 7 seconds at the latest. There is no extra time. The side with more goals wins. If the score is level the match is a draw.',
    'The team that did not kick off the first half kicks off the second half. After a goal the team that conceded kicks off.',
  ] },
  { title: 'Kick-off', art: 'setpieces', p: [
    'Before a kick-off every player is on their own half. The kicking team takes the ball from the centre spot. The other team must stay outside the centre circle until the ball is kicked.',
    'The ball is in play as soon as it moves. The kicker may pass in any direction. A goal can be scored directly from the kick-off.',
  ] },
  { title: 'Scoring', p: [
    'A goal is scored when the ball crosses the goal line (its centre passes the line) between the posts and under the crossbar. The ball hitting the post or the bar and bouncing back stays in play. An own goal counts for the other team.',
  ] },
  { title: 'Ball out of play', art: 'setpieces', p: [
    'The ball is out when its centre crosses the touchline or the goal line outside the goal. Over the touchline: a throw-in for the team that did not touch it last. Over the goal line: a corner for the attackers if a defender touched it last, a goal kick for the defenders if an attacker touched it last.',
  ] },
  { title: 'Throw-ins', p: [
    'The nearest player takes the throw-in from the touchline, holding the ball over the head with both hands. Opponents stay at least 2 m away. The ball is in play once it is thrown.',
  ] },
  { title: 'Goal kicks and corners', art: 'setpieces', p: [
    'A goal kick is taken by the goalkeeper from just inside the penalty area; opponents stay outside the area until it is taken. A corner is taken from the corner, usually by a winger; opponents stay at least 3 m from the ball.',
    'A goal can be scored directly from a corner or a goal kick.',
  ] },
  { title: 'Fouls and free kicks', art: 'tackle', p: [
    'A foul is called when a tackle hits the player before it reaches the ball, when a slide tackle hits a player, or sometimes when a tackle from behind wins the ball. Fouls are decided by the engine at the moment of contact: a clean tackle that wins the ball is usually allowed, a late or reckless one is not.',
    'The other team takes a direct free kick where the foul happened. Opponents stay at least 3 m from the ball. A foul by a defender inside their own penalty area gives a penalty.',
    'There are no yellow or red cards, and no advantage rule.',
  ] },
  { title: 'Penalties', art: 'penalty', p: [
    `A penalty is taken from the penalty spot, ${SPOT} m from the goal. Only the taker and the goalkeeper are inside the area; the goalkeeper stays on the goal line until the ball is struck. Everyone else waits outside the area. The ball is live after it is struck, so a rebound can be played.`,
  ] },
  { title: 'The goalkeeper', art: 'keeper', p: [
    'The goalkeeper may use hands inside their own penalty area. A catch holds the ball: the goalkeeper then throws or kicks it out. A hard shot or a stretched dive may be parried instead, and a parried ball stays in play.',
    'The goalkeeper may dive to either side or jump. A dive covers about two metres to the side; saving a shot depends on diving at the right time, and on the shot: harder shots are harder to hold.',
    'Outside the penalty area the goalkeeper plays with the feet like a defender. There is no back-pass rule.',
  ] },
  { title: 'Passing, shooting and heading', p: [
    'A pass along the ground, a lofted pass and a through ball all use the same ball physics: the ball slows on the grass, bounces when it lands, bends when it has spin and is slowed by the air. Harder passes are less accurate, and pressure from a close opponent makes every kick less accurate.',
    'A header needs the ball between about 1 m and 2.5 m high. The player jumps and must time the jump: the header is struck at the highest point.',
    'A ball arriving too fast to control is blocked or bounces away from the player.',
  ] },
  { title: 'No offside', p: [
    'There is no offside rule in this game. Attackers may wait near the opponent goal. Small-sided matches are often played this way, and the defenders must stay goal-side.',
  ] },
  { title: 'Computer players and levels', art: 'levels', p: [
    ...LEVELS.map((l) => `${l.name}: level ${l.id} of 5.`),
    'Each level beats the one below it. Higher levels react sooner, run slightly faster, pass and shoot more accurately, tackle better, see more options and press harder. They follow exactly the same rules as you.',
  ] },
  { title: 'Simplifications', p: [
    'This is a short, real-time version of seven-a-side football on a small pitch. Simplifications: no offside, no cards, no extra time or penalty shoot-out, no substitutions or injuries, no wind, one referee decision per contact, and a limited set of set pieces. Teams do not swap ends.',
  ] },
];

export const ROLE_GUIDE = {
  ST: [
    { title: 'Striker: your job', art: 'roles', p: [
      'You are the player furthest forward. Your job is to be where the ball can be put into the net: find space behind the defenders, hold the ball up, and finish.',
      'Teammates look for you. Stay between the defenders, away from the nearest one, and call for the ball with CALL.',
    ] },
    { title: 'Striker: controls', art: 'controls', p: [
      'SHOOT: hold to charge, release to shoot. Aim with the stick; when you point near the goal the aim is bent towards the goal mouth. Drag sideways while holding to curl the ball around the goalkeeper.',
      'HEAD: when a cross comes in at head height, press HEAD just before it reaches you. PASS lays the ball off to a teammate. SLIDE and TACKLE are for winning the ball back when you lose it near the opponents.',
    ] },
    { title: 'Striker: tips', p: [
      'Shoot early from inside the area: the pitch is small. Shots from close range into the corners are hardest to save. If a defender is next to you, pass to a free teammate or turn away with the ball.',
    ] },
  ],
  W: [
    { title: 'Winger: your job', art: 'roles', p: [
      'You play wide, on the left or right side. Your job is to stretch the defence, beat your marker with speed, and cross for the striker or cut inside to shoot. When the other team has the ball, help your defender.',
    ] },
    { title: 'Winger: controls', art: 'controls', p: [
      'Sprint down the side with the ball and use LOB to cross into the area. Use SHOOT when you cut inside. THROUGH plays the ball to a runner in the middle.',
      'SLIDE or TACKLE when the opposing full back has the ball near your touchline.',
    ] },
    { title: 'Winger: tips', p: [
      'Run with the ball on the side away from the nearest defender. A cross to the far post is hard for a goalkeeper to reach. Take your time: a good cross needs space.',
    ] },
  ],
  CM: [
    { title: 'Central midfielder: your job', art: 'roles', p: [
      'You are the link between defence and attack. You cover a lot of ground: win the ball, find the free teammate, and arrive in the area for a shot.',
    ] },
    { title: 'Central midfielder: controls', art: 'controls', p: [
      'PASS keeps the ball moving. THROUGH finds a teammate running behind the defenders. LOB switches play over the defence. TACKLE when the opponent with the ball is close and in front of you.',
      'You take the free kicks near the middle of the pitch.',
    ] },
    { title: 'Central midfielder: tips', p: [
      'Always look for a triangle: stand where two teammates can pass to you. When the other team has the ball, stand between the ball and your goal so you can intercept passes.',
    ] },
  ],
  D: [
    { title: 'Defender: your job', art: 'roles', p: [
      'You protect the goal. Mark the opponent who is nearest your goal, stay between him and the goal, and clear the ball when it is dangerous.',
    ] },
    { title: 'Defender: controls', art: 'controls', p: [
      'TACKLE when the ball carrier is close and in front of you. SLIDE only when you are sure you will reach the ball. KICK (the TACKLE button when the ball is loose and near) clears it away. When you win the ball, PASS to a free teammate.',
    ] },
    { title: 'Defender: tips', p: [
      'Do not rush in. Stay goal-side and wait until the attacker takes a touch, then tackle. Tackling from behind is a foul risk. When the ball is in the air, jump for it with HEAD.',
    ] },
  ],
  GK: [
    { title: 'Goalkeeper: your job', art: 'keeper', p: [
      'You are the last line of defence and the only player who may use hands, inside your own penalty area. Stop shots, collect crosses, and start attacks with a good throw or kick.',
    ] },
    { title: 'Goalkeeper: controls', art: 'keeper', p: [
      'Move left and right on your line with the stick. To dive, swipe on the pitch in that direction, or hold the stick that way and press DIVE. JUMP reaches high shots.',
      'After a catch, aim with the stick: KICK for a long ball, THROW for a short throw to a teammate.',
    ] },
    { title: 'Goalkeeper: tips', p: [
      'Stay between the ball and the middle of the goal. Come out a little when an attacker is running at you alone. Do not dive too early: wait until the ball is struck and about a third of a second away.',
    ] },
  ],
};

// Learn: short drills on the real pitch, then a quiz
export const LESSONS = [
  { id: 'move', title: '1. Move and sprint', goal: 'touch 4 cones in 30 seconds', n: 4, need: 4, role: 'CM', drill: { kind: 'move' }, intro: ['Drag the stick to run. Push it to the edge or hold SPRINT to run faster. Touch each marker as it lights up, in any order.'] },
  { id: 'pass', title: '2. Passing', goal: 'complete 4 passes out of 5', n: 5, need: 4, role: 'CM', drill: { kind: 'pass' }, intro: ['Point the stick at the teammate with the glowing ring and press PASS. A ring shows who will receive the ball. Hold a little longer for a harder pass.'] },
  { id: 'shoot', title: '3. Shooting', goal: 'score 2 goals from 5 shots', n: 5, need: 2, role: 'ST', drill: { kind: 'shoot' }, intro: ['Aim at a corner with the stick, hold SHOOT to charge the ring and release. A goalkeeper defends the goal.'] },
  { id: 'tackle', title: '4. Tackling', goal: 'win the ball 2 times in 4 tries', n: 4, need: 2, role: 'D', drill: { kind: 'tackle' }, intro: ['An attacker dribbles towards your goal. Stay goal-side, get close and press TACKLE when the ball is out in front of him. SLIDE is risky.'] },
  { id: 'head', title: '5. Crosses and headers', goal: 'head 2 of 4 crosses on target', n: 4, need: 2, role: 'ST', drill: { kind: 'head' }, intro: ['The winger crosses. Be near the penalty spot and press HEAD just before the ball arrives. Aim with the stick.'] },
  { id: 'keeper', title: '6. Goalkeeping', goal: 'save 3 of 6 shots', n: 6, need: 3, role: 'GK', drill: { kind: 'keeper' }, intro: ['Shots come from different places. Swipe or hold the stick and press DIVE when the ball is struck.'] },
  { id: 'quiz', title: '7. Rules quiz', goal: 'answer 4 of 6 correctly', n: 6, need: 4, quiz: true, intro: ['Six short questions about the rules of this game.'] },
];
export const QUIZ = [
  { q: 'Who may use their hands?', a: ['Any defender', 'Only the goalkeeper, in their own penalty area', 'Anyone near the goal'], ok: 1 },
  { q: 'The ball crosses the goal line outside the goal. A defender touched it last. What happens?', a: ['Goal kick', 'Corner for the attackers', 'Throw-in'], ok: 1 },
  { q: 'A defender fouls an attacker inside his own penalty area. What happens?', a: ['Penalty', 'Throw-in', 'Corner'], ok: 0 },
  { q: 'Is there an offside rule in this game?', a: ['Yes, like the big game', 'No', 'Only in the second half'], ok: 1 },
  { q: 'The match is level when the second half ends. What happens?', a: ['Extra time', 'Penalty shoot-out', 'It is a draw'], ok: 2 },
  { q: 'Where do you stand when you defend?', a: ['Behind the attacker', 'Between the attacker and your goal', 'Far from the ball'], ok: 1 },
];
