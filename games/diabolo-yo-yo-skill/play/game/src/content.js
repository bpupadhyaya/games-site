// Text for About, How to Play and the Rules reference. Every rule claim was checked against the engine:
// phys.js (hand, yo-yo, diabolo, spin, string, floor), tricks.js (judge, rows, stars, Show, Daily), ai.js (Watch & Learn, Think, ghost)
// and game.js (controls, camera, pause). A section is { title, art?, p: [paragraphs] }; the reader scrolls, so nothing overflows.

export const ABOUT = [
  { title: 'Two string toys', art: 'both', p: [
    'Spin and String is a small workshop with two classic skill toys: the yo-yo and the diabolo.',
    'The yo-yo is a spinning disc on a string that you throw down and call back to your hand. It is loved all over the world and has a famous home in the Philippines, where its modern tricks were popularised.',
    'The diabolo (in China, the kongzhu, or "empty bamboo") is a spinning hourglass that rides on a string between two sticks. It is thrown up, caught again, swung and whipped round, and it has been part of Chinese street and festival life for centuries.',
  ] },
  { title: 'The skill', p: [
    'Both toys are about touch, not speed of tapping. The spin carries the toy; your hand only shapes where it goes. A yo-yo with little spin cannot climb back. A diabolo with little spin wobbles and cannot be caught.',
    'There are no hidden numbers to chase: watch the spin bar, keep your hand calm and let the toy do the work.',
  ] },
  { title: 'This version', p: [
    'Everything you see comes from a real physics model: the string, the spin, gravity, the floor and the way a spinning toy keeps its axle steady. The tricks are named when the physics sees them happen, not when a button is pressed.',
    'Climb the Trick Book (14 tricks, 7 for each toy), chain tricks in a timed Show, take the Daily Challenge, practise freely, or watch the game think up a trick, show its plan as a ghost, and then perform it.',
  ] },
  { title: 'Credits', p: ['Original art, sound and code. Generic toys with no brand marks. The 3D scene uses the shared three.js renderer (MIT licence).'] },
];

export const HOWTO = [
  { title: 'The idea', art: 'both', p: [
    'Choose a toy on the menu: Yo-yo or Diabolo. Then try the Trick Book, a Show, the Daily Challenge or Free Play. The goal card tells you what to land.',
  ] },
  { title: 'Moving your hand', art: 'flick', p: [
    'Press anywhere in the play area and drag. The hand follows your finger like a real hand, a little behind it. Lift your finger and the hand eases back to its rest place, so the toy settles.',
    'How fast you move matters as much as where. A quick flick is a throw, a yank or a toss. A slow, steady drag is a walk or a swing.',
  ] },
  { title: 'Yo-yo: throw and return', art: 'yoyo', p: [
    'Flick down to throw. The faster the throw, the more spin the yo-yo gets. At the end of the string it sleeps: it spins in place. Keep your finger still.',
    'Flick up (or tap Return) to bring it back. It needs spin to climb, so do not wait too long: when the spin bar falls to the white mark, the yo-yo is too slow to come home.',
  ] },
  { title: 'Yo-yo: the floor', art: 'walk', p: [
    'Hold your finger low after the throw and the yo-yo lands on the floor and rolls. Slide your finger to the right, slowly and steadily, and it walks along. Floor contact wears the spin down quickly. Flick up to bring it home.',
  ] },
  { title: 'Yo-yo: swings and circles', art: 'loop', p: [
    'Flick forward, to the side, hard, and the string whips the yo-yo out to its full length. A medium flick swings it wide (Breakaway). A hard forward flick, a little upward, whips it round a full circle over your hand (Around the World).',
  ] },
  { title: 'Diabolo: spin it up', art: 'diabolo', p: [
    'The diabolo sits on the string between two sticks. Shake your finger left and right and the string slides over its waist and spins it. Watch the spin bar fill. The spin slowly wears off, so keep shaking to keep it high.',
    'Moving your hand left and right also swings the diabolo along the string like a pendulum.',
  ] },
  { title: 'Diabolo: toss and catch', art: 'toss', p: [
    'Spin it up first, then flick up (or tap Toss). The sticks pull apart, the string snaps tight, and the diabolo flies. While it is in the air, slide your hand under it and let it land on the string.',
    'A quick flick throws it higher. A spinning diabolo flies true. A slow one wobbles in the air, and a wobbling diabolo cannot be caught.',
  ] },
  { title: 'Modes', art: 'gauge', p: [
    'Trick Book: each trick has a goal. Fewer drops earn more stars, and stars open new rows.',
    'Show: 150 seconds and three lives. Each trick scores, and tricks in a row raise a multiplier. A drop breaks the chain.',
    'Daily Challenge: today there are three goals, the same for everybody. Beat them with as few drops as you can.',
    'Free Play: no goal. Try anything.',
  ] },
  { title: 'Learn, Think and Watch & Learn', p: [
    'The first time you open a trick, the game thinks for a moment and shows a ghost: a see-through toy and hand that perform the trick. Tap to try it yourself.',
    'Think shows the ghost again whenever the toy is at rest. Watch & Learn plays whole tricks by itself: it thinks, shows its plan, then performs it. Pause freezes everything, and you can make it think for longer or shorter.',
  ] },
  { title: 'Steady hands', p: ['In Settings you can switch on Steady hands: the sleeper counts a little more movement, and the diabolo forgives a little more wobble when you catch it.'] },
  { title: 'Keyboard', p: ['Arrow keys move the hand, Space is Return or Toss, H is Think, P or Escape is pause. In menus, plus and minus change the text size.'] },
];

