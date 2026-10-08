// The stadium: pitch with markings, H-posts, corner flags, stands with a crowd, floodlights, sky, wind dust. Few meshes (low draw-call count).
// Sim axes in, three.js axes out: world x = -sim x (three.js is right handed, the camera looks along +z).
import { THREE } from '../vendor3d/index.js';
import { GOAL_HW, BAR_H } from '../src/consts.js';

const canvasTex = (w, h, draw, repeat) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
};
const rnd = (seed) => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
function mergeGeo(list) {
  const pos = [], uv = [], idx = []; let base = 0;
  for (const g of list) {
    const p = g.getAttribute('position'), u = g.getAttribute('uv'), ix = g.index;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0); }
    if (ix) for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + base); else for (let i = 0; i < p.count; i++) idx.push(i + base);
    base += p.count;
  }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); out.setIndex(idx); out.computeVertexNormals();
  return out;
}
const place = (g, x, y, z) => { g.translate(x, y, z); return g; };
const SKIES = [
  { top: '#4f8fd0', mid: '#a9d0ee', low: '#e3eef5', fog: '#cfe2ef', exp: 1.0 },
  { top: '#5b95d2', mid: '#b3d4ee', low: '#e8efe6', fog: '#d4e4ee', exp: 1.0 },
  { top: '#3f7fc6', mid: '#9fc8e8', low: '#dce9f2', fog: '#c5dcec', exp: 1.0 },
  { top: '#2c3f7a', mid: '#d98c6a', low: '#f6c58e', fog: '#d9a58a', exp: 0.95 },
  { top: '#27386e', mid: '#c4709a', low: '#f1a67a', fog: '#c78aa0', exp: 0.95 },
  { top: '#050a1c', mid: '#0d1a3a', low: '#1d2c52', fog: '#0f1a38', exp: 0.85 },
];

