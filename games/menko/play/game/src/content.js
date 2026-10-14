// Text for About, How to Play and the Rules reference. Every rule claim below was checked against the engine:
// sim.js (floor, discs, scatter, cover, gust, resistance, rug), match.js (hands, turns, piles, final count), game.js (flow).
// Numbers: the floor is 640 units across; a disc is 88 across (radius 44); the rug radius is 118; the cover circle is
// 1.3 disc radii around a rival disc's middle. A section is { title, art?, p: [paragraphs] }.

export const ABOUT = [
  { title: 'A floor game from Japan', art: 'floor', p: [
    'Menko is a children\'s game from Japan. Round discs of thick paper (in older times, of clay) are laid on the ground, and the other player slaps theirs down hard beside them. If the gust of air or the knock turns the disc over, the player who made it takes it home.',
    'It has been played in streets, school yards and doorways for generations, with discs traded, collected and treasured for their pictures.',
  ] },
  { title: 'A game of small decisions', p: [
    'A bigger slam makes a bigger gust, but it also scatters wider, and landing on top of a rival disc loses yours. Light discs scatter less, heavy discs are harder to flip, and a woven rug in the middle of the floor makes discs on it harder to turn over.',
    'Small hands can win: a careful, close slam often beats a wild one.',
  ] },
  { title: 'Credits', p: [
    'The hand and the onlooking children are drawn with the Arcforge view3d layer: characters derived from the Microsoft Rocketbox Avatar Library (MIT licence, Copyright (c) 2020 Microsoft; textures repainted). 3D rendering by three.js (MIT). Full licence text ships in vendor3d/LICENSES.md.',
  ] },
  { title: 'This version', p: [
    'Menko plays on a wooden tray on a veranda at dusk, lit like a real room. Every disc has an original design; there are twenty-four to find. The floor shows where a slam may land and the chance that each rival disc flips, so every slam is a decision you can read.',
    'Play one of four computer rivals, share the phone with a friend, or sit back with Watch & Learn and see why a skilled player chooses what they choose.',
  ] },
  { title: 'About the rules', p: [
    'Menko is played with many house rules. The version here is a simple, fair one, written out in full on the Rules page, including which parts (the air gust, the rug, weights and stars) are this game\'s own way of playing.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'floor', p: [
    'Turn rival discs face-down by slamming your own disc beside them. Every disc you flip is yours and its stars count for you. When both hands are empty, the side with more stars wins.',
  ] },
  { title: 'Choose a disc', art: 'discs', p: [
    'The tray under the floor holds your hand. Tap a disc to choose it. The dots show its weight: heavy discs make a stronger gust and are harder to flip, light discs scatter less. The gold pips are its stars.',
  ] },
  { title: 'Aim', art: 'slam', p: [
    'Tap the floor to put the aim there. Drag anywhere on the floor to nudge it, so your finger never hides it. The dashed circle shows where the disc may land.',
    'Aim beside a rival disc, not on it. The red dashed circle around each rival disc is the cover zone.',
  ] },
  { title: 'Strength', art: 'strength', p: [
    'Drag the strength slider. A stronger slam makes a stronger gust but widens the landing circle. Each rival disc shows its chance to flip, and the floor warns you of any risk of covering.',
  ] },
  { title: 'Slam', art: 'gust', p: [
    'Press SLAM. Your disc lands somewhere inside the dashed circle, a ring of air spreads, and every rival disc in reach rolls against it. The closer your disc lands, the stronger the gust there.',
    'When no rival disc is on the floor, the button says Lay disc: place a disc anywhere you like. Rival discs also never flip your own.',
  ] },
  { title: 'Cover', art: 'cover', p: [
    'If your disc lands within the red circle it comes down on top of the rival disc and is lost to your rival, with its stars.',
  ] },
  { title: 'Scoring', art: 'score', p: [
    'Flipped discs add their stars to your total. Discs still on the floor at the end score nothing for either side. The Hint button suggests a disc, a spot and a strength; the Collection on the title screen shows the designs you have found.',
  ] },
];

