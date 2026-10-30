// Menko scene extras (game-owned): the child's hand that holds and slams the discs, and the neighbourhood kids kneeling on the veranda
// who watch (crowd3d). Everything here only READS the sim state through the presenter; failures degrade to "no hand / no kids".
import * as V3D from '../vendor3d/index.js';
import { buildHandGeometry, skinMaterial, nailMaterial, POSES, forearmAxis } from './handmesh.js';
import { FLOOR } from '../src/sim.js';
import { TH, DR } from './models.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (f) => f * f * (3 - 2 * f);

export async function createSceneExtras({ THREE, renderer, scene, camera, worldRoot, tier, U }) {
  const T = THREE;
  const out = { hand: null, crowd: null, setQuality: null, frame() {} };
  void camera; void TAU;
  const wx = (fx) => (fx - FLOOR / 2) * U, wz = (fy) => (fy - FLOOR / 2) * U;

  // ---------------------------------------------------------------- the hand
  // A modelled hand (handmesh.js: one smooth measured surface, nails, skin shading), meshed in the background after the scene is up, in
  // two poses: GRIP (the disc pinched at its near edge between the thumb pad underneath and the index pad on top) and FLAT (the open palm
  // of the release and of the slap on the title floor). A cotton kimono sleeve is fitted along the forearm.
  const HS = 9.2;                                  // hand-metres -> world: a 17.6 cm hand shown about 1.6 units long (the disc is 0.88 across)
  const hand = { ready: false, root: new T.Group(), grip: null, flat: null, sleeve: null, card: null, flatLow: 0 };
  hand.root.visible = false; hand.root.scale.setScalar(HS); worldRoot.add(hand.root);
  out.hand = hand;
  if (typeof location !== 'undefined' && /[?&]dev\b/.test(location.search)) window.__dbgHand = { hand, worldRoot, camera };   // dev runs only (render/measure scripts)
  (async () => {
    const skin = '#dca383', cardCm = (TH / HS) * 100, voxel = 0.21;
    const skinM = skinMaterial(), nailM = nailMaterial();
    const mk = (H) => { const g = new T.Group(), m = new T.Mesh(H.geometry, skinM), n = new T.Mesh(H.nailGeometry, nailM); m.castShadow = true; m.receiveShadow = true; n.receiveShadow = true; g.add(m, n); g.visible = false; hand.root.add(g); return g; };
    const G = await buildHandGeometry({ pose: POSES.grip, skin, voxel, cardCm });
    const F = await buildHandGeometry({ pose: POSES.flat, skin, voxel });
    hand.grip = mk(G); hand.flat = mk(F); hand.card = G.card;
    // the lowest point of the flat palm when the back of the hand faces up (for the floor contact of the slap)
    { const P = F.geometry.attributes.position.array; let lo = 0; for (let i = 1; i < P.length; i += 3) lo = Math.min(lo, P[i]); hand.flatLow = lo; }
    hand.sleeve = makeSleeve(T, forearmAxis(POSES.grip)); hand.root.add(hand.sleeve.obj);
    hand.flatSleeve = makeSleeve(T, forearmAxis(POSES.flat)); hand.root.add(hand.flatSleeve.obj);
    hand.stats = { grip: G.stats, flat: F.stats, pinchErrCm: G.thumb.err };
    hand.ready = true;
  })().catch((e) => console.warn('hand unavailable', e));

  // ---------------------------------------------------------------- kids
  let crowd = null, crowdGroup = null, crowdCam = null;
  const KS = 2.3;                                  // crowd works in metres; the diorama is ~15x life size, the kids are drawn about 5x
  try {
    crowdGroup = new T.Group(); crowdGroup.scale.setScalar(KS); crowdGroup.position.set(0, -0.22, 0);
    scene.add(crowdGroup);
    crowdCam = new T.PerspectiveCamera();
    const pts = [];
    const spots = [[-4.6, -5.3, 0.15], [-1.5, -5.9, -0.1], [1.6, -5.4, 0.12], [4.5, -5.8, -0.15], [-7.6, -3.2, 0.7], [7.8, -3.4, -0.7]];
    for (const [x, z, yaw] of spots) pts.push({ x: x / KS, y: 0, z: z / KS, yaw, seated: 0 });
    crowd = V3D.createCrowd3d({ scene: crowdGroup, camera: crowdCam, renderer }, {
      points: pts, seed: 11, culture: 'east_asian', kids: 1, quality: tier().kids || 'low', props: { flag: 0, phone: 0, child: 0 }, excitement: 0.35, camera: crowdCam, viewportHeight: 800, blobShadows: true,
    });
  } catch (e) { console.warn('crowd3d unavailable', e); crowd = null; if (crowdGroup) scene.remove(crowdGroup); crowdGroup = null; }
  out.setQuality = (q) => { if (crowd) { if (q) { crowd.setQuality(q); crowdGroup.visible = true; } else crowdGroup.visible = false; } };

  // ---------------------------------------------------------------- per frame
  out.frame = (c) => {
    const { dt, camera: cam } = c;
    if (crowd) {
      crowdCam.position.copy(cam.position).sub(crowdGroup.position).divideScalar(KS);
      crowdCam.quaternion.copy(cam.quaternion); crowdCam.fov = cam.fov; crowdCam.aspect = cam.aspect; crowdCam.near = cam.near / KS; crowdCam.far = cam.far / KS;
      crowdCam.projectionMatrix.copy(cam.projectionMatrix); crowdCam.projectionMatrixInverse.copy(cam.projectionMatrixInverse);
      crowdCam.updateMatrixWorld(true);
      crowd.update(dt, crowdCam);
      if (c.shake) crowd.react?.('gasp', { intensity: 0.5 });
    }
    if (!hand.ready) return;
    driveHand(c);
  };
  // ---- the hand per frame -----------------------------------------------------------------------------------------------------------
  const _m = new T.Matrix4(), _inv = new T.Matrix4(), _q = new T.Quaternion(), _q2 = new T.Quaternion(), _v = new T.Vector3(), _n = new T.Vector3();
  const _p = new T.Vector3(), _f = new T.Vector3(), _s = new T.Vector3(), _b = new T.Matrix4(), _c = new T.Vector3();
  const UP = new T.Vector3(0, 1, 0);
  // where each thrower's right shoulder is (worldRoot units; the tray spans -3.2..3.2): the player kneels at the near edge, the rival far
  const SHOULDER = [new T.Vector3(1.7, 3.0, 4.6), new T.Vector3(-1.7, 3.0, -4.6)];
  const hb = { f: null, n: null, s: null, inv: null };
  let mode = '', shown = 0, rel = null, lastAct = null, lastGrip = { pos: new T.Vector3(), q: new T.Quaternion(), side: 0, ok: false };
  // the hand transform that pinches disc group g at the edge nearest the thrower (world -> worldRoot local)
  function gripPose(g, side, outPos, outQ) {
    const m = g.userData.m; g.updateMatrixWorld(true); worldRoot.updateMatrixWorld(true);
    _inv.copy(worldRoot.matrixWorld).invert(); _m.multiplyMatrices(_inv, m.matrixWorld);
    _c.set(0, TH / 2, 0).applyMatrix4(_m);                       // disc centre (mid-thickness)
    _n.set(0, 1, 0).transformDirection(_m);                        // its top normal
    if (!hb.inv) {
      const cf = hand.card.f, cn = hand.card.n; hb.s = new T.Vector3().crossVectors(cf, cn);
      hb.inv = new T.Matrix4().makeBasis(cf, cn, hb.s).invert();
      const fa = forearmAxis(POSES.grip); hb.th = Math.atan2(fa.dot(hb.s), fa.dot(cf));   // the forearm's heading in the disc plane
    }
    // the arm comes from the thrower's right shoulder (off the tray edge): T, toward it, in the disc plane; the hand turns about the
    // disc's normal until its forearm heads along T, and the pinch lands on the rim where that puts it
    _p.copy(SHOULDER[side]).sub(_c); _p.addScaledVector(_n, -_p.dot(_n)).normalize();
    _q2.setFromAxisAngle(_n, hb.th); _f.copy(_p).applyQuaternion(_q2);   // f = T turned back by the forearm's heading
    const grip = _v.copy(_c).addScaledVector(_f, -(DR - 0.11));   // pinched about 1.2 cm in from the rim
    _s.crossVectors(_f, _n);
    _b.makeBasis(_f, _n, _s);
    _m.multiplyMatrices(_b, hb.inv); outQ.setFromRotationMatrix(_m);
    outPos.copy(hand.card.point).multiplyScalar(HS).applyQuaternion(outQ).negate().add(grip);
  }
  // the flat open hand, palm down, fingers away from the thrower, the palm's lowest point at height y0 (world units, floor = 0)
  function flatPose(x, z, y0, side, pitch, outPos, outQ) {
    _f.set(x, 0, z).sub(SHOULDER[side]); _f.y = 0; _f.normalize(); _s.crossVectors(_f, UP);
    _b.makeBasis(_f, UP, _s); outQ.setFromRotationMatrix(_b);
    if (pitch) { _q2.setFromAxisAngle(_s, -pitch); outQ.premultiply(_q2); }
    outPos.set(x, y0 - hand.flatLow * HS, z);
  }
  const want = { pos: new T.Vector3(), q: new T.Quaternion() };
  function show(pose, pos, q, side) {
    hand.grip.visible = pose === 'grip'; hand.sleeve.obj.visible = pose === 'grip';
    hand.flat.visible = pose === 'flat'; hand.flatSleeve.obj.visible = pose === 'flat';
    hand.root.position.copy(pos); hand.root.quaternion.copy(q); hand.root.visible = true;
    const col = side === 0 ? 0 : 1; if (hand.sleeve.side !== col) { hand.sleeve.setSide(col); hand.flatSleeve.setSide(col); }
  }
  function driveHand(c) {
    const { state, dt, play } = c, holder = c.holder;
    // 1) holding a disc (aiming, wind-up, slam): rigidly pinched, it moves with the disc
    if (play && holder && holder.g) {
      gripPose(holder.g, holder.side, want.pos, want.q);
      shown = Math.min(1, shown + dt * 6);
      const pos = _c.copy(want.pos); if (shown < 1) pos.y += (1 - ease(shown)) * 1.6;   // it lowers into view holding the disc
      show('grip', pos, want.q, holder.side);
      lastGrip.pos.copy(want.pos); lastGrip.q.copy(want.q); lastGrip.side = holder.side; lastGrip.ok = true;
      rel = null; lastAct = state.act; return;
    }
    // 2) the release: the disc is on the floor; the fingers spring open and the hand lifts away toward the thrower
    const a = play && state.m ? state.act : null;
    if (a && a.out && lastGrip.ok && (rel || lastAct === a)) {
      if (!rel) rel = { pos: lastGrip.pos.clone(), q: lastGrip.q.clone(), side: lastGrip.side, a };
      const k = a.t - a.impactAt, dir = rel.side === 0 ? 1 : -1, e = ease(clamp(k / 0.55, 0, 1));
      if (k < 0.6) {
        flatPose(rel.pos.x, rel.pos.z, 0, rel.side, 0.5, _p, _q);   // turn toward a relaxed palm-down hand as it lifts
        _q2.copy(rel.q).slerp(_q, ease(clamp(k / 0.3, 0, 1)) * 0.7);
        _v.copy(rel.pos); _v.y += 0.15 + e * 3.4; _v.z += dir * e * 1.6;
        show('flat', _v, _q2, rel.side); return;
      }
    }
    // 3) title / menus: a flat hand slaps the floor beside a card, the card jumps
    if (!play && state.att && state.att.act) {
      const k = state.att.act.t, cd = state.att.act.c;
      const y0 = k < 0.16 ? 2.2 * (1 - ease(k / 0.16)) : k < 0.22 ? 0 : 2.6 * ease(clamp((k - 0.22) / 0.4, 0, 1));
      const pitch = k < 0.16 ? 0.35 * (1 - k / 0.16) : k < 0.22 ? 0 : 0.3 * clamp((k - 0.22) / 0.3, 0, 1);
      if (k < 0.62) { flatPose(wx(cd.x - 70), wz(cd.y + 20) + 0.9, y0 + 0.004, 0, pitch, _p, _q); show('flat', _p, _q, 0); rel = null; lastGrip.ok = false; return; }
    }
    hand.root.visible = false; shown = 0; if (!(a && a.out)) { rel = null; lastGrip.ok = false; }
    lastAct = state.act;
  }
  out.crowd = crowd;
  return out;
}

