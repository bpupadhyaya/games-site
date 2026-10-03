// Text for About, How to Play and the Rules reference. Every rule claim below was checked against the engine:
// sim.js (yard geometry, throwing, flight and bounce, the can, picking up, standing the can, tagging, round end), game.js
// (roles, scoring, rounds, saving, Think, Watch & Learn) and ai.js (the five rivals). Numbers: yard 6.4 m wide and 10 m long,
// toe line at 0, the can 4.6 m from it in a chalk circle of 0.85 m radius, tag reach 0.62 m, pick-up reach 0.6 m.
// A section is { title, art?, p: [paragraphs] }; the reader paginates the lines so nothing overflows at any text size.

export const ABOUT = [
  { title: 'A street game from the Philippines', art: 'yard', p: [
    'Tumbang preso is a traditional street game played by children across the Philippines, in yards, parks and quiet streets. The players need very little: an empty tin can, a slipper each, and a line and a circle scratched in the dirt or drawn in chalk.',
    'The name is usually explained as "knock down the prisoner": the can is the preso, the prisoner, and one player, the taya, has to keep watch over it.',
  ] },
  { title: 'How the game goes', p: [
    'Everyone else stands behind a line and throws a slipper at the can. A hit knocks it over, and now the guard must run, pick the can up and stand it in its circle again, while everybody races to fetch their slippers. A thrower who is caught out in the open by the guard has to take over as the guard.',
    'Rules and names differ from street to street, and there are many ways to play. The Rules pages say exactly how this version works.',
  ] },
  { title: 'This version', p: [
    'Tumbang Preso: Can Toss turns the street game into a real-time game on your phone. You play one role for a whole match: a thrower, or the guard. The other players are computer players at five levels.',
    'The slippers fly, bounce and skid with real physics, the can rolls, and the players are simple round tokens that run, lean and turn smoothly. Nothing shakes or zooms: the yard is always seen from the same place.',
  ] },
  { title: 'Ways to play', p: [
    'Play a match as a thrower or as the guard, learn the game in short lessons, or choose Watch & Learn and see why each computer player makes its choices. The Think button gives you advice with the numbers behind it.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'yard', p: [
    'A can stands in a chalk circle. The guard protects it. Throwers stand behind the toe line and throw their slippers at the can. When the can falls, the guard must put it back up before tagging anyone, and the throwers run to get their slippers back.',
    'Behind the toe line you are safe. Out in the yard you can be tagged, but only while the can is standing.',
  ] },
  { title: 'Playing as a thrower', p: [
    'Drag on the yard to move the target ring to where the slipper should land. Choose Lob (high, easy to place) or Skim (low and fast, sends the can far) and press Throw. Aim at the middle of the can.',
    'After a hit, the can is down and the guard has to go and fetch it. Press Fetch slipper to run for yours and bring it home, or touch the yard to steer yourself. Press Run home at any time to dash back behind the line.',
    'Points: 2 for every hit, 1 for every slipper you bring home safely, minus 2 if you are tagged. To win the match, stay free: be tagged in at most 1 round of a 3-round match, or 2 rounds of a 5-round match.',
  ] },
  { title: 'Playing as the guard', p: [
    'Touch the yard and your token runs towards your finger. Press Fix can to fetch a fallen can, carry it into the circle and stand it up. Press Chase and your token goes after the thrower most likely to be caught.',
    'You can only tag while the can is standing. Stand between a runner and their slipper, and do not wander far from the can.',
    'Each round where you tag a thrower is a point. Win the match by tagging often enough.',
  ] },
  { title: 'Think, Learn and Watch & Learn', p: [
    'Think shows a hint with the numbers behind it, for example how many seconds a fetch will take and how long the guard needs to get there. Learn has short hands-on lessons and three quick questions. Watch & Learn plays a whole round between computer players, stops before each important choice and explains it.',
    'You can pause at any time. A match you leave is saved from the start of the current round and offered as Continue.',
  ] },
];

