// The words: About, How to Play, the exhaustive Rules and the Learn lessons. Every number here is one the engine really uses
// (rules.js, sim.js, ai.js). Change them together.

export const ABOUT = [
  { title: 'Kabaddi: Raid and Tag', p: [
    'The traditional South Asian team sport of raid and tag, played in 3D on your phone: one raider crosses the midline on a single breath, tags defenders and tries to get home, while the defending chain closes in.',
    'You choose how to approach, when to turn back, and how to tackle. Everything is decided by your choices, the players\' ratings and a short timing tap.',
  ], art: 'court' },
  { title: 'A sport of South Asia', p: [
    'Kabaddi has been played for centuries in villages and towns across India, Bangladesh, Pakistan, Nepal and Sri Lanka and by communities around the world. It is the national sport of Bangladesh and has been part of the Asian Games since 1990.',
    'This version follows the standard seven-a-side rules of the modern game, drawn and animated from scratch. The Rules page lists exactly what is included and what is simplified.',
  ] },
  { title: 'Friendly and fair', p: [
    'There are no real players, teams or leagues in this game: the two sides are Blue and Red, and every tackle is a sportsmanlike hold that ends with a handshake-friendly stop. Nobody is hurt.',
    'It is a game of skill and nerve for fun: no betting, no stakes, no coins. Scores and records stay on your device.',
  ] },
  { title: 'Made to be comfortable', p: [
    'Every text screen can be enlarged up to 300%, including the play screen. Think explains the best move in plain English. Learn teaches the game in six short lessons, and Watch & Learn lets you watch a whole match with the reasons shown.',
    'The game is free to try for 90 seconds of real play. Menus, the rules, Learn and Watch & Learn are always free; one purchase unlocks everything for good.',
  ] },
];

export const HOWTO = [
  { title: 'The goal', p: [
    'Two teams of seven take turns to raid. The team with more points after two halves wins. A raider scores a point for each defender he tags and brings home; the defenders score by stopping the raider before he gets back.',
    'Quick match: 4 raids per team in each half. Full match: 8.',
  ] },
  { title: 'Raiding', p: [
    'On your raid, pick one move at a time: Step in, Feint left or right, Hand touch, Toe touch, Running touch, Bonus line, or Retreat. Touch moves aim at the defender in the gold ring: use the arrows to change him, or tap a defender on the little court.',
    'You must cross the baulk line (the second line from the midline) before Retreat unlocks. Tags only count when you get back across the midline, so every extra move is a gamble. The raid clock (30 s) and the cant bar (7 s without a move) keep running.',
  ] },
  { title: 'Timing', p: [
    'After your move a ring closes in on the moment of contact. Tap anywhere as it closes: the closer to the end, the better your chance. If you do not tap you still play, just a little worse.',
  ] },
  { title: 'Defending', p: [
    'Before each raid choose a formation for your seven defenders. During the raid you see where the raider is heading and the move he seems to be making (a feint looks like a touch). Choose your answer: Ankle hold, Thigh hold, Chain tackle, Block the exit, Dash, or Hold ground, then tap as the ring closes.',
    'There is no perfect answer: a low hold beats a toe touch, a thigh hold beats a hand touch, and a lunge at a feint leaves you off balance.',
  ] },
  { title: 'Think, Learn and Watch', p: [
    'Think shows the move that looks best and why, in plain English, and pauses the raid while you read. Learn is six short lessons. Watch & Learn plays a match for you: thinking, a short reveal of the options, then the move, with a real Pause. Change the thinking time in Settings.',
  ] },
  { title: 'Menu and saving', p: [
    'The Menu button pauses. Your match is saved between raids: after quitting, Continue brings it back at the start of the next raid. Text size, sound and reaction time are in Settings.',
  ] },
];

