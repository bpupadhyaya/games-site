// The store icon scene (dev only: ?dev=1&icon=1 draws it instead of the game; `store/icon.svg` embeds a render of it).
// One subject, the flag pose on the turned pole, lit by a low warm sun. The performer is the same 3D figure the game uses.
import { drawPole } from './art.js';
import { POSES } from './figure.js';

const TAU = Math.PI * 2;
// The icon pose: the flag at its peak, hips a little high and legs lifted past level, head turned to the viewer.
export const ICON_POSE = { ...POSES.flag, p: [124, -40], tor: -96, hd: 20, hl: [3, 88], hr: [3, -146], fl: [262, -62], fr: [262, -34] };
const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export function drawIcon(ctx, w, h, draw3d, scene3d) {
  const s = Math.min(w, h), ox = (w - s) / 2, oy = (h - s) / 2;
  ctx.save(); ctx.translate(ox, oy);
  // the real 3D set, cropped tight: sheesham pole at the left edge, the performer in the flag pose, low sun behind
  const k = s / 365;
  const ok = scene3d && scene3d(ctx, s, s, { x: s * 0.075, y: s * 0.56, k: k * 1.28, pose: ICON_POSE, phi: 0.38, turn: 0.4, climb: 70, show: true, excite: 0, pulse: 0, t: 0, minimal: true, raise: -0.45, D: 8 });
  if (ok) {
    // finishing: a low sun glow behind the athlete (screen), a warm floor haze and a vignette so the single subject sits in a lit, framed picture
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const g = ctx.createRadialGradient(s * 0.6, s * 0.5, s * 0.02, s * 0.6, s * 0.5, s * 0.62);
    g.addColorStop(0, 'rgba(255,200,120,0.16)'); g.addColorStop(0.35, 'rgba(255,150,80,0.07)'); g.addColorStop(1, 'rgba(255,100,40,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    ctx.globalCompositeOperation = 'multiply';
    const v = ctx.createRadialGradient(s * 0.5, s * 0.5, s * 0.42, s * 0.5, s * 0.5, s * 0.82);
    v.addColorStop(0, 'rgba(255,255,255,1)'); v.addColorStop(1, 'rgba(70,30,60,1)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, s, s);
    ctx.restore();
    ctx.restore(); return true;
  }
  // fallback (no WebGL): the painted version
  const sk = ctx.createLinearGradient(0, 0, 0, s);
  sk.addColorStop(0, '#0d0824'); sk.addColorStop(0.38, '#3a1650'); sk.addColorStop(0.66, '#b4452f'); sk.addColorStop(0.86, '#f6a548'); sk.addColorStop(1, '#ffd48a');
  ctx.fillStyle = sk; ctx.fillRect(0, 0, s, s);
  const sun = ctx.createRadialGradient(s * 0.62, s * 0.46, s * 0.02, s * 0.62, s * 0.46, s * 0.6);
  sun.addColorStop(0, 'rgba(255,236,180,0.95)'); sun.addColorStop(0.25, 'rgba(255,190,100,0.55)'); sun.addColorStop(1, 'rgba(255,120,60,0)');
  ctx.fillStyle = sun; ctx.fillRect(0, 0, s, s);
  const hz = s * 0.88;
  const fl = ctx.createLinearGradient(0, hz, 0, s); fl.addColorStop(0, '#6b3322'); fl.addColorStop(1, '#2a1218');
  ctx.fillStyle = fl; ctx.fillRect(0, hz, s, s - hz);
  const px = s * 0.105, kk = s / 470;
  drawPole(ctx, px, -10, hz + s * 0.05, 54 * kk, 1.2);
  const o = { x: px, y: s * 0.44 + 40 * kk * 1.5, k: kk * 1.5, phi: 0 };
  const ok2 = draw3d(ctx, POSES.flag, o, 0);
  ctx.restore();
  return ok2;
}
