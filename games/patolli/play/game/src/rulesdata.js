// Table settings that are not rules of the board itself: seats, timings, the free preview. Used by game.js, view.js and the Rules book.
export const MIN_SEATS = 2;
export const MAX_SEATS = 4;
export const THINK_CHOICES = [2, 3, 5, 8, 10];     // Watch and Learn: seconds of Think before the choice is revealed (default 5, cap 10)
export const DEFAULT_THINK_IDX = 2;
export const REVEAL_SECONDS = 2;
export const DEMO_GAMES = 3;
export const PREVIEW_NOTE = 'The full game starts with a free preview of 90 seconds of real play, then asks you to unlock it once.';
export const ROSTER = [{ name: 'Jade' }, { name: 'Cochineal' }, { name: 'Maya Blue' }, { name: 'Amaranth' }];
export const SPEEDS = [{ name: 'Normal', k: 1 }, { name: 'Fast', k: 0.55 }];
