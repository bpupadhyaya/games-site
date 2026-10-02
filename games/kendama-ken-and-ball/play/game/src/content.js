// Text for About, How to Play and the Rules reference. Every rule claim was checked against the engine:
// phys.js (ken, ball, string, cups, spike, assist), tricks.js (steps, holds, drops, stars, tiers, Run) and
// game.js (pop, flip, Watch & Learn). A section is { title, art?, p: [paragraphs] }; the reader paginates the lines so
// nothing overflows, whatever the text size.

export const ABOUT = [
  { title: 'The ken and ball', art: 'parts', p: [
    'The ken and ball is a Japanese skill toy: a wooden ken, a heavy ball with a hole in it, and a string joining the two. The ken has a spike on top, a big cup and a small cup on a crossbar, and a base cup at the foot of the handle.',
    'You swing, pop and catch the ball: in a cup, or with the hole on the spike.',
  ] },
  { title: 'Where it comes from', p: [
    'Cup-and-ball toys are old and turn up in many parts of the world. The form with a spike and three cups spread widely in Japan during the twentieth century, and today people share tricks and hold friendly contests with it.',
  ] },
  { title: 'Why it is hard and calm', p: [
    'The whole skill is timing and touch: a small pull on the string, a hand that gives way as the ball lands, a ball that has to arrive gently. Nothing here is about speed of tapping. Slow down and the ball slows down with you.',
  ] },
  { title: 'This version', p: [
    'Ken and Ball simulates the string, the ball, the cups and the spike for real. The ball is a weight on the end of a taut or slack string, the cups hold it by their rims, and the spike takes it only when the hole is facing the spike.',
    'Climb the Trick Ladder, push your luck in a Combo Run, practise freely, or watch the game play a trick by itself and see how it chooses its moves.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'parts', p: [
    'Catch the ball. The goal card at the top says what to land: for example the big cup, or the big cup and then the spike. The ball has to stay put for half a second.',
  ] },
  { title: 'Move the ken', art: 'drag', p: [
    'Press anywhere in the play area and drag. The ken follows your finger like a hand: it moves a little behind you, and the cups lean when you speed up or slow down.',
    'Lift your finger and the ken stays where it is. Touch again and carry on from there; the ken never jumps.',
  ] },
  { title: 'Pop the ball', art: 'pop', p: [
    'When the ball hangs from the ken, a quick pull upward yanks it through the string. Stop the ken and the ball flies on, up past the ken, and then falls.',
    'The Pop button does a clean pull for you: hold it to charge and let go. A bigger charge sends the ball higher.',
  ] },
  { title: 'Catch it', art: 'catch', p: [
    'Slide the ken so a cup is right under the ball and move down with it as it lands. A ball that arrives gently settles between the rims. A ball that arrives hard bounces out.',
    'When the goal glows on the ken, that is where it should land.',
  ] },
  { title: 'The spike', art: 'spike', p: [
    'The hole in the ball always turns toward the string. To spike the ball, put the tip right under it as it falls so the tip goes into the hole.',
    'A ball that is turned the wrong way, or too far to the side, bounces off the spike.',
  ] },
  { title: 'Flip the ken', art: 'flip', p: [
    'Press Flip to turn the ken over. Now the base cup faces up and the ball hangs from the other end. Press it again to turn back.',
  ] },
  { title: 'Drops and stars', art: 'drops', p: [
    'When the ball goes back to hanging still, that is a drop and you start the trick again. A trick with two drops or fewer earns three stars, six or fewer two stars, and any finish one star.',
    'Stars open new rows of tricks on the ladder.',
  ] },
  { title: 'Combo Run', art: 'run', p: [
    'Three catches are offered. Land any of them for points; each catch in a row raises your multiplier. Bank to keep your points safe. A drop costs a heart and loses the points you have not banked. With five hearts gone the run ends.',
  ] },
  { title: 'Think and Watch & Learn', p: [
    'Think shows a plan for the catch you need: the arc the ball can take and where to bring the ken. It only works once the ball has settled.',
    'Watch & Learn plays whole tricks by itself. It thinks, shows its plan, and then performs it. Pause freezes everything, and you can make it think for longer or shorter.',
  ] },
  { title: 'Steady hands', p: [
    'In Settings you can switch on Steady hands: the spike takes the ball from a little farther off, and a ball falling over a cup is nudged gently toward its middle.',
  ] },
  { title: 'Keyboard', p: [
    'Arrow keys move the ken. Hold Space to charge a pop and let go. F flips the ken, H thinks, B banks in a run, and P or Escape pauses.',
  ] },
];