export const RULES = [
  { title: 'Goal', art: 'floor', p: [
    'Win more stars than your rival by flipping their discs face-down. The match ends when both hands are empty.',
  ] },
  { title: 'Setup', p: [
    'Each side is dealt a hand of 5 discs (Quick) or 8 discs (Full) from the 24 designs, with no design dealt twice. The side that starts is chosen at random. Turns then alternate strictly, so both sides use all their discs.',
    'The floor is a square with a rug in the middle. Nothing is on it at the start.',
  ] },
  { title: 'The discs', art: 'discs', p: [
    'Every design has a weight of 2, 3 or 4 dots and a value of 1, 2 or 3 stars. Your discs have a solid red rim; your rival\'s have a dotted blue rim.',
    'A heavy disc makes a stronger gust and is harder to flip, but its landing circle is wider. A light disc is easier to flip and its landing circle is narrower.',
  ] },
  { title: 'Your turn', p: [
    'Your turn is always one disc from your hand. If any rival disc is face-up on the floor, you slam. If there is none, you lay: put the disc anywhere free on the floor (a spot too close to another disc is moved to the nearest free spot).',
    'The disc you slam or lay stays on the floor, face-up, where it lands. It can be flipped by your rival on their turn.',
  ] },
  { title: 'Aiming a slam', art: 'slam', p: [
    'You choose the disc, the aim point and the strength (20% to 100%). The disc does not land exactly on the aim point: it lands at a random spot inside the dashed landing circle around it.',
    'The circle\'s radius grows with strength and with the disc\'s weight: gentle slams are accurate, hard slams are wild. The floor wall stops a disc: it comes to rest against the edge.',
  ] },
  { title: 'Where it lands', art: 'cover', p: [
    'Cover: if the disc lands with its middle inside the cover circle of a rival disc (1.3 disc radii around the rival disc\'s middle), it lands on top. There is no gust, and the disc and its stars go to your rival.',
    'Otherwise the disc comes to rest next to the discs it touched: if it overlaps any disc it is pushed out along the line between the middles until the rims just touch.',
  ] },
  { title: 'The gust', art: 'gust', p: [
    'A slam that is not a cover makes a gust that reaches every rival disc. The gust at a disc is the strength times the weight factor of your disc, and it falls off quickly with the gap between the rims. A disc landing with its rim touching a rival disc makes a rim strike: the gust is 20% stronger.',
    'Each rival disc has a resistance: heavier discs resist more, and a disc whose middle is on the rug resists 30% more. Each rival disc rolls its own luck of plus or minus 20% on the gust. If the gust is at least the resistance, the disc flips.',
    'The percentage shown over a rival disc while you aim is that chance, worked out over the whole landing circle. Your own discs are never flipped by your own slam.',
  ] },
  { title: 'Strength and scatter', art: 'strength', p: [
    'Strength is the main risk dial. Gentle slams are accurate but their gust only moves light discs close by; strong slams reach further and flip heavier discs but may land short (a cover) or wide.',
  ] },
  { title: 'Flipped discs', p: [
    'Every flipped disc is taken off the floor into your won pile, and its stars are added to your score at once. A single slam can flip several discs.',
  ] },
  { title: 'Scoring', art: 'score', p: [
    'Your score is the total stars of the discs you flipped, plus the stars of any of your rival\'s discs that covered a disc of yours. Discs still on the floor at the end of the match, and discs left in a hand, score nothing.',
    'The higher score wins. Equal scores are a draw.',
  ] },
  { title: 'Free preview and help', p: [
    'In Watch & Learn two computer rivals play a whole match; the Pause button freezes everything exactly where it is, and Think − / Think + set how long each rival thinks. The Hint button during your own turn picks a disc, a spot and a strength for you, using the same odds you see.',
    'Two Players shares one phone: after each turn a hand-over card hides the tray until the next player taps it.',
  ] },
  { title: 'This game\'s own parts', p: [
    'Real menko is played with many local rules, and the physical slap makes the gust. This game works the gust out with the numbers above, adds a rug and weights, and counts stars; those parts are this game\'s own, kept simple and fair.',
  ] },
];
