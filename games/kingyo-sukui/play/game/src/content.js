// The text of the About, How to Play and Rules pages. Each section: { title, art?, p: [paragraphs] }.
// Every number here is read from the engine (sim.js) so the rules page cannot drift from the game.
import { FISH, TANKS, GRADES, SHEETS, POI_R, CATCH_R, MAX_SCOOP, TUNE } from './sim.js';

export const ABOUT = [
  { title: 'Kingyo-sukui', art: 'tank', p: [
    'Kingyo-sukui, goldfish scooping, is a summer festival pastime in Japan. At a stall a shallow basin of goldfish waits for you. You are given a poi, a thin sheet of paper stretched over a ring on a handle, and you try to scoop fish into a bowl before the wet paper tears.',
    'The game is also played as a sport: there are national scooping contests in Japan where careful hands and a calm mind decide the winner. It is part of the living heritage of Japan and is meant to be gentle, so the fish are always cared for and put back.',
  ] },
  { title: 'About this version', p: [
    'This is a video game version made for phones and tablets. You drag the poi through the water and let go to lift. The paper wears with time in the water and with speed, wet paper is weaker, and heavy fish strain it. Every tank, fish and paper grade is invented for the game.',
    'Simplifications: you look straight down on one tank, the poi is lifted at the moment you let go, up to three fish ride up together, and every fish you scoop is released back into the water at the end.',
  ] },
  { title: 'Pictures and credits', p: [
    'All art and sound are drawn and synthesised in the game. Kingyo Sukui is part of the Arcforge collection of heritage games.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'tank', p: [
    `Scoop goldfish with a paper poi before the paper tears. A stall session gives you ${SHEETS} sheets of paper; the session ends when the last sheet is spent or the tank is empty.`,
  ] },
  { title: 'Dip the poi', art: 'dip', p: [
    'Press on the water: the poi slides in just above your finger so you can see the paper. Drag slowly. Fish bolt away from a fast or very close poi, but they let a slow one drift under them.',
  ] },
  { title: 'Lift', art: 'lift', p: [
    'Let go when a fish is inside the ring. The poi lifts and the fish over the paper come with it. Lift while moving slowly: a quick sweep makes lively fish slip off.',
  ] },
  { title: 'Watch the paper', art: 'paper', p: [
    'The bar shows how much paper is left. It wears with every second in the water and faster the harder you move, and wet paper is weaker. Heavy fish strain it: if the paper cannot take the weight it tears and the fish drops back.',
  ] },
  { title: 'Think and Watch & Learn', p: [
    'Think rings the fish worth going for and says why. A run where you used Think is practice and is not saved as a best.',
    'Watch & Learn plays a whole session for you. It stops to think, shows its choice, then scoops. You can pause at any time.',
  ] },
];

const fishLines = FISH.map((f) => `${f.name}: weight ${f.w}, worth ${f.pts}, cruises at ${f.spd}, stays on the paper up to speed ${f.grip}.${f.need ? ` Met after ${f.need} fish scooped.` : ' Always in the tank.'}`);
const tankLines = TANKS.map((t) => `${t.name} (${t.time}): ${t.n} fish. ${t.blurb}${t.need ? ` Opened by ${t.need} points in a Stall Session.` : ' Always open.'}`);
const gradeLines = GRADES.map((g) => `${g.name}: points x${g.mult}, strength x${g.str}. ${g.blurb}`);

export const RULES = [
  { title: 'Goal', art: 'poi', p: [
    'Scoop as many goldfish as you can, and the valuable ones, using the paper poi. The fish go into your bowl; at the end they are all released back into the tank.',
  ] },
  { title: 'The poi', p: [
    `The poi is a ring of ${POI_R * 2} units across (the tank is 1000 by 800 units) with paper stretched over it. You start every run with a fresh sheet. A torn sheet is replaced by a new one until the sheets run out.`,
    'Pressing on the tank dips the poi at that spot. It follows your finger with a little softness and sits slightly above the finger so you can see it. Releasing lifts it. On a keyboard use the arrow keys or WASD to move, hold Space to dip and release Space to lift.',
  ] },
  { title: 'Fish and fright', p: [
    'Fish swim between wandering targets, rest now and then near the surface, avoid the walls and each other. They are startled by the splash when the poi enters the water (within about 230 units) and by a poi that moves faster than about 60 units per second when it is near them.',
    'A startled fish bolts away for under a second. The faster the poi moves beyond that speed, the more fish are startled, up to a speed of about 300. Resting fish are the easiest to scoop.',
  ] },
  { title: 'Lifting', art: 'lift', p: [
    `When you let go, every fish whose centre is within ${CATCH_R} units of the ring centre is on the paper, up to ${MAX_SCOOP}. A fish stays on the paper only if the poi was moving no faster than its grip speed; faster than that and it slips off and bolts.`,
    'The scoop is decided at the moment you let go. A scoop with no fish ends your combo.',
  ] },
  { title: 'Paper, wear and tearing', art: 'paper', p: [
    `Paper wears by ${TUNE.wearBase.toFixed(3)} of a sheet per second in the water, plus ${TUNE.wearSpeed} per unit of speed per second. The paper gets wet at ${TUNE.wetUp} per second in the water and dries at ${TUNE.wetDown} per second when lifted.`,
    `Strength is the paper left, times (1 minus ${TUNE.wetWeak} of the wetness), times the paper grade strength. Each fish on the paper adds its weight times ${TUNE.strain} to the load. If the load is greater than the strength the paper tears: the fish drop back and the sheet is spent.`,
    `A good scoop also damages the paper by ${TUNE.damage} of its load, and a sheet below ${Math.round(TUNE.spentBelow * 100)} percent is spent.`,
  ] },
  { title: 'Scoring', p: [
    'A scoop scores the points of its fish, plus 40 percent for each extra fish in the same scoop, times the combo, times the paper grade.',
    'The combo starts at 1 and grows by 0.25 for each consecutive successful scoop up to 2. A torn sheet, a slip or an empty scoop resets it.',
  ] },
  { title: 'Goldfish', art: 'fish', p: fishLines },
  { title: 'Tanks', art: 'night', p: tankLines },
  { title: 'Paper grades', art: 'grade', p: gradeLines },
  { title: 'Modes', p: [
    `Stall Session: ${SHEETS} sheets in the tank and paper grade you choose. Your best per tank is saved and opens new tanks.`,
    'Daily Tank: the same water and fish for everybody today, always with standard paper. Free Scoop: no score and endless paper; every fish you scoop is returned to the water after a moment.',
    'Watch & Learn plays a session for you. It thinks for the set time (2, 5, 8 or 10 seconds), then shows its choice for 2 seconds, then scoops. Pause stops everything exactly where it is and Resume continues.',
  ] },
  { title: 'Think', p: [
    'Think rings the fish the game would go for, with the reason. Using it makes that run practice: its score is not saved as a best.',
  ] },
  { title: 'Unlocking', p: [
    'New goldfish varieties appear in tanks after you have scooped a total number of fish (shown in the Collection). New tanks open when you reach a score in a Stall Session.',
  ] },
  { title: 'Simplifications', p: [
    'Real poi are scooped at an angle with the rim, not lifted straight up. Here one release lifts the paper. Real stalls have different fish and bowls; these tanks and fish are invented. No living animal is harmed: all fish are put back.',
  ] },
];
