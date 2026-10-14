// Text for About, How to Play and the Rules reference. Every number below was checked against the engine:
// sim.js (surfaces, parts, slide and spin-out, obstacles, launch, drafting, medals) and game.js (modes, cup points, stars).
// A section is { title, art?, p: [paragraphs] }; the reader flows every section into one scrolling page.

export const ABOUT = [
  { title: 'Billycart Derby', art: 'cart', p: [
    'A billycart is a home-built, gravity-powered cart: a plank frame, four wheels, a rope or bolt to steer by and a brave driver. Down the hills of country towns across Australia, families and clubs hold billycart derbies, with hand-built carts, hay bales along the bends, bunting across the street and crowds on both verges.',
    'The best-known derbies draw hundreds of entrants and thousands of spectators, and the contest is half workshop and half hill: the cart you build matters as much as the line you drive.',
  ] },
  { title: 'What this game is', p: [
    'Build a cart from wheels, frame, steering, brake and ballast; read the hill; steer a clean line with your thumb; brake before the bends; and beat three rivals to the line. Five hills and a new Daily hill, a time trial against the ghost of your best run, a four-hill cup and a Watch & Learn mode where a pilot explains each stretch.',
  ] },
  { title: 'Respect and simplifications', p: [
    'This is a friendly, simplified picture of a community tradition. The hills, carts, rivals and names are our own; no real clubs, riders, events or brands appear. Speeds, slopes and grip are tuned for play, not measured from real hills.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'cart', p: [
    'There is no engine and no pushing: gravity does the work. Your job is to build a cart that suits the hill, then keep it on the road and keep its speed.',
  ] },
  { title: 'Build in the garage', art: 'wheels', p: [
    'Choose wheels, frame, steering, brake and a ballast position. The gauges show speed, rough-road ability, grip and steering bite, and the estimate is how long a flawless pilot would take with your cart on the hill you picked. Small, hard wheels are fast on tarmac and miserable on cobbles; big air tyres are the opposite.',
  ] },
  { title: 'Start', p: [
    'Three lights count down. Tap anywhere just after GO for a launch: the closer to GO, the bigger the push. Tapping before GO is a false start and holds you for a moment.',
  ] },
  { title: 'Steer', art: 'steer', p: [
    'Touch anywhere on the screen outside the buttons and slide your thumb left or right: the further you slide, the more you steer, and the cart straightens when you let go. On a keyboard, use the arrow keys or A and D.',
    'You steer into a bend, not around it: the road bends but the cart keeps going straight unless you turn. Steering assist (in Settings) helps the cart follow the road.',
  ] },
  { title: 'Brake', art: 'bend', p: [
    'Tap BRAKE to turn the brake on and tap again to release it, or hold the button down to brake only while your finger is on it. On a keyboard hold Space. Every bend has a safe speed: slower than that and you grip, faster and the cart slides wide and can spin out.',
  ] },
  { title: 'Read the road', art: 'line', p: [
    'The strip at the top shows the whole hill: its slope, surfaces, bends and every racer. Take the inside line through a bend: it is shorter. Steer around ruts and puddles, thread the hay-bale chicanes, and tuck in behind a rival to be pulled along in their slipstream.',
  ] },
  { title: 'Hints and helpers', p: [
    'Press the ? button for a hint: it reads the next stretch and puts a marker on the road where to aim. In Watch & Learn a pilot thinks, shows its plan and drives; use Pause at any time.',
  ] },
];

