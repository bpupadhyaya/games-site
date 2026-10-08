// All the words: About, How to Play, the exhaustive Rules reference, coach lines. Every statement here describes what the engine in
// sim.js really does (numbers were cross-checked against it).
export const ABOUT = [
  { h: 'Dragon Boat Race', p: 'A rhythm race in real 3D. You are a paddler in a long carved boat with twenty paddlers, a drummer at the bow and a steerer at the stern. The drum sets the beat: tap in time to bring the whole crew into sync, steer across the river lanes, and cross the line first.' },
  { h: 'The tradition', p: 'Dragon boat racing is team paddling at its purest: long narrow boats with a carved dragon head and tail, a big drum to keep every paddle in time, and crowds on the riverbank. It is raced across China, Hong Kong, Taiwan, Singapore, Malaysia and in clubs all over the world, and it is as much about teamwork and timing as strength.' },
  { h: 'What you can do', p: 'Race a three-river regatta (heat, semifinal and final on each river), pick a quick race, take the drum yourself in the Drummer Challenge and set the tempo for the crew, learn the beat in a short lesson, or sit back and let the coach crew race while it explains every decision (Watch & Learn).' },
  { h: 'Made with care', p: 'No ads, no energy timers, no tracking. The first 90 seconds of real racing are free; one unlock keeps the whole game, on your device, forever. Everything works offline.' },
];
export const CREDITS = 'Arcforge. 3D drawing by an open-source WebGL library (MIT licence, see Licences below). Fonts: Barlow and Barlow Condensed (SIL Open Font Licence). All sounds are synthesized in the game. Crew names, rivers and places are invented.';

export const HOWTO = [
  { title: 'Tap with the drum', fig: 'beat', body: 'The drum pad is on the right. A ring shrinks towards the pad for every drum beat; tap anywhere on the right side of the screen when the ring closes on the pad. The more exact you are, the better the hit: PERFECT, GREAT, GOOD or RAGGED. A beat you miss costs you.' },
  { title: 'Keep the crew in sync', fig: 'sync', body: 'SYNC is how together your crew paddles. Good hits pull it up and the paddlers visibly come into time; misses and stray taps drag it down and the paddles go ragged. Every stroke pushes the boat harder the higher your sync is, so timing is speed.' },
  { title: 'Steer with your left thumb', fig: 'steer', body: 'Touch the left side of the screen and drag left or right to steer. Bright streaks on the water are fast streams: drift into one for free speed. Dodge logs, lotus mats and buoys, and keep clear of the boat in the next lane. Sitting right behind another boat gives you a slipstream.' },
  { title: 'Watch your energy', fig: 'energy', body: 'Every stroke tires the crew, sloppy strokes more than clean ones, and the tempo calls matter: UP and SPRINT cost extra, SETTLE gives you a breather. When energy runs low the crew loses power, so clean timing is also how you last to the line.' },
  { title: 'Fire the Surge', fig: 'surge', body: 'Perfect and Great hits charge the SURGE ring around the gold button. When it is full, tap the button for five seconds of extra power. Save it for a stream, a pass, or the last stretch. Bumps and misses drain the ring.' },
  { title: 'Take the drum', fig: 'drummer', body: 'In the Drummer Challenge you sit at the drum and the crew follows YOUR taps. Keep a steady tempo inside the band the chart calls (STEADY, UP, PUSH, SPRINT), keep the gaps even, and answer a LIFT call by tapping twice quickly.' },
];

