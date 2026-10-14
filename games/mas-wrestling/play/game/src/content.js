// Text for About, How to Play and the Rules reference. Every rule claim below was checked against the engine:
//   sim.js   45 s bout (+10 s extra time when within 4 points of advantage), stamina burn 0.20/s x effort squared, rest regen 0.16/s below
//            25 % effort, strength 40 % empty to 100 % full, snap = effort above its 0.35 s average (up to +110 % force), leverage
//            1 +/- 0.45 x draw, sink cancels up to 65 % of a lift, grip wear (effort 0.06/s, lift 0.22/s, edge up to 0.09/s) and
//            restore (sink 0.12/s, rest 0.03/s), lift gauge 1.0/s per unit of net lift, settles back when nobody lifts
//   ai.js    five rivals, Think coach, Watch & Learn
//   game.js  best of three bouts, first to two, the 90 s preview, the demo cap
// A section is { title, art?, p: [paragraphs] }; the reader lays the text out so nothing overflows at any text size.

export const ABOUT = [
  { title: 'Mas-wrestling', art: 'stage', p: [
    'Mas-wrestling is a seated stick-pulling contest from Sakha (Yakutia) in the north-east of Russia. Two athletes sit facing each other with their feet braced against a board, hold one short wooden stick between them and pull. Whoever lifts the other off the floor, or wrenches the stick from their hands, wins the bout.',
    'It is a sport of strength and nerve more than of size, and it is played by children and veterans alike at festivals and in sports halls. Today it has an international federation, with athletes from many countries and national championships around the world.',
  ] },
  { title: 'This version', p: [
    'Mas Wrestling puts you in the left seat. One thumb steers a single pull: back to draw the stick to your side, up to lift, down to sink and defend. You can see the rival\'s pull as it happens and watch their stamina and grip fall, so every bout is a small story of leverage and nerve.',
    'Play against five rivals, share one phone with a friend (one thumb each), or play Watch & Learn: two computer athletes play a whole match while they explain every choice, with a real Pause.',
  ] },
  { title: 'Halls', p: [
    'Festival Meadow is an open-air green with birches and bunting, Winter Hall is a timber hall with lamps and snowy windows, and Grand Arena is a spotlit hall with banners and a roaring crowd. The halls only change the look; the rules are the same.',
  ] },
  { title: 'About the rules', p: [
    'The game keeps the heart of the sport: seated, feet on the board, one stick, win by lifting or by taking the stick, best of three bouts. It simplifies how a real contest is judged, and the Rules pages say exactly how everything in the game works.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'stage', p: [
    'You are the athlete on the left. Win a bout by lifting your rival off the floor, by emptying their grip so the stick is wrenched away, or by being clearly ahead when the clock ends. Win two bouts to win the match.',
  ] },
  { title: 'Pulling', art: 'compass', p: [
    'Put a thumb anywhere on the screen and drag. Drag left to pull back and draw the stick to your side. Drag up to lift. Drag down to sink: press your weight into the floor to defend. A diagonal blends two. The farther you drag, the harder you pull.',
    'The ring where your thumb landed follows your thumb, so you never run out of room. The compass at the bottom shows the pull you are making.',
  ] },
  { title: 'Stamina and snaps', art: 'meters', p: [
    'Hard pulling empties STAMINA, and a tired athlete pulls much weaker. Ease off and it comes back. A quick flick from slack to hard is a SNAP and pulls up to twice as hard for a moment, and costs little. Pulsed pulls beat a steady heave.',
  ] },
  { title: 'Grip and leverage', art: 'lift', p: [
    'GRIP is how well your hands hold the stick. Lifting wears down the rival\'s grip and hard pulling wears down yours. Sinking and resting restore it. If your grip empties, the stick is wrenched from your hands.',
    'The DRAW gauge shows where the stick is. The closer it is to you, the stronger your lift and the weaker theirs. The LIFT gauge fills toward whoever is lifting: fill it all the way and the rival is off the floor.',
  ] },
  { title: 'Think and Watch & Learn', p: [
    'Think pauses the bout and the coach suggests the best move for this moment, with an arrow showing the pull. Watch & Learn plays a whole short match between two computer athletes: it thinks, shows its choice with a card that explains it, then pulls. Use Pause, Speed and the Think time buttons as you like.',
    'In a two-player match the left half of the screen controls the left athlete and the right half controls the right athlete. Dragging toward your own screen edge is back for both.',
  ] },
];

