// Text for About, How to Play and the Rules book. Every number comes from sim.js so the Rules always match the engine.
import {
  WIN, LAG, PRE, LEARN_G, LEARN_WIN, ETA, PUMP, SPRING, HARMONY, WEIGHT, PHRASE, THINK_CHOICES, REVEAL_SECONDS, DEMO_RUNS, HEIGHT_EASE, STAR_NAMES, LEVELS, COUNT_IN, SOFT_CAP,
} from './sim.js';

const ms = (s) => `${Math.round(s * 1000)} ms`;
const pc = (v) => `${Math.round(v * 100)}%`;
const cm = (m) => `${Math.round(m * 100)} cm`;

export const ABOUT = {
  title: 'About',
  blocks: [
    { h: 'Neolttwigi' },
    { p: 'Neolttwigi (널뛰기) is the traditional Korean game of seesaw jumping. A long, heavy board is laid across a rolled bale of straw, and one player stands on each end. They take turns to jump: each time one lands, her weight sends the other up into the air, a little higher with every round. The charm of the game is its rhythm and its height, and the joy of a partner who lands exactly when you hope she will.' },
    { p: 'It is played at holidays and festivals, traditionally by girls and young women in their best hanbok, the traditional Korean dress. A popular story says that the game let women who rarely left the family courtyard catch a glimpse of the world beyond its wall. Today it is still seen at folk villages and cultural parks, and it is enjoyed for fun, for skill and for the sight of a long skirt and ribbons flying.' },
    { h: 'About this game' },
    { p: 'In this game you are one of the two players. You press as you land and release as your partner lands, and the closer each one is to the exact moment of contact, the higher you both go. Play with a computer partner, take turns with a friend on one screen, or watch and learn from the game itself. The girls are drawn in plain colours and are not portraits of real people.' },
    { p: 'The real game needs a flat, safe surface, a sturdy board and a partner who is happy to be thrown into the air. This is a game, not a guide to doing it yourself.' },
    { h: 'Credits' },
    { p: 'Made by Arcforge, a collection of heritage games from around the world. All sound is synthesised on your device. Titles are set in Cormorant Garamond (SIL Open Font License 1.1). Drawn with plain canvas graphics; works offline.' },
  ],
};

export const HOWTO = {
  title: 'How to Play',
  blocks: [
    { h: 'The goal' },
    { p: 'You and your partner stand on the two ends of a board. One of you is always in the air, and the other is on the board. Send each other higher with every jump, and keep your harmony going until the round is done.' },
    { fig: 'cycle', hh: 250 },
    { h: 'Two things to do' },
    { li: 'PRESS the moment your own feet touch the board. That is your stomp, and it launches your partner.' },
    { li: 'Keep your finger DOWN while she is in the air. You are crouching, ready to spring.' },
    { li: 'RELEASE at the moment her feet touch the board. That is your spring, and it sends you up.' },
    { p: 'Then you are in the air, and she presses and holds. The round is one steady beat of press, hold and release.' },
    { h: 'The ring' },
    { p: 'A ring closes on the spot where the next contact will happen. When it closes, act. Press when it says down, release when it says up.' },
    { fig: 'timing', hh: 150 },
    { h: 'Harmony' },
    { p: 'A clean contact fills the harmony bar; a miss takes a good piece away. If it runs out, the board slips and the round ends early.' },
    { h: 'Ways to play' },
    { li: 'Play: you and a computer partner, scored by height.' },
    { li: 'Learn: slower, wider timing, no slip, and a hint button.' },
    { li: 'Two Players: one on each side of the screen. The left half is the left girl, the right half the right girl.' },
    { li: 'Watch and Learn: the game plays both girls, thinking before every few jumps. Pause it any time.' },
    { h: 'On a keyboard' },
    { p: 'Space or A for the left girl, Enter or L for the right girl (press and release). P or Escape pauses, H shows a hint in Learn.' },
  ],
};

