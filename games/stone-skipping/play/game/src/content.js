// The text of the About, How to Play and Rules pages. Each section: { title, art?, p: [paragraphs] }.
// Every number here is read from the engine (sim.js) so the rules page cannot drift from the game.
import { STONES, PONDS, SESSION_THROWS, AOA_BEST, TILT_MAX, PWR_MIN, PWR_MAX, SPIN_MAX, SPIN_COST } from './sim.js';

export const ABOUT = [
  { title: 'Stone Skipping', art: 'stone', p: [
    'Stone skipping, also called stone skimming or ducks and drakes, is played on lakes, rivers and seashores all over the world. A flat stone is thrown low and fast across the water and bounces off the surface again and again before it sinks.',
    'It is a pastime of every shoreline rather than of one place, and it is also a sport: there are skimming competitions where the number of skips or the distance decides the winner.',
  ] },
  { title: 'About this version', p: [
    'This is a video game version made for phones and tablets. You choose a stone, set its tilt and spin, and flick it across the water. The stone follows a simple physical model: the angle at which it meets the water, its speed and its spin decide how well it skips.',
    'The ponds, the wind and the stones are invented for the game. Simplifications: one stone is thrown at a time from the shore, the water is always a straight lane and the wind only changes the speed of the stone and the shape of the waves.',
  ] },
  { title: 'Pictures and credits', p: [
    'The lake, the shore and the thrower are a real-time 3D scene, and all sound is synthesised in the game. The third-party credits for the 3D people and scenery are listed below. Stone Skipping is part of the Arcforge collection of heritage games.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'overview', p: [
    'Skip the stone across the water as many times as you can. Each bounce on the water is one skip. A session is five throws, each with a different stone.',
  ] },
  { title: 'Choose a stone', art: 'tray', p: [
    'Tap one of the three stones in the tray. Each has its own weight, flatness and grip: a flat stone has a wider window for a good skip, a heavy stone keeps its speed, a light one spins up easily.',
  ] },
  { title: 'Set the tilt and the spin', art: 'tilt', p: [
    'Slide Tilt to set how far the front of the stone is raised. Around 12 to 16 degrees is a good start. Slide Spin up for a steadier stone: spin keeps the angle true from skip to skip, but costs some speed.',
  ] },
  { title: 'Flick it', art: 'flick', p: [
    'Press the stone at the bottom of the pond, drag up and let go. The longer your pull, the faster the stone flies. Read the wind first: a headwind slows the stone, a tailwind carries it.',
  ] },
  { title: 'Think and Watch & Learn', p: [
    'Think shows the stone, tilt, spin and pull that a good player would use, with the reason. A session where you used Think is practice and is not saved as a best.',
    'Watch & Learn plays a whole session for you. It stops to think, shows its choice, then throws. You can pause at any time.',
  ] },
];

const stoneLines = STONES.map((s) => `${s.name}: ${Math.round(s.m * 1000)} g, flatness ${Math.round(s.flat * 100)}%, grip ${s.grip.toFixed(2)}.${s.need ? ` Unlocked by a throw of ${s.need} skips.` : ' Always available.'}`);
const pondLines = PONDS.map((p) => `${p.name} (${p.time}): ${p.blurb}${p.need ? ` Unlocked by a throw of ${p.need} skips.` : ' Always open.'}`);
export const RULES = [
  { title: 'Goal', p: [
    'Make the stone skip across the water as many times as possible. Every time it bounces off the surface counts as one skip. The throw ends when the stone sinks.',
    `A session is ${SESSION_THROWS} throws. Your score is the total number of skips. The best single throw and the longest distance are kept as your records.`,
  ] },
  { title: 'The throw', art: 'flick', p: [
    'Before each throw you choose a stone from a tray of three, set its tilt and spin and then pull and release it. The stone leaves your hand low over the water.',
    `Tilt runs from 0 to ${TILT_MAX} degrees. Spin runs from 0 to 100 percent of the most your stone's grip can give (up to ${SPIN_MAX} turns a second). The pull sets the launch speed from ${PWR_MIN} to ${PWR_MAX} metres a second.`,
    `Spin costs speed: full spin takes ${Math.round(SPIN_COST * 100)} percent off the launch speed, and a harder throw leaves less of the arm for spin.`,
  ] },
  { title: 'The angle at the water', art: 'angle', p: [
    'The first thing that decides a skip is the angle between the flat of the stone and the water it meets. It is made of your tilt, the angle at which the stone is falling, and the slope of the water surface at that spot.',
    `The best angle is ${AOA_BEST} degrees. The window around it is wider for a flat stone and narrower for a round one, and it narrows further as the stone gets faster. A stone that meets the water outside its window digs in and sinks; above 38 degrees it plunges at once.`,
  ] },
  { title: 'Speed and bounce', p: [
    'Each skip costs some speed and some height: the bounce is a fraction of how hard the stone fell, and a better angle keeps more of it. A slow stone cannot plane on the water, so its bounces get weaker as it slows.',
    'The throw ends when the bounce becomes too small to leave the water or the stone has slowed below about 3.6 metres a second. The skips then come closer and closer together before the stone sinks.',
  ] },
  { title: 'Spin', art: 'spin', p: [
    'A spinning stone behaves like a gyroscope and holds its tilt. A stone with too little spin for its speed wobbles: its tilt changes by a few degrees at every skip. The faster the stone, the more spin it needs.',
    'Spin also fades a little with every skip. A hard wrist snap is slightly less exact, so full spin makes the starting tilt a few degrees uncertain.',
  ] },
  { title: 'Wind and water', art: 'water', p: [
    'The wind flag shows the wind along the lane: a tailwind helps carry the stone, a headwind slows it, and a light stone feels it more than a heavy one. Gusty ponds change the wind during the flight.',
    'The surface adds its own slope. Chop gives a small random slope at every skip. Swell is a long wave: a bright band on the water is a rising face that adds angle, a dark band is a falling face that takes angle away.',
  ] },
  { title: 'Stones', art: 'stones', p: stoneLines },
  { title: 'Ponds', p: pondLines },
  { title: 'Modes', p: [
    `Pond Session: ${SESSION_THROWS} throws on the pond you chose in the Collection. Daily Pond: the same pond, wind and stones for everybody today; your best of the day is kept. Free Skip: unlimited throws with no score, for practice and calm.`,
    'Watch & Learn plays a whole session for you. Before each throw the game stops to think for the time you chose in Settings (2, 5, 8 or 10 seconds), then shows its stone, tilt, spin and pull for two seconds, then throws. Pause freezes everything exactly where it is.',
  ] },
  { title: 'Think hint', p: [
    'Think tries the tilt, spin and pull for every stone in the tray against the current wind and water, and shows the best of them with a short reason. A session where you used Think is practice and is not saved as a best.',
  ] },
  { title: 'Ranks', p: [
    'Session totals earn a title: First Steps, Pebble Tosser (10 skips), Steady Thrower (22), Skimmer (40), Pond Legend (60) and Master Skimmer (80).',
  ] },
  { title: 'Free to play', p: [
    'Free to play with short ads; go ad-free once.',
  ] },
];
