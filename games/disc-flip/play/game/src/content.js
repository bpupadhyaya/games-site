// Text for About, How to Play and the Rules reference. Every rule claim below was checked against the engine:
// sim.js (mat, winks, cup, hop, landing, squop, pile, blast), match.js (rounds, bonus shots, passes, count, tie-break),
// game.js (controls and flow). Numbers: the mat is 600 x 900 units, a wink is 30 across, the cup mouth is 64 across and a
// wink drops in when its middle lands within 19 units of the cup middle. A section is { title, art?, p: [paragraphs] }.

export const ABOUT = [
  { title: 'A parlour game from England', art: 'mat', p: [
    'Disc-flip is the traditional English game known as tiddlywinks. You press a large disc, the squidger, on the edge of a small disc, the wink, and it hops across the mat: into a cup in the middle, or on top of a rival\'s wink.',
    'It was a favourite of Victorian parlours, and since the 1950s it has also been a competitive club sport with its own tournaments and its own words: squidger, squop, boondock, bomb. Cousins of the game, often called flea games, are played all over Europe.',
  ] },
  { title: 'A game of small decisions', p: [
    'Every shot is a choice. Hop closer to the cup, or go for it from here? Take the sure short shot, or the long wild one? Pot a wink of your own, or land on a rival wink and freeze it where it lies?',
    'A rival wink that has been landed on cannot be shot until it is freed, so a well-placed squop can win a match.',
  ] },
  { title: 'This version', p: [
    'Disc-flip plays on a felt mat under a lamp. The aim line and the landing oval show where a wink will come down and how wide a miss may be, and the odds of a pot or a squop appear as you pull back. A steadiness ring rewards a calm release.',
    'Play one of four computer rivals, share the phone with a friend, or sit back with Watch & Learn and see why a skilled player picks each shot.',
  ] },
  { title: 'About the rules', p: [
    'Clubs play with four colours and a points table. This version is a short two-sided game with its own simple count, written out in full on the Rules page, including which parts (the three squidgers, the steadiness ring, the round limit) are this game\'s own way of playing.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'mat', p: [
    'Get your winks into the cup in the middle of the mat. Every wink you pot is a point and earns you another shot. After the last round, the side with more potted winks wins.',
  ] },
  { title: 'Take a wink, choose a squidger', art: 'squidgers', p: [
    'Press near one of your winks to take it (it glows), or just start pulling and the glowing wink is used. A wink that has another wink on top of it is frozen and cannot be shot.',
    'The three buttons under the mat choose the squidger. The Potter is short and accurate, the Squidger is the all-rounder, and the Bomber hops far but wildly and can blast a pile of winks apart.',
  ] },
  { title: 'Pull back and let go', art: 'press', p: [
    'Drag away from the direction you want to go, like a catapult. The squidger appears behind the wink, a dotted line shows the hop and a dashed oval shows where it may land. The further you pull, the further it hops.',
    'Let go to shoot. Pull only a little and let go, and nothing happens: that is how you cancel.',
  ] },
  { title: 'The steadiness ring', art: 'ring', p: [
    'While you hold, a ring swells and shrinks round the wink. Let go as it crosses the gold dashes and the landing oval gets smaller; let go at the wrong moment and it gets wider. You can switch the ring off in Settings.',
  ] },
  { title: 'Pot it', art: 'pot', p: [
    'A wink that lands in the cup is potted: it scores a point and you shoot again. A wink that stops on the rim stays on the mat just outside the cup.',
  ] },
  { title: 'Squop', art: 'squop', p: [
    'Land on top of a rival wink and it is squopped: frozen until you move your wink away. Squopping a rival wink next to the cup is often better than hopping closer yourself. You can also land on your own winks, and a wink can be on top of a wink that is on top of another.',
  ] },
  { title: 'Blast a pile', art: 'bomb', p: [
    'Land the Bomber on a pile of two or more winks and the whole pile is thrown out across the mat, freeing everything in it. Be careful: a thrown wink can fall into the cup, and the pot counts for whoever owns it.',
  ] },
  { title: 'Winning', art: 'score', p: [
    'Each side has a fixed number of rounds. Bonus shots from pots are free. The Hint button picks a wink, a squidger and a shot for you, using the same odds you see.',
  ] },
];

