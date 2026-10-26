// Table settings that are not rules of the board itself: seats, timings, the free preview. Used by game.js and the Rules book.
export const MIN_SEATS = 2;
export const MAX_SEATS = 6;
export const THINK_CHOICES = [2, 3, 5, 8, 10];     // Watch and Learn: seconds of Think before the options are revealed (default 5, cap 10)
export const DEFAULT_THINK_IDX = 2;
export const REVEAL_SECONDS = 2;
export const DEMO_GAMES = 3;
export const PREVIEW_NOTE = 'Free to play with short ads; go ad-free once.';
export const ROSTER = [
  { name: 'Isabella' }, { name: 'Cosimo' }, { name: 'Lucrezia' }, { name: 'Federico' }, { name: 'Caterina' }, { name: 'Bartolomeo' },
];
export const SPEEDS = [{ name: 'Normal', k: 1 }, { name: 'Fast', k: 0.55 }];
