// The words: About, How to Play, Rules and the Learn lessons. Every number here is the one the engine (engine.js), the physics
// (phys.js), the opponents (ai.js) and the game flow (game.js) really use. Change them together.
// Language: the game is played in English. The German words (Kegel, Volle, Abräumen, Holz, Alle Neune, Kranz, König, Pudel)
// are the flavour layer: each one is explained the first time it appears and means the same thing everywhere.

export const ABOUT = [
  { title: 'Kegeln', p: [
    'Nine-pin skittles for your phone: roll a heavy dark ball down a long polished lane and knock down nine pins that stand in a diamond.',
    'Kegeln (say KAY-geln) is the German word for rolling a ball at standing pins. The pins are Kegel, the lane is the Kegelbahn.',
  ], art: 'layout' },
  { title: 'A pastime from German-speaking lands', p: [
    'Rolling a ball at standing pins is a very old game in German-speaking countries; it is mentioned in written sources from the Middle Ages. Today it is played in clubs and inns, from relaxed evenings to careful competition. Kegeln belongs to the wider family of skittles and bowling games found around the world.',
    'A classic lane is about 19.5 metres long and the ball is 16 cm across and weighs a little under three kilograms. This game follows those sizes, and the rules of the two classic parts, Volle and Abräumen, in a form that is easy to learn and play on a phone.',
  ] },
  { title: 'The words in this game', p: [
    'Kegel: a pin. Kegelbahn: the lane. Volle: throws at a full set of nine pins. Abräumen (say AP-roy-men): clearing the pins that are left. Holz: wood, the old word for one pin knocked down.',
    'Alle Neune: all nine pins down. König: the King, the pin in the middle. Kranz: a wreath: the eight pins around the King fall and the King stays up. Pudel: a ball that leaves the lane and scores nothing.',
  ] },
  { title: 'Friendly and fair', p: [
    'All opponents are invented characters. There are no real players, clubs, leagues or brands in this game.',
    'It is a game of skill for fun: no betting, no stakes, no coins. Scores and records stay on your device.',
  ] },
  { title: 'Made to be comfortable', p: [
    'Every text screen can be enlarged up to 300%. Aim steadiness has three settings. The Think button explains a line and tests it with real simulated rolls, Learn teaches the game in four short lessons, and Watch & Learn lets you watch two players with their reasons on screen.',
    'The game is free to try for 90 seconds of real play. Menus, the rules, Learn and Watch & Learn are always free; one purchase unlocks everything for good.',
  ] },
];

export const HOWTO = [
  { title: 'The goal', p: [
    'Knock down as many pins as you can. A match has two parts: Volle (every throw is at a full set of nine pins) and Abräumen (you keep throwing at the pins that are left). Your pins from both parts are added together; the higher total wins.',
    'You and your opponent throw one after the other until each of you has made all your throws.',
  ], art: 'layout' },
  { title: 'Plan your throw', p: [
    'Drag on the lane to move the gold aim ring. It shows where your ball should cross the line of the front pin. A dashed line shows the path the ball will follow, hook included.',
    'Drag the ball at the bottom of the lane sideways to change where you start from. Pick the hook (the seven curved arrows) and the weight (Soft, Medium or Firm). The arrow buttons beside Roll nudge the aim by a finger-width.',
  ], art: 'plan' },
  { title: 'Roll', p: [
    'Flick the ball up the lane with a quick, straight swipe, or tap Roll. A smooth, straight flick is a little more accurate than the Roll button; a wobbly or slow flick is less accurate. Your hand is never perfect, so the ball will land near the ring, not always on it.',
    'Watch the ball roll. The view never moves, like standing at the foul line of a real lane: only the ball and the pins move. After big throws a small slow-motion replay of the pin deck can play in a corner.',
  ] },
  { title: 'Hook and weight', p: [
    'Hook makes the ball curve. The path bends more towards the end of the lane, so a hook lets you come in from the side and slide between pins. A big hook drifts the ball up to about half a metre sideways at Medium weight.',
    'Weight is speed. Firm throws are faster, give the pins more punch and curve a little less; Soft throws curve more and hit gently. Every lane also plays a little different: after a throw or two you will see whether this lane hooks more or less than the dashed line shows.',
  ], art: 'hooks' },
  { title: 'Abräumen: clear the rest', p: [
    'In the second part you throw at the pins you left standing last time. Each player has their own pins. When all nine have fallen, a fresh set is put up and your count carries on.',
    'Knocking down the awkward leftovers, such as one pin far at the side, is the skill of this part.',
  ], art: 'abr' },
  { title: 'Think, Learn and Watch & Learn', p: [
    'Tap Think for a line to try. The game tests it with twelve simulated rolls and tells you the average and the worst result, so the reason is measured, not guessed. Tap Use this line to set it up.',
    'Learn has four short lessons. Watch & Learn shows two computer players: you see them think, then the line is revealed with its reason, then they roll. Pause freezes everything.',
  ] },
  { title: 'Two players on one phone', p: [
    'Choose Two Players on the menu. You take turns on the same phone; the screen says whose turn it is. The match and its saving work the same way.',
    'Leaving a match in the middle keeps it. Choose Continue on the menu to carry on, paused, exactly where you stopped.',
  ] },
];

