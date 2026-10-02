// Contact geometry: how far apart two bodies stand at the moment of contact. These numbers were found by the verification scripts
// (verify/*.mjs): at each contact frame the two bodies' limb capsules are measured and the distance is the smallest one at which the
// hand or foot reaches its target on the other body with no more than 2 cm of overlap. The sim places the players with them; the 3D
// presenter only draws. All distances are metres between the two players' root positions.
export const POSE_OF = { ankle: 'lunge', thigh: 'lunge', chain: 'lunge', dash: 'lunge', hold: 'back', block: 'block' };
// a hand or toe touch: the raider stops this far from the defender he is touching (the defender's pose depends on his answer)
export const TOUCH_DIST = {
  hand: { lunge: 1.43, back: 0.84, block: 1.11 },
  toe: { lunge: 1.08, back: 0.7, block: 0.84 },
};
// a running touch: he passes the defender this far to the side and this far along his run (negative = before the defender)
export const RUN_PASS = { lateral: 0.7, along: { lunge: -0.8, back: -0.2, block: -0.4 }, onward: 1.4 };
// the hold: where the defenders stand relative to the raider once the hold is on (f forward toward the defenders, l to the raider's left)
export const HOLD_LEAD = { thigh: 0.85, chain: 0.85, dash: 0.85, hold: 0.85, ankle: 0.95 };
export const HOLD_SIDE = { f: 0.3, l: 1.05 };
export const BLOCK_SLOT = { f: 1.1, l: 0.75 };
// nobody stands closer than this to a raider who is not touching him (his own step, a feint, the bonus reach)
export const KEEP_APART = 1.5;
