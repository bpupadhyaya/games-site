// The 3D stage camera as pure maths, shared by the 2D overlay (popups, markers) and the WebGL presenter so a glyph sits exactly where the
// dancer or the footprint is. World: metres, +x to the viewer's right, +y up, +z towards the viewer; the dancer's lane is z = 0.
// The eye is CAM3.D metres in front of the stage at height CAM3.EH, pitched down CAM3.PITCH; the world origin (the dancer's feet at the
// middle of the stage) lands on screen point (ox, oy); `ppm` is pixels (virtual units) per metre at the dancer.
export const CAM3 = { D: 12, EH: 2.6, PITCH: 9.5 * Math.PI / 180 };

export function cam3(ox, oy, ppm) {
  const { D, EH, PITCH } = CAM3, sp = Math.sin(PITCH), cp = Math.cos(PITCH);
  const depth0 = EH * sp + D * cp, F = ppm * depth0;
  const raw = (x, y, z) => {
    const ry = y - EH, rz = z - D, dep = -ry * sp - rz * cp, cu = ry * cp - rz * sp;
    return [F * x / dep, -F * cu / dep];
  };
  const o = raw(0, 0, 0);
  const proj = (x, y, z = 0) => { const r = raw(x, y, z); return { x: ox + r[0] - o[0], y: oy + r[1] - o[1] }; };
  return { ox, oy, ppm, F, depth0, proj, sx: (x, y = 0, z = 0) => proj(x, y, z).x, sy: (y, x = 0, z = 0) => proj(x, y, z).y, is3d: true };
}