export const RULES = [
  { title: 'The race', blocks: [
    ['p', 'Four boats race side by side down a straight river course, one in each lane. Your boat is a standard dragon boat: twenty paddlers, a drummer at the bow and a steerer at the stern. You are the stroke: your taps keep the crew together and your thumb steers the boat.'],
    ['h', 'Courses'],
    ['list', ['Sprint 300 m, Heat 400 m, Classic 500 m, Long 600 m. In the regatta the heat is 400 m, the semifinal 500 m and the final 600 m.', 'The boat that is first to bring its bow over the finish line wins. Places are by finish time; a boat still racing when the race is called is ranked by how far it has left to go.', 'You start in a random lane. The buoy lines are for show: crossing one costs nothing, but another boat in your way does.']],
    ['fig', 'course', 300],
    ['h', 'Countdown'],
    ['p', 'Three drum beats count you in, then GO. The first judged beat is exactly on GO.'],
  ] },
  { title: 'The drum and the beat', blocks: [
    ['p', 'The drummer plays a beat; every beat the crew takes one stroke. Rings close on the drum pad to show you when to tap. How fast the beat is changes through the race:'],
    ['list', ['START: the first 8 beats are quick and slow down into the cruise.', 'CRUISE: the steady race tempo (between about 70 and 86 strokes a minute, quicker in later rounds).', 'UP: a push 13 percent faster, called by the drummer a few beats ahead. It comes once in races of 400 m or more and twice in races of 520 m or more (the final and the Long race). The Sprint has none.', 'SETTLE: right after an UP, 6 beats 10 percent slower. Energy recovers a little.', 'SPRINT: roughly the last 130 metres, 16 percent faster than the cruise.']],
    ['fig', 'tempo', 280],
    ['p', 'The banner under the progress bar tells you the current strokes per minute and warns you of the next change with a countdown in beats.'],
  ] },
  { title: 'Timing and hits', blocks: [
    ['p', 'A tap is matched to the nearest beat that has not been hit yet, if it is inside the widest timing zone. The zones depend on the Timing setting (Settings):'],
    ['list', ['Easy: PERFECT 85 ms, GREAT 150 ms, GOOD 220 ms, RAGGED 300 ms.', 'Normal: PERFECT 65 ms, GREAT 120 ms, GOOD 180 ms, RAGGED 250 ms.', 'Tight: PERFECT 50 ms, GREAT 90 ms, GOOD 140 ms, RAGGED 200 ms.']],
    ['p', 'A beat that passes with no tap inside its window is a MISS. A tap with no beat in range is a STRAY and costs a little sync. Each beat can be hit only once. If your device or speaker is late, the Timing offset in Settings (and the Calibrate screen) moves the zones.'],
    ['fig', 'windows', 260],
  ] },
  { title: 'Crew sync', blocks: [
    ['p', 'SYNC (0 to 100 percent) is a running average of your recent hits. After every beat it moves 15 percent of the way towards a target set by the hit:'],
    ['list', ['PERFECT: 100 percent. GREAT: 90. GOOD: 68. RAGGED: 38. MISS: 5.', 'A stray tap costs 2 percentage points. Hitting an object costs 12, a lane clash costs 6.']],
    ['p', 'Sync sets how hard each stroke pushes: power = 28 percent + 72 percent of sync. The paddlers also show it: at high sync they dip and pull as one, at low sync they are visibly out of time. You start a race at 45 percent.'],
  ] },
  { title: 'Energy', blocks: [
    ['p', 'Your crew starts each race with full energy. Every beat costs energy:'],
    ['list', ['Base cost 1.05 percent, times the tempo: START 1.2, CRUISE 1, UP 1.35, SETTLE 0.6, SPRINT 1.6.', 'Times the quality: a PERFECT costs 0.7 of the base, a MISS 1.4. Clean timing is cheaper.', 'SETTLE beats give back 0.4 percent each. While a Surge is on, strokes cost 40 percent less.']],
    ['p', 'Below 35 percent energy your power fades, down to 72 percent of full at empty. Energy never stops the crew completely.'],
  ] },
  { title: 'Surge', blocks: [
    ['p', 'The SURGE ring charges with good hits: PERFECT +9 percent, GREAT +6, GOOD +3, RAGGED 0, MISS -12. Hitting a log, mat or buoy takes 15 percent off.'],
    ['list', ['When the ring is full the gold button lights. Tap it (or press S) to start a Surge.', 'A Surge lasts 5 seconds: +28 percent power, strokes cost 40 percent less energy, and it costs 10 percent energy to fire. The ring runs down as it burns.', 'The ring does not charge while a Surge is on.']],
    ['fig', 'surge', 240],
  ] },
  { title: 'Steering and the river', blocks: [
    ['p', 'Touch the left side of the screen and drag: the farther you drag, the harder you turn (full turn at about 3 metres a second sideways). Keyboard: Left and Right or A and D.'],
    ['list', ['Steering costs a little speed, a few percent at full turn.', 'The river pushes boats sideways a little, more on the harbour and the canal, so you steer a little all the time.', 'The banks are soft walls: touching one slows you down.', 'Your boat holds its lane lines for show only; there is no lane penalty.']],
    ['fig', 'river', 280],
  ] },
  { title: 'Streams and slipstream', blocks: [
    ['h', 'Fast streams'],
    ['p', 'Bright moving streaks on the water are streams, 45 to 75 metres long and about 4.6 metres wide. While any part of your boat centre is inside one you move 1.15 metres a second faster, on top of your own speed. Rival boats use them too.'],
    ['h', 'Slipstream'],
    ['p', 'If you are directly behind another boat (within 1.5 metres sideways) and its stern is less than 20 metres ahead of your bow, you get up to 6 percent extra power; the closer, the more. The DRAFT tag shows it.'],
  ] },
  { title: 'Hazards and clashes', blocks: [
    ['h', 'Logs, lotus mats and buoys'],
    ['p', 'Drifting objects sit in the water. Touching one with your boat slows the boat to 66 percent, costs 12 points of sync and 15 percent of the Surge ring, and breaks your streak. The object is gone afterwards. Rival crews bump them too and stumble.'],
    ['h', 'Lane clashes'],
    ['p', 'If two boats overlap side by side (centres closer than 1.55 metres while they are level) the paddles clash: both boats slow to 90 percent (at most once every 0.8 seconds), you lose 6 points of sync, and the boats are pushed apart.'],
  ] },
  { title: 'The rival crews', blocks: [
    ['p', 'Rival crews are invented. Each has a race plan:'],
    ['list', ['Steady: the same pace all the way.', 'Fast start: strong in the first quarter, tires in the last third.', 'Late finish: slow to start, strong in the last quarter.', 'Streaky: its form moves up and down every few seconds.']],
    ['p', 'Rivals steer for streams and away from debris, keep out of each other, and one crew in each race may move across to block you when you come up behind. Near the line a crew that is just behind you digs deeper. Rivals ease off or push a little (up to 3 percent) depending on the gap to you, so a race stays close without a runaway.'],
  ] },
  { title: 'Regatta, medals and unlocks', blocks: [
    ['p', 'The regatta is three rivers: River Town (morning), Harbour Lanterns (evening) and the Grand Canal (night). Each has a heat, a semifinal and a final against stronger crews.'],
    ['list', ['In the heat and the semifinal, the top 2 of the 4 boats go through. If you are 3rd or 4th you stay in the round and can race it again.', 'In the final you win gold, silver or bronze for 1st, 2nd or 3rd. Fourth place can race again.', 'A medal opens the next river. Your best medal and best times are saved on the device.']],
  ] },
  { title: 'Drummer Challenge', blocks: [
    ['p', 'You take the drum. The crew paddles at the speed of YOUR taps and the steerer holds the lane. After a 4-beat count-in you play on your own.'],
    ['list', ['The chart calls sections: STEADY, UP, PUSH, SPRINT and so on, each with a band of strokes per minute shown on the gauge.', 'Each tap is scored on two things: how even the gap is compared with your last gap (55 percent) and how close your tempo is to the band (45 percent; no credit 12 or more strokes a minute outside). PERFECT 88, GREAT 70, GOOD 50 and up.', 'LIFT call: tap twice quickly (between 0.07 and 0.34 seconds apart) to give the crew one big stroke and +8 points of sync. Miss it and you lose 5.', 'If you stop for about two beats the crew falters: -12 sync and a weak stroke.']],
  ] },
  { title: 'Practice and Watch & Learn', blocks: [
    ['h', 'Learn the Beat'],
    ['p', 'A short guided race: tap on the beat, keep the crew in sync, take a stream, dodge a log and fire the Surge. It does not count against the free preview.'],
    ['h', 'Watch & Learn'],
    ['p', 'The coach crew races for you. At key moments (the start, a tempo call, debris ahead, a stream, a slipstream, a full Surge) the race stops: THINK (you choose 2, 5, 8 or 10 seconds in Settings), then REVEAL (2 seconds, the plan is highlighted) and then the coach ACTS. Pause stops everything and Resume carries on exactly where it stopped. It does not count against the free preview.'],
    ['h', 'Hints'],
    ['p', 'Tap the bulb during a race for a hint: the best line and what to do next. You get 3 hints per race.'],
  ] },
];

