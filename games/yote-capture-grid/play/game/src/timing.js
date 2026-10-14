// How long each kind of move plays (seconds, before the Reduced-motion scaling), and when the parts of a jump happen inside it.
// Shared by game.js (state, sounds, duration) and view.js (drawing) so the two can never drift apart.
export const TIMING = { drop: 0.5, dropLand: 0.34, step: 0.3, hop: 0.36, capAt: 0.18, capLen: 0.5, bonusAt: 0.62, bonusLen: 0.55 };