export const RULES = [
  { title: 'The derby', art: 'cart', p: [
    'Every race starts after a three-second count with lights, then GO. The first cart across the finish line wins; times are taken to the hundredth of a second. The hills are 500 m (Cobble Lane), 621 m (Main Street Hill), 658 m (Creek Run), 665 m (Gravel Ridge), 870 m (Grand Derby) and about 700 m (the Daily hill). After the line the cart rolls on through a run-out lined with hay bales and brakes by itself.',
  ] },
  { title: 'The start', p: [
    'A tap in the first 0.45 s after GO is a launch: it adds between 0.4 and 2.4 m/s of speed, more the closer to GO. A tap before GO is a false start and holds you for 0.7 s. Rivals launch with between 0.3 and 1.9 m/s depending on their group.',
  ] },
  { title: 'Speed', art: 'surfaces', p: [
    'The slope pulls the cart downhill at 9.81 m/s per second times the slope. Rolling resistance takes away 9.81 times the rolling coefficient of the wheel on that surface; air drag takes away a share that grows with the square of your speed and is smaller for heavier frames. If a cart slows below 1.5 m/s on a gentle patch the rider rocks it forward so nobody gets stuck.',
    'Slipstream: within 14 m behind a rival, and within 1.2 m of their line, your air drag is multiplied by 0.72.',
  ] },
  { title: 'Surfaces', art: 'surfaces', p: [
    'Tarmac: grip 4.2, rolling 0.018. Cobbles: grip 3.6, rolling 0.034 and bumpy. Gravel: grip 2.6, rolling 0.034. Grass at the road edge (more than 3 m from the centre): grip 1.7, rolling 0.065. A puddle multiplies grip by 0.62 and adds rolling resistance. Your wheels multiply grip: pram 0.92, spokes 1.0, air tyres 1.15, racers 0.8. Grip is in metres per second per second.',
  ] },
  { title: 'Wheels, frames, steering and brakes', art: 'wheels', p: [
    'Wheels. Pram wheels: rolling x0.7 on tarmac, x1.5 on cobbles and gravel, ruts rating 15%. Wooden spokes: x1.0, x1.2 and x1.25, rating 40%. Air tyres (3 stars): x1.5 on tarmac, x0.8 on cobbles, x0.72 on gravel, rating 80%. Bearing racers (6 stars): x0.5 on tarmac, x1.8 on cobbles and gravel, rating 10%.',
    'Frames. Plank: 30 kg, steers 10% sharper, stability 0.8. Box: 42 kg, stability 1.0. Beam (4 stars): 60 kg, drag factor 0.9, steers 18% slower, stability 1.2. Heavier carts keep their speed better.',
    'Steering. Rope: gentle, 0.17. Bolt pivot: 0.22. Tie-rod rack (2 stars): 0.31 but twitchy at speed. Steering is strongest around 10 m/s and fades at high speed.',
    'Brakes. Heel drag brakes at 2.4 m/s per second on any surface. Lever pad brakes at 4.4 on tarmac and cobbles and at 2.4 on gravel, grass and puddles.',
    'Balance. Front-heavy ballast gives sharper steering and a livelier cart; rear-heavy ballast is calmer and more stable but slower to turn in.',
  ] },
  { title: 'Bends and sliding', art: 'bend', p: [
    'The safe speed in a bend is the square root of the grip times the bend radius. Faster than that, the cart slides: the excess pushes you towards the outside, slows you down and weakens your steering. More than 0.9 m/s per second over the limit is a spin-out: you lose a third of your speed and the cart swings towards the outside. A spin-out cannot repeat within 1.6 s.',
    'Bends are drawn with red and white kerbs, and a yellow sign shows the direction 30 m before each bend.',
  ] },
  { title: 'The line', art: 'line', p: [
    'The inside of a bend is shorter, and the game makes it count: the closer to the inside you are, the less road you cover for the same speed. Swing a little wide before the bend, cut in to the inside in the middle of it and let the cart run out wide at the end. Moving sideways costs a little speed, so do not weave for nothing.',
  ] },
  { title: 'Edges, ruts, puddles and bales', p: [
    'The road is 6 m wide. Beyond 3 m from the centre is grass: low grip and heavy rolling. At 4.4 m the cart hits the hay bales: you lose 45% of your speed and bounce back inwards.',
    'A rut takes 15% of your speed (less with a high wheel rating) and knocks the cart sideways. A bale chicane is two blocks of three bales on opposite sides: hitting one takes 42% of your speed. A puddle only lowers grip and adds rolling resistance.',
  ] },
  { title: 'Modes, rivals, stars and medals', p: [
    'Derby: you and three rivals. Local Lads, Club Racers and Derby Champions differ in how good their carts and lines are and how late they brake. Time Trial: alone with the ghost of your best run on that hill. Cup: Main Street Hill, Gravel Ridge, Cobble Lane and Creek Run in order; places score 10, 6, 3 and 1 points, the most points wins and ties go to the lower total time.',
    'Medals are set from the best time of a flawless pilot on the hill: Gold within 7%, Silver within 20% and Bronze within 40%. Each medal on a hill is worth its star count (1, 2 or 3 stars per hill); stars unlock parts. Watch & Learn and the Daily hill count for no stars.',
  ] },
  { title: 'Steering assist', p: [
    'Assist adds a share of the steering the road needs, so the cart follows bends by itself: Off 0%, Low 35%, Medium 60%, High 85%. It never brakes for you and it never chooses a line.',
  ] },
  { title: 'Simplifications', p: [
    'Carts do not collide with each other, there are no jumps, and the physics is a game model: grip, drag and slopes are tuned for play and not measured from real carts or real hills.',
  ] },
];