export function rulesPages() {
  const lv = LEVELS;
  const win = (g, k) => ms(WIN[g] * k);
  return [
    {
      title: 'The round',
      blocks: [
        { h: 'How a round runs' },
        { p: `Two girls stand on a board across a straw bale. A count-in of three beats (${COUNT_IN.toFixed(1)} seconds) plays, and the girl on the right hops up to start. From then on exactly one of you is in the air. Each time the girl in the air lands, that is one contact. A round is a fixed number of contacts (from ${lv[0].events} to ${lv[lv.length - 1].events}, depending on the course).` },
        { p: `At a contact the girl who lands stomps and the other girl springs. The board takes ${ms(LAG)} to load before the second girl actually leaves it, and the next flight begins from there.` },
        { fig: 'cycle', hh: 250 },
        { h: 'Flight and rhythm' },
        { p: 'How long a girl stays in the air depends on how high she goes, and the courses use different strengths of gravity, so a high jump is a slower beat than a low one. Early jumps are quick; the high ones are long and give you time to feel the landing.' },
        { h: 'The end of a round' },
        { li: 'The round completes after the last contact, once the final jump has landed.' },
        { li: `It ends early if harmony runs to zero (not in Learn): the board slips.` },
      ],
    },
    {
      title: 'Stomp and spring',
      blocks: [
        { h: 'The stomp' },
        { p: `The girl who lands presses the moment her feet touch the board. The press is judged by how far it is from the contact. A press up to ${ms(PRE)} early still counts; anything earlier is ignored. If no press arrives in time, it is a miss.` },
        { h: 'The spring' },
        { p: `The other girl has been crouching with her finger down since her own landing. She releases as the landing girl touches the board. The release is judged the same way. Letting go earlier than ${ms(PRE)} before the contact is ignored (press and hold again).` },
        { h: 'Both at once' },
        { p: 'Every contact has these two judged actions, one for each girl. In a game against the computer you do your two, and your partner does hers with a human-like spread of timing and an occasional slip.' },
        { h: 'Keys and screen' },
        { p: 'You can press and release anywhere on the screen. In two-player mode the left half belongs to the left girl and the right half to the right girl, so two thumbs can play at once.' },
      ],
    },
    {
      title: 'Timing and height',
      blocks: [
        { h: 'Timing windows' },
        { fig: 'timing', hh: 150 },
        { p: `Before the courses and the Learn setting scale them, the windows are: Perfect within ${ms(WIN.perfect)}, Great within ${ms(WIN.great)}, Good within ${ms(WIN.good)} of the contact, either side. Anything outside is a miss.` },
        { p: `Each course scales every window (${lv.map((l) => `${l.name} x${l.win}`).join(', ')}). Learn multiplies them by ${LEARN_WIN}. At a high jump the windows shrink slightly, by ${pc(HEIGHT_EASE)} for every metre, up to 2.5 m.` },
        { h: 'The jump height' },
        { p: `A contact turns the height the landing girl fell from into the height of the next jump. The stomp keeps ${pc(ETA.perfect)} (Perfect), ${pc(ETA.great)} (Great), ${pc(ETA.good)} (Good) or ${pc(ETA.miss)} (Miss) of it and adds ${cm(PUMP.perfect)}, ${cm(PUMP.great)}, ${cm(PUMP.good)} or nothing. Then the spring multiplies the result by ${SPRING.perfect} (Perfect), ${SPRING.great} (Great), ${SPRING.good} (Good) or ${SPRING.miss} (Miss).` },
        { p: `So Perfect timing climbs, Great timing holds a height of about ${(PUMP.great / (1 - ETA.great)).toFixed(1)} m, and Good or worse lets you sink. Past ${pc(SOFT_CAP)} of the course limit every extra metre is hard to win, and the course limit (${lv.map((l) => l.hMax + ' m').join(', ')}) cannot be passed.` },
      ],
    },
    {
      title: 'Harmony and score',
      blocks: [
        { h: 'Harmony' },
        { p: `Harmony starts at ${pc(HARMONY.start)}. Each judged action changes it: Perfect +${(HARMONY.perfect * 100).toFixed(1)}, Great +${(HARMONY.great * 100).toFixed(1)}, Good ${(HARMONY.good * 100).toFixed(0)}, Miss ${(HARMONY.miss * 100).toFixed(0)} points. It is shared by both girls and never goes above 100%. At zero the board slips and the round ends. In Learn it only moves, it never ends the round.` },
        { h: 'Score' },
        { p: 'Your score is the sum of the launch heights you produced with your stomps, in centimetres: how high you sent your partner. In Two Players the higher total wins. The best single jump, the highest height anyone reached, is shown at the top.' },
        { h: 'Stars and rank' },
        { p: `Stars come from the highest jump of the round: each course has three heights (${lv.map((l) => l.stars.join(' / ') + ' m').join('; ')}). Rank names: ${STAR_NAMES.join(', ')}. A round that ends in a slip earns no stars. Your best height, stars and score for each course are kept on this device.` },
      ],
    },
    {
      title: 'The courses',
      blocks: [
        { h: 'Five courses' },
        ...lv.flatMap((l, i) => [{ li: `${i + 1}. ${l.name}: ${l.events} contacts, gravity ${l.g}, windows x${l.win}, top height ${l.hMax} m. ${l.blurb}` }]),
        { p: 'The course names are only the setting: courtyard, garden, fair, lantern night and snow. They say nothing about a particular festival.' },
        { h: 'The partner' },
        { p: `The computer girl presses and releases with a natural spread of timing, wider on the harder courses, and occasionally slips. Her spread is between ${lv.map((l) => ms(l.sigma)).join(', ')} (one standard deviation) and her chance of botching a contact is ${lv.map((l) => pc(l.slip)).join(', ')}.` },
      ],
    },
    {
      title: 'Watch and Learn',
      blocks: [
        { h: 'The game plays, you study' },
        { p: `Watch and Learn plays a whole round with the game's own two players, in phrases of ${PHRASE} contacts. Before each phrase the clock stops and three steps follow.` },
        { li: `Think: the girls wait while you study the board. You choose the length in Settings (${THINK_CHOICES.join(', ')} seconds; 5 is the default and 10 the longest).` },
        { li: `Reveal: for ${REVEAL_SECONDS} seconds the next ${PHRASE} contacts are listed with who lands, how high and how soon.` },
        { li: 'Act: the clock runs again and the phrase is played.' },
        { p: 'Pause stops everything, including the Think and Reveal timers and any movement in progress, and resumes exactly where it stopped.' },
        { h: 'Learn' },
        { p: `Learn is a real round at ${pc(LEARN_G)} gravity (a slower beat), with ${LEARN_WIN} times wider windows and no slip. The hint button stops the clock and lists the next contacts.` },
      ],
    },
    {
      title: 'Free to play and demo',
      blocks: [
        { h: 'In the app' },
        { p: 'Menus, Rules, Watch and Learn and results are always free. Free to play with short ads; go ad-free once.' },
        { p: `The public web demo is limited to ${DEMO_RUNS} rounds and the first course, a taste of the game; the apps for iPhone and Android hold everything.` },
      ],
    },
  ];
}
