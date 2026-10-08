export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const hypot2 = (x, z) => Math.sqrt(x * x + z * z);
export const wrapAng = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
// forward vector for sim yaw phi (phi = 0 faces +z, positive turns toward +x which is screen-right)
export const fwd = (phi) => ({ x: Math.sin(phi), z: Math.cos(phi) });
export const rgt = (phi) => ({ x: Math.cos(phi), z: -Math.sin(phi) });
export const yawOf = (dx, dz) => Math.atan2(dx, dz);
