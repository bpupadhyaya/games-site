// About, How to Play and Rules text. The numbers here are the engine's own constants (consts.js); the Rules page is kept in step with the code.
import { RANGE, BOARD, NEAR, POINTS, MATCH_TARGETS, MATCH_NAMES, V0, DRAW_T, BREATH_T, BREATH_CALM, TEAM_SIZE, ARROWS_PER_TURN, ZOOMS, LEVELS, HELP_NAMES } from './consts.js';

const cm = (m) => Math.round(m * 100);
export const ABOUT = [
  { title: 'Datse: Bhutan Archery', p: [
    'Archery is the national sport of Bhutan, a mountain kingdom in the eastern Himalaya. In the traditional match, called datse, two teams shoot at small painted wooden boards more than 140 metres apart, across a field in a valley. Spectators sing and joke, and when a shot finds the bullseye the shooter\'s team dances.',
    'This game brings that match to your phone: a real valley in 3D, a bamboo bow, the wind to read, a long arrow flight to follow, and a team celebration when you land the karay, the bullseye.',
  ] },
  { title: 'A game, not a ceremony', p: [
    'Datse: Bhutan Archery is a sports game made with respect for the craft and the friendly spirit of the match. It simplifies the scoring and shows only what a spectator sees on the field: archers, boards, flags, mountains and farmhouses.',
  ] },
  { title: 'Made by Arcforge', p: [
    'Datse: Bhutan Archery is part of Arcforge, a collection of world heritage games. Everything in the game is drawn and played on your device; no account is needed and nothing is collected.',
    'Your records, settings and an unfinished match are saved on this device.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', p: [`Your team of ${TEAM_SIZE} archers plays a team of ${TEAM_SIZE}. Each archer shoots ${ARROWS_PER_TURN} arrows in a row, then the other team shoots. The board is ${RANGE} metres away, so the arrow takes about three seconds to fly and the wind can push it more than a metre sideways.`] },
  { title: '1. Aim', p: ['Drag your finger on the sight lens (the round window) or anywhere on the picture above the buttons. The reticle moves over the board; the lens shows the board close up. The Zoom button changes how close.', 'The wind compass shows where the wind goes; the streamers on the poles show the same wind in the valley. With Standard help the reticle ignores the wind, so you move it upwind of the board. With Guided help the reticle already includes the wind.'] },
  { title: '2. Draw', p: ['Press and hold the round DRAW button. The archer draws the bow; the ring around the button fills in about a second. Do not let go early: a short draw falls short.', 'Keep holding. The arm slowly tires, and the reticle sways with the breath. The ring around the lens turns green at the calm moment of each breath.'] },
  { title: '3. Release', p: ['Let go of the button when the reticle is on the board and the ring is green. The arrow flies; touch and hold the screen to speed up the flight.'] },
  { title: '4. Score', p: [`Karay (the painted bullseye) ${POINTS.karay} points, anywhere else on the board ${POINTS.hit}, and a near miss on the ground ${POINTS.hit - 1} point. At the end of each round of shooting, hits cancel out and the better team gets the difference. A bullseye makes your team dance.`] },
  { title: 'Think, Pause and Watch & Learn', p: ['Think gives a hint from the coach: how the wind will push the arrow and where to put the reticle; one tap can move it for you.', 'Watch & Learn plays a whole match between two computer teams and tells you why each shot is aimed the way it is; Pause stops everything where it is.', 'Practice gives unlimited arrows with a wind you choose. Learn has three short lessons.'] },
  { title: 'Keys (web)', p: ['Arrow keys move the reticle (Shift for fine), Space holds the draw and lets go, Z zooms, T is Think, P or Escape pauses, + and - change the text size.'] },
];

export const RULES = [
  { title: 'The sport', p: [
    'Datse is Bhutan\'s national sport. Teams shoot traditional bamboo bows at painted wooden boards set far apart across a valley field, taking turns and walking to the other end to shoot back. Friends and neighbours watch from the sides.',
    'The real match is longer and has more scoring rules than a phone game can hold. This game keeps the heart of it: a very long shot, the wind, two arrows per turn, teams, and the dance for a bullseye. The scoring below is a simplified version.',
  ] },
  { title: 'The range', art: 'range', p: [
    `Two boards stand ${RANGE} metres apart in a valley meadow. Each board is ${cm(BOARD.h)} cm tall and ${cm(BOARD.w)} cm wide, painted, with a small round bullseye called the karay about ${cm(BOARD.karayY)} cm above the ground (radius ${cm(BOARD.karayR)} cm).`,
    'Archers shoot from a stand beside their own board towards the board at the other end. After each end they walk across and shoot back, so the view down the valley changes every time.',
  ] },
  { title: 'The board', art: 'board', p: [
    `Karay: the arrow lands inside the painted circle: ${POINTS.karay} points.`,
    `Board: the arrow strikes the board anywhere else: ${POINTS.hit} points.`,
    `Near: the arrow misses but lands on the ground within ${NEAR} metre (about one arrow length) of the board, short, long or to the side: ${POINTS.near} point.`,
    'Anything further away scores nothing. An arrow that passes over or beside the board and lands far away is a miss.',
  ] },
  { title: 'Teams and turns', p: [
    `Each team has ${TEAM_SIZE} archers. A turn is one archer shooting ${ARROWS_PER_TURN} arrows in a row. The teams alternate: first team, archer 1; second team, archer 1; and so on, ${TEAM_SIZE * 2} turns in all. That is one end: ${TEAM_SIZE * ARROWS_PER_TURN} arrows for each team.`,
    'The team that shoots first alternates from one end to the next.',
  ] },
  { title: 'Ends and the match', p: [
    'When all turns of an end are done, each team adds up its points for that end. Hits cancel out one for one: the team with more points wins the difference and the other team scores nothing. If both have the same, nobody scores.',
    `The match is won by the first team to reach the target: ${MATCH_NAMES.map((n, i) => `${n} ${MATCH_TARGETS[i]}`).join(', ')}. If nobody gets there in 14 ends the team that is ahead wins; if they are level, shooting goes on until someone leads.`,
  ] },
  { title: 'The wind and the arrow', p: [
    `The arrow leaves the bow at about ${V0} metres per second and is slowed by the air, pulled down by gravity and pushed by the wind for its whole flight of roughly three seconds. A crosswind of 4 m/s moves it more than a metre sideways at the board. A wind in your face makes it fall short; a wind from behind lifts it.`,
    'The wind changes strength and direction between turns and gusts a little while the arrow flies, so no shot is certain. The flags and the wind compass show the wind at the moment you shoot.',
  ] },
  { title: 'Aiming', p: [
    `The sight lens looks at the board from the bow. Zoom shows a picture ${ZOOMS.join(', ')} metres wide at the board. The reticle marks where the arrow will cross the board.`,
    `${HELP_NAMES[0]}: the reticle includes the current wind. ${HELP_NAMES[1]}: the reticle ignores the wind, so move it against the wind yourself. ${HELP_NAMES[2]}: as Standard, and the compass shows no number, so read the flags.`,
  ] },
  { title: 'Drawing and releasing', p: [
    `Full draw takes ${DRAW_T.toFixed(2)} seconds. Let go before the ring is full and the arrow is slow and falls short. After full draw the arm slowly tires.`,
    `The reticle sways with the archer\'s breath. Each breath lasts about ${BREATH_T.toFixed(1)} seconds and the arm is steadiest about ${BREATH_CALM.toFixed(1)} seconds after the draw begins and then once every breath. Hold too long and the sway grows. If you let go in the first third of a second, the draw is simply cancelled.`,
  ] },
  { title: 'The computer teams', p: [
    `There are three levels: ${LEVELS.map((l) => l.name).join(', ')}. Better teams read the wind more closely and shoot more steadily, but even the best miss now and then.`,
  ] },
  { title: 'Practice, Learn and Watch & Learn', p: [
    'Practice: one archer, unlimited arrows, and you can choose the wind.',
    'Learn: three short lessons, each with a goal in six arrows.',
    'Watch & Learn: two computer teams play a match. Before each shot the coach thinks aloud (you can choose how long), shows the aim, then the archer shoots. You can pause at any moment.',
  ] },
  { title: 'What is simplified', p: [
    'Real matches use larger teams, run over many hours, and have a more detailed scoring system. Here teams have three archers, the scoring is the simple one above, and ends are short. Distances, board size and the bamboo bow follow the real sport.',
  ] },
];

