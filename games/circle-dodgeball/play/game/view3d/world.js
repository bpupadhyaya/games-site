// Court units <-> metres. The simulation works in court units (x, y on a 1000 x 1000 floor, heights z in the same units); the 3D scene is
// in metres, at 66 units to the metre: the painted circle (radius 440) is 6.7 m (a real queimada / volkerball circle), a person is drawn
// 1.75 m tall (a little bigger than the simulation's 88 unit body, so they read on a phone), and a player's top speed (235 units/s)
// is 3.6 m/s, a real run. Heights are drawn 1.3 times the horizontal scale so a ball released at 54 units leaves the hand at about
// 1.06 m and a lob rises above the heads.
// x east, y up, z south: court y grows toward +z, the human team's half is nearest the camera.
export const S = 66;
export const HK = 1.3;
export const wx = (X) => (X - 500) / S;
export const wz = (Y) => (Y - 500) / S;
export const hz = (Z) => (Z * HK) / S;
export const cx = (x) => x * S + 500;
export const cz = (z) => z * S + 500;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
