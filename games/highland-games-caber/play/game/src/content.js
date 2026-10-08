// All reader text: About, How to Play and the exhaustive Rules. Every number here is the number the simulation uses (see physics.js, sim.js, consts.js).
export const ABOUT = [
  { title: 'Highland Games: Caber Toss', p: [
    'A small Highland Games festival in a 3D glen. The caber toss is the star: lift a tall pole, run, heave it so it turns end over end, and have it land pointing straight away from you, at 12 o\'clock.',
    'Two more events round out the day: the stone put and the weight over the bar. Your best mark in each event counts, and five other competitors are on the scoreboard.'] },
  { title: 'About the games', art: 'clock', p: [
    'Highland Games are athletic gatherings that grew up in the Scottish Highlands and are now held around the world. The heavy events (caber, stone, weight) are among the oldest parts of the programme.',
    'The caber is a tapered tree trunk, usually between 16 and 20 feet long. Judges do not measure distance: they stand where they can read the pole like a clock face, with the thrower at the centre, and call how close to 12 o\'clock it lies.'] },
  { title: 'How it is made', p: [
    'The glen, the athlete and the physics are all simulated: the caber is a long, uneven rigid pole with real weight and balance, so its turn, its landing and its fall are worked out, not scripted. The slow-motion replay shows exactly what happened.',
    'Everything is free of clan crests, brand marks and logos. Names on the scoreboard are plain first names.'] },
];

export const HOWTO = [
  { title: 'The festival', p: [
    'Play the whole festival (caber, stone, weight) or pick a single event to practise. Choose a competition level: Village green is forgiving, County games is the real thing, Games champion is tight.',
    'Your best mark in each event counts. At the end your total is ranked against five other competitors for Gold, Silver or Bronze.'] },
  { title: 'Controls', art: 'pad', p: [
    'Two thumbs. The BALANCE pad (bottom left) is for steering: drag. The big round button (bottom right) is for tapping and holding.',
    'Keyboard: arrow keys or WASD steer, Space is the button, P pauses, T opens Think.'] },
  { title: 'Caber toss', art: 'zone', p: [
    '1. Choose a caber for this throw. Lighter ones are easier; the Championship caber scores most.',
    '2. LIFT: the pole stands in your hands and wants to fall. Drag toward the yellow dot to get your hands under it. Hold it inside the green ring until the bar fills.',
    '3. RUN: six strides. Tap STRIDE as each ring closes on the button. Keep steering the lean while you run. A faster run gives more power.',
    '4. HEAVE: a cursor sweeps across a bar. Tap HEAVE while it is in the green. Too early and the pole falls back; too late and it spins past upright.',
    '5. Watch it turn. The judges read the clock and the line, then you can see a slow-motion replay.'] },
  { title: 'Stone put', p: [
    'Choose the stone. Tap LOCK to stop the angle gauge (about 41 degrees is best). Then press and hold to wind up and let go close to full power. Hold too long and you step over the board: a foul.'] },
  { title: 'Weight over the bar', p: [
    'Choose the bar height. The weight whirls in a circle. Tap SPIN as it passes its lowest point to speed it up; the gauge shows the speed the bar needs. Then, as it climbs behind you in slow motion, tap to let go. It must pass over the bar.'] },
  { title: 'Think and Watch & Learn', art: 'think', p: [
    'Think shows a hint for what to do right now. Watch & Learn plays a whole festival by itself, one step at a time: it thinks, shows its choice, then does it. You can pause it, and make the thinking time shorter or longer.'] },
];

