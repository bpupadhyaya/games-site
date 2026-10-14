// The Settings document: pure data (the view draws it, game.js acts on the ids).
import { LEVELS } from './ai.js';
import { WOODS, WOOD_KEYS, STYLES, STYLE_KEYS } from './art.js';

// Boards and cap styles open with wins against the computer.
export const isOpen = (stats, group, key) => (stats.wins || 0) >= ((group === 'wood' ? WOODS : STYLES)[key].need || 0);

export function settingsItems(s) {
  return [
    { k: 'h', t: 'Game' },
    { k: 'seg', id: 'level', label: 'Computer level', cur: s.level, opts: LEVELS.map((l, i) => ({ v: i, l: l.name })) },
    { k: 'seg', id: 'side', label: 'You play', cur: s.humanSide, opts: [{ v: 0, l: 'Red (rolls first)' }, { v: 1, l: 'Blue' }] },
    { k: 'h', t: 'Help while you play' },
    { k: 'seg', id: 'marks', label: 'Danger marks (your herders a rival can reach with a die)', cur: s.marks ? 1 : 0, opts: [{ v: 1, l: 'On' }, { v: 0, l: 'Off' }] },
    { k: 'h', t: 'Look and sound' },
    { k: 'seg', id: 'wood', label: 'Board', cur: s.wood, opts: WOOD_KEYS.map((v) => ({ v, l: WOODS[v].name, locked: !isOpen(s.stats, 'wood', v), need: WOODS[v].need })) },
    { k: 'seg', id: 'style', label: 'Caps', cur: s.style, opts: STYLE_KEYS.map((v) => ({ v, l: STYLES[v].name, locked: !isOpen(s.stats, 'style', v), need: STYLES[v].need })) },
    { k: 'seg', id: 'sound', label: 'Sound', cur: s.sound ? 1 : 0, opts: [{ v: 1, l: 'On' }, { v: 0, l: 'Off' }] },
    { k: 'seg', id: 'calm', label: 'Reduced motion', cur: s.calm ? 1 : 0, opts: [{ v: 0, l: 'Off' }, { v: 1, l: 'On' }] },
    { k: 'p', t: `Wins so far: ${s.stats.wins || 0}. Boards and caps open as you win games against the computer.` },
    ...(s.demo ? [] : [
      { k: 'h', t: 'Purchase' },
      { k: 'btn', id: 'restore', label: s.owned ? 'Full game unlocked' : 'Restore purchase', disabled: !!s.owned || !!s.restoreBusy },
      { k: 'p', t: s.restoreMsg || (s.owned ? 'Thank you for playing.' : 'Already bought the full game? Get it back on this device.') },
    ]),
    { k: 'h', t: 'Text size' },
    { k: 'p', t: 'Use A- and A+ at the top of this screen to change the size of the text on the Rules, How to Play, About and Settings screens, up to 300%.' },
  ];
}
