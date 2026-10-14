// The text of the About, How to Play and Rules pages. Each section: { title, art?, p: [paragraphs] }.
// Every number here is read from the engine (sim.js) so the rules page cannot drift from the game.
import { PLACES, LEVELS, KINDS, NSPOT, COUNT_T, ADJ, WALK_TS, PEEK_T, MOVE_T } from './sim.js';

export const ABOUT = [
  { title: 'Hide and Seek', art: 'scene', p: [
    'One child covers their eyes and counts while the others run to hide. Then the seeker goes looking, and the first one found is the next to seek. Children play it all over the world: as Nascondino in Italy, Petak Umpet in Indonesia and Kakurenbo in Japan, and under many other names.',
    'It is one of the oldest games there is: writers in ancient Greece, among them Pollux, already describe children\'s hiding and chasing games. It needs no equipment, only a few good places to hide, and it has been played in every century since.',
  ] },
  { title: 'About this version', p: [
    'This is a video game version made for phones and tablets. You can seek, tapping places to look and reading clues, or hide, choosing where to tuck yourself away while a seeker that remembers your habits searches.',
    'The three places, the hiding spots and the children are invented for the game and drawn by the game itself. Simplifications: there are eight hiding places in each scene, the seeker looks one place at a time, and rounds are short so they fit a minute or two.',
  ] },
  { title: 'Pictures and credits', p: [
    'The places, hiding spots and sound are drawn and synthesised in the game, and the children are real-time 3D people. Hide and Seek is part of the Arcforge collection of heritage games.',
  ] },
];

export const HOWTO = [
  { title: 'Two ways to play', art: 'scene', p: [
    'Seek: the children hide while the game counts to ten. Find them all before you run out of looks. Hide: you pick a place, and the seeker looks. Stay out of sight until its looks run out.',
  ] },
  { title: 'Look', art: 'clue', p: [
    'Tap a hiding place to look in it. If someone is there they pop out and you score. If not, the place shows a clue number: how many hiders are in the places next to it. Zero means cold, so nobody is close.',
  ] },
  { title: 'Listen', art: 'listen', p: [
    'Listen costs a look but marks three places with a note. Someone is giggling in at least one of them. It helps most when no place stands out.',
  ] },
  { title: 'Hide', art: 'hide', p: [
    'Choose a place while the seeker counts. The seeker then walks to a place and peeks. A red marker shows where it is going: you have a moment to slip away.',
  ] },
  { title: 'Sneak', art: 'sneak', p: [
    'Tap a green neighbour to sneak there. It takes a second and makes a little noise: a seeker standing close may hear it and look there next, even in a place it already checked.',
  ] },
  { title: 'Think and Watch & Learn', p: [
    'Think suggests the best move and says why. A run where you used Think is practice and is not saved as a best.',
    'Watch & Learn plays a whole seeking round for you. It stops to think, shows its choice, then looks. You can pause at any time.',
  ] },
];

const placeLines = PLACES.map((p) => `${p.name} (${p.local}): ${p.blurb} ${p.need ? `Opens after ${p.need} children found.` : 'Always open.'}`);
const spotLines = PLACES.map((p) => `${p.name}: ${p.spots.map((s) => `${s.name} (hides ${Math.round(KINDS[s.kind].q * 100)})`).join(', ')}.`);
const levelLines = LEVELS.map((l) => `${l.name}: ${l.hiders} hider${l.hiders === 1 ? '' : 's'}, ${l.looks} looks and ${l.listens} listen${l.listens === 1 ? '' : 's'} when seeking, ${l.hideLooks} seeker looks when hiding. ${l.counts ? 'Clues show a number.' : 'Clues only say warm or cold.'}`);

