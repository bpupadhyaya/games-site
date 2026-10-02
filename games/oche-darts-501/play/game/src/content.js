// The words: About, How to Play and the exhaustive Rules. Every number here is the one the engine (engine.js), the throw model
// (aim.js), the opponents (ai.js) and the game flow (game.js) really use. Change them together.

export const ABOUT = [
  { title: 'Oche Darts 501', p: [
    'Pub darts for your phone: hold, settle, release, and race down from 501 to exactly zero, finishing on a double.',
    'The oche is the line you stand behind to throw. Everything else is in your hand: a drifting aim point that tightens as you settle and tires if you wait too long.',
  ] },
  { title: 'A pub tradition', p: [
    'Darts has been played in pubs across Britain and Ireland for well over a hundred years. 501 with a double to finish is the classic game: simple to learn, hard to finish.',
    'This version uses the standard board, standard scoring and the usual double-out rule, drawn and sounded from scratch.',
  ], art: 'board' },
  { title: 'Friendly and fair', p: [
    'All opponents are invented characters. There are no real players, leagues or brands in this game.',
    'It is a game of skill for fun: no betting, no stakes, no coins. Scores and records stay on your device.',
  ] },
  { title: 'Made to be comfortable', p: [
    'Every text screen can be enlarged up to 300%. Aim steadiness has three settings, from Relaxed to Pub-tough. The Think button and the checkout coach teach finishing as you play, and Watch & Learn lets you watch a whole leg with the reasons shown.',
    'The game is free to try for 90 seconds of real play. Menus, the rules and Watch & Learn are always free; one purchase unlocks everything for good.',
  ] },
];

export const HOWTO = [
  { title: 'The goal', p: [
    'Start on 501 (or 301). Every dart you land takes its score off. The first player to reach exactly zero, finishing with a double, wins the leg.',
    'Win the number of legs you chose (first to 1, 2 or 3) to win the match.',
  ] },
  { title: 'Throwing a dart', p: [
    'Touch and hold anywhere below the scoreboard. A round aim point appears above your finger, so your thumb never hides it. Slide to place it on what you want to hit.',
    'The aim point never holds perfectly still: it drifts. Let go to throw.',
  ], art: 'hold' },
  { title: 'Steady hands', p: [
    'When you first touch down the drift is wide. Within about one and a half seconds your hand settles and the ring tightens and turns green. You stay steady until about two and a half seconds, then your arm tires and the ring widens and turns orange.',
    'The ring shows how far the dart can land from the aim point. Let go while the aim point is over the target and the ring is tight. A jerky release adds error too.',
    'Changed your mind? Slide your finger down into the button bar and let go: the throw is cancelled.',
  ], art: 'steady' },
  { title: 'Scoring', p: [
    'The big areas score the number shown. The thin outer ring doubles it, the thin inner ring trebles it. The outer bull is 25 and the bull is 50.',
    'Three darts make a visit. Your visit total appears next to the three dart boxes.',
  ], art: 'rings' },
  { title: 'Finish on a double', p: [
    'You must finish on a double (the outer ring, or the bull). Going past zero, landing on exactly 1, or reaching zero without a double is a bust: your score goes back to where it was at the start of the visit and the turn ends.',
    'So when you are low, think about the leave: from 40 you want double 20, from 32 double 16.',
  ], art: 'bust' },
  { title: 'Think and the coach', p: [
    'The Think button shows the best next dart and lights its place on the board. When you are on 170 or less and can finish, the checkout coach shows the route, for example T20, T18, D16. You can switch the coach off in Settings or the pause menu.',
    'The route picks the fewest darts and the friendliest double.',
  ], art: 'checkout' },
  { title: 'Watch & Learn', p: [
    'Choose Watch & Learn on the menu to watch two computer players play a whole leg of 301. Each dart has three steps: THINK (the player is working it out, 5 seconds by default; change it with the plus and minus buttons), REVEAL (the chosen target glows for 2 seconds with a plain explanation) and ACT (the dart is thrown).',
    'Pause freezes everything exactly where it is. Exit returns to the menu. Watching never uses up the free preview.',
  ] },
  { title: 'Two players', p: [
    'Choose Two Players and pass the phone: Player 1 and Player 2 take turns with three darts each. The same rules apply, and the Think button and coach work for both.',
  ] },
  { title: 'Keys on a computer', p: [
    'Arrow keys move the aim point. Space starts aiming, Space again throws. H is Think, P or Escape pauses. On menus, plus and minus change the text size.',
  ] },
];

