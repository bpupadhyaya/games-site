// The Settings document: pure data (the view draws it, game.js acts on the ids).
import { VARIANTS, VARIANT_KEYS } from './rules.js';
import { LEVELS } from './ai.js';
import { CLOTHS, CLOTH_KEYS, DISC_STYLES, STYLE_KEYS } from './art.js';

// What the player has earned: boards and disc styles open with wins against the computer.
export const UNLOCK = { cloth: { emerald: 0, midnight: 1, wine: 3 }, style: { gloss: 0, coral: 5 } };
export const isOpen = (stats, group, key) => (stats.wins || 0) >= (UNLOCK[group][key] || 0);

export function settingsItems(s) {
  return [
    { k: 'h', t: 'Game' },
    { k: 'seg', id: 'variant', label: 'Rule set', cur: s.variant, opts: VARIANT_KEYS.map((v) => ({ v, l: VARIANTS[v].name })) },
    { k: 'p', t: VARIANTS[s.variant].long + ': ' + VARIANTS[s.variant].blurb },
    { k: 'seg', id: 'level', label: 'Computer level', cur: s.level, opts: LEVELS.map((l, i) => ({ v: i, l: l.name })) },
    { k: 'seg', id: 'side', label: 'You play', cur: s.humanSide, opts: [{ v: 1, l: 'Black (moves first)' }, { v: 2, l: 'White' }] },
    { k: 'h', t: 'Help while you play' },
    { k: 'seg', id: 'hints', label: 'Show legal moves', cur: s.hints, opts: [{ v: 'counts', l: 'With flip counts' }, { v: 'dots', l: 'Dots' }, { v: 'off', l: 'Off' }] },
    { k: 'p', t: 'Dots mark every square where you may place a disc. Flip counts also show how many discs each square would turn.' },
    { k: 'h', t: 'Look and sound' },
    { k: 'seg', id: 'cloth', label: 'Board', cur: s.cloth, opts: CLOTH_KEYS.map((v) => ({ v, l: CLOTHS[v].name, locked: !isOpen(s.stats, 'cloth', v), need: UNLOCK.cloth[v] })) },
    { k: 'seg', id: 'style', label: 'Discs', cur: s.style, opts: STYLE_KEYS.map((v) => ({ v, l: DISC_STYLES[v].name, locked: !isOpen(s.stats, 'style', v), need: UNLOCK.style[v] })) },
    { k: 'seg', id: 'sound', label: 'Sound', cur: s.sound ? 1 : 0, opts: [{ v: 1, l: 'On' }, { v: 0, l: 'Off' }] },
    { k: 'seg', id: 'calm', label: 'Reduced motion', cur: s.calm ? 1 : 0, opts: [{ v: 0, l: 'Off' }, { v: 1, l: 'On' }] },
    { k: 'p', t: `Wins so far: ${s.stats.wins || 0}. Boards and disc styles open as you win games against the computer.` },
    { k: 'h', t: 'Text size' },
    { k: 'p', t: 'Use A- and A+ at the top of this screen to change the size of the text on the Rules, How to Play, About and Settings screens, up to 300%.' },
  ];
}
