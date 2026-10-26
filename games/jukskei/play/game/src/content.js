// Text for About, How to Play and the Rules reference. Every rule below was checked against the engine:
// sim.js (flight, landing, sliding, stake, zones, wind), match.js (rounds, order, bonus, extra rounds), game.js (swing meter, flow, ladder).
// Distances are in metres. A section is { title, art?, p: [paragraphs] }; the reader flows every section into one scrolling page.

export const ABOUT = [
  { title: 'Jukskei', art: 'lane', p: [
    'Jukskei is a throwing sport from South Africa. Players stand at one end of a sand lane and throw a flat wooden pin, the skei, a long way down the lane at a stake. Knock the stake over, or land the pin close to it, and you score.',
    'The name is Afrikaans for yoke pin: the wooden pin that held a yoke across a pair of working oxen. Throwing such a pin became a pastime, and today it is a sport played in clubs, with leagues and national championships.',
  ] },
  { title: 'A game of feel and weather', p: [
    'A throw looks simple and is not. The pin spins as it flies, so how it meets the sand decides whether it skids, bites in or bounces on. The wind pushes it sideways and along the lane. Good throwers read all of it, then trust their arm.',
  ] },
  { title: 'This version', p: [
    'This game plays jukskei from the side, on four sand lanes and a daily lane. You play against one of six club rivals, against a friend on the same phone, up a five-rung league ladder, or you can sit back and watch two rivals in Watch & Learn.',
    'It is a respectful, simplified picture of the sport: the lane, scoring and rivals are our own, and no real clubs, players or brands appear.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'lane', p: [
    'Each round, both sides throw four pins, taking turns, at the stake at the far end of the lane. Knock the stake over for 3 points, finish touching it for 2, or land within a metre of it for 1. After eight pins, the side with the pin nearest the stake earns one more point.',
  ] },
  { title: 'Aim with the gold ring', art: 'styles', p: [
    'Press and drag on the sand. A gold ring follows just above your finger: that is where the pin will first touch the ground. The dotted arc is the flight, and the ghost pin shows where it will end up after it skids, bites in or bounces.',
    'The small panel at the top right shows the stake close up, so you can place the ring precisely.',
  ] },
  { title: 'Choose how it flies', art: 'styles', p: [
    'Lob throws high and the pin tumbles slowly: it usually drops on its end and stays put. Skim throws low and flat: it lands on its side and skids on. Whirl spins fast, bounces and runs on past where it lands. The ghost shows the result for the style you choose.',
  ] },
  { title: 'Watch the wind', art: 'wind', p: [
    'The wind box shows how hard the wind blows and which way. A tailwind carries the pin further, a headwind holds it back, and a crosswind pushes it sideways. The game works out the throw that lands on your ring in that wind.',
  ] },
  { title: 'Throw and release', art: 'meter', p: [
    'Press Throw and the arm starts to draw back while a marker sweeps along the bar. Press Release when the marker is in the green: the closer to the middle, the steadier your arm. Miss the green and the throw will wander. If the marker reaches the end it lets go on its own, badly.',
  ] },
  { title: 'Hints and help', p: [
    'Hint suggests a good throw and moves the ring there. The guide in Settings can show the whole arc, only the landing and ghost, or just the ring. Watch & Learn plays whole rounds between two rivals and explains each choice; Pause freezes everything.',
  ] },
];

