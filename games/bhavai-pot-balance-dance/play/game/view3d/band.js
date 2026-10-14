// The band and the audience. Seated musicians are real view3d people (cross-legged on a durrie, turbans, a dholak and a harmonium); the
// audience is the shared instanced crowd (view3d crowd3d, South Asian pack) standing on the plinth and sitting on charpoys.
// Their strokes are driven by the beat the sim announces (v.beatCount / v.bp); applause and gasps come from the sim's events.
import { THREE, loadHuman, buildClip, createCrowd3d, board3d as B } from '../vendor3d/index.js';
import { tex, rng, clamp } from './room.js';

const T = THREE;
const TAU = Math.PI * 2;
const smooth = (x) => { const c = clamp(x, 0, 1); return c * c * (3 - 2 * c); };

function weave(base, line) {
  const c = globalThis.document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = line; g.lineWidth = 5;
  for (let i = 0; i < 256; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); }
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2;
  for (let i = 8; i < 256; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke(); }
  return tex(c, { repeat: [2, 1] });
}
function carpet() {
  const c = globalThis.document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d'), r = rng(9);
  g.fillStyle = '#7a1a22'; g.fillRect(0, 0, 512, 256);
  g.strokeStyle = '#e8b64a'; g.lineWidth = 8; g.strokeRect(14, 14, 484, 228);
  g.strokeStyle = '#1e6f8c'; g.lineWidth = 6; g.strokeRect(30, 30, 452, 196);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 3; j++) {
    const x = 64 + i * 56, y = 64 + j * 64; g.fillStyle = (i + j) % 2 ? '#e8b64a' : '#2a8c80';
    g.beginPath(); g.moveTo(x, y - 20); g.lineTo(x + 20, y); g.lineTo(x, y + 20); g.lineTo(x - 20, y); g.closePath(); g.fill();
    g.fillStyle = '#f4e8d0'; g.beginPath(); g.arc(x, y, 5, 0, TAU); g.fill();
  }
  for (let i = 0; i < 4000; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'; g.fillRect(r() * 512, r() * 256, 1, 3); }
  return tex(c, { aniso: 4 });
}

// Sitting on the heels (a kneeling musician's seat: thighs forward, shins folded under, back upright). The numbers are tunable at run time
// through globalThis.__seat for look-dev; the defaults are the shipped pose.
const SEAT = { drop: -0.62, thigh: 84, abduct: 12, calf: 152, twist: 6, foot: 20 };
function seatClips(h, o = {}) {
  const k = { ...SEAT, ...(globalThis.__seat || {}) };
  const seat = { Pelvis: { pos: [0, k.drop, -0.04] }, L_Thigh: { flex: k.thigh, abduct: k.abduct, twist: k.twist }, R_Thigh: { flex: k.thigh, abduct: k.abduct, twist: -k.twist }, L_Calf: { flex: k.calf }, R_Calf: { flex: k.calf }, L_Foot: { rot: [0, 0, k.foot] }, R_Foot: { rot: [0, 0, k.foot] }, Spine1: { flex: o.lean ?? 6 }, Neck: { flex: -3 } };
  return buildClip(h, { name: 'seat', duration: 3.1, base: 'idle', inherit: true, loop: true, grounded: false, fingers: 'relaxed', keys: [{ t: 0, pose: seat }, { t: 1.5, pose: { ...seat, Spine1: { flex: (o.lean ?? 6) + 2.5 } } }, { t: 3.1, pose: seat }] });
}

