// The Settings document: pure data (the view draws it, game.js acts on the ids).
import { VARIANTS, VARIANT_KEYS } from './rules.js';
import { LEVELS } from './ai.js';
import { WOODS, WOOD_KEYS, PIECE_STYLES, STYLE_KEYS } from './art.js';

// What the player has earned: boards and piece cuts open with wins against the computer.
export const UNLOCK = { wood: { satin: 0, calamander: 1, jade: 3 }, style: { faceted: 0, cabochon: 2 } };
export const isOpen = (stats, group, key) => (stats.wins || 0) >= (UNLOCK[group][key] || 0);

export function settingsItems(s) {
  return [
    { k: 'h', t: 'Game' },
    { k: 'seg', id: 'variant', label: 'Rule set', cur: s.variant, opts: VARIANT_KEYS.map((v) => ({ v, l: VARIANTS[v].name })) },
    { k: 'p', t: VARIANTS[s.variant].long + ': ' + VARIANTS[s.variant].blurb },
    { k: 'seg', id: 'level', label: 'Computer level', cur: s.level, opts: LEVELS.map((l, i) => ({ v: i, l: l.name })) },
    { k: 'seg', id: 'side', label: 'You play', cur: s.humanSide, opts: [{ v: 1, l: 'Ruby (moves first)' }, { v: 2, l: 'Sapphire' }] },
    { k: 'h', t: 'Help while you play' },
    { k: 'seg', id: 'marks', label: 'Danger marks (your pieces that can be captured next move)', cur: s.marks ? 1 : 0, opts: [{ v: 1, l: 'On' }, { v: 0, l: 'Off' }] },
    { k: 'h', t: 'Look and sound' },
    { k: 'seg', id: 'wood', label: 'Board', cur: s.wood, opts: WOOD_KEYS.map((v) => ({ v, l: WOODS[v].name, locked: !isOpen(s.stats, 'wood', v), need: UNLOCK.wood[v] })) },
    { k: 'seg', id: 'style', label: 'Pieces', cur: s.style, opts: STYLE_KEYS.map((v) => ({ v, l: PIECE_STYLES[v].name, locked: !isOpen(s.stats, 'style', v), need: UNLOCK.style[v] })) },
    { k: 'p', t: 'Ruby pieces are round and Sapphire pieces have eight sides, so you can tell them apart without colour.' },
    { k: 'seg', id: 'sound', label: 'Sound', cur: s.sound ? 1 : 0, opts: [{ v: 1, l: 'On' }, { v: 0, l: 'Off' }] },
    { k: 'seg', id: 'calm', label: 'Reduced motion', cur: s.calm ? 1 : 0, opts: [{ v: 0, l: 'Off' }, { v: 1, l: 'On' }] },
    { k: 'p', t: `Wins so far: ${s.stats.wins || 0}. Boards and piece cuts open as you win games against the computer.` },
    ...(s.demo ? [] : [{ k: 'h', t: 'Full game' },
      ...(s.owned ? [{ k: 'p', t: 'Full game unlocked. Thank you!' }]
        : [{ k: 'btn', id: 'restore', label: s.restoreBusy ? 'Checking with the store…' : 'Restore purchase', disabled: !!s.restoreBusy },
           ...(s.restoreMsg ? [{ k: 'p', t: s.restoreMsg }] : [])])]),
    { k: 'h', t: 'Text size' },
    { k: 'p', t: 'Use A- and A+ at the top of this screen to change the size of the text on the Rules, How to Play, About and Settings screens, up to 300%.' },
  ];
}
