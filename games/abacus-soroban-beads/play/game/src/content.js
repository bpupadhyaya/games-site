// Text for the About, How to Play and Rules screens. Every rule here is checked against soroban.js / lessons.js / game.js
// (see design/GDD.md "Rules reference"). Blocks: { h } heading, { p } paragraph, { li: [...] } bullets.
// A page's `fig` draws a real (static) abacus with the game's own bead art: { rods, value, hl? }.
export const ABOUT = {
  title: 'About',
  pages: [
    {
      title: 'Abacus Soroban',
      fig: { rods: 4, value: 2026 },
      body: [
        { p: 'The soroban is the Japanese bead abacus: one heaven bead worth 5 above the beam and four earth beads worth 1 below it on every rod. Skilled users add, subtract and multiply faster than they can type, and many can do it in their heads by picturing the beads.' },
        { p: 'Here you slide the beads yourself with your thumb. Learn to read numbers, then add, subtract and multiply, with a coach that moves the beads and explains why. Test the skill with Flash Mental and a 60-second Timed Challenge.' },
        { li: ['13 short lessons from "Meet the beads" to multiplying.', 'Flash Mental: numbers flash by, you set the total.', 'Timed Challenge: five levels of fast sums.', 'Watch and Learn: the beads move by themselves while the reason is spelled out.', 'Sounds are synthesized on your device. No ads.'] },
      ],
    },
    {
      title: 'Free preview and credits',
      body: [
        { p: 'You can play for a free preview first. Unlocking the full game is a single one-time purchase; there are no ads and no subscriptions. Menus, Rules, About, Watch and Learn and Pause do not use up the preview.' },
        { p: 'Numerals and interface text are set in Fredoka, used under the SIL Open Font License 1.1.' },
        { p: 'Abacus Soroban is part of Arcforge, a collection of world heritage games.' },
      ],
    },
  ],
};

export const HOWTO = {
  title: 'How to Play',
  pages: [
    {
      title: 'Read the beads',
      fig: { rods: 3, value: 376, hl: 0 },
      body: [
        { p: 'Each rod is one digit. The rod on the right is the ones, then tens, then hundreds. A bead counts only when it touches the middle beam.' },
        { li: ['Heaven bead (top) touching the beam: 5.', 'Each earth bead (bottom) touching the beam: 1.', 'Add the beads that touch the beam on a rod to get its digit, 0 to 9.'] },
        { p: 'The picture shows 376: the ones rod has the heaven bead and 1 earth bead (6), the tens rod has the heaven bead and 2 earth beads (7), the hundreds rod has 3 earth beads (3).' },
      ],
    },
    {
      title: 'Slide the beads',
      fig: { rods: 3, value: 24 },
      body: [
        { p: 'Press a bead and slide it toward the beam, or just tap it. Earth beads: pushing one up also lifts the beads between it and the beam; sliding one away drops it and the beads below it. The heaven bead flips between away and touching.' },
        { p: 'Use one thumb. The whole rod column is the target, so you do not have to hit a bead exactly. On a keyboard: Left and Right choose a rod, Up and Down move the beads, 0 to 9 set a digit.' },
      ],
    },
    {
      title: 'Lessons',
      body: [
        { p: 'Lessons teaches in order: reading, adding, taking away, then multiplying. Each lesson is five exercises. The card on the screen says what to show or do; when the abacus shows the right total the exercise is accepted and the next one slides in.' },
        { li: ['Hint tells you which rod to use and why, step by step. It looks at where the beads are now.', 'Reset puts the rods back to how the exercise began.', 'Skip moves on without a star.'] },
        { p: 'Finish a lesson with few helps for three stars.' },
      ],
    },
    {
      title: 'Flash Mental',
      body: [
        { p: 'Numbers flash on the screen one after another. Add them in your head (take-aways are shown with a minus sign), then set the total on the abacus and tap Check. Five rounds make a session.' },
        { p: 'Higher levels use longer numbers, more of them, and flash faster. While the numbers flash the beads stay still: picture them.' },
      ],
    },
    {
      title: 'Timed Challenge and Watch and Learn',
      body: [
        { p: 'Timed Challenge: 60 seconds. Each task works on the running total, so you never clear the rods: "Add 47", "Take away 18", and so on. The moment the abacus shows the right total the next task appears. Quick answers earn bonus points and a streak.' },
        { p: 'Watch and Learn plays a short tour by itself: it thinks, shows where it will work, then moves the beads and says why. Pause stops everything; tap Resume to continue. Settings sets how long it thinks.' },
      ],
    },
  ],
};

