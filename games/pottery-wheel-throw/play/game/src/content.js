// Pottery Wheel: the content that is data: stations, challenge targets, glaze traditions, captions and the long texts.
// Public text (no business reasoning, no religion words).

export const THINK_OPTS = [3, 5, 8, 10], WHEEL_OPTS = [0.7, 1, 1.4];

export const STATIONS = [
  { id: 'centre', name: 'Centre', short: 'Centre the clay', tip: 'Press steadily on the side the clay swings towards.' },
  { id: 'open', name: 'Open', short: 'Open the lump', tip: 'Press down in the middle, then draw outwards.' },
  { id: 'pull', name: 'Pull', short: 'Pull the walls up', tip: 'Press into the wall and slide up it, slowly.' },
  { id: 'shape', name: 'Shape', short: 'Shape the form', tip: 'Drag the wall out for a belly, in for a neck.' },
  { id: 'trim', name: 'Trim', short: 'Trim and smooth', tip: 'Smooth along the outside; press near the base for a foot.' },
  { id: 'glaze', name: 'Glaze', short: 'Glaze and decorate', tip: 'Pick a tradition, then hold the brush on the turning pot.' },
  { id: 'fire', name: 'Fire', short: 'Fire the kiln', tip: 'Watch the glaze come alive.' },
];

// Target silhouettes: pts = [height, outer radius] polyline from the base up; H = target height. Wall about 0.17 thick, so every one fits the lump.
export const CHALLENGES = [
  { id: 'cup', name: 'Straight Cup', tier: 1, H: 2.0, pts: [[0, 0.75], [2.0, 0.75]], trad: 3, blurb: 'Straight sides, even walls. The first lesson of the wheel.' },
  { id: 'bowl', name: 'Round Bowl', tier: 1, H: 1.4, pts: [[0, 0.55], [0.3, 0.85], [0.7, 1.15], [1.1, 1.3], [1.4, 1.35]], trad: 1, blurb: 'A wide curve that opens like a hand.' },
  { id: 'tumbler', name: 'Flared Tumbler', tier: 1, H: 2.4, pts: [[0, 0.6], [2.4, 0.95]], trad: 2, blurb: 'Straight sides that widen towards the rim.' },
  { id: 'chawan', name: 'Tea Bowl', tier: 2, H: 1.3, pts: [[0, 0.5], [0.2, 0.7], [0.6, 0.95], [1.3, 1.05]], trad: 4, blurb: 'A small, weighty bowl with a quiet foot.' },
  { id: 'vase', name: 'Belly Vase', tier: 2, H: 3.0, pts: [[0, 0.6], [0.5, 0.95], [1.1, 1.2], [1.7, 1.0], [2.3, 0.62], [2.7, 0.55], [3.0, 0.7]], trad: 0, blurb: 'A full belly, a gentle neck and a lipped rim.' },
  { id: 'jug', name: 'Water Jug', tier: 2, H: 2.6, pts: [[0, 0.7], [0.6, 1.1], [1.3, 1.15], [1.9, 0.8], [2.3, 0.6], [2.6, 0.7]], trad: 1, blurb: 'A broad body that narrows to a pouring mouth.' },
  { id: 'squat', name: 'Squat Pot', tier: 2, H: 1.3, pts: [[0, 0.9], [0.5, 1.35], [1.0, 1.25], [1.3, 0.9]], trad: 3, blurb: 'Low and wide, a pot that sits firmly.' },
  { id: 'moon', name: 'Moon Jar', tier: 3, H: 2.4, pts: [[0, 0.55], [0.4, 1.0], [0.9, 1.3], [1.2, 1.35], [1.6, 1.25], [2.0, 0.9], [2.4, 0.6]], trad: 2, blurb: 'Two bowls joined into one round, calm shape.' },
  { id: 'hourglass', name: 'Waisted Vase', tier: 3, H: 3.0, pts: [[0, 0.8], [0.8, 0.5], [1.4, 0.45], [2.0, 0.7], [2.6, 0.95], [3.0, 0.95]], trad: 5, blurb: 'In at the waist, out at the shoulder.' },
  { id: 'bottle', name: 'Long-neck Bottle', tier: 3, H: 3.4, pts: [[0, 0.75], [0.8, 0.95], [1.5, 0.9], [2.2, 0.45], [3.0, 0.3], [3.4, 0.42]], trad: 0, blurb: 'A round body and a slim neck. Narrow openings are the hard part.' },
  { id: 'urn', name: 'Tall Urn', tier: 3, H: 3.2, pts: [[0, 0.55], [0.4, 0.5], [0.8, 0.75], [1.6, 1.2], [2.4, 0.95], [2.9, 0.6], [3.2, 0.9]], trad: 4, blurb: 'A high shoulder and a flared mouth.' },
  { id: 'amphora', name: 'Storage Jar', tier: 3, H: 3.6, pts: [[0, 0.5], [0.6, 0.8], [1.4, 1.1], [2.2, 1.0], [2.9, 0.7], [3.4, 0.5], [3.6, 0.6]], trad: 1, blurb: 'The tallest form, thin walls all the way up.' },
];
// Free-throw guide shape for Watch and Learn and for the menu backdrop.
export const SAMPLE = { id: 'sample', name: 'Soft Vase', H: 2.8, pts: [[0, 0.6], [0.5, 0.9], [1.1, 1.05], [1.7, 0.9], [2.2, 0.62], [2.6, 0.55], [2.8, 0.66]] };

