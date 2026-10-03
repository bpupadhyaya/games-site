// Text for About, How to Play and the Rules reference. Every rule claim below was checked against the engine:
// sim.js (yard geometry, throwing, flight and bounce, the can, picking up, standing the can, tagging, round end), game.js
// (roles, scoring, rounds, saving, Think, Watch & Learn) and ai.js (the five rivals). Numbers: yard 6.4 m wide and 10 m long,
// toe line at 0, the can 4.6 m from it in a chalk circle of 0.85 m radius, tag reach 0.62 m, pick-up reach 0.6 m.
// A section is { title, art?, p: [paragraphs] }; the reader is one scrolling column, so nothing overflows at any text size.

export const ABOUT = [
  { title: 'A street game from the Philippines', art: 'yard', p: [
    'Tumbang preso is a traditional street game played by children across the Philippines, in yards, parks and quiet streets. It needs very little: an empty tin can, a slipper each, and a line and a circle scratched in the dirt or drawn in chalk.',
    'The name is usually explained as "knock down the prisoner": the can is the preso, the prisoner, and one player, the taya, keeps watch over it.',
  ] },
  { title: 'How the street game goes', p: [
    'Everyone else stands behind a line and throws a slipper at the can. A hit knocks it over, and now the guard must run, pick the can up and stand it in its circle again, while everybody races to fetch their slippers. In the street game, a thrower who is caught out in the open becomes the next guard. Rules and names differ from street to street.',
  ] },
  { title: 'This version', p: [
    'Tumbang Preso: Can Toss turns the street game into a real-time game on your phone. You keep one role for a whole match, thrower or guard, and the other players are computer players at five levels. Here a tag simply ends the round: the roles never swap.',
    'The slippers fly, bounce and skid with real physics, the can rolls, and the players are stylised wooden-mannequin figures that run, swing their arms and throw. Nothing shakes or zooms: the yard is always seen from the same place.',
  ] },
  { title: 'Ways to play', p: [
    'Play a match as a thrower or as the guard, learn the game in short lessons, or choose Watch & Learn to see why each computer player makes its choices. The Think button gives you advice with the numbers behind it. Text size goes up to 300%, and long screens scroll.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'yard', p: [
    'A can stands in a chalk circle and the guard protects it. Throwers stand behind the toe line and throw their slippers at the can. When the can falls, the guard must put it back up before tagging anyone, and the throwers run to get their slippers back.',
    'Behind the toe line you are safe. Out in the yard you can be tagged, but only while the can is standing. A tag ends the round; roles never swap.',
  ] },
  { title: 'Playing as a thrower', p: [
    'Drag on the yard to move the target ring (it clicks onto the middle of the can when you are close). Choose Lob (high, easy to place) or Skim (low and fast, sends the can far) and press Throw. At 200% text and above, Set up holds Lob, Skim and Think.',
    'After a hit, the guard must fetch the can. Press Fetch slipper to run for yours, touch near it, or steer yourself by dragging. Run home dashes back behind the line.',
    'Points: 2 for every hit, 1 for every safe return, minus 2 if you are tagged. You win the match by staying free: be tagged in at most 1 round of 3, or 2 of 5.',
  ] },
  { title: 'Playing as the guard', p: [
    'Touch the yard and your guard runs towards your finger. Fix can fetches a fallen can, carries it into the circle and stands it up. Chase goes after the thrower most likely to be caught.',
    'You can only tag while the can is standing. Stand between a runner and their slipper, and do not wander far from the can. Each round where you tag a thrower is a point; win the match by tagging often enough (2 of 3 rounds, 3 of 5).',
  ] },
  { title: 'Think, Learn and Watch & Learn', p: [
    'Think shows a hint with the numbers behind it. Learn has short hands-on lessons and three quick questions. Watch & Learn plays a whole round between computer players and stops before each important choice to explain it.',
    'Pause any time. A match you leave is saved from the start of the current round and offered as Continue. Settings has sound, vibration and text size.',
  ] },
];

