// The words: About, How to Play, Rules and the Learn lessons. Every number here is built from the constants the engine (engine.js), the physics
// (phys.js, sim.js), the opponents (ai.js) and the game flow (game.js) really use, so the text and the game cannot drift apart.
// Language: the game is played in English. The one Swedish word is "kubb" (a block of wood); it is explained in About and Rules.
import { FIELD, KUBB, KING, BATON, LOFTS, SPINS, BASE_STEP } from './phys.js';
import { NOISE, LOFT_K } from './sim.js';
import { PROFILES, ASSIST, TOSS_NOISE } from './ai.js';
import { SIZES, KING_RING, batonsFor } from './engine.js';

const cm = (m) => Math.round(m * 100);
const FIELD_TXT = `${FIELD.W} by ${FIELD.L} metres`;
const sig = (noise, dist, loft = 1) => `${cm(Math.min(0.5, NOISE.lat * LOFT_K[loft].lat * noise * dist))} cm`;
const pct = (k) => Math.round(Math.abs(k - 1) * 100);

export const ABOUT = [
  { title: 'Kubb', p: [
    'A lawn game for two teams: throw wooden batons to knock over wooden blocks, throw the fallen blocks back to the other side, and in the end topple the king.',
    'Kubb (say KOOB) is the Swedish word for a block of wood. The blocks are the kubbar (plural), and the tall one in the middle is the king.',
  ], art: 'layout' },
  { title: 'A game from the Nordic lands', p: [
    'Kubb is played on lawns, beaches and village greens in Sweden and across the Nordic countries, and today in many other places. It may have grown out of older Scandinavian throwing games with wooden pieces. It became a local craze on the Swedish island of Gotland in the 1980s, and a world championship has been held there since 1995.',
    'Its history is told in many ways and some of the popular stories are more legend than fact, so this game keeps to what is known: it is a friendly, outdoor game of aim, nerve and a little tactics.',
  ] },
  { title: 'About this version', p: [
    `The real pitch is 5 by 8 metres. To make it easy to see on a phone, this lawn is ${FIELD_TXT} and the pieces are drawn a little larger than real ones: a kubb is ${cm(KUBB.w)} by ${cm(KUBB.h)} cm, the king is ${cm(KING.w)} by ${cm(KING.h)} cm and a baton is ${cm(BATON.len)} cm long. The rules and the order of play follow the usual game.`,
    'All opponents are invented characters. There are no real players, clubs, leagues or brands in this game.',
    'It is a game of skill for fun: no betting, no stakes, no coins. Scores and records stay on your device.',
  ] },
  { title: 'Real physics', p: [
    'Every kubb, the king and every baton is a solid wooden body in a small physics world. A baton spins end over end in the air, lands, skids and tumbles, and the kubbs it strikes topple, slide and knock into their neighbours. The same throw from the same position always gives the same result.',
    'The lawn, the camera and the view never move: only the wood does.',
  ] },
  { title: 'Made to be comfortable', p: [
    'Every text screen can be enlarged up to 300%. Aim steadiness has three settings. The Think button explains a throw and tests it with real simulated throws, Learn teaches the game in four short lessons (throwing, field kubbs, the baseline and the king), and Watch & Learn lets you watch two players with their reasons on screen.',
    'The game is free to try for 90 seconds of real play. Menus, the rules, Learn and Watch & Learn are always free; one purchase unlocks everything for good.',
  ] },
];