// Glaze traditions, described by their craft. base / accent: three colours each. motifs: four decoration ids (drawn by the presenter and the 2D painter).
export const TRADITIONS = [
  { id: 'celadon', name: 'Celadon', craft: 'Iron-bearing glaze fired with little air turns a cool jade green; carved lines pool darker.',
    body: '#b8b49c', base: ['#9fc8aa', '#86b79a', '#b9d4b6'], accent: ['#5f9680', '#7cae98', '#497a69'], motifs: ['lines', 'petals', 'waves', 'solid'], gloss: 0.12 },
  { id: 'terracotta', name: 'Terracotta and slip', craft: 'Iron-rich red earthenware, painted and trailed with white slip before a low firing.',
    body: '#b4552d', base: ['#b4552d', '#c4693a', '#9a4524'], accent: ['#f1e6d2', '#e6c796', '#d8d0bf'], motifs: ['dots', 'waves', 'scallops', 'solid'], gloss: 0.55 },
  { id: 'blue-white', name: 'Blue and white', craft: 'Cobalt painted on white clay under a clear glaze: scrolls, waves and sprigs in one colour.',
    body: '#ece9df', base: ['#f1efe6', '#e8ede9', '#f4ece0'], accent: ['#1f4aa8', '#2d63c4', '#1a3a7d'], motifs: ['scroll', 'waves', 'leaves', 'lines'], gloss: 0.1 },
  { id: 'black-red', name: 'Black on red', craft: 'Burnished red clay with a black painted band: stepped, zigzag and meander patterns.',
    body: '#a8412a', base: ['#b0442c', '#c25a36', '#963a25'], accent: ['#1c1613', '#3a2a22', '#241a16'], motifs: ['zigzag', 'meander', 'triangles', 'solid'], gloss: 0.3 },
  { id: 'ash-iron', name: 'Ash and iron', craft: 'Wood ash melts into a running glaze; iron makes it brown, olive and rust, with spots and drips.',
    body: '#8a7a5a', base: ['#7b6a3a', '#5a4630', '#8a8a5a'], accent: ['#c28a3a', '#2b1d12', '#a9a36a'], motifs: ['drips', 'speckle', 'lines', 'solid'], gloss: 0.2 },
  { id: 'slipware', name: 'White slip and comb', craft: 'Buff clay coated in liquid slip, then combed or dotted while wet, under a honey glaze.',
    body: '#d6b27a', base: ['#e3c79a', '#d6b27a', '#e9d9b4'], accent: ['#7a4a26', '#f5ecd5', '#a96a34'], motifs: ['comb', 'dots', 'lines', 'scallops'], gloss: 0.25 },
];
export const MOTIF_NAMES = { solid: 'Plain', lines: 'Lines', petals: 'Petals', waves: 'Waves', dots: 'Dots', scallops: 'Scallops', scroll: 'Scroll', leaves: 'Leaves', zigzag: 'Zigzag', meander: 'Meander', triangles: 'Triangles', drips: 'Drips', speckle: 'Speckle', comb: 'Comb' };

