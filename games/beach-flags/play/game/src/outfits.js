// The player's outfits: swim cap, singlet and shorts colours. Unlocked by milestones; only the look changes.
// look: { cap, top, bot, skin, hair } (skin and hair come from the default runner).
import { LOOKS } from './sim.js';

const base = LOOKS[0];
const mk = (cap, top, bot) => ({ ...base, cap, top, bot });
export const OUTFITS = [
  { name: 'Gold Cap', how: 'Your first outfit', look: mk('#ffc83d', '#f4f1e6', '#1c3d73') },
  { name: 'Club Red', how: 'Win Club Beach', look: mk('#e8302a', '#e8302a', '#f4f1e6') },
  { name: 'Open Blue', how: 'Win the Open Carnival', look: mk('#1f6fe0', '#1f6fe0', '#f4f1e6') },
  { name: 'Cup Black', how: "Win the Champions' Cup", look: mk('#f4f1e6', '#23262e', '#ffc83d') },
  { name: 'Diver Teal', how: 'Take 10 flags with a dive', look: mk('#20c4b4', '#0f9c92', '#23262e') },
  { name: 'Streak Pink', how: 'Reach a streak of 5 in Sudden Death', look: mk('#ff4f9a', '#ff4f9a', '#23262e') },
];
