// Text screens: About, How to Play and the paged Rules reference. Numbers come from engine.js so the text cannot drift from the engine.
// Blocks: { h } heading, { p } paragraph, { li } bullet, { fig: name, hh: height } a figure drawn with the game's own art, { sp } gap.
import {
  VENUES, ROSTER, TEMPERS, THINK_TIMES, REVEAL_SECONDS, HIDE_TIME, CLAP_CD, TEASE_CD, WRONG_PENALTY, REACH_T, REACH_REC, MARK_AGE, AUTO_GUESTS,
} from './engine.js';

const rooms = VENUES.map((v) => `${v.name}: ${v.guests} guests, ${v.time} seconds`).join('; ');

export const ABOUT = [
  { h: "Blind Man's Buff" },
  { p: 'A blindfolded player stumbles around a room, guided only by sounds and claps, to catch the others and say who they have caught. The game is played in nearly every country under many names: Colin-Maillard in France, Blindekuh in Germany, Gallina ciega in Spain and Latin America, Korebe in Turkey, and Blind Man\'s Buff in English. It is painted by Goya, Fragonard and many others, and was a favourite at parties of the eighteenth century.' },
  { p: 'This version puts you in the blindfold. The room is dim and the guests are invisible. You hunt by ear, clap to make them answer, reach out, and then identify the person you caught by touch alone.' },
  { h: 'This version' },
  { li: `Four rooms, from a salon with three guests to a masked ball with six, with a party drawn from ten characters.` },
  { li: 'Seeker: follow claps and giggles that appear as ripples on the map, call out to make the guests answer, catch one, then name them from what your hands tell you.' },
  { li: `Hide and Dodge: you are a guest and a blindfolded seeker hunts by ear. Tiptoe is silent; every step you take above that can be heard. Survive ${HIDE_TIME} seconds.` },
  { li: 'Wear headphones if you can: the sounds come from the side they are on.' },
  { li: 'Watch and Learn plays a whole round for you with time to think before each move, and you can pause it. A Hint button works in the real game too.' },
  { li: 'A full Rules page and text size up to 300%. Sound is made on your device. No ads, works offline. Points only: there are no stakes, chips or money.' },
  { sp: 1 },
  { p: 'Simplifications: the traditional rule that the caught player becomes the next seeker is not used. Naming the person you caught is the whole goal, and the Rules page says exactly what this game does.' },
  { sp: 1 },
  { p: 'Made by Arcforge. One game in a growing collection of the world\'s heritage games.' },
];

export const HOWTO = [
  { h: 'Seeker, the quick version' },
  { li: 'Meet the party first: faces and traits are shown once. Then the blindfold goes on.' },
  { li: 'Tap the room to walk there. Drag to steer. Tap yourself to stop.' },
  { li: 'Ripples show where sounds came from. A dashed ring is how unsure the place is: it grows as the sound gets older.' },
  { li: `Press Call to clap. Guests within earshot answer after a moment, so the answers show where they are. It can be used every ${CLAP_CD} seconds, and it warns guests nearby.` },
  { li: 'When a warm shape appears close to you, press Reach to sweep both arms in front of you. Walking into someone also catches them.' },
  { li: 'Caught someone? Read the touch clues, press Feel more for the next clue, then tap who it is and confirm.' },
  { h: 'Hide and Dodge' },
  { li: 'Pick a gait: Tiptoe (silent), Walk (heard close by) or Run (heard far). Tap the room to go there.' },
  { li: `Tease makes a loud clap that draws the seeker to where you stand. It rests for ${TEASE_CD} seconds. Move away straight after.` },
  { li: 'Other guests clap too, and the seeker follows those just the same. Let them be the decoys.' },
  { h: 'Other things' },
  { li: 'Hint shows what a good listener would do next; it counts against your feathers.' },
  { li: 'Settings: sound, think time for Watch and Learn, reduced motion, and text size.' },
  { h: 'On a keyboard' },
  { li: 'Arrow keys or W A S D steer. Space reaches (seeker) or runs (hide). C calls or teases. Shift tiptoes. F feels more. H is the hint, Enter confirms a guess, Escape pauses.' },
];