// Captions for Watch and Learn / hints, one per station (the planner adds the numbers).
export const CAPTIONS = {
  centre: ['Centre the clay', 'The lump is off-centre and wobbles as it turns. Rest a finger firmly on the side it swings towards and hold the pressure steady until it runs true.'],
  open: ['Open the lump', 'Press one finger straight down into the middle, leaving a floor, then draw it outwards to make room for the walls.'],
  pull: ['Pull the walls up', 'Press the fingertip into the wall and slide it slowly up. The wall gets thinner and the pot gets taller. Slow passes, gentle pressure.'],
  shape: ['Shape the form', 'Drag the wall outwards for a belly or inwards for a neck. The clay follows your finger; a wall stretched wide becomes thinner.'],
  trim: ['Trim and smooth', 'Let the clay stiffen, then run a tool down the outside to smooth bumps. A little pressure near the base cuts a foot.'],
  glaze: ['Glaze and decorate', 'Choose a tradition, then hold the brush against the turning pot. The longer you hold, the wider the band grows.'],
  fire: ['Fire the kiln', 'In the kiln the glaze melts and the clay hardens. Watch the colour come alive.'],
};

export const HOWTO = [
  { h: 'Throw a pot in seven stations' },
  { li: 'Centre: press a finger against the side the clay swings towards and hold it steady until the wobble stops.' },
  { li: 'Open: press down in the middle and draw outwards.' },
  { li: 'Pull: press into the wall and slide up it, slowly. The wall thins and the pot rises.' },
  { li: 'Shape: drag the wall outwards for a belly, inwards for a neck.' },
  { li: 'Trim: smooth the outside and press near the base for a foot.' },
  { li: 'Glaze: choose a tradition and hold the brush on the turning pot to paint a band.' },
  { li: 'Fire: watch the kiln. Your pot goes on the shelf.' },
  { h: 'Tips' },
  { li: 'Slow hands win. Fast or heavy touches make the clay wobble.' },
  { li: 'Use Hint to see where to touch next, Undo to take back your last move, and Watch and Learn to see a whole pot made.' },
  { li: 'Challenges show a ghost outline. Match its height and curve; even walls and a smooth surface count as well.' },
  { li: 'On a keyboard the mouse is your finger. Space pauses, H shows a hint, Z undoes, N moves on to the next station.' },
];

export const ABOUT = [
  { h: 'Pottery Wheel' },
  { p: 'Throw a pot on a spinning wheel. Centre a lump of clay, open it, pull the walls up and shape the form with your fingertip in real 3D, trim a foot, then glaze it in the colours and patterns of potters from around the world and watch it come out of the kiln.' },
  { h: 'Six glaze traditions' },
  { p: 'Celadon, terracotta with white slip, blue and white, black on red, ash and iron, and combed slipware. Each is described by how it is made, and each has its own colours and patterns.' },
  { h: 'Challenges' },
  { p: 'Twelve target silhouettes from a straight cup to a tall storage jar, a daily challenge, and a free studio. Your finished pots go on a shelf.' },
  { h: 'Free preview' },
  { p: 'The first 90 seconds of throwing are free. Menus, Rules, Watch and Learn, results and your shelf are always free. A one-time unlock then lets you throw as much as you like. There are no ads.' },
  { h: 'Calm by design' },
  { p: 'The wheel rewards slow, steady hands and a relaxed rhythm. There is no timer while you throw and no ads.' },
  { h: 'Credits' },
  { p: 'Sounds are synthesised on your device. Fredoka by Milena Brandao, SIL Open Font License 1.1. 3D rendering uses three.js (MIT).' },
];

