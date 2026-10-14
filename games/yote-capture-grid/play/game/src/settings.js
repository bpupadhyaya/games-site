// The Settings document: pure data (the view draws it, game.js acts on the ids).
import { LEVELS } from './ai.js';
import { BOARDS, BOARD_KEYS, PIECE_STYLES, STYLE_KEYS, sideName } from './art.js';

// What the player has earned: boards and pebble styles open with wins against the computer.
export const UNLOCK = { board: { laterite: 0, dune: 1, rose: 3 }, style: { river: 0, clay: 5 } };
export const isOpen = (stats, group, key) => (stats.wins || 0) >= (UNLOCK[group][key] || 0);

export function settingsItems(s) {
  return [
    { k: 'h', t: 'Game' },
    { k: 'seg', id: 'level', label: 'Computer level', cur: s.level, opts: LEVELS.map((l, i) => ({ v: i, l: l.name })) },
    { k: 'seg', id: 'side', label: 'You play', cur: s.humanSide, opts: [{ v: 1, l: `${sideName(s.style, 1)} (moves first)` }, { v: 2, l: sideName(s.style, 2) }] },
    { k: 'h', t: 'Help while you play' },
    { k: 'seg', id: 'marks', label: 'Danger marks (your pebbles that can be jumped next move)', cur: s.marks ? 1 : 0, opts: [{ v: 1, l: 'On' }, { v: 0, l: 'Off' }] },
    { k: 'h', t: 'Look and sound' },
    { k: 'seg', id: 'board', label: 'Board', cur: s.board, opts: BOARD_KEYS.map((v) => ({ v, l: BOARDS[v].name, locked: !isOpen(s.stats, 'board', v), need: UNLOCK.board[v] })) },
    { k: 'seg', id: 'style', label: 'Pebbles', cur: s.style, opts: STYLE_KEYS.map((v) => ({ v, l: PIECE_STYLES[v].name, locked: !isOpen(s.stats, 'style', v), need: UNLOCK.style[v] })) },
    { k: 'seg', id: 'sound', label: 'Sound', cur: s.sound ? 1 : 0, opts: [{ v: 1, l: 'On' }, { v: 0, l: 'Off' }] },
    { k: 'seg', id: 'calm', label: 'Reduced motion', cur: s.calm ? 1 : 0, opts: [{ v: 0, l: 'Off' }, { v: 1, l: 'On' }] },
    { k: 'p', t: `Wins so far: ${s.stats.wins || 0}. Boards and pebbles open as you win games against the computer.` },
    ...(s.demo ? [] : [
      { k: 'h', t: 'Purchase' },
      { k: 'seg', id: 'restore', label: s.restoreMsg || (s.owned ? 'Thank you for playing.' : 'Already bought the full game? Get it back on this device.'), cur: -1, opts: [{ v: 1, l: s.owned ? 'Full game unlocked' : 'Restore purchase' }] },
    ]),
    { k: 'h', t: 'Text size' },
    { k: 'p', t: 'Use A- and A+ at the top of this screen to change the size of the text on the Rules, How to Play, About and Settings screens, up to 300%.' },
  ];
}
