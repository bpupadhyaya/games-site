// The Settings document: pure data (the view draws it, game.js acts on the ids).
import { LEVELS } from './ai.js';
import { BOARDS, BOARD_KEYS, PIECE_STYLES, STYLE_KEYS } from './art.js';
import { VARIANTS, VARIANT_KEYS } from './rules.js';

// What the player has earned: boards and stones open with wins against the computer.
export const UNLOCK = { board: { granite: 0, soap: 1, copper: 3 }, style: { pebble: 0, ring: 5 } };
export const isOpen = (stats, group, key) => (stats.wins || 0) >= (UNLOCK[group][key] || 0);

export function settingsItems(s) {
  return [
    { k: 'h', t: 'Game' },
    { k: 'seg', id: 'variant', label: 'Triangle', cur: s.variant, opts: VARIANT_KEYS.map((v) => ({ v, l: VARIANTS[v].name })) },
    { k: 'seg', id: 'level', label: 'Computer level', cur: s.level, opts: LEVELS.map((l, i) => ({ v: i, l: l.name })) },
    { k: 'seg', id: 'side', label: 'You play', cur: s.humanSide, opts: [{ v: 1, l: 'Sun (moves first)' }, { v: 2, l: 'River' }] },
    { k: 'h', t: 'Help while you play' },
    { k: 'seg', id: 'marks', label: 'Threat marks (points where the other side would make a line next turn)', cur: s.marks ? 1 : 0, opts: [{ v: 1, l: 'On' }, { v: 0, l: 'Off' }] },
    { k: 'h', t: 'Look and sound' },
    { k: 'seg', id: 'board', label: 'Board', cur: s.board, opts: BOARD_KEYS.map((v) => ({ v, l: BOARDS[v].name, locked: !isOpen(s.stats, 'board', v), need: UNLOCK.board[v] })) },
    { k: 'seg', id: 'style', label: 'Stones', cur: s.style, opts: STYLE_KEYS.map((v) => ({ v, l: PIECE_STYLES[v].name, locked: !isOpen(s.stats, 'style', v), need: UNLOCK.style[v] })) },
    { k: 'seg', id: 'sound', label: 'Sound', cur: s.sound ? 1 : 0, opts: [{ v: 1, l: 'On' }, { v: 0, l: 'Off' }] },
    { k: 'seg', id: 'calm', label: 'Reduced motion', cur: s.calm ? 1 : 0, opts: [{ v: 0, l: 'Off' }, { v: 1, l: 'On' }] },
    { k: 'p', t: `Wins so far: ${s.stats.wins || 0}. Boards and stones open as you win games against the computer.` },
    ...(s.showRestore ? [{ k: 'h', t: 'Purchases' }, { k: 'act', id: 'restore', label: s.owned ? 'Full game unlocked' : s.restoreBusy ? 'Checking...' : 'Restore purchase', disabled: s.owned || s.restoreBusy }, { k: 'p', t: s.restoreMsg || (s.owned ? 'Thank you for playing.' : 'Already bought the full game? Get it back here.') }] : []),
    { k: 'h', t: 'Text size' },
    { k: 'p', t: 'Use A- and A+ at the top of this screen to change the size of the text on the Rules, How to Play, About and Settings screens, up to 300%.' },
  ];
}