export const RULES = [
  { title: 'The game', p: [
    'Kabaddi is a team sport for two sides of seven. The sides take turns to send one raider into the other half. The raider tries to tag defenders and get back across the midline; the defenders try to hold him so he cannot return.',
    'A match has two halves. In each half every team raids the same number of times: 4 raids in a Quick match, 8 in a Full match. Team order alternates; the team that raided second in the first half raids first in the second. The team with more points at the end wins; level scores are a draw.',
  ] },
  { title: 'The court', p: [
    'The court is 10 m wide and 13 m long, cut in half by the midline into two halves of 6.5 m. In each half the baulk line is 3.75 m from the midline and the bonus line is 4.75 m from it; the end line is at 6.5 m. The lobbies are the 1 m strips along the sides.',
    'The first number you need to know is the baulk line: a raider must cross it before he may go home.',
  ], art: 'court' },
  { title: 'A raid', p: [
    'The raider walks to the midline and then makes moves one at a time. Each move costs time on the raid clock, which starts at 30 seconds and runs while the raid is live. If it reaches zero the raider is out.',
    'The raider must keep his cant (the continuous call that proves he is on one breath). The game shows it as the cant bar: it fills when you make a move and drains over 7 seconds while you wait. If it empties the cant is broken and the raider is out.',
    'A raider who goes home without having crossed the baulk line is out, so the Retreat move stays locked until he has.',
  ], art: 'flow' },
  { title: 'Touch points', p: [
    'Every defender the raider touches is a touch point, but only if the raider gets back across the midline. The touches are banked during the raid: if the raider is held, all banked touches are lost.',
    'On a safe return the raiding team scores one point per touched defender, those defenders are out and leave the mat, and the raiding team revives one of its own out players for each touch point.',
    'A raid that crosses the baulk line and comes home without scoring or losing is an empty raid.',
  ] },
  { title: 'The raider\'s moves', p: [
    'Step in: walk across the baulk line. Feint left or right: a body fake that costs little time. Hand touch: reach out and tag. Toe touch: lean back and tag with a foot, keeping the body out of reach. Running touch: a pass through the chain that can tag two defenders but ends deep. Bonus line: reach across the bonus line and come back. Retreat: run for the midline.',
    'Touch moves aim at one defender; the number you see is his jersey number. A defender who is not alert, or one who has just lunged at a feint, is easier to tag.',
  ] },
  { title: 'Tackles', p: [
    'A tackle is a hold that stops the raider. When the raider is held the raid ends, the raider is out, the defenders score one point and revive one of their own out players. The hold is shown as a safe, sportsmanlike wrap: nobody is thrown or hurt.',
    'Ankle hold: low and fast, best against a toe touch. Thigh hold: the standard hold against a raider who has committed forward, best against a hand touch. Chain tackle: two or three defenders link up; it needs defenders within reach of each other, is strongest then, and if it fails the raider may tag part of the chain. Block the exit: cut the way home; it makes this move safe for the raider but raises the chance of stopping the next retreat. Dash: a defender runs at the raider; strong, but he may be tagged instead. Hold ground: step back out of reach; hard to tag but hard to hold.',
  ], art: 'tackles' },
  { title: 'Who wins an exchange', p: [
    'Each move is an exchange: the raider\'s move against the defenders\' answer. Two things are checked: does the raider tag, and do the defenders hold him? Both can happen: a raider can touch and still be held, and then the touch is lost.',
    'Base chance to tag a defender, before ratings and timing: a hand touch about 6 in 10 against an ankle hold, 4 in 10 against a thigh hold and 2 in 10 against Hold ground; a toe touch about 3 in 10 against an ankle hold, 6 in 10 against a thigh hold. The chance to be held goes up with the number of moves already made, with each banked touch, with a long way home, and with the defenders\' tackle ratings; it goes down with the raider\'s agility and speed.',
    'Your timing tap adds or subtracts up to about 15 percentage points. The computer players time their contact by their level.',
  ] },
  { title: 'Super tackle', p: [
    'When the defending side has 3 or fewer players on the mat, a tackle is a super tackle and scores 2 points instead of 1.',
  ] },
  { title: 'Bonus line', p: [
    'The bonus line is live only when the defenders have 6 or 7 players on the mat. The raider may reach across it with one foot and come back: one bonus point, with no revival. It must be done before any touch; after a touch the bonus no longer counts. If the raider is held while reaching, there is no bonus and the defenders score.',
  ], art: 'bonus' },
  { title: 'Do-or-die raid', p: [
    'The raid that follows two empty raids by the same team is a do-or-die raid. The raider must score a point: if he comes home without a touch or a bonus, he is out and the defenders score one point. A raid that scores, or loses the raider, resets the count.',
  ] },
  { title: 'Revival', p: [
    'Out players revive in the order they went out. The raiders revive one player for every touch point; the bonus point revives nobody. The defenders revive one player each time they hold a raider (or the raider is out for any reason).',
  ] },
  { title: 'All out', p: [
    'When a team has no player left on the mat it is all out: the other team scores 2 extra points and all the out players come back on.',
  ] },
  { title: 'Formations', p: [
    'Before every raid the defending side picks a shape. Half circle: even cover with deep corners. Front line: shuts the baulk line, thin at the back. Deep cover: the way home is long for a raider who goes deep. Corner pincer: the corners trap a raider who enters the open middle.',
    'As a raid goes on the chain closes in around the raider.',
  ] },
  { title: 'Players', p: [
    'Every player has five ratings from 1 to 5: speed, agility, reach, tackling and alertness. Raiders are usually quicker and more agile; defenders tackle better and are more alert. Your raider for each raid is the next in the order, or any player you pick before the raid starts.',
  ] },
  { title: 'The computer players', p: [
    'Five levels: Rookie, Club, Regional, Expert and Champion. They play with the same rules and the same numbers as you. A higher level weighs the risks better, reads a feint more often, makes fewer slips and times its contact better. Each level was tested against the one below it in thousands of simulated matches and wins more often.',
  ] },
  { title: 'What is simplified', p: [
    'This game plays the core of the standard rules. Left out: substitutions, cards and timeouts, reviews, out-of-bounds and the lobby touch rule, struggle and pursuit, and the five-second rule between raids. Raids are decided by the exchange described above instead of by free movement.',
  ] },
];

