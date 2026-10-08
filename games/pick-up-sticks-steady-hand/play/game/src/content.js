// Text for About, How to Play and the Rules reference. Every rule claim below was checked against the engine:
// sim.js (the heap, free and covered sticks, the pull, the fault limit, what counts as lifted), match.js (turns, rounds, the ladder,
// the daily heap) and game.js (flow, the lever, cancelled presses). Numbers: a versus heap has 24 sticks = 1 golden master (20),
// 2 red lacquer (10), 4 jade (5), 6 indigo (3) and 11 bamboo (1): 89 points. A section is { title, art?, p: [paragraphs] };
// the reader flows the lines so nothing ever overflows.

export const ABOUT = [
  { title: 'A game of steady hands', art: 'heap', p: [
    'Children and grown-ups in Europe and in China have played this quiet game for centuries: drop a handful of slender sticks on a table, then lift them out one at a time without making any other stick so much as tremble.',
    'It asks for no speed and no luck. Only a calm touch, a patient eye and a good choice of which stick to take next.',
  ] },
  { title: 'This version', p: [
    'Pick-up Sticks simulates every stick with real contact. Slide a stick out of the heap and any stick it brushes is pushed along with it; pull too fast and the sticks underneath are dragged too. Each stick is lacquered, lit and shaded, with bands that show what it is worth.',
    'Play against one of five rivals with hands of their own, share the phone with a friend, climb the Solo Ladder, take on the Daily Heap that everyone plays the same day, or sit back with Watch & Learn.',
  ] },
  { title: 'Made to be calm', p: [
    'There is no clock. A Hint is always one tap away, Fine touch makes the stick follow your finger a little more gently, and the text can be enlarged on every screen. It is a game of skill and points only: nothing is ever won or lost except points inside the game.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'heap', p: [
    'A heap of sticks lies on the mat. Take turns lifting one stick at a time. Each stick you lift is worth points, shown by its colour and bands. When the heap is gone, the higher total wins.',
  ] },
  { title: 'Lift a free stick', art: 'free', p: [
    'A stick is free when no other stick lies across it. A covered stick cannot be lifted until the stick on top of it has gone. Tap a covered stick and the game tells you so; nothing is lost.',
    'The Hint button shows a free stick worth taking and the way to slide it.',
  ] },
  { title: 'Slide it out, slowly', art: 'pull', p: [
    'Press a free stick, near one end is easiest, and drag. The stick follows your finger. Slide it away from the heap and let go once it is clear of every other stick.',
    'Go slowly. A fast pull drags the sticks it rides over, and a stick that touches another pushes it. The Steady bar at the top shows how close any other stick is to the limit, and the ring around your grip turns amber then red when you are going too fast.',
  ] },
  { title: 'Do not move the others', art: 'fault', p: [
    'If any other stick moves too far, it is a fault: your turn is over. If you let go before the stick is clear, the turn is over too. A press that goes nowhere is simply cancelled.',
    'A turn goes on for as long as you keep lifting sticks cleanly.',
  ] },
  { title: 'Sticks and points', art: 'values', p: [
    'Bamboo is worth 1, indigo 3, jade 5, red lacquer 10 and the golden master 20. A heap of 24 sticks holds 89 points.',
  ] },
  { title: 'The golden lever', art: 'lever', p: [
    'Lift the golden master and you win the lever for the rest of the round. Tap Lever, then press and drag on the table to sweep free sticks aside without a fault. Each player may use it twice per round. A rival who wins it may use it too, when no pull looks safe.',
  ] },
  { title: 'Other ways to play', p: [
    'Solo Ladder: twelve levels, each a bigger and tighter heap with a points goal. Three slips end a heap. The Daily Heap is one heap for everybody on the same day: lift as much as you can before three slips. Watch & Learn plays a whole heap between two rivals with their thinking time on screen; use Pause and Think + / Think − to slow it down.',
  ] },
];

