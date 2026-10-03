// The two FIXED cameras as pure maths, shared by the 3D presenter (which renders with them) and the 2D HUD / touch input (which project and
// un-project field positions through them), so the picture and the controls can never disagree. Neither camera ever moves.
// 'bat'   = the batter's-eye view: behind the striker's stumps, level, looking straight down the pitch.
// 'field' = a high, fixed view from behind the striker's end that shows the whole ground.
// Camera frame: yaw is always 0 (looking down the pitch toward -world z); `pitch` tilts it down. Virtual units are the 720x1280 canvas.
import { PITCH } from './core.js';

export const CAMS = {
  bat: { x: 0, y: 1.95, z: -4.2, pitch: 0, f: 1050, cx: 360, cy: 455 },
  field: { x: 0, y: 16, z: -58, pitch: 0.5, f: 2275, cx: 360, cy: 1139 },
};

// sim point (x, y, z) -> virtual canvas coords { x, y, k } (k = pixels per metre at that depth), or null when behind the camera
export function project(cam, x, y, z) {
  const c = typeof cam === 'string' ? CAMS[cam] : cam;
  const wz = -z, cz = -c.z;                       // world z (the camera's z in the sim frame is c.z)
  const dx = x - c.x, dy = y - c.y, dz = wz - cz;
  const sp = Math.sin(c.pitch), cp = Math.cos(c.pitch);
  const zc = -dy * sp - dz * cp;
  if (zc < 0.05) return null;
  const yc = dy * cp - dz * sp;
  const k = c.f / zc;
  return { x: c.cx + dx * k, y: c.cy - yc * k, k };
}

// virtual canvas coords -> the point on the horizontal plane y = h, as sim { x, z }; null when the ray misses the plane
export function unproject(cam, vx, vy, h = 0) {
  const c = typeof cam === 'string' ? CAMS[cam] : cam;
  const xn = (vx - c.cx) / c.f, yn = -(vy - c.cy) / c.f;
  const sp = Math.sin(c.pitch), cp = Math.cos(c.pitch);
  // right = (1,0,0); up = (0, cp, -sp); forward = (0, -sp, -cp)  (world axes)
  const dX = xn, dY = yn * cp - sp, dZ = -yn * sp - cp;
  if (Math.abs(dY) < 1e-6) return null;
  const t = (h - c.y) / dY;
  if (t <= 0) return null;
  return { x: c.x + dX * t, z: -(-c.z + dZ * t) };
}

// pixels per metre across the pitch at distance z (useful for sizing HUD cues)
export const pxPerMetre = (cam, x, z) => { const p = project(cam, x, 0, z); return p ? p.k : 1; };

export const PITCH_LEN = PITCH;