export const RULES = [
  { title: 'The pins and the lane', p: [
    'Nine pins stand in a diamond: one at the front, two behind it, three in the middle row (a left corner pin, the King and a right corner pin), then two, then one at the back. Neighbouring pins are 35.5 cm apart.',
    'The pin in the middle of the diamond is the King (der König). The lane is 1.3 m wide and the front pin is 19.5 m from the foul line. The ball is 16 cm across; a pin is 38.5 cm tall.',
  ], art: 'layout' },
  { title: 'A match', p: [
    'A match is played over a chosen length: Short (5 Volle throws and 5 Abräumen throws each), Standard (10 + 10) or Full lane (15 + 15, as on a real lane).',
    'The two sides throw alternately. First all the Volle throws, then all the Abräumen throws. The side that throws first is chosen by the game and is the first to throw in both parts.',
    'At the end the higher total wins. Equal totals are a draw.',
  ] },
  { title: 'Volle: the full set', p: [
    'Every Volle throw is at all nine pins. After each throw the fallen pins are taken away and a full set of nine is put up again for the next throw, whoever throws it.',
    'Each pin that falls scores one point (one Holz, one piece of wood). The most you can score with one Volle throw is nine.',
  ] },
  { title: 'Abräumen: the pins that are left', p: [
    'Abräumen means clearing. Each side has its own pins. You throw at the pins that you left standing with your previous Abräumen throw; the first one is at a full set.',
    'Each pin that falls scores one point. When all of your pins have fallen, a full set is put up again for your next throw (the game calls this "cleared") and you carry on counting.',
    'When it is the other side\'s turn you will see their pins, not yours; the game puts each side\'s own pins back before every throw.',
  ], art: 'abr' },
  { title: 'When a pin counts', p: [
    'A pin counts as fallen when it has tipped over, or when it has been pushed off the lane (into the gutter side, past the lane edge). A pin that wobbles and stays on its spot has not fallen.',
    'A ball that leaves the lane before it reaches the pins is a Pudel: the throw scores nothing, even if it later touches pins. A ball that stays on the lane and misses all the pins also scores nothing.',
  ] },
  { title: 'Calls', p: [
    'Alle Neune: all nine pins of a full set fall with one throw. Kranz: in Volle, eight pins fall and the King, the middle pin, stays standing. Pudel: the ball left the lane.',
    'These calls are shown on screen and counted in your records. They give no bonus points: only the pins count.',
  ], art: 'calls' },
  { title: 'Aiming', p: [
    'Your throw is made from four choices: where you start (up to half a metre either side of the middle), the aim ring, the hook and the weight. The aim ring is a point on the line of the front pin, from 62 cm left to 62 cm right of the middle.',
    'The game works out the angle that would carry the ball over the ring with the hook you chose. With the hook set to straight the ball goes straight to the ring.',
  ], art: 'plan' },
  { title: 'Hook', p: [
    'There are seven hook settings: three to the left, straight, three to the right. The ball is pulled sideways more and more along the lane, so most of the curve happens near the end.',
    'The strongest hook moves the ball about 46 cm sideways at Medium weight (about 66 cm at Soft, about 34 cm at Firm). The dashed line already includes this.',
  ], art: 'hooks' },
  { title: 'Weight', p: [
    'Soft rolls at 5.4 metres a second (about 19 km/h), Medium at 6.5 (about 23 km/h) and Firm at 7.6 (about 27 km/h). Faster balls hit the pins harder and are pulled less by the hook.',
    'A pin tips over when a single knock changes its speed by more than about 1.7 metres a second. A lighter touch only makes it wobble.',
  ] },
  { title: 'The lane', p: [
    'Every match is played on a lane with its own character: it pulls the ball between 8% less and 8% more than the dashed line shows. You are not told which. Look at where your first throws end up and adjust.',
    'The pins are real physics objects: they slide, tip, roll into their neighbours and rebound off the side and back boards. The same throw always gives the same result on the same lane.',
  ] },
  { title: 'Your hand', p: [
    'Nobody rolls perfectly. Your ball lands near the aim ring: on average within 3 cm with Steady, 4.5 cm with Normal and 7 cm with Shaky. That is a typical error, and sometimes it is bigger.',
    'The Roll button gives an average hand. A smooth, straight, quick flick of the ball is up to 30% more accurate; a crooked or slow flick is up to 80% less accurate.',
  ] },
  { title: 'The computer players', p: [
    'Lehrling (1 star), Stammgast (2), Kegelbruder (3), Vereinsmeister (4) and Großmeister (5) all use the same physics as you. Each one tests many throws in its head, then picks a line and rolls with a hand that is a little off.',
    'Stronger players choose better lines and roll more accurately: about 15 cm average error for Lehrling, 9 cm for Stammgast, 6 cm for Kegelbruder, 3.6 cm for Vereinsmeister and 2 cm for Großmeister. In simulated matches of the Standard length each one won between 72 and 85 times in 100 against the one below it.',
  ] },
  { title: 'Think, Learn, Watch & Learn', p: [
    'Think tries about a thousand simulated throws for the pins that are standing, picks a line that still works with a normal hand, then rolls it twelve more times and shows the average, the best and the worst. Nothing is guessed.',
    'Learn has four lessons with goals. Watch & Learn plays two computer opponents: it thinks for the time you set (2 to 10 seconds), reveals the line for 2 seconds with its reason, then rolls. Pause freezes the whole loop.',
  ] },
  { title: 'Saving and the free preview', p: [
    'The match is saved after every throw. Choose Continue on the menu after leaving; the match resumes paused where you stopped.',
    'The game is free to try for 90 seconds of real play. Menus, these rules, Learn and Watch & Learn do not use the preview time. One purchase unlocks the full game for good; Restore purchases is in Settings and on the unlock screen.',
  ] },
];

