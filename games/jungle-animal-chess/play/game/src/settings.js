// The Settings document: pure data (the view draws it, game.js acts on the ids).
import { LEVELS } from './ai.js';
import { THEMES, THEME_KEYS } from './art.js';

// What the player has earned: boards and piece styles open with wins against the computer.
export const UNLOCK = { theme: { meadow: 0, dusk: 1, bamboo: 3 }, style: { classic: 0, night: 5 } };
export const STYLE_NAMES = { classic: 'Parchment', night: 'Midnight' };
export const STYLE_KEYS = ['classic', 'night'];
export const isOpen = (stats, group, key) => (stats.wins || 0) >= (UNLOCK[group][key] || 0);

export function settingsItems(s) {
  return [
    { k: 'h', t: 'Game' },
    { k: 'seg', id: 'level', label: 'Computer level', cur: s.level, opts: LEVELS.map((l, i) => ({ v: i, l: l.name })) },
    { k: 'seg', id: 'side', label: 'You play', cur: s.humanSide, opts: [{ v: 1, l: 'Red (moves first)' }, { v: 2, l: 'Blue' }] },
    { k: 'h', t: 'Help while you play' },
    { k: 'seg', id: 'marks', label: 'Danger marks (your animals that can be eaten next move)', cur: s.marks ? 1 : 0, opts: [{ v: 1, l: 'On' }, { v: 0, l: 'Off' }] },
    { k: 'h', t: 'Look and sound' },
    { k: 'seg', id: 'theme', label: 'Board', cur: s.theme, opts: THEME_KEYS.map((v) => ({ v, l: THEMES[v].name, locked: !isOpen(s.stats, 'theme', v), need: UNLOCK.theme[v] })) },
    { k: 'seg', id: 'style', label: 'Animal tokens', cur: s.style, opts: STYLE_KEYS.map((v) => ({ v, l: STYLE_NAMES[v], locked: !isOpen(s.stats, 'style', v), need: UNLOCK.style[v] })) },
    { k: 'seg', id: 'sound', label: 'Sound', cur: s.sound ? 1 : 0, opts: [{ v: 1, l: 'On' }, { v: 0, l: 'Off' }] },
    { k: 'seg', id: 'calm', label: 'Reduced motion', cur: s.calm ? 1 : 0, opts: [{ v: 0, l: 'Off' }, { v: 1, l: 'On' }] },
    { k: 'p', t: `Wins so far: ${s.stats.wins || 0}. Boards and animal tokens open as you win games against the computer.` },
    { k: 'h', t: 'Text size' },
    { k: 'p', t: 'Use A- and A+ at the top of this screen to change the size of the text on the Rules, How to Play, About and Settings screens, up to 300%.' },
  ];
}