// Learn lessons: each is a short scripted situation on the real engine. `rig` makes the first exchange go the way the lesson shows.
export const LESSONS = [
  { id: 'raid', title: 'The raid', goal: 'Step in across the baulk line, then retreat.',
    intro: ['You are the raider. Cross the baulk line (the second white line) with Step in, then use Retreat to get home. Retreat stays locked until you have crossed it.', 'Tags only count when you come home, so a raid with no touches is an empty raid: safe, but worth nothing.'],
    done: 'You crossed the baulk line and came home: an empty raid. Next, you will score.', raider: true, allow: ['step', 'retreat'], rig: { catch: false } },
  { id: 'tag', title: 'Tag a defender', goal: 'Step in, tag the gold-ringed defender with a hand touch, then retreat.',
    intro: ['A hand touch reaches out and tags a defender. The gold ring shows who. Use the arrows beside Target to change him.', 'After the touch, Retreat: the point only counts when you are back across the midline.'],
    done: 'One tag banked and brought home: one point, the defender is out, and a teammate is revived.', raider: true, allow: ['step', 'hand', 'retreat'], rig: { touch: true, catch: false } },
  { id: 'tackle', title: 'Hold the raider', goal: 'The raider goes for a hand touch. Answer with a Thigh hold.',
    intro: ['Now you defend. The raider is going for a hand touch. The best answer to a raider who commits forward is a Thigh hold.', 'Tap the ring as it closes for the best timing.'],
    done: 'Held! The raid is over, the defenders score a point and a defender is revived.', raider: false, allow: ['thigh'], rig: { catch: true, touch: false } },
  { id: 'bonus', title: 'The bonus line', goal: 'Go for the bonus line (the gold line), then retreat.',
    intro: ['With 6 or 7 defenders on the mat the gold bonus line is live. One foot across it and back is a bonus point, but it must come before any touch.', 'It is a quick point, but the way home is long.'],
    done: 'Bonus point. It scores a point but, unlike a touch, revives nobody.', raider: true, allow: ['step', 'bonus', 'retreat'], rig: { touch: true, catch: false } },
  { id: 'dod', title: 'Do or die', goal: 'This is a do-or-die raid: touch a defender and get home.',
    intro: ['Your team has had two empty raids in a row. This raid is do-or-die: if you come home without scoring, the raider is out.', 'Step in, tag, and retreat.'],
    done: 'You scored in a do-or-die raid. Without a point the raider would have been out.', raider: true, allow: ['step', 'hand', 'toe', 'run', 'feintL', 'feintR', 'retreat'], rig: { touch: true, catch: false }, dod: true },
  { id: 'revive', title: 'Revival', goal: 'Tag two defenders and get home: your team revives two players.',
    intro: ['Your team has two players out. Every touch point revives one of them, in the order they went out.', 'Tag two defenders, then retreat.'],
    done: 'Two touch points, two players back on the mat. Super raids with three or more touches are worth the risk.', raider: true, allow: ['step', 'hand', 'toe', 'run', 'retreat'], rig: { touch: true, catch: false }, outs: 2 },
];