export const HOWTO = [
  { title: 'The goal', p: [
    `Two teams, Blue (the bottom of the screen) and Orange (the top). Each team has ${SIZES[1].kubbs} kubbs standing on its own baseline (${SIZES[0].kubbs} in a Quick game) and there is one king in the middle.`,
    'Knock over all of the other team\'s baseline kubbs with your batons, then topple the king. Topple the king too early and you lose on the spot.',
  ], art: 'layout' },
  { title: 'Throw a baton', p: [
    'Drag back on the pitch like a slingshot (towards your own end of the lawn: down the screen for Blue, up for Orange) and let go. The ring shows where the lower end of the baton will first touch the grass; the dashed oval around it shows how far your hand might be off. A dotted line shows the flight. Drag back further to throw further. A very short pull is a cancel: let go and nothing is thrown.',
    'Loft (Low, Medium, High) changes the flight: a flat throw hits hard and skids on, a high lob is steadier but lands softly. Spin (Slow, Medium, Fast) decides how many times the baton turns end over end, and so how it arrives: the Medium spin (a quarter turn more than a whole one) tends to lay the baton flat so that it skids over a kubb, while Slow and Fast bring it down on an end. The arrow buttons move where you stand along the line.',
  ], art: 'batons' },
  { title: 'A turn', p: [
    `Each turn a team throws ${batonsFor(5)} batons (the very first turn only 2, the second 4, as in the usual game; you can switch that off in the set-up). The batons stay on the grass until the turn is over and can get in the way.`,
    'First the fallen kubbs of your team are thrown back (see below). Then you attack: field kubbs first, then the baseline kubbs, then the king. Glowing rings show what you may attack right now.',
  ], art: 'field' },
  { title: 'Throwing kubbs back', p: [
    'Kubbs that the other team knocked over are thrown by you into the other half at the start of your turn. Drag on the far half to place the aim ring and let go. They stand where they land and are called field kubbs.',
    'A kubb has to land inside the side lines, past the centre line and at least a baton length from the king. If it does not, you get one more try. If it misses again, the other team places the kubb anywhere in its half, outside that circle around the king.',
  ], art: 'throwin' },
  { title: 'Advantage line', p: [
    'If a team does not knock over all of its field kubbs, the one that stands closest to the centre line gives the other team an advantage: it can throw from the line through that kubb, closer to the target. The game moves your thrower there for you.',
    'The advantage line is never used for the king: that throw is always from your own baseline.',
  ], art: 'advantage' },
  { title: 'The king', p: [
    'When every one of your field kubbs and every baseline kubb of the other team is down, the king can be attacked. Knock it over and you win the game. If the king falls before that, even by accident, your team loses at once.',
    'So keep your batons away from the king until the time is right: a red warning ring shows when your throw passes low over it.',
  ], art: 'king' },
  { title: 'Think, Learn and Watch & Learn', p: [
    'Tap Think for a throw to try. The game tests it with twelve simulated throws that include your aim steadiness (the amount of hand shake) and tells you how often it worked. Tap Use this throw to set it up.',
    'Learn has four short lessons. Watch & Learn shows two computer players: you see them think, then the throw is revealed with its reason, then they throw. Pause freezes everything.',
  ], art: 'controls' },
  { title: 'Two players on one phone', p: [
    'Choose Two Players on the menu. You take turns on the same phone and the screen says whose turn it is; the second player throws from the top, so drag the other way (up) to pull back.',
    'Leaving a match in the middle keeps it. Choose Continue on the menu to carry on, paused, exactly where you stopped.',
  ] },
];

