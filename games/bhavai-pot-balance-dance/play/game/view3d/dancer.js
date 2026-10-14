// The dancer: a real 3D woman (view3d athlete_f) dressed as a Bhavai performer. Everything she wears that moves is simulated here, for
// looks only: the ghagra (a radial cloth whose hem lags the body, flares on spins and lifts over the stepping foot), the odhani veil
// (a pinned verlet cloth that drapes over the shoulders and collides with the body), the braid (a verlet chain), jhumka earrings and the
// ghungroo anklets. The sim owns where she is and how the tower leans; this file never writes back.
//
// Frame order (see the PROP-IN-HAND note in the brief): human.update(dt) first, then bone reads, then pots/clothes from the posed bones.
import { THREE, loadHuman, handQuat } from '../vendor3d/index.js';
import { tex, glowTexture, clamp } from './room.js';

const T = THREE;
const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const D2R = Math.PI / 180;
const sstep = (x) => { const c = clamp(x, 0, 1); return c * c * (3 - 2 * c); };

// ---- palettes: four costumes, chosen by act ---------------------------------------------------------------------------------------------
const PALETTES = [
  { skirt: '#c4123f', skirt2: '#8c0e3a', border: '#f5c542', accent: '#16b7ae', choli: '#14a5a0', odhani: '#f4b21c', odhaniEdge: '#c4123f' },
  { skirt: '#2a3fa8', skirt2: '#1b2a7a', border: '#f6a21a', accent: '#e8421a', choli: '#f08a1a', odhani: '#e0407a', odhaniEdge: '#f5c542' },
  { skirt: '#1f8a4f', skirt2: '#14663a', border: '#f5c542', accent: '#d81b60', choli: '#c8247a', odhani: '#f6d23a', odhaniEdge: '#1f8a4f' },
  { skirt: '#b3196a', skirt2: '#7a1048', border: '#f5c542', accent: '#27c4c0', choli: '#1fa8c0', odhani: '#2a56c0', odhaniEdge: '#f5c542' },
];
const LOOKS = [{ skin: 'tan', hair: 'black' }, { skin: 'brown', hair: 'black' }];

function cv(w, h) { const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h; return c; }

// Ghagra: pleated cloth, a deep embroidered border (gold, accent band, a row of mirrors) and scattered mirror work. Also returns the
// metalness/roughness map where the mirrors are bright metal so they catch the lights and the environment.
function ghagraTextures(p) {
  const W = 1024, H = 512, c = cv(W, H), g = c.getContext('2d'), m = cv(W, H), mg = m.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, p.skirt2); gr.addColorStop(0.55, p.skirt); gr.addColorStop(1, p.skirt);
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  mg.fillStyle = 'rgb(0,200,0)'; mg.fillRect(0, 0, W, H);                 // G = roughness, B = metalness
  for (let i = 0; i < 96; i++) { g.fillStyle = i % 2 ? 'rgba(40,0,16,0.22)' : 'rgba(255,200,220,0.10)'; g.fillRect(i * W / 96, 0, W / 96, H); }
  // woven texture
  for (let i = 0; i < 6000; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'; g.fillRect(Math.random() * W, Math.random() * H, 1, 3); }
  const mirror = (x, y, r) => {
    const rg = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    rg.addColorStop(0, '#ffffff'); rg.addColorStop(0.5, '#cfd8e0'); rg.addColorStop(1, '#6a7a8a');
    g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.strokeStyle = p.border; g.lineWidth = Math.max(2, r * 0.45); g.beginPath(); g.arc(x, y, r + g.lineWidth * 0.4, 0, TAU); g.stroke();
    mg.fillStyle = 'rgb(0,60,140)'; mg.beginPath(); mg.arc(x, y, r, 0, TAU); mg.fill();
  };
  // body: staggered mirrors with a stitched diamond
  for (let r = 0; r < 4; r++) for (let i = 0; i < 24; i++) {
    const x = (i + (r % 2) * 0.5) * W / 24, y = H * (0.12 + r * 0.14);
    mirror(x, y, 6);
    g.strokeStyle = p.border; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 16, y); g.lineTo(x, y - 12); g.lineTo(x + 16, y); g.lineTo(x, y + 12); g.closePath(); g.stroke();
  }
  // border band
  const y0 = H * 0.72;
  g.fillStyle = p.border; g.fillRect(0, y0, W, H * 0.06);
  g.fillStyle = p.accent; g.fillRect(0, y0 + H * 0.06, W, H * 0.07);
  g.fillStyle = p.border; g.fillRect(0, y0 + H * 0.13, W, H * 0.035);
  g.fillStyle = p.skirt2; g.fillRect(0, y0 + H * 0.165, W, H);
  for (let i = 0; i < 32; i++) { const x = (i + 0.5) * W / 32; mirror(x, y0 + H * 0.095, 8); }
  for (let i = 0; i < 64; i++) { const x = (i + 0.25) * W / 64; g.fillStyle = p.border; g.beginPath(); g.moveTo(x, y0 + H * 0.2); g.lineTo(x + 6, y0 + H * 0.27); g.lineTo(x - 6, y0 + H * 0.27); g.fill(); }
  // gota-patti ribbon at the hem
  g.fillStyle = p.border; g.fillRect(0, H * 0.965, W, H * 0.035);
  g.fillStyle = 'rgb(0,90,120)'; mg.fillStyle = 'rgb(0,90,150)'; mg.fillRect(0, H * 0.965, W, H * 0.035);
  // waistband
  g.fillStyle = p.border; g.fillRect(0, 0, W, H * 0.04);
  const map = tex(c, { aniso: 8 }); map.wrapS = T.RepeatWrapping;
  const orm = tex(m, { srgb: false, aniso: 4 }); orm.wrapS = T.RepeatWrapping;
  return { map, orm };
}

