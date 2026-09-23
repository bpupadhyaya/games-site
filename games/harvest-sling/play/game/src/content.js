// Exhaustive Rules reference. Every claim here is cross-checked against game.js/birds.js/
// tuning.js/physics.js (the real simulation) so this page can never contradict the shipped
// build. `bird` names a real bird type drawn with render.js's own drawBird() (never a separate
// icon). `demo` tags a small custom illustration the Rules scene draws for that page.
// `lines` are whole sentences/paragraphs - the Rules renderer wraps each entry to fit the reader
// card itself, so entries here are only split where there is a real paragraph break; a page with
// a demo illustration or several distinct paragraphs is kept short enough to fit comfortably even
// at the top text-size step (verified by rendering every page - see STATUS.md).
export const RULES = [
  {
    title: 'Objective',
    lines: [
      'Guard the harvest: birds land on the perches to raid the crop, and you drive them off with a slingshot before they cause too much damage.',
      'Press and drag back from the slingshot pouch, then release to fire a stone - the further back you pull (up to a maximum draw), the more power the shot has.',
    ],
  },
  {
    title: 'Aiming',
    demo: 'aim',
    lines: [
      'While aiming, a dotted guide shows the start of the flight path. The guide gets shorter at higher levels, so aiming becomes more of a learned feel and less of a sure thing.',
    ],
  },
  {
    title: 'Controls',
    lines: [
      'Releasing without pulling back far enough fires nothing and costs no stone.',
      'On a keyboard: arrow keys turn and adjust the aim, Space fires the same way.',
    ],
  },
  {
    title: 'Sparrow',
    bird: 'sparrow',
    lines: [
      'The most common bird, worth the fewest points (10). Lands on a perch and stays roughly 6-10 seconds before flying off on its own.',
      'Skittish: once perched more than 2 seconds, it may spontaneously hop to another free perch at any moment, even if you never shoot near it. Appears from level 1.',
    ],
  },
  {
    title: 'Pigeon',
    bird: 'pigeon',
    lines: [
      'A large, easy target (the biggest hit radius of any perching bird) worth 15 points. Settles in for the longest stay of any bird, roughly 8-13 seconds, so it lingers if you are busy with something else. Appears from level 1.',
    ],
  },
  {
    title: 'Parrot',
    bird: 'parrot',
    lines: [
      'Worth 25 points. Perches only briefly - about 3.2 to 3.8 seconds - so you have to react quickly once one lands. Appears from level 3 onward.',
    ],
  },
  {
    title: 'Duck',
    bird: 'duck',
    lines: [
      'Worth 30 points. Never lands: it flies straight across the screen at a steady height with a gentle bob, then leaves - you have to lead the shot yourself, with no perch to aim at. Appears from level 4 onward.',
    ],
  },
  {
    title: 'Crow',
    bird: 'crow',
    lines: [
      'Worth 40 points. While perched, the first stone that flies within about 150 pixels of it makes it dodge - it hops into the air out of that stone\'s way instead of getting hit.',
    ],
  },
  {
    title: 'Crow (continued)',
    bird: 'crow',
    lines: [
      'For roughly 2.5 seconds after dodging it is still in play and can be hit mid-air; after that window it flies off for good. Appears from level 7 onward.',
    ],
  },
  {
    title: 'Owl',
    bird: 'owl',
    lines: [
      'The owl is protected - never shoot it on purpose. It is worth -50 points (your score cannot go below 0) and hitting it costs you 2 of your remaining stones and resets your combo to 0.',
    ],
  },
  {
    title: 'Owl (continued)',
    bird: 'owl',
    lines: [
      'A hit on the owl does not count toward the level\'s hit quota. Appears from level 8 onward, and only one is ever on screen at a time.',
    ],
  },
  {
    title: 'Hummingbird',
    bird: 'hummingbird',
    lines: [
      'The rarest and most valuable bird: 100 points, and the smallest hit radius of any bird by far, which makes it the hardest to hit.',
      'Never perches - it darts rapidly between random points on screen for roughly 7-10 seconds before leaving. Appears from level 10 onward.',
    ],
  },
  {
    title: 'Near misses and startling',
    lines: [
      'A stone does not have to hit a bird to affect it. If a stone flies within about 120 pixels of a perched bird without hitting it, that bird startles.',
      'A startled bird either hops to a different free perch (roughly 60% of the time) or flies away immediately - either way, a near miss can cost you the shot at that bird.',
      'Every stone can hit at most one bird - it does not pass through to hit a second one behind it.',
    ],
  },
  {
    title: 'Combo',
    demo: 'combo',
    lines: [
      'Hitting birds back-to-back builds a combo, shown as a multiplier (up to x5) that raises the points from your next hit; any miss, or hitting the owl, resets the combo to 0.',
      'Every 3rd hit in a combo also refunds 1 extra stone.',
    ],
  },
  {
    title: 'Scoring',
    lines: [
      'A hit is worth more the farther the bird is from the slingshot (up to +50% at long range), and 25% more if the bird was moving (flying, hopping, arriving or dodging) rather than sitting still on its perch.',
      'Clearing a level adds a bonus of 5 points for every stone you had left unused.',
    ],
  },
  {
    title: 'Wind',
    demo: 'wind',
    lines: [
      'From level 4 on, wind pushes stones sideways in flight - stronger and more variable at higher levels, and from level 16 it gusts, drifting continuously instead of holding steady.',
      'Drifting specks on screen always show the current wind direction and strength.',
    ],
  },
  {
    title: 'The crop meter',
    lines: [
      'Also from level 4 on (outside Daily Hunt), a crop meter drains while pest birds are perched or dodging on screen - the more birds sitting at once, the faster it drains.',
      'If the crop meter empties completely, the run ends immediately, however many stones you have left.',
    ],
  },
  {
    title: 'Clearing a level',
    lines: [
      'Each level has a hit quota and a limited number of stones. Hit that many birds (the owl never counts) before you run out of stones - or, from level 4 on, before the crop meter empties - to clear the level and move on.',
    ],
  },
  {
    title: 'Stars and ending a run',
    lines: [
      'Clearing a level always earns at least 1 star, based on how many stones you had left: 2 or more unused stones earns 2 stars, 5 or more earns the full 3 stars.',
      'A run ends (no more levels this run) if you run out of stones with none still in flight and you have not reached the quota, or if the crop meter empties.',
    ],
  },
  {
    title: 'Slingshot upgrades',
    lines: [
      'Stars earned from clearing levels add up across every run and are never spent - they simply unlock a nicer look over time.',
      'The slingshot itself is remade in a new wood at 10, 25, 50 and 90 total stars (oak, olive, bamboo, ebony, then a final gilded finish).',
    ],
  },
  {
    title: 'Stone upgrades',
    demo: 'upgrades',
    lines: [
      'The stone you fire changes too: a plain river pebble by default, a clay ball from 15 stars, and river glass from 40 stars.',
      'These upgrades are purely cosmetic - they change nothing about how a stone flies or scores.',
    ],
  },
  {
    title: 'Campaign and Endless',
    lines: [
      'Campaign: play levels in order. Clearing a level saves your progress, so Play always resumes from the highest level you have reached.',
      'Endless: the same level-by-level difficulty ramp as Campaign, but every run starts over at level 1 and nothing about it is saved between runs.',
    ],
  },
  {
    title: 'Daily Hunt',
    lines: [
      'Everyone gets the same fixed field and the same 20 stones on a given day (seeded by the date, not chance), with no hit quota - it is scored purely on how many of those 20 stones you land. Only one scored attempt per day is recorded.',
      'The free web preview allows Campaign levels 1-3 only, for up to 3 runs, and does not offer Endless or Daily Hunt.',
    ],
  },
  {
    title: 'Ending a run',
    lines: [
      'A run ends when the crop meter empties, or you run out of stones (with none still in the air) without reaching the current level\'s quota.',
      'The tally screen shows your score (and whether it beats your all-time best), the level you reached, how many birds you scared off, your accuracy, your best combo, and a shot-by-shot grid of every stone you threw.',
      'From there you can play again, share your result, or return to the title screen.',
    ],
  },
];