const rev = (i) => `${SPINS[i].rev} ${SPINS[i].rev === 1 ? 'turn' : 'turns'}`;
export const RULES = [
  { title: 'The lawn', p: [
    `The pitch is ${FIELD_TXT}. Blue's baseline is the bottom edge and Orange's is the top edge; a dashed line across the middle is the centre line. Teams throw from behind their own baseline, between the side lines.`,
    `At the start the kubbs stand in a row along their team's baseline, ${cm(BASE_STEP)} cm apart, and the king stands in the middle of the pitch. The pieces are wooden: kubbs ${cm(KUBB.w)} by ${cm(KUBB.h)} cm, the king ${cm(KING.w)} by ${cm(KING.h)} cm, batons ${cm(BATON.len)} cm long and ${cm(BATON.r * 2)} cm thick.`,
  ], art: 'layout' },
  { title: 'The game', p: [
    `Choose the size of the game: Standard has ${SIZES[1].kubbs} kubbs per team, Quick has ${SIZES[0].kubbs}. The team that starts is chosen by the game.`,
    'The teams take turns. In each turn a team throws batons at the other team\'s kubbs. A team wins when it has knocked over every kubb of the other team that stands in the other half (its baseline kubbs and its own field kubbs) and then topples the king.',
  ] },
  { title: 'Turns and batons', p: [
    'Official opening: the team that starts throws only 2 batons, the other team 4, and from the third turn on each team throws 6 batons per turn. In the set-up you can choose 6 batons for every turn instead.',
    'A turn begins with throwing in the kubbs that the other team knocked over, if there are any, and then the batons. Batons that have been thrown stay on the grass until the turn is over; they are solid objects and a later baton can hit them.',
  ] },
  { title: 'Throwing a baton', p: [
    `You choose where you stand along your throw line (the baseline, or the advantage line), the aim ring, the loft and the spin. Drag back on the pitch and let go: the baton leaves your hand just behind the line and comes down on the ring (the point where its lower end first touches the grass). The three lofts launch at ${Math.round(LOFTS[0].a * 57.3)}, ${Math.round(LOFTS[1].a * 57.3)} and ${Math.round(LOFTS[2].a * 57.3)} degrees; the three spins turn the baton ${rev(0)}, ${rev(1)} and ${rev(2)} end over end before it lands.`,
    'A baton always turns end over end in the line of its flight, as in the real game: it never spins flat like a helicopter. How it lands depends on spin and loft, and a baton that hits a kubb with its end, its side or on the bounce knocks it differently.',
  ], art: 'controls' },
  { title: 'Your hand', p: [
    `Nobody throws perfectly. The baton lands near the ring, not always on it. At 6 metres with Medium loft the typical error to the side is about ${sig(1, 6)} with Normal aim steadiness, ${sig(ASSIST[0].noise, 6)} with Easy and ${sig(ASSIST[2].noise, 6)} with Hard; along the line of the throw it is several times larger.`,
    `Flat (Low loft) throws are about ${pct(LOFT_K[0].lat)}% less steady to the side and ${pct(LOFT_K[0].spd)}% less steady in distance than Medium ones; High lobs are about ${pct(LOFT_K[2].lat)}% steadier to the side and in distance. A flat baton skids on and hits hard; a lob comes down steeply, clears obstacles such as the king and lands softly. The dashed oval on the pitch shows the typical error (one standard deviation; it is drawn at most 1.1 metres long).`,
  ] },
  { title: 'The order of attack', p: [
    'You must attack in this order: first your own field kubbs (the kubbs you threw into the other half), then the baseline kubbs of the other team, and only then the king. The glowing rings show what is allowed.',
    'If a baton knocks over a baseline kubb while one of your field kubbs is still standing, that kubb is stood up again where it lies. The same happens to a kubb of the other team that was left standing as a field kubb in your half, and to one of your own baseline kubbs if you knock it over yourself.',
  ], art: 'field' },
  { title: 'Knocked-down kubbs', p: [
    'A kubb counts as knocked down when it is no longer standing up. A kubb that is only pushed along but still stands is not knocked down and stays where it stopped. Knocked-down kubbs lie where they stopped.',
    'A baseline kubb that is knocked down belongs to its team and waits for that team\'s next turn. A field kubb that is knocked down by its own team is finished: it is taken out of the game.',
  ] },
  { title: 'Throwing kubbs in', p: [
    'At the start of your turn you throw in your fallen kubbs one at a time, into the other half. Drag on the pitch to place the aim ring, let go to throw. The kubb is thrown from the middle of your baseline, flies end over end and stands where it lands. The dashed oval shows how far off the throw might be.',
    `The kubb is in play when it lands inside the side lines, past the centre line (in the other half) and at least a baton length (${cm(KING_RING)} cm) from the king. A throw that lands anywhere else is a fault. With Normal aim steadiness the typical error is up to about ${cm(TOSS_NOISE.across)} cm to the side and ${cm(TOSS_NOISE.along)} cm in distance for the longest throws, and less for shorter ones.`,
  ], art: 'throwin' },
  { title: 'Faults and placing', p: [
    'After a fault you throw the same kubb again. After a second fault, the other team places the kubb: it may put it anywhere in its own half, inside the side lines, at least a baton length from the king and not too near the baselines.',
    'If a kubb would land on top of another kubb, it is moved to the nearest free spot.',
  ] },
  { title: 'Advantage line', p: [
    'Field kubbs that a team did not knock down stay standing in the other team\'s half. When the other team attacks, it may throw its batons at kubbs from the line (parallel to the baseline) through the one of those kubbs that is nearest to the centre line, but never closer than the circle around the king.',
    'In this game the thrower is moved to that line automatically; it shows as a gold dashed line. The king can only be attacked from the baseline.',
  ], art: 'advantage' },
  { title: 'The king', p: [
    'You may attack the king only when you have no standing field kubb in the other half and every baseline kubb of the other team is down. Throw from your own baseline.',
    'If the king is toppled then, your team wins. If the king is toppled at any other time, whoever threw the baton, your team loses at once. A toppled king is one that does not stand up any more after the baton has stopped. A pulsing red ring and a warning appear around the king when the flight you have set up passes low over it; a higher loft clears it, and a kubb standing right behind the king is the hardest one to hit.',
  ], art: 'king' },
  { title: 'Long games', p: [
    `A Quick game ends after ${SIZES[0].turns} turns and a Standard game after ${SIZES[1].turns} turns if nobody has won: the team that knocked down more baseline kubbs wins, equal counts are a draw.`,
  ] },
  { title: 'The computer players', p: [
    `${PROFILES.map((p) => `${p.name} (${p.stars} ${p.stars === 1 ? 'star' : 'stars'}, ${p.tag.toLowerCase()})`).join(', ')}: all use the same physics as you. Each one tries many throws in its head, then picks a target, a loft and a spin and throws with a hand that is a little off.`,
    `Stronger players test more ideas and have a steadier hand: the typical sideways error at 6 metres with Medium loft is about ${PROFILES.map((p) => sig(p.noise, 6)).join(', ')} from the first to the fifth. In 60 simulated Standard games per pairing each one beat the one below it between 78 and 87 times in 100 (in Quick games between 65 and 82).`,
  ] },
  { title: 'Think, Learn, Watch & Learn', p: [
    'Think tries many throws for what you may attack now, picks the most promising ones and throws each of them twelve times with your own aim steadiness. It shows the target, the loft and the spin and tells you how many of the twelve worked. Nothing is guessed.',
    'Learn has four lessons with goals. Watch & Learn plays two computer opponents: it thinks for the time you set (2 to 10 seconds), reveals the throw for 2 seconds with its reason, then throws. Pause freezes the whole loop.',
  ] },
  { title: 'Saving and the free preview', p: [
    'The match is saved after every baton. Choose Continue on the menu after leaving; the match resumes paused where you stopped.',
    'The game is free to try for 90 seconds of real play. Menus, these rules, Learn and Watch & Learn do not use the preview time. One purchase unlocks the full game for good; Restore purchases is in Settings and on the unlock screen.',
  ] },
];