export function buildStadium(stage) {
  const g = new THREE.Group(); g.name = 'stadium';
  const HWp = 35, LEN = 100;                                   // half pitch width (touchlines at +-35 m), pitch runs from the dead-ball line z=+10 back to z=-90
  const ZMIN = -90, ZMAX = 10;
  // ---- ground texture: mown stripes, touchlines, try line, dead-ball line, 5 / 10 / 22 m lines, centre
  const PXM = 12, tw = Math.round((2 * (HWp + 40)) * PXM / 2), th = Math.round((ZMAX - ZMIN + 60) * PXM / 2);
  const X0 = -(HWp + 40), Z0 = ZMAX + 30;
  const sx = tw / (2 * (HWp + 40)), sz = th / (ZMAX - ZMIN + 60);
  const tex = canvasTex(tw, th, (c, w, h) => {
    const X = (x) => (x - X0) * sx, Z = (z) => (Z0 - z) * sz, r = rnd(7);
    c.fillStyle = '#2f8040'; c.fillRect(0, 0, w, h);
    for (let z = ZMAX + 30, i = 0; z > ZMIN - 30; z -= 5, i++) { c.fillStyle = i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'; c.fillRect(0, Z(z), w, 5 * sz); }
    for (let i = 0; i < 14000; i++) { c.fillStyle = r() < 0.5 ? 'rgba(20,70,25,0.16)' : 'rgba(150,200,90,0.10)'; c.fillRect(r() * w, r() * h, 2, 3); }
    c.fillStyle = 'rgba(8,36,20,0.38)'; c.fillRect(0, 0, X(-HWp - 2), h); c.fillRect(X(HWp + 2), 0, w, h);
    const line = (x0, z0, x1, z1, wd = 0.14, a = 0.92) => { c.strokeStyle = `rgba(250,250,244,${a})`; c.lineWidth = wd * sx; c.beginPath(); c.moveTo(X(x0), Z(z0)); c.lineTo(X(x1), Z(z1)); c.stroke(); };
    const dashed = (z, a = 0.8) => { for (let x = -HWp; x < HWp; x += 4) line(x, z, x + 2.2, z, 0.12, a); };
    line(-HWp, ZMAX, HWp, ZMAX); line(-HWp, ZMIN, HWp, ZMIN); line(-HWp, ZMIN, -HWp, ZMAX); line(HWp, ZMIN, HWp, ZMAX);
    line(-HWp, 0, HWp, 0, 0.2, 1);                               // the try line
    dashed(-5); dashed(-10, 0.6); line(-HWp, -22, HWp, -22, 0.16, 0.9); dashed(-40, 0.45); line(-HWp, -50, HWp, -50, 0.16, 0.9);
    for (const x of [-HWp + 5, HWp - 5, -HWp + 15, HWp - 15]) for (let z = -90; z < 0; z += 4) line(x, z, x, z + 2, 0.1, 0.55);
    // a faint mark where the posts stand and distance numbers painted in the grass
    c.fillStyle = 'rgba(255,255,255,0.28)'; c.font = `${Math.round(2.2 * sz)}px sans-serif`; c.textAlign = 'center';
    for (const [z, t] of [[-5, '5'], [-10, '10'], [-22, '22'], [-40, '40'], [-50, '50']]) { c.save(); c.translate(X(HWp - 2.8), Z(z) - 6); c.rotate(-Math.PI / 2); c.fillText(t, 0, 0); c.restore(); }
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2 * (HWp + 40), ZMAX - ZMIN + 60), new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, (Z0 + (ZMIN - 30)) / 2); g.add(ground);

  // ---- H-posts: two uprights, crossbar, padded bases (merged where possible; padding is a second coloured mesh)
  const postMat = new THREE.MeshStandardMaterial({ color: 0xfafaf4, roughness: 0.4, metalness: 0.2, emissive: 0x777770 });
  const padMat = new THREE.MeshStandardMaterial({ color: 0x1e4fa0, roughness: 0.8 });
  const UH = 11;
  const cyl = (x, y0, y1, r) => place(new THREE.CylinderGeometry(r, r, y1 - y0, 12), x, (y0 + y1) / 2, 0);
  const posts = new THREE.Mesh(mergeGeo([cyl(-GOAL_HW, 0, UH, 0.085), cyl(GOAL_HW, 0, UH, 0.085)]), postMat);
  g.add(posts);
  { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2 * GOAL_HW, 12), postMat); b.rotation.z = Math.PI / 2; b.position.set(0, BAR_H, 0); g.add(b); }
  const pads = new THREE.Mesh(mergeGeo([cyl(-GOAL_HW, 0, 1.9, 0.13), cyl(GOAL_HW, 0, 1.9, 0.13)]), padMat); g.add(pads);
  // tiny pennants on both uprights (wind cues) and corner flags
  const flagMat = new THREE.MeshBasicMaterial({ color: 0xffd34d, side: THREE.DoubleSide });
  const mkFlag = (len, h) => { const geo = new THREE.PlaneGeometry(len, h, 8, 1); geo.translate(len / 2, 0, 0); const m = new THREE.Mesh(geo, flagMat.clone()); return m; };
  const flags = [];
  const addFlag = (x, y, z, len, h, col) => { const f = mkFlag(len, h); f.material.color.set(col); f.position.set(x, y, z); g.add(f); flags.push({ m: f, len, base: f.geometry.getAttribute('position').array.slice() }); };
  addFlag(-GOAL_HW, UH - 0.5, 0, 1.6, 0.6, 0xffd34d); addFlag(GOAL_HW, UH - 0.5, 0, 1.6, 0.6, 0xffd34d);
  for (const x of [-HWp, HWp]) for (const z of [0, ZMAX]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.6, 6), new THREE.MeshStandardMaterial({ color: 0xffffff })); pole.position.set(x, 0.8, z); g.add(pole);
    addFlag(x, 1.45, z, 0.6, 0.35, 0xe84e3c);
  }
  // goal-line boards, the try line sponsors area is left blank on purpose (no marks)

  // ---- stands, hoardings and the crowd: one atlas texture, one material
  const AT_H = 256;
  const atlas = canvasTex(1024, AT_H, (c, w, h) => {
    const r = rnd(21); c.fillStyle = '#1a2230'; c.fillRect(0, 0, w, h);
    const cols = ['#d94f3d', '#e9c35a', '#4c8fd6', '#eaeaee', '#5fb589', '#9b6fd0', '#e48b3e', '#2c3340', '#f2a1b8', '#ffffff'];
    for (let row = 0; row < 12; row++) for (let i = 0; i < 230; i++) { c.fillStyle = cols[Math.floor(r() * cols.length)]; c.globalAlpha = 0.85; const x = i * 4.5 + r() * 2, y = 8 + row * 14 + r() * 3; c.beginPath(); c.arc(x, y, 2.6, 0, 6.3); c.fill(); c.fillStyle = 'rgba(255,224,190,0.9)'; c.beginPath(); c.arc(x, y - 5, 1.7, 0, 6.3); c.fill(); }
    c.globalAlpha = 1;
    c.fillStyle = '#0d141f'; c.fillRect(0, h - 70, w, 70);
    const bc = ['#1e4fa0', '#e9c35a', '#2f7d5a', '#d94f3d', '#f4f1e8'];
    for (let i = 0; i < 16; i++) { c.fillStyle = bc[i % bc.length]; c.fillRect(i * 64 + 2, h - 62, 60, 54); c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(i * 64 + 2, h - 62, 60, 8); c.fillStyle = 'rgba(255,255,255,0.85)'; c.beginPath(); c.arc(i * 64 + 32, h - 35, 12, 0, 6.3); c.fill(); }
  }, [1, 1]);
  const strip = (x0, z0, x1, z1, y0, y1, vA, vB, tiles = 6) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([x0, y0, z0, x1, y0, z1, x0, y1, z0, x1, y1, z1], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, vA, tiles, vA, 0, vB, tiles, vB], 2)); geo.setIndex([0, 1, 2, 2, 1, 3, 0, 2, 1, 2, 3, 1]); return geo;
  };
  const CROWD = [0, 0.74], BOARD = [0.76, 1.0];
  const tiers = [];
  // behind the posts (z > 0): two tiers; each side: one tier
  for (let k = 0; k < 3; k++) { tiers.push(strip(-55, ZMAX + 14 + k * 6, 55, ZMAX + 14 + k * 6, 1 + k * 3.4, 4.6 + k * 3.4, CROWD[0], CROWD[1], 8)); tiers.push(place(new THREE.BoxGeometry(110, 0.6, 6.2), 0, 1 + k * 3.4 - 0.3, ZMAX + 16.2 + k * 6)); }
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { tiers.push(strip(s * (HWp + 9 + k * 6), ZMIN + 6, s * (HWp + 9 + k * 6), ZMAX + 12, 1 + k * 3.4, 4.6 + k * 3.4, CROWD[0], CROWD[1], 10)); tiers.push(place(new THREE.BoxGeometry(6.2, 0.6, 118), s * (HWp + 11 + k * 6), 1 + k * 3.4 - 0.3, -40)); }
  tiers.push(strip(-HWp - 3, ZMAX + 3, HWp + 3, ZMAX + 3, 0, 1.1, BOARD[0], BOARD[1], 8));
  for (const s of [-1, 1]) tiers.push(strip(s * (HWp + 3), ZMAX + 3, s * (HWp + 3), ZMIN + 6, 0, 1.1, BOARD[0], BOARD[1], 10));
  const roof = place(new THREE.BoxGeometry(112, 0.5, 8), 0, 13.6, ZMAX + 29); tiers.push(roof);
  const stands = new THREE.Mesh(mergeGeo(tiers), new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.9, side: THREE.DoubleSide, emissive: 0x000000 }));
  g.add(stands);
  // crowd twinkle: camera flashes in the dark grounds (instanced specks)
  const specks = (n, size, color, opacity) => {
    const m = new THREE.InstancedMesh(new THREE.SphereGeometry(size, 4, 3), new THREE.MeshBasicMaterial({ color, transparent: true, opacity }), n);
    m.frustumCulled = false; const mat = new THREE.Matrix4();
    return { mesh: m, set(i, x, y, z, s = 1) { mat.makeScale(s, s, s); mat.setPosition(x, y, z); m.setMatrixAt(i, mat); }, done() { m.instanceMatrix.needsUpdate = true; } };
  };
  const NF = 90, fl = specks(NF, 0.22, 0xffffff, 0.9); const fpos = []; const rr = rnd(5);
  for (let i = 0; i < NF; i++) { const k = Math.floor(rr() * 3); fpos.push([(rr() - 0.5) * 100, 2.5 + k * 3.4 + rr() * 2, ZMAX + 16 + k * 6 - 0.5]); fl.set(i, ...fpos[i]); }
  fl.done(); g.add(fl.mesh); const flashes = fl.mesh;
  // floodlight towers (4)
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff6d6 });
  const tower = (x, z) => { const m = place(new THREE.BoxGeometry(0.7, 26, 0.7), x, 13, z); const lamps = place(new THREE.BoxGeometry(5, 3, 0.5), x, 26.5, z); return [m, lamps]; };
  const tg = [], lg = [];
  for (const [x, z] of [[-58, ZMAX + 16], [58, ZMAX + 16], [-52, -70], [52, -70]]) { const [a, b] = tower(x, z); tg.push(a); lg.push(b); }
  g.add(new THREE.Mesh(mergeGeo(tg), new THREE.MeshStandardMaterial({ color: 0x5a6270, roughness: 0.6, metalness: 0.4 })));
  const lamps = new THREE.Mesh(mergeGeo(lg), lampMat); g.add(lamps);
  // far outfield
  const far = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: 0x1f5a30, roughness: 1 })); far.rotation.x = -Math.PI / 2; far.position.set(0, -0.05, -40); g.add(far);
  // wind dust: slow drifting specks near the kicker
  const N = 70, dust = specks(N, 0.035, 0xf3ecd2, 0.55), dp = [], dr = rnd(9);
  for (let i = 0; i < N; i++) { dp.push([(dr() - 0.5) * 30, 0.2 + dr() * 5, (dr() - 0.5) * 40 - 12]); dust.set(i, ...dp[i]); }
  dust.done(); g.add(dust.mesh);
  stage.add(g);

  const api = {
    group: g, flags, dust: dust.mesh, flashes, lamps, stands,
    // sky + light per ground
    setGround(idx, stageRef) {
      const S = SKIES[idx] || SKIES[1];
      const c = document.createElement('canvas'); c.width = 4; c.height = 256; const x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, 256);
      gr.addColorStop(0, S.top); gr.addColorStop(0.6, S.mid); gr.addColorStop(1, S.low); x.fillStyle = gr; x.fillRect(0, 0, 4, 256);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; stageRef.scene.background = t;
      stageRef.setSky(S.mid, S.fog, { near: 110, far: 300 });
      const mode = idx >= 5 ? 'night' : idx >= 3 ? 'evening' : 'day';
      stageRef.setLighting(mode, { exposure: S.exp });
      lamps.visible = idx >= 3; flashes.visible = idx >= 3;
      stands.material.emissive.set(idx >= 5 ? 0x1c1a14 : 0x000000); stands.material.emissiveMap = idx >= 5 ? atlas : null; stands.material.needsUpdate = true;
    },
    // flags and dust follow the wind: w = {x, z} sim axes (m/s), t = seconds
    animate(w, t) {
      const sp = Math.hypot(w.x, w.z), ang = Math.atan2(-w.x, w.z);          // three axes: x mirrored
      for (const f of flags) {
        const arr = f.m.geometry.getAttribute('position'), n = arr.count;
        f.m.rotation.y = -ang + Math.PI * 0;                                 // the flag streams along the wind
        const amp = Math.min(0.5, 0.04 + sp * 0.035);
        for (let i = 0; i < n; i++) { const bx = f.base[i * 3]; const k = bx / f.len; arr.setZ(i, Math.sin(t * (4 + sp * 0.7) - bx * 6) * amp * k); arr.setY(i, f.base[i * 3 + 1] - k * Math.min(0.5, 0.9 - sp * 0.07) * (sp < 1 ? 1 : 0.2)); }
        arr.needsUpdate = true;
      }
      for (let i = 0; i < N; i++) {
        const q = dp[i]; q[0] -= w.x * 0.02; q[2] += w.z * 0.02; q[1] += Math.sin(t * 1.3 + i) * 0.003;
        if (q[0] > 15) q[0] -= 30; if (q[0] < -15) q[0] += 30; if (q[2] > 8) q[2] -= 40; if (q[2] < -32) q[2] += 40;
        dust.set(i, q[0], q[1], q[2]);
      }
      dust.done();
      flashes.material.opacity = 0.35 + 0.6 * Math.abs(Math.sin(t * 9.1));
    },
  };
  return api;
}

