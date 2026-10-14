// Text for About, How to Play and the Rules reference. Every rule claim below was checked against the engine:
//   sim.js  60 s bout, then a 20 s golden throw when level; first to 4 points; halal wins outright; balance point = spring (stiffness 58,
//           damping 2.9; 1.9x and 1.8x while rooting); tug force 30 x strength (45 % at an empty grip, 100 % full) x (1 - 35 % of your own
//           lean); 30 % of a tug rocks you the other way; grip burns 0.2/s at a full tug and returns 0.28/s while rooting; throw wind-up
//           0.28 s; quality = rival's lean along the throw + 7 % per unit of swing speed (up to 3) - 50 % of your own lean beyond 45 % +
//           8 % when the rival is mid-throw; miss below 32 %, stumble 32-45 %, chala from 45 %, yonbosh from 66 %, halal from 84 %;
//           miss = 0.8 s off your feet; passivity warning after 7 s of no tug and no throw, the second and later warnings give the rival 1
//           point; 1.5 s to square up after a score; decision = points, then fewer warnings, then more throws tried, then more grip
//   ai.js   five rivals, Think coach, Watch & Learn
//   game.js best of three bouts, first to two, the 90 s preview, the demo cap
// A section is { title, art?, p: [paragraphs] }; the reader lays the text out so nothing overflows at any text size.

export const ABOUT = [
  { title: 'Kurash', art: 'stage', p: [
    'Kurash is the national belt wrestling of Uzbekistan and one of the oldest sports of Central Asia. Two wrestlers in jackets and belts, one in blue and one in green, grip each other\'s belt and try to throw each other to the mat, standing up and never on the ground. Judges score a throw by how cleanly and how flatly it lands, and a perfect throw ends the bout.',
    'It is wrestled at village festivals and in sports halls across Uzbekistan and its neighbours. Kurash is an event of the Asian Games and of the World Nomad Games, and an international federation organises championships for men and women.',
  ] },
  { title: 'This version', p: [
    'Kurash puts you in the blue jacket. One thumb does everything: move it to tug, and flick and lift it to throw. You see the mat from the side, with each wrestler\'s weight shown as a dot inside a ring on the mat, so you can read the fight like a judge does. Wrestlers lean the way their weight goes.',
    'Play against five rivals from a nervous newcomer to a champion, share one phone with a friend, or play Watch & Learn: two computer wrestlers play a whole match while they explain every choice, with a real Pause.',
  ] },
  { title: 'The three venues', p: [
    'Registan Courtyard is a sunlit square of turquoise tile, Chorsu Hall is a carved wooden hall lit by lanterns, and Grand Arena is a spotlit mat in front of a roaring crowd. The venues only change the look; the rules are the same.',
  ] },
  { title: 'Credits', p: [
    'The wrestlers are derived from avatars of the Microsoft Rocketbox Avatar Library (https://github.com/microsoft/Microsoft-Rocketbox): meshes and skeletons are used as published, textures were repainted and the clothing was recoloured and added for kurash. Rocketbox is licensed under the MIT License, Copyright (c) 2020 Microsoft.',
    'Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files, to deal in the software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies, subject to the inclusion of the above copyright notice and this permission notice in all copies or substantial portions of the software. The software is provided "as is", without warranty of any kind.',
    'Motion data: Quaternius, Universal Animation Library (CC0 1.0, https://quaternius.com); Carnegie Mellon University Graphics Lab Motion Capture Database (http://mocap.cs.cmu.edu), created with funding from NSF EIA-0196217, BVH conversion by Bruce Hahne (cgspeed.com).',
    'Software: three.js, Copyright (c) 2010-2024 three.js authors, MIT License (https://threejs.org); meshoptimizer decoder, Copyright (c) 2016-2024 Arseny Kapoulkine, MIT License.',
  ] },
  { title: 'About the rules', p: [
    'The game keeps what makes kurash kurash: standing wrestling by the belt, scoring by the quality of a throw (chala, yonbosh and halal), a perfect throw that wins on the spot, and a warning for passive wrestlers. It simplifies how a real bout is refereed, and the Rules pages say exactly how everything in the game works.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'stage', p: [
    'You are the wrestler in the blue jacket on the left. Score points with throws: win a bout by reaching four points, by one perfect throw (a halal), or by being ahead when the clock ends. Win two bouts to win the match.',
  ] },
  { title: 'Tugging', art: 'compass', p: [
    'Put a thumb anywhere on the screen and move it. The way your thumb moves is the way you pull your rival: swipe right and their weight is pulled to the right. The faster you move, the harder you tug, and the ring under your thumb follows it, so you never run out of room. Hold your thumb still and the tug fades away in about half a second.',
    'The dot inside each wrestler\'s ring is their weight. When it reaches the edge, they are about to fall.',
  ] },
  { title: 'Ride the swing', art: 'swing', p: [
    'A pulled wrestler does not stop at the end of a tug: their weight swings back like a pendulum. Tug the way they are already moving and each pull adds to the swing. Tug against it and you cancel it. Short rhythmic pulls beat one long heave.',
    'Pulling also rocks you a little the other way, and a tired grip tugs weakly. Keep your own dot near the middle.',
  ] },
  { title: 'Throwing', art: 'throw', p: [
    'Flick your thumb the way you want to throw and lift it while it is still moving. The throw takes a moment to land, and it scores by how far the rival is leaning that way when it does. Far enough: chala (1 point). Farther: yonbosh (2 points). All the way over: halal, a perfect throw, and the bout is yours.',
    'Throw too early and you miss and end up off your feet, wide open to a counter. Lifting a thumb that is resting is safe: it is not a throw.',
  ] },
  { title: 'Grip and defence', art: 'meters', p: [
    'GRIP drains while you tug and returns while your thumb is still. A still thumb (kept on the glass) also roots you: your weight snaps back to the middle much faster, so a rooted wrestler is very hard to throw. If you see the rival start a throw, hold still.',
    'You cannot stand still for ever: if you neither tug nor throw for seven seconds you are warned for passivity, and every warning after the first gives your rival a point.',
  ] },
  { title: 'Think and Watch & Learn', p: [
    'Think pauses the bout and tells you the plan a good wrestler would follow and why, with an arrow on the mat. Watch & Learn plays whole bouts between two computer wrestlers and stops to explain their choices; you set how long each pause lasts in Settings.',
  ] },
];