// Learn: short lessons with goals. setup: base (team 1 baseline kubbs standing), fallen0 (kubbs Blue must first throw in), king, batons.
export const LESSONS = [
  { title: 'Throwing', base: 3, fallen0: 0, king: true, batons: 6, pass: 'knock', goalShort: '1 kubb', goalText: 'Knock down 1 baseline kubb',
    text: 'Drag back on the pitch and let go: the baton flies to the ring and spins end over end. Low loft with Fast spin is a good start. Goal: knock down one of the three orange kubbs with your 6 batons. Keep the batons away from the king!' },
  { title: 'Field kubbs', base: 3, fallen0: 2, king: true, batons: 6, pass: 'field', goalShort: '2 field', goalText: 'Knock down both field kubbs',
    text: 'Two of your kubbs were knocked down. Throw them into the orange half (drag on the far half, let go), then knock both down with batons: field kubbs always come first. Goal: clear both within 6 batons.' },
  { title: 'The baseline', base: 3, fallen0: 0, king: true, batons: 6, pass: 'base3', goalShort: '3 kubbs', goalText: 'Knock down all 3 baseline kubbs',
    text: 'No field kubbs are standing, so the baseline is open. Pick a kubb with the glowing ring and a good loft and spin (or ask Think). Goal: knock down all three orange kubbs with your 6 batons.' },
  { title: 'The king', base: 0, fallen0: 0, king: true, batons: 4, pass: 'king', goalShort: 'The king', goalText: 'Topple the king',
    text: 'Every orange kubb is down, so the king is yours to attack, and only from your own baseline. Goal: topple the king within 4 batons.' },
];
