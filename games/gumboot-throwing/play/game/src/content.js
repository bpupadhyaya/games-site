// All reader text (About, How to Play, Rules). Numbers come from consts.js so the Rules page always matches the engine.
import { STYLES, BOOTS, ROUNDS, THROWS_PER_ROUND, CHALLENGE_LIVES, MIN_FAIR, SLIP_BAND, WINDS, SWEET_FRAC, LINE_X } from './consts.js';

export const ABOUT = [
  { title: 'Gumboot throwing (wellie wanging)', p: [
    'Throwing a rubber boot as far as you can is a cheerful festival contest of New Zealand and the United Kingdom, where the rubber boot is called a gumboot or a wellie. Contestants stand on a mat, swing the boot and let it fly down a marked lane. The longest throw wins.',
    'Gumboot Day in Taihape, New Zealand, has been held since 1985, with boot throwing among its events. Competitors there and in many other towns use silly styles and huge cheers. World records are held by throwers from Finland, and they are far beyond what a village fete sees.',
  ] },
  { title: 'About this version', p: [
    'This is a friendly, simplified one-player version. You see the throw from the side: the thrower, the mat, the lane boards every ten metres and the crowd. The boot is plain rubber, the crowd is generic and nobody is hurt.',
    'Real contests have their own rules about the mat, the style and the number of throws. The Rules page lists each simplification.',
  ] },
  { title: 'Made with', p: [
    'Gumboot Throwing is part of Arcforge, a collection of games from heritage traditions around the world. The scenery, the crowd and the boots are drawn by the game itself, and all sounds are made by the game.',
  ] },
  { title: 'Credits', p: [
    'The thrower is a 3D person derived from avatars of the Microsoft Rocketbox Avatar Library (MIT License, Copyright (c) 2020 Microsoft, https://github.com/microsoft/Microsoft-Rocketbox); the textures were repainted and the clothing recoloured.',
    'Base animations: Quaternius, Universal Animation Library (CC0, https://quaternius.com), and the Carnegie Mellon University Graphics Lab Motion Capture Database (http://mocap.cs.cmu.edu), created with funding from NSF EIA-0196217, BVH conversion by Bruce Hahne (cgspeed.com), retargeted to a different skeleton.',
    '3D rendering uses three.js (Copyright (c) 2010-2024 three.js authors, MIT License, https://threejs.org) and the meshoptimizer decoder (Copyright (c) 2016-2024 Arseny Kapoulkine, MIT License).',
  ] },
];

export const HOWTO = [
  { title: 'The idea', p: [
    `Throw the boot as far down the lane as you can. A round is ${THROWS_PER_ROUND} throws and your best throw is compared with the rival's best.`,
  ] },
  { title: 'Before a throw', p: [
    'Pick a style: Underarm Swing is steady, Overarm Hurl is balanced and Full Spin has the most power and the least grip. Then drag on the plan strip at the bottom to turn the aim into the wind: the arrow points where the boot will leave.',
  ] },
  { title: 'Swing and let go', p: [
    'Press and hold anywhere on the field. The thrower swings the boot round and round, faster the longer you hold. Let go to throw. The boot flies off in the direction it is moving, so let go while it is on the way up in front of the thrower, inside the green arc.',
  ] },
  { title: 'The grip bar', p: [
    'The hand cannot hold on for ever. The bar fills as the swing goes on and the end of it turns amber, then red. If the boot slips it flies off wherever it is, often backwards.',
  ] },
  { title: 'Wind and the lane', p: [
    `The wind arrow on the plan strip shows the wind. A headwind shortens the throw and a tailwind carries it. Across the lane, the wind pushes the boot sideways: a boot that lands outside the lane lines is a no-throw (it scores 0).`,
  ] },
  { title: 'Think', p: [
    'Tap Think before a throw for a hint: the game shows the wind, the aim to use and about how long to hold. A throw that used the hint cannot earn three stars.',
  ] },
  { title: 'Keyboard', p: [
    'Left and Right turn the aim. Hold Space to swing and let go to throw. 1, 2 and 3 choose the style. T is Think and P pauses.',
  ] },
  { title: 'Other ways to play', p: [
    `Festival Cup: ${ROUNDS.length} rounds, each against a rival. Distance Challenge: keep throwing until you have had ${CHALLENGE_LIVES} no-throws. Practice: throw freely. Learn: three short drills. Watch & Learn: the computer throws and explains each decision.`,
  ] },
];

