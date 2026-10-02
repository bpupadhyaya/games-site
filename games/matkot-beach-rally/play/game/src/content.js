// Text for About, How to Play and the Rules reference. Every rule claim below was checked against the engine:
// sim.js (court, reach, swing timing, aim, pace, accuracy, landing verdicts), ai.js and opponents.js (rivals and the coach),
// game.js (modes, serve order, scoring, tiers, wind and pace ramps, Watch & Learn, hints, the web demo limit).
// A section is { title, art?, p: [paragraphs] }; the reader paginates the lines so nothing overflows at any text size.

export const ABOUT = [
  { title: 'Matkot', art: 'figures', p: [
    'Matkot (מטקות) is a beach paddle game from Israel. Two players stand a few steps apart with wooden paddles and keep a hard rubber ball in the air, with no net and no court to speak of, only the sand, the sea and the rhythm of the ball on the wood.',
    'You hear it on every beach there in summer: tok, tok, tok. It is a game for pairs, for friends and for anyone with a paddle and a free afternoon.',
  ] },
  { title: 'Cooperative and competitive', p: [
    'On the beach the same game is played two ways. Most of the time you are partners, trying to set a record for the longest rally. Sometimes it turns into a contest, with placement, power and surprise.',
    'Matkot Beach Rally has both: Beach Rally, where you and Dana keep it going, and Match, where you play a rival to 7 or 11.',
  ] },
  { title: 'This version', p: [
    'The beach is a real playing field: the ball has weight, height and wind, the sand is the floor, and every shot is decided by where you stand and when you swing.',
    'The computer players run, misjudge, hurry and settle like people. Watch & Learn plays a whole match and explains each choice before it is made.',
  ] },
  { title: 'Made to be played in short bursts', p: [
    'A rally takes a minute or two, and a match about five. The sky slides from afternoon to sunset as a rally grows, so a long rally feels like a long evening on the sand.',
  ] },
];

export const HOWTO = [
  { title: 'The goal', art: 'court', p: [
    'Keep the ball from touching the sand on your side. Hit it back over the middle line, and make your partner or rival unable to return it.',
  ] },
  { title: 'Run and swing', art: 'reach', p: [
    'Press anywhere on the screen and drag: your player runs and keeps the same distance from your thumb, so nothing is covered and a tap never moves you.',
    'Lift your thumb to swing. The paddle reaches about one metre around you; the dotted circle on the sand shows it.',
  ] },
  { title: 'Read the ball', art: 'drop', p: [
    'The white ring on the sand is where the ball will pass through hitting height. Get under it. The ball glows green when a swing now would be a sweet hit.',
  ] },
  { title: 'Aim with your feet', art: 'angle', p: [
    'Where the ball meets your paddle sets the angle. Meet it with the left side of your paddle and the ball goes left; with the right side and it goes right. The gold ring in the far court shows where a swing right now would land.',
  ] },
  { title: 'Choose the pace with timing', art: 'height', p: [
    'Swing early, while the ball is still high, for a fast, flat smash. Swing as it passes your waist for a steady drive. Wait and swing late, low, for a slow high lob.',
    'Mid-height contact is sweet: accurate, and it builds your Rhythm combo.',
  ] },
  { title: 'Beach Rally', art: 'tiers', p: [
    'You and Dana keep one rally going. Every return scores a point, a sweet hit scores double, and a run of sweet hits multiplies it. The rally grows faster and windier, and the sky slides toward sunset.',
  ] },
  { title: 'Match', art: 'score', p: [
    'Play a rival to 7 or 11 points. Every rally ends when the ball touches the sand: the side that did not drop it scores. Serves change every two points.',
  ] },
  { title: 'Watch & Learn and hints', art: 'think', p: [
    'Watch & Learn plays a full match between two computer players. Each time the ball is coming to one of them, play stops: they think, then reveal their choice with rings on the sand, then play on.',
    'In your own games tap the bulb in the top corner for a hint: a green ring shows where to stand and where to aim.',
  ] },
  { title: 'Calm mode and text size', p: [
    'Calm mode in Settings gives you a wider paddle reach, a slower ball and no wind. Text size goes up to 300% on every page.',
  ] },
];

