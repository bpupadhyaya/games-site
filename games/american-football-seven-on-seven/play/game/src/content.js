// Text of the Rules, How to Play and About pages and the Learn lessons. Every rule here was checked against the engine (consts.js, plays.js, match.js, sim.js).
import { OFF_PLAYS, DEF_CALLS } from './plays.js';
import { FIELD, ROLES } from './consts.js';
import { matrixNote } from './coach.js';

export const ABOUT = [
  { title: 'American Football: 7 on 7', p: ['A simplified, seven-a-side version of American football on a short field. Call a play, then play it in real time as one chosen position: quarterback, running back, wide receiver, tight end, defensive lineman, linebacker, cornerback or safety.', 'Every other player, on your side and the other, is controlled by the computer. The opponent has five levels.'] },
  { title: 'What is simplified', p: ['Seven players a side, a 40 yard field with two 6 yard end zones, no kickoff returns, no penalties and no substitutions. Tackles are wrap-ups: the defender wraps the ball carrier and both go down slowly.', 'Players are stylised mannequins with team-colour helmets and striped kits. The teams are just Blue and Red.'] },
  { title: 'Two-way players', p: ['Each of the seven players on a team plays both offence and defence. Your position pairs an offensive role with a defensive one: quarterback and safety, running back and linebacker, wide receiver and cornerback, tight end and defensive lineman.'] },
];

export const HOWTO = [
  { title: 'The idea', p: ['Pick your position once, at the start of a game. Each down you call a play (when your team has the ball) or a defence (when it does not). Then the play runs in real time and you control your own player.', 'Four tries (downs) to gain 10 yards. Score touchdowns and field goals. Four quarters.'] },
  { title: 'Moving', p: ['Touch and drag anywhere on the field to run: the further you drag from where you touched, the faster you go. Let go and your player carries on with the job the play gives him (running his route, covering, blocking), so you can always tap a button without losing him.', 'On a keyboard: arrow keys or WASD, Space for the main button, J / K / L for juke left, spin, juke right, B for burst, P to pause, H for Think.'] },
  { title: 'The buttons', p: ['The buttons at the bottom change with what your player is doing. With the ball: Juke left, Spin, Juke right, Burst. Running a route: Hands (tap as the ball arrives) and Burst. Defending: Tackle (dive at the ball carrier), Swat (jump for the ball), Burst. Defensive lineman: Move (beat the block) and Tackle. Quarterback: one button for each receiver.'] },
  { title: 'Throwing', p: ['As quarterback, tap a receiver button for a hard, flat throw. Hold it for a lob and let go: a longer hold is a higher, softer ball. The button shows a mark for the hold that suits the distance: let go near the mark for the most accurate throw.'] },
  { title: 'Think, Watch and Learn', p: ['Think gives a suggestion with the reasons, all taken from simulated plays. Watch & Learn plays a whole game with the computer on both sides, shows what it is thinking, and has a real Pause. Learn has short lessons on downs, plays and your position.'] },
];