export const RULES = [
  { title: 'The contest', p: [
    'A thrower stands on a rubber mat, swings a gumboot and lets it go down a lane. The distance is measured from the throwing line at the front of the mat to the place where the boot first touches the ground.',
  ], art: 'lane' },
  { title: 'The lane', p: [
    `The lane is a wedge that opens out from the mat. Its half angle is different in every round (from 9 to 15 degrees) and it is drawn on the plan strip. The boot must first touch the ground inside the lines. Distances are shown in metres from the throwing line, ${LINE_X} metres in front of the thrower.`,
    `A boot that lands outside the lane lines, behind the line or closer than ${MIN_FAIR} metres is a no-throw and scores 0.`,
  ] },
  { title: 'Styles', p: [
    `${STYLES.map((s) => `${s.name}: ${s.note.toLowerCase()}`).join('. ')}. Every style swings faster the longer you hold, but a more powerful style tops out higher, can hold on for a shorter time and throws a little more sideways.`,
    'Choose the style before the swing. You cannot change it once the swing has started.',
  ] },
  { title: 'The swing', p: [
    'Press and hold to swing. The boot circles the thrower\'s shoulder and speeds up the longer you hold, rapidly at first and then more slowly. The speed of the boot when you let go decides the distance.',
    'The boot leaves in the direction it is moving. The angle of the circle at that moment is the launch angle: low skims the grass, high floats up and drops. The best angle is not the same every throw: wind and boot weight change it. The green sweet arc shows the launch angles that land within a few per cent of the best distance at the present speed.',
  ], art: 'swing' },
  { title: 'Grip', p: [
    `Each style holds on for a limited time (${STYLES.map((s) => `${s.short} about ${s.grip.toFixed(1)} seconds`).join(', ')}). The exact moment the boot slips is different every throw, between ${Math.round(SLIP_BAND[0] * 100)}% and ${Math.round(SLIP_BAND[1] * 100)}% of that time. The grip bar turns amber when it is getting close and red when a slip is likely. A slipped boot leaves at once at the angle it had.`,
  ] },
  { title: 'Aim and wind', p: [
    'Drag on the plan strip (or use Left and Right) to turn the aim, up to a little beyond the lane lines. The boot also wobbles a little as the swing turns, more with the more powerful styles; the predicted landing mark on the plan strip includes this.',
    `The wind is different for every throw, stronger in later rounds. A wind along the lane pushes the boot back or forward; a wind across it carries the boot sideways. Gusts make it change a little during the flight. A light boot is blown about more than a heavy one. The settings in Practice are ${WINDS.map((w) => w.name).join(', ')}.`,
  ] },
  { title: 'Boots', p: [
    `The boot changes with the round: ${BOOTS.map((b) => b.name).join(', ')}. The weight changes how much the air slows it and how far the wind carries it. They all swing the same.`,
  ] },
  { title: 'Scoring a throw', p: [
    'A fair throw scores its distance in metres to one decimal place. Your best throw of the round counts for the Festival Cup; in the Distance Challenge every fair throw adds its distance to your total.',
  ] },
  { title: 'Festival Cup', p: [
    `The Cup has ${ROUNDS.length} rounds: ${ROUNDS.map((r) => r.name).join(', ')}. In each you throw ${THROWS_PER_ROUND} times and the rival throws ${THROWS_PER_ROUND} times. After each of your throws you see what the rival threw in the same turn.`,
    `Stars: one for beating the rival's best, two for reaching the second mark of the round and three for the top mark: ${ROUNDS.map((r) => `${r.name} ${r.star2} m and ${r.star3} m`).join('; ')}. A throw that used the Think hint cannot earn the third star. A round opens when you have at least one star in the one before. The rival, the wind and the lane get harder each round.`,
  ] },
  { title: 'Distance Challenge', p: [
    `An endless contest. It ends when you have had ${CHALLENGE_LIVES} no-throws. Every three throws the wind rises and the lane narrows a little. Your total in metres is saved as your best.`,
  ] },
  { title: 'Practice and Learn', p: [
    'Practice has unlimited throws: choose the style and the wind. Learn has three short drills (Power, Angle, Wind) with a goal for each. The guide is always on in the drills.',
  ] },
  { title: 'Watch & Learn', p: [
    'The computer throws a round and explains. Before each throw it stops and goes through three stages: Think (it reads the wind, tries the three styles and decides how long to hold and where to aim), Reveal (the plan is shown on the plan strip and the arc) and Act (the throw goes ahead). The thinking time is set in Settings (2 to 10 seconds). Pause stops everything and resumes exactly where it was.',
  ] },
  { title: 'Think hint', p: [
    'Tap Think before your own throw. The game shows the wind and what it would do: which aim to use and how long to hold. Close the note to carry on. A hinted throw cannot earn three stars.',
  ] },
  { title: 'Guide setting', p: [
    `Guided: the sweet arc (launch angles within ${Math.round(SWEET_FRAC * 100)}% of the best), a live distance and the predicted landing mark. Arc only: the sweet arc and nothing else. Off: no guide; you judge by feel.`,
  ] },
  { title: 'Differences from the real contest', p: [
    'Real contests usually let each thrower choose their own style, mat and number of throws, and the boots are standard. Here the swing, the wind and the grip are simplified into one set of rules so that every throw can be measured the same way.',
    'There are no injuries and nobody is hit. There are no stakes: points are only for fun.',
  ] },
  { title: 'Text size and controls', p: [
    'Every text screen can be enlarged from 100% to 300% with A+ and A-. Keyboard: Left and Right aim, hold Space to swing, 1 2 3 style, T hint, P or Escape pause, plus and minus change the text size on menus.',
  ] },
];
