// The shared geometry of the street in METRES, used by the 3D presenter (web/view3d) and by the 2D HUD (popups, call card, guide ring),
// so both agree on where the jumper stands on screen. Pure maths: no 3D library, no clock.
//
// World axes: x along the line of the two turners (they stand at +-TURNER_X), y up, z towards the camera side. The jumper stands at the
// origin facing +z. Each rope is a loop that turns about the line between the turners' hands, so its middle sweeps through the (y, z)
// plane: over the jumper's head (theta 0), out to the camera side (theta PI/2), on the ground (theta PI), out to the far side (3 PI/2).
export const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const W3 = {
  turnerX: 1.6,             // turner's feet, metres from the jumper's line
  handX: 1.3,             // the hands, towards the jumper from the turner's feet (x = +-handX)
  handY: 1.0,              // height of the hands (about the hip bone)
  handZ: 0.14,             // each rope's turning axis is this far in front of / behind the middle line
  handR: 0.1,              // radius of the circle a hand draws
  ropeR: 1.08,             // how far the middle of the rope swings from its axis
  ropeW: 0.045,            // drawn thickness of the rope
  personH: 1.72,           // the jumper, for scale
};

// Rope A turns one way, rope B the other. Pass n is rope A on the ground when theta A = PI * Theta reaches an odd multiple of PI.
export const ropeTheta = (which, Theta) => (which === 'A' ? Math.PI * Theta : Math.PI * (1 - Theta));
export const ropeAxisZ = (which) => (which === 'A' ? W3.handZ : -W3.handZ);

// Points of one rope for the angle th (0 = over the head, PI = on the ground). N+1 points from the left hand to the right hand.
// `floor` marks points lying on the ground (the rope cannot go through it, it lays flat for a stretch, like a real rope).
export function ropePoints3(which, th, N = 36, out = null) {
  const z0 = ropeAxisZ(which), r = W3.handR, xl = -W3.handX, xr = W3.handX, c = Math.cos(th), s = Math.sin(th);
  const pts = out || [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, sh = Math.pow(Math.sin(Math.PI * u), 0.8);
    const rad = r + (W3.ropeR - r) * sh;
    let y = W3.handY + rad * c;
    const floor = y < W3.ropeW * 0.5;
    if (floor) y = W3.ropeW * 0.5;
    const p = pts[i] || (pts[i] = { x: 0, y: 0, z: 0, floor: false, u: 0 });
    p.x = xl + (xr - xl) * u; p.y = y; p.z = z0 + rad * s; p.floor = floor; p.u = u;
  }
  return pts;
}
// The handle of a rope in a turner's hand: the hand centre plus the small circle the wrist draws, in phase with the rope.
export function handlePoint(which, side, th) {
  return { x: side * W3.handX, y: W3.handY + W3.handR * Math.cos(th), z: ropeAxisZ(which) + W3.handR * Math.sin(th) };
}

// ---- the camera: a fixed three-quarter view, fitted to the stage rectangle ------------------------------------------------------------------
export const CAM = { az: 0.5, el: 0.2, fov: 30 * Math.PI / 180 };
const BOX = [];
// what must stay in view: the turners with their arms, and the two rope loops swinging out to both sides of the jumper
for (const [hx, hy, hz] of [[1.98, 1.85, 0.4], [1.4, 2.25, 1.2]]) for (const sx of [-1, 1]) for (const y of [0, hy]) for (const sz of [-1, 1]) BOX.push([sx * hx, y, sz * hz]);

function camAt(d, ty, az, el, ox = 0) {
  const cx = Math.cos(az) * ox, cz = -Math.sin(az) * ox;                // slide the view along the image's right vector
  const T = [cx, ty, 0.05 + cz];
  const C = [T[0] + Math.sin(az) * Math.cos(el) * d, T[1] + Math.sin(el) * d, T[2] + Math.cos(az) * Math.cos(el) * d];
  let f = [T[0] - C[0], T[1] - C[1], T[2] - C[2]]; const fl = Math.hypot(...f); f = f.map((v) => v / fl);
  let r = [-f[2], 0, f[0]]; const rl = Math.hypot(...r); r = r.map((v) => v / rl);
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];   // r x f
  return { C, T, f, r, u };
}
function projectCam(cam, aspect, p) {
  const v = [p[0] - cam.C[0], p[1] - cam.C[1], p[2] - cam.C[2]];
  const zc = v[0] * cam.f[0] + v[1] * cam.f[1] + v[2] * cam.f[2];
  const xc = v[0] * cam.r[0] + v[1] * cam.r[1] + v[2] * cam.r[2];
  const yc = v[0] * cam.u[0] + v[1] * cam.u[1] + v[2] * cam.u[2];
  const th = Math.tan(CAM.fov / 2);
  return { nx: xc / (zc * th * aspect), ny: yc / (zc * th), z: zc };
}

