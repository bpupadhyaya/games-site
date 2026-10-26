// The words of the About, How to Play and Rules pages. Each page is a list of sections { title, art?, p: [paragraphs] }.
// `art` names a picture drawn by menus.js with the game's own table, paddles and puck. Rules are cross-checked against
// sim.js, match.js, ai.js and game.js (see STATUS.md). Public text: no business reasoning.

export const ABOUT = [
  {
    title: 'Cymbergaj', art: 'hero',
    p: [
      'Cymbergaj is the Polish game of the puck table: two players, one paddle each, a brass puck and a goal at either end. Slide your paddle, strike the puck and send it past your rival before it comes back at you. It is quick to learn, quick to play and very hard to put down.',
      'The game is told in Poland as a holiday and tavern favourite: a table you remember from summer camps, seaside kiosks and village halls, where a crowd gathers behind every match. Its older story is even smaller. Before tables floated the puck on air, players flicked coins along a tabletop with a comb or a ruler, and the same name and the same feeling carried over.',
    ],
  },
  {
    title: 'What is in the game',
    p: [
      'Play against five computer rivals who get sharper from Staś to Pan Marek, share one phone in two-player mode with a paddle under each thumb, or sit back with Watch & Learn and see why a good player chooses the shot they choose. A Hint is one tap away.',
      'Matches go to 5 goals (quick) or 7 (full). The table turns sideways on a wide screen so it always uses the whole display, and a calm mode slows the puck down.',
      'Rules, How to Play and this page can be read at any text size up to 300%.',
    ],
  },
  {
    title: 'Credits and ads',
    p: [
      'Free to play with short ads; go ad-free once.',
      'Made by Arcforge: polished world heritage games that work offline. The table, paddles, puck, hands and onlookers are lit 3D drawn on your device, and all sound is synthesised inside the game.',
    ],
  },
];