function odhaniTexture(p) {
  const W = 256, H = 384, c = cv(W, H), g = c.getContext('2d'), a = cv(W, H), ag = a.getContext('2d');
  g.fillStyle = p.odhani; g.fillRect(0, 0, W, H);
  ag.fillStyle = '#9a9a9a'; ag.fillRect(0, 0, W, H);           // alpha: a sheer, slightly see-through weave
  for (let i = 0; i < 3000; i++) { ag.fillStyle = Math.random() < 0.5 ? '#ffffff' : '#7a7a7a'; ag.fillRect(Math.random() * W, Math.random() * H, 1, 2); }
  // leheriya-like diagonal stripes
  for (let i = -H; i < W + H; i += 28) { g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 10, 0); g.lineTo(i + 10 + H * 0.6, H); g.lineTo(i + H * 0.6, H); g.fill(); }
  // gota border on all edges + dotted mirror line
  g.fillStyle = p.odhaniEdge; g.fillRect(0, 0, W, 18); g.fillRect(0, H - 22, W, 22); g.fillRect(0, 0, 14, H); g.fillRect(W - 14, 0, 14, H);
  g.fillStyle = '#f5d27a'; g.fillRect(0, H - 30, W, 6); g.fillRect(0, 20, W, 4);
  ag.fillStyle = '#ffffff'; ag.fillRect(0, 0, W, 20); ag.fillRect(0, H - 30, W, 30); ag.fillRect(0, 0, 14, H); ag.fillRect(W - 14, 0, 14, H);
  for (let i = 0; i < 12; i++) { g.fillStyle = '#fff4d8'; g.beginPath(); g.arc((i + 0.5) * W / 12, H - 12, 3.2, 0, TAU); g.fill(); }
  for (let j = 0; j < 5; j++) for (let i = 0; i < 6; i++) { g.fillStyle = '#ffe9a8'; g.beginPath(); g.arc((i + (j % 2) * 0.5 + 0.5) * W / 6, 60 + j * 62, 2.6, 0, TAU); g.fill(); }
  const map = tex(c, { aniso: 4 }), alpha = tex(a, { srgb: false, aniso: 2 });
  return { map, alpha };
}

// ---- the dancer -----------------------------------------------------------------------------------------------------------------------
const SEG = 56, RING = 18;
const VW = 11, VH = 15;                                   // veil grid (columns across, rows down)