// Fit the three-quarter view to a rectangle (virtual units). Returns the camera (position, target, fov, aspect), a projector from world
// metres to virtual screen units, and the 2D geometry the HUD uses: { k (px of the jumper's height), gy (feet), jx, r }.
const fitCache = new Map();
export function fit3(rect) {
  const key = `${Math.round(rect.x)},${Math.round(rect.y)},${Math.round(rect.w)},${Math.round(rect.h)}`;
  const hit = fitCache.get(key); if (hit) return hit;
  const aspect = rect.w / Math.max(1, rect.h);
  // margins: the call card above the head, the count-in text and popups, the pavement below the feet
  const mx = 0.0, myTop = 0.13, myBot = 0.09;
  const portrait = aspect < 0.9;
  // a tall room (portrait phone): look down more steeply so the street (ground, rope loops, kerb) fills the height instead of leaving bare pavement
  const tallK = clamp((1.15 - aspect) / 0.5, 0, 1);
  const az = portrait ? CAM.az * 0.9 : CAM.az, el = portrait ? CAM.el * (1.05 + 1.6 * tallK) : CAM.el;
  const th = Math.tan(CAM.fov / 2);
  const ext = (d, ty, ox) => {
    const cam = camAt(d, ty, az, el, ox);
    let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
    for (const p of BOX) { const q = projectCam(cam, aspect, p); if (q.nx < x0) x0 = q.nx; if (q.nx > x1) x1 = q.nx; if (q.ny < y0) y0 = q.ny; if (q.ny > y1) y1 = q.ny; }
    return { cam, x0, x1, y0, y1 };
  };
  let lo = 3, hi = 60;
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2, f = ext(mid, 1.1, 0);
    if ((f.x1 - f.x0) <= 2 * (1 - 2 * mx) && (f.y1 - f.y0) <= 2 * (1 - myTop - myBot)) hi = mid; else lo = mid;
  }
  const d = hi;
  let want = (myBot - myTop) / 2;      // desired ndc centre of the box (it sits lower than the middle when there is more room above)
  let ty = 1.1, ox = 0, f0 = ext(d, ty, ox);
  // a tall room has more height than the picture needs: sit the street on the bottom of the room (the buildings fill what is above)
  if (tallK > 0) { const hb = f0.y1 - f0.y0, wantB = -1 + 2 * myBot + hb / 2; want += (wantB - want) * tallK * 0.85; }
  for (let i = 0; i < 4; i++) {
    const cxn = (f0.x0 + f0.x1) / 2, cyn = (f0.y0 + f0.y1) / 2;
    ox += cxn * th * aspect * d * 0.95; ty += (cyn - want) * th * d * 0.95;
    f0 = ext(d, ty, ox);
  }
  const cam = f0.cam;
  let best = null;
  const proj = (x, y, z) => { const q = projectCam(cam, aspect, [x, y, z]); return { x: rect.x + rect.w / 2 + q.nx * rect.w / 2, y: rect.y + rect.h / 2 - q.ny * rect.h / 2, z: q.z }; };
  const feet = proj(0, 0, 0), head = proj(0, W3.personH, 0);
  const k = Math.max(40, feet.y - head.y);
  best = { rect, cam, aspect, proj, g: { r: rect, k, gy: feet.y, jx: feet.x, horizon: feet.y - k * 0.5 }, pxPerM: k / W3.personH };
  if (fitCache.size > 12) fitCache.clear();
  fitCache.set(key, best);
  return best;
}
void clamp;