// main.js hands over the 3D library credits (vendor3d/LICENSES.md) so About shows them in the same zoomable reader.
export function setLicenses(text) {
  if (!text || ABOUT.some((b) => b.title === '3D credits and licences')) return;
  const paras = String(text).split(/\n{2,}/).map((x) => x.replace(/^#+\s*/gm, '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 14);
  ABOUT.push({ title: '3D credits and licences', p: paras });
}

export const HOWTO = [
  {
    title: 'Slide to move', art: 'move',
    p: [
      'Put a finger anywhere on the table and slide. Your paddle (the red one, on the bottom half, or on the left when the screen is wide) follows your finger and rides a little ahead of it, so your thumb never hides it. Lift your finger and the paddle waits where you left it.',
      'On a computer, move the mouse, or use the arrow keys or WASD. P or Escape pauses; H asks for a hint.',
    ],
  },
  {
    title: 'Hit the puck', art: 'bank',
    p: [
      'Strike the puck with a moving paddle: the faster your paddle is going when it touches, the faster the puck leaves. Hit it straight at the goal, or bounce it off a side wall for a bank shot your rival is not expecting.',
      'Your paddle has to stay on your own half. Use that: a good defender stands in the lane, waits, and punches the puck back the moment it arrives.',
    ],
  },
  {
    title: 'Score a goal', art: 'goal',
    p: [
      'Get the puck into the goal at the far end, between the two brass posts. The posts are solid and the puck will bounce away from them, so aim for the middle.',
      'The first side to 5 goals wins a quick match, to 7 a full one. After a goal, the side that conceded serves.',
    ],
  },
  {
    title: 'Serve and keep it moving', art: 'serve',
    p: [
      'A 3-2-1 counts you in and the puck waits on the server’s half. Nobody may leave the puck alone: after seven seconds of resting on one side it is handed to the other.',
    ],
  },
  {
    title: 'Hint, Watch & Learn and two players', art: 'coach',
    p: [
      'Tap Hint and the table freezes for a moment: a dashed gold line shows a good shot, a white ring shows where to stand, and a line of words says why. Tap again, or wait six seconds, to carry on.',
      'Two players: both thumbs at once, one on each half. Watch & Learn: two computer players play to 3; before every serve the server thinks, shows its plan for two seconds, then serves.',
    ],
  },
];

export const RULES = [
  {
    title: 'The table', art: 'hero',
    p: [
      'The table is a long playing surface with a rounded corner at each end, a low rail all the way round and a goal mouth in the middle of each short end. The goal mouth is a little under half the width of the table, with a brass post on each side and a small pocket behind it.',
      'A line runs across the middle. The puck crosses it freely; the paddles never do.',
    ],
  },
  {
    title: 'Your half and theirs', art: 'halves',
    p: [
      'Each player owns one half of the table and defends the goal at its end. Your paddle can go anywhere on your half, right up to the middle line and into the corners, and nowhere else: it stops at the line and it cannot enter the goal pocket.',
      'In portrait you are the red paddle at the bottom and the rival is the teal paddle at the top. When the screen is wide the table turns a quarter turn: you are on the left and the rival is on the right.',
    ],
  },
  {
    title: 'The puck and the paddles',
    p: [
      'The puck is a brass coin riding a cushion of air, so it keeps travelling for a long time and loses very little speed on the rail. It has a speed limit: even the hardest strike cannot make it faster than that.',
      'A paddle is a heavy disc. When the puck meets it, the puck rebounds like a ball off a wall and also picks up the paddle’s own motion, so a paddle moving towards the puck sends it away much faster than one that is standing still. A fast sweep also gives the puck a small spin that shows on the coin; the spin does not bend its path.',
      'A puck that touches a post or the rail bounces off; corners are rounded so it never gets stuck.',
    ],
  },
  {
    title: 'Scoring and winning',
    p: [
      'A goal is scored when the puck goes in the goal mouth, past the line between the two posts. The goal counts for the player at the other end of the table, so a puck you knock into your own goal is a point for your rival.',
      'The first side to reach the goal total wins the match: 5 goals in a quick match, 7 in a full match, and 3 in Watch & Learn. There are no draws and no time limit.',
    ],
  },
  {
    title: 'Serving', art: 'serve',
    p: [
      'At the start of a match the server is chosen at random. After every goal the side that conceded serves, so the player who was just scored on always gets the puck back.',
      'For a serve the puck sits on the server’s half, in front of the goal. A 3-2-1 count runs while the paddles settle, nobody can touch the puck until it ends, and then play is live. The other side cannot reach the puck at all until it has crossed the middle line.',
    ],
  },
  {
    title: 'The seven-second rule',
    p: [
      'A puck that is resting or nearly stopped on one half for seven seconds is picked up and placed on the other half’s serve spot, so nobody can sit on it. A reminder appears three seconds before.',
      'The count resets the moment the puck is moving again and while a serve is waiting to be played.',
    ],
  },
  {
    title: 'Bank shots', art: 'bank',
    p: [
      'The rail is a mirror: the puck leaves at the same angle at which it arrived, losing only a little speed. Aim at the side wall instead of the goal and the puck rebounds across the table, often past a paddle that was only guarding the straight line.',
      'The posts also bounce the puck, a little less lively than the rail.',
    ],
  },
  {
    title: 'Controls',
    p: [
      'Touch: press anywhere on the table and slide. The paddle follows your finger on your half and rides a short way ahead of it so the finger does not cover it. When you lift your finger the paddle stays where it was.',
      'Mouse: move the mouse; click and drag works too. Keyboard: arrow keys (or WASD) move your paddle, P or Escape pauses, H shows the hint, A- and A+ change the text size on text screens.',
      'Two players on one device: each thumb takes the paddle of the half it touches first. On a computer, the mouse and the arrows are Player 1 and WASD is Player 2.',
    ],
  },
  {
    title: 'The five rivals',
    p: [
      'Staś is a beginner: slow to see the puck and happy to hit it straight. Ola is a tavern regular who defends sensibly. Kuba, a summer champion, uses the side wall. Basia, a club player, reads bank shots early and returns the puck hard. Pan Marek, the table master, is fast, calm and uses fakes.',
      'All five follow the same rules as you. They differ only in how quickly they see the puck, how fast their paddle can move, how accurately they aim and how often they choose a bank shot.',
    ],
  },
  {
    title: 'Hint', art: 'coach',
    p: [
      'Hint is available in a match against the computer. It freezes the table for up to six seconds and asks the strongest rival what it would do. A gold dashed line shows the shot (with its bounce), a white ring shows where to stand, and one line of words explains it.',
      'Tap Hint again, or anywhere on the table, to carry on. Free to play with short ads; go ad-free once.',
    ],
  },
  {
    title: 'Watch & Learn',
    p: [
      'Two computer players play a match to 3. Before each serve the server thinks for the time set in Settings or with the Think buttons (2, 5, 8 or 10 seconds, 5 by default), then shows its plan for two seconds: the dashed line is the shot, the ring is where the paddle stands. Then it serves and the rally runs live.',
      'Pause freezes everything exactly where it is, including the thinking timer, and resumes from the same place. Leave returns to the menu.',
    ],
  },
  {
    title: 'Calm mode and text size',
    p: [
      'Calm mode, in Settings and in the pause menu, makes the puck slower and the table softer so there is more time to see what is coming.',
      'Text size goes from 100% to 300% on every page and screen; pages scroll when the text no longer fits.',
    ],
  },
  {
    title: 'What is simplified',
    p: [
      'This is a game about the feeling of the table, not an exact copy of any tournament rulebook. There are no fouls, no timeouts and no goalkeeper hands; the paddle is a single disc; and the puck has a speed limit so a very hard shot stays fair. A real table has a physical air supply; here the air is the soft glow of the holes around the puck.',
    ],
  },
];
