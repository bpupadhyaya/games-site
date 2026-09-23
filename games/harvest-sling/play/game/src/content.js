// Exhaustive Rules reference. Every claim here is cross-checked against game.js/birds.js/
// tuning.js/physics.js (the real simulation) so this page can never contradict the shipped
// build. `bird` names a real bird type drawn with render.js's own drawBird() (never a separate
// icon). `demo` tags a small custom illustration the Rules scene draws for that page. Only the
// first page introducing a bird or demo topic carries the illustration; later pages on the same
// topic are text-only, which buys them the larger no-illustration text budget - see STATUS.md.
// `lines` are whole sentences/paragraphs - the Rules renderer wraps each entry to fit the reader
// card itself. Every page (title + illustration + lines) is paced to fit comfortably even at the
// top text-size step, 300% (verified by rendering every page - see STATUS.md); pages that did not
// fit were split into more single-concept pages here rather than shrinking the font, and titles
// are kept short (<= 19 characters) so the (also capped, but still much larger than body text used
// to be) title font never runs past the card at the highest step.
export const RULES = [
  {
    title: 'Objective',
    lines: [
      'Guard the harvest: birds land on the perches to raid the crop,',
    ],
  },
  {
    title: 'Guarding',
    lines: [
      'and you drive them off with a slingshot before they cause too much damage.',
    ],
  },
  {
    title: 'Firing',
    lines: [
      'Press and drag back from the slingshot pouch, then release to fire a stone.',
    ],
  },
  {
    title: 'Draw power',
    lines: [
      'The further back you pull (up to a maximum draw),',
    ],
  },
  {
    title: 'Shot power',
    lines: [
      'the more power the shot has.',
    ],
  },
  {
    title: 'Aiming',
    demo: 'aim',
    lines: [
      'While aiming, a dotted guide shows the start of the flight path.',
    ],
  },
  {
    title: 'Aiming (continued)',
    demo: 'aim',
    lines: [
      'The guide gets shorter at higher levels,',
    ],
  },
  {
    title: 'Guide feel',
    lines: [
      'so aiming becomes more of a learned feel and less of a sure thing.',
    ],
  },
  {
    title: 'Controls',
    lines: [
      'Releasing without pulling back far enough fires nothing and costs no stone.',
    ],
  },
  {
    title: 'Keyboard',
    lines: [
      'On a keyboard: arrow keys turn and adjust the aim, Space fires the same way.',
    ],
  },
  {
    title: 'Sparrow',
    bird: 'sparrow',
    lines: [
      'The most common bird, worth the fewest points (10).',
    ],
  },
  {
    title: 'Sparrow stay',
    bird: 'sparrow',
    lines: [
      'Lands on a perch and stays roughly 6-10 seconds',
    ],
  },
  {
    title: 'Sparrow flies',
    lines: [
      'before flying off on its own.',
    ],
  },
  {
    title: 'Sparrow habits',
    lines: [
      'Skittish: once perched more than 2 seconds,',
    ],
  },
  {
    title: 'Skittish hops',
    lines: [
      'it may spontaneously hop to another free perch',
    ],
  },
  {
    title: 'Hop away',
    lines: [
      'at any moment, even if you never shoot near it. Appears from level 1.',
    ],
  },
  {
    title: 'Pigeon',
    bird: 'pigeon',
    lines: [
      'A large, easy target (the biggest hit radius of any perching bird)',
    ],
  },
  {
    title: 'Pigeon (stay)',
    lines: [
      'worth 15 points. Settles in for the longest stay of any bird,',
    ],
  },
  {
    title: 'Pigeon habits',
    lines: [
      'roughly 8-13 seconds, so it lingers if you are busy with something else.',
    ],
  },
  {
    title: 'Pigeon range',
    lines: [
      'Appears from level 1.',
    ],
  },
  {
    title: 'Parrot',
    bird: 'parrot',
    lines: [
      'Worth 25 points. Perches only briefly -',
    ],
  },
  {
    title: 'Parrot timing',
    lines: [
      'about 3.2 to 3.8 seconds -',
    ],
  },
  {
    title: 'Parrot habits',
    lines: [
      'so you have to react quickly once one lands. Appears from level 3 onward.',
    ],
  },
  {
    title: 'Duck',
    bird: 'duck',
    lines: [
      'Worth 30 points. Never lands: it flies straight across the screen',
    ],
  },
  {
    title: 'Duck flight',
    lines: [
      'at a steady height with a gentle bob, then leaves.',
    ],
  },
  {
    title: 'Duck lead',
    lines: [
      'You have to lead the shot yourself,',
    ],
  },
  {
    title: 'Duck aim',
    lines: [
      'with no perch to aim at. Appears from level 4 onward.',
    ],
  },
  {
    title: 'Crow',
    bird: 'crow',
    lines: [
      'Worth 40 points. While perched, the first stone that flies',
    ],
  },
  {
    title: 'Crow (dodging)',
    lines: [
      'within about 150 pixels of it makes it dodge. It hops into the air',
    ],
  },
  {
    title: 'After dodging',
    lines: [
      "out of that stone's way instead of getting hit.",
    ],
  },
  {
    title: 'Dodge window',
    lines: [
      'For roughly 2.5 seconds after dodging',
    ],
  },
  {
    title: 'Still in play',
    lines: [
      'it is still in play and can be hit mid-air; after that window it flies off for good.',
    ],
  },
  {
    title: 'Crow range',
    lines: [
      'Appears from level 7 onward.',
    ],
  },
  {
    title: 'Owl',
    bird: 'owl',
    lines: [
      'The owl is protected - never shoot it on purpose.',
    ],
  },
  {
    title: 'Owl penalty',
    lines: [
      'It is worth -50 points (your score cannot go below 0).',
    ],
  },
  {
    title: 'Owl cost',
    lines: [
      'Hitting it also costs you 2 of your remaining stones and resets your combo to 0.',
    ],
  },
  {
    title: 'Owl and quota',
    lines: [
      "A hit on the owl does not count toward the level's hit quota.",
    ],
  },
  {
    title: 'Owl range',
    lines: [
      'Appears from level 8 onward, and only one is ever on screen at a time.',
    ],
  },
  {
    title: 'Hummingbird',
    bird: 'hummingbird',
    lines: [
      'The rarest and most valuable bird: 100 points,',
    ],
  },
  {
    title: 'Hardest to hit',
    lines: [
      'and the smallest hit radius of any bird by far,',
    ],
  },
  {
    title: 'Small target',
    lines: [
      'which makes it the hardest to hit.',
    ],
  },
  {
    title: 'Darts around',
    lines: [
      'Never perches - it darts rapidly between random points',
    ],
  },
  {
    title: 'Darting speed',
    lines: [
      'on screen for roughly 7-10 seconds',
    ],
  },
  {
    title: 'Hummingbird range',
    lines: [
      'before leaving. Appears from level 10 onward.',
    ],
  },
  {
    title: 'Near misses',
    lines: [
      'A stone does not have to hit a bird to affect it.',
    ],
  },
  {
    title: 'Near miss range',
    lines: [
      'If a stone flies within about 120 pixels of a perched bird',
    ],
  },
  {
    title: 'Startling',
    lines: [
      'without hitting it, that bird startles.',
    ],
  },
  {
    title: 'Startle hop',
    lines: [
      'A startled bird either hops to a different free perch (roughly 60% of the time)',
    ],
  },
  {
    title: 'After startling',
    lines: [
      'or flies away immediately.',
    ],
  },
  {
    title: 'A costly miss',
    lines: [
      'Either way, a near miss can cost you the shot at that bird.',
    ],
  },
  {
    title: 'One bird per stone',
    lines: [
      'Every stone can hit at most one bird',
    ],
  },
  {
    title: 'No pass-through',
    lines: [
      'it does not pass through to hit a second one behind it.',
    ],
  },
  {
    title: 'Combo',
    demo: 'combo',
    lines: [
      'Hitting birds back-to-back builds a combo, shown as a multiplier',
    ],
  },
  {
    title: 'Combo bonus',
    lines: [
      '(up to x5) that raises the points from your next hit.',
    ],
  },
  {
    title: 'Combo reset',
    lines: [
      'Any miss, or hitting the owl, resets the combo to 0.',
    ],
  },
  {
    title: 'Combo refund',
    lines: [
      'Every 3rd hit in a combo also refunds 1 extra stone.',
    ],
  },
  {
    title: 'Scoring',
    lines: [
      'A hit is worth more the farther the bird is from the slingshot',
    ],
  },
  {
    title: 'Long range bonus',
    lines: [
      '(up to +50% at long range), and 25% more if the bird was moving',
    ],
  },
  {
    title: 'Movement bonus',
    lines: [
      '(flying, hopping, arriving or dodging)',
    ],
  },
  {
    title: 'Not on its perch',
    lines: [
      'rather than sitting still on its perch.',
    ],
  },
  {
    title: 'Level-clear bonus',
    lines: [
      'Clearing a level adds a bonus of 5 points for every stone you had left unused.',
    ],
  },
  {
    title: 'Wind',
    demo: 'wind',
    lines: [
      'From level 4 on, wind pushes stones sideways in flight',
    ],
  },
  {
    title: 'Wind gusts',
    lines: [
      '- stronger and more variable at higher levels.',
    ],
  },
  {
    title: 'Gusting wind',
    lines: [
      'From level 16 it gusts, drifting continuously',
    ],
  },
  {
    title: 'Wind specks',
    lines: [
      'instead of holding steady.',
    ],
  },
  {
    title: 'Wind direction',
    lines: [
      'Drifting specks on screen always show the current wind direction and strength.',
    ],
  },
  {
    title: 'The crop meter',
    lines: [
      'Also from level 4 on (outside Daily Hunt), a crop meter drains',
    ],
  },
  {
    title: 'Crop meter drain',
    lines: [
      'while pest birds are perched or dodging on screen.',
    ],
  },
  {
    title: 'More birds, faster',
    lines: [
      'The more birds sitting at once,',
    ],
  },
  {
    title: 'Meter speed',
    lines: [
      'the faster it drains. If the crop meter empties completely,',
    ],
  },
  {
    title: 'Crop meter empties',
    lines: [
      'the run ends immediately, however many stones you have left.',
    ],
  },
  {
    title: 'Clearing a level',
    lines: [
      'Each level has a hit quota and a limited number of stones.',
    ],
  },
  {
    title: 'Hit quota',
    lines: [
      'Hit that many birds (the owl never counts) before you run out of stones.',
    ],
  },
  {
    title: 'Two ways to clear',
    lines: [
      'From level 4 on, you must also beat the crop meter before it empties.',
    ],
  },
  {
    title: 'Level cleared',
    lines: [
      'Either way, clearing the level moves you to the next one.',
    ],
  },
  {
    title: 'Stars',
    lines: [
      'Clearing a level always earns at least 1 star, based on how many stones you had left.',
    ],
  },
  {
    title: 'Star tiers',
    lines: [
      '2 or more unused stones earns 2 stars, 5 or more earns the full 3 stars.',
    ],
  },
  {
    title: 'When a run ends',
    lines: [
      'A run ends (no more levels this run) if you run out of stones',
    ],
  },
  {
    title: 'Run limits',
    lines: [
      'with none still in flight and you have not reached the quota,',
    ],
  },
  {
    title: 'Meter empties',
    lines: [
      'or if the crop meter empties.',
    ],
  },
  {
    title: 'Slingshot upgrades',
    lines: [
      'Stars earned from clearing levels add up across every run and are never spent',
    ],
  },
  {
    title: 'Never spent',
    lines: [
      '- they simply unlock a nicer look over time.',
    ],
  },
  {
    title: 'Slingshot woods',
    lines: [
      'The slingshot itself is remade in a new wood at 10, 25, 50 and 90 total stars',
    ],
  },
  {
    title: 'Wood finishes',
    lines: [
      '(oak, olive, bamboo, ebony, then a final gilded finish).',
    ],
  },
  {
    title: 'Stone upgrades',
    demo: 'upgrades',
    lines: [
      'The stone you fire changes too: a plain river pebble',
    ],
  },
  {
    title: 'Stone tiers',
    lines: [
      'by default, a clay ball from 15 stars, and river glass from 40 stars.',
    ],
  },
  {
    title: 'Cosmetic only',
    lines: [
      'These upgrades are purely cosmetic -',
    ],
  },
  {
    title: 'Looks only',
    lines: [
      'they change nothing about how a stone flies or scores.',
    ],
  },
  {
    title: 'Campaign',
    lines: [
      'Campaign: play levels in order. Clearing a level saves your progress,',
    ],
  },
  {
    title: 'Campaign resumes',
    lines: [
      'so Play always resumes from the highest level you have reached.',
    ],
  },
  {
    title: 'Endless',
    lines: [
      'Endless: the same level-by-level difficulty ramp as Campaign,',
    ],
  },
  {
    title: 'Endless restarts',
    lines: [
      'but every run starts over at level 1',
    ],
  },
  {
    title: 'Endless resets',
    lines: [
      'and nothing about it is saved between runs.',
    ],
  },
  {
    title: 'Daily Hunt',
    lines: [
      'Everyone gets the same fixed field and the same 20 stones on a given day',
    ],
  },
  {
    title: 'Same for everyone',
    lines: [
      '(seeded by the date, not chance), with no hit quota.',
    ],
  },
  {
    title: 'Daily Hunt scoring',
    lines: [
      'It is scored purely on how many of those 20 stones you land.',
    ],
  },
  {
    title: 'One try a day',
    lines: [
      'Only one scored attempt per day is recorded.',
    ],
  },
  {
    title: 'Free web preview',
    lines: [
      'The free web preview allows Campaign levels 1-3 only, for up to 3 runs,',
    ],
  },
  {
    title: 'Preview limits',
    lines: [
      'and does not offer Endless or Daily Hunt.',
    ],
  },
  {
    title: 'Ending a run',
    lines: [
      'A run ends when the crop meter empties, or you run out of stones',
    ],
  },
  {
    title: 'Missing the quota',
    lines: [
      "(with none still in the air) without reaching the current level's quota.",
    ],
  },
  {
    title: 'Tally screen',
    lines: [
      'The tally screen shows your score (and whether it beats your all-time best),',
    ],
  },
  {
    title: 'Tally details',
    lines: [
      'the level you reached, how many birds you scared off.',
    ],
  },
  {
    title: 'More on the tally',
    lines: [
      'It also shows your accuracy, your best combo,',
    ],
  },
  {
    title: 'The shot grid',
    lines: [
      'and a shot-by-shot grid of every stone you threw.',
    ],
  },
  {
    title: 'After the run',
    lines: [
      'From there you can play again, share your result, or return to the title screen.',
    ],
  },
];
