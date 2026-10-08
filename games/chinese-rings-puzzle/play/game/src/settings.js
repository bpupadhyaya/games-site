// The Settings document: pure data (the view draws it, game.js acts on the ids).
import { MIN_RINGS, MAX_RINGS } from './rules.js';
import { FINISHES, FINISH_KEYS } from './art.js';

// What the player has earned: ring finishes open with puzzles solved by hand (not by Auto Play).
export const UNLOCK = { finish: { steel: 0, brass: 1, iron: 3 } };
export const isOpen = (stats, group, key) => (stats.solved || 0) >= (UNLOCK[group][key] || 0);

export function settingsItems(s) {
  const ringOpts = []; for (let n = MIN_RINGS; n <= MAX_RINGS; n++) ringOpts.push({ v: n, l: String(n) });
  return [
    { k: 'h', t: 'Puzzle' },
    { k: 'seg', id: 'mode', label: 'Start position', cur: s.mode, opts: [{ v: 'classic', l: 'Classic' }, { v: 'scramble', l: 'Scramble' }] },
    { k: 'p', t: s.mode === 'classic' ? 'Classic: every ring starts on the bar.' : 'Scramble: a random legal position, so every puzzle is different.' },
    { k: 'seg', id: 'rings', label: 'Number of rings', cur: s.n, opts: ringOpts },
    { k: 'h', t: 'Help while you play' },
    { k: 'seg', id: 'assist', label: 'Glow the rings that can move now', cur: s.assist ? 1 : 0, opts: [{ v: 1, l: 'On' }, { v: 0, l: 'Off' }] },
    { k: 'seg', id: 'lamps', label: 'Pattern lamps under the bar', cur: s.lamps ? 1 : 0, opts: [{ v: 1, l: 'On' }, { v: 0, l: 'Off' }] },
    { k: 'h', t: 'Look and sound' },
    { k: 'seg', id: 'finish', label: 'Rings', cur: s.finish, opts: FINISH_KEYS.map((v) => ({ v, l: FINISHES[v].name, locked: !isOpen(s.stats, 'finish', v), need: UNLOCK.finish[v] })) },
    { k: 'seg', id: 'sound', label: 'Sound', cur: s.sound ? 1 : 0, opts: [{ v: 1, l: 'On' }, { v: 0, l: 'Off' }] },
    { k: 'seg', id: 'calm', label: 'Reduced motion', cur: s.calm ? 1 : 0, opts: [{ v: 0, l: 'Off' }, { v: 1, l: 'On' }] },
    { k: 'p', t: `Puzzles solved so far: ${s.stats.solved || 0}. New ring finishes open as you solve puzzles yourself.` },
    { k: 'h', t: 'Text size' },
    { k: 'p', t: 'Use A- and A+ at the top of this screen to change the size of the text on the Rules, How to Play, About and Settings screens, up to 300%.' },
  ];
}