export async function createBand(scene, camera, { quality = 'medium' } = {}) {
  const hi = quality !== 'low';
  const B_ = { members: [], crowd: null, charpoys: [] };

  // durrie (carpet) for the band, with a bolster
  const rug = new T.Mesh(new T.PlaneGeometry(3.6, 2.2), new T.MeshStandardMaterial({ map: carpet(), roughness: 0.95 }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(-2.25, 0.012, -1.45); rug.rotation.z = 0.0; rug.receiveShadow = hi; scene.add(rug);
  const bolster = new T.Mesh(new T.CapsuleGeometry(0.1, 0.8, 6, 14), new T.MeshStandardMaterial({ color: 0xd8a61c, roughness: 0.9 }));
  bolster.rotation.z = Math.PI / 2; bolster.position.set(-2.85, 0.1, -2.15); bolster.castShadow = hi; scene.add(bolster);

  // dholak: a barrel on its side, cream heads, rope lacing
  const dholak = new T.Group();
  {
    const barrel = new T.Mesh(B.lathe([[0.001, -0.3], [0.085, -0.3], [0.1, -0.22], [0.125, -0.1], [0.135, 0.0], [0.125, 0.1], [0.1, 0.22], [0.085, 0.3], [0.001, 0.3]], 24), new T.MeshStandardMaterial({ color: 0x7a3a1a, roughness: 0.5, envMapIntensity: 0.8 }));
    barrel.rotation.z = Math.PI / 2; barrel.castShadow = hi; dholak.add(barrel);
    for (const s of [-1, 1]) {
      const head = new T.Mesh(new T.CircleGeometry(0.11, 26), new T.MeshStandardMaterial({ color: 0xf2e6c2, roughness: 0.7, side: T.DoubleSide }));
      head.rotation.y = s * Math.PI / 2; head.position.x = s * 0.305; dholak.add(head);
      const rim = new T.Mesh(new T.TorusGeometry(0.11, 0.012, 8, 26), B.material('brass')); rim.rotation.y = Math.PI / 2; rim.position.x = s * 0.3; dholak.add(rim);
      const spot = new T.Mesh(new T.CircleGeometry(0.045, 20), new T.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.9, side: T.DoubleSide }));
      spot.rotation.y = s * Math.PI / 2; spot.position.x = s * (0.306 + 0.002 * s); dholak.add(spot);
    }
    for (let i = -4; i <= 4; i++) {
      const rr = 0.082 + 0.052 * Math.cos((i / 4) * 1.1);
      const rope = new T.Mesh(new T.TorusGeometry(rr, 0.007, 6, 20), new T.MeshStandardMaterial({ color: i % 2 ? 0xe8c27a : 0xc98a4a, roughness: 0.7 })); rope.rotation.y = Math.PI / 2; rope.position.x = i * 0.065; dholak.add(rope);
    }
  }
  scene.add(dholak);
  // harmonium: a wooden box with a keyboard, bellows behind
  const harmonium = new T.Group();
  {
    const wood = new T.MeshStandardMaterial({ color: 0x5a2f16, roughness: 0.45, envMapIntensity: 0.8 });
    const body = new T.Mesh(B.roundedBox(0.62, 0.22, 0.34, 0.025), wood); body.castShadow = hi; harmonium.add(body);
    const keys = new T.Mesh(new T.BoxGeometry(0.5, 0.025, 0.1), new T.MeshStandardMaterial({ color: 0xf4efdf, roughness: 0.4 })); keys.position.set(0, 0.115, 0.1); harmonium.add(keys);
    const bellows = new T.Mesh(new T.BoxGeometry(0.58, 0.17, 0.12), new T.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.8 })); bellows.position.set(0, 0.02, -0.23); harmonium.add(bellows);
    B_.bellows = bellows;
  }
  scene.add(harmonium);

  const mk = async (character, kit, skin, hair, pos, yaw, o = {}) => {
    const h = await loadHuman({ character, kit, skin, hair, lod: 'auto', quality, castShadow: hi });
    h.lodAuto = false; h.groundClamp = 'off'; h.footPlanting = false; h.turnRate = 0;
    h._seatOpts = o;
    h.addClip(seatClips(h, o));
    h.setPosition(pos[0], pos[1], pos[2]); h.setFacing(yaw);
    scene.add(h.root); h.play('seat', { fade: 0, loop: true });
    return h;
  };
  // turban: wound cloth band + a dome, with a tail
  const turban = (col) => {
    const g = new T.Group(), m = new T.MeshStandardMaterial({ color: col, roughness: 0.85 });
    const w1 = new T.Mesh(new T.TorusGeometry(0.108, 0.04, 10, 28), m); w1.rotation.x = Math.PI / 2; w1.scale.set(1, 1.1, 1);
    const w2 = new T.Mesh(new T.TorusGeometry(0.097, 0.036, 10, 28), m); w2.rotation.x = Math.PI / 2; w2.rotation.z = 0.4; w2.position.y = 0.045; w2.scale.set(1, 1.1, 1);
    const dome = new T.Mesh(new T.SphereGeometry(0.108, 20, 12, 0, TAU, 0, Math.PI * 0.55), m); dome.position.y = 0.04; dome.scale.set(1, 0.9, 1.05);
    const tail = new T.Mesh(new T.PlaneGeometry(0.12, 0.34), new T.MeshStandardMaterial({ color: col, roughness: 0.85, side: T.DoubleSide })); tail.position.set(0.0, -0.08, -0.12); tail.rotation.x = 0.15;
    g.add(w1, w2, dome, tail); g.visible = false; scene.add(g); return g;
  };
  const dh = await mk('athlete_m', { top: '#f6ecd0', bottoms: '#f1e4c4', socks: '#9a6a3a', shoes: '#9a6a3a' }, 'brown', 'black', [-2.05, 0.0, -1.3], 0.25, { lean: 8 });
  const hm = await mk('athlete_m', { top: '#e8b84a', bottoms: '#f4ead2', socks: '#9a6a3a', shoes: '#9a6a3a' }, 'tan', 'grey', [-3.05, 0.0, -1.95], 0.35, { lean: 4 });
  const sg = await mk('athlete_f', { top: '#d8326a', bottoms: '#2a56c0', socks: '#caa070', shoes: '#caa070' }, 'tan', 'black', [-1.2, 0.0, -2.2], 0.0, { lean: 3 });
  const tbDh = turban(0xff9d1f), tbHm = turban(0xf4f0e0);
  // singer's head cover (an odhani edge over the hair)
  B_.dh = dh; B_.hm = hm; B_.sg = sg;
  dholak.position.set(-2.05, 0.34, -0.98); dholak.rotation.set(0, 0.25, 0);
  harmonium.position.set(-3.05 + 0.1, 0.11, -1.35); harmonium.rotation.y = 0.35;
  B_.members = [dh, hm, sg];
  // bare feet over the sneakers (they sit barefoot on the durrie)
  const feet = [];
  for (const [h, skin] of [[dh, '#8c5a3c'], [hm, '#c8936a'], [sg, '#c8936a']]) for (const sd of ['L', 'R']) {
    const m = new T.Mesh(new T.SphereGeometry(1, 14, 10), new T.MeshStandardMaterial({ color: skin, roughness: 0.65 }));
    m.castShadow = hi; scene.add(m); feet.push({ h, sd, m });
  }
  B_.props = [rug, bolster, dholak, harmonium, tbDh, tbHm];
  B_.reseat = () => { for (const h of B_.members) { h.addClip(seatClips(h, h._seatOpts)); h.play('seat', { fade: 0, loop: true }); } };

  // charpoys on the right: a rope-woven cot with turned legs
  const cot = (x, z, yaw) => {
    const g = new T.Group();
    const wood = B.material('darkWood', { color: '#6a3f20', color2: '#8a5a30', size: 256 });
    const top = new T.Mesh(new T.BoxGeometry(1.9, 0.05, 0.95), new T.MeshStandardMaterial({ map: weave('#d9b778', '#8a6a3a'), roughness: 0.9 })); top.position.y = 0.41; top.receiveShadow = hi; g.add(top);
    for (const [px, pz, w, d] of [[0, 0.5, 2.0, 0.07], [0, -0.5, 2.0, 0.07], [0.97, 0, 0.07, 1.0], [-0.97, 0, 0.07, 1.0]]) { const r = new T.Mesh(new T.BoxGeometry(w, 0.07, d), wood); r.position.set(px, 0.42, pz); r.castShadow = hi; g.add(r); }
    for (const px of [-0.94, 0.94]) for (const pz of [-0.46, 0.46]) { const l = new T.Mesh(B.lathe([[0.001, 0], [0.05, 0], [0.04, 0.1], [0.06, 0.18], [0.04, 0.28], [0.05, 0.4], [0.001, 0.4]], 10), wood); l.position.set(px, 0, pz); l.castShadow = hi; g.add(l); }
    g.position.set(x, 0, z); g.rotation.y = yaw; scene.add(g); return g;
  };
  B_.charpoys.push(cot(2.55, -1.55, -0.12), cot(3.9, -2.4, 0.1));

  // the standing + seated audience: shared instanced crowd
  const pts = [];
  const r = rng(21);
  const place = (x, y, z, seated, yaw) => pts.push({ x, y, z, yaw: yaw ?? Math.atan2(-x * 0.2, 6) + (r() - 0.5) * 0.35, seated });
  // on the charpoys
  place(2.25, 0.44, -1.55, true); place(2.85, 0.44, -1.5, true); place(3.6, 0.44, -2.4, true); place(4.2, 0.44, -2.4, true);
  // standing on the plinth behind and at the sides
  for (let i = 0; i < 12; i++) { const side = i % 2 ? 1 : -1, k = Math.floor(i / 2); place(side * (2.9 + k * 0.62 + r() * 0.2), 0.28, -3.35 - (k % 2) * 0.5 - r() * 0.2, false); }
  place(-0.9, 0.28, -3.55, false); place(0.55, 0.28, -3.7, false); place(1.7, 0.28, -3.5, false); place(-1.75, 0.28, -3.55, false);
  const extra = quality === 'low' ? 0 : quality === 'medium' ? 14 : 26;
  for (let i = 0; i < extra; i++) { const side = i % 2 ? 1 : -1; place(side * (4.8 + (i >> 1) * 0.55 + r() * 0.3), 0.28, -4.0 - (i % 3) * 0.45, false); }
  try {
    B_.crowd = createCrowd3d({ scene, camera }, { points: pts, count: pts.length, seed: 5, culture: 'south_asian', quality: quality === 'low' ? 'low' : quality, props: { flag: 0, phone: 0.12, child: 0.08 }, excitement: 0.25, blobShadows: true });
  } catch (e) { console.warn('crowd3d unavailable', e); B_.crowd = null; }

  // the icon shows one subject: hide everyone but the dancer
  B_.hideAll = () => { for (const m of [...B_.members.map((h) => h.root), ...B_.props, ...B_.charpoys, ...feet.map((f) => f.m)]) m.visible = false; if (B_.crowd) B_.crowd.group.visible = false; B_.hidden = true; };
  const v1 = new T.Vector3(), v2 = new T.Vector3();
  const head = (h) => h.bones.Bip01_Head.getWorldPosition(new T.Vector3());
  let lastBeat = -1, hitL = 0, hitR = 0, kick = 0;
  B_.update = function (v, dt, clock, newEvents) {
    if (B_.hidden) return;
    for (const e of newEvents) {
      if (!B_.crowd) break;
      if (e.type === 'step' && e.q === 'perfect' && (e.combo % 4 === 1 || e.combo === 8)) B_.crowd.react('cheer', { origin: [0, 0, -1], radius: 14, intensity: 0.5 });
      else if (e.type === 'pot' && e.ok) B_.crowd.react('cheer', { origin: [0, 0, -1], radius: 14, intensity: 0.9 });
      else if (e.type === 'fall') B_.crowd.react('gasp', { origin: [0, 0, -1], radius: 14, intensity: 1 });
      else if (e.type === 'end' && e.ok) B_.crowd.react('ovation', { origin: [0, 0, -1], radius: 20, intensity: 1 });
      else if (e.type === 'turnHeld') B_.crowd.react('cheer', { origin: [0, 0, -1], radius: 12, intensity: 0.5 });
    }
    // dholak strokes: alternate heads on the beat; an extra soft stroke on the off-beat
    const bp = v.bp;
    if (v.beatCount !== lastBeat) { lastBeat = v.beatCount; if (v.beatCount % 2 === 0) hitL = 1; else hitR = 1; kick = 1; }
    hitL = Math.max(0, hitL - dt * 5); hitR = Math.max(0, hitR - dt * 5); kick = Math.max(0, kick - dt * 4);
    const calm = !v.playing && v.scene !== 'title' ? 0.6 : 1;
    const hand = (h, side, tx, ty, tz, hit, up) => {
      const p = v1.set(tx, ty - 0.05 * hit * calm + up, tz);
      const pole = v2.set(tx + (side === 'L' ? 0.25 : -0.25), ty - 0.1, tz - 0.3);
      h.setReach(side, p, { weight: 1, pole });
    };
    // dholak player (facing the camera, slightly turned): left hand on the left head, right hand on the right head
    {
      const h = dh, c = dholak.position, ca = Math.cos(0.25), sa = Math.sin(0.25);
      const ax = (dx) => [c.x + dx * ca, c.z - dx * sa];
      const [lx, lz] = ax(0.3), [rx, rz] = ax(-0.3);
      hand(h, 'L', lx, c.y + 0.17, lz + 0.0, hitL, 0.03 + 0.02 * Math.sin(clock * 3));
      hand(h, 'R', rx, c.y + 0.17, rz + 0.0, hitR, 0.03 + 0.02 * Math.sin(clock * 3 + 1));
      h.setFingers('L', hitL > 0.3 ? 'flat' : 'relaxed'); h.setFingers('R', hitR > 0.3 ? 'flat' : 'relaxed');
      h.lookAt(v1.set(0, 1.4, 4), { weight: 0.6 });
      h.update(dt);
    }
    // harmonium: right hand on the keys, left hand works the bellows
    {
      const h = hm, c = harmonium.position, ca = Math.cos(0.35), sa = Math.sin(0.35);
      const pump = Math.sin(clock * 2.6 * 1) * 0.04;
      h.setReach('R', v1.set(c.x - 0.05 * ca + 0.1 * sa, c.y + 0.16 + 0.015 * Math.sin(clock * 9), c.z + 0.12 * ca), { weight: 1, pole: v2.set(c.x - 0.4, c.y + 0.3, c.z - 0.1) });
      h.setReach('L', v1.set(c.x + 0.3 * ca, c.y + 0.12, c.z - 0.2 * ca + pump), { weight: 1, pole: v2.set(c.x + 0.5, c.y + 0.3, c.z - 0.3) });
      h.setFingers('R', 'open'); h.setFingers('L', 'flat');
      h.lookAt(v1.set(0, 1.5, 4), { weight: 0.5 });
      h.update(dt);
      if (B_.bellows) B_.bellows.scale.z = 1 + 0.5 * Math.sin(clock * 2.6);
    }
    // singer: sways, hand to ear on the long notes
    {
      const h = sg;
      h.setReach('R', v1.set(-1.2 - 0.12 + 0.05 * Math.sin(clock * 1.7), 0.34 + 0.02 * kick, -2.0), { weight: 1, pole: v2.set(-1.5, 0.5, -2.4) });
      h.setReach('L', v1.set(-1.0 + 0.1 * Math.sin(clock * 1.2), 0.32, -2.0), { weight: 1, pole: v2.set(-0.8, 0.4, -2.3) });
      h.setFingers('R', 'open'); h.setFingers('L', 'open');
      h.lookAt(v1.set(0, 1.5, 4), { weight: 0.6 });
      h.update(dt);
    }
    for (const f of feet) {
      const ak = f.h.bones[`Bip01_${f.sd}_Foot`].getWorldPosition(v1.clone()), toe = f.h.bones[`Bip01_${f.sd}_Toe0`].getWorldPosition(v2.clone());
      const d = toe.clone().sub(ak), len = d.length() || 0.1; d.divideScalar(len);
      f.m.position.copy(ak).addScaledVector(d, len * 0.5); f.m.position.y -= 0.01;
      f.m.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), d); f.m.scale.set(0.043, 0.035, len * 0.8 + 0.03);
    }
    // dress-up props that ride the heads
    {
      const hd = head(dh); tbDh.position.set(hd.x, hd.y + 0.13, hd.z - 0.005); tbDh.rotation.y = 0.25; tbDh.visible = true;
      const hh = head(hm); tbHm.position.set(hh.x, hh.y + 0.13, hh.z); tbHm.rotation.y = 0.35; tbHm.visible = true;
    }
    if (B_.crowd) {
      B_.crowd.setExcitement(clamp(0.04 + (v.playing ? 0.1 : 0) + clamp((v.combo ?? 0) / 24, 0, 0.5), 0, 1));
      B_.crowd.update(dt, camera);
    }
    void bp;
  };
  return B_;
}
