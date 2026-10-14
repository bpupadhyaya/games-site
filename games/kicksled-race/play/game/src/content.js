// Text for About, How to Play and the Rules reference. Every rule below was checked against the engine:
// sim.js (leg phase, kick quality, stamina, drag, slopes, surfaces, bends, bumps, medals), game.js (modes, cup points, flow).
// A section is { title, art?, p: [paragraphs] }; the reader flows every section into one scrolling page.

export const ABOUT = [
  { title: 'Kicksled Race', art: 'sled', p: [
    'The kicksled is everyday winter transport in Finland, Sweden and Norway. A chair sits on two long steel runners, and you stand on the back of the runners, hold the handle and push yourself along with one foot. In Finnish it is a potkukelkka; in Swedish and Norwegian, a spark.',
    'People ride kicksleds to the shop, across frozen lakes and along snowy town streets, and every winter there are races: kick, glide, lean into the bends and keep your breath. This game is about that rhythm.',
  ] },
  { title: 'A game of rhythm and flow', p: [
    'Kicking again and again is tiring, so a good racer kicks, rests on the glide and kicks again. The surface, the slope and the wind change the best rhythm every few seconds.',
  ] },
  { title: 'This version', p: [
    'You race the side-on kicksled on four courses and a daily course, against three rivals, against the ghost of your own best run, or through a four-race cup. Watch & Learn lets a pilot drive and explain each stretch.',
    'It is a respectful, simplified picture of the sport. The courses and rivals are our own and no real clubs, racers or brands appear.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'sled', p: [
    'Be first to the finish line. You steer nothing: your job is to push at the right moment, rest at the right moment and stand or crouch for what the track throws at you.',
  ] },
  { title: 'Kick on the ring', art: 'ring', p: [
    'After every kick your kicking leg swings back, and a ring fills around it. Tap KICK when the ring is full and bright: a Perfect kick gives the strongest push. A tap too early gives a weak push and costs more stamina. Perfect kicks in a row build a streak, up to 20% more push.',
    'On a keyboard, press Space, Z or the Right Arrow.',
  ] },
  { title: 'Glide to rest and to speed up', art: 'stamina', p: [
    'Tap GLIDE to crouch low behind the chair. Drag drops, your legs recover twice as fast and you can take bends faster. You cannot kick while crouched: tap GLIDE again, or just tap KICK, to stand up and push in one move.',
    'The stamina bar shows your legs. When it is nearly empty the push is weak: glide for a few seconds.',
  ] },
  { title: 'Read the course', art: 'terrain', p: [
    'The strip at the top shows the whole course: hills, the surface under the runners, bends and bumps, and where every racer is. Kick on climbs and soft snow, glide down slopes and across ice.',
  ] },
  { title: 'Bends and bumps', art: 'bend', p: [
    'A yellow sign gives a bend its safe speed in km/h. Above it you scrub off speed, unless you glide, which allows 22% more. Bumps are the opposite: stand up before a bump, or you are thrown about and lose speed and stamina.',
  ] },
  { title: 'Hints and helpers', p: [
    'Press the lightbulb button for a hint: it reads the next stretch and tells you what to do. In Watch & Learn a pilot thinks, shows its plan, then drives; use Pause at any time.',
  ] },
];

export const RULES = [
  { title: 'The race', art: 'terrain', p: [
    'Every race starts after a three-second count. The first racer to cross the finish line wins. Courses are 480 m (Town Square Dash), 700 m (Frozen Lake), 660 m (Forest Trail), 720 m (Harbour Climb) and about 600 m (Daily). The finish is timed to the hundredth of a second. After the line you coast to a stop.',
  ] },
  { title: 'Kicking', art: 'ring', p: [
    'After a kick the leg swings back over about 0.55 s (up to 0.8 s when you are tired). While it swings, the ring fills from 0 to 1.',
    'A tap at a ring level below 0.35 is a stumble: push at 15% and extra stamina cost. From 0.35 to 0.82 the push grows from 30% to 100%. From 0.82 to 0.9 it is a Good kick at 100%. From 0.9 to 1.0, or up to 0.15 s after the ring is full, it is Perfect at 110%. Later than that the push falls by 80% per second of waiting, to a floor of 60%.',
    'Perfect kicks in a row (a Good kick keeps the streak, anything else breaks it) add up to 20% push after 8 in a row; the bonus only applies to Perfect kicks.',
  ] },
  { title: 'Speed and slopes', art: 'terrain', p: [
    'A kick adds 0.8 m/s at rest, shrinking as you go faster (divided by 1 plus speed over 14), and is scaled by the surface and by how tired you are. Air drag grows with the square of your speed, and the wind on the lake counts against it. A downhill adds up to 0.6 m/s every second for each 8% of slope, an uphill takes the same away.',
  ] },
  { title: 'Surfaces', art: 'surfaces', p: [
    'Packed snow: rolling resistance 0.22 m/s per second, full push. Fresh snow: 0.62, push 88%. Black ice: 0.07, but only 62% push. Slush: 0.8, push 82%. The surface under you is shown in the course strip.',
  ] },
  { title: 'Stamina and gliding', art: 'stamina', p: [
    'Stamina runs from 0 to 1. A kick costs 0.055 plus up to 0.07 for a poor one. It refills 0.07 per second while you stand and 0.15 per second while you glide. Below 0.2 the push weakens down to 45%.',
    'Gliding multiplies drag by 0.55. You cannot kick while crouched: a KICK tap stands you up and kicks in the same moment, and a second tap on GLIDE stands you up without a kick.',
  ] },
  { title: 'Bends', art: 'bend', p: [
    'Each bend has a safe speed on its sign. Over it you lose 2.2 m/s per second for each m/s of excess, plus 0.5. Gliding raises the safe speed by 22%. The first and last 6 m of a bend are free.',
  ] },
  { title: 'Bumps', art: 'bump', p: [
    'Cross a bump standing and you hop over it with no loss. Cross it crouched and you lose 1.1 m/s, 12% stamina and your streak.',
  ] },
  { title: 'Modes, rivals and medals', p: [
    'Race: you and three rivals; the Relaxed, Steady and Fierce groups differ in timing, resting and how often they misjudge a bump or bend. Time Trial: alone with the ghost of your best run on that course. Cup: all four courses in order; places score 10, 6, 3 and 1 points, and most points wins; ties go to the best time.',
    'Medals are set from the time of a flawless pilot on the course: Gold within 7%, Silver within 20% and Bronze within 40%.',
  ] },
  { title: 'Simplifications', p: [
    'Real kicksledding includes steering and braking; here the track steers itself, and what matters is rhythm, resting and reading the course. Distances, slopes and speeds are tuned for play, not measured from real tracks.',
  ] },
];