// A child's cotton kimono sleeve (hand frame, metres): a soft tube along the arm from a hand's breadth above the wrist to the shoulder
// (off the tray), with a rolled hem at the cuff and gentle lengthwise folds; past the elbow it darkens and dissolves (the arm leaves the
// lamplight), so it never ends in a cap or reads as an empty cup.
// Indigo kasuri (small white crosses) for the player, a madder red with the same weave for the rival.
function makeSleeve(T, axis) {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
  const x = cv.getContext('2d');
  const paint = (base) => {
    x.fillStyle = base; x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 128; i += 2) { x.fillStyle = `rgba(255,255,255,${0.025 + ((i * 37) % 7) * 0.006})`; x.fillRect(0, i, 128, 1); x.fillStyle = 'rgba(0,0,0,0.05)'; x.fillRect(i, 0, 1, 128); }
    x.fillStyle = 'rgba(240,236,224,0.78)';
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { const px = c * 32 + (r % 2) * 16 + 8, py = r * 32 + 10; x.fillRect(px - 5, py - 1, 10, 2.4); x.fillRect(px - 1, py - 5, 2.4, 10); }
  };
  const tex = new T.CanvasTexture(cv); tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.repeat.set(6, 14); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
  // the arm leaves the light: past the elbow the sleeve darkens and dissolves (hashed alpha, no sorting) instead of ending in a cap
  const mat = new T.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0, side: T.DoubleSide, vertexColors: true, alphaHash: true });
  // lathe profile (radius, distance up the arm from the wrist), cm
  const prof = [[0.2, 4.9], [3.2, 4.75], [3.6, 5.0], [3.8, 5.6], [3.75, 6.3], [3.85, 9], [4.15, 14], [4.45, 20], [4.55, 26], [4.4, 32], [4.5, 40], [4.8, 48], [4.9, 56], [4.9, 62]];
  const pts = prof.map(([r, s]) => new T.Vector2(r * 0.01, s * 0.01));
  const geo = new T.LatheGeometry(pts, 48);
  // folds: a few soft lengthwise ripples, stronger toward the elbow
  const P = geo.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const px = P.getX(i), py = P.getY(i), pz = P.getZ(i), a = Math.atan2(pz, px), r = Math.hypot(px, pz), s = py * 100;
    const k = 1 + (0.035 * Math.sin(a * 5 + s * 0.12) + 0.025 * Math.sin(a * 9 - s * 0.2)) * Math.min(1, Math.max(0, (s - 6) / 8));
    P.setX(i, Math.cos(a) * r * k); P.setZ(i, Math.sin(a) * r * k);
  }
  geo.computeVertexNormals();
  { const C = new Float32Array(P.count * 4); for (let i = 0; i < P.count; i++) { const sv = P.getY(i) * 100, k = Math.min(1, Math.max(0, (sv - 32) / 30)), sm = k * k * (3 - 2 * k), ka = Math.min(1, Math.max(0, (sv - 44) / 18)); C[i * 4] = C[i * 4 + 1] = C[i * 4 + 2] = 1 - 0.7 * sm; C[i * 4 + 3] = 1 - ka * ka * (3 - 2 * ka); } geo.setAttribute('color', new T.BufferAttribute(C, 4)); }
  const mesh = new T.Mesh(geo, mat); mesh.castShadow = true; mesh.receiveShadow = true;
  // the lathe runs along +Y: turn it onto the forearm axis, and squash it a little (a forearm is oval, the back flatter)
  mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), axis); mesh.scale.set(1.0, 1, 0.9);
  const obj = new T.Group(); obj.add(mesh); obj.visible = false;
  const api = { obj, side: -1, setSide(sd) { api.side = sd; paint(sd === 0 ? '#2b3f73' : '#9a3424'); tex.needsUpdate = true; } };
  api.setSide(0);
  return api;
}