export const RULES = [
  { title: 'The yard', art: 'yard', p: [
    'The yard is flat dirt, 6.4 m wide and 10 m long, with a wall at the far end and a kerb on each side: slippers and the can bounce off them. A chalk toe line crosses the yard near the players; everything behind it is home. A can stands 4.6 m beyond the line in the middle of a chalk circle of 0.85 m radius.',
  ] },
  { title: 'The players', p: [
    'Four players: one guard (the taya) and three throwers, each with one slipper. You take one role and keep it for every round of the match; all other players are computer players.',
    'Everyone runs at a similar speed. A guard carrying the can runs at about three quarters of normal speed, and never crosses the toe line into home.',
  ] },
  { title: 'Throwing', art: 'throw', p: [
    'A thrower can throw whenever they hold their slipper, stand at home and the can is standing in its circle. There is no turn order, and several slippers may be in the air together. While the can is down, being carried or being stood up, a thrower keeps the slipper.',
    'Lob: a high arc of about 1.15 seconds, easier to place. Skim: a low, quick throw of about half a second, harder to place, which sends the can further when it hits. Every throw scatters a little around the target ring.',
  ] },
  { title: 'A slipper in flight', p: [
    'A slipper flies on an arc, spins, bounces where it lands and skids to a stop. Touching the standing can with enough speed knocks it over, and the slipper bounces back. A gentle touch only rocks the can: it stays up.',
  ] },
  { title: 'A fallen can', art: 'can', p: [
    'A hit sends the can flying and rolling away: the harder and flatter the throw, the further. It bounces off the walls and comes to rest on its side.',
    'The guard picks it up (within 0.6 m, once it has nearly stopped), carries it into the chalk circle and stands still inside for 0.4 seconds to stand it up. The guard then cannot tag for 0.45 seconds, so a runner right next to the circle gets a fair chance.',
  ] },
  { title: 'Fetching a slipper', p: [
    'Once a slipper has stopped, only its owner can pick it up, by getting within 0.6 m. A slipper still in the air or skidding fast cannot be picked up. A thrower who gets home with a slipper fetched from the yard earns a point for a safe return; a slipper that landed behind the line is picked up for free.',
  ] },
  { title: 'Tagging', art: 'tag', p: [
    'The guard tags a thrower by getting within 0.62 m (the ring around the guard shows the reach). A tag counts only when the thrower is in front of the toe line, the can is standing and the 0.45 second pause after standing it is over. The ring is red while a tag is possible and grey and dashed while it is not.',
    'While the can is down the guard cannot tag anyone: that is the throwers\' chance to run for their slippers. A thrower behind the toe line can never be tagged.',
  ] },
  { title: 'Ending a round', p: [
    'A round ends when a thrower is tagged. In the street game that thrower becomes the next guard; here your role never changes, so a tag simply ends the round. As the thrower it counts as a strike if you were tagged; as the guard it is a point for you.',
    'A round also ends after 80 seconds: the guard is tired and the throwers escape. Each round starts with Ready... Go! and nobody can move for the first second or so.',
  ] },
  { title: 'Scoring', p: [
    'As a thrower you score 2 points for each of your slippers that hits the can, 1 for each safe return from the yard and 2 if the 80 seconds run out; being tagged costs 2. Your two friends are careful computer throwers whose scores are not counted.',
    'What decides the match is how often you are tagged: tagged in at most 1 round of a 3-round match, or 2 of a 5-round match, and you win. A round ended by a friend\'s tag does not count against you.',
    'As the guard you score one point for each round in which you tag a thrower; a round that times out is an escape. You need 2 tags in 3 rounds, or 3 tags in 5.',
  ] },
  { title: 'The five rivals', p: [
    'As guards the computer players run faster and react quicker with each level, lead their runner and cut it off from its slipper. As throwers they aim better, run faster and judge much better when it is safe to fetch a slipper. When you throw, you choose the guard\'s level; your friends always play carefully.',
    'Each level was measured in many simulated rounds: every level lasts longer as a thrower, or catches more as a guard, than the one below. The web demo includes the first two levels.',
  ] },
  { title: 'Controls and help', p: [
    'Thrower: drag on the yard to move the target ring, choose Lob or Skim, press Throw; Fetch slipper and Run home steer your thrower, and touching the yard steers it yourself. Guard: touch the yard to run there, Fix can stands the can up, Chase goes after the runner most likely to be caught.',
    'Think shows advice and its reason. The pause button opens Rules, How to Play, sound, vibration and text size. Text size goes up to 300% on every screen, and long screens scroll.',
  ] },
  { title: 'What this version simplifies', p: [
    'Your role is fixed for the match, where in the street game the tagged player becomes the guard. The first guard is not chosen by a throwing contest, the can always returns to the middle of the circle, slippers fly through the guard without touching and each thrower has one slipper.',
    'Some street versions use a "dangkal" rule for slippers lying close to the can, or two throwing lines on narrow streets; this game does not. A match saved with Continue resumes at the start of the round you were playing, with your scores kept.',
  ] },
];
