// Shared mapping between the simulation's court units (720 x 960, y grows toward the camera end) and the 3D world in metres.
// One court unit is 1.25 cm, so a player (1.75 m) is about 140 units tall, a runner's hit circle (17 units) is a 21 cm radius, and the
// runners' 185 units per second is 2.3 m/s, which the slow-jog clip (2.4 m/s) covers at almost its own speed (no sliding, no slow motion).
export const S = 0.0125;
export const HZ = 1.35;                                   // heights above the ground are exaggerated a little so the lob reads
export const wx = (x) => (x - 360) * S;
export const wz = (y) => (y - 480) * S;
export const simX = (X) => X / S + 360;
export const simY = (Z) => Z / S + 480;
export const hz = (z) => z * S * HZ;                      // sim height units -> metres
export const STONE_H = 0.017;                             // thickness of a flat stone in metres (seven stones make a tower about 12 cm tall)
export const STONE_R0 = 0.062;                            // radius of the largest (bottom) stone in metres; each next one is 5 mm smaller
export const BALL_R = 0.034;                              // a tennis-size rubber ball is 6.7 cm across
export const VIS = 1.3;                                   // props are drawn at most 1.3x real size so they read on a phone