export const RULES = [
  { title: 'Goal', art: 'mat', p: [
    'Have more winks potted than your rival when the match ends. A wink is potted when it drops into the cup.',
  ] },
  { title: 'Setup', p: [
    'Each side has 6 winks (Quick) or 9 winks (Full), lined up along its own end of the mat. One side wears warm colours with a dot in the middle of each wink; the other wears cool colours with a ring. The side that starts is chosen at random.',
    'A Quick match lasts 8 rounds and a Full match 12. A round is one ordinary shot for each side. Turns alternate.',
  ] },
  { title: 'Your shot', p: [
    'A turn is one shot with one free wink: a wink of yours that is on the mat and has no other wink on top of it (not even a wink of your own). You choose the wink, the squidger, the direction and the power.',
    'If none of your winks is free you pass, and the round still counts.',
  ] },
  { title: 'The squidgers', art: 'squidgers', p: [
    'Potter: hops up to 190 units, the steadiest. Squidger: up to 330 units. Bomber: up to 560 units, but its landing spread is 1.7 times wider than the Squidger\'s. Only the Bomber can blast a pile.',
    'The hop at partial power is shorter than the share of the pull: a half-strength shot hops about 39% of the full range, so short shots can be set finely.',
  ] },
  { title: 'Where it lands', art: 'press', p: [
    'The wink hops in a straight line along the direction you set, and comes down at a spot that is a little long or short of the aim and a little to one side. The wider the hop, and the bigger the squidger, the wider the miss: the dashed oval is the whole region it may land in.',
    'Your hand matters too: with the steadiness ring on, letting go on the gold dashes shrinks the oval to about 65% and the worst moment widens it to about 140%. With the ring off, every shot uses the average hand.',
  ] },
  { title: 'The cup', art: 'pot', p: [
    'A wink whose middle lands within 19 units of the cup middle is potted: it leaves the mat, scores a point for its owner and its owner shoots again. A wink that lands closer to the cup than its rim but outside that is placed against the rim on the mat.',
  ] },
  { title: 'Bonus shots', p: [
    'After you pot one of your own winks you take another shot straight away, without using up a round. At most two bonus shots in a row. A wink potted by a blast does not give a bonus shot.',
  ] },
  { title: 'Squop and piles', art: 'squop', p: [
    'A wink that lands overlapping another wink comes to rest on top of it: the wink underneath is squopped and cannot be shot until nothing is on top of it. A wink can land on a rival wink or on one of your own.',
    'Winks resting on each other form a pile. Only the winks with nothing on top can be shot.',
  ] },
  { title: 'Off the mat', p: [
    'A wink that lands beyond the edge of the mat is boondocked: it is put back on the mat at the nearest edge point and the shot is wasted. No bonus shot.',
  ] },
  { title: 'The blast', art: 'bomb', p: [
    'If the Bomber lands on a wink that is part of a pile of two or more, every wink in that pile is thrown out from where it lay, in a random direction and by a random distance (more for a harder shot). The Bomber itself stays where it landed.',
    'A thrown wink behaves like any landing: it can drop into the cup (a point for its owner), land on another wink or go off the mat. A Bomber that lands on a single wink only squops it.',
  ] },
  { title: 'The count', art: 'score', p: [
    'The match ends when every round has been played, or when both sides have potted all their winks. The side with more potted winks wins. If the pots are level, the side whose winks left on the mat are nearer the cup in total wins; if even that is level, it is a draw.',
  ] },
  { title: 'Watch & Learn and two players', p: [
    'In Watch & Learn two computer rivals play a whole match: each one thinks, the chosen wink, squidger and shot are shown with a short reason, and then it shoots. Pause freezes everything where it stands; Think − and Think + set how long each rival thinks.',
    'Two Players shares one phone: the sides take turns, and Player 1 always plays the winks along the near end.',
  ] },
  { title: 'This game\'s own parts', p: [
    'Real club tiddlywinks uses four colours, a different bonus rule and a points table. This game uses one colour family per side, a short fixed number of rounds, three squidgers, the steadiness ring and a plain count of potted winks. Those parts are this game\'s own, kept simple and fair.',
  ] },
];