export const RULES = [
  { title: '1. What you are playing', art: 'stage', p: [
    'A match is the best of three bouts: the first athlete to win two bouts wins. In each bout two athletes sit facing each other with their feet braced against a board and hold one stick between them. The athlete on the left of the screen is side one (you, in a one-player match) and the athlete on the right is the rival.',
    'There are three ways to win a bout: lift the rival off the floor, empty their grip so the stick is wrenched away, or be ahead when time runs out.',
  ] },
  { title: '2. The pull', art: 'compass', p: [
    'Each athlete makes one pull at a time, a single vector. Back draws the stick toward you, up lifts, and down sinks. The length of the drag is the effort from zero to full. A diagonal mixes two: effort is the size of the back and lift parts together, and a sink counts separately.',
    'The hands follow your thumb a little slowly, so a pull builds over about a fifth of a second.',
  ] },
  { title: '3. Stamina', art: 'meters', p: [
    'Stamina runs from full to empty. Pulling burns it at 0.20 per second at full effort, and less than that for less effort (the burn grows with the square of the effort, so half effort costs a quarter). Sinking is cheap. When the effort is below a quarter, stamina comes back at up to 0.16 per second, and a little faster while sinking.',
    'A tired athlete is weaker, not helpless: full stamina pulls at full strength and empty stamina at 40 % strength.',
  ] },
  { title: '4. Snaps', p: [
    'The game compares your effort now with your own effort over the last third of a second. When it jumps up sharply that is a snap: the pull is up to double strength for as long as the effort stays above its recent average. A steady heave gets no snap, so a quick pull from slack beats a long hard pull, and costs less stamina.',
  ] },
  { title: '5. Drawing the stick', art: 'lift', p: [
    'The stick moves toward whoever pulls back harder. Its position is the DRAW gauge, from fully on your side to fully on theirs. It has some weight and it eases to a stop.',
    'Leverage: the stick close to you makes your lift up to 45 % stronger and the rival\'s up to 45 % weaker. With the stick in the middle both lift normally.',
  ] },
  { title: '6. Lifting and sinking', p: [
    'Lifting pushes the LIFT gauge toward you. With fresh arms and full leverage a clean lift fills it in about a second if nothing resists. Sinking against a lift cancels most of it: up to 65 % of the rival\'s lift, depending on how hard you sink and how tired you are. If both athletes lift, the lifts cancel.',
    'When neither athlete is lifting, the gauge settles back to level. When it reaches either end, that athlete has lifted the other off the floor and wins the bout.',
  ] },
  { title: '7. Grip', p: [
    'Grip starts full. It wears down by 0.06 per second at full effort, and by 0.22 per second for every full unit of a rival\'s lift that a sink does not cancel. Sinking restores 0.12 per second and resting with a small pull restores 0.03 per second.',
    'When the stick is drawn almost right over to the rival (the last 15 % of the gauge) your grip also slips away quickly. When a grip empties, the stick is wrenched away and the other athlete wins the bout.',
  ] },
  { title: '8. Time and points', p: [
    'A bout lasts 45 seconds (30 seconds in Watch & Learn). If nobody has won by then, the athlete ahead on points wins, where points are 60 % lift, 40 % draw and a little for stamina. If the bout is almost level (points within 0.04 of each other), ten seconds of extra time are played once, and then the leader wins.',
  ] },
  { title: '9. The five rivals', p: [
    'Aisen reads the bout late and pulls in clumsy bursts. Tuyaara is steady and patient. Eder is strong and spends his stamina early. Sardaana reads you quickly and punishes a tired moment. Aytal, the champion, pulls in clean snaps, rests at the right moments and rarely wastes a pull.',
    'All five follow the same rules as you. They see the same gauges, and a stronger rival simply reads them sooner. A rival\'s view of your own pull is delayed by a fraction of a second, longer for the weaker rivals.',
  ] },
  { title: '10. Think and Watch & Learn', p: [
    'Think pauses the bout and the coach names the best action for this moment (draw, lift, sink or rest), shows an arrow with the pull to make and says why. It is a suggestion, and the clock does not run while the card is up.',
    'Watch & Learn plays a match between two computer athletes. At key moments it stops to think (you choose 2 to 10 seconds), shows its choice with a card and then carries on. Pause freezes everything exactly where it is.',
  ] },
  { title: '11. Simplifications', p: [
    'In a real contest the athletes sit on the floor and judges rule on fouls, the lift is a hip height and bouts are decided by a series of rounds with their own rules. Here a bout is a single continuous pull, the lift is a gauge, and the stick has a draw position. The athletes are generic and the halls are invented for the game.',
  ] },
  { title: '12. The free preview', p: [
    'The first 90 seconds of real bouts are free. Watch & Learn, the menus and the rules never use up the preview, and a paused bout does not either. In the web demo the first three bouts against the first two rivals in Festival Meadow are free, and the full game is on iPhone and Android.',
  ] },
];