export const RULES = [
  { title: 'The board', p: [
    'The board has 20 numbered segments. Clockwise from the top the numbers run 20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5.',
    'Each segment has a wide single area inside the treble ring, a thin treble ring, a wide single area outside it, and a thin double ring at the edge. In the middle is the outer bull and the bull. The numbers sit on the black ring around the edge.',
  ], art: 'board' },
  { title: 'What a dart scores', p: [
    'Single: the number of the segment (1 to 20). The two single areas of a segment score the same.',
    'Double: twice the number, on the thin outer ring (2 to 40).',
    'Treble: three times the number, on the thin inner ring (3 to 60).',
    'Outer bull (the green ring): 25. Bull (the red centre): 50, and it counts as a double.',
    'Outside the double ring: no score. A dart that misses the board, hits the number ring or the wall, or bounces out scores 0.',
  ], art: 'rings' },
  { title: 'Starting score and a visit', p: [
    'A match starts at 501 or 301 for both players. You do not need a double to start: any dart scores from the first throw (straight in).',
    'Players take turns. A visit is up to three darts; each dart is subtracted from the player\'s score straight away. A dart that bounces out or misses still uses up one of the three. A visit ends early when the player busts or wins the leg.',
  ] },
  { title: 'Double out', p: [
    'To win a leg you must reduce your score to exactly zero with a dart that lands on a double, including the bull (50).',
    'A single or treble that would take you to zero does not count: that is a bust.',
  ], art: 'bust' },
  { title: 'Bust', p: [
    'A dart is a bust if it would take your score below zero, leave you on exactly 1 (no double can finish from 1), or take you to zero without being a double.',
    'On a bust your score returns to what it was at the start of that visit, the visit scores nothing, and your turn ends at once: any darts you had left are lost.',
    'A bust counts as a visit scoring zero in your three-dart average.',
  ], art: 'bust' },
  { title: 'Checkouts', p: [
    'The highest finish is 170 (treble 20, treble 20, bull). The lowest is 2 (double 1).',
    'These scores cannot be finished with three darts: 169, 168, 166, 165, 163, 162 and 159, and anything above 170.',
    'The coach and the Think button choose the route with the fewest darts and then prefer treble first darts and favourite doubles (20, 16, 8, 10, 12, 18 and so on). With fewer darts in hand than the route needs, they suggest the dart that leaves the best finish for the next visit.',
  ], art: 'checkout' },
  { title: 'Legs and the match', p: [
    'A leg is one race down from 501 or 301. The first to reach the number of legs chosen (1, 2 or 3) wins the match.',
    'Who throws first in the opening leg is random. After that the starter alternates every leg.',
    'Your three-dart average is the points you scored divided by the darts you threw, times three. The result screen shows the average, your highest visit, 180s, 100-plus visits, your best checkout and how many doubles you hit.',
  ] },
  { title: 'Hold, drift and settle', p: [
    'Your aim point is where your finger is, held 150 units above it, plus a drift. The drift starts wide and shrinks smoothly over 1.4 seconds to its steadiest. It stays at its steadiest until 2.4 seconds, then your arm tires and it grows by a steady amount each second, up to a limit at about 5.4 seconds.',
    'Holding for less than a quarter of a second cancels the throw, as does letting go with your finger in the button bar.',
  ], art: 'steady' },
  { title: 'Where the dart lands', p: [
    'The dart lands at a random place around the aim point. The spread has a base amount, plus a share of the current drift, plus extra if your finger was still moving fast at release. The ring around the aim point is 1.5 times the typical spread.',
    'The aim steadiness setting scales the drift and the spread: Relaxed is 0.7, Standard 1 and Pub-tough 1.35 times.',
  ], art: 'steady' },
  { title: 'Bounce-outs', p: [
    'A dart that lands on a wire, within about a millimetre of a ring or a segment divider, bounces out about three times in ten.',
    'A dart that lands within a few millimetres of another dart already in the board bounces out about four times in ten (the dart falls and scores nothing).',
    'A dart that lands far outside the board hits the wall and falls. All of these use up a dart of the visit.',
  ], art: 'bounce' },
  { title: 'The opponents', p: [
    'Dot the Landlady (about a 30 average), Gaz from the Corner (45), Marguerite (60), Old Fergus (75) and The Quiet Lad (90). The averages are what each makes over a whole leg.',
    'Each has a steady spread, a form that changes a little each leg, a small pull on every visit, and gets nervier when throwing at the double that wins. They choose what to aim at from the real chances of each target, so weaker players go for big safe areas and stronger players for trebles and the right doubles, and all of them can bust.',
    'In the web demo only the first two opponents are open.',
  ] },
  { title: 'Watch & Learn', p: [
    'Two computer players, picked at random from the four stronger opponents, play one leg of 301. For every dart there are three steps: THINK, which lasts 2, 5, 8 or 10 seconds as you choose (5 by default); REVEAL, which lasts 2 seconds while the chosen target glows and the reason is shown; and ACT, when the aim point settles and the dart is thrown.',
    'Pause freezes every timer and animation until you resume. Watch & Learn does not count against the free preview.',
  ] },
  { title: 'Saving, settings and unlocking', p: [
    'Quit to menu from the pause menu keeps a match in progress: choose Continue match on the menu. It resumes at the start of the current visit. A finished match is cleared.',
    'Settings: sound, aim steadiness, the checkout coach, text size (100% to 300%) and Watch & Learn thinking time. Restore purchases is also there.',
    'Free preview: the first 90 seconds of real play. Menus, these pages and Watch & Learn do not use it up. After that, one purchase unlocks the whole game for good.',
  ] },
];