// Learn: short lessons with goals. `standing` lists the pin ids that stand at the start (0 front, 4 King; see phys.js).
export const LESSONS = [
  { title: 'Roll at the pins', standing: [0, 1, 2, 3, 4, 5, 6, 7, 8], tries: 3, goal: 5, carry: false,
    text: 'Drag on the lane to place the aim ring just ahead of the front pin, then flick the ball up the lane or tap Roll. Goal: knock down 5 or more pins with one throw. You have 3 throws.' },
  { title: 'Hook and Think', standing: [0, 1, 2, 3, 4, 5, 6, 7, 8], tries: 3, goal: 6, carry: false,
    text: 'A hook lets the ball come in from the side and slide between pins. Tap Think for a tested line, then Use this line and Roll. Goal: knock down 6 or more with one throw. You have 3 throws.' },
  { title: 'Clear the left side', standing: [1, 3, 6], tries: 4, goal: 3, carry: true,
    text: 'This is Abräumen: only the pins you left are standing and they stay between throws. Goal: clear all three pins within 4 throws. Try a hook from the right side.' },
  { title: 'The King', standing: [4], tries: 3, goal: 1, carry: true,
    text: 'The King is the pin in the middle. When it is the only one left it is surprisingly easy to miss: go straight along the middle. Goal: knock it down within 3 throws.' },
];