export const RULES = [
  { title: 'The yard', art: 'yard', p: [
    'The yard is a flat dirt area 6.4 m wide and 10 m long. A chalk toe line crosses it near the players. Everything behind the toe line is home. A can stands 4.6 m beyond the toe line in the middle of a chalk circle with a radius of 0.85 m.',
    'The yard has a wall at the far end and a kerb on each side. Slippers and the can that reach a wall or kerb bounce back from it.',
  ] },
  { title: 'The players', p: [
    'There are four players: one guard (the taya) and three throwers. Each thrower has one slipper. In a match you take one role and keep it for every round. All other players are computer players.',
    'Everyone runs at a similar speed, but a guard carrying the can runs at about three quarters of normal speed. The guard may never cross the toe line into home.',
  ] },
  { title: 'Throwing', art: 'throw', p: [
    'A thrower can throw whenever they hold their slipper, stand at home (behind the toe line) and the can is standing in its circle. There is no turn order: any thrower with a slipper in hand may throw at any time, and several slippers may be in the air together.',
    'Lob: a high arc taking about 1.15 seconds, easier to place. Skim: a low, quick throw taking about half a second, harder to place, which sends the can further when it hits. Every throw scatters a little around the target ring; the ring on the yard shows roughly how much.',
    'While the can is down, being carried or still being stood up, a thrower holds on to their slipper.',
  ] },
  { title: 'A slipper in flight', p: [
    'A slipper flies on an arc, bounces a little where it lands and then skids to a stop on the dirt. It spins as it flies. A slipper that skids into a wall bounces back.',
    'A slipper that touches the standing can with enough speed knocks it over. A gentle touch only makes the can ring and rock, and it stays up. The slipper that hits the can bounces back off it.',
  ] },
  { title: 'A fallen can', art: 'can', p: [
    'A hit sends the can flying and rolling away from the slipper. The harder and flatter the throw, the further it goes. It bounces off the walls and comes to rest on its side.',
    'The guard must run to it, pick it up (within 0.6 m, once it has nearly stopped), carry it back into the chalk circle and stand still inside the circle for 0.4 seconds to stand it up. Then the can is standing in the middle of the circle again.',
    'For a moment after the can stands, the guard cannot tag (0.45 seconds), so a runner who is right next to the circle gets a fair chance.',
  ] },
  { title: 'Fetching a slipper', p: [
    'Once a thrown slipper has stopped, its owner may run out and pick it up by getting within 0.6 m of it. A thrower can only pick up their own slipper. A slipper still in the air or skidding fast cannot be picked up.',
    'After picking it up the thrower should return behind the toe line. A thrower who gets home with a slipper they fetched from the yard earns a point for a safe return. A slipper that landed behind the line is picked up for free.',
  ] },
  { title: 'Tagging', art: 'tag', p: [
    'The guard tags a thrower by getting within 0.62 m of them (the red ring around the guard shows the reach). A tag only counts when the thrower is in front of the toe line and the can is standing in its circle and the 0.45 second pause after standing it has finished.',
    'While the can is down, the guard cannot tag anyone. This is the throwers\' chance to run for their slippers. The ring around the guard is grey and dashed while no tag is possible.',
    'A thrower behind the toe line can never be tagged.',
  ] },
  { title: 'Ending a round', p: [
    'A round ends when a thrower is tagged. In the street game that thrower becomes the next guard; here your role never changes, so a tag simply ends the round: when you are the thrower it is a strike if it was you who was tagged, and when you are the guard it is a point for you.',
    'A round also ends after 80 seconds of play: the guard is tired and the throwers escape.',
    'A round starts with Ready... Go! and nobody can move for the first second or so.',
  ] },
  { title: 'Scoring: playing as a thrower', p: [
    'You score 2 points for each of your slippers that hits the can and 1 point for each safe return with a slipper fetched from the yard. If you are tagged you lose 2 points. If the 80 seconds run out, you score 2 points. Your two friends are computer throwers who play carefully; their scores are not counted.',
    'What decides the match is how often you are tagged. You win a 3-round match if you are tagged in at most 1 round, and a 5-round match if you are tagged in at most 2. A round that ends because a friend was tagged does not count against you.',
  ] },
  { title: 'Scoring: playing as the guard', p: [
    'You score one point for each round in which you tag a thrower. A round that ends because the time ran out is an escape for the throwers.',
    'In a 3-round match you need 2 tags to win; in a 5-round match you need 3.',
  ] },
  { title: 'The five rivals', p: [
    'Computer players come at five levels. As guards they run faster and react quicker with each level, lead their runner and cut it off from its slipper. As throwers they aim more accurately, run faster and judge much better when it is safe to fetch a slipper. When you are a thrower, you choose the guard\'s level; your two friends always play carefully.',
    'Each level was measured in many simulated rounds: every level lasts longer as a thrower, or catches more as a guard, than the one below. The web demo includes the first two levels.',
  ] },
  { title: 'Controls and help', p: [
    'Thrower: drag on the yard to move the target ring, choose Lob or Skim, press Throw. Fetch slipper and Run home steer your token for you, and touching the yard steers it yourself.',
    'Guard: touch the yard to run there, Fix can fetches and stands up the can, Chase goes after the runner most likely to be caught.',
    'Think shows advice and its reason. The pause button opens the pause menu with these Rules, How to Play and the text size. Text size goes up to 300% on every screen.',
  ] },
  { title: 'What this version simplifies', p: [
    'Your role is fixed for the whole match; in the street game the tagged player becomes the guard. The guard never has to pick the first guard by a throwing contest. The can always returns to the middle of the circle. Slippers fly through the guard without touching, and each thrower has just one slipper.',
    'Some street versions use a "dangkal" rule for slippers lying close to the can, or two throwing lines on narrow streets. This game does not include them.',
    'A match saved with Continue resumes at the start of the round you were playing, with your scores kept.',
  ] },
];
