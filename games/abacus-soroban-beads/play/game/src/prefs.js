import { LOOKS, LOOK_IDS } from './ui.js';
import { THINK_STEPS } from './layout.js';
export const DEFAULT_PREFS = { look: 'kyoto', sound: true, readout: true, digits: true, calm: false, textIdx: 0, thinkIdx: 1, flashLevel: 0, sprintLevel: 0 };
export const SETTINGS = [
  { id: 'look', label: 'Look', opts: LOOK_IDS.map((k) => LOOKS[k].name) },
  { id: 'readout', label: 'Number readout', opts: ['On', 'Off'] },
  { id: 'digits', label: 'Rod digits', opts: ['On', 'Off'] },
  { id: 'sound', label: 'Sound', opts: ['On', 'Off'] },
  { id: 'calm', label: 'Calm motion', opts: ['Off', 'On'] },
  { id: 'think', label: 'Think time', opts: THINK_STEPS.map((n) => `${n}s`) },
  { id: 'restore', label: 'Purchases', opts: ['Restore'] },
];
export const settingIndex = (p, id) => {
  switch (id) {
    case 'look': return LOOK_IDS.indexOf(p.look);
    case 'readout': return p.readout ? 0 : 1;
    case 'digits': return p.digits ? 0 : 1;
    case 'sound': return p.sound ? 0 : 1;
    case 'calm': return p.calm ? 1 : 0;
    case 'think': return p.thinkIdx;
    default: return -1;
  }
};
