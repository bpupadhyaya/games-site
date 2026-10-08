// All reader text: About, How to Play and the exhaustive Rules. Every number here is the number the simulation uses (see sim.js, courses.js, training.js).
export const ABOUT = [
  { title: 'Sheepdog Trials', p: [
    'You are the handler at the post of a hill-pasture sheepdog trial. With whistle and voice commands you direct a border collie to gather a flock, bring it through gates and pen it, against the clock, and a judge scores your run out of 100.',
    'The flock is alive: the ewes keep away from the dog, bunch up when worried, follow a lead ewe and sometimes one stands her ground. The skill is reading the sheep and putting the dog in the right place, not tapping fast.'] },
  { title: 'About the sport', art: 'balance', p: [
    'Sheepdog trials grew out of the daily work of shepherds on the hill farms of the United Kingdom, and are now loved across New Zealand, Australia and many other countries. A handler stands at a post and works a dog at a distance with calls and whistles.',
    'A dog "runs out" to gather the sheep, "lifts" them, "fetches" them to the handler, "drives" them away through gates and finally helps to pen them. Judges look for calm, straight, controlled work, not speed alone.'] },
  { title: 'How it is made', p: [
    'The hills, the sheep, the dog and the handler are all simulated in 3D. The flock follows simple rules (flight zone, cohesion, a lead ewe) and the dog\'s stamina and "eye" are tracked as it works, so every run is different.',
    'The game is free of trial organisation names, marks and logos. Sheep and the dog have no names; weather and time of day are chosen when you start.'] },
];

export const HOWTO = [
  { title: 'The trial', p: [
    'Choose a course, a time of day and the weather, then start. Your dog waits by your feet at the post. The flock is grazing far up the field.',
    'A run has five stages: Outrun, Lift, Fetch, Drive and Pen. The judge gives up to 100 points, including time and the quality of the dog work. Finish before the clock runs out.'] },
  { title: 'The five commands', art: 'commands', p: [
    'COME BYE sends the dog clockwise around the sheep. AWAY TO ME sends it anticlockwise. WALK ON tells it to move in on the sheep. LIE DOWN drops it and rests it. STAND stops it on its feet.',
    'A command stays on until you give another: a flanking dog keeps circling until you stop it. Keyboard: D or Right = Come bye, A or Left = Away to me, W or Up = Walk on, S or Down = Lie down, Space = Stand.'] },
  { title: 'How to move the sheep', art: 'balance', p: [
    'Sheep move away from the dog. To send them somewhere, put the dog on the opposite side of the flock from where you want them, then Walk on. The gold ring on the field and the plan map shows this "balance point".',
    'If the flock drifts sideways, Stand (or Walk on less), flank a little with Come bye or Away to me to bring the dog back onto the line, then Walk on again.'] },
  { title: 'The gauges', art: 'stamina', p: [
    'STAMINA: running tires the dog, resting restores it. A tired dog is slow. EYE: a steady, close walk-on builds the dog\'s "eye"; with a strong eye the flock stays tight and moves calmly. Galloping close in, or reversing the flank, breaks it.'] },
  { title: 'Pen and gate', p: [
    'When the first drive gate is passed the handler starts walking to the pen. Tap GATE to open it when the flock is close, work the sheep into the pen, then tap GATE again to shut it when all of them are inside.'] },
  { title: 'Training, Watch & Learn and Think', art: 'think', p: [
    'Training teaches the young dog one command at a time on a small meadow. Watch & Learn shows the computer handler playing a whole run: it thinks, shows its choice, then does it; you can pause at any time. Think in a run shows the best next command and why.',
    'Pause, Think and the camera button are at the top left. The camera switches between a view that frames the dog and the flock and a close view behind the dog.'] },
];

