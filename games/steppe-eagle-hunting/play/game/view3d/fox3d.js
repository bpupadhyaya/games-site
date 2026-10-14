// A red fox as a real 3D animal: lofted body, neck and head with a long muzzle, tall ears with black backs, four legs hinged at hip, knee and
// paw with black stockings, and a bushy brush on four chained segments with a white tip. The gait is driven by the distance travelled (stride
// phase), so the legs never move without the fox advancing. Fox local frame: +Z forward, +Y up, +X left. ~0.75 m nose to rump, brush ~0.4 m.
import { loft } from './eagle3d.js';
import { furCanvas } from './textures.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const hex = (c, T) => { const k = new T.Color(c); return [k.r, k.g, k.b]; };
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export function createFox(T) {
  const root = new T.Group(); root.name = 'fox';
  const rig = new T.Group(); root.add(rig);        // bounce, pitch, roll
  const furTex = new T.CanvasTexture(furCanvas(6, 256, 0)); furTex.wrapS = furTex.wrapT = T.RepeatWrapping; furTex.colorSpace = T.SRGBColorSpace; furTex.anisotropy = 4;
  const fur = new T.MeshStandardMaterial({ vertexColors: true, map: furTex, roughness: 0.95, metalness: 0 });
  const black = new T.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.8 });
  const nose = new T.MeshStandardMaterial({ color: 0x0b0908, roughness: 0.3 });
  const RUS = hex(0xc4561f, T), RUS2 = hex(0xdb7c35, T), CREAM = hex(0xf3e9d6, T), BLK = hex(0x241a14, T), SOCK = hex(0x2a1d16, T);
  const bodyColor = (u, a) => {   // a = 0 top .. PI bottom
    const belly = clamp((Math.cos(a) * -0.5 + 0.5 - 0.28) * 3, 0, 1);
    let c = mix3(RUS, RUS2, clamp(0.4 + 0.5 * Math.sin(u * 7 + a), 0, 1) * 0.6);
    c = mix3(c, CREAM, belly * (u > 0.45 ? 1 : 0.7));
    return c;
  };
  const shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
  // torso
  const torso = new T.Mesh(loft(T, [
    { z: -0.32, y: 0.31, rx: 0.05, ry: 0.065 }, { z: -0.24, y: 0.315, rx: 0.088, ry: 0.105 }, { z: -0.1, y: 0.32, rx: 0.09, ry: 0.11 },
    { z: 0.05, y: 0.325, rx: 0.085, ry: 0.11 }, { z: 0.16, y: 0.335, rx: 0.09, ry: 0.118 }, { z: 0.25, y: 0.35, rx: 0.07, ry: 0.09 }, { z: 0.31, y: 0.37, rx: 0.05, ry: 0.065 },
  ], 14, bodyColor, [4, 3]), fur);
  torso.castShadow = true; rig.add(torso);
  // chest ruff: a pale tuft under the neck
  const ruff = new T.Mesh(new T.SphereGeometry(0.06, 10, 8), new T.MeshStandardMaterial({ color: 0xf3e9d6, roughness: 1, map: furTex })); ruff.scale.set(0.95, 1.1, 1.2); ruff.position.set(0, 0.28, 0.2); rig.add(ruff);

  // head
  const headPivot = new T.Group(); headPivot.position.set(0, 0.39, 0.3); rig.add(headPivot);
  const headSecs = [
    { z: -0.03, y: -0.02, rx: 0.05, ry: 0.06 }, { z: 0.03, y: 0, rx: 0.055, ry: 0.058 }, { z: 0.09, y: -0.006, rx: 0.045, ry: 0.046 },
    { z: 0.15, y: -0.014, rx: 0.026, ry: 0.028 }, { z: 0.205, y: -0.02, rx: 0.014, ry: 0.016 }, { z: 0.222, y: -0.022, rx: 0.006, ry: 0.008 },
  ];
  const head = new T.Mesh(loft(T, headSecs, 14, (u, a) => {
    const under = clamp((-Math.cos(a) * 0.5 + 0.5 - 0.35) * 3.5, 0, 1);
    let c = mix3(RUS, RUS2, 0.3);
    c = mix3(c, CREAM, under);
    if (Math.abs(Math.sin(a)) > 0.7 && u > 0.2 && u < 0.7) c = mix3(c, CREAM, 0.6);  // pale cheeks
    if (u > 0.93) c = BLK;                                                          // black nose
    return c;
  }, [2, 1]), fur);
  head.castShadow = true; headPivot.add(head);
  const noseTip = new T.Mesh(new T.SphereGeometry(0.0095, 8, 6), nose); noseTip.position.set(0, -0.02, 0.222); headPivot.add(noseTip);
  const ears = [];
  for (const s of [-1, 1]) {
    const eg = new T.Group(); eg.position.set(s * 0.036, 0.05, -0.005); headPivot.add(eg);
    const g = new T.CylinderGeometry(0.004, 0.044, 0.135, 4, 1); g.translate(0, 0.066, 0); g.scale(1, 1, 0.4);
    const ear = new T.Mesh(g, new T.MeshStandardMaterial({ color: 0x1d1511, roughness: 0.9 })); ear.castShadow = true; eg.add(ear);
    const inner = new T.Mesh(new T.CylinderGeometry(0.003, 0.033, 0.105, 4, 1), new T.MeshStandardMaterial({ color: 0xf0e2c8, roughness: 1 }));
    inner.geometry.translate(0, 0.055, 0.016); inner.geometry.scale(1, 1, 0.3); eg.add(inner);
    eg.rotation.set(-0.15, 0, s * 0.18);
    const eye = new T.Mesh(new T.SphereGeometry(0.0085, 8, 6), new T.MeshStandardMaterial({ color: 0x120b06, roughness: 0.1 }));
    eye.position.set(s * 0.043, 0.012, 0.085); headPivot.add(eye);
    ears.push(eg);
  }

  // legs: [hipX, hipZ, isFore]
  const legs = [];
  const mkLeg = (x, z, fore) => {
    const hip = new T.Group(); hip.position.set(x, 0.265, z); rig.add(hip);
    const lenU = fore ? 0.115 : 0.125, lenL = fore ? 0.12 : 0.12;
    const up = new T.Mesh(new T.CylinderGeometry(0.04, 0.026, lenU, 8), new T.MeshStandardMaterial({ color: 0xcd6b2c, roughness: 0.95, map: furTex })); up.geometry.translate(0, -lenU / 2, 0); up.castShadow = true; hip.add(up);
    const knee = new T.Group(); knee.position.set(0, -lenU, 0); hip.add(knee);
    const lo = new T.Mesh(new T.CylinderGeometry(0.024, 0.017, lenL, 8), new T.MeshStandardMaterial({ color: 0x2a1d16, roughness: 0.95 })); lo.geometry.translate(0, -lenL / 2, 0); lo.castShadow = true; knee.add(lo);
    const paw = new T.Mesh(new T.SphereGeometry(0.024, 8, 6), new T.MeshStandardMaterial({ color: 0x1b130e, roughness: 0.9 })); paw.scale.set(0.9, 0.55, 1.5); paw.position.set(0, -lenL - 0.005, 0.012); paw.castShadow = true; knee.add(paw);
    return { hip, knee, lenU, lenL, fore };
  };
  legs.push(mkLeg(0.055, 0.17, true), mkLeg(-0.055, 0.17, true), mkLeg(0.055, -0.2, false), mkLeg(-0.055, -0.2, false));   // FL FR HL HR

  // brush: four chained segments, bushy, white tip
  const tail = [];
  const tailBase = new T.Group(); tailBase.position.set(0, 0.33, -0.31); rig.add(tailBase);
  let parent = tailBase;
  const segLen = 0.115, radii = [[0.04, 0.06], [0.06, 0.076], [0.076, 0.062], [0.062, 0.016]];
  for (let i = 0; i < 4; i++) {
    const g = new T.Group(); g.position.set(0, 0, i === 0 ? 0 : -segLen); parent.add(g);
    const secs = [{ z: 0, y: 0, rx: radii[i][0], ry: radii[i][0] * 0.95 }, { z: -segLen * 0.5, y: 0, rx: (radii[i][0] + radii[i][1]) / 2 * 1.06, ry: (radii[i][0] + radii[i][1]) / 2 * 1.0 }, { z: -segLen, y: 0, rx: radii[i][1], ry: radii[i][1] * 0.95 }];
    const col = (u) => {
      const t = (i + u) / 4;
      if (t > 0.82) return mix3(RUS2, CREAM, clamp((t - 0.82) * 8, 0, 1));
      if (t > 0.55 && t < 0.72) return mix3(RUS, BLK, 0.45);
      return mix3(RUS, RUS2, 0.4);
    };
    const m = new T.Mesh(loft(T, secs, 10, col, [2, 1]), fur); m.castShadow = true; g.add(m);
    tail.push(g); parent = g;
  }

  function setPose(p = {}) {
    const q = { phase: 0, gait: 0, amp: 0, crouch: 0, headYaw: 0, headPitch: 0, earBack: 0, earTwitch: 0, tailLift: 0, tailSway: 0, bounce: 0, pitch: 0, roll: 0, stretch: 0, t: 0, ...p };
    rig.position.y = q.bounce;
    rig.rotation.set(-q.pitch, 0, q.roll);
    headPivot.rotation.set(q.headPitch - q.crouch * 0.25, q.headYaw, 0);
    headPivot.position.set(0, 0.39 - q.crouch * 0.1, 0.3 + q.stretch * 0.02);
    ears.forEach((e, i) => { const s = i === 0 ? -1 : 1; e.rotation.x = -0.15 - q.earBack * 0.8 + (i === 0 ? q.earTwitch : 0); e.rotation.z = s * (0.18 + q.earBack * 0.5); });
    // legs: 0 FL, 1 FR, 2 HL, 3 HR. gait 0 stand, 1 trot (diagonals), 2 gallop (pairs)
    const ph = q.phase, A = q.amp;
    const off = q.gait >= 1.5 ? [0, 0.18, 0.55, 0.73] : [0, 0.5, 0.5, 0.0];   // FL FR HL HR
    legs.forEach((l, i) => {
      const c = ph + off[i] * Math.PI * 2;
      const sw = Math.sin(c), lift = Math.max(0, Math.cos(c));
      const stand = q.gait === 0;
      let hipA = stand ? (l.fore ? 0.0 : 0.12) : -sw * A * (l.fore ? 0.62 : 0.55);
      let kneeA = stand ? (l.fore ? 0.0 : -0.25) : (l.fore ? lift * A * 1.15 : -lift * A * 1.2 - 0.1);
      if (q.crouch > 0) { hipA += l.fore ? 0.45 * q.crouch : -0.15 * q.crouch; kneeA += l.fore ? -0.7 * q.crouch : 0.55 * q.crouch; }
      if (q.stretch > 0) { hipA += (l.fore ? -1 : 1) * 0.55 * q.stretch; }
      l.hip.rotation.x = hipA; l.knee.rotation.x = kneeA;
    });
    const sw = q.tailSway;
    tail.forEach((s, i) => { s.rotation.set(-q.tailLift * 0.35 + 0.1 - (i === 0 ? 0.0 : 0.04), sw * (0.25 + i * 0.12) * Math.sin(q.t * 3 + i * 0.7) + (q.tailYaw || 0) * 0.3, 0); });
    tailBase.rotation.x = -0.1 - q.tailLift * 0.4;
  }
  setPose({});
  return { root, setPose, rig };
}