export const RULES = [
  { title: 'Overview', art: 'both', p: [
    'Spin and String has two toys, 14 tricks and four ways to play. This page explains every rule the game uses. Text size can be changed with A- and A+ (100% to 300%).',
    'Units: lengths are in metres and times in seconds. The spin bar shows how fast the toy is spinning; its full length is the fastest spin the toy can reach.',
  ] },
  { title: 'The hand', art: 'flick', p: [
    'The hand follows your finger with a short delay (a few hundredths of a second) and stays inside a box: about one metre either side of centre and about half a metre down and just under a metre up.',
    'When you lift your finger the hand moves back to the centre at about one metre per second, gently enough that it never counts as a flick. Holding an arrow key moves the hand at about one and a half metres per second.',
    'A flick means the hand is moving fast: more than about 2.3 metres per second for a yo-yo throw, more than about 2.1 metres per second upward for a yank, and more than about 1.3 metres per second upward to start pulling the diabolo sticks apart.',
  ] },
  { title: 'Yo-yo: the throw', art: 'yoyo', p: [
    'The yo-yo hangs in your hand until you flick. A throw needs a hand speed of more than 2.3 metres per second in any direction except mostly upward. After landing in your hand it cannot be thrown again for about half a second.',
    'Once thrown, the yo-yo flies under gravity. The string is 1.1 metres long. The string pays out as the yo-yo moves away, and its speed away from your hand becomes spin: the faster it leaves, the more spin it gets, up to the top of the bar.',
    'When the string is fully out, the yo-yo stops moving away and hangs from your hand. If the hand moves, it swings like a pendulum, and a little energy is lost to the air as it swings.',
  ] },
  { title: 'Yo-yo: spin and return', art: 'gauge', p: [
    'Spin wears away all the time, a little faster when the spin is high. When the yo-yo is hanging at full string and the spin falls below about 7% of the bar (the lowest point of the bar), it goes dead and the attempt counts as a drop.',
    'To return: flick the hand up (faster than about 2.1 metres per second), or tap Return, once more than half the string is out and about a tenth of a second after the throw. If the spin is at or above the white mark on the bar (about 17%), the string binds and the yo-yo climbs home. The higher the spin, the faster it climbs, but climbing also uses up spin.',
    'If you flick up with too little spin and the string is taut, the yo-yo is dead: a drop. If the string is not yet fully out, the flick does nothing.',
  ] },
  { title: 'Yo-yo: floor and walking', art: 'walk', p: [
    'The floor is 1.3 metres below the rest position of your hand. If the string lets the yo-yo reach it, the yo-yo lands and rolls. If your hand is lifted so that the string is straight up and down, the string lifts the yo-yo off the floor again.',
    'On the floor the yo-yo rolls in one direction, toward the right, and the string holds it at its full length from your hand. Moving your hand right walks the yo-yo along. Moving left drags it against its spin and uses the spin up very quickly.',
    'Rolling on the floor uses spin about twice as fast as hanging, and dragging the yo-yo to the left uses it far faster still. A walk is counted when the yo-yo has rolled forward faster than a quarter of a metre per second, and the distance adds up.',
  ] },
  { title: 'Yo-yo: forward throws', art: 'loop', p: [
    'When a throw ends with the string pulling the yo-yo out mostly sideways (the effect starts at 40% sideways and is full at about 75%), part of its outward speed turns into swing along the string, always over the top. A medium flick swings the yo-yo wide. A hard flick gives it enough speed to go over the top.',
    'This is a game rule, not real physics: it lets a forward flick make a full circle without perfect timing. A downward throw never swings.',
  ] },
  { title: 'Yo-yo: how tricks are judged', art: 'yoyo', p: [
    'Every yo-yo trick is judged when the yo-yo gets back to your hand. Down and Up: any throw that comes back. Sleeper: hanging still at full string for 2.5 seconds. Long Sleeper: 6 seconds. With Steady hands on (Light or Strong), 0.3 seconds less is needed.',
    '"Hanging still" means the string is taut, the yo-yo is low (more than about four fifths of a string length below your hand) and it moves less than 1.25 metres per second compared with your hand (1.5 with Steady hands). A break of more than 0.4 seconds restarts the count.',
    'Walk the Dog: rolled at least 0.9 metres on the floor. Breakaway: at full string it swung out to the side at least 90% of the string length, near the height of your hand, without a full circle and without touching the floor. Around the World: a full circle (96% of 360 degrees) around your hand with the string taut and the yo-yo moving faster than 1.2 metres per second. Double World: two circles.',
  ] },
  { title: 'Diabolo: the string', art: 'diabolo', p: [
    'The diabolo is a bead on a string between two sticks. The string is 1.8 metres long and the sticks start 0.9 metres apart, so the string hangs in a deep V. The diabolo can be on the string, or in the air above it, but never beyond the stretch of the string.',
    'Pulling the sticks apart flattens the V and lifts the diabolo. When the diabolo falls onto the string again it stops there, with a very small bounce. If it lands outside the span between the sticks, or swings out past one stick, it slips off and counts as a drop. Hitting the floor is a drop.',
  ] },
  { title: 'Diabolo: spin', art: 'gauge', p: [
    'Spin is built by the string sliding over the diabolo. The faster the string slides (up to 3.5 metres per second), the faster the spin grows, and it grows more slowly as it nears the top of the bar. Shaking your hand left and right makes the string slide.',
    'Spin wears away slowly (more when it is high). It never goes below zero.',
    'The white mark on the bar is the level at which the axle is steady enough to catch easily: about 42% of the bar.',
  ] },
  { title: 'Diabolo: toss and catch', art: 'toss', p: [
    'A flick upward faster than 1.3 metres per second spreads the sticks, up to 1.6 metres apart at 4.7 metres per second. The string snaps tight and the diabolo is thrown. A toss counts only if the diabolo stays in the air for more than 0.2 seconds: smaller hops are ignored.',
    'In the air the axle wobbles. The wobble starts at a random size (a faster sideways toss makes it bigger) and shrinks as the spin goes up: a diabolo spinning at the white mark wobbles at the starting size, one spinning twice as fast about half as much, and a very slow one up to 1.8 times as much.',
    'On landing, if the wobble is more than 0.4 radians (about 23 degrees) the catch fails and it is a drop. With Steady hands the limit is 0.52 radians. A good catch must also land between the sticks.',
  ] },
  { title: 'Diabolo: how tricks are judged', art: 'toss', p: [
    'Spin Up: spin at or above 150 (about 42% of the bar) for 2 seconds while on the string. Long Spin: at or above 230 (about 64%) for 1.5 seconds. Pendulum: the diabolo crosses the centre line between more than 12 centimetres either side four times, each crossing within 2.2 seconds of the last.',
    'Toss and Catch: a caught toss that rose at least 0.8 metres above your hands. Side Toss: a caught toss that rose at least 0.6 metres and landed at least 0.8 metres sideways. High Toss: rose at least 2 metres. Triple Catch: three caught tosses in a row, each at least 0.6 metres high, with no drop between them.',
  ] },
  { title: 'Trick Book, stars and rows', art: 'ladder', p: [
    'Each toy has seven tricks in four rows. A trick is done when the physics sees its goal happen. Drops while you try it are counted: one drop or fewer earns three stars, up to four drops two stars, anything else one star.',
    'Row 1 is open. Row 2 opens at 2 stars on that toy, row 3 at 6 stars and row 4 at 11 stars. The best result for each trick is kept.',
  ] },
  { title: 'Show', art: 'gauge', p: [
    'A Show lasts 150 seconds and you have three lives. Each trick scores its base points times a multiplier. The multiplier is one plus a quarter for each trick in your chain, up to three.',
    'Doing the same trick twice in a row scores half. Every trick also adds style points, up to 30, for how much spin the toy has when it is landed. A drop ends the chain and costs a life. The Show ends when the time or the lives run out.',
    'Base points: Yo-yo: Down and Up 40, Sleeper 90, Breakaway 110, Walk the Dog 120, Long Sleeper 170, Around the World 200, Double World 320. Diabolo: Spin Up 50, Pendulum 80, Toss and Catch 110, Long Spin 140, Side Toss 150, High Toss 220, Triple Catch 300.',
  ] },
  { title: 'Daily Challenge', art: 'ladder', p: [
    'Every day has a toy and three trick goals picked from the first three rows, the same for everyone on the same day. You score as in a Show, with four drops allowed. Finish all three goals to win: a bonus of 200 points minus 40 for each drop is added.',
    'The best score of the day is kept. Winning two days in a row grows your streak.',
  ] },
  { title: 'Learn, Think, Watch & Learn', art: 'flick', p: [
    'The first time you open a trick, and whenever you tap Think while the toy is at rest, the game searches hand motions by simulating the real physics many times. It then shows the best one as a ghost: a see-through toy, hand and path.',
    'Watch & Learn thinks for 2, 5, 8 or 10 seconds (your choice), reveals the plan for 2 seconds, and performs it with the same physics. If the plan fails it thinks again. Pause freezes the planner, the hand, the physics and every timer.',
    'Watch & Learn, the ghost and the menus never count against the free preview.',
  ] },
  { title: 'Settings and the free preview', p: [
    'Sound can be switched off. Steady hands has three levels. Text size goes up to 300%. Thinking time sets Watch & Learn. The free preview lasts 90 seconds of real play; menus, the ghost and Watch & Learn are free. One purchase unlocks everything and can be restored.',
  ] },
];

// main.js hands over the 3D library credits (vendor3d/LICENSES.md) so the About page shows them in the same zoomable reader.
export function setLicenses(text) {
  if (!text || ABOUT.some((s) => s.title === 'Licences')) return;
  const paras = String(text).split(/\n{2,}/).map((p) => p.replace(/^#+\s*/gm, '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 12);
  ABOUT.push({ title: 'Licences', p: paras });
}
