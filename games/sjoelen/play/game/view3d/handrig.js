// The player's hand at the near end of the board: the modelled right hand + forearm (handmesh.js, one smooth surface built in this game)
// with a cotton shirt sleeve and cuff. It is placed FROM the disc: handmesh reports where the disc and the board sit in the hand's own
// frame, so with the disc on the board the index and middle pads rest on its back rim, the finger tips touch the board just behind it
// and the thumb rests on the board beside them. Turning the hand about the disc's vertical axis keeps that contact (the disc is round),
// which gives the natural inward yaw of a right arm coming in from the player's right.
// Scale: 1 m = 25 world units (a disc is 4.8 cm = 1.2 units across); the hand is an adult's 17.6 cm, wrist crease to middle tip.
import { buildHandGeometry, skinMaterial, nailMaterial } from './handmesh.js';

const U = 25;
const SKINS = ['#e3b08e', '#a8714c'];                 // the two players' skin tones (light, tan)
const SLEEVES = ['#34548f', '#7a4527'];               // and their shirt sleeves (blue, brown)
const SLEEVE0 = 0.125, CUFF_LEN = 0.03, SLEEVE_LEN = 0.42;   // metres up the forearm from the wrist

const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
function cottonTexture(T, base) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 2) { g.fillStyle = `rgba(0,0,0,${0.04 + hash(y, 4) * 0.06})`; g.fillRect(0, y, 128, 1); }
  for (let x = 0; x < 128; x += 2) { g.fillStyle = `rgba(255,255,255,${0.02 + hash(x, 5) * 0.04})`; g.fillRect(x, 0, 1, 128); }
  for (let k = 0; k < 6; k++) {   // soft creases along the sleeve (u = around, v = along)
    const x = hash(k, 9) * 128, w = 4 + hash(k, 3) * 9, gr = g.createLinearGradient(x - w, 0, x + w, 0);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(x - w, 0, w * 2, 128);
  }
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(2, 3);
  return t;
}

/** Build both players' hands (the second is a recoloured copy of the first mesh, so the modelling runs once). */
export async function loadHands(T) {
  const Hm = await buildHandGeometry({ skin: SKINS[0] });
  const out = [];
  for (let i = 0; i < 2; i++) {
    let geo = Hm.geometry, nailGeo = Hm.nailGeometry;
    if (i > 0) {   // same surface, darker skin: scale the baked vertex colours by the ratio of the two tones
      const a = new T.Color(SKINS[0]), b = new T.Color(SKINS[i]), k = [b.r / a.r, b.g / a.g, b.b / a.b];
      const tint = (g) => { const n = g.clone(), c = n.attributes.color.array; for (let j = 0; j < c.length; j++) c[j] = Math.min(1, c[j] * k[j % 3]); return n; };
      geo = tint(geo); nailGeo = tint(nailGeo);
    }
    out.push(makeRig(T, Hm, geo, nailGeo, i));
  }
  return out;
}

function makeRig(T, Hm, geo, nailGeo, i) {
  const root = new T.Group(); root.scale.setScalar(U); root.visible = false;
  const hand = new T.Group();
  const skin = new T.Mesh(geo, skinMaterial()), nails = new T.Mesh(nailGeo, nailMaterial());
  skin.castShadow = true; skin.receiveShadow = true;
  hand.add(skin, nails); root.add(hand);
  const cloth = new T.MeshStandardMaterial({ map: cottonTexture(T, SLEEVES[i]), roughness: 0.92, metalness: 0, side: T.DoubleSide, envMapIntensity: 0.4 });
  const sleeveGeo = new T.CylinderGeometry(1, 1, 1, 28, 4, true); sleeveGeo.translate(0, 0.5, 0);   // unit radius, 0..1 along +Y
  { const p = sleeveGeo.attributes.position; for (let j = 0; j < p.count; j++) { const v = p.getY(j), k = 1 + 0.42 * Math.sqrt(v); p.setX(j, p.getX(j) * k); p.setZ(j, p.getZ(j) * k); } sleeveGeo.computeVertexNormals(); }
  const cuffGeo = new T.LatheGeometry([[0.95, 0], [1.08, 0.08], [1.16, 0.3], [1.18, 0.6], [1.14, 0.88], [1.06, 1]].map(([r, y]) => new T.Vector2(r, y)), 28);
  const sleeve = new T.Mesh(sleeveGeo, cloth), cuff = new T.Mesh(cuffGeo, cloth);
  for (const m of [sleeve, cuff]) { m.castShadow = true; m.receiveShadow = true; }
  root.add(sleeve, cuff);
  [skin, nails, sleeve, cuff].forEach((m) => { m.frustumCulled = false; });

  // the hand's own frame -> a frame where the slide direction is +X', the board normal +Y' (then turned to the world each frame)
  const d = Hm.disc, rt = new T.Vector3().crossVectors(d.fwd, d.up);
  const toDisc = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(d.fwd, d.up, rt).transpose());
  const FA = Hm.forearm;
  const q = new T.Quaternion(), qw = new T.Quaternion(), mB = new T.Matrix4(), F = new T.Vector3(), Up = new T.Vector3(0, 1, 0), Rt = new T.Vector3();
  const c = new T.Vector3(), ax = new T.Vector3(), ay = new T.Vector3(), az = new T.Vector3(), wrist = new T.Vector3(), qTilt = new T.Quaternion();
  const ar = Hm.armRadii(SLEEVE0 + CUFF_LEN);

  return {
    root, stats: Hm.stats, dbg: Hm.dbg, discR: d.R * U,
    /** disc: world point of the disc's centre ON the board (base); fwd: world slide direction (unit, horizontal); yaw: turn about the
     *  disc's axis (rad, + = fingers toward the player's left); lift: world units the hand rises off the disc; tilt: fingers raised (rad). */
    place(disc, fwd, yaw = 0.2, lift = 0, tilt = 0) {
      F.copy(fwd).applyAxisAngle(Up, yaw + d.yaw * 0.5).normalize(); Rt.crossVectors(F, Up).normalize();
      qw.setFromRotationMatrix(mB.makeBasis(F, Up, Rt));
      q.copy(qw).multiply(toDisc);
      if (tilt) { qTilt.setFromAxisAngle(Rt, tilt); q.premultiply(qTilt); }
      hand.quaternion.copy(q);
      // position: the modelled disc centre lands on the real one (local units are metres; root scales to world units)
      c.copy(d.center).applyQuaternion(q);
      wrist.set(disc.x / U, (disc.y + lift) / U + d.H / 2, disc.z / U).sub(c);
      hand.position.copy(wrist);
      ax.copy(FA.axis).applyQuaternion(q); ay.copy(FA.y).applyQuaternion(q); az.copy(FA.z).applyQuaternion(q);
      mB.makeBasis(az, ax, ay);
      cuff.quaternion.setFromRotationMatrix(mB); cuff.position.copy(wrist).addScaledVector(ax, SLEEVE0);
      cuff.scale.set(ar.rz + 0.004, CUFF_LEN, ar.ry + 0.004);
      sleeve.quaternion.copy(cuff.quaternion); sleeve.position.copy(wrist).addScaledVector(ax, SLEEVE0 + CUFF_LEN * 0.5);
      sleeve.scale.set(ar.rz + 0.008, SLEEVE_LEN, ar.ry + 0.006);
      root.updateMatrixWorld(true);
    },
  };
}