export const RULES = [
  { title: 'The festival', p: [
    'Three events in this order: Caber Toss, Stone Put, Weight Over the Bar. Practice mode plays just one.',
    'Each event is scored from 0 to 100 using your best attempt. The festival total is the sum of the three (up to 300).',
    'The five rivals each have a fixed mark per event for the day. Your rank is your total against theirs: first is Gold, second Silver, third Bronze.',
    'Competition levels change the difficulty: Village green has the gentlest balance, the longest sweep and the widest timing windows, and shows the green zones. County games is standard. Games champion has a lively caber, a quick sweep, the narrowest windows and shows only a thin marker where the best moment is.'] },
  { title: 'Caber toss: the three cabers', art: 'caber', p: [
    'Glen caber: 17 ft (5.2 m), 52 kg. Scores 72 percent of the throw quality.',
    'Braemar caber: 19 ft 6 in (5.9 m), 79 kg. Scores 100 percent.',
    'Championship caber: 21 ft (6.4 m), 92 kg. Scores 128 percent, capped at 100 points.',
    'You have three throws, one caber chosen for each. The best of the three is your event mark.'] },
  { title: 'Caber toss: the lift', p: [
    'The pole stands on its small end in your cupped hands. It leans forward, back, left and right and keeps toppling: steer the pad toward the lean to get your hands under it.',
    'It counts as steady while the lean stays inside the green ring. The bar fills while steady and drains at 60 percent speed when not. Fill it (1.6 seconds of steadiness) to be ready.',
    'If the lean goes past about 45 degrees you drop it and lift again. A third drop at the lift, is a no-throw. About 26 seconds without getting steady also counts as a drop.'] },
  { title: 'Caber toss: the run-up', p: [
    'Six strides. A ring closes on the STRIDE button for each beat. Tap close to the beat: within the first narrow window is a perfect stride, then good, then fair, then a late scramble. The beat comes every 0.5 s (Village green), 0.46 s (County) or 0.42 s (Champion).',
    'A perfect stride adds 1.15 m/s of pace, good 0.85, fair 0.5, scrambled 0.25. A missed beat costs 0.8 m/s. Top pace is 6.9 m/s.',
    'Each stride also jolts the pole, harder at speed. Dropping it in the run is a no-throw.'] },
  { title: 'Caber toss: the heave', art: 'zone', p: [
    'After the sixth stride you plant. A cursor sweeps the bar from left to right in 1.35 s (Village), 1.1 s (County) or 0.9 s (Champion), adjusted slightly for the caber. Tap HEAVE to let go.',
    'The green zone is worked out from the real physics for your pace and lean: the part of the sweep in which the pole will turn. A faster run moves the zone earlier. The middle of the green gives the cleanest, straightest throw. If you do not tap, the pole is thrown at the end of the sweep.',
    'Early and the pole comes down on its small end or falls back. Late and it spins past upright and lands on its small end.'] },
  { title: 'Caber toss: judging', art: 'clock', p: [
    'A TURN means the heavy end lands first and the pole then falls away from you. A turn is worth 40 points.',
    'CLOCK: the thrower stands at the centre of a clock face and 12 o\'clock is straight ahead. Up to 3 degrees off is full marks (39 points). The score falls steadily to nothing at 60 degrees. Every 30 degrees is one hour, so 15 degrees left reads 11:30.',
    'LINE: how far to the left or right of the centre line the heavy end landed. Up to 21 points, falling to nothing at about 2.4 m.',
    'Steady hands decide the direction: the lean at the moment of the heave sends the pole to that side. A heave away from the middle of the green adds a twist.',
    'No turn, or a fall back toward you, scores 0.'] },
  { title: 'Stone put', art: 'stone', p: [
    'Braemar-style open put: the stone is thrown from a standing start behind the board (the trig), with no spin or glide. Two stones: the Braemar stone (26 lb, 11.8 kg) and the light stone (16 lb, 7.3 kg).',
    'ANGLE: a gauge swings from 26 to 56 degrees. Tap LOCK to stop it. Around 41 degrees travels furthest.',
    'POWER: press and hold to wind up. Power fills in 1.2 s. Release at full for the longest put. Holding longer than 1.55 s is a foul: no mark.',
    'The distance is measured from the board. Braemar stone: points = (distance minus 2.5 m) divided by 8 m, times 100. Light stone: (distance minus 2.5 m) divided by 9.5 m, times 80. Three throws; the best counts.'] },
  { title: 'Weight over the bar', art: 'weight', p: [
    'A 56 lb (25.4 kg) weight on a chain is whirled in a vertical circle and thrown up and back over a bar. Bar heights: 3.6, 3.9, 4.2, 4.5, 4.8, 5.1, 5.4 and 5.7 m.',
    'You choose the opening height. After each clear the bar goes up by one step. Five tries in all.',
    'SPIN: the weight starts at 7.9 m/s at its lowest point. Tap as it passes the lowest point to add speed: up to 0.9 m/s for a perfect tap, 0.6 good, 0.3 fair. The top speed is 12.6 m/s. The gauge shows the speed the current bar needs.',
    'RELEASE: as the weight climbs behind you, time slows. Tap during this arc to let go. Easy levels nudge your release toward the best angle.',
    'It clears if it passes the bar plane, 2.4 m behind you, at least 10 cm above the bar. Score: (highest cleared height minus 3.3 m) divided by 2.4 m, times 100. 3.9 m scores 25, 5.7 m scores 100.',
    'No tap in about 30 seconds ends the try.'] },
  { title: 'Replay, pause, Think', p: [
    'After every attempt you can watch a slow-motion replay at quarter speed. Pause stops everything. Think shows a hint without changing anything.',
    'Watch & Learn plays the festival with the computer: THINK (2 to 10 seconds, you choose), REVEAL (2 seconds, showing the choice), then ACT. Pause freezes the whole loop, including the motion.'] },
  { title: 'Free preview', p: [
    'The first 90 seconds of real play are free. Menus, Rules, About, Watch & Learn and paused time never count. After that, one unlock opens the whole festival.'] },
];