export const TIPS = [
  'Look at the ring, not at the water.', 'Tap, do not mash: one tap per beat.', 'A stream is free speed.', 'Save the Surge for the last stretch.', 'Clean timing is cheaper than fast tapping.',
];

// Watch & Learn moments: what the coach says when it stops to think
export const COACH = {
  start: { title: 'The start', text: 'The drum counts three beats, then GO. The first strokes come fast, then the tempo settles. The coach taps on every ring as it closes.', focus: 'pad' },
  up: { title: 'Tempo call: UP', text: 'The drummer is about to push the tempo up. The rings come closer together. Stay relaxed and tap each ring exactly as it closes: tense, early taps are the usual mistake.', focus: 'banner' },
  settle: { title: 'Tempo call: SETTLE', text: 'After a push the crew gets a breather. The beat slows a little and energy recovers. Use it to make every hit clean.', focus: 'banner' },
  sprint: { title: 'The final sprint', text: 'The last stretch: the beat is much faster. Nothing is left to save now, so the coach spends the Surge and keeps hitting the rings.', focus: 'banner' },
  flotsam: { title: 'Debris ahead', text: 'A log, mat or buoy is on the line. Hitting it would slow the boat and cost sync. The coach steers to the clear side early and gently, because hard turns cost speed.', focus: 'lane' },
  stream: { title: 'A fast stream', text: 'The bright streaks are a fast current. The coach drifts into it and stays inside: that is free speed for as long as the stream lasts.', focus: 'lane' },
  draft: { title: 'Slipstream', text: 'The coach is right behind another boat. The water it leaves is smoother and pulls you along: up to 6 percent extra power while you stay in its track.', focus: 'lane' },
  surge: { title: 'Surge ready', text: 'The ring is full. The coach waits for a good moment: a stream, a pass or the last stretch, because a Surge lasts only five seconds.', focus: 'surge' },
};

export const TUT = [
  { say: 'Tap on the right side when the ring closes on the drum. Hit 8 beats.', hint: 'Tap', done: (w) => w.stats.perfect + w.stats.great + w.stats.good + w.stats.ragged >= 8 },
  { say: 'Keep the crew together. Get 6 PERFECT or GREAT hits in a row.', hint: 'In sync', done: (w) => w.streak >= 6 },
  { say: 'Drag your left thumb to steer into the fast stream: the bright streaks.', hint: 'Steer', done: (w) => w.stats.streamT >= 1.5 },
  { say: 'A log is ahead in the lane. Steer around it before it reaches you.', hint: 'Dodge', done: (w) => w.flotsam.some((f) => !f.hit && w.boats[0].z - 6 > f.z) && w.stats.bumps === 0 },
  { say: 'The ring is full. Tap the gold SURGE button.', hint: 'Surge', done: (w) => w.stats.surges >= 1 },
  { say: 'Cross the finish line!', hint: 'Finish', done: (w) => w.boats[0].finished },
];