export const RULES = [
  { title: 'The toy', art: 'parts', p: [
    'The ken is held by the hand. Its spike points up. A crossbar carries the big cup on one side and the small cup on the other, and the base cup sits at the foot of the handle. The ball hangs from the ken on a string and has a hole in it.',
    'The scene is a side view. Gravity pulls the ball down; the string is a little under four ball-widths long and cannot stretch.',
  ] },
  { title: 'Your hand', art: 'drag', p: [
    'Press in the play area and drag to move the ken. The ken moves relative to your finger, follows with a little lag and has a top speed. It stays inside a box on the screen: about three quarters of the width and the middle of the height.',
    'The cups lean with the ken\'s acceleration, up to about sixteen degrees: speeding up tips the top backward, slowing down tips it forward.',
  ] },
  { title: 'The string', p: [
    'The string joins the ken, just under the spike, to the ball. It cannot stretch. While the ball is closer than the string length it hangs slack and the ball flies freely.',
    'When the ball reaches the end of the string, the string pulls it along: if the ken is moving, the ball is yanked. This is what pops the ball when you pull the ken up and stop it.',
  ] },
  { title: 'Pop', art: 'pop', p: [
    'The Pop button charges while you hold it, from 0 to 100 percent in about seven tenths of a second. On release, the hand pulls straight up for a tenth of a second at a speed that grows with the charge, and stops.',
    'With the keyboard, Left or Right held at the moment of release angles the pull.',
  ] },
  { title: 'Flip', art: 'flip', p: [
    'Flip turns the ken a half turn in about a third of a second. After a flip the spike points down, the cups face down and the base cup faces up. A ball resting on the ken when you flip it falls off.',
  ] },
  { title: 'Rims, walls, ceiling', art: 'catch', p: [
    'A cup holds the ball by its two rims. The ball rests on both rims at once, in the dish between them. A ball that is moving gently settles; a ball moving hard bounces, losing most of its speed.',
    'The ball goes through the ken if it comes up from below, as if it were swung in front of it. It collides with the cups, rims and spike when it comes down onto them.',
    'The side walls and the ceiling are soft: the ball bounces off them with little energy.',
  ] },
  { title: 'The hole', art: 'spike', p: [
    'The hole always turns toward the string, quickly but not instantly. A ball that is falling toward the spike has its hole facing down toward the ken.',
  ] },
  { title: 'Spiking the ball', art: 'spike', p: [
    'The spike takes the ball when the ball touches the spike tip, the hole is facing the spike within about thirty-eight degrees, and the tip is inside the hole. The ball then slides down onto the spike and is carried with the ken.',
    'Otherwise the spike is just a post: the ball bounces off it.',
  ] },
  { title: 'Losing the spike', p: [
    'A ball on the spike stays until the ken is yanked hard along the spike, harder than about one and a half times gravity, until the ken is shaken sideways harder than about two and a quarter times gravity, or until the ken is tipped past level.',
  ] },
  { title: 'A catch', p: [
    'A catch counts when the ball has been resting still in a cup (on both rims) or on the spike for 0.55 seconds. A ball that is rolling or bouncing does not count.',
    'A step of a trick that asks for the same place as the one before needs the ball to leave and come back.',
  ] },
  { title: 'Trick steps', p: [
    'A trick is a list of steps done in order in one try. Catch steps name the cup or the spike.',
    'Lift: the ball must rise clearly above the ken and come back down. Whirl: the ball swings a full turn around the ken with the string tight; if the string goes slack for half a second the turn starts over.',
    'Hold: keep the ball in the named place for the time shown while the hand travels at least the distance shown. Lift then cup: the ball must have risen above the ken before the catch.',
  ] },
  { title: 'Tries and drops', art: 'drops', p: [
    'A try begins when the ball starts to move. It ends in a drop when the ball hangs still again for a second and a bit, when it lies on the ken for two seconds without being in a catch, or when forty seconds pass. A drop sends the trick back to its first step.',
  ] },
  { title: 'Stars', p: [
    'A finished trick earns three stars with two drops or fewer, two stars with six drops or fewer, and one star otherwise. The best result for each trick is kept.',
  ] },
  { title: 'The Trick Ladder', art: 'ladder', p: [
    'There are twenty tricks in six rows. Row one is open. The next rows open when your stars add up to 5, 12, 20, 29 and 38.',
    'Row one: Big Cup, Small Cup, Spike, Base Cup. Row two: Triple Lift, Round the World, Lift to Big Cup, Carry the Small Cup. Row three: pairs of catches. Row four: the base cup and a three-catch row. Row five: a spike walk, a double whirl and a four-catch rhythm. Row six: the full lap and a whirl to the spike.',
  ] },
  { title: 'Combo Run', art: 'run', p: [
    'Three different catches are offered at a time: big cup 10 points, small cup 16, spike 22, base cup 30. One of them has a double bonus. Land any offered catch and its points are added to your unbanked pile, and new offers appear.',
    'Each catch in a row raises the multiplier by a half, from one up to five. A catch that was not offered scores nothing.',
  ] },
  { title: 'Banking and hearts', art: 'run', p: [
    'Bank moves your unbanked points into the bank and resets the multiplier. A drop costs one of five hearts and loses your unbanked points and your multiplier. With the fifth heart gone the run ends and your banked total is your score.',
    'Leaving a run from the pause menu banks what you have first.',
  ] },
  { title: 'Free practice', p: [
    'Practice has no goal: choose the cup or spike you want to work on by tapping the chip, and the game counts catches, your streak and your best streak. A drop ends the streak.',
  ] },
  { title: 'Think', p: [
    'Think looks for a pop that would land the ball where you need it, by trying many in a quick simulation, and shows the best arc with the target lit. It works once the ball hangs or rests still. A new pop or a flip clears it.',
  ] },
  { title: 'Watch & Learn', p: [
    'The game performs a trick on its own. It THINKS (2, 5, 8 or 10 seconds, as set), REVEALS its plan for two seconds with the arc and the target lit, and then ACTS the plan with the same ken, string and ball you play with.',
    'Pause freezes all of it and resumes exactly where it stopped. It uses the same rules, so what you see is something you can do.',
  ] },
  { title: 'Steady hands', p: [
    'Off: the spike takes the ball only if the tip is within about ten units of the middle of the hole. Light: fifteen, and a falling ball over a cup is nudged gently toward its middle. Strong: twenty, with a stronger nudge.',
  ] },
  { title: 'Simplifications', p: [
    'A real ken and ball has depth and spin; this one is a flat side view, and a ball swung up from below always passes through the ken. The ball and cups are a little more forgiving than wood, so the toy is playable with one finger.',
  ] },
];
