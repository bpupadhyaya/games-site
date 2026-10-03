// The Learn path: six short lessons, each one a real toss with coaching. A lesson is a starting position plus a goal
// (the number of tosses to catch). Lessons use the Quick pile (6 stones).
import { PIT, freshPlayer } from './sim.js';

const polar = (r, deg) => ({ x: PIT.x + Math.cos(deg * Math.PI / 180) * r, y: PIT.y + Math.sin(deg * Math.PI / 180) * r });
const ground = (list) => list.map(([r, deg], id) => ({ id, ...polar(r, deg), rot: id * 0.9 }));

// Six stones lying on the yard (the stones of the "bring home" lesson).
export const YARD_LAYOUT = ground([[190, 20], [235, 70], [200, 130], [245, 190], [185, 250], [240, 320]]);
// A layout (found by search) where grabbing the stones nearest the hand first costs about 0.24 s more than the best route.
export const ROUTE_LAYOUT = ground([[216, 155], [232, -153], [218, 25], [169, 22], [205, 1], [266, 22]]);

export const LESSONS = [
  { id: 'one', mode: 'quick', goal: 3, player: () => freshPlayer('quick', { stage: 1, dir: 'out' }) },
  { id: 'bring', mode: 'quick', goal: 3, player: () => freshPlayer('quick', { stage: 1, dir: 'in', pit: [], ground: YARD_LAYOUT.map((s) => ({ ...s })) }) },
  { id: 'two', mode: 'quick', goal: 2, player: () => freshPlayer('quick', { stage: 2, dir: 'out' }) },
  { id: 'route', mode: 'quick', goal: 2, player: () => freshPlayer('quick', { stage: 3, dir: 'in', pit: [], ground: ROUTE_LAYOUT.map((s) => ({ ...s })) }) },
  { id: 'height', mode: 'quick', goal: 2, player: () => freshPlayer('quick', { stage: 3, dir: 'out' }) },
  { id: 'sweep', mode: 'quick', goal: 2, player: () => freshPlayer('quick', { stage: 4, dir: 'out' }) },
];
export const DEMO_LESSONS = 2;