export const RULES = [
  { title: '1. The match', p: [
    'A match is the best of three bouts: the first wrestler to win two bouts wins the match.',
    'A bout lasts 60 seconds. It ends at once when one wrestler throws a halal or reaches 4 points. At the end of the 60 seconds the wrestler with more points wins.',
    'If the points are level a golden throw period of 20 seconds follows. The first wrestler to score anything wins the bout.',
    'If nobody scores in the golden throw period, the judges decide: first the wrestler with fewer passivity warnings, then the one who tried more throws, then the one with more grip left.',
  ] },
  { title: '2. The mat and the weight', art: 'stage', p: [
    'You see a round mat with a ring under each wrestler. The dot in the ring is their weight: the middle is a calm stance and the edge is falling. The wrestler\'s upper body leans the same way as the dot, while their feet stay on their marks.',
    'A weight dot swings like a pendulum: it is pulled back to the middle by a spring, and slowed only a little, so it keeps swinging after a tug. It can never go beyond the edge of the ring.',
  ] },
  { title: '3. Tugging', art: 'compass', p: [
    'Move a thumb to tug. A ring under your thumb follows it and catches up in about 0.3 seconds; the gap between ring and thumb is your tug. The direction of that gap is the direction your rival\'s weight is pulled. A gap of 110 virtual units (about a centimetre) is a full tug, and shorter gaps tug less. A gap under 15% of that is not a tug at all, and a thumb held still tugs nothing within half a second.',
    'Tug force is 30 units at full strength, multiplied by your strength and reduced by up to 35% when you yourself are at the edge of your ring. Your strength is 45% with an empty grip and 100% with a full one.',
    'Every tug rocks the one who pulls: 30% of the force acts on you in the opposite direction.',
    'Two tugs at once are simply added together on each wrestler.',
  ] },
  { title: '4. Grip', art: 'meters', p: [
    'Grip is shown as a bar. A full tug uses 20% of your grip every second; smaller tugs use less. While your thumb is still (rooting) grip returns at 28% a second. Grip does not change in the short moments when you are throwing or are off your feet.',
    'A rooted wrestler is more stable: the spring that pulls the weight to the middle is 1.9 times stronger and the swing dies away 1.8 times faster.',
  ] },
  { title: '5. Throws', art: 'throw', p: [
    'Lift your thumb while your tug is at least 35% of the full tug and you start a throw in the direction of that tug. The throw lands 0.28 seconds later. On a keyboard: the arrow keys tug (I, J, K, L for the second player) and Space throws (U for the second player).',
    'When it lands the throw has a quality from 0 to 100%. It is the rival\'s weight leaning in the throw\'s direction, plus 7% for every unit of speed they are swinging that way (at most 21%), minus half of how far your own weight is beyond 45% of the ring, plus 8% when the rival is in the middle of a throw of their own.',
    'Below 32% the throw misses: you stumble and are off your feet for 0.8 seconds, and cannot tug or throw. From 32% to 45% it is a half-throw: no points, and you are off your feet for 0.4 seconds.',
  ] },
  { title: '6. Scores', p: [
    'From 45%: chala, 1 point.',
    'From 66%: yonbosh, 2 points.',
    'From 84%: halal, a perfect throw. It wins the bout at once, whatever the score.',
    'After a point the wrestlers square up again for 1.5 seconds, and any throw still in the air is cancelled.',
  ] },
  { title: '7. Counters', p: [
    'If both wrestlers throw and both throws would score, only the better one counts: the other is a miss, and that wrestler is off their feet. Wrestling in turn rather than together is safer.',
    'A throw in the middle of a rival\'s throw is easy to land (the 8% bonus), but you must also be steady enough yourself.',
  ] },
  { title: '8. Passivity', p: [
    'A wrestler who neither tugs nor throws for 7 seconds receives a warning. The second warning, and every one after it, gives the rival a chala. A rooted but still wrestler is passive: rooting is for defence, not for hiding.',
  ] },
  { title: '9. What is simplified', p: [
    'Real kurash is refereed by judges on the quality of each throw; here the engine measures the throw. Real bouts last longer, are split into weight classes and have a longer list of technical rules (for example, how a grip may be taken). There are no ground fights in kurash, and none here. Names of the scores (chala, yonbosh, halal) follow the sport; the numbers used here are this game\'s own.',
    'The computer wrestlers\' names are made up.',
  ] },
  { title: '10. Two players, Think and Watch & Learn', p: [
    'Two players: one phone, one thumb each. The left half of the screen controls the blue wrestler and the right half the green one. Flick and lift your thumb to throw.',
    'Think: pauses the bout, picks the plan a good wrestler would choose (build the swing, hold your ground, or throw now), shows its direction as an arrow and says why. It never plays for you.',
    'Watch & Learn: two computer wrestlers play a whole match. Every few seconds one of them thinks aloud, then does what they said. You can pause, speed up three times and set how long they think.',
  ] },
  { title: '11. Preview', p: [
    'The free preview counts only the time spent in a live bout: menus, countdowns, pauses and Watch & Learn do not use it up. Unlocking the game once removes the limit for good.',
  ] },
];
