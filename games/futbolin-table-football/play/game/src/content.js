// Text of the About, How to Play and Rules pages. Cross-checked against sim.js / consts.js / ai.js. Sections: { title, art?, p: [paragraphs] }.
export const ABOUT = [
  { title: 'Futbolín', p: [
    'Table football, called futbolín in Spain and across Latin America, is played on a wooden table with rods of little players that you slide and spin. It is a staple of bars, cafés and family rooms.',
    'This game puts a lit wooden table in front of you. Slide a rod sideways with your thumb, flick it to kick, and score on the rival goal before they score on yours.',
  ] },
  { title: 'What is in the game', p: [
    'Quick matches to 3, 5 or 7 goals against five rival levels, or against a friend on the same screen. A three-round Cup. Watch & Learn, where two computer sides play and explain each kick, and a Think hint when you want one.',
    'Rules, How to Play and text size up to 300% are always a tap away. The table turns with your screen, in portrait and in landscape.',
  ] },
  { title: 'Full game and free preview', p: [
    'You can play a free preview of real matches. The menus, Rules, About, Watch & Learn and the hint are free. The full game is a single one-time unlock: no ads, no extras to buy. Use Restore purchase in Settings if you have bought it before.',
  ] },
  { title: 'A note on names', p: [
    'All team names are invented. The game uses no brands, leagues, clubs or players.',
  ] },
  { title: 'From Arcforge', p: ['Futbolín is part of the Arcforge collection of world heritage games. Tap the Arcforge mark on the title screen to see more.'] },
];

export const HOWTO = [
  { title: 'Your side', art: 'table', p: [
    'You play the red side at the bottom (at the left in landscape). You have four rods: goalkeeper, defence, midfield and attack. The rival has the other four, interleaved between yours.',
    'Score by putting the ball into the goal at the far end.',
  ] },
  { title: 'Slide', p: [
    'Touch a rod and drag sideways. The rod follows your finger; the player closest to the ball is the one to line up. The handle slides with it.',
    'The rod nearest to your finger is chosen when you touch. In Settings you can switch Rod pick to Auto, which always picks the rod that will play the ball next.',
  ] },
  { title: 'Kick', art: 'kick', p: [
    'Flick your finger quickly toward the rival goal to swing the rod. A harder flick is a harder kick. A short tap is a soft pass.',
    'Where the ball touches the player decides its angle: off the left edge sends it left, off the right edge sends it right. Sliding while you kick adds sideways push.',
  ] },
  { title: 'Defend', p: [
    'A player standing still is a wall: shots bounce off it. Keep a player in the path of the ball. The goalkeeper covers the goal mouth; the defence rod covers the lanes in front of it.',
    'You cannot kick a ball that is behind a player, so line up before the ball arrives.',
  ] },
  { title: 'Two players', p: [
    'Choose Two players when you set up a match and pass the screen around. Red plays the right half of the screen and Blue the left half (the bottom and the top when the table is turned). Each of you slides and flicks your own rods with your own thumb, at the same time. There is no hint in a two-player match.',
  ] },
  { title: 'Hint and Watch & Learn', p: [
    'Hint pauses the game and shows the rod a strong player would use, where to slide it and why. Watch & Learn lets two computer sides play; before each kick it stops, thinks, shows the plan and then acts. You can pause it at any time.',
  ] },
  { title: 'Keyboard', p: ['Left and Right slide (Up and Down in landscape), Up or Space kicks, 1 to 4 choose the rod (attack, midfield, defence, goalkeeper), Tab cycles, H shows a hint, P pauses.'] },
];