// the ball: a prolate spheroid with four panels, grip dimples painted on and a seam (original colours: no brand)
export function buildBall() {
  const tex = canvasTex(512, 256, (c, w, h) => {
    c.fillStyle = '#f2efe6'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#e1ded2'; for (let i = 0; i < 4; i += 2) c.fillRect(i * w / 4, 0, w / 4, h);
    const r = rnd(3); c.fillStyle = 'rgba(80,80,70,0.22)'; for (let i = 0; i < 1400; i++) { c.beginPath(); c.arc(r() * w, r() * h, 1.2, 0, 6.3); c.fill(); }
    c.strokeStyle = '#2b3a6b'; c.lineWidth = 5; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(i * w / 4, 0); c.lineTo(i * w / 4, h); c.stroke(); }
    c.fillStyle = '#2b3a6b'; c.fillRect(0, h * 0.42, w, 10); c.fillRect(0, h * 0.54, w, 10);
  });
  const geo = new THREE.SphereGeometry(1, 28, 16); geo.rotateX(Math.PI / 2);         // poles along +Z
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, metalness: 0 }));
  m.scale.set(0.095, 0.095, 0.155); m.name = 'ball';
  return m;
}
export function buildTee() {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.09, 0.1, 14), new THREE.MeshStandardMaterial({ color: 0x1b1b1f, roughness: 0.8 }));
  m.position.y = 0.05; return m;
}
export function buildGuide() { return null; }