export const RULES = [
  {
    title: 'The idea',
    blocks: [
      { h: 'Find, catch, name' },
      { p: 'In Seeker mode you are blindfolded in a room full of guests who are teasing you. You win a round by catching every guest and naming each one correctly before the sand runs out.' },
      { fig: 'seeker', hh: 250 },
      { p: 'You never see the guests moving. The room itself is known: furniture and walls are drawn dimly. Only a pool of candlelight shows around you, and the guests are drawn only when they are within arm\'s reach as a warm dark shape.' },
    ],
  },
  {
    title: 'Hearing',
    blocks: [
      { h: 'Sounds become ripples' },
      { p: 'Every sound a guest makes is drawn on the room as a ripple where it came from, and then as a small mark you can follow. Marks last about ' + MARK_AGE + ' seconds.' },
      { fig: 'sounds', hh: 230 },
      { li: 'A clap is a loud tease. Guests clap every few seconds, each at their own pace.' },
      { li: 'A giggle is an answer to your call, or the laugh of someone who has just run and rested.' },
      { li: 'Footsteps are quiet and only heard when someone is hurrying near you.' },
      { li: 'A dashed ring around a mark is the doubt about where it was. It grows as the sound gets older, because the guest has moved on.' },
      { p: 'With headphones the sounds come from the left or right, and louder when they are near. The ripples show the same thing without headphones.' },
    ],
  },
  {
    title: 'Calling and reaching',
    blocks: [
      { h: 'Call' },
      { p: `Press Call to clap yourself. Every free guest within 520 units answers after a delay that grows with their distance, so you can map the room by the order of the answers. A call can be repeated every ${CLAP_CD} seconds. Guests within 280 units are startled and run from you a little earlier for about 3 seconds.` },
      { h: 'Reach' },
      { p: `Reach sweeps both arms for ${REACH_T} seconds, 84 units long and 120 degrees wide, in the direction you last moved. You walk slowly while your arms are out. After a miss you must wait ${REACH_REC} second before reaching again, and a guest close by laughs and gives away where they stand.` },
      { fig: 'cone', hh: 250 },
      { p: 'Walking into a guest also catches them. Guests that you wrongly named run away and cannot be caught again for under two seconds.' },
    ],
  },
  {
    title: 'Naming who you caught',
    blocks: [
      { h: 'Three clues, one name' },
      { p: 'A caught guest is held while you feel for clues: their height, what is on their head and a trinket they wear. The first clue is free. Each Feel more reveals the next one and counts against your feathers.' },
      { fig: 'clues', hh: 270 },
      { p: 'Choose the portrait of the guest you think you hold, then confirm. The room is paused while you decide: the sand does not run.' },
      { li: 'Right: the guest takes a bow and sits out.' },
      { li: `Wrong: the guest wriggles free, you lose ${WRONG_PENALTY} seconds of sand, and the whole party is on alert for a few seconds.` },
      { p: 'No two guests in a party share the same height, hat and trinket together, so all three clues name exactly one person.' },
    ],
  },
  {
    title: 'The guests',
    blocks: [
      { h: 'Ten characters, four temperaments' },
      { fig: 'roster', hh: 300 },
      { li: `Teaser: claps often and lets you come close before running (runs when you are within ${TEMPERS.teaser.flee} units).` },
      { li: `Shy: claps rarely and runs early, from ${TEMPERS.shy.flee} units away, and needs a longer rest after each run.` },
      { li: `Speedy: a little faster than the others and runs from ${TEMPERS.speedy.flee} units.` },
      { li: `Sneaky: makes no footsteps at all, claps seldom and likes to drift behind you.` },
      { p: 'A running guest tires after a couple of seconds and stops to catch their breath for a moment. That is when to catch them.' },
    ],
  },
  {
    title: 'Rooms, sand and feathers',
    blocks: [
      { h: 'The four rooms' },
      { p: rooms + '. Furniture, hedges and columns block walking and hide nothing: the room is always visible.' },
      { h: 'Points and feathers' },
      { li: 'Each correct name scores 100 points. Each second of sand left scores 2.' },
      { li: 'A wrong name costs 30 points, each Feel more costs 10, each Hint costs 15.' },
      { li: 'Feathers: one for catching everyone, a second if at least half of the sand is left, a third if wrong names, extra clues and hints together come to no more than half the number of guests (rounded down).' },
      { fig: 'feathers', hh: 130 },
      { p: 'Points only. There are no stakes, chips or money.' },
    ],
  },
  {
    title: 'Hide and Dodge',
    blocks: [
      { h: 'You are the guest' },
      { p: `A blindfolded seeker hunts by ear in the same rooms. Stay uncaught for ${HIDE_TIME} seconds. The other guests are computer players that clap and wander; they are decoys, and the seeker may catch them too.` },
      { fig: 'gaits', hh: 230 },
      { li: 'Tiptoe is slow and silent. Standing still is silent as well.' },
      { li: 'Walk is heard only from close by (150 units).' },
      { li: 'Run is fast and heard far (380 units).' },
      { li: `Tease is a very loud clap. The seeker walks to where you were when you clapped. It rests for ${TEASE_CD} seconds.` },
      { p: 'The seeker listens for the loudest and nearest sound of the last couple of seconds, walks to where it thinks it came from (a little wrong, more so when it is far), and sweeps its arms there. If nothing is heard it wanders. Bumping into you catches you too.' },
      { li: 'Score: 10 points per second survived, 50 for each close call (the seeker\'s sweep missing you from within about 100 units), minus 5 per Tease.' },
      { li: 'Feathers: one for surviving, one for at least two close calls, one for running less than 4 seconds in total.' },
    ],
  },
  {
    title: 'Watch and Learn',
    blocks: [
      { h: 'A coached round' },
      { p: `A computer seeker plays a short round in the Salon with ${AUTO_GUESTS} guests and no sand. It works in turns: it listens and thinks for ${THINK_TIMES[1]} seconds (change it in Settings, ${THINK_TIMES[0]} to ${THINK_TIMES[THINK_TIMES.length - 1]}), shows what it decided for ${REVEAL_SECONDS} seconds with its reason, then acts for a moment. The room is frozen while it thinks.` },
      { p: 'It uses only what a player can use: ripples, marks and the warm shapes within arm\'s reach, and the clues it has felt. It pauses with the Pause button, and Pause really stops everything.' },
      { h: 'Hint' },
      { p: 'The Hint button in a real round shows the same advice: the best sound to follow, or which clue to ask for. It counts against your feathers.' },
      { h: 'Settings' },
      { li: 'Sound on or off.' },
      { li: 'Think time for Watch and Learn.' },
      { li: 'Reduced motion: fewer sparks and no screen shake.' },
      { li: 'Text size up to 300% (the A- and A+ buttons on every text screen).' },
    ],
  },
  {
    title: 'Heritage and simplifications',
    blocks: [
      { h: 'Where it comes from' },
      { p: 'Blind man\'s buff is among the oldest children\'s and party games in the world. It is known in Europe, the Middle East, South Asia and the Americas under names such as Colin-Maillard, Blindekuh, Gallina ciega and Korebe. Painters of the eighteenth and nineteenth centuries, among them Goya, Fragonard and Wilkie, set it in gardens and drawing rooms; the costumes and rooms of this game follow that period look.' },
      { h: 'What this game simplifies' },
      { li: 'The caught person does not take the blindfold. The goal is to name each guest in one round.' },
      { li: 'The rooms are small and fixed, and the guests are computer players.' },
      { li: 'Names and costumes are invented characters, not real people.' },
      { li: 'Hearing is simplified: the game shows ripples and, with headphones, places the sound left or right.' },
    ],
  },
];

// Short strings for the Meet the party card and the hide-mode brief.
export const BRIEF_SEEK = 'The blindfold goes on in a moment. These are the guests. Remember their faces: you will name them by touch.';
export const BRIEF_HIDE = 'You are one of the guests. A blindfolded seeker is hunting by ear. Stay quiet, use Tease wisely, and keep out of reach.';
export const ROSTER_COUNT = ROSTER.length;
