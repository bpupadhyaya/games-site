// The world map: where the eight hiding places stand in metres and how a perspective camera frames them on the stage rectangle.
// Pure maths (no WebGL): game.js hit-testing, view.js overlays, the 2D fallback and the 3D world (view3d/world.js) all use the
// same camera, so a tap lands on exactly what the player sees. One metre of ground is about UPM stage units at k = 1.
import { LPOS } from './sim.js';

export const UPM = 80;
const D2R = Math.PI / 180;

// ground positions (X to the right, Z toward the camera) of spot i, by orientation
export function spotXZ(i, tall) {
  const [u, v] = LPOS[i];
  return tall ? [(u - 0.5) * 5.6, (v - 0.5) * 11.5] : [(u - 0.5) * 11.0, (v - 0.5) * 5.8];
}
// the counting base (a tree trunk) where the seeker covers their eyes
export const homeXZ = (tall) => (tall ? [-2.1, 0.1] : [-5.8, 0.1]);

function fitPoints(tall) {
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const [x, z] = spotXZ(i, tall);
    pts.push([x - 0.95, 0, z + 0.7], [x + 0.95, 0, z + 0.7], [x - 0.95, 0, z - 0.5], [x + 0.95, 0, z - 0.5], [x, 2.3, z - 0.3]);
  }
  const [hx, hz] = homeXZ(tall);
  pts.push([hx - 1.2, 0, hz + 0.6], [hx + 1.4, 0, hz + 0.6], [hx - 0.4, 2.4, hz - 0.4]);
  return pts;
}

const cache = { key: '', cam: null };
// stage: {x, y, w, h} in stage units. Returns a camera description usable with project()/unproject().
export function makeCamera(stage, tall) {
  const key = `${stage.x}|${stage.y}|${stage.w}|${stage.h}|${tall ? 1 : 0}`;
  if (cache.key === key) return cache.cam;
  const fov = (tall ? 44 : 34) * D2R, pitch = (tall ? 36 : 25) * D2R, tf = Math.tan(fov / 2), a = stage.w / stage.h;
  const sn = Math.sin(pitch), cs = Math.cos(pitch);
  const pts = fitPoints(tall);
  const mx = 0.02, mt = tall ? 0.12 : 0.1, mb = 0.04;
  const ndc = (pos, p) => {
    const dx = p[0] - pos[0], dy = p[1] - pos[1], dz = p[2] - pos[2];
    const cx = dx, cy = dy * cs - dz * sn, cz = -dy * sn - dz * cs;
    return [cx / (cz * tf * a), cy / (cz * tf), cz];
  };
  let T = [0, 0.7, 0], D = 14;
  for (let it = 0; it < 4; it++) {
    let lo = 3, hi = 90;
    for (let b = 0; b < 30; b++) {
      D = (lo + hi) / 2;
      const pos = [T[0], T[1] + D * sn, T[2] + D * cs];
      let ok = true;
      for (const p of pts) { const n = ndc(pos, p); if (n[2] < 0.5 || Math.abs(n[0]) > 1 - mx || n[1] > 1 - mt || n[1] < -1 + mb) { ok = false; break; } }
      if (ok) hi = D; else lo = D;
    }
    D = hi;
    const pos = [T[0], T[1] + D * sn, T[2] + D * cs];
    let y0 = 9, y1 = -9, zc = D;
    for (const p of pts) { const n = ndc(pos, p); y0 = Math.min(y0, n[1]); y1 = Math.max(y1, n[1]); }
    const want = ((1 - mt) + (-1 + mb)) / 2, have = (y0 + y1) / 2;
    const shift = (want - have) * zc * tf;            // metres along the camera's up axis
    T = [T[0], T[1] - shift * cs, T[2] + shift * sn];
  }
  const pos = [T[0], T[1] + D * sn, T[2] + D * cs];
  const cam = { stage: { x: stage.x, y: stage.y, w: stage.w, h: stage.h }, tall, fov, pitch, tf, a, sn, cs, pos, target: T, dist: D };
  cache.key = key; cache.cam = cam;
  return cam;
}

// world point (metres) -> stage units. k = scale relative to a 1.0 sized sprite (UPM stage units per metre).
export function project(cam, X, Y, Z) {
  const dx = X - cam.pos[0], dy = Y - cam.pos[1], dz = Z - cam.pos[2];
  const cx = dx, cy = dy * cam.cs - dz * cam.sn, cz = -dy * cam.sn - dz * cam.cs;
  const S = cam.stage, nx = cx / (cz * cam.tf * cam.a), ny = cy / (cz * cam.tf);
  return { x: S.x + (nx * 0.5 + 0.5) * S.w, y: S.y + (0.5 - ny * 0.5) * S.h, k: (S.h / 2) / (cam.tf * cz) / UPM, d: cz };
}
// stage point -> ground (Y = height) point in metres
export function unproject(cam, x, y, Y = 0) {
  const S = cam.stage, nx = ((x - S.x) / S.w) * 2 - 1, ny = 1 - ((y - S.y) / S.h) * 2;
  // ray: f + right*nx*tf*a + up*ny*tf, with f = (0,-sn,-cs), up = (0,cs,-sn)
  const dx = nx * cam.tf * cam.a, dy = -cam.sn + ny * cam.tf * cam.cs, dz = -cam.cs - ny * cam.tf * cam.sn;
  const t = (Y - cam.pos[1]) / dy;
  return { X: cam.pos[0] + dx * t, Z: cam.pos[2] + dz * t };
}
// screen y of the horizon (may be above the stage)
export const horizonY = (cam) => cam.stage.y + (0.5 - (Math.tan(cam.pitch) / cam.tf) * 0.5) * cam.stage.h;
