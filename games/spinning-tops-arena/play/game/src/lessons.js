// The Learn path: five short lessons played in the real dish against a scripted practice top. `rival.launch` is the
// practice top's launch (ang 'toward' = straight at you); `judge` reads the finished round.
export const LESSONS = [
  {
    id: 'launch', title: 'Pull and let go', blurb: 'Launch your first top with a good cord pull.', arena: 'shallow',
    build: { body: 'pear', tip: 'pebble', ballast: 'std', hand: 1 }, pickBuild: false,
    rival: { name: 'Practice top', build: { body: 'dome', tip: 'peg', ballast: 'std', hand: 1 }, launch: { ang: 'toward', pow: 0.02, q: 0.8 } },
    brief: ['Press near your top at the bottom of the dish and drag back. The cord stretches and the arrow shows where the top will go. Let go to set the launch.', 'Then a needle swings across the gauge. Tap when it is in the gold to whip the cord well: a perfect whip spins the top fastest.'],
    goal: 'Pull back to at least 50% power and tap the needle in the gold or near it (Good or Perfect).',
    judge: (r) => r.launch.pow >= 0.5 && r.launch.q >= 0.9,
    okText: 'A firm pull and a clean whip. That is the whole launch.', failText: 'Pull back further (the ring around your top fills up) and tap when the needle is in the gold.',
  },
  {
    id: 'ringout', title: 'Knock it out', blurb: 'Hit the practice top so it leaves the dish.', arena: 'plate',
    build: { body: 'disc', tip: 'pebble', ballast: 'std', hand: 1 }, pickBuild: false,
    rival: { name: 'Practice top', build: { body: 'pear', tip: 'steel', ballast: 'std', hand: 1 }, launch: { ang: 'toward', off: -0.5, pow: 0.35, q: 0.85 } },
    brief: ['The Flat Plate has a low edge. A top that hits the rim hard enough goes over it and is out. Your Wide Disc is heavy, so a clean hit sends the other top a long way.', 'Aim at the practice top, or a little to one side so it skids toward the rim. Press Think if you want a suggestion.'],
    goal: 'Knock the practice top out of the dish.',
    judge: (r) => r.win && r.why === 'out',
    okText: 'Out over the rim. A heavy hit near the edge is the quickest way to win.', failText: 'Hit harder, or come in at an angle so it skids toward the rim. Think can suggest a launch.',
  },
  {
    id: 'overshoot', title: 'Not too hard', blurb: 'A launch that is too hard flies out of the dish.', arena: 'shallow',
    build: { body: 'pear', tip: 'pebble', ballast: 'std', hand: 1 }, pickBuild: false,
    rival: { name: 'Eager top', build: { body: 'pear', tip: 'steel', ballast: 'std', hand: -1 }, launch: { ang: 'toward', pow: 1, q: 0.95, off: 0.5 } },
    brief: ['The rival top is launched at full power. Watch the dotted path while you aim: if it ends in a red cross, that launch would carry your own top out of the dish.', 'A middle power keeps your top in the dish and lets the spin do the work.'],
    goal: 'Win the round with a launch of 85% power or less.',
    judge: (r) => r.win && r.launch.pow <= 0.85,
    okText: 'You stayed in the dish while the hard launch did not. Control beats force.', failText: 'Keep the power under 85% and watch that the dotted path does not end in a red cross.',
  },
  {
    id: 'wobble', title: 'Spin wins', blurb: 'A top that slows wobbles and tips over.', arena: 'shallow',
    build: { body: 'dome', tip: 'steel', ballast: 'std', hand: 1 }, pickBuild: false,
    rival: { name: 'Loose top', build: { body: 'pear', tip: 'peg', ballast: 'std', hand: 1 }, launch: { ang: 'toward', pow: 0.3, q: 0.7 } },
    brief: ['Every top slows down. As it does it starts to lean and wobble, and soon it tips over. The one that lasts longer wins, if nothing knocks it out first.', 'Your Low Dome with a Steel Point keeps its spin a long time. A clean whip gives it the most.'],
    goal: 'Win with a good whip (the needle in or near the gold).',
    judge: (r) => r.win && r.launch.q >= 0.9,
    okText: 'Your top kept its spin while theirs wobbled and tipped over.', failText: 'Tap when the needle is in or near the gold, and keep the launch gentle.',
  },
  {
    id: 'workshop', title: 'Build the right top', blurb: 'Pick a body, tip and rim weight to beat a heavy Wide Disc.', arena: 'shallow',
    build: { body: 'dome', tip: 'pebble', ballast: 'std', hand: 1 }, pickBuild: true,
    rival: { name: 'Wide Disc', build: { body: 'disc', tip: 'steel', ballast: 'std', hand: -1 }, launch: { ang: 'toward', pow: 0.85, q: 0.95 } },
    brief: ['In the workshop you choose the shape of the body, the tip and the rim weight. Each choice has a cost: a heavy top hits hard and holds steady but launches slower; a steel point spins long but slides about.', 'The rival has a heavy Wide Disc with a Steel Point that comes straight at you. A light top gets pushed around, and a Flat Peg grips the dish. Choose a top that can take the hit.'],
    goal: 'Build your own top and win the round.',
    judge: (r) => r.win,
    okText: 'The right top for the job. In a real match you can read your rival the same way.', failText: 'Try a heavier body or a different tip, and use Think to find a launch.',
  },
];
