// The Learn path: six short lessons, each one a real stage played with coaching. Stages need no setup beyond this list.
import { HOME } from './sim.js';

// A fixed layout for the "reading the route" lesson: the nearest stone sits right in front of a farther one, so taking
// them nearest-first brushes a neighbour. Stone ids keep their colours.
export const ROUTE_LAYOUT = [
  { id: 0, x: 330, y: 430, rot: 0.3 },
  { id: 1, x: 330, y: 560, rot: 1.1 },
  { id: 2, x: 190, y: 330, rot: 2.0 },
  { id: 3, x: 470, y: 330, rot: 0.7 },
  { id: 4, x: 330, y: 250, rot: 1.6 },
];

export const LESSONS = [
  { id: 'one', stage: 1, kind: 'stage' },
  { id: 'two', stage: 2, kind: 'stage' },
  { id: 'three', stage: 3, kind: 'stage' },
  { id: 'four', stage: 4, kind: 'stage' },
  { id: 'kk', stage: 5, kind: 'stage' },
  { id: 'route', stage: 3, kind: 'stage', fixed: ROUTE_LAYOUT },
];
export const DEMO_LESSONS = 2;
void HOME;