export async function createDancer(scene, { quality = 'medium' } = {}) {
  const hi = quality !== 'low';
  const people = [];
  for (let i = 0; i < LOOKS.length; i++) {
    const h = await loadHuman({ character: 'athlete_f', kit: { top: PALETTES[0].choli, bottoms: PALETTES[0].skirt2, socks: PALETTES[0].skirt2 }, skin: LOOKS[i].skin, hair: LOOKS[i].hair, lod: 'auto', quality, castShadow: hi });
    h.lodAuto = false; h.groundClamp = 'auto'; h.footPlanting = false; h.turnRate = 0;
    h.root.visible = false;
    scene.add(h.root);
    h.play('idle', { fade: 0 });
    people.push(h);
    await new Promise((r) => setTimeout(r, 0));
  }
  const D = { people, cur: null, palIdx: -1 };

  // ghagra
  const skirtGeo = new T.BufferGeometry();
  {
    const n = (SEG + 1) * (RING + 1), pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), idx = [];
    for (let j = 0; j <= RING; j++) for (let i = 0; i <= SEG; i++) { const k = j * (SEG + 1) + i; uv[k * 2] = (i / SEG) * 2; uv[k * 2 + 1] = 1 - j / RING; }
    for (let j = 0; j < RING; j++) for (let i = 0; i < SEG; i++) { const a = j * (SEG + 1) + i, b = a + 1, c = a + SEG + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    skirtGeo.setAttribute('position', new T.BufferAttribute(pos, 3)); skirtGeo.setAttribute('uv', new T.BufferAttribute(uv, 2)); skirtGeo.setIndex(idx);
  }
  const skirtMat = new T.MeshStandardMaterial({ roughness: 1, metalness: 1, side: T.DoubleSide, envMapIntensity: 1.2 });
  const skirt = new T.Mesh(skirtGeo, skirtMat); skirt.frustumCulled = false; skirt.castShadow = hi; skirt.receiveShadow = hi;
  skirt.visible = false; scene.add(skirt);
  // the underskirt / lining shows inside the hem
  const colState = []; for (let i = 0; i <= SEG; i++) colState.push({ ox: 0, oz: 0, vx: 0, vz: 0, lift: 0 });

  // odhani: a pinned verlet cloth
  const veilGeo = new T.BufferGeometry();
  const veilN = (VW + 1) * (VH + 1);
  const vPos = new Float32Array(veilN * 3), vUv = new Float32Array(veilN * 2), vIdx = [];
  for (let j = 0; j <= VH; j++) for (let i = 0; i <= VW; i++) { const k = j * (VW + 1) + i; vUv[k * 2] = i / VW; vUv[k * 2 + 1] = 1 - j / VH; }
  for (let j = 0; j < VH; j++) for (let i = 0; i < VW; i++) { const a = j * (VW + 1) + i, b = a + 1, c = a + VW + 1, d = c + 1; vIdx.push(a, c, b, b, c, d); }
  veilGeo.setAttribute('position', new T.BufferAttribute(vPos, 3)); veilGeo.setAttribute('uv', new T.BufferAttribute(vUv, 2)); veilGeo.setIndex(vIdx);
  const veilMat = new T.MeshStandardMaterial({ side: T.DoubleSide, roughness: 0.75, metalness: 0.0, transparent: true, opacity: 0.94, alphaTest: 0.0, depthWrite: true });
  const veil = new T.Mesh(veilGeo, veilMat); veil.frustumCulled = false; veil.castShadow = hi; veil.visible = false; scene.add(veil);
  const vp = [], vq = [];                                  // positions and previous positions
  for (let k = 0; k < veilN; k++) { vp.push(new T.Vector3()); vq.push(new T.Vector3()); }
  let veilInit = false;
  const REST_U = 0.055, REST_V = 0.085;                    // rest spacing across / down (m)

  // braid: verlet chain rendered as a tapered tube
  const BR = 9;
  const bp = [], bq = [];
  for (let i = 0; i < BR; i++) { bp.push(new T.Vector3()); bq.push(new T.Vector3()); }
  const braidMat = new T.MeshStandardMaterial({ color: 0x120a0a, roughness: 0.45, metalness: 0.1 });
  const braid = new T.Mesh(new T.BufferGeometry(), braidMat); braid.frustumCulled = false; braid.castShadow = hi; braid.visible = false; scene.add(braid);
  const tassel = new T.Mesh(new T.SphereGeometry(0.03, 10, 8), new T.MeshStandardMaterial({ color: 0xe8b04a, metalness: 0.9, roughness: 0.3 })); tassel.visible = false; scene.add(tassel);
  let braidInit = false;

  // jewellery
  const gold = new T.MeshStandardMaterial({ color: 0xf1c14a, metalness: 1, roughness: 0.22, envMapIntensity: 1.6 });
  const goldDim = new T.MeshStandardMaterial({ color: 0xd8a63a, metalness: 1, roughness: 0.38, envMapIntensity: 1.3 });
  const ruby = new T.MeshStandardMaterial({ color: 0xc41448, metalness: 0.2, roughness: 0.15, envMapIntensity: 1.5 });
  const mk = (geo, mat) => { const m = new T.Mesh(geo, mat); m.visible = false; m.castShadow = false; scene.add(m); return m; };
  const necklace = mk(new T.TorusGeometry(0.115, 0.008, 8, 40), gold);
  const necklace2 = mk(new T.TorusGeometry(0.15, 0.006, 8, 40), goldDim);
  const pendant = mk(new T.SphereGeometry(0.022, 12, 10), ruby);
  const tikkaChain = mk(new T.CylinderGeometry(0.003, 0.003, 0.1, 6), gold);
  const tikka = mk(new T.SphereGeometry(0.017, 12, 10), ruby);
  const nath = mk(new T.TorusGeometry(0.019, 0.003, 6, 20), gold);
  const jhumkas = [0, 1].map(() => { const g = new T.Group(); const d = new T.Mesh(new T.SphereGeometry(0.019, 12, 8, 0, TAU, 0, Math.PI * 0.62), gold); d.rotation.x = Math.PI; g.add(d); const s = new T.Mesh(new T.SphereGeometry(0.006, 8, 6), gold); s.position.y = 0.02; g.add(s); g.visible = false; scene.add(g); return g; });
  // chooda: stacks of bangles on the forearms (ivory-white and red) and bajuband armlets
  const BANG = hi ? 9 : 5;
  const bangles = [];
  for (const side of ['L', 'R']) for (let b = 0; b < BANG; b++) {
    const mat = b % 3 === 2 ? gold : (b < BANG * 0.55 ? new T.MeshStandardMaterial({ color: 0xf2e6cf, roughness: 0.3, metalness: 0 }) : new T.MeshStandardMaterial({ color: 0xc41448, roughness: 0.3, metalness: 0.1 }));
    const m = mk(new T.TorusGeometry(0.034, 0.0065, 8, 24), mat); m.userData = { side, b }; bangles.push(m);
  }
  const armlets = ['L', 'R'].map((s) => { const m = mk(new T.TorusGeometry(0.052, 0.012, 8, 24), gold); m.userData = { side: s }; return m; });
  // payal: silver anklets with ghungroo bells
  const silver = new T.MeshStandardMaterial({ color: 0xdfe4ea, metalness: 1, roughness: 0.2, envMapIntensity: 1.8 });
  const anklets = ['L', 'R'].map((s) => {
    const g = new T.Group(); g.userData.side = s;
    g.add(new T.Mesh(new T.TorusGeometry(0.052, 0.006, 8, 28), silver));
    g.userData.bells = [];
    for (let i = 0; i < 10; i++) { const b = new T.Mesh(new T.SphereGeometry(0.0125, 8, 6), silver); g.add(b); g.userData.bells.push(b); }
    g.visible = false; scene.add(g); return g;
  });

  // choli details: a gold neck trim, a bodice hem and a row of mirrors
  const choliTrim = mk(new T.TorusGeometry(0.1, 0.007, 6, 28), gold);
  const choliHem = mk(new T.TorusGeometry(0.115, 0.01, 6, 28), gold);
  const choliMirrors = [];
  for (let i = 0; i < 7; i++) choliMirrors.push(mk(new T.CircleGeometry(0.011, 10), new T.MeshStandardMaterial({ color: 0xdfe8f2, metalness: 0.35, roughness: 0.18, emissive: 0x3a4a5c, side: T.DoubleSide, envMapIntensity: 2.2 })));

  // bare feet: the athlete wears sneakers, which are wrong for a courtyard dance: cover them with skin-coloured feet (and red alta on the toes)
  const skinHex = (i) => (i === 0 ? '#c8936a' : '#8c5a3c');
  const footCover = [0, 1].map((look) => ['L', 'R'].map(() => {
    const g = new T.Group();
    const mat = new T.MeshStandardMaterial({ color: skinHex(look), roughness: 0.62 });
    const f = new T.Mesh(new T.SphereGeometry(1, 18, 12), mat); g.add(f);
    const t = new T.Mesh(new T.SphereGeometry(1, 12, 8), new T.MeshStandardMaterial({ color: 0xb01c28, roughness: 0.55 })); g.add(t);
    g.userData = { f, t }; g.visible = false; scene.add(g); return g;
  }));
  // choli sleeves: short fitted sleeves in the blouse colour with a gold hem
  const sleeveMats = []; const sleeves = ['L', 'R'].map((side) => {
    const g = new T.Group();
    const mat = new T.MeshStandardMaterial({ color: PALETTES[0].choli, roughness: 0.7, side: T.DoubleSide }); sleeveMats.push(mat);
    const m = new T.Mesh(new T.CylinderGeometry(0.055, 0.05, 1, 16, 1, true), mat); g.add(m);
    const hem = new T.Mesh(new T.TorusGeometry(0.052, 0.006, 6, 20), gold); hem.rotation.x = Math.PI / 2; hem.position.y = -0.5; g.add(hem);
    g.userData = { side, m, hem }; g.visible = false; scene.add(g); return g;
  });

  // body collision for the veil: the torso as an ellipse stack between neck and waist
  const tmp = new T.Vector3(), tmp2 = new T.Vector3(), tmp3 = new T.Vector3(), qq = new T.Quaternion();
  const wp = (h, n, out = new T.Vector3()) => h.bones[`Bip01_${n}`].getWorldPosition(out);
  const bone = (h, n) => h.bones[`Bip01_${n}`];

  const S = { yaw: 0, yawSpin: 0, spinTarget: 0, spinVel: 0, lean: 0, leanV: 0, speed: 0, lastX: null, lastT: null, hip: 0, breath: 0, bobPh: 0, lookV: 0, armSwing: 0,
    pivot: new T.Vector3(0, 1.72, 0), head: new T.Vector3(), headC: new T.Vector3(), headQ: new T.Quaternion(), neckLean: 0, headLean: 0, arm: { L: { p: new T.Vector3(), pole: new T.Vector3(), q: new T.Quaternion(), init: false }, R: { p: new T.Vector3(), pole: new T.Vector3(), q: new T.Quaternion(), init: false } },
    footL: new T.Vector3(), footR: new T.Vector3(), waist: new T.Vector3(), accS: 0, lastVx: 0, steadyArm: 1, armBlend: 0 };
  D.S = S;

  function setPalette(idx) {
    if (D.palIdx === idx) return;
    D.palIdx = idx;
    const p = PALETTES[idx % PALETTES.length];
    const t = ghagraTextures(p);
    if (skirtMat.map) skirtMat.map.dispose();
    if (skirtMat.metalnessMap) skirtMat.metalnessMap.dispose();
    skirtMat.map = t.map; skirtMat.roughnessMap = t.orm; skirtMat.metalnessMap = t.orm; skirtMat.needsUpdate = true;
    const o = odhaniTexture(p);
    if (veilMat.map) veilMat.map.dispose();
    veilMat.map = o.map; veilMat.alphaMap = o.alpha; veilMat.needsUpdate = true;
    for (const h of people) { h.setKit({ top: p.choli, bottoms: p.skirt2, socks: p.skirt2 }); }
    sleeveMats.forEach((m) => m.color.set(p.choli));
  }

  /** Pose + dress her for this frame. v = state.v3, dt (s), clock, hands = pots.handTargets() (world points + elbow poles), events = new events. */
  D.update = function (v, dt, clock, pots, newEvents, fx) {
    const h = people[v.look % people.length];
    if (D.cur !== h) { if (D.cur) D.cur.root.visible = false; D.cur = h; h.root.visible = true; braidInit = false; veilInit = false; }
    setPalette((v.ai ?? 0) % PALETTES.length);

    // ---- where she is and which way she faces ----------------------------------------------------------------------------------------
    const x = v.x, vx = S.lastX === null ? 0 : (x - S.lastX) / Math.max(dt, 1e-3);
    const vxs = clamp(vx, -4, 4);
    S.speed += (Math.abs(vxs) - S.speed) * Math.min(1, dt * 9);
    S.vxS = (S.vxS ?? 0) + (vxs - (S.vxS ?? 0)) * Math.min(1, dt * 8);
    S.lastX = x;
    // facing follows the direction she travels (smoothed), back to the audience when she stops; a spin adds a full turn
    const sv = Math.abs(S.vxS), ramp = sstep((sv - 0.15) / 0.8);
    const travelYaw = Math.sign(S.vxS) * ramp * 0.95;
    {   // critically damped spring on the heading: the turn never jumps, whatever the sim does
      const w = 6.0, a = -2 * w * (S.yawV ?? 0) - w * w * (S.yaw - travelYaw);
      S.yawV = (S.yawV ?? 0) + a * dt; S.yaw += S.yawV * dt;
    }
    for (const e of newEvents) if (e.type === 'turn') S.spinTarget += -e.dir * TAU;
    {   // critically damped spring on the spin angle (no pops when two spins arrive close together)
      const w = 7.5, a = -2 * w * S.spinVel - w * w * (S.yawSpin - S.spinTarget);
      S.spinVel += a * dt; S.yawSpin += S.spinVel * dt;
      if (Math.abs(S.spinTarget) > TAU * 6 || (Math.abs(S.yawSpin - S.spinTarget) < 0.002 && Math.abs(S.spinVel) < 0.01 && Math.abs(S.spinTarget) > 0.1)) {
        const k = Math.round(S.spinTarget / TAU) * TAU; S.yawSpin -= k; S.spinTarget -= k;
      }
    }
    const spinning = Math.abs(S.spinVel);
    const yaw = S.yaw + S.yawSpin;
    // lean under the tower: the whole body leans a little the way the tower swings, with a hip sway on the beat
    const lean = clamp(v.th * 0.07 + vxs * -0.012, -0.1, 0.1);
    S.lean += (lean - S.lean) * Math.min(1, dt * 12);
    h.root.position.set(x, 0, 0);
    h.root.rotation.set(0, yaw, S.lean);
    h.facing = yaw;
    // legs: stride phase is driven by the distance she actually covers (Human.locomote picks idle / walk / jog from the speed)
    {   // any real travel is a walk (small steps under the long skirt); standing still is idle, so legs move exactly when she does
      const sp = spinning > 1.5 ? 0 : S.speed;
      h.locomote(sp > 0.18 ? Math.max(0.85, sp * 1.1) : 0, { fade: 0.25 });
    }
    h.setFingers('R', 'relaxed'); h.setFingers('L', 'relaxed');

    // ---- hands: one steadies the lowest pot, the other flows out in time with the beat -----------------------------------------------
    const T0 = pots.hands;
    const beatPhase = v.bp, side = (v.beatCount % 2 === 0) ? 1 : -1;
    const calm = v.playing ? 0 : 1;
    const sway = clamp(S.vxS * 0.04, -0.12, 0.12);
    for (const s of [1, -1]) {                         // s = +1: her left hand (+x)
      const free = s === side;                          // the free arm alternates every beat
      const k = free ? sstep(Math.sin(beatPhase * Math.PI)) : 0;
      const pt = (s === 1 ? T0.L : T0.R);
      const target = tmp.set(pt.p.x, pt.p.y, pt.p.z);
      const reach = target.clone();
      if (free) {
        const open = 0.16 + 0.1 * k + Math.abs(sway) * 0.5 + 0.12 * Math.min(1, spinning * 0.4);
        reach.set(pt.p.x + s * open, pt.p.y + 0.02 + 0.07 * k + 0.05 * Math.sin(clock * 3 + s), pt.p.z + 0.02);
      }
      {   // never ask for a straight arm: keep the wrist within 90% of the arm's length from the shoulder (no elbow flips at full extension)
        const sh = wp(h, `${s === 1 ? 'L' : 'R'}_UpperArm`, tmp3.clone()), d3 = reach.clone().sub(sh), maxR = 0.56;
        if (d3.length() > maxR) reach.copy(sh).addScaledVector(d3.normalize(), maxR);
      }
      const shP = wp(h, `${s === 1 ? 'L' : 'R'}_UpperArm`, tmp3.clone());
      // the elbow always points down, out and a little back from the SHOULDER (a pole tied to the hand flips the arm when the hand crosses it)
      const pole = new T.Vector3(shP.x + s * 0.3, shP.y - 0.3, shP.z - 0.55);
      // palm direction: the steadying palm faces the pot (fingers up, resting on its side); the free palm opens up and forward
      const sideName = s === 1 ? 'L' : 'R';
      const cpt = T0.c;
      const toPot = new T.Vector3(cpt.x - reach.x, 0, cpt.z - reach.z + 0.0); if (toPot.lengthSq() < 1e-6) toPot.set(-s, 0, 0); toPot.normalize();
      // both palms keep facing the stack (the free one lifts a little as it opens): the same forearm roll all the time, so no wrap-around flips
      const pn = toPot.clone().multiplyScalar(free ? 0.8 : 0.92).add(new T.Vector3(0, free ? 0.45 : 0.12, free ? 0.15 : 0.1)).normalize();
      const PX = globalThis.__palm || {};
      const fx = free ? new T.Vector3(s * (PX.fa ?? 0.35), 0.9, PX.fz ?? 0.2) : new T.Vector3(-s * (PX.sa ?? 0.15), 1, PX.sz ?? 0.1);
      const hq = handQuat(h, sideName, pn, fx);
      // targets are smoothed (the free arm changes every beat: a jump would pop the elbow)
      const A = S.arm[sideName], kk = 1 - Math.exp(-dt * 12);
      if (!A.init) { A.p.copy(reach); A.pole.copy(pole); A.q.copy(hq); A.init = true; }
      A.p.lerp(reach, kk); A.pole.lerp(pole, kk); A.q.slerp(hq, kk);
      h.setReach(sideName, A.p, { weight: 1, pole: A.pole });
      h.setFingers(s === 1 ? 'L' : 'R', free ? 'open' : { curl: [[0.2, 0.25, 0.15], [0.12, 0.2, 0.12], [0.16, 0.24, 0.15], [0.2, 0.28, 0.17], [0.26, 0.34, 0.2]], spread: [0.12, 0.1, 0.02, -0.04, -0.1] });
    }
    // she looks at the audience, a touch up at the tower when it swings
    {
      const rel = Math.abs(Math.atan2(Math.sin(yaw), Math.cos(yaw)));
      const lw = 0.7 * (1 - sstep((rel - 0.35) / 0.55));
      const cur = S.lookW ?? lw;
      S.lookW = lw < cur ? lw : cur + (lw - cur) * Math.min(1, dt * 6);   // fades out at once, comes back slowly
      h.lookAt(tmp2.set(x + 0.2 * Math.sin(clock * 0.7), 1.65 + v.th * 0.6, 6), { weight: S.lookW, maxYaw: 0.9, maxPitch: 0.4 });
    }
    h.update(dt);
    // ---- palms: the forearm rolls (assisted, bounded, continuous) and the hand is turned so the palm faces the pot ----------------------
    for (const sd of ['L', 'R']) {
      const arm = h.arms[sd], wr = h.wrists[sd], A = S.arm[sd];
      if (!A.init) continue;
      arm.mid.updateWorldMatrix(true, false);
      const fq = arm.mid.getWorldQuaternion(new T.Quaternion());
      const rel = fq.clone().invert().multiply(A.q);
      const dq = wr.rest.clone().invert().multiply(rel);
      if (dq.w < 0) { dq.x *= -1; dq.y *= -1; dq.z *= -1; dq.w *= -1; }
      let th = 2 * Math.atan2(dq.x * wr.axis.x + dq.y * wr.axis.y + dq.z * wr.axis.z, dq.w);
      if (A.th !== undefined) { while (th - A.th > Math.PI) th -= TAU; while (th - A.th < -Math.PI) th += TAU; }
      A.th = th;
      const f = clamp(th * 0.8, -1.6, 1.6);
      arm.mid.quaternion.multiply(new T.Quaternion().setFromAxisAngle(wr.axis, f));
      arm.mid.updateWorldMatrix(false, true);
      const pq = arm.end.parent.getWorldQuaternion(new T.Quaternion()).invert();
      arm.end.quaternion.copy(pq.multiply(A.q));
      arm.end.updateWorldMatrix(false, true);
    }
    // ---- after the pose: neck and head take the balance (bones are read next, so this is part of the pose) -------------------------------
    const neck = bone(h, 'Neck'), head = bone(h, 'Head');
    const comp = clamp(-v.th * 0.45, -0.28, 0.28);
    S.headLean += (comp - S.headLean) * Math.min(1, dt * 10);
    qq.setFromAxisAngle(tmp.set(0, 0, 1), 0); void neck;
    const lq = new T.Quaternion();
    lq.setFromEuler(new T.Euler(0, 0, 0));
    head.updateWorldMatrix(true, false);
    // rotate about the world Z axis in the head's parent frame
    {
      const pq = head.parent.getWorldQuaternion(new T.Quaternion()).invert();
      const wz = new T.Vector3(0, 0, 1).applyQuaternion(pq).normalize();
      const rq = new T.Quaternion().setFromAxisAngle(wz, S.headLean * 0.7 - 0.0);
      head.quaternion.premultiply(rq);
      const nq = neck.parent.getWorldQuaternion(new T.Quaternion()).invert();
      const wn = new T.Vector3(0, 0, 1).applyQuaternion(nq).normalize();
      neck.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(wn, S.headLean * 0.3));
    }
    h.root.updateMatrixWorld(true);

    // ---- read the posed body ----------------------------------------------------------------------------------------------------------
    const headW = wp(h, 'Head', S.head), neckW = wp(h, 'Neck', tmp3.clone()), pel = wp(h, 'Pelvis'), sp = wp(h, 'Spine'), sp2 = wp(h, 'Spine2');
    {
      const bq = head.getWorldQuaternion(S.headQ), fr = h.boneFrame('Head');
      const l = fr.left.clone().applyQuaternion(bq), u = fr.up.clone().applyQuaternion(bq), f = fr.fwd.clone().applyQuaternion(bq);
      S.headQ.setFromRotationMatrix(new T.Matrix4().makeBasis(l, u, f));
      let top = 0.2, cen;
      if (h.headBox) {
        const b = h.headBox, mw = head.matrixWorld; cen = b.getCenter(new T.Vector3());
        let mx = -1e9; const c = new T.Vector3();
        for (let k = 0; k < 8; k++) { c.set(k & 1 ? b.max.x : b.min.x, k & 2 ? b.max.y : b.min.y, k & 4 ? b.max.z : b.min.z).applyMatrix4(mw); mx = Math.max(mx, c.dot(u)); }
        cen.applyMatrix4(mw); top = mx - cen.dot(u);
      } else cen = headW.clone().addScaledVector(u, 0.075);
      S.headC.copy(cen); S.crown = top;
      S.pivot.copy(cen).addScaledVector(u, top - 0.005);
    }
    S.neck = neckW; S.sp2 = sp2;
    const waistY = pel.y + (sp.y - pel.y) * 0.62 + 0.06, waistX = pel.x + (sp.x - pel.x) * 0.62, waistZ = pel.z + (sp.z - pel.z) * 0.62;
    S.waist.set(waistX, waistY, waistZ);

    // ---- ghagra ------------------------------------------------------------------------------------------------------------------------
    const acc = clamp(v.acc, -14, 14);
    const spinW = S.spinVel;                          // rad/s of the spin
    wp(h, 'L_Foot', S.footL); wp(h, 'R_Foot', S.footR);
    const feet = [S.footL, S.footR];
    const hemY = 0.15;
    const pos = skirtGeo.attributes.position;
    // per-column cloth state: hem lags the body (drag opposite to acceleration), flings outwards with spin, ripples with the wind
    const wind = v.wind || 0;
    const fa = [Math.atan2(feet[0].z - waistZ, feet[0].x - waistX), Math.atan2(feet[1].z - waistZ, feet[1].x - waistX)];
    const fr = [Math.hypot(feet[0].x - waistX, feet[0].z - waistZ), Math.hypot(feet[1].x - waistX, feet[1].z - waistZ)];
    const fy = [Math.max(0, feet[0].y - 0.08), Math.max(0, feet[1].y - 0.08)];
    const flareBase = 0.5 + 0.035 * Math.min(1, S.speed * 0.5) + 0.0;
    for (let i = 0; i <= SEG; i++) {
      const st = colState[i], a = (i / SEG) * TAU, ca = Math.cos(a), sa = Math.sin(a);
      // driving acceleration on the hem (m/s^2): opposite to the body's acceleration, plus the sideways whip of a spin, plus the wind
      const driveX = -acc * 0.18 - wind * 2.2 + (-spinW * sa) * 0.05;
      const driveZ = spinW * ca * 0.05 + (wind * 0.4) * Math.sin(clock * 2 + a * 2);
      const K = 70, C = 7.5;
      if (dt > 0) st.vx += (driveX - K * st.ox - C * st.vx) * dt; st.vz += (driveZ - K * st.oz - C * st.vz) * dt;
      st.ox += st.vx * dt; st.oz += st.vz * dt;
      st.ox = clamp(st.ox, -0.22, 0.22); st.oz = clamp(st.oz, -0.22, 0.22);
      // the hem lifts in front of a stepping foot and billows outward at the foot's angle
      let lift = 0, push = 0;
      for (let f = 0; f < 2; f++) {
        const da = Math.atan2(Math.sin(a - fa[f]), Math.cos(a - fa[f])), wgt = Math.exp(-da * da * 3.2);
        lift += wgt * fy[f] * 1.1; push += wgt * Math.max(0, fr[f] - 0.1) * 0.7;
      }
      st.lift = lift; st.push = push;
    }
    for (let j = 0; j <= RING; j++) {
      const s = j / RING, y = waistY + (hemY - waistY) * s;
      const prof = 0.3 * s + 0.7 * Math.pow(s, 2.1);
      const r0 = 0.15, r1 = flareBase * 1.16;
      const bell = 0.03 * Math.sin(Math.min(1, s * 5) * Math.PI * 0.5);
      for (let i = 0; i <= SEG; i++) {
        const st = colState[i % SEG === 0 && i === SEG ? 0 : i], a = (i / SEG) * TAU, ca = Math.cos(a), sa = Math.sin(a);
        const pleat = 1 + s * (0.026 * Math.sin(a * 14 + clock * 0.9 * 0 + s * 3) + 0.016 * Math.cos(a * 29 - spinW * clock * 0.0));
        const wave = s * (0.02 + 0.02 * Math.min(1, spinning * 0.35)) * Math.sin(a * 5 + clock * 3.1 + s * 5);
        const spinFlare = Math.min(0.2, spinW * spinW * 0.0045) * s * s;
        const r = (r0 + (r1 - r0) * prof + bell + spinFlare + st.push * s * s) * pleat + wave * 0.5;
        const cx = waistX * (1 - s) + (waistX * 0.9) * s;
        const hs = Math.pow(s, 2.4);
        const yy = y + st.lift * hs * 0.9 + (s > 0.97 ? Math.sin(a * 11 + clock * 4) * 0.006 : 0);
        pos.setXYZ(j * (SEG + 1) + i, cx + ca * r + st.ox * hs, yy, waistZ + sa * r * 0.82 + st.oz * hs);
      }
    }
    pos.needsUpdate = true; skirtGeo.computeVertexNormals();
    skirt.visible = true;

    // ---- odhani (verlet) ---------------------------------------------------------------------------------------------------------------
    {
      const hx = headW.x, hy = headW.y, hz = headW.z, sg = 0.125;
      const upQ = S.headQ;
      const grav = -6.5, g = grav * dt * dt, damp = 0.985;
      const wx = wind * 1.2 * dt * dt * 10;
      const pinned = (i) => {              // anchor along an arc over the back of the head, left ear to right ear
        const a = lerp(-1.7, 1.7, i / VW);                   // angle around the head, 0 = straight back
        tmp.set(Math.sin(a) * sg * 1.05, 0.065 + 0.03 * Math.cos(a), -Math.cos(a) * sg * 1.0).applyQuaternion(upQ);
        return tmp.add(S.headC);
      };
      if (!veilInit) {
        for (let j = 0; j <= VH; j++) for (let i = 0; i <= VW; i++) { const k = j * (VW + 1) + i, a = pinned(i); vp[k].set(a.x, a.y - j * REST_V, a.z - 0.02 * j); vq[k].copy(vp[k]); }
        veilInit = true;
      }
      void hx; void hy; void hz;
      // integrate (not while the presentation clock is stopped)
      if (dt > 0) for (let j = 1; j <= VH; j++) for (let i = 0; i <= VW; i++) {
        const k = j * (VW + 1) + i, p = vp[k], q = vq[k];
        const vx_ = (p.x - q.x) * damp, vy_ = (p.y - q.y) * damp, vz_ = (p.z - q.z) * damp;
        q.copy(p);
        p.x += vx_ + wx - acc * 0.0004 + 0; p.y += vy_ + g; p.z += vz_ + 0.0005 * Math.sin(clock * 2.3 + i * 0.7 + j * 0.3);
        // a spin throws the veil outwards
        if (spinning > 0.5) { const dx = p.x - waistX, dz = p.z - waistZ, rr = Math.hypot(dx, dz) || 1; const f = 0.0006 * spinning * (j / VH); p.x += dx / rr * f; p.z += dz / rr * f; p.x += -dz / rr * f * 0.4 * Math.sign(spinW); p.z += dx / rr * f * 0.4 * Math.sign(spinW); }
      }
      // constraints + body collision
      for (let it = 0; it < 3; it++) {
        for (let i = 0; i <= VW; i++) vp[i].copy(pinned(i));
        for (let j = 0; j <= VH; j++) for (let i = 0; i <= VW; i++) {
          const k = j * (VW + 1) + i;
          if (i < VW) cons(vp[k], vp[k + 1], REST_U, j === 0);
          if (j < VH) cons(vp[k], vp[k + VW + 1], REST_V, j === 0);
        }
        for (let j = 1; j <= VH; j++) for (let i = 0; i <= VW; i++) collide(vp[j * (VW + 1) + i]);
      }
      const pa = veilGeo.attributes.position;
      for (let k = 0; k < veilN; k++) pa.setXYZ(k, vp[k].x, vp[k].y, vp[k].z);
      pa.needsUpdate = true; veilGeo.computeVertexNormals();
      veil.visible = true;
    }
    function cons(a, b, rest, pinA) {
      tmp2.subVectors(b, a); const d = tmp2.length() || 1e-6, diff = (d - rest) / d;
      if (pinA) { b.addScaledVector(tmp2, -diff); } else { a.addScaledVector(tmp2, diff * 0.5); b.addScaledVector(tmp2, -diff * 0.5); }
    }
    function collide(p) {
      // torso: an elliptic cylinder from the waist to the shoulders, a sphere for the head, so the cloth rests on her instead of passing through
      const ty = clamp(p.y, waistY, neckW.y + 0.02);
      const t = (ty - waistY) / Math.max(0.05, neckW.y - waistY);
      const cx = lerp(waistX, neckW.x, t), cz = lerp(waistZ, neckW.z, t);
      const rx = lerp(0.145, 0.185, Math.sin(t * Math.PI * 0.8)) + 0.02, rz = lerp(0.105, 0.12, Math.sin(t * Math.PI * 0.8)) + 0.025;
      if (p.y > waistY - 0.1 && p.y < neckW.y + 0.1) {
        const dx = (p.x - cx) / rx, dz = (p.z - cz) / rz, d = Math.hypot(dx, dz);
        if (d < 1) { const s = d < 1e-4 ? 1 : 1 / d; p.x = cx + dx * s * rx; p.z = cz + dz * s * rz; }
      }
      // arms are not collided (the veil may hang between them): a skirt shell keeps it off the ghagra
      const dxh = p.x - S.headC.x, dyh = p.y - S.headC.y, dzh = p.z - S.headC.z, dh = Math.hypot(dxh, dyh, dzh), R = 0.14;
      if (dh < R && p.y < S.headC.y + 0.08) { const s = R / (dh || 1); p.x = S.headC.x + dxh * s; p.y = S.headC.y + dyh * s; p.z = S.headC.z + dzh * s; }
      if (p.y < waistY && p.y > hemY) {
        const rr = lerp(0.18, 0.55, (waistY - p.y) / (waistY - hemY));
        const dx = p.x - waistX, dz = p.z - waistZ, d = Math.hypot(dx, dz);
        if (d < rr) { const s = rr / (d || 1); p.x = waistX + dx * s; p.z = waistZ + dz * s; }
      }
      if (p.y < 0.02) p.y = 0.02;
    }

    // ---- braid: a verlet chain from the back of the head down the back --------------------------------------------------------------
    {
      const anchor = tmp.set(0.0, 0.02, -0.105).applyQuaternion(S.headQ).add(S.headC).clone();
      if (!braidInit) { for (let i = 0; i < BR; i++) { bp[i].set(anchor.x, anchor.y - i * 0.07, anchor.z - 0.02 * i); bq[i].copy(bp[i]); } braidInit = true; }
      bp[0].copy(anchor);
      const rest = 0.068, gr = -9 * dt * dt;
      if (dt > 0) for (let i = 1; i < BR; i++) {
        const p = bp[i], q = bq[i];
        const vx_ = (p.x - q.x) * 0.97, vy_ = (p.y - q.y) * 0.97, vz_ = (p.z - q.z) * 0.97; q.copy(p);
        p.x += vx_ - acc * 0.0006 * (i / BR) + wind * 0.002; p.y += vy_ + gr; p.z += vz_;
      }
      for (let it = 0; it < 4; it++) {
        bp[0].copy(anchor);
        for (let i = 0; i < BR - 1; i++) { const a = bp[i], b = bp[i + 1]; tmp2.subVectors(b, a); const d = tmp2.length() || 1e-6, diff = (d - rest) / d; if (i === 0) b.addScaledVector(tmp2, -diff); else { a.addScaledVector(tmp2, diff * 0.5); b.addScaledVector(tmp2, -diff * 0.5); } }
        for (let i = 1; i < BR; i++) {          // keep it off the back and under the veil: a plane behind the spine
          const p = bp[i]; const zb = lerp(S.neck.z, waistZ, clamp((S.neck.y - p.y) / Math.max(0.1, S.neck.y - waistY), 0, 1)) - 0.1;
          if (p.z > zb + 0.02 && p.y < S.neck.y) p.z = Math.min(p.z, zb - 0.0);
          if (p.z > zb - 0.1 && p.y < S.neck.y - 0.02 && p.y > waistY - 0.2) p.z = Math.min(p.z, zb - 0.01);
        }
      }
      const curve = new T.CatmullRomCurve3(bp.map((p) => p.clone()));
      braid.geometry.dispose();
      braid.geometry = new T.TubeGeometry(curve, 24, 0.03, 6, false);
      braid.visible = true;
      tassel.position.copy(bp[BR - 1]); tassel.visible = true;
    }

    // ---- jewellery and the choli ---------------------------------------------------------------------------------------------------------
    const upQ = S.headQ;
    const fw = tmp.set(0, 0, 1).applyQuaternion(upQ);
    {
      const nq = bone(h, 'Spine2').getWorldQuaternion(new T.Quaternion());
      const nf = new T.Vector3(0, 0, 1).applyQuaternion(nq), nu = new T.Vector3(0, 1, 0).applyQuaternion(nq);
      necklace.position.copy(neckW).addScaledVector(nu, -0.045).addScaledVector(nf, 0.03); necklace.quaternion.copy(nq); necklace.rotateX(Math.PI * 0.47); necklace.scale.set(0.62, 0.62, 0.8);
      necklace2.position.copy(neckW).addScaledVector(nu, -0.1).addScaledVector(nf, 0.05); necklace2.quaternion.copy(nq); necklace2.rotateX(Math.PI * 0.43); necklace2.scale.set(0.78, 0.7, 0.85);
      pendant.position.copy(neckW).addScaledVector(nu, -0.165).addScaledVector(nf, 0.1);
    }
    for (const m of [necklace, necklace2, pendant]) m.visible = true;
    tikka.position.copy(S.headC).addScaledVector(tmp2.set(0, 1, 0).applyQuaternion(upQ), 0.058).addScaledVector(fw, 0.108);
    tikkaChain.position.copy(S.headC).addScaledVector(tmp2.set(0, 1, 0).applyQuaternion(upQ), 0.1).addScaledVector(fw, 0.08);
    tikkaChain.quaternion.copy(upQ); tikkaChain.rotation.x += 0.0; tikkaChain.scale.set(1, 0.7, 1);
    tikka.visible = tikkaChain.visible = true;
    nath.position.copy(S.headC).addScaledVector(tmp2.set(0, 1, 0).applyQuaternion(upQ), -0.045).addScaledVector(fw, 0.105).addScaledVector(tmp3.set(1, 0, 0).applyQuaternion(upQ), 0.02);
    nath.quaternion.copy(upQ); nath.visible = true;
    jhumkas.forEach((g, i) => {
      const s = i === 0 ? 1 : -1;
      g.position.copy(S.headC).addScaledVector(tmp2.set(1, 0, 0).applyQuaternion(upQ), s * 0.082).addScaledVector(tmp3.set(0, 1, 0).applyQuaternion(upQ), -0.07).addScaledVector(fw, -0.012);
      g.rotation.z = clamp(S.vxS * -0.05 - S.lean * 2 - v.th * 0.3, -0.6, 0.6) + Math.sin(clock * 6 + i) * 0.04 * Math.min(1, S.speed); g.visible = true;
    });
    // choli trims follow the spine
    {
      const sp1 = wp(h, 'Spine2'), cl = wp(h, 'L_Clavicle');
      choliTrim.position.set(sp1.x, sp1.y + 0.1, sp1.z + 0.04); choliTrim.rotation.set(Math.PI * 0.5 - 0.35, 0, 0); choliTrim.scale.set(1.0, 0.8, 1);
      choliHem.position.set(sp.x * 0.5 + sp2.x * 0.5, sp.y * 0.5 + sp2.y * 0.5 - 0.04, sp.z * 0.5 + sp2.z * 0.5); choliHem.rotation.set(Math.PI * 0.5, 0, 0); choliHem.scale.set(1.0, 0.82, 1);
      choliTrim.visible = choliHem.visible = true;
      choliMirrors.forEach((m, i) => { const a = lerp(-0.9, 0.9, i / 6); m.position.set(sp1.x + Math.sin(a) * 0.12, sp1.y + 0.0 - 0.03 * Math.abs(Math.sin(a)), sp1.z + 0.085 + 0.01 * Math.cos(a)); m.visible = true; });
      void cl;
    }
    // bangles: stacked along the forearm from the wrist; armlets at the upper arm
    const handWorld = [];
    for (const m of bangles) {
      const sd = m.userData.side, hb = wp(h, `${sd}_Hand`, tmp2.clone()), fb = wp(h, `${sd}_Forearm`, tmp3.clone());
      const dir = hb.clone().sub(fb); const len = dir.length() || 1; dir.divideScalar(len);
      m.position.copy(hb).addScaledVector(dir, -0.028 - m.userData.b * 0.0125);
      m.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), dir);
      m.visible = true;
      if (m.userData.b === 0) handWorld.push(hb);
    }
    for (const m of armlets) {
      const sd = m.userData.side, ub = wp(h, `${sd}_UpperArm`, tmp2.clone()), fb = wp(h, `${sd}_Forearm`, tmp3.clone());
      const dir = fb.clone().sub(ub); const len = dir.length() || 1; dir.divideScalar(len);
      m.position.copy(ub).addScaledVector(dir, len * 0.35);
      m.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), dir); m.visible = true;
    }
    // anklets sit on the ankle, below the hem, and the ghungroo swing
    anklets.forEach((g) => {
      const sd = g.userData.side, ak = wp(h, `${sd}_Foot`, tmp2.clone()), cf = wp(h, `${sd}_Calf`, tmp3.clone());
      const dir = ak.clone().sub(cf).normalize().multiplyScalar(-1);
      g.position.copy(ak).addScaledVector(dir, 0.045);
      g.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), dir);
      g.userData.bells.forEach((b, i) => { const a = (i / 10) * TAU; const sw = Math.sin(clock * 11 + i * 1.7) * 0.006 * (0.4 + S.speed); b.position.set(Math.cos(a) * 0.052, Math.sin(a) * 0.052, -0.012 - Math.abs(sw) - 0.004); });
      g.visible = true;
    });
    // bare feet over the sneakers
    ['L', 'R'].forEach((sd, i) => {
      const g = footCover[v.look % 2][i], ak = wp(h, `${sd}_Foot`, tmp2.clone()), toe = wp(h, `${sd}_Toe0`, tmp3.clone());
      const d = toe.clone().sub(ak), len = d.length() || 0.1; d.divideScalar(len);
      g.position.copy(ak).addScaledVector(d, len * 0.52); g.position.y -= 0.012;
      g.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), d);
      g.userData.f.scale.set(0.044, 0.036, len * 0.78 + 0.03);
      g.userData.t.position.set(0, -0.006, len * 0.5 + 0.02); g.userData.t.scale.set(0.034, 0.02, 0.024);
      g.visible = true;
    });
    sleeves.forEach((g) => {
      const sd = g.userData.side, ub = wp(h, `${sd}_UpperArm`, tmp2.clone()), fb = wp(h, `${sd}_Forearm`, tmp3.clone());
      const dir = fb.clone().sub(ub), L = dir.length(); dir.divideScalar(L || 1);
      g.position.copy(ub).addScaledVector(dir, L * 0.30); g.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.clone().multiplyScalar(-1));
      g.userData.m.scale.set(1, L * 0.6, 1); g.userData.hem.position.y = -L * 0.3;
      g.visible = true;
    });
    void fx;
    S.accS = acc;
  };

  D.hide = () => { for (const p of people) p.root.visible = false; for (const g of [...footCover.flat(), ...sleeves]) g.visible = false; for (const m of [skirt, veil, braid, tassel, necklace, necklace2, pendant, tikka, tikkaChain, nath, ...jhumkas, ...bangles, ...armlets, ...anklets, choliTrim, choliHem, ...choliMirrors]) m.visible = false; };
  D.dispose = () => {};
  return D;
}