const li = (id) => OFF_PLAYS.find((p) => p.id === id);
export const RULES = [
  { title: 'The field', art: 'field', p: [`The field is ${FIELD.W} yards wide and ${FIELD.LEN} yards long between the goal lines, with an end zone of ${FIELD.EZ} yards at each end. Blue always attacks away from the camera, Red toward it. The blue line marks the line of scrimmage and the yellow line the first-down mark.`] },
  { title: 'The teams', p: ['Seven players a side: on offence a quarterback, a running back, two wide receivers, a tight end and two linemen (a centre and a guard); on defence two defensive linemen, two linebackers, two cornerbacks and a safety. The same seven players play both ways.'] },
  { title: 'Downs and distance', p: [`The team with the ball has four downs to gain ${FIELD.FIRST} yards. Gain them and the count starts again at first down. Fail on fourth down and the other team takes over where the ball is. Near the goal line the distance is the distance to the goal line.`] },
  { title: 'Scoring', p: ['A touchdown (the ball carrier crosses the goal line, or a pass is caught in the end zone) is 6 points. After it comes a try: kick the extra point (1 point, usually good) or go for 2 by running one play from the 3 yard line. A field goal is 3 points. A safety (the offence is tackled in its own end zone) is 2 points for the defence, and the scoring side takes the ball at its own 20.'] },
  { title: 'Kicks', p: [`On fourth down you may punt (the ball goes about 24 yards, the other team takes over, no return) or kick a field goal if it is within range (a kick of at most 33 yards, which is the distance to the goal line plus 8). The menu shows the chance. The computer runs the kick; the chance falls with distance.`] },
  { title: 'Quarters and clock', p: ['Four quarters of 1, 2 or 3 minutes, chosen when you start. The clock runs during plays and 9 seconds between plays, and stops for an incomplete pass, a ball carrier out of bounds or a score. The play in progress always finishes. The second half starts with a kickoff to the team that did not receive first (the ball goes to the 12 yard line). A tied game is a draw.'] },
  { title: 'Turnovers', p: ['An intercepted pass or a fumble the defence recovers is a turnover: the ball carrier keeps running and the defence is now on offence. A turnover can be run back for a touchdown. A fumble can happen when a ball carrier is wrapped up; a loose ball goes to the nearest player.'] },
  { title: 'Tackles', p: ['A defender who reaches the ball carrier wraps him around the waist; both slow down and go to the ground together, and the play is over where the carrier goes down. It is not violent: nobody is hurt and there are no pile-ons. A defender can also dive at a carrier; a juke or a spin just before the contact makes a miss much more likely. A quarterback wrapped behind the line is a sack.'] },
  { title: 'Blocking', p: ['Linemen, tight end and receivers block. A block holds a defender for a moment (longer when the blocker is stronger); then the defender gets free. A defensive lineman you control can press the Move button after a moment (once the block has held for a third of a second) to beat his blocker.'] },
  { title: 'Passing', p: ['The quarterback drops back and throws to one of four receivers. The throw takes a short wind-up; accuracy falls with distance, pressure and throwing on the run. A pass is complete if the receiver catches it in bounds; a defender close to the ball can break it up or intercept it. A receiver who is the target can press Hands as the ball arrives to catch it more surely.'] },
  { title: 'Out of bounds', p: ['A ball carrier who touches the sideline is out of bounds and the play ends there; the clock stops. A pass caught outside the lines is incomplete.'] },
  ...OFF_PLAYS.map((p) => ({ title: `Offence: ${p.name}`, art: `off:${p.id}`, p: [p.desc, matrixNote('off', p.id)] })),
  ...DEF_CALLS.map((c) => ({ title: `Defence: ${c.name}`, art: `def:${c.id}`, p: [c.desc, matrixNote('def', c.id)] })),
  { title: 'Your position', p: ROLES.filter((r) => r.unit === 'off').map((r) => `${r.name} (offence) and ${ROLES.find((x) => x.id === r.pair).name.toLowerCase()} (defence): the same player.`).concat(['You choose one pair at the start of a game and keep it. Everyone else is controlled by the computer.']) },
  { title: 'Opponent levels', p: ['Rookie, Club, Varsity, Pro and Champion. Higher levels run faster, react sooner, throw more accurately, read the field better and call plays better. Each level was tested by simulation against the one below and wins most games against it.'] },
  { title: 'What is not in the game', p: ['No penalties, no kickoff returns, no timeouts, no substitutions, no overtime (a tied game is a draw), no injuries.'] },
];
void li;

export const LESSONS = [
  { id: 'downs', title: 'Downs and distance', goal: 'Gain 10 yards in four downs', intro: ['You have four downs to move the ball 10 yards. The yellow line is the mark to reach. Call any play, then play it.'], done: 'Good: reaching the yellow line gives a new set of four downs.', kind: 'first' },
  { id: 'call', title: 'Calling a play', goal: 'Call Quick Pass and complete a pass', intro: ['Each play has a diagram. Quick Pass is a short, safe throw. Choose it and press Run play.'], done: 'A short pass is the safest way to move the ball.', kind: 'complete', call: 'quick' },
  { id: 'role', title: 'Your position', goal: 'Make a play with your player', intro: ['Your player is ringed in gold. Run a play and use your buttons. As quarterback throw, as a runner run, as a receiver catch, as a defender tackle.'], done: 'That is your job on every play.', kind: 'any' },
  { id: 'defence', title: 'Defence', goal: 'Call a defence and stop a play', intro: ['When the other team has the ball you call the defence. Zone guards areas, Man covers one receiver each. Pick one and try to stop the play.'], done: 'Well done.', kind: 'stop' },
];

// one short card per position pair: what you do on each side and which buttons you have
export const ROLE_TEXT = {
  QB: { off: 'Quarterback: after the snap you drop back. Tap a receiver button to throw hard and flat, or hold it for a lob and let go near the mark. Drag to run away from the rush; cross the line with the ball and you are a runner.', def: 'Safety: you guard the deep middle. Drag to move, Swat to jump for the ball, Tackle to dive at the runner, Burst to sprint.' },
  RB: { off: 'Running back: take the handoff and drag to run through the gaps. Juke left or right and Spin to make tacklers miss, Burst to sprint. On a pass play run your route and catch.', def: 'Linebacker: you cover the back or fill the gap. Drag to move, Tackle to dive, Swat for the ball, Burst to sprint.' },
  WR: { off: 'Wide receiver: you run your route by yourself; drag to bend it. When the ball comes to you tap Hands as it arrives. After the catch, run: Juke, Spin, Burst. On runs you block.', def: 'Cornerback: cover a receiver. Drag to stay with him, Swat to knock the ball away or pick it off, Tackle after the catch.' },
  TE: { off: 'Tight end: you block on runs and run a short route on passes. Drag to adjust your route, tap Hands as the ball arrives, then run with it.', def: 'Defensive lineman: you rush the quarterback. Drag at him; when a blocker grabs you, press Move once the block has held for a moment to break free, then Tackle to dive at the quarterback or runner.' },
};
