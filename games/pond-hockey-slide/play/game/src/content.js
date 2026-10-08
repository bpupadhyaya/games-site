// The words of the About, How to Play and Rules pages. Each page is a list of sections { title, art?, p: [paragraphs] }.
// `art` names a picture drawn by menus.js with the game's own pond and people. Rules are cross-checked against sim.js,
// match.js and game.js (see STATUS.md). Public text: no business reasoning.

export const ABOUT = [
  {
    title: 'Pond Hockey Slide', art: 'hero',
    p: [
      'A turn-based shinny match on a frozen pond, seen from above. Three skaters a side, one puck, two small goals and no goalies: pull back on a skater, let go, and watch real physics decide what happens next.',
      'Pond hockey is the game Canadians play on frozen lakes, rivers and backyard rinks all winter long, with snowbanks for boards, boots for goal posts and a toque on every head. This game takes that feeling and puts it in your thumb.',
    ],
  },
  {
    title: 'What is in the game',
    p: [
      'Play against four computer rivals who get sharper from Pip to Jolene, share the phone in two-player mode with a hand-over card, or sit back with Watch & Learn and see why a good player chooses the shot they choose. A Hint is always one tap away.',
      'Every pond is different: loose snow drifts scatter across the ice after each goal and slow anything that crosses them. Quick matches go to 3 goals and full matches to 5.',
      'Rules, How to Play and this page can be read at any text size up to 300%. The pond turns sideways on a wide screen so it always uses the whole display.',
    ],
  },
  {
    title: 'Credits and the free preview',
    p: [
      'The first 90 seconds of real play are free. Menus, rules, Watch & Learn and pauses never use up the preview. One purchase unlocks the full game on this device, with no ads and no timers.',
      'Made by Arcforge: polished world heritage games that work offline. All artwork and sound are drawn and synthesised inside the game.',
    ],
  },
];

export const HOWTO = [
  {
    title: 'Take your shot', art: 'pull',
    p: [
      'Press one of your skaters (you are the cedar-red team, shown at the bottom, or on the left of the screen when it is wide) and pull back like a slingshot. The skater glides the other way when you let go.',
      'How far you pull sets the power; the direction you pull sets the aim. A dotted line shows the path of the skater up to its first contact, and a gold line shows where the puck goes if the skater hits it.',
    ],
  },
  {
    title: 'Score a goal', art: 'goal',
    p: [
      'Get the whole puck over the goal line between the two red posts at the far end. There are no goalies, but skaters are solid: the rival side will happily park a body in front of the net.',
      'Banks help you: the puck and the skaters bounce off the snowbanks, so a bank shot can find the goal from a bad angle.',
    ],
  },
  {
    title: 'Take turns', art: 'turns',
    p: [
      'You and your rival shoot one skater each in turn. Everything keeps sliding until it stops, then the other side shoots. After a goal the pond is cleared, new snow drifts appear and the side that conceded shoots first.',
      'First to the goal total wins (3 in a quick match, 5 in a full one). If nobody gets there in 18 shots each, the leader wins; a tie goes to sudden death where the next goal wins.',
    ],
  },
  {
    title: 'Snow drifts and help', art: 'snow',
    p: [
      'Loose snow drags at skaters and the puck: a drift can stop a shot dead, so aim around them or use them to stop a rival.',
      'Hint shows a good shot for you with a plain-language reason. Watch & Learn plays two rivals against each other: they think, show what they plan, then shoot; use Pause to stop everything and Think + / Think - to change how long they take.',
      'On a computer keyboard: A and D choose a skater, the arrow keys aim and set the power, Space shoots, H asks for a Hint, P pauses.',
    ],
  },
];