export const RULES = [
  { title: '1. The set-up', art: 'heap', p: [
    'Sticks are dropped on the mat in a heap. A stick that lands across others rests on top of them. A match heap has 24 sticks: 1 golden master, 2 red lacquer, 4 jade, 6 indigo and 11 bamboo.',
    'The Daily Heap has 26 sticks. Solo Ladder heaps grow from 14 sticks at level 1 to 32 at level 10 and above, and get tighter as the levels rise.',
  ] },
  { title: '2. Points', art: 'values', p: [
    'Bamboo 1 point, indigo 3, jade 5, red lacquer 10, golden master 20. A match heap holds 89 points. Points are scored for the player who lifts the stick.',
  ] },
  { title: '3. Free and covered sticks', art: 'free', p: [
    'A stick is free when no other stick crosses it from above. A covered stick cannot be lifted; pressing on it only shows a message. The Show free sticks setting marks every free stick with a dotted line.',
    'Pressing where several sticks cross picks the top-most one.',
  ] },
  { title: '4. Lifting a stick', art: 'pull', p: [
    'Press a free stick and drag. The stick is held where you pressed it and follows your finger; with Fine touch on (the default) it moves 60 per cent as far as your finger. Held near an end it swings as it comes; held near the middle it slides sideways.',
    'The stick is lifted out when it has travelled a short way and no longer touches any other stick. It is then yours, scores its points and leaves the table.',
  ] },
  { title: '5. Contact and pace', art: 'fault', p: [
    'A stick you slide pushes any stick on its own level, or the level just above it, that it touches, and those sticks push others in turn. Sticks it slides over, on a lower level, stay put as long as you go slowly, but are dragged along if you pull faster than about 105 units a second. The pace ring and the Steady bar show this.',
    'Sticks stay where they are pushed; nothing slides back.',
  ] },
  { title: '6. Faults', art: 'fault', p: [
    'While you lift, the game watches every other stick. If an end of any of them has moved further than the limit from where it lay when you pressed (7 units in a match: less than half a stick\'s width), it is a fault. The pull stops, your stick is put back down where it is, and the turn is over.',
    'If you let go before the stick is clear, the stick is put back down where it is and the turn is over. A press that moved less than a thumb-width and is released is cancelled with no penalty.',
  ] },
  { title: '7. Turns', p: [
    'Players take turns. You keep the turn for as long as you lift sticks cleanly; a fault or an early release passes it. The player who goes first alternates from round to round.',
  ] },
  { title: '8. The golden lever', art: 'lever', p: [
    'A player who lifts the golden master wins the lever for the rest of that round. Before lifting, tap Lever, then press and drag on the table: the lever pushes free sticks aside and never causes a fault. It cannot lift anything. Each player may use it twice per round. Covered sticks are not moved by it. A rival who wins the lever may use it too, when no pull looks safe.',
  ] },
  { title: '9. Rounds and winning', art: 'rounds', p: [
    'A round ends when the last stick has been lifted. The points each player scored are added to the match score. A Quick match is one round, a Full match is three. If the match is tied after the last round, one more round is played.',
  ] },
  { title: '10. Solo Ladder and the Daily Heap', p: [
    'Solo Ladder has twelve levels. Each has a points goal, a share of the heap that rises with the level, and the fault limit gets smaller. Reach the goal before your third slip. A fault is a slip; letting go early is not. Finishing with no slips earns three stars, one slip two stars, two slips one star. You must clear a level to unlock the next.',
    'The Daily Heap is one heap that is the same for everybody on the same day. Lift as many points as you can before the third slip, or until the heap is gone. Your best score today and your best ever are kept on this device.',
  ] },
  { title: '11. Hint, Watch & Learn and the free preview', p: [
    'Hint shows the free stick a strong player would take and the direction and pace to slide it. Watch & Learn plays a whole heap between two rivals: each pull has a thinking pause, a reveal that marks the stick and path, and then the lift. You can pause at any moment and change the thinking time.',
    'The web demo includes the first two heaps and the first two ladder levels only. The full game has every rival, all twelve levels, the Daily Heap and unlimited play.',
  ] },
];
