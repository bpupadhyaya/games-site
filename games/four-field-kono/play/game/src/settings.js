// The Settings document: pure data (the view draws it, game.js acts on the ids).
import { VARIANTS, VARIANT_KEYS } from './rules.js';
import { LEVELS } from './ai.js';
import { PAPERS, PAPER_KEYS } from './art.js';

// What the player has earned: board papers open with wins against the computer.
export const UNLOCK = { paper: { hanji: 0, indigo: 1, celadon: 3 } };
export const isOpen = (stats, group, key) => (stats.wins || 0) >= (UNLOCK[group][key] || 0);

export function settingsItems(s) {
  return [
    { k: 'h', t: 'Game' },
    { k: 'seg', id: 'variant', label: 'Board', cur: s.variant, opts: VARIANT_KEYS.map((v) => ({ v, l: VARIANTS[v].name })) },
    { k: 'p', t: VARIANTS[s.variant].long + ': ' + VARIANTS[s.variant].blurb },
    { k: 'seg', id: 'level', label: 'Computer level', cur: s.level, opts: LEVELS.map((l, i) => ({ v: i, l: l.name })) },
    { k: 'seg', id: 'side', label: 'You play', cur: s.humanSide, opts: [{ v: 1, l: 'Jade' }, { v: 2, l: 'Ember' }] },
    { k: 'h', t: 'Help while you play' },
    { k: 'seg', id: 'marks', label: 'Danger marks (your stones that can be jumped next move)', cur: s.marks ? 1 : 0, opts: [{ v: 1, l: 'On' }, { v: 0, l: 'Off' }] },
    { k: 'h', t: 'Look and sound' },
    { k: 'seg', id: 'paper', label: 'Board paper', cur: s.paper, opts: PAPER_KEYS.map((v) => ({ v, l: PAPERS[v].name, locked: !isOpen(s.stats, 'paper', v), need: UNLOCK.paper[v] })) },
    { k: 'seg', id: 'sound', label: 'Sound', cur: s.sound ? 1 : 0, opts: [{ v: 1, l: 'On' }, { v: 0, l: 'Off' }] },
    { k: 'seg', id: 'calm', label: 'Reduced motion', cur: s.calm ? 1 : 0, opts: [{ v: 0, l: 'Off' }, { v: 1, l: 'On' }] },
    { k: 'p', t: `Wins so far: ${s.stats.wins || 0}. Board papers open as you win games against the computer.` },
    ...(s.demo ? [] : [
      { k: 'h', t: 'Full game' },
      s.owned ? { k: 'p', t: 'Full game unlocked. Thank you!' }
        : { k: 'act', id: 'restore', label: s.restoreBusy ? 'Checking...' : 'Restore purchase', disabled: !!s.restoreBusy },
      ...(s.restoreMsg && !s.owned ? [{ k: 'p', t: s.restoreMsg }] : []),
    ]),
    { k: 'h', t: 'Text size' },
    { k: 'p', t: 'Use A- and A+ at the top of this screen to change the size of the text on the Rules, How to Play, About and Settings screens, up to 300%.' },
  ];
}