export const RULES = [
  {
    title: '1. The pond and the people', art: 'pond',
    p: [
      'The ice is a rounded rectangle with a snowbank all around it. A small goal sits in the middle of each short end, two red posts with a net behind. There are no goalies and no other lines that matter.',
      'Each side has three skaters and there is one puck. You are the cedar-red side and your goal is behind you (the bottom of the screen in portrait, the left in landscape). Your rival is lake blue and defends the other goal. In two-player and Watch & Learn the same pond is used.',
      'At the start of a match and after every goal the skaters line up in their starting spots, the puck is in the centre and the drifts (see section 6) are laid out afresh.',
    ],
  },
  {
    title: '2. Taking a shot', art: 'pull',
    p: [
      'On your turn you move exactly one of your own skaters. Press near the skater you want and pull away from the direction you want to go; let go to launch. A pull shorter than a thumb-width does nothing, and a tap on empty ice only puts the aim away.',
      'The pull length sets the launch speed, from a gentle slide to a full-power dash; the pull direction sets the heading. The skater leans, pushes off and swings the stick as it goes.',
      'There are no fouls, no offside and no faceoffs: any skater may be moved on any turn, and a shot that touches nothing is simply a shot that touched nothing.',
    ],
  },
  {
    title: '3. Gliding and bouncing', art: 'bank',
    p: [
      'Every skater and the puck slide on ice with real momentum. The ice has very little friction, so a skater keeps gliding and slows down gradually. Heavy skaters push the light puck much further than the puck pushes them back.',
      'The snowbanks and the goal posts are solid. A skater or the puck that hits one bounces off, losing a little speed. The corners of the pond are rounded. A skater never enters a net: the goal line is a wall for skaters, but the puck can cross it between the posts.',
      'Skaters can bump each other. A skater that hits another passes some of its motion on, so you can use a skater to push a rival out of a lane or to shove the puck with a second body.',
    ],
  },
  {
    title: '4. Striking the puck', art: 'strike',
    p: [
      'When a moving skater touches the puck the stick swings and the puck leaves in the direction the contact pushes it. Hitting the puck dead centre sends it straight along your line of travel; clipping its edge sends it off at an angle. Aim the skater at the spot just behind the puck on the line you want it to take.',
      'The puck keeps sliding after the strike and bounces off banks and posts like everything else, but it loses speed more slowly than a skater, so a hard strike can cross the whole pond.',
    ],
  },
  {
    title: '5. Scoring', art: 'goal',
    p: [
      'A goal counts when the whole puck is over the goal line between the two posts. It counts for the side that attacks that goal, whichever skater put the puck there: a puck into the goal at the top is a goal for the bottom side, and a puck into the goal at the bottom is a goal for the top side. An own goal therefore counts for the rival.',
      'After a goal the celebration plays, the score goes up by one, the pond is reset and the side that conceded the goal shoots first.',
      'The match is won by the first side to reach the goal total: 3 goals in a Quick match, 5 in a Full match.',
    ],
  },
  {
    title: '6. Snow drifts', art: 'snow',
    p: [
      'After each reset there are between none and three round drifts of loose snow on the ice, never on the puck or on a starting skater. A skater or the puck inside a drift slows down much faster than on bare ice and can stop completely in it.',
      'The drifts stay where they are until the next goal. A skater that is stopped in a drift is not stuck: it can be launched again on a later turn.',
    ],
  },
  {
    title: '7. Turns', art: 'turns',
    p: [
      'After you launch a skater everything keeps moving until all the skaters and the puck have come to rest (or until a goal). Only then does the other side shoot. You cannot move during the other side\'s shot.',
      'Each side may take 18 shots in a match. When both sides have used them the side with more goals wins. If the score is level the match goes to sudden death: shots continue and the next goal wins.',
    ],
  },
  {
    title: '8. Hint, Calm mode and Watch & Learn',
    p: [
      'Hint asks the strongest computer player for a good shot in your position. It shows the skater, the line of the push and a plain-language reason; it never shoots for you. Calm mode (in Settings) shows the whole predicted path of the skater instead of most of it.',
      'Watch & Learn plays two computer rivals against each other for a whole match. Each turn they THINK (2, 5, 8 or 10 seconds, set with Think + and Think -), REVEAL their plan for two seconds with the chosen skater ringed and the path drawn, then ACT. Pause stops everything where it is, including the thinking, and Resume carries on exactly from there.',
    ],
  },
  {
    title: '9. The rivals',
    p: [
      'Pip is still learning to skate and often fluffs the shot. Marlow plays every Saturday and finds the direct line to goal. Dale loves a bank shot and thinks about your reply. Jolene is a pond hockey legend: she tries many shots, looks at what you can do afterwards and rarely misses an open net.',
      'Every rival uses the same physics you do; they only differ in how many shots they try and how precisely they execute.',
    ],
  },
  {
    title: '10. Two players, text size and the free preview',
    p: [
      'In two-player mode one phone is shared. The pond never turns; after each shot a hand-over card covers the controls until the next player taps it, so nobody sees the aim of the other by accident.',
      'Text size (Settings, or A- and A+ on the reading pages) goes from 100% to 300% and the menus scroll when they no longer fit. The first 90 seconds of real play are free; menus, rules, Watch & Learn and pauses never count. In the web demo you can play one match against the first two rivals.',
    ],
  },
];