export const RULES = [
  { title: 'The trial at a glance', p: [
    'A trial is a series of stages worked in order: Outrun (15 points), Lift (10), Fetch (20), Drive (20), Pen (15), Time (10) and Control (10): 100 in all.',
    'The handler stands at the post (the origin of the field). The flock starts grazing at the far end. The run ends when the pen gate is shut with every sheep inside, or when the time limit of the course is reached.',
    'Each fault takes points off its stage. The result screen lists every fault the judge noted.'] },
  { title: 'The field', art: 'course', p: [
    'All distances are in metres. The field is fenced all round; sheep and dog cannot leave it. Boulders and gorse bushes are solid for sheep; the dog can run through gorse but not boulders.',
    'There are three gates and a pen. The Fetch gate is in the middle of the field and the flock must cross it towards the handler. The First drive gate is to the left and the flock crosses it going away from the handler; the Second drive gate is to the right and is crossed from left to right. The pen stands to the right of the post.',
    'A gate is two posts. Its width is the gap between the posts (7 m on Valley Paddock down to 4 m on Highland Crag). Every sheep must pass between the posts in the right direction. A sheep that goes round a post, or that crosses the wrong way, does not count.'] },
  { title: 'The pen', p: [
    'The pen is a square 5 m by 5 m, fenced on three sides. The fourth side has a mouth with a hinged gate, 3.4 m wide on Valley Paddock down to 2.8 m on Highland Crag, facing up the field.',
    'The gate is closed at the start. When the first drive gate is passed the handler starts walking to the pen (about 15 seconds). Once he is there you can open the gate with GATE; open, it folds back against the fence and does not block anything. Shut it with GATE.',
    'The run is complete only when the gate is shut with all sheep inside. If you shut it early the run goes on and you can open it again. A fence between the dog and a ewe takes most of the pressure off her.'] },
  { title: 'The five commands', art: 'commands', p: [
    'COME BYE: the dog circles the flock clockwise. AWAY TO ME: anticlockwise. When sent from far away the dog runs wide, clear of the sheep\'s flight zone; sent from close, it keeps its distance. A trained dog eases as it comes round to the balance point.',
    'WALK ON: the dog moves straight in on the flock. It runs hard when the flock is more than 40 m away, trots when it is more than one and a half flight zones away, walks inside that, and creeps (0.7 m/s) when a sheep is nearer than 2.2 m.',
    'LIE DOWN: the dog drops where it is and rests. A lying dog puts very little pressure on the sheep. STAND: the dog stops on its feet and keeps its eye on the flock, holding them without pushing.'] },
  { title: 'The dog', p: [
    'Speeds: walk 1.7 m/s, trot 4.8 m/s, gallop 8.6 m/s. Uphill slows the dog; downhill helps it a little.',
    'Stamina: galloping uses 2.4% a second, trotting 1.2%, walking 0.5%, standing 0.1%. Lying down restores 3.2% a second (3.8% at dawn). Uphill running costs more. Wind and rain add a little to the cost. Below 40% stamina the dog slows, down to half speed at zero; at zero it is out of breath, which the judge notes once per spell.',
    'Eye: while the dog walks on slowly and steadily close to the flock (inside 1.25 flight zones, further than 2 m), its eye builds at 20% a second. Galloping close in (inside 0.85 flight zones) breaks it quickly; reversing the flank, lying down and losing contact take it away too. With a full eye the sheep flee more slowly and bunch up more tightly.'] },
  { title: 'The sheep', art: 'zone', p: [
    'Every ewe has a flight zone around the dog: the course\'s base distance (16 m on Valley Paddock rising to 21 m on Highland Crag, then changed by weather) times her own nerve. A dog is more worrying when it is galloping or trotting at her than when it walks, stands or lies.',
    'Inside the zone a ewe moves directly away from the dog, faster the closer it is. A dog heading straight at a ewe reaches further than one passing across. When one ewe runs, nearby ewes take alarm and run with her; the flock bunches up (cohesion) and follows the lead ewe, who wears a bell.',
    'On the harder courses a bold ewe has 55% of the usual flight zone and will stamp and stand her ground until the dog\'s eye is strong. Breaking away: a ewe more than about 20 m from the flock for over 5 seconds is a break-away.',
    'Grazing sheep wander slowly; wind pushes them along; uphill slows them; fences, boulders and gate posts stop them. The handler worries them too, within 6 m (2.6 m when standing at the pen).'] },
  { title: 'The balance point', art: 'balance', p: [
    'Sheep move along the line from the dog through the flock. The balance point is the place on the far side of the flock from the current target (the fetch gate, the handler, a drive gate or the pen). A dog standing there and walking on drives the flock to the target.',
    'The field shows the balance point as a gold ring a few metres behind the flock and the plan map shows it too. When the dog is far off it, flank with Come bye or Away to me; the dog slows as it comes to the balance point.'] },
  { title: 'Stage 1: Outrun (15)', p: [
    'Send the dog with Come bye or Away to me. The stage ends when the dog is behind the flock (more than 135 degrees round from the handler\'s side, and within 1.8 flight zones of the sheep).',
    'Faults: 0.45 points for every sheep-second spent inside a flight zone (up to 9), and up to 4 more if any sheep bolted faster than 4.6 m/s (1 point for each second of bolting beyond half a second).'] },
  { title: 'Stage 2: Lift (10)', p: [
    'Start the flock moving with a quiet Walk on. The lift ends when the flock\'s centre has moved 7 m (or after 60 seconds).',
    'Faults: bolting for more than 0.6 s (1.4 points a second, up to 4); the flock split (average distance from its centre over 12 m): 3; a lift slower than 45 s: 2.'] },
  { title: 'Stage 3: Fetch (20)', p: [
    'Bring the flock through the fetch gate and on to the handler. The stage ends when the gate is passed (or all sheep have crossed its line) and the flock\'s centre is within 13 m of the post.',
    'Faults: missing the gate costs 10 points times the share of sheep that missed it; a crooked fetch costs 0.9 points per metre of average sideways error over 4 m (up to 5); bolting over 1 s costs 0.7 a second (up to 4); a split flock (average spread over 16 m): 2.'] },
  { title: 'Stage 4: Drive (20)', p: [
    'Drive the flock away through the First drive gate and then across through the Second. Each gate is worth 10 points.',
    'Faults at each gate: 10 times the share of sheep that missed it; a crooked drive costs 0.5 points per metre of average sideways error over 4 m (up to 2.5); bolting over 1.2 s costs 0.5 a second (up to 2). A gate counts as finished when every sheep has crossed its line.'] },
  { title: 'Stage 5: Pen (15)', p: [
    'Put every sheep in the pen and shut the gate. The flock heads for a point above the pen mouth first if it is not lined up, then straight in. In the pen phase the dog works the sheep still outside.',
    'Fault: 3 points for every sheep not in the pen when the run ends. If the clock runs out, the pen stage scores 60% of its points, shared by the sheep already inside.'] },
  { title: 'Time (10) and Control (10)', p: [
    'Time: 10 points times (limit minus your time) over 70% of the limit, so a run finished in 30% of the limit or faster scores all 10. Limits: 420 s on Valley Paddock and Lowland Farm, 450 s on Hill Pasture and Upland Moor, 480 s on Highland Crag. If time runs out only the stages completed score and Time and Control score nothing.',
    'Control starts at 10. A break-away costs 2.5; over 70 commands costs 0.06 each (up to 3); each time the dog runs out of breath costs 1.5 (up to 3); a flock often strung out (spread over 22 m) costs 1.'] },
  { title: 'The courses', p: [
    'Valley Paddock: 4 sheep, flat, flight zone 16 m, gates 6.5-7 m, pen mouth 3.4 m. Lowland Farm: 5 sheep, rolling, zone 17 m, gates 5.6-6 m, mouth 3.2 m.',
    'Hill Pasture: 6 sheep, sloping ground, zone 19 m, a bold ewe, gates about 5.2 m, mouth 3.1 m. Upland Moor: 7 sheep, gorse and wind, zone 20 m, a bold ewe, gates 4.6 m, mouth 3.0 m. Highland Crag: 8 sheep, steep ground and crags, zone 21 m, two bold ewes, gates 4 m, mouth 2.8 m.',
    'A course unlocks when you score 50 or more on the one before it.'] },
  { title: 'Weather and time of day', p: [
    'Clear: no change. Breezy: wind pushes the flock along and the dog tires 12% faster. Mist: the flight zone is 12% smaller and the sheep are calmer; the view is short. Rain: the flight zone is 10% bigger and the sheep livelier; the dog tires 6% faster.',
    'Dawn: the dog recovers 20% faster when lying down. Day: no change. Dusk: the flock stays 20% more tightly together.'] },
  { title: 'Training', p: [
    'Six lessons on a small meadow with three sheep, in order: Come bye (circle clockwise for most of a full turn without disturbing the sheep), Away to me (the same anticlockwise), Walk on (move the flock into the ring), Lie down (lie down in the gold sector behind the sheep), Stand (bring the flock into the ring and stop it there) and Your first gate (bring all three through the gate).',
    'Each lesson shows what the command does and what to do. Completed lessons are remembered. No time limit and no score.'] },
  { title: 'Watch & Learn and Think', art: 'think', p: [
    'The computer handler plays a run on the course you choose. For every new command it THINKS (2 to 10 seconds, set in Settings, 5 by default) and explains the situation, REVEALS its choice for 2 seconds by lighting the button and marking the field, then ACTS. Pause freezes the whole run exactly where it is.',
    'Think during your own run shows the same advice for the moment, and costs nothing. Menus, Rules, Training, Watch & Learn, pause and the result are free; only live play of a trial counts against the free preview.'] },
  { title: 'Ending a run', p: [
    'A run ends when the gate is shut on all the sheep (a finished run), or when time runs out (a retired run). You can also quit from the pause menu. Your best score on each course is kept.'] },
];