export const RULES = [
  { title: 'The beach court', art: 'court', p: [
    'The court is 8.4 metres wide and 12 metres long, drawn in the sand. There is no net: a line in the middle at 6 metres divides your half from the other half.',
    'You play the near half and your partner or rival plays the far half. The ball is live until it touches the sand.',
  ] },
  { title: 'Where you can stand', p: [
    'You may run anywhere on your half, up to 1 metre behind your baseline and 0.5 metres outside each sideline, but not closer than 0.4 metres to the middle line.',
    'Your top running speed is 4.4 metres per second, with a quick start and stop. Dragging far ahead of your player does not make them faster.',
  ] },
  { title: 'Your paddle', art: 'reach', p: [
    'The paddle face sits 0.3 metres in front of you. The ball can be hit if it is within 1.15 metres of the face (1.5 metres in Calm mode) and between 0.35 and 2.0 metres above the sand.',
    'You cannot hit the ball twice in a row: after your hit, only the other side can hit it. At the serve, only the server may hit it.',
  ] },
  { title: 'The swing', art: 'swing', p: [
    'Lifting your thumb starts a swing. It has a wind-up of 0.05 seconds, then an impact window of 0.26 seconds, then a recovery, 0.55 seconds in all.',
    'The ball is hit the first moment it is inside your reach and height range while the impact window is open. If it is not, the swing misses, and you cannot swing again until the recovery ends. You run at 70% speed during the recovery.',
  ] },
  { title: 'Height decides pace', art: 'height', p: [
    'The height at which the paddle meets the ball sets how fast and how deep the return is.',
    'At 2.0 metres the ball flies for 0.62 seconds and lands 1.8 metres past the middle line. At 1.15 metres it flies for 1.05 seconds and lands 3.4 metres past it. At 0.35 metres it flies for 1.55 seconds and lands 4.9 metres past it. In between the values blend smoothly. Calm mode makes every flight 15% longer.',
    'Above 1.55 metres the shot is a smash, below 0.8 metres a lob, in between a drive.',
  ] },
  { title: 'Angle and depth', art: 'angle', p: [
    'Sideways: the ball lands at 3.8 metres times how far left or right of the paddle face it met, as a fraction of your reach. Centre contact goes down the middle; full left or right contact goes 3.8 metres to that side. Left and right are as you see them on screen.',
    'Front and back: meeting the ball ahead of the paddle face sends it up to 0.9 metres deeper; meeting it behind sends it up to 0.9 metres shorter.',
  ] },
  { title: 'Sweet hits and accuracy', art: 'sweet', p: [
    'A hit at 0.95 to 1.4 metres high, within 0.9 of your reach of the face, is sweet: it lands exactly where the gold ring promised.',
    'Outside that band the landing spot wobbles: by 0.9 metres per metre below the band and 1.0 per metre above it, and, once the ball is more than 80% of your reach away from the paddle face, by up to 0.3 metres more at the very edge. A wide shot at full stretch can easily go out.',
  ] },
  { title: 'How a rally ends', art: 'land', p: [
    'A rally ends when the ball touches the sand. If it lands on the hitter\'s own side, or outside the lines, the hitter loses the rally. If it lands inside the opposite half and is not returned, the hitter wins it.',
    'A serve the server fails to hit before it lands is a lost rally for the server. The lines count as inside.',
  ] },
  { title: 'Serving', art: 'serve', p: [
    'The server\'s ball is tossed up from about 2 metres and falls. Swing as it drops to choose the pace: swing early for a fast serve, late for a high one.',
    'In a match the server changes every two points; the first server is random. In Beach Rally Dana always serves.',
  ] },
  { title: 'Wind', art: 'wind', p: [
    'Wind pushes the ball sideways. In Beach Rally it starts after 12 hits and grows with the rally, from 0.25 up to 0.75 metres per second squared, always blowing the same way within a run.',
    'In a match you choose None, Breeze (0.35) or Gusty (0.85), and the direction changes each rally. Calm mode has no wind. The arrow in the corner shows its strength and direction, and the gold ring already allows for it.',
  ] },
  { title: 'Beach Rally scoring', art: 'tiers', p: [
    'Each of your returns scores 1 point, or 2 if it is sweet, multiplied by your Rhythm: the multiplier is 1 plus one for every three sweet hits in a row, up to 5. A return that is not sweet, or a missed swing, resets the run of sweet hits.',
    'Dana\'s returns count toward the rally but do not score points. Tiers at 10, 25, 50 and 100 hits are Steady, Flow, Beach Master and Legend. The rally ends the first time the ball touches the sand.',
  ] },
  { title: 'How Beach Rally gets harder', p: [
    'The ball flies up to 18% faster as the rally approaches 70 hits. Dana adapts: she sends easier balls when you are struggling and stretches you wider when you play sweet hits.',
    'The light moves from afternoon to dusk over the first 80 hits. Nothing else changes: the rules stay the same.',
  ] },
  { title: 'Match rules', art: 'score', p: [
    'Every rally is worth a point to the side that did not drop it. The first side to 7 (or 11) wins. There is no extra margin needed.',
    'Your rival\'s name, speed and reaction time are fixed for the match. The light and wind settings only change how the beach looks and feels.',
  ] },
  { title: 'The rivals', art: 'figures', p: [
    'Noa: easygoing. Runs at 3.3 m/s, reacts in 0.40 s, often mistimes. Eli: steady. 3.7 m/s, 0.32 s. Maya: fast feet. 4.5 m/s, 0.27 s.',
    'Gal: tricky placement. 4.0 m/s, 0.24 s, aims for the lines. Shira: relentless. 4.7 m/s, 0.20 s, rarely misreads. Dana, your rally partner, runs at 4.4 m/s and reacts in 0.20 s.',
    'Every rival reads the ball with some error, swings with some timing wobble, and gets less steady in long rallies and at match point. They also have habits you can learn.',
  ] },
  { title: 'Watch & Learn', art: 'think', p: [
    'Two computer players, Maya and Gal, play a match to 3. Whenever the ball is coming to one of them, play freezes. THINK lasts 2, 5, 8 or 10 seconds (you choose; the default is 5). REVEAL lasts 2 seconds and shows the stand spot, the meeting point and the target on the sand with other options dimmed. Then the ball moves and they carry it out.',
    'Pause and Resume freeze everything, including the thinking timer. Exit leaves the demonstration.',
  ] },
  { title: 'Hints', art: 'think', p: [
    'In Beach Rally and Match a hint is available when the ball is coming to you. The coach thinks for up to 1.5 seconds and reveals for 2 seconds while play is frozen, then play continues with the green stand ring and aim ring left on the sand until you hit.',
  ] },
  { title: 'Settings and the free preview', p: [
    'Settings: sound, Calm mode, the gold aim guide, text size (100% to 300%), Watch & Learn thinking time and Restore purchases.',
    'The game starts with a free preview of 90 seconds of play. Menus, these pages and Watch & Learn do not count. After that, one purchase unlocks everything. The web demo allows 6 rallies and the first rival.',
  ] },
];