export const RULES = [
  { title: 'The match', art: 'lane', p: [
    'Two sides, one stake. A match is a fixed number of rounds (5 or 8 rounds). The side with more points after the last round wins. If it is level, extra rounds are played, up to three; if it is still level after those, the match is a draw.',
  ] },
  { title: 'A round', p: [
    'Each side has four pins in a round. The sides throw in turn until all eight are thrown. In the first round the starting side is the one chosen for the match; after that the starting side swaps every round.',
    'A new wind blows at the start of a round and drifts a little between throws. The stake is stood up again after every throw; pins stay where they lie until the round ends.',
  ] },
  { title: 'The throw', art: 'styles', p: [
    'The gold ring marks the point where the pin first touches the sand. The game solves the throw for the style you picked and the wind, and the ghost pin shows the full result.',
    'Your own hand is not perfect. The shaded oval around the ring shows how far an ordinary release might miss: it grows with distance. A very long target may be out of reach; then the throw is as hard as it can be and falls short.',
  ] },
  { title: 'Three styles', art: 'styles', p: [
    'Lob: steep and high, slow end-over-end spin. The pin tends to land on its end, bites into the sand and stops close to where it lands.',
    'Skim: low and fast, hardly spinning. The pin lands flat and skids on; on soft sand it stops sooner.',
    'Whirl: a middle height with a fast spin. The pin bounces up to twice before it settles and runs on beyond its first landing.',
    'Whether a pin lands flat or on its end depends on its spin and how long it is in the air, so a small change in distance can change what it does. The ghost shows it.',
  ] },
  { title: 'Release timing', art: 'meter', p: [
    'After you press Throw, a marker sweeps once along the bar. Release in the gold middle for your normal hand. Away from the middle the sideways and distance shake grows, up to about three and a half times at either end. If the marker reaches the end, the pin is let go on its own at the worst timing.',
    'Rivals do not use the bar; their shake is part of who they are, and the stronger rivals are steadier.',
  ] },
  { title: 'The wind', art: 'wind', p: [
    'The wind acts on a pin while it is in the air. Speed is shown in metres per second and the arrow shows the direction: right is toward the stake, down is toward you. The lane\'s own strength sets how windy it can be: the Windy ridge is the roughest.',
    'The wind does not move a pin once it is on the sand.',
  ] },
  { title: 'The lane', art: 'lane', p: [
    'The lane is 6 m wide between the white side lines. The stake stands 18 to 24 m from the throwing line, depending on the pitch. A pin that comes to rest outside the side lines, more than 6 m beyond the stake, or behind the throwing line is out: it scores nothing and cannot win the nearest-pin bonus.',
    'Lanes: Farm lane (18 m, light breeze), Club ground (24 m), Windy ridge (24 m, strong gusts), River sand (21 m, soft sand that stops pins fast) and the Daily pitch, which changes every day.',
  ] },
  { title: 'Scoring a pin', art: 'zones', p: [
    'Knock the stake over: 3 points. A pin that hits the stake gently, or comes to rest touching it (centre within 30 cm), scores 2. A pin that rests within one metre of the stake scores 1. Anything else scores nothing.',
    'A pin that knocks the stake over scores 3 wherever it ends up; the stake counts as knocked only when the pin hits it hard enough. A pin can hit the stake in the air as well as on the sand.',
  ] },
  { title: 'Pins push pins', p: [
    'Pins on the sand are solid: a pin that arrives hard knocks others away, and an opponent\'s pin that sits close to the stake can be shoved off it. Points already scored stay scored, but the nearest-pin bonus is decided at the end of the round, so a throw that clears the stake can be worth more than its own points.',
  ] },
  { title: 'The nearest pin', art: 'bonus', p: [
    'When all eight pins are down, the closest pin to the stake centre that is not out decides the bonus. If it lies within 2 m, its side earns 1 extra point. If the two sides\' nearest pins are the same distance, or none is within 2 m, there is no bonus.',
  ] },
  { title: 'Modes', p: [
    'Play vs Computer: one of six rivals, on a lane you choose. Two Players: both of you on one phone, alternating. League ladder: five rungs, a rival and a lane each, rising in strength; your highest rung is saved. Watch & Learn: two rivals play a short match and show their thinking; Pause stops everything and the Think setting changes how long they ponder.',
  ] },
  { title: 'Where this version simplifies', p: [
    'The real sport has its own team formats, stake distances and scoring tables; this game keeps the heart of it, throwing a flat pin at a stake, and uses its own simple points. The stake, the pins and the scoring circles are drawn larger than life so they can be seen on a phone. Wind is a constant push while a pin is in the air. Rivals, lanes and names are made up.',
    'Menus and Watch & Learn are always free. Go ad-free once.',
  ] },
];