export const RULES = [
  { title: 'Goal', art: 'scene', p: [
    'Seeking: find every hider before you run out of looks. Hiding: still be hidden when the seeker has used all of its looks.',
  ] },
  { title: 'The places', art: 'places', p: placeLines },
  { title: 'Hiding places', p: [
    `Every scene has ${NSPOT} hiding places in three rows. Each place has a hiding value from 0 to 100: how well it hides someone. Both the hiders and the seeker prefer good places, so a barrel is chosen more often than a washing line.`,
    ...spotLines,
  ] },
  { title: 'Seeking: the count', p: [
    `The game counts down from ten for about ${COUNT_T.toFixed(1)} seconds while the hiders run. Each hider takes a different place. They choose places in proportion to how well they hide, but avoid the places you tend to look in first, and they remember it from round to round.`,
  ] },
  { title: 'Seeking: looks', art: 'clue', p: [
    'You have a fixed number of looks. Each look in a place is one look used. A place can be looked in once. If a hider is there the hider is found: 100 points.',
    `The place then shows a clue: the number of hiders hidden in the neighbouring places (the places beside it and the ones diagonally behind or in front of it; each place has between ${Math.min(...ADJ.map((a) => a.length))} and ${Math.max(...ADJ.map((a) => a.length))} neighbours). On Hard it only says warm (at least one) or cold (none). Clues count only hiders that are still hidden at that moment.`,
  ] },
  { title: 'Seeking: listening', art: 'listen', p: [
    'Listen uses one look and one of your listens. It marks three places, one of which holds a hider who has not been found, and any of the others may hold one too. The marks stay until you look there.',
  ] },
  { title: 'Seeking: scoring', p: [
    'Each hider found is worth 100. If you find them all, every look left over adds 15 and finding everyone adds 50. A round ends when everybody is found or the looks are used up. Three stars: all found with three or more looks to spare.',
  ] },
  { title: 'Hiding', art: 'hide', p: [
    'Tap a place to hide. After the count the seeker thinks for a moment, picks a place, shows a red marker over it while it walks, then peeks. If you are there, or are on your way from or to it, you are found.',
    `The seeker never picks a place it has already checked unless it hears a noise. It prefers good hiding places, places close to where it just looked, and places where you have hidden before. On Easy it ignores your habits. It walks for ${WALK_TS.map((s) => s.toFixed(2)).join(', ')} seconds (Easy, Regular, Hard) and peeks for ${PEEK_T.toFixed(1)}.`,
  ] },
  { title: 'Sneaking', art: 'sneak', p: [
    `You may sneak to a neighbouring place; the move takes ${MOVE_T.toFixed(2)} seconds and cannot go to the place the seeker is walking to. If the seeker peeks at the place you leave or the place you are going to before you arrive, you are found.`,
    'When you arrive the seeker may hear a rustle. It is more likely to hear it if it is close to your new place. A seeker that heard a rustle will go and look at that place next, even if it looked there before.',
  ] },
  { title: 'Hiding: scoring', p: [
    'Each look you survive scores 10. Staying hidden to the end adds 60. Each sneak that arrives safely adds 25. Three stars: still hidden to the end after two or more safe sneaks.',
  ] },
  { title: 'Levels', p: levelLines },
  { title: 'Modes', p: [
    'Seek and Hide are played in the place you choose on the title screen. Places open as you find children (seeking).',
    'Daily Hunt: the same place and hiders for everybody today, played at Regular level. Watch & Learn plays a seeking round for you. It thinks for the set time (2, 5, 8 or 10 seconds), shows its choice for 2 seconds, then looks. Pause stops everything exactly where it is and Resume continues.',
  ] },
  { title: 'Think', p: [
    'Think rings the place the game would choose, or lights Listen, with the reason. When hiding it suggests where to hide or when to sneak. Using it makes that run practice: its score is not saved as a best.',
  ] },
  { title: 'Simplifications', p: [
    'Real hide and seek has a home base, running and tagging, and children who change places freely. Here the places are fixed, the seeker looks one place at a time, and nothing is chased. Nobody is ever frightened or hurt, no one is eliminated, and there are no stakes: points only.',
  ] },
];