export const RULES = [
  { title: 'The table', art: 'table', p: [
    'The table is a felt field 68 units wide and 120 long with wooden rails, cut corners so the ball never sticks, and a goal mouth 24 wide in the middle of each end rail.',
    'Eight rods cross the field. From the rival end to yours they are: rival goalkeeper, rival defence, your attack, rival midfield, your midfield, rival attack, your defence, your goalkeeper.',
  ] },
  { title: 'The players on each rod', art: 'rods', p: [
    'Goalkeeper: 1 player, slides up to 22 units either way. Defence: 2 players 24 apart, slides up to 19. Midfield: 5 players 12 apart, slides up to 7. Attack: 3 players 20 apart, slides up to 11.5.',
    'A player is a small block 4.8 wide and 3.6 deep with a foot. The ball is 4.4 across, so it passes between neighbouring players on the same rod but never through one.',
  ] },
  { title: 'Starting and restarting', p: [
    'Every kick-off the ball is placed near the centre. After one second it rolls slowly toward the side that has to restart: at the start of a match, you; after a goal, the side that was scored on.',
    'If the ball stops moving for more than two seconds (it can come to rest between rods where no player can reach) it is a dead ball. It goes back to the centre and rolls toward the side that did not touch it last.',
  ] },
  { title: 'Sliding a rod', p: [
    'A rod slides sideways only. Your own rods follow your finger closely (up to a top speed so that a rod cannot jump across the ball). The rival rods slide at a speed set by the level.',
    'A moving player pushes the ball. A ball pinched between two players of the same rod is slowed sharply.',
  ] },
  { title: 'Kicking', art: 'kick', p: [
    'A kick swings the rod: the player draws his foot back, then drives it forward about 9 units in under a tenth of a second, holds, and returns. A rod cannot kick again until the swing has finished (about 0.3 seconds).',
    'If the foot meets the ball on the way forward, the ball leaves at 45 plus up to 205 units per second, depending on the kick power (a tap is soft, a hard flick is full). The speed is capped at 300.',
    'The sideways direction comes from where the ball touched the foot (up to 48 units per second sideways) plus some of the rod\'s own sideways speed.',
    'If the foot meets the ball from behind or the side, or while drawing back, the ball just bounces off the wood, with a little friction.',
  ] },
  { title: 'The ball', p: [
    'It rolls with a little friction and slows to a stop. It bounces off the side rails and end rails (about 80% of its speed is kept), off the posts, and off the angled corners. It bounces off players and keeps about a third of its speed.',
  ] },
  { title: 'Goals and winning', p: [
    'A goal counts when the whole ball has crossed the end line inside the goal mouth. After a goal there is a short celebration and a restart.',
    'A match is played to 3, 5 or 7 goals (the first side to reach it wins). There are no draws and no time limit.',
  ] },
  { title: 'Two players', p: [
    'In a two-player match both sides are played by people, with the same table and the same rules. Red controls the rods with handles on the right, Blue the rods with handles on the left. A finger on the right half of the screen picks the Red rod nearest to it; a finger on the left half picks the nearest Blue rod. Blue kicks down the table, Red up. The first restart is always Red\'s. Two-player matches are not counted in your record and do not use the Cup.',
  ] },
  { title: 'The rival', p: [
    'Five levels: Novice, Regular, Sharp, Expert and Master. They differ in how late they see the ball (0.30 s down to 0.035 s), how fast they slide, how well they predict bounces, how accurately they aim, how hard they kick and how eagerly they strike.',
    'Each rival rod follows the ball sideways, sets a player behind it, then strikes toward the part of your goal that your goalkeeper is leaving open.',
  ] },
  { title: 'The Cup', p: [
    'Three matches in a row: Quarter-final against the Plaza Owls (Novice, to 3), Semi-final against the Rio Rapids (Sharp, to 5), Final against the Cobalt Crew (Expert, to 5). Win all three to lift the Cup. If you lose you can try the round again. Progress is saved.',
  ] },
  { title: 'Hint, Pause and Watch & Learn', p: [
    'Hint stops the match and names the rod a strong player would use, how to slide it and why. Use it to take that rod, or close it and carry on.',
    'Pause stops the whole game; nothing moves until you resume. Watch & Learn plays two computer sides. Before each strike by the red side it stops for the Think time (2, 5, 8 or 10 seconds), then shows the plan for two seconds, then lets the kick happen. Pause freezes all of it.',
  ] },
  { title: 'Free preview and the full game', p: [
    'Real matches use up a 90 second free preview, counted only while the ball is in play. Menus, Rules, Watch & Learn and hints do not count. After that, one purchase unlocks everything for good.',
    'In the free web demo only two matches against the first two levels are available.',
  ] },
];