// The exhaustive Rules, one array of pages. Numbers here are the engine's own constants (web/src/sim.js, game.js).
export const RULES = [
  { title: 'The Wheel', blocks: [
    { p: 'You throw one pot at a time on a wheel that turns until you fire the kiln. The clay is a stack of 48 layers around the wheel axis. Each layer has an outer radius, an inner radius and a height, and every layer keeps its own amount of clay.' },
    { fig: 'layers', hh: 300 },
    { h: 'One rule of clay' },
    { p: 'While you throw, clay is never lost. A thinner wall means a taller pot; a wall pushed out round a bigger circle gets thinner; a wall pushed in gets thicker. Only trimming cuts clay away.' },
    { h: 'Your finger' },
    { p: 'You touch with one finger. Where the fingertip is, sideways and in height, is what the clay feels. Pressure is how far the fingertip is inside the clay surface: dragging toward the axis presses harder.' },
    { h: 'Wobble' },
    { p: 'Fast, heavy or downward touches shake the clay. The shake fades as you hold still. A pot that was centred poorly shakes more easily.' },
  ] },
  { title: '1 Centre', blocks: [
    { p: 'A fresh lump is off-centre and swings round as the wheel turns. Rest your fingertip against the swinging side, inside the surface by a moderate amount, and hold it.' },
    { fig: 'centre', hh: 260 },
    { li: 'Pressure in the green zone (the fingertip 0.08 to 0.40 units inside the surface) shrinks the swing by about 95 percent each second.' },
    { li: 'Below that the effect fades to nothing; above it, the effect fades and by 0.45 units you start to squash the clay and make it swing more.' },
    { li: 'Moving the fingertip faster than 1.1 units a second also shakes it.' },
    { li: 'Centring is done when the swing stays under 0.02 for one second. You can also move on with Next.' },
  ] },
  { title: '2 Open', blocks: [
    { p: 'Press the fingertip into the top of the lump and draw it down. It never goes below a floor of 0.12 units. Then draw it outwards: everything above the fingertip is hollowed out to its reach.' },
    { fig: 'open', hh: 260 },
    { li: 'The cavity never reaches closer than 0.17 units to the outside, so the wall starts out thick.' },
    { li: 'Opening makes the clay above the floor taller, so the rim rises.' },
    { li: 'The fingertip follows your finger at no more than 1.6 units a second down and 1.2 sideways. Moving faster than 1.3 units a second shakes the clay.' },
    { li: 'You can move on once the pot is open.' },
  ] },
  { title: '3 Pull', blocks: [
    { p: 'Press the fingertip into the wall (up to 0.36 units inside the surface) and slide it up. The wall under the fingertip is squeezed thinner, its midline staying put, and the pot rises because the clay has nowhere else to go.' },
    { fig: 'pull', hh: 280 },
    { li: 'Squeeze speed grows with how hard you press and how fast you move up, up to 1.4 times a normal pass. Sliding down squeezes nothing.' },
    { li: 'The wall will not go thinner than 0.07 units. A pass over a thin wall shows a Wall is thin note.' },
    { li: 'Pressing harder than 0.24 units inside, moving faster than 1.5 units a second, or pressing while moving down makes that part of the wall wobble.' },
    { li: 'The floor is never pulled.' },
  ] },
  { title: '4 Shape', blocks: [
    { p: 'Start the touch close to the wall and drag the fingertip: the wall near the fingertip follows it, more strongly the closer it is. Drag outward for a belly and inward for a neck or a waist.' },
    { fig: 'shape', hh: 280 },
    { li: 'The wall moves as one piece. Stretched round a wider circle it gets thinner, round a narrower one thicker. The pot becomes shorter or taller to match.' },
    { li: 'The opening never closes completely: the narrowest inside radius is 0.04 units.' },
    { li: 'The wall will not go thinner than 0.07 units, and the clay will not go wider than 1.55 units from the axis.' },
    { li: 'A quick upward slide while pressing in still pulls the wall up, as in the Pull step.' },
    { li: 'In a Challenge a ghost outline shows the target. The nearer your outer profile is to it along the whole height, the higher your shape score.' },
  ] },
  { title: '5 Trim', blocks: [
    { p: 'The pot is now leather-hard. A tool drawn along the outside evens out the bumps, and a little pressure near the base cuts a foot ring. This is the only step that removes clay, so the pot cannot get taller here.' },
    { li: 'Smoothing blends each layer towards the average of the layers beside it.' },
    { li: 'Within 0.34 units of the wheel, pressing inwards cuts the wall back and forms a foot.' },
    { li: 'The wall will not be cut below 0.07 units thick, and the base stays at least 0.3 units wide.' },
    { li: 'Clay that is thicker than its neighbours (more than 8 percent above the average wall) is shaved back towards the average as you trim it.' },
    { li: 'Trimming also calms any wobble in the wall it touches.' },
  ] },
  { title: '6 Glaze', blocks: [
    { p: 'Choose one of six traditions. Each has three base colours, three accent colours and four patterns. Hold the brush against the turning pot: a band grows round the pot, wider the longer you hold, up to 0.68 units tall. Lift to set it.' },
    { fig: 'bands', hh: 250 },
    { li: 'Up to four bands. Undo removes the last band.' },
    { li: 'Celadon: jade green, lines, petals and waves. Terracotta and slip: red clay with white dots, waves and scallops. Blue and white: cobalt scrolls, waves and leaves. Black on red: zigzags, meanders and triangles. Ash and iron: running drips and speckle. Slipware: combed and dotted slip under honey glaze.' },
    { li: 'Glaze never changes the score. It is yours to enjoy.' },
  ] },
  { title: '7 Fire and Score', blocks: [
    { p: 'In the kiln the clay darkens and the glaze melts. Tap to skip the firing. Then your pot is scored and goes on the shelf if you choose.' },
    { h: 'The score' },
    { li: 'Centred: how little swing remained when you finished centring, and how calm the walls are.' },
    { li: 'Even walls: how equal the wall thickness is from floor to rim.' },
    { li: 'Smooth: how few bumps and wobbles remain in the outer profile.' },
    { li: 'Shape (Challenges): how close the outer profile is to the target over its height, with a small penalty for a pot taller or shorter than the outline.' },
    { li: 'Total: in the Studio, 40 percent even walls, 40 percent smooth, 20 percent centred. In a Challenge, 50 percent shape, 20 percent even, 20 percent smooth, 10 percent centred.' },
    { li: 'Stars: 45 for one, 64 for two, 80 for three. A pot that was never opened scores 40 percent of that.' },
  ] },
  { title: 'Modes and the Shelf', blocks: [
    { li: 'Studio: a free throw with no target.' },
    { li: 'Challenges: twelve target outlines in three tiers. The best stars are kept.' },
    { li: 'Daily Challenge: one outline and one tradition for each day, the same for everyone.' },
    { li: 'Shelf: up to 24 of your finished pots. Tap one to see it turn in 3D, or remove it.' },
    { li: 'Undo takes back your last stroke (up to 12). Hint shows where to touch next.' },
    { li: 'Pause stops the wheel, the clay and the demonstration exactly where they are.' },
  ] },
  { title: 'Watch and Learn', blocks: [
    { p: 'A demonstration throws a whole pot for you, one stroke at a time, using the same clay as your own pots.' },
    { li: 'For each stroke: THINK (a caption tells you what is about to happen, 5 seconds by default, 3 to 10 in Settings), REVEAL (a ring marks where the finger will go, 2 seconds), then the finger ACTS.' },
    { li: 'Pause freezes everything, including the wheel, and resumes exactly where it stopped.' },
    { li: 'Skip moves to the next stroke. Close returns to the menu. Watching is free.' },
  ] },
  { title: 'Controls and Settings', blocks: [
    { li: 'Touch or mouse: drag. Space: pause. H: hint. Z: undo. N: next station. Escape: back.' },
    { li: 'Settings: sound, haptics (a small buzz on devices that allow it), calm mode (fewer particles), wheel speed, Think time for Watch and Learn, and text size from 100 to 300 percent. Text size also applies to this Rules page, About, How to Play and the Settings page itself.' },
    { li: 'The game keeps working in portrait and landscape and when you rotate the device.' },
  ] },
];