export const RULES = {
  title: 'Rules',
  pages: [
    {
      title: 'The soroban',
      fig: { rods: 5, value: 90210 },
      body: [
        { p: 'A soroban is a frame with vertical rods and a horizontal beam. On every rod one heaven bead sits above the beam and four earth beads sit below it. Lessons use three to five rods; Flash Mental and the Timed Challenge use five, so the largest number is 99,999.' },
        { p: 'The rightmost rod is the ones, the next is tens, then hundreds, thousands and ten-thousands. A rod with no bead at the beam is zero.' },
      ],
    },
    {
      title: 'What a rod is worth',
      fig: { rods: 4, value: 5678, hl: 3 },
      body: [
        { li: ['Tap Watch on the Flash Mental levels screen to see two rounds play themselves: the numbers flash, it waits for you to think, reveals the total and sets it on the beads.', 'The heaven bead is worth 5 when it touches the beam, otherwise 0.', 'Each earth bead is worth 1 when it touches the beam, otherwise 0.', 'A rod therefore shows 0 to 9 (5 + 4).', 'The abacus value is the digits read left to right.'] },
        { p: 'The same value is only ever one arrangement of beads, so the game checks the total by the digits on the rods.' },
      ],
    },
    {
      title: 'Moving beads',
      fig: { rods: 3, value: 143 },
      body: [
        { li: ['Pushing an earth bead toward the beam lifts it and every earth bead between it and the beam.', 'Sliding an earth bead away from the beam, or tapping one that touches it, drops it and every earth bead farther out.', 'The heaven bead moves alone: toward the beam is +5, away is -5.', 'A tap toggles; a slide toward the beam only ever engages a bead and a slide away only releases it.', 'Rods are locked while Watch and Learn is playing, while the game is paused and during a Reading question.'] },
      ],
    },
    {
      title: 'Adding',
      fig: { rods: 3, value: 7 },
      body: [
        { p: 'Add from the highest place to the lowest. Per digit the coach uses one of four moves:' },
        { li: ['Direct: push as many earth beads up as the digit.', 'Heaven: for 5 to 9 pull the heaven bead down, then push the rest.', 'Five-friend: when there are not enough earth beads left, add 5 and take away the difference (+4 = +5 -1).', 'Ten-friend: when the rod would pass 9, carry 1 to the next rod on the left and take away the difference from 10 (+8 = +10 -2).'] },
        { p: 'A carry onto a rod that is already 9 carries again.' },
      ],
    },
    {
      title: 'Taking away',
      fig: { rods: 3, value: 12 },
      body: [
        { li: ['Direct: push as many earth beads away as the digit.', 'Heaven: for 5 to 9 lift the heaven bead away, then push the rest.', 'Five-friend: when the earth beads are not enough, lift the heaven bead and bring beads back (-4 = -5 +1).', 'Borrow: when the rod has less than the digit, take 1 from the next rod on the left (worth 10) and add back the difference (-8 = -10 +2).'] },
        { p: 'A borrow from a rod that is 0 borrows from the next one again. Totals never go below 0.' },
      ],
    },
    {
      title: 'Multiplying',
      fig: { rods: 4, value: 92 },
      body: [
        { p: 'The multiplying lesson uses partial products. For 23 x 4: the 2 is in the tens place and 2 x 4 = 8, so add 80; the 3 gives 3 x 4 = 12, so add 12. The total after both additions is 92.' },
        { p: 'Digits are taken from the highest place first. Each partial product is an ordinary addition, so everything above applies. In the Timed Challenge level 5 the abacus clears between multiplication tasks.' },
      ],
    },
    {
      title: 'Lessons and stars',
      body: [
        { p: 'There are 13 lessons of 5 exercises. Everything is generated for each play, and every exercise really needs the move its lesson teaches. An exercise ends when the abacus shows exactly the target total.' },
        { p: 'Reading numbers shows locked beads and four choices; a wrong choice counts as a help.' },
        { li: ['Helps are Hints, Resets and wrong choices.', '3 stars: no helps. 2 stars: up to 3 helps. 1 star: finished with more.', 'Skip counts as a help and gives no credit for that exercise.'] },
      ],
    },
    {
      title: 'Flash Mental',
      body: [
        { li: ['A session is 5 rounds. Each round flashes the numbers of the level one at a time, then you set the total and tap Check.', 'Level 1: three 1-digit numbers, 1.2 s each. Level 2: three 2-digit numbers, 1.1 s. Level 3: four 2-digit numbers with take-aways, 1.0 s. Level 4: five 3-digit numbers, 0.9 s. Level 5: seven 3-digit numbers, 0.75 s.', 'The running total is never negative.', 'A round is right when the abacus shows the exact total; the answer is then revealed with the list of numbers.', 'Stars: 5 right is 3 stars, 4 right is 2, 3 right is 1.'] },
      ],
    },
    {
      title: 'Timed Challenge',
      body: [
        { li: ['60 seconds on the clock. Tasks work on the running total (Add N, Take away N), so the rods are never cleared. Level 5 asks for a product from a cleared abacus.', 'Level 1: 1-digit add and take away. Level 2: 2-digit add. Level 3: 2-digit add and take away. Level 4: 3-digit add and take away. Level 5: 2-digit x 1-digit.', 'Points per task: 10, plus up to 10 for speed (10 minus the seconds spent), plus a streak bonus of 2 per task in a row up to 10.', 'Hint and Skip take 3 seconds off the clock. Hint, Reset and Skip break the streak.', 'Your best score on each level is saved.'] },
      ],
    },
    {
      title: 'Watch and Learn',
      body: [
        { p: 'A tour of eight operations: adding with direct beads, the heaven bead, a five-friend, a ten-friend, a long addition, taking away with the heaven bead, a borrow and a multiplication. The numbers are drawn fresh each time.' },
        { li: ['THINK: it states the task and waits (2, 5, 8 or 10 seconds in Settings; 5 by default).', 'REVEAL: for 2 seconds the rod and beads it will use glow.', 'ACT: the beads move one step at a time with the reason written out.', 'Pause freezes everything, including a bead in mid-move; Resume continues exactly there. Exit leaves the tour.'] },
      ],
    },
    {
      title: 'Settings and text size',
      body: [
        { li: ['Look: Kyoto, Cedar or Jade.', 'Number readout: shows the total the beads hold. Rod digits: shows each rod\'s digit.', 'Sound and Calm motion (fewer particles).', 'Think time for Watch and Learn.', 'Restore purchases.'] },
        { p: 'Every text screen has A- and A+ to scale text up to 300%.' },
      ],
    },
  ],
};
export const DOCS = { about: ABOUT, howto: HOWTO, rules: RULES };
